import {files} from '../battle/coordinates.js';
import {randomSource,key} from '../dungeon/map.js';
import {worldMeta} from './world.js';
import {inside} from '../battle/geometry.js';
import {clusteredCells} from './clusters.js';
function connected(map){const seen=new Set(),queue=[map.start.y*map.width+map.start.x];for(let i=0;i<queue.length;i++){const at=queue[i];if(seen.has(at)||map.tiles[at]!==1)continue;seen.add(at);const x=at%map.width,y=Math.floor(at/map.width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(x+dx>0&&x+dx<map.width-1&&y+dy>0&&y+dy<map.height-1&&!seen.has(at+dx+dy*map.width))queue.push(at+dx+dy*map.width);}return seen.size===map.tiles.filter(t=>t===1).length;}
const tileFor={ruins:'hole',garden:'vine',forge:'heat',ice:'ice'};
export function battlefieldWorld(run,enemy,bounds,occupied){
 const biome=run.biome,kind=tileFor[biome];if(!biome)return null;
 const world={biome,key:`${run.id}-${enemy.id}`,round:0,tiles:{}},rng=randomSource(run.seed^run.floor*7139^Array.from(enemy.id).reduce((s,c)=>s+c.charCodeAt(0)*97,0)),cells=[];
 for(let y=bounds.bottom;y<=bounds.top;y++)for(let x=bounds.left;x<=bounds.right;x++){const s=files[x]+y;if(inside(s,bounds)&&!occupied.has(s))cells.push(s);}
 if(kind){for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
 const count=Math.round((bounds.right-bounds.left+1)*(bounds.top-bounds.bottom+1)/12);
 const selected=kind==='hole'?clusteredCells(cells,count,rng,s=>({x:s.charCodeAt(0)-97,y:Number(s.slice(1))})):cells.slice(0,count);
 for(const s of selected)world.tiles[s]=kind;}
 return world;
}
export function addMapTerrain(run){
 const kind=tileFor[run.biome];run.map.world={biome:run.biome,key:`${run.id}-${run.act}-${run.floor}`,round:0,tiles:{}};if(!kind)return;
 const map=run.map,rng=randomSource(run.seed^run.floor*8941^run.act*9013),protectedCells=new Set([map.start,map.exit,...run.enemies,...run.loot,...(run.merchants??[])].map(p=>key(p.x,p.y))),cells=[];
 for(const cell of map.secret?.cells??[])protectedCells.add(cell);
 for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(map.tiles[y*map.width+x]===1&&!protectedCells.has(key(x,y)))cells.push({x,y});
 const ordinaryFloor=map.tiles.filter(t=>t===1).length-(map.secret?.cells.length??0);
 const count=Math.round(ordinaryFloor/12);for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
 const selected=kind==='hole'?clusteredCells(cells,count,rng,p=>p,p=>{const index=p.y*map.width+p.x;map.tiles[index]=2;if(connected(map))return true;map.tiles[index]=1;return false;}):cells.slice(0,count);
 for(const p of selected)map.world.tiles[key(p.x,p.y)]=kind;
}
export function attachWorld(preset,world){if(!world)return preset;return {...preset,world,fen:preset.fen.replace(/;world=[^;\s]+/,'')+worldMeta(world)};}
