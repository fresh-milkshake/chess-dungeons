import test from 'node:test';
import assert from 'node:assert/strict';
import {actVariants,actScene} from '../src/lab/acts/catalog.js';
import {describeCell,drawActScene} from '../src/lab/acts/draw.js';
import {vinePaths} from '../src/lab/acts/vegetation.js';
import {heatAmount} from '../src/lab/acts/heat.js';
import {dragonSprite} from '../src/lab/acts/dragon.js';
import {freezePiece,permanentlyLost,canPreviewMove,reaperMoves,previewSprite} from '../src/lab/acts/preview-rules.js';

test('dragons have only black and wild forms and appear only in the third-act visual prototype',()=>{
 assert.throws(()=>dragonSprite('w'),/только/);
 assert.match(dragonSprite('b','/'),/special\/b-dragon-v3.png$/);
 assert.match(dragonSprite('wild','/'),/wild\/dragon-v2.png$/);
 for(const theme of actVariants)for(const kind of ['map','battle']){
  const dragons=actScene(theme.id,kind).pieces.filter(p=>p.type==='dragon');
  assert.deepEqual(dragons.map(p=>p.color),theme.id==='court'?['b','wild']:[]);
  for(const p of dragons)assert.equal(previewSprite(p,'/'),dragonSprite(p.color,'/'));
 }
});

test('six act vignettes follow 1/3/1/1 slots and keep each map and battle frame coherent',()=>{
 assert.deepEqual([1,2,3,4].map(act=>actVariants.filter(v=>v.act===act).length),[1,3,1,1]);
 const seen=new Set();
 for(const theme of actVariants){assert.ok(!seen.has(theme.id));seen.add(theme.id);
  for(const kind of ['map','battle'])for(let step=0;step<5;step++){
   const s=actScene(theme.id,kind,step),key=p=>p.x+','+p.y;
   assert.deepEqual(actScene(theme.id,kind,step),s);
   const blocked=new Set([...s.walls,...s.tiles.filter(t=>t.type==='hole')].map(key));
   assert.equal(new Set(s.pieces.map(key)).size,s.pieces.length);
   for(const p of [...s.pieces,...s.tiles,...s.walls])assert.ok(p.x>=0&&p.x<s.size&&p.y>=0&&p.y<s.size);
   for(const p of s.pieces){assert.ok(!blocked.has(key(p)),`${theme.id} ${kind} ${step}: actor on blocked terrain`);if(p.type==='k'){assert.ok(!p.material);assert.ok(!p.cursed&&!p.rooted);}}
   assert.ok(s.caption.length>15);assert.ok(s.pieces.some(p=>p.color==='w'&&p.type==='k'));
  }
 }
});

test('garden holds the knight for exactly one subsequent step and then releases it',()=>{
 const enter=actScene('garden','battle',1),held=actScene('garden','battle',2),free=actScene('garden','battle',3);
 assert.deepEqual([enter.focus.x,enter.focus.y],[held.focus.x,held.focus.y]);
 assert.equal(held.focus.rooted,true);assert.equal(free.focus.rooted,false);assert.notEqual(free.focus.x,held.focus.x);
});

test('forge warns before reducing stone HP and reset restores the original shield',()=>{
 const tile=s=>s.tiles.find(t=>t.x===2&&t.y===2);
 assert.equal(tile(actScene('forge','battle',1)).phase,'warning');
 assert.equal(actScene('forge','battle',1).focus.hp,2);
 assert.equal(tile(actScene('forge','battle',2)).phase,'active');assert.equal(actScene('forge','battle',2).focus.hp,1);
 assert.equal(actScene('forge','battle',0).focus.hp,2);
});

test('fragile ice cracks under the arriving piece and stays absent after departure',()=>{
 for(const [kind,arrive,leave,x,y] of [['battle',1,2,2,2],['map',2,3,2,4]]){
  const tile=s=>s.tiles.find(t=>t.x===x&&t.y===y);
  assert.equal(tile(actScene('ice',kind,arrive)).cracked,true);
  for(let step=leave;step<5;step++)assert.equal(tile(actScene('ice',kind,step)).type,'hole');
 }
});

test('necropolis displays neutral remains without curse traps or resurrection',()=>{
 for(const kind of ['map','battle'])for(let step=0;step<5;step++){
  const scene=actScene('crypt',kind,step);assert.equal(scene.tiles.length,3);assert.ok(scene.tiles.every(t=>t.type==='remains'));assert.ok(scene.pieces.every(p=>!p.cursed));assert.match(describeCell(scene,scene.tiles[0]),/Разбитая нейтральная/);
 }
});

