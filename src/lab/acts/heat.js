import {seeded} from './vegetation.js';
const cache=new Map(),clamp=n=>Math.max(0,Math.min(1,n));
export const heatLevel=phase=>phase==='active'?1:phase==='warning'?.48:0;
export function heatAmount(previous,current,age){const t=clamp(age/1.35),ease=t*t*(3-2*t);return heatLevel(previous)+(heatLevel(current)-heatLevel(previous))*ease;}
function cracks(seed){
 if(cache.has(seed))return cache.get(seed);const random=seeded(seed),paths=[];
 for(let j=0;j<3;j++){
  const p=[[j/3+.06,0]];for(let i=1;i<=7;i++)p.push([Math.max(.02,Math.min(.98,p[i-1][0]+(random()-.5)*.32)),i/7]);paths.push(p);
  for(let i=2;i<6;i+=2)paths.push([p[i],[Math.max(.02,Math.min(.98,p[i][0]+(random()>.5?.22:-.22))),p[i][1]+.06],[Math.max(.02,Math.min(.98,p[i][0]+(random()>.5?.3:-.3))),p[i][1]+.15]]);
 }cache.set(seed,paths);return paths;
}
export function drawHeat(ctx,x,y,u,time,amount,seed){
 ctx.save();ctx.beginPath();ctx.rect(x,y,u,u);ctx.clip();ctx.lineJoin='round';ctx.lineCap='round';
 const paths=cracks(seed);
 for(const points of paths){
  // Heat propagates along each fissure, with a broad translucent halo.
  const grad=ctx.createLinearGradient(x,y,x+u,y+u),front=amount*1.7;
  grad.addColorStop(0,`rgba(241,80,26,${amount*.25})`);grad.addColorStop(Math.min(.99,Math.max(.01,front)),`rgba(246,97,29,${amount*.14})`);grad.addColorStop(1,'#c1270c00');
  ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(x+a*u,y+b*u):ctx.moveTo(x+a*u,y+b*u));ctx.strokeStyle=grad;ctx.lineWidth=u*.18;ctx.stroke();
  ctx.strokeStyle='#302b2a88';ctx.lineWidth=u*.022;ctx.stroke();
  if(amount>.005){
   ctx.globalAlpha=amount;ctx.shadowColor='#ff5c1d';ctx.shadowBlur=u*.12*amount;
   const glow=ctx.createLinearGradient(x,y,x,y+u);glow.addColorStop(0,'#ffe4aa');glow.addColorStop(.5,'#f78843');glow.addColorStop(1,'#c74924');ctx.strokeStyle=glow;ctx.lineWidth=u*(.008+.016*amount);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
 }
 if(amount>.7){ctx.globalAlpha=(amount-.7)*.55;ctx.fillStyle='#ffb964';for(let i=0;i<3;i++){const f=(time*.19+i*.31+seed*.01)%1;ctx.beginPath();ctx.arc(x+u*(.2+i*.27),y+u*(.9-f*.7),u*.013*(1-f),0,Math.PI*2);ctx.fill();}}
 ctx.restore();
}
