import { mkdir, readFile,writeFile } from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve,dirname} from 'node:path';import {WildRules} from '../src/battle/wild-rules.js';import {Run} from '../src/dungeon/run.js';import {automaticDeployment,deploymentPreset} from '../src/dungeon/deployment.js';
const filename=resolve('public/engine/dungeons.js'),m={exports:{}};new Function('module','exports','require','__filename','__dirname',await readFile(filename,'utf8'))(m,m.exports,createRequire(import.meta.url),filename,dirname(filename));const wasm=await m.exports({wasmBinary:await readFile('public/engine/dungeons.wasm'),print(){},printErr(){}});wasm.ccall('dungeon_init','number',[],[]);const native=c=>{const r=JSON.parse(wasm.ccall('dungeon_command','string',['string'],[c]));if(r.error)throw Error(r.error);return r;};
const results=[];
for(const [seed,act,floor] of [[0,1,1],[8,1,2],[0,2,1],[256,2,2],[512,2,3],[0,3,3],[0,4,1]]){
 const run=new Run(seed,act);run.floor=floor;run.setupFloor();const enemy=run.enemies.find(e=>floor===3?e.boss:e.guard),preset=deploymentPreset(run,enemy,automaticDeployment(run,enemy));const rules=new WildRules(native);let state=await rules.request('load '+preset.fen);if(state.legal.length)state=await rules.request('move '+state.legal[Math.floor(state.legal.length/2)]);
 // Warm the same backend before a measured fresh search.
 await rules.request('search 2 40');const start=performance.now(),reply=await rules.request('search 3 250');results.push({biome:run.biome,act,floor,ms:+(performance.now()-start).toFixed(2),depth:reply.depth,nodes:reply.nodes,bestmove:reply.bestmove,backend:reply.searchBackend??'native',legal:state.legal.includes(reply.bestmove)});
}
await mkdir('outputs', { recursive: true });
await writeFile(`outputs/ai-benchmark-${process.argv[2]??'after'}.json`,JSON.stringify(results,null,2));console.log(results);
