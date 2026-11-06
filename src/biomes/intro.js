import {biomeNames} from './world.js';
import '../dungeon/boss-intro.css';
const active=new WeakSet();
export function showActIntro({root,scope,run,persist}){
 if(!scope.active||!run.biome||run.stage!=='exploring'||run.actAnnounced===run.act||active.has(root))return;
 active.add(root);run.actAnnounced=run.act;persist();
 const overlay=document.createElement('div');overlay.className='boss-intro act-entry-intro';overlay.setAttribute('role','status');
 const title=document.createElement('div');title.className='boss-intro-title';
 const caption=document.createElement('p');caption.className='boss-intro-caption';caption.textContent=`АКТ ${['I','II','III','IV'][run.act-1]}`;
 const heading=document.createElement('h1');heading.textContent=biomeNames[run.biome];title.append(caption,heading);overlay.append(title);root.append(overlay);
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1100:2600;
 const animation=overlay.animate([{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.65},{opacity:0}],{duration,fill:'both'});
 function finish(){animation.cancel();overlay.remove();active.delete(root);}
 animation.finished.then(finish,()=>{});scope.onPause(finish);scope.cleanup(finish);
 scope.on(window,'keydown',e=>{if(!overlay.isConnected)return;e.preventDefault();e.stopImmediatePropagation();},{capture:true});
}
