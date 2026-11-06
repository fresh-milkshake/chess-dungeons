#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source_dir="${DUNGEONS_SOURCE:-.qa/fairy-stockfish/src}"
mkdir -p public/engine .qa/dungeons-build
if [[ "${DUNGEONS_BASELINE:-0}" != 1 ]]; then cp engine/dungeons-api.cpp "$source_dir/dungeons-api.cpp"; fi
cd "$source_dir"
sources=(benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp material.cpp misc.cpp movegen.cpp movepick.cpp pawns.cpp position.cpp psqt.cpp search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp nnue/evaluate_nnue.cpp nnue/features/half_ka_v2.cpp partner.cpp parser.cpp piece.cpp variant.cpp xboard.cpp nnue/features/half_ka_v2_variants.cpp dungeons-api.cpp)
flags=(-std=c++17 -O2 -DNDEBUG -DNNUE_EMBEDDING_OFF -DDUNGEONS_SINGLE_THREAD -I.)
target="${1:-wasm}"
if [[ "$target" == native ]]; then
  g++ "${flags[@]}" "${sources[@]}" -pthread -o ../../dungeons-build/dungeons-native
else
  mkdir -p ../../dungeons-build/wasm
  objects=()
  for source in "${sources[@]}"; do
    object="../../dungeons-build/wasm/${source//\//_}.o"
    if [[ ! -f "$object" || "$source" -nt "$object" || ( "$source" == position.cpp && dungeons-position.inc -nt "$object" ) ]] || find . -name '*.h' -newer "$object" -print -quit 2>/dev/null | grep -q .; then
      em++ "${flags[@]}" -c "$source" -o "$object"
    fi
    objects+=("$object")
  done
  em++ -O2 "${objects[@]}" --no-entry -sMODULARIZE=1 -sEXPORT_NAME=createDungeonEngine -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 -sMAXIMUM_MEMORY=268435456 -sTOTAL_STACK=8388608 -sEXPORTED_FUNCTIONS='["_dungeon_init","_dungeon_command"]' -sEXPORTED_RUNTIME_METHODS='["ccall"]' -o ../../../public/engine/dungeons.js
fi
