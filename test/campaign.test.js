import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {Run} from '../src/dungeon/run.js';
import {makeEncounter,encounterReward,enemyTypes,aiProfile} from '../src/dungeon/encounters.js';
import {chessFen,encounterBounds,inside,fullBoard} from '../src/battle/geometry.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {makeShop,canReceive,captureMaterial} from '../src/dungeon/balance.js';
import {validateWildSetup} from '../src/battle/wild-rules.js';

const win=(run,enemy=run.enemies.find(e=>e.guard))=>{if(run.stage!=='encounter')run.openEncounter(enemy);run.beginBattle(run.inventory.map(p=>p.id));run.finishBattle('win',new Set(run.inventory.map(p=>p.id)));};
test('ten explored floors, four exit bosses and three shops form a complete campaign',()=>{
 let run=new Run(401),bosses=0,shops=0;
 for(let act=1;act<=4;act++){
  assert.equal(run.act,act);
  for(let floor=1;floor<=(act===4?0:2);floor++){
   assert.equal(run.floor,floor);assert.equal(run.stage,'exploring');
   const guard=run.enemies.find(e=>e.guard),hunter=run.enemies.find(e=>e.roaming);
   assert.ok(enemyTypes[hunter.type].rank>enemyTypes[guard.type].rank);
   win(run);
  }
  assert.equal(run.floor,act===4?1:3);assert.equal(run.stage,'exploring');
  const boss=run.enemies.find(e=>e.guard);assert.ok(boss.boss);assert.deepEqual({x:boss.x,y:boss.y},run.map.exit);run.openEncounter(boss);assert.equal(run.retreat(),false);assert.deepEqual(makeEncounter(run,boss,[]).bounds,act===4?encounterBounds(run,boss):fullBoard);
  const marked=[...parsePosition(makeEncounter(run,boss,[]).fen).pieces.values()].filter(p=>p.hp===3&&!p.emperor);assert.equal(marked.length,boss.armor.filter(p=>p.material==='diamond').length);
  win(run);bosses++;assert.equal(run.stage,'boss-reward');assert.ok(run.inventory.some(p=>p.id===`boss-pawn-${act}`));
  run=Run.restore(run.snapshot());assert.equal(run.chooseBossReward(0),true);assert.equal(run.chooseBossReward(0),false);
  if(act===4){assert.equal(run.stage,'victory');break;}
  shops++;assert.equal(run.stage,'shop');assert.deepEqual(run.shop,makeShop(run));
  const stock=JSON.stringify(run.shop);run=Run.restore(run.snapshot());assert.equal(JSON.stringify(run.shop),stock);
  const shopDistance=run.map.width-1;for(let x=0;x<shopDistance;x++)assert.equal(run.step(1,0),true);
  assert.equal(run.act,act+1);assert.equal(run.floor,1);assert.equal(run.stage,'exploring');
 }
 assert.equal(bosses,4);assert.equal(shops,3);
});
test('shop charges exactly once, requires physical contact and respects affordability and caps',()=>{
 let run=new Run(401);run.floor=3;run.setupFloor();win(run);run.chooseBossReward(0);
 const item=run.shop.items[1];run.material=100;assert.equal(run.buyShop(item.id),false);
 run.player={x:item.x,y:item.y};const count=run.inventory.length;run.material=item.price-1;
 assert.equal(run.buyShop(item.id),false);assert.equal(item.sold,false);
 run.material=item.price;assert.equal(run.buyShop(item.id),true);assert.equal(run.material,0);assert.equal(run.inventory.length,count+1);
 run=Run.restore(run.snapshot());run.material=100;assert.equal(run.buyShop(item.id),false);assert.equal(run.material,100);
 assert.ok(!run.shop.items.some(p=>p.material==='diamond'||p.type==='k'));
 run.inventory.push(...Array.from({length:20},(_,i)=>({id:`cap-${i}`,type:'p',material:'ordinary'})));assert.equal(canReceive(run,'ordinary'),false);
 const other=run.shop.items[0];run.player={x:other.x,y:other.y};assert.equal(run.buyShop(other.id),false);
});
test('rectangle generation is repeatable; both axes only shrink for act I pawns; initial positions never check a king',()=>{
 const shapes=new Set();
 for(let seed=1;seed<=120;seed++)for(let act=1;act<=3;act++)for(let floor=1;floor<=3;floor++){
  const run=new Run(seed,act);run.floor=floor;run.setupFloor();
  for(const enemy of run.enemies){
   const preset=makeEncounter(run,enemy,run.inventory.map(p=>p.id)),bounds=preset.bounds;
   shapes.add(`${bounds.right-bounds.left+1}x${bounds.top-bounds.bottom+1}`);
   assert.deepEqual(bounds,encounterBounds(run,enemy));
   assert.deepEqual(preset,makeEncounter(run,enemy,run.inventory.map(p=>p.id)));
   if(bounds.left>0||bounds.right<7)if(bounds.bottom>1||bounds.top<8){assert.equal(act,1);assert.equal(enemy.type,'p');}
   const {pieces}=parsePosition(preset.fen);for(const square of pieces.keys())assert.ok(inside(square,bounds));
   if(enemy.wild||enemy.kingless||preset.world){assert.doesNotThrow(()=>validateWildSetup(preset.fen));continue;}
   const chess=new Chess(chessFen(preset.fen));assert.equal(chess.isCheck(),false);
   assert.equal(chess.isAttacked(chess.findPiece({type:'k',color:'b'})[0],'w'),false);
  }
 }
 assert.ok(shapes.has('8x8'));assert.ok([...shapes].some(s=>!s.startsWith('8')&&!s.endsWith('8')));
});
test('capture income excludes armor hits, enemy takes and undone moves; replacement hunters cannot be farmed',()=>{
 const moves=[{color:'w',hit:true,captured:'q'},{color:'b',captured:'q'},{color:'w',captured:'r'},{color:'w',captured:'p'}];
 assert.equal(captureMaterial(moves),6);assert.equal(encounterReward({type:'p'},1,moves),6);assert.equal(captureMaterial(moves.slice(0,2)),0);
 const run=new Run(99),hunter=run.enemies.find(e=>e.roaming);win(run,hunter);
 const replacement=run.enemies.find(e=>e.roaming&&!e.weak&&!e.wild);assert.ok(replacement);assert.equal(encounterReward(replacement,1,moves),0);
});
test('minimal non-farming route funds meaningful purchases and difficulty rises by act',()=>{
 for(let seed=1;seed<=100;seed++){
  const run=new Run(seed);win(run);win(run);win(run);run.chooseBossReward(0);
  assert.ok(run.material>=run.shop.items[1].price); // Even no captures / no ruins / no optional fights.
  assert.equal(run.shop.items.filter(i=>i.material==='ordinary'&&['n','b'].includes(i.type)).length,2);
  assert.ok(run.material<run.shop.items.reduce((n,i)=>n+i.price,0));
 }
 assert.ok(aiProfile(1).depth<aiProfile(2).depth&&aiProfile(2).depth<aiProfile(3).depth);
});
