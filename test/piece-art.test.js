import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pieceImage,pieceMaterial,pieceSets,materials} from '../src/piece-sets.js';
import {parsePosition} from '../src/lab/scenarios.js';

test('every king stays ordinary even when material and combat attributes are supplied',()=>{
 for(const color of ['w','b'])for(const {id:material} of materials){const king={type:'k',color,material,hp:3,damage:2,glass:true};assert.equal(pieceMaterial(king),null);assert.equal(pieceImage(king,'neo','/'),`/pieces/neo/${color}k.png`);}
 const king=parsePosition('6k1/8/8/8/8/8/8/6K1 w - - 0 1 @g1=3/2/1').pieces.get('g1');
 assert.equal(king.hp,1);assert.equal(king.damage,1);assert.equal(king.glass,false);
});
test('only Neo remains and stale saved set IDs resolve to Neo',()=>{
 assert.deepEqual(pieceSets.map(s=>s.id),['neo']);assert.equal(pieceImage({color:'w',type:'n'},'merida','/'),'/pieces/neo/wn.png');
});
test('armor artwork follows remaining layers',()=>{
 assert.equal(pieceMaterial({type:'q',hp:3}),'diamond');assert.equal(pieceMaterial({type:'q',hp:2}),'stone');assert.equal(pieceMaterial({type:'q',hp:1}),null);
});
