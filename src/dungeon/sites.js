import {key,walkable,randomSource} from './map.js';
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

/** Keep three finds and one optional sentry regardless of the room count. */
export function floorSites(map,seed){
 const random=randomSource(seed),start=map.start,exit=map.exit;
 const candidates=map.rooms.filter(r=>!(r.cx===start.x&&r.cy===start.y)&&!(r.cx===exit.x&&r.cy===exit.y)).sort((a,b)=>distance({x:a.cx,y:a.cy},start)-distance({x:b.cx,y:b.cy},start));
 const room=candidates[Math.min(1,candidates.length-1)],sentry={x:room.cx,y:room.cy};
 const occupied=new Set([start,exit,sentry].map(p=>key(p.x,p.y))),spots=[];
 for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(walkable(map,x,y)&&!occupied.has(key(x,y)))spots.push({x,y});
 const near=spots.filter(p=>distance(p,start)>=2&&distance(p,start)<=3);
 const chosen=[near[Math.floor(random()*near.length)]??spots[0]];
 const rooms=map.rooms.filter(r=>r.cx!==start.x||r.cy!==start.y).map(r=>({room:r,score:distance({x:r.cx,y:r.cy},start)*(.7+random()*.6)})).sort((a,b)=>a.score-b.score);
 for(const {room:r} of [rooms[Math.floor((rooms.length-1)/2)],rooms.at(-1)]){
  const spot=spots.find(p=>p.x===r.x&&p.y===r.y&&!chosen.some(c=>c.x===p.x&&c.y===p.y));if(spot)chosen.push(spot);
 }
 while(chosen.length<3){
  const remaining=spots.filter(p=>!chosen.some(c=>c.x===p.x&&c.y===p.y)).sort((a,b)=>Math.min(...chosen.map(c=>distance(b,c)))-Math.min(...chosen.map(c=>distance(a,c))));
  chosen.push(remaining[0]);
 }
 return {sentry,loot:chosen.map((p,index)=>({...p,index,role:['p','n','b','r','q'][Math.floor(random()*5)]}))};
}
