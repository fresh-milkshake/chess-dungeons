import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScope} from '../src/app/scope.js';
import {routeFor,campaignRoute} from '../src/app/routes.js';
import {DungeonEngine} from '../src/lab/client.js';

test('paused screens stop receiving input; resume does not duplicate listeners; dispose is final',()=>{
 const target=new EventTarget(),scope=createScope();let hits=0,stops=0,cleanups=0;
 scope.on(target,'move',()=>hits++);scope.onPause(()=>{stops++;target.dispatchEvent(new Event('move'));});scope.cleanup(()=>cleanups++);
 target.dispatchEvent(new Event('move'));scope.pause();target.dispatchEvent(new Event('move'));assert.equal(hits,1);
 scope.resume();target.dispatchEvent(new Event('move'));assert.equal(hits,2);
 scope.dispose();scope.dispose();scope.resume();target.dispatchEvent(new Event('move'));
 assert.equal(hits,2);assert.equal(stops,2);assert.equal(cleanups,1);assert.equal(scope.disposed,true);
});
test('game routes retain a project base and saved campaign state resolves stale browser history',()=>{
 const route=path=>routeFor(new URL(path,'http://localhost/chess-dungeons/dungeon.html'));
 assert.equal(route('lab.html').kind,null);assert.equal(route('battle.html').kind,'battle');
 const run={id:'run-1',stage:'encounter'};
 assert.equal(campaignRoute(route('dungeon.html'),run).url.pathname,'/chess-dungeons/deployment.html');
 assert.equal(campaignRoute(route('dungeon.html?stay=1'),run).kind,'map');
 assert.equal(campaignRoute(route('dungeon.html'),run,{historyReturn:true}).kind,'map');
 assert.equal(campaignRoute(route('battle.html?run=run-1'),run).kind,'deployment');
 run.stage='battle';assert.equal(campaignRoute(route('deployment.html?run=run-1'),run).kind,'battle');
 run.stage='exploring';assert.equal(campaignRoute(route('battle.html?run=run-1'),run).kind,'map');
 assert.equal(campaignRoute(route('battle.html'),run).kind,'battle');
 assert.equal(campaignRoute(route('deployment.html?run=wrong'),run).kind,'map');
});
test('shared engine commands cannot interleave, and a rejected request does not block later commands',async()=>{
 const engine=Object.create(DungeonEngine.prototype),calls=[];let finish;
 engine.queue=Promise.resolve();engine.rules={request:command=>{calls.push(command);if(command==='search')return new Promise(resolve=>finish=resolve);if(command==='bad')throw Error('invalid');return command;}};
 const first=engine.request('search'),next=engine.request('load');await Promise.resolve();assert.deepEqual(calls,['search']);
 finish('bestmove');assert.equal(await first,'bestmove');assert.equal(await next,'load');
 const bad=engine.request('bad'),after=engine.request('state');await assert.rejects(bad,/invalid/);assert.equal(await after,'state');
 assert.deepEqual(calls,['search','load','bad','state']);
});
