/**
 * useOnlineTable — adapts the server's filtered GameView into the TableState
 * shape that TableScreen already renders. Seats are rotated so "me" is
 * always seat 0, which is exactly what the local table assumes — the
 * approved UI renders online games pixel-identically with zero changes.
 *
 * The server is the source of truth for the completed trick (it holds the
 * finished 4-card trick through the post-trick pause, then wipes it when
 * the next turn begins). This hook also mirrors the local table's sounds,
 * live turn countdown, and illegal-play toasts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@bhabi-thulla/game-engine';
import type { GameView } from '@bhabi-thulla/protocol';
import { online, type OnlineSnapshot } from './online';
import { playCardSound, thullaSound } from './sound';
import { TURN_SECONDS, type MatchView, type TableState } from './useTable';

/** Never rendered — opponents' hands are counts only, but the view needs the length. */
const HIDDEN_CARD = { id: 'hidden', suit: 'spades', rank: 2 } as Card;

export function useOnlineTable(snap: OnlineSnapshot): TableState | null {
  const game = snap.game;
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);

  const prevGameRef = useRef<GameView | null>(null);
  const errorTimer = useRef<number | null>(null);

  const mySeat = game?.mySeat ?? 0;
  const n = game?.numSeats ?? 4;
  const rel = useCallback((seat: number) => (seat - mySeat + n) % n, [mySeat, n]);

  const notify = useCallback((msg: string) => {
    setError(msg);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 2600);
  }, []);

  // Card snap on every new play (including the trick-completing 4th card,
  // which arrives via completedTrick while the live trick resets to empty)
  // + the Thulla sting, driven by state diffs.
  useEffect(() => {
    if (!game) return;
    const prev = prevGameRef.current;
    const count = game.trick?.plays.length ?? 0;
    const prevCount = prev?.trick?.plays.length ?? 0;
    const doneCount = game.completedTrick?.plays.length ?? 0;
    const prevDoneCount = prev?.completedTrick?.plays.length ?? 0;
    if (count > prevCount || doneCount > prevDoneCount) playCardSound();
    if (game.thullaFlash) window.setTimeout(() => thullaSound(), 180);
    prevGameRef.current = game;
  }, [game]);

  // Turn countdown follows the server; resets when it's not our turn.
  useEffect(() => {
    setSecondsLeft(game?.secondsLeft ?? TURN_SECONDS);
  }, [game?.secondsLeft]);
  useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Clear timers on unmount.
  useEffect(() => {
    return () => {
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, []);

  const playCard = useCallback(
    (seat: number, cardId: string) => {
      void seat;
      void online.playCard(cardId).then((err) => {
        if (err) notify(err);
      });
    },
    [notify],
  );

  const match = useMemo<MatchView | null>(() => {
    if (!game) return null;
    const ordered = [...game.seats].sort((a, b) => rel(a.seat) - rel(b.seat));
    return {
      numSeats: game.numSeats,
      phase: game.phase,
      isFirstTrick: game.isFirstTrick,
      bhabi: game.bhabi !== null ? rel(game.bhabi) : null,
      seats: ordered.map((s) => ({
        name: s.name,
        hand:
          s.seat === game.mySeat
            ? (game.hand as Card[])
            : Array.from({ length: s.cardCount }, () => HIDDEN_CARD),
        escaped: s.escaped,
        isBot: s.isBot,
      })),
      trick: game.trick
        ? {
            plays: game.trick.plays.map((p) => ({
              seat: rel(p.seat),
              card: p.card as Card,
            })),
            ledSuit: game.trick.ledSuit,
            leader: rel(game.trick.leader),
          }
        : null,
      events: game.events,
    };
  }, [game, rel]);

  // The server holds the finished trick through the post-trick pause and
  // clears it when the next turn begins — rotate its seats like the live trick.
  const completedTrick = useMemo(() => {
    const ct = game?.completedTrick;
    if (!ct) return null;
    return {
      plays: ct.plays.map((p) => ({ seat: rel(p.seat), card: p.card as Card })),
      ledSuit: ct.ledSuit,
    };
  }, [game, rel]);

  const table = useMemo<TableState | null>(() => {
    if (!game || !match) return null;
    return {
      match,
      turn: game.turn !== null ? rel(game.turn) : null,
      legalIds: new Set(game.legalCardIds),
      secondsLeft,
      paused: false,
      lastResult: null,
      thullaFlash: game.thullaFlash ? 'online' : null,
      completedTrick,
      error,
      events: game.events,
      playCard,
      notify,
      togglePause: () => {},
    };
  }, [game, match, rel, secondsLeft, completedTrick, error, playCard, notify]);

  return table;
}
