import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {Run} from '../src/dungeon/run.js';
import {artifactPlan} from '../src/artifacts/acquisition.js';
import {artifacts} from '../src/artifacts/catalog.js';
import {artifactEffect} from '../src/artifacts/effects.js';
import {WildRules,wildFen,wildLegal,kingThreatened} from '../src/battle/wild-rules.js';
import {Battle} from '../src/battle/game.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {automaticDeployment,deploymentPreset} from '../src/dungeon/deployment.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {makeShop,bossOptions,shopMap} from '../src/dungeon/balance.js';
import {campaignBattle} from '../src/dungeon/battle-link.js';
import {saveRun,loadRun} from '../src/dungeon/storage.js';
import {configureBattleRelics} from '../src/debug/battle-relics.js';
import {rerollShop} from '../src/artifacts/rerolls.js';
import {deploymentLimit} from '../src/artifacts/mechanics.js';
const bounds={left:0,right:7,bottom:1,top:8},piece=(type,color='w',hp=1)=>({type,color,hp,damage:1,glass:false});
let native;
before(async()=>{const filename=resolve('public/engine/dungeons.js'),commonjs={exports:{}};new Function('module','exports','require','__filename','__dirname',await readFile(filename,'utf8'))(commonjs,commonjs.exports,createRequire(import.meta.url),filename,dirname(filename));const module=await commonjs.exports({wasmBinary:await readFile('public/engine/dungeons.wasm'),print(){},printErr(){}});module.ccall('dungeon_init','number',[],[]);native=command=>{const r=JSON.parse(module.ccall('dungeon_command','string',['string'],[command]));if(r.error)throw Error(r.error);return r;};});
const engine=()=>new WildRules(native);
const start=async(board,mode='mixed',extras={})=>{const b=new Battle(engine());await b.start({id:'artifact-test',fen:wildFen(board,bounds,'w',mode),artifacts:artifacts.filter(a=>a.id!=='coldfire').map(a=>a.id),...extras});return b;};
const ability=(b,id,target,sourceId)=>b.move('artifact '+JSON.stringify({id,target,sourceId,ethereal:[...b.ethereal]}));

test('artifact plan has at least one early relic, unique fixed content and exactly 3 shop offers',()=>{
 let second=0,third=0;for(let seed=1;seed<=1000;seed++){
  const p=artifactPlan(seed);assert.ok(p.sites[0].present);assert.deepEqual(p,artifactPlan(seed));second+=p.sites[1].present;third+=p.sites[2].present;
  const ids=[...p.sites.filter(s=>s.present).map(s=>s.artifactId),...p.shops.flatMap(s=>s.artifacts)];assert.equal(new Set(ids).size,ids.length);assert.ok(p.sites.every(s=>s.floor>=1&&s.floor<=(s.act===4?1:3)));assert.ok(p.shops.every(s=>s.artifacts.length===3));
 }assert.ok(second>600&&second<700);assert.ok(third>750&&third<850);
});

