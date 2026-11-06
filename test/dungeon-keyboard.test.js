import test from 'node:test';
import assert from 'node:assert/strict';
import {keyboardDirection} from '../src/dungeon/keyboard.js';

test('map keyboard chords cover every king direction and opposing keys cancel',()=>{
 const cases=[['KeyW',[0,-1]],['KeyA',[-1,0]],['KeyS',[0,1]],['KeyD',[1,0]],['ArrowUp,ArrowRight',[1,-1]],['KeyW,KeyA',[-1,-1]],['KeyS,KeyD',[1,1]],['ArrowDown,ArrowLeft',[-1,1]],['KeyW,KeyS',[0,0]],['KeyA,KeyD',[0,0]],['KeyW,ArrowUp,KeyS',[0,0]],['KeyW,ArrowUp,KeyD',[1,-1]]];
 for(const [codes,expected]of cases)assert.deepEqual(keyboardDirection(codes.split(',')),expected,codes);
});
