import {drawVines} from '../acts/vegetation.js';
import {createIceShader} from '../acts/ice-shader.js';
import {drawHeat,heatAmount} from '../acts/heat.js';
import {gardenSprite} from '../acts/preview-rules.js';
import {drawIceFallback} from '../../biomes/ice-fallback.js';
import {remainsImage} from '../acts/draw.js';
import {terrainSeed} from '../../biomes/appearance.js';

export const studyTerrain={
 garden:{label:'Трава и цветы · лоза на одной клетке',animated:true},
 forge:{label:'Раскалённые трещины на одной клетке',animated:true},
 ice:{label:'Хрупкий лёд · целая и треснувшая клетки',animated:true},
 crypt:{label:'Останки · холодная приземная дымка',animated:true},
 ruins:{label:'Один провал в поле',animated:false},
 court:{label:'Чистое поле дворца',animated:false},
};

/** Existing act visuals over the swatches; all ice/heat tiles share one shader. */
export function createActStudyEffects(slots,requestRender,onStatus){
 const records=[],images=new Map();let shader,enabled=true,disposed=false;
 const base=import.meta.env.BASE_URL;
 function image(url){
  if(!images.has(url)){
   const img=new Image();img.onload=()=>{if(!disposed)requestRender();};
   img.onerror=()=>{if(!disposed)onStatus('Не удалось загрузить одну из масок эффектов актов.');};
   img.src=url;images.set(url,img);
  }
  return images.get(url);
 }
 for(const slot of slots){
  if(!slot.biome||slot.wall||slot.biome==='court')continue;
  const canvas=document.createElement('canvas');canvas.className='study-terrain';
  canvas.width=canvas.height=256;canvas.setAttribute('aria-hidden','true');canvas.dataset.biome=slot.biome;
  slot.element.append(canvas);
  records.push({slot,canvas,ctx:canvas.getContext('2d'),seed:terrainSeed('1,1')});
  if(slot.biome==='garden'){image(gardenSprite('grass',base));image(gardenSprite('flowers',base));}
  if(slot.biome==='crypt')image(remainsImage('n',base));
 }
 function plant(ctx,type,x,y,u,rotation){
  const img=images.get(gardenSprite(type,base));if(!img?.complete||!img.naturalWidth)return;
  ctx.save();ctx.translate(x+u*.5,y+u*.5);ctx.rotate(rotation);ctx.globalAlpha=.57;
  ctx.drawImage(img,-u*.46,-u*.46,u*.92,u*.92);ctx.restore();
 }
 function iceShader(){if(shader===undefined)shader=createIceShader();return shader;}
 function drawTile(record,time,age){
  const {ctx,canvas,slot,seed}=record,u=canvas.width/2;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  switch(slot.biome){
   case 'garden':
    plant(ctx,'grass',0,0,u,Math.PI*.5);plant(ctx,'flowers',0,u,u,Math.PI);
    drawVines(ctx,u,u,u,time,age,seed,false);
    break;
   case 'forge':{
    const phase=['cool','warning','active','cool'],cycle=(time+7.2)/3.6,index=Math.floor(cycle)%4;
    const amount=heatAmount(phase[(index+3)%4],phase[index],(cycle%1)*3.6);
    if(!iceShader()?.heat(ctx,u,u,u,time,seed,amount))drawHeat(ctx,u,u,u,time,amount,seed);
    break;
   }
   case 'ice':
    if(!iceShader()?.draw(ctx,u,0,u,time,terrainSeed('1,0'),false))drawIceFallback(ctx,u,0,u,time,false);
    if(!iceShader()?.draw(ctx,u,u,u,time,seed,true))drawIceFallback(ctx,u,u,u,time,true);
    break;
   case 'crypt':{
    ctx.save();
    for(let i=0;i<2;i++){
     const x=u*(.4+i*.9+Math.sin(time*.10+i*3.)*.45),y=u*(.6+i*.7);
     const mist=ctx.createRadialGradient(x,y,0,x,y,u*1.25);
     mist.addColorStop(0,'#b3c5bd0a');mist.addColorStop(.5,'#758d8606');mist.addColorStop(1,'#758d8600');
     ctx.fillStyle=mist;ctx.fillRect(0,0,u*2,u*2);
    }
    ctx.restore();
    const img=images.get(remainsImage('n',base));
    if(img?.complete&&img.naturalWidth)ctx.drawImage(img,u*.06,u*1.06,u*.88,u*.88);
    break;
   }
   case 'ruins':
    // The game's hole removes the terrain tile; no raised rim or fake side faces.
    ctx.fillStyle='#141713';ctx.fillRect(u,u,u,u);
    break;
  }
 }
 return {
  draw(time,visible,impacts){
   let animated=false;
   for(const record of records){
    record.canvas.hidden=!enabled;
    if(!enabled||!visible.has(record.slot.element))continue;
    const age=impacts.has(record.slot.sample.id)?time-impacts.get(record.slot.sample.id):6;
    drawTile(record,time,age);
    animated||=studyTerrain[record.slot.biome].animated;
   }
   return animated;
  },
  setEnabled(value){enabled=value;records.forEach(r=>{r.canvas.hidden=!enabled;});requestRender();},
  dispose(){disposed=true;records.forEach(r=>r.canvas.remove());for(const img of images.values()){img.onload=null;img.onerror=null;}images.clear();shader?.dispose?.();shader=null;},
 };
}