test('all relic PNG sprites have real alpha and increasing act prices',async()=>{
 assert.equal(artifacts.length,21);for(const a of artifacts){const png=await readFile('public/artifacts/'+a.id+'.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok([4,6].includes(png[25]));assert.ok(a.price[0]>=30);assert.ok(a.price[1]>a.price[0]);}
});

test('banner and mirror have finite free-cell placements, cropped edges, and no recursive copies',()=>{
 const board=new Map([['d2',piece('k')],['c3',piece('n')],['g8',piece('k','b')]]);
 const first=artifactEffect(board,bounds,'banner',[]);assert.deepEqual(first.spawned,['d3','e3']);assert.equal(board.size,3);
 const second=artifactEffect(first.board,bounds,'mirror',first.ethereal);assert.deepEqual(second.spawned,['d4','e4']);assert.equal(second.ethereal.length,4);
 assert.throws(()=>artifactEffect(board,bounds,'mirror',[]),/Нет свободных/);
 assert.throws(()=>artifactEffect(board,bounds,'seal',[],'d2'),/кроме короля/);
 const cropped={left:2,right:5,bottom:2,top:7};assert.throws(()=>artifactEffect(new Map([['c6',piece('k')]]),cropped,'banner',[]),/Нет свободных/); // last rank cannot hold a new pawn
});

test('summon spends the white turn, replies and complete undo restore board and ethereal set',async()=>{
 const b=await start(new Map([['d1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['g7',piece('p','b')]]));const original=b.state.fen;
 await ability(b,'banner');assert.equal(parsePosition(b.state.fen).turn,'b');assert.equal(b.ethereal.size,3);b.artifactRuntime.used.banner=1;
 await b.move(b.state.legal[0]);await b.undoTurn();assert.equal(b.state.fen,original);assert.equal(b.ethereal.size,0);assert.equal(b.artifactRuntime.used.banner,1);
});

test('ability replay preserves positions, spent charges and undo across reload',async()=>{
 const b=await start(new Map([['d1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['g7',piece('p','b')]]));
 await ability(b,'banner');await b.move(b.state.legal[0]);await ability(b,'mirror');b.artifactRuntime.used={banner:1,mirror:1,hourglass:2,seal:0};const saved=b.snapshot(),fen=b.state.fen;
 const copy=new Battle(engine());await copy.restore(saved,b.preset);assert.equal(copy.state.fen,fen);assert.deepEqual([...copy.ethereal],[...b.ethereal]);assert.deepEqual(copy.artifactRuntime.used,b.artifactRuntime.used);
 await copy.undoTurn();assert.equal(copy.artifactRuntime.used.mirror,1);assert.equal(copy.ethereal.size,3);
});

test('a blocked or check-ignoring summon is rejected without changing the position',async()=>{
 const b=await start(new Map([['d1',piece('k')],['d8',piece('r','b')],['h8',piece('k','b')],['d2',piece('n')]]));
 // Remove the shield and check the king: mirror cannot fix the file.
 await b.engine.request('load '+wildFen(new Map([['d1',piece('k')],['d8',piece('r','b')],['h8',piece('k','b')],['a2',piece('p')]]),bounds));
 await assert.rejects(b.engine.request('artifact '+JSON.stringify({id:'mirror',ethereal:['a2']})),/шах/);
});

test('truce suppresses wild attacks on white and breaks only for the actual attacked beast; undo restores it',async()=>{
 const board=new Map([['h1',piece('k')],['h8',piece('k','b')],['a1',piece('r')],['a4',{...piece('r','wild',2),wildId:'guardian-a',neutral:true}],['f4',{...piece('n','wild',2),wildId:'guardian-b',neutral:true}]]);
 const b=await start(board);assert.ok(!wildLegal(parsePosition(b.state.fen).pieces,bounds,'wild').includes('a4a1'));
 await b.move('a1a4');const p=parsePosition(b.state.fen).pieces;assert.equal(p.get('a4').neutral,false);assert.equal(p.get('f4').neutral,true);assert.equal(p.get('a4').aggro,'w');await b.undoTurn();assert.equal(parsePosition(b.state.fen).pieces.get('a4').neutral,true);
});

test('royal-less victory waits for all guards, supports legal black searches and skips immobile armies',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a1',piece('r')],['a6',piece('n','b')],['b8',piece('n','b')]]),'clear');assert.equal(b.result,null);
 await b.move('a1a6');assert.equal(b.result,null);const reply=await b.engine.request('search 3 80');assert.ok(b.state.legal.includes(reply.bestmove));assert.equal(reply.searchBackend,'variant');await b.move(reply.bestmove);
 const e=engine();const f=wildFen(new Map([['h1',piece('k')],['a1',piece('r')],['a2',piece('p','b')]]),bounds,'b','clear');const s=await e.request('load '+f);assert.deepEqual(s.legal,['0000']);assert.equal((await e.request('move 0000')).fen.split(' ')[1],'w');
 const won=await e.request('load '+wildFen(new Map([['h1',piece('k')]]),bounds,'w','clear'));assert.equal(won.gameResult.result,'win');
});

test('oracle uses native maximum search for white in royal battles and returns a mate',async()=>{
 const b=await start(new Map([['f6',piece('k')],['g6',piece('q')],['h8',piece('k','b')]]));const reply=await b.engine.request('search 30 5000');assert.ok(b.state.legal.includes(reply.bestmove));await b.move(reply.bestmove);assert.equal(b.result.result,'win');
});

test('field reliquaries and ordinary kingless encounters load and deploy legally across acts',()=>{
 let pairs=0;for(let seed=1;seed<=80;seed++)for(const act of [1,2,3]){
  const r=new Run(seed,act);const site=r.artifactPlan.sites[act-1];r.floor=site.floor;r.setupFloor();const guard=r.enemies.find(e=>e.reliquary);
  if(site.present){assert.ok(guard);const preset=deploymentPreset(r,guard,automaticDeployment(r,guard));const parsed=parsePosition(preset.fen);assert.ok(![...parsed.pieces.values()].some(p=>p.color==='b'&&p.type==='k'));assert.equal(preset.objective,'clear');assert.equal(kingThreatened(parsed.pieces,parsed.bounds,'w'),false);if(guard.wildGuardIds){pairs++;assert.equal(preset.wildIds.length,2);assert.ok(r.enemies.filter(e=>e.wild).length<=2);}}
  else assert.equal(guard,undefined);
 }assert.ok(pairs>10);
});

test('shop purchases charge once and fourth facet adds genuinely distinct valid reward choices',()=>{
 const r=new Run(14);r.stage='shop';r.shop=makeShop(r);r.map=shopMap();assert.equal(r.shop.items.length,11);assert.equal(new Set(r.shop.items.map(p=>p.x+','+p.y)).size,11);
 const offer=r.shop.items.find(p=>p.kind==='artifact');r.player={x:offer.x,y:offer.y};r.material=offer.price;assert.equal(r.buyShop(offer.id),true);assert.equal(r.material,0);assert.ok(r.artifacts.includes(offer.artifactId));assert.equal(r.buyShop(offer.id),false);
 r.artifacts=['facet'];for(const act of [1,2,3]){r.act=act;const o=bossOptions(r);assert.equal(o.length,4);assert.equal(new Set(o.map(p=>p.type+p.material)).size,4);const loot=r.rewardOptions({});assert.equal(loot.length,4);assert.notEqual(loot[0].type+loot[0].material,loot[3].type+loot[3].material);assert.ok(['piece','power','material','scout','exit','recharge'].includes(loot[3].kind));}
});

test('seal use survives settlement and its ethereal source is consumed permanently',async()=>{
 const r=new Run(8);r.artifacts=['seal'];r.inventory.push({id:'glass-source',type:'p',material:'glass'});const enemy=r.enemies.find(e=>e.guard);r.openEncounter(enemy);r.beginBattle(['glass-source']);
 r.active.preset.fen=wildFen(new Map([['h1',piece('k')],['b2',{...piece('p'),glass:true}],['a8',piece('k','b')],['b8',piece('r','b')]]),bounds);r.active.preset.identities={h1:'king',b2:'glass-source'};
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};saveRun(r,storage);const c=campaignBattle('?run='+r.id,storage),b=new Battle(engine());await b.start(c.preset);await ability(b,'seal','b2','glass-source');b.artifactRuntime.used.seal=1;await b.move('b8b2');assert.ok(!parsePosition(b.state.fen).pieces.has('b2')||parsePosition(b.state.fen).pieces.get('b2').color==='b');c.save(b);assert.equal(loadRun(storage).artifactFloor.sealUsed,true);
 b.resigned=true;c.finish(b);assert.ok(!loadRun(storage).inventory.some(p=>p.id==='glass-source'));
});

test('friendly invaders do not block a clear victory, but assigned relic guardians still must be defeated',async()=>{
 const e=engine(),board=new Map([['h1',piece('k')],['a6',{...piece('n','wild',2),wildId:'guard',neutral:true}]]);
 let s=await e.request('load '+wildFen(board,bounds,'w','clear'));assert.equal(s.gameResult.result,'win');
 s=await e.request('load '+wildFen(board,bounds,'w','clear')+';required=guard');assert.equal(s.gameResult,null);assert.ok(s.fen.includes('required=guard'));
});

test('reliquary grants exactly its predrawn artifact once, with capture income but no victory bonus',()=>{
 const r=new Run(111),site=r.artifactPlan.sites[0];r.floor=site.floor;r.setupFloor();const enemy=r.enemies.find(e=>e.reliquary);r.openEncounter(enemy);r.beginBattle(['queen','knight']);r.finishBattle('win',new Set(['king','queen','knight']),[{color:'w',captured:'n',hit:false}]);
 assert.deepEqual(r.artifacts,[site.artifactId]);assert.equal(r.material,1);assert.ok(!r.enemies.some(e=>e.id===enemy.id));assert.throws(()=>r.finishBattle('win',new Set()),/уже завершён/);assert.deepEqual(Run.restore(r.snapshot()).artifacts,r.artifacts);
});

test('debug relic grants preserve a native position, safely enable summons, and allow removal without charging',async()=>{
 const b=new Battle(engine());await b.start({id:'debug-relic-native',fen:'7k/2p5/8/8/8/8/8/R2K4 w - - 0 1 @hunt=0'});
 await b.move('a1a2');await b.move('h8g8');const board=parsePosition(b.state.fen).pieces;
 await configureBattleRelics(b,['mirage']);assert.equal(b.history.length,2);assert.deepEqual(b.artifactRuntime.owned,['mirage']);
 await configureBattleRelics(b,['mirage','banner']);assert.equal(b.history.length,0);assert.ok(b.state.wildMode);assert.deepEqual(parsePosition(b.state.fen).pieces,board);
 await ability(b,'banner');assert.equal(b.ethereal.size,3);
 await configureBattleRelics(b,[]);assert.deepEqual(b.artifactRuntime.owned,[]);assert.equal(b.ethereal.size,3);
});

test('debug relic ownership persists to the campaign save and next encounters',async()=>{
 const r=new Run(33),enemy=r.enemies.find(e=>e.guard);r.openEncounter(enemy);r.beginBattle(['queen','knight']);
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};saveRun(r,storage);
 const c=campaignBattle('?run='+r.id,storage),b=new Battle(engine());await b.start(c.preset);
 await configureBattleRelics(b,['mirage','hourglass'],c);c.save(b);assert.deepEqual(loadRun(storage).artifacts,['mirage','hourglass']);
 const replay=loadRun(storage);replay.prepareAgain();assert.deepEqual(replay.artifacts,['mirage','hourglass']);
 await configureBattleRelics(b,[],c);c.save(b);assert.deepEqual(loadRun(storage).artifacts,[]);
});


test('targeted frost strips diamond armor, preserves the role, is one-hit fragile and survives replay',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['a4',piece('q','b',3)]]));
 await ability(b,'frost','a4');let p=parsePosition(b.state.fen).pieces.get('a4');assert.equal(p.hp,1);assert.equal(p.iced,true);assert.equal(p.type,'q');assert.equal(p.glass,true);
 await b.move('h8g8');await b.move('a1a4');assert.equal(b.moves.at(-1).hit,false);assert.equal(parsePosition(b.state.fen).pieces.get('a4').color,'w');
 const copy=new Battle(engine());await copy.restore(b.snapshot(),b.preset);assert.equal(copy.state.fen,b.state.fen);await copy.undoTurn();assert.equal(parsePosition(copy.state.fen).pieces.get('a4').iced,true);
});
test('curse removes captures and attack zones while allowing escape, including wild and en passant',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['a4',piece('r','b')]]));
 await ability(b,'hex','a4');assert.ok(!b.state.legal.includes('a4a1'));assert.ok(b.state.legal.includes('a4b4'));assert.equal(parsePosition(b.state.fen).pieces.get('a4').cursed,true);
 assert.equal(kingThreatened(parsePosition(b.state.fen).pieces,bounds,'w'),false);
 const wild=new Map([['h1',piece('k')],['h8',piece('k','b')],['a1',piece('r')],['a4',{...piece('r','wild',2),wildId:'cursed',cursed:true}]]);
 assert.ok(!wildLegal(wild,bounds,'wild').includes('a4a1'));assert.ok(wildLegal(wild,bounds,'wild').includes('a4b4'));
 const pawn=new Map([['h1',piece('k')],['h8',piece('k','b')],['e5',{...piece('p'),cursed:true}],['d5',piece('p','b')]]);assert.ok(!wildLegal(pawn,bounds,'w','d6').includes('e5d6'));
});
test('briar targets only empty ordinary cells and holds either team for one own turn',async()=>{
 const board=new Map([['h1',piece('k')],['d1',piece('q')],['h8',piece('k','b')]]);
 assert.throws(()=>artifactEffect(board,bounds,'briar',[],'d1'),/пустую/);assert.throws(()=>artifactEffect(board,bounds,'frost',[],'h1'),/кроме короля/);
 const b=await start(board);await ability(b,'briar','d2');assert.equal(parsePosition(b.state.fen).pieces.world.tiles.d2,'vine');await b.move('h8g8');await b.move('d1d2');assert.equal(parsePosition(b.state.fen).pieces.get('d2').rooted,1);await b.move('g8h8');assert.ok(!b.state.legal.some(m=>m.startsWith('d2')));await b.move('h1g1');assert.equal(parsePosition(b.state.fen).pieces.get('d2').rooted??0,0);
});
test('floor, act and battle artifacts keep separate budgets across the next fight',async()=>{
 const r=new Run(8);r.artifacts=['frost','briar','hex'];const e=r.enemies.find(e=>e.special);r.openEncounter(e);r.beginBattle(['queen']);
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};saveRun(r,storage);const c=campaignBattle('?run='+r.id,storage),b=new Battle(engine());await b.start(c.preset);b.artifactRuntime.used={frost:1,briar:1,hex:1};c.save(b);
 const restored=loadRun(storage);assert.deepEqual(restored.artifactFloor.used,{frost:1});assert.deepEqual(restored.artifactAct.used,{hex:1});restored.finishBattle('draw',new Set(['king','queen']),[]);const next=makeEncounter(restored,restored.enemies.find(e=>e.guard),[]);assert.deepEqual(next.floorUses,{frost:1});assert.deepEqual(next.actUses,{hex:1});restored.setupFloor();assert.equal(restored.artifactFloor.used,undefined);assert.equal(restored.artifactAct.used.hex,1);
});
test('a destroyed frozen permanent ally is lost, surviving allies recover their original material',()=>{
 for(const survived of [false,true]){const r=new Run(8);r.inventory.push({id:'stone-source',type:'r',material:'stone'});const e=r.enemies.find(e=>e.special);r.openEncounter(e);r.beginBattle(['stone-source']);r.finishBattle('draw',new Set(survived?['king','stone-source']:['king']),[{artifact:'frost',uci:'artifact '+JSON.stringify({id:'frost',sourceId:'stone-source'})}]);assert.equal(r.inventory.some(p=>p.id==='stone-source'),survived);if(survived)assert.equal(r.inventory.find(p=>p.id==='stone-source').material,'stone');}
});

