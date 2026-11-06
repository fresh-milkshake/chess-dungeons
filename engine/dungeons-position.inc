// Chess Dungeons prototype. Included inside namespace Stockfish in position.cpp.
bool Position::dungeon_armored() const {
    if (!dungeon_mode()) return false;
    for (Bitboard occupied = pieces(); occupied;)
        if (st->durability[pop_lsb(occupied)]) return true;
    return false;
}

int Position::dungeon_capture_value(Move m) const {
    const Square target = type_of(m) == EN_PASSANT ? capture_square(to_sq(m)) : to_sq(m);
    const int value = int(PieceValue[MG][piece_on(target)]);
    if (!dungeon_hit(m)) return value;
    // A surviving hit gains armor only, not the target's full material value.
    if (dungeon_survives(m)) return value * std::min(int(st->durability[target]) - 1,
        st->damage[from_sq(m)] ? int(st->damage[from_sq(m)]) : 1) * 35 / 100;
    return value + (st->durability[target] ? value * (st->durability[target] - 1) * 35 / 100 : 0)
        + (st->damage[target] ? value * 12 / 100 : 0)
        + (st->glassHunter && color_of(piece_on(target)) == WHITE && (st->glassPieces & target) ? 35 : 0);
}

bool Position::dungeon_hit(Move m) const {
    if (!dungeon_mode() || type_of(m) == CASTLING || type_of(m) == DROP) return false;
    Square target = type_of(m) == EN_PASSANT ? capture_square(to_sq(m)) : to_sq(m);
    return piece_on(target) && color_of(piece_on(target)) != sideToMove;
}

bool Position::dungeon_survives(Move m) const {
    if (!dungeon_hit(m)) return false;
    Square target = type_of(m) == EN_PASSANT ? capture_square(to_sq(m)) : to_sq(m);
    return st->durability[target] > (st->damage[from_sq(m)] ? st->damage[from_sq(m)] : 1);
}

Key Position::dungeon_key() const {
    if (!dungeon_mode()) return 0;
    Key result = 0xD06E0A5F12345678ULL ^ (st->glassHunter ? 0x5896BACD1234ULL : 0);
    for (Square square = SQ_A1; square < SQUARE_NB; ++square) {
        const int bits = st->durability[square] + 4 * st->damage[square] + ((st->glassPieces & square) ? 16 : 0);
        if (!bits) continue;
        Key value = Key(1 + int(square) * 32 + bits) + 0x9e3779b97f4a7c15ULL;
        value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ULL;
        value = (value ^ (value >> 27)) * 0x94d049bb133111ebULL;
        result ^= value ^ (value >> 31);
    }
    return result;
}

void Position::dungeon_parse(const std::string& fen) {
    const auto marker = fen.find(" @");
    if (marker == std::string::npos) return;
    st->dungeonMode = true;
    std::string data = fen.substr(marker + 2), entry;
    std::istringstream input(data);
    while (std::getline(input, entry, ';')) {
        if (entry == "hunt=1") { st->glassHunter = true; continue; }
        if (entry.size() != 8 || entry[2] != '=' || entry[4] != '/' || entry[6] != '/') continue;
        if (entry[0] < 'a' || entry[0] > 'h' || entry[1] < '1' || entry[1] > '8') continue;
        Square square = make_square(File(entry[0] - 'a'), Rank(entry[1] - '1'));
        if (!piece_on(square) || type_of(piece_on(square)) == KING) continue;
        int hp = entry[3] - '0', damage = entry[5] - '0';
        if (hp < 1 || hp > 3 || damage < 1 || damage > 2) continue;
        st->durability[square] = hp > 1 ? hp : 0;
        st->damage[square] = damage > 1 ? damage : 0;
        if (entry[7] == '1') st->glassPieces |= square;
    }
}

std::string Position::dungeon_metadata() const {
    if (!dungeon_mode()) return "";
    std::ostringstream output;
    output << " @hunt=" << (st->glassHunter ? 1 : 0);
    for (Bitboard occupied = pieces(); occupied;) {
        Square square = pop_lsb(occupied);
        if (type_of(piece_on(square)) == KING) continue;
        if (st->durability[square] || st->damage[square] || (st->glassPieces & square))
            output << ';' << char('a' + file_of(square)) << char('1' + rank_of(square)) << '='
                   << (st->durability[square] ? int(st->durability[square]) : 1) << '/'
                   << (st->damage[square] ? int(st->damage[square]) : 1) << '/' << ((st->glassPieces & square) ? 1 : 0);
    }
    return output.str();
}

int Position::dungeon_eval() const {
    int score = 0;
    for (Bitboard occupied = pieces(); occupied;) {
        Square square = pop_lsb(occupied);
        Piece piece = piece_on(square);
        if (type_of(piece) == KING) continue;
        int value = int(PieceValue[MG][piece]);
        int bonus = st->durability[square] ? value * (st->durability[square] - 1) * 35 / 100 : 0;
        if (st->damage[square]) bonus += value * 12 / 100;
        // Only the player's glass pieces get a small survival premium. Black
        // minimizing this value gains a small incentive to destroy them.
        if (st->glassHunter && color_of(piece) == WHITE && (st->glassPieces & square)) bonus += 35;
        score += color_of(piece) == WHITE ? bonus : -bonus;
    }
    return sideToMove == WHITE ? score : -score;
}
