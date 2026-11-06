import {moveParts} from '../src/battle/coordinates.js';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { scenarios, parsePosition } from '../src/lab/scenarios.js';
import {placement,inside} from '../src/battle/geometry.js';

let command;
before(async () => {
  const filename = resolve('public/engine/dungeons.js');
  const source = await readFile(filename, 'utf8');
  const commonjs = { exports: {} };
  new Function('module', 'exports', 'require', '__filename', '__dirname', source)(commonjs, commonjs.exports, createRequire(import.meta.url), filename, dirname(filename));
  const engine = await commonjs.exports({ wasmBinary: await readFile('public/engine/dungeons.wasm'), print() {}, printErr: (text) => { if (!text.includes('NNUE')) console.error(text); } });
  engine.ccall('dungeon_init', 'number', [], []);
  command = (value) => JSON.parse(engine.ccall('dungeon_command', 'string', ['string'], [value]));
});

test('native strength API applies Elo and clears it for unrestricted search', () => {
  assert.equal(command('strength 1200').strengthElo,1200);
  assert.equal(command('strength 9000').strengthElo,2850);
  assert.equal(command('strength 0').strengthElo,0);
});

test('ordinary chess retains its legal tree and exact make/unmake state', () => {
  const initial = command('load rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(initial.legal.length, 20);
  assert.equal(command('perft 3').nodes, 8902);
  assert.equal(command('state').key, initial.key);
  assert.equal(command('state').fen, initial.fen);
});

test('stone survives one attack without relocation; second attack captures; undo restores HP', () => {
  const initial = command(`load ${scenarios[0].fen}`);
  const hit = command('move a1a4');
  const { pieces, turn } = parsePosition(hit.fen);
  assert.equal(hit.hit, true);
  assert.equal(turn, 'b');
  assert.equal(pieces.get('a1').type, 'r');
  assert.equal(pieces.get('a4').color, 'b');
  assert.equal(pieces.get('a4').hp, 1);
  command('move g8g7');
  const kill = command('move a1a4');
  assert.equal(kill.hit, false);
  assert.equal(parsePosition(kill.fen).pieces.has('a1'), false);
  assert.equal(parsePosition(kill.fen).pieces.get('a4').color, 'w');
  command('undo'); command('undo'); command('undo');
  assert.equal(command('state').fen, initial.fen);
  assert.equal(command('state').key, initial.key);
});

test('empowered knight kills stone immediately and carries its damage to the new square', () => {
  command(`load ${scenarios[0].fen}`);
  const result = command('move c3a4');
  const { pieces } = parsePosition(result.fen);
  assert.equal(result.hit, false);
  assert.equal(pieces.get('a4').color, 'w');
  assert.equal(pieces.get('a4').damage, 2);
  assert.equal(pieces.has('c3'), false);
});

test('diamond loses two HP to an empowered hit while both pieces stay in place', () => {
  const initial = command(`load ${scenarios[1].fen}`);
  const result = command('move f4d5');
  const { pieces } = parsePosition(result.fen);
  assert.equal(result.hit, true);
  assert.equal(pieces.get('d5').hp, 1);
  assert.equal(pieces.get('f4').damage, 2);
  command('undo');
  assert.equal(command('state').fen, initial.fen);
});

test('pinned rook may hit without uncovering its king, but may not relocate', () => {
  const armored = command(`load ${scenarios[2].fen}`);
  assert.ok(armored.legal.includes('e2a2'));
  const ordinary = command(`load ${scenarios[2].fen.replace('a2=2/1/0', 'a2=1/1/0')}`);
  assert.equal(ordinary.legal.includes('e2a2'), false);
});

test('a nonlethal hit cannot evade check by pretending the checker disappears', () => {
  const checked = command('load 6k1/8/8/8/8/8/4r3/4K3 w - - 0 1 @e2=2/1/0');
  assert.equal(checked.check, true);
  assert.equal(checked.legal.includes('e1e2'), false);
});

test('castling carries rook attributes and undo restores both participants', () => {
  const initial = command('load 4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1 @h1=2/2/0');
  const result = command('move e1g1');
  const { pieces } = parsePosition(result.fen);
  assert.equal(pieces.get('g1').type, 'k');
  assert.equal(pieces.get('g1').hp, 1);
  assert.equal(pieces.get('f1').hp, 2);
  assert.equal(pieces.get('f1').damage, 2);
  command('undo');
  assert.equal(command('state').fen, initial.fen);
  assert.equal(command('state').key, initial.key);
});

test('en passant respects protected target HP and empowered capture', () => {
  const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1 @d5=2/1/0';
  const initial = command(`load ${fen}`);
  const hit = command('move e5d6');
  const afterHit = parsePosition(hit.fen).pieces;
  assert.equal(hit.hit, true);
  assert.equal(afterHit.get('d5').hp, 1);
  assert.ok(afterHit.has('e5'));
  assert.equal(afterHit.has('d6'), false);
  command('undo');
  assert.equal(command('state').fen, initial.fen);
  command(`load ${fen};e5=1/2/0`);
  const kill = command('move e5d6');
  const afterKill = parsePosition(kill.fen).pieces;
  assert.equal(kill.hit, false);
  assert.equal(afterKill.has('d5'), false);
  assert.equal(afterKill.get('d6').damage, 2);
});

test('HP, power and player glass policy are part of the position identity', () => {
  const ordinary = command('load 6k1/8/8/8/r7/2N5/8/R5K1 w - - 0 1 @hunt=1');
  const stone = command(`load ${scenarios[0].fen}`);
  const boss = command(`load ${scenarios[0].fen.replace('hunt=1', 'hunt=0')}`);
  assert.notEqual(ordinary.key, stone.key);
  assert.notEqual(stone.key, boss.key);
});

test('armored perft preserves attributes through every explored continuation', () => {
  for (const scenario of scenarios) {
    const initial = command(`load ${scenario.fen}`);
    assert.ok(command('perft 3').nodes > 0);
    assert.equal(command('state').fen, initial.fen);
    assert.equal(command('state').key, initial.key);
  }
});

test('Fairy-Stockfish search returns legal moves and leaves the root position intact', () => {
  for (const scenario of scenarios) {
    const initial = command(`load ${scenario.fen}`);
    const result = command('search 4 1000');
    assert.ok(initial.legal.includes(result.bestmove), `${scenario.id}: ${result.bestmove}`);
    assert.ok(result.nodes > 0);
    assert.equal(result.fen, initial.fen);
    assert.equal(result.key, initial.key);
    assert.ok(!command(`move ${result.bestmove}`).error);
  }
});

test('search prefers an empowered lethal capture of a protected queen', () => {
  command('load 6k1/8/8/8/q7/2N5/8/R5K1 w - - 0 1 @hunt=1;a4=2/1/0;c3=1/2/0');
  assert.equal(command('search 5 1500').bestmove, 'c3a4');
});

test('search finds mate in one with an armored defender on the board', () => {
  command('load 6rk/8/5KQ1/8/8/8/8/8 w - - 0 1 @hunt=1;g8=2/1/0');
  const result = command('search 4 1000');
  const mate = command(`move ${result.bestmove}`);
  assert.equal(mate.check, true);
  assert.deepEqual(mate.legal, []);
});

test('only ordinary enemies get the player-glass incentive; bot glass and ethereal are ordinary', () => {
  const base = '6k1/8/8/3r4/8/2N1B3/8/6K1 b - - 0 1';
  command(`load ${base} @hunt=0;c3=1/1/1`);
  const boss = command('eval').score;
  command(`load ${base} @hunt=1;c3=1/1/1`);
  assert.ok(command('eval').score < boss);
  command(`load ${base} @hunt=1`);
  const ordinary = command('eval').score;
  command(`load ${base} @hunt=1;d5=1/1/1`);
  assert.equal(command('eval').score, ordinary);
});

test('kings reject every special attribute, including empowered attack', () => {
  const fen='6k1/8/8/8/8/8/8/6K1 w - - 0 1';
  const plain=command('load '+fen+' @hunt=0');
  const special=command('load '+fen+' @hunt=0;g1=3/2/1;g8=2/2/1');
  assert.equal(special.fen,plain.fen);
  assert.equal(special.key,plain.key);
  for(const piece of parsePosition(special.fen).pieces.values()) {
    assert.equal(piece.hp,1);assert.equal(piece.damage,1);assert.equal(piece.glass,false);
  }
});

test('neutral dungeon mode preserves ordinary exchange search', () => {
  for(const fen of [
    'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 1 3',
  ]) {
    command('load '+fen);const ordinary=command('search 7 3000');
    command('load '+fen+' @hunt=0');const neutral=command('search 7 3000');
    assert.equal(neutral.depth,ordinary.depth);
    assert.equal(neutral.bestmove,ordinary.bestmove);
    assert.equal(neutral.score,ordinary.score);
  }
});

// These run the actual compiled WASM, including save replay and complete battle turns.
test('debug editing rebases real WASM rules and survives custom save replay',async()=>{
 const {Battle}=await import('../src/battle/game.js'),{editBattle}=await import('../src/battle/debug.js');
 const client={request:async value=>command(value)},game=new Battle(client);
 await game.start({id:'debug-qa',fen:'6k1/8/8/8/8/8/8/R5K1 w - - 0 1 @hunt=1'});
 await editBattle(game,{kind:'piece',type:'r',color:'b'},'a4');
 await editBattle(game,{kind:'material',material:'stone'},'a4');
 await editBattle(game,{kind:'material',material:'diamond'},'a1');
 await editBattle(game,{kind:'material',material:'power'},'a1');
 const saved=game.snapshot(),root=game.state.fen;await game.restore(saved);
 assert.equal(game.state.fen,root);assert.equal(parsePosition(root).pieces.get('a1').hp,3);
 await game.move('a1a4');assert.equal(game.state.hit,false);assert.equal(parsePosition(game.state.fen).pieces.get('a4').color,'w');
 await game.undoTurn();assert.equal(game.state.fen,root);
 await editBattle(game,{kind:'material',material:'ethereal'},'a1');assert.ok(game.ethereal.has('a1'));
 await editBattle(game,{kind:'material',material:'ordinary'},'a1');assert.ok(!game.ethereal.has('a1'));assert.equal(parsePosition(game.state.fen).pieces.get('a1').damage,1);
 const before=game.state.fen;await assert.rejects(()=>editBattle(game,{kind:'material',material:'stone'},'g1'),/Король/);assert.equal(game.state.fen,before);
 await editBattle(game,{kind:'piece',type:'b',color:'w'},'c3');await editBattle(game,{kind:'piece',type:'n',color:'w'},'e3');
 assert.notEqual(game.preset.identities.c3,game.preset.identities.e3);
});

test('debug edits preserve campaign identities, spent ether and revisions across reload',async()=>{
 const {Battle}=await import('../src/battle/game.js'),{editBattle}=await import('../src/battle/debug.js');
 const {Run}=await import('../src/dungeon/run.js'),{saveRun,loadRun}=await import('../src/dungeon/storage.js'),{campaignBattle}=await import('../src/dungeon/battle-link.js');
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},run=new Run(81);
 run.enemies.find(e=>e.guard).bounds={left:0,right:7,bottom:1,top:8};
 run.openEncounter(run.enemies.find(e=>e.guard));run.beginBattle(['queen','knight']);saveRun(run,storage);
 const context=campaignBattle('?run='+run.id,storage),stale=campaignBattle('?run='+run.id,storage),game=new Battle({request:async value=>command(value)});
 await game.restore(context.snapshot,context.preset);const queen=Object.entries(context.preset.identities).find(([,id])=>id==='queen')[0];await game.move(queen+'d4');await game.move('g8h7');
 await editBattle(game,{kind:'material',material:'glass'},'d4',context);
 assert.equal(game.preset.identities.d4,'queen');assert.equal(game.moves.length,0);assert.equal(loadRun(storage).inventory.find(p=>p.id==='queen').material,'glass');
 await editBattle(game,{kind:'piece',type:'r',color:'w'},'f1',context);const id=game.preset.identities.f1;
 await editBattle(game,{kind:'material',material:'ethereal'},'f1',context);assert.ok(!loadRun(storage).inventory.some(p=>p.id===id));
 await editBattle(game,{kind:'material',material:'diamond'},'f1',context);assert.equal(loadRun(storage).inventory.find(p=>p.id===id).material,'diamond');
 assert.throws(()=>stale.save(game),/другой вкладке/);
 const restored=campaignBattle('?run='+run.id,storage);await game.restore(restored.snapshot,restored.preset);assert.equal(parsePosition(game.state.fen).pieces.get('f1').hp,3);assert.equal(game.preset.identities.f1,id);
});

