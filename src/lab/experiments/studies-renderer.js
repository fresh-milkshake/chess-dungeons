import {studyVertex,studyFragment} from './studies-source.js';
import {studyVertex as savedVertex,studyFragment as savedFragment} from './saved-jade-source.js';
import {studyVertex as graniteVertex,studyFragment as graniteFragment} from './saved-granite-source.js';

/** One viewport-sized transparent canvas for every board and wall swatch. */
export function createStudyRenderer(canvas,slots,panel,onStatus,actEffects){
 const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});
 if(!gl)throw new Error('Образцам материалов нужен WebGL2.');
 let program,uniforms,savedProgram,savedUniforms,graniteProgram,graniteUniforms,frame=0,previous=0,elapsed=0,lastDraw=0,lost=false,disposed=false;
 let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const visible=new Set(),impacts=new Map(),colors=new Map();
 const rgb=hex=>{if(!colors.has(hex))colors.set(hex,[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255));return colors.get(hex);};
 function pipeline(vertex,fragment){
  const shaders=[];
  const result=gl.createProgram();
  try{
   for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(result,shader);
   }
   gl.linkProgram(result);if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(result));
   const locations=Object.fromEntries(['kinds','darkA','darkB','lightA','lightB','scales','polishes','time','effectAge','wall','spectral','world','variation','necropolis'].map(k=>[k,gl.getUniformLocation(result,k)]));
   return {program:result,uniforms:locations};
  }catch(error){gl.deleteProgram(result);throw error;}finally{shaders.forEach(s=>gl.deleteShader(s));}
 }
 function initialize(){
  try{
   ({program,uniforms}=pipeline(studyVertex,studyFragment));
   ({program:savedProgram,uniforms:savedUniforms}=pipeline(savedVertex,savedFragment));
   ({program:graniteProgram,uniforms:graniteUniforms}=pipeline(graniteVertex,graniteFragment));
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);canvas.dataset.program='linked';
  }catch(error){if(program)gl.deleteProgram(program);throw error;}
 }
 initialize();
 function draw(now){
  frame=0;if(disposed||lost)return;
  const active=!panel.hidden&&!document.hidden&&visible.size>0;
  canvas.hidden=!active;
  if(!active){previous=0;return;}
  if(!paused&&previous)elapsed+=Math.min((now-previous)/1000,.08);previous=now;
  if(now-lastDraw<32){frame=requestAnimationFrame(draw);return;}lastDraw=now;
  const rect=canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio,1.25,1800/rect.width);
  const width=Math.max(1,Math.round(rect.width*scale)),height=Math.max(1,Math.round(rect.height*scale));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  gl.disable(gl.SCISSOR_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);gl.enable(gl.SCISSOR_TEST);gl.uniform1f(uniforms.time,elapsed);
  let animated=false;
  for(const slot of slots){
   if(!visible.has(slot.element))continue;
   const box=slot.element.getBoundingClientRect();
   if(box.bottom<=0||box.top>=rect.height||box.right<=0||box.left>=rect.width)continue;
   const x=Math.round((box.left-rect.left)*scale),y=Math.round((rect.bottom-box.bottom)*scale);
   const w=Math.max(1,Math.round(box.width*scale)),h=Math.max(1,Math.round(box.height*scale));
   const left=Math.max(0,x),bottom=Math.max(0,y),right=Math.min(width,x+w),top=Math.min(height,y+h);
   if(right<=left||top<=bottom)continue;
   gl.viewport(x,y,w,h);gl.scissor(left,bottom,right-left,top-bottom);
   const a=slot.wall?slot.sample.wall:slot.sample.dark,b=slot.wall?a:slot.sample.light;
   const granite=slot.saved&&slot.sample.shader==='saved-granite-source.js';
   const locations=granite?graniteUniforms:slot.saved?savedUniforms:uniforms;
   gl.useProgram(granite?graniteProgram:slot.saved?savedProgram:program);gl.uniform1f(locations.time,elapsed);
   gl.uniform2i(locations.kinds,a.kind,b.kind);
   gl.uniform3fv(locations.darkA,rgb(a.a));gl.uniform3fv(locations.darkB,rgb(a.b));
   gl.uniform3fv(locations.lightA,rgb(b.a));gl.uniform3fv(locations.lightB,rgb(b.b));
   gl.uniform2f(locations.scales,a.scale,b.scale);gl.uniform2f(locations.polishes,a.polish,b.polish);
   const age=impacts.has(slot.sample.id)?elapsed-impacts.get(slot.sample.id):-1;
   gl.uniform1f(locations.effectAge,age);gl.uniform1i(locations.wall,slot.wall?1:0);gl.uniform1i(locations.spectral,slot.spectral?1:0);
   gl.uniform1i(locations.world,slot.world??-1);gl.uniform1i(locations.variation,slot.variation??0);
   gl.uniform1i(locations.necropolis,slot.biome==='crypt'?1:0);
   gl.drawArrays(gl.TRIANGLES,0,3);
   animated||=slot.spectral||(slot.world??-1)>=0||age>=0&&age<2.4;
  }
  gl.disable(gl.SCISSOR_TEST);
  animated=actEffects?.draw(elapsed,visible,impacts)||animated;
  canvas.dataset.visible=String(visible.size);
  if(!paused&&animated)frame=requestAnimationFrame(draw);
 }
 function wake(){if(disposed||lost)return;previous=0;lastDraw=0;if(!frame)frame=requestAnimationFrame(draw);}
 const intersection=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);
  wake();
 });
 slots.forEach(s=>intersection.observe(s.element));
 const mutation=new MutationObserver(wake);mutation.observe(panel,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',wake);document.addEventListener('visibilitychange',wake);
 const resize=new ResizeObserver(wake);slots.forEach(s=>resize.observe(s.element));
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;canvas.hidden=true;canvas.dataset.program='lost';onStatus('GPU-контекст образцов потерян. Ожидаем восстановления…');});
 canvas.addEventListener('webglcontextrestored',()=>{try{initialize();lost=false;onStatus('');wake();}catch(error){onStatus(error.message);}});
 wake();
 return {
  refresh:wake,
  replay(id){impacts.set(id,elapsed);wake();},
  pause(value){paused=value;wake();},
  get paused(){return paused;},
  dispose(){disposed=true;cancelAnimationFrame(frame);intersection.disconnect();resize.disconnect();mutation.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',wake);document.removeEventListener('visibilitychange',wake);actEffects?.dispose();gl.deleteProgram(program);gl.deleteProgram(savedProgram);gl.deleteProgram(graniteProgram);canvas.remove();},
 };
}
