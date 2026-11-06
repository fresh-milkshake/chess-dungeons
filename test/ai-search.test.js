import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {aiProfile,floorProfiles,randomDecision} from '../src/battle/ai-profile.js';
import {variantSearch} from '../src/battle/variant-search.js';
import {WildRules,wildFen,wildLegal,kingThreatened,applyVariantMove,chooseWildMove} from '../src/battle/wild-rules.js';
import {moveParts,rank} from '../src/battle/coordinates.js';
const bounds={left:0,right:7,bottom:1,top:8},piece=(type,color='w',hp=1)=>({type,color,hp,damage:1,glass:false});
const opts=board=>({board,bounds,turn:'b',mode:'mixed',ep:'-',depth:1,milliseconds:600,legal:wildLegal,apply:applyVariantMove,threatened:kingThreatened,wildChoice:chooseWildMove});
test('ten floors grow monotonically in Elo and time independently of army type',()=>{
 assert.equal(floorProfiles.length,10);for(let i=0;i<10;i++){const act=Math.floor(i/3)+1,floor=i%3+1,p=aiProfile(act,floor);assert.equal(p.stage,i+1);if(i){assert.ok(p.elo>aiProfile(Math.floor((i-1)/3)+1,(i-1)%3+1).elo);assert.ok(p.milliseconds>=aiProfile(Math.floor((i-1)/3)+1,(i-1)%3+1).milliseconds);}assert.ok(aiProfile(act,floor,{weak:true}).skill<=p.skill);assert.ok(aiProfile(act,floor,{roaming:true}).skill>=p.skill);}
 assert.equal(aiProfile(4,1,{}, {preset:'high'}).elo,1500);assert.equal(randomDecision(['a1a2'],1,()=>{throw Error('No randomness at maximum');}),null);
});
test('zero skill can sample every legal move and never needs a search, including a native board',async()=>{
 for(let i=0;i<3;i++)assert.equal(randomDecision(['a','b','c'],0,(()=>{let n=0;return ()=>n++?((i+.5)/3):0;})()),['a','b','c'][i]);
 let searches=0;const native=c=>{if(c.startsWith('search'))searches++;return {legal:['a1a2','a1b1'],fen:'native'};};const e=new WildRules(native,{random:()=>0});await e.request('load native');const r=await e.request('search 12 3000 0');assert.equal(r.bestmove,'a1a2');assert.equal(r.nodes,0);assert.equal(searches,0);
});
test('tactical extension avoids a poisoned pawn that the previous depth-one search takes',async()=>{
 const board=new Map([['a1',piece('k')],['h8',piece('k','b')],['d6',piece('q','b')],['d4',piece('p')],['e3',piece('p')]]);
 let old=await readFile('test/fixtures/variant-search-before.txt','utf8');old=old.replace(/^import[^\n]+\n/,'').replace('export function','function');const before=new Function('moveParts','squareRank','files',old+';return variantSearch;')(moveParts,rank,'abcdefghijklmnop');
 assert.equal(before(opts(board)).bestmove,'d6d4');const result=variantSearch(opts(board));assert.notEqual(result.bestmove,'d6d4');assert.ok(result.qnodes>0);assert.ok(wildLegal(board,bounds,'b').includes(result.bestmove));
});
test('maximum variant search finds immediate mate while zero skill can miss it',async()=>{
 const board=new Map([['h1',piece('k')],['f3',piece('k','b')],['g3',piece('q','b')]]);board.world={biome:'garden',key:'mate',round:0,tiles:{a8:'vine'}};
 const engine=()=>new WildRules(()=>{throw Error('Variant board must not delegate');},{random:()=>0});const strong=engine();await strong.request('load '+wildFen(board,bounds,'b'));const r=await strong.request('search 6 300 1');const won=await strong.request('move '+r.bestmove);assert.equal(won.gameResult.result,'loss');
 const weak=engine();await weak.request('load '+wildFen(board,bounds,'b'));const random=await weak.request('search 6 300 0');assert.equal(random.nodes,0);assert.notEqual(random.bestmove,r.bestmove);
});
test('transpositions are reused and a strict time budget still returns a legal move',()=>{
 const board=new Map([['a1',piece('k')],['h8',piece('k','b')],['f6',piece('n','b')],['c6',piece('n','b')],['c3',piece('n')],['f3',piece('n')]]);
 const r=variantSearch({...opts(board),depth:4,milliseconds:500});assert.ok(wildLegal(board,bounds,'b').includes(r.bestmove));assert.ok(r.ttHits>0);assert.ok(r.elapsed<900);
});
