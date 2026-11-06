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

test('analysis scores are from white perspective and engine replies retain their position', () => {
  const { engine, scores, moves } = setup();
  engine.request('position b - - 0 1');
  engine.receive('info depth 8 score cp 125');
  engine.receive('info depth 9 score mate -3');
  engine.receive('bestmove e7e5');
  engine.request('position b - - 0 1', true);
  engine.receive('bestmove e7e5 ponder g1f3');
  assert.deepEqual(scores, [{ type: 'cp', value: -125 }, { type: 'mate', value: 3 }]);
  assert.deepEqual(moves, [['e7e5', 'position b - - 0 1']]);
});

test('Elo limits the opponent, while subsequent analysis restores full strength', () => {
  const { engine, commands, scores } = setup();
  engine.request('position b - - 0 1', true, 1753);
  assert.ok(commands.includes('setoption name UCI_LimitStrength value true'));
  assert.ok(commands.includes('setoption name UCI_Elo value 1753'));
  engine.receive('info depth 8 score cp 125');
  assert.deepEqual(scores, []);
  engine.receive('bestmove e7e5');
  const beforeAnalysis = commands.length;
  engine.request('next w - - 0 2', false, 1753);
  assert.deepEqual(commands.slice(beforeAnalysis, beforeAnalysis + 2), [
    'setoption name UCI_LimitStrength value false',
    'setoption name Skill Level value 20',
  ]);
  engine.receive('info depth 8 score cp 30');
  assert.deepEqual(scores, [{ type: 'cp', value: 30 }]);
});

test('changing Elo during a search drops the old move and uses the latest Elo', () => {
  const { engine, commands, moves } = setup();
  engine.request('same b - - 0 1', true, 1500);
  engine.request('same b - - 0 1', true, 2100);
  engine.receive('bestmove e7e5');
  assert.deepEqual(moves, []);
  assert.ok(commands.includes('setoption name UCI_Elo value 2100'));
  engine.receive('bestmove c7c5');
  assert.deepEqual(moves, [['c7c5', 'same b - - 0 1']]);
});

test('beginner difficulty never sends an unsupported Elo value to Stockfish', () => {
  const { engine, commands } = setup();
  engine.request('position b - - 0 1', true, 100);
  assert.ok(commands.includes('setoption name UCI_Elo value 1320'));
  assert.equal(commands.includes('setoption name UCI_Elo value 100'), false);
});

test('switching to local play while thinking cannot execute the cancelled engine reply', () => {
  const { engine, moves } = setup();
  engine.request('same b - - 0 1', true);
  engine.request('same b - - 0 1', false);
  engine.receive('bestmove e7e5');
  engine.receive('bestmove c7c5');
  assert.deepEqual(moves, []);
});
