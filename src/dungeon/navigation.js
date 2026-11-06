import {ACTS,floorsInAct} from './campaign.js';
/** Debug travel keeps the player's progression resources, but rebuilds the floor. */
export function jumpToFloor(run,act,floor){
 if(!Number.isInteger(act)||!Number.isInteger(floor)||act<1||act>ACTS||floor<1||floor>floorsInAct(act))return false;
 if(run.act!==act)delete run.actAnnounced;
 run.act=act;run.floor=floor;delete run.deployment;
 run.setupFloor();
 return true;
}
