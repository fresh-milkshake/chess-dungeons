import {audioSettings} from './settings.js';
import {music,audioStatus,subscribeAudio} from './runtime.js';
import {soundtrack} from './playlist.js';
import './controls.css';
const soundSvg=muted=>`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 5 5.5 9H2v6h3.5l4.5 4V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>${muted?'<path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>':'<path d="M14 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'}</svg>`;
export function mountSoundControls(){
 if(document.querySelector('#game-audio-controls'))return;
 const root=document.createElement('aside');root.id='game-audio-controls';root.className='game-audio-controls';root.setAttribute('aria-label','Управление звуком');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='game-audio-toggle';toggle.setAttribute('aria-controls','game-audio-panel');
 const panel=document.createElement('div');panel.id='game-audio-panel';panel.className='game-audio-panel';panel.hidden=true;
 const head=document.createElement('div');head.className='game-audio-heading';head.textContent='Звук';panel.append(head);
 const fields=new Map();for(const [key,name] of [['master','Общая громкость'],['music','Музыка и окружение'],['effects','Звуки ходов']]){
  const label=document.createElement('label'),caption=document.createElement('span'),value=document.createElement('output'),range=document.createElement('input');caption.textContent=name;range.type='range';range.min=0;range.max=100;range.step=1;range.setAttribute('aria-label',name);label.append(caption,value,range);panel.append(label);fields.set(key,{range,value});range.addEventListener('input',()=>{audioSettings.set({[key]:Number(range.value)/100,...(Number(range.value)>0?{muted:false}:{})});music().unlock();});
 }
 const credit=document.createElement('a');credit.href=`${import.meta.env.BASE_URL}audio/CREDITS.html`;credit.target='_blank';credit.rel='noopener';credit.textContent='Музыка и авторы ↗';panel.append(credit);
 const status=document.createElement('p');status.className='game-audio-status';status.setAttribute('role','status');panel.append(status);root.append(toggle,panel);document.body.append(root);
 const show=()=>{panel.hidden=false;toggle.setAttribute('aria-expanded','true');};const hide=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');};
 const render=()=>{const s=audioSettings.get(),muted=s.muted||s.master===0;if(toggle.dataset.muted!==String(muted))toggle.innerHTML=soundSvg(muted);toggle.setAttribute('aria-label',muted?'Включить звук':'Выключить звук');toggle.setAttribute('aria-pressed',String(muted));toggle.dataset.muted=String(muted);for(const [key,{range,value}] of fields){range.value=Math.round(s[key]*100);if(value.textContent!==range.value+'%')value.textContent=range.value+'%';}const audio=audioStatus();status.textContent=audio.error|| (audio.loading?'Загрузка звука…':audio.track?soundtrack[audio.track].name:'');root.dataset.track=audio.track??'';root.dataset.playing=String(audio.playing&&!muted);};
 audioSettings.subscribe(render);subscribeAudio(render);render();hide();
 toggle.addEventListener('click',()=>{audioSettings.set({muted:!audioSettings.get().muted,...(audioSettings.get().master===0?{master:.7}:{})});show();music().unlock();});root.addEventListener('pointerenter',show);root.addEventListener('pointerleave',()=>{if(!root.contains(document.activeElement))hide();});root.addEventListener('focusin',show);root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))hide();});root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();hide();toggle.blur();}});
 document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))hide();});
 const unlock=()=>music().unlock();document.addEventListener('pointerdown',unlock,{once:true,capture:true});document.addEventListener('keydown',unlock,{once:true,capture:true});document.addEventListener('visibilitychange',()=>music().visibility(document.hidden));
}
