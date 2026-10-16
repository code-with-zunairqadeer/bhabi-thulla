import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Match,
  PlayResult,
  Card,
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
/** Bot "thinking" delay so play is understandable. */
const BOT_DELAY_MS = 1100;

export interface TableState {
  match: Match;
  turn: number | null;
  legalIds: Set<string>;
  selectedId: string | null;
  secondsLeft: number;
  lastResult: PlayResult | null;
  thullaFlash: string | null;
  error: string | null;
  events: string[];
  selectCard: (id: string) => void;
  playSelected: () => void;
  playCard: (seat: number, cardId: string) => void;
}

function botNames(n: number): string[] {
  const pool = ['Ali', 'Ahmed', 'Bilal', 'Usman', 'Danish', 'Fahad', 'Imran', 'Kamran'];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [lastResult, setLastResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Index into match.events of a Thulla announcement to flash until next play. */
  const [thullaFlashIdx, setThullaFlashIdx] = useState<number | null>(null);
  const errorTimer = useRef<number | null>(null);

  const turn = match.turnSeat();

  const refresh = useCallback(() => {
    setSelectedId(null);
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
      } catch (e) {
        flashError(e instanceof Error ? e.message : 'Illegal move');
        return;
      }
      refresh();
    },
    [match, refresh, flashError],
  );

  const selectCard = useCallback(
    (id: string) => {
      if (turn !== 0 || match.phase === 'finished') return;
      setSelectedId((prev) => (prev === id ? null : id));
    },
    [turn, match],
  );

  const playSelected = useCallback(() => {
    if (selectedId && turn === 0) playCard(0, selectedId);
  }, [selectedId, turn, playCard]);

  // Bot turns run on a server-style scheduled delay.
  useEffect(() => {
    if (match.phase === 'finished' || turn === null) return;
    if (!match.seats[turn].isBot) return;
    const id = window.setTimeout(() => {
      const card: Card = chooseBotMove(observe(match, turn), config.difficulty);
      playCard(turn, card.id);
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [match, turn, moveCount, config.difficulty, playCard]);

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
    selectedId,
    secondsLeft,
    lastResult,
    thullaFlash: thullaFlashIdx !== null ? (match.events[thullaFlashIdx] ?? null) : null,
    error,
    events: match.events,
    selectCard,
    playSelected,
    playCard,
  };
}
