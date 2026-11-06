import {generateMap,walkable} from '../src/dungeon/map.js';
import {floorSites} from '../src/dungeon/sites.js';

// Optimistic movement lower bounds: known map, 8-way king steps, no combat.
function distances(map,from){
 const dist=Array(map.tiles.length).fill(-1),queue=[from.y*map.width+from.x];dist[queue[0]]=0;
 for(let i=0;i<queue.length;i++){
  const x=queue[i]%map.width,y=Math.floor(queue[i]/map.width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy,id=yy*map.width+xx;
   if((!dx&&!dy)||!walkable(map,xx,yy)||dist[id]>=0||dx&&dy&&(!walkable(map,xx,y)||!walkable(map,x,yy)))continue;
   dist[id]=dist[queue[i]]+1;queue.push(id);
  }
 }
 return dist;
}
const result=[];
for(const rooms of [3,4,5,6]){
 const direct=[],exploration=[],areas=[];
 for(let i=1;i<=400;i++){
  const seed=Math.imul(i,2654435761)>>>0,map=generateMap(seed,{rooms}),sites=floorSites(map,seed);
  const points=[map.start,...sites.loot,map.exit],matrix=points.map(p=>{const d=distances(map,p);return points.map(p=>d[p.y*map.width+p.x]);});
  direct.push(matrix[0][4]);areas.push(map.tiles.filter(Boolean).length);
  const tours=[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
  exploration.push(Math.min(...tours.map(([a,b,c])=>matrix[0][a]+matrix[a][b]+matrix[b][c]+matrix[c][4])));
 }
 const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {mean:+(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1),p50:sorted[Math.floor(sorted.length*.5)],p90:sorted[Math.floor(sorted.length*.9)]};};
 result.push({rooms,direct:stats(direct),allThreeFinds:stats(exploration),floorCells:stats(areas),expectedFindMaterial:15,materialPer100ExplorationMoves:+(1500/stats(exploration).mean).toFixed(1)});
}
console.log(JSON.stringify({seedsPerCount:400,assumption:'All three finds exchanged for act-I material; routes know the map and exclude fights, fog and human decisions.',result},null,2));
