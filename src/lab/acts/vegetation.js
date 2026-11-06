const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
export function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
const paths=new Map();
export function vinePaths(seed){
 if(paths.has(seed))return paths.get(seed);
 const random=seeded(seed),result=[];
 for(let j=0;j<4;j++){
  const phase=random()*TAU,vertical=random()>.5,lane=(j+.5)/4,points=[];
  for(let i=0;i<=64;i++){
   const t=i/64,a=.02+t*.96,b=Math.max(.06,Math.min(.94,lane+Math.sin(t*TAU*.8+phase)*.095+Math.sin(t*TAU*2+phase)*.035));
   points.push(vertical?[b,a]:[a,b]);
  }
  result.push({points,delay:j*.16,leaves:Array.from({length:8},(_,i)=>({at:5+i*7,side:i%2?1:-1,size:.06+random()*.028}))});
 }
 paths.set(seed,result);return result;
}
function leaf(ctx,x,y,size,angle,color,scale=1){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.fillStyle=color;ctx.strokeStyle='#23452a';ctx.lineWidth=.5;
 ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(size*.1,-size*.65,size,0);ctx.quadraticCurveTo(size*.35,size*.54,0,0);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(size*.83,0);ctx.strokeStyle='#b7c68866';ctx.stroke();ctx.restore();
}
export function drawVines(ctx,x,y,u,time,age,seed,active=false){
 ctx.save();ctx.beginPath();ctx.rect(x,y,u,u);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';
 for(const path of vinePaths(seed)){
  const growth=clamp((age-path.delay)/2.8),end=growth*64,tip=Math.floor(end),points=path.points;
  if(!tip)continue;
  ctx.beginPath();for(let i=0;i<=tip;i++){const p=points[i];i?ctx.lineTo(x+p[0]*u,y+p[1]*u):ctx.moveTo(x+p[0]*u,y+p[1]*u);}
  if(tip<64){const a=points[tip],b=points[tip+1],f=end-tip;ctx.lineTo(x+(a[0]+(b[0]-a[0])*f)*u,y+(a[1]+(b[1]-a[1])*f)*u);}
  ctx.strokeStyle='#173e24';ctx.lineWidth=u*.043;ctx.stroke();ctx.strokeStyle=active?'#6c9e45':'#5f8e43';ctx.lineWidth=u*.023;ctx.stroke();ctx.strokeStyle='#b9c87966';ctx.lineWidth=u*.007;ctx.stroke();
  for(const l of path.leaves){const reveal=clamp((end-l.at)/4);if(!reveal)continue;const p=points[l.at],q=points[l.at+1],angle=Math.atan2(q[1]-p[1],q[0]-p[0])+l.side*(.8+Math.sin(time*.4+l.at)*.035);leaf(ctx,x+p[0]*u,y+p[1]*u,u*l.size,angle,l.side>0?'#71964c':'#4a753b',reveal);}
 }
 ctx.restore();
}
export function gardenDetails(ctx,x,y,u,kind,seed,time){
 const r=seeded(seed);ctx.save();ctx.globalAlpha=.85;
 for(let j=0;j<3;j++){
  const a=.1+r()*.8,b=j%2?.85:.12+r()*.15,px=x+a*u,py=y+b*u;
  if(kind==='grass'){
   ctx.lineWidth=u*.012;ctx.strokeStyle='#48663f';
   for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+(i-1.5)*u*.02,py-u*.05,px+(i-1.5)*u*.04+Math.sin(time*.5+seed)*u*.008,py-u*(.08+r()*.06));ctx.stroke();}
  }else if(kind==='clover'){
   for(let i=0;i<3;i++)leaf(ctx,px,py,u*.055,i*TAU/3,'#67894d');
  }else{
   const color=kind==='flowers'?'#e4d8b5':'#99b9ca';
   for(let i=0;i<5;i++){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(px+Math.cos(i*TAU/5)*u*.026,py+Math.sin(i*TAU/5)*u*.026,u*.025,u*.014,i*TAU/5,0,TAU);ctx.fill();}
   ctx.fillStyle='#baa15c';ctx.beginPath();ctx.arc(px,py,u*.013,0,TAU);ctx.fill();
  }
 }
 ctx.restore();
}
