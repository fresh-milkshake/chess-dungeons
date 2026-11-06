import {createScope} from './app/scope.js';
import {createPieceSprite} from './piece-effects.js';
export function enableBoardDrag({ board, canDrag, select, drop, imageFor, onCancel, canDrop, onOutside, touchScroll, scope=createScope() }) {
  let gesture = null;
  let suppressClickUntil = 0;

  function clear() {
    if (!gesture) return;
    const {id,ghost}=gesture;
    gesture=null;
    ghost?.remove();
    board.querySelector('.drag-origin')?.classList.remove('drag-origin');
    board.querySelector('.drop-target')?.classList.remove('drop-target');
    board.classList.remove('dragging');
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
  }

  function targetAt(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-square]');
    return element && board.contains(element) ? element : null;
  }

  scope.on(board,'pointerdown', (event) => {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const source = event.target.closest('[data-square]');
    const piece = source && canDrag(source.dataset.square);
    const scroll = event.pointerType==='touch'&&touchScroll?.contains(event.target)&&touchScroll.scrollWidth>touchScroll.clientWidth+1?touchScroll:null;
    if (!piece && !scroll) return;
    gesture = { id: event.pointerId, from: source?.dataset.square, piece, scroll, x: event.clientX, y: event.clientY, size: source?.getBoundingClientRect().width, started: performance.now() };
  });

  scope.on(board,'pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if (!gesture.ghost && !gesture.scrolling && Math.hypot(dx,dy) < 5) return;
    // Horizontal swipes browse the reserve. A vertical drag or a short hold
    // followed by movement picks up a piece, including with the board at the side.
    if (!gesture.ghost && !gesture.scrolling && gesture.scroll &&
        (!gesture.piece || Math.abs(dx)>2*Math.abs(dy)&&performance.now()-gesture.started<180)) {
      gesture.scrolling=true;
      gesture.scrollStart=gesture.scroll.scrollLeft;
      board.setPointerCapture(event.pointerId);
    }
    if (gesture.scrolling) {
      event.preventDefault();
      gesture.scroll.scrollLeft=gesture.scrollStart-dx;
      return;
    }
    event.preventDefault();
    if (!gesture.ghost) {
      board.setPointerCapture(event.pointerId);
      select(gesture.from);
      board.querySelector(`[data-square="${gesture.from}"]`)?.classList.add('drag-origin');
      gesture.ghost = createPieceSprite(gesture.piece,imageFor(gesture.piece));
      gesture.ghost.classList.add('drag-ghost');
      gesture.ghost.style.width = `${gesture.size * .95}px`;
      document.body.append(gesture.ghost);
      board.classList.add('dragging');
    }
    gesture.ghost.style.left = `${event.clientX}px`;
    gesture.ghost.style.top = `${event.clientY}px`;
    board.querySelector('.drop-target')?.classList.remove('drop-target');
    const target = targetAt(event);
    if (target && (canDrop?canDrop(target.dataset.square):target.querySelector('.move-hint, .capture-hint'))) target.classList.add('drop-target');
  });

  scope.on(board,'pointerup', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.scrolling) {
      suppressClickUntil=performance.now()+350;
      clear();
      return;
    }
    if (!gesture.ghost) { clear(); return; }
    const dragged = !!gesture.ghost;
    const from = gesture.from;
    const target = targetAt(event);
    const valid = !!target && (canDrop?canDrop(target.dataset.square):!!target.querySelector('.move-hint, .capture-hint'));
    clear();
    if (dragged) {
      suppressClickUntil = performance.now() + 350;
      if (valid) drop(target.dataset.square);
      else if (!target && onOutside) onOutside(from);
      else onCancel();
    }
  });

  function cancel() {
    if (!gesture) return;
    const dragged = !!gesture.ghost;
    clear();
    if (dragged) { suppressClickUntil = performance.now() + 350; onCancel(); }
  }
  scope.on(board,'pointercancel', event=>{if(gesture?.id===event.pointerId)cancel();});
  scope.on(window,'pointerup', event=>{if(gesture?.id===event.pointerId&&!gesture.ghost)clear();});
  scope.on(board,'lostpointercapture', event=>{if(event.target===board&&gesture?.id===event.pointerId)cancel();});
  scope.on(window,'blur', cancel);
  scope.on(window,'keydown', (event) => { if (event.key === 'Escape') cancel(); });
  scope.onPause(clear);
  return () => performance.now() < suppressClickUntil;
}
