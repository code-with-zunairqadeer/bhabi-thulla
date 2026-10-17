import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Match,
  PlayResult,
  Card,
  Suit,
  TrickPlay,
  MatchPhase,
  BotDifficulty,
  observe,
  chooseBotMove,
} from '@bhabi-thulla/game-engine';
import { playCardSound, thullaSound } from './sound';

/** Game speeds: how long bots wait before playing and how long a finished
 *  trick stays on screen. Relaxed is the default so new players can follow. */
export type GameSpeed = 'relaxed' | 'normal' | 'fast';
export interface Pace {
  botDelayMs: number;
  postTrickMs: number;
}
export const SPEEDS: Record<GameSpeed, Pace & { label: string }> = {
  relaxed: { label: 'Relaxed', botDelayMs: 2600, postTrickMs: 2200 },
  normal: { label: 'Normal', botDelayMs: 1700, postTrickMs: 1400 },
  fast: { label: 'Fast', botDelayMs: 900, postTrickMs: 800 },
};

export interface TableConfig {
  nickname: string;
  numSeats: number;
  difficulty: BotDifficulty;
  pace: Pace;
}

/** Practice-table turn timer (seconds). Matches the brief's default. */
export const TURN_SECONDS = 30;

/**
 * Structural view of a match — everything TableScreen reads. The local
 * engine Match satisfies this, and the online adapter builds one from the
 * server's filtered GameView (seats rotated so "me" is always seat 0).
 */
export interface MatchViewSeat {
  name: string;
  hand: Card[];
  escaped: boolean;
  isBot: boolean;
}
export interface MatchView {
  numSeats: number;
  phase: MatchPhase;
  isFirstTrick: boolean;
  bhabi: number | null;
  seats: MatchViewSeat[];
  trick: {
    plays: TrickPlay[];
    ledSuit: Suit | null;
    leader: number;
  } | null;
  events: string[];
}

export interface TableState {
  match: MatchView;
  turn: number | null;
  legalIds: Set<string>;
  secondsLeft: number;
  paused: boolean;
  lastResult: PlayResult | null;
  thullaFlash: string | null;
  /** The just-completed trick, shown until the next card is played. */
  completedTrick: { plays: TrickPlay[]; ledSuit: Suit } | null;
  error: string | null;
  events: string[];
  playCard: (seat: number, cardId: string) => void;
  notify: (msg: string) => void;
  togglePause: () => void;
}

const BOT_NAMES = ['Alpha Bot', 'Beta Bot', 'Gamma Bot', 'Delta Bot', 'Echo Bot', 'Foxx Bot'];

function botNames(n: number): string[] {
  return Array.from({ length: n }, (_, i) => BOT_NAMES[i % BOT_NAMES.length]);
}

