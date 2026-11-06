import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {campaignBattle} from '../src/dungeon/battle-link.js';
import {loadRun,saveRun} from '../src/dungeon/storage.js';
import {bossOptions} from '../src/dungeon/balance.js';
function fixture(act=1){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const run=new Run(72,act);run.floor=act===4?1:3;run.setupFloor();run.openEncounter(run.enemies.find(e=>e.boss));run.beginBattle(['queen']);saveRun(run,storage);
 return {run,storage,link:campaignBattle('?run='+run.id,storage),battle:{result:{result:'win'},moves:[]}};
}
test('boss reward is unclaimed across reload until chosen, then settlement and choice commit once',()=>{
 const {run,storage,link,battle}=fixture();const before=loadRun(storage).snapshot();
 assert.equal(loadRun(storage).stage,'battle');assert.equal(campaignBattle('?run='+run.id,storage).snapshot.moves.length,0);
 assert.throws(()=>link.claimBossReward(battle,99),/Выберите/);assert.deepEqual(loadRun(storage).snapshot(),before);
 link.claimBossReward(battle,0);let next=loadRun(storage);assert.equal(next.stage,'shop');assert.equal(next.act,1);assert.equal(link.closed,true);
 assert.equal(next.inventory.filter(p=>p.id==='boss-choice-1').length,1);const material=next.material;
 assert.throws(()=>link.claimBossReward(battle,1),/другой вкладке/);assert.equal(loadRun(storage).material,material);
 for(let i=0;i<next.map.width-1;i++)next.step(1,0);
 assert.equal(next.act,2);assert.equal(next.stage,'exploring');assert.notEqual(next.actAnnounced,next.act);
});
test('a failed reward save leaves the won battle available for retry',()=>{
 const {storage,link,battle}=fixture();const before=loadRun(storage).snapshot(),write=storage.setItem;
 storage.setItem=()=>{throw Error('quota');};assert.throws(()=>link.claimBossReward(battle,0),/quota/);assert.equal(link.run.stage,'battle');assert.equal(link.closed,false);
 assert.deepEqual(loadRun(storage).snapshot(),before);storage.setItem=write;link.claimBossReward(battle,0);assert.equal(loadRun(storage).stage,'shop');
});
test('final boss reward leads to run victory and cannot be chosen before winning',()=>{
 const {storage,link,battle}=fixture(4);assert.throws(()=>link.claimBossReward({...battle,result:null},0),/победите/);
 link.claimBossReward(battle,1);const next=loadRun(storage);assert.equal(next.stage,'victory');assert.equal(next.act,4);assert.ok(next.inventory.some(p=>p.id==='boss-choice-4'));
});

test('boss die rolls on the won board, survives reload and settles exactly the displayed choice',()=>{
 const {run,storage,link,battle}=fixture();link.run.artifacts=['boss-die'];battle.artifactRuntime={owned:['boss-die'],used:{},toggles:{}};
 const before=bossOptions(link.run);link.rerollBossReward(battle);const shown=bossOptions(link.run);assert.notDeepEqual(shown,before);assert.equal(loadRun(storage).stage,'battle');
 const reload=campaignBattle('?run='+run.id,storage);assert.deepEqual(bossOptions(reload.run),shown);assert.throws(()=>reload.rerollBossReward(battle),/недоступно/);reload.claimBossReward(battle,1);const choice=loadRun(storage).inventory.find(p=>p.id==='boss-choice-1');assert.equal(choice.type,shown[1].type);assert.equal(choice.material,shown[1].material);
});

test('failed boss die persistence preserves the charge for retry',()=>{
 const {storage,link,battle}=fixture();link.run.artifacts=['boss-die'];battle.artifactRuntime={owned:['boss-die'],used:{},toggles:{}};const write=storage.setItem;
 storage.setItem=()=>{throw Error('quota');};assert.throws(()=>link.rerollBossReward(battle),/quota/);assert.equal(battle.artifactRuntime.used['boss-die'],undefined);storage.setItem=write;link.rerollBossReward(battle);assert.equal(loadRun(storage).artifactFloor.used['boss-die'],1);
});
