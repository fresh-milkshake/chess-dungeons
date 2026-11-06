/** Contact shadows follow the union boundary, without wall side faces. */
export function drawAtlasShadows(ctx,walls,holes,size){
 const u=288/size,wall=(x,y)=>walls.has(`${x},${y}`);
 ctx.save();ctx.beginPath();
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!wall(x,y)&&!holes.has(`${x},${y}`))ctx.rect(16+x*u,16+y*u,u,u);
 ctx.clip();ctx.beginPath();
 const segment=(x,y,dx,dy)=>{ctx.moveTo(16+x*u,16+y*u);ctx.lineTo(16+(x+dx)*u,16+(y+dy)*u);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(wall(x,y)){
  if(!wall(x,y-1))segment(x,y,1,0);
  if(!wall(x+1,y))segment(x+1,y,0,1);
  if(!wall(x,y+1))segment(x,y+1,1,0);
  if(!wall(x-1,y))segment(x,y,0,1);
 }
 ctx.strokeStyle='#060b0b65';ctx.lineWidth=1.4;ctx.shadowColor='#050a0bd9';ctx.shadowBlur=6;ctx.shadowOffsetY=1.2;ctx.stroke();
 ctx.shadowBlur=2;ctx.lineWidth=.7;ctx.stroke();ctx.restore();
}

export function drawPieceContact(ctx,x,y,u){
 ctx.save();ctx.fillStyle='#060b0b45';ctx.shadowColor='#03070780';ctx.shadowBlur=u*.09;
 ctx.beginPath();ctx.ellipse(x,y+u*.30,u*.28,u*.10,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
