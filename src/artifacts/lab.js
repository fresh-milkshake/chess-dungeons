import {artifacts,artifactImage,kindLabel} from './catalog.js';
import {artifactSummaries} from './summaries.js';
import {chargeSettingsKey,readChargeDrafts,configuredArtifact,chargeChanges,chargeChangesText} from './lab-settings.js';
import {artifactPrice,sellableArtifact} from '../dungeon/economy.js';
import {artifactIcon} from './icon-effects.js';
import {rarityInfo,sourceLabel,sourceAllowed} from './rarity.js';
import {rechargeScope,rechargeLabel,rechargeHint,actionLabel,refillsOn,chargeBudgetLabel} from './charges.js';
import '../dungeon/typography.css';
import './style.css';
import './lab.css';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text)el.textContent=text;return el;};
const normalized=text=>text.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
const scopes=[['','Любое восстановление'],['battle','За бой'],['floor','За этаж'],['act','За акт'],['run','За забег'],['boss','После босса'],['shop','В магазине'],['none','Без зарядов']];
const events={battle:[['battle','Следующий бой']],floor:[['battle','Следующий бой'],['floor','Следующий этаж']],act:[['floor','Следующий этаж'],['act','Следующий акт']],run:[['act','Следующий акт'],['run','Новый забег']],boss:[['boss','Следующая награда']],shop:[['shop','Следующий магазин']]};
const shared={floor:'Один запас на все бои этажа.',act:'Один запас на все этажи акта.',run:'Единственный запас на весь забег.',battle:'Полный запас в начале каждого боя.',boss:'Полный запас для выбора награды каждого босса.',shop:'Отдельный запас в каждом магазине.'};
const order=['hourglass','oracle','hex','briar','banner','mirror','seal','silence','frost','glassward','dragonhorn','lastcrown','boss-die','merchant-die'];
const displayArtifacts=[...artifacts].sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):99)-(order.includes(b.id)?order.indexOf(b.id):99));

