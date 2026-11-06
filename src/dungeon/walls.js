import {key,walkable} from './map.js';

/** Outline only exposed faces; adjacent rock cells form one solid mass. */
export function wallFaces(map,x,y,seen){
 return [[0,-1,'n'],[1,0,'e'],[0,1,'s'],[-1,0,'w']]
  .filter(([dx,dy])=>seen.has(key(x+dx,y+dy))&&walkable(map,x+dx,y+dy))
  .map(([, ,side])=>`wall-${side}`).join(' ');
}
