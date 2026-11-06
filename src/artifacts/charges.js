import {artifacts} from './catalog.js';

export const CHARGE_VERSION=3;
export const rechargeScope=a=>a.recharge??(a.perRun?'run':a.perAct?'act':a.perFloor?'floor':a.context==='shop'?'shop':a.charges?'battle':null);
export const rechargeLabel=a=>({battle:'на бой',floor:'на этаж',act:'на акт',run:'на забег',boss:'на выбор босса',shop:'на посещение магазина'})[rechargeScope(a)]??'Без зарядов';
export const rechargeHint=a=>({battle:'Восстановление: следующий бой.',floor:'Восстановление: следующий этаж.',act:'Восстановление: следующий акт.',run:'В этом забеге не восстанавливается.',boss:'Новый заряд для награды следующего босса.',shop:'Восстановление: следующий магазин.'})[rechargeScope(a)]??'Постоянное действие.';
export const actionLabel=a=>a.spendsTurn?'Занимает ход':a.kind==='passive'?'Действует само':a.context?'Вне боя':'Без траты хода';
export const chargeBudgetLabel=a=>{const n=a.charges,last=n%10,teen=n%100>=11&&n%100<=14;return n?`${n} ${!teen&&last===1?'заряд':!teen&&last>=2&&last<=4?'заряда':'зарядов'} ${rechargeLabel(a)}`:'Без зарядов';};
export function refillsOn(a,event){
 const scope=rechargeScope(a);if(!scope)return false;
 if(event==='run'||scope===event)return true;
 const level={battle:1,floor:2,act:3,run:4};return !!level[scope]&&!!level[event]&&level[event]>level[scope];
}

/** One source of truth for map, preparation and future battle budgets. */
export function artifactUses(run){
 const used={};
 for(const a of artifacts){
  const scope=rechargeScope(a);
  if(scope==='floor'||scope==='boss')used[a.id]=run.artifactFloor?.used?.[a.id]??0;
  else if(scope==='act')used[a.id]=run.artifactAct?.act===run.act?run.artifactAct.used?.[a.id]??0:0;
  else if(scope==='run')used[a.id]=run.artifactRun?.[a.id]??0;
  else if(scope==='shop')used[a.id]=run.shop?.rerolls??0;
 }
 return used;
}
export function presetArtifactUses(preset){
 const used={};
 for(const a of artifacts){
  const scope=rechargeScope(a);let n=0;
  if(scope==='floor'||scope==='boss')n=preset.floorUses?.[a.id]??0;
  if(scope==='act')n=preset.actUses?.[a.id]??(preset.chargeVersion?0:preset.floorUses?.[a.id]??0);
  if(scope==='run')n=preset.runUses?.[a.id]??0;
  if(n)used[a.id]=n;
 }
 return used;
}
export function ensureActCharges(run){if(run.artifactAct?.act!==run.act)run.artifactAct={act:run.act,used:{}};}
export function migrateArtifactCharges(run){
 ensureActCharges(run);
 if(run.chargeVersion===CHARGE_VERSION)return;
 // Retain known spends, but never invent uses from earlier unrecorded battles.
 const active=run.active?.artifactRuntime?.used??{};
 run.artifactFloor.used??={};
 for(const id of ['hourglass','oracle','mirror'])if(active[id])run.artifactFloor.used[id]=Math.max(run.artifactFloor.used[id]??0,active[id]);
 if(active.banner)run.artifactFloor.used.banner=Math.max(run.artifactFloor.used.banner??0,active.banner);
 if(active.silence)run.artifactAct.used.silence=Math.max(run.artifactAct.used.silence??0,active.silence);
 const hex=Math.max(run.artifactFloor.used.hex??0,active.hex??0);if(hex)run.artifactAct.used.hex=Math.max(run.artifactAct.used.hex??0,hex);
 run.chargeVersion=CHARGE_VERSION;
}
export function resetArtifactCharges(run){
 ensureActCharges(run);run.artifactAct.used={};run.artifactRun={};
 run.artifactFloor.used={};run.artifactFloor.sealUsed=false;
}
