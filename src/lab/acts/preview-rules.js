import {dragonSprite} from './dragon.js';
// Lab-only rules: these do not register new pieces or statuses in the campaign engine.
export function freezePiece(piece){
 if(piece.type==='k')return {...piece};
 return {...piece,material:undefined,glass:false,hp:1,iced:true,frozenTurns:0,permanentLoss:true};
}
export function canPreviewMove(){return true;}
export function permanentlyLost(piece,captured){return !!captured&&!!(piece.iced||piece.permanentLoss||piece.glass||piece.material==='glass');}
export function reaperMoves(piece,pieces,size){
 const result=[];
 for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]])for(let n=1;n<=2;n++){
  const x=piece.x+dx*n,y=piece.y+dy*n;if(x<0||y<0||x>=size||y>=size)break;
  const occupant=pieces.find(p=>p!==piece&&p.x===x&&p.y===y);
  if(!occupant||occupant.color!==piece.color)result.push({x,y,capture:!!occupant});
  if(occupant)break;
 }
 return result;
}
export function previewSprite(piece,base){
 if(piece.skin==='dragon')return dragonSprite(piece.color,base);
 if(piece.skin==='emperor'&&piece.hp===1)return `${base}pieces/neo/special/b-emperor-final.png`;
 return piece.skin?`${base}pieces/neo/special/${piece.color}-${piece.skin}-v2.png`:null;
}
export function gardenSprite(type,base){return `${base}terrain/garden/${type==='grass'||type==='clover'?'grass':'flowers'}.png`;}
