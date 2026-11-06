import {files,rank as squareRank,boardAxes} from './coordinates.js';
import {randomSource} from '../dungeon/map.js';

export const fullBoard={left:0,right:7,bottom:1,top:8};
export function chessFen(fen){const [board,...fields]=fen.split(' @')[0].split(' ');return [board.replace(/[*1-8]+/g,part=>String([...part].reduce((n,c)=>n+(c==='*'?1:Number(c)),0))),...fields].join(' ');}
export function encounterBounds(run,enemy){
 if(enemy.boss&&run.act===4){const bounds={left:0,right:13,bottom:1,top:14,shape:'imperial',cutouts:[]};for(let y=1;y<=14;y++)for(let x=0;x<14;x++)if(!((x>=1&&x<=12&&y>=2&&y<=13)||(x>=5&&x<=8&&(y===1||y===14))||((x===0||x===13)&&y>=6&&y<=9)))bounds.cutouts.push(files[x]+y);return bounds;}
 if(enemy.boss||enemy.region==='secret')return {...fullBoard};
 if(enemy.bounds)return {...enemy.bounds};
 const rng=randomSource(run.seed^Math.imul(run.act*100+run.floor,7919)^Array.from(enemy.id).reduce((n,c)=>(n*31+c.charCodeAt(0))|0,0));
 const bounds={...fullBoard};
 if(rng()<.45)return bounds;
 const both=enemy.type==='p'&&run.act===1&&rng()<.25;
 const trimFiles=both||rng()<.5;
 if(trimFiles){if(rng()<.5)bounds.left++;else bounds.right--;if(rng()<.35){bounds.left=1;bounds.right=6;}}
 if(!trimFiles||both){if(rng()<.5)bounds.bottom++;else bounds.top--;if(rng()<.35){bounds.bottom=2;bounds.top=7;}}
 return bounds;
}
export function inside(square,bounds){return square.charCodeAt(0)-97>=bounds.left&&square.charCodeAt(0)-97<=bounds.right&&squareRank(square)>=bounds.bottom&&squareRank(square)<=bounds.top&&!bounds.cutouts?.includes(square);}
export function placement(board,bounds=fullBoard){
 const extent={left:0,right:Math.max(7,bounds.right),bottom:1,top:Math.max(8,bounds.top)};
 return boardAxes(extent).ranks.map(rank=>{
  let row='',empty=0;
  for(const file of files.slice(0,extent.right+1)){
   const square=file+rank,code=inside(square,bounds)?board.get(square):'*';
   if(!code){empty++;continue;}if(empty){row+=empty;empty=0;}row+=code;
  }
  return row+(empty||'');
 }).join('/');
}

export {files} from './coordinates.js';
