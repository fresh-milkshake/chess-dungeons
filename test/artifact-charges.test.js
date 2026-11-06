import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/dungeon/run.js';
import {artifacts,artifactById} from '../src/artifacts/catalog.js';
import {artifactUses,presetArtifactUses,rechargeScope,rechargeLabel,resetArtifactCharges,CHARGE_VERSION,refillsOn,actionLabel} from '../src/artifacts/charges.js';
import {syncArtifactUses} from '../src/artifacts/mechanics.js';
import {makeEncounter} from '../src/dungeon/encounters.js';
import {campaignActs} from '../src/dungeon/campaign.js';

const spent=()=>({owned:artifacts.map(a=>a.id),used:Object.fromEntries(artifacts.filter(a=>a.charges).map(a=>[a.id,a.charges])),toggles:{}});
test('every finite artifact defines a valid explicit recovery period',()=>{
 for(const a of artifacts){if(a.charges){assert.ok(['battle','floor','act','run','boss','shop'].includes(a.recharge));assert.notEqual(rechargeLabel(a),'Без зарядов');}else assert.equal(rechargeScope(a),null);}
 assert.equal(artifactById('briar').charges,2);assert.equal(artifactById('hourglass').charges,3);
});
test('same-floor new fight replenishes only battle charges; a new floor retains act and run spends',()=>{
 const r=new Run(72);syncArtifactUses(r,spent());
 const preset=()=>makeEncounter(r,r.enemies.find(e=>e.guard),[]),same=presetArtifactUses(preset());
 for(const id of ['hourglass','oracle','mirror','frost','glassward','banner'])assert.equal(same[id],artifactById(id).charges);
 assert.equal(same.silence,1);
 assert.equal(same.hex,1);assert.equal(same.dragonhorn,1);assert.equal(same.lastcrown,1);
 for(const id of ['briar','seal'])assert.equal(same[id]??0,0);
 r.floor=2;r.setupFloor();const next=presetArtifactUses(preset());
 for(const id of ['hourglass','oracle','mirror','frost','glassward','banner'])assert.equal(next[id]??0,0);
 assert.equal(next.silence,1);
 assert.equal(next.hex,1);assert.equal(next.lastcrown,1);r.act=2;r.floor=1;r.setupFloor();const act=presetArtifactUses(preset());assert.equal(act.hex??0,0);assert.equal(act.lastcrown,1);
 assert.equal(act.silence??0,0);
});
test('ten-floor route grants at most thirty undos, ten oracles and four permanent curses',()=>{
 const r=new Run(891),owned=artifacts.map(a=>a.id),total={hourglass:0,oracle:0,hex:0,mirror:0};r.artifacts=owned;
 for(const {act,floors} of campaignActs)for(let floor=1;floor<=floors;floor++){
  r.act=act;r.floor=floor;r.setupFloor();const used=artifactUses(r);
  for(const id of Object.keys(total))total[id]+=artifactById(id).charges-(used[id]??0);
  syncArtifactUses(r,{owned,used:{...used,hourglass:3,oracle:1,hex:1,mirror:1},toggles:{}});
 }
 assert.deepEqual(total,{hourglass:30,oracle:10,hex:4,mirror:10});
});
test('old saves migrate recorded spends without changing the board or inventing previous uses',()=>{
 const r=new Run(3),old=r.snapshot();delete old.chargeVersion;delete old.artifactAct;
 old.artifactFloor.used={hex:1,briar:1,seal:1};old.active={artifactRuntime:{used:{hourglass:2,oracle:1,mirror:1,hex:1}}};
 const migrated=Run.restore(old);assert.deepEqual(migrated.map,old.map);assert.equal(migrated.chargeVersion,CHARGE_VERSION);
 const u=artifactUses(migrated);assert.equal(u.hourglass,2);assert.equal(u.hex,1);assert.equal(u.oracle,1);assert.equal(u.seal??0,0);assert.equal(u.briar??0,0);
 const loaded=Run.restore(migrated.snapshot());assert.deepEqual(artifactUses(loaded),u);
 const clean=new Run(4).snapshot();delete clean.chargeVersion;delete clean.artifactAct;assert.equal(artifactUses(Run.restore(clean)).hourglass??0,0);
});
test('legacy battle presets read known act spends without carrying the old floor seal budget',()=>{
 assert.deepEqual(presetArtifactUses({floorUses:{hex:1,seal:1,briar:1,frost:1},sealUsed:true}),{hex:1,frost:1});
 assert.equal(presetArtifactUses({chargeVersion:CHARGE_VERSION,floorUses:{hex:1},actUses:{hex:0}}).hex??0,0);
});

test('previous charge version retains recorded banner and silence uses across their new scopes',()=>{
 const old=new Run(93).snapshot();old.chargeVersion=2;
 old.active={artifactRuntime:{used:{banner:1,silence:1}}};
 const loaded=Run.restore(old),used=artifactUses(loaded);
 assert.equal(used.banner,1);assert.equal(used.silence,1);
 loaded.floor=2;loaded.setupFloor();assert.equal(artifactUses(loaded).banner??0,0);assert.equal(artifactUses(loaded).silence,1);
 loaded.act=2;loaded.floor=1;loaded.setupFloor();assert.equal(artifactUses(loaded).silence??0,0);
});
test('debug charge reset clears all persistent periods explicitly',()=>{
 const r=new Run(72);syncArtifactUses(r,spent());resetArtifactCharges(r);
 assert.ok(Object.values(artifactUses(r)).every(n=>n===0));
 const next=makeEncounter(r,r.enemies.find(e=>e.guard),[]);assert.deepEqual(presetArtifactUses(next),{});
});

test('charge demonstration agrees with period boundaries and a rewind spends no turn',()=>{
 assert.equal(refillsOn(artifactById('hourglass'),'battle'),false);assert.equal(refillsOn(artifactById('hourglass'),'floor'),true);
 assert.equal(refillsOn(artifactById('hex'),'floor'),false);assert.equal(refillsOn(artifactById('hex'),'act'),true);
 assert.equal(refillsOn(artifactById('lastcrown'),'act'),false);assert.equal(refillsOn(artifactById('lastcrown'),'run'),true);
 assert.equal(refillsOn(artifactById('briar'),'battle'),true);assert.equal(actionLabel(artifactById('hourglass')),'Без траты хода');
});
