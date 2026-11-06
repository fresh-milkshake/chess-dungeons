import {Chess} from 'chess.js';
import {pieceImage} from '../../piece-sets.js';
import {createMoveAnimation} from '../../move-effects.js';
import {createExperimentRenderer} from './renderer.js';
import {setupMaterialStudies} from './studies.js';
import './style.css';

const themes=[
 {name:'Космическая',title:'Перед вечностью',tag:'01 / ASTRAL',description:'Чёрный обсидиан и холодный звёздный камень. За краем поля — почти чёрная бездна, слои космической пыли и далёкий свет.',effect:'Короткий холодный отблеск растворяется в полировке камня.',color:'#a6afb7'},
 {name:'Водная',title:'Затишье без берега',tag:'02 / ABYSSAL',description:'Тёмная морская керамика и перламутр. Медленные течения уходят в глубину, где вода почти теряет свет.',effect:'На месте хода едва меняется влажный блеск поверхности.',color:'#81b8b0'},
 {name:'Призрачная',title:'Никого. Пока.',tag:'03 / SPECTRAL',description:'Пепельный камень проступает из холодного тумана. Мираж едва колеблет границы клеток, лёгкая дымка медленно проходит через всё поле.',effect:'После хода дымка чуть расступается, а камень ненадолго становится отчётливее.',color:'#a4bfb0'},
 {name:'Тёмный гранит · лава',title:'Жар под пеплом',tag:'04 / INFERNAL',description:'Тёмный гранит среди остывающей корки. Под ней медленно движется лава; за дальним краем поля жар ещё не угас.',effect:'Камень ненадолго теплеет в месте приземления фигуры.',color:'#c78f72'},
 {name:'Императорский дворец',title:'В ожидании аудиенции',tag:'05 / IMPERIAL',description:'Густой малахит и приглушённое золото. За краем поля сгущаются облака, скрывающие свет над ещё пустующим троном.',effect:'В золоте остаётся слабый отблеск, быстро возвращающийся к покою.',color:'#d4bd87'},
];

