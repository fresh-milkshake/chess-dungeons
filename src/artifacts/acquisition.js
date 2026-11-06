import {randomSource,key,walkable} from '../dungeon/map.js';
import {artifacts,artifactById} from './catalog.js';
import {actTwoBalance} from '../dungeon/act-two-balance.js';
import {campaignActs,floorsInAct} from '../dungeon/campaign.js';
import {artifactPrice,sellableArtifact} from '../dungeon/economy.js';
import {sourceAllowed,rarityOf} from './rarity.js';

export function artifactPlan(seed){
 const random=randomSource(Math.imul(seed^0x691ac35,2654435761)),pool=artifacts.map(a=>a.id);
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const sites=campaignActs.map(({act})=>({act,floor:1+Math.floor(random()*floorsInAct(act)),present:act===1||random()<(act===2?.65:.8)}));
 for(const site of sites)if(site.present){const legendary=random()<[.05,.10,.25,.4][site.act-1],eligible=pool.filter(id=>sourceAllowed(id,'exploration')),preferred=eligible.filter(id=>(rarityOf(id)==='legendary')===legendary),id=(preferred.length?preferred:eligible)[0];site.artifactId=pool.splice(pool.indexOf(id),1)[0];}
 const shops=[1,2,3].map(act=>{const picked=[];while(picked.length<3){const index=pool.findIndex(id=>sourceAllowed(id,'shop')&&sellableArtifact(id,act));if(index<0)break;picked.push(pool.splice(index,1)[0]);}return {act,artifacts:picked};});
 return {version:3,sites,shops};
}
export function upgradeArtifactPlan(run){
 const plan=run.artifactPlan;if(!plan||plan.version>=3)return;
 if(plan.version===2){const fresh=artifactPlan(run.seed);for(const shop of plan.shops)if(shop.act>=run.act&&!(run.stage==='shop'&&shop.act===run.act))shop.artifacts=fresh.shops.find(s=>s.act===shop.act)?.artifacts??shop.artifacts;for(const site of plan.sites)if(site.act>run.act||site.act===run.act&&site.floor>run.floor)site.artifactId=fresh.sites.find(s=>s.act===site.act)?.artifactId??site.artifactId;plan.version=3;return;}
 const used=new Set([...run.artifacts,...plan.sites.map(s=>s.artifactId),...plan.shops.flatMap(s=>s.artifacts)]);
 const fresh=artifactPlan(run.seed),pool=[...fresh.shops.flatMap(s=>s.artifacts),...fresh.sites.map(s=>s.artifactId)].filter(id=>id&&!used.has(id));
 if(!plan.shops.some(s=>s.act===3))plan.shops.push({act:3,artifacts:[...new Set(pool)].slice(0,3)});
 plan.version=3;
}
export function artifactOffers(run){
 const plan=run.artifactPlan??artifactPlan(run.seed);
 const reserved=new Set([...plan.sites.map(s=>s.artifactId),...plan.shops.flatMap(s=>s.artifacts),...(run.artifacts??[])]);
 const replacements=artifacts.filter(a=>!reserved.has(a.id)&&sourceAllowed(a.id,'shop')&&sellableArtifact(a.id,run.act)).map(a=>a.id);
 const planned=(plan.shops.find(s=>s.act===run.act)?.artifacts??[]).map(id=>sourceAllowed(id,'shop')&&sellableArtifact(id,run.act)?id:replacements.shift()).filter(Boolean);
 return planned.filter(id=>!run.artifacts?.includes(id)).map((artifactId,i)=>({id:`artifact-shop-${run.act}-${artifactId}`,kind:'artifact',artifactId,price:artifactPrice(artifactById(artifactId),run.act),x:4+i*3,y:2,sold:false}));
}
export function addReliquary(run){
 const site=run.artifactPlan?.sites.find(s=>s.act===run.act&&s.floor===run.floor&&s.present);
 if(!site)return;
 const occupied=new Set([run.player,run.map.exit,...run.enemies,...run.loot].map(p=>key(p.x,p.y))),spots=[];
 for(let y=1;y<run.map.height-1;y++)for(let x=1;x<run.map.width-1;x++)if(walkable(run.map,x,y)&&!occupied.has(key(x,y))){const d=Math.max(Math.abs(x-run.player.x),Math.abs(y-run.player.y));if(d>=4)spots.push({x,y,d});}
 if(!spots.length)throw Error('Не удалось разместить реликварий на доступном полу.');
 spots.sort((a,b)=>b.d-a.d);const random=randomSource(run.seed^run.act*7919),spot=spots[Math.floor(random()*Math.max(1,Math.ceil(spots.length/2)))];
 const army=run.act===1?(random()<.5?['n','n','n']:['p','p','p','p','p']):run.act===2?['n','n','b','p']:['r','b','n','p','p'];
 let wildGuardIds;
 if(run.act>=2&&random()<(run.act===2?actTwoBalance.reliquaryWild[Math.max(0,Math.min(1,run.floor-1))]:.45)){
  const wild=run.enemies.filter(e=>e.wild);
  while(wild.length<2){const pos=spots.find(p=>!run.enemies.some(e=>e.x===p.x&&e.y===p.y)&&!(p.x===spot.x&&p.y===spot.y));if(!pos)break;const e={id:`relic-wild-${run.act}-${wild.length}`,x:pos.x,y:pos.y,type:['n','b','r','q'][Math.floor(random()*4)],wild:true,roaming:true,hp:2,damage:2,patrol:0};run.enemies.push(e);wild.push(e);}
  wildGuardIds=wild.slice(0,2).map(e=>e.id);
 }
 run.enemies.push({id:`reliquary-${run.act}`,x:spot.x,y:spot.y,type:army[0],army:wildGuardIds?[]:army,wildGuardIds,artifactId:site.artifactId,reliquary:true,kingless:true,armor:!wildGuardIds?(run.act>=3?[{index:0,material:'stone'},{index:1,material:'stone'}]:run.act===2?[{index:0,material:'stone'}]:[]):[],formationStyle:'forward'});
}
