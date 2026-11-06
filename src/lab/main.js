import {mountSoundControls} from '../audio/controls.js';
mountSoundControls();
import '../game-input.js';
import '../style.css';
import './style.css';
import { setupShaderLab } from './shaders/panel.js';
import {setupFogLab} from './fog.js';
import { DungeonEngine } from './client.js';
import { scenarios, parsePosition } from './scenarios.js';
import { pieceImage } from '../piece-sets.js';
import { createMoveAnimation, createMoveSound } from '../move-effects.js';
import {moveDetails} from '../battle/game.js';
import {setupArtifactLab} from '../artifacts/lab.js';
import {setupActLab} from './acts/panel.js';
import {setupExperiments} from './experiments/panel.js';

const $ = (id) => document.getElementById(id);
setupShaderLab($('effects-panel'));
const fogTab=document.createElement('button');fogTab.id='fog-tab';fogTab.textContent='Туман войны';fogTab.setAttribute('role','tab');fogTab.setAttribute('aria-controls','fog-panel');fogTab.setAttribute('aria-selected','false');fogTab.tabIndex=-1;document.querySelector('.lab-tabs').append(fogTab);
const artifactTab=document.createElement('button');artifactTab.id='artifacts-tab';artifactTab.textContent='Артефакты';artifactTab.setAttribute('role','tab');artifactTab.setAttribute('aria-controls','artifacts-panel');artifactTab.setAttribute('aria-selected','false');artifactTab.tabIndex=-1;document.querySelector('.lab-tabs').append(artifactTab);const artifactPanel=document.createElement('section');artifactPanel.id='artifacts-panel';artifactPanel.setAttribute('role','tabpanel');artifactPanel.setAttribute('aria-labelledby','artifacts-tab');artifactPanel.hidden=true;document.body.append(artifactPanel);setupArtifactLab(artifactPanel);
const actsTab=document.createElement('button');actsTab.id='acts-tab';actsTab.textContent='Акты и биомы';actsTab.setAttribute('role','tab');actsTab.setAttribute('aria-controls','acts-panel');actsTab.setAttribute('aria-selected','false');actsTab.tabIndex=-1;document.querySelector('.lab-tabs').append(actsTab);
const actsPanel=document.createElement('section');actsPanel.id='acts-panel';actsPanel.setAttribute('role','tabpanel');actsPanel.setAttribute('aria-labelledby','acts-tab');actsPanel.hidden=true;document.body.append(actsPanel);
const experimentsTab=document.createElement('button');experimentsTab.id='experiments-tab';experimentsTab.textContent='Эксперименты';experimentsTab.setAttribute('role','tab');experimentsTab.setAttribute('aria-controls','experiments-panel');experimentsTab.setAttribute('aria-selected','false');experimentsTab.tabIndex=-1;document.querySelector('.lab-tabs').append(experimentsTab);
const experimentsPanel=document.createElement('section');experimentsPanel.id='experiments-panel';experimentsPanel.setAttribute('role','tabpanel');experimentsPanel.setAttribute('aria-labelledby','experiments-tab');experimentsPanel.hidden=true;document.body.append(experimentsPanel);
let fogReady=false,actsReady=false,experimentsReady=false;
for (const name of ['effects', 'mechanics','fog','artifacts','acts','experiments']) $(`${name}-tab`).addEventListener('click', () => {
  for (const other of ['effects', 'mechanics','fog','artifacts','acts','experiments']) {
    $(`${other}-panel`).hidden = other !== name;
    $(`${other}-tab`).setAttribute('aria-selected', String(other === name));
    $(`${other}-tab`).tabIndex = other === name ? 0 : -1;
  }
  if(name==='fog'&&!fogReady){setupFogLab($('fog-panel'));fogReady=true;}
  if(name==='acts'&&!actsReady){setupActLab($('acts-panel'));actsReady=true;}
  if(name==='experiments'&&!experimentsReady){setupExperiments(experimentsPanel);experimentsReady=true;}
  window.dispatchEvent(new Event('resize'));
});
if(location.hash==='#fog')$('fog-tab').click();
if(location.hash==='#artifacts')$('artifacts-tab').click();
if(location.hash==='#acts')$('acts-tab').click();
if(location.hash==='#experiments')$('experiments-tab').click();
if(location.hash==='#material-studies'){$('experiments-tab').click();document.getElementById('material-studies').scrollIntoView({block:'start'});}
if(location.hash==='#dragon'){$('acts-tab').click();document.getElementById('dragon-study').scrollIntoView({block:'center'});}
if(location.hash==='#curse')document.getElementById('curse-effects').scrollIntoView({block:'start'});
if(location.hash==='#emperor')document.getElementById('emperor-effects').scrollIntoView({block:'start'});
document.querySelector('.lab-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('.lab-tabs button')];
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (tabs.indexOf(document.activeElement) + (event.key==='ArrowLeft'?-1:1)+tabs.length) % tabs.length;
  tabs[index].click(); tabs[index].focus();
});
const preferences = (() => { try { return JSON.parse(localStorage.getItem('chess-dungeons-v1')) ?? {}; } catch { return {}; } })();
const engine = new DungeonEngine();
const animation = createMoveAnimation($('board'));
const sound = createMoveSound(() => preferences.soundEnabled !== false);
let state, selected, busy = false;
const history = [];
let etherealSquares = new Set();
const etherealHistory = [];
const pieceSet = preferences.pieceSet ?? 'neo';
for (const scenario of scenarios) $('scenario').add(new Option(scenario.name, scenario.id));

