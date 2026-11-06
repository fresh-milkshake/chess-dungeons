import {createScope} from './app/scope.js';
import './debug-menu.css';

export function setupDebugMenu({root=document,scope=createScope()}={}){
 const panel=root.querySelector('.debug-panel'),toggle=root.querySelector('#debug-toggle');
 const triggers=root.querySelectorAll(`[aria-controls="${panel.id}"]`);
 function setOpen(open){
  panel.hidden=!open;
  for(const button of triggers)button.setAttribute('aria-expanded',String(open));
  document.dispatchEvent(new CustomEvent('debug-menu-change',{detail:{open}}));
  if(open)root.querySelector('#'+'debug-close').focus();
  else if(panel.contains(document.activeElement))document.activeElement.blur();
 }
 toggle.addEventListener('click',()=>setOpen(panel.hidden));
 root.querySelector('#'+'debug-close').addEventListener('click',()=>setOpen(false));
 const map=!!root.querySelector('#map-viewport');toggle.textContent=map?'DEBUG · Shift+D':'DEBUG · D';
 scope.on(window,'keydown',event=>{
  if(event.code==='KeyD'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.shiftKey===map&&!event.target.closest?.('input:not([type=range]):not([type=checkbox]),textarea,select,[contenteditable=true],dialog[open]')){event.preventDefault();event.stopImmediatePropagation();setOpen(panel.hidden);}
  if(event.code==='Escape'&&!panel.hidden){event.preventDefault();setOpen(false);}
 },{capture:true});
 scope.onPause(()=>setOpen(false));
 return {setOpen,get isOpen(){return !panel.hidden;}};
}
