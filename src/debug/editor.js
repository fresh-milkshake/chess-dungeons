import {createScope} from '../app/scope.js';
import './editor.css';
import {pieceImage} from '../piece-sets.js';

const roles={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'};
const materials={ordinary:'Обычная',stone:'Камень · 2 HP',glass:'Стекло',ethereal:'Эфир',diamond:'Алмаз · 3 HP',power:'Усиление · 2 урона'};

export function setupPieceEditor({onApply,onPick=()=>false,isBusy=()=>false,resolveTarget,helpText,container=document,scope=createScope()}){
 const panel=container.querySelector('.debug-panel'),root=document.createElement('section');root.className='debug-editor';
 root.innerHTML='<h3>Фигуры и материалы</h3><label class="editor-mode"><input id="debug-edit-mode" type="checkbox">Редактор · ИИ на паузе</label><select id="debug-piece-color" aria-label="Сторона добавляемой фигуры"><option value="w">Белые · игрок</option><option value="b">Чёрные · противник</option><option value="wild">Дикие · третья сторона</option></select><div class="editor-pieces"></div><div class="editor-materials"></div><p>В редакторе перетаскивайте любые фигуры свободно; за пределы доски — удалить. Занятые клетки меняются местами. Материалы работают на всех сторонах. Король всегда обычный. Правки начинают историю заново.</p><p class="editor-status" role="status"></p>';
 panel.append(root);
 if(helpText)root.querySelector('p').textContent=helpText;
 const mode=root.querySelector('input'),side=root.querySelector('select'),status=root.querySelector('.editor-status');
 let tool=null,gesture=null,suppressUntil=0;
 function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
 function select(payload){const wasEditing=mode.checked;tool=payload;mode.checked=true;for(const button of root.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===(payload.kind==='piece'?payload.type:payload.material)));if(!wasEditing)document.dispatchEvent(new CustomEvent('debug-editor-mode',{detail:{editing:true}}));}
 async function apply(payload,target){
  if(isBusy()){message('Дождитесь окончания текущего действия.',true);return;}
  try{await onApply(payload,target);message('Готово. Можно продолжить редактирование.');}
  catch(error){message(error.message,true);}
 }
 function payloadFor(button){return button.dataset.kind==='piece'?{kind:'piece',type:button.dataset.tool,color:side.value}:{kind:'material',material:button.dataset.tool};}
 for(const [type,label] of Object.entries(roles)){
  const button=document.createElement('button');button.type='button';button.dataset.kind='piece';button.dataset.tool=type;button.title=label;button.setAttribute('aria-label',`Добавить: ${label}`);
  const img=document.createElement('img');img.alt='';img.draggable=false;button.append(img);root.querySelector('.editor-pieces').append(button);
 }
 function updateIcons(){for(const button of root.querySelectorAll('[data-kind="piece"]')){const unavailable=side.value==='wild'&&!'nbrq'.includes(button.dataset.tool);button.hidden=unavailable;button.querySelector('img').src=unavailable?'':pieceImage({type:button.dataset.tool,color:side.value},'neo',import.meta.env.BASE_URL);}if(tool?.kind==='piece')tool=side.value==='wild'&&!'nbrq'.includes(tool.type)?null:{...tool,color:side.value};}
 side.addEventListener('change',updateIcons);updateIcons();
 for(const [material,label] of Object.entries(materials)){
  const button=document.createElement('button');button.type='button';button.dataset.kind='material';button.dataset.tool=material;button.setAttribute('aria-label',`Материал: ${label}`);
  const icon=document.createElement('span');icon.className=`editor-material-icon ${material}`;if(material==='power')icon.textContent='⚡';
  const text=document.createElement('span');text.textContent=label;button.append(icon,text);root.querySelector('.editor-materials').append(button);
 }
 root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-tool]');if(!button||performance.now()<suppressUntil)return;
  if(isBusy()){message('Дождитесь окончания текущего действия.',true);return;}
  const payload=payloadFor(button);select(payload);
  try{if(await onPick(payload)){tool=null;message('Фигура добавлена в отряд.');return;}}
  catch(error){message(error.message,true);return;}
  message(payload.kind==='piece'?'Выберите свободную клетку.':'Выберите фигуру для применения материала.');
 });
 function clear(){
  if(!gesture)return;const previous=gesture;gesture=null;
  previous.ghost?.remove();document.querySelector('.editor-drop-target')?.classList.remove('editor-drop-target');panel.style.visibility='';
  if(previous.active)suppressUntil=performance.now()+350;
  if(document.body.hasPointerCapture(previous.id))document.body.releasePointerCapture(previous.id);
 }
 root.addEventListener('pointerdown',event=>{
  const button=event.target.closest('[data-tool]');if(!button||gesture||!event.isPrimary||event.button!==0||isBusy())return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,payload:payloadFor(button),button,active:false};
 });
 scope.on(document,'pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  if(!gesture.active&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<5)return;
  event.preventDefault();
  if(!gesture.active){
   gesture.active=true;select(gesture.payload);document.body.setPointerCapture(event.pointerId);
   gesture.ghost=gesture.button.firstElementChild.cloneNode(true);gesture.ghost.classList.add('debug-drag-ghost');document.body.append(gesture.ghost);panel.style.visibility='hidden';
  }
  gesture.ghost.style.left=`${event.clientX}px`;gesture.ghost.style.top=`${event.clientY}px`;
  document.querySelector('.editor-drop-target')?.classList.remove('editor-drop-target');
  resolveTarget(document.elementFromPoint(event.clientX,event.clientY))?.classList.add('editor-drop-target');
 },{passive:false});
 scope.on(document,'pointerup',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const previous=gesture,target=previous.active?resolveTarget(document.elementFromPoint(event.clientX,event.clientY)):null;clear();
  if(previous.active){if(target)apply(previous.payload,target);else message('Перетащите инструмент на подходящую цель.',true);}
 });
 scope.on(document,'pointercancel',clear);scope.on(document.body,'lostpointercapture',clear);scope.on(window,'blur',clear);
 mode.addEventListener('change',()=>{if(!mode.checked){tool=null;clear();}document.dispatchEvent(new CustomEvent('debug-editor-mode',{detail:{editing:mode.checked}}));});
 scope.on(document,'debug-menu-change',event=>{if(!event.detail.open){clear();mode.checked=false;tool=null;document.dispatchEvent(new CustomEvent('debug-editor-mode',{detail:{editing:false}}));}});
 scope.onPause(()=>{clear();mode.checked=false;tool=null;});
 return {
  setEditing(enabled){mode.checked=enabled;tool=null;clear();document.dispatchEvent(new CustomEvent('debug-editor-mode',{detail:{editing:enabled}}));},
  get editing(){return mode.checked;},message,
  consumeClick(element){if(performance.now()<suppressUntil)return true;if(!mode.checked)return false;if(tool){const target=resolveTarget(element);if(target)apply(tool,target);}return true;},
 };
}
