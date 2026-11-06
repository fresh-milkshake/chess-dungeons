import {artifactImage} from './catalog.js';
import {rarityOf,rarityInfo} from './rarity.js';
import './icon-effects.css';
const entries=new Set(),textures=new Map();let gl,program,canvas,locations,failed=false,last=0,request=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const vertex=`#version 300 es
in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 outColor;uniform sampler2D sprite;uniform vec3 rarityColor,lightColor;uniform float time,glowStrength,legend;
float alphaAt(vec2 p){if(any(lessThan(p,vec2(0.)))||any(greaterThan(p,vec2(1.))))return 0.;return texture(sprite,p).a;}
void main(){
 vec2 p=(uv-.5)*1.8+.5;float a=alphaAt(p),edge=0.;
 for(int i=0;i<12;i++){float angle=float(i)*6.2831853/12.;edge=max(edge,alphaAt(p+vec2(cos(angle),sin(angle))*.027));}
 float outline=max(0.,edge-a);float shimmer=.85+legend*.15*sin(time*1.6+p.y*7.-p.x*4.);
 vec2 d=uv-.5;float radius=length(d),angle=atan(d.y,d.x);
 float rays=pow(.5+.5*sin(angle*13.+sin(angle*5.-time*.35)*.65+time*.2),7.);
 float soft=exp(-radius*radius*12.);float glow=glowStrength*(.12*soft+.5*rays*soft)*(1.-a)*smoothstep(.51,.22,radius);
 float opacity=clamp(outline*.95+glow,0.,1.);if(opacity<.002)discard;
 vec3 border=mix(rarityColor,vec3(1.,.48,.12),legend*(.5+.5*sin(time*1.6+p.y*7.-p.x*4.))*.42);
 vec3 color=(border*shimmer*outline*.95+lightColor*glow)/max(.001,outline*.95+glow);outColor=vec4(color,opacity);
}`;
function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
function init(){
 if(gl||failed)return;
 try{canvas=document.createElement('canvas');canvas.width=canvas.height=160;gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 unavailable');
 program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 locations=Object.fromEntries(['sprite','rarityColor','lightColor','time','active','legend'].map(name=>[name,gl.getUniformLocation(program,name==='active'?'glowStrength':name)]));gl.uniform1i(locations.sprite,0);gl.viewport(0,0,160,160);
 }catch(error){failed=true;gl=null;console.warn('Эффекты реликвий:',error.message);}
}
function loadTexture(img,id){
 if(textures.has(id))return textures.get(id);
 const task=new Promise(resolve=>{const source=new Image();source.onload=()=>{
  const probe=document.createElement('canvas');probe.width=probe.height=24;const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,24,24);const pixels=ctx.getImageData(0,0,24,24).data;let r=0,g=0,b=0,weight=0;
  for(let i=0;i<pixels.length;i+=4){const w=pixels[i+3]/255;if(w<.15)continue;r+=pixels[i]*w;g+=pixels[i+1]*w;b+=pixels[i+2]*w;weight+=w;}
  const color=[r,g,b].map(v=>Math.min(1,.1+v/Math.max(1,weight)/255));init();let texture;
  if(gl){const mask=document.createElement('canvas');mask.width=mask.height=128;const scale=128/Math.max(source.naturalWidth,source.naturalHeight),w=source.naturalWidth*scale,h=source.naturalHeight*scale;mask.getContext('2d').drawImage(source,(128-w)/2,(128-h)/2,w,h);texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
  resolve({texture,color});};source.onerror=()=>resolve(null);source.src=img.src||artifactImage(id,import.meta.env.BASE_URL);});textures.set(id,task);return task;
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
function tick(now){
 request=requestAnimationFrame(tick);if(document.hidden||now-last<50)return;last=now;
 for(const entry of entries){
  if(!entry.root.isConnected){if(entry.connected||now-entry.born>1000)entries.delete(entry);continue;}entry.connected=true;if(!entry.asset||!gl)continue;
  const box=entry.root.getBoundingClientRect();if(box.bottom<0||box.top>innerHeight||box.width===0)continue;
  const active=entry.root.closest('[data-artifact]')?.dataset.glowing==='true',legend=rarityOf(entry.id)==='legendary';if(entry.drawn&&!active&&!entry.wasActive&&!legend)continue;
  gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,entry.asset.texture);gl.uniform3fv(locations.rarityColor,rgb(rarityInfo(entry.id).color));gl.uniform3fv(locations.lightColor,entry.asset.color);gl.uniform1f(locations.time,reduced.matches?0:now*.001);gl.uniform1f(locations.active,active?1:0);gl.uniform1f(locations.legend,legend?1:0);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
  entry.ctx.clearRect(0,0,160,160);entry.ctx.drawImage(canvas,0,0);entry.drawn=true;entry.wasActive=active;
 }
}
export function artifactIcon(img,id){
 if(!img.getAttribute('width'))img.width=36;if(!img.getAttribute('height'))img.height=36;
 const root=document.createElement('span');root.className='relic-icon';root.dataset.rarity=rarityOf(id);root.style.setProperty('--rarity-color',rarityInfo(id).color);root.setAttribute('aria-label',rarityInfo(id).name+' · реликвия');
 if(img.width)root.style.width=img.width+'px';if(img.height)root.style.height=img.height+'px';
 const layer=document.createElement('canvas');layer.width=layer.height=160;layer.setAttribute('aria-hidden','true');layer.className='relic-icon-fx';root.append(layer,img);
 const entry={root,id,ctx:layer.getContext('2d'),connected:false,born:performance.now()};entries.add(entry);loadTexture(img,id).then(asset=>{entry.asset=asset;root.dataset.gpu=gl?'ready':'fallback';});if(!request)request=requestAnimationFrame(tick);return root;
}
