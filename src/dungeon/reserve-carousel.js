/** Edge depth lives on the inner sprite; slot FLIP motion remains independent. */
export function setupReserveCarousel({container,board,scope}){
 let frame=0;
 function paint(){
  frame=0;if(!scope.active)return;
  const nodes=[...container.querySelectorAll(':scope > [data-piece-id]')],width=container.clientWidth;
  const first=nodes[0],last=nodes.at(-1),natural=first?last.offsetLeft+last.offsetWidth-first.offsetLeft:0;
  const boardWidth=Math.min(width,board.getBoundingClientRect().width),wasOverflow=container.classList.contains('reserve-overflow');
  const overflow=natural>boardWidth+1;container.classList.toggle('reserve-overflow',overflow);
  // The viewport stays screen-wide. Gutters let even the first/last sprite
  // reach the centre instead of remaining permanently hidden in an edge fade.
  if(overflow&&!wasOverflow)container.scrollLeft=(container.scrollWidth-width)/2;
  const scroll=container.scrollLeft,tile=first?.offsetWidth??72,edge=(width-boardWidth)/2,fade=Math.min(tile*1.5,Math.max(24,edge));
  container.style.setProperty('--carousel-fade-left',`${Math.max(0,edge-fade)}px`);
  container.style.setProperty('--carousel-solid-left',`${Math.max(0,edge)}px`);
  container.style.setProperty('--carousel-solid-right',`${Math.min(width,width-edge)}px`);
  container.style.setProperty('--carousel-fade-right',`${Math.min(width,width-edge+fade)}px`);
  for(const node of nodes){
   const x=node.offsetLeft+node.offsetWidth/2-scroll;
   const start=boardWidth/2-tile*.75,end=boardWidth/2+fade;
   const t=overflow?Math.max(0,Math.min(1,(Math.abs(x-width/2)-start)/(end-start))):0;
   const depth=t*t*(3-2*t),side=x<width/2?1:-1;
   node.style.setProperty('--reserve-depth',`${-160*depth}px`);
   node.style.setProperty('--reserve-turn',`${side*30*depth}deg`);
   node.style.setProperty('--reserve-sink',`${6*depth}px`);
  }
 }
 function refresh(){if(!frame&&scope.active)frame=requestAnimationFrame(paint);}
 function stop(){cancelAnimationFrame(frame);frame=0;}
 const resize=new ResizeObserver(refresh);resize.observe(container);resize.observe(board);
 const mutation=new MutationObserver(refresh);mutation.observe(container,{childList:true});
 scope.on(container,'scroll',refresh,{passive:true});scope.onPause(stop);scope.onResume(refresh);
 scope.cleanup(()=>{stop();resize.disconnect();mutation.disconnect();});
 function layout(){stop();paint();}
 refresh();return {refresh,layout};
}
