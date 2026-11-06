import {chessFen} from '../src/battle/geometry.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {Run} from '../src/dungeon/run.js';
import {generateMap,walkable,neighbors,key,pathTo,visibility} from '../src/dungeon/map.js';
import {enemyTypes,aiProfile,makeEncounter,survivingIds} from '../src/dungeon/encounters.js';
import {campaignBattle} from '../src/dungeon/battle-link.js';
import {saveRun,loadRun} from '../src/dungeon/storage.js';

function articulationPoints(map){const seen=new Map(),low=new Map(),cuts=new Set();let timer=0;
 function visit(p,parent){const id=key(p.x,p.y);seen.set(id,++timer);low.set(id,timer);let children=0;
  for(const next of neighbors(map,p)){const n=key(next.x,next.y);if(n===parent)continue;if(!seen.has(n)){children++;visit(next,id);low.set(id,Math.min(low.get(id),low.get(n)));if(parent!==null&&low.get(n)>=seen.get(id))cuts.add(id);}else low.set(id,Math.min(low.get(id),seen.get(n)));}
  if(parent===null&&children>1)cuts.add(id);
 }visit(map.start,null);return {cuts,visited:seen.size};
}
test('1000 varied floor seeds stay connected, have closed borders and no single-cell choke points',()=>{
 const sizes=new Set(),layouts=new Set(),counts=new Set();for(let i=0;i<1000;i++){
  const map=generateMap(Math.imul(i+1,2654435761)>>>0);sizes.add(map.width+'x'+map.height);
  for(let x=0;x<map.width;x++){assert.equal(map.tiles[x],0);assert.equal(map.tiles[(map.height-1)*map.width+x],0);}
  for(let y=0;y<map.height;y++){assert.equal(map.tiles[y*map.width],0);assert.equal(map.tiles[y*map.width+map.width-1],0);}
  const graph=articulationPoints(map);assert.equal(graph.visited,map.tiles.filter(t=>t===1).length);assert.equal(graph.cuts.size,0,'seed '+i);assert.ok(pathTo(map,map.start,map.exit).length>0);
  layouts.add(map.layout);counts.add(map.rooms.length);assert.ok(map.rooms.length>=4&&map.rooms.length<=5);assert.ok(map.rooms.every(r=>r.w>=3&&r.h>=3));
  assert.ok(map.links.length>=map.rooms.length+1);
  for(let r=0;r<map.rooms.length;r++)assert.ok(map.links.filter(e=>e.a===r||e.b===r).length>=2);
  assert.notDeepEqual(map.start,map.exit);
 }assert.ok(sizes.size>10);assert.equal(layouts.size,4);assert.equal(counts.size,2);
});
test('layout generation is repeatable, rooms do not overlap, and exit is in the most distant room',()=>{
 for(const seed of [0,1,17,43,711,123456,0xffffffff]){
  const map=generateMap(seed);assert.deepEqual(generateMap(seed),map);
  for(let i=0;i<map.rooms.length;i++)for(let j=i+1;j<map.rooms.length;j++){
   const a=map.rooms[i],b=map.rooms[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
  }
  const exitLength=pathTo(map,map.start,map.exit).length;
  for(const room of map.rooms)assert.ok(pathTo(map,map.start,{x:room.cx,y:room.cy}).length<=exitLength);
 }
});
test('variable room counts keep enemies and three finds on distinct reachable floor cells',()=>{
 for(let seed=1;seed<=150;seed++){
  const run=new Run(seed),actors=[run.player,...run.enemies,...run.loot];
  assert.equal(new Set(actors.map(p=>key(p.x,p.y))).size,actors.length);
  assert.equal(run.loot.length,3);
  for(const actor of actors){assert.ok(walkable(run.map,actor.x,actor.y));assert.ok(pathTo(run.map,run.player,actor).length);}
 }
});
test('each exploration floor has a stronger roaming enemy and a slower pursuit clock',()=>{
 const run=new Run(43);const hunter=run.enemies.find(e=>e.roaming),guard=run.enemies.find(e=>e.guard);assert.ok(enemyTypes[hunter.type].rank>enemyTypes[guard.type].rank);
 const p={x:hunter.x,y:hunter.y};assert.equal(run.step(0,0),true);assert.deepEqual({x:hunter.x,y:hunter.y},p);run.step(0,0);assert.ok(Math.abs(hunter.x-p.x)+Math.abs(hunter.y-p.y)<=1);
 const turn=run.turns;assert.equal(run.step(9,0),false);assert.equal(run.turns,turn);
});
test('fog keeps exploration memory while walls block sight and hidden enemies stay undisclosed',()=>{
 const map={width:7,height:7,tiles:Array(49).fill(1)};for(let y=0;y<7;y++)map.tiles[y*7+3]=0;
 const seen=visibility(map,{x:2,y:3},3);assert.ok(seen.includes('3,3'));assert.ok(!seen.includes('4,3'));
 const run=new Run(20),previous=[...run.seen];run.step(0,0);assert.ok(previous.every(id=>run.seen.includes(id)));
});
test('ruins yield exactly three weak choices, disappear once, and cannot be claimed twice after reload',()=>{
 for(let seed=1;seed<=40;seed++){
  let run=new Run(seed);const loot=run.loot[0],from=neighbors(run.map,loot)[0];run.player=from;run.step(loot.x-from.x,loot.y-from.y);
  assert.equal(run.stage,'reward');assert.ok(!run.loot.some(l=>l.id===loot.id));
  const choices=run.pendingReward.options;assert.equal(choices.length,3);assert.equal(new Set(choices.map(o=>o.kind)).size,3);assert.ok(['glass','ethereal'].includes(choices[0].material));assert.ok(['p','n','b'].includes(choices[0].type));assert.ok(choices.every(o=>o.pieceId!=='king'));
  run=Run.restore(run.snapshot());assert.equal(run.chooseReward(0),true);const state=run.snapshot();assert.equal(run.chooseReward(0),false);assert.deepEqual(run.snapshot(),state);
 }
});
test('army markers change army size/value while AI depends only on act',()=>{
 let previous=0;const values={p:1,n:3,b:3,r:5,q:9};for(const profile of Object.values(enemyTypes)){const value=profile.army.reduce((s,t)=>s+values[t],0);assert.ok(value>previous);previous=value;}
 assert.ok(aiProfile(4).depth>aiProfile(1).depth);
 const run=new Run(71);for(const enemy of run.enemies){const preset=makeEncounter(run,enemy,run.inventory.map(p=>p.id));if(!enemy.kingless){const chess=new Chess(chessFen(preset.fen));assert.equal(chess.turn(),'w');assert.equal(chess.isCheck(),false);}else assert.ok(preset.fen.includes('wildmode=clear'));assert.ok(!preset.fen.includes('g1='));}
});
test('deployed ether is spent once; reserves, ordinary pieces and stone return; captured glass is lost',()=>{
 const run=new Run(15);run.inventory.push({id:'glass',type:'p',material:'glass'},{id:'ether',type:'n',material:'ethereal'},{id:'reserve',type:'b',material:'ethereal'},{id:'stone',type:'r',material:'stone'});run.buffs=[{pieceId:'stone',remaining:1}];
 const guard=run.enemies.find(e=>e.guard);run.openEncounter(guard);const preset=run.beginBattle(['queen','knight','glass','ether','stone']);
 assert.ok(!run.inventory.some(p=>p.id==='ether'));assert.ok(run.inventory.some(p=>p.id==='reserve'));assert.equal(run.buffs[0].remaining,0);assert.ok(preset.fen.includes('/2/0'));
 const parsed=new Chess(chessFen(preset.fen));assert.ok(![...parsed.board().flat()].some(p=>p?.type==='p'&&p.color==='w'&&p.square.endsWith('1')));
 run.finishBattle('win',new Set(['king','stone','knight']));
 assert.ok(!run.inventory.some(p=>p.id==='glass'));assert.ok(run.inventory.some(p=>p.id==='queen'));assert.equal(run.inventory.find(p=>p.id==='stone').material,'stone');assert.ok(run.inventory.some(p=>p.id==='reserve'));assert.equal(run.buffs.length,0);assert.ok(run.enemies.some(e=>e.roaming));assert.equal(run.stage,'exploring');assert.equal(run.floor,2);assert.equal(run.material,5);
 assert.throws(()=>run.finishBattle('win',new Set()),/уже завершён/);assert.equal(run.nextFloor(),false);
});
test('identity tracking distinguishes captures, armor hits, castling and promoted glass pawns',()=>{
 const preset={identities:{g1:'king',a7:'glass',h1:'rook'}};
 assert.deepEqual([...survivingIds(preset,[{from:'a7',to:'a8',target:'a8',hit:false},{from:'b8',to:'a8',target:'a8',hit:true}])].sort(),['glass','king','rook']);
 assert.ok(!survivingIds(preset,[{from:'a7',to:'a8',target:'a8',hit:false},{from:'b8',to:'a8',target:'a8',hit:false}]).has('glass'));
});
test('campaign battle saves are separate and stale tabs cannot duplicate settlement',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const run=new Run(81);run.openEncounter(run.enemies.find(e=>e.guard));run.beginBattle(['queen','knight']);saveRun(run,storage);
 const a=campaignBattle('?run='+run.id,storage),b=campaignBattle('?run='+run.id,storage);a.save({moves:[],resigned:false});
 assert.throws(()=>b.save({moves:[],resigned:false}),/другой вкладке/);
 const c=campaignBattle('?run='+run.id,storage);c.finish({result:{result:'loss'},moves:[]});assert.equal(loadRun(storage).stage,'defeat');assert.throws(()=>a.finish({result:{result:'win'},moves:[]}),/другой вкладке/);
});

