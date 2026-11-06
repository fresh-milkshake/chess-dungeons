import {emperorFixture,emperorStatus,moveEmperorLab,emperorDamage} from './emperor-rules.js';
import {pieceImage} from '../../piece-sets.js';
import {previewSprite} from './preview-rules.js';
export function setupEmperorMechanics(root){
 root.innerHTML=`<h2>Три жизни императора</h2><p>3–2 HP: шаг на одну клетку в любую сторону, урон 1, шаха императору нет. При 1 HP: обычные шах и мат, урон 2, агрессивная форма без эффекта усиления.</p><div class="imperial-controls"><label>Проверка <select aria-label="Сценарий императора"><option value="armor">Снять броню</option><option value="damage">Урон по алмазной пешке</option><option value="mate">Проверка мата</option></select></label><div role="group" aria-label="Здоровье императора">${[3,2,1].map(hp=>`<button data-hp="${hp}">${hp} HP</button>`).join('')}</div><button class="imperial-reset">Сбросить</button><button class="imperial-undo">Отменить ход</button></div><div class="imperial-test"><div class="imperial-board" role="group" aria-label="Поле проверки императора"></div><div><strong class="imperial-stage"></strong><p class="imperial-state" role="status"></p><p>Управляйте обеими сторонами: выберите фигуру, затем подсвеченную клетку. При ударе по броне атакующий остаётся на месте.</p><p>На последней жизни императора нельзя взять как обычную фигуру — нужно поставить мат. Урон не позволяет перескочить эту стадию.</p><p>Изолированная проверка правил, без ИИ и изменений текущего забега.</p></div></div>`;
 let fixture='armor',hp=3,state=emperorFixture(fixture,hp),selected=null,history=[];
 const board=root.querySelector('.imperial-board'),select=root.querySelector('select');
 function render(){
  const status=emperorStatus(state),emperor=state.pieces.find(p=>p.type==='emperor'),legal=status.moves.filter(m=>m.id===selected);board.replaceChildren();
  for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++){
   const p=state.pieces.find(p=>p.x===x&&p.y===y),target=legal.find(m=>m.x===x&&m.y===y),square=String.fromCharCode(97+x)+(state.size-y),cell=document.createElement('button');cell.className=`imperial-cell ${(x+y)%2?'dark':'light'}${target?' target':''}${p?.id===selected?' selected':''}`;cell.type='button';cell.dataset.square=square;
   cell.setAttribute('aria-label',`${square}${p?` · ${p.color==='w'?'белые':'чёрные'} ${p.type==='emperor'?'император':p.type} · ${p.hp} HP`:''}${target?' · допустимый ход':''}`);
   if(p){const img=new Image();img.src=p.type==='emperor'?previewSprite({...p,skin:'emperor'},import.meta.env.BASE_URL):pieceImage(p,'neo',import.meta.env.BASE_URL);img.alt='';img.draggable=false;cell.append(img);if(p.hp>1||p.material||p.type==='emperor'){const badge=document.createElement('small');badge.textContent=`${p.hp}${p.type==='emperor'&&p.hp===1?' · ⚔2':''}`;cell.append(badge);}}
   cell.addEventListener('click',()=>{if(target){history.push(structuredClone(state));state=moveEmperorLab(state,target);selected=null;}else selected=p?.color===state.turn?p.id:null;render();});board.append(cell);
  }
  root.querySelector('.imperial-stage').textContent=`Император: ${emperor.hp} HP · урон ${emperorDamage(emperor)} · ${emperor.hp===1?'финальная форма, шах и мат':'без шахов'}`;
  root.querySelector('.imperial-state').textContent=status.mate?`Мат · ${state.turn==='b'?'император побеждён':'игрок проиграл'}`:status.stalemate?'Пат':`${status.check?'Шах · ':''}Ход ${state.turn==='w'?'белых':'чёрных'}${state.last?.hit?' · броня повреждена':''}`;
  root.querySelector('.imperial-undo').disabled=!history.length;
  for(const button of root.querySelectorAll('[data-hp]'))button.setAttribute('aria-pressed',String(Number(button.dataset.hp)===emperor.hp));
 }
 function reset(){state=emperorFixture(fixture,hp);selected=null;history=[];render();}
 select.addEventListener('change',()=>{fixture=select.value;if(fixture!=='armor')hp=1;reset();});
 for(const button of root.querySelectorAll('[data-hp]'))button.addEventListener('click',()=>{hp=Number(button.dataset.hp);reset();});
 root.querySelector('.imperial-reset').addEventListener('click',reset);root.querySelector('.imperial-undo').addEventListener('click',()=>{state=history.pop()??state;selected=null;render();});render();
}
