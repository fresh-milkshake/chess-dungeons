import {rank as squareRank,files} from '../battle/coordinates.js';
const vertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
uniform vec2 grid;uniform float time;uniform float marked[256];
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fog(vec2 p){return .65*noise(p)+.35*noise(p*2.03+7.1);}
void main(){
 vec2 cell=floor(uv*grid);int id=int(cell.y)*int(grid.x)+int(cell.x);
 if(id<0||id>=256||marked[id]<.5){color=vec4(0);return;}
 vec2 p=fract(uv*grid)-.5;float seed=hash(cell+3.)*19.;float t=time+seed;
 vec2 flow=vec2(noise(p*3.+vec2(t*.14,seed)),noise(p*3.+vec2(seed,-t*.12)))-.5;
 float cloud=fog(p*5.+flow*1.6+vec2(-t*.19,t*.13));
 float veil=fog(p*7.-flow*2.+vec2(t*.12,-t*.18));
 // The eye itself is made of smoke: warp lids, iris and pupil together,
 // rather than moving a haze texture behind a rigid pictogram.
 p+=flow*.105+vec2(veil-.5,cloud-.5)*.055;
 float x=abs(p.x)/.4,lid=.19*(1.-x*x);
 float window=1.-smoothstep(.98,1.05,x);
 float aa=max(fwidth(p.y),.002);
 float edge=abs(abs(p.y)-lid);
 float core=1.-smoothstep(.008-aa,.008+aa,edge);
 float plume=1.-smoothstep(.009,.052,edge);
 float outline=(core*.38+plume*.62)*window*(.48+.52*smoothstep(.22,.72,veil));
 float inner=(1.-smoothstep(lid-.01,lid+.01,abs(p.y)))*window;
 float iris=1.-smoothstep(.13-aa,.13+aa,length(p));
 float pupil=1.-smoothstep(.017-aa,.017+aa,abs(p.x)*(1.+abs(p.y)*12.));
 pupil*=1.-smoothstep(.09,.12,abs(p.y));
 float halo=exp(-dot(p/(vec2(.39,.25)),p/(vec2(.39,.25)))*2.);
 float wisps=smoothstep(.35,.72,cloud)*halo;
 float silk=pow(max(0.,1.-abs(veil-.51)*8.),3.)*inner;
 float alpha=outline*(.38+.19*cloud)+inner*.045+iris*(.17+.21*veil)*(1.-pupil*.82)+wisps*.22+silk*.14;
 vec3 tint=mix(vec3(.67,.10,.24),vec3(1.,.33,.34),cloud);
 tint=mix(tint,vec3(.85,.47,.65),silk*.32);
 alpha*=.86+.14*sin(time*.8+seed);
 color=vec4(tint,clamp(alpha,0.,.65));
}`;

// One small transparent render target for the whole board. No texture readback,
// DOM scans or layout reads on animation frames; work skips unmarked cells.
export function createEyeShader(board,scope){
 let canvas,gl,program,locations,frame=0,last=0,enabled=false,failed=false;
 let width=0,height=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function resize(){
  if(!gl||!canvas||failed||!width||!height)return;
  const dpr=Math.min(devicePixelRatio||1,2),scale=Math.min(dpr,2048/Math.max(width,height));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);start();}
 }
 const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;width=rect.width;height=rect.height;resize();});observer.observe(board);
 scope.on(window,'resize',resize);
 function stop(){cancelAnimationFrame(frame);frame=0;}
 function draw(now){
  frame=0;if(!enabled||!scope.active||document.hidden||failed)return;
  if(now-last>=1000/24||reduced.matches){last=now;gl.uniform1f(locations.time,reduced.matches?0:now/1000);gl.drawArrays(gl.TRIANGLES,0,3);}
  if(!reduced.matches)frame=requestAnimationFrame(draw);
 }
 function start(){if(enabled&&scope.active&&!document.hidden&&!failed&&!frame)frame=requestAnimationFrame(draw);}
 function initialize(){
  if(canvas||failed)return;
  try{
   canvas=document.createElement('canvas');canvas.className='artifact-eye-canvas';canvas.dataset.boardOverlay='eye';canvas.setAttribute('aria-hidden','true');
   gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});if(!gl)throw Error('WebGL2 unavailable');
   program=gl.createProgram();
   for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);}
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);locations=Object.fromEntries(['grid','time','marked[0]'].map(n=>[n,gl.getUniformLocation(program,n)]));
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;stop();canvas.hidden=true;board.classList.remove('artifact-eye-shader');});
   board.append(canvas);board.classList.add('artifact-eye-shader');canvas.dataset.shaderStatus='running';resize();
  }catch{failed=true;canvas?.remove();board.classList.remove('artifact-eye-shader');}
 }
 scope.on(document,'visibilitychange',()=>document.hidden?stop():start());
 scope.on(reduced,'change',()=>{stop();start();});scope.onPause(stop);scope.onResume(start);
 scope.cleanup(()=>{stop();observer.disconnect();if(gl){gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}canvas?.remove();board.classList.remove('artifact-eye-shader');});
 return {update(threats,bounds,flipped){
  enabled=!!threats?.size;
  if(!enabled){stop();if(canvas)canvas.hidden=true;return;}
  initialize();if(failed)return;
  canvas.hidden=false;const columns=bounds.right-bounds.left+1,rows=bounds.top-bounds.bottom+1;
  const marked=new Float32Array(256);
  for(const square of threats){const x=square.charCodeAt(0)-97,y=squareRank(square);marked[(flipped?y-bounds.bottom:bounds.top-y)*columns+(flipped?bounds.right-x:x-bounds.left)]=1;}
  gl.uniform2f(locations.grid,columns,rows);gl.uniform1fv(locations['marked[0]'],marked);start();
 }};
}
