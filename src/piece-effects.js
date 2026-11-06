import {createIceShader} from './lab/acts/ice-shader.js';
import {pieceImage,pieceMaterial} from './piece-sets.js';
import {approvedEffects,variants} from './lab/shaders/variants.js';
import {vertexSource,fragmentSource} from './lab/shaders/source.js';

export function effectsForPiece(piece){
 if(piece.emperor)return [{...variants.find(v=>v.id==='I1'),intensity:1},...(piece.cursed?[{...variants.find(v=>v.id==='C5'),intensity:1}]:[])];
 if(piece.cursed&&piece.type.toLowerCase()==='k')return [{...variants.find(v=>v.id==='C5'),intensity:1}];
 if(piece.type.toLowerCase()==='k')return [];
 if(piece.iced)return [{id:'ICE',group:'ice',category:4,index:5,intensity:1},...(piece.cursed?[{...variants.find(v=>v.id==='C5'),intensity:1}]:piece.damage>1?[{...variants.find(v=>v.id==='P5'),intensity:1.75}]:[])];
 if(piece.cursed)return [{...variants.find(v=>v.id==='C5'),intensity:1}];
 const material=piece.color==='wild'||piece.wild?null:pieceMaterial(piece),groups=[];
 if(material==='diamond'||material==='ethereal')groups.push(material);
 if(piece.damage>1)groups.push('power');
 return groups.map(group=>({...variants.find(v=>v.id===approvedEffects[group].id),intensity:approvedEffects[group].intensity}));
}

