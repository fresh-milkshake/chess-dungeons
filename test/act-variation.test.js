import test from 'node:test';import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';import {changeActVariation} from '../src/biomes/variation.js';
test('variation reload retains act, floor, inventory, difficulty and spent floor charges',()=>{
 const r=new Run(42,2,{preset:'high'});r.floor=2;r.setupFloor();r.material=97;r.artifacts=['frost'];r.artifactFloor.used={frost:1};r.deployment={positions:{}};
 const biome=r.biome,inventory=structuredClone(r.inventory),plan=[...r.biomes];
 assert.equal(changeActVariation(r,()=>0),true);assert.notEqual(r.biome,biome);assert.equal(r.act,2);assert.equal(r.floor,2);
 assert.equal(r.material,97);assert.deepEqual(r.inventory,inventory);assert.deepEqual(r.artifacts,['frost']);assert.equal(r.difficulty.preset,'high');assert.equal(r.artifactFloor.used.frost,1);assert.equal(r.deployment,undefined);
 assert.equal(r.biomes[0],plan[0]);assert.equal(r.biomes[2],plan[2]);assert.equal(Run.restore(r.snapshot()).biome,r.biome);assert.equal(r.map.world.biome,r.biome);
});
test('second act changes variation; other acts and active fights remain unchanged',()=>{
 const r=new Run(42,2),original=r.biome;assert.equal(changeActVariation(r,()=>0),true);assert.notEqual(r.biome,original);
 const final=new Run(42,1),snapshot=final.snapshot();assert.equal(changeActVariation(final),false);assert.deepEqual(final.snapshot(),snapshot);
 r.stage='battle';assert.equal(changeActVariation(r),false);
});
