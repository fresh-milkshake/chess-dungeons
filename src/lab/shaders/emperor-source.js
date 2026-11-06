// Original single-pass effects inspired by polar SDFs, domain warping and holographic foil.
export const emperorSource=`
float imperialLine(float d,float width){return exp(-abs(d)/width);}
float imperialDiamond(vec2 p,vec2 b){return (abs(p.x)/b.x+abs(p.y)/b.y-1.)*min(b.x,b.y);}
vec4 emperorEffect(vec4 inputBase,float t){
 vec2 p=uv-.5,buv=p/.84+.5;
 vec4 base=texture(sprite,buv);
 float a=atan(p.y,p.x),r=length(p),rimA=0.,haloA=0.;
 for(int i=0;i<8;i++){float k=float(i)*TAU/8.;vec2 d=vec2(cos(k),sin(k));rimA=max(rimA,texture(sprite,buv+d*.012).a);haloA=max(haloA,texture(sprite,buv+d*.032).a);}
 float rim=max(0.,rimA-base.a),halo=max(0.,haloA-base.a);
 vec3 gold=vec3(1.,.69,.20),material=base.rgb,aura=vec3(0.),front=vec3(0.);float opacity=0.,frontA=0.;
 float strength=clamp(intensity,0.,2.);
 bool awakening=variant<=4||variant==6;
 float arrival=awakening?smoothstep(.35,2.85,effectAge):1.;
 if(awakening&&effectAge<=.35)return vec4(base.rgb*base.a,base.a);
 if(variant==1){
  vec2 sun=uv-vec2(.5,.38);float ra=length(sun),an=atan(sun.y,sun.x);
  float wind=fbm(vec2(an*2.,ra*12.-t*.65));
  float edge=.31+.027*sin(an*11.+t*.5)+.035*(wind-.5);
  float corona=imperialLine(ra-edge,.016)+imperialLine(ra-edge,.055)*.35;
  float rays=pow(max(0.,cos(an*13.-t*.35)),10.)*exp(-abs(ra-.35)/.075);
  float solar=clamp(corona+rays*.65,0.,1.);
  aura=mix(vec3(1.,.18,.015),vec3(1.,.86,.42),smoothstep(.0,1.,corona))*solar;
  opacity=solar*.78;
  float molten=fbm(buv*5.+vec2(t*.17,-t*.24));
  // Three broad, feathered reflections with independent phases and directions.
  float broad=sweep(buv,t*.095,-.72,.24);
  float small=sweep(buv,t*.079+.37,-1.05,.14);
  float opposite=sweep(buv,-t*.061+.71,2.18,.095);
  float softness=.65+.35*fbm(buv*3.+vec2(t*.09,-t*.07));
  float shine=(broad*.15+small*.10+opposite*.075)*softness;
  float veins=pow(1.-abs(molten-.5)*2.,9.);
  material=mix(base.rgb,mix(vec3(.37,.16,.025),gold,molten),.30)+gold*(shine+veins*.09);
  aura+=gold*rim*.75;opacity=max(opacity,rim*.8);
 }
 if(variant==2){
  vec2 flow=vec2(fbm(p*4.+vec2(t*.14,-t*.24)),fbm(p*4.+vec2(9.-t*.19,t*.12)));
  float curse=fbm(p*8.+flow*3.+vec2(0.,-t*.4));
  float horns=exp(-pow((abs(p.x)-(.19+.13*sin((p.y+.35)*4.)+.06*(curse-.5)))/.035,2.));
  float veil=horns*(1.-smoothstep(.28,.49,abs(p.y)))*smoothstep(.30,.65,curse);
  vec3 poison=vec3(.62,.85,.19),plum=vec3(.43,.06,.57);
  float tendrils=pow(1.-abs(curse-.5)*2.,8.);
  aura=plum*veil*1.3+poison*veil*tendrils*.55;opacity=veil*.85;
  vec2 seal=vec2(p.x,(p.y-.32)*3.);float sr=length(seal),sa=atan(seal.y,seal.x)-t*.24;
  float sigil=imperialLine(sr-.32,.009)*(.35+.65*pow(max(0.,cos(sa*7.)),5.));
  aura+=poison*sigil;opacity=max(opacity,sigil*.7);
  material=mix(base.rgb,vec3(.22,.065,.28),.18+curse*.14)+poison*rim*.25;
  float cut=exp(-pow((curse-.51)/.025,2.));material+=plum*cut*.25;
 }
 if(variant==3){
  vec3 blue=vec3(.08,.36,.66),iceLight=vec3(.74,.96,1.);
  vec2 flow=vec2(fbm(p*4.+vec2(t*.24,-t*.16)),fbm(p*4.+vec2(7.-t*.17,t*.19)));
  float cloud=fbm(p*8.+flow*3.+vec2(t*.32,-t*.13));
  // Broad twisting wind fronts, rather than a fixed throne or a circular halo.
  float envelope=1.-smoothstep(.30,.48,length(p*vec2(.86,1.)));
  float wind=0.;
  for(int j=0;j<3;j++){
   float k=float(j),y=(p.y+.22-k*.20)+.11*sin(p.x*8.+t*1.2+k)+(cloud-.5)*.13;
   float ribbon=exp(-y*y/.0017)*envelope;
   aura+=mix(blue,iceLight,smoothstep(.50,.73,cloud))*ribbon*.78;opacity=max(opacity,ribbon*.74);
   wind+=ribbon;
  }
  // A gaseous polar crown: broad diffuse light, with no polygonal debris.
  vec2 pole=p-vec2(0.,-.13);float pr=length(pole),pa=atan(pole.y,pole.x);
  vec2 polarFlow=vec2(cos(pa),sin(pa));
  float bank=fbm(polarFlow*3.2+vec2(t*.11,-t*.17));
  float fringe=.285+(bank-.5)*.065;
  float polarHalo=exp(-pow((pr-fringe)/.050,2.));
  float breathing=.65+.35*fbm(p*5.+vec2(-t*.22,t*.16));
  float curtains=pow(.5+.5*sin(pa*5.+bank*7.+t*.27),3.)*exp(-pow((pr-.32)/.105,2.));
  float dissolve=smoothstep(.27,.65,cloud)*envelope;
  vec3 boreal=mix(vec3(.20,.51,.90),iceLight,bank);
  aura+=boreal*(polarHalo*.68+curtains*.52)*breathing;
  opacity=max(opacity,(polarHalo*.52+curtains*.48)*breathing);
  float driftLight=exp(-pow((p.x+.14*sin(p.y*6.+t*.45)+(cloud-.5)*.15)/.11,2.))*dissolve;
  aura+=iceLight*driftLight*.20;opacity=max(opacity,driftLight*.25);
  front+=iceLight*(wind*.12+driftLight*.12);frontA=max(frontA,dissolve*.09);
  float frost=pow(1.-abs(cloud-.52)*2.,7.);
  float glaze=smoothstep(.39,.70,cloud)*.48;
  material=mix(base.rgb,base.rgb*vec3(.48,.76,1.)+iceLight*.20,glaze)+iceLight*(rim*.42+frost*.055);
 }
 if(variant==4){
  vec2 flow=vec2(fbm(p*4.+vec2(t*.12,-t*.20)),fbm(p*4.+vec2(7.-t*.17,t*.13)));
  float folds=fbm(p*7.+flow*2.8+vec2(0.,-t*.45));
  float mantle=exp(-pow((abs(p.x)-(.23+.10*(folds-.5)+p.y*.10))/.09,2.));
  float height=(1.-smoothstep(.18,.46,abs(p.y)));
  float silk=mantle*height*(.4+.6*smoothstep(.35,.68,folds));
  vec3 wine=mix(vec3(.35,.055,.32),vec3(.92,.23,.20),folds);
  aura=wine*silk;opacity=silk*.60;
  float filaments=pow(max(0.,1.-abs(folds-.50)*7.),7.)*mantle*height;
  aura+=gold*filaments*.36;opacity=max(opacity,filaments*.40);
  material=mix(base.rgb,wine,.23+folds*.12)+gold*filaments*.12;
  for(int i=0;i<6;i++){float k=float(i),life=fract(t*.16+k*.163),side=mod(k,2.)*2.-1.;vec2 pos=vec2(side*(.25+.04*sin(life*5.+k)),.42-life*.8);float ember=star(p-pos,.016)*sin(life*3.14159);aura+=gold*ember;opacity=max(opacity,ember*.7);}
 }
 if(variant==5||variant==6||variant==7){
  vec2 sun=p-vec2(0.,-.095);float radius=length(sun),angle=atan(sun.y,sun.x);
  float sunRadius=.257*(variant==6?mix(.15,1.,smoothstep(.45,2.15,effectAge)):1.);
  float aa=max(fwidth(radius),.0013),distance=radius-sunRadius;
  float disc=1.-smoothstep(-aa,aa,distance),outsideSun=smoothstep(-aa,aa,distance);
  vec2 polar=vec2(cos(angle),sin(angle));
  float turbulence=fbm(polar*5.+vec2(t*.08,-t*.06));
  float fine=fbm(polar*13.+vec2(radius*28.-t*.21,t*.09));
  float outer=max(distance,0.);
  float edge=exp(-outer/.006)*outsideSun;
  float corona=exp(-outer/(.045+.055*turbulence))*outsideSun;
  float rays=pow(max(0.,sin(angle*11.+turbulence*9.-t*.13)),5.)*exp(-outer/.12)*outsideSun;
  float sparksOnEdge=smoothstep(.48,.70,fine)*corona;
  vec3 amber=vec3(1.,.43,.10),pale=vec3(1.,.88,.56),violet=vec3(.33,.12,.48);
  float storm=fbm(p*6.+vec2(t*.11,-t*.16));
  float nebula=exp(-pow((radius-.33)/.11,2.))*smoothstep(.30,.64,storm);
  float frameFade=1.-smoothstep(.43,.495,max(abs(p.x),abs(p.y)));
  aura=vec3(.025,.018,.033)*disc+violet*nebula*.42+amber*(corona*.50+rays*.62+sparksOnEdge*.20)+pale*edge;
  opacity=clamp(disc*.96+nebula*.38+corona*.65+rays*.60,0.,.96);
  for(int i=0;i<5;i++){
   float k=float(i),theta=k*1.256+.3+.10*sin(t*.3+k);
   vec2 q=rotate(theta)*sun;float loopRadius=.039+.014*sin(t*.48+k);
   float loop=imperialLine(length(q-vec2(.26,0.))-loopRadius,.0045)*outsideSun;
   float pulse=.55+.45*sin(t*.7+k*2.);
   aura+=mix(amber,pale,pulse)*loop*.75;opacity=max(opacity,loop*.80);
  }
  // Ejected embers travel away from the eclipse; no shimmer crosses the material.
  for(int i=0;i<12;i++){
   float k=float(i),life=fract(t*.12+k*.177),theta=k*2.399+sin(k)*.2;
   vec2 pos=vec2(cos(theta),sin(theta))*(.27+life*.22)+vec2(0.,-.095);
   vec2 q=rotate(theta)* (p-pos);
   float ember=exp(-pow(q.y/.0035,2.))*exp(-abs(q.x)/(.012+.012*life))*sin(life*3.14159);
   aura+=pale*ember*.85;opacity=max(opacity,ember*.8);
  }
  // A slow ground shockwave ties the background to the space around the boss.
  float waveLife=fract(t*.12),ellipse=length(vec2(p.x,(p.y-.29)*3.));
  float shock=imperialLine(ellipse-(.10+waveLife*.40),.012)*sin(waveLife*3.14159);
  aura+=amber*shock*.48;opacity=max(opacity,shock*.45);
  material=base.rgb+vec3(.9,.53,.23)*rim*.25;
  if(variant==6){
   // Luminous solar prominences rise in diffuse columns around the throne.
   vec2 plumeFlow=vec2(fbm(p*3.8+vec2(t*.12,-t*.24)),fbm(p*4.2+vec2(4.-t*.14,-t*.19)));
   float plasma=fbm(p*8.+plumeFlow*3.+vec2(0.,-t*.46));
   float shoulders=exp(-pow((abs(p.x)-(.23+.065*(plasma-.5)))/.065,2.));
   float rise=shoulders*(1.-smoothstep(.18,.46,abs(p.y)))*smoothstep(.30,.69,plasma);
   aura+=mix(amber,pale,plasma)*rise*.88;opacity=max(opacity,rise*.68);
   float skin=fbm(buv*6.+plumeFlow*2.+vec2(t*.15,-t*.21));
   float veins=exp(-pow((skin-.51)/.035,2.));
   float lightWave=exp(-pow((buv.y-fract(t*.13))/.17,2.));
   vec3 obsidian=base.rgb*vec3(.68,.58,.49);
   material=mix(base.rgb,obsidian,.24+.15*skin)+mix(amber,pale,lightWave)*(veins*.28+lightWave*.14);
   material+=pale*rim*.30;
  }
  if(variant==7){
   // Gravitational tides: warped continuous light sheets, never orbiting solids.
   vec2 gravity=rotate(.35*sin(t*.12))*(p-vec2(0.,.08));
   vec2 tideFlow=vec2(fbm(p*4.+vec2(-t*.14,t*.13)),fbm(p*4.+vec2(t*.12,6.-t*.20)));
   float tideNoise=fbm(gravity*6.+tideFlow*2.5+vec2(t*.19,-t*.11));
   float lens=length(vec2(gravity.x,gravity.y*1.65));
   float bands=pow(.5+.5*sin(lens*42.-t*.90+tideNoise*6.),5.);
   float veil=exp(-pow((lens-.32)/.16,2.))*(.25+.75*tideNoise);
   vec3 spectral=mix(vec3(.26,.48,.68),vec3(.83,.57,.96),tideNoise);
   aura+=spectral*bands*veil*.72;opacity=max(opacity,bands*veil*.47);
   float skin=fbm(buv*4.5+tideFlow*2.+vec2(-t*.11,t*.18));
   float shadow=smoothstep(.39,.64,skin);
   float penumbra=exp(-pow((skin-.51)/.055,2.));
   float silk=.5+.5*sin(buv.y*9.+skin*6.-t*.65);
   material=mix(base.rgb,base.rgb*vec3(.55,.53,.72),shadow*.43);
   material+=mix(vec3(.38,.66,.88),pale,silk)*(penumbra*.22+rim*.34);
   front+=spectral*bands*veil*.16;frontA=max(frontA,bands*veil*.10);
  }
  aura*=frameFade;opacity*=frameFade;
 }
 if(awakening){
  float mist=fbm(buv*3.+vec2(1.7,-2.4));
  float skinArrival=smoothstep(.50+mist*.25,2.65+mist*.20,effectAge);
  material=mix(base.rgb,material,skinArrival);
  opacity*=arrival;aura*=arrival;frontA*=arrival;
 }
 material=mix(base.rgb,material,min(strength,1.));material=mix(material,clamp(front,0.,1.),clamp(frontA*strength,0.,.6));
 float outside=clamp(opacity*strength,0.,.9)*(1.-base.a);
 vec3 auraRGB=opacity>.001?aura/max(opacity,.15):vec3(0.);
 vec3 rgb=clamp(material,0.,1.)*base.a+clamp(auraRGB,0.,1.)*outside;
 return vec4(rgb,base.a+outside);
}
`;
