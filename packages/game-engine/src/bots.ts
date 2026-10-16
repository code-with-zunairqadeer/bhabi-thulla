/**
 * Fair-information bots: each bot sees ONLY its own hand plus public table
 * state (played cards, hand counts, escapes). The decision functions never
 * receive opponents' hands — the server must build the observation with
 * `observe()` rather than passing the full match.
 */
import { Card, Suit, rankValue } from './cards.js';
import { TrickPlay } from './rules.js';
import { Match } from './engine.js';

export interface BotObservation {
  ownHand: readonly Card[];
  legalPlays: readonly Card[];
  ledSuit: Suit | null;
  /** Cards played in the current trick (public). */
  trickPlays: readonly TrickPlay[];
  /** Card count per seat (public). */
  handCounts: readonly number[];
  escaped: readonly boolean[];
}

/** Build a bot's view of the match. Contains no hidden information. */
export function observe(match: Match, seat: number): BotObservation {
  const t = match.trick;
  return {
    ownHand: [...match.seats[seat].hand],
    legalPlays: match.legalPlays(seat),
    ledSuit: t?.ledSuit ?? null,
    trickPlays: t ? [...t.plays] : [],
    handCounts: match.seats.map((s) => s.hand.length),
    escaped: match.seats.map((s) => s.escaped),
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
 * Normal: simple explainable heuristics.
 * - Leading: shed the highest card. If everyone follows it is discarded and
 *   the bot keeps the lead; high cards are the most dangerous to hold.
 * - Following: play the lowest card of the led suit, so the bot is least
 *   likely to become the pickup recipient if a later player Thullas.
 * - Unable to follow: the off-suit card cannot win the trick, so shed the
 *   highest card — it can never cause a pickup.
 */
export function normalBot(obs: BotObservation): Card {
  const plays = obs.legalPlays;
  if (plays.length === 0) throw new Error('normalBot: no legal plays');
  if (plays.length === 1) return plays[0];
  if (obs.ledSuit === null) return highest(plays);
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
