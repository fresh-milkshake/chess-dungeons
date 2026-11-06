import {bossOptions} from '../dungeon/balance.js';
import {createPieceSprite} from '../piece-effects.js';
import {pieceImage} from '../piece-sets.js';
import {artifactImage} from '../artifacts/catalog.js';
import {artifactIcon} from '../artifacts/icon-effects.js';

/** Keep the won board in place until an explicit, durable reward choice. */
export function setupBossRewards({root,onChoose,onReroll}){
 const choices=document.createElement('div');choices.id='boss-reward-options';choices.className='boss-reward-options';choices.hidden=true;choices.setAttribute('role','group');choices.setAttribute('aria-label','Выберите награду за босса');
 root.querySelector('#again').before(choices);
 const reroll=document.createElement('button');reroll.type='button';reroll.className='primary-button boss-reward-reroll';reroll.textContent='Кость судьбы · обновить награды';reroll.hidden=true;choices.after(reroll);reroll.addEventListener('click',()=>onReroll?.());
 let key='',focused=false;
 return {render({run,enemy,result,busy}){
  const active=!!(run&&enemy?.boss&&result?.result==='win');choices.hidden=!active;root.querySelector('#again').hidden=active;reroll.hidden=!active||!run.artifacts?.includes('boss-die');reroll.disabled=busy||!!run?.artifactFloor?.used?.['boss-die'];
  root.querySelector('.result-card').classList.toggle('choosing-boss-reward',active);
  if(!active){focused=false;return false;}
  const options=bossOptions(run),next=JSON.stringify(options);
  if(key!==next){key=next;choices.replaceChildren(...options.map((option,index)=>{
   const button=document.createElement('button');button.type='button';button.className='boss-reward-option';button.setAttribute('aria-label',`Выбрать награду: ${option.title}`);
   if(option.kind==='artifact'){const img=document.createElement('img');img.src=artifactImage(option.artifactId,import.meta.env.BASE_URL);img.alt='';button.append(artifactIcon(img,option.artifactId));}else{const piece={type:option.type,color:'w',material:option.material};button.append(createPieceSprite(piece,pieceImage(piece,'neo',import.meta.env.BASE_URL)));}
   const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=option.title;detail.textContent=option.detail;button.append(name,detail);button.addEventListener('click',()=>onChoose(index));return button;
  }));}
  for(const button of choices.children)button.disabled=busy;
  root.querySelector('#result-detail').textContent=run.act===4?'Выберите последнюю награду, чтобы завершить забег.':'Выберите одну награду. Затем откроется магазин перед следующим актом.';
  if(!busy&&!focused){choices.querySelector('button')?.focus({preventScroll:true});focused=true;}
  return true;
 }};
}
