import {files as allFiles,inside} from '../battle/geometry.js';
import {battlefieldWorld,attachWorld} from '../biomes/generation.js';
import {attacks,enemyFormation} from './enemy-formation.js';
import { parsePosition } from '../lab/scenarios.js';
import {encounterBounds,placement} from '../battle/geometry.js';
import {victoryMaterial,captureMaterial} from './balance.js';
import {owns} from '../artifacts/catalog.js';
import {deploymentLimit} from '../artifacts/mechanics.js';
import {paidCaptureMaterial} from './economy.js';
export const enemyTypes={
 p:{name:'Пешка',rank:1,army:['p','p']},n:{name:'Конь',rank:2,army:['n','p','p']},
 b:{name:'Слон',rank:3,army:['b','n','p','p']},r:{name:'Ладья',rank:4,army:['r','n','p','p','p']},q:{name:'Ферзь',rank:5,army:['q','r','b','p','p','p']},
 k:{name:'Король',rank:6,army:['q','r','r','b','n','p','p']},
};
Object.defineProperties(enemyTypes,{d:{value:{name:'Дракон',rank:5,army:['d','p','p']}},j:{value:{name:'Жнец',rank:3,army:['j','p','p']}}});
export {aiProfile} from '../battle/ai-profile.js';
export function encounterReward(enemy,act=1,moves=[]) { return enemy.rewardless?0:victoryMaterial(enemy,act)+paidCaptureMaterial(captureMaterial(moves),act); }
export function encounterName(enemy){
 if(enemy.emperor)return 'Император';
 const title=enemy.reliquary?'Реликварий':enemy.weak?'Патруль':enemy.special?{ambush:'Фланговая засада',split:'Два фланга',forward:'Передовой отряд'}[enemy.formationStyle]:enemy.wild?'Дикая фигура':enemy.boss?'Босс':enemy.roaming?'Преследователь':'Страж';
 return `${title} · ${enemyTypes[enemy.type].name}`;
}
export function makeEncounter(run,enemy,selected) {
 const deployed=run.inventory.filter(p=>p.type==='k'||selected.includes(p.id));
 if(deployed.filter(p=>p.type==='k').length!==1||deployed.length>deploymentLimit(run))throw Error(`Выберите короля и не более ${deploymentLimit(run)-1} других фигур.`);
 const bounds=encounterBounds(run,enemy),files=allFiles.slice(bounds.shape==='imperial'?1:bounds.left,bounds.shape==='imperial'?13:bounds.right+1),bottom=bounds.shape==='imperial'?2:bounds.bottom,top=bounds.shape==='imperial'?13:bounds.top;
 const kingFile=files.at(-2),whiteKing=kingFile+bottom,blackKing=kingFile+top;
 const army=enemy.army??enemyTypes[enemy.type].army;
 const shift=(run.seed+run.floor+enemy.id.length)%files.length,edgeFiles=[...files.slice(shift),...files.slice(0,shift)];
 const taken=new Set();
 const formation=enemy.wildGuardIds?enemy.wildGuardIds.map(id=>run.enemies.find(e=>e.id===id)).filter(Boolean).map(actor=>{const square=edgeFiles.map(f=>f+top).find(s=>!taken.has(s)&&!attacks(s,actor.type,whiteKing,new Map([[whiteKing,'K']])));taken.add(square);return {type:actor.type,square,actor};}):enemy.wild?[{type:enemy.type,square:edgeFiles.map(f=>f+top).find(s=>!attacks(s,enemy.type,whiteKing,new Map()))}]:enemyFormation(run,enemy,army,bounds.shape==='imperial'?{left:1,right:12,bottom:2,top:13}:bounds).filter(p=>!enemy.kingless||p.type!=='k');
 const board=new Map([[whiteKing,'K'],...formation.map(p=>[p.square,p.type])]),identities={},attributes=[],ethereal=[],used=new Set([whiteKing]);
 // Both front ranks are filled before a third deployment rank is used.
 const backOrder=[...files].filter(f=>f!==kingFile).sort((a,b)=>Math.abs(a.charCodeAt(0)-(Math.floor((bounds.left+bounds.right)/2)+97))-Math.abs(b.charCodeAt(0)-(Math.floor((bounds.left+bounds.right)/2)+97)));
 const slots=[...backOrder.map(f=>f+bottom),...[...files].map(f=>f+(bottom+1)),...[...files].map(f=>f+(bottom+2))];
 const pawnSlots=[...files].map(f=>f+(bottom+1)).concat([...files].map(f=>f+(bottom+2)));
 for(const piece of [...deployed].sort((a,b)=>(a.type==='p')-(b.type==='p'))){const square=piece.type==='k'?whiteKing:(piece.type==='p'?pawnSlots:slots).find(s=>!used.has(s)&&!attacks(s,piece.type,blackKing,board,'w'));
  if(!square)throw Error('Для выбранных фигур нет места.');used.add(square);board.set(square,piece.type.toUpperCase());identities[square]=piece.id;
  if(piece.type==='k')continue;
  const hp=piece.material==='diamond'?3:piece.material==='stone'?2:1,power=run.buffs.some(b=>b.pieceId===piece.id&&(b.permanent||b.remaining>0))?2:1;
  if(hp>1||power>1||piece.material==='glass')attributes.push(`${square}=${hp}/${power}/${piece.material==='glass'?1:0}`);
  if(piece.material==='ethereal')ethereal.push(square);
 }
 let marked=false;
 for(const [index,{type,square}] of formation.filter(p=>p.type!=='k').entries()){
  if(type==='d'&&!enemy.wild)continue;
  const armor=enemy.armor?.find(a=>a.index===index);
  if(armor||!enemy.armor&&!marked&&type===enemy.type){
   marked=true;const material=armor?.material??enemy.material,hp=enemy.wild?(enemy.hp??2):material==='diamond'?3:material==='stone'?2:1,damage=enemy.wild?2:enemy.damage??1;
   if(hp>1||damage>1||material==='glass')attributes.push(`${square}=${hp}/${damage}/${material==='glass'?1:0}`);
   if(material==='ethereal')ethereal.push(square);
  }
 }
 const wildIds=[];
 if(enemy.wildGuardIds){for(const p of formation){wildIds.push(p.actor.id);attributes.push(`${p.square}=${p.actor.hp??2}/2/0`,`wild=${p.square}|${p.actor.id}|${p.actor.aggro??'-'}`);}}
 else if(enemy.wild){wildIds.push(enemy.id);attributes.push(`wildmode=solo`,`wild=${formation[0].square}|${enemy.id}|${enemy.aggro??'-'}`);}
 else{
  const invader=run.encounterId===enemy.id&&run.enemies.find(e=>e.id===run.encounterWild&&e.wild);
  if(invader){
   const candidates=[];for(let rank=bottom+3;rank<=top-2;rank++)for(const file of [files[0],files.at(-1)])candidates.push(file+rank);
   const offset=(run.seed+run.floor+invader.id.length)%candidates.length,ordered=[...candidates.slice(offset),...candidates.slice(0,offset)];
   const fixedBoard=new Map([[whiteKing,'K'],...formation.map(p=>[p.square,p.type])]);
   const square=ordered.find(s=>!fixedBoard.has(s)&&![whiteKing,blackKing].some(king=>attacks(s,invader.type,king,fixedBoard)));
   if(square){board.set(square,invader.type);wildIds.push(invader.id);attributes.push(`${square}=${invader.hp??2}/2/0`,'wildmode=mixed',`wild=${square}|${invader.id}|${invader.aggro??'-'}`);}
  }
 }
 if(enemy.boss&&run.act===4)attributes.push(`emperor=${blackKing}|3`);
 const mode=enemy.kingless?'clear':enemy.wild?'solo':'mixed';
 if(bounds.shape==='imperial'||enemy.kingless||run.artifacts?.length){for(let i=attributes.length-1;i>=0;i--)if(attributes[i].startsWith('wildmode='))attributes.splice(i,1);attributes.push(`wildmode=${mode}`);}
 if(owns(run,'fang'))attributes.push(`truce=${wildIds.filter(id=>!run.enemies.find(e=>e.id===id)?.truceBroken).join(',')}`);
 if(enemy.wildGuardIds)attributes.push(`required=${wildIds.join(',')}`);
 const id=`run-${run.id}-${enemy.id}-${run.counter}`;
 return attachWorld({id,name:encounterName(enemy),description:`Акт ${run.act} · ${files.length} × ${top-bottom+1} · белые — ваш отряд.${enemy.special?' Противник выдвинул фигуры вперёд: необычная стартовая позиция.':''}${wildIds.length&&!enemy.wild?' Дикая фигура вторглась сбоку и атакует обе армии.':''}`,fen:placement(board,bounds)+` w - - 0 1 @hunt=${enemy.boss?0:1}`+(attributes.length?';'+attributes.join(';'):''),bounds,ethereal,identities,wildIds,artifactToggles:{...(run.artifactToggles??{})},artifacts:[...(run.artifacts??[])],sealUsed:!!run.artifactFloor?.sealUsed,floorUses:{...(run.artifactFloor?.used??{})},runUses:{...(run.artifactRun??{})},actUses:{...(run.artifactAct?.used??{})},chargeVersion:run.chargeVersion,objective:enemy.kingless?'clear':'royal',deployed:deployed.map(p=>({...p})),enemyId:enemy.id},battlefieldWorld(run,enemy,bounds,new Set(board.keys())));
}
export function identityPositions(preset,moves) {
 const positions=new Map(Object.entries(preset.identities??{}));
 for(const move of moves){if(move.hit){for(const square of move.terrainRemoved??[])positions.delete(square);continue;}const moving=positions.get(move.from);positions.delete(move.target);positions.delete(move.from);if(moving)positions.set(move.to,moving);
  for(const square of move.terrainRemoved??[])positions.delete(square);
  if(move.castle){const rook=positions.get(move.rookFrom);positions.delete(move.rookFrom);if(rook)positions.set(`${move.to[0]==='g'?'f':'d'}${move.from[1]}`,rook);}
 }
 return Object.fromEntries(positions);
}
export function survivingIds(preset,moves){return new Set(Object.values(identityPositions(preset,moves)));}
export function describeArmy(enemy,run) {if(enemy.wildGuardIds&&run)return enemy.wildGuardIds.map(id=>run.enemies.find(e=>e.id===id)).filter(Boolean).map(e=>({color:'wild',type:e.type,hp:e.hp??2,damage:2}));if(enemy.wild)return [{color:'wild',type:enemy.type,hp:enemy.hp??2,damage:2}];let marked=false;return (enemy.army??enemyTypes[enemy.type].army).map((type,index)=>{const material=enemy.armor?enemy.armor.find(a=>a.index===index)?.material:!marked&&type===enemy.type?enemy.material:undefined;if(type===enemy.type)marked=true;return {color:'b',type,material:type==='d'?undefined:material};});}