test('merchant rerolls cost 8/14/22, preserve sold slots, exclude stones and stop after three',()=>{
 const r=new Run(891);r.artifacts=['merchant-die'];r.stage='shop';r.shop=makeShop(r);r.material=100;
 r.shop.items[0].sold=true;const sold={...r.shop.items[0]},original=r.shop.items.filter(i=>!i.sold).map(i=>i.id);
 for(const remaining of [92,78,56]){assert.equal(rerollShop(r),true);assert.equal(r.material,remaining);assert.deepEqual(r.shop.items[0],sold);assert.ok(r.shop.items.every(i=>i.material!=='stone'));const ids=r.shop.items.filter(i=>i.kind==='artifact').map(i=>i.artifactId);assert.equal(new Set(ids).size,ids.length);}
 assert.equal(rerollShop(r),false);assert.equal(r.material,56);assert.ok(r.shop.items.some(i=>!i.sold&&!original.includes(i.id)));
 const poor=new Run(8);poor.artifacts=['merchant-die'];poor.stage='shop';poor.shop=makeShop(poor);const before=poor.snapshot();assert.equal(rerollShop(poor),false);assert.deepEqual(poor.shop,before.shop);assert.equal(poor.material,0);
});

test('boss die replaces all choices, preserves facet count and cannot grant a stone queen',()=>{
 for(let act=1;act<=4;act++){
  const r=new Run(80,act);r.artifacts=['boss-die','facet'];const before=bossOptions(r).map(p=>p.type+p.material);r.artifactFloor.used={'boss-die':1};const after=bossOptions(r);
  assert.equal(after.length,4);assert.equal(new Set(after.map(p=>p.type+p.material)).size,4);assert.equal(after.filter(p=>p.material==='stone').length,1);assert.ok(after.slice(1).some(p=>!before.includes(p.type+p.material)));assert.ok(!after.some(p=>p.type==='q'&&p.material==='stone'));
 }
});

