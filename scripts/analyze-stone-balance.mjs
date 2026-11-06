import { mkdir } from 'node:fs/promises';
import {ACTS,floorsInAct} from '../src/dungeon/campaign.js';
import {Run} from '../src/dungeon/run.js';
import {canReceive} from '../src/dungeon/balance.js';
import {stoneTrophy,stoneRole} from '../src/dungeon/stone-rewards.js';
import {writeFile} from 'node:fs/promises';

// A resource ledger assuming victories, not an AI win-rate or difficulty benchmark.
const scenarios=[
 {name:'mandatory-only',optional:false,shopping:false,captureShare:0,ruins:0,stoneChoice:false},
 {name:'boss-stone-focused',optional:false,shopping:true,captureShare:.5,ruins:2,stoneChoice:true},
 {name:'exploration',optional:true,shopping:true,captureShare:.5,ruins:2,stoneChoice:true},
];
const result=[];
for(const scenario of scenarios){
 const counts=[],uniqueRoles=[],beforeFinal=[],roles=new Set(),atFirstBoss=[];let firstActZero=0,automaticCompensations=0;
 for(let seed=1;seed<=Number(process.argv[2]??1000);seed++){
  const run=new Run(seed);const stones=()=>run.inventory.filter(p=>p.material==='stone');
  const win=enemy=>{
   const pending=stoneTrophy(run,enemy);if(pending&&(pending.duplicate||!canReceive(run,'stone')))automaticCompensations++;
   run.openEncounter(enemy);run.beginBattle(run.inventory.filter(p=>p.type!=='k').slice(0,10).map(p=>p.id));
   const army=enemy.army??({p:['p','p'],n:['n','p','p'],b:['b','n','p','p'],r:['r','n','p','p','p'],q:['q','r','b','p','p','p']})[enemy.type]??[];
   const moves=army.slice(0,Math.round(army.length*scenario.captureShare)).map(type=>({color:'w',captured:type,hit:false}));
   run.finishBattle('win',new Set(run.inventory.map(p=>p.id)),moves);
  };
  for(let act=1;act<=ACTS;act++){
   for(let floor=1;floor<floorsInAct(act);floor++){
    run.material+=scenario.ruins*(5+(act-1)*2);
    if(scenario.optional)win(run.enemies.find(e=>e.special));
    win(run.enemies.find(e=>e.guard));
   }
   if(act===1){atFirstBoss.push(stones().length);if(!stones().length)firstActZero++;}
   if(act===ACTS)beforeFinal.push(stones().length);
   win(run.enemies.find(e=>e.boss));
   const choice=scenario.stoneChoice?run.pendingReward.options.findIndex(p=>p.material==='stone'&&p.type===stoneRole(run,run.pendingReward.options.filter(o=>o.material==='stone').map(p=>p.type),101)):2;
   run.chooseBossReward(choice);
   if(act===ACTS)break;
   if(scenario.shopping){
    const offers=run.shop.items.filter(p=>p.material==='stone').sort((a,b)=>Number(stones().some(p=>p.type===a.type))-Number(stones().some(p=>p.type===b.type))||b.price-a.price);
    for(const item of offers){run.player={x:item.x,y:item.y};run.buyShop(item.id);}
   }
   run.player={...run.map.exit,x:run.map.exit.x-1};run.step(1,0);

  }
  counts.push(stones().length);uniqueRoles.push(new Set(stones().map(p=>p.type)).size);stones().forEach(p=>roles.add(p.type));
 }
 const stats=values=>({min:Math.min(...values),mean:Number((values.reduce((s,v)=>s+v,0)/values.length).toFixed(2)),max:Math.max(...values)});
 result.push({scenario:scenario.name,seeds:Number(process.argv[2]??1000),beforeFirstBoss:stats(atFirstBoss),beforeFinalBoss:stats(beforeFinal),end:stats(counts),stoneRoles:[...roles].sort(),zeroBeforeFirstBoss:firstActZero,distinctStoneRolesPerRun:stats(uniqueRoles),automaticCompensations});
}
const report={assumptions:'Victory-only resource ledger; no combat win rate, glass loss or human timing modeled. Mandatory-only picks ordinary boss rewards and skips shops and optional enemies. Other paths take two average material ruins per floor, half the enemy army as captures, choose stone boss rewards and visit shops (which never sell stone). Exploration also defeats the unusual encounter once per floor.',results:result};
await mkdir('outputs', { recursive: true });
await writeFile('outputs/stone-balance-analysis.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
