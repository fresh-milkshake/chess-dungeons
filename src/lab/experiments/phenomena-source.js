/** Original, bounded procedural approximations; see PHENOMENA.md for references. */
export const phenomenaSource=`
float matterNoise3(vec3 p){
 float z=floor(p.z),f=fract(p.z);f=f*f*(3.-2.*f);
 return mix(noise(p.xy+vec2(z*37.,z*19.)),noise(p.xy+vec2((z+1.)*37.,(z+1.)*19.)),f);
}
vec2 matterFlow(vec2 p,float t){
 return vec2(fbm(p+vec2(t*.045,-t*.019)),fbm(p+vec2(8.-t*.024,t*.031)))-.5;
}
vec3 matterVolume(vec2 p,float t,int variant,float checker){
 vec3 accumulated=vec3(0.);float transmittance=1.;
 float v=float(variant);
 vec2 q=p*.85;
 if(variant==1){vec2 d=q-vec2(.4,-.2);q+=vec2(-d.y,d.x)*.38/(.32+dot(d,d));}
 if(variant==2)t*=mix(-.55,.55,checker);
 for(int i=0;i<6;i++){
  float depth=float(i)*.37;
  vec3 position=vec3(q*(1.+depth*.12)+vec2(depth*.19,-depth*.24),depth+v*3.7);
  position.xy+=matterFlow(position.xy*.65,t+depth*4.)*.65;
  position+=vec3(t*.008,-t*.011,t*.024);
  float density=matterNoise3(position*2.)*.66+matterNoise3(position*4.1+8.)*.34;
  float extinction=smoothstep(.40,.74,density)*.75;
  float light=matterNoise3(position*2.+vec3(-.18,-.23,.3));
  vec3 gas=mix(vec3(.012,.018,.028),vec3(.19,.22,.25),smoothstep(.35,.75,light));
  if(variant==4)gas=mix(gas,vec3(.28,.21,.12),pow(density,5.)*2.);
  float alpha=1.-exp(-extinction*.48);
  accumulated+=transmittance*alpha*gas;transmittance*=1.-alpha;
 }
 return accumulated;
}
// Analytic wave slope: the normal, reflection and caustic coordinates all move.
vec3 matterWater(vec2 p,float t,int variant){
 vec3 wave=vec3(0.);float amplitude=.34;
 for(int i=0;i<5;i++){
  float k=float(i),angle=k*2.399+float(variant)*.31;
  vec2 direction=vec2(cos(angle),sin(angle));float frequency=2.4+k*1.7;
  float phase=dot(p,direction)*frequency+t*(.45+k*.13);
  float crest=exp(sin(phase)-1.);
  wave.xy+=direction*frequency*cos(phase)*crest*amplitude;
  wave.z+=crest*amplitude;amplitude*=.61;
 }
 return wave;
}
vec3 matterFilm(float thickness,float facing){
 vec3 wavelength=vec3(650.,510.,475.);
 vec3 phase=12.5663706*1.33*thickness*max(facing,.15)/wavelength;
 return .5+.5*cos(phase);
}
vec3 newWorldMatter(vec2 p,float checker,int world,int variant,float t,float impulse,vec3 base){
 float v=float(variant);vec2 q=p+vec2(v*3.71,v*2.83);
 vec2 flow=matterFlow(q*.85,t);
 if(world==0){
  vec3 volume=matterVolume(q,t,variant,checker);
  float density=fbm(q*1.3+flow*2.);
  vec3 c=base*(.80+density*.32);
  if(variant==3){
   vec2 liquid=q+flow*1.5;
   float height=fbm(liquid*2.4);
   vec2 slope=vec2(noise(liquid*5.+vec2(.04,0))-noise(liquid*5.-vec2(.04,0)),noise(liquid*5.+vec2(0,.04))-noise(liquid*5.-vec2(0,.04)))*6.;
   float highlight=pow(max(0.,dot(normalize(vec3(-slope,1.)),normalize(vec3(-.3,-.4,1.)))),24.);
   c=base*(.72+height*.55)+vec3(.24,.27,.30)*highlight*.34;
  }else c+=volume*mix(1.15,.75,checker);
  // Polished black matter contains light; it never reveals the scenery beneath.
  c+=impulse*volume*.12;
  return mix(base,c,.82);
 }
 if(world==1){
  vec3 wave=matterWater(q*.95,t,variant);
  vec3 normal=normalize(vec3(-wave.xy*.20,1.));
  vec2 refracted=q+wave.xy*.14+flow*.2;
  float focus=pow(max(0.,1.-abs(sin(refracted.x*5.+wave.z*3.)+cos(refracted.y*4.-wave.z*4.))*.67),9.);
  float reflection=pow(max(dot(normal,normalize(vec3(-.16,-.25,1.))),0.),38.);
  float fresnel=.04+.96*pow(1.-normal.z,5.);
  vec3 c=base*(.87+wave.z*.18)+vec3(.10,.31,.29)*focus*.60;
  c+=vec3(.32,.44,.42)*reflection*(.22+fresnel);
  if(variant==1){
   float ink=smoothstep(.40,.64,fbm(q*1.1+flow*2.4+vec2(t*.025,0.)));
   c=mix(base,base*vec3(.36,.78,.87),ink*.50)+focus*vec3(.06,.18,.17);
  }
  if(variant==2){
   vec3 film=matterFilm(280.+fbm(q+flow)*240.+wave.z*60.,normal.z);
   c=base*(.78+film*.24)+reflection*film*.24+focus*vec3(.06,.13,.11);
  }
  if(variant==3){
   float phase=fbm(q*2.+flow*.4)+sin(t*.17)*.09;
   float frozen=smoothstep(.43,.57,phase);
   c=mix(c,base*.92+vec3(.07,.11,.12)*fbm(q*13.),frozen*.72);
  }
  if(variant==4){
   vec2 counterflow=matterFlow(q*1.8,-t*.65);
   float turbulence=pow(fbm(q*3.+counterflow*3.),3.);
   c+=vec3(.13,.34,.30)*turbulence;
  }
  return c+impulse*vec3(.016,.028,.025)*(focus+.3);
 }
 if(world==2){
  float vapour=0.,transmittance=1.;
  for(int i=0;i<5;i++){
   float depth=float(i)*.42;
   vec3 pos=vec3(q*.9+flow*.5+vec2(depth*.25,-depth*.2),depth+t*.06+v*4.);
   float density=smoothstep(.30,.76,matterNoise3(pos*2.));
   float alpha=1.-exp(-density*.35);vapour+=transmittance*alpha;transmittance*=1.-alpha;
  }
  float phase=fbm(q*.8+flow*1.8+vec2(t*.018,-t*.012));
  vec3 c=base*(.79+phase*.36);
  if(variant==0)c=mix(c,vec3(.20,.36,.29),vapour*.35);
  if(variant==1){
   float red=matterNoise3(vec3(q*3.+flow*.4+vec2(.025,0),t*.04));
   float green=matterNoise3(vec3(q*3.+flow*.4,t*.04));
   float blue=matterNoise3(vec3(q*3.+flow*.4-vec2(.025,0),t*.04));
   c+=vec3(red,green,blue)*.09-vapour*.025;
  }
  if(variant==2)c=base*(1.10-vapour*.5)+vec3(.04,.07,.055)*(1.-phase);
  if(variant==3){
   float shimmer=fbm(q*3.+flow*3.+vec2(0.,sin(t*.24)*.1));
   c=base*(.75+shimmer*.55)+vapour*vec3(.045,.10,.08);
  }
  if(variant==4){
   float condensation=smoothstep(.32,.67,phase+sin(t*.23)*.08);
   c=mix(base*.65,base*1.13,condensation)+vapour*vec3(.04,.075,.06);
  }
  return c+impulse*vec3(.012,.02,.016);
 }
 if(world==3){
  vec2 rock=q*1.5+flow*.35;
  float pressure=fbm(rock+vec2(t*.006,-t*.004));
  float fissure=1.-smoothstep(.018,.13,abs(sin(rock.x*2.+rock.y+fbm(rock*1.4)*10.)));
  float heat=fbm(rock*2.1+flow*1.7+vec2(-t*.026,t*.012));
  float cooling=.5+.5*sin(t*.22+v+pressure*6.);
  float opening=smoothstep(.43,.68,heat+cooling*.08);
  float molten=fissure*opening;
  vec3 c=base*(.86+pressure*.25);
  vec3 emission=vec3(.66,.13,.015);
  if(variant==1){molten=pow(fissure,2.)*smoothstep(.40,.7,heat);emission=vec3(.32,.12,.035);}
  if(variant==2){molten=pow(noise(rock*35.+flow*.1),10.)*opening*.6;emission=vec3(.78,.20,.025);}
  if(variant==3){
   vec3 film=matterFilm(310.+heat*260.,.92);
   c+=film*pow(pressure,3.)*.11;molten*=.26;emission=vec3(.38,.18,.04);
  }
  if(variant==4){
   float pores=pow(1.-noise(rock*12.),7.);molten=pores*opening;
   c=mix(c,base*.74,smoothstep(.50,.70,heat)*.3);
  }
  return c+emission*molten*.36+emission*impulse*molten*.09;
 }
 if(world==4){
  vec2 mineral=q+flow*.24;
  float stone=fbm(mineral*1.7);
  float phase=mineral.x*3.+mineral.y+fbm(mineral)*12.;
  float strata=.5+.5*sin(phase);
  vec3 normal=normalize(vec3((noise(mineral*7.+.03)-noise(mineral*7.-.03))*1.8,flow.y*.6,1.));
  float highlight=pow(max(dot(normal,normalize(vec3(-.12,-.2,1.))),0.),40.);
  vec3 c=base*(.85+stone*.26);
  if(variant==0){
   float goldFlow=pow(.5+.5*sin(phase+sin(t*.22+stone*4.)*.7),8.);
   c+=mix(vec3(.025,.10,.045),vec3(.22,.15,.05),checker)*goldFlow*.55;
   c+=highlight*mix(vec3(.035,.07,.04),vec3(.20,.16,.075),checker);
  }
  if(variant==1){
   vec3 internal=matterVolume(mineral,t*.45,4,checker);
   c+=internal*mix(vec3(.45,1.5,.65),vec3(1.2,.8,.35),checker)*.65;
  }
  if(variant==2){
   vec3 film=matterFilm(260.+stone*270.+sin(t*.18)*65.,normal.z);
   c=base*(.84+film*.26)+film*highlight*.13;
  }
  if(variant==3){
   float direction=sin(mineral.x*5.+flow.x*3.+t*.10);
   float anisotropy=pow(max(0.,1.-abs(direction*.25+mineral.y*.045)),12.);
   c+=mix(vec3(.045,.07,.035),vec3(.20,.14,.05),checker)*anisotropy*.65;
  }
  if(variant==4){
   float growth=.5+.5*sin(stone*12.-t*.18);
   float deposits=smoothstep(.68,.88,strata+growth*.12);
   c=mix(c,base*1.14,deposits*.55)+highlight*vec3(.10,.075,.025)*deposits;
  }
  return c+impulse*highlight*vec3(.03,.024,.012);
 }
 return base;
}
`;
