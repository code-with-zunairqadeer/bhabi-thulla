import { Link } from 'react-router-dom';
import { SUITS, rankValue } from '@bhabi-thulla/game-engine';
import { TableState, TURN_SECONDS } from '../game/useTable';
import { CardView } from './CardView';

interface Props {
  table: TableState;
  nickname: string;
  onLeave: () => void;
}

const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

/**
 * Seat positions around the table, as fractions of the table box.
 * Seat 0 (you) sits at the bottom; seats advance ANTICLOCKWISE as seen from
 * above — the way a real Bhabi Thulla table flows.
 */
function seatPos(seat: number, numSeats: number): { x: number; y: number } {
  const angle = ((90 - (seat * 360) / numSeats) * Math.PI) / 180;
  return { x: 50 + 46 * Math.cos(angle), y: 50 + 43 * Math.sin(angle) };
}

function SeatPod({
  x,
  y,
  name,
  line2,
  active,
  escaped,
  isYou,
  timerPct,
  lowTime,
}: {
  x: number;
  y: number;
  name: string;
  line2: string;
  active: boolean;
  escaped: boolean;
  isYou: boolean;
  timerPct?: number;
  lowTime?: boolean;
}) {
  return (
    <div
      className="absolute z-10"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex flex-col items-center w-16 sm:w-20">
        <div
          className={`relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full font-black text-sm sm:text-base transition-all ${
            active
              ? 'bg-amber-300 text-emerald-950 ring-2 ring-amber-100 shadow-[0_0_22px_rgba(252,211,77,0.65)] scale-110'
              : 'bg-emerald-900/90 text-amber-100 ring-1 ring-emerald-700/60'
          } ${escaped ? 'opacity-40 grayscale' : ''}`}
          aria-label={`${name}${active ? ', current turn' : ''}${escaped ? ', escaped' : ''}`}
        >
          {active && !escaped && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400 border-2 border-emerald-950" />
            </span>
          )}
          {name.charAt(0).toUpperCase()}
        </div>
        <p
          className={`mt-1 max-w-16 sm:max-w-20 truncate text-[11px] sm:text-xs font-bold leading-tight text-center ${
            active ? 'text-amber-200' : 'text-amber-50/90'
          } ${escaped ? 'opacity-50' : ''}`}
        >
          {name}
          {isYou && <span className="text-teal-300"> (you)</span>}
        </p>
        <p className="text-emerald-100/60 text-[10px] sm:text-[11px] leading-tight">
          {escaped ? <span className="text-teal-300 font-semibold">escaped ✓</span> : line2}
        </p>
        {isYou && timerPct !== undefined && (
          <div className="mt-1 h-1 w-12 sm:w-14 rounded bg-emerald-950/70 overflow-hidden" aria-hidden>
            <div
              className={`h-full transition-all duration-1000 ${lowTime ? 'bg-red-400' : 'bg-amber-300'}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function TableScreen({ table, nickname, onLeave }: Props) {
  const { match, turn, legalIds, secondsLeft, error, events, completedTrick } = table;
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
  const ledSuit = displayLedSuit;
  const mustFollow = ledSuit !== null && me.hand.some((c) => c.suit === ledSuit);
  const hint = !myTurn
    ? null
    : match.isFirstTrick && (trick?.plays.length ?? 0) === 0
      ? 'You hold the A-spades — you must open with it.'
      : mustFollow
        ? `You must follow ${ledSuit}.`
        : ledSuit
          ? `No ${ledSuit} in hand — tap any card. Break suit and it's a Thulla!`
          : 'Your lead — tap any card.';

  const illegalReason = mustFollow ? `You must follow ${ledSuit}.` : null;
  const timerPct = Math.max(0, Math.min(100, (secondsLeft / TURN_SECONDS) * 100));
  const recentEvents = events.slice(-4).reverse();
  const turnName = turn !== null ? match.seats[turn].name : null;

  return (
    <div className="felt min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-emerald-800/60">
        <Link
          to="/"
          className="text-emerald-100/70 text-sm font-semibold hover:text-amber-200 px-1 py-1 whitespace-nowrap"
        >
          ← Playground
        </Link>
        <div aria-live="polite" className="flex-1 flex justify-center">
          {match.phase === 'finished' ? (
            <span className="text-emerald-100/60 text-xs font-semibold">Round over</span>
          ) : myTurn ? (
            <span className="animate-pulse rounded-full bg-amber-300 px-4 py-1 text-emerald-950 text-xs font-black tracking-wide">
              YOUR TURN{secondsLeft <= 10 ? ` · ${secondsLeft}s` : ''}
            </span>
          ) : (
            <span className="rounded-full border border-emerald-700/60 bg-emerald-950/60 px-4 py-1 text-emerald-100/80 text-xs font-semibold">
              {turnName}'s turn…
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="text-emerald-100/70 text-sm font-semibold hover:text-amber-200 px-2 py-1 whitespace-nowrap"
          aria-label="Leave table"
        >
          Leave →
        </button>
      </header>
      <p className="text-center text-emerald-100/40 text-[11px] pt-1.5">
        Bhabi Thulla · Practice table · {match.numSeats} seats · Developed by Zunair Qadeer
      </p>

      {/* Round table */}
      <div className="relative w-full max-w-xl mx-auto aspect-[4/3] sm:aspect-[16/10] mt-1 px-2">
        {/* Wooden rim + felt */}
        <div className="absolute inset-2 sm:inset-4 rounded-[50%] bg-gradient-to-br from-amber-900 via-[#5b3a1a] to-amber-950 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-2 sm:inset-3 rounded-[50%] bg-[radial-gradient(ellipse_at_center,#0f6a4d_0%,#0a4a35_55%,#063325_100%)] shadow-[inset_0_10px_40px_rgba(0,0,0,0.5)]" />
        </div>
        {/* Felt watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden
        >
          <span className="text-emerald-100/10 font-black text-5xl sm:text-6xl tracking-tight">♠</span>
        </div>
        {/* Turn-flow arrow (anticlockwise) */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none opacity-25"
          viewBox="0 0 200 200"
          aria-hidden
        >
          <defs>
            <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill="#fcd34d" />
            </marker>
          </defs>
          <path
            d="M 93.2 173.7 A 78 74 0 1 0 106.8 173.7"
            fill="none"
            stroke="#fcd34d"
            strokeWidth="1.6"
            strokeDasharray="7 6"
            markerEnd="url(#flow-arrow)"
          />
        </svg>

        {/* Thulla flash */}
        {table.thullaFlash && (
          <p
            className="thulla-flash absolute left-1/2 top-[6%] -translate-x-1/2 z-20 text-amber-200 font-black text-base sm:text-lg text-center whitespace-nowrap"
            role="alert"
          >
            {table.thullaFlash}
          </p>
        )}

        {/* Trick cards at the centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {displayPlays.length > 0 ? (
            <div className="flex items-end justify-center" aria-live="polite">
              {displayPlays.map((p, i) => (
                <div
                  key={`${p.seat}-${p.card.id}`}
                  className="play-in -ml-5 first:ml-0 flex flex-col items-center"
                  style={{ transform: `rotate(${(i - (displayPlays.length - 1) / 2) * 7}deg)` }}
                >
                  <CardView card={p.card} small />
                  <span className="text-emerald-100/80 text-[10px] font-semibold max-w-14 truncate mt-0.5 bg-emerald-950/70 rounded px-1">
                    {match.seats[p.seat].name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-emerald-100/40 text-sm px-8 text-center">
              {match.isFirstTrick ? 'Waiting for the A-spades opening…' : 'Waiting for the lead…'}
            </p>
          )}
        </div>
        {ledSuit && (
          <p className="absolute left-1/2 bottom-[4%] -translate-x-1/2 z-10 text-emerald-100/70 text-[11px] whitespace-nowrap bg-emerald-950/60 rounded-full px-3 py-0.5">
            Led suit: <span className="font-bold text-amber-200 capitalize">{ledSuit}</span>
            {showingCompleted && <span className="text-emerald-100/40"> · trick complete</span>}
          </p>
        )}

        {/* Seats around the table */}
        {match.seats.map((s, seat) => {
          const { x, y } = seatPos(seat, match.numSeats);
          const isTurn = turn === seat && match.phase !== 'finished';
          return (
            <SeatPod
              key={seat}
              x={x}
              y={y}
              name={s.name}
              line2={s.isBot ? `BOT · ${s.hand.length} cards` : `${s.hand.length} cards`}
              active={isTurn}
              escaped={s.escaped}
              isYou={seat === 0}
              timerPct={seat === 0 && myTurn ? timerPct : undefined}
              lowTime={secondsLeft <= 10}
            />
          );
        })}
      </div>

      {/* Feed + hint */}
      <div className="px-3 sm:px-5 space-y-1.5 max-w-xl w-full mx-auto">
        {error && (
          <p className="text-red-200 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-1.5 text-sm" role="alert">
            {error}
          </p>
        )}
        {hint && <p className="text-amber-100/90 text-sm text-center">{hint}</p>}
        <ul className="text-emerald-100/50 text-xs space-y-0.5 h-14 overflow-hidden" aria-label="Recent actions">
          {recentEvents.map((e, i) => (
            <li key={`${i}-${e}`} className={i === 0 ? 'text-emerald-100/80' : ''}>
              {e}
            </li>
          ))}
        </ul>
      </div>

      {/* Your hand — single tap plays immediately. */}
      <div className="border-t border-emerald-800/60 bg-emerald-950/40 px-3 sm:px-5 pt-2 pb-4 safe-bottom mt-auto">
        <div className="flex items-center justify-between mb-1.5 max-w-xl mx-auto">
          <p className="text-amber-50 text-sm font-bold truncate">
            {nickname}
            {me.escaped && <span className="text-teal-300 ml-2">escaped ✓</span>}
            {!me.escaped && <span className="text-emerald-100/50 font-normal ml-2">{me.hand.length} cards</span>}
          </p>
          <p className="text-emerald-100/50 text-xs">
            {myTurn ? (secondsLeft > 0 ? `${secondsLeft}s — tap a card` : 'auto-playing…') : 'waiting…'}
          </p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2 max-w-xl mx-auto" role="listbox" aria-label="Your hand">
          {sortedHand.map((c) => {
            const legal = legalIds.has(c.id);
            return (
              <div key={c.id} role="option" aria-selected={false}>
                <CardView
                  card={c}
                  legal={myTurn && legal}
                  dimmed={myTurn && !legal}
                  onClick={() => {
                    if (!myTurn) return;
                    if (legal) table.playCard(0, c.id);
                    else table.notify(illegalReason ?? 'Not your turn.');
                  }}
                />
              </div>
            );
          })}
        </div>
        <p className="text-emerald-100/40 text-[11px] mt-1 text-center">
          Tap a highlighted card to throw it · Developed by Zunair Qadeer
        </p>
      </div>
    </div>
  );
}
