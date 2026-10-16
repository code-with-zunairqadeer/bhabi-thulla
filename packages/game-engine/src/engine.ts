/**
 * Authoritative match engine: deal, turn order, trick resolution, Thulla,
 * escapes and Bhabi determination. Pure logic, no I/O — the same code runs
 * on the server and (for UI prediction) in the browser.
 */
import {
  Card, Suit, createDeck, shuffle, isAceOfSpades, Rng,
} from './cards.js';
import {
  RulesConfig, CLASSIC_RULES, TrickPlay, legalPlays, trickWinnerSeat, isThullaPlay,
} from './rules.js';

export interface Seat {
  name: string;
  isBot: boolean;
  hand: Card[];
  escaped: boolean;
}

export interface TrickState {
  plays: TrickPlay[];
  ledSuit: Suit | null;
  leader: number;
  /** Seats taking part, frozen at trick start, clockwise from leader. */
  participants: number[];
  /** Index into participants of the seat to play next. */
  nextToPlay: number;
}

export type MatchPhase = 'awaiting_action' | 'finished';

export interface PlayResult {
  seat: number;
  card: Card;
  /** True when the play broke suit and ended the trick immediately. */
  thulla: boolean;
  trickComplete: boolean;
  /** Seat that picked up the pile on a Thulla, else null. */
  pickedUpBy: number | null;
  /** Seats that escaped as a result of this trick. */
  escapedSeats: number[];
  finished: boolean;
  /** Seat index of the Bhabi, when finished with one player holding cards. */
  bhabi: number | null;
  draw: boolean;
}

export interface MatchOptions {
  numSeats: number; // 4..7
  dealer?: number;
  names?: string[];
  bots?: boolean[];
  rules?: RulesConfig;
  rng?: Rng;
  /** Test hook: exact hands per seat (must include the A-spades somewhere). */
  preDeal?: Card[][];
}

export class Match {
  readonly numSeats: number;
  readonly rules: RulesConfig;
  readonly seats: Seat[];
  readonly dealer: number;
  trick: TrickState | null = null;
  discardPile: Card[] = [];
  phase: MatchPhase = 'awaiting_action';
  bhabi: number | null = null;
  draw = false;
  isFirstTrick = true;
  tricksPlayed = 0;
  /** Tricks since the last escape; diagnostics for no-progress cycles. */
  tricksWithoutProgress = 0;
  /** Human-readable public action feed. */
  events: string[] = [];

  constructor(opts: MatchOptions) {
    const { numSeats } = opts;
    if (numSeats < 4 || numSeats > 7) throw new Error('numSeats must be 4-7');
    this.numSeats = numSeats;
    this.rules = opts.rules ?? CLASSIC_RULES;
    this.dealer = opts.dealer ?? 0;
    this.seats = Array.from({ length: numSeats }, (_, i) => ({
      name: opts.names?.[i] ?? `Player ${i + 1}`,
      isBot: opts.bots?.[i] ?? false,
      hand: [],
      escaped: false,
    }));

    if (opts.preDeal) {
      if (opts.preDeal.length !== numSeats) throw new Error('preDeal must cover every seat');
      opts.preDeal.forEach((hand, i) => { this.seats[i].hand = [...hand]; });
    } else {
      this.deal(shuffle(createDeck(), opts.rng));
    }

    const opener = this.seats.findIndex((s) => s.hand.some(isAceOfSpades));
    if (opener === -1) throw new Error('invariant violated: A-spades was not dealt');
    this.startTrick(opener);
  }

  /** Deal one card at a time, starting with the seat after the dealer. */
  private deal(deck: Card[]): void {
    let i = 0;
    for (const card of deck) {
      this.seats[(this.dealer + 1 + i) % this.numSeats].hand.push(card);
      i++;
    }
  }

