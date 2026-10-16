/**
 * Classic ruleset contract (proposed defaults, versioned).
 * Two opening behaviours are configurable; everything else follows Classic.
 */
import { isAceOfSpades, rankValue } from './cards.js';
export const CLASSIC_RULES = { opening: 'classic', version: 'classic-1' };
export const PROTECTED_OPENING_RULES = { opening: 'protected', version: 'protected-1' };
/**
 * Cards a player may legally play from hand.
 * - Opening lead of the match: only the A-spades.
 * - Leading a trick: anything.
 * - Following: must follow led suit if possible, else anything.
 */
export function legalPlays(hand, ledSuit, mustOpenWithAceSpades) {
    if (mustOpenWithAceSpades) {
        const ace = hand.find(isAceOfSpades);
        return ace ? [ace] : [];
    }
    if (ledSuit === null)
        return [...hand];
    const follow = hand.filter((c) => c.suit === ledSuit);
    return follow.length > 0 ? follow : [...hand];
}
/**
 * Seat holding the highest card of the led suit among the plays.
 * Determines both normal-trick winners and Thulla pickup recipients.
 */
export function trickWinnerSeat(plays, ledSuit) {
    let best = -1;
    let bestVal = -1;
    for (const p of plays) {
        if (p.card.suit !== ledSuit)
            continue;
        const v = rankValue(p.card.rank);
        if (v > bestVal) {
            bestVal = v;
            best = p.seat;
        }
    }
    if (best === -1)
        throw new Error('trickWinnerSeat: no led-suit card in trick');
    return best;
}
/** A non-leading play that breaks suit ends the trick immediately (Thulla). */
export function isThullaPlay(card, ledSuit, isLead) {
    return !isLead && card.suit !== ledSuit;
}
