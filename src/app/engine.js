import {DungeonEngine} from '../lab/client.js';
let engine;
export function sharedEngine(){return engine??=new DungeonEngine();}
