import {rank as squareRank,files} from '../battle/coordinates.js';
import {artifactImage} from './catalog.js';

// A separate overlay survives board selection/rendering and never participates
// in chess sprite selectors, dragging or move animation snapshots.
export function createThreatVisuals(board,scope){
 const layer=document.createElement('div');layer.className='artifact-bell-layer';layer.setAttribute('aria-hidden','true');board.parentElement.append(layer);
 const animations=new Set();
 function clear(){for(const animation of animations)animation.cancel();animations.clear();layer.replaceChildren();}
 scope.onPause(clear);scope.cleanup(()=>{clear();layer.remove();});
 return {clear,ring(squares,bounds,flipped){
  clear();const columns=bounds.right-bounds.left+1,rows=bounds.top-bounds.bottom+1;
  for(const square of squares){
   const x=square.charCodeAt(0)-97,y=squareRank(square);
   const cell=document.createElement('span');cell.className='artifact-bell-signal';
   cell.style.left=`${(flipped?bounds.right-x:x-bounds.left)/columns*100}%`;
   cell.style.top=`${(flipped?y-bounds.bottom:bounds.top-y)/rows*100}%`;
   cell.style.width=`${100/columns}%`;cell.style.height=`${100/rows}%`;
   const icon=document.createElement('img');icon.src=artifactImage('bell',import.meta.env.BASE_URL);icon.alt='';icon.draggable=false;cell.append(icon);layer.append(cell);
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   const animation=icon.animate(reduced?[{opacity:.95},{opacity:0}]:[{opacity:0,transform:'translateY(6%) scale(.55)'},{opacity:1,transform:'translateY(0) scale(.8)',offset:.12},{opacity:.7,transform:'translateY(-12%) scale(1.12)',offset:.45},{opacity:0,transform:'translateY(-28%) scale(1.65)'}],{duration:reduced?600:1350,easing:'ease-out',fill:'forwards'});
   animations.add(animation);animation.finished.then(()=>{animations.delete(animation);cell.remove();},()=>{});
  }
 }};
}
