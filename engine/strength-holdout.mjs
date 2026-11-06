import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
async function load(folder){const f=resolve(folder,'dungeons.js'),m={exports:{}};new Function('module','exports','require','__filename','__dirname',await readFile(f,'utf8'))(m,m.exports,createRequire(import.meta.url),f,dirname(f));const e=await m.exports({wasmBinary:await readFile(resolve(folder,'dungeons.wasm')),print(){},printErr(){}});e.ccall('dungeon_init','number',[],[]);return s=>JSON.parse(e.ccall('dungeon_command','string',['string'],[s]));}
const old=await load('.qa/strength/before'),current=await load('public/engine');
const report=JSON.parse(await readFile('engine/strength-results.json'));const games=[];
for(const [index,p] of report.special.entries())for(let seed=1;seed<=4;seed++){
 let state=current('load '+p.fen),random=seed+index*17;
 for(let ply=0;ply<6 && state.legal.length&&!state.draw;ply++){random=(Math.imul(random,1664525)+1013904223)>>>0;state=current('move '+state.legal[random%state.legal.length]);}
 if(!state.legal.length||state.draw)continue;
 const start=state.fen;
 for(const swap of [false,true]){
  state=current('load '+start);let plies=0;const moves=[];
  while(plies<140&&state.legal.length&&!state.draw){const side=state.fen.split(' ')[1],cmd=(side==='w')!==swap?current:old;cmd('load '+state.fen);const r=cmd('search 5 3000');if(r.depth!==5||!state.legal.includes(r.bestmove))throw Error('Invalid search');current('load '+state.fen);state=current('move '+r.bestmove);moves.push(r.bestmove);plies++;}
  const result=!state.legal.length?(state.check?'mate':'stalemate'):state.draw?'draw':'limit';const winner=result==='mate'?((state.fen.split(' ')[1]==='b')!==swap?'after':'before'):null;
  games.push({id:p.id,seed,swap,start,plies,result,winner,moves,finalFen:state.fen});
 }
 console.log(p.id,seed,games.length);
}
const summary=games.reduce((s,g)=>(s[g.winner??g.result]=(s[g.winner??g.result]||0)+1,s),{});
await writeFile('engine/strength-holdout.json',JSON.stringify({method:'Four deterministic seeds per root, six uniformly selected legal opening plies, then paired engine colors; depth 5, hash cleared at every root, 140 ply cap. Not an Elo calibration.',games,summary},null,2));console.log(summary);
