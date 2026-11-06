import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {wildChances,chooseWildTypes} from '../src/dungeon/wild.js';
import {randomSource,key,walkable,visibility} from '../src/dungeon/map.js';
import {weakPatrolTarget,advanceRoamers} from '../src/dungeon/patrol.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {wallFaces} from '../src/dungeon/walls.js';
import {effectsForPiece} from '../src/piece-effects.js';

test('wild pairs grow with both act and floor; diversity survives saves and cycles through every officer',()=>{
 assert.equal(wildChances(1,2).any,0);
 for(const act of [2,3])assert.ok(wildChances(act,2).pair>wildChances(act,1).pair);
 assert.ok(wildChances(3,1).pair>wildChances(2,1).pair);
 const run=new Run(91,2),random=randomSource(42),first=chooseWildTypes(run,2,random);
 const restored=Run.restore(run.snapshot()),second=chooseWildTypes(restored,2,random);
 assert.equal(new Set([...first,...second]).size,4);
 const all=[];for(let i=0;i<40;i++)all.push(...chooseWildTypes(restored,2,random));
 const counts=[...'nbrq'].map(t=>all.filter(v=>v===t).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=2);
 for(let seed=1;seed<=100;seed++)for(const act of [2,3]){
  const r=new Run(seed,act);for(const enemy of r.enemies.filter(e=>e.wild)){
   assert.equal(enemy.damage,2);const p=makeEncounter(r,enemy,[]);
   assert.equal([...parsePosition(p.fen).pieces.values()].find(p=>p.color==='wild').damage,2);
  }
 }
 assert.deepEqual(effectsForPiece({type:'n',color:'wild',hp:2,damage:2}).map(e=>e.id),['P5']);
});

test('boss materials escalate by act, final boss has a full army and a three-life emperor',()=>{
 const branches=new Set();
 for(let seed=1;seed<=50;seed++)for(let act=1;act<=4;act++){
  const r=new Run(seed,act);r.floor=act===4?1:3;r.setupFloor();
  const pieces=[...parsePosition(makeEncounter(r,r.enemies[0],[]).fen).pieces.values()].filter(p=>p.color==='b');
  assert.equal(pieces.find(p=>p.type==='k').hp,act===4?3:1);
  const diamond=pieces.filter(p=>p.hp===3&&!p.emperor),stone=pieces.filter(p=>p.hp===2);
  if(act===1){assert.equal(stone.length,1);assert.equal(stone[0].type,'p');assert.equal(diamond.length,0);}
  if(act===2){branches.add(diamond.length?'diamond':'stone');if(diamond.length){assert.equal(diamond[0].type,'p');assert.equal(stone.length,0);}else{assert.equal(stone.length,2);assert.equal(stone.filter(p=>p.type==='p').length,1);}}
  if(act===4){assert.equal(pieces.length,16);assert.deepEqual(diamond.map(p=>p.type).sort(),['p','q']);assert.equal(stone.length,3);}
 }
 assert.equal(branches.size,2);
});

test('extra encounters have distinct safe forward formations, no overlaps and persist without respawning',()=>{
 const styles=new Set();
 for(let seed=1;seed<=60;seed++){
  const r=new Run(seed),special=r.enemies.find(e=>e.special),weak=r.enemies.find(e=>e.weak);
  assert.ok(special);assert.equal(weak.type,'p');assert.ok(r.enemies.some(e=>e.roaming&&!e.weak&&!e.wild));
  styles.add(special.formationStyle);
  const preset=makeEncounter(r,special,[]),pieces=parsePosition(preset.fen).pieces;
  assert.ok([...pieces.entries()].some(([s,p])=>p.color==='b'&&Number(s[1])===preset.bounds.top-2));
  const positions=[r.player,r.map.exit,...r.enemies.filter(e=>!e.guard),...r.loot].map(p=>key(p.x,p.y));assert.equal(new Set(positions).size,positions.length);
  r.enemies=r.enemies.filter(e=>!e.weak&&!e.special);const restored=Run.restore(r.snapshot());assert.equal(restored.enemies.some(e=>e.weak||e.special),false);
 }
 assert.equal(styles.size,3);
});

test('weak patrol forgets player immediately, returns to route and jitters waypoint one or two cells',()=>{
 const r=new Run(83),pawn=r.enemies.find(e=>e.weak);
 const target=weakPatrolTarget(r,pawn,false),anchor=pawn.route[pawn.routeIndex];
 const distance=Math.abs(target.x-anchor.x)+Math.abs(target.y-anchor.y);assert.ok(distance>=1&&distance<=2);assert.ok(walkable(r.map,target.x,target.y));
 pawn.lastSeen={x:1,y:1};assert.deepEqual(weakPatrolTarget(r,pawn,true),r.player);assert.equal(pawn.chasing,true);
 assert.deepEqual(weakPatrolTarget(r,pawn,false),target);assert.equal(pawn.chasing,false);assert.equal(pawn.lastSeen,undefined);
 pawn.x=target.x;pawn.y=target.y;weakPatrolTarget(r,pawn,false);assert.equal(pawn.routeIndex,1);
 const restored=Run.restore(r.snapshot());assert.deepEqual(restored.enemies.find(e=>e.weak).waypoint,pawn.waypoint);
 // Exercise the actual sight/path integration, not only target selection.
 const distant=[];for(let y=1;y<r.map.height-1;y++)for(let x=1;x<r.map.width-1;x++)if(walkable(r.map,x,y)&&!visibility(r.map,pawn,5).includes(key(x,y)))distant.push({x,y});
 r.player=distant[0];pawn.chasing=true;advanceRoamers(r);assert.equal(pawn.chasing,false);
});

test('wall relief borders floor only and never reveals unseen neighboring terrain',()=>{
 const map={width:5,height:5,tiles:Array(25).fill(0)};map.tiles[2*5+3]=1;map.tiles[1*5+2]=1;
 assert.equal(wallFaces(map,2,2,new Set()),'');
 assert.equal(wallFaces(map,2,2,new Set(['3,2'])),'wall-e');
 assert.equal(wallFaces(map,2,2,new Set(['3,2','2,1','1,2'])),'wall-n wall-e');
});