test('phalanx permits nineteen in both manual and automatic deployment',()=>{
 const r=new Run(891);r.inventory.push(...Array.from({length:21},(_,i)=>({id:'pawn-'+i,type:'p',material:'ordinary'})));const enemy=r.enemies.find(e=>e.special);
 assert.equal(deploymentLimit(r),16);r.artifacts=['ranks'];assert.equal(deploymentLimit(r),19);const positions=automaticDeployment(r,enemy);assert.equal(Object.keys(positions).length,19);assert.equal(deploymentPreset(r,enemy,positions).deployed.length,19);
 r.artifacts=[];assert.throws(()=>deploymentPreset(r,enemy,positions),/16/);
});

test('coldfire selects a stable nonking ally, strips armor, doubles damage and replays identically',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a1',piece('r','w',3)],['h8',piece('k','b')],['b8',piece('r','b')]]),'mixed',{artifacts:['coldfire'],identities:{h1:'king',a1:'cold-source'}});
 const p=parsePosition(b.state.fen).pieces;assert.equal(p.get('a1').iced,true);assert.equal(p.get('a1').hp,1);assert.equal(p.get('a1').damage,2);assert.equal(p.get('h1').iced,undefined);assert.equal(b.artifactRuntime.frozenId,'cold-source');
 const copy=new Battle(engine());await copy.restore(b.snapshot(),b.preset);assert.equal(copy.state.fen,b.state.fen);
});

