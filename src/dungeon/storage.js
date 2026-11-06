import { Run } from './run.js';
export const runKey='chess-dungeons-run-v1';
export function loadRun(storage=localStorage){const raw=storage.getItem(runKey);return raw?Run.restore(JSON.parse(raw)):null;}
export function saveRun(run,storage=localStorage){storage.setItem(runKey,JSON.stringify(run.snapshot()));}
