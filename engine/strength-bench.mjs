import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {Chess} from 'chess.js';
import {scenarios} from '../src/lab/scenarios.js';
async function engine(folder) {
 const filename=resolve(folder,'dungeons.js'),commonjs={exports:{}};
 new Function('module','exports','require','__filename','__dirname',await readFile(filename,'utf8'))(commonjs,commonjs.exports,createRequire(import.meta.url),filename,dirname(filename));
 const mod=await commonjs.exports({wasmBinary:await readFile(resolve(folder,'dungeons.wasm')),print(){},printErr(){}});
 mod.ccall('dungeon_init','number',[],[]);
 return s=>JSON.parse(mod.ccall('dungeon_command','string',['string'],[s]));
}
const seedLines=[['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6'],['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7'],['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6'],['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6'],['e4','e6','d4','d5','Nc3','Bb4','e5','c5'],['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5']];
const ordinary=seedLines.flatMap((line,i)=>{const g=new Chess();const out=[];line.forEach((m,j)=>{g.move(m);if(j===3||j===7)out.push({id:`opening-${i}-${j}`,fen:g.fen()})});return out});
const special=[...scenarios.filter(s=>s.id!=='ethereal'),...ordinary.slice(0,8).map(p=>({...p,fen:p.fen+' @hunt=1;d1=2/1/0;d8=3/1/0;b1=1/2/0;g8=1/2/0'}))];
const before=await engine('.qa/strength/before'),after=await engine('public/engine'),baseline=await engine('.qa/strength/baseline');
const search=(cmd,p,depth,ms)=>{cmd('load '+p.fen);const t=performance.now();const r=cmd(`search ${depth} ${ms}`);return {move:r.bestmove,score:r.score,depth:r.depth,nodes:r.nodes,ms:performance.now()-t}};
// Warm all three JITs before timing, then alternate order to reduce order bias.
for(const cmd of [before,after,baseline])search(cmd,ordinary[0],5,3000);
const report={conditions:{upstream:'9f778da667f6e07dae1e85d3e2ea204fc6dee94d',nnue:false,threads:1,ordinaryDepth:7,specialBudgetMs:300,referenceBudgetMs:3000},ordinary:[],special:[],games:[]};
for(const [i,p] of ordinary.entries()){
 const row={id:p.id,fen:p.fen};
 for(const [name,cmd] of (i%2?[['after',after],['before',before],['baseline',baseline]]:[['baseline',baseline],['before',before],['after',after]])) row[name]=search(cmd,p,7,3000);
 row.beforeNeutral=search(before,{...p,fen:p.fen+' @hunt=0'},7,3000);
 row.afterNeutral=search(after,{...p,fen:p.fen+' @hunt=0'},7,3000);
 report.ordinary.push(row);console.log('ordinary',i,row.baseline.move,row.beforeNeutral.move,row.afterNeutral.move);
}
for(const [i,p] of special.entries()){
 const reference=search(after,p,12,3000),old=search(before,p,12,300),current=search(after,p,12,300);
 report.special.push({id:p.id,fen:p.fen,reference,before:old,after:current});console.log('special',i,reference.move,old.move,current.move);
}
await mkdir('.qa/strength',{recursive:true});await writeFile('.qa/strength/report.json',JSON.stringify(report,null,2));
// Paired colors on every special position; terminal states adjudicated by actual rules only.
for(const p of special)for(const swap of [false,true]){
 let state=after('load '+p.fen),plies=0,result='limit',winner=null;const moves=[];
 while(plies<100 && state.legal.length && !state.draw){
  const turn=state.fen.split(' ')[1],name=(turn==='w')!==swap?'after':'before',cmd=name==='after'?after:before;
  cmd('load '+state.fen);const r=cmd('search 12 40');if(!state.legal.includes(r.bestmove))throw Error('illegal '+name);
  state=after('load '+state.fen);state=after('move '+r.bestmove);moves.push(r.bestmove);plies++;
 }
 if(!state.legal.length){result=state.check?'mate':'stalemate';if(state.check){const losing=state.fen.split(' ')[1];winner=(losing==='b')!==swap?'after':'before';}}else if(state.draw)result='draw';
 report.games.push({id:p.id,swap,plies,result,winner,moves,finalFen:state.fen});await writeFile('.qa/strength/report.json',JSON.stringify(report,null,2));console.log('game',p.id,swap,result,winner);
}
console.log(JSON.stringify({ordinary:report.ordinary.length,special:report.special.length,games:report.games.length}));
