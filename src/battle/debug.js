import {editPosition} from '../debug/position.js';
import {parsePosition} from '../lab/scenarios.js';
import {identityPositions} from '../dungeon/encounters.js';

// Every edit rebases history while preserving roster and wild actor identities.
export async function editBattle(battle,tool,square,campaign=null){
 const previous=battle.snapshot(),previousPreset=battle.preset;
 let counter=campaign?.run.counter??previousPreset.debugCounter??0;
 if(tool.kind==='piece'&&tool.color==='wild')tool={...tool,wildId:`debug-wild-${++counter}`};
 const edited=editPosition(battle.state.fen,battle.ethereal,tool,square);
 const preset={...structuredClone(previousPreset),...edited,debug:true,identities:identityPositions(previousPreset,battle.moves)};
 const inventory=campaign?structuredClone(campaign.run.inventory):null;
 preset.deployed??=[];
 if(tool.kind==='move'){
  const from=preset.identities[tool.from],to=preset.identities[square];
  delete preset.identities[tool.from];delete preset.identities[square];
  if(from)preset.identities[square]=from;if(to)preset.identities[tool.from]=to;
 }else if(tool.kind==='remove'){
  const id=preset.identities[tool.from];delete preset.identities[tool.from];
  preset.deployed=preset.deployed.filter(p=>p.id!==id);
  if(inventory&&id&&id!=='king'){const index=inventory.findIndex(p=>p.id===id);if(index>=0)inventory.splice(index,1);}
 }
 const piece=parsePosition(edited.fen).pieces.get(square);
 if(piece?.color==='w'&&tool.kind!=='move'&&tool.kind!=='remove'){
  let id=preset.identities[square];
  if(tool.kind==='piece'){
   id=piece.type==='k'?'king':`debug-battle-${++counter}`;preset.identities[square]=id;
   const added={id,type:piece.type,material:'ordinary'};preset.deployed.push(added);
   if(inventory&&!inventory.some(p=>p.id===id))inventory.push({...added});
  }else if(id&&tool.material!=='power'){
   const deployed=preset.deployed.find(p=>p.id===id);
   if(deployed)deployed.material=tool.material;
   if(inventory){
    const index=inventory.findIndex(p=>p.id===id);
    if(tool.material==='ethereal'){if(index>=0)inventory.splice(index,1);}
    else if(index>=0)inventory[index].material=tool.material;
    else if(deployed)inventory.push({...deployed});
   }
  }
 }
 const beforeWild=parsePosition(battle.state.fen).pieces;
 const afterWild=parsePosition(edited.fen).pieces;
 // Keep captured map participants so settlement still knows which actor was killed.
 preset.wildIds=[...new Set([...(previousPreset.wildIds??[]),...[...beforeWild.values()].filter(p=>p.color==='wild').map(p=>p.wildId),...[...afterWild.values()].filter(p=>p.color==='wild').map(p=>p.wildId)])];
 preset.debugRemovedWild=[...new Set([...(preset.debugRemovedWild??[]),...battle.moves.map(m=>m.capturedWildId).filter(Boolean),...[...beforeWild.values()].filter(p=>p.color==='wild'&&![...afterWild.values()].some(q=>q.wildId===p.wildId)).map(p=>p.wildId)])];
 preset.debugCounter=counter;
 campaign?.verify();
 try{
  await battle.start(preset);
  if(campaign)campaign.rebase(preset,{inventory,counter,clearBuff:tool.kind==='material'&&tool.material==='ordinary'?preset.identities[square]:null});
 }catch(error){await battle.restore(previous,previousPreset);throw error;}
}
