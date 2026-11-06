import {phenomenaSource} from './phenomena-source.js';

export const vertexSource = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const fragmentSource = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 resolution;
uniform vec4 board;
uniform float time;
uniform int theme;
uniform int materialVariant;
uniform int recipeEnabled;
uniform ivec2 recipeKinds;
uniform vec3 recipeDarkA,recipeDarkB,recipeLightA,recipeLightB;
uniform vec2 recipeScales,recipePolishes;
uniform vec4 moves[8];
uniform vec2 selected;

float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec2 rotate(vec2 p,float angle){float c=cos(angle),s=sin(angle);return mat2(c,-s,s,c)*p;}
float fbm(vec2 p){float sum=0.,amplitude=.5;for(int i=0;i<5;i++){sum+=amplitude*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.7;amplitude*=.5;}return sum;}
float waves(vec2 p){
 float h=0.,a=.5;
 for(int i=0;i<6;i++){float k=float(i);vec2 d=vec2(sin(k*2.4),cos(k*2.4));float x=dot(p,d)*(1.7+k*.8)+time*(.16+k*.045);h+=a*exp(sin(x)-1.);p+=d*cos(x)*a*.35;a*=.65;}
 return h;
}
vec3 accent(){if(theme==0)return vec3(.42,.45,.49);if(theme==1)return vec3(.16,.48,.46);if(theme==2)return vec3(.36,.57,.48);if(theme==4)return vec3(.78,.59,.27);return vec3(.68,.19,.05);}
${phenomenaSource}

// A depth stack of irregular gas clouds, lit from beyond the upper board edge.
// No planets, orbits, stars drawn as symbols, or surface transparency.
vec3 cosmicEnvironment(vec2 p){
 vec2 q=rotate(p*.21,-.48);
 vec3 col=vec3(.0008,.0010,.0015);float transmittance=1.;
 for(int i=0;i<4;i++){
  float depth=float(i);
  vec2 layer=q*(1.+depth*.36)+vec2(depth*5.4-time*.0025*(depth+1.),depth*2.7);
  vec2 warp=vec2(fbm(layer*.73),fbm(layer*.83+9.));
  float mass=fbm(layer*1.8+warp*2.4);
  float density=smoothstep(.31,.76,mass)*(.52-depth*.055);
  float illumination=fbm(layer*1.8+warp*2.4+vec2(-.14,-.23));
  vec3 gas=mix(vec3(.003,.004,.006),vec3(.032,.037,.043),smoothstep(.40,.76,illumination));
  gas+=pow(clamp(mass*.98+.03,0.,1.),6.)*vec3(.065,.058,.044);
  col+=transmittance*density*gas;transmittance*=1.-density*.8;
 }
 // Broad, occluded light and a dark rift imply an immense unseen presence.
 vec2 remote=p-vec2(.8,-6.8);
 float radiance=exp(-dot(remote*vec2(.16,.25),remote*vec2(.16,.25)));
 float rift=fbm(q*.67+vec2(1.5,-.2));
 col+=radiance*mix(vec3(.004,.006,.009),vec3(.065,.054,.035),smoothstep(.45,.72,rift));
 col*=.45+.55*smoothstep(.32,.63,fbm(q*.85+vec2(4.,1.)));
 col+=pow(fbm(q*7.+fbm(q*2.)),6.)*vec3(.025,.029,.035);
 float concealedLight=exp(-pow((p.y+5.3)*.85,2.)-pow((p.x-.8)*.32,2.));
 col+=concealedLight*vec3(.065,.068,.071)*smoothstep(.35,.68,rift);
 return col*1.85;
}

vec3 oceanEnvironment(vec2 p){
 float h=waves(p*1.55);
 vec2 gradient=vec2(waves(p*1.55+vec2(.045,0))-h,waves(p*1.55+vec2(0,.045))-h)/.045;
 vec3 normal=normalize(vec3(-gradient*.8,1.));
 float reflected=pow(max(dot(normal,normalize(vec3(-.4,-.45,1.))),0.),32.);
 float depth=fbm(p*.23+vec2(time*.002,0.));
 vec3 col=mix(vec3(.003,.018,.032),vec3(.018,.13,.15),h*.55+depth*.45);
 col+=reflected*vec3(.055,.15,.16);
 // The far water almost loses its light; the currents remain slow and heavy.
 col*=1.-exp(-pow((p.y+4.7)*.42,2.))*.56;
 col+=pow(fbm(p*.6+vec2(time*.004,-time*.003)),3.)*vec3(.012,.055,.054);
 return col*1.45;
}

