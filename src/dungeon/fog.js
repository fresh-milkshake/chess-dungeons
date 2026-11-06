import {createScope} from '../app/scope.js';
import {createFogRenderer} from '../fog/renderer.js';
import {fogViewportSize,fogPatternOffset} from '../fog/knowledge.js';
import {smoothKnowledge,createMaskTransition,projectFogFrame} from '../fog/smooth-mask.js';
import './fog.css';
import {profile} from '../performance.js';
import {isShopping} from './merchants.js';

export function setupMapFog(viewport,board,{scope=createScope()}={}){
 const margin=96,canvas=document.createElement('canvas');canvas.className='map-fog';canvas.setAttribute('aria-hidden','true');viewport.append(canvas);
 let renderer;
 try{renderer=createFogRenderer(canvas);}catch(error){console.warn('Туман: статичный режим',error);}
 if(!renderer){canvas.remove();return {update(){}};}
 let enabled=false,last=0,time=0,frames=0,lost=false,dirty=true,capture=null,field=null,world=null,maskKey='';
 let camera={x:0,y:0,tile:72},width=0,height=0;
 let uploadedMask=null,maskDirty=true,request=0,wasMoving=false;
 const transition=createMaskTransition(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(pointer: coarse)');
 function align(){
  if(!capture)return;
  const p=projectFogFrame(capture,camera);
  canvas.style.transform=`translate(${p.x+margin}px,${p.y+margin}px) scale(${p.scale})`;
  // Redraw before a large jump can expose the edge of the oversized frame.
  if(p.x>0||p.y>0||p.x+width*p.scale<width-margin*2||p.y+height*p.scale<height-margin*2)dirty=true;
 }
 scope.on(viewport,'map-camera-change',event=>{camera=event.detail;align();if(dirty&&enabled&&field&&!lost&&!document.hidden)draw(performance.now());});
 function resize(){
  if(!scope.active||!viewport.clientWidth||!viewport.clientHeight)return;
  if(width===viewport.clientWidth+margin*2&&height===viewport.clientHeight+margin*2)return;
  width=viewport.clientWidth+margin*2;height=viewport.clientHeight+margin*2;
  const size=fogViewportSize(width,height);canvas.width=size.width;canvas.height=size.height;
  canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;capture=null;dirty=true;
 }
 const observer=new ResizeObserver(resize);observer.observe(viewport);scope.cleanup(()=>observer.disconnect());
 canvas.dataset.variant='F2';canvas.dataset.gpu='ready';
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;canvas.hidden=true;viewport.classList.remove('fog-active');canvas.dataset.gpu='lost';});
 function draw(now){
  const moving=transition.active(now);
  wasMoving=moving;
  if(!reduced.matches)time+=Math.min((now-last)/1000,.1);last=now;
  const mask=transition.sample(now);
  if(mask!==uploadedMask||moving||maskDirty){renderer.setMask(field.width,field.height,mask,world);uploadedMask=mask;maskDirty=false;}
  const origin=[(-margin-camera.x)/camera.tile,(-margin-camera.y)/camera.tile];
  renderer.draw(time,1,origin,[width/camera.tile,height/camera.tile]);
  capture={origin,tile:camera.tile};dirty=false;align();
  canvas.dataset.frames=String(++frames);canvas.dataset.time=time.toFixed(2);canvas.dataset.transition=String(moving);
 }
 function tick(now){
  request=requestAnimationFrame(tick);
  if(!scope.active||!enabled||document.hidden||lost||!field){last=now;return;}
  const moving=transition.active(now);
  const interval=moving?(touch.matches?1000/30:1000/60):(touch.matches?1000/15:50);
  if(dirty||wasMoving&&!moving||(moving||!reduced.matches)&&now-last>=interval)draw(now);
 }
 function resume(){resize();last=performance.now();dirty=true;request=requestAnimationFrame(tick);}
 resume();
 scope.onPause(()=>cancelAnimationFrame(request));scope.onResume(resume);
 return {update(run){
  enabled=!isShopping(run.stage);canvas.hidden=!enabled||lost;viewport.classList.toggle('fog-active',enabled&&!lost);
  if(!enabled)return;
  const id=`${run.id}:${run.act}:${run.floor}`,key=id+'|'+run.seen.join(';')+'|'+run.visible.join(';');
  if(key===maskKey)return;
  maskKey=key;world=[run.map.width,run.map.height];field=profile('map:fog-mask',()=>smoothKnowledge(...world,run.seen,run.visible));
  transition.set(field.data,performance.now()-(reduced.matches?240:0),id);dirty=true;maskDirty=true;
  renderer.setOffset(fogPatternOffset(run.seed,run.act,run.floor));
 }};
}
