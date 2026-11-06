import test from 'node:test';import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {campaignActs,floorsInAct,bossAtExit,totalFloors,secretRouteConcept} from '../src/dungeon/campaign.js';
import {pathTo} from '../src/dungeon/map.js';import {jumpToFloor} from '../src/dungeon/navigation.js';
test('normal route has ten explorable floors, four exit bosses and no separate boss floor',()=>{
 assert.equal(totalFloors,10);assert.deepEqual(campaignActs.map(a=>a.floors),[3,3,3,1]);
 for(let seed=0;seed<12;seed++)for(const {act,floors} of campaignActs)for(let floor=1;floor<=floors;floor++){
  const r=new Run(seed,act);r.floor=floor;r.setupFloor();const guard=r.enemies.find(e=>e.guard);
  assert.equal(r.stage,'exploring');assert.ok(r.map.rooms.length>=4);assert.equal(!!guard.boss,bossAtExit(act,floor));assert.deepEqual({x:guard.x,y:guard.y},r.map.exit);assert.ok(pathTo(r.map,r.player,r.map.exit).length);
  assert.equal(r.enemies.filter(e=>e.boss).length,bossAtExit(act,floor)?1:0);
  if(guard.boss){const path=pathTo(r.map,r.player,guard),previous=path.at(-2);r.player={...previous};r.step(guard.x-previous.x,guard.y-previous.y);assert.equal(r.stage,'encounter');assert.equal(r.encounterId,guard.id);}
 }
});
test('secret route is inactive design data and cannot be entered via normal debug travel',()=>{
 assert.equal(secretRouteConcept.implemented,false);assert.equal(secretRouteConcept.entry.act,3);assert.equal(secretRouteConcept.acts.at(-1).name,'Последний предел');
 const r=new Run(12);assert.equal(jumpToFloor(r,5,1),false);assert.throws(()=>new Run(12,5),/недоступен/);assert.equal(floorsInAct(4),1);assert.equal(jumpToFloor(r,4,2),false);
});
test('legacy saves keep loaded maps and active battles while extending future route and shop',()=>{
 const r=new Run(87);r.openEncounter(r.enemies.find(e=>e.guard));r.beginBattle(['queen']);
 const old=r.snapshot();delete old.campaignVersion;old.biomes=['garden','forge','court'];old.artifactPlan.version=1;old.artifactPlan.shops=old.artifactPlan.shops.filter(s=>s.act<3);
 const copy=Run.restore(old);assert.deepEqual(copy.map,r.map);assert.deepEqual(copy.active,r.active);assert.equal(copy.biomes[2],'ruins');assert.equal(copy.biomes[3],'court');assert.ok(copy.artifactPlan.shops.some(s=>s.act===3));
});
