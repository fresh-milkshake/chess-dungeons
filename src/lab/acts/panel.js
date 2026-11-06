import {actVariants,actScene} from './catalog.js';
import {drawActScene,sceneCell,describeCell,sceneSize,remainsImage} from './draw.js';
import {pieceImage} from '../../piece-sets.js';
import './style.css';
import {previewSprite,gardenSprite} from './preview-rules.js';
import {createIceShader} from './ice-shader.js';
import {setupDragonStudy} from './dragon.js';
import {createAtlasMaterials} from './atlas-materials.js';
import {selectedMaterials,selectedActScene} from './selected-materials.js';

export function setupActLab(root){
 root.innerHTML=`<div class="act-atlas"><header class="act-atlas-heading"><div><p class="act-eyebrow">АТЛАС ПОДЗЕМЕЛЬЯ · ВИЗУАЛЬНЫЕ ПРОТОТИПЫ</p><h1>Четыре акта. <em>Шесть миров.</em></h1><p class="act-intro">Один отряд — разные способы думать о позиции. Рассмотрите карту и доску, затем пройдите пять шагов каждой механики.</p></div><ol class="act-route"><li><b>I</b><span>Начало<small>1 вариант</small></span></li><li><b>II</b><span>Испытание<small>3 варианта</small></span></li><li><b>III</b><span>Раскол<small>1 вариант</small></span></li><li><b>IV</b><span>Император<small>1 этаж</small></span></li></ol></header><div class="act-atlas-controls"><div class="act-filters" role="group" aria-label="Фильтр актов"><button type="button" data-act-filter="all" aria-pressed="true">Все миры</button><button type="button" data-act-filter="1" aria-pressed="false">Акт I</button><button type="button" data-act-filter="2" aria-pressed="false">Акт II</button><button type="button" data-act-filter="3" aria-pressed="false">Акт III</button><button type="button" data-act-filter="4" aria-pressed="false">Акт IV</button></div><button type="button" class="act-motion" aria-pressed="false">Пауза эффектов</button></div><p class="act-prototype-note">Шаги — постановочные примеры предлагаемых правил. Эти образцы не меняют текущий забег и не запускают бой с ИИ. На клетку можно нажать, чтобы узнать её свойства.</p><div class="act-atlas-grid"></div></div>`;
 const images=new Map(),cards=[],motion=root.querySelector('.act-motion'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,last=0,time=0,paused=reduced.matches,dirty=true;
 const iceShader=createIceShader();root.dataset.iceRenderer=iceShader?'webgl2':'canvas2d-fallback';
 const materials=createAtlasMaterials();root.dataset.materialRenderer=materials?'webgl2-baked':'fallback';
 root.querySelector('.act-intro').textContent='Выбранные материалы, стены и туман войны — для просмотра перед переносом в игру.';
 root.querySelector('.act-prototype-note').textContent='Только лаборатория: оформление текущего забега не меняется. На карте туман закрывает дальнюю область; снимите его для сравнения. Пять шагов ниже показывают особенности каждой локации.';
 function load(url){if(images.has(url))return;const img=new Image();img.onload=()=>{dirty=true;start();};img.onerror=()=>{root.dataset.assetError='true';};img.src=url;images.set(url,img);}
 function prepare(card){
  card.previous=card.scenes;card.effectStart=time;
  card.scenes=card.views.map(view=>{const scene=selectedActScene(actScene(card.theme.id,view.kind,card.step));for(const p of scene.pieces)load(previewSprite(p,import.meta.env.BASE_URL)??pieceImage(p,'neo',import.meta.env.BASE_URL));for(const d of scene.decorations)load(gardenSprite(d.type,import.meta.env.BASE_URL));for(const t of scene.tiles)if(t.type==='remains')load(remainsImage(t.role,import.meta.env.BASE_URL));view.canvas.setAttribute('aria-label',`${card.theme.name} · ${view.kind==='map'?'фрагмент карты':'фрагмент боя'}. ${scene.caption}`);return scene;});
  card.phase.textContent=card.scenes[1].phase;card.caption.textContent=card.scenes[1].caption;
  card.next.textContent=card.step===4?'Повторить цикл':'Следующий шаг';card.dots.forEach((d,i)=>d.classList.toggle('current',i===card.step));
  card.started=performance.now();card.node.querySelector('.act-cell-info').textContent='Нажмите на клетку · стрелки перемещают указатель.';dirty=true;start();
 }
 for(const theme of actVariants){
  const node=document.createElement('article');node.className='act-study';node.dataset.act=String(theme.act);node.dataset.biome=theme.id;node.style.setProperty('--act-accent',theme.accent);node.style.setProperty('--act-ground',theme.ground);
  const roman=['I','II','III','IV'][theme.act-1];
  node.innerHTML=`<header class="act-study-heading"><div><p class="act-eyebrow">АКТ ${roman} · ${theme.terrain.toUpperCase()}</p><h2>${theme.name}</h2><p class="act-subtitle">${theme.subtitle}</p></div><span class="act-study-index" aria-hidden="true">${roman}</span></header><div class="act-study-scenes"><figure><figcaption><span>Исследование</span><small>Фрагмент карты</small></figcaption><canvas width="640" height="640" tabindex="0" role="img" data-scene="map"></canvas></figure><figure><figcaption><span>Сражение</span><small>Фрагмент доски</small></figcaption><canvas width="640" height="640" tabindex="0" role="img" data-scene="battle"></canvas></figure></div><p class="act-rule">${theme.rule}</p><div class="act-study-playback"><div class="act-step-dots" aria-hidden="true">${'<i></i>'.repeat(5)}</div><strong class="act-phase"></strong><div class="act-step-buttons"><button type="button" class="act-reset" aria-label="Сначала: ${theme.name}" title="Сначала">↺</button><button type="button" class="act-next" aria-label="Следующий шаг: ${theme.name}">Следующий шаг</button></div></div><p class="act-step-caption" aria-live="polite"></p><p class="act-cell-info">Нажмите на клетку · стрелки перемещают указатель.</p><footer class="act-study-footer"><span>${theme.tactic}</span><small>Босс · ${theme.boss}</small></footer>`;
  root.querySelector('.act-atlas-grid').append(node);
  const selection=selectedMaterials[theme.id],materialNote=document.createElement('p');materialNote.className='act-material-note';materialNote.textContent=selection.note;node.querySelector('.act-study-heading').after(materialNote);
  if(theme.id==='ruins'){node.style.setProperty('--act-accent','#a8b9b4');node.style.setProperty('--act-ground','#171d1e');node.querySelector('.act-subtitle').textContent='Здесь всё ещё ждут. Уже никто не помнит кого.';}
  if(theme.id==='crypt'){node.style.setProperty('--act-accent','#a5b7ae');node.style.setProperty('--act-ground','#111819');}
  const fogButton=document.createElement('button');fogButton.type='button';fogButton.className='act-fog-toggle';fogButton.setAttribute('aria-pressed','true');fogButton.textContent=`Туман: ${selection.fog}`;node.querySelector('figure figcaption').append(fogButton);
  const views=[...node.querySelectorAll('canvas')].map(canvas=>({canvas,kind:canvas.dataset.scene,context:canvas.getContext('2d'),selected:null}));
  const card={node,theme,views,scenes:[],step:0,fog:true,visible:false,started:0,phase:node.querySelector('.act-phase'),caption:node.querySelector('.act-step-caption'),dots:[...node.querySelectorAll('.act-step-dots i')],next:node.querySelector('.act-next')};cards.push(card);
  fogButton.addEventListener('click',()=>{card.fog=!card.fog;fogButton.setAttribute('aria-pressed',String(card.fog));fogButton.textContent=card.fog?`Туман: ${selection.fog}`:'Туман снят · показать';dirty=true;start();});
  node.querySelector('.act-next').addEventListener('click',()=>{card.step=(card.step+1)%5;prepare(card);});
  node.querySelector('.act-reset').addEventListener('click',()=>{card.step=0;for(const v of views)v.selected=null;prepare(card);});
  for(const [index,view] of views.entries()){
   function inspect(cell){view.selected=cell;node.querySelector('.act-cell-info').textContent=describeCell(card.scenes[index],cell);dirty=true;start();}
   view.canvas.addEventListener('click',event=>inspect(sceneCell(view.canvas,event,card.scenes[index].size)));
   view.canvas.addEventListener('keydown',event=>{
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(event.key==='Escape'){inspect(null);return;}
    const direction=directions[event.key];if(!direction)return;event.preventDefault();event.stopPropagation();
    const p=view.selected??{x:0,y:0},size=card.scenes[index].size;inspect({x:Math.max(0,Math.min(size-1,p.x+direction[0])),y:Math.max(0,Math.min(size-1,p.y+direction[1]))});
   });
  }
  prepare(card);
 }
 setupDragonStudy(root.querySelector('[data-biome="court"]'));
 function syncPause(){motion.textContent=paused?'Продолжить эффекты':'Пауза эффектов';motion.setAttribute('aria-pressed',String(paused));}
 syncPause();motion.addEventListener('click',()=>{paused=!paused;syncPause();dirty=true;start();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;syncPause();dirty=true;start();});
 for(const button of root.querySelectorAll('[data-act-filter]'))button.addEventListener('click',()=>{
  const act=button.dataset.actFilter;for(const b of root.querySelectorAll('[data-act-filter]'))b.setAttribute('aria-pressed',String(b===button));
  for(const card of cards)card.node.hidden=act!=='all'&&String(card.theme.act)!==act;
  dirty=true;start();
 });
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const c=cards.find(c=>c.node===e.target);if(c){if(e.isIntersecting&&!c.seen){c.effectStart=time;c.seen=true;}c.visible=e.isIntersecting;}}dirty=true;start();},{rootMargin:'80px'});cards.forEach(c=>observer.observe(c.node));
 const resize=new ResizeObserver(entries=>{for(const e of entries){const canvas=e.target,side=Math.max(1,Math.min(1280,Math.round(e.contentRect.width*Math.min(devicePixelRatio||1,2))));if(canvas.width!==side){canvas.width=canvas.height=side;}}dirty=true;start();});cards.forEach(c=>c.views.forEach(v=>resize.observe(v.canvas)));
 new MutationObserver(()=>{if(root.hidden)stop();else{dirty=true;start();}}).observe(root,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
 function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
 function start(){if(!frame&&!document.hidden&&!root.hidden)frame=requestAnimationFrame(tick);}
 function tick(now){
  frame=0;if(root.hidden||document.hidden)return;
  const visible=cards.filter(c=>c.visible&&!c.node.hidden);if(!visible.length)return;
  const moving=!reduced.matches&&visible.some(c=>now-c.started<240);
  if(dirty||now-last>=1000/24){
   if(last&&!paused)time+=Math.min((now-last)/1000,.1);last=now;
   let draws=0;
   for(const card of visible)for(const [i,view] of card.views.entries()){
    view.context.setTransform(view.canvas.width/sceneSize,0,0,view.canvas.height/sceneSize,0,0);
    drawActScene(view.context,card.scenes[i],images,time,{selected:view.selected,progress:reduced.matches?1:Math.min(1,(now-card.started)/220),age:reduced.matches?10:time-card.effectStart,previous:card.previous?.[i],iceShader,materials,fog:card.fog});draws++;
   }
   root.dataset.draws=String(draws);root.dataset.frames=String(Number(root.dataset.frames??0)+1);root.dataset.time=time.toFixed(2);dirty=false;
  }
  if(!paused||moving)frame=requestAnimationFrame(tick);
 }
 window.addEventListener('pagehide',()=>{stop();materials?.dispose();iceShader?.dispose();},{once:true});
 root.dataset.renderer='canvas2d';root.dataset.variants=String(cards.length);return {cards};
}
