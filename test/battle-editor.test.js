import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {WildRules} from '../src/battle/wild-rules.js';
import {Battle} from '../src/battle/game.js';
import {editBattle} from '../src/battle/debug.js';
import {editPosition} from '../src/debug/position.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {Run} from '../src/dungeon/run.js';
import {saveRun,loadRun} from '../src/dungeon/storage.js';
import {campaignBattle} from '../src/dungeon/battle-link.js';
import {addDebugPiece} from '../src/dungeon/debug.js';
let native;
before(async()=>{
 const filename=resolve('public/engine/dungeons.js');
 const commonjs={exports:{}};new Function('module','exports','require','__filename','__dirname',await readFile(filename,'utf8'))(commonjs,commonjs.exports,createRequire(import.meta.url),filename,dirname(filename)); const factory=commonjs.exports;
 const wasmBinary=await readFile(resolve('public/engine/dungeons.wasm'));
 const module=await factory({wasmBinary,print:()=>{},printErr:()=>{}});
 module.ccall('dungeon_init','number',[],[]);
 native=command=>JSON.parse(module.ccall('dungeon_command','string',['string'],[command]));
});
const fen='6k1/8/8/8/8/8/8/R5K1 w - - 0 1 @hunt=1';
const fresh=async()=>{const battle=new Battle(new WildRules(native));await battle.start({id:'debug-test',fen,identities:{a1:'rook',g1:'king'},deployed:[{id:'rook',type:'r',material:'ordinary'},{id:'king',type:'k',material:'ordinary'}]});return battle;};
const pieces=battle=>parsePosition(battle.state.fen).pieces;

test('free debug movement swaps any sides and carries armor, ether and roster identity',async()=>{
 const battle=await fresh();await editBattle(battle,{kind:'piece',type:'n',color:'b'},'d5');
 await editBattle(battle,{kind:'material',material:'ethereal'},'a1');
 await editBattle(battle,{kind:'material',material:'power'},'a1');
 await editBattle(battle,{kind:'move',from:'a1'},'d5');
 assert.equal(pieces(battle).get('d5').color,'w');assert.equal(pieces(battle).get('d5').damage,2);
 assert.equal(pieces(battle).get('a1').color,'b');assert.deepEqual([...battle.ethereal],['d5']);
 assert.equal(battle.preset.identities.d5,'rook');assert.equal(battle.moves.length,0);
 const saved=battle.snapshot();await battle.restore(saved);assert.deepEqual([...battle.ethereal],['d5']);assert.equal(pieces(battle).get('a1').color,'b');
});


test('materials and free movement work with wild creatures, save replay retains metadata',async()=>{
 const battle=await fresh();await editBattle(battle,{kind:'piece',type:'r',color:'b'},'a8');
 await editBattle(battle,{kind:'piece',type:'n',color:'wild'},'d5');
 const id=pieces(battle).get('d5').wildId;
 battle.state=await battle.engine.request('load '+battle.state.fen.replace(`|${id}|-`,`|${id}|b`));
 await editBattle(battle,{kind:'material',material:'diamond'},'a1');
 await editBattle(battle,{kind:'material',material:'ethereal'},'a8');
 await editBattle(battle,{kind:'material',material:'power'},'a8');
 await editBattle(battle,{kind:'move',from:'d5'},'f4');
 assert.equal(pieces(battle).get('a1').hp,3);assert.equal(pieces(battle).get('a8').damage,2);assert.ok(battle.ethereal.has('a8'));
 assert.equal(pieces(battle).get('f4').wildId,id);assert.equal(pieces(battle).get('f4').aggro,'b');assert.equal(pieces(battle).get('f4').hp,2);
 const saved=battle.snapshot();await battle.restore(saved);assert.equal(pieces(battle).get('f4').wildId,id);assert.equal(pieces(battle).get('f4').aggro,'b');
 await editBattle(battle,{kind:'piece',type:'q',color:'wild'},'c4');assert.notEqual(pieces(battle).get('c4').wildId,id);
 await assert.rejects(editBattle(battle,{kind:'material',material:'stone'},'g1'),/Король/);
 await editBattle(battle,{kind:'remove',from:'f4'},null);assert.ok(!pieces(battle).has('f4'));assert.ok(battle.preset.debugRemovedWild.includes(id));
});

