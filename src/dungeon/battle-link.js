import {loadRun,saveRun} from './storage.js';
import {aiProfile,survivingIds} from './encounters.js';
import {Run} from './run.js';
import {syncArtifactUses} from '../artifacts/mechanics.js';
import {owns} from '../artifacts/catalog.js';
export function campaignBattle(search,storage){
 const id=new URLSearchParams(search).get('run');if(!id)return null;
 const run=loadRun(storage);if(!run||run.id!==id||run.stage!=='battle'||!run.active)throw Error('Бой забега не найден. Вернитесь в подземелье.');
 let revision=run.active.revision??0;
 const check=()=>{const latest=loadRun(storage);if(latest?.stage!=='battle'||latest.active?.id!==run.active?.id||latest.active.revision!==revision)throw Error('Бой изменён в другой вкладке. Перезагрузите страницу.');};
 return {run,closed:false,preset:run.active.preset,ai:aiProfile(run.act,run.floor,run.enemies.find(e=>e.id===run.active.preset.enemyId),run.difficulty),
  verify:check,
  rerollBossReward(battle){
   check();const enemy=run.enemies.find(e=>e.id===run.active.preset.enemyId);
   if(!enemy?.boss||battle.result?.result!=='win'||!owns(run,'boss-die')||battle.artifactRuntime.used['boss-die'])throw Error('Обновление награды недоступно.');
   const before=run.snapshot(),used=battle.artifactRuntime.used['boss-die'];
   try{battle.artifactRuntime.used['boss-die']=1;this.save(battle);}catch(error){Object.assign(run,Run.restore(before));if(used===undefined)delete battle.artifactRuntime.used['boss-die'];else battle.artifactRuntime.used['boss-die']=used;throw error;}
  },
  claimBossReward(battle,index){
   check();const enemy=run.enemies.find(e=>e.id===run.active.preset.enemyId);
   if(!enemy?.boss||battle.result?.result!=='win')throw Error('Сначала победите босса.');
   const updated=Run.restore(run.snapshot()),survivors=survivingIds(updated.active.preset,battle.moves);
   updated.finishBattle('win',survivors,battle.moves,battle.state?.wildPieces,battle.artifactRuntime);
   if(!updated.chooseBossReward(index))throw Error('Выберите награду за босса.');
   saveRun(updated,storage);Object.assign(run,updated);this.closed=true;
  },
  snapshot:{version:1,preset:run.active.preset.id,moves:run.active.moves,resigned:run.active.resigned,artifactRuntime:run.active.artifactRuntime},
  save(battle){check();run.active.moves=battle.moves.map(m=>m.uci);run.active.resigned=!!battle.resigned;run.active.artifactRuntime=structuredClone(battle.artifactRuntime);syncArtifactUses(run,battle.artifactRuntime);if(run.active.preparation){run.active.preparation.artifacts=[...run.artifacts];run.active.preparation.artifactToggles={...run.artifactToggles};}run.active.revision=revision+1;saveRun(run,storage);revision++;},
  rebase(preset,{inventory,counter,clearBuff}){
   check();
   const updated=Run.restore(run.snapshot());updated.active.preset=preset;updated.active.moves=[];updated.active.resigned=false;updated.active.revision=revision+1;
   updated.inventory=inventory;updated.counter=counter;if(clearBuff)updated.buffs=updated.buffs.filter(b=>b.pieceId!==clearBuff);
   saveRun(updated,storage);Object.assign(run,updated);revision++;this.preset=preset;
  },
  finish(battle){check();if(!battle.result)throw Error('Бой ещё не завершён.');const survivors=survivingIds(run.active.preset,battle.moves);run.finishBattle(battle.result.result,survivors,battle.moves,battle.state?.wildPieces,battle.artifactRuntime);saveRun(run,storage);this.closed=true;},
 };
}
