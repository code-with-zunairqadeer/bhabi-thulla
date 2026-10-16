import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Pause,
  Play,
  RotateCcw,
  BookOpen,
  Turtle,
  Rabbit,
  Zap,
  Layers,
  LogOut,
  ChevronLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { rankValue } from '@bhabi-thulla/game-engine';
import { TableState, TURN_SECONDS, GameSpeed, SPEEDS } from '../game/useTable';
import {
  clickSound,
  turnSound,
  isMuted,
  setMuted,
} from '../game/sound';
import { CardView } from './CardView';

interface Props {
  table: TableState;
  nickname: string;
  speed: GameSpeed;
  onSpeedChange: (s: GameSpeed) => void;
  onLeave: () => void;
  onRematch: () => void;
}

const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

const SUIT_GLYPH: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

/**
 * Seat positions on the ELLIPSE table, as fractions of the table box.
 * Seat 0 (you) sits at the bottom; seats advance ANTICLOCKWISE as seen from
 * above — the way a real Bhabi Thulla table flows.
 */
function seatPos(seat: number, numSeats: number): { x: number; y: number } {
  const angle = ((90 - (seat * 360) / numSeats) * Math.PI) / 180;
  return { x: 50 + 47 * Math.cos(angle), y: 50 + 46 * Math.sin(angle) };
}

/** Offset of a played card from the table centre, towards its player's seat. */
function trickOffset(seat: number, numSeats: number): { x: number; y: number } {
  const angle = ((90 - (seat * 360) / numSeats) * Math.PI) / 180;
  return { x: 16 * Math.cos(angle), y: 20 * Math.sin(angle) };
}

