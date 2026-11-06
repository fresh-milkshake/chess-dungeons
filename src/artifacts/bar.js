import {artifactById,artifactImage,kindLabel} from './catalog.js';
import {rechargeLabel,rechargeHint,actionLabel} from './charges.js';
import './style.css';
import {artifactIcon} from './icon-effects.js';
import {rarityInfo} from './rarity.js';
export function createArtifactBar({root,scope,onUse}){
 const bar=document.createElement('aside');bar.className='artifact-bar';bar.setAttribute('aria-label','Артефакты');root.append(bar);
 let signature='';const entries=new Map(),pulses=new Map(),timers=new Map();
 scope.cleanup(()=>{for(const timer of timers.values())clearTimeout(timer);});
 function create(id){
  const a=artifactById(id),button=document.createElement('button');button.type='button';button.className='artifact-button';button.dataset.artifact=id;button.dataset.kind=a.kind;button.setAttribute('aria-label',a.name);
  const img=document.createElement('img');img.src=artifactImage(id,import.meta.env.BASE_URL);img.alt='';img.draggable=false;button.append(artifactIcon(img,id));
  const count=document.createElement('span');count.className='artifact-count';if(a.charges)button.append(count);
  const tip=document.createElement('span');tip.className='artifact-tooltip';const name=document.createElement('strong');name.textContent=a.name;const kind=document.createElement('em'),text=document.createElement('span');text.textContent=a.description;const recovery=document.createElement('em');recovery.textContent=actionLabel(a)+(a.charges?' · '+rechargeHint(a):'');
  const rarity=document.createElement('span');rarity.className='relic-rarity';rarity.style.setProperty('--rarity-color',rarityInfo(id).color);rarity.textContent=rarityInfo(id).name;tip.append(rarity,name,kind,text,recovery);button.append(tip);
  button.addEventListener('click',()=>{
   if(a.kind==='active'){
    clearTimeout(timers.get(id));pulses.set(id,performance.now()+450);button.dataset.glowing='true';
    timers.set(id,setTimeout(()=>{pulses.delete(id);timers.delete(id);if(button.dataset.on!=='true')button.dataset.glowing='false';},450));
   }onUse(id);
  });
  return {button,count,kind};
 }
 return {render({owned=[],used={},toggles={},battle=false,context=null,busy=false,target=null}={}){
  const next=JSON.stringify([owned,used,toggles,battle,context,busy,target]);if(next===signature)return;signature=next;bar.hidden=!owned.length;
  for(const [id,entry] of entries)if(!owned.includes(id)){entry.button.remove();entries.delete(id);}
  let index=0;
  for(const id of owned){
   const a=artifactById(id);if(!a)continue;
   if(!entries.has(id))entries.set(id,create(id));const {button,count,kind}=entries.get(id);
   const enabled=a.kind==='toggle'?toggles[id]!==false:target===id,remaining=Math.max(0,(a.charges??0)-(used[id]??0));
   if(a.kind==='toggle')button.setAttribute('aria-pressed',String(enabled));button.dataset.on=String(enabled);button.dataset.glowing=String(enabled||(pulses.get(id)??0)>performance.now());
   if(a.charges)button.setAttribute('aria-description',`${remaining} из ${a.charges}, ${rechargeLabel(a)}. ${rechargeHint(a)}`);
   const available=a.kind!=='active'||!!(a.context?a.context===context:battle)&&remaining>0;
   button.dataset.available=String(available);button.disabled=busy||!available;if(count.textContent!==String(remaining))count.textContent=String(remaining);
   const kindText=kindLabel(a)+(a.charges?` · ${remaining}/${a.charges} · ${rechargeLabel(a)}`:'');if(kind.textContent!==kindText)kind.textContent=kindText;
   if(bar.children[index]!==button)bar.insertBefore(button,bar.children[index]??null);index++;
  }
 }};
}
