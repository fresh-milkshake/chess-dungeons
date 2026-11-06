import {createFogRenderer} from '../fog/renderer.js';
import './fog.css';

export const fogBudget={width:320,height:214,fps:20,octaves:2};
const variants=[
 ['Стелющийся туман','Низкие мягкие облака медленно плывут вдоль границы.'],
 ['Дымные гряды','Крупные слои дыма накатывают друг на друга.'],
 ['Тихие завихрения','Рассеянные вихри без ярких контуров и вспышек.'],
 ['Сумрачная завеса','Вертикальные полупрозрачные струи в плотной темноте.'],
 ['Дыхание глубины','Туман плавно сгущается и редеет небольшими островками.'],
 ['Плотные гряды','Движение F2 с плотной дымовой основой в оттенке доски.'],
 ['Пепельное море','Светлые тяжёлые клубы мягко перетекают друг в друга.'],
 ['Плотные клубы','Густой дым с широкими извивающимися потоками.'],
 ['Дымные валы','Плотные тёплые слои накатывают длинными волнами.'],
 ['Мягкая мгла','Мягкие светлые облака с медленным внутренним завихрением.'],
];


// Explicit knowledge, never the unrevealed terrain, drives the GPU mask.
export function fogScene(){
 return Array.from({length:54},(_,i)=>{
  const x=i%9,y=Math.floor(i/9),state=x>=6?'unknown':x>=4?'memory':'visible';
  return {x,y,state,wall:state!=='unknown'&&((x===3&&y>=1&&y<=4)||(y===0&&x<6)),player:x===1&&y===3};
 });
}

export function setupFogLab(root){
 root.innerHTML=`<div class="fog-heading"><div><small>ДЕСЯТЬ ВАРИАНТОВ · ОДНА СЦЕНА</small><h1>Туман и камень</h1><p>Слева — видимая область, в середине — память карты, справа — неизведанное. Стены имеют рельефные края; туман движется поверх.</p></div><button class="secondary-button" id="fog-pause">Приостановить</button></div><p class="fog-budget">Один WebGL2-контекст · до 320 × 214 на вариант · 20 кадров/с · 2 слоя шума · без размытия и постобработки. В скрытой вкладке и за пределами экрана отрисовка останавливается.</p><div class="fog-grid"></div><p class="fog-selection" aria-live="polite">В игре сейчас F2 · Дымные гряды. F6–F10 — новые плотные варианты для сравнения.</p>`;
 const cards=[],scene=fogScene();let selected='F2';
 try{selected=localStorage.getItem('chess-dungeons-fog-choice')??'F2';}catch{/* Optional preference. */}
 for(let i=0;i<variants.length;i++){
  if(i===5){const heading=document.createElement('h2');heading.className='fog-divider';heading.textContent='Новые варианты · плотный дым';root.querySelector('.fog-grid').append(heading);}
  const card=document.createElement('button');card.type='button';card.className='fog-card';card.dataset.variant=`F${i+1}`;card.setAttribute('aria-pressed',String(selected===`F${i+1}`));
  const title=document.createElement('strong');title.textContent=`F${i+1} · ${variants[i][0]}`;
  const map=document.createElement('div');map.className='fog-scene';
  for(const cell of scene){
   const tile=document.createElement('span');tile.className=`fog-tile ${cell.state}${cell.wall?' rock':(cell.x+cell.y)%2?' dark':' light'}`;
   if(cell.wall){const shadows=[];for(const [dx,dy,shadow] of [[0,-1,'inset 0 3px #90958a'],[1,0,'inset -3px 0 #252a29'],[0,1,'inset 0 -3px #252a29'],[-1,0,'inset 3px 0 #747d73']]){const neighbor=scene.find(c=>c.x===cell.x+dx&&c.y===cell.y+dy);if(neighbor&&!neighbor.wall&&neighbor.state!=='unknown')shadows.push(shadow);}tile.style.boxShadow=shadows.join(',')||'none';}
   if(cell.player){const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL}pieces/neo/wk.png`;img.alt='Белый король';tile.append(img);}
   map.append(tile);
  }
  const canvas=document.createElement('canvas');canvas.width=fogBudget.width;canvas.height=fogBudget.height;canvas.setAttribute('aria-hidden','true');map.append(canvas);
  const detail=document.createElement('p');detail.textContent=variants[i][1];card.append(title,map,detail);
  card.addEventListener('click',()=>{selected=card.dataset.variant;for(const c of cards)c.card.setAttribute('aria-pressed',String(c.card===card));root.querySelector('.fog-selection').textContent=`Выбрано ${selected} · ${variants[i][0]}. В игре сейчас F2; этот выбор сохранён только для сравнения.`;try{localStorage.setItem('chess-dungeons-fog-choice',selected);}catch{/* Optional preference. */}});
  root.querySelector('.fog-grid').append(card);cards.push({card,canvas,context:canvas.getContext('2d'),visible:false});
 }
 const surface=document.createElement('canvas');surface.width=fogBudget.width;surface.height=fogBudget.height;
 const renderer=createFogRenderer(surface);
 if(!renderer){root.querySelector('.fog-budget').textContent='WebGL2 недоступен: показана статичная сцена без анимации.';for(const c of cards)c.canvas.style.background='linear-gradient(90deg,transparent 35%,#090d11ed 80%)';return;}
 renderer.setMask(9,6,new Uint8Array(scene.map(c=>c.state==='unknown'?255:c.state==='memory'?150:0)));
 const light=getComputedStyle(root.querySelector('.fog-tile.light:not(.unknown)')).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
 const dark=getComputedStyle(root.querySelector('.fog-tile.dark:not(.unknown)')).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
 renderer.setTint(light.map((value,i)=>(value+dark[i])/510));
 root.dataset.tint=light.map((value,i)=>Math.round((value+dark[i])/2)).join(',');
 let paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,elapsed=0,frame=0,needsDraw=true;
 const pause=root.querySelector('#fog-pause');const pauseLabel=()=>{pause.textContent=paused?'Продолжить':'Приостановить';pause.setAttribute('aria-pressed',String(paused));};pauseLabel();
 pause.addEventListener('click',()=>{paused=!paused;pauseLabel();needsDraw=true;});
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const c=cards.find(c=>c.card===e.target);c.visible=e.isIntersecting;}needsDraw=true;});cards.forEach(c=>observer.observe(c.card));
 surface.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;root.dataset.gpu='lost';pause.disabled=true;});
 root.dataset.gpu='ready';root.dataset.contexts='1';
 function tick(now){
  requestAnimationFrame(tick);
  if(document.hidden||root.hidden||!root.getClientRects().length){last=now;return;}
  if(!needsDraw&&(paused||now-last<1000/fogBudget.fps))return;
  const delta=Math.min((now-last)/1000,.1);last=now;if(!paused)elapsed+=delta;
  let draws=0;
  for(const [i,c] of cards.entries())if(c.visible){
   renderer.draw(elapsed,i);c.context.clearRect(0,0,surface.width,surface.height);c.context.drawImage(surface,0,0);draws++;
  }
  if(draws){frame++;root.dataset.frames=String(frame);root.dataset.draws=String(draws);root.dataset.time=elapsed.toFixed(2);needsDraw=false;}
 }
 requestAnimationFrame(tick);
}
