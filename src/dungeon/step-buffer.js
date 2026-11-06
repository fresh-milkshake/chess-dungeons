/** One pending action, latest direction wins; holding is independent of OS repeat. */
export function createStepBuffer({step,isBusy,canMove,schedule=setTimeout,cancel=clearTimeout,repeatDelay=80}){
 let pending=null,held=null,running=false,timer=null,generation=0;
 const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
 const reset=()=>{clear();pending=null;held=null;generation++;};
 const request=delay=>{clear();timer=schedule(pump,delay);};
 async function pump(){
  clear();if(!canMove()){reset();return;}
  if(running)return;
  if(isBusy()){if(pending)request(16);return;}
  const direction=pending??held;if(!direction)return;
  pending=null;running=true;const token=generation;let moved=false;
  try{moved=await step(...direction);}finally{
   running=false;if(token!==generation){if(pending&&canMove())request(0);return;}
   if(!canMove()){reset();return;}
   if(pending)request(0);else if(held&&moved!==false)request(repeatDelay);
  }
 }
 return {
  press(direction){pending=[...direction];pump();},
  setHeld(direction){held=direction?.some(Boolean)?[...direction]:null;if(!held&&!pending&&!running)clear();},
  wake(){if(!canMove())reset();else if(pending&&!running)pump();},
  reset,
 };
}
