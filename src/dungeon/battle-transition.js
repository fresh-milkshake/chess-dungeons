/** Transfer the prepared board and loaded position through the application router. */
export function enterBattle({board,state,runId,navigate}){
 const {x,y,width,height}=board.getBoundingClientRect();
 return navigate(`./battle.html?run=${encodeURIComponent(runId)}`,{replace:true,handoff:{board,state,boardRect:{x,y,width,height}}});
}