function syncControls() {
  for (const id of ['scenario', 'lab-bot', 'lab-reset', 'lab-hunter', 'lab-auto', 'lab-depth']) $(id).disabled = busy || !state?.legal.length && id === 'lab-bot';
  $('lab-undo').disabled = busy || !history.length;
}

function render() {
  animation.cancel();
  const { pieces, turn } = parsePosition(state.fen);
  const targets = selected ? state.legal.filter((move) => move.slice(0, 2) === selected).map((move) => move.slice(2, 4)) : [];
  const cells = [];
  for (const rank of '87654321') for (const file of 'abcdefgh') {
    const square = file + rank, piece = pieces.get(square);
    const cell = $('board').querySelector(`[data-square="${square}"]`) ?? document.createElement('button');
    cell.type = 'button';
    cell.className = `square ${(file.charCodeAt(0) + Number(rank)) % 2 ? 'light' : 'dark'}${selected === square ? ' selected' : ''}`;
    cell.dataset.square = square;
    cell.setAttribute('aria-label', `${square}${piece ? ` ${piece.color} ${piece.type}, HP ${piece.hp}, урон ${piece.damage}${piece.glass ? ', стеклянная' : ''}` : ''}${targets.includes(square) ? ', допустимый ход' : ''}`);
    cell.replaceChildren();
    if (piece) {
      const image = document.createElement('img'); image.src = pieceImage({...piece, material: etherealSquares.has(square) ? 'ethereal' : undefined}, pieceSet, import.meta.env.BASE_URL); image.alt = ''; image.draggable = false; cell.append(image);
      if (piece.hp > 1 || piece.damage > 1 || piece.glass) {
        const badge = document.createElement('span'); badge.className = `piece-badge${piece.hp === 3 ? ' diamond-badge' : ''}`;
        badge.textContent = `${piece.hp > 1 ? piece.hp : ''}${piece.damage > 1 ? '⚡' : ''}${piece.glass ? '◇' : ''}`; cell.append(badge);
      }
    }
    if (targets.includes(square)) { const hint = document.createElement('span'); hint.className = piece ? 'capture-hint' : 'move-hint'; cell.append(hint); }
    if (file === 'a' || rank === '1') { const label = document.createElement('span');label.className = `coordinate ${file === 'a' ? 'rank' : 'file'}`;label.textContent = file === 'a' ? rank : file;cell.append(label); }
    cells.push(cell);
  }
  cells.forEach((cell, index) => { if ($('board').children[index] !== cell) $('board').insertBefore(cell, $('board').children[index] ?? null); });
  $('lab-turn').textContent = !state.legal.length ? state.check ? 'Мат · партия завершена' : 'Пат · ничья' : state.draw ? 'Ничья' : `${state.check ? 'Шах · ' : ''}Ход ${turn === 'w' ? 'белых' : 'чёрных'}`;
  syncControls();
}

