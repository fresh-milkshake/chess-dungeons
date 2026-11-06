import test from 'node:test';
import assert from 'node:assert/strict';
import {boardTransition,wheelZoom} from '../src/battle/view.js';
test('preparation transition maps the battle board exactly onto its previous rectangle',()=>{
 const from={x:250,y:90,width:500,height:400},to={x:200,y:24,width:750,height:600};
 const d=boardTransition(from,to);assert.equal(d.sx,2/3);assert.equal(d.sy,2/3);
 assert.equal(to.x+to.width/2+d.x,from.x+from.width/2);
 assert.equal(to.y+to.height/2+d.y,from.y+from.height/2);
 assert.equal(boardTransition(null,to),null);
});
test('centered wheel zoom normalizes wheel units and remains bounded',()=>{
 assert.ok(wheelZoom(1,-100)>1);assert.ok(wheelZoom(1,100)<1);
 assert.equal(wheelZoom(1,3,1),wheelZoom(1,48));
 assert.equal(wheelZoom(2.5,-100),2.5);assert.equal(wheelZoom(.75,100),.75);
});
