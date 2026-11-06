import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WildRules,wildFen,wildLegal,validateWildSetup} from '../src/battle/wild-rules.js';
import {Battle} from '../src/battle/game.js';
import {Run} from '../src/dungeon/run.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {automaticDeployment,deploymentPreset} from '../src/dungeon/deployment.js';
import {invadingWild,settleWild} from '../src/dungeon/wild.js';
const bounds={left:0,right:7,bottom:1,top:8};
const piece=(type,color,hp=1)=>({type,color,hp,damage:1,glass:false});
const feral=(type='r',hp=2,aggro=null)=>({...piece(type,'wild',hp),wildId:'wild-test',aggro});
const coordinator=()=>new WildRules(async()=>{throw Error('No native call expected');});

test('both armies hit the same wild identity, only an actual attack switches aggro, undo restores it',async()=>{
 const engine=coordinator(),board=new Map([['h1',piece('k','w')],['h8',piece('k','b')],['a1',piece('r','w')],['a8',piece('r','b')],['a4',feral('r',2)]]);
 let state=await engine.request('load '+wildFen(board,bounds));
 assert.ok(state.legal.includes('a1a4'));
 state=await engine.request('move a1a4');assert.ok(state.hit);assert.equal(state.wildPieces[0].hp,1);assert.equal(state.wildPieces[0].aggro,'w');assert.equal(parsePosition(state.fen).turn,'b');
 // Add a fresh second armor layer to test both sides without killing the beast.
 const damaged=state.fen;engine.board.get('a4').hp=2;
 state=await engine.request('move a8a4');assert.ok(state.hit);assert.equal(state.wildPieces[0].aggro,'b');assert.equal(parsePosition(state.fen).turn,'x');
 const {pieces}=parsePosition(state.fen),wildMoves=wildLegal(pieces,bounds,'wild');
 assert.ok(wildMoves.includes('a4a8'));assert.ok(!wildMoves.includes('a4a1'));
 const best=await engine.request('search 3 25');assert.equal(best.bestmove,'a4a8');
 await engine.request('move '+best.bestmove);assert.equal(parsePosition((await engine.request('state')).fen).turn,'w');
 await engine.request('undo');state=await engine.request('undo');assert.equal(state.wildPieces[0].aggro,'w');assert.equal(state.wildPieces[0].hp,2);
 // A neutral move cannot change aggro.
 await engine.request('load '+damaged);state=await engine.request('move h8g8');assert.equal(state.wildPieces[0].aggro,'w');
});

test('an empowered capture kills wild armor; a solo encounter has no black army or invented king',async()=>{
 const engine=coordinator(),board=new Map([['h1',piece('k','w')],['a1',{...piece('r','w'),damage:2}],['a6',feral()]]);
 const fen=wildFen(board,bounds,'w','solo');assert.doesNotThrow(()=>validateWildSetup(fen));
 const root=await engine.request('load '+fen);assert.equal([...parsePosition(root.fen).pieces.values()].filter(p=>p.color==='b').length,0);
 const state=await engine.request('move a1a6');assert.equal(state.capturedWildId,'wild-test');assert.equal(state.gameResult.result,'win');
 assert.equal((await engine.request('undo')).fen,root.fen);
});

test('solo alternating turns, battle replay and complete round undo preserve wild HP and aggro',async()=>{
 const board=new Map([['h1',piece('k','w')],['b1',piece('n','w')],['f7',feral('n')]]),preset={id:'test-wild',fen:wildFen(board,bounds,'w','solo')};
 const battle=new Battle(coordinator());await battle.start(preset);
 await battle.move('b1c3');assert.equal(parsePosition(battle.state.fen).turn,'x');
 const response=await battle.engine.request('search 1 25');await battle.move(response.bestmove);assert.equal(parsePosition(battle.state.fen).turn,'w');
 const saved=battle.snapshot(),fen=battle.state.fen;
 const restored=new Battle(coordinator());await restored.restore(saved,preset);assert.equal(restored.state.fen,fen);
 await restored.undoTurn();assert.equal(restored.state.fen,preset.fen);assert.equal(restored.moves.length,0);
});

