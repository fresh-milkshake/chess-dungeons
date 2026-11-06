import {animatePiece} from '../move-effects.js';

// Only rendered actors are recorded: movement in the fog cannot reveal an enemy.
export function snapshotActors(board) {
  return new Map([...board.querySelectorAll(':is(img,canvas.piece-shader)[data-actor]')].map(img=>[
    img.dataset.actor,{x:img.parentElement.offsetLeft,y:img.parentElement.offsetTop},
  ]));
}

export async function playMapMoves(board,before,sound,{dragged=false}={}) {
  async function moveActor(img,origin,animated=true) {
    const cell=img.parentElement,dx=origin.x-cell.offsetLeft,dy=origin.y-cell.offsetTop;
    if(!dx&&!dy)return;
    sound.play();
    const animation=animated?animatePiece(img,dx,dy):null;
    if(!animation)return;
    cell.classList.add('moving-actor');
    try{await animation.finished;}catch{/* A refreshed view may cancel an animation. */}
    finally{cell.classList.remove('moving-actor');}
  }
  // Hold opponents at their old positions while the player's click move plays.
  const enemies=[...board.querySelectorAll(':is(img,canvas.piece-shader)[data-actor]')].filter(img=>img.dataset.actor!=='player'&&before.has(img.dataset.actor));
  for(const img of enemies){const p=before.get(img.dataset.actor),cell=img.parentElement;img.style.transform=`translate(${p.x-cell.offsetLeft}px,${p.y-cell.offsetTop}px)`;cell.classList.add('moving-actor');}
  const player=board.querySelector(':is(img,canvas.piece-shader)[data-actor="player"]');
  if(player&&before.has('player'))await moveActor(player,before.get('player'),!dragged);
  await Promise.all(enemies.map(async img=>{
    img.style.transform='';
    await moveActor(img,before.get(img.dataset.actor));
    img.parentElement.classList.remove('moving-actor');
  }));
}
