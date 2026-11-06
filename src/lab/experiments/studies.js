import {worldStudies,actStudies} from './studies-catalog.js';
import {createStudyRenderer} from './studies-renderer.js';
import {savedMaterials} from './saved-materials.js';
import {createActStudyEffects,studyTerrain} from './act-study-effects.js';
import './studies.css';

const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text)el.textContent=text;return el;};

export function setupMaterialStudies(panel,{onApply}={}){
 const root=node('section','material-studies');root.id='material-studies';root.setAttribute('aria-label','Варианты материалов');
 const canvas=node('canvas','study-canvas');canvas.setAttribute('aria-hidden','true');canvas.hidden=true;root.append(canvas);
 const slots=[],buttons=[];let renderer,actEffects;
 function heading(number,title,description){
  const header=node('header','study-heading'),words=node('div','');
  words.append(node('p','experiment-eyebrow',number),node('h2','',title),node('p','study-intro',description));header.append(words);root.append(header);return header;
 }
 heading('ЛИЧНАЯ КОЛЛЕКЦИЯ','Сохранённые материалы','Зафиксированные варианты. Экспериментальные версии ниже могут меняться, эта подборка сохраняет выбранный облик.');
 addGroup({id:'saved',name:'Избранные поверхности',subtitle:'Отдельные параметры и зафиксированные исходные шейдеры.',accent:'#d4bd87',saved:true,samples:savedMaterials});
 const first=heading('НОВЫЕ МИРЫ / 25 ЭКСПЕРИМЕНТОВ','Пять миров. Живое вещество.','Здесь меняется поведение материала: внутреннее движение, поглощение света, оптическая плёнка, температура. Сравните четыре клетки или откройте вариант на полной доске.');
 const pause=node('button','secondary-button study-pause');pause.type='button';first.append(pause);
 function addGroup(group,act=false){
  const section=node('section','study-group');section.dataset.studyGroup=group.id;section.style.setProperty('--study-accent',group.accent);
  const header=node('header','study-group-heading');header.append(node('h3','',group.name),node('p','',group.subtitle));section.append(header);
  const grid=node('div',`study-grid${act?' study-act-grid':''}`);
  for(const sample of group.samples){
   const card=node('article','study-card');card.dataset.study=sample.id;
   card.setAttribute('aria-label',`${sample.id} · ${sample.name}. ${sample.description}. Показать отклик материала.`);
   const preview=node('button','study-preview');preview.type='button';preview.setAttribute('aria-label',`${sample.name} · показать отклик поверхности`);
   const stage=node('span',act?'study-pair':'study-single'),floor=node('span','study-surface');floor.dataset.surface='board';floor.setAttribute('role','img');floor.setAttribute('aria-label','Четыре клетки доски');stage.append(floor);
   slots.push({element:floor,sample,spectral:group.spectral??false,wall:false,saved:group.saved??false,world:group.world??-1,variation:sample.variation??0,biome:act?sample.biome:null});
   if(act){const wall=node('span','study-surface study-wall');wall.dataset.surface='wall';wall.setAttribute('role','img');wall.setAttribute('aria-label','Материал стен карты, вид сверху');stage.append(wall);slots.push({element:wall,sample,spectral:false,wall:true});}
   const caption=node('span','study-caption');caption.append(node('span','study-id',sample.sourceId??sample.id),node('strong','study-name',sample.name),node('span','study-description',sample.description));
   if(act&&sample.wall.name)caption.append(node('span','study-wall-description',`Стены: ${sample.wall.name}.`));
   if(act&&studyTerrain[sample.biome])caption.append(node('span','study-terrain-description',studyTerrain[sample.biome].label));
   preview.append(stage);
   if(act){const labels=node('span','study-pair-labels');labels.append(node('span','','ДОСКА · 2 × 2'),node('span','','СТЕНЫ'));card.append(preview,labels,caption);}else card.append(preview,caption);
   if(group.world!==undefined&&onApply){const apply=node('button','study-apply','На полную доску ↗');apply.type='button';apply.dataset.apply=sample.id;apply.addEventListener('click',()=>onApply(sample));card.append(apply);}
   if(group.saved&&sample.reference){const reference=node('a','study-reference','Скриншот-эталон ↗');reference.href=import.meta.env.BASE_URL+sample.reference;reference.target='_blank';reference.rel='noopener';card.append(reference);}
   buttons.push({card:preview,sample});grid.append(card);
  }
  section.append(grid);root.append(section);
 }
 worldStudies.forEach(g=>addGroup(g));
 const actHeading=heading('АКТЫ / 24 СОЧЕТАНИЯ','Камень под ногами. Стены вокруг.','По четыре сочетания для каждой локации, включая отдельно кузницу, лёд и некрополь. Слева — четыре клетки с эффектами, справа — стены.');
 const terrainToggle=node('button','secondary-button study-terrain-toggle','Эффекты актов: вкл.');terrainToggle.type='button';terrainToggle.setAttribute('aria-pressed','true');actHeading.append(terrainToggle);
 terrainToggle.addEventListener('click',()=>{const enabled=terrainToggle.getAttribute('aria-pressed')!=='true';terrainToggle.setAttribute('aria-pressed',String(enabled));terrainToggle.textContent=enabled?'Эффекты актов: вкл.':'Эффекты актов: выкл.';actEffects?.setEnabled(enabled);});
 actStudies.forEach(g=>addGroup(g,true));
 const footer=node('footer','study-footer');footer.append(node('p','','Нажмите на поверхность, чтобы увидеть отклик. «На полную доску» показывает эксперимент в сцене боя. Сохранённые материалы и подборка текущих актов используют свои прежние шейдеры.'));
 const status=node('p','study-status');status.setAttribute('role','status');status.hidden=true;footer.append(status);root.append(footer);panel.append(root);
 const report=text=>{status.textContent=text;status.hidden=!text;};
 actEffects=createActStudyEffects(slots,()=>renderer?.refresh(),report);
 try{renderer=createStudyRenderer(canvas,slots,panel,report,actEffects);}catch(error){actEffects.dispose();report(error.message);}
 for(const {card,sample} of buttons){card.disabled=!renderer;card.addEventListener('click',()=>renderer?.replay(sample.id));}
 function sync(){const paused=renderer?.paused??false;pause.textContent=paused?'▶ Оживить образцы':'Ⅱ Пауза образцов';pause.setAttribute('aria-pressed',String(paused));pause.disabled=!renderer;}
 pause.addEventListener('click',()=>{renderer.pause(!renderer.paused);sync();});sync();
 window.addEventListener('pagehide',event=>{if(!event.persisted)renderer?.dispose();});
 return root;
}