// One GPU context, shared sprite batches; ordinary DOM canvases retain native
// stacking, fog, clipping, pointer handling and the existing move animations.
const sprites=new Set(),textures=new Map();
let iceShader;
let gpu,gl,program,uniforms,request=0,last=0,time=0,failed=false;
const combinedFragment=fragmentSource.replace('void main(){','void materialMain(){')+`
uniform bool powerLayer;
void main(){
 materialMain();
 if(powerLayer && fragColor.a>.001){
  vec2 flow=vec2(fbm(uv*4.0+vec2(time*.23,0)),fbm(uv*4.0-vec2(0,time*.29)));
  float mist=fbm(uv*8.0+flow*2.7+vec2(-time*.32,time*.26));
  float drifting=smoothstep(.3,.72,mist);
  vec3 tint=mix(vec3(.9,.12,.24),vec3(1.0,.37,.3),smoothstep(.35,.68,mist));
  vec3 color=fragColor.rgb/fragColor.a;
  color=mix(color,tint,drifting*.25*1.75)+vec3(pow(drifting,3.0)*.018*1.75);
  fragColor.rgb=clamp(color,0.0,1.0)*fragColor.a;
 }
}`;
function initialize(){
 if(gl||failed)return;
 try{
  gpu=document.createElement('canvas');
  gl=gpu.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});
  if(!gl)throw Error('WebGL2 unavailable');
  program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,combinedFragment]]){
   const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
   gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  uniforms=Object.fromEntries(['sprite','time','effectAge','intensity','category','variant','powerLayer'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gpu.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;gl=null;for(const s of sprites)s.dirty=true;});
  gpu.addEventListener('webglcontextrestored',()=>{failed=false;textures.forEach(t=>t.texture=null);initialize();for(const s of sprites)s.dirty=true;});
 }catch{failed=true;gl=null;}
}
function texture(url){
 if(textures.has(url))return textures.get(url);
 const entry={image:new Image(),loaded:false,texture:null};textures.set(url,entry);
 entry.image.onload=()=>{
  const image=entry.image;if(image.width!==image.height){const source=document.createElement('canvas'),side=Math.min(1024,Math.max(image.width,image.height)),scale=side/Math.max(image.width,image.height);source.width=source.height=side;const ctx=source.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,(side-image.width*scale)/2,(side-image.height*scale)/2,image.width*scale,image.height*scale);entry.image=source;}
  entry.loaded=true;for(const s of sprites)if(s.url===url)s.dirty=true;
 };
 entry.image.src=url;return entry;
}
function upload(entry){
 if(entry.texture)return entry.texture;
 const image=entry.image,source=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(image.width,image.height));
 source.width=Math.round(image.width*scale);source.height=Math.round(image.height*scale);
 const ctx=source.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,source.width,source.height);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);
 return entry.texture=t;
}
function tick(now){
 request=0;
 if(now-last>=1000/30&&!document.hidden){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced)time+=Math.min((now-last)/1000,.1);last=now;
  const batches=new Map();
  for(const s of sprites){
   if(!s.canvas.isConnected){sprites.delete(s);continue;}
   const rect=s.canvas.getBoundingClientRect();
   if(!s.entry.loaded||!rect.width||!rect.height||rect.right<0||rect.left>innerWidth||rect.bottom<0||rect.top>innerHeight)continue;
   const size=Math.max(32,Math.min(1024,Math.ceil(Math.max(rect.width,rect.height)*Math.min(devicePixelRatio||1,2))));
   const key=JSON.stringify([s.url,s.effects.map(e=>e.id),size]);
   s.appearedAt??=time;
   if(!batches.has(key))batches.set(key,{size,sprites:[]});batches.get(key).sprites.push(s);
  }
  for(const {size,sprites:batch} of batches.values()){
   if(reduced&&batch.every(s=>!s.dirty&&s.canvas.width===size))continue;
   const first=batch[0],effect=first.effects[0].id==='ICE'&&first.effects.length>1?first.effects.at(-1):first.effects[0];
   if(gl){
    gpu.width=size;gpu.height=size;gl.viewport(0,0,size,size);gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D,upload(first.entry));gl.uniform1i(uniforms.sprite,0);
    gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.intensity,effect.intensity);
    gl.uniform1f(uniforms.effectAge,reduced?1000:time-first.appearedAt);
    gl.uniform1i(uniforms.category,effect.category);gl.uniform1i(uniforms.variant,effect.index);
    gl.uniform1i(uniforms.powerLayer,first.effects.length>1&&first.effects[0].id!=='ICE'?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
   }
   for(const s of batch){
    const canvas=s.canvas;if(canvas.width!==size){canvas.width=size;canvas.height=size;}
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);
    if(first.effects[0].id==='ICE'){if(iceShader===undefined)iceShader=createIceShader();if(!iceShader?.frozen(ctx,0,0,size,time,s.entry.image))ctx.drawImage(s.entry.image,0,0,size,size);if(first.effects.length>1&&gl){ctx.globalAlpha=.4;ctx.drawImage(gpu,0,0,size,size);ctx.globalAlpha=1;}}
    else ctx.drawImage(gl?gpu:s.entry.image,0,0,size,size);
    s.dirty=false;canvas.dataset.shaderStatus=gl?'running':'fallback';canvas.dataset.phase=time.toFixed(3);
   }
  }
  // Retain a bounded working set of textures across page transitions and edits.
  if(textures.size>48){const used=new Set([...sprites].map(s=>s.url));for(const [url,t] of textures)if(!used.has(url)){if(gl&&t.texture)gl.deleteTexture(t.texture);textures.delete(url);}}
 }
 if(sprites.size)request=requestAnimationFrame(tick);
}
export function createPieceSprite(piece,url=pieceImage(piece,'neo',import.meta.env?.BASE_URL??'/')){
 const effects=effectsForPiece(piece);
 if(!effects.length){const img=document.createElement('img');img.src=url;img.alt='';img.draggable=false;img.style.objectFit='contain';return img;}
 initialize();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.className='piece-shader';canvas.setAttribute('aria-hidden','true');
 canvas.dataset.shader=effects.map(e=>e.id).join('+');canvas.dataset.shaderStatus='loading';
 const entry=texture(url),previous=[...sprites].find(s=>s.url===url&&s.canvas.dataset.shader===canvas.dataset.shader&&s.canvas.dataset.shaderStatus!=='loading');
 // A board refresh must not blank a moving sprite until the next GPU frame.
 if(previous)canvas.getContext('2d').drawImage(previous.canvas,0,0,128,128);
 else if(entry.loaded)canvas.getContext('2d').drawImage(entry.image,0,0,128,128);
 sprites.add({canvas,url,effects,entry,dirty:true});if(!request)request=requestAnimationFrame(tick);
 return canvas;
}