test('battle lifecycle restores moves, HP, ether and the player turn through undo and save replay', async()=>{
 const {Battle,battles}=await import('../src/battle/game.js');
 const client={request:async value=>command(value)};
 const game=new Battle(client);
 await game.start(battles[0]);
 const initial=game.state.fen;
 await game.move('g1f3');await game.move('g8f6');
 const saved=game.snapshot(),fen=game.state.fen;
 assert.ok(game.ethereal.has('f3'));assert.ok(game.ethereal.has('f6'));
 const undone=[];
 await game.undoTurn(async move=>{undone.push([move.uci,parsePosition(game.state.fen).turn,game.moves.length]);await Promise.resolve();});
 assert.deepEqual(undone,[['g8f6','b',1],['g1f3','w',0]]);
 assert.equal(game.moves.length,0);assert.equal(game.state.fen,initial);
 await game.restore(saved);assert.equal(game.state.fen,fen);assert.ok(game.ethereal.has('f3'));
});

test('all battle armies load legally and the opponent can answer a real player move',async()=>{
 const {battles}=await import('../src/battle/game.js');
 for(const preset of battles){
  const state=command('load '+preset.fen);assert.ok(state.legal.length>0,preset.id);assert.equal(state.check,false,preset.id);
  const player=command('search 4 1200');command('move '+player.bestmove);
  const black=command('state');const answer=command('search 5 1200');assert.ok(black.legal.includes(answer.bestmove),preset.id);
 }
});

