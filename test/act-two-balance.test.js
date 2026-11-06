import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {describeArmy,makeEncounter,aiProfile,encounterReward} from '../src/dungeon/encounters.js';
import {bossArmy,values,victoryMaterial,makeShop} from '../src/dungeon/balance.js';
import {wildChances} from '../src/dungeon/wild.js';
import {parsePosition} from '../src/lab/scenarios.js';

const pressure=army=>army.reduce((sum,p)=>sum+(values[p.type]??0)*(p.material==='stone'?1.65:p.material==='diamond'?2.3:1),0);

test('act II guards and unusual encounters bridge the established act I and III budgets',()=>{
 for(let seed=1;seed<=60;seed++)for(const floor of [1,2]){
  const strengths=[1,2,3].map(act=>{
   const r=new Run(seed,act);r.floor=floor;r.setupFloor();
   const guard=r.enemies.find(e=>e.guard),special=r.enemies.find(e=>e.special),hunter=r.enemies.find(e=>e.roaming&&!e.weak&&!e.wild);
   return {guard:pressure(describeArmy(guard,r)),special:pressure(describeArmy(special,r)),hunter:pressure(describeArmy(hunter,r))};
  });
  assert.ok(strengths[0].guard<strengths[1].guard&&strengths[1].guard<strengths[2].guard);
  assert.ok(strengths[0].special<strengths[1].special&&strengths[1].special<strengths[2].special);
  assert.ok(strengths[1].guard<strengths[1].hunter);
 }
 assert.ok(aiProfile(1,3).skill<aiProfile(2,1).skill&&aiProfile(2,3).skill<aiProfile(3,1).skill);
});

test('act II boss has an intermediate armored budget, full board, ordinary king and both material branches',()=>{
 const means=[0,0,0,0],branches=new Set();
 for(let seed=1;seed<=100;seed++)for(const act of [1,2,3,4]){
  const r=new Run(seed,act);r.floor=3;r.setupFloor();const boss=r.enemies[0];
  means[act-1]+=pressure(describeArmy(boss,r))/100;
  if(act!==2)continue;
  const preset=makeEncounter(r,boss,['queen','knight']),black=[...parsePosition(preset.fen).pieces.values()].filter(p=>p.color==='b');
  assert.equal(black.length,13);assert.deepEqual(preset.bounds,{left:0,right:7,bottom:1,top:8});
  assert.equal(black.find(p=>p.type==='k').hp,1);assert.equal(new Set(parsePosition(preset.fen).pieces.keys()).size,16);
  branches.add(black.some(p=>p.hp===3)?'diamond':'stone');
 }
 assert.ok(means[0]<means[1]&&means[1]<means[2]&&means[2]<means[3],`boss budgets ${means}`);assert.equal(branches.size,2);
 assert.deepEqual(bossArmy(1),['r','b','n','p','p','p','p']);
 assert.deepEqual(bossArmy(4),['q','r','r','b','b','n','n','p','p','p','p','p','p','p','p']);
});

test('act II introduces wild pairs gently and escalates without weakening the act III anchor',()=>{
 const first=wildChances(2,1),second=wildChances(2,2),third=wildChances(3,1);
 assert.ok(first.any*first.pair<=.08);assert.ok(first.any*first.pair<second.any*second.pair);
 assert.ok(first.any<second.any&&second.any<third.any);
 assert.ok(first.pair<second.pair&&second.pair<third.pair);
 assert.equal(wildChances(1,2).any,0);
 assert.ok(Math.abs(third.any-.75)<1e-9);assert.ok(Math.abs(third.pair-.55)<1e-9);
});

test('rebalance preserves generated old floors, boss positions and already opened shop stock',()=>{
 const r=new Run(39,2),guard=r.enemies.find(e=>e.guard);delete guard.army;
 const before=structuredClone(r.enemies);assert.deepEqual(Run.restore(r.snapshot()).enemies,before);
 r.floor=3;r.setupFloor();r.enemies[0].army=['q','r','b','n','p','p','p','p'];
 const fen=makeEncounter(r,r.enemies[0],[]).fen,restored=Run.restore(r.snapshot());
 assert.equal(makeEncounter(restored,restored.enemies[0],[]).fen,fen);
 r.stage='shop';r.shop=makeShop(r);r.shop.items[0].sold=true;r.shop.items[1].price=123;
 assert.deepEqual(Run.restore(r.snapshot()).shop,r.shop);
});

test('act II fixed income stays intermediate and every extra pawn pays only once on capture',()=>{
 const bonuses=[1,2,3].map(act=>{
  const r=new Run(91,act);let sum=0;
  for(const floor of [1,2,3]){r.floor=floor;r.setupFloor();sum+=victoryMaterial(r.enemies.find(e=>e.guard),act);}
  return sum;
 });
 assert.deepEqual(bonuses,[28,42,56]);
 const r=new Run(17,2);r.floor=3;r.setupFloor();const boss=r.enemies[0];
 const moves=boss.army.map(captured=>({color:'w',captured,hit:false}));
 assert.equal(encounterReward(boss,2),26);assert.equal(encounterReward(boss,2,moves),42);
 assert.equal(encounterReward(boss,2,[{color:'w',captured:'q',hit:true}]),26);
});
