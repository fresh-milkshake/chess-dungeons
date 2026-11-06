export const minElo = 100;
// Stockfish itself only accepts Elo values at or above this threshold.
export const nativeMinElo = 1320;
export const maxElo = 3190;
export const defaultElo = 1600;

export function normalizeElo(value, fallback = defaultElo) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minElo, Math.min(maxElo, Math.round(number))) : fallback;
}

// A beginner mode, not an empirically calibrated Elo scale. At 100 every move
// is sampled uniformly from legal moves; this fades into native Stockfish at 1320.
export function chooseOpponentMove(bestMove, legalMoves, elo, random = Math.random) {
  const strength = normalizeElo(elo);
  if (strength >= nativeMinElo || !legalMoves.length) return bestMove;
  const randomMoveChance = (nativeMinElo - strength) / (nativeMinElo - minElo);
  if (random() >= randomMoveChance) return bestMove;
  return legalMoves[Math.floor(random() * legalMoves.length)];
}