test('armor tactics find mate and lethal empowered captures for both colors',()=>{
 const positions=[
  {fen:'6rk/8/5KQ1/8/8/8/8/8 w - - 0 1 @hunt=1;g8=2/1/0',mate:true},
  {fen:'8/8/8/8/8/5kq1/8/6RK b - - 0 1 @hunt=0;g1=2/1/0',mate:true},
  {fen:'6k1/8/8/8/q7/2N5/8/R5K1 w - - 0 1 @hunt=1;a4=2/1/0;c3=1/2/0',move:'c3a4'},
  {fen:'r5k1/8/2n5/Q7/8/8/8/6K1 b - - 0 1 @hunt=0;a5=2/1/0;c6=1/2/0',move:'c6a5'},
 ];
 for(const fixture of positions)for(const depth of [3,5,7]){
  const start=command('load '+fixture.fen),result=command(`search ${depth} 1200`);
  assert.ok(start.legal.includes(result.bestmove));
  if(fixture.move)assert.equal(result.bestmove,fixture.move,`depth ${depth}`);
  if(fixture.mate){const end=command('move '+result.bestmove);assert.equal(end.check,true);assert.equal(end.legal.length,0);}
 }
});

test('saved battle replay preserves threefold repetition and terminal move lock',async()=>{
 const {Battle,battles}=await import('../src/battle/game.js');
 const game=new Battle({request:async value=>command(value)});
 await game.start(battles.find(p=>p.id==='ordinary'));
 for(const uci of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'])await game.move(uci);
 assert.equal(game.result.result,'draw');
 const saved=game.snapshot();await game.restore(saved);assert.equal(game.result.result,'draw');
 await assert.rejects(game.move(game.state.legal[0]),/недоступен/);
 await game.undoTurn();assert.equal(game.result,null);assert.equal(parsePosition(game.state.fen).turn,'w');
});

test('bot defends against mate instead of wasting a turn hitting an armored queen',()=>{
 const fen='6rk/8/5KQ1/8/8/8/8/8 b - - 0 1 @hunt=0;g8=2/1/0;g6=2/1/0';
 command('load '+fen);assert.ok(command('state').legal.includes('g8g6'));
 assert.equal(command('move g8g6').hit,true);
 const trap=command('move g6h6');assert.equal(trap.check,true);assert.equal(trap.legal.length,0);
 for(const depth of [3,5,7]){
  command('load '+fen);const choice=command(`search ${depth} 1200`);assert.notEqual(choice.bestmove,'g8g6');
  const reply=command('move '+choice.bestmove);
  for(const candidate of reply.legal){const child=command('move '+candidate);assert.ok(!child.check||child.legal.length>0,`depth ${depth}: ${choice.bestmove} allows ${candidate} mate`);command('undo');}
 }
});

test('bot evacuates its stone queen from an empowered knight',()=>{
 const fen='6k1/8/8/8/q7/2N5/8/R5K1 b - - 0 1 @hunt=0;a4=2/1/0;c3=1/2/0';
 for(const depth of [3,5,7]){
  command('load '+fen);
  const result=command(`search ${depth} 1200`);
  assert.ok(result.bestmove.startsWith('a4'));
  const after=command('move '+result.bestmove),{pieces}=parsePosition(after.fen);
  const [square,queen]=[...pieces].find(([,p])=>p.color==='b' && p.type==='q');
  assert.ok(!after.legal.some(m=>m.slice(2,4)===square && pieces.get(m.slice(0,2)).damage>=queen.hp),`depth ${depth}: queen hangs`);
 }
});

test('campaign formation and custom save replay use the actual WASM rules',async()=>{
 const {Run}=await import('../src/dungeon/run.js');
 const {Battle}=await import('../src/battle/game.js');
 const run=new Run(459);run.inventory.push({id:'glass-pawn',type:'p',material:'glass'},{id:'ether-knight',type:'n',material:'ethereal'},{id:'stone-bishop',type:'b',material:'stone'});
 run.openEncounter(run.enemies.find(e=>e.guard));const preset=run.beginBattle(run.inventory.map(p=>p.id));
 const game=new Battle({request:async value=>command(value)});await game.start(preset);const initial=game.state.fen;
 for(let ply=0;ply<2;ply++){const best=command('search 4 1200');await game.move(best.bestmove);}
 const saved=game.snapshot(),fen=game.state.fen;await game.restore(saved,preset);assert.equal(game.state.fen,fen);await game.undoTurn();assert.equal(game.state.fen,initial);
 assert.ok([...parsePosition(initial).pieces].some(([,p])=>p.color==='w'&&p.type==='p'&&p.glass));
});

test('cropped ranks use the real edge for promotion and preserve walls through search and undo',()=>{
 const bounds={left:1,right:6,bottom:2,top:7};
 const fen=placement(new Map([['g2','K'],['g7','k'],['b6','P'],['e3','p'],['d4','R']]),bounds)+' w - - 0 1 @hunt=0';
 const root=command('load '+fen);
 assert.ok(root.legal.includes('b6b7q'));assert.ok(root.legal.includes('b6b7n'));assert.ok(!root.legal.includes('b6b7'));
 for(const move of root.legal){assert.ok(inside(move.slice(0,2),bounds));assert.ok(inside(move.slice(2,4),bounds));}
 const searched=command('search 4 100');assert.ok(root.legal.includes(searched.bestmove));assert.equal(searched.fen,root.fen);
 const promoted=command('move b6b7n');assert.equal(parsePosition(promoted.fen).pieces.get('b7').type,'n');
 assert.ok(promoted.legal.includes('e3e2q'));command('move e3e2q');assert.equal(parsePosition(command('state').fen).pieces.get('e2').type,'q');
 command('undo');command('undo');assert.equal(command('state').fen,root.fen);assert.equal(command('state').key,root.key);
 assert.ok(command('perft 2').nodes>0);assert.equal(command('state').fen,root.fen);
});

test('campaign rectangles and bosses load, answer and replay through the game coordinator with the actual WASM adapter',async()=>{
 const {WildRules}=await import('../src/battle/wild-rules.js');
 const rules=new WildRules(async cmd=>command(cmd));
 const {Run}=await import('../src/dungeon/run.js'),{makeEncounter}=await import('../src/dungeon/encounters.js');
 for(let seed=1;seed<=15;seed++)for(let act=1;act<=4;act++)for(let floor=1;floor<=(act===4?1:3);floor++){
  const run=new Run(seed,act);run.floor=floor;run.setupFloor();
  for(const enemy of run.enemies){
   if(enemy.wild||enemy.kingless)continue; // Variant coordinator is exercised separately, including actual WASM projections.
   const preset=makeEncounter(run,enemy,run.inventory.map(p=>p.id)),root=await rules.request('load '+preset.fen);
   assert.equal(root.check,false);assert.ok(root.legal.length>0);
   const move=root.legal.find(m=>m.startsWith(Object.keys(preset.identities).find(s=>preset.identities[s]==='knight')))??root.legal[0];
   await rules.request('move '+move);const reply=await rules.request('search 2 25');assert.ok(reply.legal.includes(reply.bestmove));
   assert.ok(inside(moveParts(reply.bestmove).to,preset.bounds));await rules.request('move '+reply.bestmove);
   await rules.request('undo');await rules.request('undo');assert.equal((await rules.request('state')).fen,root.fen);
  }
 }
});

test('wild coordinator keeps real WASM black replies legal and replays the complete three-side round',async()=>{
 const {WildRules,wildFen}=await import('../src/battle/wild-rules.js');
 const {Battle}=await import('../src/battle/game.js');
 const board=new Map([['g1',{type:'k',color:'w',hp:1,damage:1}],['g8',{type:'k',color:'b',hp:1,damage:1}],['c1',{type:'n',color:'w',hp:1,damage:1}],['c8',{type:'n',color:'b',hp:1,damage:1}],['a5',{type:'r',color:'wild',hp:2,damage:1,wildId:'wild-native'}]]);
 const preset={id:'native-wild',fen:wildFen(board,{left:0,right:7,bottom:1,top:8})};
 const game=new Battle(new WildRules(async text=>{const result=command(text);if(result.error)throw Error(result.error);return result;}));
 await game.start(preset);await game.move('c1d3');
 let reply=await game.engine.request('search 3 50');assert.ok(game.state.legal.includes(reply.bestmove));await game.move(reply.bestmove);assert.equal(parsePosition(game.state.fen).turn,'x');
 reply=await game.engine.request('search 3 50');await game.move(reply.bestmove);assert.equal(parsePosition(game.state.fen).turn,'w');
 const saved=game.snapshot(),fen=game.state.fen;await game.restore(saved,preset);assert.equal(game.state.fen,fen);
 await game.undoTurn();assert.equal(game.state.fen,preset.fen);
});

test('three-side coordinator retains native chess legality after the wild participant is gone',async()=>{
 const {WildRules}=await import('../src/battle/wild-rules.js');
 const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1 @hunt=1;b1=2/1/0;g8=2/1/0;d1=1/2/0';
 const rules=new WildRules(async()=>{throw Error('No search in differential verification');});
 let native=command('load '+fen),coordinated=await rules.request('load '+fen+';wildmode=mixed'),compared=0;
 for(let ply=0;ply<80;ply++){
  assert.deepEqual([...coordinated.legal].sort(),[...native.legal].sort(),`legal moves at ply ${ply}`);
  compared++;
  if(!native.legal.length||coordinated.gameResult)break;
  const move=[...native.legal].sort()[(ply*11+7)%native.legal.length];
  native=command('move '+move);coordinated=await rules.request('move '+move);
  assert.equal(coordinated.hit,native.hit);
 }
 assert.equal(compared,80);
});


test('pawn double steps start on the second active rank for both colors',()=>{
 const bounds={left:0,right:7,bottom:2,top:7};
 const root=command('load '+placement(new Map([['g2','K'],['g7','k'],['b3','P'],['e6','p']]),bounds)+' w - - 0 1 @hunt=0');
 assert.ok(root.legal.includes('b3b5'));const next=command('move b3b5');assert.ok(next.legal.includes('e6e4'));
 command('move e6e4');command('undo');command('undo');assert.equal(command('state').fen,root.fen);
});

test('manual formation starts on exact chosen cells and preserves deployed attributes in WASM',async()=>{
 const {Run}=await import('../src/dungeon/run.js'),{deploymentPreset}=await import('../src/dungeon/deployment.js');
 const run=new Run(711),enemy=run.enemies.find(e=>e.guard);run.biome='court';enemy.bounds={left:0,right:7,bottom:1,top:8};
 run.inventory.push({id:'glass',type:'p',material:'glass'},{id:'stone',type:'b',material:'stone'});run.buffs=[{pieceId:'stone',remaining:1}];
 const preset=deploymentPreset(run,enemy,{king:'g1',queen:'d2',stone:'f1',glass:'c2'}),root=command('load '+preset.fen),pieces=parsePosition(root.fen).pieces;
 assert.equal(root.check,false);assert.equal(pieces.get('d2').type,'q');assert.equal(pieces.get('f1').hp,2);assert.equal(pieces.get('f1').damage,2);assert.equal(pieces.get('c2').glass,true);
 assert.ok(root.legal.includes('d2d4'));command('move d2d4');const reply=command('search 3 50');assert.ok(reply.legal.includes(reply.bestmove));
 command('move '+reply.bestmove);command('undo');command('undo');assert.equal(command('state').fen,root.fen);
});
