/** Stable distribution shared by the atlas and real boards, including old saves. */
export function gardenDecorations(cells){
 const rank=p=>{const n=Math.sin((p.x+1)*127.1+(p.y+1)*311.7)*43758.5453;return (n%1+1)%1;};
 return [...cells].sort((a,b)=>rank(a)-rank(b)).slice(0,Math.round(cells.length*.4))
  .map((p,i)=>({...p,type:['grass','clover','flowers','blueflowers'][i%4]}));
}

export function keepTerrainOverlay(kind,rooted,unseen,overlay){
 return !unseen&&(overlay.rooted==='true'?rooted:overlay.kind===kind);
}
