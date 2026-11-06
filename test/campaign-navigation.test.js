import test from 'node:test';import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';import {jumpToFloor} from '../src/dungeon/navigation.js';
test('debug travel preserves resources; all floors are maps and last floors have exit bosses',()=>{
 const r=new Run(42,1,{preset:'high',overrideElo:1200});r.material=82;r.artifacts=['frost'];r.inventory.push({id:'extra',type:'r',material:'glass'});
 const inventory=structuredClone(r.inventory),plan=[...r.biomes];
 for(const [act,floor] of [[2,2],[3,3],[4,1],[1,1]]){
  assert.equal(jumpToFloor(r,act,floor),true);assert.equal(r.act,act);assert.equal(r.floor,floor);
  assert.equal(r.material,82);assert.deepEqual(r.inventory,inventory);assert.deepEqual(r.artifacts,['frost']);assert.equal(r.difficulty.overrideElo,1200);assert.deepEqual(r.biomes,plan);
  assert.equal(r.stage,'exploring');if(floor===3||act===4)assert.ok(r.enemies.find(e=>e.guard)?.boss);
 }
 const saved=r.snapshot();assert.equal(jumpToFloor(r,5,1),false);assert.equal(jumpToFloor(r,4,2),false);assert.equal(jumpToFloor(r,1,0),false);assert.deepEqual(r.snapshot(),saved);
});
