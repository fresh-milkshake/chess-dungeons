function line(ctx,points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
export function drawIceFallback(ctx,x,y,u,t,cracked){
 ctx.fillStyle='#b3e9ef55';ctx.fillRect(x+1,y+1,u-2,u-2);
 ctx.fillStyle='#ecfcff66';ctx.beginPath();ctx.moveTo(x+2,y+2);ctx.lineTo(x+u*.8,y+2);ctx.lineTo(x+u*.23,y+u*.7);ctx.fill();
 line(ctx,[[x+u*.1,y+u*.85],[x+u*.85,y+u*.15]],'#edfcff99',1);
 if(cracked){line(ctx,[[x+u*.2,y],[x+u*.43,y+u*.34],[x+u*.35,y+u*.61],[x+u*.74,y+u]],'#334f64',1.7);line(ctx,[[x+u*.43,y+u*.34],[x+u*.8,y+u*.24],[x+u,y+u*.41]],'#334f64',1.3);line(ctx,[[x+u*.35,y+u*.61],[x,y+u*.75]],'#334f64',1.2);}
 else{const a=.2+.12*Math.sin(t*.7+x);line(ctx,[[x+u*.27,y+u*.13],[x+u*.68,y+u*.13]],`rgba(245,255,255,${a})`,1.5);}
}
