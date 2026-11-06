import {merchantOffers,purchaseProblem,figureName,upgradePrice,paymentPieces,buffActive,isMerchantStage,empowermentText} from './merchants.js';
import {deploymentLimit} from '../artifacts/mechanics.js';
import {artifactById} from '../artifacts/catalog.js';
import {createPieceSprite} from '../piece-effects.js';
import {pieceImage} from '../piece-sets.js';
import './merchants.css';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
const sprite=p=>createPieceSprite({...p,color:'w'},pieceImage({...p,color:'w'},'neo',import.meta.env.BASE_URL));
export const merchantTitle=o=>o.kind==='artifact'?artifactById(o.artifactId).name:o.kind==='empower'?`Усиление фигуры${o.duration?` · ${o.duration} ${o.duration===1?'бой':'боя'}`:''}`:o.kind==='bundle'?o.pieces.map(figureName).join(' + '):figureName(o);
export const merchantCost=o=>o.costPieces?.map(p=>`${p.count} × ${figureName(p)}`).join(' + ')??(o.slots?`${o.slots} слотов расстановки`:o.kind==='empower'?'Цена зависит от фигуры':`◆ ${o.price}`);
export function exchangeCostSprites(offer,inventory,{compact=false}={}){
 const row=el('span',`exchange-cost${compact?' compact':''}`);row.setAttribute('role','img');row.setAttribute('aria-label','Отдать: '+merchantCost(offer));
 for(const need of offer.costPieces??[]){
  const owned=inventory.filter(p=>p.type===need.type&&p.material===need.material).length,item=el('span','exchange-cost-item');item.title=`${figureName(need)} · нужно ${need.count}, есть ${owned}`;item.classList.toggle('missing',owned<need.count);item.append(sprite(need));if(need.count>1)item.append(el('span','exchange-cost-quantity','×'+need.count));row.append(item);
 }return row;
}
export function renderMerchantDescription(node,run,offer,problem){
 const key=JSON.stringify([offer,problem,offer?.costPieces?.map(n=>run.inventory.filter(p=>p.type===n.type&&p.material===n.material).length),offer?null:run.message]);if(node.dataset.merchantDescription===key)return;node.dataset.merchantDescription=key;
 node.replaceChildren();if(!offer){node.textContent=run.message;return;}
 node.append(el('span','',merchantTitle(offer)));
 if(offer.costPieces){node.append(el('span','exchange-cost-label','Отдать'),exchangeCostSprites(offer,run.inventory));}else node.append(el('span','merchant-current-cost',' · '+merchantCost(offer)));
 if(problem)node.append(el('span','merchant-current-note',problem));
 if(offer.kind==='empower')node.append(el('span','merchant-current-note',empowermentText(offer)));
 if(offer.kind==='artifact')node.append(el('span','merchant-current-note',artifactById(offer.artifactId).description));
}
export function createMerchantUI({root,scope,getRun,onAction}){
 const panel=el('section','merchant-panel dungeon-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Сделка с торговцем');panel.hidden=true;root.querySelector('#map-dialogs').append(panel);
 const notice=el('aside','merchant-notice');notice.hidden=true;notice.setAttribute('role','status');root.append(notice);
 let confirmation=null,targeting=false,key='';
 const currentOffer=()=>merchantOffers(getRun()).find(o=>!o.sold&&!o.withdrawn&&o.x===getRun().player.x&&o.y===getRun().player.y);
 const clear=()=>{confirmation=null;targeting=false;key='';};
 const cancel=()=>{clear();onAction(()=>true);};
 scope.on(window,'keydown',event=>{if(!panel.hidden&&event.key==='Escape'){event.preventDefault();cancel();}});
 function requestPurchase(){
  const run=getRun(),offer=currentOffer();if(!offer)return;
  const problem=offer.kind==='empower'?'':purchaseProblem(run,offer);if(problem){onAction(r=>{r.message=problem;return true;});return;}
  if(offer.slots||(paymentPieces(run,offer)??[]).some(p=>run.buffs.some(b=>b.pieceId===p.id&&buffActive(b))))confirmation=offer.id;
  else if(offer.kind==='empower')targeting=true;
  else{onAction(r=>r.buyMerchant(offer.id));return;}
  key='';onAction(()=>true);
 }
 function render(){
  const run=getRun();if(!isMerchantStage(run.stage))clear();
  notice.hidden=run.stage!=='exploring'||!run.message.startsWith('Торговец откроет');notice.textContent=notice.hidden?'':run.message;
  panel.hidden=!(confirmation||targeting);if(panel.hidden)return;
  const next=JSON.stringify([run.stage,run.material,run.inventory,run.buffs,run.slotDebt,confirmation,targeting]);if(next===key)return;key=next;
  panel.replaceChildren(el('div','chapter',run.stage==='secret-shop'?'ТАЙНЫЙ ТОРГ':'МАГАЗИН ЭТАЖА'),el('h2','',confirmation?'Цена сделки':'Усиление фигуры'));
  panel.append(el('p','merchant-wallet',`◆ ${run.material} · слотов расстановки: ${deploymentLimit(run)}`));
  if(confirmation){
   const offer=merchantOffers(run).find(o=>o.id===confirmation);panel.append(el('p','merchant-warning',offer.slots?`Вы навсегда потеряете ${offer.slots} слотов расстановки до конца забега. Лимит уменьшится: ${deploymentLimit(run)} → ${deploymentLimit(run)-offer.slots}. Фигуры в резерве сохранятся.`:'В обмен уйдёт фигура с Усилением. Вы потеряете и саму фигуру, и её усиление. Продолжить обмен?'));
   const yes=el('button','primary-button',offer.slots?'Подтвердить потерю слотов':'Подтвердить обмен усиленной фигуры');yes.addEventListener('click',()=>{const id=confirmation;clear();onAction(r=>r.buyMerchant(id,{confirmSlots:true,confirmBuffLoss:true}));});panel.append(yes);
  }else{
   const enhancement=merchantOffers(run).find(o=>o.id==='empower');panel.append(el('p','',empowermentText(enhancement)));
   const grid=el('div','merchant-targets');for(const piece of run.inventory.filter(p=>p.type!=='k')){
    const button=el('button','merchant-offer'),problem=purchaseProblem(run,enhancement,piece.id);button.append(sprite(piece),el('strong','',figureName(piece)),el('span','merchant-price',`◆ ${upgradePrice(piece,run.act,run.floor,enhancement.duration)}`));button.disabled=!!problem;button.title=problem||'Наложить Усиление';button.addEventListener('click',()=>{clear();onAction(r=>r.buyMerchant('empower',{pieceId:piece.id}));});grid.append(button);
   }panel.append(grid);
  }
  const no=el('button','secondary-button','Отказаться · Esc');no.addEventListener('click',cancel);panel.append(no);panel.querySelector('button:not(:disabled)')?.focus();
 }
 return {render,requestPurchase,currentOffer,get modalOpen(){return !!(confirmation||targeting);}};
}
