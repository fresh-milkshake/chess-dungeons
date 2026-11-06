import {setAudioScene} from '../audio/runtime.js';
import {setupDifficultyDebug,renderEloCaption} from './difficulty-ui.js';
import {deploymentLimit} from '../artifacts/mechanics.js';
import {artifactUses} from '../artifacts/charges.js';
import {aiProfile} from '../battle/ai-profile.js';
import {rank as squareRank,files} from '../battle/coordinates.js';
import '../game-input.js';
import '../style.css';
import './deployment.css';
import {loadRun,saveRun} from './storage.js';
import {encounterName,encounterReward} from './encounters.js';
import {initialDeployment,automaticDeployment,previousDeployment,deploymentPreset,deploymentSquares} from './deployment.js';
import {renderBoard,imageFor} from '../battle/board.js';
import {enableBoardDrag} from '../board-drag.js';

import {enterBattle} from './battle-transition.js';
import {trackRun} from '../timing/index.js';
import {createPieceSprite} from '../piece-effects.js';
import {stoneTrophyText} from './stone-rewards.js';
import {canReceive} from './balance.js';
import {artifactById} from '../artifacts/catalog.js';
import {createArtifactBar} from '../artifacts/bar.js';
import {showBossIntro} from './boss-intro.js';
import {reserveBaselines} from './reserve-baselines.js';
import {setupReserveMotion} from './reserve-motion.js';
import {setupReserveCarousel} from './reserve-carousel.js';
import {setupDebugMenu} from '../debug-menu.js';
import {setupRelicDebug} from '../debug/relics.js';
import {setupPreparationRecon} from './recon.js';
export function mountDeployment({root,scope,navigate,engine}){
const $=id=>root.querySelector('#'+id),names={k:'Король',q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь',p:'Пешка'},materials={ordinary:'обычная',stone:'камень',glass:'стекло',ethereal:'эфир',diamond:'алмаз'};
const typeOrder='pnbrqk',materialOrder=['ordinary','stone','glass','ethereal','diamond'];
let run,enemy,selected=null,busy=false,introducing=false,suppressClick=()=>false,playing=false,prepared=null,validationQueue=Promise.resolve();
const debug=setupDebugMenu({root,scope});
const recon=setupPreparationRecon({board:$('deployment-board'),scope});
const reserveMotion=setupReserveMotion({container:$('reserve'),scope}),reserveNodes=new Map();
const reserveCarousel=setupReserveCarousel({container:$('reserve'),board:$('deployment-board'),scope});
let reserveLayoutKey='';
const artifactBar=createArtifactBar({root,scope,onUse:id=>{const a=artifactById(id);if(a.kind==='toggle'){try{checkFresh();run.artifactToggles??={};run.artifactToggles[id]=run.artifactToggles[id]===false;saveRun(run);render();}catch(error){status(error.message,true);}}else status(a.description);}});

function warmPosition(preset){
 if(prepared?.fen===preset.fen)return;
 const candidate={fen:preset.fen,state:null,error:null};prepared=candidate;
 candidate.ready=validationQueue.then(async()=>{
  if(scope.disposed||prepared!==candidate)return;
  const black=await engine.request('load '+preset.fen.replace(' w ',' b '));if(black.check)throw Error('Нельзя начинать бой с шаха вражескому королю.');
  if(scope.disposed)return;
  const white=await engine.request('load '+preset.fen);if(white.check||!white.legal.length)throw Error('В этой позиции король под шахом или нет допустимых ходов.');
  candidate.state=white;
 }).catch(error=>{candidate.error=error;}).then(()=>{if(!scope.disposed&&prepared===candidate&&!playing&&!busy){$('begin-battle').disabled=introducing||!!candidate.error;status(candidate.error?.message??'',!!candidate.error);}});
 validationQueue=candidate.ready;
}
function status(message,error=false){$('placement-status').textContent=message;$('placement-status').classList.toggle('error',error);}
function checkFresh(){const latest=loadRun();if(latest?.id!==run.id||latest.stage!=='encounter'||latest.encounterId!==enemy.id||(latest.deployment?.revision??0)!==(run.deployment?.revision??0))throw Error('Расстановка изменена в другой вкладке. Перезагрузите страницу.');}
function commit(positions){
 checkFresh();deploymentPreset(run,enemy,positions,{validate:false});
 const previous=run.deployment;run.deployment={enemyId:enemy.id,positions,revision:(previous?.revision??0)+1};
 try{saveRun(run);}catch(error){run.deployment=previous;throw error;}
}
function pieceFor(id){const p=run.inventory.find(p=>p.id===id);return p&&{...p,color:'w',hp:p.material==='stone'?2:p.material==='diamond'?3:1,damage:run.buffs.some(b=>b.pieceId===id&&(b.permanent||b.remaining>0))?2:1};}
function positionsAt(square){
 const next={...run.deployment.positions},from=next[selected],occupant=Object.keys(next).find(id=>next[id]===square);
 if(square.startsWith('reserve'))delete next[selected];
 else{if(occupant&&occupant!==selected){if(from)next[occupant]=from;else delete next[occupant];}next[selected]=square;}
 return next;
}
function canDrop(square){if(!selected||busy||playing)return false;try{deploymentPreset(run,enemy,positionsAt(square),{validate:false});return true;}catch{return false;}}
function place(square){
 if(!selected||busy)return;
 try{
  commit(positionsAt(square));selected=null;render();
 }catch(error){status(error.message,true);}
}
function render(){
 if(run)artifactBar.render({owned:run.artifacts,toggles:run.artifactToggles,used:artifactUses(run),busy});
 if(!scope.active||playing||!run?.deployment)return;
 trackRun(run,'preparation',{encounterId:enemy.id,encounterName:encounterName(enemy)});
 const positions=run.deployment.positions,preset=deploymentPreset(run,enemy,positions,{validate:false});
 $('preparation').style.setProperty('--deployment-columns',preset.bounds.right-preset.bounds.left+1);
 $('preparation').style.setProperty('--deployment-rows',preset.bounds.top-preset.bounds.bottom+1);
 const allowed=new Set(deploymentSquares(preset.bounds));
 renderBoard($('deployment-board'),{state:{fen:preset.fen,legal:[],check:false},moves:[],ethereal:new Set(preset.ethereal)},positions[selected]??null,false);
 for(const cell of $('deployment-board').children){
  if(!cell.dataset.square)continue;
  const square=cell.dataset.square,permitted=allowed.has(square);
  cell.classList.add(permitted?'allowed-deployment':'outside-deployment');
  if(squareRank(square)===preset.bounds.bottom+2)cell.classList.add('zone-edge');
  cell.title=permitted?`${square} · область расстановки`:`${square} · за пределами области`;
  cell.disabled=busy;
 }
 recon.update({bounds:preset.bounds,owned:run.artifacts,fen:preset.fen});
 const reservePieces=run.inventory.filter(p=>!positions[p.id]).sort((a,b)=>typeOrder.indexOf(a.type)-typeOrder.indexOf(b.type)||materialOrder.indexOf(a.material)-materialOrder.indexOf(b.material));
 reserveMotion.update(reservePieces.map(p=>p.id),()=>{
 const nodes=reservePieces.map((p,index)=>{
  let button=reserveNodes.get(p.id);if(!button){button=document.createElement('button');reserveNodes.set(p.id,button);}
  button.className=`reserve-piece${selected===p.id?' selected':''}`;button.dataset.pieceId=p.id;button.dataset.square=`reserve:${p.id}`;button.title=`${names[p.type]} · ${materials[p.material]}`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(selected===p.id));button.disabled=busy;
  const baseline=reserveBaselines[p.material]?.[p.type]??reserveBaselines.ordinary[p.type];
  button.style.setProperty('--reserve-baseline-offset',`${(reserveBaselines.ordinary.p-baseline)*100}%`);
  if(index){const previous=reservePieces[index-1];button.classList.add(previous.type!==p.type?'reserve-type-start':previous.material!==p.material?'reserve-material-start':'reserve-continuation');}
  const piece=pieceFor(p.id),visualKey=JSON.stringify(piece);
  if(!button.isConnected||button.dataset.visualKey!==visualKey){const visual=document.createElement('span');visual.className='reserve-visual';visual.append(createPieceSprite(piece,imageFor(piece)));button.replaceChildren(visual);button.dataset.visualKey=visualKey;}
  return button;
 });
 const reserve=$('reserve');
 for(const node of [...reserve.children])if(!nodes.includes(node))node.remove();
 nodes.forEach((node,index)=>{if(reserve.children[index]!==node)reserve.insertBefore(node,reserve.children[index]??null);});
 if(!nodes.length){const empty=document.createElement('span');empty.className='reserve-empty';empty.textContent='Все фигуры на поле';empty.dataset.square='reserve';reserve.append(empty);}
 const layoutKey=JSON.stringify(reservePieces.map(p=>p.id));
 if(layoutKey!==reserveLayoutKey){reserveCarousel.layout();reserveLayoutKey=layoutKey;}
 },{exit:!suppressClick()&&!$('reserve').classList.contains('reserve-overflow')});
 const slots=$('deployment-slots'),limit=deploymentLimit(run),free=Math.max(0,limit-Object.keys(positions).length);
 if(slots.childElementCount!==free){slots.replaceChildren(...Array.from({length:free},()=>{const square=document.createElement('span');square.setAttribute('aria-hidden','true');return square;}));}
 slots.setAttribute('aria-label',`Свободных мест: ${free} из ${limit}`);slots.title=`Свободных мест: ${free} из ${limit}`;
 $('return-piece').disabled=busy||!positions[selected];$('clear-formation').disabled=busy;$('auto-formation').disabled=busy;
 $('leave-preparation').textContent=enemy.boss?'Вернуться к подготовке позже':'Отступить';
 let problem='';try{const valid=deploymentPreset(run,enemy,positions);warmPosition(valid);}catch(error){problem=error.message;prepared=null;}
 $('begin-battle').disabled=busy||!!problem||!!prepared?.error;
 status(problem||prepared?.error?.message||'',!!problem||!!prepared?.error);
}
try{
 run=loadRun();const id=new URLSearchParams(location.search).get('run');
 if(!run||run.id!==id)throw Error('Забег не найден.');
 if(run.stage==='battle'){navigate(`./battle.html?run=${encodeURIComponent(run.id)}`,{replace:true});}
 else {
  if(run.stage!=='encounter')throw Error('Нет активной встречи. Вернитесь на карту.');
  enemy=run.enemies.find(e=>e.id===run.encounterId);setAudioScene({biome:run.biome,emperor:!!enemy?.boss&&run.act===4,stage:'deployment'});if(!enemy)throw Error('Противник не найден.');
  if(run.deployment?.enemyId!==enemy.id){run.deployment={...initialDeployment(run,enemy),revision:0};saveRun(run);}
  $('encounter-name').textContent=encounterName(enemy);
  setupDifficultyDebug({root,scope,getDifficulty:()=>run.difficulty,onChange:value=>{run.difficulty=value;saveRun(run);renderEloCaption($('encounter-name').parentElement,aiProfile(run.act,run.floor,enemy,run.difficulty));}});
  renderEloCaption($('encounter-name').parentElement,aiProfile(run.act,run.floor,enemy,run.difficulty));
  $('encounter-summary').textContent=enemy.wild?`Один противник · ${enemy.hp??2} HP · без короля`:run.act===4?'Дворец императора':enemy.rewardless?'Повторный преследователь · без награды':`За победу: ◆ ${encounterReward(enemy,run.act)} + взятия`;
  if(run.encounterWild)$('encounter-summary').textContent+=' · вторжение дикой фигуры сбоку';
  $('encounter-summary').textContent+=enemy.kingless?' · Цель: уничтожить отряд':' · Цель: мат королю';
  if(enemy.artifactId){const a=artifactById(enemy.artifactId);$('encounter-summary').textContent+=` · Артефакт: ${a.name}. ${a.description}`;}
  const trophy=stoneTrophyText(run,enemy,canReceive);if(trophy)$('encounter-summary').textContent+=` · Трофей: ${trophy}`;
  $('auto-glass').checked=!!run.deploymentOptions?.glass;$('auto-ethereal').checked=!!run.deploymentOptions?.ethereal;
  $('previous-formation').disabled=!run.previousDeployment;
  render();
  suppressClick=enableBoardDrag({scope,board:$('preparation'),
   canDrag:token=>{if(busy||playing)return null;const id=token.startsWith('reserve:')?token.slice(8):Object.keys(run.deployment.positions).find(id=>run.deployment.positions[id]===token);return pieceFor(id);},
   select:token=>{selected=token.startsWith('reserve:')?token.slice(8):Object.keys(run.deployment.positions).find(id=>run.deployment.positions[id]===token);render();},
   drop:place,canDrop,imageFor,
   onOutside:from=>{if(!from.startsWith('reserve'))place('reserve');else{selected=null;render();}},
   onCancel:()=>{selected=null;render();},
  });
  const introKey=`${run.act}:${run.floor}:${enemy.id}`;
  if(enemy.boss&&!run.bossAnnouncements?.includes(introKey)){
   introducing=true;$('begin-battle').disabled=true;
   showBossIntro({root,scope,title:enemy.boss&&run.act===4?'Император':encounterName(enemy),act:run.act,onDone:completed=>{
    introducing=false;
    if(completed){try{const latest=loadRun();if(latest?.id===run.id&&latest.stage==='encounter'&&latest.encounterId===enemy.id){latest.bossAnnouncements=[...new Set([...(latest.bossAnnouncements??[]),introKey])];saveRun(latest);run.bossAnnouncements=latest.bossAnnouncements;}}catch(error){status(error.message,true);}}
    if(scope.active)render();
   }});
  }
 }
}catch(error){status(error.message,true);$('begin-battle').disabled=true;$('clear-formation').disabled=true;}
$('preparation').addEventListener('click',event=>{
 if(busy||!enemy||suppressClick())return;
 const reserve=event.target.closest('[data-piece-id]');
 if(reserve){selected=selected===reserve.dataset.pieceId?null:reserve.dataset.pieceId;render();return;}
 const square=event.target.closest('#deployment-board [data-square]')?.dataset.square;if(!square)return;
 const occupant=Object.keys(run.deployment.positions).find(id=>run.deployment.positions[id]===square);
 if(selected===occupant){selected=null;render();}else if(selected)place(square);else if(occupant){selected=occupant;render();}
});
$('return-piece').addEventListener('click',()=>place('reserve'));
$('clear-formation').addEventListener('click',()=>{try{commit(initialDeployment(run,enemy).positions);selected=null;render();}catch(error){status(error.message,true);}});
$('auto-formation').addEventListener('click',()=>{if(busy||playing||!enemy)return;try{commit(automaticDeployment(run,enemy,run.deploymentOptions));selected=null;render();}catch(error){status(error.message,true);}});
$('previous-formation').addEventListener('click',()=>{if(busy||playing||!enemy)return;try{commit(previousDeployment(run,enemy));selected=null;render();}catch(error){status(error.message,true);}});
for(const material of ['glass','ethereal'])$('auto-'+material).addEventListener('change',()=>{try{checkFresh();run.deploymentOptions={glass:$('auto-glass').checked,ethereal:$('auto-ethereal').checked};commit({...run.deployment.positions});$('auto-'+material).blur();}catch(error){status(error.message,true);}});
$('leave-preparation').addEventListener('click',()=>{try{checkFresh();if(!enemy.boss){run.retreat();saveRun(run);}navigate('./dungeon.html?stay=1');}catch(error){status(error.message,true);}});
$('begin-battle').addEventListener('click',async()=>{
 if(busy||introducing||playing||!enemy)return;
 try{deploymentPreset(run,enemy,run.deployment.positions);}catch(error){status(error.message,true);return;}
 busy=true;render();
 try{
  checkFresh();const preset=deploymentPreset(run,enemy,run.deployment.positions);
  const candidate=prepared;await candidate.ready;if(candidate.error)throw candidate.error;
  if(prepared!==candidate||!candidate.state||candidate.fen!==preset.fen)throw Error('Расстановка изменилась. Повторите начало боя.');
  if(scope.disposed)return;checkFresh();const previous=run.snapshot();
  try{run.beginBattle([],run.deployment.positions);saveRun(run);}catch(error){Object.assign(run,previous);throw error;}
  playing=true;await enterBattle({board:$('deployment-board'),engine,state:candidate.state,runId:run.id,navigate});
 }catch(error){
  if(playing){const notice=document.getElementById('battle-notice');if(notice){notice.textContent=error.message;notice.hidden=false;}return;}
  busy=false;render();status(error.message,true);
 }
});
scope.on(document,'keydown',event=>{
 if(playing||debug.isOpen||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 if(event.code==='KeyR'||event.code==='KeyE'||event.code==='Space'){
  event.preventDefault();if(event.repeat||busy||!enemy)return;
  $(event.code==='KeyR'?'auto-formation':event.code==='KeyE'?'previous-formation':'begin-battle').click();return;
 }
 if(!enemy||busy)return;
 if(event.key==='Escape'){event.preventDefault();if(!event.repeat&&!introducing)$('leave-preparation').click();return;}
 if(event.key==='Delete'&&selected){event.preventDefault();place('reserve');}
});
scope.on(root,'pointerdown',event=>{const options=root.querySelector('.deployment-options');if(options.open&&!options.contains(event.target))options.open=false;});
let scrollFrame=0,scrollTarget=0,lastScrollTime=0;
const reserve=$('reserve'),reducedScroll=matchMedia('(prefers-reduced-motion: reduce)');
function stopReserveScroll(){cancelAnimationFrame(scrollFrame);scrollFrame=0;scrollTarget=reserve.scrollLeft;}
function animateReserveScroll(now){
 scrollFrame=0;if(!scope.active)return;
 scrollTarget=Math.max(0,Math.min(scrollTarget,reserve.scrollWidth-reserve.clientWidth));
 const distance=scrollTarget-reserve.scrollLeft,dt=Math.min(40,now-lastScrollTime);lastScrollTime=now;
 if(Math.abs(distance)<.5||reducedScroll.matches){reserve.scrollLeft=scrollTarget;return;}
 const step=distance*(1-Math.exp(-dt/65));
 // scrollLeft can be rounded to whole pixels: keep the easing from stalling.
 reserve.scrollLeft+=Math.sign(distance)*Math.min(Math.abs(distance),Math.max(1,Math.abs(step)));
 scrollFrame=requestAnimationFrame(animateReserveScroll);
}
scope.onPause(stopReserveScroll);scope.cleanup(stopReserveScroll);
scope.on(reserve,'pointerdown',stopReserveScroll,{capture:true});
scope.on($('reserve'),'wheel',event=>{
 if(busy||playing||introducing||event.ctrlKey)return;
 if(reserve.scrollWidth<=reserve.clientWidth+1)return;
 const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
 if(!delta)return;
 event.preventDefault();event.stopPropagation();
 const unit=event.deltaMode===1?32:event.deltaMode===2?reserve.clientWidth:1;
 if(!scrollFrame)scrollTarget=reserve.scrollLeft;
 scrollTarget=Math.max(0,Math.min(scrollTarget+delta*unit,reserve.scrollWidth-reserve.clientWidth));
 if(reducedScroll.matches){reserve.scrollLeft=scrollTarget;return;}
 if(!scrollFrame){lastScrollTime=performance.now();scrollFrame=requestAnimationFrame(animateReserveScroll);}
},{passive:false});



setupRelicDebug({root,scope,getState:()=>run?{owned:run.artifacts}:null,isBusy:()=>busy||playing||introducing,onChange:owned=>{checkFresh();run.artifacts=owned;saveRun(run);prepared=null;render();}});
 return {};
}
