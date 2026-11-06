import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const upstream = 'https://github.com/fairy-stockfish/Fairy-Stockfish.git';
const revision = '9f778da667f6e07dae1e85d3e2ea204fc6dee94d';
const checkout = '.qa/fairy-stockfish';
function run(program, args) {
  const result = spawnSync(program, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status})`);
}
await mkdir('.qa', { recursive: true });
if (!existsSync(`${checkout}/.git`)) {
  run('git', ['clone', '--no-checkout', upstream, checkout]);
  run('git', ['-C', checkout, 'checkout', '--detach', revision]);
}
const actual = spawnSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
if (actual.stdout.trim() !== revision) throw new Error(`Unexpected upstream revision in ${checkout}; expected ${revision}`);
run(process.execPath, ['engine/patch-fairy.mjs']);
run(process.execPath, ['engine/check-patch.mjs']);
if (process.platform === 'win32') run('wsl', ['-d', 'Ubuntu', '--', 'bash', 'engine/build.sh', 'wasm']);
else run('bash', ['engine/build.sh', 'wasm']);
await copyFile('engine/dungeons-worker.js', 'public/engine/dungeons-worker.js');
console.log('Dungeon Fairy-Stockfish WASM built locally.');
