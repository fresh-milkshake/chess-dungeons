import {knowledgeMask} from './knowledge.js';
const weights=[1,4,10,20,31,36,31,20,10,4,1],weightSum=weights.reduce((a,b)=>a+b,0),axisCache=new Map();
function axisTaps(size,scale){
 const key=`${size}:${scale}`;if(axisCache.has(key))return axisCache.get(key);
 const taps=Array.from({length:size*scale},(_,p)=>{
  const groups=new Map();for(let k=-5;k<=5;k++){const i=Math.floor((p+k)/scale),index=i<0||i>=size?-1:i;groups.set(index,(groups.get(index)??0)+weights[k+5]);}
  return [...groups].flat();
 });
 if(axisCache.size>=8)axisCache.delete(axisCache.keys().next().value);axisCache.set(key,taps);return taps;
}

/** Blur only the small knowledge field, never the viewport or game sprites. */
export function smoothKnowledge(width,height,seen,visible,scale=4){
 const source=knowledgeMask(width,height,seen,visible),w=width*scale,h=height*scale;
 const horizontal=new Float32Array(w*height),unknownHorizontal=new Float32Array(w*height),result=new Uint8Array(w*h),xt=axisTaps(width,scale),yt=axisTaps(height,scale);
 // Upscaled source rows repeat: compute each logical row once and group equal taps.
 for(let y=0;y<height;y++)for(let x=0;x<w;x++){
  let value=0,unknown=0;const taps=xt[x];for(let i=0;i<taps.length;i+=2){const sx=taps[i],v=sx<0?255:source[y*width+sx],weight=taps[i+1];value+=v*weight;unknown+=(v===255?255:0)*weight;}
  horizontal[y*w+x]=value/weightSum;unknownHorizontal[y*w+x]=unknown/weightSum;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let value=0,unknown=0;const taps=yt[y];for(let i=0;i<taps.length;i+=2){const sy=taps[i],weight=taps[i+1];value+=(sy<0?255:horizontal[sy*w+x])*weight;unknown+=(sy<0?255:unknownHorizontal[sy*w+x])*weight;}
  // Finish the fade before known DOM terrain ends, hiding its square cutout.
  result[y*w+x]=Math.round(Math.min(255,Math.max(value/weightSum,unknown/weightSum*2.2)));
 }
 return {width:w,height:h,data:result};
}

/** Retarget from the current displayed field, including during rapid movement. */
export function createMaskTransition(duration=240){
 let target=null,from=null,output=null,started=0,identity=null;
 const active=now=>!!from&&now-started<duration;
 function sample(now){
  if(!active(now)){from=null;return target;}
  const t=Math.max(0,Math.min(1,(now-started)/duration)),ease=t*t*(3-2*t);
  for(let i=0;i<output.length;i++)output[i]=Math.round(from[i]+(target[i]-from[i])*ease);
  return output;
 }
 return {active,sample,set(next,now,key){
  if(key===identity&&target?.length===next.length&&target.every((v,i)=>v===next[i]))return false;
  const previous=target&&key===identity&&target.length===next.length?Uint8Array.from(sample(now)):null;
  identity=key;target=next;from=previous;output=new Uint8Array(next.length);started=now;return true;
 }};
}

/** Reproject an existing fog frame with CSS at the camera's full frame rate. */
export function projectFogFrame(capture,camera){
 return {x:camera.x+capture.origin[0]*camera.tile,y:camera.y+capture.origin[1]*camera.tile,scale:camera.tile/capture.tile};
}
