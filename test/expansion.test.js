import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {piecePrice} from '../src/dungeon/economy.js';
import {merchantPlan} from '../src/dungeon/merchant-plan.js';
import {pathTo,key,walkable} from '../src/dungeon/map.js';
import {merchantOffers,secretOffers,floorOffers,purchaseProblem,upgradePrice} from '../src/dungeon/merchants.js';
import {advanceRoamers} from '../src/dungeon/patrol.js';
import {deploymentLimit} from '../src/artifacts/mechanics.js';
import {scoutPatch,scoutingChoices,rechargeCandidates,exitDiscovered} from '../src/dungeon/scouting.js';
import {artifacts} from '../src/artifacts/catalog.js';
import {artifactUses} from '../src/artifacts/charges.js';
import {rarityOf,sourceAllowed,bossPreferred,rarities} from '../src/artifacts/rarity.js';
import {bossOptions,makeShop} from '../src/dungeon/balance.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {parsePosition} from '../src/lab/scenarios.js';
const secretRun=(seed=4)=>{const r=new Run(seed);Object.assign(r,r.merchantPlan.secret);r.setupFloor();r.enemies=r.enemies.filter(e=>!r.map.secret.guardIds.includes(e.id));r.openMerchant(r.merchants.find(m=>m.kind==='secret'));r.material=10000;return r;};

test('merchant locations are preplanned: one floor shop per I–III, never floor one; exactly one secret per run',()=>{
 const locations=new Set();for(let seed=1;seed<=40;seed++){
  const r=new Run(seed),plan=structuredClone(r.merchantPlan);assert.deepEqual(plan,merchantPlan(seed));let local=0,secret=0;
  for(let act=1;act<=4;act++)for(let floor=1;floor<=(act===4?1:3);floor++){
   r.act=act;r.floor=floor;r.setupFloor();assert.deepEqual(r.merchantPlan,plan);
   for(const shop of r.merchants){if(shop.kind==='secret'){secret++;locations.add(`${act}.${floor}`);assert.ok(['3.2','3.3','4.1'].includes(`${act}.${floor}`));}else{local++;assert.ok(act<=3&&floor>=2);assert.equal(r.floorMarket.offers.length,6);}}
   assert.deepEqual(Run.restore(r.snapshot()).merchants,r.merchants);
  }
  assert.equal(local,3);assert.equal(secret,1);
 }assert.equal(locations.size,3);
});
test('secret extension is connected, has a one-cell entrance, three mandatory roamers and a bypassable fixed elite',()=>{
 for(let seed=1;seed<=30;seed++){
  const r=secretRun(seed);r.closeMerchant();const area=r.map.secret;assert.ok(r.map.width>area.originalWidth);assert.equal(area.rooms.length,3);
  const blocked=new Set([key(area.optional.x,area.optional.y)]);assert.ok(pathTo(r.map,r.map.start,area.shop,blocked).length>0);
  assert.equal(r.enemies.find(e=>e.id==='secret-elite').roaming,undefined);
  const entrance=area.entrance;assert.equal(r.map.tiles[(entrance.y-1)*r.map.width+entrance.x],0);assert.equal(r.map.tiles[(entrance.y+1)*r.map.width+entrance.x],0);
 }
});
test('secret gate requires all three guards and patrols cannot leave the hidden region',()=>{
 const r=new Run(16);Object.assign(r,r.merchantPlan.secret);r.setupFloor();const shop=r.merchants.find(m=>m.kind==='secret');assert.equal(r.openMerchant(shop),false);
 const ids=r.map.secret.guardIds,allowed=new Set(r.map.secret.cells);assert.equal(ids.length,3);
 for(const id of ids)assert.ok(r.enemies.find(e=>e.id===id).roaming);
 r.enemies=r.enemies.filter(e=>e.region==='secret');r.stage='exploring';r.player={...r.map.start};
 for(let t=0;t<90;t++){advanceRoamers(r);for(const e of r.enemies.filter(e=>e.roaming))assert.ok(allowed.has(key(e.x,e.y)));}
 r.enemies=r.enemies.filter(e=>e.id!==ids[0]);assert.equal(r.openMerchant(shop),false);
 r.enemies=r.enemies.filter(e=>!ids.includes(e.id));assert.equal(r.openMerchant(shop),true);assert.equal(r.closeMerchant(),true);assert.deepEqual(r.player,r.map.start);
});
test('floor trades spend the specified pieces atomically, keep the king and remain sold after reload',()=>{
 const r=new Run(19);r.floor=2;r.setupFloor();r.floorMarket={act:1,offers:floorOffers(r)};r.stage='floor-shop';
 const offer=r.floorMarket.offers[0],before=r.snapshot();assert.equal(r.buyMerchant(offer.id),false);assert.deepEqual(r.inventory,before.inventory);
 for(let i=0;i<3;i++)r.inventory.push({id:'glass-'+i,type:'p',material:'glass'});
 assert.equal(r.buyMerchant(offer.id),true);assert.equal(r.inventory.filter(p=>p.material==='glass').length,0);assert.ok(r.inventory.some(p=>p.type==='p'&&p.material==='ordinary'));assert.ok(r.inventory.some(p=>p.id==='king'));assert.equal(r.material,0);
 const restored=Run.restore(r.snapshot());assert.equal(restored.buyMerchant(offer.id),false);assert.equal(restored.floorMarket.offers.length,6);
});

