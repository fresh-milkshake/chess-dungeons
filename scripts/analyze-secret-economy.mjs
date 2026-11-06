import { mkdir } from 'node:fs/promises';
import {Run} from '../src/dungeon/run.js';
import {describeArmy,encounterReward} from '../src/dungeon/encounters.js';
import {merchantPlan} from '../src/dungeon/merchant-plan.js';
import {secretOffers,upgradePrice} from '../src/dungeon/merchants.js';
import {floorsInAct} from '../src/dungeon/campaign.js';
import {writeFile} from 'node:fs/promises';
const stages=[{act:3,floor:2},{act:3,floor:3},{act:4,floor:1}],count=Number(process.argv[2]??200),results=[];
const stats=xs=>{const sorted=[...xs].sort((a,b)=>a-b);return {min:sorted[0],median:sorted[Math.floor(xs.length/2)],mean:+(xs.reduce((s,n)=>s+n,0)/xs.length).toFixed(2),p90:sorted[Math.floor(xs.length*.9)],max:sorted.at(-1)};};
for(const stage of stages){const totals=[],offers=[],baskets=[];
 for(let i=1;i<=count;i++){
  const r=new Run(Math.imul(i,2654435761)>>>0);r.merchantPlan={...merchantPlan(r.seed),secret:stage};let money=0;
  for(let act=1;act<=stage.act;act++)for(let floor=1;floor<=(act===stage.act?stage.floor:floorsInAct(act));floor++){
   r.act=act;r.floor=floor;r.setupFloor();const target=act===stage.act&&floor===stage.floor;
   // Kill wild actors once; reliquary wild guards cannot pay for the same actors twice.
   for(const enemy of r.enemies.filter(e=>!target||!e.guard)){
    const army=enemy.wildGuardIds?[]:describeArmy(enemy,r),moves=army.map(p=>({color:'w',captured:p.type}));money+=encounterReward(enemy,act,moves);
   }
   // An explicit upper bound: all three finds can potentially offer their maximum material.
   money+=r.loot.length*([7,8,9,10][act-1]);
  }
  const stock=secretOffers(r),legend=stock.filter(o=>o.kind==='artifact'&&o.price).sort((a,b)=>a.price-b.price)[0];totals.push(money);
  const stone=stock.find(o=>o.id==='stone-n'),rook=stock.find(o=>o.id==='ordinary-rook');baskets.push(stone.price+(legend?.price??0)+rook.price+upgradePrice({type:'q',material:'ordinary'},stage.act,stage.floor));offers.push({stoneKnight:stone.price,stoneRook:stock.find(o=>o.id==='stone-r').price,legendMin:legend?.price,ordinaryRook:rook.price,queenEmpower:upgradePrice({type:'q',material:'ordinary'},stage.act,stage.floor)});
 }
 results.push({...stage,resourceUpperBound:stats(totals),fourPurchaseBasket:stats(baskets),examplePrices:offers[0]});
}
const report={samplesPerStage:count,assumptions:'Upper-bound material ledger, not win rate. Every finite original enemy defeated, including all optional guards; every enemy piece captured by white, wild actors counted once; maximum material option at all three finds; no spending in previous shops, no renewable hunters, no debug or duplication. Current floor exit guardian excluded because defeating it leaves the floor. Secret guard/elite income included before shopping. This upper bound is not a guaranteed attainable budget in a real run. Four-purchase basket: stone knight + cheapest offered legendary + ordinary rook + five-battle queen empowerment. Slot trades are an independent cost. Prices depend on stage, never wallet.',results};
await mkdir('outputs', { recursive: true });
await writeFile('outputs/secret-economy-analysis.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
