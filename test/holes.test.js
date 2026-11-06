import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {boardOutline} from '../src/biomes/board-outline.js';

test('a diagonal map step depends on its destination, not orthogonal walls or gaps',()=>{
 const r=new Run(0);r.enemies=[];r.loot=[];r.map={width:7,height:7,tiles:Array(49).fill(0),start:{x:3,y:3},exit:{x:5,y:5}};r.player={x:3,y:3};r.stage='exploring';
 r.map.tiles[3*7+3]=1;r.map.tiles[2*7+2]=1;
 for(const obstacles of [[0,1],[1,0],[0,0],[2,2]]){
  r.map.tiles[2*7+3]=obstacles[0];r.map.tiles[3*7+2]=obstacles[1];
  assert.equal(r.canStep(-1,-1),true);
 }
 assert.equal(r.step(-1,-1),true);assert.deepEqual(r.player,{x:2,y:2});
 r.map.tiles[1*7+1]=2;assert.equal(r.canStep(-1,-1),false);
});
test('board silhouettes omit interior holes and clipped corners without changing flip geometry',()=>{
 const b={left:0,right:7,bottom:1,top:8},holes=new Set(['b1','c1','d4']);
 const normal=boardOutline(b,holes),flipped=boardOutline(b,holes,true);
 assert.equal((normal.path.match(/M/g)??[]).length,61);
 assert.ok(!normal.path.includes('M1 7h'));assert.ok(!normal.path.includes('M3 4h'));
 assert.ok(!flipped.path.includes('M6 0h'));assert.equal((flipped.path.match(/M/g)??[]).length,61);
});
test('new battle gaps favour neighbouring clusters while protecting every starting figure',()=>{
 let total=0,neighbouring=0;
 for(let seed=0;seed<40;seed++){
  const r=new Run(seed*16,3);r.biomes[2]='ruins';r.setupFloor();const e=r.enemies.find(e=>e.guard),p=makeEncounter(r,e,[]),holes=Object.keys(p.world.tiles);
  assert.deepEqual(p.world,makeEncounter(r,e,[]).world);
  for(const s of holes){total++;if(holes.some(t=>s!==t&&Math.abs(s.charCodeAt(0)-t.charCodeAt(0))+Math.abs(Number(s.slice(1))-Number(t.slice(1)))===1))neighbouring++;assert.ok(!p.identities[s]);}
 }
 assert.ok(neighbouring/total>.6,`Only ${neighbouring}/${total} holes have a neighbour`);
});
