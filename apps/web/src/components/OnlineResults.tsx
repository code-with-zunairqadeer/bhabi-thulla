/**
 * OnlineResults — end-of-match screen for server-driven games, from the
 * game:over event (per-player view: "You are the Bhabi!" when it's you).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RotateCcw } from 'lucide-react';
import type { OnlineSnapshot } from '../game/online';
import { online } from '../game/online';
import { clickSound } from '../game/sound';

export function OnlineResults({ snap, nickname }: { snap: OnlineSnapshot; nickname: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const over = snap.over;
  if (!over) return null;
  const isHost = snap.room?.hostGuestId === snap.guestId;

  const rematch = async () => {
    clickSound();
    setBusy(true);
    setError(null);
    try {
      await online.rematch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a rematch.');
      setBusy(false);
    }
  };

  return (
    <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-2">Match over</p>
        {over.draw ? (
          <>
            <h1 className="text-4xl font-black text-amber-100 mb-1">Draw</h1>
            <p className="text-emerald-100/70 mb-6">Everyone emptied their hands together — no Bhabi this time.</p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-black text-amber-100 mb-1">
              {over.youAreBhabi ? 'You are the Bhabi!' : `${over.bhabiName} is the Bhabi`}
            </h1>
            <p className="text-emerald-100/70 mb-6">
              {over.youAreBhabi
                ? 'Last one holding cards. Better luck next deal.'
                : 'Last player holding cards takes the title.'}
            </p>
          </>
        )}

        <div className="panel rounded-2xl p-5 text-left mb-5">
          <h2 className="text-sm font-bold text-emerald-100/80 uppercase tracking-wider mb-3">Final standings</h2>
          {over.escapeOrder.length === 0 && over.draw ? (
            <p className="text-emerald-100/50 text-sm">No escapes recorded.</p>
          ) : (
            <ol className="space-y-1.5">
              {over.escapeOrder.map((name, i) => (
                <li key={`${name}-${i}`} className="flex items-center gap-2.5 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-800/80 text-teal-100 text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-amber-50 font-semibold flex-1">{name}</span>
                  <span className="text-teal-300/70 text-xs">escaped ✓</span>
                </li>
              ))}
              {!over.draw && over.bhabiName && (
                <li className="flex items-center gap-2.5 text-sm pt-1.5 mt-1 border-t border-emerald-800/50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-emerald-950 text-xs font-black shrink-0">
                    B
                  </span>
                  <span className="text-amber-100 font-semibold flex-1">{over.bhabiName}</span>
                  <span className="text-amber-200/60 text-xs">
                    Bhabi · {over.seats.find((s) => s.name === over.bhabiName)?.cardCount ?? 0} cards
                  </span>
                </li>
              )}
            </ol>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-300/30 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={rematch}
              disabled={busy}
              className="flex-1 rounded-2xl bg-amber-300 py-3.5 font-black text-emerald-950 transition hover:bg-amber-200 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> {busy ? '…' : 'Rematch'}
            </button>
          ) : (
            <p className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-emerald-100/60 flex items-center justify-center">
              Waiting for the host to call a rematch…
            </p>
          )}
          <button
            type="button"
            onClick={() => { clickSound(); online.leave(); navigate('/bhabi-thulla'); }}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 font-bold text-emerald-100/80 transition hover:border-amber-200/40 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Home size={18} /> New table
          </button>
        </div>

        <p className="mt-6 text-[11px] text-emerald-100/35">
          Played as <span className="text-amber-200/70 font-semibold">{nickname}</span> · Developed by{' '}
          <span className="text-amber-200/70 font-semibold">Zunair Qadeer</span>
        </p>
      </div>
    </div>
  );
}
