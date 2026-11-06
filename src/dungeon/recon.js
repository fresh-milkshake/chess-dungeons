import {boardOutline,outlineMask} from '../biomes/board-outline.js';
import {vertexSource} from '../lab/shaders/source.js';
import {fogFragment} from '../fog/shader.js';
import {preparationVision,preparationKnowledge} from './recon-vision.js';
import {parsePosition} from '../lab/scenarios.js';
import {pieceImage} from '../piece-sets.js';
import './recon.css';

const fragment=fogFragment.replace('void main(){',`
// Deform the visibility mask, not the board or sprite UVs. Continuous noise
// keeps the boundary irregular without per-frame random jumps or mask uploads.
float preparationFog(vec2 at){
 float x=at.x*worldSize.x,t=time*.60;
 // Independent motion on both noise axes makes banks grow and dissolve,
 // rather than merely sliding a fixed contour sideways.
 float drift=noise(vec2(x*.63+t*.22,23.7+t*.38))-.5;
 float banks=noise(vec2(x*1.35+drift*.7-t*.35,61.3+t*.54))-.5;
 float wisps=noise(vec2(x*2.8+t*.48,9.4-t*.65))-.5;
 float offset=drift*.45+banks*.21+wisps*.065;
 return texture(knowledge,vec2(at.x,at.y-offset/worldSize.y)).r;
}
void mapFog(){`).replace('texture(knowledge,p/maskSize).r','preparationFog(uv)')+`
uniform sampler2D scene;uniform bool mirage;uniform float edge;
void main(){
 mapFog();
 if(!mirage)return;
 vec2 p=uv*worldSize;
 float cover=1.-smoothstep(edge-.028,edge+.028,uv.y);
 if(cover<.001)return;
 float t=time*.37;
 vec2 flow=vec2(cloud(p*.82+vec2(t,-t*.28)),cloud(p*.94+vec2(-t*.35,t)))-.5;
 vec2 bend=vec2(flow.x*.027+sin(p.y*3.6+t*2.1)*.003,flow.y*.009)*cover;
 vec2 at=clamp(uv+bend,vec2(.001),vec2(.999));
 // Only alpha from ordinary Neo sprites enters this texture. Materials,
 // strength badges, board colours and sprite RGB cannot leak through the fog.
 vec2 stepUV=vec2(.022)/worldSize;
 float outer=0.,inner=1.;
 for(int i=0;i<8;i++){
  float angle=float(i)*.78539816;
  float a=texture(scene,at+vec2(cos(angle),sin(angle))*stepUV).a;
  outer=max(outer,a);inner=min(inner,a);
 }
 float ring=clamp(outer-inner,0.,1.);
 float vapor=cloud(p*2.1+flow+vec2(t*.4,-t*.7));
 float alpha=ring*cover*(.38+.30*vapor);
 vec3 tint=mix(vec3(.43,.62,.66),vec3(.83,.9,.89),vapor);
 float combined=alpha+fragColor.a*(1.-alpha);
 fragColor=vec4((tint*alpha+fragColor.rgb*fragColor.a*(1.-alpha))/max(combined,.001),combined);
}`;

/** One overlay shared by all enemy squares. The board is transferred cleanly
 * to battle; no visibility rules, engine state or enemy positions are changed. */
