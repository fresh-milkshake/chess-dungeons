import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2] ?? '.qa/fairy-stockfish/src';
async function patch(file, replacements) {
  let text = (await readFile(join(root, file), 'utf8')).replace(/\r\n/g, '\n');
  if (text.includes('// DUNGEONS PATCH')) return;
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Patch mismatch: ${file}: ${from.slice(0, 70)}`);
    text = text.replace(from, to);
  }
  await writeFile(join(root, file), '// DUNGEONS PATCH\n' + text);
}

await patch('position.h', [
  ['  // Copied when making a move', '  // Copied when making a move\n  bool dungeonMode;\n  bool glassHunter;\n  unsigned char durability[SQUARE_NB]; // zero means ordinary (one hit point)\n  unsigned char damage[SQUARE_NB]; // zero means ordinary (one damage)\n  Bitboard glassPieces;'],
  ['  // FEN string input/output', `  bool dungeon_mode() const { return st->dungeonMode; }
  bool dungeon_hit(Move m) const;
  bool dungeon_armored() const;
  int dungeon_capture_value(Move m) const;
  bool dungeon_survives(Move m) const;
  Key dungeon_key() const;
  int dungeon_eval() const;
  std::string dungeon_metadata() const;
  void dungeon_parse(const std::string& fen);

  // FEN string input/output`],
  ['  return (!count_in_hand(ALL_PIECES)', '  return !dungeon_mode() && (!count_in_hand(ALL_PIECES)'],
]);

await copyFile('engine/dungeons-position.inc', join(root, 'dungeons-position.inc'));
await patch('position.cpp', [
  ['  set_state(st);\n\n  assert(pos_is_ok());', '  dungeon_parse(fenStr);\n  set_state(st);\n\n  assert(pos_is_ok());'],
  ['  si->key ^= Zobrist::castling[si->castlingRights];', '  si->key ^= Zobrist::castling[si->castlingRights];\n  si->key ^= dungeon_key();'],
  ['  ss << " " << 1 + (gamePly - (sideToMove == BLACK)) / 2;', '  ss << " " << 1 + (gamePly - (sideToMove == BLACK)) / 2;\n  ss << dungeon_metadata();'],
  ['  // Illegal checks', `  if (dungeon_survives(m))
      return !checkers() && (type_of(m) != PROMOTION || promotion_type(m) == QUEEN);

  // Illegal checks`],
  ['bool Position::gives_check(Move m) const {', 'bool Position::gives_check(Move m) const {\n  if (dungeon_survives(m)) return false;'],
  ['#ifndef NO_THREADS\n  thisThread->nodes.fetch_add', `  if (dungeon_survives(m)) {
      newSt = *st;
      newSt.previous = st;
      st = &newSt;
      const Square target = type_of(m) == EN_PASSANT ? capture_square(to_sq(m)) : to_sq(m);
      const int power = st->damage[from_sq(m)] ? st->damage[from_sq(m)] : 1;
      st->durability[target] -= power;
      if (st->durability[target] == 1) st->durability[target] = 0;
      st->epSquares = 0;
      st->rule50 = 0;
      ++st->pliesFromNull;
      ++gamePly;
      sideToMove = ~sideToMove;
      set_state(st);
      st->move = m;
      st->capturedPiece = NO_PIECE;
      st->repetition = 0;
      st->dirtyPiece.dirty_num = 0;
      st->accumulator.computed[WHITE] = st->accumulator.computed[BLACK] = false;
      thisThread->nodes.fetch_add(1, std::memory_order_relaxed);
      return;
  }

#ifndef NO_THREADS
  thisThread->nodes.fetch_add`],
  ['  Key k = st->key ^ Zobrist::side;', '  Key k = st->key ^ Zobrist::side;\n  const Key oldDungeonKey = dungeon_key();'],
  ['  // Update the key with the final value', `  if (dungeon_mode()) {
      Square target = type_of(m) == CASTLING ? make_square(to > from ? FILE_G : FILE_C, rank_of(from)) : to;
      if (type_of(m) == EN_PASSANT) {
          Square cap = capture_square(to);
          st->durability[cap] = st->damage[cap] = 0;
          st->glassPieces &= ~square_bb(cap);
      }
      st->durability[target] = st->durability[from];
      st->damage[target] = st->damage[from];
      st->glassPieces = (st->glassPieces & ~square_bb(target)) | ((st->glassPieces & from) ? square_bb(target) : Bitboard(0));
      st->durability[from] = st->damage[from] = 0;
      st->glassPieces &= ~square_bb(from);
      if (type_of(m) == CASTLING) {
          Square rookFrom = to_sq(m);
          Square rookTo = make_square(to > from ? FILE_F : FILE_D, rank_of(from));
          st->durability[rookTo] = st->durability[rookFrom];
          st->damage[rookTo] = st->damage[rookFrom];
          st->glassPieces = (st->glassPieces & ~square_bb(rookTo)) | ((st->glassPieces & rookFrom) ? square_bb(rookTo) : Bitboard(0));
          st->durability[rookFrom] = st->damage[rookFrom] = 0;
          st->glassPieces &= ~square_bb(rookFrom);
      }
      k ^= oldDungeonKey ^ dungeon_key();
  }

  // Update the key with the final value`],
  ['  Color us = sideToMove;\n  Square from = from_sq(m);\n  Square to = to_sq(m);\n  Piece pc = piece_on(to);', `  if (dungeon_mode() && st->previous) {
      const StateInfo* previous = st->previous;
      const Square target = type_of(m) == EN_PASSANT ? capture_square(to_sq(m)) : to_sq(m);
      if (previous->durability[target] > (previous->damage[from_sq(m)] ? previous->damage[from_sq(m)] : 1)
          && type_of(m) != CASTLING && piece_on(from_sq(m)) != NO_PIECE) {
          st = st->previous;
          --gamePly;
          return;
      }
  }
  Color us = sideToMove;
  Square from = from_sq(m);
  Square to = to_sq(m);
  Piece pc = piece_on(to);`],
  ['bool Position::see_ge(Move m, Value threshold) const {', `bool Position::see_ge(Move m, Value threshold) const {
  // Ordinary exchange pruning cannot prove an armored attack is bad.
  if (dungeon_armored()) return true;`],
  ['} // namespace Stockfish', '#include "dungeons-position.inc"\n\n} // namespace Stockfish'],
]);

