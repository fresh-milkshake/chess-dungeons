import {heatAmount} from './heat.js';
export function furnaceLights(ctx,scene,previous,age,time){
 const u=288/scene.size;ctx.save();ctx.beginPath();ctx.rect(16,16,288,288);ctx.clip();ctx.globalCompositeOperation='screen';
 for(const tile of scene.tiles.filter(t=>t.type==='heat')){
  const before=previous?.tiles.find(p=>p.x===tile.x&&p.y===tile.y),a=heatAmount(before?.phase??tile.phase,tile.phase,age);if(a<.01)continue;
  const x=16+(tile.x+.5)*u,y=16+(tile.y+.5)*u,pulse=.94+.06*Math.sin(time*2.1+tile.x*3+tile.y),glow=ctx.createRadialGradient(x,y,0,x,y,u*1.65);
  glow.addColorStop(0,`rgba(255,145,42,${a*.44*pulse})`);glow.addColorStop(.35,`rgba(244,75,17,${a*.27*pulse})`);glow.addColorStop(1,'#fc4a0000');ctx.fillStyle=glow;ctx.fillRect(x-u*1.7,y-u*1.7,u*3.4,u*3.4);
 }
 ctx.restore();
}
