# Local prototype verification — 2026-10-20

Upstream revision: `9f778da667f6e07dae1e85d3e2ea204fc6dee94d`.

- `npm run test:lab`: **14/14 passed**, running the actual browser WASM binary
  under Node, including exact rollback of state/hash, stone/diamond protection,
  double damage, pinned attacks, check evasion, castling, en passant, legal
  search replies, lethal protected-queen capture, mate with an armored defender,
  and the player-only glass preference.
- Existing `npm test`: **10/10 passed**.
- `npm run build`: passed; both the main page and `lab.html` are packaged.
- `node engine/check-patch.mjs`: passed; a fresh application of the tracked
  patch matches the modified upstream source used for compilation.
- Native Fairy-Stockfish benchmark: completed (6,180,480 searched nodes).
- Upstream `tests/perft.sh chess`: passed.
- Upstream `tests/perft.sh variant`: passed.
- Upstream `tests/perft.sh all`: passed with a native build using
  `largeboards=yes all=yes`.
- Upstream `stockfish check variants.ini`: completed with the large-board
  native build. Native builds are regression checks; the browser prototype
  uses its separate 8x8 single-threaded WASM build.

The Windows checkout uses CRLF for upstream shell scripts; perft scripts were
normalized to LF in a temporary Linux copy before running in Ubuntu/WSL.

Browser checks on `http://127.0.0.1:5173/lab.html`:

- 64 board cells and all scenario controls loaded successfully.
- Rook a1 attacking stone rook a4 spent the turn, left both pieces in place,
  and reduced the target to 1 HP.
- The bot replied a4–a1, capturing the attacking rook and giving check;
  the browser reported depth 5 and 379 nodes for that diagnostic position.
- Empowered knight f4 attacking diamond queen d5 removed 2 HP, leaving both
  pieces in place with the queen at 1 HP.
- Automatic black replies worked after an empowered lethal capture.
- At 390px viewport width, document width was 390px (no horizontal overflow).
- No browser errors or warnings were reported during these checks.

These checks establish the tested rules, integration and sample tactics.
They do not establish a calibrated Elo, broad strategic strength, balance of
the initial evaluation bonuses, or equivalence to standard Stockfish strength.

## Playable battle milestone — 20 October 2026

- Added `/battle.html`, four full-game army presets, white player vs automatic black replies.
- 15 application tests and 22 actual-WASM tests passed. New tests cover battle save replay, undo, preserved threefold repetition, terminal move lock, both-color mate and empowered captures at depths 3/5/7, avoiding an armored-hit mate trap, and evacuating a stone queen from an empowered knight.
- Browser: actual DevTools drag g1–f3 moved an ethereal knight and triggered b8–c6; reload restored both moves and ether appearance, undo returned the full player turn.
- Browser: d1–d8 hit on the diamond guard reduced HP 3→2, changed diamond artwork to stone, and left the attacking queen on d1.
- Browser: promotion offered all four roles; knight promotion produced insufficient-material draw, and undo restored the pawn. A mating move produced victory, resignation produced defeat.
- Browser: standard UCI castling moved king to g1 and preserved an ethereal rook on f1. Both standard and king-to-rook encodings are covered by appearance tests.
- Mobile viewport 390px: document width 390px, all board sprites loaded. No browser errors/warnings in checked flows.

No C++ search/evaluation changes or Elo calibration were made for this milestone. Tactical coverage was expanded; these checks do not imply broad strategic strength improvement. Campaign inventory effects remain future work.

Production preview (`vite preview`, local port 4174): verified e2–e4 hints and execution, automatic b8–c6 response, all board sprites loaded, and two-move save restored after reload without console errors/warnings. The preview was local only.
