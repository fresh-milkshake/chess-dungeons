// Progressive downsampling avoids one-step aliasing of large generated outlines.
const pyramids=new WeakMap();
export function sampledSprite(image,pixels){
 if(typeof document==='undefined'||!image?.naturalWidth)return image;
 let levels=pyramids.get(image);
 if(!levels){let source=image,width=image.naturalWidth;
  if(image.naturalWidth!==image.naturalHeight){
   const square=document.createElement('canvas');width=Math.max(image.naturalWidth,image.naturalHeight);square.width=square.height=width;
   const ctx=square.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,(width-image.naturalWidth)/2,(width-image.naturalHeight)/2);source=square;
  }
  levels=[source];
  while(width>64){const next=document.createElement('canvas');next.width=next.height=Math.ceil(width/2);const ctx=next.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,next.width,next.height);levels.push(next);source=next;width=next.width;}
  pyramids.set(image,levels);
 }
 let chosen=levels[0];for(const level of levels){if((level.naturalWidth??level.width)<pixels)break;chosen=level;}return chosen;
}
