import {drawIceFallback} from '../../biomes/ice-fallback.js';
import {pieceImage} from '../../piece-sets.js';
import {drawVines} from './vegetation.js';
import {drawHeat,heatAmount} from './heat.js';
import {previewSprite,gardenSprite,reaperMoves} from './preview-rules.js';
import {sampledSprite} from './sprite-sampling.js';
import {furnaceLights} from './atmosphere.js';
import {terrainSeed} from '../../biomes/appearance.js';
import {drawAtlasShadows,drawPieceContact} from './atlas-shadows.js';
export const remainsImage=(role,base)=>`${base}pieces/neo/ruins/${role}.png`;

const TAU=Math.PI*2;
export const sceneSize=320;
const clamp=n=>Math.max(0,Math.min(1,n));
const terrainNames={hole:'Провал · нельзя встать',vine:'Лозы · задержка на ход',heat:'Жар',ice:'Хрупкий лёд',remains:'Разбитая нейтральная фигура · пока без воскрешения',curse:'Проклятие',seal:'Неактивная королевская печать'};
export function sceneCell(canvas,event,size){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*sceneSize/r.width,y=(event.clientY-r.top)*sceneSize/r.height;const unit=288/size,col=Math.floor((x-16)/unit),row=Math.floor((y-16)/unit);return col>=0&&row>=0&&col<size&&row<size?{x:col,y:row}:null;}
export function describeCell(scene,cell){
 if(!cell)return 'Наведите на клетку, чтобы рассмотреть её.';
 const at=p=>p.x===cell.x&&p.y===cell.y,piece=scene.pieces.find(at),tile=scene.tiles.find(at);
 const names={k:'король',q:'ферзь',r:'ладья',b:'слон',n:'конь',p:'пешка',reaper:'жнец',dragon:'дракон'};
 return `${String.fromCharCode(97+cell.x)}${scene.size-cell.y} · ${scene.walls.some(at)?'Стена':tile?terrainNames[tile.type]+(tile.cracked?' · треснул':tile.phase==='warning'?' · предупреждение':tile.phase==='active'?' · активен':''):'Обычная клетка'}${piece?` · ${piece.color==='w'?'Белые':piece.color==='wild'?'Дикие':'Чёрные'}: ${piece.skin==='emperor'?'император':names[piece.type]}${piece.rooted?' · удерживается':''}${piece.cursed?' · проклятие':''}${piece.iced?` · ледяной · потеря навсегда при взятии · 1 HP`:''}${piece.material==='stone'?` · камень, ${piece.hp} HP`:''}`:''}`;
}

