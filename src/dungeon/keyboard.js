import {createScope} from '../app/scope.js';
import {createStepBuffer} from './step-buffer.js';
import {isShopping} from './merchants.js';
const directions = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export function keyboardDirection(codes) {
  const values = [...new Map([...codes].map(code => directions[code]).filter(Boolean).map(value => [value.join(','), value])).values()];
  return [Math.sign(values.reduce((sum, value) => sum + value[0], 0)), Math.sign(values.reduce((sum, value) => sum + value[1], 0))];
}

/** Shared focus/navigation for exploration and every map dialog. */
export function setupMapKeyboard({ viewport, dialogs, directionControls, getStage, isBusy, isBlocked, step, selectKing, center, canRestart=()=>false, restart, changeVariation, scope=createScope() }) {
  const held = new Set();
  let timer, previousStage, pointer, focusIndex = 0;
  const buffer=createStepBuffer({step,isBusy,canMove:()=>scope.active&&!isBlocked()&&dialogs.hidden&&!document.hidden&&(getStage()==='exploring'||isShopping(getStage()))});
  const controls = () => [...dialogs.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)')]
    .filter(element => element.getClientRects().length && !element.closest('[hidden]'));
  const release = () => {
    if (!pointer) return;
    const {button,id}=pointer;pointer=null;
    buffer.setHeld(null);
    if(button.hasPointerCapture(id))button.releasePointerCapture(id);
  };
  const stop = () => { clearTimeout(timer); timer = null; held.clear();release();buffer.reset(); };
  if(directionControls){
    const buttonAt=event=>event.target.closest('button[data-dx]');
    const directionFor=button=>[Number(button.dataset.dx),Number(button.dataset.dy)];
    scope.on(directionControls,'pointerdown',event=>{
      const button=buttonAt(event);
      if(!button||button.disabled||button.getAttribute('aria-disabled')==='true'||pointer||!event.isPrimary||event.button!==0||isBlocked())return;
      event.preventDefault();
      stop();
      pointer={button,id:event.pointerId};
      button.setPointerCapture(event.pointerId);
      const direction=directionFor(button);
      buffer.setHeld(direction);
      buffer.press(direction);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      scope.on(directionControls,type,event=>{if(pointer?.id===event.pointerId)release();});
    }
    scope.on(directionControls,'click',event=>{
      const button=buttonAt(event);
      if(event.detail===0&&button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')buffer.press(directionFor(button));
    });
  }
  function move() {
    clearTimeout(timer); timer = null;
    if (isBlocked() || !(getStage()==='exploring'||isShopping(getStage()))) return;
    const direction = keyboardDirection(held);
    if (direction.some(Boolean)) buffer.press(direction);
  }
  function update() {
    const stage = getStage(), changed = stage !== previousStage;
    if (changed) { stop(); focusIndex = 0; }
    const modal = !dialogs.hidden;
    viewport.inert = modal;
    previousStage = stage;
    buffer.wake();
    if (isBlocked()) return;
    if (modal) {
      const items = controls();
      if (!items.includes(document.activeElement)) items[Math.min(focusIndex, items.length - 1)]?.focus({ preventScroll: true });
    } else if (changed) viewport.focus({ preventScroll: true });
  }
  function focusItem(index) {
    const items = controls();
    if (!items.length) return;
    focusIndex = (index + items.length) % items.length;
    items[focusIndex].focus({ preventScroll: true });
    items[focusIndex].scrollIntoView({ block: 'nearest' });
  }
  dialogs.addEventListener('focusin', event => {
    const index = controls().indexOf(event.target);
    if (index >= 0) focusIndex = index;
  });
  scope.on(window,'keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isBlocked()) return;
    const code = event.code || event.key;
    if (code === 'Home' && getStage() === 'exploring') { event.preventDefault(); stop(); center(); return; }
    const direction = directions[code];
    const confirm = code === 'Enter' || code === 'NumpadEnter';
    const wait = code === 'Space' || event.key === ' ' || event.key === '.';
    if (!dialogs.hidden) {
      if (!(direction || confirm || wait || code === 'Tab' || code === 'Escape')) return;
      event.preventDefault();
      if (event.repeat || isBusy()) return;
      const items = controls(), current = items.indexOf(document.activeElement);
      if (direction || code === 'Tab') {
        const delta = code === 'Tab' ? event.shiftKey ? -1 : 1 : direction[0] || direction[1];
        focusItem((current < 0 ? 0 : current) + delta);
      } else if (code === 'Escape') {
        if (getStage() === 'encounter') dialogs.querySelector('#retreat').click();
      } else {
        const target = items[current < 0 ? 0 : current];
        target?.click();
      }
      return;
    }
    if (!(getStage()==='exploring'||isShopping(getStage())) || event.target.closest?.('input,select,textarea,a,button:not(.map-cell),[contenteditable="true"]')) return;
    if(code==='KeyR'&&!event.shiftKey&&canRestart()){
      event.preventDefault();if(event.repeat||isBusy())return;stop();restart();return;
    }
    if(code==='Insert'&&!event.shiftKey&&getStage()==='exploring'&&changeVariation){
      event.preventDefault();if(event.repeat||isBusy())return;stop();changeVariation();return;
    }
    if (!direction && !confirm && !wait) return;
    event.preventDefault();
    if (event.repeat) return;
    if(pointer)stop();
    if (confirm) { stop(); selectKing(); return; }
    if (wait) { stop(); buffer.press([0, 0]); return; }
    held.add(code);
    buffer.setHeld(keyboardDirection(held));
    // A short chord window lets W+D / Up+Right make one diagonal king step.
    clearTimeout(timer);if(isBusy())move();else timer = setTimeout(move, 40);
  });
  scope.on(window,'keyup', event => {
    if (!held.has(event.code)) return;
    if (timer) move(); // Short taps still take a step before releasing the key.
    held.delete(event.code);
    buffer.setHeld(keyboardDirection(held));
  });
  scope.on(window,'blur', stop);
  scope.on(document,'focusin',event=>{if(event.target.closest?.('input,select,textarea,a,button:not(.map-cell),[contenteditable="true"]'))stop();});
  scope.on(document,'visibilitychange', () => { if (document.hidden) stop(); });
  scope.on(document,'debug-menu-change', event => { if (event.detail.open) stop(); else update(); });
  scope.onPause(stop);
  return { update };
}
