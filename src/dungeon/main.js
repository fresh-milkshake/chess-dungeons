import {setAudioScene} from '../audio/runtime.js';
import {ACTS,totalFloors,floorsInAct} from './campaign.js';
import {rerollShop} from '../artifacts/rerolls.js';
import {artifactUses} from '../artifacts/charges.js';
import {createRunPicker,setupDifficultyDebug,renderEloCaption} from './difficulty-ui.js';
import {aiProfile} from '../battle/ai-profile.js';
import {changeActVariation} from '../biomes/variation.js';
import {setupCampaignNavigation} from '../debug/campaign-navigation.js';
import {renderTerrain} from '../biomes/view.js';
import {showActIntro} from '../biomes/intro.js';
import '../game-input.js';
import '../style.css';
import './style.css';
import './landmarks.css';
import './walls.css';
import {trackRun} from '../timing/index.js';
import {profile} from '../performance.js';
import {addLandmark} from './landmarks.js';
import {Run} from './run.js';
import {key,walkable} from './map.js';
import {wallFaces} from './walls.js';
import {enemyTypes,encounterName,describeArmy,encounterReward} from './encounters.js';
import {loadRun,saveRun,runKey} from './storage.js';
import {pieceImage} from '../piece-sets.js';
import {createPieceSprite} from '../piece-effects.js';
import {enableBoardDrag} from '../board-drag.js';
import {createMoveSound} from '../move-effects.js';
import {snapshotActors,playMapMoves} from './motion.js';
import {setupDebugMenu} from '../debug-menu.js';
import {createCamera} from './camera.js';
import {setupMapFog} from './fog.js';
import {setupPieceEditor} from '../debug/editor.js';
import {addDebugPiece,materializeDebugPiece} from './debug.js';
import {setupMapKeyboard} from './keyboard.js';
import {canReceive} from './balance.js';
import {encounterBounds} from '../battle/geometry.js';
import {stoneTrophyText} from './stone-rewards.js';
import {artifactById,artifactImage,kindLabel} from '../artifacts/catalog.js';
import {createArtifactBar} from '../artifacts/bar.js';
import {setupRelicDebug} from '../debug/relics.js';
import {createMerchantUI,merchantTitle,merchantCost,exchangeCostSprites,renderMerchantDescription} from './merchant-ui.js';
import {isShopping,isMerchantStage,merchantOffers,purchaseProblem} from './merchants.js';
import {createExitMirage} from './exit-mirage.js';
import {artifactIcon} from '../artifacts/icon-effects.js';
import {setupMerchantDebug} from '../debug/merchants.js';
import {setupMapTools} from '../debug/map-tools.js';
export function mountMap({root,scope,navigate}){
const $=id=>root.querySelector('#'+id),base=import.meta.env.BASE_URL;
const names={k:'Король',q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь',p:'Пешка'};
const materials={ordinary:'Обычная',glass:'Стеклянная',ethereal:'Эфирная',stone:'Каменная',diamond:'Алмазная'};
let run,busy=false,selected=false,needsDifficulty=false,mapTools;
const debug=setupDebugMenu({root,scope});
const camera=createCamera($('map-viewport'),$('map'),{scope,canPan:()=>!mapTools?.placing&&!isShopping(run?.stage)&&!debug.isOpen&&$('map-dialogs').hidden&&!$('map').classList.contains('dragging')});
let cameraFloor=null;
const fog=setupMapFog($('map-viewport'),$('map'),{scope});
const exitMirage=createExitMirage($('map-viewport'),scope);
let cameraPlayer=null;
let keyboard;
const artifactBar=createArtifactBar({root,scope,onUse:id=>{const a=artifactById(id);if(id==='merchant-die'){apply(()=>rerollShop(run),{animate:false});}else if(a.kind==='toggle'){run.artifactToggles??={};run.artifactToggles[id]=run.artifactToggles[id]===false;persist();render();}else{run.message=a.description;render();}}});
const cellViews=new WeakMap();
const merchantUI=createMerchantUI({root,scope,getRun:()=>run,onAction:action=>apply(()=>action(run),{animate:false})});
let inventoryView='';
const sound=createMoveSound(()=>$('sound-toggle').checked);
try{$('sound-toggle').checked=localStorage.getItem('chess-dungeons-map-sound')!=='off';}catch{/* Optional preference. */}
scope.on(document,'pointerdown',()=>sound.unlock());
scope.on(document,'keydown',()=>sound.unlock());
$('sound-toggle').addEventListener('change',()=>{if(!$('sound-toggle').checked)sound.stop();try{localStorage.setItem('chess-dungeons-map-sound',$('sound-toggle').checked?'on':'off');}catch{/* Optional preference. */}});
try{run=loadRun();if(!run){run=new Run();needsDifficulty=true;}}catch{run=new Run();needsDifficulty=true;run.message='Сохранение не удалось восстановить. Начат новый забег.';}
const runPicker=createRunPicker({root,scope,onStart:choice=>apply(()=>{if(needsDifficulty){run.difficulty=choice;needsDifficulty=false;}else run=new Run(undefined,1,choice);difficultyDebug.refresh();},{animate:false})});
const difficultyDebug=setupDifficultyDebug({root,scope,getDifficulty:()=>run.difficulty,onChange:value=>{run.difficulty=value;persist();render();}});
const campaignNavigation=setupCampaignNavigation({root,getRun:()=>run,isBusy:()=>busy,onNavigate:async action=>{const wasEncounter=run.stage==='encounter';const moved=await apply(()=>{const moved=action();if(moved){cameraFloor=null;cameraPlayer=null;}return moved;},{animate:false});if(moved&&wasEncounter&&run.stage==='encounter')navigate(`./deployment.html?run=${encodeURIComponent(run.id)}`);}});
setupRelicDebug({root,scope,getState:()=>({owned:run.artifacts}),isBusy:()=>busy,onChange:owned=>apply(()=>{run.artifacts=owned;},{animate:false})});
setupMerchantDebug({root,getRun:()=>run,onAction:action=>apply(action,{animate:false})});
function sprite(type,color='w',material,damage=1){return createPieceSprite({type,color,material,damage},pieceImage({type,color,material},'neo',base));}
function artifactSprite(id){const img=document.createElement('img');img.src=artifactImage(id,base);img.alt='';img.draggable=false;const icon=artifactIcon(img,id);icon.classList.add('artifact-map-token');return icon;}
function offerLabel(offer){return offer.kind==='artifact'?`${artifactById(offer.artifactId).name} · ${kindLabel(artifactById(offer.artifactId))}`:`${names[offer.type]} · ${materials[offer.material]}`;}
function pieceLabel(p){return p.type==='k'?'Король · всегда обычный':`${names[p.type]} · ${materials[p.material]}`;}
function persist(){return profile('map:save',()=>saveRun(run));}
const editor=setupPieceEditor({scope,container:root,
 isBusy:()=>busy,
 helpText:'Белые фигуры добавляются в отряд нажатием или перетаскиванием. Чёрные размещаются на свободном полу. Материал переносится на фигуру отряда или противника. Король всегда обычный.',
 resolveTarget:element=>element?.closest('#map [data-cell],#inventory [data-piece-id]')??null,
 onPick:async tool=>{if(tool.kind!=='piece'||tool.color!=='w')return false;await edit(tool,null);return true;},
 onApply:edit,
});
mapTools=setupMapTools({root,scope,getRun:()=>run,isBusy:()=>busy,onAction:action=>apply(action,{animate:false}),onArm:()=>editor.setEditing(false)});
async function edit(tool,target){
 const cell=target?.dataset.cell?.split(',').map(Number),position=cell?{x:cell[0],y:cell[1]}:null;
 const ok=await apply(()=>{
  if(tool.kind==='piece')addDebugPiece(run,tool,position);
  else materializeDebugPiece(run,tool.material,{pieceId:target?.dataset.pieceId,cell:position});
 },{animate:false});
 if(!ok)throw Error(run.message??'Не удалось изменить фигуру.');
}
async function apply(action,{dragged=false,animate=true}={}){
 if(busy||!scope.active)return false;
 const before=profile('map:snapshot',()=>run.snapshot()),actors=profile('map:actors',()=>snapshotActors($('map')));
 busy=true;selected=false;
 try{
  const result=profile('map:rules',action);if(result===false)return false;
  persist();render();
  if(animate&&before.stage===run.stage&&before.act===run.act&&before.floor===run.floor){
   await playMapMoves($('map'),actors,sound,{dragged});
  }
  if(scope.active&&run.stage==='encounter'&&before.stage!=='encounter')navigate(`./deployment.html?run=${encodeURIComponent(run.id)}`);
  return true;
 }catch(error){run=Run.restore(before);run.message=error.message;return false;}
 finally{busy=false;render();}
}
function renderMap(){return profile('map:cells',renderMapContent);}
function renderMapContent(){
 fog.update(run);
 exitMirage.update(run);
 const map=run.map,visible=new Set(run.visible),seen=new Set(run.seen),cells=[],board=$('map');
 const existing=new Map([...board.children].map(cell=>[cell.dataset.cell,cell]));
 if(board.style.getPropertyValue('--columns')!==String(map.width))board.style.setProperty('--columns',map.width);
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  const id=key(x,y),known=seen.has(id),lit=visible.has(id),floor=isShopping(run.stage)||walkable(map,x,y),enemy=lit?run.enemies.find(e=>e.x===x&&e.y===y):null,loot=known?run.loot.find(l=>l.x===x&&l.y===y):null;
  const player=run.player.x===x&&run.player.y===y,exit=known&&run.map.exit.x===x&&run.map.exit.y===y;
  let cell=existing.get(id);
  if(!cell){cell=document.createElement('button');cell.type='button';cell.dataset.cell=id;cell.dataset.square=id;cell.dataset.x=x;cell.dataset.y=y;}
  const entry=known&&x===map.start.x&&y===map.start.y,offer=isShopping(run.stage)?(isMerchantStage(run.stage)?merchantOffers(run):run.shop.items).find(i=>i.x===x&&i.y===y&&!i.withdrawn):null;
  const merchant=known?run.merchants?.find(m=>m.x===x&&m.y===y):null;
  const faces=known&&!floor?wallFaces(map,x,y,seen):'',hinted=selected&&!player&&lit&&run.canStep(x-run.player.x,y-run.player.y);
  const view=JSON.stringify([known,lit,floor,player,exit,entry,selected&&player,hinted,enemy,loot,offer,offer?.costPieces?.map(n=>run.inventory.filter(p=>p.type===n.type&&p.material===n.material).length),faces,merchant,isShopping(run.stage)]);
  const disabled=busy||!(run.stage==='exploring'||isShopping(run.stage));
  if(cell.disabled!==disabled)cell.disabled=disabled;
  cells.push(cell);
  if(cellViews.get(cell)===view)continue;
  cell.className=`map-cell ${!known?'unseen':floor?`floor ${(x+y)%2?'tile-dark':'tile-light'}`:'wall'}${known&&!lit?' memory':''}${player?' player':''}${enemy?.roaming?' hunter':''}${exit?' exit':''}`;
  if(known&&!floor&&map.tiles[y*map.width+x]!==2){if(faces)cell.className+=` ${faces}`;}
  cell.replaceChildren();let label=!known?'Неизведано':floor?'Пол':map.tiles[y*map.width+x]===2?'Провал':'Стена';
  if(!isShopping(run.stage)){if(exit&&run.act!==4)addLandmark(cell,'exit');else if(entry)addLandmark(cell,'entry');}
  if(loot){const img=document.createElement('img');img.src=`${base}pieces/neo/ruins/${loot.role}.png`;img.alt='';img.draggable=false;cell.append(img);label='Разбитая серая фигура · находка';}
  if(merchant){const token=document.createElement('span');token.className='map-merchant-token';token.textContent='⚖';cell.append(token);cell.classList.add(merchant.kind==='secret'?'secret-merchant':'floor-merchant');label=merchant.kind==='secret'?'Секретный магазин':'Магазин этажа';}
  if(offer){cell.classList.add('shop-offer');if(offer.sold){cell.classList.add('sold');label='Продано';}else{if(offer.kind==='artifact'){cell.classList.add('artifact-offer');cell.append(artifactSprite(offer.artifactId));}else if(offer.kind==='bundle'){const bundle=document.createElement('span');bundle.className='shop-bundle';for(const p of offer.pieces)bundle.append(sprite(p.type,'w',p.material));cell.append(bundle);}else if(offer.kind==='empower'){const emblem=document.createElement('span');emblem.className='shop-empower';emblem.textContent='✦';if(offer.duration){const turns=document.createElement('small');turns.textContent=`${offer.duration} ${offer.duration===1?'бой':'боя'}`;emblem.append(turns);}cell.append(emblem);}else cell.append(sprite(offer.type,'w',offer.material));const price=document.createElement('span');price.className='shop-price';price.textContent=isMerchantStage(run.stage)?offer.costPieces?'⇄':offer.slots?`−${offer.slots} ▪`:offer.kind==='empower'?'✦':`◆ ${offer.price}`:`◆ ${offer.price}`;if(offer.costPieces){price.replaceChildren(exchangeCostSprites(offer,run.inventory,{compact:true}));price.classList.add('exchange-price');}cell.dataset.payment=offer.costPieces?'exchange':'material';cell.append(price);label=isMerchantStage(run.stage)?`${merchantTitle(offer)} · ${merchantCost(offer)}`:`${offerLabel(offer)} · ${offer.price} материала`;}}
  if(isShopping(run.stage)&&x===map.start.x&&y===map.start.y){cell.classList.add('shop-entry');const entry=document.createElement('span');entry.className='shop-door';entry.textContent='ВХОД →';cell.append(entry);}
  if(isShopping(run.stage)&&exit){cell.querySelector('.stairs')?.remove();const door=document.createElement('span');door.className='shop-door';door.textContent='ВЫХОД →';cell.append(door);}
  if(enemy){const img=enemy.reliquary?artifactSprite(enemy.artifactId):enemy.emperor?createPieceSprite({type:'k',color:'b',emperor:true,hp:3,damage:1},pieceImage({type:'k',color:'b',emperor:true,hp:3},'neo',base)):sprite(enemy.type,enemy.wild?'wild':'b',enemy.material,enemy.damage);if(enemy.reliquary)cell.classList.add('artifact-reliquary');img.dataset.actor=enemy.id;cell.append(img);if(enemy.wild)cell.classList.add('wild-enemy');const dot=document.createElement('span');dot.className='enemy-marker';dot.textContent=enemy.reliquary?'⚔':enemy.wild?`◆ ${enemy.hp??2}`:enemy.roaming?'↝':'•';cell.append(dot);if(enemy.weak){cell.classList.add('weak-patrol');dot.textContent=enemy.chasing?'!':'↝';}label=enemy.wild?`Дикая ${enemyTypes[enemy.type].name} · ${enemy.hp??2} жизни · охотится и на белых, и на чёрных`:`${enemy.weak?'Патруль':enemy.special?'Необычная встреча':enemy.roaming?'Преследователь':'Противник'}: ${enemyTypes[enemy.type].name}, армия ${(enemy.army??enemyTypes[enemy.type].army).map(t=>names[t]).join(', ')}`;}
  if(enemy?.emperor)label='Император · финальный босс';
  if(enemy?.reliquary)label=artifactById(enemy.artifactId).name+' · охраняемый реликварий · '+label;
  if(player){const img=sprite('k');img.dataset.actor='player';cell.append(img);label='Вы · белый король';if(selected)cell.classList.add('selected');}
  if(hinted){const hint=document.createElement('span');hint.className=enemy?'capture-hint':'move-hint';cell.append(hint);}
  if(!isShopping(run.stage))label+=exit?(run.act===4?' · Император':' · Переход на следующий этаж'):entry?' · Место появления':'';
  cell.setAttribute('aria-label',`${x+1}, ${y+1}: ${label}`);cell.title=label;cell.tabIndex=player?0:-1;cellViews.set(cell,view);
 }
 const wanted=map.width*map.height;for(const child of [...board.children])if(!cells.includes(child)&&!child.hasAttribute('data-board-overlay'))child.remove();
 cells.forEach((c,i)=>{if($('map').children[i]!==c)$('map').insertBefore(c,$('map').children[i]??null);});

 renderTerrain(board,isShopping(run.stage)?null:map.world,new Map([[key(run.player.x,run.player.y),{rooted:run.rootedMap}]]),new Set(map.tiles.flatMap((tile,i)=>tile===1?[key(i%map.width,Math.floor(i/map.width))]:[])));
 $('map-size').textContent=`${map.width} × ${map.height} · исследовано ${Math.round(run.seen.length/wanted*100)}%`;
}
function renderRewards(){
 $('reward-panel').hidden=!['reward','boss-reward'].includes(run.stage);if($('reward-panel').hidden)return;
 $('reward-panel').querySelector('.chapter').textContent=run.stage==='boss-reward'?'БОСС ПОБЕЖДЁН · НАГРАДЫ':'НАХОДКА';
 $('reward-panel').querySelector('h2').textContent=run.stage==='boss-reward'?'Награда за босса':run.pendingReward.parentOptions?'Какую реликвию перезарядить?':'Среди осколков';
 $('reward-options').replaceChildren(...run.pendingReward.options.map((o,index)=>{const button=document.createElement('button');button.className='reward-card';
  if(o.kind==='piece')button.append(sprite(o.type,'w',o.material));else if(o.artifactId)button.append(artifactSprite(o.artifactId));else{const icon=document.createElement('span');icon.className='reward-symbol';icon.textContent=({power:'⚡',scout:'◉',exit:'⌑',recharge:'↻'})[o.kind]??'◆';button.append(icon);}
  button.disabled=busy;const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=o.title+(o.amount?' · '+o.amount:'');detail.textContent=o.detail;text.append(title,detail);button.append(text);button.addEventListener('click',()=>apply(()=>run.stage==='boss-reward'?run.chooseBossReward(index):run.chooseReward(index),{animate:false}));return button;}));
 if(run.pendingReward.parentOptions){const back=document.createElement('button');back.textContent='Назад к находке';back.className='secondary-button';back.addEventListener('click',()=>apply(()=>run.cancelRewardTarget(),{animate:false}));$('reward-options').append(back);}
}
function renderEncounter(){
 $('encounter-panel').hidden=run.stage!=='encounter';if(run.stage!=='encounter')return;
 const enemy=run.enemies.find(e=>e.id===run.encounterId);$('enemy-title').textContent=encounterName(enemy);renderEloCaption($('enemy-title').parentElement,aiProfile(run.act,run.floor,enemy,run.difficulty));
 $('retreat').hidden=!!enemy.boss;
 const bounds=encounterBounds(run,enemy);
 $('encounter-detail').textContent=`Доска ${bounds.right-bounds.left+1} × ${bounds.top-bounds.bottom+1} · ${enemy.rewardless?'Повторный преследователь — без награды.':`За победу: ◆ ${encounterReward(enemy,run.act)} + взятия.`}`;
 const trophy=stoneTrophyText(run,enemy,canReceive);if(trophy)$('encounter-detail').textContent+=` Трофей: ${trophy}.`;
 if(enemy.artifactId){const a=artifactById(enemy.artifactId);$('encounter-detail').textContent+=` Артефакт: ${a.name}. ${a.description}`;}
 $('enemy-army').replaceChildren(...(enemy.wild||enemy.kingless?[]:[sprite('k','b')]),...describeArmy(enemy,run).map(p=>sprite(p.type,p.color,p.material,p.damage)));
}
function renderInventory(){return profile('map:inventory',renderInventoryContent);}
function renderInventoryContent(){
 const view=JSON.stringify([run.inventory,run.buffs]);if(inventoryView===view)return;inventoryView=view;
 const groups=[];
 for(const type of ['p','n','b','r','q','k']){
  const pieces=run.inventory.filter(p=>p.type===type).sort((a,b)=>['ordinary','stone','glass','ethereal','diamond'].indexOf(a.material)-['ordinary','stone','glass','ethereal','diamond'].indexOf(b.material));
  if(!pieces.length)continue;
  const group=document.createElement('div');group.className='inventory-group';group.dataset.pieceType=type;
  group.setAttribute('role','group');group.setAttribute('aria-label',`${names[type]}: ${pieces.length}`);
  for(const p of pieces){const item=document.createElement('div');item.className='inventory-piece';item.dataset.pieceId=p.id;item.title=pieceLabel(p);item.setAttribute('aria-label',pieceLabel(p));item.append(sprite(p.type,'w',p.material,run.buffs.some(b=>b.pieceId===p.id&&(b.permanent||b.remaining>0))?2:1));group.append(item);}
  groups.push(group);
 }
 $('inventory').replaceChildren(...groups);
}
function render(){return profile('map:render',renderContent);}
function renderContent(){
 if(!needsDifficulty)showActIntro({root,scope,run,persist});
 if(!scope.active)return;setAudioScene({biome:run.biome,stage:run.stage});difficultyDebug.refresh();campaignNavigation.refresh();mapTools.refresh();
 artifactBar.render({owned:run.artifacts,toggles:run.artifactToggles,context:run.stage==='shop'?'shop':null,used:artifactUses(run),busy});
 trackRun(run,needsDifficulty?'difficulty':{exploring:'map',reward:'reward','boss-reward':'boss-reward',encounter:'encounter',battle:'menu',cleared:'results',defeat:'results',victory:'results',shop:'shop','floor-shop':'shop','secret-shop':'shop'}[run.stage]??'menu',{encounterId:run.encounterId??undefined});
 document.body.classList.toggle('shopping',isShopping(run.stage));
 $('shop-controls').hidden=!isShopping(run.stage);
 if(isShopping(run.stage)){
  const local=isMerchantStage(run.stage),offer=local?merchantUI.currentOffer():run.shop.items.find(i=>i.x===run.player.x&&i.y===run.player.y&&!i.sold);
  $('shop-controls').querySelector('.chapter').textContent=local?(run.stage==='secret-shop'?'ТАЙНЫЙ ТОРГ':'МАГАЗИН ЭТАЖА'):'МЕЖДУ АКТАМИ · МАГАЗИН';
  $('shop-wallet').textContent=(local?'':`Акт ${run.act} → ${run.act+1} · `)+`◆ ${run.material}`;
  $('map').style.setProperty('--shop-columns',run.map.width);$('map').style.setProperty('--shop-rows',run.map.height);
  const problem=offer&&local&&offer.kind!=='empower'?purchaseProblem(run,offer):'';
  if(local)renderMerchantDescription($('shop-description'),run,offer,problem);else{$('shop-description').replaceChildren();delete $('shop-description').dataset.merchantDescription;$('shop-description').textContent=offer?`${offerLabel(offer)} · ◆ ${offer.price}${offer.kind==='artifact'?' · '+artifactById(offer.artifactId).description:''}`:run.message;}
  $('shop-buy').hidden=!offer;$('shop-buy').disabled=busy||!offer||(local?!!problem:run.material<offer.price||offer.kind!=='artifact'&&!canReceive(run,offer.material));
  $('shop-buy').textContent=offer?.costPieces?'Обменять · Enter':offer?.kind==='empower'?'Выбрать фигуру · Enter':'Купить · Enter';
 }
 $('chapter').textContent=`АКТ ${['I','II','III','IV','V'][run.act-1]} · ЭТАЖ ${run.floor}`;$('turn-counter').textContent=`Ход ${run.turns}`;$('message').textContent=run.message;$('material-count').textContent=`◆ ${run.material}`;
 renderMap();renderRewards();renderEncounter();
 renderInventory();
 $('buff-summary').textContent=run.buffs.filter(b=>b.permanent||b.remaining>0).map(b=>`⚡ ${names[run.inventory.find(p=>p.id===b.pieceId)?.type]}: ${b.permanent?'постоянное Усиление':`Усиление · боёв: ${b.remaining}`}`).join(' · ');
 $('resume-panel').hidden=run.stage!=='battle';$('resume').href=`./battle.html?run=${encodeURIComponent(run.id)}`;
 $('ending-panel').hidden=!['cleared','defeat','victory'].includes(run.stage);
 $('ending-label').textContent=run.stage==='defeat'?'ЗАБЕГ ЗАВЕРШЁН':'ВЫХОД НАЙДЕН';$('ending-title').textContent=run.stage==='defeat'?'Король пал.':`Этаж ${run.floor} пройден.`;
 $('ending-detail').textContent=run.stage==='defeat'?'Начните новый забег.':run.stage==='victory'?`Пройдены ${ACTS} акта и ${totalFloors} этажей. Осталось материала: ${run.material}.`:'Ваш отряд перейдёт на следующий этаж.';
 if(run.stage==='victory'){$('ending-label').textContent='ПОБЕДА';$('ending-title').textContent='Подземелье пройдено.';}
 $('next-floor').hidden=run.stage!=='cleared'||run.floor>=floorsInAct(run.act);
 const hunter=run.enemies.find(e=>e.roaming&&!e.wild&&!e.weak),visible=hunter&&run.visible.includes(key(hunter.x,hunter.y));$('hunter-status').textContent=visible?'Преследователь в поле зрения.':hunter?'Вы слышите далёкие шаги.':'';
 for(const b of document.querySelectorAll('.dpad button'))b.disabled=busy||run.stage!=='exploring';
 for(const id of ['fight','retreat','next-floor','new-run'])$(id).disabled=busy;
 $('map').setAttribute('aria-busy',String(busy));
 $('map-dialogs').hidden=!(['reward','boss-reward','encounter','battle','cleared','defeat','victory'].includes(run.stage)||isMerchantStage(run.stage)&&merchantUI.modalOpen);
 merchantUI.render();
 $('restart-run').hidden=!['defeat','victory'].includes(run.stage);
 const floorId=`${run.id}:${run.act}:${run.floor}:${isShopping(run.stage)}`,playerId=key(run.player.x,run.player.y);
 if(isShopping(run.stage))camera.stop();
 else if(cameraFloor!==floorId)camera.center(run.player);
 else if(cameraPlayer!==playerId)camera.follow(run.player);
 cameraFloor=floorId;
 cameraPlayer=playerId;
 keyboard?.update();
}
for(const [type,profile] of Object.entries(enemyTypes)){const item=document.createElement('span');item.append(sprite(type,'b'));item.title=`${profile.name}: ${profile.army.map(t=>names[t]).join(', ')}`;$('enemy-scale').append(item);}
const suppressClick=enableBoardDrag({scope,board:$('map'),
 canDrag:id=>!busy&&!mapTools.placing&&!editor.editing&&(run.stage==='exploring'||isShopping(run.stage))&&id===key(run.player.x,run.player.y)?{type:'k',color:'w'}:null,
 select:()=>{selected=true;renderMap();},
 drop:id=>{const [x,y]=id.split(',').map(Number);apply(()=>run.step(x-run.player.x,y-run.player.y),{dragged:true});},
 imageFor:p=>pieceImage(p,'neo',base),onCancel:()=>{selected=false;renderMap();},
});
$('map').addEventListener('click',event=>{if(mapTools.consumeClick(event.target)||editor.consumeClick(event.target)||busy||suppressClick()||camera.suppressClick())return;const cell=event.target.closest('[data-cell]');if(!cell)return;
 const dx=Number(cell.dataset.x)-run.player.x,dy=Number(cell.dataset.y)-run.player.y;
 if(!dx&&!dy){if(isShopping(run.stage)){buy();return;}const merchant=run.merchants?.find(m=>m.x===run.player.x&&m.y===run.player.y);if(merchant){apply(()=>{run.openMerchant(merchant);},{animate:false});return;}selected=!selected;renderMap();return;}apply(()=>run.step(dx,dy));
});
$('inventory').addEventListener('click',event=>editor.consumeClick(event.target));
for(const b of document.querySelectorAll('.dpad button'))b.addEventListener('click',()=>apply(()=>run.step(Number(b.dataset.dx),Number(b.dataset.dy))));
keyboard=setupMapKeyboard({scope,viewport:$('map-viewport'),dialogs:$('map-dialogs'),getStage:()=>run.stage,isBusy:()=>busy,isBlocked:()=>debug.isOpen||mapTools.placing||editor.editing||runPicker.isOpen,
 canRestart:()=>run.act===1&&run.floor===1&&run.stage==='exploring',restart:()=>apply(()=>{run=new Run(undefined,1,run.difficulty);},{animate:false}),
 changeVariation:()=>apply(()=>{const changed=changeActVariation(run);if(changed){cameraFloor=null;cameraPlayer=null;}return changed;},{animate:false}),
 step:(dx,dy)=>isShopping(run.stage)&&!dx&&!dy?buy():apply(()=>run.step(dx,dy)),selectKing:()=>{if(isShopping(run.stage)){buy();return;}const merchant=run.merchants?.find(m=>m.x===run.player.x&&m.y===run.player.y);if(merchant){apply(()=>run.openMerchant(merchant),{animate:false});return;}selected=!selected;renderMap();camera.center(run.player);},center:()=>camera.center(run.player)});
 function buy(){if(isMerchantStage(run.stage)){merchantUI.requestPurchase();return;}const item=run.shop?.items.find(i=>i.x===run.player.x&&i.y===run.player.y&&!i.sold);if(item)apply(()=>run.buyShop(item.id),{animate:false});}
 $('shop-buy').addEventListener('click',()=>{buy();$('map-viewport').focus();});
$('center-camera').addEventListener('click',()=>camera.center(run.player));
$('fight').addEventListener('click',()=>navigate(`./deployment.html?run=${encodeURIComponent(run.id)}`));
$('retreat').addEventListener('click',()=>apply(()=>run.retreat()));$('next-floor').addEventListener('click',()=>apply(()=>run.nextFloor(),{animate:false}));
$('new-run').addEventListener('click',()=>runPicker.open());
$('restart-run').addEventListener('click',()=>runPicker.open());
scope.on(window,'storage',event=>{if(event.key===runKey){try{run=loadRun()??run;render();}catch{/* Keep the current view if another tab writes an invalid save. */}}});
try{if(!needsDifficulty)persist();}catch{run.message='Не удалось сохранить забег. Проверьте доступ к хранилищу браузера.';}
render();if(needsDifficulty)runPicker.open(true);
function sizeInventory(){const tile=$('map').firstElementChild?.getBoundingClientRect().width??72;$('inventory').style.setProperty('--squad-size',`${tile*.88}px`);}
const inventoryObserver=new ResizeObserver(()=>{if(scope.active)sizeInventory();});inventoryObserver.observe($('map'));scope.cleanup(()=>inventoryObserver.disconnect());sizeInventory();






 scope.onPause(()=>sound.stop());scope.cleanup(()=>sound.dispose());
 return {resume(){run=loadRun()??run;busy=false;selected=false;camera.refresh();render();}};
}