function line(ctx,points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
export function drawActScene(ctx,scene,images,time,{selected=null,progress=1,age=10,previous=null,iceShader=null,materials=null,fog=false}={}){
 const {theme,size}=scene,u=288/size,ox=16,oy=16;ctx.clearRect(0,0,sceneSize,sceneSize);
 const walls=new Set(scene.walls.map(p=>p.x+','+p.y)),holes=new Set(scene.tiles.filter(p=>p.type==='hole').map(p=>p.x+','+p.y));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=ox+x*u,py=oy+y*u;if(holes.has(x+','+y))continue;
  if(materials){if(!walls.has(x+','+y))materials.cell(ctx,scene.id,x,y,px,py,u,false);continue;}
  ctx.fillStyle=(x+y)%2?theme.dark:theme.light;ctx.fillRect(px,py,u+.2,u+.2);
  // Sparse deterministic wear follows the board rather than animated pixels.
  if((x*7+y*3)%5===0){line(ctx,[[px+u*.12,py+u*.17],[px+u*.21,py+u*.23],[px+u*.18,py+u*.32]],'#3333331f',.7);}
  if(walls.has(x+','+y)){
   ctx.fillStyle=theme.wall;ctx.fillRect(px,py,u+.2,u+.2);
   if(!walls.has(x+','+(y-1)))line(ctx,[[px,py+2],[px+u,py+2]],theme.light+'55',2);
   if(!walls.has((x+1)+','+y))line(ctx,[[px+u-2,py],[px+u-2,py+u]],'#0005',3);
   if(!walls.has(x+','+(y+1)))line(ctx,[[px,py+u-2],[px+u,py+u-2]],'#0007',3);
  }
 }
 for(const d of scene.decorations??[]){const img=images.get(gardenSprite(d.type,(import.meta.env?.BASE_URL??'./')));if(img?.complete&&img.naturalWidth){ctx.save();ctx.translate(ox+(d.x+.5)*u,oy+(d.y+.5)*u);ctx.rotate(((d.x*3+d.y)%4)*Math.PI/2);ctx.globalAlpha=.57;ctx.drawImage(img,-u*.46,-u*.46,u*.92,u*.92);ctx.restore();}}
 if(materials){materials.walls(ctx,scene.id,walls,size);drawAtlasShadows(ctx,walls,holes,size);}
 for(const tile of scene.tiles){const x=ox+tile.x*u,y=oy+tile.y*u;
  const seed=terrainSeed(`${tile.x},${tile.y}`);
  if(tile.type==='vine')drawVines(ctx,x,y,u,time,age,seed,tile.active);
  else if(tile.type==='heat'){const old=previous?.tiles.find(t=>t.x===tile.x&&t.y===tile.y),amount=heatAmount(old?.phase??tile.phase,tile.phase,age);if(!iceShader?.heat(ctx,x,y,u,time,seed,amount))drawHeat(ctx,x,y,u,time,amount,seed);}
  else if(tile.type==='ice'){if(!iceShader?.draw(ctx,x,y,u,time,seed,tile.cracked))drawIceFallback(ctx,x,y,u,time,tile.cracked);}
  else if(tile.type==='remains'){const img=images.get(remainsImage(tile.role,(import.meta.env?.BASE_URL??'./')));if(img?.complete&&img.naturalWidth)ctx.drawImage(img,x+u*.06,y+u*.06,u*.88,u*.88);}
 }
 if(scene.id==='forge')furnaceLights(ctx,scene,previous,age,time);
 if(scene.exit){const x=ox+(scene.exit.x+.5)*u,y=oy+(scene.exit.y+.5)*u;ctx.strokeStyle=theme.accent;ctx.lineWidth=2;ctx.strokeRect(x-u*.2,y-u*.3,u*.4,u*.6);line(ctx,[[x-u*.3,y+u*.33],[x+u*.3,y+u*.33]],theme.accent,1.5);}
 if(scene.arrow){const {from,to}=scene.arrow;if(from[0]!==to[0]||from[1]!==to[1]){ctx.setLineDash([2,4]);line(ctx,[[ox+(from[0]+.5)*u,oy+(from[1]+.5)*u],[ox+(to[0]+.5)*u,oy+(to[1]+.5)*u]],theme.accent+'bb',1.5);ctx.setLineDash([]);}}
 // Clear holes only in the terrain layer, before sprites can cross them.
 if(scene.kind==='map'&&!materials){
  const player=scene.pieces[0],cx=ox+(player.x+.5)*u,cy=oy+(player.y+.5)*u;
  const mist=ctx.createRadialGradient(cx,cy,u*1.7,cx,cy,u*5.7);mist.addColorStop(0,'#111a2100');mist.addColorStop(1,'#111a21aa');ctx.fillStyle=mist;ctx.fillRect(ox,oy,288,288);
 }
 for(const tile of scene.tiles)if(tile.type==='hole')ctx.clearRect(ox+tile.x*u,oy+tile.y*u,u,u);
 if(scene.id==='crypt'&&scene.kind==='battle'&&scene.focus?.type==='reaper')for(const p of reaperMoves(scene.focus,scene.pieces,size)){circle(ctx,ox+(p.x+.5)*u,oy+(p.y+.5)*u,u*.07,theme.accent+'80');}
 for(const piece of scene.pieces){
  let x=piece.x,y=piece.y;
  const motion=progress;
  if(piece===scene.focus&&scene.arrow&&motion<1){const a=clamp(motion),ease=a*a*(3-2*a);x=scene.arrow.from[0]+(x-scene.arrow.from[0])*ease;y=scene.arrow.from[1]+(y-scene.arrow.from[1])*ease;}
  const px=ox+(x+.5)*u,py=oy+(y+.5)*u,url=previewSprite(piece,(import.meta.env?.BASE_URL??'./'))??pieceImage(piece,'neo',(import.meta.env?.BASE_URL??'./')),img=images.get(url);
  if(piece===scene.focus){circle(ctx,px,py+u*.25,u*.32,theme.accent+'28');}
  if(materials)drawPieceContact(ctx,px,py,u);
  if(img?.complete&&img.naturalWidth){ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.shadowColor=piece.color==='b'?'#e4dac755':'#0009';ctx.shadowBlur=piece.color==='b'?2:3;ctx.shadowOffsetY=1;const sample=piece.skin?sampledSprite(img,u*.9*(ctx.getTransform?.()?.a??1)):img;
   if(!piece.iced||!iceShader?.frozen(ctx,px-u*.45,py-u*.45,u*.9,time,img))ctx.drawImage(sample,px-u*.45,py-u*.45,u*.9,u*.9);ctx.restore();}
  if(piece.material==='stone'||piece.material==='diamond'||piece.iced||piece.skin==='emperor'){circle(ctx,px+u*.29,py-u*.3,u*.12,piece.iced?'#24546b':'#383b3a');ctx.fillStyle='#f4e9d4';ctx.font=`600 ${u*.15}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(piece.hp),px+u*.29,py-u*.245);}
  if(piece.rooted)drawVines(ctx,px-u*.43,py-u*.43,u*.86,time,age,841,true);
  if(piece.cursed){ctx.strokeStyle='#d9acf0';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(px,py+u*.31,u*.35,u*.09,0,0,TAU);ctx.stroke();line(ctx,[[px-u*.12,py-u*.4],[px+u*.12,py-u*.18]],'#ddbaeb',1.6);line(ctx,[[px+u*.12,py-u*.4],[px-u*.12,py-u*.18]],'#ddbaeb',1.6);}
 }
 if(selected&&!holes.has(selected.x+','+selected.y)){ctx.strokeStyle=theme.accent;ctx.lineWidth=2;ctx.strokeRect(ox+selected.x*u+1,oy+selected.y*u+1,u-2,u-2);}
 if(scene.kind==='battle'){ctx.fillStyle=theme.accent+'aa';ctx.font='9px sans-serif';ctx.textAlign='center';for(let i=0;i<size;i++){ctx.fillText(String.fromCharCode(97+i),ox+(i+.5)*u,sceneSize-5);ctx.fillText(String(size-i),7,oy+(i+.53)*u);}}
 if(scene.kind==='map'&&fog&&materials)materials.fog(ctx,scene.id,time);
}
