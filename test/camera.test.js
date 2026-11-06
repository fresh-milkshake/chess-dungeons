import test from 'node:test';
import assert from 'node:assert/strict';
import {followTarget,zoomAt,followAxis} from '../src/dungeon/camera.js';

test('camera tracks every king step and stays still only when the king is already centered',()=>{
 const camera={x:0,y:0,zoom:1};
 assert.deepEqual(followTarget(camera,{x:4,y:4},100,1000,1000),{x:50,y:50});
 assert.equal(followTarget({x:50,y:50,zoom:1},{x:4,y:4},100,1000,1000),null);
 assert.deepEqual(followTarget(camera,{x:6,y:6},100,1000,1000),{x:-150,y:-150});
 assert.deepEqual(followTarget(camera,{x:7,y:4},100,1000,1000),{x:-250,y:50});
 assert.deepEqual(followTarget({x:0,y:0,zoom:2},{x:4,y:4},100,1000,1000),{x:-400,y:-400});
});

test('wheel zoom keeps the world point under the pointer fixed and bounds its scale',()=>{
 const camera={x:-200,y:80,zoom:1},point={x:350,y:220};
 for(const scale of [.01,.5,1,2,10]){
  const next=zoomAt(camera,point,scale);assert.ok(next.zoom>=.4&&next.zoom<=2.5);
  assert.equal((point.x-next.x)/next.zoom,(point.x-camera.x)/camera.zoom);
  assert.equal((point.y-next.y)/next.zoom,(point.y-camera.y)/camera.zoom);
 }
});

test('camera retargeting preserves motion rather than restarting from zero speed',()=>{
 let state={position:0,velocity:0};
 for(let i=0;i<28;i++)state=followAxis(state.position,state.velocity,-72,.01);
 assert.ok(state.velocity<-50);
 const next=followAxis(state.position,state.velocity,-144,.001);
 assert.ok(next.velocity<0);assert.ok(Math.abs(next.velocity/state.velocity-1)<.2);
 assert.ok(next.position<state.position);
});

test('camera spring gives the same result at 60 and 165 Hz and settles without overshoot',()=>{
 const simulate=hz=>{let state={position:0,velocity:0};for(let i=0;i<hz;i++)state=followAxis(state.position,state.velocity,-72,1/hz);return state;};
 const a=simulate(60),b=simulate(165);
 assert.ok(Math.abs(a.position-b.position)<1e-8);assert.ok(Math.abs(a.velocity-b.velocity)<1e-8);
 assert.ok(a.position>-72&&a.position<-71.9);
 const reversed=followAxis(a.position,a.velocity,0,.1);assert.ok(reversed.velocity>0);assert.ok(reversed.position<0);
});