test('map move hints use the same legality as a committed king step without consuming a turn',()=>{
 for(const seed of [15,71,81]){
  const run=new Run(seed),snapshot=run.snapshot();
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const hinted=run.canStep(dx,dy),copy=Run.restore(run.snapshot());
   assert.equal(copy.step(dx,dy),hinted);
   assert.equal(copy.turns,run.turns+(hinted?1:0));
  }
  assert.deepEqual(run.snapshot(),snapshot);
  run.stage='encounter';assert.equal(run.canStep(0,0),false);
 }
});

test('guardian settlement skips the completed floor once; other victories stay on the same floor',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const run=new Run(20261020);run.openEncounter(run.enemies.find(e=>e.guard));run.beginBattle(['queen']);saveRun(run,storage);
 const context=campaignBattle('?run='+run.id,storage),battle={result:{result:'win'},moves:[]};context.finish(battle);
 const next=loadRun(storage);assert.equal(next.floor,2);assert.equal(next.stage,'exploring');assert.equal(next.material,5);assert.equal(next.active,null);assert.deepEqual(next.player,next.map.start);
 assert.throws(()=>context.finish(battle),/другой вкладке/);assert.equal(loadRun(storage).material,5);
 const hunter=next.enemies.find(e=>e.roaming);next.openEncounter(hunter);next.beginBattle(['queen']);next.finishBattle('win',new Set(['king','queen']));assert.equal(next.floor,2);assert.equal(next.material,14);assert.equal(next.stage,'exploring');
});