export function setupArtifactLab(panel){
 let drafts={};try{drafts=readChargeDrafts(localStorage.getItem(chargeSettingsKey),artifacts);}catch{}
 const configured=a=>configuredArtifact(a,drafts);
 panel.className='artifact-lab relic-archive';
 const head=node('header','relic-archive-head'),title=node('div','');title.append(node('p','relic-eyebrow','МАЛЫЕ ВЕЩИ · ВЕЛИКАЯ СИЛА'),node('h1','','Реликварий'),node('p','relic-intro','Выберите реликвию, узнайте её силу и испытайте запас зарядов.'));
 const seal=node('div','relic-archive-seal');seal.append(node('strong','',String(artifacts.length)),node('span','','реликвия'));head.append(title,seal);
 const tools=node('div','relic-tools');tools.setAttribute('role','search');tools.setAttribute('aria-label','Поиск реликвий');
 const searchLabel=node('label','relic-search-label','Поиск'),search=document.createElement('input');search.type='search';search.id='relic-search';search.placeholder='Название или действие…';searchLabel.htmlFor=search.id;searchLabel.append(search);tools.append(searchLabel);
 const select=(id,label,options)=>{const field=node('label','relic-filter-label',label),el=document.createElement('select');el.id=id;el.setAttribute('aria-label',label);field.htmlFor=id;for(const [value,text] of options)el.add(new Option(text,value));field.append(el);tools.append(field);return el;};
 const kind=select('relic-kind','Действие',[['','Все реликвии'],['active','Активные'],['toggle','Переключаемые'],['passive','Пассивные']]),period=select('relic-period','Заряды',scopes);
 const reset=node('button','relic-filter-reset','Сбросить');reset.type='button';reset.hidden=true;tools.append(reset);
 const count=node('p','relic-result-count');count.setAttribute('role','status');
 const layout=node('div','relic-archive-layout'),grid=node('div','relic-grid');grid.setAttribute('aria-label','Все реликвии');
 const detail=node('aside','relic-detail');detail.id='relic-detail';detail.setAttribute('aria-label','Выбранная реликвия');
 const empty=node('p','relic-empty','Такой реликвии здесь нет. Попробуйте другое имя или действие.');empty.hidden=true;
 const cards=new Map(),spent=new Map();let selected='hourglass';
 const settingsBar=node('section','relic-settings-bar');settingsBar.setAttribute('aria-label','Настройки зарядов');
 const settingsInfo=node('div','');settingsInfo.append(node('strong','','Настройка зарядов'),node('p','','Изменения сохраняются здесь и не меняют правила игры.'));
 const copy=node('button','relic-settings-copy','Скопировать изменения'),clear=node('button','relic-settings-reset','Сбросить все');copy.type=clear.type='button';
 const changeCount=node('span','relic-settings-count'),copyStatus=node('p','relic-settings-status');copyStatus.setAttribute('role','status');
 const preview=node('details','relic-settings-preview'),previewTitle=node('summary','','Что будет скопировано'),exportText=node('textarea','');exportText.readOnly=true;exportText.setAttribute('aria-label','Изменённые реликвии и значения');preview.append(previewTitle,exportText);
 settingsBar.append(settingsInfo,changeCount,copy,clear,copyStatus,preview);
 function updateSettings(){
  const changes=chargeChanges(artifacts,drafts);changeCount.textContent=`Изменено: ${changes.length}`;copy.disabled=clear.disabled=!changes.length;exportText.value=chargeChangesText(artifacts,drafts);copyStatus.textContent='';
  for(const original of artifacts){const a=configured(original),footer=cards.get(a.id)?.querySelector('.relic-card-footer');if(footer)footer.replaceChildren(node('span','relic-card-budget',chargeBudgetLabel(a)),a.charges?dots(a):node('span','relic-passive-mark','∞'));cards.get(a.id)?.classList.toggle('relic-card-modified',changes.some(change=>change.id===a.id));}
 }
 function saveSettings(){try{localStorage.setItem(chargeSettingsKey,JSON.stringify(drafts));}catch{copyStatus.textContent='Не удалось сохранить настройки в браузере. Скопируйте изменения перед закрытием страницы.';}}
 copy.addEventListener('click',async()=>{const text=chargeChangesText(artifacts,drafts);try{await navigator.clipboard.writeText(text);copyStatus.textContent='Изменённые реликвии и значения скопированы.';}catch{preview.open=true;exportText.focus();exportText.select();copyStatus.textContent='Текст выделен. Нажмите Ctrl+C, чтобы скопировать.';}});
 clear.addEventListener('click',()=>{drafts={};spent.clear();updateSettings();saveSettings();filter();});
 function image(a,size){const img=document.createElement('img');img.src=artifactImage(a.id,import.meta.env.BASE_URL);img.width=img.height=size;img.alt='';img.draggable=false;return artifactIcon(img,a.id);}
 function dots(a,used=0){const row=node('span','relic-pips');row.setAttribute('aria-hidden','true');for(let i=0;i<Math.min(a.charges,8);i++){const pip=node('i','');pip.dataset.spent=String(i>=a.charges-used);row.append(pip);}return row;}
 for(const a of displayArtifacts){
  const card=node('button','relic-card');card.type='button';card.id='relic-card-'+a.id;card.dataset.relic=a.id;card.setAttribute('aria-controls',detail.id);card.setAttribute('aria-pressed','false');
  const heading=node('span','relic-card-heading'),words=node('span','');words.append(node('span','relic-card-kind',kindLabel(a)),node('strong','relic-card-name',a.name));heading.append(image(a,32),words);
  const effect=node('span','relic-card-effect',artifactSummaries[a.id]??a.description),footer=node('span','relic-card-footer');footer.append(node('span','relic-card-budget',chargeBudgetLabel(a)),a.charges?dots(a):node('span','relic-passive-mark','∞'));
  card.append(heading,effect,footer);card.addEventListener('click',()=>{selected=a.id;renderSelection();});cards.set(a.id,card);grid.append(card);
 }
 function renderSelection(){
  for(const [id,card] of cards)card.setAttribute('aria-pressed',String(id===selected));
  const original=artifacts.find(a=>a.id===selected),a=original&&configured(original);detail.hidden=!a;if(!a)return;detail.replaceChildren();
  const heading=node('div','relic-detail-heading');heading.append(image(a,56),node('span','relic-eyebrow',kindLabel(a)));detail.append(heading,node('h2','',a.name),node('p','relic-flavor',a.flavor),node('p','relic-detail-effect',a.description),node('span','relic-action-label',actionLabel(a)));
  const origin=node('p','relic-source',`${rarityInfo(a.id).name} · ${sourceLabel(a.id)}`);origin.style.color=rarityInfo(a.id).color;detail.append(origin);
  const editor=node('section','relic-charge-editor');editor.setAttribute('aria-label','Настройка выбранной реликвии');editor.append(node('h3','','Настройка зарядов'));
  const modeLabel=node('label','','Условия восстановления'),mode=document.createElement('select');mode.setAttribute('aria-label','Условия восстановления');for(const [value,text] of [['none','Без ограничений'],...scopes.filter(([value])=>value&&value!=='none')])mode.add(new Option(text,value));mode.value=a.charges?rechargeScope(a):'none';modeLabel.append(mode);
  const amountLabel=node('label','','Количество зарядов'),amount=document.createElement('input');amount.type='number';amount.min='1';amount.max='99';amount.step='1';amount.value=String(a.charges??1);amount.disabled=!a.charges;amount.setAttribute('aria-label','Количество зарядов');amountLabel.append(amount);
  const defaults=node('button','relic-settings-reset','Вернуть исходные');defaults.type='button';defaults.disabled=!chargeChanges([original],drafts).length;
  const apply=()=>{if(mode.value!=='none'&&!amount.checkValidity()){amount.reportValidity();return;}drafts[a.id]=mode.value==='none'?{charges:null,recharge:null}:{charges:Number(amount.value),recharge:mode.value};spent.delete(a.id);updateSettings();saveSettings();filter();};
  mode.addEventListener('change',apply);amount.addEventListener('change',apply);defaults.addEventListener('click',()=>{delete drafts[a.id];spent.delete(a.id);updateSettings();saveSettings();filter();});
  editor.append(modeLabel,amountLabel,defaults);detail.append(editor);
  if(a.charges){
   const box=node('section','relic-charge-demo');box.setAttribute('aria-label','Испытание зарядов');box.append(node('h3','','Испытание зарядов'));
   const budget=node('div','relic-demo-budget'),value=node('strong',''),label=node('span','',rechargeLabel(a)),pips=node('span','');budget.append(value,label,pips);
   const note=node('p','relic-demo-note',shared[rechargeScope(a)]),status=node('p','relic-demo-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   const use=node('button','relic-demo-use','Применить'),steps=node('div','relic-demo-steps');use.type='button';
   const update=text=>{const used=spent.get(a.id)??0;value.textContent=`${Math.max(0,a.charges-used)} / ${a.charges}`;pips.replaceChildren(dots(a,used));use.disabled=used>=a.charges;status.textContent=text??rechargeHint(a);};
   use.addEventListener('click',()=>{spent.set(a.id,Math.min(a.charges,(spent.get(a.id)??0)+1));update((spent.get(a.id)??0)>=a.charges?'Запас исчерпан. '+rechargeHint(a):'Один заряд потрачен.');});
   for(const [event,title] of events[rechargeScope(a)]??[]){const button=node('button','',title);button.type='button';button.addEventListener('click',()=>{const refilled=refillsOn(a,event);if(refilled)spent.set(a.id,0);update(refilled?'Полный запас восстановлен.':'Заряды не восстановились. '+rechargeHint(a));});steps.append(button);}
   box.append(budget,note,use,steps,status,node('small','relic-demo-footnote','Проба не расходует заряды вашего отряда.'));detail.append(box);update();
  }else detail.append(node('p','relic-no-charges',a.kind==='toggle'?'Можно включать и выключать без ограничений.':a.kind==='active'?'Применяется без ограничения зарядов.':'Действует без активации и не расходует заряды.'));
  const prices=node('div','relic-price-list');prices.setAttribute('aria-label','Цена у торговцев');for(const [i,price] of [1,2,3].map(act=>artifactPrice(a,act)).entries()){const item=node('span','');item.append(node('small','',`После ${['I','II','III'][i]} акта`),node('strong','',sourceAllowed(a.id,'shop')&&sellableArtifact(a.id,i+1)?`◆ ${price}`:'Не продаётся'));prices.append(item);}detail.append(prices);
  if(sourceAllowed(a.id,'secret'))detail.append(node('p','relic-source',`Тайный торг: ◆ ${[1,1.15,1.35].map(scale=>Math.round(a.price[1]*2.2*scale)).join(' / ')} на III.2 / III.3 / IV.1. Наличие зависит от ассортимента.`));
 }
 function filter(){
  const query=normalized(search.value),visible=displayArtifacts.map(configured).filter(a=>(!query||normalized(a.name+' '+a.description).includes(query))&&(!kind.value||a.kind===kind.value)&&(!period.value||(a.charges?rechargeScope(a):'none')===period.value));
  const ids=new Set(visible.map(a=>a.id));for(const [id,card] of cards)card.hidden=!ids.has(id);count.textContent=`Показано ${visible.length} из ${artifacts.length}`;empty.hidden=!!visible.length;reset.hidden=!search.value&&!kind.value&&!period.value;
  if(!ids.has(selected))selected=visible[0]?.id??null;renderSelection();
 }
 for(const input of [search,kind,period])input.addEventListener(input===search?'input':'change',filter);reset.addEventListener('click',()=>{search.value='';kind.value='';period.value='';filter();search.focus();});
 grid.append(empty);layout.append(grid,detail);panel.append(head,tools,settingsBar,count,layout);updateSettings();filter();
}
