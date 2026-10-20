export function enableBoardDrag({ board, canDrag, select, drop, imageFor, onCancel }) {
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

  board.addEventListener('pointerdown', (event) => {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const source = event.target.closest('[data-square]');
    const piece = source && canDrag(source.dataset.square);
    if (!piece) return;
    gesture = { id: event.pointerId, from: source.dataset.square, piece, x: event.clientX, y: event.clientY, size: source.getBoundingClientRect().width };
  });

  board.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.ghost && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5) return;
    event.preventDefault();
    if (!gesture.ghost) {
      board.setPointerCapture(event.pointerId);
      select(gesture.from);
      board.querySelector(`[data-square="${gesture.from}"]`)?.classList.add('drag-origin');
      gesture.ghost = document.createElement('img');
      gesture.ghost.src = imageFor(gesture.piece);
      gesture.ghost.alt = '';
      gesture.ghost.className = 'drag-ghost';
      gesture.ghost.style.width = `${gesture.size * .95}px`;
      document.body.append(gesture.ghost);
      board.classList.add('dragging');
    }
    gesture.ghost.style.left = `${event.clientX}px`;
    gesture.ghost.style.top = `${event.clientY}px`;
    board.querySelector('.drop-target')?.classList.remove('drop-target');
    const target = targetAt(event);
    if (target?.querySelector('.move-hint, .capture-hint')) target.classList.add('drop-target');
  });

  board.addEventListener('pointerup', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dragged = !!gesture.ghost;
    const target = targetAt(event);
    const valid = !!target?.querySelector('.move-hint, .capture-hint');
    clear();
    if (dragged) {
      suppressClickUntil = performance.now() + 350;
      if (valid) drop(target.dataset.square);
      else onCancel();
    }
  });

  function cancel() {
    if (!gesture) return;
    const dragged = !!gesture.ghost;
    clear();
    if (dragged) { suppressClickUntil = performance.now() + 350; onCancel(); }
  }
  board.addEventListener('pointercancel', cancel);
  window.addEventListener('pointerup', () => { if (gesture && !gesture.ghost) clear(); });
  board.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') cancel(); });
  return () => performance.now() < suppressClickUntil;
}
