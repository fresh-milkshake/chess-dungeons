import {audioSettings} from './settings.js';
import {createAudioDirector} from './director.js';
import {soundtrackFor} from './playlist.js';
let director;const listeners=new Set();let state={track:null,playing:false,loading:false,error:''};
export function music(){return director??=createAudioDirector({settings:audioSettings,base:import.meta.env.BASE_URL,fetchAudio:(...args)=>fetch(...args),report:next=>{state={...state,...next};for(const fn of listeners)fn(state);}});}
export const setAudioScene=scene=>music().scene(soundtrackFor(scene));
export const audioStatus=()=>({...state});
export function subscribeAudio(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