export function setupPreparationRecon({board,scope}){
 const arena=board.parentElement,canvas=document.createElement('canvas');canvas.className='preparation-recon';canvas.setAttribute('aria-hidden','true');arena.append(canvas);
 const scene=document.createElement('canvas'),ctx=scene.getContext('2d');
 let gl,program,locations,maskTexture,sceneTexture,vision,bounds,frame=0,last=0,time=0,width=0,height=0,disposed=false,failed=false,dirty=true,key='',sources=[],lastConfig;
 const images=new Map();
 function silhouette(piece){
  const url=pieceImage({type:piece.type,color:piece.color},'neo',import.meta.env.BASE_URL);
  if(!images.has(url)){
   const img=new Image();img.onload=()=>{if(!disposed){dirty=true;start();}};img.src=url;images.set(url,img);
  }
  return images.get(url);
 }
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){cancelAnimationFrame(frame);frame=0;}
 function fallback(){if(disposed)return;failed=true;stop();canvas.hidden=true;arena.classList.add('recon-fallback');}
 function initialize(){
  try{
   gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});if(!gl)throw Error('WebGL2 unavailable');
   program=gl.createProgram();
   for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   locations=Object.fromEntries(['knowledge','time','variant','worldOrigin','worldSize','maskSize','boardTint','patternOffset','scene','mirage','edge'].map(n=>[n,gl.getUniformLocation(program,n)]));
   function texture(unit){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);return t;}
   maskTexture=texture(0);sceneTexture=texture(1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
   gl.uniform1i(locations.knowledge,0);gl.uniform1i(locations.scene,1);gl.uniform1i(locations.variant,1);gl.uniform2f(locations.worldOrigin,0,0);gl.uniform2f(locations.patternOffset,37.2,19.4);gl.uniform3f(locations.boardTint,211.5/255,176.5/255,137/255);
   canvas.dataset.shaderStatus='running';
  }catch(error){console.warn('Разведка: статичный режим',error);fallback();}
 }
 initialize();
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
 function resize(){
  if(failed||!width||!height)return;
  const scale=Math.min(devicePixelRatio||1,2,2048/Math.max(width,height)),w=Math.round(width*scale),h=Math.round(height*scale);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;scene.width=w;scene.height=h;gl.viewport(0,0,w,h);dirty=true;start();}
 }
 const observer=new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;resize();});observer.observe(board);
 scope.on(window,'resize',resize);
 function paintScene(){
  if(!vision)return;
  const tileX=scene.width/vision.columns,tileY=scene.height/vision.rows;
  ctx.clearRect(0,0,scene.width,scene.height);
  for(const {square,sprite} of sources){
   const col=square.charCodeAt(0)-97-bounds.left,row=bounds.top-Number(square.slice(1));
   if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,(col+.06)*tileX,(row+.06)*tileY,tileX*.88,tileY*.88);
  }
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);
  dirty=false;
 }
 function tick(now){
  frame=0;if(!scope.active||disposed||document.hidden||failed||!vision||!width||!height)return;
  if(now-last>=1000/24||dirty||reduced.matches){
   if(!reduced.matches)time+=Math.min((now-last)/1000,.1);last=now;
   if(vision.mode==='mirage'&&dirty)paintScene();
   if(vision.mode==='fog')dirty=false;
   gl.uniform1f(locations.time,reduced.matches?0:time);gl.drawArrays(gl.TRIANGLES,0,3);
   canvas.dataset.frames=String(Number(canvas.dataset.frames??0)+1);canvas.dataset.mode=vision.mode;
  }
  if(!reduced.matches||dirty)frame=requestAnimationFrame(tick);
 }
 function start(){if(!frame&&scope.active&&!disposed&&!document.hidden&&!failed&&vision)frame=requestAnimationFrame(tick);}
 scope.on(board,'load',()=>{dirty=true;start();},{capture:true});scope.on(document,'visibilitychange',()=>document.hidden?stop():start());scope.on(reduced,'change',()=>{stop();start();});
 function clear(){stop();canvas.hidden=true;arena.classList.remove('recon-active','recon-fog','recon-mirage','recon-fallback');for(const cell of board.querySelectorAll('.preparation-obscured')){cell.classList.remove('preparation-obscured');cell.removeAttribute('title');}}
 scope.onPause(clear);scope.onResume(()=>{if(lastConfig)update(lastConfig);});
 scope.cleanup(()=>{disposed=true;clear();observer.disconnect();if(gl){gl.deleteTexture(maskTexture);gl.deleteTexture(sceneTexture);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}canvas.remove();});
 function update(config){
  lastConfig=config;bounds=config.bounds;vision=preparationVision(bounds,config.owned);
  const terrain=parsePosition(config.fen).pieces.world,holes=new Set(Object.entries(terrain?.tiles??{}).filter(([,t])=>t==='hole').map(([s])=>s));
  canvas.style.clipPath='';canvas.style.maskImage=holes.size||config.bounds.cutouts?.length?outlineMask(boardOutline(config.bounds,holes)):'';canvas.style.maskSize='100% 100%';
  canvas.hidden=failed;arena.classList.add('recon-active');arena.classList.toggle('recon-fog',vision.mode==='fog');arena.classList.toggle('recon-mirage',vision.mode==='mirage');arena.classList.toggle('recon-fallback',failed);arena.style.setProperty('--recon-edge',vision.edge);
  arena.style.setProperty('--recon-fade',1/vision.rows);
  const next=[],pieces=parsePosition(config.fen).pieces,names={k:'Король',q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь',p:'Пешка'};
  for(const cell of board.querySelectorAll('[data-square]')){
   const square=cell.dataset.square,hidden=vision.hidden.has(square);cell.classList.toggle('preparation-obscured',hidden);
   if(hidden){
    const piece=pieces.get(square),visible=vision.mode==='mirage'&&piece&&piece.color!=='w';
    const label=visible?`Мираж: ${names[piece.type]}`:'Туман войны';
    cell.setAttribute('aria-label',`${square} · ${label}`);cell.title=label;
    if(visible)next.push({square,sprite:silhouette(piece)});
   }
  }
  const changed=sources.length!==next.length||next.some((s,i)=>s.sprite!==sources[i]?.sprite);sources=next;
  if(failed)return;
  const newKey=config.fen+'|'+vision.mode;
  if(key!==newKey){key=newKey;dirty=true;
   const data=preparationKnowledge(vision);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,2,256,0,gl.RED,gl.UNSIGNED_BYTE,data);
   gl.uniform2f(locations.worldSize,vision.columns,vision.rows);gl.uniform2f(locations.maskSize,vision.columns,vision.rows);gl.uniform1i(locations.mirage,vision.mode==='mirage');gl.uniform1f(locations.edge,vision.edge);
  }
  if(changed)dirty=true;start();
 }
 return {update};
}
