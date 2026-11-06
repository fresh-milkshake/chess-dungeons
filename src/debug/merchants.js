import {jumpToFloor} from '../dungeon/navigation.js';
import {enterMerchant} from '../dungeon/merchants.js';
/** Developer-only entry points for checking the newly generated merchants. */
export function setupMerchantDebug({root,getRun,onAction}){
 const section=document.createElement('section');section.className='debug-merchant-controls';const title=document.createElement('h3');title.textContent='Магазины · проверка';section.append(title);
 const add=(text,action)=>{const button=document.createElement('button');button.type='button';button.className='secondary-button';button.textContent=text;button.addEventListener('click',()=>onAction(action));section.append(button);};
 add('Открыть магазин этажа · debug',()=>{const r=getRun(),act=Math.min(3,r.act),site=r.merchantPlan.floors.find(s=>s.act===act);jumpToFloor(r,site.act,site.floor);const merchant=r.merchants.find(m=>m.kind==='floor');r.player={x:merchant.x,y:merchant.y};return r.openMerchant(merchant);});
 add('Открыть тайный торг · debug',()=>{const r=getRun(),site=r.merchantPlan.secret;jumpToFloor(r,site.act,site.floor);const merchant=r.merchants.find(m=>m.kind==='secret');r.player={x:merchant.x,y:merchant.y};enterMerchant(r,merchant);return true;});
 add('Добавить 100 материала · debug',()=>{getRun().material+=100;return true;});
 root.querySelector('#debug-panel').append(section);return {section};
}
