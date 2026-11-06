import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {deploymentPreset,initialDeployment,automaticDeployment,previousDeployment,deploymentSquares} from '../src/dungeon/deployment.js';
import {parsePosition} from '../src/lab/scenarios.js';
const fixture=()=>{const run=new Run(711);run.biome='court';const enemy=run.enemies.find(e=>e.guard);enemy.bounds={left:0,right:7,bottom:1,top:8};run.openEncounter(enemy);return {run,enemy};};
test('automatic formation is valid, deterministic and preserves resources across board shapes',()=>{
 for(let seed=1;seed<=40;seed++)for(let act=1;act<=3;act++){
  const run=new Run(seed,act);run.inventory.push(...'pppppbnrq'.split('').map((type,i)=>({id:`extra-${i}`,type,material:i%3===0?'ethereal':i%3===1?'stone':'glass'})));
  run.buffs=[{pieceId:'knight',remaining:1}];
  for(const enemy of run.enemies){const before=run.snapshot(),positions=automaticDeployment(run,enemy);assert.doesNotThrow(()=>deploymentPreset(run,enemy,positions));assert.deepEqual(automaticDeployment(run,enemy),positions);assert.deepEqual(run.snapshot(),before);assert.equal(Object.keys(positions).length,run.inventory.filter(p=>!['glass','ethereal'].includes(p.material)).length);}
 }
 const {run,enemy}=fixture();run.inventory.push(...Array.from({length:25},(_,i)=>({id:`many-${i}`,type:'p',material:'ordinary'})));const positions=automaticDeployment(run,enemy);assert.ok(Object.keys(positions).length<=16);assert.ok(positions.king);assert.doesNotThrow(()=>deploymentPreset(run,enemy,positions));
});
test('manual deployment preserves exact squares, identities, material and reserves',()=>{
 const {run,enemy}=fixture();run.inventory.push({id:'ether',type:'r',material:'ethereal'},{id:'glass',type:'p',material:'glass'},{id:'stone',type:'b',material:'stone'});run.buffs=[{pieceId:'stone',remaining:1}];
 const positions={king:'g1',queen:'d2',ether:'b1',glass:'c2',stone:'f1'},preset=deploymentPreset(run,enemy,positions);
 assert.deepEqual(preset.identities,{g1:'king',d2:'queen',b1:'ether',c2:'glass',f1:'stone'});
 assert.ok(!preset.deployed.some(p=>p.id==='knight'));assert.ok(preset.ethereal.includes('b1'));
 const pieces=parsePosition(preset.fen).pieces;assert.equal(pieces.get('f1').hp,2);assert.equal(pieces.get('f1').damage,2);assert.ok(pieces.get('c2').glass);
 assert.ok(run.inventory.some(p=>p.id==='ether'));assert.equal(run.buffs[0].remaining,1);
 run.deployment={enemyId:enemy.id,positions,revision:2};const restored=Run.restore(run.snapshot());
 assert.deepEqual(restored.deployment.positions,positions);
 restored.beginBattle([],positions);assert.ok(!restored.inventory.some(p=>p.id==='ether'));assert.ok(restored.inventory.some(p=>p.id==='knight'));assert.equal(restored.buffs[0].remaining,0);assert.equal(restored.deployment,null);
});
test('deployment rejects overlaps, unavailable pieces, forbidden cells, first-rank pawns and missing king',()=>{
 const {run,enemy}=fixture();run.inventory.push({id:'pawn',type:'p',material:'ordinary'});
 for(const [positions,pattern] of [[{king:'g1',queen:'g1'},/занята/],[{king:'g1',unknown:'d1'},/нет в отряде/],[{king:'g1',queen:'d4'},/трёх нижних/],[{king:'g1',pawn:'b1'},/Пешку/],[{queen:'d1'},/короля/]])assert.throws(()=>deploymentPreset(run,enemy,positions),pattern);
 assert.doesNotThrow(()=>deploymentPreset(run,enemy,{queen:'d1'},{validate:false}));
 const before=run.snapshot();assert.throws(()=>run.beginBattle([],{king:'g1',queen:'d8'}));assert.deepEqual(run.snapshot(),before);
});
test('preparation cannot start with either king in check and follows cropped boundaries',()=>{
 const {run,enemy}=fixture();enemy.army=[];assert.throws(()=>deploymentPreset(run,enemy,{king:'g1',queen:'b3'}),/вражескому королю/);
 enemy.bounds={left:1,right:6,bottom:2,top:7};
 assert.equal(deploymentSquares(enemy.bounds).length,18);const initial=initialDeployment(run,enemy);assert.equal(initial.positions.king,'f2');
 const preset=deploymentPreset(run,enemy,{king:'f2',queen:'d3',knight:'c4'});assert.ok(preset.fen.includes('*'));assert.equal(preset.identities.c4,'knight');
 assert.throws(()=>deploymentPreset(run,enemy,{king:'a2'}),/нижних/);
});

test('R excludes fragile materials unless independently enabled; never spends them',()=>{
 const {run,enemy}=fixture();
 run.inventory.push({id:'glass',type:'n',material:'glass'},{id:'ether',type:'n',material:'ethereal'});
 const before=run.snapshot();
 for(const glass of [false,true])for(const ethereal of [false,true]){
  const positions=automaticDeployment(run,enemy,{glass,ethereal});
  assert.equal(!!positions.glass,glass);assert.equal(!!positions.ether,ethereal);
  assert.doesNotThrow(()=>deploymentPreset(run,enemy,positions));
 }
 assert.deepEqual(run.snapshot(),before);
});

test('E recalls starting squares across reload and adapts to losses and cropped boards',()=>{
 const {run,enemy}=fixture();enemy.army=[];
 run.inventory.push({id:'glass',type:'n',material:'glass'},{id:'ether',type:'r',material:'ethereal'});
 const positions={king:'g1',queen:'d2',knight:'c2',glass:'a1',ether:'b1'};
 run.beginBattle([],positions);
 const restored=Run.restore(run.snapshot());restored.stage='encounter';
 assert.deepEqual(previousDeployment(restored,enemy),{king:'g1',queen:'d2',knight:'c2',glass:'a1'});
 restored.inventory=restored.inventory.filter(p=>p.id!=='glass');
 enemy.bounds={left:1,right:6,bottom:2,top:7};
 const recalled=previousDeployment(restored,enemy);assert.ok(!recalled.glass&&!recalled.ether);
 assert.equal(Object.keys(recalled).length,3);assert.doesNotThrow(()=>deploymentPreset(restored,enemy,recalled));
 assert.throws(()=>previousDeployment(new Run(1),enemy),/ещё нет/);
});
