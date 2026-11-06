# Chess Dungeons engine prototype

Chess Dungeons uses a patched Fairy-Stockfish, pinned to upstream commit
`9f778da667f6e07dae1e85d3e2ea204fc6dee94d`:
https://github.com/fairy-stockfish/Fairy-Stockfish

Upstream sources are downloaded to ignored `.qa/fairy-stockfish`. Tracked files
in this directory describe and apply the modifications; generated binaries live
in ignored `public/engine`. The Pages workflow rebuilds the engine from these
sources before running the tests and publishing the game.

## Build

On this Windows workstation the build uses Ubuntu in WSL with `emscripten`,
`g++`, and `make`. On Linux it uses the installed Emscripten directly.

```sh
npm run build:lab
npm run test:lab
npm run build
npm run dev
```

Open `/lab.html`. The engine runs entirely in a single browser Worker and does
not need a server-side engine, SharedArrayBuffer, or COOP/COEP headers.

`patch-fairy.mjs` patches the pinned checkout once, with exact-match checks.
After changing the patcher, use a new ignored checkout to apply it cleanly;
do not assume an existing patched tree has been updated. `build.sh` copies the
tracked C++ API and compiles it; incremental WASM objects are in
`.qa/dungeons-build/wasm`. `dungeons-position.inc` contains the additional
position mechanics. The upstream GPL-3.0-or-later license applies to the fork.

## Implemented rules

- Ordinary pieces have 1 HP and 1 damage; stone has 2 HP, diamond 3 HP.
- Empowered pieces have 2 damage. A surviving target stays on its square;
  attacker stays too, and the turn changes. HP loss resets the 50-move counter.
- On a lethal attack the usual capture is performed. Properties move with
  their piece, including rook properties during castling.
- Royal kings cannot carry HP, power, or glass attributes.
- Pinned pieces may make nonlethal hits while staying in place. A nonlethal
  hit cannot remove a check on your king or give a new check.
- Attributes are included in hashes, FEN round-trips, search root state, and
  make/unmake. Ordinary search and checkmate handling remain Fairy-Stockfish.
- Player glass pieces receive a small extra survival value only for an
  ordinary enemy (`hunt=1`); the enemy gains that extra benefit when destroying
  them. Boss mode (`hunt=0`) omits it. The bot's own glass and ethereal pieces
  have ordinary in-battle value.

Extended FEN suffix example: ` @hunt=1;a4=2/1/0;c3=1/2/0`.
Each square entry is `square=HP/damage/glass`. An empty `@hunt=0` still enables
dungeon rules without the glass preference. Battle metadata is local and
separate from any future campaign inventory identifiers.

## Strength limitations

This is a correctness and feasibility prototype, not a rated opponent.
NNUE is disabled for dungeon positions. Classical evaluation receives small
initial bonuses for armor and damage; these have not been tuned by self-play.
Ordinary static-exchange pruning is bypassed while armor remains because
its assumptions do not hold for nonlethal attacks. It is restored after the
last armored piece loses its protection. Capture ordering uses actual armor
damage; ordinary endgame shortcuts and capture-futility bounds are guarded. Other search heuristics
still need profiling and validation. No claim of preserving standard
Stockfish Elo is made.

The current UI offers depth controls, not Elo. It uses a fixed 8x8 board and
predefined diagnostic positions; a campaign, variable board sizes, persistent
inventory, arbitrary new movement patterns, and training NNUE are later work.

Tests run the actual compiled WASM: ordinary perft reference, armored perft
with exact rollback, one/two damage, pinned hits, check evasions, position keys,
castling and en passant, legal search replies, lethal queen capture, mate in one
with an armored defender, and glass policy. `node engine/check-patch.mjs`
also verifies that a clean application of the tracked patch produces the
same modified upstream source that was compiled locally.

Measured comparison and its limits: [STRENGTH.md](STRENGTH.md).
