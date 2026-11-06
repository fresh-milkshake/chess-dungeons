import {mountSoundControls} from '../audio/controls.js';
import '../game-input.js';
import './style.css';
import mapDocument from '../../dungeon.html?raw';
import deploymentDocument from '../../deployment.html?raw';
import battleDocument from '../../battle.html?raw';
import {mountMap} from '../dungeon/main.js';
import {mountDeployment} from '../dungeon/deployment-main.js';
import {mountBattle} from '../battle/main.js';
import {loadRun} from '../dungeon/storage.js';
import {createScope} from './scope.js';
import {routeFor,campaignRoute} from './routes.js';
import {sharedEngine} from './engine.js';
import '../mobile.css';
import './mobile.css';

const templates={map:mapDocument,deployment:deploymentDocument,battle:battleDocument};
const host=document.createElement('div');host.id='app-screen-host';document.body.replaceChildren(host);mountSoundControls();
const cached=new Map();let current=null,queue=Promise.resolve();
function shell(kind){
 const doc=new DOMParser().parseFromString(templates[kind],'text/html');doc.querySelectorAll('script').forEach(s=>s.remove());
 const root=document.createElement('div');root.className='app-screen';root.dataset.screen=kind;root.append(...doc.body.childNodes);
 return {root,scope:createScope(),bodyClass:doc.body.className,title:doc.title,controller:null,kind};
}
async function transition(target,{replace=false,history=true,handoff=null}={}){
 let run;try{run=loadRun();}catch{/* The map owns malformed-save recovery. */}
 const route=campaignRoute(routeFor(new URL(target,location.href)),run,{historyReturn:!history});if(!route.kind)throw Error('Неизвестный игровой экран.');
 if(history){const method=replace?'replaceState':'pushState';window.history[method]({screen:route.kind},'',route.url);}
 else if(route.url.href!==location.href)window.history.replaceState({screen:route.kind},'',route.url);
 if(current){
  host.inert=true;
  try{await current.controller?.beforeLeave?.();}finally{host.inert=false;}
  current.scope.pause();current.root.hidden=true;
  if(current.kind!=='map'){current.scope.dispose();current.root.remove();}
 }
 let view=route.kind==='map'?cached.get('map'):null;
 const fresh=!view;if(fresh)view=shell(route.kind);
 current=view;document.body.className=view.bodyClass;document.title=view.title;
 if(!view.root.isConnected)host.append(view.root);view.root.hidden=false;view.scope.resume();
 if(fresh){
  if(route.kind==='map'){cached.set('map',view);view.controller=mountMap({root:view.root,scope:view.scope,navigate});}
  else if(route.kind==='deployment')view.controller=mountDeployment({root:view.root,scope:view.scope,navigate,engine:sharedEngine()});
  else{
   if(handoff?.board){const board=handoff.board;board.id='board';board.setAttribute('aria-label','Боевая доска');board.querySelectorAll('button').forEach(cell=>{cell.disabled=false;});view.root.querySelector('#board').replaceWith(board);}
   if(handoff?.boardRect)view.root.querySelector('.battle-arena').style.visibility='hidden';
   view.controller=await mountBattle({root:view.root,scope:view.scope,navigate,engine:sharedEngine(),preparedState:handoff?.state,preparedRect:handoff?.boardRect});
  }
 }else view.controller.resume();
 view.root.querySelector('#map-viewport')?.focus({preventScroll:true});
 host.dataset.screen=route.kind;host.dispatchEvent(new CustomEvent('screen-ready',{detail:{kind:route.kind}}));
}
export function navigate(target,options={}){
 const job=queue.then(()=>transition(target,options));queue=job.catch(error=>{console.error(error);host.dataset.error=error.message;});return job;
}
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
 const url=new URL(link.href);if(url.origin!==location.origin||!routeFor(url).kind)return;
 event.preventDefault();navigate(url.href);
});
window.addEventListener('popstate',()=>navigate(location.href,{history:false}));
await navigate(location.href,{replace:true});
