// Frozen plain granite from the scene before the bold material experiments.
export const studyVertex=`#version 300 es
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}`;
export const studyFragment=`#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
const int theme=3;
uniform float time,effectAge;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec2 rotate(vec2 p,float angle){float c=cos(angle),s=sin(angle);return mat2(c,-s,s,c)*p;}
float fbm(vec2 p){float sum=0.,amplitude=.5;for(int i=0;i<5;i++){sum+=amplitude*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.7;amplitude*=.5;}return sum;}
vec3 material(vec2 p,float checker,vec4 response){
 vec2 tile=floor(p+4.),local=fract(p+4.)-.5;
 vec2 stone=rotate(local+response.xy,hash(tile+7.)*6.28)+tile*13.7;
 float mineral=fbm(stone*3.);vec3 col;
 if(theme==0){
  float cloud=fbm(stone*2.+fbm(stone*.8)*2.);
  float inclusions=pow(noise(stone*39.),7.);
  vec3 obsidian=mix(vec3(.032,.038,.045),vec3(.065,.073,.084),cloud);
  vec3 meteorite=mix(vec3(.43,.46,.49),vec3(.61,.63,.64),cloud);
  col=mix(obsidian,meteorite,checker);
  col+=inclusions*mix(vec3(.027,.031,.038),vec3(.035,.033,.029),checker);
  float iridescence=fbm(stone*.8+vec2(2.,7.));
  col+=smoothstep(.43,.72,iridescence)*mix(vec3(.014,.016,.020),vec3(.032,.030,.026),checker);
  float polish=pow(clamp(cloud*.8+iridescence*.4,0.,1.),2.);
  col+=response.w*mix(vec3(.072,.080,.094),vec3(.065,.067,.068),checker)*(.55+polish);
 }
 else if(theme==1){
  float glaze=fbm(stone*2.5+mineral*1.7);
  float pearl=pow(.5+.5*sin(stone.x*4.+fbm(stone*.8)*6.),5.);
  vec3 jade=mix(vec3(.020,.13,.145),vec3(.045,.23,.23),glaze);
  vec3 nacre=mix(vec3(.59,.71,.65),vec3(.77,.81,.72),glaze);
  col=mix(jade,nacre,checker);
  col+=pearl*mix(vec3(.004,.012,.012),vec3(.020,.025,.023),checker);
  col+=(noise(stone*140.)-.5)*.006;
  // A damped change in the glaze's reflection; the ceramic stays opaque.
  col+=response.w*vec3(.060,.090,.085)*(.5+glaze*.7);
 }
 else if(theme==2){
  col=mix(vec3(.073,.13,.115),vec3(.51,.63,.56),checker)*(.87+fbm(stone*2.)*.25);
  col+=pow(mineral,3.)*vec3(.035,.055,.043);
  col+=response.z*vec3(.032,.058,.045)*(.6+mineral);
 }
 else if(theme==3){
  float grain=noise(stone*210.),crystal=pow(noise(stone*79.),14.);
  float feldspar=smoothstep(.59,.77,noise(stone*34.));
  col=mix(vec3(.080,.073,.065),vec3(.48,.45,.40),checker)*(.83+mineral*.34);
  col+=(grain-.5)*.036+crystal*vec3(.09,.083,.073);
  col+=feldspar*mix(vec3(.017,.015,.012),vec3(.027,.023,.018),checker);
  // Heat catches mineral grains, without opening cracks or casting fire.
  col+=response.z*vec3(.080,.033,.009)*(.5+feldspar*.5+crystal);
 }
 else {
  float warp=fbm(stone*1.5);
  float bands=.5+.5*sin(stone.x*5.+stone.y*2.+warp*18.);
  float fine=.5+.5*sin(stone.x*19.+stone.y*7.+warp*31.);
  vec3 malachite=mix(vec3(.012,.080,.034),vec3(.060,.36,.15),pow(bands,.85));
  malachite+=pow(fine,12.)*vec3(.027,.075,.029);
  float brushed=noise(vec2(stone.x*210.,stone.y*8.));
  vec3 gold=mix(vec3(.67,.39,.11),vec3(.97,.73,.29),mineral)+(brushed-.5)*vec3(.021,.015,.005);
  col=mix(malachite,gold,checker);
  col+=response.w*mix(vec3(.040,.070,.048),vec3(.105,.083,.040),checker)*(.65+mineral);
 }
 // Broad reflected light describes polish, never a bevel or sidewall.
 float softbox=exp(-pow(p.x*.18+p.y*.12+.2,2.)*3.5);
 if(theme==0)col+=softbox*mix(vec3(.013,.015,.019),vec3(.045,.044,.040),checker);
 if(theme==1)col+=softbox*vec3(.028,.039,.034);
 if(theme==4)col+=softbox*mix(vec3(.021,.034,.019),vec3(.22,.16,.062),checker);
 float farLight=exp(-pow(p.x*.16,2.)-pow((p.y+4.6)*.22,2.));
 if(theme==0)col*=.80+farLight*.30;
 if(theme==1)col*=.84+farLight*.16;
 if(theme==3)col+=farLight*vec3(.018,.004,.001);
 return col;
}


void main(){
 vec2 p=uv*2.-4.;
 float checker=1.-mod(floor(uv.x*2.)+floor(uv.y*2.),2.);
 vec3 c=material(p,checker,vec4(0.));
 float seam=min(min(fract(uv.x*2.),1.-fract(uv.x*2.)),min(fract(uv.y*2.),1.-fract(uv.y*2.)));
 c*=.94+.06*smoothstep(0.,.004,seam);
 float peripheral=clamp(length(p*vec2(.10,.09)),0.,1.);
 c*=1.-peripheral*peripheral*.10;
 c=1.-exp(-max(c,vec3(0.))*1.72);
 fragColor=vec4(pow(c,vec3(.88)),1.);
}`;