async function guarded(action) {
  if (busy) return;
  busy = true;
  if (state) render();
  try { await action(); } catch (error) { $('lab-event').textContent = error.message; }
  finally { busy = false; syncControls(); }
}

async function loadScenario() {
  const scenario = scenarios.find(({ id }) => id === $('scenario').value);
  state = await engine.request(`load ${scenario.fen.replace('hunt=1', `hunt=${$('lab-hunter').checked ? 1 : 0}`)}`);
  history.length = 0; etherealHistory.length = 0; etherealSquares = new Set(scenario.ethereal ?? []); selected = null;
  $('scenario-description').textContent = scenario.description;
  $('lab-event').textContent = 'Выберите фигуру и допустимую клетку. Число на фигуре — оставшаяся прочность.';
  $('lab-search').textContent = '';
  render();
}

async function move(uci) {
  const before = animation.snapshot();
  const original = state.fen;
  const { turn } = parsePosition(original);
  state = await engine.request(`move ${uci}`);
  history.push({...moveDetails(original,uci,state.hit),hit:state.hit}); etherealHistory.push(new Set(etherealSquares));
  if (!state.hit) {
    const from = uci.slice(0,2), to = uci.slice(2,4), ethereal = etherealSquares.has(from);
    etherealSquares.delete(from); etherealSquares.delete(to);
    if (ethereal) etherealSquares.add(to);
  }
  selected = null;
  render();
  if (!state.hit) animation.play({ from: uci.slice(0, 2), to: uci.slice(2, 4), color: turn, flags: '' }, before);
  else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) $('board').querySelector(`[data-square="${uci.slice(2, 4)}"] :is(img,canvas.piece-shader)`)?.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}], {duration:170});
  sound.play();
  $('lab-event').textContent = state.hit ? `${uci.slice(0,2)} → ${uci.slice(2,4)} · удар: защита снята, атакующая фигура осталась на месте.` : `${uci.slice(0,2)} → ${uci.slice(2,4)} · ход выполнен.`;
}

async function bot() {
  if (!state.legal.length || state.draw) return;
  $('lab-event').textContent = 'Fairy-Stockfish рассчитывает ход с учётом защиты и урона…';
  const start = performance.now();
  const result = await engine.request(`search ${$('lab-depth').value} 1200`);
  $('lab-search').textContent = `Глубина ${result.depth} · ${result.nodes.toLocaleString('ru')} узлов · ${Math.round(performance.now()-start)} мс`;
  if (result.bestmove) await move(result.bestmove);
}

$('board').addEventListener('pointerdown', sound.unlock, {capture:true});
$('lab-bot').addEventListener('pointerdown', sound.unlock);
$('board').addEventListener('click', (event) => {
  if (busy || !state || state.draw || ($('lab-auto').checked && parsePosition(state.fen).turn === 'b')) return;
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (!square) return;
  const uci = state.legal.find((move) => move.slice(0,2) === selected && move.slice(2,4) === square);
  if (uci) guarded(async () => { await move(uci); if ($('lab-auto').checked && parsePosition(state.fen).turn === 'b') await bot(); });
  else { selected = selected === square ? null : parsePosition(state.fen).pieces.get(square)?.color === parsePosition(state.fen).turn ? square : null; render(); }
});
$('scenario').addEventListener('change', () => guarded(loadScenario));
$('lab-reset').addEventListener('click', () => guarded(loadScenario));
$('lab-hunter').addEventListener('change', () => guarded(async () => { state = await engine.request(`load ${state.fen.replace(/hunt=[01]/, `hunt=${$('lab-hunter').checked ? 1 : 0}`)}`); history.length=0; etherealHistory.length=0; selected=null; render(); }));
$('lab-auto').addEventListener('change', () => { if ($('lab-auto').checked && parsePosition(state.fen).turn === 'b') guarded(bot); });
$('lab-bot').addEventListener('click', () => guarded(bot));
$('lab-undo').addEventListener('click', () => guarded(async () => {
 const before=animation.snapshot();state=await engine.request('undo');const move=history.pop();
 etherealSquares=etherealHistory.pop()??new Set();selected=null;render();
 await animation.undo(move,before);$('lab-event').textContent='Ход отменён, прочность восстановлена.';
}));
guarded(loadScenario);
