import {randomSource,key,walkable} from './map.js';
import {artifacts,artifactById} from '../artifacts/catalog.js';
import {sourceAllowed,rarityOf} from '../artifacts/rarity.js';
import {caps} from './balance.js';
import {deploymentLimit} from '../artifacts/mechanics.js';
import {piecePrice,artifactPrice} from './economy.js';
const names={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь'},materials={ordinary:'обычная',glass:'стекло',ethereal:'эфир',stone:'камень'};
export const figureName=p=>`${names[p.type]} · ${materials[p.material]}`;
export const buffActive=b=>b.permanent||b.remaining>0;
export const isMerchantStage=stage=>stage==='floor-shop'||stage==='secret-shop';
export const isShopping=stage=>stage==='shop'||isMerchantStage(stage);
export function merchantBoard(offers,secret){
 const width=secret?15:9,height=7,rows=[2,4],columns=secret?[2,4,6,8,10,12]:[2,4,6];
 offers.forEach((offer,i)=>{offer.x=columns[i%columns.length];offer.y=rows[Math.floor(i/columns.length)];});
 return {width,height,tiles:Array(width*height).fill(1),rooms:[],start:{x:0,y:Math.floor(height/2)},exit:{x:width-1,y:Math.floor(height/2)}};
}
const recipe=(type,material,count=1)=>({type,material,count});
export const secretScale=(act,floor)=>act===4?1.35:floor===3?1.15:1;
export const upgradePrice=(piece,act,floor,duration=null)=>Math.round((duration===null?({p:45,n:70,b:70,r:105,q:150}[piece.type]??90)*secretScale(act,floor):({p:6,n:10,b:10,r:15,q:22}[piece.type]??15)*({1:1,2:1.8,3:2.5}[duration]??1)*(1+(act-1)*.15))*(piece.material==='stone'?1.65:1));
export function empowermentText(offer){return offer?.duration?`Усиление на ${offer.duration} ${offer.duration===1?'бой':'боя'} с участием выбранной фигуры. Материал сохраняется.`:'Пешка — до конца забега; остальные — на пять боёв с их участием. Материал сохраняется.';}
const activeMarket=run=>run.stage==='floor-shop'?run.floorMarket:run.secretMarket;
function materialOffers(run,exchanges){
 const rng=randomSource(run.seed^run.act*23417^0x5951),pool=[
  [['n','glass'],['b','glass'],['r','ethereal'],['p','glass']],
  [['n','glass'],['b','ethereal'],['r','glass'],['r','ethereal']],
  [['r','ethereal'],['q','glass'],['q','ethereal'],['r','glass']],
 ][Math.min(2,run.act-1)],piece=pool[Math.floor(rng()*pool.length)],reserved=new Set(exchanges.map(o=>o.artifactId)),relics=artifacts.filter(a=>sourceAllowed(a.id,'shop')&&!run.artifacts.includes(a.id)&&!reserved.has(a.id)),relic=relics[Math.floor(rng()*relics.length)],duration=1+Math.floor(rng()*3);
 return [{id:'material-piece',kind:'piece',type:piece[0],material:piece[1],price:Math.ceil(piecePrice(...piece,run.act)*1.35)},
  relic?{id:'material-relic',kind:'artifact',artifactId:relic.id,price:artifactPrice(relic,run.act)}:{id:'material-supplies',kind:'bundle',pieces:[{type:'p',material:'glass'},{type:'p',material:'glass'}],price:Math.ceil(piecePrice('p','glass',run.act)*2*1.35)},
  {id:'empower',kind:'empower',duration}].map(o=>({...o,sold:false}));
}
function relicRecipe(id){const tier=rarityOf(id);return tier==='epic'?[recipe('r','ordinary',2),recipe('n','glass')]:tier==='rare'?[recipe('n','ordinary'),recipe('b','ordinary'),recipe('p','glass',2)]:[recipe('n','ordinary'),recipe('p','glass',2)];}
export function floorOffers(run){
 const rng=randomSource(run.seed^run.act*9173^0x3729),available=artifacts.filter(a=>sourceAllowed(a.id,'exchange')),pool=available.filter(a=>!run.artifacts.includes(a.id)),choices=pool.length?pool:available,relic=choices[Math.floor(rng()*choices.length)];
 const exchanges=[{id:'exchange-pawn',kind:'piece',costPieces:[recipe('p','glass',3)],type:'p',material:'ordinary'},
  run.act===1?{id:'exchange-officer',kind:'piece',costPieces:[recipe('n','glass'),recipe('b','glass')],type:rng()<.5?'n':'b',material:'ordinary'}:{id:'exchange-officer',kind:'piece',costPieces:[recipe('p','ordinary')],type:run.act===3?'r':'b',material:'ethereal'},
  ...(relic?[{id:'exchange-relic',kind:'artifact',artifactId:relic.id,costPieces:relicRecipe(relic.id)}]:[])].map(o=>({...o,sold:false}));
 return [...exchanges,...materialOffers(run,exchanges)];
}
/** Extend old stock once, preserving already revealed recipes, prices and sold flags. */
export function upgradeFloorMarket(run){
 const market=run.floorMarket;if(!market||market.act!==run.act)return;
 market.empowered??=[];
 if(market.version!==3){
  const additions=materialOffers(run,market.offers);for(const offer of additions)if(!market.offers.some(o=>o.id===offer.id))market.offers.push(offer);
  for(const offer of market.offers)if(!offer.sold&&!offer.costPieces){
   if(offer.kind==='piece'){if(offer.material==='ordinary')Object.assign(offer,additions.find(o=>o.id==='material-piece'));offer.price=Math.ceil(piecePrice(offer.type,offer.material,run.act)*1.35);}
   if(offer.kind==='bundle')offer.price=Math.ceil(offer.pieces.reduce((sum,p)=>sum+piecePrice(p.type,p.material,run.act),0)*1.35);
  }market.version=3;
 }
 if(run.stage==='floor-shop'&&run.merchantVisit&&(run.map.height!==7||market.offers.some(o=>o.x===undefined))){run.map=merchantBoard(market.offers,false);run.seen=run.map.tiles.map((_,i)=>key(i%run.map.width,Math.floor(i/run.map.width)));run.visible=[...run.seen];}
}
export function secretOffers(run){
 const rng=randomSource(run.seed^0x2774b2),scale=secretScale(run.act,run.floor),pool=artifacts.filter(a=>sourceAllowed(a.id,'secret')&&!run.artifacts.includes(a.id));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const count=run.act===4?3:2;
 const offers=[...['p','n','b','r'].map(type=>({id:'stone-'+type,kind:'piece',type,material:'stone',group:'stone',price:Math.round(({p:70,n:130,b:130,r:190})[type]*scale)})),
 ...pool.slice(0,count).map(a=>({id:'legend-'+a.id,kind:'artifact',artifactId:a.id,price:Math.round(a.price[1]*2.2*scale)})),
 {id:'ordinary-rook',kind:'piece',type:'r',material:'ordinary',price:Math.round(55*scale)},
 {id:'ordinary-queen',kind:'piece',type:'q',material:'ordinary',price:Math.round(90*scale)},
 {id:'slots-officers',kind:'bundle',pieces:[{type:'n',material:'ordinary'},{type:'b',material:'ordinary'}],slots:3},
 ...(pool[count]?[{id:'slots-relic',kind:'artifact',artifactId:pool[count].id,slots:5}]:[]),
 {id:'empower',kind:'empower'}];
 return offers.map(o=>({...o,sold:false}));
}
export function placeMerchants(run){
 run.merchants=[];
 const site=run.merchantPlan.floors.find(s=>s.act===run.act&&s.floor===run.floor);
 if(site){
  const occupied=new Set([run.player,run.map.exit,...run.enemies,...run.loot].map(p=>key(p.x,p.y))),spots=[];
  for(let y=1;y<run.map.height-1;y++)for(let x=1;x<(run.map.secret?.originalWidth??run.map.width)-1;x++)if(walkable(run.map,x,y)&&!occupied.has(key(x,y)))spots.push({x,y});
  const rng=randomSource(run.seed^run.act*5437),point=spots[Math.floor(rng()*spots.length)];
  if(point){run.floorMarket??={act:run.act,offers:floorOffers(run)};if(run.floorMarket.act!==run.act)run.floorMarket={act:run.act,offers:floorOffers(run)};upgradeFloorMarket(run);run.merchants.push({...point,id:'floor-market',kind:'floor'});}
 }
 if(run.map.secret){run.secretMarket??={offers:secretOffers(run),empowered:[],stoneBought:false};run.merchants.push({...run.map.secret.shop,id:'secret-market',kind:'secret'});}
}
export function openMerchant(run,merchant){
 if(run.merchantVisit)return false;
 if(merchant.kind==='secret'&&!merchant.debug&&run.map.secret?.guardIds.some(id=>run.enemies.some(e=>e.id===id))){run.message='Торговец откроет двери, когда вы победите трёх стражей тайного пути.';return false;}
 enterMerchant(run,merchant);return true;
}
export function enterMerchant(run,merchant){
 if(merchant.kind==='floor')upgradeFloorMarket(run);
 run.merchantVisit=Object.fromEntries(['map','player','enemies','loot','seen','visible','merchants','rootedMap'].map(k=>[k,run[k]]));
 if(merchant.stock){
  run.merchantVisit.debugStock={id:merchant.id,floor:run.floorMarket??null,secret:run.secretMarket??null};
  if(merchant.kind==='floor')run.floorMarket=merchant.stock;else run.secretMarket=merchant.stock;
 }
 run.stage=merchant.kind==='secret'?'secret-shop':'floor-shop';
 run.map=merchantBoard(merchantOffers(run),merchant.kind==='secret');run.player={...run.map.start};run.enemies=[];run.loot=[];run.merchants=[];
 run.seen=run.map.tiles.map((_,i)=>key(i%run.map.width,Math.floor(i/run.map.width)));run.visible=[...run.seen];run.rootedMap=0;
 run.message='Встаньте на клетку товара. Enter или пробел — покупка. Выход справа возвращает на этаж.';
}
export function leaveMerchant(run){
 if(!isMerchantStage(run.stage)||!run.merchantVisit)return false;
 const {debugStock,...floorState}=run.merchantVisit;
 if(debugStock){
  const merchant=floorState.merchants.find(m=>m.id===debugStock.id);if(merchant)merchant.stock=activeMarket(run);
  run.floorMarket=debugStock.floor;run.secretMarket=debugStock.secret;
 }
 Object.assign(run,floorState);delete run.merchantVisit;run.stage='exploring';run.message='Вы вернулись к входу в магазин.';return true;
}
export function merchantOffers(run){return run.stage==='secret-shop'?run.secretMarket?.offers??[]:run.floorMarket?.offers??[];}
export function paymentPieces(run,offer){
 const selected=[];
 for(const need of offer.costPieces??[]){const found=run.inventory.filter(p=>p.type===need.type&&p.material===need.material&&!selected.includes(p)).sort((a,b)=>Number(run.buffs.some(v=>v.pieceId===a.id&&buffActive(v)))-Number(run.buffs.some(v=>v.pieceId===b.id&&buffActive(v)))).slice(0,need.count);if(found.length<need.count)return null;selected.push(...found);}
 return selected;
}
export function purchaseProblem(run,offer,pieceId){
 if(!offer||offer.sold)return 'Предложение уже использовано.';
 if(offer.group==='stone'&&run.secretMarket.stoneBought)return 'Каменная фигура уже выбрана.';
 if(offer.kind==='artifact'&&run.artifacts.includes(offer.artifactId))return 'Эта реликвия уже у вас.';
 const spent=paymentPieces(run,offer);if(!spent)return 'Не хватает фигур для обмена.';
 if(offer.slots&&deploymentLimit(run)-offer.slots<1)return 'Должен остаться хотя бы один слот для короля.';
 let price=offer.price??0;
 if(offer.kind==='empower'){
  const piece=run.inventory.find(p=>p.id===pieceId&&p.type!=='k');if(!piece)return 'Выберите свою фигуру, кроме короля.';
  if((activeMarket(run).empowered??[]).includes(piece.id)||run.buffs.some(b=>b.pieceId===piece.id&&(b.permanent||b.remaining>=(offer.duration??5))))return 'Эта фигура уже получила усиление.';
  price=upgradePrice(piece,run.act,run.floor,offer.duration);
 }
 if(run.material<price)return 'Недостаточно материала.';
 const received=offer.kind==='piece'?[offer]:offer.pieces??[];
 for(const material of new Set(received.map(p=>p.material)))if(run.inventory.filter(p=>p.type!=='k'&&p.material===material&&!spent.includes(p)).length+received.filter(p=>p.material===material).length>(caps[material]??0))return 'Лимит фигур этого материала достигнут.';
 return '';
}
export function purchaseMerchant(run,id,{pieceId,confirmSlots=false,confirmBuffLoss=false}={}){
 if(!['floor-shop','secret-shop'].includes(run.stage))return false;
 const offer=merchantOffers(run).find(o=>o.id===id),problem=purchaseProblem(run,offer,pieceId);if(problem){run.message=problem;return false;}
 if(offer.slots&&!confirmSlots){run.message=`Вы навсегда потеряете ${offer.slots} слота расстановки до конца забега. Подтвердите сделку.`;return false;}
 const spent=paymentPieces(run,offer),ids=new Set(spent.map(p=>p.id));let price=offer.price??0;
 if(!confirmBuffLoss&&spent.some(p=>run.buffs.some(b=>b.pieceId===p.id&&buffActive(b)))){run.message='В обмен уйдёт усиленная фигура. Подтвердите потерю её усиления.';return false;}
 if(offer.kind==='empower'){
  const piece=run.inventory.find(p=>p.id===pieceId);price=upgradePrice(piece,run.act,run.floor,offer.duration);const permanent=!offer.duration&&piece.type==='p';
  run.buffs=run.buffs.filter(b=>b.pieceId!==piece.id);run.buffs.push({pieceId:piece.id,remaining:permanent?0:offer.duration??5,permanent,secret:run.stage==='secret-shop'});(activeMarket(run).empowered??=[]).push(piece.id);
 }else if(offer.kind==='artifact')run.artifacts.push(offer.artifactId);
 else for(const piece of offer.kind==='bundle'?offer.pieces:[offer])run.inventory.push({id:`merchant-${++run.counter}`,type:piece.type,material:piece.material});
 run.material-=price;run.slotDebt=(run.slotDebt??0)+(offer.slots??0);run.inventory=run.inventory.filter(p=>!ids.has(p.id));run.buffs=run.buffs.filter(b=>!ids.has(b.pieceId));
 if(offer.kind!=='empower')offer.sold=true;
 if(offer.group==='stone'){run.secretMarket.stoneBought=true;for(const item of run.secretMarket.offers)if(item.group==='stone'&&item!==offer)item.withdrawn=true;}
 run.message='Сделка заключена.';return true;
}