vec3 spectralEnvironment(vec2 p){
 vec2 q=p*.4+vec2(time*.005,-time*.007);
 vec2 warp=vec2(fbm(q*1.1),fbm(q*.9+7.));
 float nearFog=fbm(q*1.7+warp*2.),distantFog=fbm(q*.63-warp*.6+vec2(4.,3.));
 vec3 col=vec3(.008,.016,.019);
 col+=pow(nearFog,2.6)*vec3(.055,.115,.09)+pow(distantFog,3.)*vec3(.06,.068,.075);
 float farLight=exp(-pow(p.x*.28,2.)-pow((p.y+5.8)*.32,2.));
 col+=farLight*vec3(.05,.09,.072)*smoothstep(.28,.7,nearFog);
 return col*1.7;
}

vec3 lavaEnvironment(vec2 p){
 vec2 drift=vec2(time*.003,-time*.002);
 vec2 warp=vec2(fbm(p*.27+drift),fbm(p*.31-drift+5.));vec2 q=p*.7+warp*2.;
 float crust=fbm(q*1.65),molten=smoothstep(.46,.68,crust);
 float convection=fbm(q*4.+vec2(time*.012,-time*.017));
 vec3 cold=vec3(.014,.009,.009)+noise(p*32.)*.006;
 vec3 magma=mix(vec3(.27,.018,.003),vec3(.95,.22,.018),pow(convection,1.7));
 vec3 col=mix(cold,magma,molten);
 col+=smoothstep(.56,.72,crust)*pow(convection,3.)*vec3(.52,.18,.018);
 float smoke=fbm(p*.31+vec2(-time*.004,time*.006));
 return col*(1.-smoothstep(.42,.76,smoke)*.6)*1.18;
}

vec3 imperialEnvironment(vec2 p){
 vec2 q=p*.32+vec2(time*.0035,time*.001);
 float body=fbm(q+vec2(fbm(q*.7)*1.5,0.)),cloud=smoothstep(.32,.69,body);
 float facing=fbm(q+vec2(-.18,-.25));
 vec3 sky=vec3(.13,.19,.25);
 vec3 vapor=mix(vec3(.14,.175,.20),vec3(.75,.66,.46),smoothstep(.30,.69,facing));
 vec3 col=mix(sky,vapor,cloud);
 // Daylight remains concealed behind the cloud bank, like a throne out of view.
 float dawn=exp(-pow((p.x-.5)*.22,2.)-pow((p.y+6.0)*.27,2.));
 col+=dawn*vec3(.23,.16,.07)*(.4+cloud*.6);
 return mix(col,col*.68,smoothstep(.52,.8,fbm(q*2.7+4.))*.35)*1.25;
}

vec3 environment(vec2 p){
 if(theme==0)return cosmicEnvironment(p);
 if(theme==1)return oceanEnvironment(p);
 if(theme==2)return spectralEnvironment(p);
 if(theme==3)return lavaEnvironment(p);
 return imperialEnvironment(p);
}

// Impact changes the texture sampling and finish, without moving tile boundaries.
// xy: local material displacement; z: pressure; w: a soft, drifting reflection.
vec4 surfaceResponse(vec2 p){
 vec4 result=vec4(0.);
 for(int i=0;i<8;i++){
  float age=time-moves[i].z;if(age<0.||age>2.4)continue;
  vec2 delta=p-moves[i].xy;
  float envelope=(1.-exp(-age*18.))*exp(-age*2.1);
  float radius=theme==2?.72:.62;
  float footprint=exp(-dot(delta,delta)/(radius*radius))*envelope;
  float textureMask=.65+.35*noise(delta*5.+moves[i].xy*3.);
  float drift=sin(age*5.5-dot(delta,vec2(1.2,.8)));
  float movement=theme==1?.035:theme==2?.047:theme==0?.014:theme==4?.006:0.;
  result.xy+=vec2(delta.y+.15,-delta.x+.10)*movement*footprint*drift;
  result.z+=footprint*textureMask*(1.+moves[i].w*.10);
  result.w+=footprint*(.65+.35*drift)*textureMask;
 }
 result.zw=min(result.zw,vec2(.9));
 return result;
}

