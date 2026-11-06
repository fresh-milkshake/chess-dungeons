import {walkable} from './map.js';
import {applyMaterial} from '../debug/position.js';

export function addDebugPiece(run,tool,cell){
 if(run.stage==='battle'||run.stage==='defeat')throw Error('Изменяйте активный бой на его странице.');
 if(!['w','b','wild'].includes(tool.color)||!['p','n','b','r','q','k'].includes(tool.type))throw Error('Неизвестная фигура.');
 if(tool.color==='wild'&&!'nbrq'.includes(tool.type))throw Error('Дикие фигуры: конь, слон, ладья или ферзь.');
 if(tool.color==='w'){
  if(tool.type==='k')throw Error('В отряде уже есть король.');
  if(run.inventory.length>=64)throw Error('Достигнут предел редактора: 64 фигуры.');
  run.inventory.push({id:`debug-${++run.counter}`,type:tool.type,material:'ordinary'});return;
 }
 if(!cell||!walkable(run.map,cell.x,cell.y))throw Error('Разместите противника на свободном полу карты.');
 if([run.player,...run.enemies,...run.loot,run.map.exit].some(p=>p.x===cell.x&&p.y===cell.y))throw Error('Клетка занята.');
 run.enemies.push({id:`debug-enemy-${++run.counter}`,type:tool.type,...cell,...(tool.color==='wild'?{wild:true,roaming:true,hp:2,damage:2,patrol:0}:{material:'ordinary'})});
}

export function materializeDebugPiece(run,material,{pieceId,cell}={}){
 if(run.stage==='battle'||run.stage==='defeat')throw Error('Изменяйте активный бой на его странице.');
 if(cell&&cell.x===run.player.x&&cell.y===run.player.y)throw Error('Король всегда обычный и не получает усилений.');
 const piece=pieceId?run.inventory.find(p=>p.id===pieceId):cell&&run.enemies.find(p=>p.x===cell.x&&p.y===cell.y);
 if(!piece)throw Error('Материал нужно перенести на фигуру отряда или противника.');
 if(piece.wild)throw Error('Дикая фигура имеет собственный материал и две жизни.');
 const updated=applyMaterial(piece,material);
 if(pieceId){
  if(material==='power'){run.buffs=run.buffs.filter(b=>b.pieceId!==pieceId);run.buffs.push({pieceId,remaining:1});}
  else{piece.material=updated.material;if(material==='ordinary')run.buffs=run.buffs.filter(b=>b.pieceId!==pieceId);}
 }else{piece.material=updated.material??piece.material;piece.damage=updated.damage;}
}
