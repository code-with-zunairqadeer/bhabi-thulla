import { SUITS, rankValue } from '@bhabi-thulla/game-engine';
import { TableState, TURN_SECONDS } from '../game/useTable';
import { CardView } from './CardView';

interface Props {
  table: TableState;
  nickname: string;
  onLeave: () => void;
}

const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

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

  const opponents = match.seats.slice(1);
  const timerPct = Math.max(0, Math.min(100, (secondsLeft / TURN_SECONDS) * 100));
  const recentEvents = events.slice(-4).reverse();

  return (
    <div className="felt min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-emerald-800/60">
        <button
          type="button"
          onClick={onLeave}
          className="text-emerald-100/70 text-sm font-semibold hover:text-amber-200 px-2 py-1"
          aria-label="Leave table"
        >
          ← Leave
        </button>
        <div className="text-center">
          <h1 className="text-amber-100 font-black tracking-tight leading-none">Bhabi Thulla</h1>
          <p className="text-emerald-100/50 text-[11px]">Practice table · {match.numSeats} seats</p>
        </div>
        <div className="w-24 text-right" aria-live="polite">
          {myTurn ? (
            <span className={`text-sm font-bold ${secondsLeft <= 10 ? 'text-red-300' : 'text-amber-200'}`}>
              {secondsLeft}s
            </span>
          ) : (
            <span className="text-emerald-100/50 text-xs">
              {turn !== null ? `${match.seats[turn].name}'s turn` : '—'}
            </span>
          )}
        </div>
      </header>
      {myTurn && (
        <div className="h-1 bg-emerald-950/60" role="progressbar" aria-valuenow={secondsLeft} aria-valuemax={TURN_SECONDS}>
          <div
            className={`h-full transition-all duration-1000 ${secondsLeft <= 10 ? 'bg-red-400' : 'bg-amber-300'}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      )}

      {/* Opponents */}
      <div className="flex gap-2 overflow-x-auto px-3 sm:px-5 py-3" aria-label="Opponents">
        {opponents.map((s, i) => {
          const seat = i + 1;
          const isTurn = turn === seat;
          return (
            <div
              key={seat}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 border shrink-0 transition ${
                isTurn
                  ? 'border-amber-300 bg-emerald-900/70 shadow-[0_0_12px_rgba(252,211,77,0.25)]'
                  : 'border-emerald-800/60 bg-emerald-950/50'
              } ${s.escaped ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-amber-50 text-xs font-bold truncate max-w-24">
                  {s.name}
                </p>
                <p className="text-emerald-100/60 text-[11px]">
                  {s.escaped ? <span className="text-teal-300 font-semibold">escaped ✓</span> : `${s.hand.length} cards`}
                </p>
              </div>
              {!s.escaped && s.hand.length > 0 && (
                <div className="flex -space-x-4" aria-hidden>
                  {s.hand.slice(0, 3).map((_, k) => (
                    <CardView key={k} card={s.hand[0]} small faceDown />
                  ))}
                  {s.hand.length > 3 && (
                    <span className="text-emerald-100/60 text-[10px] self-center pl-4">+{s.hand.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trick area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-44">
        {table.thullaFlash && (
          <p className="thulla-flash text-amber-200 font-black text-lg mb-2 text-center" role="alert">
            {table.thullaFlash}
          </p>
        )}
        {displayPlays.length > 0 ? (
          <div className="flex flex-wrap items-end justify-center gap-3" aria-live="polite">
            {displayPlays.map((p) => (
              <div key={`${p.seat}-${p.card.id}`} className="flex flex-col items-center gap-1 play-in">
                <CardView card={p.card} small />
                <span className="text-emerald-100/70 text-[11px] font-semibold max-w-16 truncate">
                  {match.seats[p.seat].name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-emerald-100/40 text-sm">
            {match.isFirstTrick ? 'Waiting for the A-spades opening…' : 'Waiting for the lead…'}
          </p>
        )}
        {ledSuit && (
          <p className="text-emerald-100/60 text-xs mt-2">
            Led suit: <span className="font-bold text-amber-200 capitalize">{ledSuit}</span>
            {showingCompleted && <span className="text-emerald-100/40"> · trick complete</span>}
          </p>
        )}
      </div>

      {/* Feed + hint */}
      <div className="px-3 sm:px-5 space-y-1.5">
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
      <div className="border-t border-emerald-800/60 bg-emerald-950/40 px-3 sm:px-5 pt-2 pb-4 safe-bottom">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-amber-50 text-sm font-bold truncate">
            {nickname}
            {me.escaped && <span className="text-teal-300 ml-2">escaped ✓</span>}
            {!me.escaped && <span className="text-emerald-100/50 font-normal ml-2">{me.hand.length} cards</span>}
          </p>
          <p className="text-emerald-100/50 text-xs">
            {myTurn ? (secondsLeft > 0 ? `${secondsLeft}s — tap a card` : 'auto-playing…') : 'waiting…'}
          </p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2" role="listbox" aria-label="Your hand">
          {sortedHand.map((c) => {
            const legal = legalIds.has(c.id);
            return (
              <div key={c.id} role="option" aria-selected={false}>
                <CardView
                  card={c}
                  legal={myTurn && legal}
                  dimmed={myTurn && !legal}
                  onClick={
                    myTurn
                      ? () =>
                          legal
                            ? table.playCard(0, c.id)
                            : table.notify(illegalReason ?? 'Not your turn.')
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
        <p className="text-emerald-100/40 text-[11px] mt-1 text-center">
          Tap a highlighted card to throw it. {SUITS.length * 13}-card deck · no trump
        </p>
      </div>
    </div>
  );
}
