/** FLIP the keyed reserve slots, preserving material canvases and baselines. */
export function setupReserveMotion({container,scope}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Set(),ghosts=new Set();
 let keys=null;
 function stop(){for(const animation of animations)animation.cancel();animations.clear();for(const ghost of ghosts)ghost.remove();ghosts.clear();}
 function animate(node,frames,duration=260,done=()=>{}){
  const animation=node.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)'});animations.add(animation);
  const finish=()=>{animations.delete(animation);done();};animation.onfinish=finish;animation.oncancel=finish;
 }
 function update(nextKeys,render,{exit=true}={}){
  // Selection/busy updates must neither restart motion nor read slot geometry.
  const changed=keys!==null&&(keys.length!==nextKeys.length||keys.some((id,i)=>id!==nextKeys[i]));
  const before=new Map();
  if(changed&&!reduced.matches&&scope.active)for(const node of container.querySelectorAll(':scope > [data-piece-id]')){
   before.set(node.dataset.pieceId,{node,rect:node.getBoundingClientRect(),opacity:getComputedStyle(node).opacity});
  }
  if(changed)stop();
  render();keys=[...nextKeys];
  if(!changed||reduced.matches||!scope.active)return;
  const present=new Set(nextKeys);
  // Measure every destination before starting any compositor-only animations.
  const after=[...container.querySelectorAll(':scope > [data-piece-id]')].map(node=>({node,rect:node.getBoundingClientRect()}));
  for(const {node,rect} of after){
   const old=before.get(node.dataset.pieceId);
   if(old){
    const dx=old.rect.left-rect.left,dy=old.rect.top-rect.top;
    if(Math.abs(dx)+Math.abs(dy)>.5)animate(node,[{transform:`translate(${dx}px,${dy}px)`,opacity:old.opacity},{transform:'translate(0,0)',opacity:1}]);
   }else animate(node,[{opacity:0,transform:'translateY(7px) scale(.93)'},{opacity:1,transform:'translateY(0) scale(1)'}],220);
  }
  const bounds=container.getBoundingClientRect();
  for(const [id,{node,rect,opacity}] of before){
   if(!exit||present.has(id)||rect.right<=bounds.left||rect.left>=bounds.right)continue;
   const ghost=node.cloneNode(true);
   // cloneNode does not copy canvas pixels. Copy once; no extra shader context.
   const originals=node.querySelectorAll('canvas');ghost.querySelectorAll('canvas').forEach((copy,i)=>copy.getContext('2d')?.drawImage(originals[i],0,0));
   ghost.removeAttribute('data-piece-id');ghost.removeAttribute('data-square');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
   ghost.classList.add('reserve-exit');ghost.style.cssText+=`;position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;pointer-events:none;z-index:100;--reserve-tile:${rect.width}px;`;
   document.body.append(ghost);ghosts.add(ghost);
   animate(ghost,[{opacity,transform:'scale(1)'},{opacity:0,transform:'translateY(-5px) scale(.94)'}],160,()=>{ghost.remove();ghosts.delete(ghost);});
  }
 }
 scope.onPause(stop);scope.cleanup(stop);scope.on(reduced,'change',stop);
 return {update};
}