test('emperor palace is only a renamed placeholder with an ordinary king',()=>{
 const before=structuredClone(actVariants);
 for(let step=0;step<5;step++){const s=actScene('court','battle',step);assert.equal(s.tiles.length,0);assert.equal(s.theme.name,'Дворец императора');assert.ok(s.pieces.some(p=>p.type==='k'&&p.color==='b'&&!p.material&&p.skin==='emperor'));}
 assert.deepEqual(actVariants,before);assert.equal(actScene('court','battle',99).step,4);assert.throws(()=>actScene('missing','map'),/Неизвестный/);
});

test('garden decor covers forty percent of available tiles without covering the vines or walls',()=>{
 for(const kind of ['map','battle']){const s=actScene('garden',kind),blocked=new Set([...s.walls,...s.tiles].map(p=>p.x+','+p.y));assert.equal(s.decorations.length,Math.round((s.size*s.size-blocked.size)*.4));assert.equal(new Set(s.decorations.map(p=>p.type)).size,4);assert.ok(s.decorations.every(p=>!blocked.has(p.x+','+p.y)));}
});

test('vine geometry remains stable between frames and differs between cells',()=>{
 const a=vinePaths(11),b=vinePaths(171);assert.deepEqual(vinePaths(11),a);assert.notDeepEqual(a,b);assert.equal(a.length,4);assert.ok(a.every(p=>p.points.length===65&&p.leaves.length===8&&p.points.flat().every(n=>n>=0&&n<=1)));
});

test('heat interpolation is continuous, bounded and works in both directions',()=>{
 assert.equal(heatAmount('cool','active',0),0);assert.equal(heatAmount('cool','active',1.35),1);assert.equal(heatAmount('active','cool',1.35),0);
 const steps=Array.from({length:15},(_,i)=>heatAmount('cool','active',i*.1));assert.ok(steps.every((n,i)=>n>=0&&n<=1&&(!i||n>=steps[i-1])));assert.ok(heatAmount('active','cool',.6)>0&&heatAmount('active','cool',.6)<1);
});


test('independent ice spell removes armor without immobilizing and captured ice is permanently lost',()=>{
 for(const material of [undefined,'stone','diamond','glass','ethereal']){const original={type:'n',color:'w',hp:3,material};const iced=freezePiece(original);assert.equal(iced.hp,1);assert.equal(iced.material,undefined);assert.equal(iced.glass,false);assert.equal(canPreviewMove(iced),true);assert.equal(iced.frozenTurns,0);assert.equal(permanentlyLost(iced,true),true);assert.equal(permanentlyLost(iced,false),false);assert.ok(!original.iced);}
 const floor=actScene('ice','battle',1),spell=actScene('ice','battle',2),lost=actScene('ice','battle',4);
 assert.equal(floor.focus.material,'diamond');assert.equal(floor.focus.hp,3);assert.ok(!floor.focus.iced);assert.equal(spell.focus.iced,true);assert.notDeepEqual([floor.focus.x,floor.focus.y],[spell.focus.x,spell.focus.y]);assert.equal(lost.lost.length,1);assert.equal(lost.lost[0].permanentLoss,true);assert.ok(!lost.pieces.some(p=>p.type==='n'&&p.color==='w'));
});

test('reapers stop after two diagonal squares and obey both friendly and enemy blockers',()=>{
 const p={x:3,y:3,type:'reaper',color:'w'},friends={x:4,y:4,color:'w'},enemy={x:2,y:2,color:'b'};const moves=reaperMoves(p,[p,friends,enemy],8);assert.ok(moves.every(m=>Math.abs(m.x-3)===Math.abs(m.y-3)&&Math.abs(m.x-3)<=2));assert.ok(!moves.some(m=>m.x===4&&m.y===4||m.x===5&&m.y===5||m.x===1&&m.y===1));assert.ok(moves.some(m=>m.x===2&&m.y===2&&m.capture));
 const scene=actScene('crypt','battle');assert.equal(scene.focus.type,'reaper');assert.ok(scene.pieces.some(p=>p.color==='b'&&p.type==='reaper'));assert.match(previewSprite(scene.focus,'/'),/w-reaper-v2.png/);
});

test('holes are cleared in terrain before any figure sprite is drawn, including on broken ice',()=>{
 for(const [id,step] of [['ruins',2],['ice',3]]){
  const calls=[],gradient={addColorStop(){}};const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:(...args)=>calls.push({key,args}),set:()=>true});
  const image={complete:true,naturalWidth:300},images={get:()=>image};drawActScene(ctx,actScene(id,'battle',step),images,0,{progress:.5});
  const firstSprite=calls.findIndex(c=>c.key==='drawImage');assert.ok(firstSprite>0);assert.ok(calls.slice(0,firstSprite).filter(c=>c.key==='clearRect').length>1);assert.ok(!calls.slice(firstSprite).some(c=>c.key==='clearRect'));
 }
});