test('wild movement obeys blockers, two-hit armor, pawn promotion and cropped boundaries',async()=>{
 const b={left:1,right:6,bottom:2,top:7},board=new Map([['g2',piece('k','w')],['g7',piece('k','b')],['b6',piece('p','w')],['f5',feral('b')],['d3',piece('p','b')]]);
 assert.ok(wildLegal(board,b,'w').includes('b6b7q'));
 for(const uci of wildLegal(board,b,'wild'))assert.ok(uci[2]>='b'&&uci[2]<='g'&&Number(uci[3])>=2&&Number(uci[3])<=7);
 assert.ok(!wildLegal(board,b,'wild').includes('f5c2')); // blocked by d3
 const engine=coordinator();await engine.request('load '+wildFen(board,b,'w'));
 const state=await engine.request('move b6b7q');assert.equal(parsePosition(state.fen).pieces.get('b7').type,'q');
});

test('wild spawning starts in act II, is finite, repeatable and leaves the black hunter intact',()=>{
 const counts=new Set();
 for(let seed=1;seed<=180;seed++)for(let act=1;act<=3;act++){
  const run=new Run(seed,act),wild=run.enemies.filter(e=>e.wild);assert.ok(wild.length<=2);if(act===1)assert.equal(wild.length,0);else counts.add(wild.length);
  assert.deepEqual(wild,new Run(seed,act).enemies.filter(e=>e.wild));assert.ok(run.enemies.some(e=>e.roaming&&!e.wild));
  for(const enemy of wild){assert.ok((act===3?'qnrbd':'qnrb').includes(enemy.type));assert.equal(enemy.hp,2);const preset=makeEncounter(run,enemy,[]);assert.equal(preset.wildIds.length,1);assert.doesNotThrow(()=>deploymentPreset(run,enemy,automaticDeployment(run,enemy)));}
 }
 assert.deepEqual([...counts].sort(),[0,1,2]);
});

test('invasion is a nearby map actor, cannot clone, and settlement removes only killed participants',()=>{
 const run=new Run(80,2),guard=run.enemies.find(e=>e.guard);
 const near={...guard,id:'wild-near',type:'n',wild:true,hp:2},far={...run.player,id:'wild-far',type:'b',wild:true,hp:2};
 run.enemies=run.enemies.filter(e=>!e.wild).concat(near,far);assert.equal(invadingWild(run,guard)?.id,near.id);
 run.openEncounter(guard);const root=makeEncounter(run,guard,[]),again=makeEncounter(run,guard,['queen']);
 assert.deepEqual(root.wildIds,[near.id]);assert.deepEqual(root.wildIds,again.wildIds);
 const a=[...parsePosition(root.fen).pieces].find(([,p])=>p.wildId===near.id);assert.ok([root.bounds.left,root.bounds.right].includes(a[0].charCodeAt(0)-97));
 settleWild(run,root,[],[{id:near.id,hp:1,aggro:'b'}]);assert.equal(near.hp,1);
 settleWild(run,root,[{capturedWildId:near.id,color:'b'}],[]);assert.ok(!run.enemies.some(e=>e.id===near.id));assert.ok(run.enemies.some(e=>e.id===far.id));
 run.enemies=run.enemies.filter(e=>!e.wild);assert.equal(invadingWild(run,guard),null);run.ensureHunter();assert.equal(run.enemies.filter(e=>e.wild).length,0);
});

test('old save migration runs once and never adds beasts to a floor that already has wild actors',()=>{
 const run=new Run(80,2);run.enemies=run.enemies.filter(e=>!e.wild);run.enemies.push({...run.map.start,id:'wild-existing',type:'n',wild:true,hp:2});
 const old=run.snapshot();delete old.wildGeneration;
 const restored=Run.restore(old);assert.deepEqual(restored.enemies.filter(e=>e.wild).map(e=>e.id),['wild-existing']);
 restored.enemies=restored.enemies.filter(e=>!e.wild);assert.equal(Run.restore(restored.snapshot()).enemies.filter(e=>e.wild).length,0);
});
