import {sampledSprite} from './sprite-sampling.js';

// Visual prototype only: movement and campaign spawn rules remain undecided.
export function dragonSprite(color,base='/'){
 if(color==='b')return `${base}pieces/neo/special/b-dragon-v3.png`;
 if(color==='wild')return `${base}pieces/wild/dragon-v2.png`;
 throw new Error('Дракон доступен только чёрным и диким');
}

export function setupDragonStudy(root){
 const section=document.createElement('section');section.id='dragon-study';section.className='dragon-study';
 section.innerHTML=`<p class="act-eyebrow">НОВАЯ ФИГУРА · АКТ III</p><h3>Дракон</h3><p>Чёрный дракон и его дикая алая форма. Ходы и способности пока не заданы.</p><div class="dragon-comparison">${[['b','Чёрный дракон'],['wild','Дикий дракон']].map(([color,name])=>`<figure><canvas data-dragon="${color}" width="720" height="320" role="img" aria-label="${name}: сравнение на светлой и тёмной клетке в размере 96 и 64 пикселя"></canvas><figcaption>${name}<small>96 px / 64 px</small></figcaption></figure>`).join('')}</div>`;
 root.append(section);
 for(const canvas of section.querySelectorAll('canvas')){
  const img=new Image();img.onload=()=>{
   const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   for(let i=0;i<3;i++){const size=i===2?64:96,x=i*120;ctx.fillStyle=i===1?'#b88963':'#efd8af';ctx.fillRect(x,0,120,160);ctx.drawImage(sampledSprite(img,size*2),x+(120-size)/2,132-size,size,size);}
   canvas.dataset.loaded='true';
  };img.src=dragonSprite(canvas.dataset.dragon,import.meta.env.BASE_URL);
 }
}
