import {mountSoundControls} from './audio/controls.js';
mountSoundControls();
import './game-input.js';
import './style.css';
import './materials.css';
import { materials, pieceImage } from './piece-sets.js';
import { approvedEffects, variants } from './lab/shaders/variants.js';
import { createSpriteRenderer } from './lab/shaders/renderer.js';
const collection=document.getElementById('material-collection');
const effectSlots=[];
const roles={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь'};
const wildSection=document.createElement('section');wildSection.className='material-section';wildSection.id='wild';
wildSection.innerHTML='<h2>Дикие · алые резные фигуры</h2><p class="material-effect-label">Цербер, горгулья, змей и дракон · отдельная сторона · 2 жизни</p><div class="material-grid wild-grid"></div>';
for(const [type,motif] of [['n','Цербер'],['r','Горгулья'],['b','Змей'],['q','Дракон']]){
 const card=document.createElement('figure');card.className='material-card';
 const pair=document.createElement('div');pair.className='material-comparison';
 for(const color of ['w','wild']){const img=document.createElement('img');img.src=pieceImage({type,color},'neo',import.meta.env.BASE_URL);img.alt=`${roles[type]} · ${color==='wild'?motif:'Neo'}`;pair.append(img);}
 const caption=document.createElement('figcaption');caption.textContent=`${roles[type]} · ${motif}`;card.append(pair,caption);wildSection.querySelector('.wild-grid').append(card);
}
collection.append(wildSection);
for(const material of [...materials,{id:'power',name:'Усиленные · эффект атаки'}]){
 const section=document.createElement('section');section.className='material-section';
 const title=document.createElement('h2');title.textContent=material.name;section.append(title);
 const chosen=approvedEffects[material.id];
 if(chosen){const label=document.createElement('p');label.className='material-effect-label';label.textContent=`${variants.find(v=>v.id===chosen.id).name} · ${Math.round(chosen.intensity*100)}%${chosen.pending?' · предпросмотр, вариант ещё не выбран':''}`;section.append(label);}
 const grid=document.createElement('div');grid.className='material-grid';
 for(const color of ['w','b'])for(const type of Object.keys(roles)){
  const card=document.createElement('figure');card.className='material-card';
  const comparison=document.createElement('div');comparison.className='material-comparison';
  for(const variant of [null,material.id]){
   const img=document.createElement('img');img.src=pieceImage({color,type,material:variant},'neo',import.meta.env.BASE_URL);img.alt=`${color==='w'?'Белая':'Чёрная'} ${roles[type].toLowerCase()} · ${variant?material.name:'Оригинал Neo'}`;img.loading='lazy';comparison.append(img);
   if(variant&&chosen){const effect=variants.find(v=>v.id===chosen.id);img.dataset.shader=chosen.id;img.dataset.intensity=String(chosen.intensity);effectSlots.push({image:img,category:effect.category,index:effect.index,intensity:chosen.intensity});}
  }
  const caption=document.createElement('figcaption');caption.textContent=`${color==='w'?'Белые':'Чёрные'} · ${roles[type]}`;card.append(comparison,caption);grid.append(card);
 }
 section.append(grid);document.getElementById('material-collection').append(section);
}

const ruins=document.createElement('section');ruins.className='material-section';
const heading=document.createElement('h2');heading.textContent='Разбитые фигуры · находки в подземелье';ruins.append(heading);
const grid=document.createElement('div');grid.className='material-grid';
for(const [type,name] of Object.entries(roles)){const card=document.createElement('figure');card.className='material-card';const pair=document.createElement('div');pair.className='material-comparison';for(const path of ['pieces/neo/w'+type+'.png','pieces/neo/ruins/'+type+'.png']){const img=document.createElement('img');img.src=import.meta.env.BASE_URL+path;img.alt=name+' · '+(path.includes('ruins')?'разбитая серая Neo':'оригинал Neo');pair.append(img);}const label=document.createElement('figcaption');label.textContent=name;card.append(pair,label);grid.append(card);}ruins.append(grid);document.getElementById('material-collection').append(ruins);

const canvas=document.createElement('canvas');canvas.className='material-effects';canvas.setAttribute('aria-hidden','true');collection.prepend(canvas);
const status=document.getElementById('material-effect-status');
let renderer;
try{
 renderer=createSpriteRenderer(canvas,effectSlots,{visibleOnly:true,maxTextureSize:512,readyMessage:'Выбранные эффекты включены · алмаз 100% · эфир 60% · усиление 175%',onStatus(message,ready){status.textContent=message;collection.classList.toggle('material-effects-ready',ready);}});
 renderer.load();
}catch(error){status.textContent=error.message;}
window.addEventListener('pagehide',event=>{if(!event.persisted)renderer?.dispose();});
