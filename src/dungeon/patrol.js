import {randomSource,key,walkable,pathTo,visibility,neighbors} from './map.js';
import {actTwoBalance} from './act-two-balance.js';
const same=(a,b)=>a.x===b.x&&a.y===b.y;
export function addFloorEncounters(run){
 const random=randomSource(Math.imul(run.seed^(run.act*9319+run.floor*7919),2654435761));
 const occupied=new Set([run.player,run.map.exit,...run.enemies,...run.loot].map(p=>key(p.x,p.y))),spots=[];
 for(let y=1;y<run.map.height-1;y++)for(let x=1;x<run.map.width-1;x++)if(walkable(run.map,x,y)&&!occupied.has(key(x,y))&&Math.abs(x-run.player.x)+Math.abs(y-run.player.y)>=4)spots.push({x,y});
 const pick=()=>spots.splice(Math.floor(random()*spots.length),1)[0];
 if(!run.enemies.some(e=>e.special)&&spots.length){
  const style=['ambush','split','forward'][Math.floor(random()*3)],army=[['n','b','p'],[...actTwoBalance.special],['r','b','p','p'],['r','b','n','p','p']][run.act-1];
  const officer=random()<.5?0:1;
  const armor=[{index:officer,material:'stone'},...(run.act>=3?[{index:army.indexOf('p'),material:'stone'}]:[])];
  run.enemies.push({...pick(),id:`unusual-${run.floor}`,type:army[0],army,formationStyle:style,special:true,armor,kingless:random()<.4});
 }
 if(!run.enemies.some(e=>e.weak)&&spots.length){
  const route=run.map.rooms.map(r=>({x:r.cx,y:r.cy}));
  for(let i=route.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[route[i],route[j]]=[route[j],route[i]];}
  run.enemies.push({...pick(),id:`patrol-${run.floor}`,type:'p',weak:true,roaming:true,route,routeIndex:0,routeVisits:0,kingless:random()<.5});
 }
 run.encounterGeneration=2;
}
export function jitterWaypoint(run,enemy,anchor){
 const random=randomSource(Math.imul(run.seed^(enemy.routeVisits*7919+run.floor*131),2654435761)),choices=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dy)>=1&&Math.abs(dx)+Math.abs(dy)<=2){
  const p={x:anchor.x+dx,y:anchor.y+dy};
  if(walkable(run.map,p.x,p.y)&&!run.enemies.some(e=>e.id!==enemy.id&&same(e,p)))choices.push(p);
 }
 return choices[Math.floor(random()*choices.length)]??anchor;
}
export function weakPatrolTarget(run,enemy,canSee){
 enemy.chasing=canSee;delete enemy.lastSeen;
 if(canSee)return run.player;
 enemy.route??=run.map.rooms.map(r=>({x:r.cx,y:r.cy}));enemy.routeIndex??=0;enemy.routeVisits??=0;
 if(!enemy.waypoint||same(enemy,enemy.waypoint)){
  if(enemy.waypoint)enemy.routeIndex=(enemy.routeIndex+1)%enemy.route.length;
  enemy.routeVisits++;enemy.waypoint=jitterWaypoint(run,enemy,enemy.route[enemy.routeIndex]);
 }
 return enemy.waypoint;
}
export function advanceRoamers(run){
 for(const enemy of run.enemies.filter(e=>e.roaming)){
  const region=enemy.region==='secret'?new Set(run.map.secret?.cells??[]):null;
  const friendly=enemy.wild&&run.artifacts?.includes('fang')&&!enemy.truceBroken;
  const canSee=!run.debugMap?.ghost&&!friendly&&(!region||region.has(key(run.player.x,run.player.y)))&&visibility(run.map,enemy,5).includes(key(run.player.x,run.player.y));if(run.debugMap?.ghost||friendly||region&&!region.has(key(run.player.x,run.player.y)))delete enemy.lastSeen;
  let target;
  if(enemy.weak)target=weakPatrolTarget(run,enemy,canSee);
  else{
   if(canSee)enemy.lastSeen={...run.player};
   const rooms=region?run.map.secret.rooms:run.map.rooms;
   const patrolTarget=()=>{const r=rooms[(enemy.patrol??0)%rooms.length],center={x:r.cx,y:r.cy};return [center,...neighbors(run.map,center)].find(p=>!run.enemies.some(e=>e.id!==enemy.id&&same(e,p)))??center;};
   target=enemy.lastSeen??patrolTarget();
   if(same(enemy,target)){enemy.lastSeen=null;enemy.patrol=((enemy.patrol??0)+1)%run.map.rooms.length;target=patrolTarget();}
  }
  const blocked=new Set(run.enemies.filter(e=>e.id!==enemy.id).map(e=>key(e.x,e.y)));
  if(region){for(let y=1;y<run.map.height-1;y++)for(let x=1;x<run.map.width-1;x++)if(!region.has(key(x,y)))blocked.add(key(x,y));}
  const path=pathTo(run.map,enemy,target,blocked);
  if(path.length>1){enemy.x=path[1].x;enemy.y=path[1].y;}
  if(!run.debugMap?.ghost&&same(enemy,run.player)){run.openEncounter(enemy);break;}
 }
}
