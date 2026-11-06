import { mkdir, writeFile } from 'node:fs/promises';
import {Run} from '../src/dungeon/run.js';
import {describeArmy} from '../src/dungeon/encounters.js';
import {floorsInAct} from '../src/dungeon/campaign.js';
import {artifactById} from '../src/artifacts/catalog.js';
const samples=Number(process.argv[3]??150),file=process.argv[2]??'outputs/economy-analysis.json';
const scenarios=[
 {name:'minimal',captures:0,moneyFinds:0,pieceFinds:0,optional:0,reliquary:false,consume:false},
 {name:'focused',captures:.4,moneyFinds:1,pieceFinds:1,optional:0,reliquary:true,consume:true},
 {name:'balanced',captures:.5,moneyFinds:1,pieceFinds:1,optional:1,reliquary:true,consume:true},
 {name:'explorer',captures:.65,moneyFinds:2,pieceFinds:1,optional:4,reliquary:true,consume:true},
];
const stats=xs=>({min:Math.min(...xs),p50:[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],mean:+(xs.reduce((s,n)=>s+n,0)/xs.length).toFixed(2),max:Math.max(...xs)});
const reports=[];
for(const policy of scenarios){
 const rows=Array.from({length:4},()=>[]);
 for(let i=1;i<=samples;i++){
  const run=new Run(Math.imul(i,2654435761)>>>0);let actIncome=0;
  const win=enemy=>{
   const army=describeArmy(enemy,run),before=run.material;
   run.openEncounter(enemy);
   const selected=run.inventory.filter(p=>p.type!=='k'&&(p.material==='ordinary'||p.material==='stone'||policy.consume)).slice(0,15).map(p=>p.id);
   const preset=run.beginBattle(selected);
   const moves=army.filter((_,j)=>(j+1)*policy.captures%1<policy.captures).map(p=>({color:'w',captured:p.type,hit:false}));
   const survivors=new Set(preset.deployed.filter(p=>!policy.consume||p.material!=='glass'||(run.seed+run.floor+p.type.charCodeAt(0))%4!==0).map(p=>p.id));
   run.finishBattle('win',survivors,moves);actIncome+=run.material-before;
  };
  for(let act=1;act<=4;act++){
   actIncome=0;const entry=run.material;
   for(let floor=1;floor<=floorsInAct(act);floor++){
    const loot=[...run.loot];
    for(let j=0;j<policy.moneyFinds+policy.pieceFinds;j++){
     const found=loot[j];run.turns+=2;const options=run.rewardOptions(found);run.pendingReward={options};run.stage='reward';
     const moneyChoice=options.findIndex(o=>o.kind==='material');
     const before=run.material;run.chooseReward(j<policy.moneyFinds&&moneyChoice>=0?moneyChoice:0);actIncome+=run.material-before;run.stage='exploring';
    }
    const optional=run.enemies.filter(e=>!e.guard&&!e.wild&&!e.reliquary).sort((a,b)=>Number(!!b.special)-Number(!!a.special));
    for(const enemy of optional.slice(0,policy.optional))if(run.enemies.some(e=>e.id===enemy.id))win(enemy);
    if(policy.reliquary){const relic=run.enemies.find(e=>e.reliquary);if(relic)win(relic);}
    win(run.enemies.find(e=>e.guard));
   }
   run.chooseBossReward(0);
   const row={entry,income:actIncome,beforeShop:run.material,stockCost:act<4?run.shop.items.reduce((sum,p)=>sum+p.price,0):0,spent:0,pieceSpent:0,relicSpent:0,relicsBought:0,permanent:run.inventory.filter(p=>['ordinary','stone'].includes(p.material)).length,temporary:run.inventory.filter(p=>['glass','ethereal'].includes(p.material)).length,ownedRelics:run.artifacts.length};
   if(act<4){
    const purchase=item=>{run.player={x:item.x,y:item.y};if(run.buyShop(item.id)){row.spent+=item.price;if(item.kind==='artifact'){row.relicSpent+=item.price;row.relicsBought++;}else row.pieceSpent+=item.price;}};
    // A restrained shopper: one permanent upgrade, one affordable relic, one glass rook.
    const upgrade=run.shop.items.filter(p=>p.material==='ordinary'&&['n','b','r'].includes(p.type)).sort((a,b)=>run.inventory.filter(p=>p.type===a.type&&p.material==='ordinary').length-run.inventory.filter(p=>p.type===b.type&&p.material==='ordinary').length||a.price-b.price)[0];
    if(upgrade)purchase(upgrade);
    if(policy.name!=='minimal'){
     const relics=run.shop.items.filter(p=>p.kind==='artifact').sort((a,b)=>a.price-b.price);
     if(act===3){for(const relic of relics)if(relic.price<=run.material)purchase(relic);}else{const relic=relics.find(p=>p.price<=run.material-10);if(relic)purchase(relic);}
     const supplies=run.shop.items.filter(p=>['glass','ethereal'].includes(p.material)&&!p.sold&&(act===3||p.type==='r'&&p.material==='glass'));
     for(const temporary of supplies)purchase(temporary);
    }
    row.exit=run.material;rows[act-1].push(row);run.player={x:run.map.exit.x-1,y:run.map.exit.y};run.step(1,0);
   }else{row.exit=run.material;rows[act-1].push(row);}
  }
 }
 reports.push({scenario:policy.name,policy,acts:rows.map((rs,i)=>({act:i+1,...Object.fromEntries(Object.keys(rs[0]).map(key=>[key,stats(rs.map(r=>r[key]))]))}))});
}
const report={samples,assumptions:'Ten actual generated floors, all three floors counted before each boss and one palace floor. Actual reward choices, shops and settlement; synthetic victories, fractional capture ledger, one-third of finds may be skipped. Glass has a deterministic 25% loss proxy and all selected ether is consumed. Ordinary and stone casualties recover under current rules. No win-rate, positional strength or human route reachability claim; no renewable hunter farming or shop rerolls. First two shops: one permanent upgrade, one relic keeping 10 material, one glass rook. Final shop: spend remaining funds on available relics then temporary supplies because no further shops remain. Minimal means zero captures/finds/optional battles and one permanent purchase per shop. Before-report uses the old restrained one-relic policy even in the final shop; gross incomes are comparable, final spending policies are not.',reports};
await mkdir('outputs', { recursive: true });
await writeFile(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file,samples,summary:reports.map(r=>({scenario:r.scenario,acts:r.acts.map(a=>({act:a.act,income:a.income.mean,beforeShop:a.beforeShop.mean,spent:a.spent.mean,exit:a.exit.mean,permanent:a.permanent.mean,temporary:a.temporary.mean,relics:a.ownedRelics.mean,bought:a.relicsBought.mean}))}))},null,2));
