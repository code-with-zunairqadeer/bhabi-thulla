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
  return { x: 50 + 47 * Math.cos(angle), y: 50 + 47 * Math.sin(angle) };
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
              ? 'bg-gradient-to-br from-amber-200 to-amber-400 text-emerald-950 ring-2 ring-amber-100 shadow-[0_0_26px_rgba(252,211,77,0.7)] scale-110'
              : 'bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-100 ring-1 ring-amber-200/30 shadow-[0_4px_10px_rgba(0,0,0,0.5)]'
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
          className={`mt-1 max-w-16 sm:max-w-20 truncate text-[11px] sm:text-xs font-bold leading-tight text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
            active ? 'text-amber-200' : 'text-amber-50/90'
          } ${escaped ? 'opacity-50' : ''}`}
        >
          {name}
          {isYou && <span className="text-teal-300"> (you)</span>}
        </p>
        <p className="text-emerald-100/70 text-[10px] sm:text-[11px] leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {escaped ? <span className="text-teal-300 font-semibold">escaped ✓</span> : line2}
        </p>
        {isYou && timerPct !== undefined && (
          <div className="mt-1 h-1 w-12 sm:w-14 rounded bg-black/50 overflow-hidden" aria-hidden>
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
  const turnName = turn !== null ? match.seats[turn].name : null;
  const feedEvents = events.slice().reverse();
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

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

  return (
    <div className="felt h-dvh flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 border-b border-emerald-800/60 bg-emerald-950/40 backdrop-blur">
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
            <span className="animate-pulse rounded-full bg-amber-300 px-4 py-1 text-emerald-950 text-xs font-black tracking-wide shadow-[0_0_16px_rgba(252,211,77,0.5)]">
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
      {/* Credit strip — its own row, never behind the table */}
      <div className="h-7 shrink-0 flex items-center justify-center border-b border-emerald-800/40 bg-black/20">
        <p className="text-emerald-100/50 text-[11px] tracking-wide">
          Bhabi Thulla · Practice table · {match.numSeats} seats ·{' '}
          <span className="text-amber-200/80 font-semibold">Developed by Zunair Qadeer</span>
        </p>
      </div>

      {/* Main row: table + instruction panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Round table */}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center px-2 py-4">
          <div
            className="relative"
            style={{ width: 'min(calc(100% - 0.5rem), calc(100dvh - 19rem))', aspectRatio: '1 / 1' }}
          >
            {/* Wooden rim */}
            <div className="table-rim absolute -inset-3 sm:-inset-4 rounded-full" aria-hidden />
            {/* Felt */}
            <div className="table-felt absolute inset-0 rounded-full overflow-hidden" aria-hidden>
              <div className="felt-noise absolute inset-0 opacity-[0.05]" />
            </div>
            {/* Gold emblem ring */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none opacity-40"
              viewBox="0 0 200 200"
              aria-hidden
            >
              <defs>
                <path
                  id="emblem-circle"
                  d="M 100,100 m -58,0 a 58,58 0 1,1 112,0 a 58,58 0 1,1 -112,0"
                />
              </defs>
              <text fontSize="10" fill="#fcd34d" letterSpacing="3" fontWeight="800">
                <textPath href="#emblem-circle">
                  BHABI THULLA • ZUNAIR'S PLAYGROUND •
                </textPath>
              </text>
              <text x="100" y="112" textAnchor="middle" fontSize="34" fill="#fcd34d" opacity="0.5">
                ♠
              </text>
            </svg>
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
                d="M 93 179.7 A 80 80 0 1 0 107 179.7"
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
                className="thulla-flash absolute left-1/2 top-[15%] -translate-x-1/2 z-20 text-amber-200 font-black text-sm sm:text-base text-center whitespace-nowrap bg-emerald-950/80 rounded-full px-4 py-1 border border-amber-300/40"
                role="alert"
              >
                {table.thullaFlash}
              </p>
            )}

            {/* Trick cards at the centre */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {displayPlays.length > 0 ? (
                <>
                  <div className="flex items-end justify-center" aria-live="polite">
                    {displayPlays.map((p, i) => (
                      <div
                        key={`${p.seat}-${p.card.id}`}
                        className="play-in -ml-5 first:ml-0 flex flex-col items-center"
                        style={{ transform: `rotate(${(i - (displayPlays.length - 1) / 2) * 7}deg)` }}
                      >
                        <CardView card={p.card} small />
                        <span className="text-amber-100/90 text-[10px] font-semibold max-w-14 truncate mt-0.5 bg-black/60 rounded px-1">
                          {match.seats[p.seat].name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {ledSuit && (
                    <p className="mt-2 text-emerald-100/80 text-[11px] whitespace-nowrap bg-black/50 rounded-full px-3 py-0.5">
                      Led suit: <span className="font-bold text-amber-200 capitalize">{ledSuit}</span>
                      {showingCompleted && <span className="text-emerald-100/50"> · trick complete</span>}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-emerald-100/50 text-sm px-8 text-center">
                  {match.isFirstTrick ? 'Waiting for the A-spades opening…' : 'Waiting for the lead…'}
                </p>
              )}
            </div>

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
        </div>

        {/* What's-happening panel (desktop) */}
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col min-h-0 border-l border-emerald-800/60 bg-emerald-950/40">
          <div className="px-4 py-3 border-b border-emerald-800/60">
            <p className="text-xs font-black tracking-[0.2em] text-teal-300/80 uppercase">
              <span className="inline-block h-2 w-2 rounded-full bg-teal-300 mr-2 animate-pulse" aria-hidden />
              What's happening
            </p>
          </div>
          <div className="px-4 py-3">
            <div className="rounded-xl bg-emerald-900/60 border border-amber-300/30 px-3 py-2.5">
              <p className="text-amber-100 font-black text-sm">{status.title}</p>
              <p className="text-emerald-100/70 text-xs mt-0.5">{status.sub}</p>
            </div>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-1.5 text-xs" aria-label="Recent actions">
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
          <div className="px-4 py-3 border-t border-emerald-800/60">
            <p className="text-[11px] font-bold text-emerald-100/60 uppercase tracking-wider mb-1.5">
              Quick rules
            </p>
            <ul className="text-[11px] text-emerald-100/50 space-y-1 leading-snug">
              <li>• Follow the led suit if you can.</li>
              <li>
                • Can't follow? Any card — that's a{' '}
                <span className="text-amber-200 font-semibold">Thulla</span>; the trick stops.
              </li>
              <li>• Highest card of the led suit picks up the pile.</li>
              <li>• Empty your hand to escape. Last one holding cards is the Bhabi.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Compact status ticker (mobile) */}
      <div className="lg:hidden shrink-0 h-8 flex items-center justify-center px-3 border-t border-emerald-800/40 bg-black/20">
        <p className="text-emerald-100/70 text-xs truncate" aria-live="polite">
          {status.title} — {status.sub}
        </p>
      </div>

      {/* Your hand — single tap plays immediately. */}
      <div className="shrink-0 h-44 border-t border-emerald-800/60 bg-emerald-950/40 px-3 sm:px-5 pt-2 pb-3 safe-bottom">
        <div className="flex items-center justify-between mb-1 max-w-xl mx-auto">
          <p className="text-amber-50 text-sm font-bold truncate">
            {nickname}
            {me.escaped && <span className="text-teal-300 ml-2">escaped ✓</span>}
            {!me.escaped && <span className="text-emerald-100/50 font-normal ml-2">{me.hand.length} cards</span>}
          </p>
          <p className="text-emerald-100/50 text-xs">
            {myTurn ? (secondsLeft > 0 ? `${secondsLeft}s — tap a card` : 'auto-playing…') : 'waiting…'}
          </p>
        </div>
        {error && (
          <p className="text-red-200 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-1 text-xs mb-1 max-w-xl mx-auto" role="alert">
            {error}
          </p>
        )}
        <div
          className="flex -space-x-7 justify-[safe_center] overflow-x-auto pb-1 pt-1 max-w-3xl mx-auto px-1"
          role="listbox"
          aria-label="Your hand"
        >
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
      </div>
    </div>
  );
}
