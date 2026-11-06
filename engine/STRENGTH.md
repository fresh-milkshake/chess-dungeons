# Strength check — 20 October 2026

The ordinary game still uses its unchanged Stockfish 19 worker. This experiment concerns only the Fairy-Stockfish dungeon prototype. It does not measure an Elo difference against Stockfish 19.

## Controlled ordinary-position comparison

Pinned upstream: `9f778da667f6e07dae1e85d3e2ea204fc6dee94d`. All three binaries use the same single-thread WASM adapter, compiler settings and classical evaluation (NNUE disabled). The pristine baseline keeps upstream position, search, evaluation and move ordering. Twelve positions from six opening lines were searched to depth 7 after JIT warmup. Each root clears the transposition table. The dungeon roots use `@hunt=0` with no armor or power, so their legal game is exactly ordinary chess.

| Measure | Pristine baseline | Previous prototype | Updated prototype |
|---|---:|---:|---:|
| Same best move as baseline | 12/12 | 5/12 | 12/12 |
| Total searched nodes | 54,255 | 72,481 | 54,253 |
| Summed elapsed time, one run | 140.6 ms | 197.5 ms | 170.2 ms |

This establishes recovery of ordinary search behavior on the sampled positions, and approximately 25.1% fewer nodes than the previous prototype at that depth. Different moves alone are not evidence of inferior play. Timings are small, single-run observations and include dungeon bookkeeping overhead; they are not a reliable speed rating.

## Special-rule comparison

Twelve starting positions (four diagnostic scenes plus eight opening positions with armor/power) were played with both engine/color assignments. Each root uses the same rules, one thread, and a freshly cleared hash. Positions share opening lines and are not independent rating samples.

| Budget | Updated wins | Previous wins | Draws | Unfinished at ply cap |
|---|---:|---:|---:|---:|
| 40 ms, depth cap 12, 100 plies | 7 | 9 | 0 | 8 |
| Fixed depth 5, 140 plies | 9 | 10 | 2 | 3 |

Unfinished games are not adjudicated as draws. All executed moves were legal. These results do **not** establish a statistically convincing strength gain or loss with armor. A 300 ms search agreed with the updated engine's own 3000 ms reference on 8/12 roots, versus 7/12 for the previous engine; this measures search stability against a non-independent reference, not objective playing strength.

## Additional held-out continuation check

After the changes were frozen, four deterministic seeds per starting root produced six uniformly selected legal continuation plies, followed by paired-color depth-5 games (140-ply cap). In 96 games the updated engine won 33, the previous engine won 41, 14 were drawn and 8 were unfinished. Raw continuations and all moves are in `strength-holdout.json`; rerun with `node engine/strength-holdout.mjs`. The sample favors the previous version numerically, but does not establish a statistically convincing strength difference; no armor strength gain is claimed. In particular, the ordinary-position search recovery must not be interpreted as restored Stockfish-level strength under armor rules.

## Changes retained

- Restore ordinary static exchange pruning once no armor remains. Empowered damage alone does not change captures against 1-HP targets.
- Order attacks by the material/armor actually removed, rather than treating every nonlethal hit as a full capture.
- Do not apply the ordinary quiescence capture-futility bound while armor is present.
- Disable specialized ordinary endgame evaluations and draw-scaling heuristics while armor is present.
- Preserve the small ordinary-enemy preference for destroying the player's glass; boss mode and the bot's own glass receive no such premium.

The prototype still uses hand-tuned classical armor/power values. A suitably trained NNUE and a larger independent tactical/self-play suite are needed before claiming preservation of Stockfish-level strength or assigning Elo.

## Evidence and reproduction

Raw roots, search outputs and complete game move lists: `strength-results.json`.

Before modifying the engine, preserve `public/engine/dungeons.js` and `.wasm` in `.qa/strength/before/`. Build the candidate with `npm run build:lab`. `node scripts/prepare-strength.mjs` prepares the pristine pinned baseline using the same browser adapter. Then run `node engine/strength-bench.mjs` and `node engine/strength-selfplay.mjs`. The latter adds fixed-depth games to `.qa/strength/report.json`.

Validation: 16 actual-WASM regression tests, 13 application tests, production build, reproducible clean patch application, native upstream bench (6,257,668 nodes), upstream `perft.sh all`, and `stockfish check variants.ini` passed. Browser testing verified armor-to-ordinary artwork transitions and undo, and ether artwork movement/undo. These are bounded checks, not a strength certification.
