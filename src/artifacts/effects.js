import {copyWorld,hole} from '../biomes/world.js';
import {rank as squareRank,files} from '../battle/coordinates.js';
import {inside} from '../battle/geometry.js';
import {randomSource} from '../dungeon/map.js';
import {attacks} from '../dungeon/enemy-formation.js';
export function artifactEffect(board,bounds,id,ethers,target,seed=0,friendly=false,freeAction=false){
 const next=copyWorld(board,new Map([...board].map(([s,p])=>[s,{...p}]))),ethereal=new Set(ethers),spawned=[];
 const pawn={type:'p',color:'w',hp:1,damage:1,glass:false};
 const put=s=>{if(inside(s,bounds)&&!hole(board,s)&&squareRank(s)<bounds.top&&!next.has(s)){next.set(s,{...pawn});ethereal.add(s);spawned.push(s);}};
 if(id==='banner'){
  const king=[...board].find(([,p])=>p.type==='k'&&p.color==='w');if(!king)throw Error('Король не найден.');
  const x=king[0].charCodeAt(0)-97,y=squareRank(king[0])+1;
  for(const dx of [-1,0,1])if(x+dx>=0&&x+dx<=bounds.right&&y<=bounds.top)put(files[x+dx]+y);
 }else if(id==='mirror'){
  for(const s of ethers)if(board.get(s)?.type==='p'&&board.get(s).color==='w'&&squareRank(s)<bounds.top)put(s[0]+(squareRank(s)+1));
 }else if(id==='seal'||id==='lastcrown'){
  const p=next.get(target);if(!p||p.color!=='w'||p.type==='k')throw Error('Выберите свою фигуру, кроме короля.');
  next.set(target,{type:id==='seal'?'r':'q',color:'w',hp:1,damage:id==='seal'?1:2,glass:false,cursed:p.cursed,curseTurns:p.curseTurns,curseBase:p.curseBase,rooted:p.rooted});ethereal.add(target);
 }else if(id==='silence'){
  for(const p of next.values()){p.curseBase=p.curseTurns?p.curseBase:!!p.cursed;p.cursed=true;p.curseTurns=p.color==='w'&&!freeAction?2:1;}
 }else if(id==='dragonhorn'){
  const random=randomSource(seed),free=[];
  for(let y=bounds.bottom;y<=bounds.top;y++)for(let x=bounds.left;x<=bounds.right;x++){
   const square=files[x]+y;if(!inside(square,bounds)||hole(board,square)||board.has(square))continue;
   if([...board].some(([s,p])=>p.type==='k'&&attacks(square,'d',s,{has:s=>board.has(s)||hole(board,s)},'wild')))continue;
   free.push(square);
  }
  if(free.length<2)throw Error('Нет двух безопасных свободных клеток. Заряд сохранён.');
  for(let i=0;i<2;i++){const s=free.splice(Math.floor(random()*free.length),1)[0];next.set(s,{type:'d',color:'wild',hp:2,damage:2,glass:false,wildId:`relic-dragon-${seed}-${i}`,aggro:null,neutral:friendly});spawned.push(s);}
 }else if(id==='frost'||id==='hex'){
  const p=next.get(target);if(!p||p.type==='k')throw Error('Выберите фигуру, кроме короля.');
  if(id==='frost'){if(p.iced)throw Error('Фигура уже ледяная.');Object.assign(p,{hp:1,glass:true,iced:true,material:undefined});}
  else{if(p.cursed)throw Error('Фигура уже проклята.');p.cursed=true;}
 }else if(id==='briar'){
  if(!target||!inside(target,bounds)||next.has(target)||next.world?.tiles[target])throw Error('Выберите пустую обычную клетку.');
  next.world??={biome:'court',key:'artifact-vines',round:0,tiles:{}};next.world.tiles[target]='vine';
 }else throw Error('Неизвестная способность.');
 if(['banner','mirror'].includes(id)&&!spawned.length)throw Error('Нет свободных клеток для призыва. Заряд сохранён.');
 return {board:next,ethereal:[...ethereal],spawned};
}
