export const audioSettingsKey='chess-dungeons-audio-v1';
export const audioDefaults={muted:false,master:.7,music:.45,effects:.65};
const clamp=(v,fallback)=>Number.isFinite(Number(v))?Math.max(0,Math.min(1,Number(v))):fallback;
export function normalizeAudioSettings(value={}){return {muted:value.muted===true,master:clamp(value.master,audioDefaults.master),music:clamp(value.music,audioDefaults.music),effects:clamp(value.effects,audioDefaults.effects)};}
export function createAudioSettings(storage){
 let value;try{storage??=globalThis.localStorage;value=normalizeAudioSettings(JSON.parse(storage?.getItem(audioSettingsKey)??'{}'));}catch{value={...audioDefaults};}
 const listeners=new Set();
 return {get:()=>({...value}),set(patch){value=normalizeAudioSettings({...value,...patch});try{storage?.setItem(audioSettingsKey,JSON.stringify(value));}catch{}for(const fn of listeners)fn({...value});return {...value};},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
}
export const audioSettings=createAudioSettings();
export const effectsVolume=()=>{const s=audioSettings.get();return s.muted?0:s.master*s.effects;};
