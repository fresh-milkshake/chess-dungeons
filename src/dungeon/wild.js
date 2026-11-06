import {randomSource,pathTo,walkable,key} from './map.js';
import {actTwoBalance} from './act-two-balance.js';
export function wildChances(act,floor){if(act===2)return {...actTwoBalance.wild[Math.max(0,Math.min(1,floor-1))]};return {any:act<2?0:Math.min(.9,.55+(act-2)*.2+(floor-1)*.05),pair:act<2?0:Math.min(.9,.25+(act-2)*.3+(floor-1)*.15)};}
export function chooseWildTypes(run,count,random){
 const history=run.wildDiversity??={counts:{},previous:[]},chosen=[];
 for(let i=0;i<count;i++){
  const available=[...(run.act>=3?'nbrqd':'nbrq')].filter(t=>!chosen.includes(t)),fresh=available.filter(t=>!history.previous.includes(t));
  const pool=fresh.length?fresh:available,min=Math.min(...pool.map(t=>history.counts[t]??0));
  const least=pool.filter(t=>(history.counts[t]??0)===min),type=least[Math.floor(random()*least.length)];
  chosen.push(type);history.counts[type]=(history.counts[type]??0)+1;
 }
 history.previous=chosen;return chosen;
}
export function spawnWild(run){
 if(run.act<2)return;
 const random=randomSource(Math.imul(run.seed^Math.imul(run.act*100+run.floor,0x45d9f3b),2654435761));
 const chance=wildChances(run.act,run.floor);if(random()>chance.any)return;
 const count=random()<chance.pair?2:1;
 const occupied=new Set([run.player,run.map.exit,...run.enemies,...run.loot].map(p=>key(p.x,p.y))),spots=[];
 for(let y=1;y<run.map.height-1;y++)for(let x=1;x<run.map.width-1;x++)if(walkable(run.map,x,y)&&!occupied.has(key(x,y))&&Math.abs(x-run.player.x)+Math.abs(y-run.player.y)>=6)spots.push({x,y});
 const types=chooseWildTypes(run,Math.min(count,spots.length),random);
 for(let i=0;i<types.length;i++){
  const [pos]=spots.splice(Math.floor(random()*spots.length),1);
  run.enemies.push({...pos,id:`wild-${run.act}-${run.floor}-${i}`,type:types[i],wild:true,roaming:true,hp:2,damage:2,patrol:i});
 }
}
export function invadingWild(run,enemy){
 if(run.act<2||enemy.wild||enemy.boss||enemy.wildGuardIds)return null;
 return run.enemies.filter(e=>e.wild&&e.id!==enemy.id).map(e=>({enemy:e,path:pathTo(run.map,e,enemy)})).filter(e=>e.path.length>0&&e.path.length<=7).sort((a,b)=>a.path.length-b.path.length||a.enemy.id.localeCompare(b.enemy.id))[0]?.enemy??null;
}
export function settleWild(run,preset,moves,wildState){
 const participants=new Set(preset.wildIds??[]),killed=new Set([...(preset.debugRemovedWild??[]),...moves.map(m=>m.capturedWildId).filter(Boolean),...moves.flatMap(m=>m.terrainWildIds??[])]);
 for(const id of killed)if(participants.has(id))run.enemies=run.enemies.filter(e=>e.id!==id);
 if(wildState)for(const e of run.enemies.filter(e=>participants.has(e.id))){
  const survivor=wildState.find(p=>p.id===e.id);if(survivor){e.hp=survivor.hp;e.aggro=survivor.aggro;if(run.artifacts?.includes('fang')&&survivor.neutral===false)e.truceBroken=true;}
 }
}
