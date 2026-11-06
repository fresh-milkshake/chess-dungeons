import {studyVertex,studyFragment} from '../experiments/studies-source.js';
import {phenomenaSource} from '../experiments/phenomena-source.js';
import {studyFragment as jadeFragment} from '../experiments/saved-jade-source.js';
import {studyFragment as graniteFragment} from '../experiments/saved-granite-source.js';
import {selectedMaterials} from './selected-materials.js';

const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const vec=hex=>rgb(hex).map(c=>c/255);
// Compile only the static material recipes, without the 25 experimental worlds.
const materialFragment=studyFragment.replace(phenomenaSource,'').replace('uniform int necropolis;','uniform int necropolis;uniform int marble;uniform vec3 marbleBase,marbleGreen;').replace('if(world>=0)c=newWorldMatter(p*2.,checker,world,variation,time,reaction,c);','').replace('fragColor=vec4(pow(c,vec3(.88)),1.);',`
 if(wall==1&&marble==1){
  vec2 p=uv*vec2(4.,5.);vec2 flow=p+vec2(fbm(p*.9),fbm(p*.7+10.))*2.2;
  float ridge=abs(fbm(flow*1.7)-.48);
  float vein=1.-smoothstep(.006,.034,ridge);
  float halo=1.-smoothstep(.02,.11,ridge);
  float inclusion=smoothstep(.55,.67,fbm(flow*2.3+13.));
  float mineral=max(inclusion,vein*smoothstep(.42,.65,fbm(flow*.8+4.))*.62);
  c=marbleBase+vec3(.04)-vec3(.11,.10,.08)*vein-vec3(.025,.024,.020)*halo;
  c=mix(c,marbleGreen*(.9+fbm(flow*12.)*.2),mineral*.86);
  c+=(fbm(flow*10.)-.5)*.035;fragColor=vec4(c,1.);
 }else fragColor=vec4(pow(c,vec3(.88)),1.);`);
const fogFragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 fragColor;
uniform float time;uniform int biome;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.03+6.2;a*=.5;}return n;}
void main(){
 vec2 drift=vec2(time*.025,-time*.012),p=uv*5.;
 float n=fbm(p+drift),wisps=fbm(p*2.+vec2(n*2.)-drift);
 float edge=uv.x*.72+(1.-uv.y)*.58-.76;
 float cover=smoothstep(-.075,.12,edge+(n-.5)*.14);
 vec3 low,high;float body;
 if(biome==0){low=vec3(.075,.13,.10);high=vec3(.33,.40,.24);body=fbm(p*.8+vec2(n,0.)+drift);}
 else if(biome==1){low=vec3(.085,.077,.071);high=vec3(.28,.25,.22);body=fbm(p*vec2(.6,2.4)+vec2(wisps,time*.04));}
 else if(biome==2){low=vec3(.16,.25,.30);high=vec3(.68,.80,.81);body=fbm(p*vec2(.45,3.)+vec2(time*.16,n));}
 else if(biome==3){low=vec3(.025,.045,.044);high=vec3(.21,.28,.25);body=pow(fbm(p*vec2(1.4,.55)+vec2(n,-time*.018)),1.6);}
 else if(biome==4){low=vec3(.17,.21,.22);high=vec3(.48,.53,.51);body=fbm(p*.55+vec2(time*.006,0.));}
 else {low=vec3(.08,.17,.15);high=vec3(.53,.51,.34);body=fbm(p*.8+vec2(wisps*.9,time*.015));}
 vec3 color=mix(low,high,body);
 float alpha=cover*mix(.88,1.,smoothstep(.06,.20,edge));
 fragColor=vec4(color,alpha);
}`;

/** One small GL context; static tiles are baked once, only visible fog animates. */
export function createAtlasMaterials(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
 const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const programs=[];
 function program(fragment){
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const v=shader(gl.VERTEX_SHADER,studyVertex),f=shader(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  programs.push(p);return p;
 }
 let recipe,jade,granite,fog;
 try{recipe=program(materialFragment);jade=program(jadeFragment);granite=program(graniteFragment);fog=program(fogFragment);}catch(error){for(const p of programs)gl.deleteProgram(p);console.error('Atlas shaders',error);return null;}
 const u=(p,name)=>gl.getUniformLocation(p,name),cache=new Map();
 function configure(p,s,wall=false){
  gl.useProgram(p);const a=wall?s.wall:s.dark,b=wall?s.wall:s.light;
  gl.uniform2i(u(p,'kinds'),a.kind,b.kind);
  for(const [key,value] of Object.entries({darkA:a.a,darkB:a.b,lightA:b.a,lightB:b.b}))gl.uniform3fv(u(p,key),vec(value));
  gl.uniform2f(u(p,'scales'),a.scale,b.scale);gl.uniform2f(u(p,'polishes'),a.polish,b.polish);
  for(const [key,value] of Object.entries({wall:Number(wall),spectral:0,world:-1,necropolis:0}))gl.uniform1i(u(p,key),value);
  gl.uniform1i(u(p,'marble'),Number(wall&&s.wallMarble===true));
  gl.uniform1f(u(p,'time'),0);gl.uniform1f(u(p,'effectAge'),-1);
 }
 function render(){gl.viewport(0,0,384,384);gl.drawArrays(gl.TRIANGLES,0,3);}
 function tile(x,y,s,dark,wall){
  const out=document.createElement('canvas');out.width=out.height=192;const ctx=out.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(canvas,x,y,192,192,0,0,192,192);
  const strength=wall?1:(s.strength?.[dark?0:1]??1),target=!wall&&s.recolor?rgb(dark?s.recolor.dark:s.recolor.light):null;
  if(strength!==1||target){
   const pixels=ctx.getImageData(0,0,192,192),data=pixels.data,mean=[0,0,0];
   for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)mean[c]+=data[i+c]/(192*192);
   for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)data[i+c]=(target?.[c]??mean[c])+(data[i+c]-mean[c])*strength;
   ctx.putImageData(pixels,0,0);
  }
  return out;
 }
 for(const [id,s] of Object.entries(selectedMaterials)){
  const p=id==='forge'?granite:id==='court'?jade:recipe;configure(p,s);render();
  // The frozen granite swatch starts with a light square; other recipes start dark.
  const floor=p===granite
   ?[tile(0,0,s,false,false),tile(192,0,s,true,false),tile(192,192,s,false,false),tile(0,192,s,true,false)]
   :[tile(192,0,s,false,false),tile(0,0,s,true,false),tile(0,192,s,false,false),tile(192,192,s,true,false)];
  configure(recipe,s,true);
  if(s.wallMarble){
   // Match the actual rendered chess-square hues, including their tone mapping.
   const mean=tile=>{const data=tile.getContext('2d').getImageData(0,0,192,192).data,sum=[0,0,0];for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)sum[c]+=data[i+c]/(192*192*255);return sum;};
   gl.uniform3fv(u(recipe,'marbleBase'),mean(floor[0]));gl.uniform3fv(u(recipe,'marbleGreen'),mean(floor[1]));
  }
  render();
  const wall=document.createElement('canvas');wall.width=wall.height=384;wall.getContext('2d').drawImage(canvas,0,0);
  if(s.wallMatch==='dark'){
   const ctx=wall.getContext('2d'),pixels=ctx.getImageData(0,0,384,384),data=pixels.data;
   const floorData=floor[1].getContext('2d').getImageData(0,0,192,192).data,source=[0,0,0],target=[0,0,0];
   for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)source[c]+=data[i+c]/(384*384);
   for(let i=0;i<floorData.length;i+=4)for(let c=0;c<3;c++)target[c]+=floorData[i+c]/(192*192);
   // Retain the basalt grain, with the floor's warm hue and a little less light.
   for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)data[i+c]=target[c]*.9+(data[i+c]-source[c])*.72;
   ctx.putImageData(pixels,0,0);
  }
  cache.set(id,{floor,wall});
 }
 return {
  cache,
  walls(ctx,id,walls,size){
   const s=cache.get(id),u=288/size;ctx.save();ctx.beginPath();
   for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(walls.has(`${x},${y}`))ctx.rect(16+x*u,16+y*u,u,u);
   ctx.clip();ctx.drawImage(s.wall,16,16,288,288);ctx.restore();
  },
  cell(ctx,id,x,y,px,py,size,isWall){
   const s=cache.get(id);if(!s)return;
   if(isWall){
    // One map-wide slab in world coordinates: UVs never restart at cell edges.
    const ratio=s.wall.width/288;
    ctx.drawImage(s.wall,(px-16)*ratio,(py-16)*ratio,size*ratio,size*ratio,px,py,size+.04,size+.04);
   }else{
    const parity=(x+y)%2,variant=(Math.floor(x/2)+Math.floor(y/2))%2;
    ctx.drawImage(s.floor[parity+variant*2],px,py,size+.15,size+.15);
   }
  },
  fog(ctx,id,time){gl.useProgram(fog);gl.uniform1i(u(fog,'biome'),Object.keys(selectedMaterials).indexOf(id));gl.uniform1f(u(fog,'time'),time);render();ctx.drawImage(canvas,16,16,288,288);},
  dispose(){for(const p of programs)gl.deleteProgram(p);cache.clear();gl.getExtension('WEBGL_lose_context')?.loseContext();},
 };
}
