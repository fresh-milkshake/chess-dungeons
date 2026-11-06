/** Encode visibility only; no terrain or actor information enters the shader. */
export function knowledgeMask(width,height,seen,visible){
 const known=new Set(seen),lit=new Set(visible);
 return Uint8Array.from({length:width*height},(_,i)=>{const id=`${i%width},${Math.floor(i/width)}`;return lit.has(id)?0:known.has(id)?150:255;});
}
export function fogViewportSize(width,height){
 const scale=Math.min(1,960/width,540/height);
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
/** Stable per floor, independent of camera and elapsed time. */
export function fogPatternOffset(seed,act,floor){
 let value=(seed^Math.imul(act,104729)^Math.imul(floor,7919))>>>0;
 const next=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296*128;};
 return [next(),next()];
}
