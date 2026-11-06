import {parsePosition} from '../lab/scenarios.js';
import {wildFen} from '../battle/wild-rules.js';

/** Deterministic start effects: reload/redeploy cannot reroll the chosen ally. */
export function initialRelicPosition(preset){
 if(!preset.artifacts?.some(id=>['coldfire','glassward'].includes(id)))return {fen:preset.fen};
 const {pieces,bounds,turn}=parsePosition(preset.fen);let frozenId;
 if(preset.artifacts.includes('coldfire')){
  const candidates=[...pieces].filter(([,p])=>p.color==='w'&&p.type!=='k').sort(([a],[b])=>a.localeCompare(b));
  let seed=0;for(const char of preset.id)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;
  const chosen=candidates[seed%Math.max(1,candidates.length)];
  if(chosen){Object.assign(chosen[1],{hp:1,damage:2,iced:true,glass:true});frozenId=preset.identities?.[chosen[0]];}
 }
 if(preset.artifacts.includes('glassward'))pieces.relics={glassAvailable:preset.floorUses?.glassward?0:1,glassUsed:preset.floorUses?.glassward?1:0};
 return {fen:wildFen(pieces,bounds,turn,preset.fen.match(/wildmode=(\w+)/)?.[1]??'mixed',preset.fen.split(' ')[3])+ (preset.fen.match(/;required=[^;]*/)?.[0]??''),frozenId};
}
