import { mkdir, copyFile, access } from 'node:fs/promises';

await mkdir('public/engine', { recursive: true });
for (const ext of ['js', 'wasm']) {
  await copyFile(`node_modules/stockfish/bin/stockfish-19-lite-single.${ext}`, `public/engine/stockfish-19-lite-single.${ext}`);
}
for (const ext of ['js', 'wasm']) {
  try { await access(`public/engine/dungeons.${ext}`); }
  catch { throw new Error('Experimental engine missing. Run npm run build:lab first (requires Emscripten).'); }
}
await copyFile('engine/dungeons-worker.js', 'public/engine/dungeons-worker.js');
