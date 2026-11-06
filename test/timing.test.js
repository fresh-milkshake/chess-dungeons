import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActiveClock} from '../src/timing/clock.js';
import {emptyReport,addTime,summarizeRun} from '../src/timing/storage.js';
test('active time excludes unfocused and hidden intervals without adding them on return',()=>{
 let now=0;const chunks=[],clock=new ActiveClock({now:()=>now,onTime:(c,t)=>chunks.push([c.phase,t]),focused:true});
 clock.setContext({phase:'map'});now=5000;clock.setActivity({focused:false});now=65000;clock.tick();
 clock.setActivity({focused:true});now=68000;clock.setActivity({visible:false});now=168000;clock.tick();
 clock.setActivity({visible:true});now=170000;clock.tick();
 assert.equal(chunks.reduce((n,[,t])=>n+t,0),10000);
});
test('stage changes split time exactly; disabling remains effective through focus and stage changes',()=>{
 let now=0;const report=emptyReport(),clock=new ActiveClock({now:()=>now,onTime:(c,t)=>addTime(report,c,t,0),focused:true});
 const context={runId:'run',act:1,floor:1,phase:'map'};clock.setContext(context);now=3000;clock.setContext({...context,phase:'reward'});now=7000;clock.setEnabled(false);
 const snapshot=JSON.stringify(report);now=100000;clock.setContext({...context,phase:'preparation'});clock.setActivity({focused:false});now=200000;clock.setActivity({focused:true});clock.tick();assert.equal(JSON.stringify(report),snapshot);
 clock.setEnabled(true);now=202000;clock.tick();assert.deepEqual(summarizeRun(report.runs.run).phases,{map:3000,reward:4000,preparation:2000});
});
test('levels, shops, encounters and separate runs keep independent totals',()=>{
 const report=emptyReport(),context={runId:'r1',act:1,floor:1,phase:'map'};
 addTime(report,context,1000);addTime(report,{...context,phase:'preparation',encounterId:'guard'},2000);addTime(report,{...context,phase:'battle-player',encounterId:'guard'},3000);
 addTime(report,{...context,floor:2},4000);addTime(report,{...context,floor:null,area:'shop',phase:'shop'},5000);addTime(report,{...context,runId:'r2'},9000);
 const sum=summarizeRun(report.runs.r1);assert.equal(sum.total,15000);assert.equal(sum.areas.length,3);assert.equal(report.runs.r1.areas['1:1'].encounters.guard.phases.preparation,2000);assert.equal(summarizeRun(report.runs.r2).total,9000);
});
