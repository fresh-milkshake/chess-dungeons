import {files,rank} from '../battle/coordinates.js';
import {inside,fullBoard} from '../battle/geometry.js';
// Generate rays once per position, without querying the DOM for every attacker.
// Include the first occupied square (defended pieces), but never pass through it.
export function artifactThreats({pieces,walls,bounds=fullBoard}){
 const threats=new Set(),danger=new Map();
 const add=(x,y,p)=>{
  if(x<bounds.left||x>bounds.right||y<bounds.bottom||y>bounds.top)return false;
  const square=files[x]+y;if(walls.has(square)||!inside(square,bounds)||pieces.world?.tiles[square]==='hole')return false;
  threats.add(square);
  if(pieces.get(square)?.color==='w')danger.set(square,Math.max(danger.get(square)??0,p.damage??1));
  return !pieces.has(square);
 };
 for(const [from,p] of pieces){
  if(p.rooted||p.cursed||p.color==='w'||p.color==='wild'&&(p.neutral||p.aggro==='b'))continue;
  const x=from.charCodeAt(0)-97,y=rank(from);
  if(p.type==='p'){for(const dx of [-1,1])add(x+dx,y+(p.color==='b'?-1:1),p);continue;}
  if(['n','d'].includes(p.type)){for(const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]])add(x+dx,y+dy,p);if(p.type==='n')continue;}
  const directions=[];
  if('bqkdj'.includes(p.type))directions.push([1,1],[-1,1],[1,-1],[-1,-1]);
  if('rqk'.includes(p.type))directions.push([1,0],[-1,0],[0,1],[0,-1]);
  for(const [dx,dy] of directions)for(let step=1;step<=(p.type==='k'?1:p.type==='j'?2:15);step++)if(!add(x+dx*step,y+dy*step,p))break;
 }
 return {threats,danger};
}

export function createThreatCache(parse){
 let fen,position,result;
 return {
  position(next){if(fen!==next){fen=next;position=parse(next);result=null;}return position;},
  get(next){this.position(next);return result??=artifactThreats(position);},
 };
}
