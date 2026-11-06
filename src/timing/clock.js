/** Counts only focused, visible, enabled time; clocks are injected for tests. */
export class ActiveClock {
 constructor({now=()=>performance.now(),onTime=()=>{},enabled=true,focused=false,visible=true}={}){
  this.now=now;this.onTime=onTime;this.enabled=enabled;this.focused=focused;this.visible=visible;this.context=null;this.last=now();
 }
 tick(){const current=this.now(),elapsed=Math.max(0,current-this.last);this.last=current;if(this.enabled&&this.focused&&this.visible&&this.context&&elapsed)this.onTime(this.context,elapsed);}
 setContext(context){this.tick();this.context=context?{...context}:null;}
 setActivity({focused=this.focused,visible=this.visible}){this.tick();this.focused=focused;this.visible=visible;}
 setEnabled(enabled){this.tick();this.enabled=enabled;}
}
