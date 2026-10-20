import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';

function setup() {
  const commands = [], scores = [], moves = [];
  const worker = { postMessage: (command) => commands.push(command), terminate() {} };
  const engine = new Engine({ createWorker: () => worker, onScore: (s) => scores.push(s), onMove: (...args) => moves.push(args), onStatus() {}, onFailure() {} });
  engine.receive('uciok');
  engine.receive('readyok');
  return { engine, commands, scores, moves };
}

test('undo or a new game discards both score and bestmove from an obsolete search', () => {
  const { engine, commands, moves, scores } = setup();
  engine.request('old b - - 0 1', true);
  engine.request('intermediate w - - 0 1');
  engine.request('new w - - 0 1');
  engine.receive('info depth 8 score cp 350');
  engine.receive('bestmove e7e5');
  assert.deepEqual(scores, []);
  assert.deepEqual(moves, []);
  assert.equal(commands.filter((c) => c === 'stop').length, 1);
  assert.equal(commands.includes('position fen intermediate w - - 0 1'), false);
  assert.equal(commands.at(-2), 'position fen new w - - 0 1');
  engine.receive('info depth 8 score cp 75');
  assert.deepEqual(scores, [{ type: 'cp', value: 75 }]);
});

test('scores are always from white perspective and engine replies retain their position', () => {
  const { engine, scores, moves } = setup();
  engine.request('position b - - 0 1', true);
  engine.receive('info depth 8 score cp 125');
  engine.receive('info depth 9 score mate -3');
  engine.receive('bestmove e7e5 ponder g1f3');
  assert.deepEqual(scores, [{ type: 'cp', value: -125 }, { type: 'mate', value: 3 }]);
  assert.deepEqual(moves, [['e7e5', 'position b - - 0 1']]);
});

test('switching to local play while thinking cannot execute the cancelled engine reply', () => {
  const { engine, moves } = setup();
  engine.request('same b - - 0 1', true);
  engine.request('same b - - 0 1', false);
  engine.receive('bestmove e7e5');
  engine.receive('bestmove c7c5');
  assert.deepEqual(moves, []);
});
