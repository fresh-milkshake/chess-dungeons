import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
// Prepare a pristine engine with only the identical browser threading adapter.
// Position, evaluation, move picker and search remain upstream originals.
const source='.qa/upstream-baseline';
const revision='9f778da667f6e07dae1e85d3e2ea204fc6dee94d';
const actual=execFileSync('git',['-C','.qa/fairy-stockfish','rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actual!==revision)throw Error('Unexpected upstream revision');
const files=execFileSync('git',['-C','.qa/fairy-stockfish','ls-tree','-r','--name-only','HEAD','src'],{encoding:'utf8'}).trim().split('\n');
for(const file of files){const target=`${source}/${file}`;await mkdir(dirname(target),{recursive:true});await writeFile(target,execFileSync('git',['-C','.qa/fairy-stockfish','show',`HEAD:${file}`],{maxBuffer:32*1024*1024}));}
for(const file of ['thread.cpp','tt.cpp'])await copyFile(`.qa/fairy-stockfish/src/${file}`,`${source}/src/${file}`);
await writeFile(`${source}/src/dungeons-api.cpp`,(await readFile('engine/dungeons-api.cpp','utf8')).replace('position->dungeon_survives(move)','false'));
await mkdir('.qa/strength/baseline',{recursive:true});
const shellRoot=process.platform==='win32'?'/mnt/'+process.cwd()[0].toLowerCase()+process.cwd().slice(2).replaceAll('\\','/'):process.cwd();
const script=(await readFile('engine/build.sh','utf8')).replaceAll('\r','').replace('cd "$(dirname "$0")/.."',`cd '${shellRoot.replaceAll("'","'\\''")}'`).replaceAll('../../dungeons-build','../../baseline-build').replaceAll('../../../public/engine/dungeons','../../strength/baseline/dungeons');
await writeFile('.qa/build-baseline.sh',script);
const command='DUNGEONS_SOURCE=.qa/upstream-baseline/src DUNGEONS_BASELINE=1 bash .qa/build-baseline.sh';
if(process.platform==='win32')execFileSync('wsl',['-d','Ubuntu','--','bash','-lc',`cd '${shellRoot}'; ${command}`],{stdio:'inherit'});
else execFileSync('bash',['-lc',command],{stdio:'inherit'});
console.log('Pristine baseline compiled. Preserve a pre-change JS/WASM pair in .qa/strength/before before running the strength comparison.');
