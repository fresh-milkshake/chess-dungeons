import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {setGhostMode,revealMap,spawnMapEntity} from '../src/dungeon/map-debug.js';
import {advanceRoamers} from '../src/dungeon/patrol.js';
import {merchantOffers,leaveMerchant} from '../src/dungeon/merchants.js';
const free=r=>{for(let y=1;y<r.map.height-1;y++)for(let x=1;x<r.map.width-1;x++){const p={x,y};if(r.map.tiles[y*r.map.width+x]===1&&!r.map.world.tiles[`${x},${y}`]&&![r.player,r.map.start,r.map.exit,...r.enemies,...r.loot,...r.merchants].some(a=>a.x===x&&a.y===y))return p;}throw Error('No free cell');};

test('ghost crosses walls, holes, enemies and terrain without triggering encounters or hazards',()=>{
 const r=new Run(12);r.player={x:2,y:2};r.enemies=[{id:'guard',type:'q',x:3,y:2,lastSeen:{x:2,y:2},chasing:true}];r.loot=[];r.merchants=[];r.map.tiles[2*r.map.width+3]=0;r.map.tiles[2*r.map.width+4]=2;r.map.world.tiles['4,2']='heat';r.rootedMap=1;
 assert.equal(r.canStep(1,0),false);setGhostMode(r,true);assert.equal(r.rootedMap,0);assert.equal(r.enemies[0].lastSeen,undefined);
 assert.ok(r.step(1,0));assert.equal(r.stage,'exploring');assert.throws(()=>setGhostMode(r,false),/свободную/);
 assert.ok(r.step(1,0));assert.equal(r.stage,'exploring');assert.equal(r.map.world.round,0);
 r.player={x:0,y:0};assert.equal(r.canStep(-1,0),false);
 r.player=free(r);setGhostMode(r,false);assert.equal(r.debugMap.ghost,false);
});
test('ghost hides from roaming opponents including contact, and normal detection resumes',()=>{
 const r=new Run(33);const enemy=r.enemies.find(e=>e.roaming&&!e.weak);r.player={x:enemy.x,y:enemy.y};setGhostMode(r,true);advanceRoamers(r);assert.equal(r.stage,'exploring');assert.ok(r.enemies.every(e=>!e.lastSeen&&!e.chasing));
 r.debugMap.ghost=false;enemy.weak=true;r.player={x:enemy.x,y:enemy.y};advanceRoamers(r);assert.equal(enemy.chasing,true);
});
test('reveal covers entire current floor, persists through restore, resets on next floor',()=>{
 const r=new Run(11);setGhostMode(r,true);revealMap(r);assert.equal(r.visible.length,r.map.width*r.map.height);
 const restored=Run.restore(r.snapshot());assert.equal(restored.visible.length,r.visible.length);restored.floor=2;restored.setupFloor();assert.equal(restored.debugMap.reveal,false);assert.equal(restored.debugMap.ghost,true);assert.ok(restored.visible.length<restored.map.tiles.length);
});
test('spawners validate location and types and create distinct encounters',()=>{
 const r=new Run(21);assert.throws(()=>spawnMapEntity(r,{kind:'wild'},r.player));assert.throws(()=>spawnMapEntity(r,{kind:'wild',type:'p'},free(r)));
 for(const type of ['n','b','r','q','d']){const pos=free(r);spawnMapEntity(r,{kind:'wild',type},pos);const e=r.enemies.at(-1);assert.equal(e.type,type);assert.equal(e.hp,2);assert.equal(e.damage,2);assert.equal(e.roaming,true);}
 spawnMapEntity(r,{kind:'fight',type:'b'},free(r));assert.equal(r.enemies.at(-1).wild,undefined);assert.equal(r.enemies.at(-1).guard,undefined);
 assert.equal(new Set(r.enemies.map(e=>e.id)).size,r.enemies.length);
});
test('spawned shops enter without secret guards, preserve own stock across reload and restore original market',()=>{
 for(const kind of ['floor','secret']){
  let r=new Run(19);const plan=structuredClone(r.merchantPlan),original={act:1,version:3,offers:[],empowered:[]};r.floorMarket=original;
  spawnMapEntity(r,{kind},free(r));const merchant=r.merchants.at(-1),entrance={x:merchant.x,y:merchant.y};r.player=entrance;
  assert.ok(r.openMerchant(merchant));assert.equal(r.stage,`${kind}-shop`);const offer=merchantOffers(r).find(o=>o.kind==='piece'&&!o.costPieces);r.material=10000;assert.ok(r.buyMerchant(offer.id));
  r=Run.restore(r.snapshot());assert.ok(leaveMerchant(r));assert.deepEqual(r.player,entrance);assert.deepEqual(r.floorMarket,original);assert.deepEqual(r.merchantPlan,plan);
  const saved=r.merchants.find(m=>m.id===merchant.id);assert.ok(r.openMerchant(saved));assert.equal(merchantOffers(r).find(o=>o.id===offer.id).sold,true);leaveMerchant(r);
 }
});
