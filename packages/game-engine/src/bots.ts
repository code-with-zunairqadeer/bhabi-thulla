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
 * Breaking suit is public, so the bot knows exactly who is void where — and
 * the seat that matters most is the next active player, who must follow
 * first. Leading a suit the next player is known void in is an instant
 * self-Thulla: they break at once and the lone lead card picks the pile up.
 * Those suits are forbidden while any alternative exists.
 *
 * Among the playable suits, the bot prefers the fewest known voids overall.
 * If the chosen suit has a later-player void, it leads low to bait the
 * break — someone else's higher card then takes the pile. With no voids in
 * play it sheds its highest card. Forced into a next-player void, it leads
 * its lowest card and keeps its high cards for later.
 */
function chooseLead(obs: BotObservation, plays: readonly Card[]): Card {
  const n = obs.handCounts.length;
  // Next active player after the bot — the one who must follow first.
  let next = obs.seat;
  for (let i = 1; i <= n; i++) {
    const s = (obs.seat + i) % n;
    if (!obs.escaped[s]) {
      next = s;
      break;
    }
  }
  const nextVoid = (suit: Suit): boolean => obs.knownVoids.has(`${next}:${suit}`);
  const totalVoids = (suit: Suit): number => {
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (i !== obs.seat && !obs.escaped[i] && obs.knownVoids.has(`${i}:${suit}`)) c++;
    }
    return c;
  };
  const laterVoids = (suit: Suit): number => {
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (i !== obs.seat && i !== next && !obs.escaped[i] && obs.knownVoids.has(`${i}:${suit}`)) c++;
    }
    return c;
  };

  const safe = plays.filter((c) => !nextVoid(c.suit));
  if (safe.length === 0) return lowest(plays);
  const minVoids = Math.min(...safe.map((c) => totalVoids(c.suit)));
  const candidates = safe.filter((c) => totalVoids(c.suit) === minVoids);
  // Bait a later void with the lowest card; otherwise shed the highest.
  return candidates.some((c) => laterVoids(c.suit) > 0) ? lowest(candidates) : highest(candidates);
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
