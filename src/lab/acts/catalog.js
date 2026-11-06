import {biomeAppearance} from '../../biomes/appearance.js';
import {gardenDecorations} from '../../biomes/decoration.js';
import {freezePiece,permanentlyLost} from './preview-rules.js';
export const actVariants=[
 {id:'garden',act:1,name:'Растущий сад',subtitle:'Не оставляй фигуры одни.',rule:'Наступившая на лозу фигура пропускает одну следующую возможность действовать.',boss:'Садовник',accent:'#a6c78c',ground:'#15211b',terrain:'Удерживающие лозы',tactic:'Прикрытие и планирование отступления'},
 {id:'forge',act:2,name:'Кузница пешек',subtitle:'У каждой позиции есть срок.',rule:'Клетка нагревается, предупреждает, затем наносит 1 урон. Каменная броня принимает удар.',boss:'Литейщик',accent:'#edab79',ground:'#11100f',terrain:'Нагретая клетка',tactic:'Темп атаки и расход брони'},
 {id:'ice',act:2,name:'Замерзшие земли',subtitle:'Назад дороги может не быть.',rule:'Ледяная клетка только разрушается после ухода. Отдельное заклинание оледенения снимает броню до 1 HP без пропуска хода; взятая ледяная фигура теряется навсегда.',boss:'Хрустальный регент',accent:'#a6d9de',ground:'#15232e',terrain:'Хрупкий лёд',tactic:'Изменение маршрутов и отсечение противника'},
 {id:'crypt',act:2,name:'Некрополь',subtitle:'Сила тоже умеет молчать.',rule:'Жнец ходит и атакует по диагонали на одну или две клетки, не перепрыгивая фигуры. Воскрешение останков пока не реализовано.',boss:'Безмолвный епископ',accent:'#c1b3dc',ground:'#1d1925',terrain:'Останки фигур',tactic:'Останки на карте и в сражении · некроманты позднее'},
 {id:'ruins',act:3,name:'Расколотые палаты',subtitle:'Сначала найди путь.',rule:'Провалы прерывают линии. Конь может перепрыгнуть отсутствующие клетки.',boss:'Хранитель проходов',accent:'#d5b88b',ground:'#1b1d1b',terrain:'Провал',tactic:'Геометрия и контроль узких проходов'},
 {id:'court',act:4,name:'Дворец императора',subtitle:'Финальная резиденция.',rule:'Император: 3 HP, шаг как у короля. На 3–2 HP шаха нет; на 1 HP появляется шах и мат, агрессивная форма и урон 2 без эффекта усиления.',boss:'Император',accent:'#e4cb87',ground:'#1c1d19',terrain:'Концепция в разработке',tactic:'Император · правила обычного короля'},
].map(theme=>({...theme,...biomeAppearance[theme.id]}));

const coords=(...points)=>points.map(([x,y])=>({x,y}));
const routes={ruins:[[1,4],[2,2],[4,3],[3,1],[5,0]],garden:[[1,4],[2,2],[2,2],[4,3],[3,1]],forge:[[2,4],[2,2],[2,2],[4,2],[4,1]],ice:[[1,4],[2,2],[4,3],[3,1],[3,1]],crypt:[[1,4],[3,2],[3,2],[1,0],[2,1]],court:[[2,4],[2,4],[2,4],[2,4],[2,4]]};
const captions={
 ruins:['Разрыв режет линии; конь готов к прыжку.','Конь перепрыгнул провал.','Следующий прыжок вывел коня на другой фланг.','Конь обошёл узкий проход.','Проход обойдён: конь забирает пешку.'],
 garden:['Лоза заметна заранее — сюда можно войти, но нельзя сразу уйти.','Конь вошёл в лозу. Следующая возможность действовать будет пропущена.','Конь удерживается. Остальной отряд может действовать.','Лоза отпустила: конь снова перемещается.','Отряд продолжает наступление после задержки.'],
 forge:['Холодный металл. Ладья начинает с 2 HP.','Клетка раскаливается: предупреждение перед ударом.','Жар снял 1 HP. Ладью спасла каменная броня.','Ладья покинула остывающую клетку.','Выдержав жар, ладья берёт пешку.'],
 ice:['Алмазные фигуры до заклинания: 3 HP. Ледяные клетки не превращают фигуры.','Конь наступил на лёд: трескается только клетка; конь всё ещё алмазный.','Отдельное заклинание оледенило коня и ладью: 1 HP, движение сразу разрешено.','Конь ходит как обычно. Лёд под ним исчез; сам эффект оледенения остаётся.','Пешка взяла ледяного коня. Он потерян навсегда; чёрная ледяная ладья остаётся.'],
 crypt:['Белый и чёрный жнецы: обычные фигуры нового типа. Точки показывают допустимые клетки белого жнеца.','Жнец прошёл две клетки по диагонали.','Дальше двух клеток по диагонали пройти или атаковать нельзя.','Ещё один диагональный ход на две клетки.','Жнец может ходить и на одну клетку по диагонали.'],
 court:['3 HP: удар снимает броню, шаха императору нет.','2 HP: император по-прежнему не обязан уходить из-под атаки.','1 HP: появилась агрессивная форма; теперь действуют шах и мат.','Финальная форма наносит 2 урона без красного эффекта усиления.','Император побеждается матом на последней жизни. Проверка правил — в разделе эффектов материалов.'],
};

