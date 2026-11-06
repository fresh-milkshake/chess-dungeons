/** Rarity and acquisition are independent: secret shops can stock every legendary relic. */
export const rarities={common:{name:'Обычный',color:'#c8cbd0'},uncommon:{name:'Необычный',color:'#74c883'},rare:{name:'Редкий',color:'#6daef4'},epic:{name:'Эпический',color:'#bc82e8'},legendary:{name:'Легендарный',color:'#edb15c'}};
const rareById={eye:'common',bell:'common',mirage:'common',briar:'uncommon',banner:'uncommon',glassward:'uncommon','boss-die':'uncommon','merchant-die':'uncommon',ranks:'rare',mirror:'rare',seal:'rare',hourglass:'epic',oracle:'epic',coldfire:'epic',silence:'rare',facet:'rare',fang:'epic',frost:'legendary',hex:'legendary',dragonhorn:'legendary',lastcrown:'legendary'};
const exploration=new Set(['coldfire','facet','fang','frost','hex','dragonhorn','lastcrown']);
const boss=new Set(['eye','bell','mirage','briar','banner','glassward','ranks','boss-die','merchant-die','mirror','seal']);
export const rarityOf=id=>rareById[id]??'common';
export const rarityInfo=id=>rarities[rarityOf(id)];
export const explorationOnly=id=>exploration.has(id);
export const bossPreferred=id=>boss.has(id);
export function sourceAllowed(id,source){
 if(source==='secret')return rarityOf(id)==='legendary';
 if(source==='exploration')return exploration.has(id);
 if(source==='boss'||source==='shop'||source==='exchange')return !exploration.has(id);
 return false;
}
export const sourceLabel=id=>exploration.has(id)?'Исследование'+(rarityOf(id)==='legendary'?' · секретный магазин':''):'Боссы · магазины';
