import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectsForPiece} from '../src/piece-effects.js';
test('approved game effects follow current armor, ether and independent empowerment for both sides',()=>{
 for(const color of ['w','b'])for(const type of 'pnbrq'){
  const p={type,color};
  assert.deepEqual(effectsForPiece(p),[]);
  assert.deepEqual(effectsForPiece({...p,hp:2}),[]);
  assert.deepEqual(effectsForPiece({...p,material:'glass'}),[]);
  assert.deepEqual(effectsForPiece({...p,hp:3}).map(e=>e.id),['D3']);
  assert.deepEqual(effectsForPiece({...p,material:'ethereal',damage:2}).map(e=>e.id),['E4','P5']);
  assert.deepEqual(effectsForPiece({...p,hp:3,damage:2}).map(e=>e.id),['D3','P5']);
  assert.equal(effectsForPiece({...p,damage:2})[0].intensity,1.75);
 }
 assert.deepEqual(effectsForPiece({type:'k',material:'diamond',hp:3,damage:2}),[]);
});
