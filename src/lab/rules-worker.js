import {WildRules} from '../battle/wild-rules.js';

// The existing classic WASM adapter remains isolated in its own worker. This
// module worker owns the coordinator and its synchronous variant search, so no
// search (including native-search fallbacks) can block painting or user input.
let native,nextId=0,queue=Promise.resolve();
const pending=new Map();
const rules=new WildRules(command=>new Promise((resolve,reject)=>{
 const id=++nextId;pending.set(id,{resolve,reject});native.postMessage({id,command});
}));
self.onmessage=({data})=>{
 if(data.nativeUrl){
  if(native)return;
  native=new Worker(data.nativeUrl);
  native.onmessage=({data:{id,result,error}})=>{
   const request=pending.get(id);if(!request)return;pending.delete(id);
   if(error||result?.error)request.reject(Error(error||result.error));else request.resolve(result);
  };
  native.onerror=()=>{for(const request of pending.values())request.reject(Error('Не удалось загрузить WASM-движок'));pending.clear();};
  return;
 }
 const {id,command}=data;
 queue=queue.then(async()=>{
  try{if(!native)throw Error('Движок не инициализирован');const result=await rules.request(command);self.postMessage({id,result});}
  catch(error){self.postMessage({id,error:String(error?.message??error)});}
 });
};