export function setupExperiments(root){
 root.className='experiment-lab';
 root.innerHTML=`<header class="experiment-heading"><div><p class="experiment-eyebrow">ЛАБОРАТОРИЯ / ИССЛЕДОВАНИЯ СРЕДЫ</p><h1>Другие миры.</h1><p>Пять досок. Пять миров. Один шахматный бой.</p></div><span class="experiment-edition">EXPERIMENTS<br><b>001 — 005</b></span></header>
 <div class="experiment-layout"><section class="experiment-scene" aria-label="Экспериментальная шахматная сцена"><canvas class="experiment-canvas" aria-hidden="true"></canvas><div class="experiment-scene-label"><span class="experiment-world-tag"></span><span>NEO · 8 × 8</span></div><div class="experiment-board board" role="group" aria-label="Шахматная доска экспериментов"></div><div class="experiment-scene-footer"><span class="experiment-turn" role="status"></span><span class="experiment-move">Начальная позиция</span></div><p class="experiment-error" role="alert" hidden></p></section>
 <aside class="experiment-sidebar"><p class="experiment-eyebrow">ВЫБЕРИТЕ МИР</p><div class="experiment-worlds">${themes.map((t,i)=>`<button type="button" data-world="${i}" aria-pressed="${i===0}" style="--world-color:${t.color}"><span>0${i+1}</span><strong>${t.name}</strong><span aria-hidden="true">↗</span></button>`).join('')}</div><div class="experiment-copy"><h2></h2><p class="experiment-description"></p><p class="experiment-effect"></p></div>
 <div class="experiment-actions"><button type="button" class="secondary-button" data-action="demo">▶ Демонстрация</button><button type="button" class="secondary-button" data-action="pause" aria-pressed="false">Ⅱ Пауза среды</button><button type="button" class="secondary-button" data-action="undo">↶ Отменить ход</button><button type="button" class="secondary-button" data-action="reset">↻ Новая партия</button></div><p class="experiment-help">Играйте за обе стороны: выберите фигуру и клетку назначения. Превращение пешки — в ферзя.</p><p class="experiment-note">Доска, окружение и следы ходов — процедурные шейдеры. Фигуры — игровые Neo.</p></aside></div>`;
 const $=selector=>root.querySelector(selector),board=$('.experiment-board'),game=new Chess(),animation=createMoveAnimation(board);
 let selected=null,renderer,demoTimer=0,demonstrating=false,theme=0;
 const names={p:'пешка',r:'ладья',n:'конь',b:'слон',q:'ферзь',k:'король'};
 function statusError(text){$('.experiment-error').hidden=!text;$('.experiment-error').textContent=text;root.classList.toggle('experiment-no-gpu',!!text);}
 try{renderer=createExperimentRenderer($('.experiment-canvas'),board,root,statusError);}catch(error){statusError(error.message);}
 function render(){
  const targets=selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[];
  board.replaceChildren();
  for(const rank of '87654321')for(const file of 'abcdefgh'){
   const square=file+rank,piece=game.get(square),cell=document.createElement('button');cell.type='button';cell.dataset.square=square;
   cell.className='square'+(selected===square?' selected':'');
   cell.setAttribute('aria-label',`${square}${piece?`, ${piece.color==='w'?'белые':'чёрные'}: ${names[piece.type]}`:''}${targets.includes(square)?', допустимый ход':''}`);
   if(piece){const image=document.createElement('img');image.src=pieceImage(piece,'neo',import.meta.env.BASE_URL);image.alt='';image.draggable=false;cell.append(image);}
   if(targets.includes(square)){const hint=document.createElement('span');hint.className=piece?'capture-hint':'move-hint';cell.append(hint);}
   if(file==='a'){const label=document.createElement('span');label.className='coordinate rank';label.textContent=rank;cell.append(label);}
   if(rank==='1'){const label=document.createElement('span');label.className='coordinate file';label.textContent=file;cell.append(label);}
   board.append(cell);
  }
  const last=game.history().at(-1);
  $('.experiment-turn').textContent=game.isCheckmate()?'Мат · партия завершена':game.isDraw()?'Ничья':`${game.isCheck()?'Шах · ':''}Ход ${game.turn()==='w'?'белых':'чёрных'}`;
  $('.experiment-move').textContent=last?`${game.history().length}. ${last}`:'Начальная позиция';
  $('[data-action="undo"]').disabled=!last;
  renderer?.select(selected);
 }
 function play(from,to){
  const before=animation.snapshot();let move;
  try{move=game.move({from,to,promotion:'q'});}catch{return false;}
  selected=null;animation.cancel();render();animation.play(move,before);renderer?.move(move);return true;
 }
 function stopDemo(){clearTimeout(demoTimer);demonstrating=false;$('[data-action="demo"]').textContent='▶ Демонстрация';$('[data-action="demo"]').setAttribute('aria-pressed','false');}
 function demoStep(){
  if(!demonstrating||root.hidden||document.hidden){stopDemo();return;}
  const legal=game.moves({verbose:true});if(game.isGameOver()||!legal.length){stopDemo();return;}
  // Prefer central development so the preview quickly shows trails across the board.
  const opening=['e4','e5','Nf3','Nc6','Bc4','Bc5','O-O','Nf6'];
  const move=legal.find(m=>m.san===opening[game.history().length])??legal[Math.floor(Math.random()*legal.length)];
  play(move.from,move.to);demoTimer=setTimeout(demoStep,1450);
 }
 board.addEventListener('click',event=>{
  const square=event.target.closest('[data-square]')?.dataset.square;if(!square||game.isGameOver())return;
  stopDemo();if(selected&&play(selected,square))return;
  selected=selected===square?null:game.get(square)?.color===game.turn()?square:null;render();
 });
 for(const button of root.querySelectorAll('[data-world]'))button.addEventListener('click',()=>{
  theme=Number(button.dataset.world);const t=themes[theme];root.style.setProperty('--experiment-accent',t.color);root.dataset.world=String(theme);
  root.querySelectorAll('[data-world]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('.experiment-world-tag').textContent=t.tag;$('.experiment-copy h2').textContent=t.title;$('.experiment-description').textContent=t.description;$('.experiment-effect').textContent=t.effect;renderer?.theme(theme);
 });
 $('[data-action="demo"]').addEventListener('click',()=>{if(demonstrating){stopDemo();return;}if(game.isGameOver()){game.reset();render();}demonstrating=true;$('[data-action="demo"]').textContent='■ Остановить';$('[data-action="demo"]').setAttribute('aria-pressed','true');demoStep();});
 const pause=$('[data-action="pause"]');
 function syncPause(){pause.setAttribute('aria-pressed',String(renderer?.paused??false));pause.textContent=renderer?.paused?'▶ Оживить среду':'Ⅱ Пауза среды';}
 pause.disabled=!renderer;pause.addEventListener('click',()=>{renderer.pause(!renderer.paused);syncPause();});syncPause();
 $('[data-action="undo"]').addEventListener('click',()=>{stopDemo();animation.cancel();game.undo();selected=null;renderer?.clear();render();});
 $('[data-action="reset"]').addEventListener('click',()=>{stopDemo();animation.cancel();game.reset();selected=null;renderer?.clear();render();});
 new MutationObserver(()=>{if(root.hidden){stopDemo();animation.cancel();}}).observe(root,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDemo();});
 window.addEventListener('pagehide',event=>{stopDemo();if(!event.persisted)renderer?.dispose();});
 const requested=Number(new URLSearchParams(location.search).get('experiment'));
 const initial=Number.isInteger(requested)&&requested>=0&&requested<themes.length?requested:0;
 $(`[data-world="${initial}"]`).click();render();
 setupMaterialStudies(root,{onApply(sample){
  $(`[data-world="${sample.world}"]`).click();renderer?.variant(sample.variation);renderer?.recipe(sample);
  $('.experiment-copy h2').textContent=sample.name;
  $('.experiment-description').textContent=sample.description;
  $('.experiment-world-tag').textContent=`${themes[sample.world].tag} · ${sample.id}`;
  root.dataset.materialVariant=String(sample.variation);
  $('.experiment-scene').scrollIntoView({block:'center'});
 }});
}
