export const fogFragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 fragColor;
uniform float time;uniform int variant;uniform sampler2D knowledge;
uniform vec2 worldOrigin;uniform vec2 worldSize;uniform vec2 maskSize;
uniform vec3 boardTint;
uniform vec2 patternOffset;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float cloud(vec2 p){return noise(p)*.67+noise(p*2.03+7.1)*.33;}
float smokeBanks(vec2 p,float t){
 p+=patternOffset;
 // Aperiodic low-frequency distortion breaks the old repeating sine bands.
 vec2 warp=vec2(noise(p*.19+vec2(t*.07,41.2)),noise(p*.17+vec2(19.7,-t*.05)))-.5;
 vec2 q=p+warp*3.2;
 vec2 a=mat2(.87,-.49,.49,.87)*q*vec2(.63,1.05)+vec2(-t,t*.23);
 vec2 b=mat2(-.66,.75,-.75,-.66)*q*vec2(1.2,.76)+vec2(t*.31,-t*.43)+29.4;
 return noise(a)*.60+noise(b)*.40;
}
void main(){
 vec2 p=worldOrigin+uv*worldSize;
 float hidden=any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,maskSize))?1.:texture(knowledge,p/maskSize).r;float t=time*.18;float n;
 if(variant==0)n=cloud(p*.8+vec2(-t,t*.24));
 else if(variant==1)n=smokeBanks(p,t);
 else if(variant==2){vec2 q=p-vec2(6.,3.);float a=atan(q.y,q.x)+t*.24;float r=length(q);n=cloud(vec2(cos(a),sin(a))*r*.85+vec2(t*.3,0));}
 else if(variant==3)n=cloud(vec2(p.x*1.7+sin(p.y*.6-t)*.35,p.y*.48-t*.75));
 else if(variant==4)n=cloud(p*.7+vec2(sin(t*.6),cos(t*.4))*.7)*(.8+.2*sin(time*.5+p.x*.8));
 else if(variant==5)n=smokeBanks(p,t);
 else if(variant==6)n=cloud(p*.62+vec2(-t*.55,sin(p.x*.6-t)*.65));
 else if(variant==7)n=cloud(vec2(p.x*.95+sin(p.y*.8+t)*.6,p.y*.8-t*.5));
 else if(variant==8)n=cloud(vec2(p.x*.5-t*.4,p.y*1.5+sin(p.x*.65-t)*.8));
 else n=cloud(p*.55+vec2(sin(t*.7+p.y*.3),-t*.4));
 n=smoothstep(.15,.85,n);
 float edge=smoothstep(.02,.45,hidden);
 float alpha=mix(clamp(hidden*(.95+.3*n),0.,1.),.965+.025*n,smoothstep(.64,.95,hidden));
 alpha=max(alpha,edge*.14*n);
 vec3 tint=mix(vec3(.015,.022,.028),vec3(.18,.21,.23),n*.8);
 if(variant>=5){
  // Keep only a faint board tint: dense fog should read as mist, not sand.
  vec2 lightness=vec2(.58,1.08);
  if(variant==6)lightness=vec2(.72,1.14);
  else if(variant==7)lightness=vec2(.48,.98);
  else if(variant==8)lightness=vec2(.60,1.08);
  else if(variant==9)lightness=vec2(.68,1.08);
  float luminance=dot(boardTint,vec3(.2126,.7152,.0722));
  vec3 paleTint=mix(mix(vec3(luminance),boardTint,.18),vec3(.86),.12);
  tint=paleTint*mix(lightness.x,lightness.y,n);
  alpha=mix(clamp(hidden*(1.05+.24*n),0.,1.),1.,smoothstep(.65,.95,hidden));
 }
 fragColor=vec4(tint,clamp(alpha,0.,1.));
}`;
