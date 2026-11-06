export const timingKey='chess-dungeons-timing-v1',preferenceKey='chess-dungeons-timing-enabled';
export const phaseNames={difficulty:'Выбор сложности',map:'Карта',reward:'Выбор находки','boss-reward':'Выбор награды босса',encounter:'Выбор встречи',preparation:'Подготовка','battle-player':'Бой · ваши решения','battle-bot':'Бой · ход ИИ','battle-loading':'Загрузка боя',results:'Итоги',shop:'Магазин',menu:'Меню боя',stats:'Просмотр статистики',debug:'Дебаг-меню'};
export function emptyReport(){return {version:1,runs:{}};}
export function readReport(storage){try{const report=JSON.parse(storage.getItem(timingKey));return report?.version===1&&report.runs&&typeof report.runs==='object'?report:emptyReport();}catch{return emptyReport();}}
export function addTime(report,context,milliseconds,stamp=Date.now()){
 if(!context?.runId||!Number.isFinite(milliseconds)||milliseconds<=0)return report;
 const run=report.runs[context.runId]??={startedAt:stamp,updatedAt:stamp,areas:{}};run.updatedAt=stamp;
 const areaKey=context.area==='shop'?`${context.act}:shop`:`${context.act}:${context.floor}`;
 const area=run.areas[areaKey]??={act:context.act,floor:context.floor,area:context.area??'floor',phases:{},encounters:{}};
 if(context.rooms!=null)area.map??={rooms:context.rooms,width:context.mapWidth,height:context.mapHeight,layout:context.layout,generation:context.generation};
 area.phases[context.phase]=(area.phases[context.phase]??0)+milliseconds;
 if(context.encounterId){const encounter=area.encounters[context.encounterId]??={name:context.encounterName??context.encounterId,phases:{}};if(context.encounterName)encounter.name=context.encounterName;encounter.phases[context.phase]=(encounter.phases[context.phase]??0)+milliseconds;}
 return report;
}
export function summarizeRun(run){
 const phases={},areas=[];
 for(const area of Object.values(run?.areas??{})){
  for(const [phase,time] of Object.entries(area.phases))phases[phase]=(phases[phase]??0)+time;
  areas.push({...area,total:Object.values(area.phases).reduce((sum,time)=>sum+time,0)});
 }
 return {phases,areas,total:Object.values(phases).reduce((sum,time)=>sum+time,0)};
}
