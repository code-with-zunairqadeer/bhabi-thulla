/**
 * useOnlineTable — adapts the server's filtered GameView into the TableState
 * shape that TableScreen already renders. Seats are rotated so "me" is
 * always seat 0, which is exactly what the local table assumes — the
 * approved UI renders online games pixel-identically with zero changes.
 *
 * Also mirrors the local table's behavior: completed-trick display with a
 * pace-aware wipe, card snap on every play, the cheeky Thulla sting, a live
 * turn countdown, and illegal-play toasts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, Suit, TrickPlay } from '@bhabi-thulla/game-engine';
import type { GameView } from '@bhabi-thulla/protocol';
import { online, type OnlineSnapshot } from './online';
import { playCardSound, thullaSound } from './sound';
import { TURN_SECONDS, type MatchView, type TableState } from './useTable';

const POST_TRICK_MS: Record<string, number> = {
  relaxed: 2200,
  normal: 1600,
  fast: 900,
};

/** Never rendered — opponents' hands are counts only, but the view needs the length. */
const HIDDEN_CARD = { id: 'hidden', suit: 'spades', rank: 2 } as Card;

export function useOnlineTable(snap: OnlineSnapshot): TableState | null {
  const game = snap.game;
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [completedTrick, setCompletedTrick] = useState<{
    plays: TrickPlay[];
    ledSuit: Suit;
  } | null>(null);

  const prevGameRef = useRef<GameView | null>(null);
  const wipeTimer = useRef<number | null>(null);
  const errorTimer = useRef<number | null>(null);

  const mySeat = game?.mySeat ?? 0;
  const n = game?.numSeats ?? 4;
  const rel = useCallback((seat: number) => (seat - mySeat + n) % n, [mySeat, n]);

  const notify = useCallback((msg: string) => {
    setError(msg);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 2600);
  }, []);

  // Completed-trick display + wipe + sounds, driven by game:state diffs.
  useEffect(() => {
    if (!game) return;
    const prev = prevGameRef.current;
    const trick = game.trick;
    if (wipeTimer.current) {
      window.clearTimeout(wipeTimer.current);
      wipeTimer.current = null;
    }
    if (trick && trick.plays.length > 0) {
      setCompletedTrick(null);
      const prevCount = prev?.trick?.plays.length ?? 0;
      if (trick.plays.length > prevCount) playCardSound();
    } else if (prev?.trick && prev.trick.plays.length > 0 && prev.trick.ledSuit) {
      setCompletedTrick({
        plays: prev.trick.plays.map((p) => ({
          seat: rel(p.seat),
          card: p.card as Card,
        })),
        ledSuit: prev.trick.ledSuit,
      });
      wipeTimer.current = window.setTimeout(
        () => setCompletedTrick(null),
        POST_TRICK_MS[game.pace] ?? 2000,
      );
    }
    if (game.thullaFlash) window.setTimeout(() => thullaSound(), 180);
    prevGameRef.current = game;
  }, [game, rel]);

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
      if (wipeTimer.current) window.clearTimeout(wipeTimer.current);
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
      bhabi: null,
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
