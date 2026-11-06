import {test} from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeMask,fogViewportSize,fogPatternOffset} from '../src/fog/knowledge.js';
import {smoothKnowledge,createMaskTransition,projectFogFrame} from '../src/fog/smooth-mask.js';

test('fog mask tracks only explored/visible cells and forgets current visibility without erasing memory',()=>{
 assert.deepEqual([...knowledgeMask(3,2,['0,0','1,0','2,1'],['1,0'])],[150,0,255,255,255,150]);
 assert.deepEqual([...knowledgeMask(3,2,['0,0','1,0','2,1'],['2,1'])],[150,150,255,255,255,0]);
 assert.deepEqual([...knowledgeMask(2,2,[],[])],[255,255,255,255]);
});

test('viewport fog has a fixed pixel budget even at 4K and preserves aspect ratio',()=>{
 for(const [w,h] of [[3840,2160],[1440,1000],[1920,1080],[800,600],[400,1200]]){
  const size=fogViewportSize(w,h);assert.ok(size.width<=960);assert.ok(size.height<=540);
  assert.ok(size.width*size.height<=960*540);assert.ok(Math.abs(size.width/size.height-w/h)<.01);
 }
 assert.deepEqual(fogViewportSize(320,214),{width:320,height:214});
});
test('smoke offset survives reload, changes between floors/acts and stays within shader precision bounds',()=>{
 const original=fogPatternOffset(49,1,1);
 assert.deepEqual(fogPatternOffset(49,1,1),original);
 assert.notDeepEqual(fogPatternOffset(49,1,2),original);
 assert.notDeepEqual(fogPatternOffset(49,2,1),original);
 assert.notDeepEqual(fogPatternOffset(50,1,1),original);
 assert.ok(original.every(n=>n>=0&&n<128));
});

test('knowledge boundary has a continuous soft contour without dimming the visible center or exposing distant terrain',()=>{
 const visible=[];for(let y=3;y<=5;y++)for(let x=3;x<=5;x++)visible.push(`${x},${y}`);
 const mask=smoothKnowledge(9,9,visible,visible),at=(x,y)=>mask.data[y*mask.width+x];
 assert.equal(mask.width,36);assert.equal(mask.height,36);assert.equal(at(18,18),0);assert.equal(at(32,18),255);
 assert.ok(at(23,18)>200); // Terrain must be obscured before its unknown-cell cutout.
 const edge=Array.from({length:12},(_,i)=>at(19+i,18));
 assert.ok(new Set(edge).size>=5);assert.ok(edge.every((v,i)=>i===0||v>=edge[i-1]));
 const memory=smoothKnowledge(9,9,Array.from({length:81},(_,i)=>`${i%9},${Math.floor(i/9)}`),[]);
 assert.equal(memory.data[18*36+18],150);
});

test('mask retargeting is continuous, duplicate renders do not restart the fade, new floors snap safely',()=>{
 const fade=createMaskTransition(240);
 fade.set(new Uint8Array([0,255]),0,'floor-1');assert.deepEqual([...fade.sample(0)],[0,255]);
 fade.set(new Uint8Array([255,0]),10,'floor-1');assert.deepEqual([...fade.sample(10)],[0,255]);
 const midway=[...fade.sample(130)];assert.ok(midway.every(v=>v>=127&&v<=128));
 assert.equal(fade.set(new Uint8Array([255,0]),130,'floor-1'),false);
 fade.set(new Uint8Array([0,255]),130,'floor-1');assert.deepEqual([...fade.sample(130)],midway);
 assert.deepEqual([...fade.sample(370)],[0,255]);assert.equal(fade.active(370),false);
 fade.set(new Uint8Array([255,255]),380,'floor-2');assert.deepEqual([...fade.sample(380)],[255,255]);
});

test('fog frame follows the camera between GPU draws, including pan and zoom',()=>{
 const capture={origin:[-3.25,-7.5],tile:72},world=[8.3,12.8];
 for(const camera of [{x:100,y:-15,tile:72},{x:-250,y:80,tile:110},{x:5,y:-7,tile:30}]){
  const p=projectFogFrame(capture,camera);
  const projected=[p.x+(world[0]-capture.origin[0])*capture.tile*p.scale,p.y+(world[1]-capture.origin[1])*capture.tile*p.scale];
  assert.ok(Math.abs(projected[0]-(camera.x+world[0]*camera.tile))<1e-8);
  assert.ok(Math.abs(projected[1]-(camera.y+world[1]*camera.tile))<1e-8);
 }
});
