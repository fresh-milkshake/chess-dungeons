import {actStudies} from '../experiments/studies-catalog.js';
import {savedMaterials} from '../experiments/saved-materials.js';
import {biomeAppearance} from '../../biomes/appearance.js';

const sample=id=>actStudies.flatMap(group=>group.samples).find(s=>s.id===id);
const stone=(kind,a,b,scale,polish=.04)=>({kind,a,b,scale,polish});
// Deliberately lab-only: campaign palettes and saved gallery recipes stay intact.
export const selectedMaterials={
 garden:{...sample('I.1'),recolor:biomeAppearance.garden,strength:[.85,.85],note:'Известь и мох · исходные оттенки сада · замшелый скальный срез',fog:'Влажная пыльца'},
 forge:{...savedMaterials[1],wall:sample('II.F2').wall,wallMatch:'dark',recolor:biomeAppearance.forge,strength:[1,1],note:'Тёмный гранит · оригинальные оттенки кузницы · стены из «Закалки» в гамме тёмных клеток',fog:'Холодный пепел'},
 ice:{...sample('II.I4'),note:'Голубая мерзлота · материал и оттенки без изменений',fog:'Снежная слепота'},
 crypt:{...sample('II.N2'),strength:[.38,.68],note:'Зал без отражений · приглушённая патина, особенно на тёмных клетках',fog:'Мёртвый воздух'},
 ruins:{name:'Никого не осталось',dark:stone(5,'#555e60','#77807d',1.2),light:stone(5,'#9eaaa6','#bcc1b6',1.5),wall:stone(5,'#293133','#414b4b',1.5),strength:[.65,.65],note:'Никого не осталось · выцветший известняк, сырой бетон, пустые переходы',fog:'Забытое пространство'},
 court:{...savedMaterials[0],wall:stone(1,'#9daeb2','#fff9eb',1.3,.28),wallMarble:true,strength:[.48,.6],note:'Нефритовый договор · мягкий рисунок · тёплый мрамор в оттенках светлых клеток, с зелёными минеральными вкраплениями',fog:'Нефритовая завеса'},
};

export function selectedActScene(scene){
 if(scene.id!=='ruins'&&scene.id!=='crypt')return scene;
 scene.theme={...scene.theme,...(scene.id==='ruins'?{accent:'#a8b9b4',ground:'#171d1e',dark:'#68716f',light:'#aab4ac',wall:'#333e40'}:{accent:'#a5b7ae',ground:'#111819'})};
 if(scene.id==='ruins'&&scene.kind==='map'){
  scene.size=9;
  scene.walls=[];
  for(let i=0;i<9;i++)scene.walls.push({x:i,y:0},{x:i,y:8});
  for(let i=1;i<8;i++)scene.walls.push({x:0,y:i},{x:8,y:i});
  scene.walls.push(...[[2,2],[2,3],[2,4],[5,2],[6,2],[6,5],[6,6]].map(([x,y])=>({x,y})));
  scene.tiles=[[4,3],[4,4],[5,3]].map(([x,y])=>({x,y,type:'hole'}));
  scene.pieces=[{x:[1,2,3,3,4][scene.step],y:[7,7,7,6,6][scene.step],type:'k',color:'w'}];
  scene.exit={x:7,y:1};
 }
 return scene;
}
