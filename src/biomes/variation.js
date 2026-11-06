import {biomeVariants,biomePlan} from './world.js';

/** Reload the same floor in a different theme, retaining campaign resources. */
export function changeActVariation(run,random=Math.random){
 if(run.stage!=='exploring')return false;
 const alternatives=(biomeVariants[run.act-1]??[]).filter(id=>id!==run.biome);
 if(!alternatives.length)return false;
 const charges=structuredClone(run.artifactFloor);
 run.biomes??=biomePlan(run.seed);
 run.biomes[run.act-1]=alternatives[Math.min(alternatives.length-1,Math.floor(random()*alternatives.length))];
 delete run.deployment;delete run.actAnnounced;
 run.setupFloor();
 if(charges?.key===run.artifactFloor.key)run.artifactFloor=charges;
 return true;
}
