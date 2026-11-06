import {setGhostMode,revealMap,spawnMapEntity} from '../dungeon/map-debug.js';
import './map-tools.css';

export function setupMapTools({root,scope,getRun,isBusy,onAction,onArm}){
 let placing=null;
 const section=document.createElement('section');section.className='debug-map-tools';
 section.innerHTML='<h3>Карта · инструменты</h3><label><input type="checkbox" id="debug-map-ghost"> Ghost mode</label><p>Сквозь стены и провалы; противники не замечают короля. Опасные клетки не действуют.</p><button type="button" id="debug-map-reveal">Раскрыть карту</button><p><select id="debug-map-spawn" aria-label="Объект для размещения"><option value="wild">Дикая фигура</option><option value="fight">Обычный бой</option><option value="floor">Магазин этажа</option><option value="secret">Секретный магазин</option></select> <select id="debug-map-type" aria-label="Тип фигуры"></select></p><button type="button" id="debug-map-place">Разместить на карте</button>';
 root.querySelector('#debug-panel .debug-heading').after(section);
 for(const button of section.querySelectorAll('button'))button.className='secondary-button';
 const find=id=>section.querySelector('#'+id),ghost=find('debug-map-ghost'),kind=find('debug-map-spawn'),type=find('debug-map-type');
 const hint=document.createElement('div');hint.className='debug-placement-hint';hint.hidden=true;hint.setAttribute('role','status');root.append(hint);
 const names={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король',d:'Дракон'};
 function options(){const types=kind.value==='wild'?['n','b','r','q','d']:['p','n','b','r','q','k'];type.replaceChildren(...types.map(value=>{const o=document.createElement('option');o.value=value;o.textContent=names[value];return o;}));type.hidden=!['wild','fight'].includes(kind.value);}
 function cancel(){placing=null;hint.hidden=true;root.querySelector('#map').style.cursor='';}
 options();kind.onchange=options;
 ghost.onchange=()=>onAction(()=>setGhostMode(getRun(),ghost.checked));
 find('debug-map-reveal').onclick=()=>onAction(()=>revealMap(getRun()));
 find('debug-map-place').onclick=()=>{if(isBusy()||getRun().stage!=='exploring')return;onArm();root.querySelector('#debug-close').click();placing={kind:kind.value,type:type.value};hint.textContent='Выберите свободную клетку · Esc — отмена';hint.hidden=false;root.querySelector('#map').style.cursor='crosshair';};
 scope.on(document,'keydown',event=>{if(scope.active&&placing&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}},{capture:true});
 scope.onPause(cancel);scope.cleanup(()=>hint.remove());
 return {get placing(){return !!placing;},refresh(){ghost.checked=!!getRun().debugMap?.ghost;for(const el of [ghost,find('debug-map-reveal'),find('debug-map-place')])el.disabled=isBusy()||getRun().stage!=='exploring';},consumeClick(element){if(!placing)return false;const cell=element.closest('[data-cell]');if(cell&&!isBusy()){const tool=placing;onAction(()=>spawnMapEntity(getRun(),tool,{x:Number(cell.dataset.x),y:Number(cell.dataset.y)})).then(ok=>{if(placing!==tool)return;if(ok)cancel();else hint.textContent=`${getRun().message} · Esc — отмена`;});}return true;}};
}
