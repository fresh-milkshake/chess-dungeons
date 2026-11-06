/** Invert the layout change, then smoothly reveal the final battle layout. */
export function boardTransition(from,to){
 if(!from?.width||!from.height||!to.width||!to.height)return null;
 return {x:from.x+from.width/2-to.x-to.width/2,y:from.y+from.height/2-to.y-to.height/2,sx:from.width/to.width,sy:from.height/to.height};
}
export function wheelZoom(zoom,delta,mode=0){
 const pixels=delta*(mode===1?16:mode===2?600:1);
 return Math.max(.75,Math.min(2.5,zoom*Math.exp(-Math.max(-240,Math.min(240,pixels))*.0015)));
}
export function setupBattleView({arena,viewport,scope,from,zoomEnabled=false}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const delta=boardTransition(from,arena.getBoundingClientRect());let opening;
 if(delta&&!reduced)opening=arena.animate([
  {transform:`translate(${delta.x}px,${delta.y}px) scale(${delta.sx},${delta.sy})`},
  {transform:'translate(0px,0px) scale(1,1)'},
 ],{duration:720,easing:'cubic-bezier(.22,.7,.2,1)'});
 arena.style.visibility='';
 let current=1,target=1,frame=0,last=0;
 function tick(time){
  const dt=last?Math.min(64,time-last):16;last=time;
  current+=(target-current)*(1-Math.exp(-dt/105));
  if(Math.abs(target-current)<.0005)current=target;
  arena.style.scale=String(current);
  frame=current===target?0:requestAnimationFrame(tick);if(!frame)last=0;
 }
 if(zoomEnabled)scope.on(viewport,'wheel',event=>{
  if(event.ctrlKey||event.metaKey||event.target.closest?.('button:not(.square),input,select,textarea,dialog,.battle-result'))return;
  event.preventDefault();target=wheelZoom(target,event.deltaY,event.deltaMode);
  if(reduced){current=target;arena.style.scale=String(current);return;}
  if(!frame)frame=requestAnimationFrame(tick);
 },{passive:false});
 const stop=()=>{opening?.cancel();cancelAnimationFrame(frame);frame=0;last=0;};
 scope.onPause(stop);scope.cleanup(()=>{stop();arena.style.scale='';arena.style.visibility='';});
}
