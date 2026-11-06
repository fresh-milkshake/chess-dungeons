import {audioSettings,effectsVolume} from './audio/settings.js';
export function animatePiece(img, dx, dy) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof img.animate !== 'function') return null;
  return img.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(1)` },
    { transform: `translate(${dx * .32}px, ${dy * .32}px) scale(1.035)`, offset: .55 },
    { transform: 'translate(0, 0) scale(1)' },
  ], { duration: 200, easing: 'cubic-bezier(.2,.65,.3,1)' });
}

export function createMoveAnimation(board) {
  const active = new Set();

  function cancel() {
    for (const animation of active) animation.cancel();
    active.clear();
  }

  function snapshot() {
    return new Map([...board.querySelectorAll('[data-square]')].map((square) => [square.dataset.square, square.getBoundingClientRect()]));
  }

  function track(animation,img) {
    if (!animation) return Promise.resolve();
    img.style.zIndex='5';const cell=img.closest('[data-square]');if(cell)cell.classList.add('moving-piece');active.add(animation);
    const cleanup=()=>{img.style.zIndex='';cell?.classList.remove('moving-piece');active.delete(animation);};
    return animation.finished.then(cleanup,cleanup);
  }

  function play(move, before, reverse=false) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    const paths = move.hit?[]:[{ from: move.from, to: move.to }],pending=[];
    const rank = move.color === 'w' ? '1' : '8';
    if (move.flags.includes('k')) paths.push({ from: `h${rank}`, to: `f${rank}` });
    if (move.flags.includes('q')) paths.push({ from: `a${rank}`, to: `d${rank}` });
    for (const path of paths) {
      if(reverse)[path.from,path.to]=[path.to,path.from];
      const origin = before.get(path.from);
      const square = board.querySelector(`[data-square="${path.to}"]`);
      const img = square?.querySelector('img,canvas.piece-shader');
      if (!origin || !img || typeof img.animate !== 'function') continue;
      const destination = square.getBoundingClientRect();
      const dx = origin.x - destination.x;
      const dy = origin.y - destination.y;
      const animation = animatePiece(img, dx, dy);
      pending.push(track(animation,img));
    }
    if(reverse){
      const target=move.target??(move.flags.includes('e')?`${move.to[0]}${move.from[1]}`:move.to);
      const restored=board.querySelector(`[data-square="${target}"] :is(img,canvas.piece-shader)`);
      if(restored){
        const frames=move.hit?[{filter:'brightness(1.7)',opacity:.4},{filter:'brightness(1)',opacity:1}]:[{opacity:0},{opacity:1}];
        pending.push(track(restored.animate(frames,{duration:200,easing:'ease-out'}),restored));
      }
    }
    return Promise.all(pending);
  }

  return { snapshot, play, undo:(move,before)=>play(move,before,true), cancel };
}

export function createMoveSound(isEnabled) {
  const audio = new Audio(`${import.meta.env.BASE_URL}sounds/move.mp3`);
  audio.preload = 'auto';
  audio.volume = .65;
  let context;
  let output;
  let buffer;
  let loading;
  const sources = new Set();
  const updateVolume=()=>{audio.volume=.65*effectsVolume();if(output)output.gain.setTargetAtTime(effectsVolume(),context.currentTime,.03);};
  const unsubscribe=audioSettings.subscribe(updateVolume);updateVolume();

  // Resume on the initial board gesture so asynchronous bot replies can play too.
  function unlock() {
    if (!isEnabled()) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      if(!context){context=new AudioContext();output=context.createGain();output.connect(context.destination);updateVolume();}
      context.resume().catch(() => {});
      loading ??= fetch(audio.src)
        .then((response) => { if (!response.ok) throw new Error('Move sound unavailable'); return response.arrayBuffer(); })
        .then((data) => context.decodeAudioData(data))
        .then((decoded) => { buffer = decoded; })
        .catch(() => {});
    } catch { /* Playback must never interrupt a move. */ }
  }

  function play() {
    if (!isEnabled()||effectsVolume()===0||document.hidden) return;
    if (context?.state === 'running' && buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = .65;
      source.connect(gain).connect(output);
      sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
      source.start();
    } else {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }

  function stop() {
    for (const source of sources) source.stop();
    sources.clear();
    audio.pause();
    audio.currentTime = 0;
  }

  return { unlock, play, stop,dispose(){stop();unsubscribe();context?.close().catch(()=>{});} };
}
