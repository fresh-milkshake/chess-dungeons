import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enemyFormation,formationScore} from '../src/dungeon/enemy-formation.js';
const bounds={left:0,right:7,bottom:1,top:8},army=['q','r','b','n','p','p','p'];
test('harder formations improve structural score without rerolls or composition changes',()=>{
 let gains=0;const unique=new Set();
 for(let seed=1;seed<=150;seed++){
  const enemy={id:'test',type:'q'},run={seed,floor:1,act:1};
  const easy=enemyFormation(run,enemy,army,bounds),hard=enemyFormation({...run,act:3},enemy,army,bounds);
  assert.deepEqual(enemyFormation({...run,counter:999},enemy,army,bounds),easy);
  assert.deepEqual(hard.map(p=>p.type).sort(),['k',...army].sort());
  const a=formationScore(easy,bounds),b=formationScore(hard,bounds);assert.ok(b>=a);if(b>a)gains++;
  unique.add(JSON.stringify(hard));
 }
 assert.ok(gains>40);assert.ok(unique.size>50);
});