export function useTable(config: TableConfig): TableState {
  const [match] = useState(
    () =>
      new Match({
        numSeats: config.numSeats,
        names: [config.nickname, ...botNames(config.numSeats - 1)],
        bots: [false, ...Array(config.numSeats - 1).fill(true)],
      }),
  );
  const [, setVersion] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [paused, setPaused] = useState(false);
  const [lastResult, setLastResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedTrick, setCompletedTrick] = useState<{ plays: TrickPlay[]; ledSuit: Suit } | null>(null);
  /** Index into match.events of a Thulla announcement to flash until next play. */
  const [thullaFlashIdx, setThullaFlashIdx] = useState<number | null>(null);
  /** When the current turn started (for pacing bot moves). */
  const turnStartedAt = useRef<number>(Date.now());
  /** Bots wait until this timestamp after a trick completes. */
  const pauseUntil = useRef<number>(0);
  /** True while the game is paused: bots and the turn timer freeze. */
  const pausedRef = useRef(false);
  /** Guards against retry-spam if the engine ever rejects a bot move. */
  const attemptedMove = useRef<string | null>(null);
  const errorTimer = useRef<number | null>(null);
  /** Clears the finished trick off the table once its result has been seen. */
  const wipeTimer = useRef<number | null>(null);

  const turn = match.turnSeat();

  const refresh = useCallback(() => {
    setSecondsLeft(TURN_SECONDS);
    setVersion((v) => v + 1);
    setMoveCount((c) => c + 1);
  }, []);

  const flashError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 2500);
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const playCard = useCallback(
    (seat: number, cardId: string) => {
      setThullaFlashIdx(null);
      if (wipeTimer.current) {
        window.clearTimeout(wipeTimer.current);
        wipeTimer.current = null;
      }
      try {
        const r = match.playCard(seat, cardId);
        setLastResult(r);
        playCardSound(); // every card hitting the felt snaps — human and bots
        if (r.thulla) {
          setThullaFlashIdx(match.events.length - 1);
          // Let the snap land first, then the cheeky womp.
          window.setTimeout(() => thullaSound(), 180);
        }
        // Keep the finished trick on screen until the next card is played.
        setCompletedTrick(r.trickComplete ? r.completedTrick : null);
        if (r.trickComplete) {
          // Let the trick result breathe, then wipe the table clean — the
          // next lead starts on an empty table.
          pauseUntil.current = Date.now() + config.pace.postTrickMs;
          wipeTimer.current = window.setTimeout(() => {
            setCompletedTrick(null);
            wipeTimer.current = null;
          }, config.pace.postTrickMs);
        }
      } catch (e) {
        flashError(e instanceof Error ? e.message : 'Illegal move');
        return;
      }
      refresh();
    },
    [match, refresh, flashError, config.pace],
  );

  // Clear pending timers on unmount.
  useEffect(() => {
    return () => {
      if (wipeTimer.current) window.clearTimeout(wipeTimer.current);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, []);

  // Restart the turn clock whenever the turn advances.
  useEffect(() => {
    turnStartedAt.current = Date.now();
  }, [turn, moveCount]);

  // Bot driver: a watchdog interval instead of one-shot timeouts, so a bot
  // can never get stuck. Every tick it asks: is it a bot's turn, and has the
  // pacing delay elapsed? The engine state is read live, so missed or failed
  // turns are impossible by construction. Frozen while paused.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (match.phase === 'finished' || pausedRef.current) return;
      const t = match.turnSeat();
      if (t === null || !match.seats[t].isBot) return;
      const wait = Math.max(config.pace.botDelayMs, pauseUntil.current - Date.now());
      if (Date.now() - turnStartedAt.current < wait) return;
      const key = `${t}:${moveCount}`;
      if (attemptedMove.current === key) return;
      attemptedMove.current = key;
      try {
        const card: Card = chooseBotMove(observe(match, t), config.difficulty);
        playCard(t, card.id);
      } catch (e) {
        flashError(e instanceof Error ? e.message : 'Bot failed to play');
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [match, config.difficulty, config.pace, playCard, moveCount, flashError]);

  // Human turn timer; timeout auto-plays a sensible move. Frozen while paused.
  useEffect(() => {
    if (paused || match.phase === 'finished' || turn === null) return;
    if (match.seats[turn].isBot) return;
    if (secondsLeft <= 0) {
      const card: Card = chooseBotMove(observe(match, turn), 'normal');
      playCard(turn, card.id);
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [match, turn, secondsLeft, playCard, paused]);

  const legalIds = new Set(
    turn === 0 && match.phase !== 'finished' ? match.legalPlays(0).map((c) => c.id) : [],
  );

  return {
    match,
    turn,
    legalIds,
    secondsLeft,
    paused,
    lastResult,
    thullaFlash: thullaFlashIdx !== null ? (match.events[thullaFlashIdx] ?? null) : null,
    completedTrick,
    error,
    events: match.events,
    playCard,
    notify: flashError,
    togglePause,
  };
}
