import {randomSource} from './map.js';
import {stoneRole} from './stone-rewards.js';
import {owns,artifacts} from '../artifacts/catalog.js';
import {sourceAllowed,bossPreferred} from '../artifacts/rarity.js';
import {artifactOffers} from '../artifacts/acquisition.js';
import {actTwoBalance} from './act-two-balance.js';
import {completionMaterial,piecePrice} from './economy.js';

export {ACTS,FLOORS} from './campaign.js';
export const values={p:1,n:3,b:3,r:5,q:9,d:7,j:2.8,k:0};
export const caps={ordinary:20,stone:3,glass:10,ethereal:5};
export const names={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь'};
export function canReceive(run,material){return run.inventory.filter(p=>p.type!=='k'&&p.material===material).length<(caps[material]??0);}
export const victoryMaterial=(enemy,act=1)=>completionMaterial(enemy,act);
// Captures pay once, at victory. Armor hits, enemy captures and undo never pay.
export function captureMaterial(moves){return moves.reduce((sum,m)=>sum+(m.color==='w'&&!m.hit?(values[m.captured]??0):0),0);}
export function bossOptions(run){
 let offers=run.act===1?[['p','stone'],['n','ordinary'],['b','ordinary']]:run.act===2?[[stoneRole(run,['n','b'],71),'stone'],['r','ordinary'],['q','glass']]:[['r','stone'],['q','ordinary'],['q','glass']];
 if(owns(run,'facet'))offers.push(['r','ethereal']);
 if(run.artifactFloor?.used?.['boss-die']){
  const old=new Set(offers.map(p=>p.join(':'))),random=randomSource(run.seed^run.act*15485863);
  const pool=[['n','glass'],['b','glass'],['r','glass'],['n','ethereal'],['b','ethereal'],['r','ethereal'],['p','stone'],...(run.act>=2?[['n','stone'],['b','stone'],['q','ordinary'],['q','glass']]:[]),...(run.act>=3?[['r','stone']]:[])].filter(p=>!old.has(p.join(':')));
  const stone=offers[0],others=pool.filter(p=>p[1]!=='stone');offers=[stone,...Array.from({length:offers.length-1},()=>others.splice(Math.floor(random()*others.length),1)[0])];
 }
 const choices=offers.map(([type,material])=>{
  return {kind:'piece',type,material,title:`${names[type]} · ${({stone:'камень',ordinary:'обычная',glass:'стекло',ethereal:'эфир'})[material]}`,detail:material==='glass'?'1 HP. При взятии теряется навсегда.':material==='ethereal'?'Одно использование в бою.':material==='stone'?'2 HP. Защита восстанавливается перед следующим боем. При лимите — компенсация материалом.':'Постоянная фигура. При лимите — компенсация материалом.'};
 });
 const available=artifacts.filter(a=>sourceAllowed(a.id,'boss')&&!run.artifacts?.includes(a.id)),preferred=available.filter(a=>bossPreferred(a.id)),pool=preferred.length?preferred:available;
 if(pool.length){const random=randomSource(run.seed^run.act*73867),initial=Math.floor(random()*pool.length),index=run.artifactFloor?.used?.['boss-die']&&pool.length>1?(initial+1+Math.floor(random()*(pool.length-1)))%pool.length:initial,a=pool[index];choices[2]={kind:'artifact',artifactId:a.id,title:a.name,detail:a.description};}
 return choices;
}
export function bossArmy(act){return [
 ['r','b','n','p','p','p','p'],
 [...actTwoBalance.boss],
 ['q','r','r','b','b','n','n','p','p','p','p','p','p'],
 ['q','r','r','b','b','n','n','p','p','p','p','p','p','p','p'],
 ][act-1];}
export function bossArmor(act,seed){
 const army=bossArmy(act),pawn=army.indexOf('p');
 if(act===1)return [{index:pawn,material:'stone'}];
 if(act===2){
  const random=randomSource(Math.imul(seed^0x71af35d,2654435761));
  return random()<.3?[{index:pawn,material:'diamond'}]:[{index:Math.floor(random()*pawn),material:'stone'},{index:pawn,material:'stone'}];
 }
 if(act===3)return [{index:pawn,material:'diamond'},...[1,3].map(index=>({index,material:'stone'}))];
 return [{index:0,material:'diamond'},{index:pawn,material:'diamond'},...[1,3,5].map(index=>({index,material:'stone'}))];
}

/** Eight fixed offers: ordinary pieces and temporary glass/ethereal pieces. */
export function makeShop(run){
 const random=randomSource(Math.imul(run.seed^(run.act*104729),2654435761));
 const offers=[
  ['n','ordinary'],['b','ordinary'],['r','ordinary'],['r','glass'],
  [random()<.5?'n':'b','glass'],['r','ethereal'],['q','glass'],
  run.act>=3?['q','ethereal']:['p','ordinary'],
 ];
 return {act:run.act,items:[...offers.map(([type,material],i)=>({id:`shop-${run.act}-${i}`,type,material,price:piecePrice(type,material,run.act),x:3+i%4*3,y:i<4?1:5,sold:false})),...artifactOffers(run)]};
}
export function shopMap(){
 return {width:15,height:7,tiles:Array(105).fill(1),rooms:[],start:{x:0,y:3},exit:{x:14,y:3}};
}