test('mass curse affects all factions and kings, expires once per side and retains permanent curses',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['a8',{...piece('r','b'),cursed:true}],['d4',{...piece('n','wild',2),wildId:'curse-test'}]]));
 await ability(b,'silence');let ps=parsePosition(b.state.fen).pieces;assert.ok([...ps.values()].every(p=>p.cursed));assert.equal(ps.get('a1').curseTurns,1);assert.equal(ps.get('h8').curseTurns,1);
 await b.move('h8g8');ps=parsePosition(b.state.fen).pieces;assert.equal(!!ps.get('g8').cursed,false);assert.equal(ps.get('a8').cursed,true);assert.ok(!b.state.legal.some(m=>['h1','a1','a8','g8'].includes(m.slice(-2))));
 await b.move(b.state.legal[0]);await b.move('h1g1');ps=parsePosition(b.state.fen).pieces;assert.equal(!!ps.get('g1').cursed,false);assert.equal(!!ps.get('a1').cursed,false);assert.equal(ps.get('a8').cursed,true);
});

test('free mass curse keeps the player turn and terrain clock, blocks every faction for its next move and replays',async()=>{
 const board=new Map([['h1',piece('k')],['a1',piece('r')],['h8',piece('k','b')],['a8',{...piece('r','b'),cursed:true}],['d4',{...piece('n','wild',2),wildId:'silence-free'}]]);
 board.world={biome:'forge',round:1,tiles:{e5:'heat'}};
 const b=await start(board);await b.move('artifact '+JSON.stringify({id:'silence',spendsTurn:false}));let ps=parsePosition(b.state.fen).pieces;
 assert.equal(parsePosition(b.state.fen).turn,'w');assert.equal(ps.world.round,1);assert.ok([...ps.values()].every(p=>p.cursed&&p.curseTurns===1));assert.ok(!b.state.legal.includes('a1a8'));assert.equal(b.artifactRuntime.used.silence,1);
 const copy=new Battle(engine());await copy.restore(b.snapshot(),b.preset);assert.equal(copy.state.fen,b.state.fen);
 await b.move('h1g1');ps=parsePosition(b.state.fen).pieces;assert.equal(!!ps.get('g1').cursed,false);assert.equal(ps.get('h8').cursed,true);assert.ok(!b.state.legal.includes('a8a1'));
 await b.move('h8g8');ps=parsePosition(b.state.fen).pieces;assert.equal(!!ps.get('g8').cursed,false);assert.equal(ps.get('a8').cursed,true);assert.equal(ps.get('d4').cursed,true);
 await b.move(b.state.legal[0]);ps=parsePosition(b.state.fen).pieces;assert.ok([...ps.values()].filter(p=>p.color==='wild').every(p=>!p.cursed));
});

