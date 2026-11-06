import {files} from '../battle/coordinates.js';
import {readWorld} from '../biomes/world.js';
export const scenarios = [
  { id: 'stone', name: 'Каменная защита', description: 'Ладья a1 снимет защиту с ладьи a4 и останется на месте. Усиленный конь c3 уничтожит её одним ударом.', fen: '6k1/8/8/8/r7/2N5/8/R5K1 w - - 0 1 @hunt=1;a4=2/1/0;c3=1/2/0' },
  { id: 'diamond', name: 'Алмазная защита', description: 'Конь f4 наносит 2 урона. После удара по ферзю d5 у него останется 1 HP, а конь останется на f4.', fen: '6k1/8/8/3q4/5N2/8/8/6K1 w - - 0 1 @hunt=1;d5=3/1/0;f4=1/2/0' },
  { id: 'pin', name: 'Удар связанной фигурой', description: 'Ладья e2 прикрывает короля от ладьи e8. Она может ударить каменного слона a2, поскольку при ударе остаётся на e2.', fen: '4r1k1/8/8/8/8/8/b3R3/4K3 w - - 0 1 @hunt=1;a2=2/1/0' },
  { id: 'glass', name: 'Стеклянная цель', description: 'Белый конь c3 — стеклянный. У обычного противника есть небольшой дополнительный стимул его уничтожить. У босса этого бонуса нет.', fen: '6k1/8/8/3r4/8/2N1B3/8/6K1 b - - 0 1 @hunt=1;c3=1/1/1' },
  { id: 'ethereal', name: 'Эфирные фигуры', description: 'Эфирные фигуры в текущем бою играют как обычные. Их одноразовое использование относится к будущему режиму забега.', ethereal: ['c3','e6'], fen: '6k1/8/4b3/8/8/2N5/8/6K1 w - - 0 1 @hunt=1' },
];

export function parsePosition(fen) {
  const [ordinary, metadata = ''] = fen.split(' @');
  const [placement, turn] = ordinary.split(' ');
  const pieces = new Map(), walls = new Set();
  const height=placement.split('/').length;let width=8;
  placement.split('/').forEach((row, rank) => {
    let file = 0;
    for (const code of row.match(/\d+|[^\d]/g)??[]) {
      if (/\d/.test(code)) file += Number(code);
      else if(code==='*')walls.add(`${files[file++]}${height-rank}`);
      else {
        pieces.set(`${files[file++]}${height-rank}`, { color: code === code.toUpperCase() ? 'w' : 'b', type: code.toLowerCase(), hp: 1, damage: 1, glass: false });
      }
    }
    width=Math.max(width,file);
  });
  for (const entry of metadata.split(';')) {
    const wild=entry.match(/^wild=([a-p]\d{1,2})\|([a-zA-Z0-9-]+)\|([-wb])$/);
    if(wild&&pieces.has(wild[1]))Object.assign(pieces.get(wild[1]),{color:'wild',wildId:wild[2],aggro:wild[3]==='-'?null:wild[3]});
    const emperor=entry.match(/^emperor=([a-p]\d{1,2})\|([1-3])$/);if(emperor&&pieces.get(emperor[1])?.type==='k')Object.assign(pieces.get(emperor[1]),{emperor:true,hp:Number(emperor[2]),damage:emperor[2]==='1'?2:1});
    const match = entry.match(/^([a-p]\d{1,2})=([1-3])\/([12])\/([01])$/);
    if (match && pieces.has(match[1]) && pieces.get(match[1]).type !== 'k') Object.assign(pieces.get(match[1]), { hp: Number(match[2]), damage: Number(match[3]), glass: match[4] === '1' });
  }
  for(const entry of metadata.split(';')){const status=entry.match(/^status=([a-p]\d{1,2})\|([01])\|([01])$/);if(status&&pieces.has(status[1]))Object.assign(pieces.get(status[1]),{iced:status[2]==='1',cursed:status[3]==='1'});}
  for(const entry of metadata.split(';')){const curse=entry.match(/^curse=([a-p]\d{1,2})\|([12])\|([01])$/);if(curse&&pieces.has(curse[1]))Object.assign(pieces.get(curse[1]),{cursed:true,curseTurns:Number(curse[2]),curseBase:curse[3]==='1'});}
  const relics=metadata.match(/(?:^|;)relics=([01]),([01])(?:;|$)/);if(relics)pieces.relics={glassAvailable:Number(relics[1]),glassUsed:Number(relics[2])};
  const world=readWorld(fen);if(world)pieces.world=world;
  for(const entry of metadata.split(';')){const root=entry.match(/^root=([a-p]\d{1,2})\|([12])$/);if(root&&pieces.has(root[1]))pieces.get(root[1]).rooted=Number(root[2]);}
  const neutral=new Set(metadata.match(/(?:^|;)truce=([^;]*)/)?.[1].split(',')??[]);for(const p of pieces.values())if(p.color==='wild')p.neutral=neutral.has(p.wildId);
  const open=[];for(let rank=1;rank<=height;rank++)for(const file of files.slice(0,width))if(!walls.has(file+rank))open.push(file+rank);
  const bounds={left:Math.min(...open.map(s=>s.charCodeAt(0)-97)),right:Math.max(...open.map(s=>s.charCodeAt(0)-97)),bottom:Math.min(...open.map(s=>Number(s.slice(1)))),top:Math.max(...open.map(s=>Number(s.slice(1))))};
  const cutouts=[...walls].filter(s=>s.charCodeAt(0)-97>=bounds.left&&s.charCodeAt(0)-97<=bounds.right&&Number(s.slice(1))>=bounds.bottom&&Number(s.slice(1))<=bounds.top);
  if(cutouts.length)bounds.cutouts=cutouts;
  return { pieces, turn, walls, bounds };
}
