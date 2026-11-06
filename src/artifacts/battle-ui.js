import {parsePosition} from '../lab/scenarios.js';
import {createThreatCache} from './threats.js';
import {createThreatVisuals} from './threat-visuals.js';
import {createEyeShader} from './eye-shader.js';
import {artifactEffect} from './effects.js';
import {artifactById} from './catalog.js';
import {identityPositions} from '../dungeon/encounters.js';
import {createArtifactBar} from './bar.js';

export function setupBattleArtifacts({root,scope,battle,guarded,bot,execute,animation,save,render,isBusy,message,onContextUse=()=>{},isFlipped=()=>false}){
 let target=null,preview=null,activating=null;
 const board=root.querySelector('#board');
 const cache=createThreatCache(parsePosition),visuals=createThreatVisuals(board,scope);
 const eyeShader=createEyeShader(board,scope);
 let eyeSignature='';
 let lastAnnounced;
 const bar=createArtifactBar({root,scope,onUse:use});
 const allowed=id=>battle.artifactRuntime?.owned.includes(id);
 function clear(){target=null;preview=null;}
 async function activate(id,square){
  const r=battle.artifactRuntime,a=artifactById(id);
  if(!allowed(id)||(r.used[id]??0)>=(a.charges??0))throw Error('Артефакт уже использован.');
  activating=id;render();try{
  if(id==='hourglass'){
   if(!battle.history.length)throw Error('Пока нечего отменять.');r.used[id]=(r.used[id]??0)+1;
   await battle.undoTurn(async move=>{const before=animation.snapshot();render();await animation.undo(move,before);});return;
  }
  if(battle.result||parsePosition(battle.state.fen).turn!=='w')throw Error('Способность доступна в ваш ход.');
  if(id==='oracle'){
   const reply=await battle.engine.request('search 30 5000');if(!battle.state.legal.includes(reply.bestmove))throw Error('Не удалось выбрать ход. Заряд сохранён.');
   r.used[id]=(r.used[id]??0)+1;await execute(reply.bestmove);activating=null;render();await bot();return;
  }
  const sourceId=['seal','lastcrown','frost'].includes(id)?identityPositions(battle.preset,battle.moves)[square]:undefined;
  let seed=0;for(const char of battle.preset.id)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;seed=(seed+battle.moves.length)>>>0;
  await battle.move('artifact '+JSON.stringify({id,target:square,ethereal:[...battle.ethereal],sourceId,seed,friendly:r.owned.includes('fang'),spendsTurn:a.spendsTurn!==false}));
  clear();activating=null;save();message(`${a.name}: способность применена.`);render();if(a.spendsTurn!==false)await bot();
  }finally{activating=null;if(scope.active)render();}
 }
 function use(id){
  const a=artifactById(id),r=battle.artifactRuntime;if(!r||!allowed(id)||isBusy())return;
  if(a.kind==='toggle'){r.toggles[id]=r.toggles[id]===false;if(id==='bell'&&r.toggles[id]===false)visuals.clear();render();save();return;}
  if(a.context){onContextUse(id);return;}
  if(a.kind==='passive'){message(a.description);return;}
  if(['hourglass','oracle','silence','dragonhorn'].includes(id)){guarded(()=>activate(id));return;}
  target=target===id?null:id;preview=null;
  if(target&&['frost','hex','briar'].includes(id)){message(id==='briar'?'Выберите пустую обычную клетку для лозы. Escape — отменить.':'Выберите фигуру, кроме короля. Escape — отменить.');}
  else if(target){message(['seal','lastcrown'].includes(id)?'Выберите свою фигуру для превращения. Это её последний бой. Escape — отменить.':'Подсвечены клетки призыва. Нажмите артефакт повторно, чтобы отменить, или клетку доски для подтверждения.');try{preview=artifactEffect(parsePosition(battle.state.fen).pieces,parsePosition(battle.state.fen).bounds,id,battle.ethereal).spawned;}catch(error){if(!['seal','lastcrown'].includes(id)){clear();message(error.message);}}}
  render();
 }
 scope.on(window,'keydown',event=>{if(event.key==='Escape'&&target){event.preventDefault();clear();render();}});
 scope.onPause(clear);
 return {get targeting(){return !!target;},consume(square){if(!target)return false;const id=target;guarded(()=>activate(id,square));return true;},playerTurn(){
  if(!battle.state||battle.result||!scope.active)return;
  const position=cache.position(battle.state.fen);if(position.turn!=='w')return;
  const token=battle.moves.at(-1)??battle.preset;
  if(token===lastAnnounced)return;lastAnnounced=token;
  const r=battle.artifactRuntime;
  if(r?.owned.includes('bell')&&r.toggles.bell!==false)visuals.ring(cache.get(battle.state.fen).danger.keys(),position.bounds,isFlipped());
 },render(){
  const r=battle.artifactRuntime;if(!r)return;bar.render({...r,battle:true,context:battle.result?.result==='win'&&battle.preset.enemyId?.startsWith('boss-')?'boss-reward':null,busy:isBusy(),target:target??activating});
  if(!battle.state)return;
  const {pieces}=cache.position(battle.state.fen),eye=r.owned.includes('eye')&&r.toggles.eye!==false;
  const threats=eye?cache.get(battle.state.fen).threats:null;
  const signature=eye?battle.state.fen+isFlipped():'off';
  if(signature!==eyeSignature){eyeSignature=signature;eyeShader.update(threats,cache.position(battle.state.fen).bounds,isFlipped());}
  for(const cell of board.querySelectorAll('[data-square]')){const s=cell.dataset.square;cell.classList.toggle('artifact-threat',threats?.has(s)??false);cell.classList.toggle('artifact-preview',(preview?.includes(s)??false)||(target==='briar'&&!pieces.has(s)&&!pieces.world?.tiles[s]));cell.classList.toggle('artifact-seal-target',(['seal','lastcrown'].includes(target)&&pieces.get(s)?.color==='w'||['frost','hex'].includes(target)&&pieces.has(s))&&pieces.get(s)?.type!=='k');}
 }};
}
