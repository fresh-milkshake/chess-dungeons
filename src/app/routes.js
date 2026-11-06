export function routeFor(url){
 const name=url.pathname.split('/').pop();
 return {kind:({'dungeon.html':'map','deployment.html':'deployment','battle.html':'battle'})[name]??null,url};
}
/** Saves are authoritative when browser history points at an already-finished battle. */
export function campaignRoute(route,run,{historyReturn=false}={}){
 const {kind,url}=route,id=url.searchParams.get('run');
 const next=(page,withRun=false)=>{const target=new URL(page,url);if(withRun)target.searchParams.set('run',run.id);return routeFor(target);};
 if(kind==='map'&&run?.stage==='encounter'&&!url.searchParams.has('stay')&&!historyReturn)return next('deployment.html',true);
 if(kind==='deployment'||kind==='battle'&&id){
  if(!run||id!==run.id)return next('dungeon.html');
  if(run.stage==='encounter')return next('deployment.html',true);
  if(run.stage==='battle')return next('battle.html',true);
  return next('dungeon.html');
 }
 return route;
}
