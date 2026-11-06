import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { chooseOpponentMove, normalizeElo } from '../src/engine-strength.js';

test('100 Elo can select every legal move, including promotion choices', () => {
  const game = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const moves = game.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);
  for (let i = 0; i < moves.length; i++) {
    const samples = [0.99, (i + 0.5) / moves.length];
    const chosen = chooseOpponentMove(moves[0], moves, 100, () => samples.shift());
    assert.equal(chosen, moves[i]);
    const position = new Chess(game.fen());
    assert.ok(position.move({ from: chosen.slice(0, 2), to: chosen.slice(2, 4), promotion: chosen[4] }));
  }
});

test('native difficulty preserves the engine reply without random sampling', () => {
  for (const elo of [1320, 1753, 3190]) {
    assert.equal(chooseOpponentMove('e7e5', ['e7e5', 'a7a5'], elo, () => { throw new Error('Unexpected randomness'); }), 'e7e5');
  }
});

test('intermediate beginner difficulty can retain or replace the engine move', () => {
  assert.equal(chooseOpponentMove('e7e5', ['e7e5', 'a7a5'], 700, () => 0.99), 'e7e5');
  const samples = [0, 0.99];
  assert.equal(chooseOpponentMove('e7e5', ['e7e5', 'a7a5'], 700, () => samples.shift()), 'a7a5');
});

test('saved difficulty is bounded and integer-valued', () => {
  assert.equal(normalizeElo(1), 100);
  assert.equal(normalizeElo(5000), 3190);
  assert.equal(normalizeElo(100.4), 100);
  assert.equal(normalizeElo(undefined), 1600);
});
