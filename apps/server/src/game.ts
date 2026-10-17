/**
 * GameController — the authoritative match for one room. It owns the
 * engine Match, drives bot seats on the room's pace, enforces the human
 * turn timer (auto-play on timeout so a table never stalls), and broadcasts
 * per-player filtered views after every change.
 *
 * Plays are idempotent: each carries a client-generated actionId, and a
 * retried tap simply re-sends the current state instead of double-playing.
 */
import { randomUUID } from 'node:crypto';
import {
  Match,
  PROTECTED_OPENING_RULES,
  chooseBotMove,
  observe,
} from '@bhabi-thulla/game-engine';
import type { Pace } from '@bhabi-thulla/protocol';
import { saveMatchResult } from './db.js';
import type { Room, RoomManager } from './rooms.js';

export interface PaceTimings {
  botMs: number;
  postTrickMs: number;
  turnTimeoutMs: number;
}

export const PACE_TIMINGS: Record<Pace, PaceTimings> = {
  relaxed: { botMs: 2600, postTrickMs: 2200, turnTimeoutMs: 30000 },
  normal: { botMs: 1700, postTrickMs: 1600, turnTimeoutMs: 30000 },
  fast: { botMs: 900, postTrickMs: 900, turnTimeoutMs: 20000 },
};

export interface GameHooks {
  /** Send fresh game:state to every connected player. */
  broadcast: () => void;
  /** Send game:over to every connected player. */
  sendGameOver: () => void;
}

export class GameController {
  readonly match: Match;
  readonly matchId = randomUUID();
  /** Epoch ms when the current human turn expires, null otherwise. */
  turnDeadline: number | null = null;
  private processedActions = new Set<string>();
  private timers: NodeJS.Timeout[] = [];
  private thullaFlash = false;
  private destroyed = false;
  private over = false;

  constructor(
    readonly room: Room,
    private readonly rooms: RoomManager,
    private readonly hooks: GameHooks,
  ) {
    const humans = rooms.humansInJoinOrder(room);
    const names = Array.from(
      { length: room.settings.seats },
      (_, i) => rooms.seatName(room, i),
    );
    const bots = Array.from(
      { length: room.settings.seats },
      (_, i) => i >= humans.length,
    );
    this.match = new Match({
      numSeats: room.settings.seats,
      names,
      bots,
      rules: PROTECTED_OPENING_RULES,
    });
    humans.forEach((p, i) => {
      p.seat = i;
    });
  }

  get pace(): Pace {
    return this.room.settings.pace;
  }

  /** True for exactly one broadcast after a Thulla lands. */
  consumeThullaFlash(): boolean {
    const f = this.thullaFlash;
    this.thullaFlash = false;
    return f;
  }

  peekThullaFlash(): boolean {
    return this.thullaFlash;
  }

  clearThullaFlash(): void {
    this.thullaFlash = false;
  }

  get isOver(): boolean {
    return this.over;
  }

  start(): void {
    this.scheduleNext();
  }

  /**
   * Apply a human's play. Returns ok:false with a message when the play is
   * illegal — the engine is the single source of truth here.
   */
  playCard(seat: number, cardId: string, actionId: string): { ok: boolean; error?: string } {
    if (this.destroyed || this.over) return { ok: false, error: 'The match is over.' };
    if (this.processedActions.has(actionId)) return { ok: true }; // retry — state re-sent by caller
    try {
      const result = this.match.playCard(seat, cardId);
      this.processedActions.add(actionId);
      this.thullaFlash = result.thulla;
      this.clearTimers();
      if (result.finished) {
        this.over = true;
        this.room.status = 'finished';
        void this.persist();
        this.hooks.sendGameOver();
        this.hooks.broadcast();
        return { ok: true };
      }
      const postMs = result.trickComplete ? PACE_TIMINGS[this.pace].postTrickMs : 0;
      this.later(() => this.scheduleNext(), postMs);
      this.hooks.broadcast();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Illegal play.' };
    }
  }

  /** Drive the next turn: bots act on pace, humans get a countdown. */
  private scheduleNext(): void {
    this.clearTimers();
    if (this.destroyed || this.over || this.match.phase === 'finished') return;
    const seat = this.match.turnSeat();
    if (seat === null) return;
    const player = this.rooms.seatPlayer(this.room, seat);
    const humanTurn = player !== null && player.connected && !this.match.seats[seat].escaped;
    if (!humanTurn) {
      // Bot seat — or a disconnected human, covered by a bot so the table
      // never stalls waiting on a dead phone.
      this.later(() => {
        try {
          const card = chooseBotMove(observe(this.match, seat), 'normal');
          this.playCard(seat, card.id, randomUUID());
        } catch {
          this.scheduleNext();
        }
      }, PACE_TIMINGS[this.pace].botMs);
      return;
    }
    const timeoutMs = PACE_TIMINGS[this.pace].turnTimeoutMs;
    this.turnDeadline = Date.now() + timeoutMs;
    this.later(() => {
      // Turn timer expired — play a sensible card for them.
      try {
        const card = chooseBotMove(observe(this.match, seat), 'normal');
        this.playCard(seat, card.id, randomUUID());
      } catch {
        this.scheduleNext();
      }
    }, timeoutMs);
    // Keep every client's countdown honest while they think.
    const tick = setInterval(() => {
      if (this.destroyed || this.over) clearInterval(tick);
      else this.hooks.broadcast();
    }, 5000);
    this.timers.push(tick);
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      if (!this.destroyed) fn();
    }, ms);
    this.timers.push(t);
  }

  private clearTimers(): void {
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.timers = [];
    this.turnDeadline = null;
  }

  private async persist(): Promise<void> {
    const m = this.match;
    const escapeOrder: string[] = [];
    for (const e of m.events) {
      const mm = e.match(/^(.+) escapes!$/);
      if (mm) escapeOrder.push(mm[1]);
    }
    await saveMatchResult({
      id: this.matchId,
      roomCode: this.room.code,
      seats: m.numSeats,
      pace: this.pace,
      botFill: this.room.settings.botFill,
      rulesVersion: m.rules.version,
      bhabiSeat: m.bhabi,
      draw: m.draw,
      setAside: m.setAside.map((c) => ({ id: c.id, suit: c.suit, rank: c.rank })),
      players: m.seats.map((s, seat) => {
        const p = this.rooms.seatPlayer(this.room, seat);
        return {
          seat,
          guestId: p?.guestId ?? null,
          name: s.name,
          isBot: s.isBot,
          escaped: s.escaped,
        };
      }),
      events: [...m.events],
    });
    void escapeOrder;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
  }
}
