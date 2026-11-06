import {randomSource} from '../dungeon/map.js';
import {artifacts,owns} from './catalog.js';
import {shopRerollPrice} from './mechanics.js';
import {artifactPrice,piecePrice,pieceShopPool,sellableArtifact} from '../dungeon/economy.js';
import {sourceAllowed} from './rarity.js';

export function rerollShop(run){
 const cost=shopRerollPrice(run);
 if(run.stage!=='shop'||!owns(run,'merchant-die')||cost===null)return false;
 if(run.material<cost){run.message=`Для обновления нужно ${cost} материала.`;return false;}
 const roll=(run.shop.rerolls??0)+1,old=run.shop.items;
 const fresh=old.map(item=>({...item}));
 const random=randomSource(run.seed^run.act*7919^roll*104729),unavailable=new Set([...run.artifacts,...old.filter(i=>i.kind==='artifact').map(i=>i.artifactId)]);
 const pool=artifacts.filter(a=>!unavailable.has(a.id)&&sourceAllowed(a.id,'shop')&&sellableArtifact(a.id,run.act));
 for(const item of fresh){
  const previous=old.find(i=>i.x===item.x&&i.y===item.y);if(previous?.sold)continue;
  if(item.kind==='artifact'){
   const a=pool.splice(Math.floor(random()*pool.length),1)[0];if(!a)continue;
   item.artifactId=a.id;item.price=artifactPrice(a,run.act);
  }else{
   const choices=pieceShopPool.filter(([type,material])=>run.act>=2||type!=='q'||material!=='ordinary');
   const options=choices.filter(([type,material])=>type!==previous?.type||material!==previous?.material),[type,material]=options[Math.floor(random()*options.length)];Object.assign(item,{type,material,price:piecePrice(type,material,run.act)});
  }
  item.id=`shop-${run.act}-reroll-${roll}-${item.x}-${item.y}`;
 }
 run.shop.items=old.map(previous=>previous.sold?previous:fresh.find(i=>i.x===previous.x&&i.y===previous.y)??previous);
 run.shop.rerolls=roll;run.material-=cost;run.message=`Ассортимент обновлён за ${cost} материала.`;return true;
}
