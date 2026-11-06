import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {WildRules} from '../src/battle/wild-rules.js';
import {worldMeta,biomePlan} from '../src/biomes/world.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {deploymentPreset,automaticDeployment} from '../src/dungeon/deployment.js';
import {pathTo,key} from '../src/dungeon/map.js';
const engine=()=>new WildRules(()=>{throw Error('Variant must not delegate unsupported rules to native chess');});
const fen=(position,tiles={},extra='')=>position+' @hunt=1'+extra+worldMeta({biome:'ruins',round:0,tiles});
test('biome plan keeps 1/3/1/1 variants, sparse hazards and reachable map content',()=>{
 const seen=new Set();for(let seed=0;seed<20;seed++){
  const plan=biomePlan(seed*257);assert.equal(plan[0],'garden');assert.ok(['forge','ice','crypt'].includes(plan[1]));assert.equal(plan[2],'ruins');assert.equal(plan[3],'court');seen.add(plan[1]);
  const run=new Run(seed*257);assert.equal(run.biome,plan[0]);for(const p of [run.map.exit,...run.enemies,...run.loot])assert.ok(pathTo(run.map,run.player,p).length);
  assert.ok(!run.map.world.tiles[key(run.player.x,run.player.y)]);assert.equal(Run.restore(run.snapshot()).biome,run.biome);
 }assert.equal(seen.size,3);
});
test('holes block sliders and destinations while dragon knight jumps still work',async()=>{
 const e=engine();let s=await e.request('load '+fen('7k/8/8/8/8/8/8/RD4K1 w - - 0 1',{a3:'hole',c2:'hole'}));
 assert.ok(!s.legal.includes('a1a4'));assert.ok(!s.legal.includes('b1c2'));assert.ok(s.legal.includes('b1d2'));assert.ok(!s.legal.includes('b1d3'));assert.ok(s.legal.includes('b1c3'));
});
test('reaper is limited to two unobstructed diagonal squares',async()=>{
 const e=engine();const s=await e.request('load '+fen('7k/8/8/3j4/8/8/8/K7 b - - 0 1'));
 assert.ok(s.legal.includes('d5f3'));assert.ok(!s.legal.includes('d5g2'));
});
test('vines hold for one own turn, serialize and restore correctly through undo',async()=>{
 const e=engine();await e.request('load '+fen('7k/8/8/8/8/8/8/R5K1 w - - 0 1',{a2:'vine'}));
 let s=await e.request('move a1a2');assert.equal(parsePosition(s.fen).pieces.get('a2').rooted,1);
 await e.request('move h8h7');s=await e.request('move g1f1');assert.equal(parsePosition(s.fen).pieces.get('a2').rooted??0,0);
 s=await e.request('undo');assert.equal(parsePosition(s.fen).pieces.get('a2').rooted,1);
});
test('ice collapses on departure, does not freeze the piece, and undo restores the floor',async()=>{
 const e=engine();await e.request('load '+fen('7k/8/8/8/8/8/8/1N4K1 w - - 0 1',{b1:'ice'}));
 let s=await e.request('move b1c3');let p=parsePosition(s.fen);assert.equal(p.pieces.world.tiles.b1,'hole');assert.equal(p.pieces.get('c3').iced,undefined);
 s=await e.request('undo');assert.equal(parsePosition(s.fen).pieces.world.tiles.b1,'ice');
});
test('heat removes armor, may kill a voluntary king and is restored by undo',async()=>{
 const e=engine();await e.request('load '+fen('7k/8/8/8/8/8/8/R5K1 w - - 0 1',{a2:'heat'},';a1=2/1/0'));
 await e.request('move a1a2');let s=await e.request('move h8h7');assert.equal(parsePosition(s.fen).pieces.get('a2').hp,1);
 await e.request('load '+fen('7k/8/8/8/8/8/8/6K1 w - - 0 1',{g2:'heat'}));await e.request('move g1g2');s=await e.request('move h8h7');assert.equal(s.gameResult.result,'loss');s=await e.request('undo');assert.ok(parsePosition(s.fen).pieces.has('g2'));
});
test('court guarantees an ordinary dragon and emperor; custom deployment preserves the world',()=>{
 const r=new Run(114,4);const enemy=r.enemies[0],preset=makeEncounter(r,enemy,[]),p=parsePosition(preset.fen).pieces;
 assert.equal([...p.values()].filter(p=>p.type==='d').length,1);assert.equal([...p.values()].find(p=>p.type==='d').hp,1);assert.equal([...p.values()].find(p=>p.emperor).hp,3);
 const deployed=deploymentPreset(r,enemy,automaticDeployment(r,enemy));assert.equal(parsePosition(deployed.fen).pieces.world.biome,'court');
});

test('emperor and final arena belong only to act four; act three retains its dragon',()=>{
 for(const act of [3,4]){
  const r=new Run(114,act);r.floor=act===4?1:3;r.setupFloor();
  const preset=makeEncounter(r,r.enemies[0],[]),pieces=parsePosition(preset.fen).pieces;
  assert.equal(r.biome,act===4?'court':'ruins');assert.equal([...pieces.values()].find(p=>p.emperor)?.hp,act===4?3:undefined);
  assert.ok([...pieces.values()].some(p=>p.type==='d'));assert.equal(preset.bounds.shape,act===4?'imperial':undefined);
 }
});
test('armored emperor transitions into royal final form on the actual game coordinator',async()=>{
 const e=engine();await e.request('load '+fen('3k4/8/8/8/8/8/8/3R2K1 w - - 0 1',{},';emperor=d8|3'));
 let s=await e.request('move d1d8');assert.equal(parsePosition(s.fen).pieces.get('d8').hp,2);assert.equal(s.check,false);
 await e.request('move d8e8');await e.request('move d1e1');s=await e.request('move e8e7');s=await e.request('move e1e7');assert.equal(parsePosition(s.fen).pieces.get('e7').hp,1);assert.equal(s.check,true);
});
test('a fully rooted side can wait and undo without deadlocking the turn',async()=>{
 const e=engine();let s=await e.request('load '+fen('7k/8/8/8/8/8/8/6K1 w - - 0 1',{g1:'vine'},';root=g1|1'));
 assert.deepEqual(s.legal,['0000']);s=await e.request('move 0000');assert.equal(parsePosition(s.fen).pieces.get('g1').rooted??0,0);s=await e.request('undo');assert.deepEqual(s.legal,['0000']);
});
test('variant AI searches legal moves using the same terrain state',async()=>{
 const e=engine();const s=await e.request('load '+fen('7k/8/8/8/8/8/8/R5K1 b - - 0 1',{h7:'heat'}));const reply=await e.request('search 3 100');assert.ok(s.legal.includes(reply.bestmove));assert.equal(reply.searchBackend,'variant');
});
