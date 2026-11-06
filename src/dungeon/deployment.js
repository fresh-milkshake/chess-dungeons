import {rank as squareRank,files as allFiles} from '../battle/coordinates.js';
import {worldMeta,hole} from '../biomes/world.js';
import {Chess} from 'chess.js';
import {makeEncounter} from './encounters.js';
import {parsePosition} from '../lab/scenarios.js';
import {placement,inside,chessFen} from '../battle/geometry.js';
import {values} from './balance.js';
import {wildMetadata,validateWildSetup} from '../battle/wild-rules.js';
import {deploymentLimit} from '../artifacts/mechanics.js';

export function deploymentSquares(bounds){
 const squares=[];
 for(let rank=bounds.bottom;rank<=bounds.bottom+2;rank++)for(let file=bounds.left;file<=bounds.right;file++){const square=allFiles[file]+rank;if(inside(square,bounds))squares.push(square);};
 return squares;
}
export function initialDeployment(run,enemy){
 const preset=makeEncounter(run,enemy,[]);
 return {enemyId:enemy.id,positions:Object.fromEntries(Object.entries(preset.identities).map(([square,id])=>[id,square]))};
}
export function automaticDeployment(run,enemy,{glass=false,ethereal=false}={}){
 const positions=initialDeployment(run,enemy).positions,bounds=makeEncounter(run,enemy,[]).bounds;
 const strength=p=>(values[p.type]??0)+(p.material==='stone'?2:p.material==='diamond'?4:0);
 const chosen=run.inventory.filter(p=>p.type!=='k'&&(p.material!=='glass'||glass)&&(p.material!=='ethereal'||ethereal)).sort((a,b)=>strength(b)-strength(a)||['ordinary','stone','glass','ethereal','diamond'].indexOf(a.material)-['ordinary','stone','glass','ethereal','diamond'].indexOf(b.material)).slice(0,deploymentLimit(run)-1);
 const center=(bounds.left+bounds.right)/2,files=allFiles.slice(bounds.left,bounds.right+1).split('').sort((a,b)=>Math.abs(a.charCodeAt(0)-97-center)-Math.abs(b.charCodeAt(0)-97-center));
 for(const piece of chosen.sort((a,b)=>(a.type!=='p')-(b.type!=='p'))){
  const ranks=piece.type==='p'?[bounds.bottom+1,bounds.bottom+2]:[bounds.bottom,bounds.bottom+1,bounds.bottom+2];
  for(const square of ranks.flatMap(rank=>files.map(file=>file+rank))){
   if(Object.values(positions).includes(square))continue;
   try{deploymentPreset(run,enemy,{...positions,[piece.id]:square});positions[piece.id]=square;break;}catch{/* Try another cell; unplaceable figures remain in reserve. */}
  }
 }
 return positions;
}
export function previousDeployment(run,enemy){
 const previous=run.previousDeployment;
 if(!previous)throw Error('Предыдущей расстановки ещё нет.');
 const positions=initialDeployment(run,enemy).positions,bounds=makeEncounter(run,enemy,[]).bounds;
 const allowed=deploymentSquares(bounds),old=previous.bounds;
 const mapped=Object.fromEntries(Object.entries(previous.positions).filter(([id])=>run.inventory.some(p=>p.id===id)).map(([id,square])=>[id,allFiles[Math.max(bounds.left,Math.min(bounds.right,square.charCodeAt(0)-97-old.left+bounds.left))]+Math.min(bounds.bottom+2,squareRank(square)-old.bottom+bounds.bottom)]));
 // Validate the whole position first: a returning piece may shield the king.
 try{deploymentPreset(run,enemy,mapped);return mapped;}catch{/* Repair lost shields, collisions and changed bounds below. */}
 for(const [id,square] of Object.entries(previous.positions).sort(([a],[b])=>(a!=='king')-(b!=='king'))){
  const piece=run.inventory.find(p=>p.id===id);if(!piece)continue;
  if(piece.type==='k')delete positions[id];
  const x=Math.max(bounds.left,Math.min(bounds.right,square.charCodeAt(0)-97-old.left+bounds.left)),y=Math.min(bounds.bottom+2,squareRank(square)-old.bottom+bounds.bottom);
  const candidates=[...allowed].sort((a,b)=>(Math.abs(a.charCodeAt(0)-97-x)+Math.abs(squareRank(a)-y))-(Math.abs(b.charCodeAt(0)-97-x)+Math.abs(squareRank(b)-y)));
  for(const target of candidates){
   if(Object.values(positions).includes(target))continue;
   try{deploymentPreset(run,enemy,{...positions,[id]:target});positions[id]=target;break;}catch{/* Keep unavailable or unsafe placements in reserve. */}
  }
 }
 return positions;
}
export function deploymentPreset(run,enemy,positions,{validate=true}={}){
 const root=makeEncounter(run,enemy,[]),{pieces}=parsePosition(root.fen),allowed=new Set(deploymentSquares(root.bounds));
 for(const [square,piece] of pieces)if(piece.color==='w')pieces.delete(square);
 const deployed=[],identities={},ethereal=root.ethereal.filter(s=>pieces.has(s));
 const occupied=new Set();
 if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Некорректная расстановка.');
 for(const [id,square] of Object.entries(positions)){
  const piece=run.inventory.find(p=>p.id===id);
  if(!piece)throw Error('Фигуры уже нет в отряде.');
  if(typeof square!=='string'||!/^([a-p]\d{1,2})$/.test(square))throw Error('Выберите клетку доски.');
  if(!inside(square,root.bounds)||!allowed.has(square))throw Error('Расставляйте фигуры в трёх нижних горизонталях.');
  if(root.world?.tiles[square]==='hole')throw Error('Здесь провал.');
  if(piece.type==='k'&&root.world?.tiles[square]==='heat')throw Error('Нельзя выставить короля на клетку жара.');
  if(occupied.has(square)||pieces.has(square))throw Error('Клетка уже занята.');
  if(piece.type==='p'&&squareRank(square)===root.bounds.bottom)throw Error('Пешку нельзя поставить на первую горизонталь области.');
  occupied.add(square);identities[square]=id;deployed.push({...piece});
  pieces.set(square,{type:piece.type,color:'w',hp:piece.type==='k'?1:piece.material==='stone'?2:piece.material==='diamond'?3:1,damage:piece.type!=='k'&&run.buffs.some(b=>b.pieceId===id&&(b.permanent||b.remaining>0))?2:1,glass:piece.type!=='k'&&piece.material==='glass'});
  if(piece.type!=='k'&&piece.material==='ethereal')ethereal.push(square);
 }
 if(deployed.length>deploymentLimit(run))throw Error(`На поле можно выставить до ${deploymentLimit(run)} фигур с королём.`);
 const kings=deployed.filter(p=>p.type==='k');
 if(validate&&kings.length!==1)throw Error('Перед боем выставьте короля.');
 const board=new Map([...pieces].map(([square,p])=>[square,p.color==='w'?p.type.toUpperCase():p.type]));
 const metadata=[`hunt=${enemy.boss?0:1}`,...[...pieces].filter(([,p])=>p.type!=='k'&&(p.hp>1||p.damage>1||p.glass)).map(([s,p])=>`${s}=${p.hp}/${p.damage}/${p.glass?1:0}`)];
 if(root.world&&!root.fen.includes('wildmode='))metadata.push('wildmode=mixed');
 if(root.fen.includes('wildmode='))metadata.push(...wildMetadata(pieces,root.fen.match(/wildmode=(\w+)/)[1]));
 for(const [s,p] of pieces)if(p.emperor)metadata.push(`emperor=${s}|${p.hp}`);
 const required=root.fen.match(/;required=([^;]*)/)?.[1];if(required)metadata.push(`required=${required}`);
 const fen=placement(board,root.bounds)+' w - - 0 1 @'+metadata.join(';')+worldMeta(root.world);
 if(validate&&(root.world||root.fen.includes('wildmode=')))validateWildSetup(fen);
 else if(validate){
  const chess=new Chess(chessFen(fen)),white=Object.keys(identities).find(s=>pieces.get(s).type==='k'),black=[...pieces].find(([,p])=>p.type==='k'&&p.color==='b')[0];
  if(chess.isAttacked(white,'b'))throw Error('Ваш король под шахом. Переставьте короля или прикройте его.');
  if(chess.isAttacked(black,'w'))throw Error('Нельзя начинать бой с шаха вражескому королю.');
 }
 return {...root,fen,identities,deployed,ethereal};
}
