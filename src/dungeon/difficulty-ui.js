import {difficultyPresets,normalizeDifficulty,difficultyDebugKey} from '../battle/difficulty.js';
import './difficulty.css';
export function readDifficultyDebug(){try{return {show:false,manual:false,elo:1200,...JSON.parse(localStorage.getItem(difficultyDebugKey)??'{}')};}catch{return {show:false,manual:false,elo:1200};}}
function saveDebug(value){localStorage.setItem(difficultyDebugKey,JSON.stringify(value));document.dispatchEvent(new CustomEvent('difficulty-display-change'));}
export function renderEloCaption(anchor,profile){
 if(!anchor)return;let caption=anchor.querySelector('.encounter-elo');if(!caption){caption=document.createElement('p');caption.className='encounter-elo';anchor.append(caption);}
 caption.hidden=!readDifficultyDebug().show;caption.textContent=`≈ ${profile.elo} Elo`;caption.title='Предполагаемая шахматная сила. Для особых правил — предварительная оценка, требующая калибровки.';
}
export function setupDifficultyDebug({root,scope,getDifficulty,onChange,getProfile}){
 const panel=root.querySelector('#debug-panel'),section=document.createElement('section');section.className='difficulty-debug';
 section.innerHTML='<h3>Сложность ИИ</h3><label><input type="checkbox" class="elo-manual"> Ручная настройка Elo</label><label class="elo-range-label">Предполагаемая сила <output></output><input class="elo-range" aria-label="Сложность противника в Elo" type="range" min="100" max="2850" step="50"></label><label><input type="checkbox" class="elo-show"> Показывать Elo перед боем</label><p>Обычные правила: штатный UCI Elo. Особые правила: предварительная оценка; нужна калибровка партий.</p>';
 panel.append(section);const manual=section.querySelector('.elo-manual'),slider=section.querySelector('.elo-range'),output=section.querySelector('output'),show=section.querySelector('.elo-show');
 const refresh=()=>{const d=normalizeDifficulty(getDifficulty()),prefs=readDifficultyDebug();manual.checked=d.overrideElo!==null;slider.value=String(d.overrideElo??prefs.elo);slider.disabled=!manual.checked;output.value=slider.value+' Elo';show.checked=prefs.show;};
 const commit=()=>{const prefs=readDifficultyDebug();saveDebug({...prefs,manual:manual.checked,elo:Number(slider.value)});onChange({...normalizeDifficulty(getDifficulty()),overrideElo:manual.checked?Number(slider.value):null});refresh();};
 manual.addEventListener('change',commit);slider.addEventListener('input',()=>{output.value=slider.value+' Elo';});slider.addEventListener('change',commit);show.addEventListener('change',()=>{saveDebug({...readDifficultyDebug(),show:show.checked});onChange(normalizeDifficulty(getDifficulty()));});
 scope.on(document,'difficulty-display-change',()=>{show.checked=readDifficultyDebug().show;});refresh();return {refresh};
}
export function createRunPicker({root,scope,onStart}){
 const dialog=document.createElement('dialog');dialog.className='run-difficulty';dialog.setAttribute('aria-labelledby','run-difficulty-title');
 dialog.innerHTML='<p class="difficulty-eyebrow">НОВЫЙ ЗАБЕГ</p><h2 id="run-difficulty-title">Выберите испытание</h2><p class="difficulty-intro">Четыре акта. Десять этажей. Ваш темп игры.</p><div class="difficulty-options" role="radiogroup" aria-label="Сложность забега"></div><p class="difficulty-custom" hidden></p><details class="difficulty-picker-debug"><summary>Debug</summary><label><input class="picker-manual" type="checkbox"> Задать Elo вручную</label><label>Предполагаемая сила <output class="picker-elo-value"></output><input class="picker-elo" aria-label="Elo нового забега" type="range" min="100" max="2850" step="50"></label><p>Для особых правил значение ориентировочное.</p></details><div class="difficulty-actions"><button class="difficulty-cancel secondary-button">Назад</button><button class="difficulty-start primary-button">Войти в подземелье</button></div>';
 root.append(dialog);let preset='medium',required=false;
 const pickerManual=dialog.querySelector('.picker-manual'),pickerSlider=dialog.querySelector('.picker-elo'),pickerValue=dialog.querySelector('.picker-elo-value');
 const changePicker=()=>{saveDebug({...readDifficultyDebug(),manual:pickerManual.checked,elo:Number(pickerSlider.value)});update();};
 pickerManual.addEventListener('change',changePicker);pickerSlider.addEventListener('input',()=>{pickerValue.value=pickerSlider.value+' Elo';});pickerSlider.addEventListener('change',changePicker);
 const cards=Object.entries(difficultyPresets).map(([id,value],i)=>{const b=document.createElement('button');b.type='button';b.className='difficulty-card';b.setAttribute('role','radio');b.dataset.preset=id;b.innerHTML=`<span class="difficulty-number">0${i+1}</span><strong>${value.name}</strong><span>${value.description}</span>`;b.onclick=()=>{preset=id;update();};dialog.querySelector('.difficulty-options').append(b);return b;});
 const update=()=>{for(const b of cards){b.setAttribute('aria-checked',String(b.dataset.preset===preset));b.tabIndex=b.dataset.preset===preset?0:-1;}const prefs=readDifficultyDebug(),hint=dialog.querySelector('.difficulty-custom');pickerManual.checked=prefs.manual;pickerSlider.value=String(prefs.elo);pickerSlider.disabled=!prefs.manual;pickerValue.value=pickerSlider.value+' Elo';hint.hidden=!prefs.manual;hint.textContent=`Debug: фиксированная сила ≈ ${prefs.elo} Elo на всех этажах.`;};
 cards.forEach((card,index)=>card.addEventListener('keydown',event=>{const delta={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];if(!delta)return;event.preventDefault();const next=cards[(index+delta+cards.length)%cards.length];preset=next.dataset.preset;update();next.focus();}));
 dialog.querySelector('.difficulty-cancel').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(required)event.preventDefault();});
 dialog.querySelector('.difficulty-start').onclick=async()=>{const button=dialog.querySelector('.difficulty-start');button.disabled=true;try{const prefs=readDifficultyDebug();await onStart({preset,overrideElo:prefs.manual?prefs.elo:null});dialog.close();}finally{button.disabled=false;}};
 scope.onPause(()=>dialog.close());scope.cleanup(()=>dialog.remove());
 return {get isOpen(){return dialog.open;},open(mandatory=false){required=mandatory;dialog.querySelector('.difficulty-cancel').hidden=mandatory;update();dialog.showModal();cards.find(b=>b.dataset.preset===preset).focus();}};
}
