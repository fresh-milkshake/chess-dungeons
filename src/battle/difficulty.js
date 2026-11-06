import {campaignStage} from '../dungeon/campaign.js';
export const difficultyPresets={
 low:{name:'Низкая',description:'Для первых шагов. Противники чаще упускают угрозы.',elos:[100,170,240,310,380,450,520,590,650,700]},
 medium:{name:'Средняя',description:'Постепенный рост сопротивления и тактических угроз.',elos:[450,540,630,720,810,900,990,1080,1170,1250]},
 high:{name:'Высокая',description:'Для опытных игроков. Более точная и требовательная игра.',elos:[1000,1050,1100,1160,1220,1280,1340,1400,1450,1500]},
};
export const difficultyDebugKey='chess-dungeons-difficulty-debug-v1';
export const normalizeDifficulty=value=>({preset:Object.hasOwn(difficultyPresets,value?.preset)?value.preset:'medium',overrideElo:Number.isFinite(value?.overrideElo)?Math.max(100,Math.min(2850,Math.round(value.overrideElo))):null});
export function targetElo(act,floor,difficulty){const d=normalizeDifficulty(difficulty);return d.overrideElo??difficultyPresets[d.preset].elos[campaignStage(act,floor)];}
/** Same Elo-to-level fit used by the pinned Fairy-Stockfish build (CCRL anchor).
 * Variant move selection is an adaptation, not a human-Elo calibration. */
export function eloSkillLevel(elo){const x=Math.max(500,Math.min(2850,elo))-1346.6;return Math.max(-20,Math.min(20,x>0?(x/143.4)**(1/.806):x/143.4+(x/500)**5));}
export function chooseEloMove(candidates,elo,random=Math.random){
 if(!candidates.length)return null;if(elo>=2850)return candidates[0].move;
 const pool=candidates.slice(0,4),top=pool[0].score,delta=Math.min(100,Math.max(0,top-pool.at(-1).score)),weakness=120-2*eloSkillLevel(elo);
 let best=pool[0].move,score=-Infinity;
 for(const p of pool){const adjusted=p.score+(weakness*(top-p.score)+delta*Math.floor(random()*weakness))/128;if(adjusted>=score){best=p.move;score=adjusted;}}
 return best;
}
