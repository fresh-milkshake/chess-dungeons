import {mountSoundControls} from './audio/controls.js';
mountSoundControls();
import './game-input.js';
import { Chess } from 'chess.js';
import { Engine } from './engine.js';
import { enableBoardDrag } from './board-drag.js';
import { pieceSets, defaultPieceSet, pieceImage } from './piece-sets.js';
import { minElo, maxElo, defaultElo, nativeMinElo, normalizeElo, chooseOpponentMove } from './engine-strength.js';
import { createMoveAnimation, createMoveSound } from './move-effects.js';
import './style.css';
import './mobile.css';

const $ = (id) => document.getElementById(id);
const game = new Chess();
const pieceNames = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
let selected = null;
let targets = [];
let flipped = false;
let mode = 'local';
let pieceSet = defaultPieceSet;
let engineElo = defaultElo;
let pendingPromotion = null;
let engineFailed = false;
let readyToRender = false;
let undoBusy=false;
const moveAnimation = createMoveAnimation($('board'));
const moveSound = createMoveSound(() => $('sound-enabled').checked);

try {
  const saved = JSON.parse(localStorage.getItem('chess-dungeons-v1'));
  if (saved) {
    if (saved.pgn) game.loadPgn(saved.pgn);
    mode = saved.mode === 'engine' ? 'engine' : 'local';
    flipped = !!saved.flipped;
    if (pieceSets.some(({ id }) => id === saved.pieceSet)) pieceSet = saved.pieceSet;
    engineElo = normalizeElo(saved.engineElo);
    $('show-eval').checked = saved.showEval !== false;
    $('sound-enabled').checked = saved.soundEnabled !== false;
  }
} catch { game.reset(); }
$('mode').value = mode;
for (const input of [$('elo'), $('elo-range')]) {
  input.min = String(minElo);
  input.max = String(maxElo);
}

function save() {
  try {
    localStorage.setItem('chess-dungeons-v1', JSON.stringify({ pgn: game.pgn(), mode, flipped, pieceSet, engineElo, soundEnabled: $('sound-enabled').checked, showEval: $('show-eval').checked }));
  } catch { /* Private browsing can disable storage; the current game still works. */ }
}

function imageFor(piece) {
  return pieceImage(piece, pieceSet, import.meta.env.BASE_URL);
}

function setupPieceSets() {
  for (const set of pieceSets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piece-set';
    button.dataset.pieceSet = set.id;
    button.setAttribute('aria-label', `${set.name} · ${set.detail}`);
    const preview = document.createElement('span');
    preview.className = 'piece-set-preview';
    preview.setAttribute('aria-hidden', 'true');
    for (const piece of [{ color: 'w', type: 'n' }, { color: 'b', type: 'q' }]) {
      const img = document.createElement('img');
      img.src = pieceImage(piece, set.id, import.meta.env.BASE_URL);
      img.alt = '';
      img.draggable = false;
      preview.append(img);
    }
    const name = document.createElement('span');
    name.className = 'piece-set-name';
    name.textContent = set.name;
    const detail = document.createElement('small');
    detail.textContent = set.detail;
    button.append(preview, name, detail);
    button.addEventListener('click', () => { pieceSet = set.id; render(); });
    $('piece-sets').append(button);
  }
}