  /** Seats still in the game (non-escaped). */
  activeSeats(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.numSeats; i++) if (!this.seats[i].escaped) out.push(i);
    return out;
  }

  /**
   * Begin a trick led by `leader`. Public so tests and the server can
   * re-seat after lobby changes; normal flow calls it internally.
   */
  startTrick(leader: number): void {
    if (this.seats[leader].escaped) throw new Error('escaped seat cannot lead');
    const participants: number[] = [];
    let s = leader;
    for (let k = 0; k < this.numSeats; k++) {
      if (!this.seats[s].escaped) participants.push(s);
      s = (s + 1) % this.numSeats;
    }
    this.trick = { plays: [], ledSuit: null, leader, participants, nextToPlay: 0 };
  }

  /** Seat whose turn it is now, or null when finished. */
  turnSeat(): number | null {
    if (this.phase === 'finished' || !this.trick) return null;
    return this.trick.participants[this.trick.nextToPlay] ?? null;
  }

  /** Legal plays for a seat in the current trick. */
  legalPlays(seat: number): Card[] {
    const t = this.trick;
    if (!t) throw new Error('no active trick');
    const mustOpen = this.isFirstTrick && t.plays.length === 0;
    return legalPlays(this.seats[seat].hand, t.ledSuit, mustOpen);
  }

  /**
   * Play a card. Validates turn, ownership and legality, then resolves
   * the trick when it completes (immediately on a Thulla).
   */
  playCard(seat: number, cardId: string): PlayResult {
    if (this.phase === 'finished') throw new Error('match is finished');
    const t = this.trick;
    if (!t) throw new Error('no active trick');
    const expected = t.participants[t.nextToPlay];
    if (seat !== expected) throw new Error(`not seat ${seat}'s turn (expected ${expected})`);

    const hand = this.seats[seat].hand;
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error('card not in hand');
    if (!this.legalPlays(seat).some((c) => c.id === cardId)) {
      throw new Error('illegal play: must follow suit');
    }

    const [card] = hand.splice(idx, 1);
    const isLead = t.plays.length === 0;
    if (isLead) t.ledSuit = card.suit;
    t.plays.push({ seat, card });
    t.nextToPlay += 1;

    const protectedOpening = this.isFirstTrick && this.rules.opening === 'protected';
    const thulla = !protectedOpening && isThullaPlay(card, t.ledSuit as Suit, isLead);

    const result: PlayResult = {
      seat, card, thulla,
      trickComplete: false, pickedUpBy: null, escapedSeats: [],
      finished: false, bhabi: null, draw: false,
    };

    if (thulla) {
      this.resolveThulla(result);
    } else if (t.nextToPlay >= t.participants.length) {
      this.resolveNormalTrick(result);
    }
    return result;
  }

  /** Off-suit play: trick ends at once; highest led-suit card picks up the pile. */
  private resolveThulla(result: PlayResult): void {
    const t = this.trick as TrickState;
    const recipient = trickWinnerSeat(t.plays, t.ledSuit as Suit);
    const pile = t.plays.map((p) => p.card);
    this.seats[recipient].hand.push(...pile);
    result.pickedUpBy = recipient;
    result.trickComplete = true;
    const who = this.seats[result.seat].name;
    const got = this.seats[recipient].name;
    this.events.push(
      `${who} has no ${t.ledSuit}. Thulla! ${got} picks up ${pile.length} cards.`,
    );
    this.finishTrick(recipient, result);
  }

  /** Everyone followed: discard the trick; highest led-suit card leads next. */
  private resolveNormalTrick(result: PlayResult): void {
    const t = this.trick as TrickState;
    const pile = t.plays.map((p) => p.card);
    this.discardPile.push(...pile);
    result.trickComplete = true;

    // Protected opening: the whole opening trick is discarded and the
    // A-spades player leads next (unless they escaped).
    const nextLeader = (this.isFirstTrick && this.rules.opening === 'protected')
      ? t.leader
      : trickWinnerSeat(t.plays, t.ledSuit as Suit);
    this.events.push(`${this.seats[nextLeader].name} leads next.`);
    this.finishTrick(nextLeader, result);
  }

  /**
   * Common trick teardown: mark escapes (only AFTER resolution), check for
   * Bhabi/draw, and seat the next trick. Exported for tests.
   */
  resolveEndgame(): { finished: boolean; bhabi: number | null; draw: boolean; escapedSeats: number[] } {
    const escapedSeats: number[] = [];
    for (let i = 0; i < this.numSeats; i++) {
      if (!this.seats[i].escaped && this.seats[i].hand.length === 0) {
        this.seats[i].escaped = true;
        escapedSeats.push(i);
        this.events.push(`${this.seats[i].name} escapes!`);
      }
    }
    const active = this.activeSeats();
    let finished = false;
    let bhabi: number | null = null;
    let draw = false;
    if (active.length === 1) {
      finished = true;
      bhabi = active[0];
      this.phase = 'finished';
      this.bhabi = bhabi;
      this.events.push(`${this.seats[bhabi].name} is BHABI!`);
    } else if (active.length === 0) {
      finished = true;
      draw = true;
      this.phase = 'finished';
      this.draw = true;
      this.events.push('Draw — no Bhabi.');
    } else if (escapedSeats.length === 0) {
      this.tricksWithoutProgress += 1;
    } else {
      this.tricksWithoutProgress = 0;
    }
    return { finished, bhabi, draw, escapedSeats };
  }

  private finishTrick(nextLeader: number, result: PlayResult): void {
    this.tricksPlayed += 1;
    const end = this.resolveEndgame();
    result.escapedSeats = end.escapedSeats;
    result.finished = end.finished;
    result.bhabi = end.bhabi;
    result.draw = end.draw;
    this.isFirstTrick = false;
    if (!end.finished) {
      const leader = this.seats[nextLeader].escaped
        ? this.nextActiveClockwise(nextLeader)
        : nextLeader;
      this.startTrick(leader);
    } else {
      this.trick = null;
    }
  }

  private nextActiveClockwise(from: number): number {
    let s = (from + 1) % this.numSeats;
    let guard = 0;
    while (this.seats[s].escaped && guard < this.numSeats) {
      s = (s + 1) % this.numSeats;
      guard++;
    }
    return s;
  }

  /** Next dealer, rotating clockwise. */
  nextDealer(): number {
    return (this.dealer + 1) % this.numSeats;
  }
}
