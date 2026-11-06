/* Experimental, single-threaded Fairy-Stockfish WASM adapter. */
importScripts('./dungeons.js');
const ready = createDungeonEngine({
  locateFile: (file) => new URL(file, self.location.href).href,
  print: () => {},
  printErr: (message) => console.warn(message),
}).then((engine) => { engine.ccall('dungeon_init', 'number', [], []); return engine; });
let queue = Promise.resolve();
self.onmessage = ({ data: { id, command } }) => {
  queue = queue.then(async () => {
    try {
      const engine = await ready;
      const result = JSON.parse(engine.ccall('dungeon_command', 'string', ['string'], [command]));
      self.postMessage({ id, result });
    } catch (error) { self.postMessage({ id, error: String(error) }); }
  });
};
