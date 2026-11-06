// Opt-in, local diagnostics: no timers, storage or outbound telemetry.
const enabled=typeof location!=='undefined'&&new URLSearchParams(location.search).has('profile');
export function profile(name,action){
 if(!enabled)return action();
 const start=performance.now();
 try{return action();}finally{performance.measure(name,{start,duration:performance.now()-start});}
}
