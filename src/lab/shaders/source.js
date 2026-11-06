import {emperorSource} from './emperor-source.js';
import {curseSource} from './curse-source.js';
export const vertexSource = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
 vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
 uv=vec2(p.x,1.0-p.y);gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

// D1–D4 retain their original treatment. Ether keeps its flowing material layer;
// empowerment uses much lighter animated reflections over the unchanged sprite.
export const fragmentSource = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform sampler2D sprite;
uniform float time;
uniform float effectAge;
uniform float intensity;
uniform int category;
uniform int variant;
const float TAU=6.2831853;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03+3.7)+.15*noise(p*4.09+8.1);}
float line(float x,float w){return 1.0-smoothstep(w*.35,w,abs(x));}
float disk(vec2 p,float r){return 1.0-smoothstep(r*.28,r,length(p));}
float window(float p){return smoothstep(0.0,.12,p)*(1.0-smoothstep(.8,1.0,p));}
float sweep(vec2 p,float t,float angle,float width){
 float phase=fract(t),x=dot(p-.5,vec2(cos(angle),sin(angle)));
 return line(x-mix(-.92,.92,phase),width)*window(phase);
}
vec3 spectrum(float x){return .55+.45*cos(TAU*(x+vec3(0,.33,.67)));}
mat2 rotate(float x){float c=cos(x),s=sin(x);return mat2(c,-s,s,c);}
float star(vec2 p,float size){
 vec2 q=abs(p);float core=disk(p,size*.3);
 float rays=line(q.x,size*.055)*line(q.y,size)+line(q.y,size*.055)*line(q.x,size);
 return max(core,rays);
}
float sparks(vec2 p,float t,float density){
 vec2 cell=floor(p*density);float total=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(x,y);float seed=hash(id),phase=fract(t*.65+seed*8.0);
  vec2 center=(id+.2+.6*vec2(seed,hash(id+7.0)))/density;
  center+=vec2(sin(t+seed*30.0),cos(t*.8+seed*19.0))*.012;
  float pulse=pow(max(0.0,sin(phase*3.14159)),10.0)*step(.54,hash(id+19.0));
  total+=star(rotate(t*.35+seed*6.0)*(p-center),.027)*pulse;
 }
 return total;
}
vec2 cells(vec2 p){
 vec2 id=floor(p),f=fract(p);float first=10.0,second=10.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 o=vec2(x,y),j=id+o;
  float d=length(o+vec2(hash(j),hash(j+11.7))-f);
  if(d<first){second=first;first=d;}else second=min(second,d);
 }
 return vec2(first,second-first);
}
// Short, tapering curved trails, rather than full-length sine stripes.
float wisps(vec2 p,float t,float seed){
 float value=0.0;
 for(int i=0;i<5;i++){
  float k=float(i),phase=fract(t*.23+k*.213+seed);
  float cy=mix(1.12,-.12,phase),cx=.5+.25*sin(phase*5.0+k*2.4+seed*9.0);
  for(int j=0;j<12;j++){
   float age=float(j)*.012;
   vec2 pos=vec2(cx+sin(phase*9.0-age*12.0+k)*age*.6,cy+age);
   value+=disk(p-pos,mix(.034,.006,float(j)/11.0))*(1.0-float(j)/13.0)*window(phase);
  }
 }
 return min(value,1.5);
}
// Preserve the first diamond collection while the player chooses a favourite.
vec4 originalDiamond(vec4 base){
 float t=time,a=base.a,inner=1.0;
 for(int i=0;i<8;i++){
  float angle=float(i)*.785398;
  inner=min(inner,texture(sprite,uv+vec2(cos(angle),sin(angle))*.012).a);
 }
 float rim=max(0.0,a-inner),glow=0.0;
 float x=uv.x*.72+uv.y*.45-(fract(t*.13)*1.7-.25);
 float moving=exp(-x*x/(.08*.08));
 vec3 col=base.rgb,light=vec3(0.0);
 if(variant==1){light=vec3(.8,.96,1.0)*moving*.8;glow=rim*.08;}
 if(variant==2){
  float d=uv.x-uv.y*.55-sin(t*.44)*.6;
  light=spectrum(uv.x*.8+uv.y*.5+t*.08)*exp(-d*d/(.22*.22))*.52;
  col=mix(col,col*vec3(.87,.97,1.0),.12);
 }
 if(variant==3){
  vec2 grid=uv*9.0,cell=floor(grid),center=vec2(hash(cell),hash(cell+21.0))*.64+.18;
  float pulse=pow(max(0.0,sin(t*1.6+hash(cell+7.0)*6.28318)),14.0);
  vec2 p=abs((fract(grid)-center)/9.0);
  float sparkle=min(1.0,.000022/(p.x*p.y+.000022))*exp(-length(p)*40.0)*pulse*step(.68,hash(cell+4.0));
  light=vec3(.9,.98,1.0)*sparkle*1.5+vec3(.08,.14,.18)*moving;
 }
 if(variant==4){
  vec2 g=vec2(uv.x+uv.y*.5,uv.y)*11.0;
  float facet=hash(floor(g)+step(fract(g).y,fract(g).x));
  float flash=pow(max(0.0,sin(t*.8+facet*18.0)),7.0);
  light=mix(vec3(.16,.46,.65),vec3(.9,.98,1.0),facet)*flash*.46;
 }
 float extra=clamp(glow*intensity,0.0,.6)*(1.0-a);
 return vec4(clamp(col+light*intensity,0.0,1.0)*a+vec3(.5,.86,1.0)*extra,a+extra);
}
vec3 flowingMaterial(vec3 source,vec2 p,float t){
 float amount=0.0,field=0.0;
 vec3 pigment=source;
 float lum=dot(source,vec3(.299,.587,.114));
 if(category==1){
  if(variant==1){
   float wave=dot(p,vec2(.7,.45))+fbm(p*3.5+vec2(t*.12,-t*.17))*.2;
   field=.5+.5*cos(wave*9.0-t*.9);
   pigment=mix(vec3(.69,.59,.88),vec3(.55,.88,.88),.5+.5*sin(wave*5.0+t*.55));
   amount=.025+.27*pow(field,2.0);
  }
  if(variant==2){
   vec2 q=p*4.5;
   vec2 flow=vec2(fbm(q+vec2(t*.17,-t*.23)),fbm(q+vec2(-t*.21,t*.11)));
   field=fbm(q*1.7+flow*3.5+vec2(t*.14,-t*.31));
   pigment=mix(vec3(.34,.44,.64),vec3(.59,.8,.83),smoothstep(.25,.72,field));
   amount=.035+.34*smoothstep(.25,.74,field);
  }
  if(variant==3){
   float bend=sin(p.y*5.0-t*.6)*.15+fbm(p*3.0+vec2(t*.14,0))*.22;
   float reflection=sin(p.x*5.0+bend*5.0-t*.8);
   field=exp(-reflection*reflection*5.0);
   pigment=mix(vec3(.61,.49,.82),vec3(.79,.88,.9),.5+.5*sin(p.y*4.0+t*.5));
   amount=.02+.32*field;
  }
  if(variant==4){
   field=.5+.5*sin(p.y*4.0+p.x*3.0-t*.7);
   pigment=mix(vec3(.48,.68,.87),vec3(.7,.58,.84),field);
   amount=pow(field,3.0)*.11;
  }
  if(variant==5){
   vec2 q=p*4.0+vec2(-t*.12,t*.18);
   float cloud=fbm(q+vec2(fbm(q+4.0),fbm(q-3.0))*2.5);
   field=smoothstep(.24,.74,cloud);
   pigment=mix(vec3(.36,.3,.68),vec3(.4,.73,.8),.5+.5*sin(cloud*7.0+t*.45));
   amount=.04+.36*field;
  }
 }

 // Preserve the Neo shading under the moving pigment, including dark pieces.
 vec3 material=pigment*(.28+.72*lum);
 return mix(source,material,clamp(amount*intensity,0.0,.88));
}
${emperorSource}
${curseSource}
void main(){
 vec4 base=texture(sprite,uv);
 if(variant==0||intensity==0.0){fragColor=vec4(base.rgb*base.a,base.a);return;}
 if(category==3){fragColor=emperorEffect(base,time);return;}
 if(category==4){fragColor=curseEffect(base,time);return;}
 if(category==0&&variant<=4){fragColor=originalDiamond(base);return;}
 float t=time,mask=0.0,white=0.0,haloMask=0.0,dissolve=0.0;
 vec3 tint=vec3(1.0);vec2 displacement=vec2(0.0);
 if(category==0){
  tint=vec3(.72,.91,1.0);
  if(variant==5){
   float phase=fract(t*.31);
   float ripple=line(length(uv-.5-vec2(-.24,.23))-(phase*1.4-.12),.045)*window(phase);
   float fractures=pow(.5+.5*sin(uv.x*48.0+uv.y*29.0+fbm(uv*6.0)*11.0-t*2.4),6.0);
   tint=spectrum(uv.x*.4+uv.y*.5+t*.16)*.3+vec3(.65);
   mask=ripple*.45;white=ripple*(.25+fractures*.85);haloMask=ripple*.35;
  }
 }else if(category==1){
  tint=vec3(.68,.83,1.0);
  if(variant==1){
   float warp=fbm(uv*4.0+vec2(t*.15,-t*.19))*.15;
   float d=dot(uv-.5,vec2(.73,.68))+warp-sin(t*.6)*.6;
   float pearl=exp(-d*d/(.16*.16));
   float interference=.5+.5*cos((uv.x*.8+uv.y*.4+warp)*36.0-t*1.2);
   tint=mix(vec3(.81,.71,1.0),vec3(.65,1.0,.92),interference);
   mask=pearl*(.12+.13*interference);white=pearl*.07;haloMask=pearl*.08;
  }
  if(variant==2){
   vec2 q=uv*5.0;
   vec2 flow=vec2(fbm(q+vec2(t*.17,-t*.23)),fbm(q+vec2(-t*.21,t*.11)));
   float smoke=fbm(q*1.8+flow*3.0+vec2(t*.13,-t*.35));
   float curl=1.0-smoothstep(.025,.14,abs(smoke-.52));
   mask=curl*.17;white=curl*.025;dissolve=smoothstep(.45,.72,smoke)*.23;
   tint=vec3(.55,.83,.89);haloMask=curl*.08;
  }
  if(variant==3){
   float bend=sin(uv.y*5.0-t*.6)*.15+fbm(uv*3.0+vec2(t*.14,0))*.22;
   float reflection=sin(uv.x*5.0+bend*5.0-t*.8);
   float broad=exp(-reflection*reflection*6.0);
   float fine=exp(-reflection*reflection*75.0);
   float threads=.5+.5*sin(uv.y*43.0+fbm(uv*4.0)*8.0-t*.65);
   mask=broad*.14;white=fine*(.06+.07*threads);haloMask=broad*.065;
   tint=mix(vec3(.76,.65,1.0),vec3(.82,.96,1.0),.5+.5*sin(t*.6+uv.y*3.0));
  }
  if(variant==4){
   float edge=uv.y-.5-sin(t*.72)*.68+(fbm(uv*6.0+vec2(t*.15,-t*.13))-.5)*.22;
   float rift=exp(-edge*edge/(.07*.07));
   float boundary=exp(-pow((abs(edge)-.065)/.018,2.0));
   displacement=vec2(sin(uv.y*13.0+t)*.022,cos(uv.x*11.0-t)*.012)*rift;
   dissolve=rift*.4;mask=boundary*.24;white=boundary*.07;
   haloMask=boundary*.12;tint=vec3(.7,.76,1.0);
  }
  if(variant==5){
   float cloud=fbm(uv*6.0+vec2(-t*.12,t*.18)+fbm(uv*3.0+vec2(t*.1,0))*2.0);
   float motes=sparks(uv+vec2(sin(t*.27)*.015,t*.025),t*.7,11.0);
   float stars=motes*(.4+.6*smoothstep(.3,.68,cloud));
   mask=stars*.28;white=stars*.3;haloMask=stars*.18;
   tint=mix(vec3(.68,.57,1.0),vec3(.6,1.0,.93),cloud);
  }
 }else{
  // Red light is a translucent surface reflection, never an opaque paint layer.
  // Broad feathered envelopes and much weaker microdetail keep Neo readable.
  tint=vec3(1.0,.22,.29);
  if(variant==1){
   float d=dot(uv-.5,vec2(.8,-.6))-sin(t*.67)*.64;
   float pearl=exp(-d*d/(.16*.16));
   float glint=exp(-pow((d-.025)/.035,2.0));
   float flecks=.6+.4*noise(uv*24.0+vec2(t*.12,-t*.08));
   tint=mix(vec3(.93,.24,.34),vec3(1.0,.5,.43),.5+.5*sin(t*.8+uv.y*3.0));
   mask=pearl*flecks*.21;white=glint*.08;
   haloMask=pearl*.075;
  }
  if(variant==2){
   float dust=sparks(uv,t*.85,12.0);
   float shimmer=.5+.5*sin(t*.9+uv.y*5.0+uv.x*2.0);
   tint=vec3(1.0,.24,.3);
   mask=dust*.31;white=dust*.12;
   mask+=pow(shimmer,5.0)*.035;haloMask=dust*.1;
  }
  if(variant==3){
   float bend=fbm(uv*4.0+vec2(t*.17,-t*.11));
   float d=uv.x*.62+uv.y*.78-.7-sin(t*.58)*.58+(bend-.5)*.13;
   float sheen=exp(-d*d/(.2*.2));
   float fine=.5+.5*sin(uv.x*35.0+uv.y*20.0+bend*9.0-t*.8);
   tint=mix(vec3(.87,.18,.29),vec3(1.0,.45,.4),.5+.5*sin(t*.7+uv.y*3.0));
   mask=sheen*(.12+.065*fine);white=sheen*pow(fine,12.0)*.035;
   haloMask=sheen*.06;
  }
  if(variant==4){
   vec2 g=vec2(uv.x+uv.y*.5,uv.y)*10.0;
   float facet=hash(floor(g)+step(fract(g).y,fract(g).x));
   float flash=pow(max(0.0,sin(t*.85+facet*18.0)),6.0);
   float diffuse=.5+.5*sin(t*.65+uv.x*4.0-uv.y*3.0);
   tint=mix(vec3(.94,.18,.26),vec3(1.0,.47,.4),facet);
   mask=flash*.16+pow(diffuse,3.0)*.025;white=flash*.045;
   haloMask=flash*.06;
  }
  if(variant==5){
   vec2 flow=vec2(fbm(uv*4.0+vec2(t*.23,0)),fbm(uv*4.0-vec2(0,t*.29)));
   float mist=fbm(uv*8.0+flow*2.7+vec2(-t*.32,t*.26));
   float drifting=smoothstep(.3,.72,mist);
   tint=mix(vec3(.9,.12,.24),vec3(1.0,.37,.3),smoothstep(.35,.68,mist));
   mask=drifting*.25;white=pow(drifting,3.0)*.018;
   haloMask=drifting*.08;
  }
 }
 float strength=clamp(mask*intensity,0.0,.92);
 vec4 surface=base;
 if(category==1&&variant==4&&dot(displacement,displacement)>.000001){
  vec4 shifted=texture(sprite,uv+displacement*min(intensity,1.5));
  surface=mix(base,shifted,min(1.0,length(displacement)*50.0));
 }
 vec3 underlying=category==0?surface.rgb:flowingMaterial(surface.rgb,uv,t);
 vec3 color=mix(underlying,tint,strength);
 color+=vec3(white*intensity)*(.3+.7*(1.0-strength));
 float a=surface.a*(1.0-clamp(dissolve*intensity,0.0,.85)),outer=0.0;
 if(haloMask>.001){
  for(int i=0;i<8;i++){float angle=float(i)*.785398;outer=max(outer,texture(sprite,uv+vec2(cos(angle),sin(angle))*.012).a);}
 }
 float extra=max(0.0,outer-base.a)*clamp(haloMask*intensity,0.0,.7)*(1.0-a);
 fragColor=vec4(clamp(color,0.0,1.0)*a+tint*extra,a+extra);
}`;