await patch('movepick.cpp', [
  ['int(PieceValue[MG][pos.piece_on(to_sq(m))]) * 6', '(pos.dungeon_mode() ? pos.dungeon_capture_value(m) : int(PieceValue[MG][pos.piece_on(to_sq(m))])) * 6'],
]);

await patch('search.cpp', [
  ['          &&  futilityBase > -VALUE_KNOWN_WIN', '          && !pos.dungeon_armored() // Armor hits invalidate ordinary capture futility bounds.\n          &&  futilityBase > -VALUE_KNOWN_WIN'],
]);

await patch('evaluate.cpp', [
  ['if (me->specialized_eval_exists())', 'if (!pos.dungeon_armored() && me->specialized_eval_exists())'],
  ['int sf = me->scale_factor(pos, strongSide);', 'int sf = pos.dungeon_armored() ? int(SCALE_FACTOR_NORMAL) : me->scale_factor(pos, strongSide);'],
  ['if (sf == SCALE_FACTOR_NORMAL && !pos.captures_to_hand()', 'if (!pos.dungeon_armored() && sf == SCALE_FACTOR_NORMAL && !pos.captures_to_hand()'],
  ['  // Damp down the evaluation linearly when shuffling', '  if (pos.dungeon_mode()) v += Value(pos.dungeon_eval());\n\n  // Damp down the evaluation linearly when shuffling'],
]);

await patch('thread.cpp', [
  ['Thread::Thread(size_t n) : idx(n), stdThread(&Thread::idle_loop, this) {', `#ifdef DUNGEONS_SINGLE_THREAD
Thread::Thread(size_t n) : idx(n), stdThread() { searching = false; }
#else
Thread::Thread(size_t n) : idx(n), stdThread(&Thread::idle_loop, this) {`],
  ['/// Thread destructor', '#endif\n\n/// Thread destructor'],
  ['  exit = true;', '#ifndef DUNGEONS_SINGLE_THREAD\n  exit = true;'],
  ['  stdThread.join();', '  stdThread.join();\n#endif'],
  ['  std::lock_guard<std::mutex> lk(mutex);\n  searching = true;', '#ifdef DUNGEONS_SINGLE_THREAD\n  searching = true;\n  search();\n  searching = false;\n#else\n  std::lock_guard<std::mutex> lk(mutex);\n  searching = true;'],
  ['  cv.notify_one(); // Wake up the thread in idle_loop()', '  cv.notify_one(); // Wake up the thread in idle_loop()\n#endif'],
  ['  std::unique_lock<std::mutex> lk(mutex);\n  cv.wait(lk, [&]{ return !searching; });', '#ifndef DUNGEONS_SINGLE_THREAD\n  std::unique_lock<std::mutex> lk(mutex);\n  cv.wait(lk, [&]{ return !searching; });\n#endif'],
]);
await patch('tt.cpp', [
  ['  std::vector<std::thread> threads;', '#ifdef DUNGEONS_SINGLE_THREAD\n  std::memset(table, 0, clusterCount * sizeof(Cluster));\n#else\n  std::vector<std::thread> threads;'],
  ['      th.join();', '      th.join();\n#endif'],
]);
