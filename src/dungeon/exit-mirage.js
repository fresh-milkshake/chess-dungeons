import {key} from './map.js';
export function createExitMirage(viewport,scope){
 const ghost=document.createElement('div');ghost.className='exit-mirage';ghost.hidden=true;ghost.setAttribute('aria-label','Призрачный контур выхода');ghost.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 54V24a18 18 0 0 1 36 0v30M10 54h44M22 48V25a10 10 0 0 1 20 0v23M22 48h20"/></svg>';viewport.append(ghost);
 let camera={x:0,y:0,tile:72},exit;
 const align=()=>{if(!exit)return;ghost.style.width=ghost.style.height=camera.tile+'px';ghost.style.transform=`translate(${camera.x+exit.x*camera.tile}px,${camera.y+exit.y*camera.tile}px)`;};
 scope.on(viewport,'map-camera-change',event=>{camera=event.detail;align();});
 return {update(run){exit=run.map.exit;ghost.hidden=!run.exitRevealed||run.seen.includes(key(exit.x,exit.y))||run.stage==='shop';align();}};
}