function renderBoard() {
  moveAnimation.cancel();
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  const lastMove = game.history({ verbose: true }).at(-1);
  const squares = [];
  for (const [row, rank] of [...ranks].entries()) {
    for (const [col, file] of [...files].entries()) {
      const square = `${file}${rank}`;
      const piece = game.get(square);
      const button = $('board').querySelector(`[data-square="${square}"]`) ?? document.createElement('button');
      button.replaceChildren();
      const isTarget = targets.some((m) => m.to === square);
      button.type = 'button';
      button.className = `square ${(file.charCodeAt(0) + Number(rank)) % 2 ? 'light' : 'dark'}`;
      button.dataset.square = square;
      button.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'белые' : 'чёрные'} ${pieceNames[piece.type]}` : ''}${isTarget ? ', допустимый ход' : ''}`);
      button.setAttribute('aria-pressed', String(selected === square));
      if (lastMove && [lastMove.from, lastMove.to].includes(square)) button.classList.add('last-move');
      if (selected === square) button.classList.add('selected');
      if (piece?.type === 'k' && piece.color === game.turn() && game.isCheck()) button.classList.add('in-check');
      if (piece) {
        const img = document.createElement('img');
        img.src = imageFor(piece);
        img.alt = '';
        img.draggable = false;
        button.append(img);
      }
      if (isTarget) {
        const hint = document.createElement('span');
        hint.className = piece ? 'capture-hint' : 'move-hint';
        button.append(hint);
      }
      if (col === 0) {
        const label = document.createElement('span');
        label.className = 'coordinate rank';
        label.textContent = rank;
        button.append(label);
      }
      if (row === 7) {
        const label = document.createElement('span');
        label.className = 'coordinate file';
        label.textContent = file;
        button.append(label);
      }
      squares.push(button);
    }
  }
  const focused = document.activeElement?.dataset.square;
  squares.forEach((button, index) => {
    if ($('board').children[index] !== button) $('board').insertBefore(button, $('board').children[index] ?? null);
  });
  if (focused) $('board').querySelector(`[data-square="${focused}"]`)?.focus({ preventScroll: true });
}

function statusText() {
  if (game.isCheckmate()) return `Мат. Победа ${game.turn() === 'w' ? 'чёрных' : 'белых'}`;
  if (game.isStalemate()) return 'Ничья — пат';
  if (game.isThreefoldRepetition()) return 'Ничья — повторение позиции';
  if (game.isInsufficientMaterial()) return 'Ничья — недостаточно фигур';
  if (game.isDrawByFiftyMoves()) return 'Ничья — правило 50 ходов';
  if (game.isDraw()) return 'Ничья';
  if (mode === 'engine' && game.turn() === 'b') return 'Stockfish думает…';
  return `${game.isCheck() ? 'Шах. ' : ''}Ход ${game.turn() === 'w' ? 'белых' : 'чёрных'}`;
}

function renderHistory() {
  const moves = game.history();
  $('move-count').textContent = String(moves.length);
  if (!moves.length) {
    $('move-list').innerHTML = '<div class="empty-moves">История начинается с первого хода.</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < moves.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    for (const [index, text] of [`${i / 2 + 1}.`, moves[i], moves[i + 1] ?? ''].entries()) {
      const cell = document.createElement('span');
      cell.textContent = text;
      if (index && i + index - 1 === moves.length - 1) cell.className = 'latest';
      row.append(cell);
    }
    fragment.append(row);
  }
  $('move-list').replaceChildren(fragment);
  $('move-list').scrollTop = $('move-list').scrollHeight;
}

function renderCaptured() {
  const taken = { w: [], b: [] };
  for (const move of game.history({ verbose: true })) {
    if (move.captured) taken[move.color].push({ color: move.color === 'w' ? 'b' : 'w', type: move.captured });
  }
  for (const color of ['w', 'b']) {
    const fragment = document.createDocumentFragment();
    for (const piece of taken[color].sort((a, b) => 'pnbrq'.indexOf(a.type) - 'pnbrq'.indexOf(b.type))) {
      const img = document.createElement('img');
      img.src = imageFor(piece);
      img.alt = `Взята: ${pieceNames[piece.type]}`;
      fragment.append(img);
    }
    $(color === 'w' ? 'white-captured' : 'black-captured').replaceChildren(fragment);
  }
}

