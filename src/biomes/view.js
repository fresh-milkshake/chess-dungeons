import {drawVines} from '../lab/acts/vegetation.js';
import {createIceShader} from '../lab/acts/ice-shader.js';
import {heatPhase} from './world.js';
import './view.css';
import {renderMapOutline,renderBoardOutline} from './board-outline.js';
import {biomeAppearance,terrainSeed} from './appearance.js';
import {gardenDecorations,keepTerrainOverlay} from './decoration.js';
import {drawHeat,heatAmount} from '../lab/acts/heat.js';
import {gardenSprite} from '../lab/acts/preview-rules.js';
import {drawIceFallback} from './ice-fallback.js';
const records=new Map(),starts=new WeakMap();let shader,request=0,previous=0;
function tick(now){
 request=0;if(document.hidden){request=requestAnimationFrame(tick);return;}
 if(now-previous<1000/24){request=requestAnimationFrame(tick);return;}previous=now;
 for(const [canvas,r] of records){if(!canvas.isConnected){records.delete(canvas);continue;}const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth||!rect.width)continue;
  const age=(now-r.start)/1000;if(r.kind==='vine'&&age>3.5&&r.drawn)continue;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);const t=now/1000;
  if(r.kind==='vine')drawVines(ctx,0,0,256,t,age,r.seed,r.rooted);
  if(r.kind==='ice'){if(shader===undefined)shader=createIceShader();if(!shader?.draw(ctx,0,0,256,t,r.seed,r.cracked))drawIceFallback(ctx,0,0,256,t,r.cracked);}
  if(r.kind==='heat'){
   if(shader===undefined)shader=createIceShader();const phase=heatPhase(r.world);
   if(r.phase!==phase){r.previousPhase=r.phase??phase;r.phase=phase;r.phaseStart=now;}
   r.amount=heatAmount(r.previousPhase,phase,(now-r.phaseStart)/1000);
   if(!shader?.heat(ctx,0,0,256,t,r.seed,r.amount))drawHeat(ctx,0,0,256,t,r.amount,r.seed);
  }
  r.drawn=true;
 }
 if(records.size)request=requestAnimationFrame(tick);
}
export function renderTerrain(board,world,pieces=new Map(),floorCells=null){
 if(!board)return;board.dataset.biome=world?.biome??'';
 const theme=biomeAppearance[world?.biome];for(const key of ['wall','light','dark'])if(theme)board.style.setProperty(`--${key}`,theme[key]);else board.style.removeProperty(`--${key}`);
 if(!world){if(board.id==='map')renderBoardOutline(board,null,false);return;}
 let clock=starts.get(board);if(!clock||clock.key!==world.key){clock={key:world.key,start:performance.now()};starts.set(board,clock);}const start=clock.start;
 const plainCells=[...board.children].filter(c=>{const id=c.dataset.cell??c.dataset.square;return id&&(floorCells?floorCells.has(id):!c.classList.contains('wall'))&&!world.tiles[id];});
 const decorations=new Map(world.biome==='garden'?gardenDecorations(plainCells.map(cell=>{const id=cell.dataset.cell??cell.dataset.square;const [x,y]=id.includes(',')?id.split(',').map(Number):[id.charCodeAt(0)-97,Number(id.slice(1))];return {id,x,y};})).map(p=>[p.id,p]):[]);
 for(const cell of board.children){const id=cell.dataset.cell??cell.dataset.square;if(!id)continue;const kind=world.tiles[id],rooted=!!pieces.get(id)?.rooted;
  cell.classList.toggle('biome-hole',kind==='hole'&&!cell.classList.contains('unseen'));cell.classList.toggle('biome-rooted',rooted);
  const decoration=decorations.get(id);let grass=cell.querySelector(':scope > .garden-decoration');
  if(decoration&&!cell.classList.contains('unseen')){
   if(!grass){grass=document.createElement('span');grass.className='garden-decoration';grass.setAttribute('aria-hidden','true');cell.append(grass);}
   grass.style.backgroundImage=`url("${gardenSprite(decoration.type,import.meta.env.BASE_URL)}")`;
   grass.style.transform=`rotate(${((decoration.x*3+decoration.y)%4)*90}deg)`;
  }else grass?.remove();
  for(const overlay of cell.querySelectorAll(':scope > .terrain-effect'))if(!keepTerrainOverlay(kind,rooted,cell.classList.contains('unseen'),overlay.dataset)){records.delete(overlay);overlay.remove();}
  for(const [type,over] of [[kind,false],...(rooted?[['vine',true]]:[])]){
   if(!['vine','heat','ice'].includes(type)||cell.classList.contains('unseen'))continue;
   let canvas=cell.querySelector(`:scope > .terrain-effect[data-rooted="${over}"]`);
   if(!canvas){canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.className='terrain-effect';canvas.dataset.kind=type;canvas.dataset.rooted=String(over);canvas.setAttribute('aria-hidden','true');cell.append(canvas);}
   let record=records.get(canvas);if(!record){record={start:over?performance.now():start,seed:terrainSeed(id),kind:type,rooted:over};records.set(canvas,record);}record.world=world;record.cracked=pieces.has(id);
  }
 }
 if(board.id==='map')renderMapOutline(board);
 if(!request&&records.size)request=requestAnimationFrame(tick);
}
