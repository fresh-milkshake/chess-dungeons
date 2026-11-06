import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStepBuffer} from '../src/dungeon/step-buffer.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],tasks=new Map(),resolvers=[];let id=0,busy=false,allowed=true;
 const buffer=createStepBuffer({isBusy:()=>busy,canMove:()=>allowed,step:(...dir)=>{calls.push(dir);return new Promise(resolve=>resolvers.push(resolve));},schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},cancel:id=>tasks.delete(id)});
 return {buffer,calls,tasks,finish:async(value=true)=>{resolvers.shift()(value);await flush();},tick:()=>{const [id,t]=tasks.entries().next().value;tasks.delete(id);t.fn();},busy:value=>{busy=value;},allowed:value=>{allowed=value;}};
}
test('ten taps during one movement collapse to one next step, latest direction wins',async()=>{
 const f=fixture();f.buffer.press([1,0]);for(let i=0;i<10;i++)f.buffer.press([1,0]);f.buffer.press([0,-1]);
 assert.deepEqual(f.calls,[[1,0]]);await f.finish();assert.equal(f.tasks.size,1);f.tick();assert.deepEqual(f.calls,[[1,0],[0,-1]]);await f.finish();assert.equal(f.tasks.size,0);
});
test('held movement repeats after completion; releasing stops and blocked steps do not loop',async()=>{
 const f=fixture();f.buffer.setHeld([1,0]);f.buffer.press([1,0]);await f.finish();assert.equal([...f.tasks.values()][0].delay,80);f.tick();assert.equal(f.calls.length,2);
 f.buffer.setHeld(null);await f.finish();assert.equal(f.tasks.size,0);
 f.buffer.setHeld([0,-1]);f.buffer.press([0,-1]);await f.finish(false);assert.equal(f.tasks.size,0);
});
test('external animation queues one action; stage change or blur clears pending and held input',async()=>{
 const f=fixture();f.busy(true);f.buffer.press([1,0]);f.buffer.press([0,1]);assert.equal(f.calls.length,0);f.busy(false);f.tick();assert.deepEqual(f.calls,[[0,1]]);
 f.buffer.press([1,0]);f.buffer.setHeld([1,0]);f.allowed(false);await f.finish();assert.equal(f.tasks.size,0);f.allowed(true);f.buffer.wake();assert.equal(f.calls.length,1);
});
test('new input after blur can resume once an old in-flight animation finishes',async()=>{
 const f=fixture();f.buffer.press([1,0]);f.buffer.reset();f.buffer.press([-1,0]);await f.finish();f.tick();assert.deepEqual(f.calls,[[1,0],[-1,0]]);await f.finish();
});
