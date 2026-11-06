import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {encounterBounds,inside,placement,fullBoard} from '../src/battle/geometry.js';
import {files,moveParts} from '../src/battle/coordinates.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {WildRules,wildFen} from '../src/battle/wild-rules.js';
import {automaticDeployment,deploymentPreset} from '../src/dungeon/deployment.js';
import {moveDetails} from '../src/battle/game.js';
import {artifactThreats} from '../src/artifacts/threats.js';

test('only final boss has a 12-square core with four symmetric four-cell protrusions',()=>{
 const b=encounterBounds({act:4},{boss:true}),cells=[];
 for(let y=1;y<=14;y++)for(let x=0;x<14;x++)if(inside(files[x]+y,b))cells.push([x,y]);
 assert.equal(cells.length,144+16);
 for(const [x,y] of cells){assert.ok(inside(files[13-x]+y,b));assert.ok(inside(files[x]+(15-y),b));}
 assert.ok(inside('a6',b));assert.ok(inside('f14',b));assert.ok(!inside('a1',b));
 for(const act of [1,2,3])assert.deepEqual(encounterBounds({act},{boss:true}),fullBoard);
});
test('imperial setup and metadata round-trip support ranks 10–14 and retain the emperor',async()=>{
 const run=new Run(0,4);run.floor=1;run.setupFloor();const boss=run.enemies[0];
 const preset=deploymentPreset(run,boss,automaticDeployment(run,boss)),p=parsePosition(preset.fen);
 assert.equal(p.bounds.top,14);assert.equal(p.bounds.right,13);assert.equal(p.walls.size,36);
 assert.ok([...p.pieces].some(([s,q])=>q.emperor&&Number(s.slice(1))>9&&q.hp===3));
 const e=new WildRules(()=>{throw Error('Unsupported board cannot use 8×8 native search');});
 const initial=await e.request('load '+preset.fen);assert.ok(initial.legal.length);
 const first=initial.legal[0];await e.request('move '+first);const reply=await e.request('search 2 50');assert.ok(reply.legal.includes(reply.bestmove));
 await e.request('move '+reply.bestmove);await e.request('undo');const restored=await e.request('undo');assert.equal(restored.fen,initial.fen);
});
test('extended moves, long rays, side cells, promotion and threat markers work',async()=>{
 const b=encounterBounds({act:4},{boss:true});
 const piece=(type,color)=>({type,color,hp:1,damage:1,glass:false});
 const board=new Map([['l2',piece('k','w')],['l13',piece('k','b')],['f2',piece('r','w')],['g13',piece('p','w')],['m9',piece('r','b')]]);
 const fen=wildFen(board,b),e=new WildRules(()=>{throw Error('native');}),s=await e.request('load '+fen);
 assert.ok(s.legal.includes('f2f14'));assert.ok(s.legal.includes('g13g14q'));
 assert.deepEqual(moveParts('f2f14'),{from:'f2',to:'f14',promotion:undefined});
 assert.equal(moveDetails(fen,'f2f14',false).to,'f14');
 const threats=artifactThreats(parsePosition(fen)).threats;assert.ok(threats.has('n9'));assert.ok(!threats.has('n10'));
 const moved=await e.request('move f2f14');assert.equal(parsePosition(moved.fen).pieces.get('f14').type,'r');
 assert.equal(parsePosition(placement(new Map(),b)+' w - - 0 1').walls.size,36);
});
