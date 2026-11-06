import test from 'node:test';
import assert from 'node:assert/strict';
import {artifacts} from '../src/artifacts/catalog.js';
import {readChargeDrafts,configuredArtifact,chargeChanges,chargeChangesText} from '../src/artifacts/lab-settings.js';
const hourglass=artifacts.find(a=>a.id==='hourglass');
test('charge draft exports only changed fields and leaves the game catalogue untouched',()=>{
 const drafts={hourglass:{charges:5,recharge:'floor'}};
 assert.deepEqual(chargeChanges(artifacts,drafts),[{id:'hourglass',name:hourglass.name,charges:5}]);
 assert.equal(configuredArtifact(hourglass,drafts).charges,5);assert.equal(hourglass.charges,3);
 drafts.hourglass={charges:3,recharge:'act'};
 assert.deepEqual(JSON.parse(chargeChangesText(artifacts,drafts)),[{id:'hourglass',name:hourglass.name,recharge:'act'}]);
 drafts.hourglass={charges:3,recharge:'floor'};assert.deepEqual(chargeChanges(artifacts,drafts),[]);
});
test('unlimited drafts export explicit removal, and passive relics can receive charges',()=>{
 assert.deepEqual(chargeChanges([hourglass],{hourglass:{charges:null,recharge:null}}),[{id:'hourglass',name:hourglass.name,charges:null,recharge:null}]);
 const passive=artifacts.find(a=>a.id==='ranks');assert.deepEqual(chargeChanges([passive],{ranks:{charges:2,recharge:'run'}}),[{id:'ranks',name:passive.name,charges:2,recharge:'run'}]);
});
test('stored drafts validate known relics, whole quantities and recovery scopes',()=>{
 assert.deepEqual(readChargeDrafts('{broken',artifacts),{});
 for(const charges of [0,-1,1.5,100,'3'])assert.deepEqual(readChargeDrafts(JSON.stringify({hourglass:{charges,recharge:'floor'}}),artifacts),{});
 assert.deepEqual(readChargeDrafts(JSON.stringify({hourglass:{charges:4,recharge:'turn'},unknown:{charges:1,recharge:'run'}}),artifacts),{});
 const saved={hourglass:{charges:4,recharge:'battle'}};assert.deepEqual(readChargeDrafts(JSON.stringify(saved),artifacts),saved);
});
