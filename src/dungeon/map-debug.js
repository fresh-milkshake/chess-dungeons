import {key,walkable} from './map.js';
import {floorOffers,secretOffers} from './merchants.js';

export function setGhostMode(run,enabled){
 if(run.stage!=='exploring')throw Error('Вернитесь на карту.');
 if(!enabled&&(!walkable(run.map,run.player.x,run.player.y)||run.enemies.some(e=>e.x===run.player.x&&e.y===run.player.y)))throw Error('Перед отключением Ghost mode вернитесь на свободную клетку пола.');
 (run.debugMap??={}).ghost=!!enabled;
 if(enabled){run.rootedMap=0;for(const enemy of run.enemies){delete enemy.lastSeen;enemy.chasing=false;}}
}
export function revealMap(run){
 if(run.stage!=='exploring')throw Error('Вернитесь на карту.');
 (run.debugMap??={}).reveal=true;run.refreshSight();
}
export function spawnMapEntity(run,{kind,type='n'},cell){
 if(run.stage!=='exploring')throw Error('Размещение доступно только на карте.');
 if(!['wild','fight','floor','secret'].includes(kind)||!cell||!Number.isInteger(cell.x)||!Number.isInteger(cell.y))throw Error('Некорректный объект.');
 const occupied=[run.player,run.map.start,run.map.exit,...run.enemies,...run.loot,...(run.merchants??[])];
 if(!walkable(run.map,cell.x,cell.y)||run.map.world?.tiles[key(cell.x,cell.y)]||occupied.some(p=>p.x===cell.x&&p.y===cell.y))throw Error('Выберите свободную клетку пола без особого эффекта.');
 if((kind==='wild'&&!['n','b','r','q','d'].includes(type))||(kind==='fight'&&!['p','n','b','r','q','k'].includes(type)))throw Error('Недопустимая фигура.');
 const id=`debug-${kind}-${++run.counter}`;
 if(kind==='wild'||kind==='fight')run.enemies.push({...cell,id,type,...(kind==='wild'?{wild:true,roaming:true,hp:2,damage:2,patrol:0}:{})});
 else{
  const stockRun={...run,seed:run.seed^Math.imul(run.counter,7919)};
  const stock=kind==='floor'?{act:run.act,version:3,offers:floorOffers(stockRun),empowered:[]}:{offers:secretOffers(stockRun),empowered:[],stoneBought:false};
  (run.merchants??=[]).push({...cell,id,kind,debug:true,stock});
 }
 run.message='Объект размещён.';return true;
}
