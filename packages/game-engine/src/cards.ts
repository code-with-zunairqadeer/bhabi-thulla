/** Card model: suits, ranks, deck construction and shuffling. */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  /** Stable identity, e.g. "A-spades", "10-hearts". */
  readonly id: string;
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/** Numeric strength of a rank. A > K > Q > J > 10 ... 2. No trump in Classic. */
export function rankValue(rank: Rank): number {
  return RANK_VALUE[String(rank)];
}

export function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: `${String(rank)}-${suit}` };
}

/** A standard 52-card deck, no jokers, ordered by suit then rank. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}

/** Random source returning a float in [0, 1). Injectable for deterministic tests. */
export type Rng = () => number;

function defaultRng(): number {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
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
export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isAceOfSpades(card: Card): boolean {
  return card.suit === 'spades' && card.rank === 'A';
}

/** Positive if a outranks b, negative if lower, 0 if equal. */
export function compareByRank(a: Card, b: Card): number {
  return rankValue(a.rank) - rankValue(b.rank);
}
