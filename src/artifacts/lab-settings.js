import {rechargeScope} from './charges.js';

export const chargeScopes=['battle','floor','act','run','boss','shop'];
export const chargeSettingsKey='chess-dungeons:lab:artifact-charges:v1';
const baseSettings=a=>({charges:a.charges??null,recharge:a.charges?rechargeScope(a):null});
export function normalizeChargeSettings(value){
 if(!value||typeof value!=='object')return null;
 if(value.charges===null&&value.recharge===null)return {charges:null,recharge:null};
 if(!Number.isInteger(value.charges)||value.charges<1||value.charges>99||!chargeScopes.includes(value.recharge))return null;
 return {charges:value.charges,recharge:value.recharge};
}
export function readChargeDrafts(raw,catalog){
 try{const data=JSON.parse(raw),drafts={};if(!data||typeof data!=='object')return drafts;
  for(const a of catalog){const value=normalizeChargeSettings(data[a.id]);if(value)drafts[a.id]=value;}
  return drafts;
 }catch{return {};}
}
export function configuredArtifact(a,drafts){
 const settings=normalizeChargeSettings(drafts[a.id]);
 if(!settings)return a;
 return {...a,charges:settings.charges??undefined,recharge:settings.recharge??undefined,perRun:false,perAct:false,perFloor:false};
}
export function chargeChanges(catalog,drafts){
 return catalog.flatMap(a=>{const value=normalizeChargeSettings(drafts[a.id]);if(!value)return [];
  const base=baseSettings(a),changes={};for(const key of ['charges','recharge'])if(value[key]!==base[key])changes[key]=value[key];
  return Object.keys(changes).length?[{id:a.id,name:a.name,...changes}]:[];
 });
}
export const chargeChangesText=(catalog,drafts)=>JSON.stringify(chargeChanges(catalog,drafts),null,2);