test('piece exchanges prefer unbuffed copies and require confirmation before losing empowerment',()=>{
 const r=new Run(19);r.floorMarket={act:1,offers:floorOffers(r)};r.stage='floor-shop';
 for(let i=0;i<4;i++)r.inventory.push({id:'glass-'+i,type:'p',material:'glass'});
 r.buffs.push({pieceId:'glass-0',remaining:5});
 assert.equal(r.buyMerchant('exchange-pawn'),true);assert.ok(r.inventory.some(p=>p.id==='glass-0'));assert.ok(r.buffs.some(b=>b.pieceId==='glass-0'));
 const s=new Run(19);s.floorMarket={act:1,offers:floorOffers(s)};s.stage='floor-shop';
 for(let i=0;i<3;i++)s.inventory.push({id:'glass-'+i,type:'p',material:'glass'});
 s.buffs.push({pieceId:'glass-0',permanent:true,remaining:0});const before=s.snapshot();
 assert.equal(s.buyMerchant('exchange-pawn'),false);assert.deepEqual(s.inventory,before.inventory);assert.deepEqual(s.buffs,before.buffs);
 assert.equal(s.buyMerchant('exchange-pawn',{confirmBuffLoss:true}),true);assert.equal(s.buffs.length,0);
});
test('secret shop sells at most one stone, never a stone queen, and charges fixed stage prices',()=>{
 for(const seed of [1,2,7]){
  const r=secretRun(seed),offers=merchantOffers(r),stones=offers.filter(o=>o.group==='stone');assert.equal(stones.length,4);assert.ok(stones.every(o=>o.type!=='q'));
  const stone=stones.find(o=>o.type==='r'),money=r.material;assert.equal(r.buyMerchant(stone.id),true);assert.equal(r.material,money-stone.price);assert.equal(r.inventory.filter(p=>p.material==='stone').length,1);assert.ok(stones.filter(o=>o!==stone).every(o=>o.withdrawn));assert.equal(r.buyMerchant(stones[0].id),false);
  const restored=Run.restore(r.snapshot());assert.equal(restored.secretMarket.stoneBought,true);assert.deepEqual(restored.secretMarket.offers,r.secretMarket.offers);
 }
 const r=secretRun(),price=secretOffers(r).map(o=>o.price);r.material=0;assert.deepEqual(secretOffers(r).map(o=>o.price),price);
 const p={type:'r',material:'stone'};assert.ok(upgradePrice(p,3,2)<upgradePrice(p,3,3));assert.ok(upgradePrice(p,3,3)<upgradePrice(p,4,1));assert.ok(upgradePrice(p,3,2)>upgradePrice({...p,material:'ordinary'},3,2));
});
test('slot payment requires confirmation, survives reload, keeps one slot and still receives Phalanx bonus',()=>{
 const r=secretRun(),offer=merchantOffers(r).find(o=>o.slots&&o.kind==='bundle'),start=r.snapshot();assert.equal(r.buyMerchant(offer.id),false);assert.equal(r.slotDebt,0);assert.deepEqual(r.inventory,start.inventory);
 assert.equal(r.buyMerchant(offer.id,{confirmSlots:true}),true);assert.equal(deploymentLimit(r),13);const restored=Run.restore(r.snapshot());assert.equal(deploymentLimit(restored),13);restored.artifacts.push('ranks');assert.equal(deploymentLimit(restored),16);
 const fresh=secretRun();fresh.slotDebt=15;assert.equal(deploymentLimit(fresh),1);assert.ok(purchaseProblem(fresh,merchantOffers(fresh).find(o=>o.slots)));
});
test('secret empowerment preserves armor and consumes only deployed battles; pawn empowerment is permanent',()=>{
 const r=secretRun();r.inventory.push({id:'stone',type:'n',material:'stone'},{id:'pawn',type:'p',material:'ordinary'});
 assert.equal(r.buyMerchant('empower',{pieceId:'king'}),false);assert.equal(r.buyMerchant('empower',{pieceId:'stone'}),true);assert.equal(r.buyMerchant('empower',{pieceId:'pawn'}),true);
 r.closeMerchant();const enemy=r.enemies.find(e=>e.guard),preset=makeEncounter(r,enemy,['stone','pawn']),pieces=[...parsePosition(preset.fen).pieces.values()];assert.ok(pieces.some(p=>p.type==='n'&&p.hp===2&&p.damage===2));assert.equal(r.inventory.find(p=>p.id==='stone').material,'stone');
 r.stage='exploring';r.openEncounter(enemy);r.beginBattle(['queen']);assert.equal(r.buffs.find(b=>b.pieceId==='stone').remaining,5);r.finishBattle('draw',new Set(r.inventory.map(p=>p.id)));
 r.openEncounter(enemy);r.beginBattle(['stone','pawn']);assert.equal(r.buffs.find(b=>b.pieceId==='stone').remaining,4);assert.equal(r.buffs.find(b=>b.pieceId==='pawn').permanent,true);r.finishBattle('draw',new Set(r.inventory.map(p=>p.id)));assert.ok(r.buffs.find(b=>b.pieceId==='pawn').permanent);
});
test('scouting reveals new terrain, exit outline reveals no surrounding cells, ineligible finds disappear',()=>{
 const r=new Run(71),patch=scoutPatch(r,7);assert.ok(patch.some(c=>!r.seen.includes(c)));const before=[...r.seen];
 r.stage='reward';r.pendingReward={options:[{kind:'exit',title:'Выход'}]};assert.equal(r.chooseReward(0),true);assert.equal(exitDiscovered(r),true);assert.deepEqual(r.seen,before);assert.ok(!scoutingChoices(r,7).some(o=>o.kind==='exit'));
 r.stage='reward';r.pendingReward={options:[{kind:'scout',title:'Карта'}]};assert.equal(r.chooseReward(0),true);assert.ok(r.seen.length>before.length);
 r.seen=r.map.tiles.map((_,i)=>key(i%r.map.width,Math.floor(i/r.map.width)));assert.equal(scoutPatch(r).length,0);assert.equal(scoutingChoices(r).length,0);
});
test('charge finds prioritize floor relics, allow an explicit target, restore exactly one and can be cancelled',()=>{
 const r=new Run(12);r.artifacts=['hex','hourglass','lastcrown'];r.artifactFloor.used={hourglass:2};r.artifactAct.used={hex:1};r.artifactRun={lastcrown:1};assert.equal(rechargeCandidates(r)[0],'hourglass');
 r.stage='reward';r.pendingReward={options:[{kind:'recharge'}]};r.chooseReward(0);assert.equal(r.stage,'reward');assert.equal(r.pendingReward.options.length,3);assert.equal(r.cancelRewardTarget(),true);assert.equal(r.pendingReward.options[0].kind,'recharge');r.chooseReward(0);const i=r.pendingReward.options.findIndex(o=>o.artifactId==='lastcrown');r.chooseReward(i);assert.equal(artifactUses(r).lastcrown,0);assert.equal(artifactUses(r).hourglass,2);
});
test('rarity pools preserve exploration exclusivity, all legendary relics enter secret stock and bosses prefer useful general relics',()=>{
 assert.equal(Object.keys(rarities).length,5);const stocked=new Set();
 for(let seed=1;seed<=70;seed++){
  const r=new Run(seed);for(const site of r.artifactPlan.sites.filter(s=>s.present))assert.ok(sourceAllowed(site.artifactId,'exploration'));
  for(const act of [1,2,3]){r.act=act;for(const item of makeShop(r).items.filter(i=>i.kind==='artifact'))assert.ok(sourceAllowed(item.artifactId,'shop'));const reward=bossOptions(r);assert.equal(reward.length,3);assert.equal(reward.filter(o=>o.material==='stone').length,1);assert.ok(bossPreferred(reward.find(o=>o.kind==='artifact').artifactId));}
  const secret=secretRun(seed);for(const item of merchantOffers(secret).filter(o=>o.kind==='artifact')){assert.equal(rarityOf(item.artifactId),'legendary');stocked.add(item.artifactId);}
 }
 for(const a of artifacts.filter(a=>rarityOf(a.id)==='legendary'))assert.ok(stocked.has(a.id));
});

