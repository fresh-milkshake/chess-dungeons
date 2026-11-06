import {normalizeDifficulty} from '../battle/difficulty.js';
import {chooseBiome,biomeArmies,mapTerrainStep} from '../biomes/campaign.js';
import {addMapTerrain} from '../biomes/generation.js';
import {floorSites} from './sites.js';
import {generateMap,randomSource,key,walkable,visibility} from './map.js';
import {enemyTypes,makeEncounter,encounterReward} from './encounters.js';
import {bossArmy,bossArmor,bossOptions,canReceive,makeShop,shopMap} from './balance.js';
import {deploymentPreset} from './deployment.js';
import {spawnWild,invadingWild,settleWild} from './wild.js';
import {addFloorEncounters,advanceRoamers} from './patrol.js';
import {stoneTrophy,stoneCompensation} from './stone-rewards.js';
import {artifactPlan,addReliquary,upgradeArtifactPlan} from '../artifacts/acquisition.js';
import {artifactById,owns} from '../artifacts/catalog.js';
import {actTwoBalance} from './act-two-balance.js';
import {CAMPAIGN_VERSION,floorsInAct,bossAtExit,isFinalAct} from './campaign.js';
import {syncArtifactUses} from '../artifacts/mechanics.js';
import {CHARGE_VERSION,ensureActCharges,migrateArtifactCharges} from '../artifacts/charges.js';
import {findMaterial,rewardCompensation} from './economy.js';
import {merchantPlan,extendSecretArea} from './merchant-plan.js';
import {placeMerchants,openMerchant,purchaseMerchant,enterMerchant,leaveMerchant,isShopping,isMerchantStage,upgradeFloorMarket} from './merchants.js';
import {scoutingChoices,scoutPatch,rechargeCandidates,restoreOneCharge} from './scouting.js';
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const pieceNames={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь'};
export class Run {
 constructor(seed=Date.now()>>>0,act=1,difficulty){
  this.campaignVersion=CAMPAIGN_VERSION;this.difficulty=normalizeDifficulty(difficulty);
  this.version=1;this.id=`${seed}-${Date.now().toString(36)}`;this.seed=seed>>>0;this.act=act;this.floor=1;this.turns=0;this.material=0;this.counter=0;this.merchantPlan=merchantPlan(this.seed);this.slotDebt=0;
  this.artifacts=[];this.artifactPlan=artifactPlan(this.seed);this.inventory=[{id:'king',type:'k',material:'ordinary'},{id:'queen',type:'q',material:'ordinary'},{id:'knight',type:'n',material:'ordinary'}];this.buffs=[];this.setupFloor();
 }
 setupFloor(){
  delete this.merchantVisit;
  if(this.debugMap)this.debugMap.reveal=false;
  if(!floorsInAct(this.act))throw Error('Этот акт пока недоступен.');
  this.floor=Math.max(1,Math.min(floorsInAct(this.act),this.floor));
  chooseBiome(this);this.rootedMap=0;
  this.exitRevealed=false;
  this.wildGeneration=1;
  this.artifactFloor={key:`${this.act}-${this.floor}`,sealUsed:false};
  ensureActCharges(this);this.chargeVersion=CHARGE_VERSION;
  this.encounterGeneration=2;
  this.hunterCleared=false;this.shop=null;this.map=generateMap((this.seed+this.floor*7919+(this.act-1)*104729)>>>0,{rooms:this.floor===1?4:5});this.player={...this.map.start};this.seen=[];this.enemies=[];this.loot=[];this.active=null;this.pendingReward=null;this.encounterId=null;this.stage='exploring';
  const sites=floorSites(this.map,this.seed^this.floor),types=[['p','n','b'],['b','r','q'],['r','q','q'],['q']][this.act-1];
  const guard=bossAtExit(this.act,this.floor)?{id:`boss-${this.act}`,type:this.act===1?'r':'q',...this.map.exit,boss:true,emperor:isFinalAct(this.act),guard:true,army:bossArmy(this.act),armor:bossArmor(this.act,this.seed)}:{id:`guard-${this.floor}`,type:types[this.floor-1],...this.map.exit,guard:true,...(this.act===2?{army:[...actTwoBalance.guards[this.floor-1]]}:{})};
  this.enemies.push(guard);
  this.enemies.push({id:`sentry-${this.floor}`,type:types[this.floor-1]==='q'?'q':['n','b','r','q'][Math.min(3,enemyTypes[types[this.floor-1]].rank)],...sites.sentry});
  this.loot=sites.loot.map(({index,...loot})=>({...loot,id:`ruin-${this.floor}-${index}`}));
  this.ensureHunter();addFloorEncounters(this);spawnWild(this);addReliquary(this);biomeArmies(this);
  if(this.merchantPlan.secret.act===this.act&&this.merchantPlan.secret.floor===this.floor){
   const area=extendSecretArea(this.map,this.seed),guardIds=[];
   for(let i=0;i<3;i++){const room=area.rooms[i],id=`secret-guard-${i}`;guardIds.push(id);this.enemies.push({id,x:room.cx,y:room.cy-1,type:i===2?'q':'r',roaming:true,region:'secret',patrol:i,army:i===2?['q','r','b','n','p','p']:['r','b','n','p','p'],armor:i===2?[{index:0,material:'stone'}]:[]});}
   area.guardIds=guardIds;this.enemies.push({id:'secret-elite',...area.optional,type:'q',region:'secret',optional:true,army:['q','r','r','b','n','n','p','p','p'],armor:[{index:0,material:'stone'}]});
  }
  placeMerchants(this);addMapTerrain(this);this.refreshSight();this.message=isFinalAct(this.act)?'Найдите Императора в конце дворца. Это последний бой забега.':'Найдите выход. Чёрная фигура показывает силу вражеской армии.';
 }
 refreshSight(){this.visible=this.debugMap?.reveal?this.map.tiles.map((_,i)=>key(i%this.map.width,Math.floor(i/this.map.width))):visibility(this.map,this.player);this.seen=[...new Set([...this.seen,...this.visible])];}
 ensureHunter(){
  if(this.enemies.some(e=>e.roaming&&!e.wild&&!e.weak))return;
  const occupied=new Set([...this.enemies,...this.loot,this.map.exit,this.player].map(p=>key(p.x,p.y)));
  const candidates=[];for(let y=1;y<this.map.height-1;y++)for(let x=1;x<this.map.width-1;x++)if(walkable(this.map,x,y)&&!occupied.has(key(x,y)))candidates.push({x,y});
  candidates.sort((a,b)=>distance(b,this.player)-distance(a,this.player));
  const pos=candidates[0],guard=this.enemies.find(e=>e.guard),rank=guard?enemyTypes[guard.type].rank:Math.min(5,this.act+this.floor-1);this.enemies.push({...pos,id:`hunter-${++this.counter}`,type:rank<4?'r':rank<5?'q':'k',roaming:true,rewardless:!!this.hunterCleared,patrol:0});
 }
 openEncounter(enemy){this.encounterId=enemy.id;this.encounterWild=invadingWild(this,enemy)?.id??null;this.stage='encounter';this.message=`${enemy.wild?'Дикая фигура':enemy.roaming?'Блуждающий противник':'Страж'}: ${enemyTypes[enemy.type].name}. Выберите отряд или отступите.`;}
 canStep(dx,dy){
  if(isShopping(this.stage))return Number.isInteger(dx)&&Number.isInteger(dy)&&Math.abs(dx)<=1&&Math.abs(dy)<=1&&this.player.x+dx>=0&&this.player.x+dx<this.map.width&&this.player.y+dy>=0&&this.player.y+dy<this.map.height;
  if(this.stage!=='exploring'||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)>1||Math.abs(dy)>1)return false;
  const next={x:this.player.x+dx,y:this.player.y+dy};
  if(this.debugMap?.ghost)return next.x>=0&&next.y>=0&&next.x<this.map.width&&next.y<this.map.height;
  if(!walkable(this.map,next.x,next.y))return false;
  return true;
 }
 step(dx,dy){
  if(isShopping(this.stage))return this.stepShop(dx,dy);
  if(this.stage==='exploring'&&!this.debugMap?.ghost&&this.rootedMap){this.rootedMap--;this.turns++;mapTerrainStep(this,this.player);this.advanceEnemies();this.refreshSight();this.message='Лозы отпустили короля.';return true;}
  if(!this.canStep(dx,dy))return false;
  const next={x:this.player.x+dx,y:this.player.y+dy};
  this.turns++;const enemy=this.enemies.find(e=>same(e,next));if(enemy&&!this.debugMap?.ghost){this.openEncounter(enemy);return true;}
  const previous=this.player;this.player=next;if(!this.debugMap?.ghost)mapTerrainStep(this,previous);this.refreshSight();if(this.stage==='defeat')return true;
  const loot=this.loot.find(l=>same(l,next));
  if(loot){this.loot=this.loot.filter(l=>l.id!==loot.id);this.pendingReward={id:loot.id,options:this.rewardOptions(loot)};this.stage='reward';this.message='Среди серых осколков осталось кое-что полезное. Выберите одну находку.';return true;}
  const merchant=this.merchants?.find(m=>same(m,next));if(merchant){openMerchant(this,merchant);return true;}
  if(same(next,this.map.exit)&&!this.enemies.some(e=>e.guard)){this.stage='cleared';this.message='Выход открыт. Этаж пройден.';return true;}
  this.advanceEnemies();return true;
 }
 advanceEnemies(){
  if(this.stage!=='exploring'||this.turns%2!==0)return;
  advanceRoamers(this);
  this.refreshSight();
 }
 retreat(){
  if(this.stage!=='encounter')return;
  if(this.enemies.find(e=>e.id===this.encounterId)?.boss)return false;
  const enemy=this.enemies.find(e=>e.id===this.encounterId),candidates=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const p={x:this.player.x+dx,y:this.player.y+dy};
   if(walkable(this.map,p.x,p.y)&&!this.enemies.some(e=>same(e,p))&&!this.loot.some(l=>same(l,p))&&!same(p,this.map.exit))candidates.push(p);
  }
  candidates.sort((a,b)=>distance(b,enemy)-distance(a,enemy));
  const previous={...this.player};if(candidates[0])this.player=candidates[0];else if(same(enemy,this.player))return;
  this.stage='exploring';this.encounterId=null;this.turns++;this.message='Вы отступили. Преследователь тратит ход на поиск следа.';mapTerrainStep(this,previous);this.refreshSight();
 }
 rewardOptions(loot){
  const random=randomSource(this.seed^this.turns^(this.floor*1337));const type=random()<[.7,.55,.4,.25][this.act-1]?'p':this.act>=3&&random()<.25?'r':random()<.5?'n':'b';
  let material=random()<.5?'glass':'ethereal';if(this.inventory.filter(p=>p.material===material).length>=(material==='glass'?10:5))material=material==='glass'?'ethereal':'glass';
  const target=this.inventory.filter(p=>p.type!=='k').sort((a,b)=>'pnbrq'.indexOf(a.type)-'pnbrq'.indexOf(b.type))[0];
  const base=[{kind:'piece',type,material,title:`${material==='glass'?(type==='p'?'Стеклянная':'Стеклянный'):(type==='p'?'Эфирная':'Эфирный')} ${pieceNames[type]}`,detail:material==='glass'?'Останется в отряде, пока не будет взята.':'Одно использование. Можно оставить в резерве.'},
   {kind:'power',pieceId:target.id,title:`Усиление: ${pieceNames[target.type]}`,detail:'2 урона на один бой. Только выбранная фигура.'},
   {kind:'material',amount:findMaterial(this.act,random),title:'Материал',detail:'Запас для покупок и обменов.'}];
  const pool=[...base.slice(1),...scoutingChoices(this,this.turns)];for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return [base[0],...pool.slice(0,owns(this,'facet')?3:2)];
 }
 chooseReward(index){
  if(this.stage!=='reward'||!this.pendingReward||!Number.isInteger(index)||!this.pendingReward.options[index])return false;
  const option=this.pendingReward.options[index];
  if(option.kind==='recharge'){
   const candidates=rechargeCandidates(this);if(!candidates.length)return false;
   this.pendingReward={...this.pendingReward,parentOptions:this.pendingReward.options,options:candidates.map(id=>({kind:'recharge-target',artifactId:id,title:artifactById(id).name,detail:'Восстановить один потраченный заряд.'}))};return true;
  }
  if(option.kind==='recharge-target'){if(!restoreOneCharge(this,option.artifactId))return false;}
  else if(option.kind==='scout'){const patch=scoutPatch(this,this.turns);if(!patch.length)return false;this.seen=[...new Set([...this.seen,...patch])];}
  else if(option.kind==='exit'){this.exitRevealed=true;}
  else if(option.kind==='piece'){
   const cap=option.material==='glass'?10:5;if(this.inventory.filter(p=>p.material===option.material).length>=cap)return false;
   this.inventory.push({id:`found-${++this.counter}`,type:option.type,material:option.material});
  }else if(option.kind==='power'){this.buffs=this.buffs.filter(b=>b.pieceId!==option.pieceId);this.buffs.push({pieceId:option.pieceId,remaining:1});}
  else if(option.kind==='material')this.material+=option.amount;
  this.pendingReward=null;this.stage='exploring';this.message=`Получено: ${option.title}${option.amount?' · '+option.amount:''}.`;this.advanceEnemies();return true;
 }
 beginBattle(selected,positions=null){
  if(this.stage!=='encounter')throw Error('Нет активной встречи.');
  const preparation=this.snapshot();
  const enemy=this.enemies.find(e=>e.id===this.encounterId);const preset=positions?deploymentPreset(this,enemy,positions):makeEncounter(this,enemy,selected);this.counter++;preset.id=`run-${this.id}-${enemy.id}-${this.counter}`;
  this.previousDeployment={bounds:{...preset.bounds},positions:Object.fromEntries(Object.entries(preset.identities).map(([square,id])=>[id,square]))};
  this.deployment=null;
  this.active={id:preset.id,preset,moves:[],resigned:false,revision:0,preparation};
  const deployed=new Set(preset.deployed.map(p=>p.id));this.inventory=this.inventory.filter(p=>!(deployed.has(p.id)&&p.material==='ethereal'));
  for(const buff of this.buffs)if(!buff.permanent&&deployed.has(buff.pieceId))buff.remaining=Math.max(0,buff.remaining-1);
  this.stage='battle';return preset;
 }
 prepareAgain(){
  if(this.stage!=='battle'||!this.active)throw Error('Нет активного боя.');
  if(this.active.preparation){const restored=Run.restore(this.active.preparation);for(const key of Object.keys(this))delete this[key];Object.assign(this,restored);return;}
  // Older saves predate the preparation snapshot. Restore spent deployed pieces.
  const preset=this.active.preset;
  for(const piece of preset.deployed??[])if(!this.inventory.some(p=>p.id===piece.id))this.inventory.push({...piece});
  for(const [square,id] of Object.entries(preset.identities??{})){
   if(!new RegExp(`${square}=\\d/2/`).test(preset.fen))continue;
   const buff=this.buffs.find(b=>b.pieceId===id);if(buff)buff.remaining++;else this.buffs.push({pieceId:id,remaining:1});
  }
  this.deployment={enemyId:preset.enemyId,positions:Object.fromEntries(Object.entries(preset.identities).map(([square,id])=>[id,square])),revision:0};
  this.encounterId=preset.enemyId;this.active=null;this.stage='encounter';
 }
 finishBattle(result,survivors,moves=[],wildState=null,runtime=null){
  if(this.stage!=='battle'||!this.active)throw Error('Этот бой уже завершён.');
  const preset=this.active.preset,enemy=this.enemies.find(e=>e.id===preset.enemyId),deployed=new Set(preset.deployed.map(p=>p.id));
  settleWild(this,preset,moves,wildState);
  syncArtifactUses(this,runtime);
  const consumedIds=new Set(moves.filter(m=>['seal','lastcrown'].includes(m.artifact)).map(m=>{try{return JSON.parse(m.uci.slice(9)).sourceId;}catch{return null;}}).filter(Boolean));
  this.inventory=this.inventory.filter(p=>!consumedIds.has(p.id));
  const frozenIds=new Set(moves.filter(m=>m.artifact==='frost').map(m=>{try{return JSON.parse(m.uci.slice(9)).sourceId;}catch{return null;}}).filter(Boolean));
  if(runtime?.frozenId)frozenIds.add(runtime.frozenId);
  this.inventory=this.inventory.filter(p=>!(frozenIds.has(p.id)&&!survivors.has(p.id)));
  this.inventory=this.inventory.filter(p=>!(p.material==='glass'&&deployed.has(p.id)&&!survivors.has(p.id)));
  this.buffs=this.buffs.filter(b=>(b.permanent||b.remaining>0)&&this.inventory.some(p=>p.id===b.pieceId));
  this.active=null;this.encounterId=null;
  if(result==='loss'){this.stage='defeat';this.message='Король потерпел поражение. Забег завершён.';return;}
  if(result==='win'){
   const trophy=stoneTrophy(this,enemy);
   if(trophy){
    this.stoneRewards??=[];this.stoneRewards.push(trophy.key);
    if(!trophy.duplicate&&canReceive(this,'stone'))this.inventory.push({id:trophy.id,type:trophy.type,material:'stone'});
    else this.material+=stoneCompensation[trophy.type];
   }
   this.material+=encounterReward(enemy,this.act,moves);this.enemies=this.enemies.filter(e=>e.id!==enemy.id);this.player={x:enemy.x,y:enemy.y};
   if(enemy.artifactId){this.artifacts??=[];if(!this.artifacts.includes(enemy.artifactId))this.artifacts.push(enemy.artifactId);}
   this.message='Победа. Стеклянные потери учтены, эфирные фигуры израсходованы, каменная защита восстановлена.';
   if(enemy.boss){
    if(canReceive(this,'ordinary'))this.inventory.push({id:`boss-pawn-${this.act}`,type:'p',material:'ordinary'});else this.material+=rewardCompensation('p','ordinary');
    this.pendingReward={options:bossOptions(this),stoneBalance:3};this.stage='boss-reward';this.message='Босс побеждён. Получена обычная пешка. Выберите одну награду. Каменная фигура — редкий трофей босса.';return;
   }
   this.stage=enemy.guard?'cleared':'exploring';
   if(enemy.guard){this.nextFloor();return;}
   // Replacement hunters keep pressure without becoming a renewable income.
   if(enemy.roaming&&!enemy.wild&&!enemy.weak&&enemy.region!=='secret')this.hunterCleared=true;this.ensureHunter();
  }else{this.stage='exploring';this.message='Ничья. Противник остаётся на этаже. Вы можете изменить отряд.';if(enemy.boss){this.openEncounter(enemy);return;}if(same(enemy,this.player)){this.openEncounter(enemy);this.retreat();}}
  this.refreshSight();
 }
 nextFloor(){if(this.stage!=='cleared'||this.floor>=floorsInAct(this.act))return false;this.floor++;this.setupFloor();return true;}
 chooseBossReward(index){
  if(this.stage!=='boss-reward'||!Number.isInteger(index))return false;
  const option=this.pendingReward?.options[index];if(!option)return false;
  if(option.kind==='artifact'){if(this.artifacts.includes(option.artifactId))return false;this.artifacts.push(option.artifactId);}
  else if(canReceive(this,option.material))this.inventory.push({id:`boss-choice-${this.act}`,type:option.type,material:option.material});
  else this.material+=option.material==='stone'?stoneCompensation[option.type]:rewardCompensation(option.type,option.material);
  this.pendingReward=null;
  if(isFinalAct(this.act)){this.stage='victory';this.message='Император побеждён. Все четыре акта пройдены.';return true;}
  this.shop=makeShop(this);this.map=shopMap();this.player={...this.map.start};this.enemies=[];this.loot=[];this.seen=this.map.tiles.map((_,i)=>key(i%this.map.width,Math.floor(i/this.map.width)));this.visible=[...this.seen];this.stage='shop';this.message='Магазин. Встаньте на клетку товара: Enter — купить. Выход справа.';return true;
 }
 stepShop(dx,dy){
  if(!isShopping(this.stage)||!this.canStep(dx,dy))return false;
  const x=this.player.x+dx,y=this.player.y+dy;
  this.player={x,y};if(same(this.player,this.map.exit)){if(isMerchantStage(this.stage))this.closeMerchant();else{this.act++;this.floor=1;this.setupFloor();}}return true;
 }
 buyShop(id){
  if(this.stage!=='shop')return false;
  const item=this.shop.items.find(i=>i.id===id);
  if(!item||item.sold||!same(this.player,item))return false;
  if(this.material<item.price){this.message=`Недостаточно материала: нужно ${item.price}, есть ${this.material}.`;return false;}
  if(item.kind==='artifact'){
   if(this.artifacts.includes(item.artifactId)){this.message='Этот артефакт уже есть.';return false;}
   this.material-=item.price;item.sold=true;this.artifacts.push(item.artifactId);this.message=`Получен артефакт: ${artifactById(item.artifactId).name}.`;return true;
  }
  if(!canReceive(this,item.material)){this.message='Лимит фигур из этого материала достигнут.';return false;}
  this.material-=item.price;item.sold=true;this.inventory.push({id:item.id,type:item.type,material:item.material});this.message='Фигура куплена и добавлена в отряд.';return true;
 }
 buyMerchant(id,options){return purchaseMerchant(this,id,options);}
 openMerchant(merchant){return openMerchant(this,merchant);}
 closeMerchant(){return leaveMerchant(this);}
 cancelRewardTarget(){if(!this.pendingReward?.parentOptions)return false;this.pendingReward.options=this.pendingReward.parentOptions;delete this.pendingReward.parentOptions;return true;}
 snapshot(){return JSON.parse(JSON.stringify(this));}
 static restore(data){
  if(data?.version!==1||!Number.isInteger(data.map?.width)||!Number.isInteger(data.map?.height)||data.map.tiles?.length!==data.map.width*data.map.height||!Array.isArray(data.inventory)||!data.inventory.some(p=>p.id==='king'&&p.type==='k')||!['exploring','reward','encounter','battle','cleared','defeat','boss-reward','shop','victory','floor-shop','secret-shop'].includes(data.stage))throw Error('Некорректное сохранение забега');
  const run=Object.assign(Object.create(Run.prototype),data);
  run.merchantPlan??=merchantPlan(run.seed);run.merchants??=[];run.slotDebt??=0;
  // Preserve a loaded map/battle verbatim; only future generation uses the new route.
  if(run.campaignVersion!==CAMPAIGN_VERSION){run.biomes??=[];run.biomes[2]='ruins';run.biomes[3]='court';run.campaignVersion=CAMPAIGN_VERSION;}
  run.difficulty=normalizeDifficulty(run.difficulty);run.artifacts??=[];run.artifactPlan??=artifactPlan(run.seed);run.artifactFloor??={key:`${run.act}-${run.floor}`,sealUsed:false};
  migrateArtifactCharges(run);
  upgradeArtifactPlan(run);
  if(run.shop?.items)run.shop.items=run.shop.items.map(item=>item.material==='stone'&&!item.sold?{...item,material:'glass',price:Math.round(item.price*.55)}:item);
  if(run.stage==='boss-reward'&&run.pendingReward?.stoneBalance!==3)run.pendingReward={options:bossOptions(run),stoneBalance:3};
  if(!run.wildDiversity){const previous=run.enemies.filter(e=>e.wild).map(e=>e.type);run.wildDiversity={previous,counts:Object.fromEntries(previous.map(t=>[t,previous.filter(v=>v===t).length]))};}
  if(!run.wildGeneration){
   if(run.enemies.some(e=>e.wild)||run.active?.preset?.wildIds?.length)run.wildGeneration=1;
   else if(run.stage==='exploring'){spawnWild(run);run.wildGeneration=1;}
  }
  for(const enemy of run.enemies)if(enemy.wild)enemy.damage=2;
  if(!run.encounterGeneration&&run.stage==='exploring')addFloorEncounters(run);
  if(run.stage==='encounter')for(const enemy of run.enemies)if(enemy.boss&&!enemy.armor){enemy.army=bossArmy(run.act);enemy.armor=bossArmor(run.act,run.seed);}
  if(isMerchantStage(run.stage)&&!run.merchantVisit){const merchant=run.merchants.find(m=>m.kind===(run.stage==='secret-shop'?'secret':'floor'));if(merchant)enterMerchant(run,merchant);else run.stage='exploring';}
  upgradeFloorMarket(run);if(!isShopping(run.stage))run.refreshSight();return run;
 }
}