function SeatPod({
  x,
  y,
  name,
  cards,
  active,
  escaped,
}: {
  x: number;
  y: number;
  name: string;
  cards: number;
  active: boolean;
  escaped: boolean;
}) {
  return (
    <div
      className="absolute z-10"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
      title={`${name} · ${cards} cards${escaped ? ' · escaped' : ''}`}
    >
      <div
        className={`flex flex-col items-center transition-transform duration-200 ${
          active ? 'scale-[1.15]' : 'hover:scale-105'
        } ${escaped ? 'opacity-45 grayscale' : ''}`}
      >
        <div
          className={`relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full font-black text-sm sm:text-base transition-all ${
            active
              ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-emerald-950 ring-2 ring-amber-100 shadow-[0_0_30px_rgba(252,211,77,0.75)]'
              : 'bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-100 ring-1 ring-amber-200/30 shadow-[0_4px_10px_rgba(0,0,0,0.5)]'
          }`}
          aria-label={`${name}${active ? ', current turn' : ''}${escaped ? ', escaped' : ''}`}
        >
          {active && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400 border-2 border-emerald-950" />
            </span>
          )}
          {name.charAt(0).toUpperCase()}
          {/* Card-count badge for small screens (name chip is hidden there) */}
          <span
            className="sm:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 border border-white/15 px-1.5 py-px text-[9px] font-bold text-amber-100/90 whitespace-nowrap"
            aria-hidden
          >
            {escaped ? '✓' : cards}
          </span>
        </div>
        <div className="mt-1 hidden sm:block rounded-full bg-black/60 border border-white/10 backdrop-blur px-2 py-0.5 text-center leading-tight">
          <p
            className={`max-w-20 truncate text-[10px] font-bold ${
              active ? 'text-amber-200' : 'text-amber-50/90'
            }`}
          >
            {name}
          </p>
          <p className="text-emerald-100/60 text-[9px]">
            {escaped ? <span className="text-teal-300 font-semibold">escaped ✓</span> : `${cards} cards`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  title,
  label,
  onClick,
  compact,
  children,
}: {
  title: string;
  label?: string;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => {
        clickSound();
        onClick();
      }}
      className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-emerald-100/85 transition hover:border-amber-200/40 hover:bg-white/10 hover:text-amber-100 active:scale-95 ${
        compact ? 'p-2.5 justify-center' : 'px-2.5 py-1.5'
      }`}
    >
      {children}
      {label && !compact && <span className="hidden md:inline">{label}</span>}
    </button>
  );
}

const SPEED_ICONS: Record<GameSpeed, React.ReactNode> = {
  relaxed: <Turtle size={14} />,
  normal: <Rabbit size={14} />,
  fast: <Zap size={14} />,
};

const RULES = [
  ['Goal', 'Get rid of every card. The last player still holding cards is the Bhabi — and loses.'],
  ['Opening', 'Whoever holds the A♠ starts and must play it first.'],
  ['Follow suit', 'The leader plays any card. Everyone else must play the led suit if they have one.'],
  ['Thulla', "Can't follow? Play any card — that's a Thulla! The trick stops dead on the spot."],
  ['Pickup', 'Whoever played the highest card of the led suit picks up the whole pile and leads next.'],
  ['Clean trick', 'If everyone follows, the cards are discarded and the highest card leads next.'],
  ['Escape', 'Play your last card and you escape, safe. Watch who is void in which suit — good players remember!'],
];

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div
        className="panel rounded-2xl max-w-md w-full p-6 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-amber-100">How to play</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-100/60 hover:text-amber-200 text-xl px-2"
            aria-label="Close rules"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-3">
          {RULES.map(([title, body]) => (
            <li key={title} className="text-sm">
              <p className="font-bold text-amber-200">{title}</p>
              <p className="text-emerald-100/70">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TableScreen({ table, nickname, speed, onSpeedChange, onLeave, onRematch }: Props) {
  const { match, turn, legalIds, secondsLeft, paused, error, events, completedTrick } = table;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const me = match.seats[0];
  const trick = match.trick;

  // The engine seats the next trick instantly, so keep showing the finished
  // trick — including its final card — until the next card is played.
  const livePlays = trick?.plays ?? [];
  const displayPlays = livePlays.length > 0 ? livePlays : (completedTrick?.plays ?? []);
  const displayLedSuit = trick?.ledSuit ?? completedTrick?.ledSuit ?? null;
  const showingCompleted = livePlays.length === 0 && (completedTrick?.plays.length ?? 0) > 0;

  // Sort the live hand on every render. The engine mutates hand arrays in
  // place, so memoizing on the array reference would show stale cards.
  const sortedHand = [...me.hand].sort(
    (a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || rankValue(b.rank) - rankValue(a.rank),
  );

  const myTurn = turn === 0 && match.phase !== 'finished';
  const [soundOff, setSoundOff] = useState(isMuted());
  const prevMyTurn = useRef(false);

  const toggleMute = () => {
    const next = !soundOff;
    setMuted(next);
    setSoundOff(next);
    if (!next) clickSound();
  };

  // Gentle chime when the turn comes to you.
  useEffect(() => {
    if (myTurn && !paused && !prevMyTurn.current) turnSound();
    prevMyTurn.current = myTurn && !paused;
  }, [myTurn, paused]);

  // Viewport width: drives the mobile layout and keeps the hand fan on screen.
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobileLayout = vw < 768;

  // Hand fan geometry: shrink the overlap so every card fits the viewport,
  // however many cards pile up after Thullas.
  const HAND_CARD_W = 56; // CardView small width, px
  const handAvailW = Math.min(vw * 0.96, 620);
  const handStep =
    sortedHand.length <= 1
      ? HAND_CARD_W
      : Math.min(26, Math.max(13, (handAvailW - HAND_CARD_W) / (sortedHand.length - 1)));
  const ledSuit = displayLedSuit;
  const mustFollow = ledSuit !== null && me.hand.some((c) => c.suit === ledSuit);
  const hint = !myTurn
    ? null
    : match.isFirstTrick && (trick?.plays.length ?? 0) === 0
      ? 'You hold the A♠ — open with it.'
      : mustFollow
        ? `You must follow ${ledSuit}.`
        : ledSuit
          ? `No ${ledSuit} in hand — anything goes. Break suit and it's a Thulla!`
          : 'Your lead — play anything.';

  const illegalReason = mustFollow ? `You must follow ${ledSuit}.` : null;
  const timerPct = Math.max(0, Math.min(100, (secondsLeft / TURN_SECONDS) * 100));
  const turnName = turn !== null ? match.seats[turn].name : null;
  const feedEvents = events.slice().reverse();

  const status =
    match.phase === 'finished'
      ? {
          title: '🏁 Round over',
          sub:
            match.bhabi !== null
              ? `${match.seats[match.bhabi].name} is the Bhabi.`
              : 'Draw — no Bhabi this time.',
        }
      : table.thullaFlash
        ? { title: '💥 Thulla!', sub: table.thullaFlash }
        : myTurn
          ? { title: '🟢 Your turn', sub: hint ?? 'Tap a highlighted card.' }
          : { title: `🃏 ${turnName}'s turn`, sub: 'Waiting for their card…' };

  const thullaActive = !!table.thullaFlash && !paused;

  const tryPlay = (cardId: string) => {
    if (!myTurn || paused) return;
    if (legalIds.has(cardId)) {
      table.playCard(0, cardId);
    } else {
      table.notify(illegalReason ?? 'Not your turn.');
      setShakeId(cardId);
      window.setTimeout(() => setShakeId((s) => (s === cardId ? null : s)), 450);
    }
  };

  // Every action button, rendered once for desktop and once (compact,
  // thumb-sized) for the mobile action row. Nothing hides in a menu.
  const toolbarActions = (compact: boolean) => (
    <>
      <ToolButton
        compact={compact}
        title={paused ? 'Resume the game' : 'Pause the game'}
        label={paused ? 'Resume' : 'Pause'}
        onClick={() => table.togglePause()}
      >
        {paused ? <Play size={compact ? 18 : 14} /> : <Pause size={compact ? 18 : 14} />}
      </ToolButton>
      <ToolButton
        compact={compact}
        title="Restart this round with a fresh deal"
        label="Restart"
        onClick={onRematch}
      >
        <RotateCcw size={compact ? 18 : 14} />
      </ToolButton>
      <ToolButton compact={compact} title="How to play" label="Rules" onClick={() => setRulesOpen(true)}>
        <BookOpen size={compact ? 18 : 14} />
      </ToolButton>

      {/* Speed control */}
      <div
        className="flex rounded-lg border border-white/10 bg-white/5 p-0.5"
        role="group"
        aria-label="Game speed"
      >
        {(Object.keys(SPEEDS) as GameSpeed[]).map((s) => (
          <button
            key={s}
            type="button"
            title={`${SPEEDS[s].label} pace`}
            aria-label={`${SPEEDS[s].label} pace`}
            aria-pressed={speed === s}
            onClick={() => {
              clickSound();
              onSpeedChange(s);
            }}
            className={`rounded-md transition active:scale-95 ${compact ? 'p-2.5' : 'p-1.5'} ${
              speed === s
                ? 'bg-amber-300 text-emerald-950 shadow'
                : 'text-emerald-100/60 hover:text-amber-100 hover:bg-white/10'
            }`}
          >
            {SPEED_ICONS[s]}
          </button>
        ))}
      </div>

      {/* Sound toggle */}
      <button
        type="button"
        title={soundOff ? 'Unmute sounds' : 'Mute sounds'}
        aria-label={soundOff ? 'Unmute sounds' : 'Mute sounds'}
        aria-pressed={!soundOff}
        onClick={toggleMute}
        className={`rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-emerald-100/85 transition hover:border-amber-200/40 hover:bg-white/10 hover:text-amber-100 active:scale-95 ${
          compact ? 'p-2.5' : 'p-2'
        }`}
      >
        {soundOff ? <VolumeX size={compact ? 18 : 14} /> : <Volume2 size={compact ? 18 : 14} />}
      </button>

      <div className="w-px h-5 bg-white/10 shrink-0" aria-hidden />
      <ToolButton compact={compact} title="Back to table setup" label="New table" onClick={onLeave}>
        <Layers size={compact ? 18 : 14} />
      </ToolButton>
      <Link
        to="/"
        title="Quit to playground"
        aria-label="Quit to playground"
        onClick={() => clickSound()}
        className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-emerald-100/85 transition hover:border-red-300/40 hover:bg-red-950/40 hover:text-red-200 active:scale-95 ${
          compact ? 'p-2.5 justify-center' : 'px-2.5 py-1.5'
        }`}
      >
        <LogOut size={compact ? 18 : 14} />
        {!compact && <span className="hidden md:inline">Quit</span>}
      </Link>
    </>
  );

  return (
    <div className="felt h-dvh flex flex-col overflow-hidden select-none overscroll-none">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <header className="shrink-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="h-12 flex items-center gap-2 px-3">
          <Link
            to="/"
            onClick={() => clickSound()}
            className="flex items-center gap-0.5 text-emerald-100/70 text-sm font-semibold hover:text-amber-200 whitespace-nowrap p-1 -ml-1"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Playground</span>
          </Link>
          <div className="w-px h-5 bg-white/10" aria-hidden />
          <h1 className="font-black text-amber-100 tracking-wide text-sm whitespace-nowrap">
            Bhabi Thulla
          </h1>
          <p className="hidden xl:block text-[11px] text-emerald-100/45 whitespace-nowrap">
            Developed by <span className="text-amber-200/80 font-semibold">Zunair Qadeer</span>
          </p>

          {/* Turn indicator + led-suit badge (header: nothing can overlap it here) */}
          <div aria-live="polite" className="flex-1 flex justify-center items-center gap-2 min-w-0">
            {match.phase === 'finished' ? (
              <span className="text-emerald-100/60 text-xs font-semibold">Round over</span>
            ) : myTurn && !paused ? (
              <span className="animate-pulse rounded-full bg-amber-300 px-3 sm:px-4 py-1 text-emerald-950 text-xs font-black tracking-wide shadow-[0_0_16px_rgba(252,211,77,0.5)] whitespace-nowrap">
                YOUR TURN{secondsLeft <= 10 ? ` · ${secondsLeft}s` : ''}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-700/60 bg-emerald-950/60 px-3 sm:px-4 py-1 text-emerald-100/80 text-xs font-semibold truncate max-w-full">
                {paused ? 'Paused' : `${turnName}'s turn…`}
              </span>
            )}
            {ledSuit && displayPlays.length > 0 && match.phase !== 'finished' && (
              <span
                title={`Led suit: ${ledSuit}${showingCompleted ? ' (trick complete)' : ''}`}
                className="hidden min-[420px]:inline rounded-full border border-amber-200/30 bg-black/40 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
              >
                <span className={RED_SUITS.has(ledSuit) ? 'text-red-300' : 'text-amber-100'}>
                  {SUIT_GLYPH[ledSuit]}
                </span>{' '}
                <span className="text-amber-200/90 capitalize">{ledSuit}</span>
              </span>
            )}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-1.5">{toolbarActions(false)}</div>
        </div>

        {/* Mobile action row — every button stays visible, thumb-sized */}
        <div className="md:hidden flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto">
          {toolbarActions(true)}
        </div>
      </header>

      {/* ── Main row: table + feed ──────────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        {/* Table scene — one continuous felt, no separate bars */}
        <main className="flex-1 min-w-0 min-h-0 relative">
          <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4 pt-2 sm:pt-3 pb-32">
            <div
              className={`relative ${thullaActive ? 'table-shake' : ''}`}
              style={{
                width: `min(100%, calc((100dvh - ${isMobileLayout ? 17.5 : 14}rem) * 1.45))`,
                aspectRatio: '1.45 / 1',
              }}
            >
              {/* Wooden rim */}
              <div className="table-rim absolute -inset-2 sm:-inset-3 rounded-[50%]" aria-hidden />
              {/* Felt with overhead spotlight */}
              <div className="table-felt absolute inset-0 rounded-[50%] overflow-hidden" aria-hidden>
                <div className="felt-noise absolute inset-0 opacity-[0.05]" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 60% 48% at 50% 28%, rgba(255, 238, 190, 0.17), transparent 70%)',
                  }}
                />
                {/* Thin gold inner ring — clean, no text */}
                <div className="absolute inset-6 sm:inset-8 rounded-[50%] border border-amber-200/15" />
              </div>

              {/* Turn-flow arrow: a full, still oval hugging the rim — direction only */}
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none opacity-30"
                viewBox="0 0 290 200"
                aria-hidden
              >
                <defs>
                  <marker
                    id="flow-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="5"
                    refY="3.5"
                    orient="auto"
                  >
                    <path d="M0,0 L7,3.5 L0,7 z" fill="#fcd34d" />
                  </marker>
                </defs>
                <path
                  d="M 145 193 A 134 93 0 0 0 145 7 A 134 93 0 0 0 145 193"
                  fill="none"
                  stroke="#fcd34d"
                  strokeWidth="1.8"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  markerEnd="url(#flow-arrow)"
                />
              </svg>

              {/* Thulla flash banner */}
              {thullaActive && (
                <p
                  className="thulla-flash absolute left-1/2 top-[12%] -translate-x-1/2 z-20 text-amber-200 font-black text-sm sm:text-base text-center whitespace-nowrap bg-emerald-950/85 rounded-full px-4 py-1 border border-amber-300/40"
                  role="alert"
                >
                  {table.thullaFlash}
                </p>
              )}

              {/* Trick cards at the centre, fanned towards each player */}
              <div className="absolute inset-0 pointer-events-none">
                {displayPlays.map((p, i) => {
                  const o = trickOffset(p.seat, match.numSeats);
                  const rot = (i - (displayPlays.length - 1) / 2) * 7;
                  return (
                    <div
                      key={`${p.seat}-${p.card.id}`}
                      className="absolute"
                      style={{
                        left: `${50 + o.x}%`,
                        top: `${50 + o.y}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10 + i,
                      }}
                    >
                      <div className="play-in">
                        <div style={{ transform: `rotate(${rot}deg) scale(0.94)` }}>
                          <CardView card={p.card} small />
                          <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/65 px-1.5 py-px text-[9px] font-semibold text-amber-100/90">
                            {match.seats[p.seat].name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {displayPlays.length === 0 && match.phase !== 'finished' && (
                  <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-100/60 text-sm px-8 text-center whitespace-nowrap">
                    {myTurn
                      ? match.isFirstTrick
                        ? 'You hold the A♠ — open with it.'
                        : 'Your lead — tap any card.'
                      : match.isFirstTrick
                        ? `${turnName} opens with the A♠…`
                        : `${turnName} leads…`}
                  </p>
                )}
              </div>

              {/* Seats around the table (your seat is your hand, below) */}
              {match.seats.map((s, seat) => {
                if (seat === 0) return null;
                const { x, y } = seatPos(seat, match.numSeats);
                const isTurn = turn === seat && match.phase !== 'finished' && !paused;
                return (
                  <SeatPod
                    key={seat}
                    x={x}
                    y={y}
                    name={s.name}
                    cards={s.hand.length}
                    active={isTurn}
                    escaped={s.escaped}
                  />
                );
              })}

              {/* Paused overlay */}
              {paused && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[50%] bg-black/60 backdrop-blur-[2px]">
                  <p className="text-amber-100 font-black text-2xl mb-1">Paused</p>
                  <p className="text-emerald-100/60 text-sm mb-4">Take your time.</p>
                  <button
                    type="button"
                    onClick={() => {
                      clickSound();
                      table.togglePause();
                    }}
                    className="flex items-center gap-2 rounded-xl bg-amber-300 px-6 py-2.5 font-black text-emerald-950 hover:bg-amber-200 active:scale-95 transition"
                  >
                    <Play size={16} /> Resume
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Your hand: floating fan, part of the scene ── */}
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20">
            <div className="relative flex flex-col items-center">
              {/* Error / illegal-move toast */}
              {error && (
                <p
                  className="absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-red-950/90 border border-red-700/60 px-3 py-1.5 text-red-100 text-xs font-semibold shadow-lg"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {/* Status pill */}
              <div className="flex items-center gap-2 rounded-full bg-black/55 border border-white/10 backdrop-blur px-3 py-1">
                <span className="text-amber-50 text-xs font-bold whitespace-nowrap">
                  {nickname}
                  {me.escaped && <span className="text-teal-300"> · escaped ✓</span>}
                  {!me.escaped && (
                    <span className="text-emerald-100/50 font-normal"> · {me.hand.length} cards</span>
                  )}
                </span>
                <span className="w-px h-3 bg-white/15" aria-hidden />
                <span className="text-emerald-100/70 text-xs whitespace-nowrap">
                  {paused
                    ? 'paused'
                    : match.phase === 'finished'
                      ? 'round over'
                      : myTurn
                        ? `${secondsLeft}s — tap a card`
                        : 'waiting…'}
                </span>
              </div>

              {/* Timer bar */}
              {myTurn && !paused && match.phase !== 'finished' && (
                <div
                  className="mt-1.5 h-1 w-44 rounded bg-black/60 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(timerPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Your turn timer"
                >
                  <div
                    className={`h-full transition-all duration-1000 ${
                      secondsLeft <= 10 ? 'bg-red-400' : 'bg-amber-300'
                    }`}
                    style={{ width: `${timerPct}%` }}
                  />
                </div>
              )}

              {/* Hint */}
              {myTurn && !paused && hint && (
                <p className="mt-1 text-[11px] font-semibold text-amber-100/85 text-center px-4">
                  {hint}
                </p>
              )}

              {/* The fan */}
              <div
                className="flex justify-center items-end mt-1.5 px-2"
                role="listbox"
                aria-label="Your hand"
              >
                {sortedHand.map((c, i) => {
                  const legal = myTurn && legalIds.has(c.id) && !paused;
                  const rot = (i - (sortedHand.length - 1) / 2) * 4;
                  return (
                    <div
                      key={c.id}
                      role="option"
                      aria-selected={false}
                      className="shrink-0"
                      style={{ marginLeft: i === 0 ? 0 : -(HAND_CARD_W - handStep), zIndex: i }}
                    >
                      <div
                        className="deal-in"
                        style={{ animationDelay: `${Math.min(i * 40, 500)}ms` }}
                      >
                        <div
                          className={shakeId === c.id ? 'shake' : ''}
                          style={{ transform: `rotate(${rot}deg)`, transformOrigin: '50% 130%' }}
                        >
                          <CardView
                            card={c}
                            small
                            legal={legal}
                            dimmed={myTurn && !legalIds.has(c.id)}
                            onClick={() => tryPlay(c.id)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* What's-happening panel (desktop) */}
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col min-h-0 border-l border-white/10 bg-black/25 backdrop-blur">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs font-black tracking-[0.2em] text-teal-300/80 uppercase">
              <span
                className="inline-block h-2 w-2 rounded-full bg-teal-300 mr-2 animate-pulse"
                aria-hidden
              />
              What's happening
            </p>
          </div>
          <div className="px-4 py-3">
            <div className="rounded-xl bg-emerald-900/60 border border-amber-300/30 px-3 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
              <p className="text-amber-100 font-black text-sm">{status.title}</p>
              <p className="text-emerald-100/70 text-xs mt-0.5">{status.sub}</p>
            </div>
          </div>
          <ul
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-1.5 text-xs"
            aria-label="Recent actions"
          >
            {feedEvents.map((e, i) => (
              <li
                key={`${i}-${e}`}
                className={`rounded-lg px-2.5 py-1.5 leading-snug ${
                  i === 0
                    ? 'bg-emerald-900/70 border border-amber-300/25 text-amber-50 font-semibold'
                    : 'text-emerald-100/55'
                }`}
              >
                {e}
              </li>
            ))}
          </ul>
          <p className="px-4 py-2.5 border-t border-white/10 text-[11px] text-emerald-100/40">
            Developed by <span className="text-amber-200/80 font-semibold">Zunair Qadeer</span>
          </p>
        </aside>
      </div>

      {/* Compact status ticker (mobile) */}
      <div className="lg:hidden shrink-0 h-8 flex items-center justify-center px-3 border-t border-white/10 bg-black/25">
        <p className="text-emerald-100/70 text-xs truncate" aria-live="polite">
          {status.title} — {status.sub}
        </p>
      </div>

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}
