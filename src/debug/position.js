import {rank as squareRank,files} from '../battle/coordinates.js';
import {Chess,validateFen} from 'chess.js';
import {parsePosition} from '../lab/scenarios.js';
import {chessFen} from '../battle/geometry.js';
import {wildFen} from '../battle/wild-rules.js';

export const debugMaterials=['ordinary','stone','glass','ethereal','diamond','power'];
export function applyMaterial(piece,material){
 if(!debugMaterials.includes(material))throw Error('Неизвестный материал.');
 if(piece.type==='k'&&material!=='ordinary')throw Error('Король всегда обычный и не получает усилений.');
 if(material==='power')return {...piece,damage:2};
 return {...piece,material,hp:material==='diamond'?3:material==='stone'?2:1,glass:material==='glass',damage:piece.type==='k'||material==='ordinary'?1:piece.damage??1};
}

export function serializePosition(pieces,sourceFen,{allowIncomplete=false}={}){
 const fields=sourceFen.split(' @')[0].split(' '),rows=[];
 const {walls,bounds,pieces:original}=parsePosition(sourceFen);if(original.world&&!pieces.world)pieces.world=original.world;
 const mode=sourceFen.match(/wildmode=(\w+)/)?.[1]??'mixed';
 const coordinated=()=>wildFen(pieces,bounds,fields[1]==='x'&&![...pieces.values()].some(p=>p.color==='wild')?'w':fields[1],mode==='solo'&&[...pieces.values()].some(p=>p.color==='b'&&p.type==='k')?'mixed':mode).replace('hunt=1',sourceFen.includes('hunt=0')?'hunt=0':'hunt=1');
 if(pieces.world||sourceFen.includes('wildmode=')||[...pieces.values()].some(p=>p.color==='wild')){const required=sourceFen.match(/;required=([^;]*)/)?.[1];return coordinated()+(required?';required='+required:'');}
 for(const rank of '87654321'){
  let row='',empty=0;
  for(const file of 'abcdefgh'){
   const p=pieces.get(file+rank);
   if(walls.has(file+rank)){if(p)throw Error('Клетка за краем доски.');if(empty){row+=empty;empty=0;}row+='*';continue;}
   if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}
   row+=p.color==='w'?p.type.toUpperCase():p.type;
  }
  if(empty)row+=empty;rows.push(row);
 }
 // Editing rebases the position: stale castling, en passant and move clocks must not survive.
 const ordinary=chessFen(`${rows.join('/')} ${fields[1]} - - 0 1`);
 const valid=validateFen(ordinary);if(!valid.ok){if(allowIncomplete)return coordinated();throw Error(valid.error);}
 const chess=new Chess(ordinary),kings={};
 for(const [square,p] of pieces)if(p.type==='k')kings[p.color]=square;
 const white=chess.isAttacked(kings.w,'b'),black=chess.isAttacked(kings.b,'w');
 if(white&&black){if(allowIncomplete)return coordinated();throw Error('Оба короля не могут одновременно находиться под шахом.');}
 const turn=white?'w':black?'b':fields[1];
 const attributes=[];
 for(const [square,p] of pieces)if(p.type!=='k'&&(p.hp>1||p.damage>1||p.glass))attributes.push(`${square}=${p.hp}/${p.damage}/${p.glass?1:0}`);
 const hunt=sourceFen.includes('hunt=0')?0:1;
 return `${rows.join('/')} ${turn} - - 0 1 @hunt=${hunt}${attributes.length?';'+attributes.join(';'):''}`;
}

export function validateDebugPosition(fen){
 if(typeof fen!=='string'||fen.length>5000)throw Error('Некорректная позиция редактора.');
 const {pieces}=parsePosition(fen);return serializePosition(pieces,fen);
}

export function editPosition(fen,ethereal,tool,square){
 if(tool.kind!=='remove'&&!/^[a-p]\d{1,2}$/.test(square))throw Error('Выберите клетку доски.');
 const {pieces,walls,bounds}=parsePosition(fen),ethers=new Set(ethereal);
 if(walls.has(square))throw Error('Клетка за краем доски.');
 if(tool.kind==='move'||tool.kind==='remove'){
  const source=pieces.get(tool.from);if(!source)throw Error('На исходной клетке нет фигуры.');
  if(tool.kind==='remove'){pieces.delete(tool.from);ethers.delete(tool.from);}
  else if(square!==tool.from){
   const target=pieces.get(square),sourceEther=ethers.has(tool.from),targetEther=ethers.has(square);
   pieces.delete(tool.from);if(target)pieces.set(tool.from,target);pieces.set(square,source);
   ethers.delete(tool.from);ethers.delete(square);if(sourceEther)ethers.add(square);if(targetEther)ethers.add(tool.from);
  }
 }else if(tool.kind==='piece'){
  if(!'pnbrqk'.includes(tool.type)||!['w','b','wild'].includes(tool.color))throw Error('Неизвестная фигура.');
  if(tool.color==='wild'&&!'nbrq'.includes(tool.type))throw Error('Дикие фигуры: конь, слон, ладья или ферзь.');
  if(pieces.has(square))throw Error('Клетка занята. Выберите свободную клетку.');
  if(tool.type==='p'&&[bounds.bottom,bounds.top].includes(squareRank(square)))throw Error('Пешку нельзя поставить на крайнюю горизонталь.');
  if(tool.type==='k'&&[...pieces.values()].some(p=>p.type==='k'&&p.color===tool.color))throw Error('У этой стороны уже есть король.');
  pieces.set(square,{type:tool.type,color:tool.color,hp:tool.color==='wild'?2:1,damage:tool.color==='wild'?2:1,glass:false,...(tool.color==='wild'?{wildId:tool.wildId??'debug-wild',aggro:null}:{})});
 }else{
  const p=pieces.get(square);if(!p)throw Error('Перетащите материал на фигуру.');
  pieces.set(square,applyMaterial(p,tool.material));
  if(tool.material!=='power'){ethers.delete(square);if(tool.material==='ethereal')ethers.add(square);}
 }
 return {fen:serializePosition(pieces,fen,{allowIncomplete:true}),ethereal:[...ethers]};
}
