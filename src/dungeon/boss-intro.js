import './boss-intro.css';

/** One short announcement before preparation; no second pause on Space. */
export function showBossIntro({root,scope,title,act,onDone}){
 const preparation=root.querySelector('#preparation');
 const overlay=document.createElement('div');overlay.className='boss-intro';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
 const caption=document.createElement('p');caption.className='boss-intro-caption';caption.textContent=`АКТ ${['I','II','III','IV'][act-1]??act} · ${act===4?'ФИНАЛЬНЫЙ БОСС':'БОСС'}`;
 const heading=document.createElement('h1');heading.textContent=title;
 const content=document.createElement('div');content.className='boss-intro-title';content.append(caption,heading);overlay.append(content);
 const dimmer=document.createElement('div');dimmer.className='boss-intro-dimmer';dimmer.setAttribute('aria-hidden','true');overlay.prepend(dimmer);root.append(overlay);
 const wasInert=preparation.inert;preparation.inert=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?1100:2600;
 const textFrames=reduced?[{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.65},{opacity:0}]:[{opacity:0,transform:'translateY(12px) scale(.96)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.18},{opacity:1,transform:'translateY(0) scale(1.015)',offset:.6},{opacity:0,transform:'translateY(-8px) scale(1.04)'}];
 const text=content.animate(textFrames,{duration,easing:'ease-out',fill:'both'});
 const shade=dimmer.animate([{opacity:0},{opacity:.76,offset:.12},{opacity:.76,offset:.6},{opacity:0}],{duration,easing:'ease-in-out',fill:'both'});
 let ended=false;
 function finish(completed){if(ended)return;ended=true;text.cancel();shade.cancel();overlay.remove();preparation.inert=wasInert;onDone(completed);}
 text.finished.then(()=>finish(true),()=>{});
 const started=performance.now();
 scope.on(window,'keydown',event=>{if(ended)return;event.preventDefault();event.stopImmediatePropagation();if(performance.now()-started>450&&['Escape','Enter','Space'].includes(event.code))finish(true);},{capture:true});
 scope.onPause(()=>finish(false));scope.cleanup(()=>finish(false));
}
