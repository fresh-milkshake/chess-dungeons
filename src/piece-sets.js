export const pieceSets = [
  { id: 'neo', name: 'Chess.com', detail: 'Neo', directory: 'pieces/neo', extension: 'png', lowercase: true },
];
export const defaultPieceSet = 'neo';
export const materials = [
  {id:'stone',name:'Каменные'}, {id:'ethereal',name:'Эфирные'},
  {id:'glass',name:'Стеклянные'}, {id:'diamond',name:'Алмазные'},
];
export function pieceMaterial(piece) {
  if (piece.type.toLowerCase() === 'k'||piece.iced) return null;
  if (materials.some(m=>m.id===piece.material)) return piece.material;
  if (piece.hp===3) return 'diamond';
  if (piece.hp===2) return 'stone';
  return piece.glass ? 'glass' : null;
}
export function pieceImage(piece, _setId = defaultPieceSet, baseUrl = './') {
  if(piece.emperor)return `${baseUrl}pieces/neo/special/${piece.hp===1?'b-emperor-final':'b-emperor-v2'}.png`;
  if(piece.type==='d')return `${baseUrl}pieces/${piece.color==='wild'||piece.wild?'wild/dragon-v2.png':'neo/special/b-dragon-v3.png'}`;
  if(piece.type==='j')return `${baseUrl}pieces/neo/special/b-reaper-v2.png`;
  if(piece.color==='wild'||piece.wild)return `${baseUrl}pieces/wild/${piece.type.toLowerCase()}.png`;
  const material = pieceMaterial(piece);
  return `${baseUrl}pieces/neo/${material ? material+'/' : ''}${piece.color}${piece.type.toLowerCase()}.png`;
}
