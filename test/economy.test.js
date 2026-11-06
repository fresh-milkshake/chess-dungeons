import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {victoryMaterial,makeShop} from '../src/dungeon/balance.js';
import {encounterReward} from '../src/dungeon/encounters.js';
import {piecePrice,pieceShopPool,artifactPrice,rewardCompensation} from '../src/dungeon/economy.js';
import {artifacts,artifactById} from '../src/artifacts/catalog.js';
import {rerollShop} from '../src/artifacts/rerolls.js';

test('mandatory three-floor acts fund a permanent upgrade without buying out the shop',()=>{
 for(let seed=1;seed<=30;seed++)for(const act of [1,2,3]){
  const run=new Run(seed,act);let income=0;
  for(let floor=1;floor<=3;floor++){run.floor=floor;run.setupFloor();income+=encounterReward(run.enemies.find(e=>e.guard),act);}
  assert.equal(income,[28,42,56][act-1]);const shop=makeShop(run);
  assert.ok(income>=piecePrice('n','ordinary',act));assert.ok(income<shop.items.reduce((sum,p)=>sum+p.price,0));
 }
});
test('income pays for encounter role and sums fractional salvage once per victory',()=>{
 assert.ok(victoryMaterial({type:'p',weak:true},1)<victoryMaterial({type:'p',guard:true},1));
 const moves=[{color:'w',captured:'p'},{color:'w',captured:'p'},{color:'w',captured:'q',hit:true},{color:'b',captured:'q'}];
 assert.equal(encounterReward({type:'n',reliquary:true},1,moves),1);
 assert.equal(encounterReward({type:'q',rewardless:true},3,moves),0);
 const reaper=encounterReward({type:'j',reliquary:true},2,[{color:'w',captured:'j'}]);assert.equal(reaper,1);assert.ok(Number.isInteger(reaper));
});
test('fresh stock and rerolled stock share prices, sold items retain historical prices',()=>{
 for(const act of [1,2,3]){
  const run=new Run(654,act);run.stage='shop';run.shop=makeShop(run);run.material=1000;run.artifacts=['merchant-die'];
  const sold=run.shop.items[0];sold.sold=true;sold.price=123;
  assert.equal(rerollShop(run),true);assert.equal(run.material,992);assert.equal(run.shop.items[0].price,123);
  for(const item of run.shop.items.filter(i=>!i.sold))assert.equal(item.price,item.kind==='artifact'?artifactPrice(artifactById(item.artifactId),act):piecePrice(item.type,item.material,act));
  const historical=run.snapshot();historical.shop.items[1].price=321;
  assert.equal(Run.restore(historical).shop.items[1].price,321);
 }
});
test('palace economy provides supplies instead of unusable currency and final shop discounts temporary pieces',()=>{
 const run=new Run(12,4);
 for(const enemy of run.enemies)assert.ok(encounterReward(enemy,4,[{color:'w',captured:'q'}])>=4);
 const choices=run.rewardOptions(run.loot[0]);assert.equal(choices.length,3);assert.ok(choices.every(o=>o.kind!=='material'||o.amount>=7));
 for(const material of ['glass','ethereal'])for(const type of ['n','b','r','q'])assert.ok(piecePrice(type,material,3)<piecePrice(type,material,2));
 for(let seed=1;seed<=60;seed++)assert.ok(makeShop(new Run(seed,3)).items.every(i=>i.artifactId!=='boss-die'));
 const legacy=new Run(87,3);legacy.artifactPlan.shops[2].artifacts[0]='boss-die';
 const offers=makeShop(legacy).items.filter(i=>i.kind==='artifact');assert.equal(offers.length,3);assert.ok(offers.every(i=>i.artifactId!=='boss-die'));assert.equal(new Set(offers.map(i=>i.artifactId)).size,3);
});
test('prices are integral, fragile supplies are cheaper than permanent counterparts and compensation cannot create a purchase loop',()=>{
 for(const act of [1,2,3])for(const [type,material] of pieceShopPool){const price=piecePrice(type,material,act);assert.ok(Number.isInteger(price)&&price>0);assert.ok(rewardCompensation(type,material)<price);}
 for(const type of ['p','n','b','r','q']){assert.ok(piecePrice(type,'ethereal',1)<piecePrice(type,'glass',1));assert.ok(piecePrice(type,'glass',1)<piecePrice(type,'ordinary',1));}
 for(const a of artifacts)assert.equal(a.price.length,3);
 assert.throws(()=>piecePrice('q','stone',1));assert.throws(()=>piecePrice('q','diamond',1));
});