// Each tile is a different cut of the same material; the view stays strictly flat.
vec3 material(vec2 p,float checker,vec4 response){
 vec2 tile=floor(p+4.),local=fract(p+4.)-.5;
 vec3 col;
 if(recipeEnabled==1){
  vec2 cut=(local+.5)*2.+vec2(hash(tile+5.),hash(tile+17.))*23.;
  int kind=checker<.5?recipeKinds.x:recipeKinds.y;
  float scale=checker<.5?recipeScales.x:recipeScales.y;
  float polish=checker<.5?recipePolishes.x:recipePolishes.y;
  vec3 a=checker<.5?recipeDarkA:recipeLightA,b=checker<.5?recipeDarkB:recipeLightB;
  cut=cut*scale+response.xy;
  float broad=fbm(cut*.9),grain=noise(cut*78.);
  float amount=.25+broad*.5+grain*.12;
  if(kind==1||kind==6||kind==10)amount=.2+.7*pow(.5+.5*sin(cut.x*(kind==10?14.:3.)+fbm(cut*.7)*15.),.8);
  if(kind==2)amount=.14+fbm(cut*1.4+fbm(cut*.5)*2.)*.7;
  if(kind==3)amount=.32+broad*.2+pow(.5+.5*sin(cut.x*5.+cut.y*1.7+broad*12.),2.)*.43;
  if(kind==4)amount=.36+fbm(cut*4.)*.4+noise(vec2(cut.x*150.,cut.y*4.))*.12;
  if(kind==5)amount=.28+fbm(cut*6.)*.65-pow(noise(cut*40.),8.)*.65;
  if(kind==7)amount=.32+broad*.5+pow(fbm(cut*9.),2.)*.2;
  if(kind==8)amount=smoothstep(.27,.72,fbm(cut*2.+fbm(cut*.8)*3.))*.85+grain*.1;
  if(kind==11)amount=.25+broad*.65-pow(1.-noise(cut*12.),7.)*.6;
  vec3 c=mix(a,b,clamp(amount,0.,1.));
  c+=(grain-.5)*mix(.026,.006,polish);
  c+=vec3(.09,.1,.095)*(.22+.78*broad)*exp(-pow(cut.x*.17+cut.y*.10-.4,2.)*4.)*polish;
  col=c;
 }else{
 vec2 stone=rotate(local+response.xy,hash(tile+7.)*6.28)+tile*13.7;
 float mineral=fbm(stone*3.);
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
 }
 return newWorldMatter(p,checker,theme,materialVariant,time,response.z,col);
}

vec2 mirageOffset(vec2 p){
 vec2 drift=vec2(time*.045,-time*.033);
 vec2 bend=vec2(noise(p*.95+drift),noise(p*.83-drift+7.))-.5;
 bend*=.045;
 bend.x+=sin(p.y*2.1+time*.65)*.006;
 bend.y+=sin(p.x*1.7-time*.48)*.004;
 return bend;
}

// Refraction and airborne haze cross every tile, including the board silhouette.
// The hit targets and piece sprites remain on their original, stable grid.
vec3 spectralSurface(vec2 p,out float coverage){
 vec3 background=spectralEnvironment(p);
 vec2 refracted=p+mirageOffset(p);
 float edge=max(abs(refracted.x),abs(refracted.y));
 vec2 q=p*.62+vec2(-time*.019,time*.014);
 float drifting=fbm(q+vec2(fbm(q*.7),0.));
 float wisps=smoothstep(.28,.70,drifting);
 coverage=1.-smoothstep(3.985,4.045,edge);
 vec3 col=background;
 if(coverage>0.){
  vec2 wave=sin((refracted+4.)*3.14159265);
  float softness=max(.040,12./board.z);
  vec2 transition=smoothstep(vec2(-softness),vec2(softness),wave);
  float checker=transition.x*transition.y+(1.-transition.x)*(1.-transition.y);
  vec4 response=surfaceResponse(p);
  vec3 stone=material(refracted,checker,response);
  vec3 mist=spectralEnvironment(p+response.xy*2.);
  float opacity=.60+checker*.20+response.z*.05-wisps*.045;
  col=mix(background,mix(mist,stone,opacity),coverage);
  if(distance(floor(p+4.),selected)<.1)col+=accent()*.066*coverage;
 }
 // Broad translucent wisps soften the grid, rather than drawing fog outlines.
 float proximity=1.-smoothstep(4.,4.85,edge);
 vec3 hazeColor=vec3(.19,.26,.23);
 col=mix(col,hazeColor,(.025+wisps*.07)*proximity);
 return col;
}

void main(){
 vec2 pixel=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
 vec2 uv=(pixel-board.xy)/board.zw,p=(uv-.5)*8.;
 float edge=max(abs(p.x),abs(p.y));vec3 col;
 float coverage=edge<4.?1.:0.;
 if(theme==2)col=spectralSurface(p,coverage);
 else if(edge>=4.)col=environment(p);
 else {
  vec2 cell=fract(uv*8.);float checker=1.-mod(floor(uv.x*8.)+floor(uv.y*8.),2.);
  vec4 response=surfaceResponse(p);
  col=material(p,checker,response);
  // Hairline material joint only: no tile borders, bevels or drop shadows.
  float seam=min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y));
  col*=.94+.06*smoothstep(0.,8./board.z*.6,seam);
  if(distance(floor(uv*8.),selected)<.1)col+=accent()*.066;
 }
 float peripheral=clamp(length(p*vec2(.10,.09)),0.,1.);
 col*=1.-peripheral*peripheral*mix(.20,.10,coverage);
 float exposure=mix(1.35,1.72,coverage);
 col=1.-exp(-max(col,vec3(0.))*exposure);
 fragColor=vec4(pow(col,vec3(.88)),1.);
}`;
