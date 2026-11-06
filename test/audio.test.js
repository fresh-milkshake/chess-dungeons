import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createAudioSettings,audioDefaults,audioSettingsKey} from '../src/audio/settings.js';
import {soundtrackFor,soundtrack} from '../src/audio/playlist.js';import {createAudioDirector} from '../src/audio/director.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(){const voices=[],loads=[],reports=[];const settings=createAudioSettings(storage());const param=()=>({events:[],setTargetAtTime(...v){this.events.push(['target',...v]);},setValueAtTime(...v){this.events.push(['value',...v]);},linearRampToValueAtTime(...v){this.events.push(['ramp',...v]);},cancelScheduledValues(){}});const ctx={state:'suspended',currentTime:0,destination:{},resume:async()=>{ctx.state='running';},suspend:async()=>{ctx.state='suspended';},close:()=>{ctx.state='closed';},createGain:()=>({gain:param(),connect(target){return target;},disconnect(){}}),createBufferSource:()=>{const v={connect(target){return target;},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();},disconnect(){}};voices.push(v);return v;},decodeAudioData:async data=>({duration:20,data})};const pending=[];const director=createAudioDirector({settings,createContext:()=>ctx,fetchAudio:(url,options)=>{loads.push(url);return new Promise(resolve=>pending.push({url,signal:options.signal,resolve:()=>resolve({ok:true,arrayBuffer:async()=>url})}));},report:r=>reports.push(r)});return {voices,loads,reports,settings,ctx,pending,director};}

test('audio preferences persist without changing saved volume when muted and tolerate unavailable storage',()=>{
 const s=storage(),settings=createAudioSettings(s);settings.set({master:.4,music:.2,muted:true});assert.equal(createAudioSettings(s).get().master,.4);settings.set({muted:false});assert.equal(settings.get().music,.2);assert.equal(settings.get().master,.4);s.setItem(audioSettingsKey,'broken');assert.deepEqual(createAudioSettings(s).get(),audioDefaults);assert.doesNotThrow(()=>createAudioSettings({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}).set({master:.3}));
});
test('soundtrack routing distinguishes the emperor encounter from the palace and ordinary battles',()=>{
 for(const biome of ['garden','forge','ice','crypt','ruins','court'])for(const stage of ['exploring','floor-shop','secret-shop','shop','battle','deployment'])assert.equal(soundtrackFor({biome,stage}),biome);
 assert.equal(soundtrackFor({biome:'court',emperor:true,stage:'deployment'}),'emperor');assert.equal(soundtrackFor({biome:'court',emperor:true,stage:'battle'}),'emperor');assert.equal(soundtrackFor({biome:'court',emperor:true,stage:'results'}),'court');
});
test('music waits for interaction, keeps one seamless source across same-location renders, pauses without restarting',async()=>{
 const h=harness();h.director.scene('garden');assert.equal(h.loads.length,0);const unlock=h.director.unlock();await settle();h.pending[0].resolve();await unlock;assert.equal(h.voices.length,1);assert.equal(h.voices[0].loop,true);assert.equal(h.voices[0].loopEnd,20);
 for(let i=0;i<20;i++)h.director.scene('garden');assert.equal(h.loads.length,1);await h.director.visibility(true);assert.equal(h.ctx.state,'suspended');await h.director.visibility(false);assert.equal(h.ctx.state,'running');assert.equal(h.voices.length,1);h.director.dispose();assert.equal(h.ctx.state,'closed');
});
test('a stale scene load cannot replace the current soundtrack after returning to its location',async()=>{
 const h=harness();h.director.scene('garden');const unlock=h.director.unlock();await settle();h.pending[0].resolve();await unlock;
 h.director.scene('forge');assert.equal(h.pending[1].signal.aborted,false);h.director.scene('garden');assert.equal(h.pending[1].signal.aborted,true);h.pending[1].resolve();await settle();assert.equal(h.voices.length,1);assert.equal(h.reports.at(-1).track,'garden');h.director.dispose();
});
test('emperor changes use a quick attack, music volume respects mute, retiring voices are released',async()=>{
 const h=harness();h.director.scene('court');const unlock=h.director.unlock();await settle();h.pending[0].resolve();await unlock;h.director.scene('emperor');h.pending[1].resolve();await settle();assert.equal(h.voices.length,2);assert.equal(h.voices[0].stopped,true);assert.equal(h.voices[1].loop,true);h.settings.set({muted:true});assert.equal(h.reports.at(-1).track,'emperor');h.director.dispose();assert.equal(h.voices[1].buffer,null);
});
test('each soundtrack ships as local Ogg with provenance and an explicit open license',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/audio/manifest.json',import.meta.url),'utf8'));assert.equal(manifest.length,7);for(const [id,t] of Object.entries(soundtrack)){const bytes=await readFile(new URL('../public/audio/'+t.file,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'OggS');const m=manifest.find(m=>m.id===id);assert.match(m.source,/^https:\/\/(opengameart.org|lasonotheque.org)\//);assert.match(m.license,/^(CC0|CC-BY)/);assert.ok(m.duration>20&&m.duration<150);}
});

test('decoded loop seam matches without inserting silence or altering the middle',async()=>{
 const {smoothLoopEdges}=await import('../src/audio/loop.js');const channels=[Float32Array.from({length:3200},(_,i)=>.2+Math.sin(i/9)*.1),Float32Array.from({length:3200},(_,i)=>.1+Math.sin(i/7)*.2)];const before=channels.map(c=>c.slice());smoothLoopEdges({length:3200,sampleRate:32000,numberOfChannels:2,getChannelData:i=>channels[i]});
 for(let i=0;i<2;i++){assert.ok(Math.abs(channels[i][0]-channels[i].at(-1))<1e-6);assert.notEqual(channels[i][0],0);assert.deepEqual(channels[i].slice(192,-192),before[i].slice(192,-192));assert.ok(channels[i].every(Number.isFinite));}
});
