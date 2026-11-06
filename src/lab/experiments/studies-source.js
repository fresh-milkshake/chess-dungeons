import {recipeSource} from './recipe-source.js';
import {phenomenaSource} from './phenomena-source.js';

export const studyVertex=`#version 300 es
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const studyFragment=`#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform ivec2 kinds;
uniform vec3 darkA,darkB,lightA,lightB;
uniform vec2 scales,polishes;
uniform float time,effectAge;
uniform int wall,spectral;
uniform int world,variation;
uniform int necropolis;

float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.06+4.3;a*=.5;}return v;}
${phenomenaSource}
${recipeSource}

vec3 wallMaterial(vec3 c){
 // Horizontal geological cut: continuous mass, never a wall facade or brick grid.
 vec2 rock=uv*vec2(1.6,3.1);
 vec2 warp=vec2(fbm(rock*.8),fbm(rock*.9+5.))-.5;
 float strata=fbm(rock*1.8+warp*1.4);
 vec3 cut=mix(darkA,darkB,.27+strata*.40);
 c=mix(c,cut,.34);
 if(kinds.x==0||kinds.x==9){
  float stress=abs(fbm(rock*2.1+warp*1.7)-.48);
  float fissure=1.-smoothstep(.008,.032,stress);
  c*=1.-fissure*.12;
 }
 c*=.77+strata*.11;
 return c;
}

void main(){
 vec2 p=uv*2.;
 if(spectral==1){
  p+=vec2(noise(p*1.3+time*.03),noise(p*1.1-time*.025+8.))*.025-.0125;
 }
 vec2 tile=floor(p),local=fract(p);
 float checker=mod(tile.x+tile.y,2.);
 if(wall==1)checker=0.;
 vec2 cut=local*2.+vec2(hash(tile+5.),hash(tile+17.))*23.;
 if(wall==1)cut=uv*vec2(3.,5.);
 float reaction=0.;vec2 distortion=vec2(0.);
 if(effectAge>=0.&&effectAge<2.4){
  vec2 delta=p-vec2(1.45,1.45);
  reaction=exp(-dot(delta,delta)/.27)*(1.-exp(-effectAge*18.))*exp(-effectAge*2.);
  distortion=vec2(delta.y,-delta.x)*reaction*.035*sin(effectAge*5.);
 }
 bool darkSide=checker<.5;
 float polish=darkSide?polishes.x:polishes.y;
 if(wall==1)polish=min(polish,.12);
 vec3 c=recipeSurface(cut*(darkSide?scales.x:scales.y)+(wall==1?vec2(0.):distortion),darkSide?kinds.x:kinds.y,darkSide?darkA:lightA,darkSide?darkB:lightB,polish,wall==1?0.:reaction);
 if(wall==1)c=wallMaterial(c);
 if(necropolis==1&&wall==0){
  vec2 stone=uv*vec2(4.6,5.2);
  vec2 dampWarp=vec2(fbm(stone*.8),fbm(stone*.7+6.));
  float damp=fbm(stone*1.8+dampWarp*1.4);
  float stains=smoothstep(.37,.70,damp);
  c*=.91+fbm(stone*8.)*.12;
  c=mix(c,c*vec3(.70,.81,.77),stains*.32);
 }
 if(spectral==1){
  float veil=fbm(p*.9+vec2(-time*.016,time*.011));
  c=mix(c,vec3(.20,.30,.26),.08+veil*.06);
 }
 if(world>=0)c=newWorldMatter(p*2.,checker,world,variation,time,reaction,c);
 c=1.-exp(-c*(wall==1?1.18:1.55));
 fragColor=vec4(pow(c,vec3(.88)),1.);
}`;
