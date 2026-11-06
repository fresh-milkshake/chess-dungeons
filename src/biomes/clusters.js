/** Sparse bites, mostly 2–3 neighbouring cells, with occasional solitary gaps. */
export function clusteredCells(cells,count,rng,point,accept=()=>true){
 const remaining=[...cells],chosen=[];let cluster=[];
 while(remaining.length&&chosen.length<count){
  const adjacent=cluster.length<3?remaining.filter(c=>cluster.some(p=>{const a=point(c),b=point(p);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;})):[];
  const growing=adjacent.length&&rng()<.86;
  const candidate=growing?adjacent[Math.floor(rng()*adjacent.length)]:remaining[Math.floor(rng()*remaining.length)];
  remaining.splice(remaining.indexOf(candidate),1);
  if(!accept(candidate))continue;
  if(!growing)cluster=[];cluster.push(candidate);chosen.push(candidate);
 }
 return chosen;
}
