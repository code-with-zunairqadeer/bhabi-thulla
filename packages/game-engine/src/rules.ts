/**
 * Classic ruleset contract (proposed defaults, versioned).
 * Two opening behaviours are configurable; everything else follows Classic.
 */
import { Card, Suit, isAceOfSpades, rankValue } from './cards.js';

export type OpeningRule = 'classic' | 'protected';

export interface RulesConfig {
  /** 'classic': off-suit play on the opening trick ends it immediately (Thulla).
   *  'protected': the opening trick always runs through all participants. */
  opening: OpeningRule;
  /** Ruleset version recorded with every match. Bump when defaults change. */
  version: string;
}

export const CLASSIC_RULES: RulesConfig = { opening: 'classic', version: 'classic-1' };
export const PROTECTED_OPENING_RULES: RulesConfig = { opening: 'protected', version: 'protected-1' };

export interface TrickPlay {
  seat: number;
  card: Card;
}

/**
 * Cards a player may legally play from hand.
 * - Opening lead of the match: only the A-spades.
 * - Leading a trick: anything.
 * - Following: must follow led suit if possible, else anything.
 */
export function legalPlays(
  hand: readonly Card[],
  ledSuit: Suit | null,
  mustOpenWithAceSpades: boolean,
): Card[] {
  if (mustOpenWithAceSpades) {
    const ace = hand.find(isAceOfSpades);
    return ace ? [ace] : [];
  }
  if (ledSuit === null) return [...hand];
  const follow = hand.filter((c) => c.suit === ledSuit);
  return follow.length > 0 ? follow : [...hand];
}

/**
 * Seat holding the highest card of the led suit among the plays.
 * Determines both normal-trick winners and Thulla pickup recipients.
 */
export function trickWinnerSeat(plays: readonly TrickPlay[], ledSuit: Suit): number {
  let best = -1;
  let bestVal = -1;
  for (const p of plays) {
    if (p.card.suit !== ledSuit) continue;
    const v = rankValue(p.card.rank);
    if (v > bestVal) {
      bestVal = v;
      best = p.seat;
    }
  }
  if (best === -1) throw new Error('trickWinnerSeat: no led-suit card in trick');
  return best;
}

/** A non-leading play that breaks suit ends the trick immediately (Thulla). */
export function isThullaPlay(card: Card, ledSuit: Suit, isLead: boolean): boolean {
  return !isLead && card.suit !== ledSuit;
}
