/**
 * Fair-information bots: each bot sees ONLY its own hand plus public table
 * state (played cards, hand counts, escapes, and publicly known voids).
 * The decision functions never receive opponents' hands — the server must
 * build the observation with `observe()` rather than passing the full match.
 */
import { Card, Suit, rankValue } from './cards.js';
import { TrickPlay } from './rules.js';
import { Match } from './engine.js';

export interface BotObservation {
  /** The bot's own seat index. */
  seat: number;
  ownHand: readonly Card[];
  legalPlays: readonly Card[];
  ledSuit: Suit | null;
  /** Cards played in the current trick (public). */
  trickPlays: readonly TrickPlay[];
  /** Card count per seat (public). */
  handCounts: readonly number[];
  escaped: readonly boolean[];
  /**
   * Publicly known voids, as "seat:suit". A seat becomes known void in a suit
   * the moment it breaks that suit — everyone at the table saw it happen.
   */
  knownVoids: ReadonlySet<string>;
}

/** Build a bot's view of the match. Contains no hidden information. */
export function observe(match: Match, seat: number): BotObservation {
  const t = match.trick;
  return {
    seat,
    ownHand: [...match.seats[seat].hand],
    legalPlays: match.legalPlays(seat),
    ledSuit: t?.ledSuit ?? null,
    trickPlays: t ? [...t.plays] : [],
    handCounts: match.seats.map((s) => s.hand.length),
    escaped: match.seats.map((s) => s.escaped),
    knownVoids: match.voids,
  };
}

function highest(cards: readonly Card[]): Card {
  return cards.reduce((a, b) => (rankValue(b.rank) > rankValue(a.rank) ? b : a));
}

function lowest(cards: readonly Card[]): Card {
  return cards.reduce((a, b) => (rankValue(b.rank) < rankValue(a.rank) ? b : a));
}

/** Easy: a random legal card. */
export function easyBot(obs: BotObservation, rng: () => number = Math.random): Card {
  const plays = obs.legalPlays;
  if (plays.length === 0) throw new Error('easyBot: no legal plays');
  return plays[Math.floor(rng() * plays.length)];
}

/**
 * Choose a lead card.
 *
 * Breaking suit is public, so leading a suit in which a still-active opponent
 * is known void hands them the power to stop the round — and a high lead card
 * would then pick the pile up. The rule is strict: never lead into a known
 * void while any alternative exists. Suits are ranked by fewest known-void
 * opponents, then by highest card (shed danger). If every suit has a known
 * void, lead the lowest card of the least-dangerous suit so an opponent
 * likely holds higher and takes the pile instead.
 */
function chooseLead(obs: BotObservation, plays: readonly Card[]): Card {
  const voidCount = (suit: Suit): number =>
    obs.handCounts.reduce(
      (n, _, i) => n + (i !== obs.seat && !obs.escaped[i] && obs.knownVoids.has(`${i}:${suit}`) ? 1 : 0),
      0,
    );
  const minVoids = Math.min(...plays.map((c) => voidCount(c.suit)));
  const candidates = plays.filter((c) => voidCount(c.suit) === minVoids);
  // Safest suits: shed the highest card. Every suit dangerous: lead the
  // lowest card so an opponent likely holds higher and takes the pile.
  return minVoids > 0 ? lowest(candidates) : highest(candidates);
}

/**
 * Normal: simple explainable heuristics.
 * - Leading: avoid suits with known voids (see chooseLead).
 * - Following: play the lowest card of the led suit, so the bot is least
 *   likely to become the pickup recipient if a later player Thullas.
 * - Unable to follow: the off-suit card cannot win the trick, so shed the
 *   highest card — it can never cause a pickup.
 */
export function normalBot(obs: BotObservation): Card {
  const plays = obs.legalPlays;
  if (plays.length === 0) throw new Error('normalBot: no legal plays');
  if (plays.length === 1) return plays[0];
  if (obs.ledSuit === null) return chooseLead(obs, plays);
  const follow = plays.filter((c) => c.suit === obs.ledSuit);
  if (follow.length > 0) return lowest(follow);
  return highest(plays);
}

export type BotDifficulty = 'easy' | 'normal';

export function chooseBotMove(
  obs: BotObservation,
  difficulty: BotDifficulty,
  rng?: () => number,
): Card {
  return difficulty === 'easy' ? easyBot(obs, rng) : normalBot(obs);
}
