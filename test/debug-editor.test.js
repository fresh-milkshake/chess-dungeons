import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyMaterial,editPosition} from '../src/debug/position.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {Run} from '../src/dungeon/run.js';
import {addDebugPiece,materializeDebugPiece} from '../src/dungeon/debug.js';
import {makeEncounter} from '../src/dungeon/encounters.js';

const initial='6k1/8/8/8/8/8/8/R5K1 w - - 0 1 @hunt=1';
test('debug materials replace armor/glass, preserve independent power, and never modify kings',()=>{
 const rook={type:'r',color:'w',hp:1,damage:1,glass:false};
 const diamond=applyMaterial(rook,'diamond');assert.equal(diamond.hp,3);
 const strong=applyMaterial(diamond,'power');assert.equal(strong.hp,3);assert.equal(strong.damage,2);
 const glass=applyMaterial(strong,'glass');assert.equal(glass.hp,1);assert.equal(glass.damage,2);assert.equal(glass.glass,true);
 const plain=applyMaterial(glass,'ordinary');assert.equal(plain.damage,1);assert.equal(plain.glass,false);
 for(const material of ['stone','glass','ethereal','diamond','power'])assert.throws(()=>applyMaterial({...rook,type:'k'},material),/Король/);
});

test('debug placement enforces occupancy, king count, pawn ranks and legal check ownership',()=>{
 assert.throws(()=>editPosition(initial,[],{kind:'piece',type:'q',color:'w'},'a1'),/занята/);
 assert.throws(()=>editPosition(initial,[],{kind:'piece',type:'k',color:'b'},'d5'),/уже есть/);
 assert.throws(()=>editPosition(initial,[],{kind:'piece',type:'p',color:'b'},'b8'),/Пешку/);
 const check=editPosition(initial,[],{kind:'piece',type:'r',color:'w'},'g5');assert.equal(parsePosition(check.fen).turn,'b');
 const add=editPosition(initial,[],{kind:'piece',type:'n',color:'b'},'d5');assert.equal(parsePosition(add.fen).pieces.get('d5').color,'b');
 const ether=editPosition(add.fen,[],{kind:'material',material:'ethereal'},'d5');assert.deepEqual(ether.ethereal,['d5']);
 const stone=editPosition(ether.fen,ether.ethereal,{kind:'material',material:'stone'},'d5');assert.deepEqual(stone.ethereal,[]);assert.equal(parsePosition(stone.fen).pieces.get('d5').hp,2);
});

test('map editor adds inventory and enemies without a turn; materials reach generated armies',()=>{
 const run=new Run(25),turn=run.turns;
 addDebugPiece(run,{color:'w',type:'r'});const rook=run.inventory.at(-1);
 materializeDebugPiece(run,'diamond',{pieceId:rook.id});materializeDebugPiece(run,'power',{pieceId:rook.id});
 const cell=run.visible.map(k=>{const [x,y]=k.split(',').map(Number);return{x,y};}).find(c=>{try{const copy=Run.restore(run.snapshot());addDebugPiece(copy,{color:'b',type:'n'},c);return true;}catch{return false;}});
 assert.ok(cell);addDebugPiece(run,{color:'b',type:'n'},cell);const enemy=run.enemies.at(-1);materializeDebugPiece(run,'stone',{cell});
 const preset=makeEncounter(run,enemy,run.inventory.map(p=>p.id)),pieces=parsePosition(preset.fen).pieces;
 assert.ok([...pieces.values()].some(p=>p.color==='w'&&p.type==='r'&&p.hp===3&&p.damage===2));
 assert.ok([...pieces.values()].some(p=>p.color==='b'&&p.type==='n'&&p.hp===2));
 assert.equal(run.turns,turn);assert.throws(()=>addDebugPiece(run,{color:'w',type:'k'}),/уже есть/);
 assert.throws(()=>materializeDebugPiece(run,'stone',{pieceId:'king'}),/Король/);
 assert.throws(()=>addDebugPiece(run,{color:'b',type:'r'},cell),/занята/);
});
