import {createScope} from '../app/scope.js';
export function followTarget({x,y,zoom},player,tile,width,height){
 const worldX=(player.x+.5)*tile*zoom,worldY=(player.y+.5)*tile*zoom;
 const screenX=x+worldX,screenY=y+worldY;
 if(Math.abs(screenX-width/2)<.5&&Math.abs(screenY-height/2)<.5)return null;
 return {x:width/2-worldX,y:height/2-worldY};
}
export function zoomAt({x,y,zoom},point,nextZoom){
 const bounded=Math.min(2.5,Math.max(.4,nextZoom));
 return {x:point.x-(point.x-x)*bounded/zoom,y:point.y-(point.y-y)*bounded/zoom,zoom:bounded};
}
/** Exact critically damped spring step: retargeting keeps the current velocity. */
export function followAxis(position,velocity,target,seconds,frequency=12){
 const offset=position-target,impulse=velocity+frequency*offset,decay=Math.exp(-frequency*seconds);
 return {position:target+(offset+impulse*seconds)*decay,velocity:(velocity-frequency*impulse*seconds)*decay};
}
export function createCamera(viewport,board,{canPan=()=>true,scope=createScope()}={}){
 let x=0,y=0,zoom=1,followFrame=0,following=null;
 let velocityX=0,velocityY=0,lastFollow=0,paintedTile=null;
 let pan=null,suppressClickUntil=0;
 let baseTile=parseFloat(getComputedStyle(viewport).getPropertyValue('--tile'))||72;
 const tile=()=>baseTile;
 function paint(){
  // Resize the layout instead of magnifying a low-resolution composited layer.
  const scaledTile=baseTile*zoom;
  if(paintedTile!==scaledTile){board.style.setProperty('--camera-tile',`${scaledTile}px`);viewport.style.backgroundSize=`${scaledTile*2}px ${scaledTile*2}px`;paintedTile=scaledTile;}
  board.style.transform=`translate(${x}px,${y}px)`;
  viewport.style.backgroundPosition=`${x}px ${y}px`;
  viewport.dispatchEvent(new CustomEvent('map-camera-change',{detail:{x,y,tile:scaledTile}}));
 }
 function cancelFollow(){cancelAnimationFrame(followFrame);followFrame=0;following=null;velocityX=velocityY=0;}
 function center(player){
  cancelFollow();x=width/2-(player.x+.5)*tile()*zoom;
  y=height/2-(player.y+.5)*tile()*zoom;paint();
 }
 function follow(player){
  const target=followTarget({x,y,zoom},player,tile(),width,height);
  if(!target)return;
  if(following?.x===target.x&&following?.y===target.y)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){cancelFollow();x=target.x;y=target.y;paint();return;}
  following=target;
  if(followFrame)return;
  lastFollow=performance.now();
  function tick(now){
   const dt=Math.max(0,(now-lastFollow)/1000);lastFollow=now;
   const horizontal=followAxis(x,velocityX,following.x,dt),vertical=followAxis(y,velocityY,following.y,dt);
   x=horizontal.position;velocityX=horizontal.velocity;y=vertical.position;velocityY=vertical.velocity;
   if(Math.hypot(x-following.x,y-following.y)<.1&&Math.hypot(velocityX,velocityY)<.5){x=following.x;y=following.y;cancelFollow();paint();return;}
   paint();followFrame=requestAnimationFrame(tick);
  }
  followFrame=requestAnimationFrame(tick);
 }
 function endPan(){
  if(!pan)return;
  const gesture=pan;pan=null;viewport.classList.remove('panning');
  if(gesture.active)suppressClickUntil=performance.now()+350;
  if(viewport.hasPointerCapture(gesture.id))viewport.releasePointerCapture(gesture.id);
 }
 scope.on(viewport,'pointerdown',event=>{
  if(pan||!event.isPrimary||event.button!==0||!canPan())return;
  // The king owns its drag gesture; every other part of the map can be panned.
  if(event.target.closest('[data-cell]')?.querySelector('[data-actor="player"]'))return;
  pan={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,active:false};
 });
 scope.on(viewport,'pointermove',event=>{
  if(!pan||event.pointerId!==pan.id)return;
  if(!pan.active&&Math.hypot(event.clientX-pan.startX,event.clientY-pan.startY)<5)return;
  if(!canPan()){endPan();return;}
  event.preventDefault();
  if(!pan.active){pan.active=true;cancelFollow();viewport.setPointerCapture(event.pointerId);viewport.classList.add('panning');}
  x+=event.clientX-pan.lastX;y+=event.clientY-pan.lastY;
  pan.lastX=event.clientX;pan.lastY=event.clientY;paint();
 });
 scope.on(viewport,'pointerup',event=>{if(event.pointerId===pan?.id)endPan();});
 scope.on(viewport,'pointercancel',endPan);
 scope.on(viewport,'lostpointercapture',endPan);
 scope.on(window,'pointerup',endPan);
 scope.on(viewport,'wheel',event=>{
  if(event.ctrlKey||!canPan())return;
  event.preventDefault();cancelFollow();
  const rect=viewport.getBoundingClientRect(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
  const next=zoomAt({x,y,zoom},{x:event.clientX-rect.left,y:event.clientY-rect.top},zoom*Math.exp(-delta*.0015));
  ({x,y,zoom}=next);paint();
 },{passive:false});
 function stop(){cancelFollow();endPan();}
 scope.on(window,'blur',stop);
 scope.on(document,'visibilitychange',()=>{if(document.hidden)stop();});
 let width=viewport.clientWidth,height=viewport.clientHeight;
 function refresh(){if(!scope.active||!viewport.clientWidth||!viewport.clientHeight)return;cancelFollow();x+=(viewport.clientWidth-width)/2;y+=(viewport.clientHeight-height)/2;width=viewport.clientWidth;height=viewport.clientHeight;baseTile=parseFloat(getComputedStyle(viewport).getPropertyValue('--tile'))||72;paint();}
 const observer=new ResizeObserver(refresh);observer.observe(viewport);
 scope.onPause(stop);scope.cleanup(()=>observer.disconnect());
 return {center,follow,stop,refresh,suppressClick:()=>performance.now()<suppressClickUntil};
}
