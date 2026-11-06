import {rank as squareRank,files as allFiles} from '../battle/coordinates.js';
// A deterministic pool prevents rerolling enemy positions while editing a squad.
const cache=new Map(),worth={p:1,n:3,b:3,r:5,q:9,k:0,d:7,j:2};
export function attacks(from,type,target,board,color='b'){
 const dx=target.charCodeAt(0)-from.charCodeAt(0),dy=squareRank(target)-squareRank(from);
 if(!dx&&!dy)return false;
 if(type==='p')return Math.abs(dx)===1&&dy===(color==='b'?-1:1);
 if(type==='d'&&Math.abs(dx)*Math.abs(dy)===2)return true;
 if(type==='j'&&Math.max(Math.abs(dx),Math.abs(dy))>2)return false;
 if(type==='n')return Math.abs(dx)*Math.abs(dy)===2;
 if(type==='k')return Math.max(Math.abs(dx),Math.abs(dy))===1;
 const diagonal=Math.abs(dx)===Math.abs(dy),straight=!dx||!dy;
 if(!(type==='q'&&(diagonal||straight)||['b','d','j'].includes(type)&&diagonal||type==='r'&&straight))return false;
 for(let x=from.charCodeAt(0)+Math.sign(dx),y=squareRank(from)+Math.sign(dy);String.fromCharCode(x)+y!==target;x+=Math.sign(dx),y+=Math.sign(dy))if(board.has(String.fromCharCode(x)+y))return false;
 return true;
}
export function formationScore(pieces,bounds){
 const board=new Map(pieces.map(p=>[p.square,p.type])),king=pieces.find(p=>p.type==='k').square,center=(bounds.left+bounds.right)/2;
 let score=0;
 for(const p of pieces){
  const file=p.square.charCodeAt(0)-97,rank=squareRank(p.square);
  if(p.type==='p'){
   if(Math.abs(file-(king.charCodeAt(0)-97))<=1&&rank===bounds.top-1)score+=7;
   score+=2-Math.abs(file-center)*.4;
   if(!pieces.some(q=>q!==p&&q.type==='p'&&Math.abs(q.square.charCodeAt(0)-p.square.charCodeAt(0))===1))score-=2;
  }
  if(p.type!=='k'){
   const defenders=pieces.filter(q=>q!==p&&attacks(q.square,q.type,p.square,board)).length;
   score+=defenders?Math.min(defenders,2)*2:-(worth[p.type]??0)*.7;
  }
  for(let y=bounds.top-3;y<=bounds.top;y++)for(let x=bounds.left;x<=bounds.right;x++){
   const target=allFiles[x]+y;
   if(!board.has(target)&&attacks(p.square,p.type,target,board))score+=.15;
  }
 }
 return score;
}
export function enemyFormation(run,enemy,army,bounds){
 const key=JSON.stringify([run.seed,run.floor,enemy.id,army,bounds,run.act,enemy.type,!!enemy.boss,enemy.formationStyle]);
 if(cache.has(key))return cache.get(key).map(p=>({...p}));
 let seed=run.seed>>>0;for(const c of `${run.floor}:${enemy.id}`)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const files=allFiles.slice(bounds.left,bounds.right+1).split(''),king=files.at(-2)+bounds.top,whiteKing=files.at(-2)+bounds.bottom;
 const rank='pnbrqk'.indexOf(enemy.type)+1,budget=4+Math.max(0,run.act-1)*16+rank*4+(enemy.boss?24:0);
 let best=null,bestScore=-Infinity;
 for(let attempt=0;attempt<budget;attempt++){
  const back=shuffle(files.filter(f=>f!==king[0]).map(f=>f+bounds.top));
  const pawns=shuffle(files.map(f=>f+(bounds.top-1))),pieces=[{square:king,type:'k'}];
  for(const type of army){const square=(type==='p'?pawns:back).shift();if(!square)throw Error('Нет места для вражеской армии.');pieces.push({square,type});}
  if(enemy.formationStyle){
   const front=shuffle([files[0],files.at(-1)].map(f=>f+(bounds.top-2))),officers=pieces.filter(p=>p.type!=='k'&&p.type!=='p');
   const count=enemy.formationStyle==='split'?Math.min(2,officers.length):Math.min(1,officers.length);
   for(let i=0;i<count;i++)officers[i].square=front[i];
   if(enemy.formationStyle==='forward'){
    const pawn=pieces.find(p=>p.type==='p');if(pawn)pawn.square=files[Math.floor(files.length/2)]+(bounds.top-2);
   }
  }
  const board=new Map(pieces.map(p=>[p.square,p.type]));
  if(pieces.some(p=>attacks(p.square,p.type,whiteKing,board)))continue;
  const score=formationScore(pieces,bounds);
  if(score>bestScore){best=pieces;bestScore=score;}
 }
 if(!best)throw Error('Нет безопасной стартовой расстановки.');
 if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,best);
 return best.map(p=>({...p}));
}
