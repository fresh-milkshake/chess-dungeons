import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outcome,moveDetails,moveEthereal} from '../src/battle/game.js';

const kings='6k1/8/8/8/8/8/8/6K1 w - - 0 1 @hunt=0';
test('battle results distinguish mate, stalemate, resignation and insufficient material',()=>{
 assert.equal(outcome({fen:kings,legal:[],check:true}).result,'loss');
 assert.equal(outcome({fen:kings.replace(' w ',' b '),legal:[],check:true}).result,'win');
 assert.equal(outcome({fen:kings,legal:[],check:false}).result,'draw');
 assert.equal(outcome({fen:kings,legal:['g1h1'],check:false}).detail,'Недостаточно материала для мата.');
 assert.equal(outcome({fen:kings,legal:['g1h1']},true).result,'loss');
 assert.equal(outcome({fen:'6k1/8/8/8/8/8/8/1N4K1 w - - 0 1 @b1=2/1/0',legal:['b1c3']}),null);
});
test('ether follows castling rook, en passant victim, promotion and nonlethal hit',()=>{
 const castle='4k3/8/8/8/8/8/8/4K2R w K - 0 1';
 assert.deepEqual([...moveEthereal(new Set(['h1']),castle,'e1h1',false)],['f1']);
 assert.equal(moveDetails(castle,'e1h1',false).to,'g1');
 assert.equal(moveDetails(castle,'e1g1',false).label,'O-O');
 assert.deepEqual([...moveEthereal(new Set(['h1']),castle,'e1g1',false)],['f1']);
 const ep='6k1/8/8/3pP3/8/8/8/6K1 w - d6 0 1';
 assert.deepEqual([...moveEthereal(new Set(['d5','e5']),ep,'e5d6',false)],['d6']);
 assert.deepEqual([...moveEthereal(new Set(['d5','e5']),ep,'e5d6',true)],['d5','e5']);
 assert.deepEqual([...moveEthereal(new Set(['a7']),'6k1/P7/8/8/8/8/8/6K1 w - - 0 1','a7a8n',false)],['a8']);
});
