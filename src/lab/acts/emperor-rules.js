// Interactive rule prototype. No campaign saves or Stockfish variants are mutated.
const other=c=>c==='w'?'b':'w';
export const emperorDamage=p=>p.type==='emperor'?(p.hp===1?2:1):(p.damage??1);
export const isRoyal=p=>p.type==='k'||p.type==='emperor'&&p.hp===1;
const at=(a,b)=>a.x===b.x&&a.y===b.y;
function attacks(piece,target,pieces){
 const dx=target.x-piece.x,dy=target.y-piece.y,ax=Math.abs(dx),ay=Math.abs(dy);if(!dx&&!dy)return false;
 if(piece.type==='k'||piece.type==='emperor')return Math.max(ax,ay)===1;
 if(piece.type==='n')return ax*ay===2;
 if(piece.type==='p')return ax===1&&dy===(piece.color==='w'?-1:1);
 if(!((piece.type==='b'||piece.type==='q')&&ax===ay||(piece.type==='r'||piece.type==='q')&&(!dx||!dy)))return false;
 const sx=Math.sign(dx),sy=Math.sign(dy);for(let i=1;i<Math.max(ax,ay);i++)if(pieces.some(p=>p.x===piece.x+sx*i&&p.y===piece.y+sy*i))return false;
 return true;
}
export function emperorCheck(state,color=state.turn){
 return state.pieces.filter(p=>p.color===color&&isRoyal(p)).some(king=>state.pieces.some(p=>p.color!==color&&attacks(p,king,state.pieces)));
}
function apply(state,move){
 const next=structuredClone(state),p=next.pieces.find(p=>p.id===move.id),victim=next.pieces.find(q=>q!==p&&at(q,move));let hit=false;
 if(victim){
  const damage=emperorDamage(p);
  if(victim.type==='emperor'&&victim.hp>1){victim.hp=Math.max(1,victim.hp-damage);hit=true;}
  else if((victim.hp??1)>damage){victim.hp-=damage;hit=true;}
  else next.pieces=next.pieces.filter(q=>q!==victim);
 }
 if(!hit){p.x=move.x;p.y=move.y;if(p.type==='p'&&(p.y===0||p.y===state.size-1))p.type='q';}
 next.turn=other(state.turn);next.last={...move,hit,damage:emperorDamage(p)};return next;
}
export function emperorLegal(state){
 const moves=[];
 for(const p of state.pieces.filter(p=>p.color===state.turn))for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++){
  const target={x,y},victim=state.pieces.find(q=>at(q,target));if(victim?.color===p.color||victim&&isRoyal(victim))continue;
  let possible=attacks(p,target,state.pieces);
  if(p.type==='p')possible=!victim?x===p.x&&y===p.y+(p.color==='w'?-1:1):possible;
  if(!possible)continue;const move={id:p.id,x,y};if(!emperorCheck(apply(state,move),state.turn))moves.push(move);
 }
 return moves;
}
export function emperorStatus(state){
 const check=emperorCheck(state),moves=emperorLegal(state);return {check,mate:check&&!moves.length,stalemate:!check&&!moves.length,moves};
}
export function moveEmperorLab(state,move){
 if(!emperorLegal(state).some(m=>m.id===move.id&&at(m,move)))throw Error('Недопустимый ход');return apply(state,move);
}
export function emperorFixture(id='armor',hp=3){
 const emperor={id:'emperor',type:'emperor',color:'b',hp,x:3,y:2};
 if(id==='mate')return {size:6,turn:'b',pieces:[{...emperor,x:0,y:0},{id:'wk',type:'k',color:'w',x:2,y:2,hp:1},{id:'wq',type:'q',color:'w',x:1,y:1,hp:1}]};
 const pieces=[emperor,{id:'wk',type:'k',color:'w',x:0,y:5,hp:1},{id:'wp',type:'p',color:'w',x:3,y:3,hp:3,material:'diamond'}];
 if(id==='armor')pieces.push({id:'wr',type:'r',color:'w',x:0,y:2,hp:1},{id:'bn',type:'n',color:'b',x:5,y:0,hp:1});
 return {size:6,turn:id==='damage'?'b':'w',pieces};
}