function render() {
  renderBoard();
  renderHistory();
  renderCaptured();
  $('status').textContent = statusText();
  $('undo').disabled = undoBusy || !game.history().length;
  for(const id of ['flip','new-game','mode','elo','elo-range','show-eval','sound-enabled'])$(id).disabled=undoBusy;
  $('white-turn').hidden = game.turn() !== 'w' || game.isGameOver();
  $('black-turn').hidden = game.turn() !== 'b' || game.isGameOver();
  $('black-name').textContent = mode === 'engine' ? 'Stockfish' : 'Чёрные';
  $('black-detail').textContent = mode === 'engine' ? `${engineElo < nativeMinElo ? 'Учебный режим' : 'Stockfish 19 lite'} · ${engineElo} Elo` : 'За одной доской';
  $('white-detail').textContent = mode === 'engine' ? 'Вы играете белыми' : 'За одной доской';
  $('board-hint').textContent = game.isGameOver() ? 'Партия завершена' : selected ? 'Выберите подсвеченную клетку' : 'Выберите фигуру, чтобы увидеть ходы';
  $('evaluation').hidden = !$('show-eval').checked;
  $('evaluation').classList.toggle('flipped', flipped);
  $('engine-strength').hidden = mode !== 'engine' || engineFailed;
  $('elo').value = String(engineElo);
  $('elo-range').value = String(engineElo);
  $('elo-note').textContent = engineElo < nativeMinElo
    ? 'Учебный режим с дополнительными ошибками. Elo — условная сложность.'
    : 'Целевая сила движка, приблизительный рейтинг.';
  for (const button of $('piece-sets').children) {
    button.disabled=undoBusy;
    button.setAttribute('aria-pressed', String(button.dataset.pieceSet === pieceSet));
  }
  save();
}

function updateScore({ type, value }) {
  let numeric = type === 'cp' ? value / 100 : Math.sign(value || 1) * 100;
  if (game.isCheckmate()) numeric = game.turn() === 'w' ? -100 : 100;
  if (game.isDraw()) numeric = 0;
  $('eval-white').style.height = `${50 + 47 * Math.tanh(numeric / 5)}%`;
  $('eval-number').textContent = game.isCheckmate() ? (numeric > 0 ? '1–0' : '0–1') : game.isDraw() ? '0.0' : type === 'mate' ? `${value < 0 ? '−' : ''}M${Math.abs(value)}` : `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}`;
  $('evaluation').setAttribute('aria-valuenow', String(Math.max(-10, Math.min(10, numeric))));
  $('evaluation').setAttribute('aria-valuetext', $('eval-number').textContent);
}

const engine = new Engine({
  onScore: updateScore,
  onStatus: (text) => { $('engine-status').textContent = text; },
  onFailure: () => {
    engineFailed = true;
    mode = 'local';
    $('mode').value = mode;
    $('mode').querySelector('[value="engine"]').disabled = true;
    $('eval-number').textContent = '—';
    if (readyToRender) render();
  },
  onMove: (uci, fen) => {
    if (undoBusy || mode !== 'engine' || game.fen() !== fen || game.turn() !== 'b' || game.isGameOver()) return;
    try {
      const legalMoves = game.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);
      const chosen = chooseOpponentMove(uci, legalMoves, engineElo);
      playMove({ from: chosen.slice(0, 2), to: chosen.slice(2, 4), promotion: chosen[4] });
    } catch { $('engine-status').textContent = 'Не удалось получить ход · переключитесь на игру вдвоём'; }
  },
});

function analyze() {
  if (engineFailed) return;
  if (game.isGameOver()) updateScore({ type: 'cp', value: 0 });
  engine.request(game.fen(), mode === 'engine' && game.turn() === 'b' && !game.isGameOver(), engineElo);
}

function changed() {
  selected = null;
  targets = [];
  render();
  analyze();
}

function playMove(move, animate = true) {
  const before = animate ? moveAnimation.snapshot() : null;
  const result = game.move(move);
  changed();
  if (before) moveAnimation.play(result, before);
  moveSound.play();
}

