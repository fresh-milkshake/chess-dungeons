import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const files = ['position.h', 'position.cpp', 'evaluate.cpp', 'thread.cpp', 'tt.cpp', 'movepick.cpp', 'search.cpp'];
const target = '.qa/patch-verification';
await mkdir(target, { recursive: true });
for (const file of files) {
  const original = execFileSync('git', ['-C', '.qa/fairy-stockfish', 'show', `HEAD:src/${file}`]);
  await writeFile(`${target}/${file}`, original);
}
execFileSync(process.execPath, ['engine/patch-fairy.mjs', target], { stdio: 'inherit' });
for (const file of [...files, 'dungeons-position.inc']) {
  const expected = (await readFile(`${target}/${file}`, 'utf8')).replace(/\r\n/g, '\n');
  const actual = (await readFile(`.qa/fairy-stockfish/src/${file}`, 'utf8')).replace(/\r\n/g, '\n');
  if (actual !== expected) throw new Error(`Generated source differs from reproducible patch: ${file}`);
}
console.log('Patched source matches a clean application to the pinned upstream revision.');
