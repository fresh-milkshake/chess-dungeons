import {generateLayout} from './generation.js';
export const key = (x,y)=>`${x},${y}`;
export function randomSource(seed) { let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;}; }
export const cardinal = [[1,0],[-1,0],[0,1],[0,-1]];
export function walkable(map,x,y) { return x>0&&y>0&&x<map.width-1&&y<map.height-1&&map.tiles[y*map.width+x]===1; }
export function neighbors(map,p) { return cardinal.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(p=>walkable(map,p.x,p.y)); }
export function pathTo(map,from,to,blocked=new Set()) {
 const queue=[from],previous=new Map([[key(from.x,from.y),null]]);
 for(let i=0;i<queue.length;i++){
  const p=queue[i],id=key(p.x,p.y);
  if(p.x===to.x&&p.y===to.y){const path=[];let q=p;while(q){path.unshift(q);q=previous.get(key(q.x,q.y));}return path;}
  for(const next of neighbors(map,p)){const n=key(next.x,next.y);if(!previous.has(n)&&!blocked.has(n)){previous.set(n,p);queue.push(next);}}
 }
 return [];
}
export function generateMap(seed,options) {
 return generateLayout(seed,randomSource(Math.imul(seed^0x9e3779b9,2654435761)),options);
}
function sight(map,from,to) {
 let x=from.x,y=from.y;const dx=Math.abs(to.x-x),dy=Math.abs(to.y-y),sx=x<to.x?1:-1,sy=y<to.y?1:-1;let error=dx-dy;
 while(x!==to.x||y!==to.y){const twice=error*2,oldX=x,oldY=y;if(twice>-dy){error-=dy;x+=sx;}if(twice<dx){error+=dx;y+=sy;}
  if(x!==oldX&&y!==oldY&&!walkable(map,x,oldY)&&!walkable(map,oldX,y))return false;
  if(x===to.x&&y===to.y)return true;
  if(!walkable(map,x,y))return false;
 }return true;
}
export function visibility(map,player,radius=3) {
 const visible=[];
 for(let y=Math.max(0,player.y-radius);y<=Math.min(map.height-1,player.y+radius);y++)for(let x=Math.max(0,player.x-radius);x<=Math.min(map.width-1,player.x+radius);x++)if(sight(map,player,{x,y}))visible.push(key(x,y));
 return visible;
}
