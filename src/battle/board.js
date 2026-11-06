import {moveParts,rank as squareRank,files,boardAxes} from './coordinates.js';
import {renderTerrain} from '../biomes/view.js';
import {boardOutline,renderBoardOutline} from '../biomes/board-outline.js';
import { parsePosition } from '../lab/scenarios.js';
import { pieceImage } from '../piece-sets.js';
import {createPieceSprite} from '../piece-effects.js';

const contentCache=new WeakMap();

export function renderBoard(board, battle, selected, flipped) {
  const { pieces, turn, bounds, walls } = parsePosition(battle.state.fen);
  const columns=bounds.right-bounds.left+1,rows=bounds.top-bounds.bottom+1;
  const holes=new Set(Object.entries(pieces.world?.tiles??{}).filter(([,kind])=>kind==='hole').map(([s])=>s));
  const absent=s=>walls.has(s)||holes.has(s),shapeKey=[...holes].sort().join(',');
  board.style.background='transparent';board.style.boxShadow=bounds.cutouts?.length?'none':'';
  board.style.gridTemplateRows=`repeat(${rows},1fr)`;
  board.style.gridTemplateColumns=`repeat(${columns},1fr)`;
  board.parentElement.style.setProperty('--board-ratio',columns/rows);
  const targets = selected ? battle.state.legal.filter(m=>moveParts(m).from===selected).map(m=>moveParts(m).to) : [];
  // Display castling on the king's destination while retaining engine UCI encoding.
  if (selected && pieces.get(selected)?.type==='k') {
    for (const to of [...targets]) if (pieces.get(to)?.color===turn && pieces.get(to)?.type==='r') targets.push(`${to[0]>selected[0]?'g':'c'}${selected.slice(1)}`);
  }
  const last = battle.moves.at(-1);
  const cells = [];
  for (const rank of boardAxes(bounds,flipped).ranks) for (const file of boardAxes(bounds,flipped).columns) {
    const square=file+rank, piece=pieces.get(square);if(walls.has(square))continue;
    const cell=board.querySelector(`[data-square="${square}"]`) ?? document.createElement('button');
    cell.type='button'; cell.dataset.square=square;
    cell.style.gridColumn=String(flipped?bounds.right-(file.charCodeAt(0)-97)+1:file.charCodeAt(0)-97-bounds.left+1);cell.style.gridRow=String(flipped?Number(rank)-bounds.bottom+1:bounds.top-Number(rank)+1);
    const className=`square ${(file.charCodeAt(0)+Number(rank))%2?'light':'dark'}${selected===square?' selected':''}${last && [last.from,last.to].includes(square)?' last-move':''}${piece?.type==='k'&&piece.color===turn&&battle.state.check?' in-check':''}${piece?.color==='wild'?' wild-square':''}${cell.classList.contains('artifact-threat')?' artifact-threat':''}`;
    if(cell.className!==className)cell.className=className;
    cell.setAttribute('aria-label',`${square}${piece?` ${piece.color} ${piece.type}, прочность ${piece.hp}, урон ${piece.damage}`:''}${targets.includes(square)?', допустимый ход':''}`);
    const visual=piece?{...piece,material:battle.ethereal.has(square)?'ethereal':undefined}:null;
    const spriteKey=JSON.stringify(visual),contentKey=JSON.stringify([spriteKey,targets.includes(square),flipped,bounds.left,bounds.right,bounds.bottom,bounds.top,shapeKey]);
    const previous=contentCache.get(cell);
    if(previous?.contentKey===contentKey){cells.push(cell);continue;}
    cell.replaceChildren();
    let sprite=null;
    if (piece) {
      sprite=previous?.spriteKey===spriteKey?previous.sprite:createPieceSprite(visual,imageFor(visual));cell.append(sprite);
      if(piece.color==='wild'){
        cell.classList.add('wild-square');const tag=document.createElement('span');tag.className='wild-badge';tag.textContent=`◆ ${piece.hp}${piece.aggro?' · '+(piece.aggro==='w'?'Б':'Ч'):''}`;cell.append(tag);
        cell.title=`Дикая фигура · ${piece.hp} HP · ${piece.aggro?(piece.aggro==='w'?'охотится на белых':'охотится на чёрных'):'атакует обе стороны'}`;
      }else cell.removeAttribute('title');
      if ((piece.type!=='k'||piece.emperor) && piece.color!=='wild' && (piece.hp>1||piece.damage>1||piece.glass)) {
        const badge=document.createElement('span');badge.className=`piece-badge${piece.hp===3?' diamond-badge':''}`;badge.textContent=`${piece.hp>1?piece.hp:''}${piece.damage>1?'⚡':''}${piece.glass?'◇':''}`;cell.append(badge);
      }
    }
    if(targets.includes(square)){const hint=document.createElement('span');hint.className=piece?'capture-hint':'move-hint';cell.append(hint);}
    if(!absent(square)&&file===boardAxes(bounds,flipped).columns.find(f=>!absent(f+rank))){const label=document.createElement('span');label.className='coordinate rank';label.textContent=rank;cell.append(label);}
    if(!absent(square)&&Number(rank)===boardAxes(bounds,!flipped).ranks.find(r=>!absent(file+r))){const label=document.createElement('span');label.className='coordinate file';label.textContent=file;cell.append(label);}
    contentCache.set(cell,{contentKey,spriteKey,sprite});
    cells.push(cell);
  }
  for(const cell of [...board.children])if(!cells.includes(cell)&&!cell.hasAttribute('data-board-overlay'))cell.remove();
  cells.forEach((cell,index)=>{if(board.children[index]!==cell)board.insertBefore(cell,board.children[index]??null);});
  renderTerrain(board,pieces.world,pieces);
  renderBoardOutline(board,boardOutline(bounds,holes,flipped),holes.size>0||!!bounds.cutouts?.length);
}
export function imageFor(piece) { return pieceImage(piece,'neo',import.meta.env.BASE_URL); }

export function findMoves(state, from, to) {
  const {pieces}=parsePosition(state.fen);
  const moves=state.legal.filter(m=>moveParts(m).from===from && moveParts(m).to===to);
  if(moves.length || pieces.get(from)?.type!=='k')return moves;
  return state.legal.filter(m=>moveParts(m).from===from && pieces.get(moveParts(m).to)?.type==='r' && `${m[2]>from[0]?'g':'c'}${from.slice(1)}`===to);
}