/** Deterministic visual vignettes, deliberately independent from Run/Stockfish. */
export function actScene(id,kind,step=0){
 const theme=actVariants.find(v=>v.id===id);if(!theme)throw Error('Неизвестный вариант акта');
 const s=Math.max(0,Math.min(4,Math.floor(step))),map=kind==='map',size=map?7:6;
 const walls=map?coords(...Array.from({length:7},(_,x)=>[x,0]),...Array.from({length:7},(_,x)=>[x,6]),...Array.from({length:5},(_,y)=>[0,y+1]),...Array.from({length:5},(_,y)=>[6,y+1]),[1,2],[1,3],[4,1]):[];
 const tiles=[],add=(type,points,extra={})=>tiles.push(...coords(...points).map(p=>({...p,type,...extra})));
 if(id==='ruins')add('hole',map?[[3,2],[3,3],[4,2]]:[[2,3],[3,3],[3,2]]);
 if(id==='garden')add('vine',map?[[4,3],[5,3]]:[[2,2],[3,3]],{active:s===1||s===2});
 if(id==='forge')add('heat',map?[[3,2],[4,2],[3,3]]:[[2,2],[3,2]],{phase:s===1||s===4?'warning':s===2?'active':'cool'});
 if(id==='ice'){
  add(s>=(map?3:2)?'hole':'ice',map?[[2,4]]:[[2,2]],{cracked:map?s===2:s===1});
  add('ice',map?[[3,3],[4,3]]:[[3,3]],{cracked:false});
  if(!map)add(s>=3?'hole':'ice',[[4,3]],{cracked:s===2});
 }
 if(id==='crypt'){
  add('remains',map?[[4,3],[3,2],[2,3]]:[[1,2],[3,3],[4,2]]);
  tiles.forEach((tile,i)=>{tile.role=['n','b','r'][i];});
 }
 const decorations=[];
 if(id==='garden'){
  const blocked=new Set([...walls,...tiles].map(p=>p.x+','+p.y)),eligible=[];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!blocked.has(x+','+y))eligible.push({x,y});
  decorations.push(...gardenDecorations(eligible));
 }
 // Third act intentionally has no proposed terrain law yet.
 const target=routes[id][s],position=map?[[1,5],[2,5],[2,4],[3,4],[4,4]][s]:target;
 const pieces=map?[
  {x:position[0],y:position[1],type:'k',color:'w'},
  {x:5,y:4,type:id==='court'?'q':id==='garden'?'b':'r',color:'b'},
 ]:[
  {x:4,y:5,type:'k',color:'w'}, {x:0,y:4,type:'p',color:'w'},
  {x:target[0],y:target[1],type:id==='forge'||id==='crypt'?'r':'n',color:'w',material:id==='forge'?'stone':undefined,hp:id==='forge'?(s>=2?1:2):1,rooted:id==='garden'&&s===2,cursed:false},
  {x:5,y:0,type:'k',color:'b'}, {x:0,y:0,type:id==='court'?'q':'r',color:'b'},
  ...(id==='crypt'?[{x:2,y:0,type:'b',color:'b'}]:[]),
  ...(id==='ruins'?[{x:5,y:0,type:'p',color:'b'}]:[{x:4,y:1,type:'p',color:'b'}]),
 ];
 // Keep the ordinary king and a capture target on distinct squares.
 if(!map&&id==='ruins'){pieces.find(p=>p.color==='b'&&p.type==='k').x=4;if(s===4)pieces.splice(pieces.findIndex(p=>p.color==='b'&&p.type==='p'),1);}
 if(!map&&id==='forge'&&s===4)pieces.splice(pieces.findIndex(p=>p.color==='b'&&p.type==='p'),1);
 if(id==='court'){const emperor=pieces.find(p=>p.color==='b'&&(map||p.type==='k'));emperor.type='k';emperor.skin='emperor';emperor.hp=s===0?3:s===1?2:1;
  pieces.push({x:map?4:1,y:map?3:1,type:'dragon',skin:'dragon',color:'b'},{x:map?2:5,y:map?2:3,type:'dragon',skin:'dragon',color:'wild'});
 }
 if(id==='crypt'){if(map){pieces[1].type='reaper';pieces[1].skin='reaper';}else for(const piece of pieces)if(piece.type==='b'||piece.color==='w'&&piece.type==='r'){piece.type='reaper';piece.skin='reaper';}}
 if(id==='ice'&&!map){for(let i=0;i<pieces.length;i++){const piece=pieces[i];if(piece.color==='w'&&piece.type==='n'||piece.color==='b'&&piece.type==='r'){piece.material='diamond';piece.hp=3;if(s>=2)pieces[i]=freezePiece(piece);}}}
 let lost=[];
 if(id==='ice'&&!map){const pawn=pieces.find(p=>p.type==='p'&&p.color==='b');pawn.y=0;if(s===4){const index=pieces.findIndex(p=>p.type==='n'&&p.color==='w');const victim=pieces[index];if(permanentlyLost(victim,true))lost=[{...victim,captured:true}];pieces.splice(index,1);pawn.x=3;pawn.y=1;}}
 const focus=map?null:pieces.find(p=>p.color==='w'&&p.type!=='k'&&p.type!=='p');
 const arrow=!map&&s>0&&!(id==='garden'&&s===2)&&id!=='court'&&!(id==='ice'&&s===4)?{from:routes[id][s-1],to:routes[id][s]}:null;
 return {id,kind,size,step:s,theme,walls,tiles,decorations,pieces,lost,focus,arrow,exit:map?{x:5,y:1}:null,caption:captions[id][s],next:captions[id][Math.min(4,s+1)],phase:id==='court'?`${s===0?3:s===1?2:1} HP · ${s<2?'без шаха':'шах и мат'}`:id==='forge'?['Холод','Предупреждение','Удар жара','Остывание','Предупреждение'][s]:`Шаг ${s+1} / 5`};
}
