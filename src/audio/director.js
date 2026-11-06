import {soundtrack} from './playlist.js';
import {smoothLoopEdges} from './loop.js';
/** One decoded current loop and one retiring voice; scene changes cannot revive stale downloads. */
export function createAudioDirector({settings,base='./',createContext=()=>new (window.AudioContext||window.webkitAudioContext)({sampleRate:32000}),fetchAudio=(...args)=>fetch(...args),report=()=>{}}){
 let context,master,current=null,desired=null,pending=null,revision=0,unlocked=false,hidden=false,disposed=false,loading=false;
 const retiring=new Set();
 const status=(extra={})=>report({track:desired,playing:!!current&&context?.state==='running'&&!hidden,loading,...extra});
 function volume(){if(!master)return;const s=settings.get();master.gain.setTargetAtTime(s.muted||hidden?0:s.master*s.music,context.currentTime,.06);status();}
 function retire(voice,duration){if(!voice)return;for(const old of retiring)try{old.source.stop();}catch{}retiring.clear();retiring.add(voice);const at=context.currentTime;voice.gain.gain.cancelScheduledValues(at);voice.gain.gain.setTargetAtTime(0,at,Math.max(.01,duration/5));try{voice.source.stop(at+duration+.05);}catch{retiring.delete(voice);}}
 async function start(){
  if(!unlocked||!desired||hidden||disposed)return;
  if(current?.id===desired){volume();return;}
  if(pending?.id===desired)return;
  const id=desired,ticket=++revision;pending?.abort.abort();const abort=new AbortController();pending={id,abort};loading=true;status();
  try{
   const response=await fetchAudio(`${base}audio/${soundtrack[id].file}`,{signal:abort.signal});if(!response.ok)throw Error('Не удалось загрузить музыкальный фон.');
   const buffer=await context.decodeAudioData(await response.arrayBuffer());
   if(disposed||ticket!==revision||hidden)return;
   smoothLoopEdges(buffer);
   const source=context.createBufferSource(),gain=context.createGain(),voice={id,source,gain};source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;source.connect(gain).connect(master);
   const fade=id==='emperor'?.18:2.5,at=context.currentTime;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(soundtrack[id].gain,at+fade);
   source.onended=()=>{retiring.delete(voice);source.disconnect();gain.disconnect();source.buffer=null;};source.start();retire(current,fade);current=voice;
   loading=false;status({error:''});
  }catch(error){if(ticket===revision&&error.name!=='AbortError'){loading=false;status({error:error.message});}}
  finally{if(ticket===revision){pending=null;loading=false;status();}}
 }
 const unsubscribe=settings.subscribe(()=>{volume();if(unlocked&&!settings.get().muted)start();});
 return {
  scene(id){if(!soundtrack[id]||disposed)return;if(desired===id)return;desired=id;if(pending){pending.abort.abort();pending=null;revision++;}start();status();},
  async unlock(){if(disposed)return;try{if(!context){context=createContext();master=context.createGain();master.connect(context.destination);}unlocked=true;if(!hidden)await context.resume();volume();await start();}catch{status({error:'Нажмите на значок звука, чтобы включить воспроизведение.'});}},
  async visibility(value){hidden=value;if(hidden){pending?.abort.abort();pending=null;revision++;loading=false;await context?.suspend();}else if(unlocked){await context.resume();volume();start();}status();},
  dispose(){disposed=true;revision++;pending?.abort.abort();unsubscribe();for(const voice of [current,...retiring])if(voice)try{voice.source.stop();}catch{}current=null;retiring.clear();context?.close();},
 };
}
