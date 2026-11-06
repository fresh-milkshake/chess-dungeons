// One search at a time: a stopped search must finish before a new position starts.
import { defaultElo, nativeMinElo, normalizeElo } from './engine-strength.js';

export class Engine {
  constructor({ onScore, onMove, onStatus, onFailure, createWorker = () => new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`) }) {
    Object.assign(this, { onScore, onMove, onStatus, onFailure });
    this.ready = false;
    this.active = null;
    this.pending = null;
    this.wanted = null;
    try {
      this.worker = createWorker();
      this.worker.onmessage = ({ data }) => this.receive(String(data));
      this.worker.onerror = () => this.fail();
      this.worker.postMessage('uci');
      this.timeout = setTimeout(() => this.fail(), 20000);
    } catch { this.fail(); }
  }

  fail() {
    clearTimeout(this.timeout);
    this.failed = true;
    this.worker?.terminate();
    this.onStatus('Stockfish недоступен · игра вдвоём работает');
    this.onFailure();
  }

  request(fen, play = false, elo = defaultElo) {
    if (this.failed) return;
    this.wanted = fen;
    this.pending = { fen, play, elo: normalizeElo(elo) };
    if (this.active && !this.stopping) {
      this.stopping = true;
      this.worker.postMessage('stop');
    }
    this.startPending();
  }

  startPending() {
    if (!this.ready || this.active || !this.pending) return;
    this.active = this.pending;
    this.pending = null;
    this.stopping = false;
    this.onStatus('Stockfish 19 lite · считает…');
    this.worker.postMessage(`setoption name UCI_LimitStrength value ${this.active.play}`);
    if (this.active.play) this.worker.postMessage(`setoption name UCI_Elo value ${Math.max(nativeMinElo, this.active.elo)}`);
    else this.worker.postMessage('setoption name Skill Level value 20');
    this.worker.postMessage(`position fen ${this.active.fen}`);
    this.worker.postMessage('go depth 16 movetime 900');
  }

  receive(line) {
    if (line === 'uciok') {
      this.worker.postMessage('setoption name Hash value 16');
      this.worker.postMessage('isready');
    }
    if (line === 'readyok') {
      clearTimeout(this.timeout);
      this.ready = true;
      this.onStatus('Stockfish 19 lite · готов');
      this.startPending();
    }
    if (!this.active) return;
    const score = line.match(/\bscore (cp|mate) (-?\d+)/);
    if (score && !this.active.play && this.active.fen === this.wanted && !this.stopping) {
      const sign = this.active.fen.split(' ')[1] === 'w' ? 1 : -1;
      this.onScore({ type: score[1], value: Number(score[2]) * sign });
    }
    if (line.startsWith('bestmove ')) {
      const finished = this.active;
      const valid = finished.fen === this.wanted && !this.stopping;
      this.active = null;
      this.onStatus('Stockfish 19 lite · оценка позиции');
      if (valid && finished.play) this.onMove(line.split(' ')[1], finished.fen);
      this.startPending();
    }
  }
}
