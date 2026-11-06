import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {bossOptions,makeShop,caps} from '../src/dungeon/balance.js';
import {stoneTrophy} from '../src/dungeon/stone-rewards.js';
const win=(r,e=r.enemies.find(e=>e.guard))=>{r.openEncounter(e);r.beginBattle(['queen','knight']);r.finishBattle('win',new Set(r.inventory.map(p=>p.id)));};
test('only bosses grant one selected stone reward: pawn, minor, rook; never queen',()=>{
 for(let seed=1;seed<=40;seed++){
  const r=new Run(seed);
  for(let act=1;act<=4;act++){
   assert.equal(r.inventory.filter(p=>p.material==='stone').length,Math.min(3,act-1));
   for(const enemy of r.enemies)assert.equal(stoneTrophy(r,enemy),null);
   if(act<4){win(r);win(r);}win(r);
   const offers=r.pendingReward.options,stones=offers.filter(o=>o.material==='stone');assert.equal(stones.length,1);
   assert.ok((act===1?['p']:act===2?['n','b']:['r']).includes(stones[0].type));
   assert.ok(offers.every(o=>!(o.type==='q'&&o.material==='stone')));
   r.chooseBossReward(offers.indexOf(stones[0]));
   if(act<4){r.player={x:r.map.exit.x-1,y:r.map.exit.y};r.step(1,0);}
  }
  assert.equal(r.stage,'victory');assert.equal(r.inventory.filter(p=>p.material==='stone').length,3);
 }
 assert.equal(caps.stone,3);
});
test('shops only sell ordinary, glass and ether; fourth choice never increases stone supply',()=>{
 for(const act of [1,2,3])for(let seed=1;seed<=50;seed++){
  const r=new Run(seed,act);r.artifacts=['facet'];const choices=bossOptions(r);
  assert.equal(choices.length,4);assert.equal(choices.filter(p=>p.material==='stone').length,1);assert.equal(new Set(choices.map(p=>p.type+p.material)).size,4);
  const shop=makeShop(r);assert.ok(shop.items.every(p=>p.kind==='artifact'||['ordinary','glass','ethereal'].includes(p.material)));assert.deepEqual(shop,makeShop(r));
 }
});
test('old pending rewards and unsold stone stock migrate without deleting owned figures',()=>{
 const r=new Run(8);r.inventory.push({id:'legacy-queen',type:'q',material:'stone'});r.stage='boss-reward';r.pendingReward={stoneBalance:2,options:[{type:'q',material:'stone'}]};
 const migrated=Run.restore(r.snapshot());assert.equal(migrated.pendingReward.stoneBalance,3);assert.equal(migrated.pendingReward.options.filter(p=>p.material==='stone').length,1);assert.ok(migrated.inventory.some(p=>p.id==='legacy-queen'));
 migrated.stage='shop';migrated.shop=makeShop(migrated);migrated.shop.items[0]={...migrated.shop.items[0],material:'stone',price:40};
 const copy=Run.restore(migrated.snapshot());assert.equal(copy.shop.items[0].material,'glass');assert.equal(copy.shop.items[0].price,22);
});
