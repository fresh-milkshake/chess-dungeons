/** Implemented campaign. Alternate ending is design data only, never a playable route. */
export const CAMPAIGN_VERSION=2;
export const campaignActs=[
 {act:1,roman:'I',floors:3,variants:['garden']},
 {act:2,roman:'II',floors:3,variants:['forge','ice','crypt']},
 {act:3,roman:'III',floors:3,variants:['ruins']},
 {act:4,roman:'IV',floors:1,variants:['court']},
];
export const ACTS=campaignActs.length,FLOORS=3;
export const totalFloors=campaignActs.reduce((sum,act)=>sum+act.floors,0);
export const floorsInAct=act=>campaignActs[act-1]?.floors??0;
export const bossAtExit=(act,floor)=>floorsInAct(act)>0&&floor===floorsInAct(act);
export const isFinalAct=act=>act===ACTS;
export const campaignStage=(act,floor)=>Math.max(0,Math.min(totalFloors-1,campaignActs.slice(0,Math.max(0,act-1)).reduce((sum,a)=>sum+a.floors,0)+floor-1));
export const secretRouteConcept={
 implemented:false,entry:{act:3,kind:'special-door',conditions:'not-designed'},
 replacesNormalFinale:true,acts:[
  {act:4,variants:['Обсерватория','Маскарад','Проклятые залы'],floors:null},
  {act:5,name:'Последний предел',boss:'Истинный финальный босс',floors:null},
 ],
};
