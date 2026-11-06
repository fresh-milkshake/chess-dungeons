/** Landmarks live below actors and never reveal unexplored cells. */
export function addLandmark(cell,type){
 cell.classList.add(`landmark-${type}`);
 const marker=document.createElement('span');marker.className=`map-landmark ${type}`;marker.setAttribute('aria-hidden','true');
 const shape=document.createElement('span');shape.className='landmark-shape';
 if(type==='exit')for(let i=0;i<3;i++){const step=document.createElement('i');step.style.setProperty('--step',i);shape.append(step);}
 const label=document.createElement('span');label.className='landmark-label';label.textContent=type==='entry'?'ВХОД':'ВЫХОД';
 marker.append(shape,label);cell.append(marker);
}
