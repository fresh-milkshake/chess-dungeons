import {randomDecision} from './ai-profile.js';
import {moveParts,rank as squareRank,files,boardAxes} from './coordinates.js';
import {movePattern} from './patterns.js';
import {copyWorld,worldMeta,hole,rooted,applyTerrain} from '../biomes/world.js';
import {parsePosition} from '../lab/scenarios.js';
import {placement,inside} from './geometry.js';
import {attacks} from '../dungeon/enemy-formation.js';
import {variantSearch} from './variant-search.js';
import {artifactEffect} from '../artifacts/effects.js';
import {protectGlass} from '../artifacts/mechanics.js';

const value={p:1,n:3,b:3,r:5,q:9,k:100,d:7,j:2};
const other=color=>color==='w'?'b':'w';
const square=(x,y)=>files[x]+y;
const clone=board=>copyWorld(board,new Map([...board].map(([s,p])=>[s,{...p}])));
export function wildMetadata(pieces,mode='mixed'){
 return [`wildmode=${mode}`,...[...pieces].filter(([,p])=>p.color==='wild').map(([s,p])=>`wild=${s}|${p.wildId}|${p.aggro??'-'}`),`truce=${[...pieces.values()].filter(p=>p.color==='wild'&&p.neutral).map(p=>p.wildId).join(',')}`];
}
export function wildFen(board,bounds,turn='w',mode='mixed',ep='-',half=0){
 const attrs=[...board].filter(([,p])=>p.type!=='k'&&(p.hp>1||p.damage>1||p.glass)).map(([s,p])=>`${s}=${p.hp}/${p.damage}/${p.glass?1:0}`);
 if(board.relics)attrs.push(`relics=${board.relics.glassAvailable?1:0},${board.relics.glassUsed?1:0}`);
 for(const [s,p] of board)if(p.curseTurns)attrs.push(`curse=${s}|${p.curseTurns}|${p.curseBase?1:0}`);
 return placement(new Map([...board].map(([s,p])=>[s,p.color==='w'?p.type.toUpperCase():p.type])),bounds)+` ${turn} - ${ep} ${half} 1 @hunt=1;`+[...attrs,...wildMetadata(board,mode),...[...board].filter(([,p])=>p.rooted).map(([s,p])=>`root=${s}|${p.rooted}`),...[...board].filter(([,p])=>p.iced||p.cursed).map(([s,p])=>`status=${s}|${p.iced?1:0}|${p.cursed?1:0}`),...[...board].filter(([,p])=>p.emperor).map(([s,p])=>`emperor=${s}|${p.hp}`)].join(';')+worldMeta(board.world);
}
function threatened(board,bounds,target,color){
 const blockers={has:s=>board.has(s)||hole(board,s)||!inside(s,bounds)};
 return [...board].some(([from,p])=>!rooted(p)&&!p.cursed&&p.color!==color&&!(p.color==='wild'&&p.neutral&&color==='w')&&(p.color!=='wild'||!p.aggro||p.aggro===color)&&attacks(from,p.type,target,blockers,p.color));
}
export function kingThreatened(board,bounds,color){
 const king=[...board].find(([,p])=>p.type==='k'&&p.color===color);
 return !!king&&!(king[1].emperor&&king[1].hp>1)&&threatened(board,bounds,king[0],color);
}
export function validateWildSetup(fen){
 const {pieces,bounds}=parsePosition(fen);
 if(![...pieces.values()].some(p=>p.type==='k'&&p.color==='w'))throw Error('Перед боем выставьте короля.');
 if(kingThreatened(pieces,bounds,'w'))throw Error('Ваш король под шахом. Переставьте короля или прикройте его.');
 if(kingThreatened(pieces,bounds,'b'))throw Error('Нельзя начинать бой с шаха вражескому королю.');
}
function applied(board,uci,ep,turn='w'){
 if(uci==='0000'){const next=clone(board);applyTerrain(next,'','',turn,true);return {board:next,hit:true};}
 const next=clone(board),from=moveParts(uci).from,to=moveParts(uci).to,p=next.get(from),target=next.get(to);
 const captureSquare=p.type==='p'&&to===ep&&!target?to[0]+from.slice(1):to;
 const victim=next.get(captureSquare),saved=!!victim&&victim.hp<=p.damage&&protectGlass(next,victim),hit=saved||!!victim&&(victim.hp>p.damage||!!victim.emperor&&victim.hp>1);
 if(victim?.color==='wild'&&p.color!=='wild'){victim.aggro=p.color;if(p.color==='w')victim.neutral=false;}
 if(hit){victim.hp=saved?1:victim.emperor?Math.max(1,victim.hp-p.damage):victim.hp-p.damage;if(victim.emperor)victim.damage=victim.hp===1?2:1;}
 else{next.delete(captureSquare);next.delete(from);next.set(to,{...p,type:moveParts(uci).promotion??p.type});}
 applyTerrain(next,from,to,p.color,hit);
 const terrainRemoved=[...board.keys()].filter(s=>(hit||s!==from)&&!next.has(s));if(!hit&&!next.has(to))terrainRemoved.push(to);
 return {board:next,hit,target:captureSquare,terrainRemoved,capturedWildId:!hit?victim?.wildId:undefined};
}
export function wildLegal(board,bounds,color,ep='-',capturesOnly=false){
 const result=[];
 for(const [from,p] of board){
  if(p.color!==color||rooted(p))continue;
  const x=from.charCodeAt(0)-97,y=squareRank(from),blockedRays=new Set();
  for(const [dx,dy] of movePattern(p)){
   if(!dx&&!dy)continue;
   const ray='brqdj'.includes(p.type)&&(dx===0||dy===0||Math.abs(dx)===Math.abs(dy)),direction=ray?Math.sign(dx)+','+Math.sign(dy):null;
   if(ray&&blockedRays.has(direction))continue;
   if(x+dx<bounds.left||x+dx>bounds.right||y+dy<bounds.bottom||y+dy>bounds.top){if(ray)blockedRays.add(direction);continue;}
   const to=square(x+dx,y+dy);
   if(!inside(to,bounds)||hole(board,to)){if(ray)blockedRays.add(direction);continue;}
   const target=board.get(to);if(ray&&target)blockedRays.add(direction);if(p.cursed&&(target||p.type==='p'&&to===ep))continue;if(target?.color===color||color!=='wild'&&target?.type==='k'&&!(target.emperor&&target.hp>1))continue;
   if(color==='wild'&&target&&p.aggro&&target.color!==p.aggro)continue;
   if(color==='wild'&&p.neutral&&target?.color==='w')continue;
   let allowed;
   if(p.type==='p'){
    const direction=color==='w'?1:-1,start=color==='w'?bounds.bottom+1:bounds.top-1;
    allowed=dx===0&&!target&&(dy===direction||y===start&&dy===2*direction&&!board.has(square(x,y+direction))&&!hole(board,square(x,y+direction)))||Math.abs(dx)===1&&dy===direction&&(!!target||to===ep&&board.get(to[0]+from.slice(1))?.type==='p'&&board.get(to[0]+from.slice(1))?.color!==color);
   }else allowed=true;
   if(!allowed)continue;
   const promotion=p.type==='p'&&y+dy===(color==='w'?bounds.top:bounds.bottom);
   if(capturesOnly&&!target&&!promotion&&!(p.type==='p'&&to===ep))continue;
   for(const role of promotion?'qnrb':['']){
    const uci=from+to+role,next=applied(board,uci,ep);
    if(next.hit&&promotion&&role!=='q')continue;
    if(color==='wild'||!kingThreatened(next.board,bounds,color))result.push(uci);
   }
  }
 }
 if(!capturesOnly&&!result.length&&[...board.values()].some(p=>p.color===color&&(rooted(p)||p.curseTurns))&&!kingThreatened(board,bounds,color))return ['0000'];
 return result;
}
function wildChoice(board,bounds,moves,ep){
 if(moves[0]==='0000')return '0000';
 let best=moves[0],score=-Infinity;
 for(const uci of moves){
  const from=moveParts(uci).from,to=moveParts(uci).to,p=board.get(from),target=board.get(to),next=applied(board,uci,ep);
  const prey=[...board].filter(([,q])=>q.color!=='wild'&&!(p.neutral&&q.color==='w')&&(!p.aggro||q.color===p.aggro));
  const distance=prey.length?Math.min(...prey.map(([s])=>Math.max(Math.abs(to.charCodeAt(0)-s.charCodeAt(0)),Math.abs(squareRank(to)-squareRank(s))))):0;
  let candidate=(target?(value[target.type]??0)*(next.hit?4:10):0)-distance*.7;
  if(!next.hit){for(const [s,q] of next.board)if(q.color!=='wild'&&attacks(s,q.type,to,next.board,q.color))candidate-=q.damage>=p.hp?6:2;}
  if(candidate>score){score=candidate;best=uci;}
 }
 return best;
}