test('glass ward saves one lethal hit, stays spent after undo/reload and resets next floor',async()=>{
 const board=new Map([['h1',piece('k')],['a1',{...piece('r'),glass:true}],['h8',piece('k','b')],['a8',piece('r','b')]]);
 const b=await start(board,'mixed',{artifacts:['glassward']});await b.move('h1g1');await b.move('a8a1');assert.equal(b.moves.at(-1).hit,true);assert.equal(parsePosition(b.state.fen).pieces.get('a1').color,'w');assert.equal(b.artifactRuntime.used.glassward,1);
 await b.undoTurn();const copy=new Battle(engine());await copy.restore(b.snapshot(),b.preset);assert.equal(parsePosition(copy.state.fen).pieces.relics.glassAvailable,0);await copy.move('h1g1');await copy.move('a8a1');assert.equal(parsePosition(copy.state.fen).pieces.get('a1').color,'b');
 const spent=await start(board,'mixed',{artifacts:['glassward'],floorUses:{glassward:1}});assert.equal(parsePosition(spent.state.fen).pieces.relics.glassAvailable,0);
});

test('two dragons are deterministic, hostile enhanced wild units and avoid holes and royal checks',async()=>{
 const board=new Map([['h1',piece('k')],['a1',piece('r')],['h8',piece('k','b')]]);board.world={biome:'ruins',tiles:{d4:'hole'},round:0};
 const first=artifactEffect(board,bounds,'dragonhorn',[],undefined,97),second=artifactEffect(board,bounds,'dragonhorn',[],undefined,97);assert.deepEqual(first.spawned,second.spawned);assert.equal(first.spawned.length,2);
 for(const s of first.spawned){const p=first.board.get(s);assert.equal(p.type,'d');assert.equal(p.color,'wild');assert.equal(p.hp,2);assert.equal(p.damage,2);assert.equal(p.neutral,false);assert.notEqual(s,'d4');}assert.equal(kingThreatened(first.board,bounds,'w'),false);assert.equal(kingThreatened(first.board,bounds,'b'),false);
 const b=await start(board,'mixed',{artifacts:['dragonhorn']});await ability(b,'dragonhorn');assert.equal(b.state.wildPieces.length,2);await b.move(b.state.legal[0]);await b.move(b.state.legal[0]);await assert.rejects(ability(b,'dragonhorn'),/использован/);
});

