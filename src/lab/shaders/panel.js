import {setupEmperorMechanics} from '../acts/emperor-panel.js';
import './style.css';
import { approvedEffects, effectGroups, variants, spriteUrl } from './variants.js';
import { createSpriteRenderer } from './renderer.js';

export function setupShaderLab(root) {
  const preferenceKey = 'chess-dungeons-shader-lab-v4';
  let picks = Object.fromEntries(Object.entries(approvedEffects).filter(([,effect])=>!effect.pending).map(([group, effect]) => [group, effect.id]));
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (saved && typeof saved === 'object') {picks = { ...picks, ...saved };if(saved._emperorRevision!==6&&!['I1','I2','I4','I5','I6','I7'].includes(saved.emperor))delete picks.emperor;}
    else {
      const old = JSON.parse(localStorage.getItem('chess-dungeons-shader-lab-v3') ?? localStorage.getItem('chess-dungeons-shader-lab-v2'));
      for (const group of ['diamond','power']) if (old?.[group]) picks[group] = old[group];
    }
  } catch { /* Local choices are optional. */ }
  // The user's approved curse replaces any earlier local prototype choice once.
  try{if(JSON.parse(localStorage.getItem(preferenceKey))?._curseRevision!==1)picks.curse='C5';}catch{picks.curse='C5';}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML = `
    <div class="sfx-heading"><div><p class="sfx-eyebrow">NEO / MATERIAL STUDIES</p><h1>Свет меняет всё.</h1><p>Пять тем. Двадцать семь вариантов. Выбери, как будет выглядеть сила.</p></div><span class="sfx-count">27<span>живых шейдеров</span></span></div>
    <div class="sfx-controls">
      <label>Фигура<select id="sfx-piece"><option value="n">Конь</option><option value="p">Пешка</option><option value="b">Слон</option><option value="r">Ладья</option><option value="q">Ферзь</option></select></label>
      <label>Материал проклятия<select id="sfx-curse-material"><option value="ordinary">Обычный</option><option value="stone">Камень</option><option value="glass">Стекло</option><option value="diamond">Алмаз</option><option value="ethereal">Эфир</option></select></label>
      <label>Фон<select id="sfx-background"><option value="board">Шахматная клетка</option><option value="dark">Тёмный</option><option value="light">Светлый</option></select></label>
      <label>Общая сила <output id="sfx-strength-value">100%</output><input id="sfx-strength" type="range" min="0" max="200" value="100" step="5"></label>
      <label>Скорость <output id="sfx-speed-value">1×</output><input id="sfx-speed" type="range" min="25" max="200" value="100" step="25"></label>
      <button id="sfx-pause" class="secondary-button" aria-pressed="${reduced.matches}">${reduced.matches ? '▶ Продолжить' : 'Ⅱ Пауза'}</button>
      <button id="sfx-original" class="secondary-button" aria-pressed="false">Без эффектов</button>
    </div>
    <div class="sfx-gallery" data-background="board"><canvas class="sfx-canvas" aria-hidden="true"></canvas></div>
    <div class="sfx-footer"><span id="sfx-status" role="status">Подготовка шейдеров…</span><span>Выбор сохраняется здесь. В игре используются выбранные пресеты D3, E4 и P5.</span></div>`;
  const mechanics=document.createElement('section');mechanics.className='imperial-mechanics';root.append(mechanics);setupEmperorMechanics(mechanics);
  const gallery = root.querySelector('.sfx-gallery'), canvas = root.querySelector('canvas');
  const slots = [];
  for (const [category, group] of effectGroups.entries()) {
    const section = document.createElement('section'); section.className = 'sfx-group';section.dataset.group=group.id;if(group.id==='emperor')section.id='emperor-effects';if(group.id==='curse')section.id='curse-effects'; section.style.setProperty('--sfx-accent', group.accent);
    const title = document.createElement('div'); title.className = 'sfx-group-title';
    title.innerHTML = `<div><h2>${group.title}</h2><p>${group.subtitle}</p></div><span class="sfx-choice"></span>`;
    if(group.id==='emperor')title.insertAdjacentHTML('beforeend','<button type="button" id="sfx-replay-emperor" class="secondary-button">↻ Повторить появление</button>');
    section.append(title);
    const cards = document.createElement('div'); cards.className = 'sfx-cards';
    const entries = [{ id: `${group.prefix}0`, name: 'Исходник', description: group.id === 'power' ? 'Обычная фигура Neo без усиления.' : 'Тот же PNG без шейдера.', index: 0, category }, ...variants.filter(variant => variant.group === group.id)];
    for (const entry of entries) {
      const card = document.createElement('button'); card.type = 'button'; card.className = `sfx-card${entry.index === 0 ? ' sfx-reference' : ''}`;
      card.dataset.variant = entry.id; card.setAttribute('aria-label', `${entry.id} · ${entry.name}`);
      const tuning = entry.intensity && entry.intensity !== 1 ? ` · ${Math.round(entry.intensity * 100)}%` : '';
      card.dataset.intensity = String(entry.intensity ?? 1);
      card.innerHTML = `<span class="sfx-card-id">${entry.index ? entry.id : 'NEO'}${tuning}<span class="sfx-check" aria-hidden="true">✓</span></span><span class="sfx-stage">${['w','b'].map(color=>`<span class="sfx-side" data-color="${color}"><img alt="${group.id==='emperor'?(color==='w'?'Император, 3–2 HP':'Император, 1 HP'):(color==='w'?'Белая фигура':'Чёрная фигура')}" draggable="false"></span>`).join('')}</span><span class="sfx-card-name">${entry.name}</span><span class="sfx-card-description">${entry.description}</span>`;
      for(const side of card.querySelectorAll('.sfx-side')) slots.push({ image: side.querySelector('img'), color: side.dataset.color, category, index: entry.index, group: group.id, intensity: entry.intensity ?? 1 });
      cards.append(card);
      if (entry.index) {
        card.setAttribute('aria-pressed', String(picks[group.id] === entry.id));
        card.addEventListener('click', () => {
          picks[group.id] = entry.id;
          try { localStorage.setItem(preferenceKey, JSON.stringify({...picks,_emperorRevision:6,_curseRevision:1})); } catch { /* Still usable in private browsing. */ }
          updatePicks();
          if(group.id==='emperor')renderer?.replay(entry.id);
        });
      } else { card.disabled = true; }
    }
    section.append(cards); gallery.append(section);
  }
  function updatePicks() {
    for (const [i, group] of effectGroups.entries()) {
      const section = gallery.querySelectorAll('.sfx-group')[i];
      const choice = variants.find(variant => variant.group === group.id && variant.id === picks[group.id]);
      section.querySelector('.sfx-choice').textContent = choice ? `Выбрано: ${choice.id} · ${choice.name} · ${Math.round(choice.intensity * 100)}%` : 'Выбери вариант';
      for (const card of section.querySelectorAll('[aria-pressed]')) card.setAttribute('aria-pressed', String(card.dataset.variant === choice?.id));
    }
  }
  updatePicks();
  let renderer;
  const status = (message, ready) => { root.querySelector('#sfx-status').textContent = message; gallery.classList.toggle('sfx-ready', ready); };
  try { renderer = createSpriteRenderer(canvas, slots, { onStatus: status,maxTextureSize:512,visibleOnly:true,readyMessage:'WebGL2 · 27 вариантов · один GPU-контекст' }); } catch (error) { status(error.message, false); }
  root.querySelector('#sfx-replay-emperor').addEventListener('click',()=>{
    if(reduced.matches)return;
    paused=false;const button=root.querySelector('#sfx-pause');button.setAttribute('aria-pressed','false');button.textContent='Ⅱ Пауза';
    renderer?.set({paused:false});renderer?.replay();
  });
  function loadSprites() {
    for (const slot of slots) slot.image.src = spriteUrl(slot.group, slot.color, root.querySelector('#sfx-piece').value, import.meta.env.BASE_URL,root.querySelector('#sfx-curse-material').value);
    renderer?.load();
  }
  root.querySelector('#sfx-piece').addEventListener('change', loadSprites);
  root.querySelector('#sfx-curse-material').addEventListener('change', loadSprites);
  root.querySelector('#sfx-background').addEventListener('change', event => { gallery.dataset.background = event.target.value; });
  let original = false, paused = reduced.matches;
  const strength = () => {
    const value = Number(root.querySelector('#sfx-strength').value);
    root.querySelector('#sfx-strength-value').textContent = `${value}%`;
    renderer?.set({ intensity: original ? 0 : value / 100 });
  };
  root.querySelector('#sfx-strength').addEventListener('input', strength);
  root.querySelector('#sfx-speed').addEventListener('input', event => {
    const speed = Number(event.target.value) / 100;
    root.querySelector('#sfx-speed-value').textContent = `${speed}×`;
    renderer?.set({ speed });
  });
  root.querySelector('#sfx-pause').addEventListener('click', event => {
    paused = !paused; event.currentTarget.setAttribute('aria-pressed', String(paused)); event.currentTarget.textContent = paused ? '▶ Продолжить' : 'Ⅱ Пауза'; renderer?.set({ paused });
  });
  root.querySelector('#sfx-original').addEventListener('click', event => {
    original = !original; event.currentTarget.setAttribute('aria-pressed', String(original)); strength();
  });
  reduced.addEventListener('change', event => {
    if (!event.matches) return;
    paused = true; const button = root.querySelector('#sfx-pause'); button.setAttribute('aria-pressed', 'true'); button.textContent = '▶ Продолжить';
  });
  loadSprites();
  window.addEventListener('pagehide', event => { if (!event.persisted) renderer?.dispose(); });
}
