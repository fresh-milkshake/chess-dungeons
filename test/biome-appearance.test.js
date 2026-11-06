import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainSeed,biomeAppearance} from '../src/biomes/appearance.js';
import {actVariants} from '../src/lab/acts/catalog.js';
import {gardenDecorations,keepTerrainOverlay} from '../src/biomes/decoration.js';

test('garden decoration stays stable across rerenders and excludes occupied terrain candidates',()=>{
 const cells=Array.from({length:25},(_,i)=>({x:i%5,y:Math.floor(i/5)}));
 const before=structuredClone(cells),decor=gardenDecorations(cells);
 assert.equal(decor.length,10);assert.deepEqual(cells,before);
 assert.deepEqual(gardenDecorations([...cells].reverse()),decor);
 assert.ok(decor.every(p=>cells.some(c=>c.x===p.x&&c.y===p.y)));
});
test('expired root overlay is removed even when the piece remains on a vine tile',()=>{
 assert.equal(keepTerrainOverlay('vine',false,false,{kind:'vine',rooted:'true'}),false);
 assert.equal(keepTerrainOverlay('vine',false,false,{kind:'vine',rooted:'false'}),true);
 assert.equal(keepTerrainOverlay(undefined,true,false,{kind:'vine',rooted:'true'}),true);
 assert.equal(keepTerrainOverlay('vine',true,true,{kind:'vine',rooted:'true'}),false);
 assert.equal(keepTerrainOverlay('hole',false,false,{kind:'ice',rooted:'false'}),false);
});

test('lab and gameplay share the exact biome wall and chess-square palette',()=>{
 for(const theme of actVariants)for(const key of ['wall','light','dark'])assert.equal(theme[key],biomeAppearance[theme.id][key]);
});
test('procedural seeds stay in safe float32 range even far from the origin',()=>{
 const distinct=new Set();
 for(let y=0;y<100;y++)for(let x=0;x<100;x++){
  const seed=terrainSeed(`${x},${y}`);assert.ok(Number.isInteger(seed)&&seed>=0&&seed<1021);distinct.add(seed);
 }
 assert.ok(distinct.size>900);
 assert.equal(terrainSeed('2,4'),terrainSeed('c4'));
 assert.equal(terrainSeed('2,4'),857);
});
