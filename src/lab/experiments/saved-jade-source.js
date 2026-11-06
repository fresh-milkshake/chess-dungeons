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

float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.06+4.3;a*=.5;}return v;}
vec3 cellular(vec2 p){
 vec2 id=floor(p),f=fract(p);float first=10.,second=10.,identity=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 offset=vec2(float(x),float(y)),seed=id+offset;
  vec2 site=vec2(hash(seed),hash(seed+37.));float d=length(offset+site-f);
  if(d<first){second=first;first=d;identity=hash(seed+19.);}else second=min(second,d);
 }
 return vec3(first,second,identity);
}

vec3 surface(vec2 p,int kind,vec3 a,vec3 b,float polish,float reaction){
 float broad=fbm(p*.9),grain=noise(p*78.),mask=broad;
 vec3 c;
 if(kind==0){
  vec3 fragments=cellular(p*14.);
  float quartz=pow(fragments.z,5.)*smoothstep(.06,.18,fragments.y-fragments.x);
  mask=.25+broad*.40+grain*.16+quartz*.42;
 }
 else if(kind==1){
  vec2 warp=vec2(fbm(p*.65),fbm(p*.8+9.));
  float vein=.5+.5*sin(p.x*2.+p.y*.8+warp.x*14.+warp.y*5.);
  float thin=pow(.5+.5*sin(p.x*8.+warp.y*24.),14.);
  mask=pow(vein,.72)*.82+thin*.13;
 }
 else if(kind==2){
  float glass=fbm(p*1.4+fbm(p*.5)*2.);
  float inclusion=pow(noise(p*30.),9.);
  mask=.14+glass*.7+inclusion*.12;
 }
 else if(kind==3){
  float lamella=.5+.5*sin(p.x*5.+p.y*1.7+fbm(p*.8)*12.);
  mask=.32+broad*.2+pow(lamella,2.)*.43;
 }
 else if(kind==4){
  float brushed=noise(vec2(p.x*150.,p.y*4.));
  float hammered=fbm(p*4.);
  mask=.36+hammered*.4+brushed*.12;
 }
 else if(kind==5){
  float pores=pow(noise(p*40.),8.);
  float chalk=fbm(p*6.);
  mask=.28+chalk*.65-pores*.65;
 }
 else if(kind==6){
  vec2 warp=vec2(fbm(p*.8),fbm(p*.7+2.));
  float rings=.5+.5*sin(p.x*6.+warp.x*18.+warp.y*9.);
  float fibres=noise(vec2(p.x*55.,p.y*2.));
  mask=.2+rings*.6+fibres*.14;
 }
 else if(kind==7){
  vec3 cells=cellular(p*2.8+fbm(p*.7));
  float fracture=exp(-(cells.y-cells.x)*32.);
  float frost=pow(fbm(p*9.),2.);
  mask=.32+broad*.5+fracture*.25+frost*.2;
 }
 else if(kind==8){
  float oxidation=fbm(p*2.+fbm(p*.8)*3.);
  float speckle=noise(p*60.);
  mask=smoothstep(.27,.72,oxidation)*.85+speckle*.1;
 }
 else if(kind==9){
  vec3 chunks=cellular(p*5.5);
  float mortar=smoothstep(.015,.085,chunks.y-chunks.x);
  mask=(.23+chunks.z*.54+grain*.12)*mortar+.10;
 }
 else if(kind==10){
  float fibre=fbm(vec2(p.x*14.,p.y*.55));
  float layers=.5+.5*sin(p.x*20.+fbm(p*.65)*18.);
  mask=.18+fibre*.60+layers*.14;
 }
 else {
  vec3 pores=cellular(p*7.);
  float voids=1.-smoothstep(.10,.24,pores.x);
  mask=.25+broad*.65-voids*.65;
 }
 c=mix(a,b,clamp(mask,0.,1.));
 float grainLight=(grain-.5)*mix(.026,.006,polish);
 c+=grainLight;
 float reflection=exp(-pow(p.x*.17+p.y*.10-.4,2.)*4.);
 float sheen=(.22+.78*broad)*reflection;
 c+=vec3(.09,.10,.095)*sheen*polish;
 if(kind==3){
  float interference=sin(p.x*3.+fbm(p)*6.);
  c+=vec3(.028*interference,.021,-.020*interference)*polish;
 }
 if(kind==4)c+=b*sheen*.16;
 if(kind==11)c*=.95+noise(p*5.)*.08;
 // Local pressure changes the finish, not the grid or a decorative overlay.
 c+=mix(vec3(.045,.04,.03),vec3(.08,.09,.085),polish)*reaction*(.5+broad);
 return max(c,vec3(0.));
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
 vec3 c;
 if(checker<.5)c=surface(cut*scales.x+distortion,kinds.x,darkA,darkB,polishes.x,reaction);
 else c=surface(cut*scales.y+distortion,kinds.y,lightA,lightB,polishes.y,reaction);
 if(spectral==1){
  float veil=fbm(p*.9+vec2(-time*.016,time*.011));
  c=mix(c,vec3(.20,.30,.26),.08+veil*.06);
 }
 c=1.-exp(-c*1.55);
 fragColor=vec4(pow(c,vec3(.88)),1.);
}`;
