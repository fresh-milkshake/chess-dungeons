import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactThreats,createThreatCache} from '../src/artifacts/threats.js';
import {parsePosition} from '../src/lab/scenarios.js';
import {attacks} from '../src/dungeon/enemy-formation.js';

test('ray threats match geometric attacks for every piece, stop at blockers, and exclude allies',()=>{
 for(const type of 'pnbrqk'){
  const pieces=new Map([['d5',{type,color:'b',damage:2}],['d3',{type:'p',color:'w'}],['b5',{type:'p',color:'b'}]]);
  const {threats,danger}=artifactThreats({pieces,walls:new Set()});
  for(const file of 'abcdefgh')for(const rank of '12345678'){
   const target=file+rank;
   const expected=[...pieces].some(([from,p])=>p.color==='b'&&attacks(from,p.type,target,pieces,p.color));
   assert.equal(threats.has(target),expected,`${type} -> ${target}`);
  }
  if(type==='r'||type==='q')assert.equal(danger.get('d3'),2);
 }
});

test('cropped walls block rays and friendly or black-targeting wilds do not threaten white',()=>{
 const pieces=new Map([['d5',{type:'r',color:'b'}],['c2',{type:'q',color:'wild',neutral:true}],['g4',{type:'n',color:'wild',aggro:'b'}]]);
 const {threats}=artifactThreats({pieces,walls:new Set(['d4'])});
 assert.equal(threats.has('d4'),false);assert.equal(threats.has('d3'),false);assert.equal(threats.has('a2'),false);assert.equal(threats.has('e3'),false);
 pieces.get('g4').aggro='w';assert.equal(artifactThreats({pieces,walls:new Set(['d4'])}).threats.has('e3'),true);
});

test('unchanged UI renders reuse one position parse and one threat map; a real move invalidates it',()=>{
 let parses=0;const cache=createThreatCache(fen=>{parses++;return parsePosition(fen);});
 const first='2r4k/8/8/8/8/2N5/2B5/7K w - - 0 1',next=first.replace(' w ',' b ');
 const result=cache.get(first);
 for(let i=0;i<100;i++){assert.equal(cache.get(first),result);cache.position(first);}
 assert.equal(parses,1);assert.equal(result.danger.get('c3'),1);assert.equal(result.danger.has('c2'),false);
 assert.notEqual(cache.get(next),result);assert.equal(parses,2);
});
