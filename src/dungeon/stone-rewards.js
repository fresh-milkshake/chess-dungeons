import {randomSource} from './map.js';

export const stoneCompensation={p:6,n:14,b:14,r:24,q:40};

/** Prefer a new stone role; seeded ties never reroll on reload or retreat. */
export function stoneRole(run,roles,salt=0){
 const count=type=>run.inventory.filter(p=>p.material==='stone'&&p.type===type).length;
 const least=Math.min(...roles.map(count)),pool=roles.filter(type=>count(type)===least);
 const random=randomSource(Math.imul(run.seed^(run.act*104729)^salt,2654435761));
 return pool[Math.floor(random()*pool.length)];
}

/** Ordinary encounters never grant stone pieces. */
export function stoneTrophy(){return null;}
export function stoneTrophyText(){return '';}
