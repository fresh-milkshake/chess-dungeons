import {artifactById} from '../artifacts/catalog.js';
import {artifactUses,rechargeScope} from '../artifacts/charges.js';
import {key,randomSource} from './map.js';
export function rechargeCandidates(run){
 const used=artifactUses(run);
 return (run.artifacts??[]).filter(id=>(artifactById(id)?.charges??0)>0&&(used[id]??0)>0).sort((a,b)=>Number(rechargeScope(artifactById(b))==='floor')-Number(rechargeScope(artifactById(a))==='floor'));
}
export function restoreOneCharge(run,id){
 if(!rechargeCandidates(run).includes(id))return false;
 const scope=rechargeScope(artifactById(id));
 const uses=scope==='run'?run.artifactRun:scope==='act'?run.artifactAct.used:scope==='shop'?null:run.artifactFloor.used;
 if(scope==='shop')run.shop.rerolls--;else uses[id]--;return true;
}
export const exitDiscovered=run=>!!run.exitRevealed||run.seen.includes(key(run.map.exit.x,run.map.exit.y));
export function scoutPatch(run,salt=0){
 const seen=new Set(run.seen),map=run.map,candidates=[];
 for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(map.tiles[y*map.width+x]===1&&!seen.has(key(x,y)))candidates.push({x,y});
 if(!candidates.length)return [];
 const rng=randomSource(run.seed^run.act*7841^run.floor*7937^salt),center=candidates[Math.floor(rng()*candidates.length)],patch=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=center.x+dx,y=center.y+dy;if(x>=0&&x<map.width&&y>=0&&y<map.height&&dx*dx+dy*dy<=6)patch.push(key(x,y));}
 return patch;
}
export function scoutingChoices(run,salt){
 return [...(scoutPatch(run,salt).length?[{kind:'scout',title:'След разведчика',detail:'Открыть небольшой неизведанный участок этого этажа.'}]:[]),...(!exitDiscovered(run)?[{kind:'exit',title:'Путь к выходу',detail:'Увидеть призрачный контур выхода. Окружающие клетки и путь останутся скрыты.'}]:[]),...(rechargeCandidates(run).length?[{kind:'recharge',title:'Остаточный заряд',detail:'Восстановить один потраченный заряд принадлежащей реликвии. Реликвию выбираете вы.'}]:[])];
}