test('editor can delete and replace kings without leaving an unrecoverable save',async()=>{
 const battle=await fresh();await editBattle(battle,{kind:'remove',from:'g8'},null);assert.equal(battle.result.result,'win');
 const saved=battle.snapshot();await battle.restore(saved);assert.ok(!pieces(battle).has('g8'));
 await editBattle(battle,{kind:'piece',type:'k',color:'b'},'h8');assert.equal(battle.result,null);
 await editBattle(battle,{kind:'remove',from:'g1'},null);await editBattle(battle,{kind:'piece',type:'k',color:'w'},'h1');assert.equal(battle.preset.identities.h1,'king');
});

test('campaign redeployment restores the full pre-battle state without consuming ether or buffs twice',async()=>{
 const run=new Run(123);run.inventory.push({id:'ether',type:'r',material:'ethereal'});run.buffs=[{pieceId:'queen',remaining:1}];run.openEncounter(run.enemies.find(e=>e.guard));
 const original=Run.restore(run.snapshot()).snapshot();run.beginBattle(run.inventory.map(p=>p.id));assert.ok(!run.inventory.some(p=>p.id==='ether'));
 const persisted=Run.restore(JSON.parse(JSON.stringify(run)));persisted.material=999;persisted.prepareAgain();assert.deepEqual(persisted.snapshot(),original);
 persisted.beginBattle(persisted.inventory.map(p=>p.id));persisted.prepareAgain();assert.deepEqual(persisted.snapshot(),original);
});

test('campaign debug delete and swaps update persistent identities and removal of map wild actors',async()=>{
 const run=new Run(42);run.openEncounter(run.enemies.find(e=>e.guard));run.beginBattle(run.inventory.map(p=>p.id));
 Object.assign(run.active.preset,{fen,identities:{a1:'queen',g1:'king'},deployed:[run.inventory.find(p=>p.id==='queen'),run.inventory.find(p=>p.id==='king')]});
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};saveRun(run,storage);
 const campaign=campaignBattle('?run='+run.id,storage),battle=new Battle(new WildRules(native));await battle.start(campaign.preset);
 await editBattle(battle,{kind:'move',from:'a1'},'b3',campaign);assert.equal(loadRun(storage).active.preset.identities.b3,'queen');
 await editBattle(battle,{kind:'remove',from:'b3'},null,campaign);assert.ok(!loadRun(storage).inventory.some(p=>p.id==='queen'));
 campaign.run.prepareAgain();assert.ok(campaign.run.inventory.some(p=>p.id==='queen'));
});

test('wild debug map actors have proper strength and invalid wild roles are rejected',()=>{
 const run=new Run(123),cell=run.visible.map(s=>{const [x,y]=s.split(',').map(Number);return{x,y};}).find(c=>{try{addDebugPiece(Run.restore(run.snapshot()),{color:'wild',type:'n'},c);return true;}catch{return false;}});
 addDebugPiece(run,{color:'wild',type:'n'},cell);assert.ok(run.enemies.at(-1).wild);assert.equal(run.enemies.at(-1).hp,2);assert.equal(run.enemies.at(-1).damage,2);
 assert.throws(()=>editPosition(fen,[],{kind:'piece',type:'k',color:'wild'},'e4'),/Дикие/);
});

test('older active saves can return to preparation with spent ether and power restored',()=>{
 const run=new Run(123);run.inventory.push({id:'old-ether',type:'r',material:'ethereal'});run.buffs=[{pieceId:'queen',remaining:1}];run.openEncounter(run.enemies.find(e=>e.guard));run.beginBattle(run.inventory.map(p=>p.id));
 delete run.active.preparation;run.prepareAgain();assert.equal(run.stage,'encounter');assert.ok(run.inventory.some(p=>p.id==='old-ether'));assert.equal(run.buffs.find(b=>b.pieceId==='queen').remaining,1);assert.ok(run.deployment.positions.king);
});