test('ethereal transformations consume a surviving permanent source and run charges cross floors',()=>{
 for(const id of ['seal','lastcrown']){const r=new Run(7);r.artifacts=[id];const e=r.enemies.find(e=>e.special);r.openEncounter(e);r.beginBattle(['queen']);r.finishBattle('draw',new Set(['king','queen']),[{artifact:id,uci:'artifact '+JSON.stringify({id,sourceId:'queen'})}],null,{owned:[id],toggles:{},used:{[id]:1}});assert.ok(!r.inventory.some(p=>p.id==='queen'));if(id==='lastcrown'){r.setupFloor();const next=makeEncounter(r,r.enemies.find(e=>e.guard),[]);assert.equal(next.runUses.lastcrown,1);}}
});

test('last crown creates a one-hit enhanced ether queen, refuses kings and spends its run charge',async()=>{
 const b=await start(new Map([['h1',piece('k')],['b2',piece('n','w',2)],['h8',piece('k','b')]]),'mixed',{artifacts:['lastcrown'],identities:{b2:'source'}});
 await assert.rejects(ability(b,'lastcrown','h1','king'),/кроме короля/);assert.equal(b.artifactRuntime.used.lastcrown,undefined);
 await ability(b,'lastcrown','b2','source');const p=parsePosition(b.state.fen).pieces.get('b2');assert.equal(p.type,'q');assert.equal(p.hp,1);assert.equal(p.damage,2);assert.ok(b.ethereal.has('b2'));assert.equal(b.artifactRuntime.used.lastcrown,1);
});

test('debug refills replay between abilities without giving a normal charge refund',async()=>{
 const b=await start(new Map([['h1',piece('k')],['a2',piece('p')],['h8',piece('k','b')],['a8',piece('r','b')],['c8',piece('b','b')]]));
 await ability(b,'hex','a8');await b.move('h8g8');await assert.rejects(ability(b,'hex','c8'),/использован/);
 await b.resetArtifactCharges();await ability(b,'hex','c8');const copy=new Battle(engine());await copy.restore(b.snapshot(),b.preset);
 assert.equal(copy.state.fen,b.state.fen);assert.equal(copy.artifactRuntime.used.hex,1);assert.equal(copy.moves.filter(m=>m.uci==='charge-reset').length,1);
 await copy.undoTurn();assert.equal(copy.artifactRuntime.used.hex,1);
});
