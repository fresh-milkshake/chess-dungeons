import {boardAxes} from '../battle/coordinates.js';

/** One silhouette shared by the board shadow and preparation fog mask. */
export function boardOutline(bounds,holes=new Set(),flipped=false){
 const {columns,ranks}=boardAxes(bounds,flipped),missing=new Set([...(bounds.cutouts??[]),...holes]);
 let path='';
 for(let y=0;y<ranks.length;y++)for(let x=0;x<columns.length;x++)if(!missing.has(columns[x]+ranks[y]))path+=`M${x} ${y}h1v1h-1z`;
 return {path,columns:columns.length,rows:ranks.length};
}
export function outlineMask({path,columns,rows}){
 return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columns} ${rows}"><path fill="white" d="${path}"/></svg>`)}")`;
}
export function renderBoardOutline(board,outline,needed){
 let svg=board.querySelector(':scope > .board-outline');
 board.classList.toggle('has-board-outline',needed);
 if(!needed){svg?.remove();return;}
 if(!svg){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('board-outline');svg.dataset.boardOverlay='true';svg.setAttribute('aria-hidden','true');svg.append(document.createElementNS(svg.namespaceURI,'path'));board.append(svg);}
 const key=`${outline.columns}:${outline.rows}:${outline.path}`;
 if(svg.dataset.shape===key)return;
 svg.dataset.shape=key;svg.setAttribute('viewBox',`0 0 ${outline.columns} ${outline.rows}`);svg.setAttribute('preserveAspectRatio','none');svg.firstElementChild.setAttribute('d',outline.path);
}

export function renderMapOutline(board){
 const cells=[...board.querySelectorAll(':scope > [data-cell]')],holes=cells.filter(c=>c.classList.contains('biome-hole'));
 if(!holes.length){renderBoardOutline(board,null,false);return;}
 const columns=Number(board.style.getPropertyValue('--columns')),rows=Math.max(...cells.map(c=>Number(c.dataset.y)))+1;
 const path=cells.filter(c=>!c.classList.contains('biome-hole')&&!c.classList.contains('unseen')).map(c=>`M${c.dataset.x} ${c.dataset.y}h1v1h-1z`).join('');
 renderBoardOutline(board,{path,columns,rows},true);
}
