import {setAudioScene} from '../audio/runtime.js';
import {resetArtifactCharges} from '../artifacts/charges.js';
import {setupDifficultyDebug,readDifficultyDebug,renderEloCaption} from '../dungeon/difficulty-ui.js';
import {aiProfile} from './ai-profile.js';
import {normalizeDifficulty} from './difficulty.js';
import {setupBattleView} from './view.js';
import {setupBossRewards} from './boss-reward.js';
import {moveParts} from './coordinates.js';
import {createScope} from '../app/scope.js';
import '../game-input.js';
import '../style.css';
import '../lab/style.css';
import './style.css';
import { DungeonEngine } from '../lab/client.js';
import { parsePosition } from '../lab/scenarios.js';
import { Battle, battles } from './game.js';
import { renderBoard, findMoves, imageFor } from './board.js';
import { enableBoardDrag } from '../board-drag.js';
import { createMoveAnimation, createMoveSound } from '../move-effects.js';
import { campaignBattle } from '../dungeon/battle-link.js';
import {setupDebugMenu} from '../debug-menu.js';
import {encounterReward} from '../dungeon/encounters.js';
import {setupPieceEditor} from '../debug/editor.js';
import {editBattle} from './debug.js';
import {trackStage,runTimingContext} from '../timing/index.js';
import {saveRun} from '../dungeon/storage.js';
import {stoneTrophyText} from '../dungeon/stone-rewards.js';
import {canReceive} from '../dungeon/balance.js';
import {setupBattleArtifacts} from '../artifacts/battle-ui.js';
import {artifactById} from '../artifacts/catalog.js';
import {setupRelicDebug} from '../debug/relics.js';
import {configureBattleRelics} from '../debug/battle-relics.js';

