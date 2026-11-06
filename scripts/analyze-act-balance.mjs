import { mkdir } from 'node:fs/promises';
import {ACTS,floorsInAct} from '../src/dungeon/campaign.js';
import {writeFile} from 'node:fs/promises';
import {Run} from '../src/dungeon/run.js';
import {describeArmy,aiProfile,encounterReward} from '../src/dungeon/encounters.js';
import {values} from '../src/dungeon/balance.js';
import {wildChances} from '../src/dungeon/wild.js';

const samples=Number(process.argv[3]??200);
const stats=a=>({min:Math.min(...a),mean:+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(3),max:Math.max(...a)});
// A transparent resource-pressure proxy, NOT an engine evaluation or Elo:
// each extra hit costs tempo, but does not double a piece's chess value.
function pressure(p){const hp=p.hp??(p.material==='diamond'?3:p.material==='stone'?2:1);return (values[p.type]??0)*(1+.65*(hp-1))*(p.damage===2?1.3:1);}
const results=[];
for(let act=1;act<=ACTS;act++){
 const floors=[];
 for(let floor=1;floor<=floorsInAct(act);floor++){
  const groups={},wild=[],pairs=[];
  for(let i=1;i<=samples;i++){
   const run=new Run(Math.imul(i,2654435761)>>>0,act);run.floor=floor;run.setupFloor();
   const beasts=run.enemies.filter(e=>e.wild);wild.push(beasts.length);pairs.push(Number(beasts.length>=2));
   for(const enemy of run.enemies.filter(e=>!e.wild&&!e.weak)){
    const role=enemy.boss?'boss':enemy.reliquary?'reliquary':enemy.special?'special':enemy.guard?'guard':enemy.roaming?'hunter':'sentry';
    const army=describeArmy(enemy,run),g=groups[role]??={count:[],material:[],pressure:[],reward:[]};
    g.count.push(army.length);g.material.push(army.reduce((s,p)=>s+(values[p.type]??0),0));g.pressure.push(army.reduce((s,p)=>s+pressure(p),0));g.reward.push(encounterReward(enemy,act));
   }
  }
  floors.push({floor,roles:Object.fromEntries(Object.entries(groups).map(([role,g])=>[role,Object.fromEntries(Object.entries(g).map(([k,a])=>[k,stats(a)]))])),wildActors:stats(wild),floorsWithWildPair:stats(pairs).mean,normalWildChances:wildChances(act,floor)});
 }
 results.push({act,ai:aiProfile(act),floors});
}

const economy=[];
for(const optional of [false,true]){
 const checkpoints=Array.from({length:ACTS},()=>[]),income=Array.from({length:ACTS},()=>[]),bossSquad=Array.from({length:ACTS},()=>[]);
 for(let i=1;i<=samples;i++){
  const run=new Run(Math.imul(i,2654435761)>>>0);
  const win=enemy=>{
   const army=describeArmy(enemy,run);
   run.openEncounter(enemy);run.beginBattle(['queen','knight']);
   // Deterministic half-capture ledger: every other figure; assumes victory.
   const moves=army.filter((_,index)=>index%2===0).map(p=>({color:'w',captured:p.type,hit:false}));
   run.finishBattle('win',new Set(run.inventory.map(p=>p.id)),moves);
  };
  for(let act=1;act<=ACTS;act++){
   const start=run.material;checkpoints[act-1].push(run.material);
   for(let floor=1;floor<=floorsInAct(act);floor++){
    // Count finds and optional fights on the boss's explored floor as well.
    for(const loot of run.loot.slice(0,2)){run.turns+=2;run.material+=run.rewardOptions(loot).find(o=>o.kind==='material')?.amount??0;}
    if(optional)win(run.enemies.find(e=>e.special));
    if(floor===floorsInAct(act))bossSquad[act-1].push(run.inventory.reduce((s,p)=>s+pressure(p),0));
    win(run.enemies.find(e=>e.guard));
   }
   income[act-1].push(run.material-start);
   run.chooseBossReward(0);
   if(act===ACTS)break;
   // Buy at most one ordinary upgrade; leave money for relics.
   const offer=run.shop.items.filter(p=>p.material==='ordinary'&&!run.inventory.some(q=>q.material==='ordinary'&&q.type===p.type)).sort((a,b)=>a.price-b.price).find(p=>p.price<=run.material);
   if(offer){run.player={x:offer.x,y:offer.y};run.buyShop(offer.id);}
   run.player={x:run.map.exit.x-1,y:run.map.exit.y};run.step(1,0);
  }
 }
 economy.push({route:optional?'guards + unusual encounters':'guards only',acts:[1,2,3,4].map((act,i)=>({act,entryMoney:stats(checkpoints[i]),income:stats(income[i]),permanentSquadBeforeBoss:stats(bossSquad[i])}))});
}
const report={samples,assumptions:'Widely spaced seeds per act/floor. Pressure is material × (1 + .65 per extra HP) × 1.3 for empowerment; no positional evaluation or win-rate claim. Wild counts include actors created by reliquaries. Economy assumes victories, no permanent losses, alternate captures, two money ruins/floor, first stone boss choice and at most one missing ordinary purchase/shop. No wild/hunter income, relic purchase or compensation farming.',results,economy};
const file=process.argv[2]??'outputs/act-balance-analysis.json';await mkdir('outputs', { recursive: true });
await writeFile(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file,acts:results.map(r=>({act:r.act,guard:r.floors.slice(0,2).map(f=>f.roles.guard?.pressure.mean),special:r.floors.slice(0,2).map(f=>f.roles.special.pressure.mean),boss:r.floors.at(-1).roles.boss.pressure,wild:r.floors.slice(0,2).map(f=>({mean:f.wildActors.mean,pair:f.floorsWithWildPair}))})),economy},null,2));
