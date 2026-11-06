import {identityPositions} from '../dungeon/encounters.js';

export async function configureBattleRelics(battle,owned,campaign){
 campaign?.verify();
 const runtime=structuredClone(battle.artifactRuntime);runtime.owned=[...owned];
 if(!battle.state.wildMode&&owned.some(id=>['banner','mirror','seal','frost','briar','hex','silence','dragonhorn','lastcrown','glassward','coldfire'].includes(id))){
  const before=battle.snapshot(),oldPreset=battle.preset;
  const preset={...structuredClone(oldPreset),debug:true,artifacts:[...owned],ethereal:[...battle.ethereal],identities:identityPositions(oldPreset,battle.moves),fen:battle.state.fen+(battle.state.fen.includes(' @')?';wildmode=mixed;truce=':' @hunt=0;wildmode=mixed;truce=')};
  try{
   await battle.start(preset);
   runtime.frozenId=battle.artifactRuntime.frozenId??runtime.frozenId;
   if(campaign)campaign.rebase(preset,{inventory:structuredClone(campaign.run.inventory),counter:campaign.run.counter});
  }catch(error){await battle.restore(before,oldPreset);throw error;}
 }
 battle.artifactRuntime=runtime;battle.preset.artifacts=[...owned];
}
