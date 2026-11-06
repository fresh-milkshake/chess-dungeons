/** Economy for three full acts and a one-floor finale. Prices are integer material. */
export const ECONOMY_VERSION=1;
const at=(table,act)=>table[Math.max(0,Math.min(3,act-1))];
export const bossMaterial=[18,26,34,44];
const roleMaterial={guard:[5,8,11,14],special:[6,9,12,15],hunter:[8,11,14,18],patrol:[2,3,4,5],sentry:[3,5,7,9],wild:[6,8,10,12]};
export function completionMaterial(enemy,act){
 if(enemy.rewardless||enemy.reliquary)return 0;
 if(enemy.boss)return at(bossMaterial,act);
 const role=enemy.wild?'wild':enemy.weak?'patrol':enemy.guard?'guard':enemy.special?'special':enemy.roaming?'hunter':'sentry';
 const rank={p:1,n:2,b:3,r:4,q:5,k:6,d:5,j:3}[enemy.type]??1;
 return at(roleMaterial[role],act)+(['hunter','sentry','wild'].includes(role)?Math.floor((rank-1)/2):0);
}
export const paidCaptureMaterial=raw=>Math.floor(raw*.5);
export const findMaterial=(act,random)=>at([4,5,6,7],act)+Math.floor(random()*4);
const ordinary={p:6,n:20,b:20,r:32,q:60},glass={p:3,n:7,b:7,r:11,q:18},ethereal={p:2,n:5,b:5,r:7,q:12};
export const pieceShopPool=[...Object.keys(ordinary).map(type=>[type,'ordinary']),...Object.keys(glass).map(type=>[type,'glass']),...Object.keys(ethereal).map(type=>[type,'ethereal'])];
export function piecePrice(type,material,shopAct){
 const base=({ordinary,glass,ethereal})[material]?.[type];if(base===undefined)throw Error('Этот материал не продаётся.');
 const scale=material==='ordinary'?at([1,1.1,1.15,1.15],shopAct):shopAct>=3?(material==='ethereal'?.75:.82):1;
 return Math.max(1,Math.round(base*scale));
}
export const artifactPrice=(artifact,shopAct)=>artifact.price[Math.max(0,Math.min(2,shopAct-1))]??artifact.price.at(-1);
export const shopRerollCosts=[8,14,22];
export const rewardCompensation=(type,material)=>Math.floor(piecePrice(type,material,1)*.5);
/** No useful boss reward remains after the palace; don't sell its reroll relic before it. */
export const sellableArtifact=(id,shopAct)=>shopAct<3||id!=='boss-die';
