import {artifacts,artifactImage,kindLabel} from '../artifacts/catalog.js';
import './relics.css';
import {artifactIcon} from '../artifacts/icon-effects.js';

export function setupRelicDebug({root,scope,getState,onChange,onReset,isBusy=()=>false}){
 const panel=root.querySelector('#debug-panel');
 const section=document.createElement('section');section.className='debug-relics';
 const heading=document.createElement('h3');heading.textContent='Реликвии';section.append(heading);
 const list=document.createElement('div');list.className='debug-relic-list';
 for(const a of artifacts){
  const label=document.createElement('label'),input=document.createElement('input'),img=document.createElement('img'),text=document.createElement('span');
  input.type='checkbox';input.dataset.relic=a.id;input.setAttribute('aria-label',`Реликвия: ${a.name}`);
  img.src=artifactImage(a.id,import.meta.env.BASE_URL);img.alt='';img.draggable=false;
  const icon=artifactIcon(img,a.id);icon.style.width=icon.style.height='28px';text.textContent=a.name;label.title=`${kindLabel(a)}. ${a.description}`;label.append(input,icon,text);list.append(label);
 }
 const actions=document.createElement('div');actions.className='debug-relic-actions';
 const all=document.createElement('button'),none=document.createElement('button'),reset=document.createElement('button');
 all.textContent='Выдать все';none.textContent='Убрать все';reset.textContent='Восстановить заряды';reset.hidden=!onReset;
 for(const b of [all,none,reset])b.type='button';actions.append(all,none,reset);
 const status=document.createElement('p');status.className='debug-relic-status';status.setAttribute('role','status');
 const hint=document.createElement('small');hint.textContent='Только debug: бесплатно. Подключение призывов к обычному бою начинает историю ходов заново.';
 section.append(list,actions,hint,status);panel.append(section);
 let pending=false;
 function render(){const state=getState();if(!state)return;const owned=new Set(state.owned??[]);for(const input of list.querySelectorAll('input')){input.checked=owned.has(input.dataset.relic);input.disabled=pending||isBusy();}for(const b of [all,none,reset])b.disabled=pending||isBusy();}
 async function change(action){if(pending||isBusy())return;pending=true;render();try{await action();status.textContent='Готово.';}catch(error){status.textContent=error.message;}finally{pending=false;if(scope.active)render();}}
 list.addEventListener('change',event=>{const input=event.target;if(!input.dataset.relic)return;const owned=new Set(getState()?.owned??[]);if(input.checked)owned.add(input.dataset.relic);else owned.delete(input.dataset.relic);change(()=>onChange([...owned]));});
 all.addEventListener('click',()=>change(()=>onChange(artifacts.map(a=>a.id))));none.addEventListener('click',()=>change(()=>onChange([])));reset.addEventListener('click',()=>change(onReset));
 scope.on(document,'debug-menu-change',event=>{if(event.detail.open)render();});
 render();return {render};
}
