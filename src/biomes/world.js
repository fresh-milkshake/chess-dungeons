export const biomeNames={ruins:'Расколотые палаты',garden:'Растущий сад',forge:'Кузница пешек',ice:'Замерзшие земли',crypt:'Некрополь',court:'Дворец императора'};
import {campaignActs} from '../dungeon/campaign.js';
import {protectGlass,tickCurses} from '../artifacts/mechanics.js';
export const biomeVariants=campaignActs.map(act=>[...act.variants]);
export function biomePlan(seed){return ['garden',biomeVariants[1][(seed>>>8)%3],'ruins','court'];}
export function worldMeta(world){return world?`;world=${encodeURIComponent(JSON.stringify(world))}`:'';}
export function readWorld(fen){try{const value=fen.match(/;world=([^;\s]+)/)?.[1];return value?JSON.parse(decodeURIComponent(value)):null;}catch{return null;}}
export function worldOf(board){return board.world;}
export function copyWorld(from,to){if(from.world)to.world={...from.world,tiles:{...from.world.tiles}};if(from.relics)to.relics={...from.relics};return to;}
export function hole(board,square){return board.world?.tiles?.[square]==='hole';}
export function rooted(piece){return (piece?.rooted??0)>0;}
export function blockedBoard(board){const next=new Map(board);for(const [s,t] of Object.entries(board.world?.tiles??{}))if(t==='hole')next.set(s,'*');return next;}
export function heatPhase(world){return ['warning','active','cool'][(world?.round??0)%3];}
export function applyTerrain(board,from,to,mover,hit=false){
 tickCurses(board,mover);
 const world=board.world;if(!world)return;
 if(!hit&&from!==to&&world.tiles[from]==='ice')world.tiles[from]='hole';
 const p=board.get(hit?from:to);
 if(!hit&&p&&world.tiles[to]==='vine')p.rooted=2;
 const hurt=(s,p)=>{if(p.type==='k'||p.hp<=1){if(!protectGlass(board,p))board.delete(s);}else p.hp--;};
 if(!hit&&p&&world.tiles[to]==='heat'&&heatPhase(world)==='active')hurt(to,p);
 for(const q of board.values())if(q.color===mover&&q.rooted)q.rooted--;
 const last=[...board.values()].some(q=>q.color==='wild')?'wild':'b';
 if(mover===last){world.round=(world.round??0)+1;if(heatPhase(world)==='active')for(const [s,q] of [...board])if(world.tiles[s]==='heat')hurt(s,q);}
}
