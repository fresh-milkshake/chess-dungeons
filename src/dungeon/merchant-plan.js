import {randomSource} from './map.js';
export function merchantPlan(seed){const random=randomSource(seed^0x448ac19);return {version:1,floors:[1,2,3].map(act=>({act,floor:random()<.5?2:3})),secret:[{act:3,floor:2},{act:3,floor:3},{act:4,floor:1}][Math.floor(random()*3)]};}
/** Extend only to the east. The old map, start, exit and existing rooms retain coordinates. */
export function extendSecretArea(map,seed){
 const originalWidth=map.width,originalHeight=map.height,width=originalWidth+24;
 const candidates=[];for(let y=3;y<originalHeight-3;y++)for(let x=originalWidth-2;x>=1;x--)if(map.tiles[y*originalWidth+x]===1){candidates.push({x,y});break;}
 candidates.sort((a,b)=>b.x-a.x||Math.abs(a.y-originalHeight/2)-Math.abs(b.y-originalHeight/2));
 const anchor=candidates[(seed>>>0)%Math.min(3,candidates.length)],cy=anchor.y,height=Math.max(originalHeight,cy+10),tiles=Array(width*height).fill(0);
 for(let y=0;y<originalHeight;y++)for(let x=0;x<originalWidth;x++)tiles[y*width+x]=map.tiles[y*originalWidth+x];
 const cells=new Set(),carve=(x,y)=>{tiles[y*width+x]=1;cells.add(`${x},${y}`);};
 for(let x=anchor.x+1;x<width-3;x++)carve(x,cy);
 const rooms=[];
 for(let i=0;i<3;i++){const x=originalWidth+2+i*7,room={x,y:cy-2,w:5,h:5,cx:x+2,cy};rooms.push(room);for(let y=cy-2;y<=cy+2;y++)for(let xx=x;xx<x+5;xx++)carve(xx,y);}
 // An alcove branches off the middle room. Its static elite never blocks the route.
 const ox=rooms[1].cx,oy=cy+6;for(let y=cy+3;y<=oy;y++)carve(ox,y);for(let y=oy-1;y<=oy+1;y++)for(let x=ox-1;x<=ox+1;x++)carve(x,y);
 map.width=width;map.height=height;map.tiles=tiles;map.secret={cells:[...cells],rooms,entrance:{x:anchor.x+1,y:cy},shop:{x:rooms[2].cx+1,y:cy},optional:{x:ox,y:oy},originalWidth,originalHeight};
 return map.secret;
}
