import './campaign-navigation.css';
import {jumpToFloor} from '../dungeon/navigation.js';
import {campaignActs,bossAtExit} from '../dungeon/campaign.js';

export function setupCampaignNavigation({root,getRun,isBusy,onNavigate}){
 const section=document.createElement('section');section.className='debug-campaign-navigation';
 section.innerHTML='<h3>Акты и этажи</h3><p>Переход пересоздаёт этаж. Отряд, материал и сложность сохраняются.</p>';
 const buttons=[];
 for(const {act,roman,floors} of campaignActs){
  const row=document.createElement('div');row.className='debug-floor-row';
  const label=document.createElement('span');label.textContent=`Акт ${roman}`;row.append(label);
  for(let floor=1;floor<=floors;floor++){
   const button=document.createElement('button');button.type='button';button.textContent=bossAtExit(act,floor)?`${floor} · Босс`:String(floor);
   button.setAttribute('aria-label',`Перейти: акт ${act}, этаж ${floor}`);
   button.dataset.act=act;button.dataset.floor=floor;
   button.onclick=()=>{if(!isBusy())onNavigate(()=>jumpToFloor(getRun(),act,floor));};row.append(button);buttons.push(button);
  }section.append(row);
 }
 root.querySelector('#debug-panel .debug-heading').after(section);
 return {refresh(){const run=getRun();for(const button of buttons){const current=run.act===Number(button.dataset.act)&&run.floor===Number(button.dataset.floor);button.setAttribute('aria-current',String(current));button.disabled=isBusy();}}};
}
