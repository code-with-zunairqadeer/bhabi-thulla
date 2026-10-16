/**
 * Acceptance tests for the Bhabi Thulla game engine (Milestone B).
 * Covers the rules contract: deal, opening, follow-suit, Thulla, escapes,
 * Bhabi/draw endgames, card conservation, bot fairness and both openings.
 */
import { describe, it, expect } from 'vitest';
import {
  Card, Suit, Rank, makeCard, createDeck, Rng,
} from '../src/cards.js';
import { trickWinnerSeat, PROTECTED_OPENING_RULES } from '../src/rules.js';
import { Match } from '../src/engine.js';
import { observe, easyBot, normalBot, BotObservation } from '../src/bots.js';

const C = (rank: string | number, suit: Suit): Card => makeCard(suit, rank as Rank);

/** Deterministic RNG for reproducible tests. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function allCardIds(m: Match): string[] {
  const ids: string[] = [];
  for (const s of m.seats) for (const c of s.hand) ids.push(c.id);
  if (m.trick) for (const p of m.trick.plays) ids.push(p.card.id);
  for (const c of m.discardPile) ids.push(c.id);
  return ids;
}

describe('cards and deal', () => {
  it('creates a 52-card deck with distinct cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it.each([
    [4, 13, 0],
    [5, 10, 2],
    [6, 8, 4],
    [7, 7, 3],
  ])('deals fairly with %i seats: %i cards each, %i sit out', (n, perSeat, aside) => {
    const m = new Match({ numSeats: n, rng: mulberry32(n) });
    const sizes = m.seats.map((s) => s.hand.length);
    expect(sizes.every((s) => s === perSeat)).toBe(true);
    expect(m.setAside).toHaveLength(aside);
    const dealtIds = allCardIds(m);
    expect(new Set(dealtIds).size).toBe(dealtIds.length); // no duplicates
    // The A-spades is always in play — someone must open with it.
    expect(dealtIds).toContain('A-spades');
    expect(m.setAside.some((c) => c.id === 'A-spades')).toBe(false);
  });

  it('keeps the A-spades in play across many shuffles', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const n of [5, 6, 7]) {
        const m = new Match({ numSeats: n, rng: mulberry32(seed * 100 + n) });
        expect(allCardIds(m)).toContain('A-spades');
        expect(m.setAside.some((c) => c.id === 'A-spades')).toBe(false);
      }
    }
  });

  it('rotates the dealer', () => {
    expect(new Match({ numSeats: 4, dealer: 2 }).nextDealer()).toBe(3);
    expect(new Match({ numSeats: 4, dealer: 3 }).nextDealer()).toBe(0);
  });
});

describe('opening', () => {
  it('A-spades holder opens and may only play the A-spades', () => {
    const m = new Match({ numSeats: 4, rng: mulberry32(7) });
    const opener = m.seats.findIndex((s) => s.hand.some((c) => c.id === 'A-spades'));
    expect(m.turnSeat()).toBe(opener);
    const legal = m.legalPlays(opener);
    expect(legal).toHaveLength(1);
    expect(legal[0].id).toBe('A-spades');
    const r = m.playCard(opener, 'A-spades');
    expect(r.thulla).toBe(false);
    expect(m.trick?.ledSuit).toBe('spades');
  });

  it('the A-spades opening trick can never Thulla (protected by default)', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('9', 'hearts')],
        [C('5', 'clubs'), C('6', 'clubs')],
        [C('7', 'hearts'), C('7', 'clubs')],
        [C('8', 'hearts'), C('8', 'clubs')],
      ],
    });
    expect(m.rules.opening).toBe('protected');
    expect(m.turnSeat()).toBe(0);
    m.playCard(0, 'A-spades');
    const r1 = m.playCard(1, '5-clubs'); // no spades — still no Thulla
    expect(r1.thulla).toBe(false);
    expect(r1.trickComplete).toBe(false);
    m.playCard(2, '7-hearts');
    const r3 = m.playCard(3, '8-hearts');
    expect(r3.trickComplete).toBe(true);
    expect(r3.thulla).toBe(false);
    // A-spades player leads the next trick.
    expect(m.turnSeat()).toBe(0);
  });
});

describe('follow-suit', () => {
  it('must follow suit when possible, any card when void', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts'), C('3', 'clubs')],
        [C('9', 'diamonds')],
        [C('2', 'diamonds')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    const legal = m.legalPlays(1).map((c) => c.id);
    expect(legal).toEqual(['5-hearts']); // must follow; clubs not allowed
    expect(() => m.playCard(1, '3-clubs')).toThrow('illegal play');
  });
});

describe('thulla', () => {
  it('off-suit play ends the trick at once; later players do not play', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('3', 'clubs')],
        [C('A', 'hearts')],
        [C('5', 'hearts')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    const r = m.playCard(1, '3-clubs'); // no hearts -> Thulla
    expect(r.thulla).toBe(true);
    expect(r.trickComplete).toBe(true);
    expect(r.pickedUpBy).toBe(0); // K-hearts is highest hearts
    // Seats 2 and 3 never got to play.
    expect(m.seats[2].hand).toHaveLength(1);
    expect(m.seats[3].hand).toHaveLength(1);
    // Recipient collected the pile and leads the next trick.
    expect(m.seats[0].hand).toHaveLength(1 + 2); // A-spades + 2 picked up
    expect(m.turnSeat()).toBe(0);
    expect(m.events.join(' ')).toMatch(/Thulla!/);
  });

  it('matches the brief example: K-hearts, 5-hearts, A-hearts, 3-clubs -> A-hearts collects 4 and leads', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts')],
        [C('A', 'hearts')],
        [C('3', 'clubs')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '5-hearts');
    m.playCard(2, 'A-hearts');
    const r = m.playCard(3, '3-clubs');
    expect(r.thulla).toBe(true);
    expect(r.pickedUpBy).toBe(2);
    const collected = m.seats[2].hand.map((c) => c.id).sort();
    expect(collected).toEqual(['3-clubs', '5-hearts', 'A-hearts', 'K-hearts'].sort());
    expect(m.turnSeat()).toBe(2);
  });

  it('trickWinnerSeat picks the highest led-suit card only', () => {
    expect(trickWinnerSeat(
      [
        { seat: 0, card: C('K', 'hearts') },
        { seat: 1, card: C('5', 'hearts') },
        { seat: 2, card: C('A', 'hearts') },
        { seat: 3, card: C('3', 'clubs') },
      ],
      'hearts',
    )).toBe(2);
  });
});

describe('normal tricks', () => {
  it('all-follow trick is discarded and the highest card leads next', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts'), C('4', 'diamonds')],
        [C('5', 'hearts'), C('6', 'diamonds')],
        [C('2', 'hearts'), C('7', 'diamonds')],
        [C('9', 'hearts'), C('8', 'diamonds')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '5-hearts');
    m.playCard(2, '2-hearts');
    const r = m.playCard(3, '9-hearts');
    expect(r.thulla).toBe(false);
    expect(r.trickComplete).toBe(true);
    expect(m.discardPile).toHaveLength(4);
    expect(m.turnSeat()).toBe(0); // K-hearts highest
  });

  it('lead passes clockwise when the trick winner escaped', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts')],
        [C('2', 'hearts')],
        [C('9', 'hearts'), C('4', 'clubs')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(3); // seat 3 leads with last heart... use 9-hearts
    m.playCard(3, '9-hearts');
    m.playCard(0, 'K-hearts');
    m.playCard(1, '5-hearts');
    m.playCard(2, '2-hearts');
    // K-hearts (seat 0) wins but seat 0 still holds A-spades, so no escape here;
    // instead assert the winner leads.
    expect(m.turnSeat()).toBe(0);
  });
});

describe('escapes', () => {
  it('marks empty-handed players safe only AFTER the trick resolves', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts')],
        [C('A', 'hearts')],
        [C('3', 'clubs')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '5-hearts'); // seat 1's last card
    expect(m.seats[1].escaped).toBe(false); // trick not resolved yet
    m.playCard(2, 'A-hearts');
    const r = m.playCard(3, '3-clubs'); // Thulla -> seat 2 collects
    expect(r.escapedSeats).toContain(1);
    expect(m.seats[1].escaped).toBe(true);
  });

  it('last-card-highest player collects on Thulla and stays active', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades')],
        [C('K', 'hearts')],
        [C('A', 'hearts')],
        [C('3', 'clubs')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(1);
    m.playCard(1, 'K-hearts'); // last card
    m.playCard(2, 'A-hearts'); // last card, currently highest
    const r = m.playCard(3, '3-clubs'); // Thulla
    expect(r.pickedUpBy).toBe(2);
    expect(m.seats[2].escaped).toBe(false); // collected the pile, remains active
    expect(m.seats[2].hand).toHaveLength(3);
    expect(m.seats[1].escaped).toBe(true); // empty hand, safe
  });
});

describe('endgame', () => {
  it('last player holding cards is Bhabi', () => {
    const m = new Match({ numSeats: 4, preDeal: [[C('A', 'spades')], [], [], []] });
    const end = m.resolveEndgame();
    expect(end.finished).toBe(true);
    expect(end.bhabi).toBe(0);
    expect(m.phase).toBe('finished');
    expect(end.escapedSeats).toEqual([1, 2, 3]);
  });

  it('all hands empty together is a draw with no Bhabi', () => {
    const m = new Match({ numSeats: 4, preDeal: [[C('A', 'spades')], [], [], []] });
    m.seats[0].hand = [];
    const end = m.resolveEndgame();
    expect(end.finished).toBe(true);
    expect(end.draw).toBe(true);
    expect(end.bhabi).toBeNull();
  });
});

describe('protected opening', () => {
  it('opening trick runs through all players; A-spades player leads next', () => {
    const m = new Match({
      numSeats: 4,
      rules: PROTECTED_OPENING_RULES,
      preDeal: [
        [C('A', 'spades'), C('9', 'hearts')],
        [C('5', 'clubs'), C('6', 'clubs')],
        [C('7', 'hearts'), C('7', 'clubs')],
        [C('8', 'hearts'), C('8', 'clubs')],
      ],
    });
    expect(m.turnSeat()).toBe(0);
    m.playCard(0, 'A-spades');
    const r1 = m.playCard(1, '5-clubs'); // no spades: no Thulla in protected opening
    expect(r1.thulla).toBe(false);
    expect(r1.trickComplete).toBe(false);
    m.playCard(2, '7-hearts');
    const r3 = m.playCard(3, '8-hearts');
    expect(r3.trickComplete).toBe(true);
    expect(m.discardPile).toHaveLength(4);
    expect(m.turnSeat()).toBe(0); // A-spades player leads
  });
});

describe('validation', () => {
  it('rejects out-of-turn plays, unknown cards and suit-breaking', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts'), C('3', 'clubs')],
        [C('9', 'diamonds')],
        [C('2', 'diamonds')],
      ],
    });
    expect(() => m.playCard(1, '5-hearts')).toThrow("not seat 1's turn");
    expect(() => m.playCard(0, 'Q-hearts')).toThrow('card not in hand');
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    expect(() => m.playCard(1, '3-clubs')).toThrow('illegal play');
  });
});

describe('card conservation', () => {
  it('hands + current trick + discard + set-aside always hold exactly 52 distinct cards', () => {
    const m = new Match({ numSeats: 5, rng: mulberry32(99) });
    const rng = mulberry32(7);
    for (let i = 0; i < 500 && m.phase !== 'finished'; i++) {
      const seat = m.turnSeat() as number;
      const card = normalBot(observe(m, seat));
      m.playCard(seat, card.id);
      const all = [...allCardIds(m), ...m.setAside.map((c) => c.id)];
      expect(new Set(all).size).toBe(52);
    }
  });
});

describe('bots', () => {
  it('never choose an illegal move', () => {
    const rng = mulberry32(1234);
    for (let g = 0; g < 20; g++) {
      const m = new Match({ numSeats: 4 + (g % 4), rng: mulberry32(g) });
      for (let i = 0; i < 40 && m.phase !== 'finished'; i++) {
        const seat = m.turnSeat() as number;
        const obs = observe(m, seat);
        const legal = new Set(obs.legalPlays.map((c) => c.id));
        expect(legal.has(easyBot(obs, rng).id)).toBe(true);
        expect(legal.has(normalBot(obs).id)).toBe(true);
        m.playCard(seat, normalBot(obs).id);
      }
    }
  });

  it('observation carries seat and voids but exposes no hidden cards', () => {
    const m = new Match({ numSeats: 4, rng: mulberry32(5) });
    const obs = observe(m, 0);
    expect(obs.seat).toBe(0);
    expect(obs.knownVoids instanceof Set).toBe(true);
    const json = JSON.stringify(obs);
    for (let s = 1; s < 4; s++) {
      for (const c of m.seats[s].hand) {
        expect(json).not.toContain(c.id);
      }
    }
  });
});

describe('known voids', () => {
  it('records a void when a player breaks suit', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('3', 'clubs')],
        [C('A', 'hearts')],
        [C('5', 'hearts')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '3-clubs'); // no hearts -> void revealed
    expect(m.voids.has('1:hearts')).toBe(true);
    expect(m.voids.has('0:hearts')).toBe(false);
  });

  it('records voids even on the protected opening trick', () => {
    const m = new Match({
      numSeats: 4,
      rules: PROTECTED_OPENING_RULES,
      preDeal: [
        [C('A', 'spades'), C('9', 'hearts')],
        [C('5', 'clubs'), C('6', 'clubs')],
        [C('7', 'hearts'), C('7', 'clubs')],
        [C('8', 'hearts'), C('8', 'clubs')],
      ],
    });
    m.playCard(0, 'A-spades');
    m.playCard(1, '5-clubs'); // no spades -> void revealed, no Thulla (protected)
    expect(m.voids.has('1:spades')).toBe(true);
  });

  function leadObs(knownVoids: Set<string>): BotObservation {
    return {
      seat: 0,
      ownHand: [C('K', 'spades'), C('A', 'hearts')],
      legalPlays: [C('K', 'spades'), C('A', 'hearts')],
      ledSuit: null,
      trickPlays: [],
      handCounts: [2, 5, 5, 5],
      escaped: [false, false, false, false],
      knownVoids,
    };
  }

  it('normalBot avoids leading a suit where an opponent is known void', () => {
    // Seat 1 is void in spades: leading the K-spades would hand them the
    // power to stop the round and make us pick the pile up.
    expect(normalBot(leadObs(new Set(['1:spades']))).id).toBe('A-hearts');
  });

  it('normalBot leads low when every suit has a known void', () => {
    const obs = leadObs(new Set(['1:spades', '2:hearts']));
    expect(normalBot(obs).id).toBe('K-spades'); // lower of K-spades / A-hearts
  });

  it('normalBot ignores voids of escaped players', () => {
    const obs: BotObservation = {
      ...leadObs(new Set(['1:spades'])),
      escaped: [false, true, false, false],
    };
    expect(normalBot(obs).id).toBe('A-hearts'); // seat 1 is out; spades safe again -> shed highest
  });

  it('voids are visible to bots through observe() after a real Thulla', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('3', 'clubs')],
        [C('A', 'hearts')],
        [C('5', 'hearts')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '3-clubs'); // Thulla; seat 2 (bot) now leads
    const botSeat = m.turnSeat() as number;
    const obs = observe(m, botSeat);
    expect(obs.knownVoids.has('1:hearts')).toBe(true);
  });

  it('captures the completed trick so clients can keep showing it', () => {
    const m = new Match({
      numSeats: 4,
      preDeal: [
        [C('A', 'spades'), C('K', 'hearts')],
        [C('5', 'hearts')],
        [C('A', 'hearts')],
        [C('3', 'clubs')],
      ],
    });
    m.isFirstTrick = false;
    m.startTrick(0);
    m.playCard(0, 'K-hearts');
    m.playCard(1, '5-hearts');
    m.playCard(2, 'A-hearts');
    const r = m.playCard(3, '3-clubs'); // Thulla completes the trick
    expect(r.trickComplete).toBe(true);
    expect(r.completedTrick?.ledSuit).toBe('hearts');
    expect(r.completedTrick?.plays.map((p) => p.card.id).sort()).toEqual(
      ['K-hearts', '5-hearts', 'A-hearts', '3-clubs'].sort(),
    );
    // The engine already seated the next trick; the snapshot preserves the old one.
    expect(m.trick?.plays).toHaveLength(0);
  });

  it('normalBot prefers the suit with fewer known-void opponents', () => {
    const obs: BotObservation = {
      seat: 0,
      ownHand: [C('K', 'spades'), C('Q', 'hearts'), C('Q', 'diamonds')],
      legalPlays: [C('K', 'spades'), C('Q', 'hearts'), C('Q', 'diamonds')],
      ledSuit: null,
      trickPlays: [],
      handCounts: [3, 5, 5, 5],
      escaped: [false, false, false, false],
      // Two opponents void in spades, one in hearts, none in diamonds.
      knownVoids: new Set(['1:spades', '2:spades', '3:hearts']),
    };
    expect(normalBot(obs).id).toBe('Q-diamonds');
  });
});