test('local merchant boards preserve the floor and return to the entrance without advancing enemies',()=>{
 for(const secret of [false,true]){
  const r=new Run(21),site=secret?r.merchantPlan.secret:r.merchantPlan.floors[0];Object.assign(r,site);r.setupFloor();
  const merchant=r.merchants.find(m=>m.kind===(secret?'secret':'floor'));
  if(secret)r.enemies=r.enemies.filter(e=>!r.map.secret.guardIds.includes(e.id));
  r.player={x:merchant.x,y:merchant.y};const state=r.snapshot();assert.equal(r.openMerchant(merchant),true);
  assert.notDeepEqual(r.map,state.map);assert.equal(r.player.x,0);assert.equal(r.enemies.length,0);assert.equal(r.seen.length,r.map.tiles.length);
  const saved=Run.restore(r.snapshot());assert.deepEqual(saved.merchantVisit.map,state.map);assert.deepEqual(saved.map,r.map);
  while(saved.player.x<saved.map.exit.x)saved.step(1,0);
  assert.equal(saved.stage,'exploring');assert.deepEqual(saved.map,state.map);assert.deepEqual(saved.player,state.player);assert.deepEqual(saved.enemies,state.enemies);assert.deepEqual(saved.seen,state.seen);assert.equal(saved.turns,state.turns);
 }
});

