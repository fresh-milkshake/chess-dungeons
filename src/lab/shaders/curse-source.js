// Localized moving marks: never replace the material or distort the piece silhouette.
export const curseSource = `

vec4 curseAlternate(vec4 base,float t){
 vec2 p=uv-.5;float inner=base.a,outer=base.a;
 for(int i=0;i<8;i++){float a=float(i)*TAU/8.;vec2 d=vec2(cos(a),sin(a));inner=min(inner,texture(sprite,uv+d*.014).a);outer=max(outer,texture(sprite,uv+d*.027).a);}
 float edge=max(0.,base.a-inner),mist=max(0.,outer-base.a);
 vec3 violet=vec3(.51,.16,.68),sick=vec3(.59,.74,.26),col=base.rgb,aura=vec3(0.);float alpha=0.;
 float strength=clamp(intensity,0.,2.);
 if(variant==2){
  float chains=0.,frontChains=0.;
  for(int j=0;j<2;j++){
   float k=float(j),tilt=(k-.5)*.95;
   vec2 q=rotate(tilt)*p;q.y*=2.6;
   float angle=atan(q.y,q.x),radius=length(q);
   float phase=angle*9.+t*(k==0.?.32:-.27);
   float ring=exp(-pow((radius-.25)/.012,2.));
   float links=.25+.75*pow(abs(sin(phase)),.65);
   float chain=ring*links;chains+=chain;frontChains+=chain*smoothstep(-.05,.07,q.y);
  }
  float breath=.65+.35*sin(t*1.35);
  aura=violet*chains;alpha=clamp(chains*.65,0.,.75);
  col=mix(col,vec3(.40,.18,.53),clamp(frontChains*.36*breath*strength,0.,.38));
  col+=sick*edge*.08*breath*strength;
 }
 if(variant==3){
  vec2 cracks=cells(uv*6.5);
  float narrow=1.-smoothstep(.010,.048,cracks.y);
  float pulse=smoothstep(.38,.66,fbm(uv*5.+vec2(t*.20,-t*.13)));
  float veins=narrow*pulse;
  col=mix(col,col*.48+vec3(.27,.065,.29),veins*.26*strength);
  col+=vec3(.58,.16,.50)*veins*.16*strength;
  aura=violet;alpha=mist*(.18+.20*pulse);
 }
 if(variant==4){
  float foreground=0.;
  for(int i=0;i<18;i++){
   float k=float(i),angle=k*2.399+t*(.32+.035*mod(k,3.));
   float radius=.20+.13*hash(vec2(k,8.));vec2 pos=vec2(cos(angle)*radius,sin(angle)*.34);
   vec2 q=rotate(angle*1.7)*(p-pos);float d=max(abs(q.x)-.007,abs(q.y)-(.012+.008*mod(k,3.)));
   float ash=1.-smoothstep(-.001,.002,d),pulse=.5+.5*sin(t*.9+k*1.7);
   vec3 color=mod(k,4.)==0.?sick:vec3(.28,.08,.36);
   aura+=color*ash;alpha=max(alpha,ash*(.50+.30*pulse));
   foreground+=ash*smoothstep(-.12,.16,sin(angle));
  }
  col=mix(col,vec3(.16,.08,.19),clamp(foreground*.24*strength,0.,.28));
  float swarmPulse=.65+.35*sin(t*1.3);
  aura+=violet*mist*.22*swarmPulse;alpha=max(alpha,mist*.30*swarmPulse);
  col+=violet*edge*.22*strength;
 }
 if(variant==5){
  vec2 q=uv*5.;vec2 flow=vec2(fbm(q+vec2(t*.12,-t*.17)),fbm(q+vec2(8.-t*.14,t*.09)));
  float ink=fbm(q*1.8+flow*3.+vec2(0.,t*.26));
  float tar=smoothstep(.52,.70,ink),vein=exp(-pow((ink-.55)/.025,2.));
  col=mix(col,base.rgb*.45+vec3(.09,.025,.12),tar*.28*strength);
  col+=violet*vein*.085*strength;
  aura=mix(vec3(.14,.055,.20),violet,ink);alpha=mist*(.22+.32*tar);
  for(int i=0;i<7;i++){
   float k=float(i),life=fract(t*.12+k*.157),side=mod(k,2.)*2.-1.;
   vec2 pos=vec2(side*(.24+.035*sin(k+life*8.)),.34-life*.70);
   vec2 d=(p-pos)*vec2(1.,.7);float drop=exp(-dot(d,d)/.00011)*sin(life*3.14159);
   aura+=sick*drop*.30;alpha=max(alpha,drop*.40);
  }
 }
 // Preserve the original alpha silhouette and cap all surface occlusion.
 float outside=clamp(alpha*strength,0.,.75)*(1.-base.a);
 vec3 auraColor=alpha>.001?aura/max(alpha,.15):vec3(0.);
 return vec4(clamp(col,0.,1.)*base.a+clamp(auraColor,0.,1.)*outside,base.a+outside);
}

vec4 curseEffect(vec4 base,float t){
 if(variant>1)return curseAlternate(base,t);
 vec2 p=uv-.5;
 vec2 flow=vec2(fbm(p*5.+vec2(t*.13,-t*.20)),fbm(p*5.+vec2(6.-t*.16,t*.10)));
 float smoke=fbm(p*9.+flow*2.5+vec2(t*.12,-t*.27));
 float pulse=.65+.35*sin(t*1.8);
 float inner=base.a,outer=base.a;
 for(int i=0;i<8;i++){float a=float(i)*TAU/8.;vec2 d=vec2(cos(a),sin(a));inner=min(inner,texture(sprite,uv+d*.016).a);outer=max(outer,texture(sprite,uv+d*(.018+.013*smoke)).a);}
 float edge=max(0.,base.a-inner),mist=max(0.,outer-base.a);
 float ribbon=exp(-pow((smoke-.51)/.065,2.));
 vec3 violet=vec3(.56,.12,.72),sick=vec3(.68,.78,.25);
 vec3 col=mix(base.rgb,base.rgb*.65+violet*.25,ribbon*.16*intensity);
 col+=violet*edge*(.16+.14*pulse)*intensity;
 // A broken, slowly counter-rotating binding seal at the feet.
 vec2 q=rotate(-t*.16)*vec2(p.x,(p.y-.31)*3.5);
 float angle=atan(q.y,q.x),radius=length(q);
 float broken=.25+.75*smoothstep(-.2,.5,sin(angle*3.+t*.4));
 float ring=exp(-abs(radius-.28)/.012)*broken;
 vec2 mark=uv-vec2(.5,.24);
 float slash=max(line(mark.x-mark.y,.009),line(mark.x+mark.y,.009))*(1.-smoothstep(.055,.085,length(mark)));
 float markA=slash*(.34+.16*pulse)*intensity;
 col=mix(col,sick,markA);
 float outside=clamp((mist*(.24+.30*ribbon)+ring*.55)*intensity,0.,.7)*(1.-base.a);
 vec3 aura=mix(violet,sick,ring*.65);
 return vec4(clamp(col,0.,1.)*base.a+aura*outside,base.a+outside);
}
`;
