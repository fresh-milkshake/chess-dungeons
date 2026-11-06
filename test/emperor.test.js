import test from 'node:test';
import assert from 'node:assert/strict';
import {emperorFixture,emperorLegal,emperorCheck,emperorStatus,moveEmperorLab,emperorDamage} from '../src/lab/acts/emperor-rules.js';
import {effectGroups,variants,spriteUrl} from '../src/lab/shaders/variants.js';
import {effectsForPiece} from '../src/piece-effects.js';
test('seven emperor studies compare the ordinary and final black sprites without changing approved presets',()=>{
 assert.equal(effectGroups.find(g=>g.id==='emperor').variants.length,7);
 assert.deepEqual(variants.filter(v=>v.group==='emperor').map(v=>v.id),['I1','I2','I3','I4','I5','I6','I7']);
 assert.match(spriteUrl('emperor','w','n','/'),/b-emperor-v2.png/);assert.match(spriteUrl('emperor','b','n','/'),/b-emperor-final.png/);
 assert.deepEqual(effectsForPiece({type:'k',color:'b',hp:1,damage:2}),[]);
});
test('armored emperor may stand and move under attack; the final form is royal',()=>{
 for(const hp of [3,2,1]){const s=emperorFixture('armor',hp);s.turn='b';assert.equal(emperorCheck(s),hp===1);assert.equal(emperorLegal(s).some(m=>m.id==='emperor'&&m.x===4&&m.y===2),hp>1);}
});
test('hits remove armor without moving the attacker and the last HP immediately activates check',()=>{
 let s=emperorFixture();s=moveEmperorLab(s,{id:'wr',x:3,y:2});assert.equal(s.pieces.find(p=>p.type==='emperor').hp,2);assert.equal(s.last.hit,true);assert.equal(s.pieces.find(p=>p.id==='wr').x,0);
 s=moveEmperorLab(s,{id:'bn',x:4,y:2});s=moveEmperorLab(s,{id:'wr',x:3,y:2});assert.equal(s.pieces.find(p=>p.type==='emperor').hp,1);assert.equal(emperorCheck(s),true);
});
test('final emperor deals two damage to armor while retaining king movement and no power effect',()=>{
 const s=emperorFixture('damage',1),next=moveEmperorLab(s,{id:'emperor',x:3,y:3});assert.equal(emperorDamage(s.pieces[0]),2);assert.equal(next.pieces.find(p=>p.id==='wp').hp,1);assert.equal(next.last.hit,true);assert.equal(next.pieces[0].y,2);
 assert.ok(emperorLegal(s).every(m=>m.id!=='emperor'||Math.max(Math.abs(m.x-3),Math.abs(m.y-2))===1));
});
test('mate exists only on the last life and direct royal capture is never legal',()=>{
 assert.equal(emperorStatus(emperorFixture('mate',1)).mate,true);assert.equal(emperorStatus(emperorFixture('mate',3)).mate,false);
 let s=emperorFixture('armor',3);s.pieces.find(p=>p.id==='wr').damage=4;s=moveEmperorLab(s,{id:'wr',x:3,y:2});assert.equal(s.pieces.find(p=>p.type==='emperor').hp,1);
 s.turn='w';assert.ok(!emperorLegal(s).some(m=>m.id==='wr'&&m.x===3&&m.y===2));
});