test('floor stock has three exchanges and three material offers including varied fixed-duration empowerment',()=>{
 const durations=new Set();for(let seed=1;seed<=50;seed++)for(const act of [1,2,3]){
  const r=new Run(seed);r.act=act;const offers=floorOffers(r);assert.equal(offers.length,6);assert.equal(offers.filter(o=>o.costPieces).length,3);assert.equal(offers.filter(o=>!o.costPieces).length,3);for(const o of offers.filter(o=>o.kind==='piece'&&!o.costPieces)){assert.ok(['glass','ethereal'].includes(o.material));assert.ok(o.price>piecePrice(o.type,o.material,act));}const enhancement=offers.find(o=>o.kind==='empower');durations.add(enhancement.duration);assert.deepEqual(floorOffers(r),offers);
  const relics=offers.filter(o=>o.kind==='artifact');assert.equal(new Set(relics.map(o=>o.artifactId)).size,relics.length);for(const relic of relics)assert.ok(sourceAllowed(relic.artifactId,relic.costPieces?'exchange':'shop'));assert.ok(offers.filter(o=>o.kind==='piece').every(o=>!['stone','diamond'].includes(o.material)));
  const p={type:'n',material:'ordinary'};assert.ok(upgradePrice(p,act,2,1)<upgradePrice(p,act,2,2));assert.ok(upgradePrice(p,act,2,2)<upgradePrice(p,act,2,3));
 }assert.deepEqual([...durations].sort(),[1,2,3]);
 const all=new Run(2);all.artifacts=artifacts.map(a=>a.id);const stock=floorOffers(all);assert.equal(stock.length,6);assert.ok(stock.some(o=>o.id==='material-supplies'&&o.price>0));
});

