import {owns,artifactById} from './catalog.js';
import {rechargeScope,ensureActCharges} from './charges.js';
import {shopRerollCosts} from '../dungeon/economy.js';

export const deploymentLimit=run=>Math.max(1,16+(owns(run,'ranks')?3:0)-(run.slotDebt??0));
export const shopRerollPrice=run=>shopRerollCosts[run.shop?.rerolls??0]??null;
export function protectGlass(board,piece){
 if(piece?.color!=='w'||!piece.glass||piece.iced||!board.relics?.glassAvailable)return false;
 board.relics.glassAvailable=0;board.relics.glassUsed=1;piece.hp=1;return true;
}
/** End one side's opportunity, including passes and artifact actions. */
export function tickCurses(board,color){
 for(const p of board.values())if(p.color===color&&p.curseTurns){
  p.curseTurns--;if(!p.curseTurns){p.cursed=!!p.curseBase;delete p.curseBase;delete p.curseTurns;}
 }
}
export function syncArtifactUses(run,runtime){
 if(!runtime)return;
 run.artifacts=[...runtime.owned];run.artifactToggles={...runtime.toggles};
 run.artifactFloor??={key:`${run.act}-${run.floor}`};run.artifactFloor.used??={};run.artifactRun??={};
 ensureActCharges(run);
 for(const id of runtime.owned){
  const scope=rechargeScope(artifactById(id)??{}),n=runtime.used[id]??0;
  if(scope==='floor'||scope==='boss')run.artifactFloor.used[id]=n;
  if(scope==='act')run.artifactAct.used[id]=n;
  if(scope==='run')run.artifactRun[id]=n;
 }
 // Compatibility for v1 snapshots; the battle scope now ignores this old field.
 run.artifactFloor.sealUsed=!!runtime.used.seal;
}
