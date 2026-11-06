import {targetElo} from './difficulty.js';
import {campaignStage} from '../dungeon/campaign.js';
export const floorProfiles=[
 {depth:3,milliseconds:70},{depth:4,milliseconds:100},{depth:5,milliseconds:160},
 {depth:5,milliseconds:200},{depth:6,milliseconds:280},{depth:7,milliseconds:420},
 {depth:8,milliseconds:550},{depth:9,milliseconds:750},{depth:10,milliseconds:1000},{depth:12,milliseconds:1400},
];
export function aiProfile(act,floor=1,enemy={},difficulty){
 const index=campaignStage(act,floor),base=floorProfiles[index],elo=targetElo(act,floor,difficulty);
 // Army composition never changes Elo; only the selected preset/floor or explicit override does.
 const scale=elo<500?.55:elo<1000?.75:elo>=2000?1.4:1;
 return {...base,elo,skill:Math.min(1,elo/2850),depth:elo>=2000?12:elo>=1000?Math.max(6,base.depth):elo<500?2:Math.max(4,base.depth),milliseconds:Math.min(2500,Math.max(elo>=2000?900:elo>=1000?150:25,Math.round(base.milliseconds*scale))),stage:index+1};
}
export function randomDecision(moves,skill,random=Math.random){
 const bounded=Math.max(0,Math.min(1,Number(skill)));
 if(!moves.length||bounded>=1)return null;
 if(random()<(1-bounded)**2*.85||bounded===0)return moves[Math.min(moves.length-1,Math.floor(random()*moves.length))];
 return null;
}