/** Three-faction coordinator. Ordinary games delegate unchanged to native WASM. */
export class WildRules {
 constructor(native,{random=Math.random}={}){this.native=native;this.random=random;this.active=false;this.history=[];}
 async request(command){
  const [action,...args]=command.split(' ');
  if(action==='load'){
   const fen=args.join(' ');this.active=fen.includes('wildmode=')||fen.includes(';world=')||/[dj]/i.test(fen.split(' ')[0]);
   if(!this.active)return this.native(command);
   const parsed=parsePosition(fen);this.board=parsed.pieces;this.bounds=parsed.bounds;
   this.mode=fen.match(/wildmode=(\w+)/)?.[1]??'mixed';this.turn=parsed.turn==='b'&&this.mode==='solo'?'x':parsed.turn;
   this.required=new Set(fen.match(/;required=([^;]*)/)?.[1].split(',').filter(Boolean)??[]);
   this.ep=fen.split(' ')[3];this.half=Number(fen.split(' ')[4])||0;this.history=[];this.event={};return this.state();
  }
  if(!this.active){
   if(action==='search'){
    const elo=args[3]===undefined?null:Math.max(100,Math.min(2850,Number(args[3])||100));
    if(args[2]!==undefined||elo!==null){const state=await this.native('state'),move=elo!==null?(elo<500?randomDecision(state.legal,(elo-100)/400,this.random):null):randomDecision(state.legal,Number(args[2]),this.random);if(move)return {...state,bestmove:move,depth:0,nodes:0,estimatedElo:elo,searchBackend:'beginner'};}
    await this.native('strength '+(elo??0));
   }
   return this.native(command);
  }
  if(action==='relicspend'){
   if(args[0]==='glassward'&&this.board.relics)Object.assign(this.board.relics,{glassAvailable:0,glassUsed:1});return this.state();
  }
  if(action==='relicrestore'){
   if(args[0]==='glassward'&&this.board.relics)Object.assign(this.board.relics,{glassAvailable:1,glassUsed:0});return this.state();
  }
  if(action==='artifact'){
   if(this.turn!=='w')throw Error('Дождитесь своего хода.');
   const payload=JSON.parse(args.join(' ')),spendsTurn=payload.spendsTurn!==false,effect=artifactEffect(this.board,this.bounds,payload.id,payload.ethereal??[],payload.target,payload.seed,payload.friendly,!spendsTurn);
   if(kingThreatened(effect.board,this.bounds,'w'))throw Error('Способность не устраняет шах вашему королю.');
   this.history.push({board:clone(this.board),turn:this.turn,ep:this.ep,half:this.half});
   if(spendsTurn)applyTerrain(effect.board,'','','w',true);this.board=effect.board;
   if(spendsTurn){this.turn=this.nextTurn('w');this.ep='-';this.half=0;}this.event={hit:false,artifact:payload.id,ethereal:effect.ethereal,spawned:effect.spawned};return this.state();
  }
  if(action==='undo'){
   const spent=this.board.relics?.glassUsed,old=this.history.pop();if(old)Object.assign(this,old);if(spent&&this.board.relics)Object.assign(this.board.relics,{glassAvailable:0,glassUsed:1});this.event={};return this.state();
  }
  if(action==='move'){
   const uci=args[0],current=this.state();if(current.gameResult||!current.legal.includes(uci))throw Error('Этот ход недоступен.');
   this.history.push({board:clone(this.board),turn:this.turn,ep:this.ep,half:this.half});
   const from=moveParts(uci).from,to=moveParts(uci).to,p=this.board.get(from);
   if(uci==='0000'){const before=clone(this.board);applyTerrain(this.board,'','',this.turn==='x'?'wild':this.turn,true);const terrainRemoved=[...before.keys()].filter(s=>!this.board.has(s));this.event={hit:true,pass:true,terrainRemoved,terrainWildIds:terrainRemoved.map(s=>before.get(s)?.wildId).filter(Boolean)};this.half++;}
   else{
    const victim=this.board.get(to),next=applied(this.board,uci,this.ep);this.board=next.board;
    this.event={hit:next.hit,capturedWildId:next.capturedWildId,terrainRemoved:next.terrainRemoved,terrainWildIds:(next.terrainRemoved??[]).map(s=>victim?.wildId&&s===to?victim.wildId:this.history.at(-1).board.get(s)?.wildId).filter(Boolean)};
    this.half=p.type==='p'||victim?0:this.half+1;
    if(this.turn!=='x')this.ep=p.type==='p'&&!next.hit&&Math.abs(squareRank(from)-squareRank(to))===2?from[0]+((squareRank(from)+squareRank(to))/2):'-';
   }
   this.turn=this.nextTurn(this.turn);
   return this.state();
  }
  if(action==='search'){
   const state=this.state();if(!state.legal.length)return {...state,bestmove:null};
   const elo=args[3]===undefined?null:Math.max(100,Math.min(2850,Number(args[3])||100));
   const randomMove=elo!==null?(elo<500?randomDecision(state.legal,(elo-100)/400,this.random):null):randomDecision(state.legal,args[2]===undefined?1:Number(args[2]),this.random);if(randomMove)return {...state,bestmove:randomMove,depth:0,nodes:0,searchBackend:'beginner'};
   if(this.turn==='x')return {...state,bestmove:wildChoice(this.board,this.bounds,state.legal,this.ep),depth:1,nodes:state.legal.length};
   if(state.legal[0]==='0000')return {...state,bestmove:'0000',depth:0,nodes:1};
   const kings=[...this.board.values()].filter(p=>p.type==='k');
   if(this.board.relics||this.bounds.top>8||this.bounds.right>7||Object.keys(this.board.world?.tiles??{}).length||[...this.board.values()].some(p=>p.rooted||p.emperor||p.cursed||p.iced||['d','j'].includes(p.type))||!kings.some(p=>p.color==='b'))return {...state,...variantSearch({board:this.board,bounds:this.bounds,turn:this.turn,mode:this.mode,ep:this.ep,depth:Number(args[0])||6,milliseconds:Number(args[1])||1000,legal:wildLegal,apply:applied,threatened:kingThreatened,wildChoice,required:[...this.required],elo,random:this.random})};
   // Project wild creatures as hostile to the black army for its native search.
   // Their independent turns/aggro are enforced by this coordinator afterwards.
   const projection=clone(this.board);for(const p of projection.values())if(p.color==='wild')p.color=other(this.turn);
   const fen=wildFen(projection,this.bounds,this.turn,'mixed',this.ep,this.half).replace(/;wildmode=[^;]+/,'').replace(/;truce=[^;]*/, '');
   let reply;try{await this.native('load '+fen);await this.native('strength '+(elo??0));reply=await this.native(command);}catch{/* Use the verified legal tactical fallback below. */}
   const fallback=()=>variantSearch({board:this.board,bounds:this.bounds,turn:this.turn,mode:this.mode,ep:this.ep,depth:4,milliseconds:200,legal:wildLegal,apply:applied,threatened:kingThreatened,wildChoice,required:[...this.required],elo,random:this.random}).bestmove;
   const bestmove=state.legal.includes(reply?.bestmove)?reply.bestmove:fallback();
   return {...state,...reply,fen:state.fen,legal:state.legal,check:state.check,bestmove,gameResult:state.gameResult,depth:reply?.depth??1,nodes:reply?.nodes??state.legal.length};
  }
  return this.state();
 }
 nextTurn(turn){if(turn==='w')return [...this.board.values()].some(p=>p.color==='b')?'b':[...this.board.values()].some(p=>p.color==='wild')?'x':'w';return turn==='b'&&[...this.board.values()].some(p=>p.color==='wild')?'x':'w';}
 blackFallback(moves){return [...moves].sort((a,b)=>this.moveScore(b)-this.moveScore(a))[0];}
 moveScore(uci){const victim=this.board.get(moveParts(uci).to),next=applied(this.board,uci,this.ep),to=moveParts(uci).to;return (victim?(value[victim.type]??0)*(next.hit ? .4 : 1):0)-[...next.board].filter(([s,p])=>p.color!=='b'&&attacks(s,p.type,to,next.board,p.color)).length*2;}
 state(){
  const color=this.turn==='x'?'wild':this.turn;
  let legal=wildLegal(this.board,this.bounds,color,this.ep),gameResult=null;
  const check=color!=='wild'&&kingThreatened(this.board,this.bounds,color);
  const whiteKing=[...this.board.values()].some(p=>p.type==='k'&&p.color==='w'),blackKing=[...this.board.values()].some(p=>p.type==='k'&&p.color==='b');
  const wildPieces=[...this.board].filter(([,p])=>p.color==='wild').map(([square,p])=>({id:p.wildId,square,hp:p.hp,aggro:p.aggro,type:p.type,neutral:p.neutral}));
  if(!whiteKing)gameResult={title:'Поражение',detail:'Ваш король погиб.',result:'loss'};
  else if(this.mode==='clear'&&![...this.board.values()].some(p=>p.color==='b'||p.color==='wild'&&(!p.neutral||this.required.has(p.wildId))))gameResult={title:'Победа',detail:'Вражеский отряд уничтожен.',result:'win'};
  else if(this.mode==='solo'&&!wildPieces.length)gameResult={title:'Победа',detail:'Дикая фигура побеждена.',result:'win'};
  else if(this.mode==='mixed'&&!blackKing)gameResult={title:'Победа',detail:'Король чёрных пал.',result:'win'};
  else if(color!=='wild'&&!legal.length&&(check||this.mode!=='clear'&&![...this.board.values()].some(p=>p.color===color&&rooted(p))))gameResult={title:check?(color==='b'?'Победа':'Поражение'):'Ничья',detail:check?'Мат.':'Пат.',result:check?(color==='b'?'win':'loss'):'draw'};
  else if(this.half>=100)gameResult={title:'Ничья',detail:'50 ходов без взятия или хода пешки.',result:'draw'};
  if(color==='wild'&&!legal.length&&!gameResult)legal=['0000'];
  if((this.mode==='clear'||[...this.board.values()].some(p=>p.color===color&&rooted(p)))&&!legal.length&&!check&&!gameResult)legal=['0000'];
  return {fen:wildFen(this.board,this.bounds,this.turn,this.mode,this.ep,this.half)+(this.required.size?`;required=${[...this.required].join(',')}`:''),check,legal,draw:gameResult?.result==='draw',wildMode:true,wildPieces,gameResult,...this.event};
 }
}

export {applied as applyVariantMove,wildChoice as chooseWildMove};
