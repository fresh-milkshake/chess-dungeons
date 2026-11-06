import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationVision,preparationKnowledge} from '../src/dungeon/recon-vision.js';
import {Run} from '../src/dungeon/run.js';
import {artifactPlan} from '../src/artifacts/acquisition.js';

test('preparation hides all ranks outside deployment on full and cropped boards',()=>{
 for(const bounds of [{left:0,right:7,bottom:1,top:8},{left:1,right:6,bottom:2,top:8},{left:2,right:7,bottom:2,top:7}]){
  const v=preparationVision(bounds);
  assert.equal(v.mode,'fog');assert.equal(v.hidden.size,v.columns*(v.rows-3));
  for(let y=bounds.bottom;y<=bounds.bottom+2;y++)for(let x=bounds.left;x<=bounds.right;x++)assert.equal(v.hidden.has('abcdefgh'[x]+y),false);
  assert.ok(v.hidden.has('abcdefgh'[bounds.left]+bounds.top));
 }
});
test('only Mirage Lens adds outlines without removing the fog; old relics do not unlock it',()=>{
 const b={left:0,right:7,bottom:1,top:8};
 assert.equal(preparationVision(b,['eye','bell','oracle']).mode,'fog');
 assert.equal(preparationVision(b,['mirage']).mode,'mirage');
 assert.deepEqual(preparationVision(b,['mirage']).hidden,preparationVision(b).hidden);
});

test('soft fog is centred between the third and fourth home ranks, including cropped boards',()=>{
 for(const bounds of [{left:0,right:7,bottom:1,top:8},{left:1,right:6,bottom:2,top:7}]){
  const v=preparationVision(bounds),data=preparationKnowledge(v,2401);
  const at=y=>data[Math.round(y*2400)*2];
  assert.ok(v.hidden.has('d'+(bounds.bottom+3)));assert.equal(v.hidden.has('d'+(bounds.bottom+2)),false);
  assert.ok(Math.abs(at(v.edge)-127.5)<=1);
  assert.equal(at(v.edge-1/v.rows),255);assert.equal(at(v.edge+1/v.rows),0);
  assert.ok(at(v.edge+.3/v.rows)>0&&at(v.edge-.3/v.rows)<255);
  for(let i=2;i<data.length;i+=2)assert.ok(data[i]<=data[i-2]);
 }
});
test('new relic plans can offer Mirage Lens while saved plans remain unchanged',()=>{
 let sites=0,shops=0;
 for(let seed=1;seed<=100;seed++){const p=artifactPlan(seed);sites+=p.sites.some(s=>s.artifactId==='mirage');shops+=p.shops.some(s=>s.artifacts.includes('mirage'));}
 assert.equal(sites,0);assert.ok(shops>0);
 const r=new Run(3),before=structuredClone(r.artifactPlan);assert.deepEqual(Run.restore(r.snapshot()).artifactPlan,before);
});