function chooseSquare(square, animate = true) {
  if (undoBusy || game.isGameOver() || pendingPromotion || (mode === 'engine' && game.turn() === 'b')) return;
  const move = targets.find((candidate) => candidate.to === square);
  if (selected && move) {
    if (move.promotion) {
      pendingPromotion = { from: selected, to: square };
      const options = $('promotion').querySelector('.promotion-options');
      options.replaceChildren();
      for (const type of ['q', 'r', 'b', 'n']) {
        const button = document.createElement('button');
        button.setAttribute('aria-label', pieceNames[type]);
        const img = document.createElement('img');
        img.src = imageFor({ color: game.turn(), type });
        img.alt = pieceNames[type];
        button.append(img);
        button.onclick = () => {
          const promotedMove = { ...pendingPromotion, promotion: type };
          pendingPromotion = null;
          $('promotion').close();
          playMove(promotedMove, animate);
        };
        options.append(button);
      }
      $('promotion').showModal();
      return;
    }
    playMove({ from: selected, to: square }, animate);
    return;
  }
  if (selected === square) selected = null;
  else selected = game.get(square)?.color === game.turn() ? square : null;
  targets = selected ? game.moves({ square: selected, verbose: true }) : [];
  render();
}

const suppressDragClick = enableBoardDrag({
  board: $('board'),
  canDrag: (square) => {
    if (undoBusy || game.isGameOver() || pendingPromotion || (mode === 'engine' && game.turn() === 'b')) return null;
    const piece = game.get(square);
    return piece?.color === game.turn() ? piece : null;
  },
  select: (square) => {
    selected = square;
    targets = game.moves({ square, verbose: true });
    render();
  },
  drop: (square) => chooseSquare(square, false),
  imageFor,
  onCancel: () => { selected = null; targets = []; render(); },
});

$('board').addEventListener('click', (event) => {
  if (suppressDragClick()) return;
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (square) chooseSquare(square);
});
$('board').addEventListener('keydown', (event) => {
  const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
  if (!(event.key in keys)) return;
  event.preventDefault();
  const squares = [...$('board').children];
  const index = squares.indexOf(event.target.closest('[data-square]'));
  squares[Math.max(0, Math.min(63, index + keys[event.key]))]?.focus();
});
$('promotion').addEventListener('cancel', () => { pendingPromotion = null; });
$('board').addEventListener('pointerdown', moveSound.unlock, { capture: true });
$('board').addEventListener('pointerup', event => { if (event.pointerType === 'touch') moveSound.unlock(); }, { capture: true });
$('board').addEventListener('keydown', moveSound.unlock, { capture: true });
$('mode').addEventListener('pointerdown', moveSound.unlock);
$('mode').addEventListener('keydown', moveSound.unlock);
$('sound-enabled').addEventListener('change', () => {
  if ($('sound-enabled').checked) moveSound.unlock();
  else moveSound.stop();
  save();
});
$('show-eval').addEventListener('change', render);
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
$('mode').addEventListener('change', () => { mode = $('mode').value; changed(); });
$('elo-range').addEventListener('input', () => { $('elo').value = $('elo-range').value; });
for (const input of [$('elo'), $('elo-range')]) {
  input.addEventListener('change', () => {
    const nextElo = normalizeElo(input.valueAsNumber, engineElo);
    const changedStrength = nextElo !== engineElo;
    engineElo = nextElo;
    render();
    if (changedStrength && mode === 'engine' && game.turn() === 'b' && !game.isGameOver()) analyze();
  });
}
$('undo').addEventListener('click', async () => {
  if(undoBusy)return;undoBusy=true;selected=null;targets=[];
  try{
    do{
      const before=moveAnimation.snapshot(),move=game.undo();render();
      if(move)await moveAnimation.undo(move,before);
    }while(mode==='engine'&&game.turn()==='b'&&game.history().length);
  }finally{undoBusy=false;changed();}
});
$('new-game').addEventListener('click', () => {
  if (game.history().length && !game.isGameOver()) $('restart').showModal();
  else { game.reset(); changed(); }
});
$('cancel-restart').addEventListener('click', () => $('restart').close());
$('confirm-restart').addEventListener('click', () => { $('restart').close(); game.reset(); changed(); });
readyToRender = true;
setupPieceSets();
if (engineFailed) { mode = 'local'; $('mode').value = mode; }
render();
analyze();
