// Chess Dungeons experimental interface to a locally patched Fairy-Stockfish.
// GPL-3.0-or-later; upstream authors and license are preserved in the source tree.
#include <iostream>
#include <sstream>
#include "bitboard.h"
#include "endgame.h"
#include "piece.h"
#include "position.h"
#include "psqt.h"
#include "search.h"
#include "thread.h"
#include "tt.h"
#include "uci.h"
#include "variant.h"

using namespace Stockfish;
static std::unique_ptr<Position> position;
static StateListPtr states;
static std::string output;
static std::unique_ptr<Variant> boardVariant;

static uint64_t perft(Position& pos, int depth) {
    if (!depth) return 1;
    uint64_t count = 0;
    const auto key = pos.key();
    const auto fen = pos.fen();
    for (const auto& move : MoveList<LEGAL>(pos)) {
        StateInfo next;
        pos.do_move(move, next);
        count += perft(pos, depth - 1);
        pos.undo_move(move);
        if (pos.key() != key || pos.fen() != fen) std::abort();
    }
    return count;
}

static std::string state_json(const std::string& extra = "") {
    std::ostringstream json;
    Value result;
    const bool draw = position->is_game_end(result);
    json << "{\"fen\":\"" << position->fen() << "\",\"key\":\"" << position->key()
         << "\",\"check\":" << (position->checkers() ? "true" : "false") << ",\"legal\":[";
    bool first = true;
    for (const auto& move : MoveList<LEGAL>(*position)) {
        if (!first) json << ',';
        first = false;
        json << '"' << UCI::move(*position, move) << '"';
    }
    json << "],\"draw\":" << (draw && result == VALUE_DRAW ? "true" : "false") << extra << '}';
    return json.str();
}

extern "C" int dungeon_init() {
    pieceMap.init();
    variants.init();
    UCI::init(Options);
    Tune::init();
    Options["Use NNUE"] = std::string("false");
    PSQT::init(variants.find("chess")->second);
    Bitboards::init();
    Position::init();
    Bitbases::init();
    Endgames::init();
    Threads.set(1);
    Search::clear();
    position.reset(new Position());
    return 1;
}

extern "C" const char* dungeon_command(const char* input) {
    std::istringstream command(input);
    std::string action;
    command >> action;
    if (action == "strength") {
        int elo = 0; command >> elo;
        elo = elo > 0 ? std::clamp(elo, 500, 2850) : 0;
        Options["UCI_LimitStrength"] = std::string(elo > 0 ? "true" : "false");
        if (elo > 0) Options["UCI_Elo"] = std::to_string(elo);
        else Options["Skill Level"] = std::string("20");
        output = "{\"strengthElo\":" + std::to_string(elo) + "}";
        return output.c_str();
    } else if (action == "load") {
        std::string fen;
        std::getline(command >> std::ws, fen);
        auto* rules = variants.find("chess")->second;
        boardVariant.reset();
        if (fen.substr(0, fen.find(' ')).find('*') != std::string::npos) {
            boardVariant.reset(new Variant(*rules));
            int rank = 7, file = 0, low = 7, high = 0;
            for (char c : fen.substr(0, fen.find(' '))) {
                if (c == '/') { --rank; file = 0; }
                else if (c >= '1' && c <= '8') { low = std::min(low, rank); high = std::max(high, rank); file += c - '0'; }
                else { if (c != '*') { low = std::min(low, rank); high = std::max(high, rank); } ++file; }
            }
            boardVariant->promotionRegion[WHITE] = rank_bb(Rank(high));
            boardVariant->promotionRegion[BLACK] = rank_bb(Rank(low));
            boardVariant->doubleStepRegion[WHITE] = rank_bb(Rank(low + 1));
            boardVariant->doubleStepRegion[BLACK] = rank_bb(Rank(high - 1));
            boardVariant->castling = false;
            boardVariant->endgameEval = NO_EG_EVAL;
            rules = boardVariant->conclude();
        }
        PSQT::init(rules);
        states.reset(new std::deque<StateInfo>(1));
        position->set(rules, fen, false, &states->back(), Threads.main());
        Search::clear();
    } else if (!states) {
        output = "{\"error\":\"Load a position first\"}";
        return output.c_str();
    } else if (action == "move") {
        std::string uci;
        command >> uci;
        Move move = UCI::to_move(*position, uci);
        if (move == MOVE_NONE) { output = "{\"error\":\"Illegal move\"}"; return output.c_str(); }
        const bool hit = position->dungeon_survives(move);
        states->emplace_back();
        position->do_move(move, states->back());
        output = state_json(std::string(",\"hit\":") + (hit ? "true" : "false"));
        return output.c_str();
    } else if (action == "undo" && states->size() > 1) {
        position->undo_move(states->back().move);
        states->pop_back();
    } else if (action == "perft") {
        int depth = 1;
        command >> depth;
        output = state_json(",\"nodes\":" + std::to_string(perft(*position, std::clamp(depth, 0, 5))));
        return output.c_str();
    } else if (action == "eval") {
        output = state_json(",\"score\":" + std::to_string(Eval::evaluate(*position)));
        return output.c_str();
    } else if (action == "search") {
        if (MoveList<LEGAL>(*position).size() == 0) { output = state_json(",\"bestmove\":null"); return output.c_str(); }
        Search::LimitsType limits;
        int depth = 4, milliseconds = 800;
        command >> depth >> milliseconds;
        limits.depth = std::clamp(depth, 1, 12);
        limits.movetime = std::clamp(milliseconds, 25, 3000);
        limits.startTime = now();
        const auto before = position->fen();
        Threads.start_thinking(*position, states, limits);
        Threads.main()->wait_for_search_finished();
        states = std::move(Threads.setupStates);
        auto* best = Threads.get_best_thread();
        const auto& root = best->rootMoves.front();
        if (before != position->fen()) std::abort();
        std::ostringstream extra;
        extra << ",\"bestmove\":\"" << UCI::move(*position, root.pv.front()) << "\",\"score\":" << int(root.score)
              << ",\"depth\":" << best->completedDepth << ",\"nodes\":" << Threads.nodes_searched();
        output = state_json(extra.str());
        return output.c_str();
    }
    output = state_json();
    return output.c_str();
}

#ifndef __EMSCRIPTEN__
int main() {
    dungeon_init();
    std::string command;
    while (std::getline(std::cin, command)) std::cout << dungeon_command(command.c_str()) << std::endl;
    Threads.set(0);
    return 0;
}
#endif
