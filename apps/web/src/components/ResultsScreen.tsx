import { Match } from '@bhabi-thulla/game-engine';

interface Props {
  match: Match;
  onRematch: () => void;
  onHome: () => void;
}

export function ResultsScreen({ match, onRematch, onHome }: Props) {
  const bhabiName = match.bhabi !== null ? match.seats[match.bhabi].name : null;
  const youAreBhabi = match.bhabi === 0;

  // Escape order from the event feed.
  const escapeOrder: string[] = [];
  for (const e of match.events) {
    const m = e.match(/^(.+) escapes!$/);
    if (m) escapeOrder.push(m[1]);
  }

  return (
    <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-2">Match over</p>
        {match.draw ? (
          <>
            <h1 className="text-4xl font-black text-amber-100 mb-1">Draw</h1>
            <p className="text-emerald-100/70 mb-6">Everyone emptied their hands together — no Bhabi this time.</p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-black text-amber-100 mb-1">
              {youAreBhabi ? 'You are the Bhabi!' : `${bhabiName} is the Bhabi`}
            </h1>
            <p className="text-emerald-100/70 mb-6">
              {youAreBhabi
                ? 'Last one holding cards. Better luck next deal.'
                : 'Last player holding cards takes the title.'}
            </p>
          </>
        )}

        <div className="panel rounded-2xl p-5 text-left mb-5">
          <h2 className="text-sm font-bold text-emerald-100/80 uppercase tracking-wider mb-3">Escape order</h2>
          {escapeOrder.length === 0 ? (
            <p className="text-emerald-100/50 text-sm">No escapes recorded.</p>
          ) : (
            <ol className="space-y-1.5">
              {escapeOrder.map((name, i) => (
                <li key={`${name}-${i}`} className="flex items-center gap-2.5 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-800/80 text-teal-100 text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-amber-50 font-semibold">{name}</span>
                  <span className="text-teal-300/70 text-xs">escaped ✓</span>
                </li>
              ))}
              {!match.draw && bhabiName && (
                <li className="flex items-center gap-2.5 text-sm pt-1 border-t border-emerald-800/50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-emerald-950 text-xs font-black shrink-0">
                    B
                  </span>
                  <span className="text-amber-100 font-bold">{bhabiName}</span>
                  <span className="text-amber-200/70 text-xs">Bhabi</span>
                </li>
              )}
            </ol>
          )}
          <p className="text-emerald-100/40 text-xs mt-3">{match.tricksPlayed} tricks played.</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 rounded-xl bg-amber-300 py-3 font-black text-emerald-950 transition hover:bg-amber-200"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onHome}
            className="flex-1 rounded-xl border border-emerald-700/60 bg-emerald-950/60 py-3 font-bold text-emerald-100 transition hover:border-amber-300/50"
          >
            Home
          </button>
        </div>

        <p className="text-emerald-100/40 text-xs mt-6">Developed by Zunair Qadeer</p>
      </div>
    </div>
  );
}
