/** Resources owned by one screen; cached screens can pause without losing state. */
export function createScope(){
 const controller=new AbortController(),pauses=new Set(),resumes=new Set(),cleanups=new Set();
 let active=true,disposed=false;
 const scope={
  get active(){return active&&!disposed;},get disposed(){return disposed;},signal:controller.signal,
  on(target,type,listener,options={}){
   const wrapped=event=>{if(scope.active)listener(event);};
   target.addEventListener(type,wrapped,{...(typeof options==='boolean'?{capture:options}:options),signal:controller.signal});
   return ()=>target.removeEventListener(type,wrapped,options);
  },
  onPause(fn){pauses.add(fn);return fn;},onResume(fn){resumes.add(fn);return fn;},cleanup(fn){cleanups.add(fn);return fn;},
  pause(){if(!scope.active)return;active=false;for(const fn of pauses)fn();},
  resume(){if(disposed||active)return;active=true;for(const fn of resumes)fn();},
  dispose(){if(disposed)return;scope.pause();disposed=true;controller.abort();for(const fn of cleanups)fn();pauses.clear();resumes.clear();cleanups.clear();},
 };
 return scope;
}
