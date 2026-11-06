import {createScope} from './app/scope.js';
import {createPieceSprite} from './piece-effects.js';
export function enableBoardDrag({ board, canDrag, select, drop, imageFor, onCancel, canDrop, onOutside, scope=createScope() }) {
  let gesture = null;
  let suppressClickUntil = 0;

  function clear() {
    if (!gesture) return;
    gesture.ghost?.remove();
    board.querySelector('.drag-origin')?.classList.remove('drag-origin');
    board.querySelector('.drop-target')?.classList.remove('drop-target');
    board.classList.remove('dragging');
    if (board.hasPointerCapture(gesture.id)) board.releasePointerCapture(gesture.id);
    gesture = null;
  }

  function targetAt(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-square]');
    return element && board.contains(element) ? element : null;
  }

  scope.on(board,'pointerdown', (event) => {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const source = event.target.closest('[data-square]');
    const piece = source && canDrag(source.dataset.square);
    if (!piece) return;
    gesture = { id: event.pointerId, from: source.dataset.square, piece, x: event.clientX, y: event.clientY, size: source.getBoundingClientRect().width };
  });

  scope.on(board,'pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.ghost && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5) return;
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
  scope.on(board,'pointercancel', cancel);
  scope.on(window,'pointerup', () => { if (gesture && !gesture.ghost) clear(); });
  scope.on(board,'lostpointercapture', cancel);
  scope.on(window,'blur', cancel);
  scope.on(window,'keydown', (event) => { if (event.key === 'Escape') cancel(); });
  scope.onPause(clear);
  return () => performance.now() < suppressClickUntil;
}
