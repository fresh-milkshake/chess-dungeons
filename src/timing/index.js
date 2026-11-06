import './style.css';
import {ActiveClock} from './clock.js';
import {timingKey,preferenceKey,emptyReport,readReport,addTime,summarizeRun,phaseNames} from './storage.js';

let service;
const format=ms=>{const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/3600)?Math.floor(seconds/3600)+':':''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
function createService(){
 const pending=[];let context=null,selectedRun=null,panelOpen=false,debugOpen=false,storageError=false;
 let enabled=true;try{enabled=localStorage.getItem(preferenceKey)!=='off';}catch{storageError=true;}
 const clock=new ActiveClock({enabled,focused:document.hasFocus(),visible:!document.hidden,onTime:(context,time)=>pending.push({context,time})});
 const dock=document.createElement('aside');dock.className='timing-dock';dock.setAttribute('aria-label','Локальный трекинг времени');
 const show=document.createElement('button');show.type='button';show.className='timing-show';show.title='Время по этажам и этапам';show.setAttribute('aria-controls','timing-panel');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='timing-toggle';toggle.title='Включить или отключить учёт времени';dock.append(show,toggle);
 const panel=document.createElement('section');panel.id='timing-panel';panel.className='timing-panel';panel.hidden=true;panel.setAttribute('aria-label','Статистика активного времени');
 panel.innerHTML='<div class="timing-heading"><strong>Время в игре</strong><button type="button" class="timing-close" aria-label="Закрыть статистику">×</button></div><p class="timing-note">Только время в фокусе. Хранится в этом браузере, никуда не отправляется.</p><label class="timing-setting"><input type="checkbox"> Записывать активное время</label><select aria-label="Забег для просмотра"></select><div class="timing-summary"></div><div class="timing-areas"></div><p class="timing-error" role="status"></p><div class="timing-actions"><button type="button" class="timing-export">Скачать JSON</button><button type="button" class="timing-clear">Очистить статистику</button></div>';
 const checkbox=panel.querySelector('input'),select=panel.querySelector('select');
 function report(){let report;try{report=readReport(localStorage);}catch{report=emptyReport();storageError=true;}for(const {context,time} of pending)addTime(report,context,time);return report;}
 const effectiveContext=()=>context?{...context,phase:panelOpen&&panel.contains(document.activeElement)?'stats':debugOpen&&(document.querySelector('.app-screen:not([hidden]) .debug-panel')??document.querySelector('.debug-panel'))?.contains(document.activeElement)?'debug':context.phase}:null;
 function flush(){
  clock.tick();if(!pending.length)return;
  try{const data=report();localStorage.setItem(timingKey,JSON.stringify(data));pending.length=0;storageError=false;}catch{storageError=true;}
 }
 function mount(){if(!dock.isConnected)document.body.append(dock);if(!panel.isConnected)document.body.append(panel);}
 function render(){
  mount();const data=report(),runId=selectedRun??context?.runId,current=summarizeRun(data.runs[context?.runId]);
  toggle.textContent=clock.enabled?'Трекинг: вкл':'Трекинг: выкл';toggle.setAttribute('aria-pressed',String(clock.enabled));checkbox.checked=clock.enabled;
  show.textContent=`◷ ${format(current.total)}`;show.setAttribute('aria-expanded',String(panelOpen));panel.hidden=!panelOpen;
  if(!panelOpen)return;
  const ids=Object.keys(data.runs).sort((a,b)=>data.runs[b].updatedAt-data.runs[a].updatedAt);
  const signature=JSON.stringify([ids,context?.runId]);if(select.dataset.signature!==signature){select.replaceChildren(...ids.map(id=>{const option=document.createElement('option');option.value=id;option.textContent=id===context?.runId?'Текущий забег':`Забег · ${new Date(data.runs[id].startedAt).toLocaleString('ru-RU')}`;return option;}));select.dataset.signature=signature;}if(ids.includes(runId))select.value=runId;
  const summary=summarizeRun(data.runs[select.value]),table=document.createElement('table');
  const combat=(summary.phases['battle-player']??0)+(summary.phases['battle-bot']??0);if(combat){const row=table.insertRow();row.insertCell().textContent='Бой · всего';row.insertCell().textContent=format(combat);}
  for(const [phase,time] of Object.entries(summary.phases)){const row=table.insertRow();row.insertCell().textContent=phaseNames[phase]??phase;row.insertCell().textContent=format(time);}
  const total=document.createElement('p');total.className='timing-total';total.textContent=`Активное время · ${format(summary.total)}`;panel.querySelector('.timing-summary').replaceChildren(total,table);
  const openAreas=new Set([...panel.querySelectorAll('details[open]')].map(detail=>detail.dataset.area));
  panel.querySelector('.timing-areas').replaceChildren(...summary.areas.sort((a,b)=>a.act-b.act||(a.area==='shop'?99:a.floor)-(b.area==='shop'?99:b.floor)).map(area=>{
   const details=document.createElement('details'),title=document.createElement('summary');details.dataset.area=`${area.act}:${area.area==='shop'?'shop':area.floor}`;details.open=openAreas.has(details.dataset.area);title.textContent=area.area==='shop'?`Магазин после акта ${area.act} · ${format(area.total)}`:area.area==='standalone'?`Отдельный бой · ${format(area.total)}`:`Акт ${area.act} · этаж ${area.floor} · ${format(area.total)}`;details.append(title);
   if(area.map?.rooms){const info=document.createElement('p');info.textContent=`${area.map.rooms} комн. · ${area.map.width} × ${area.map.height}`;details.append(info);}
   for(const [phase,time] of Object.entries(area.phases)){const line=document.createElement('p');line.textContent=`${phaseNames[phase]??phase}: ${format(time)}`;details.append(line);}
   for(const encounter of Object.values(area.encounters??{})){
    const line=document.createElement('p'),fight=(encounter.phases['battle-player']??0)+(encounter.phases['battle-bot']??0);line.textContent=`${encounter.name} · подготовка ${format(encounter.phases.preparation??0)} · бой ${format(fight)}`;details.append(line);
   }
   return details;
  }));
  panel.querySelector('.timing-error').textContent=storageError?'Не удалось сохранить статистику в хранилище браузера.':'';
 }
 function setEnabled(value,persist=true){
  clock.setEnabled(value);flush();if(persist)try{localStorage.setItem(preferenceKey,value?'on':'off');}catch{storageError=true;}render();
 }
 const focusGame=()=>{document.getElementById('map-viewport')?.focus({preventScroll:true});};
 toggle.addEventListener('click',()=>{setEnabled(!clock.enabled);toggle.blur();focusGame();});checkbox.addEventListener('change',()=>setEnabled(checkbox.checked));
 show.addEventListener('click',()=>{clock.tick();panelOpen=!panelOpen;clock.setContext(effectiveContext());render();if(panelOpen)checkbox.focus();else focusGame();});panel.querySelector('.timing-close').addEventListener('click',()=>{panelOpen=false;clock.setContext(effectiveContext());render();focusGame();});select.addEventListener('change',()=>{selectedRun=select.value;render();});
 panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();panelOpen=false;clock.setContext(effectiveContext());render();focusGame();}});dock.addEventListener('keydown',event=>event.stopPropagation());
 panel.querySelector('.timing-export').addEventListener('click',()=>{flush();const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='chess-dungeons-active-time.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 panel.querySelector('.timing-clear').addEventListener('click',()=>{clock.tick();pending.length=0;try{localStorage.removeItem(timingKey);}catch{storageError=true;}selectedRun=null;render();});
 window.addEventListener('blur',()=>{clock.setActivity({focused:false});flush();render();});window.addEventListener('focus',()=>{clock.setActivity({focused:true,visible:!document.hidden});render();});
 document.addEventListener('visibilitychange',()=>{clock.setActivity({visible:!document.hidden,focused:document.hasFocus()});flush();render();});
 window.addEventListener('pagehide',()=>{clock.setActivity({visible:false});flush();});window.addEventListener('pageshow',()=>clock.setActivity({visible:!document.hidden,focused:document.hasFocus()}));
 window.addEventListener('storage',event=>{if(event.key===preferenceKey)setEnabled(event.newValue!=='off',false);else if(event.key===timingKey)render();});
 document.addEventListener('debug-menu-change',event=>{debugOpen=event.detail.open;clock.setContext(effectiveContext());render();});
 document.addEventListener('focusin',()=>clock.setContext(effectiveContext()));
 document.addEventListener('focusout',()=>queueMicrotask(()=>clock.setContext(effectiveContext())));
 setInterval(()=>{clock.tick();render();},1000);setInterval(flush,5000);
 return {setContext(next){const key=JSON.stringify(next);if(key!==JSON.stringify(context)){if(context?.runId!==next.runId)selectedRun=null;clock.tick();context={...next};clock.setContext(effectiveContext());flush();}render();}};
}
export function trackStage(context){service??=createService();service.setContext(context);}
export function runTimingContext(run,phase,extra={}){return {runId:run.id,act:run.act,floor:run.stage==='shop'?null:run.floor,area:run.stage==='shop'?'shop':'floor',rooms:run.map?.rooms?.length,mapWidth:run.map?.width,mapHeight:run.map?.height,layout:run.map?.layout,generation:run.map?.generation,phase,...extra};}
export function trackRun(run,phase,extra={}){trackStage(runTimingContext(run,phase,extra));}
