import {chooseEloMove} from './difficulty.js';
import {moveParts,rank} from './coordinates.js';

/** Iterative alpha-beta with bounded transpositions and tactical leaf extensions. */
export function variantSearch({board,bounds,turn,mode,ep,depth,milliseconds,legal,apply,threatened,wildChoice,required=[],elo=null,random=Math.random}){
 const mandatory=new Set(required),weights={p:100,n:320,b:330,r:510,q:950,k:20000,d:760,j:240};
 const started=performance.now(),deadline=started+Math.max(10,Math.min(milliseconds,5000)),table=new Map(),history=new Map();
 let nodes=0,qnodes=0,ttHits=0,doneDepth=0,completedCandidates=[];
 const timeout=()=>{if((++nodes&15)===0&&performance.now()>=deadline)throw budget;},budget=Symbol('search budget');
 const next=(b,t)=>t==='w'?([...b.values()].some(p=>p.color==='b')?'b':'x'):t==='b'&&[...b.values()].some(p=>p.color==='wild')?'x':'w';
 const evaluate=b=>{
  let score=0;const cx=(bounds.left+bounds.right)/2,cy=(bounds.bottom+bounds.top)/2;
  for(const [s,p] of b){
   const center=Math.max(0,4-(Math.abs(s.charCodeAt(0)-97-cx)+Math.abs(rank(s)-cy))*.6);
   const advance=p.color==='w'?rank(s)-bounds.bottom:bounds.top-rank(s);
   let v=(weights[p.type]??0)+(p.hp-1)*Math.min(250,weights[p.type]*.45)+(p.damage-1)*130;
   if(p.type!=='k'){v+=center*(['n','b','j','d'].includes(p.type)?9:3);if(p.type==='p')v+=advance*7;if(p.cursed)v*=.58;if(p.rooted)v-=24;}
   score+=(p.color==='w'?1:p.color==='wild'&&p.neutral&&!mandatory.has(p.wildId)?0:-1)*v;
  }return score;
 };
 const terminal=(b,d)=>{
  const ps=[...b.values()];if(!ps.some(p=>p.type==='k'&&p.color==='w'))return -1e6-d;
  if(mode==='clear'&&!ps.some(p=>p.color==='b'||p.color==='wild'&&(!p.neutral||mandatory.has(p.wildId))))return 1e6+d;
  if(mode==='solo'&&!ps.some(p=>p.color==='wild')||mode==='mixed'&&!ps.some(p=>p.type==='k'&&p.color==='b'))return 1e6+d;
  return null;
 };
 const key=(b,t,passant)=>t+'|'+passant+'|'+[...b].map(([s,p])=>`${s}:${p.color}${p.type}${p.hp}${p.damage}${+!!p.glass}${p.rooted??0}${+!!p.cursed}${p.curseTurns??0}${+!!p.curseBase}${+!!p.iced}${+!!p.emperor}${+!!p.neutral}${p.aggro??''}${p.wildId??''}`).sort().join(',')+'|'+((b.world?.round??0)%3)+'|'+Object.entries(b.world?.tiles??{}).sort().join(',')+'|'+JSON.stringify(b.relics??null);
 const moveScore=(b,m,t,pv)=>{
  if(m===pv)return 1e9;const {from,to,promotion}=moveParts(m),p=b.get(from),q=b.get(to);
  return (q?(weights[q.type]??0)*(q.hp<=(p?.damage??1)?12:3)-(weights[p?.type]??0):0)+(promotion?weights[promotion]??0:0)+(history.get(t+m)??0);
 };
 const order=(b,moves,t,pv)=>moves.map(m=>({m,score:moveScore(b,m,t,pv)})).sort((a,c)=>c.score-a.score).map(x=>x.m);
 const after=(b,m,passant,t)=>{
  const n=apply(b,m,passant,t==='x'?'wild':t),{from,to}=moveParts(m),p=b.get(from);
  const newEp=p?.type==='p'&&!n.hit&&Math.abs(rank(from)-rank(to))===2?from[0]+((rank(from)+rank(to))/2):'-';
  return {board:n.board,ep:newEp,turn:next(n.board,t)};
 };
 function quiet(b,t,passant,d,alpha,beta){
  timeout();qnodes++;const end=terminal(b,d);if(end!==null)return end;
  const color=t==='x'?'wild':t,check=color!=='wild'&&threatened(b,bounds,color),stand=evaluate(b);
  if(!d&&!check)return stand;
  const moves=legal(b,bounds,color,passant,!check);if(!moves.length&&check)return color==='w'?-1e6-d:1e6+d;
  if(!d)return stand;
  let best=check?(t==='w'?-Infinity:Infinity):stand;
  if(!check){if(t==='w'){if(best>=beta)return best;alpha=Math.max(alpha,best);}else{if(best<=alpha)return best;beta=Math.min(beta,best);}}
  const tactical=check?moves:moves.filter(m=>{const p=moveParts(m);return b.has(p.to)||p.promotion||b.get(p.from)?.type==='p'&&p.to===passant;});
  if(t==='x'&&tactical.length){const n=after(b,wildChoice(b,bounds,tactical,passant),passant,t);return quiet(n.board,n.turn,n.ep,d-1,alpha,beta);}
  for(const m of order(b,tactical,t)){
   const n=after(b,m,passant,t),v=quiet(n.board,n.turn,n.ep,d-1,alpha,beta);
   if(t==='w'){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(alpha>=beta)break;
  }return best;
 }
 function search(b,t,passant,d,alpha,beta){
  timeout();const end=terminal(b,d);if(end!==null)return end;if(!d)return quiet(b,t,passant,2,alpha,beta);
  const k=key(b,t,passant),entry=table.get(k),originalAlpha=alpha,originalBeta=beta;
  if(entry?.depth>=d){ttHits++;if(entry.bound==='exact')return entry.score;if(entry.bound==='lower')alpha=Math.max(alpha,entry.score);else beta=Math.min(beta,entry.score);if(alpha>=beta)return entry.score;}
  const color=t==='x'?'wild':t,moves=legal(b,bounds,color,passant);
  if(!moves.length){if(color!=='wild'&&threatened(b,bounds,color))return color==='w'?-1e6-d:1e6+d;return search(b,next(b,t),'-',d-1,alpha,beta);}
  if(t==='x'){const n=after(b,wildChoice(b,bounds,moves,passant),passant,t);return search(n.board,n.turn,n.ep,d-1,alpha,beta);}
  let best=t==='w'?-Infinity:Infinity,bestmove=moves[0];const ranked=[],rankRoot=k===rootKey&&elo!==null&&elo<2850;
  for(const m of order(b,moves,t,entry?.bestmove)){
   const n=after(b,m,passant,t),v=search(n.board,n.turn,n.ep,d-1,rankRoot?-Infinity:alpha,rankRoot?Infinity:beta);
   if(rankRoot)ranked.push({move:m,score:t==='w'?v:-v});
   if(t==='w'?v>best:v<best){best=v;bestmove=m;}
   if(t==='w')alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
   if(alpha>=beta){if(!b.has(moveParts(m).to))history.set(t+m,Math.min(5000,(history.get(t+m)??0)+d*d));break;}
  }
  if(rankRoot)completedCandidates=ranked.sort((a,b)=>b.score-a.score);
  if(table.size>20000)table.clear();table.set(k,{depth:d,score:best,bestmove,bound:best<=originalAlpha?'upper':best>=originalBeta?'lower':'exact'});return best;
 }
 const moves=order(board,legal(board,bounds,turn,ep),turn),rootKey=key(board,turn,ep);let bestmove=moves[0],score=evaluate(board);
 for(let d=1;d<=Math.min(depth,12);d++){
  try{const value=search(board,turn,ep,d,-Infinity,Infinity),entry=table.get(rootKey);if(entry?.bestmove)bestmove=entry.bestmove;score=value;doneDepth=d;if(Math.abs(score)>999000||performance.now()>=deadline)break;}
  catch(error){if(error!==budget)throw error;break;}
 }
 if(completedCandidates.length)bestmove=chooseEloMove(completedCandidates,elo,random);
 return {bestmove,estimatedElo:elo,score,depth:doneDepth,nodes,qnodes,ttHits,elapsed:performance.now()-started,searchBackend:'variant'};
}
