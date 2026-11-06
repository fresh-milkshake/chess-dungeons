import test from 'node:test';import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';import {aiProfile} from '../src/battle/ai-profile.js';
import {difficultyPresets,normalizeDifficulty,targetElo,eloSkillLevel,chooseEloMove} from '../src/battle/difficulty.js';
import {WildRules,wildFen} from '../src/battle/wild-rules.js';
const p=(type,color)=>({type,color,hp:1,damage:1,glass:false});
test('all three saved presets advance over ten floors; high targets 1000–1500',()=>{
 for(const preset of Object.keys(difficultyPresets)){
  const r=new Run(5,1,{preset});let previous=0;
  for(let i=0;i<10;i++){const elo=targetElo(Math.floor(i/3)+1,i%3+1,r.difficulty);assert.ok(elo>previous);previous=elo;}
  assert.deepEqual(Run.restore(r.snapshot()).difficulty,{preset,overrideElo:null});
 }
 assert.equal(targetElo(1,1,{preset:'high'}),1000);assert.equal(targetElo(4,1,{preset:'high'}),1500);
});
test('manual Elo stays constant across floors and ignores army composition, old saves become medium',()=>{
 const r=new Run(8);delete r.difficulty;assert.deepEqual(Run.restore(r.snapshot()).difficulty,{preset:'medium',overrideElo:null});
 for(let act=1;act<=4;act++)for(let floor=1;floor<=(act===4?1:3);floor++)for(const enemy of [{type:'p',weak:true},{type:'q',boss:true}])assert.equal(aiProfile(act,floor,enemy,{preset:'low',overrideElo:1200}).elo,1200);
 assert.equal(normalizeDifficulty({overrideElo:9000}).overrideElo,2850);assert.equal(normalizeDifficulty({overrideElo:-50}).overrideElo,100);
});
test('Elo handicap is based on pinned engine skill fit and strongest mode has no noise',()=>{
 assert.ok(eloSkillLevel(500)<eloSkillLevel(1200)&&eloSkillLevel(1200)<eloSkillLevel(1500)&&eloSkillLevel(1500)<eloSkillLevel(2850));
 const c=[{move:'best',score:500},{move:'second',score:480},{move:'third',score:400},{move:'fourth',score:350},{move:'excluded',score:-1000}];
 assert.equal(chooseEloMove(c,2850,()=>{throw Error('No randomness');}),'best');for(let i=0;i<100;i++){const move=chooseEloMove(c,1200);assert.ok(c.slice(0,4).some(p=>p.move===move));}
});
test('native Elo is set before search and maximum oracle clears the previous handicap',async()=>{
 const commands=[],native=c=>{commands.push(c);return {legal:['a1a2'],fen:'native',bestmove:'a1a2'};};const e=new WildRules(native);
 await e.request('load native');await e.request('search 6 150 1 1200');assert.ok(commands.includes('strength 1200'));commands.length=0;await e.request('search 12 3000');assert.ok(commands.includes('strength 0'));
});
test('variant Elo search is legal, budgeted, and does not alter position',async()=>{
 const board=new Map([['a1',p('k','w')],['h8',p('k','b')],['d4',p('r','b')],['c2',p('n','w')]]);board.world={biome:'garden',key:'elo-test',round:0,tiles:{d3:'vine'}};
 const e=new WildRules(()=>{throw Error('No native rules here');},{random:()=>.5});const initial=await e.request('load '+wildFen(board,{left:0,right:7,bottom:1,top:8},'b'));
 const result=await e.request('search 4 80 1 1200');assert.ok(initial.legal.includes(result.bestmove));assert.equal(result.estimatedElo,1200);assert.equal(result.fen,initial.fen);assert.ok(result.elapsed<600);
});
