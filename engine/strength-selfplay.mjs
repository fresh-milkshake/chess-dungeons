import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
async function load(folder){const f=resolve(folder,'dungeons.js'),m={exports:{}};new Function('module','exports','require','__filename','__dirname',await readFile(f,'utf8'))(m,m.exports,createRequire(import.meta.url),f,dirname(f));const e=await m.exports({wasmBinary:await readFile(resolve(folder,'dungeons.wasm')),print(){},printErr(){}});e.ccall('dungeon_init','number',[],[]);return s=>JSON.parse(e.ccall('dungeon_command','string',['string'],[s]));}
const before=await load('.qa/strength/before'),after=await load('public/engine');
const report=JSON.parse(await readFile('.qa/strength/report.json'));report.fixedDepthGames=[];
for(const p of report.special)for(const swap of [false,true]){
 let state=after('load '+p.fen),plies=0,result='limit',winner=null;const moves=[];
 while(plies<140&&state.legal.length&&!state.draw){const side=state.fen.split(' ')[1],name=(side==='w')!==swap?'after':'before',cmd=name==='after'?after:before;cmd('load '+state.fen);const r=cmd('search 5 3000');if(r.depth!==5)throw Error('Depth budget not reached');if(!state.legal.includes(r.bestmove))throw Error('Illegal');after('load '+state.fen);state=after('move '+r.bestmove);moves.push(r.bestmove);plies++;}
 if(!state.legal.length){result=state.check?'mate':'stalemate';if(state.check)winner=(state.fen.split(' ')[1]==='b')!==swap?'after':'before';}else if(state.draw)result='draw';
 report.fixedDepthGames.push({id:p.id,swap,plies,result,winner,moves,finalFen:state.fen});await writeFile('.qa/strength/report.json',JSON.stringify(report,null,2));console.log(p.id,swap,result,winner);
}
