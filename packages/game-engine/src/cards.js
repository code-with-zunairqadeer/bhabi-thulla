/** Card model: suits, ranks, deck construction and shuffling. */
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
const RANK_VALUE = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};
/** Numeric strength of a rank. A > K > Q > J > 10 ... 2. No trump in Classic. */
export function rankValue(rank) {
    return RANK_VALUE[String(rank)];
}
export function makeCard(suit, rank) {
    return { suit, rank, id: `${String(rank)}-${suit}` };
}
/** A standard 52-card deck, no jokers, ordered by suit then rank. */
export function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push(makeCard(suit, rank));
        }
    }
    return deck;
}
function defaultRng() {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.getRandomValues) {
        const buf = new Uint32Array(1);
        cryptoObj.getRandomValues(buf);
        return buf[0] / 2 ** 32;
    }
    return Math.random();
}
/**
 * Fisher-Yates shuffle. Unbiased for a uniform rng.
 * Defaults to cryptographic randomness where available (per spec: secure server shuffle).
 */
export function shuffle(items, rng = defaultRng) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
export function isAceOfSpades(card) {
    return card.suit === 'spades' && card.rank === 'A';
}
/** Positive if a outranks b, negative if lower, 0 if equal. */
export function compareByRank(a, b) {
    return rankValue(a.rank) - rankValue(b.rank);
}
