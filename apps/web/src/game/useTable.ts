import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Match,
  PlayResult,
  Card,
  Suit,
  TrickPlay,
  BotDifficulty,
  observe,
  chooseBotMove,
} from '@bhabi-thulla/game-engine';

export interface TableConfig {
  nickname: string;
  numSeats: number;
  difficulty: BotDifficulty;
}

/** Practice-table turn timer (seconds). Matches the brief's default. */
export const TURN_SECONDS = 30;
/** Delay before a bot plays, so humans can follow the action. */
const BOT_DELAY_MS = 1700;
/** Extra beat after a trick completes, so the result stays visible. */
const POST_TRICK_PAUSE_MS = 1600;

export interface TableState {
  match: Match;
  turn: number | null;
  legalIds: Set<string>;
  secondsLeft: number;
  lastResult: PlayResult | null;
  thullaFlash: string | null;
  /** The just-completed trick, shown until the next card is played. */
  completedTrick: { plays: TrickPlay[]; ledSuit: Suit } | null;
  error: string | null;
  events: string[];
  playCard: (seat: number, cardId: string) => void;
  notify: (msg: string) => void;
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
  const [lastResult, setLastResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedTrick, setCompletedTrick] = useState<{ plays: TrickPlay[]; ledSuit: Suit } | null>(null);
  /** Index into match.events of a Thulla announcement to flash until next play. */
  const [thullaFlashIdx, setThullaFlashIdx] = useState<number | null>(null);
  /** When the current turn started (for pacing bot moves). */
  const turnStartedAt = useRef<number>(Date.now());
  /** Bots wait until this timestamp after a trick completes. */
  const pauseUntil = useRef<number>(0);
  /** Guards against retry-spam if the engine ever rejects a bot move. */
  const attemptedMove = useRef<string | null>(null);
  const errorTimer = useRef<number | null>(null);

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

  const playCard = useCallback(
    (seat: number, cardId: string) => {
      setThullaFlashIdx(null);
      try {
        const r = match.playCard(seat, cardId);
        setLastResult(r);
        if (r.thulla) setThullaFlashIdx(match.events.length - 1);
        // Keep the finished trick on screen until the next card is played.
        setCompletedTrick(r.trickComplete ? r.completedTrick : null);
        // Let the trick result breathe before the next trick's lead.
        if (r.trickComplete) pauseUntil.current = Date.now() + POST_TRICK_PAUSE_MS;
      } catch (e) {
        flashError(e instanceof Error ? e.message : 'Illegal move');
        return;
      }
      refresh();
    },
    [match, refresh, flashError],
  );

  // Restart the turn clock whenever the turn advances.
  useEffect(() => {
    turnStartedAt.current = Date.now();
  }, [turn, moveCount]);

  // Bot driver: a watchdog interval instead of one-shot timeouts, so a bot
  // can never get stuck. Every tick it asks: is it a bot's turn, and has the
  // pacing delay elapsed? The engine state is read live, so missed or failed
  // turns are impossible by construction.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (match.phase === 'finished') return;
      const t = match.turnSeat();
      if (t === null || !match.seats[t].isBot) return;
      const wait = Math.max(BOT_DELAY_MS, pauseUntil.current - Date.now());
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
  }, [match, config.difficulty, playCard, moveCount, flashError]);

  // Human turn timer; timeout auto-plays a sensible move.
  useEffect(() => {
    if (match.phase === 'finished' || turn === null) return;
    if (match.seats[turn].isBot) return;
    if (secondsLeft <= 0) {
      const card: Card = chooseBotMove(observe(match, turn), 'normal');
      playCard(turn, card.id);
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [match, turn, secondsLeft, playCard]);

  const legalIds = new Set(
    turn === 0 && match.phase !== 'finished' ? match.legalPlays(0).map((c) => c.id) : [],
  );

  return {
    match,
    turn,
    legalIds,
    secondsLeft,
    lastResult,
    thullaFlash: thullaFlashIdx !== null ? (match.events[thullaFlashIdx] ?? null) : null,
    completedTrick,
    error,
    events: match.events,
    playCard,
    notify: flashError,
  };
}
