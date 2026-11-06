// One reusable offscreen WebGL2 surface for every ice tile; no per-card contexts.
const vertex=`#version 300 es
in vec2 a;out vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 color;uniform float time;uniform float seed;uniform float cracked;
uniform int mode;uniform float amount;uniform sampler2D sprite;
vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)))+seed)*43758.5453);}
vec3 cells(vec2 p){vec2 n=floor(p),f=fract(p);float d1=9.,d2=9.;vec2 id=vec2(0.);
for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j)),o=hash(n+g),r=g+o-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+g;}else d2=min(d2,d);}
return vec3(sqrt(d1),sqrt(d2)-sqrt(d1),hash(id).x);}
float fbmIce(vec2 p){return cells(p).z*.6+cells(p*2.1).z*.4;}
void main(){
vec2 p=uv+vec2(seed*.013,seed*.027);vec3 c=cells(p*4.2),fine=cells(p*13.);
float vein=1.-smoothstep(.006,.035,c.y),hair=1.-smoothstep(.002,.012,fine.y);
float sweep=exp(-pow((uv.x*.8+uv.y*.56-fract(time*.075+seed*.13)*1.8+.3)/.12,2.));
float glint=pow(max(0.,sin(c.z*35.+time*.65)),16.)*.25;
vec3 base=mix(vec3(.20,.44,.57),vec3(.68,.88,.92),c.z*.65+.22);
base+=vein*vec3(.18,.24,.25)+hair*.035+sweep*vec3(.2,.27,.29)+glint;
float fissure=(1.-smoothstep(.0,.018,c.y))*(.25+cracked*.65);
base=mix(base,vec3(.12,.27,.34),fissure*cracked);
float rim=1.-smoothstep(.0,.06,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
base+=rim*.18;float alpha=.30+vein*.32+hair*.14+sweep*.20+cracked*.04;
base+=pow(1.-c.x,6.)*.18;
if(mode==1){
 vec2 flow=uv+vec2(sin(uv.y*9.+time*.7),cos(uv.x*8.-time*.5))*amount*.027;
 vec3 lava=cells((flow+vec2(seed*.013,seed*.027))*4.2);
 float edge=1.-smoothstep(.006,.065,lava.y),halo=1.-smoothstep(.015,.27,lava.y);
 float front=smoothstep(.0,.60,amount);
 vec3 hot=mix(vec3(.90,.11,.012),vec3(1.,.92,.52),pow(edge,.7));
 base=mix(vec3(.12,.065,.045),hot,front);alpha=edge*(.38+amount*.62)+halo*amount*.47+amount*.18;
 base*=mix(1.,.92+.08*sin(time*2.+lava.z*12.),amount);
}
if(mode==2){
 vec4 original=texture(sprite,uv);float lum=dot(original.rgb,vec3(.2126,.7152,.0722));
 // Translucent ice replaces the material while preserving team luminance and alpha.
 vec2 facets=cells(uv*7.5+vec2(2.,3.)).yz;
 float veins=1.-smoothstep(.006,.035,facets.x);
 float striae=pow(.5+.5*sin(uv.x*87.+uv.y*39.+fbmIce(uv*6.)*7.),10.);
 float ribbon=exp(-pow((uv.x*.75+uv.y*.52-.7-sin(time*.4)*.55)/.085,2.));
 vec3 darkIce=vec3(.07,.24,.36),whiteIce=vec3(.66,.87,.95);
 vec3 ice=mix(darkIce,whiteIce,smoothstep(.12,.88,lum));
 ice+=vec3(.10,.18,.22)*facets.y+vec3(.30,.36,.40)*veins*.65;
 ice+=vec3(.15,.23,.28)*(striae*.35+ribbon*.70);
 base=mix(original.rgb,ice,.88);alpha=original.a;
}
color=vec4(base,alpha);
}`;
export function createIceShader(){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true,depth:false});
 if(!gl)return null;
 const shaders=[];let program;
 try{
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));}
  program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 }catch(error){shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);console.warn('Ice shader unavailable',error);gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
 shaders.forEach(s=>gl.deleteShader(s));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['time','seed','cracked','mode','amount','sprite'].map(k=>[k,gl.getUniformLocation(program,k)])),textures=new WeakMap(),createdTextures=new Set();
 // A complete sampler is required even in branches that do not sample it.
 const dummy=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,dummy);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 function render(ctx,x,y,u,time,seed,cracked,mode=0,amount=0,img=null){
  if(gl.isContextLost())return false;
  // Large world hashes destroy fract()/Voronoi precision on float32 GPUs.
  seed=((Number(seed)||0)%1021+1021)%1021;
  const pixels=Math.min(384,Math.max(64,Math.ceil(u*ctx.getTransform().a)));
  if(canvas.width!==pixels){canvas.width=canvas.height=pixels;gl.viewport(0,0,pixels,pixels);}
  if(img){let texture=textures.get(img);if(!texture){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);textures.set(img,texture);createdTextures.add(texture);}gl.bindTexture(gl.TEXTURE_2D,texture);}
  gl.uniform1i(uniforms.sprite,0);gl.uniform1i(uniforms.mode,mode);gl.uniform1f(uniforms.amount,amount);gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.seed,seed);gl.uniform1f(uniforms.cracked,cracked?1:0);gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(canvas,x,y,u,u);return true;
 }
 return {dispose(){for(const texture of createdTextures)gl.deleteTexture(texture);createdTextures.clear();gl.deleteTexture(dummy);gl.deleteBuffer(buffer);gl.deleteProgram(program);},draw:(...args)=>render(...args),heat:(ctx,x,y,u,t,seed,amount)=>render(ctx,x,y,u,t,seed,false,1,amount),frozen:(ctx,x,y,u,t,img)=>render(ctx,x,y,u,t,19,false,2,0,img)};
}
