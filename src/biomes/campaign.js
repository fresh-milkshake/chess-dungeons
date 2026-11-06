import {biomePlan,biomeVariants,heatPhase} from './world.js';
import {key} from '../dungeon/map.js';
export function chooseBiome(run){run.biomes??=biomePlan(run.seed);const index=run.act-1;if(!biomeVariants[index].includes(run.biomes[index]))run.biomes[index]=biomePlan(run.seed)[index];run.biome=run.biomes[index];}
export function biomeArmies(run){
 if(run.biome==='crypt')for(const enemy of run.enemies)if(!enemy.wild){const army=enemy.army??{p:['p','p'],n:['n','p','p'],b:['b','n','p','p'],r:['r','n','p','p','p'],q:['q','r','b','p','p','p'],k:['q','r','r','b','n','p','p']}[enemy.type];enemy.army=army.map(t=>t==='b'?'j':t);if(!enemy.army.includes('j')&&!enemy.weak)enemy.army[0]='j';}
 if(run.act>=3)for(const enemy of run.enemies)if(!enemy.wild&&(enemy.boss||enemy.guard&&run.floor>=2&&(run.seed%100)<45)){
  enemy.army=[...(enemy.army??['q','r','b','p','p','p'])];const officer=enemy.army.findIndex((t,i)=>['b','n'].includes(t)&&!enemy.armor?.some(a=>a.index===i));enemy.army[officer<0?0:officer]='d';
 }
}
export function mapTerrainStep(run,previous){
 const world=run.map.world;if(!world)return;
 const from=key(previous.x,previous.y),to=key(run.player.x,run.player.y);
 if(from!==to&&world.tiles[from]==='ice'){world.tiles[from]='hole';run.map.tiles[previous.y*run.map.width+previous.x]=2;}
 if(world.tiles[to]==='vine'&&from!==to)run.rootedMap=1;
 const burn=()=>{run.stage='defeat';run.message='Король погиб на раскалённой клетке.';};
 if(world.tiles[to]==='heat'&&heatPhase(world)==='active')burn();
 world.round++;
 if(world.tiles[to]==='heat'&&heatPhase(world)==='active')burn();
}