export async function mountBattle({engine:existingEngine=null,preparedState=null,preparedRect=null,root=document,scope=createScope(),navigate}={}){
const $ = id=>root.querySelector('#'+id);
const storageKey='chess-dungeons-battle-v1';
function setSearchDepth(value){const n=Math.max(1,Math.min(12,Number(value)||5));if(![...$('depth').options].some(o=>o.value===String(n)))$('depth').add(new Option(String(n),String(n)));$('depth').value=String(n);}
function restoreAiSettings(settings){if(!settings)return;if([...$('ai-budget').options].some(o=>o.value===settings.budget))$('ai-budget').value=settings.budget;if(settings.depth)setSearchDepth(settings.depth);}
setupDebugMenu({root,scope});
const engine=existingEngine??new DungeonEngine(), battle=new Battle(engine);
const animation=createMoveAnimation($('board'));
const sound=createMoveSound(()=>$('sound').checked);
let selected=null, busy=true, flipped=false;
let pendingAction=Promise.resolve();
let campaign=null;let standaloneDifficulty=normalizeDifficulty({preset:'high',overrideElo:readDifficultyDebug().manual?readDifficultyDebug().elo:null});let difficultyDebug;
function opponentProfile(){return campaign?aiProfile(campaign.run.act,campaign.run.floor,{},campaign.run.difficulty):aiProfile(2,2,{},standaloneDifficulty);}
let timingContext=null;
let artifactUI;
let relicDebug;
const editor=setupPieceEditor({scope,container:root,
 isBusy:()=>busy||!battle.state,
 resolveTarget:element=>element?.closest('#board [data-square]')??null,
 onApply:async(tool,target)=>{
  let error;
  await guarded(async()=>{try{await editBattle(battle,tool,target.dataset.square,campaign);$('event').textContent='Позиция изменена. История ходов начинается заново.';}catch(problem){error=problem;throw problem;}});
  if(error)throw error;
 },
});
function showError(error){$('event').textContent=error.message;$('battle-notice').textContent=error.message;$('battle-notice').hidden=false;}
for(const preset of battles)$('battle-preset').add(new Option(preset.name,preset.id));
const rerollBossReward=()=>guarded(async()=>{campaign.rerollBossReward(battle);});
const bossRewards=setupBossRewards({root,onReroll:rerollBossReward,onChoose:index=>guarded(async()=>{campaign.claimBossReward(battle,index);navigate('./dungeon.html');})});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function save(){if(campaign?.closed)return;try{if(campaign){campaign.run.active.aiSettings={budget:$('ai-budget').value,depth:$('depth').value};campaign.save(battle);}else localStorage.setItem(storageKey,JSON.stringify({...battle.snapshot(),depth:$('depth').value,difficulty:standaloneDifficulty,aiBudget:$('ai-budget').value,sound:$('sound').checked,flipped}));}catch(error){$('event').textContent=`Не удалось сохранить: ${error.message}`;}}
function humanTurn(){return battle.state && !busy && !editor.editing && !battle.result && parsePosition(battle.state.fen).turn==='w';}
function render(){
 if(!scope.active)return;
  if(!battle.state)return;
  setAudioScene({biome:campaign?.run.biome??'ruins',emperor:!!campaign?.run.enemies.find(e=>e.id===campaign.preset.enemyId)?.emperor,stage:battle.result?'results':'battle'});
  renderBoard($('board'),battle,selected,flipped);
  difficultyDebug?.refresh();if(difficultyDebug)renderEloCaption($('description').parentElement,opponentProfile());
  artifactUI?.render();
  relicDebug?.render();
  const result=battle.result, {turn}=parsePosition(battle.state.fen);
  if(timingContext)trackStage({...timingContext,phase:result?(result.result==='win'&&campaign?.run.enemies.find(e=>e.id===campaign.preset.enemyId)?.boss?'boss-reward':'results'):turn==='w'?'battle-player':'battle-bot'});
  $('turn').textContent=result?result.title:busy?(turn==='x'?'Дикая фигура выбирает жертву…':'Противник рассчитывает ход…'):`${battle.state.check?'Шах · ':''}${turn==='w'?'Ваш ход · белые':turn==='x'?'Ход дикой фигуры':'Ход противника'}`;
  $('result').hidden=!result||editor.editing;
  if(result){
   $('result-title').textContent=result.title;$('result-detail').textContent=result.detail;$('result').dataset.result=result.result;
   const enemy=campaign?.run.enemies.find(e=>e.id===campaign.preset.enemyId);
   const amount=result.result==='win'&&enemy?encounterReward(enemy,campaign.run.act,battle.moves):0;
   $('result-reward').textContent=`◆ +${amount} материала`;
   $('result-reward').hidden=false;
   const trophy=result.result==='win'&&enemy?stoneTrophyText(campaign.run,enemy,canReceive):'';
   $('result-trophy').textContent=trophy;$('result-trophy').hidden=!trophy;
   if(result.result==='win'&&enemy?.artifactId){$('result-trophy').textContent=`Артефакт: ${artifactById(enemy.artifactId).name}`;$('result-trophy').hidden=false;}
   $('again').textContent=enemy?.boss&&result.result==='win'?'Награда за босса':enemy?.guard&&result.result==='win'?'На следующий этаж':'Выйти из боя';
  }
  bossRewards.render({run:campaign?.run,enemy:campaign?.run.enemies.find(e=>e.id===campaign.preset.enemyId),result:editor.editing?null:result,busy});
  $('description').textContent=battle.preset.description;
  $('battle-preset').value=battle.preset.id;
  for(const id of ['new','battle-preset','depth','ai-budget','again','flip','redeploy'])$(id).disabled=busy;
  if(campaign){$('new').hidden=true;$('battle-preset').disabled=true;}
  $('undo').disabled=busy || !battle.history.length;
  $('resign').disabled=busy || !!result;
}
function guarded(action){if(!scope.active||busy)return pendingAction;const job=performAction(action);pendingAction=job;return job;}
async function performAction(action){
 if(!scope.active)return;
  if(busy)return;
  $('battle-notice').hidden=true;
  busy=true;selected=null;render();
  try{await action();if(scope.active)save();}
  catch(error){showError(error);}
  finally{busy=false;render();}
}
async function animateHit(move,before){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const origin=before.get(move.from),target=before.get(move.to);
  const attacker=$('board').querySelector(`[data-square="${move.from}"] :is(img,canvas.piece-shader)`);
  const victim=$('board').querySelector(`[data-square="${move.to}"] :is(img,canvas.piece-shader)`);
  if(origin && target)attacker?.animate([{transform:'translate(0,0)'},{transform:`translate(${(target.x-origin.x)*.28}px,${(target.y-origin.y)*.28}px)`,offset:.45},{transform:'translate(0,0)'}],{duration:240,easing:'ease-in-out'});
  victim?.animate([{filter:'brightness(1)'},{filter:'brightness(2)',transform:'translateX(4px)'},{filter:'brightness(1)',transform:'translateX(0)'}],{duration:240});
}
async function execute(uci,dragged=false){
  const before=animation.snapshot(), old=parsePosition(battle.state.fen).pieces;
  const move=await battle.move(uci);if(!scope.active)return;render();
  if(move.hit)await animateHit(move,before);
  else if(!dragged)animation.play(move,before);
  sound.play();
  const now=parsePosition(battle.state.fen).pieces;
  $('event').textContent=move.hit?`${move.label} · удар: прочность ${old.get(move.target)?.hp} → ${now.get(move.target)?.hp}. Фигуры остаются на месте.`:move.label;
  save();
  if(move.hit || !dragged)await pause(matchMedia('(prefers-reduced-motion: reduce)').matches?0:move.hit?240:205);
}
async function bot(){
  if(!scope.active||editor.editing || battle.result)return;
  if(parsePosition(battle.state.fen).turn==='w'){if(battle.state.legal.length===1&&battle.state.legal[0]==='0000')await execute('0000');else{artifactUI?.playerTurn();return;}}
  do{
  $('turn').textContent='Противник рассчитывает ход…';
  const start=performance.now();
  const ai=opponentProfile();const strength=ai.elo;
  const budget=Number($('ai-budget').value)||ai.milliseconds;
  const reply=await engine.request(`search ${$('depth').value} ${budget} 1 ${strength}`);
  if(!scope.active||editor.editing)return;
  if(!battle.state.legal.includes(reply.bestmove))throw new Error('Движок не вернул допустимый ход. Можно отменить ход или начать бой заново.');
  $('search').textContent=`Глубина ${reply.depth} · ${reply.nodes.toLocaleString('ru')} узлов · ${Math.round(performance.now()-start)} мс · ${reply.searchBackend??'native'} · ≈ ${strength} Elo`;
  await execute(reply.bestmove);
  }while(scope.active&&!battle.result&&parsePosition(battle.state.fen).turn!=='w'&&!editor.editing);
  if(!battle.result&&battle.state.legal.length===1&&battle.state.legal[0]==='0000'&&parsePosition(battle.state.fen).turn==='w'){await execute('0000');await bot();}
  artifactUI?.playerTurn();
}
async function promotion(moves){
  if(moves.length===1)return moves[0];
  const names={q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'};
  $('promotion-options').replaceChildren(...moves.map(uci=>{const button=document.createElement('button');button.value=uci;button.setAttribute('aria-label',names[moveParts(uci).promotion]);const img=document.createElement('img');img.src=imageFor({color:'w',type:moveParts(uci).promotion});img.alt=names[moveParts(uci).promotion];button.append(img);return button;}));
  const dialog=$('promotion');dialog.returnValue='cancel';dialog.showModal();
  await new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));
  return moves.includes(dialog.returnValue)?dialog.returnValue:null;
}
function playTo(square,dragged=false){
  if(!humanTurn() || !selected)return;
  const moves=findMoves(battle.state,selected,square);
  if(!moves.length)return;
  guarded(async()=>{const uci=await promotion(moves);if(uci){await execute(uci,dragged);await bot();}});
}
const suppressClick=enableBoardDrag({scope,
  board:$('board'),
  canDrag:square=>{if(busy||artifactUI?.targeting||!battle.state||!editor.editing&&!humanTurn())return null;const piece=parsePosition(battle.state.fen).pieces.get(square);return piece&&(editor.editing||piece.color==='w')?{...piece,material:battle.ethereal.has(square)?'ethereal':undefined}:null;},
  select:square=>{selected=square;if(!editor.editing)render();},
  canDrop:square=>editor.editing?!!square:!!selected&&findMoves(battle.state,selected,square).length>0,
  drop:square=>{if(editor.editing){const from=selected;guarded(()=>editBattle(battle,{kind:'move',from},square,campaign));}else playTo(square,true);},
  onOutside:from=>{if(editor.editing)guarded(()=>editBattle(battle,{kind:'remove',from},null,campaign));else{selected=null;render();}},imageFor,
  onCancel:()=>{selected=null;render();},
});
$('board').addEventListener('pointerdown',sound.unlock,{capture:true});
$('board').addEventListener('click',event=>{
  if(suppressClick())return;
  if(editor.consumeClick(event.target))return;
  const artifactSquare=event.target.closest('[data-square]')?.dataset.square;if(artifactSquare&&artifactUI?.consume(artifactSquare))return;
  if(!humanTurn())return;
  const square=event.target.closest('[data-square]')?.dataset.square;
  if(!square)return;
  if(selected && findMoves(battle.state,selected,square).length){playTo(square);return;}
  selected=selected===square?null:parsePosition(battle.state.fen).pieces.get(square)?.color==='w'?square:null;render();
});
async function start(presetId=$('battle-preset').value){
  await battle.start(battles.find(p=>p.id===presetId));
  $('event').textContent='Выберите фигуру или перетащите её на допустимую клетку.';
  $('search').textContent='';
}
$('new').addEventListener('click',()=>guarded(start));
$('redeploy').addEventListener('click',()=>guarded(async()=>{
 if(campaign){campaign.verify();campaign.run.prepareAgain();saveRun(campaign.run);campaign.closed=true;navigate(`./deployment.html?run=${encodeURIComponent(campaign.run.id)}`);}
 else{await battle.start(openingPreset);editor.setEditing(true);$('event').textContent='Расставьте фигуры свободно. Снимите галочку редактора, чтобы продолжить бой.';}
}));
$('again').addEventListener('click',()=>guarded(async()=>{if(campaign)campaign.finish(battle);navigate('./dungeon.html');}));
$('battle-preset').addEventListener('change',()=>{const id=$('battle-preset').value;guarded(()=>start(id));});
$('undo').addEventListener('click',()=>guarded(async()=>{
 await battle.undoTurn(async move=>{const before=animation.snapshot();render();await animation.undo(move,before);});
 $('event').textContent='Ваш ход и ответ противника отменены.';$('search').textContent='';
}));
$('resign').addEventListener('click',()=>guarded(async()=>{battle.resigned=true;$('event').textContent='Бой завершён.';}));
$('flip').addEventListener('click',()=>{if(busy)return;flipped=!flipped;selected=null;render();save();});
$('sound').addEventListener('change',()=>{sound.unlock();save();});
$('depth').addEventListener('change',save);
$('ai-budget').addEventListener('change',save);
scope.on(document,'debug-editor-mode',event=>{selected=null;render();if(!event.detail.editing)pendingAction.then(()=>{if(scope.active&&!editor.editing&&!busy&&battle.state)guarded(bot);});});
async function initialize(){
  if(new URLSearchParams(location.search).has('run')){
    try{
      campaign=campaignBattle(location.search);
      timingContext=runTimingContext(campaign.run,'battle-loading',{encounterId:campaign.preset.enemyId,encounterName:campaign.preset.name});trackStage(timingContext);
      $('battle-preset').add(new Option(campaign.preset.name,campaign.preset.id));
      if(![...$('depth').options].some(o=>o.value===String(campaign.ai.depth)))$('depth').add(new Option(String(campaign.ai.depth),String(campaign.ai.depth)));
      setSearchDepth(campaign.ai.depth);restoreAiSettings(campaign.run.active.aiSettings);
      if(preparedState&&!campaign.snapshot.moves.length)await battle.start(campaign.preset,preparedState);
      else await battle.restore(campaign.snapshot,campaign.preset);
      $('event').textContent='Бой забега. Эфирные фигуры уже израсходованы; результат перенесётся на этаж после завершения.';
      render();await bot();save();
    }catch(error){showError(error);}
    finally{busy=false;render();}
    return;
  }
  let restored=false;
  timingContext={runId:'standalone-battle',act:0,floor:0,area:'standalone'};trackStage({...timingContext,phase:'battle-loading'});
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved){await battle.restore(saved);restored=true;standaloneDifficulty=normalizeDifficulty(saved.difficulty);if(saved.aiBudget&&[...$('ai-budget').options].some(o=>o.value===saved.aiBudget))$('ai-budget').value=saved.aiBudget;if(['3','5','7','9','12'].includes(saved.depth))setSearchDepth(saved.depth);$('sound').checked=saved.sound!==false;flipped=!!saved.flipped;}
  }catch{/* A malformed save starts a fresh game. */}
  try{
    if(!restored)await start();else $('event').textContent='Сохранённый бой восстановлен.';
    render();await bot();save();
  }catch(error){showError(error);}
  finally{busy=false;render();}
}
scope.onPause(()=>{animation.cancel();sound.stop();if($('promotion').open)$('promotion').close('cancel');});
scope.cleanup(()=>sound.dispose());
if(!existingEngine)scope.cleanup(()=>engine.fail(Error('Экран закрыт.')));
difficultyDebug=setupDifficultyDebug({root,scope,getDifficulty:()=>campaign?.run.difficulty??standaloneDifficulty,onChange:value=>{const changed=JSON.stringify(campaign?.run.difficulty??standaloneDifficulty)!==JSON.stringify(value);if(campaign){campaign.run.difficulty=value;campaign.ai=opponentProfile();}else standaloneDifficulty=value;if(changed){setSearchDepth(opponentProfile().depth);$('ai-budget').value='0';}save();render();}});
artifactUI=setupBattleArtifacts({root,scope,onContextUse:id=>{if(id==='boss-die')rerollBossReward();},battle,guarded,bot,execute,animation,save,render,isBusy:()=>busy,isFlipped:()=>flipped,message:text=>{$('event').textContent=text;$('battle-notice').textContent=text;$('battle-notice').hidden=false;}});
relicDebug=setupRelicDebug({root,scope,getState:()=>battle.artifactRuntime,isBusy:()=>busy,onChange:owned=>guarded(()=>configureBattleRelics(battle,owned,campaign)),onReset:()=>guarded(async()=>{await battle.resetArtifactCharges();if(campaign)resetArtifactCharges(campaign.run);})});
await initialize();
setupBattleView({arena:root.querySelector('.battle-arena'),viewport:root.querySelector('.battle-stage'),scope,from:preparedRect,zoomEnabled:!!(campaign?.run.act===4&&campaign.run.enemies.find(e=>e.id===campaign.preset.enemyId)?.boss)});
const openingPreset=structuredClone(battle.preset);
$('redeploy').textContent=campaign?'Повторная расстановка':'Перезапуск и расстановка';
return {beforeLeave:()=>pendingAction};
}