test('floor empowerment spends only material, preserves stone, and ticks only when its figure is deployed',()=>{
 const r=new Run(17);r.floor=r.merchantPlan.floors[0].floor;r.setupFloor();r.openMerchant(r.merchants.find(m=>m.kind==='floor'));r.material=10000;r.inventory.push({id:'stone-local',type:'n',material:'stone'});
 const enhancement=merchantOffers(r).find(o=>o.kind==='empower'),before=r.material,inventory=structuredClone(r.inventory);
 assert.equal(r.buyMerchant('empower',{pieceId:'king'}),false);assert.equal(r.material,before);
 assert.equal(r.buyMerchant('empower',{pieceId:'stone-local'}),true);assert.deepEqual(r.inventory,inventory);assert.equal(r.material,before-upgradePrice(inventory.at(-1),r.act,r.floor,enhancement.duration));assert.equal(r.buffs.find(b=>b.pieceId==='stone-local').remaining,enhancement.duration);assert.equal(r.buffs.find(b=>b.pieceId==='stone-local').permanent,false);
 assert.equal(r.buyMerchant('empower',{pieceId:'stone-local'}),false);r.closeMerchant();const enemy=r.enemies.find(e=>e.guard);
 r.openEncounter(enemy);r.beginBattle(['queen']);assert.equal(r.buffs.find(b=>b.pieceId==='stone-local').remaining,enhancement.duration);r.finishBattle('draw',new Set(r.inventory.map(p=>p.id)));
 r.openEncounter(enemy);const preset=r.beginBattle(['stone-local']);assert.ok([...parsePosition(preset.fen).pieces.values()].some(p=>p.color==='w'&&p.type==='n'&&p.hp===2&&p.damage===2));assert.equal(r.buffs.find(b=>b.pieceId==='stone-local').remaining,enhancement.duration-1);
});

test('old open floor shops gain material offers once while preserving trades, purchases and the return map',()=>{
 const r=new Run(27);r.floor=r.merchantPlan.floors[0].floor;r.setupFloor();r.openMerchant(r.merchants.find(m=>m.kind==='floor'));const floor=structuredClone(r.merchantVisit.map);
 r.floorMarket.offers=r.floorMarket.offers.filter(o=>o.costPieces);delete r.floorMarket.version;r.floorMarket.offers[0].sold=true;r.floorMarket.offers[1].customNote='keep';r.player={x:6,y:2};r.map={width:9,height:5,tiles:Array(45).fill(1),start:{x:0,y:2},exit:{x:8,y:2},rooms:[]};
 const restored=Run.restore(r.snapshot());assert.equal(restored.floorMarket.offers.length,6);assert.equal(restored.map.height,7);assert.deepEqual(restored.player,{x:6,y:2});assert.equal(restored.floorMarket.offers[0].sold,true);assert.equal(restored.floorMarket.offers[1].customNote,'keep');assert.deepEqual(restored.merchantVisit.map,floor);assert.ok(restored.floorMarket.offers.every(o=>Number.isInteger(o.x)&&Number.isInteger(o.y)));assert.equal(Run.restore(restored.snapshot()).floorMarket.offers.length,6);
});

test('unsold ordinary material stock migrates to temporary pieces at a premium; sold stock and inventory stay intact',()=>{
 const r=new Run(35);r.floorMarket={act:1,version:2,offers:floorOffers(r)};const item=r.floorMarket.offers.find(o=>o.id==='material-piece');Object.assign(item,{type:'r',material:'ordinary',price:1});const inventory=structuredClone(r.inventory),restored=Run.restore(r.snapshot()),updated=restored.floorMarket.offers.find(o=>o.id==='material-piece');assert.ok(['glass','ethereal'].includes(updated.material));assert.equal(updated.price,Math.ceil(piecePrice(updated.type,updated.material,1)*1.35));assert.deepEqual(restored.inventory,inventory);
 item.sold=true;const sold=Run.restore(r.snapshot()).floorMarket.offers.find(o=>o.id==='material-piece');assert.equal(sold.material,'ordinary');assert.equal(sold.sold,true);assert.equal(sold.price,1);
});
