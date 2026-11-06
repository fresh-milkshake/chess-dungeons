// Preparation only: the battle itself always has complete information.
export function preparationVision(bounds,owned=[]){
 const columns=bounds.right-bounds.left+1,rows=bounds.top-bounds.bottom+1,enemyRows=Math.max(0,rows-3),hidden=new Set();
 for(let rank=bounds.top;rank>bounds.top-enemyRows;rank--)for(let file=bounds.left;file<=bounds.right;file++)hidden.add('abcdefghijklmnop'[file]+rank);
 return {columns,rows,edge:enemyRows/rows,hidden,mode:owned.includes('mirage')?'mirage':'fog'};
}

// Centre the soft transition on the boundary of the three home ranks. GPU
// noise displaces this profile locally; the quintic curve has no hard ends.
export function preparationKnowledge(vision,height=256){
 const data=new Uint8Array(2*height),start=vision.edge-.60/vision.rows,end=vision.edge+.60/vision.rows;
 for(let y=0;y<height;y++){
  const t=Math.max(0,Math.min(1,(y/(height-1)-start)/(end-start)));
  const value=Math.round((1-t*t*t*(t*(t*6-15)+10))*255);
  data[y*2]=data[y*2+1]=value;
 }
 return data;
}
