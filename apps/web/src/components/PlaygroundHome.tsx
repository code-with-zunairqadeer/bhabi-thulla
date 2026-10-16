import { Link } from 'react-router-dom';

const COMING_SOON = [
  { emoji: '🂠', blurb: 'A new table is being shuffled. Check back soon.' },
  { emoji: '🎴', blurb: 'Something devious is in the works. Stay tuned.' },
];

export function PlaygroundHome() {
  return (
    <div className="felt min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4">
        <p className="text-amber-200 font-black tracking-tight text-lg">🃏 Zunair's Playground</p>
        <p className="text-emerald-100/50 text-xs">Developed by Zunair Qadeer</p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-10">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-3">The arcade is open</p>
        <h1 className="text-5xl sm:text-6xl font-black text-amber-100 tracking-tight text-center mb-3">
          Zunair's <span className="text-amber-300">Playground</span>
        </h1>
        <p className="text-emerald-100/70 text-center max-w-md mb-10">
          A growing arcade of card games, built by hand. Pull up a chair — the first table is ready.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 w-full max-w-3xl">
          <Link
            to="/bhabi-thulla"
            className="panel rounded-2xl p-6 block transition hover:border-amber-300/60 hover:-translate-y-0.5"
          >
            <div className="text-4xl mb-3" aria-hidden>♠</div>
            <h2 className="text-xl font-black text-amber-100 mb-1">Bhabi Thulla</h2>
            <p className="text-emerald-100/60 text-sm mb-4">
              The classic Pakistani shedding game. You versus the bots — follow suit or Thulla!
            </p>
            <span className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 font-black text-emerald-950">
              Play now <span aria-hidden>→</span>
            </span>
            <span className="ml-3 text-teal-300 text-xs font-bold uppercase tracking-wider">Live</span>
          </Link>

          {COMING_SOON.map((g, i) => (
            <div key={i} className="panel rounded-2xl p-6 opacity-60">
              <div className="text-4xl mb-3" aria-hidden>{g.emoji}</div>
              <h2 className="text-xl font-black text-emerald-100/70 mb-1">Coming soon</h2>
              <p className="text-emerald-100/40 text-sm mb-4">{g.blurb}</p>
              <span className="inline-block rounded-xl border border-emerald-700/60 px-4 py-2 font-bold text-emerald-100/50 text-sm">
                Locked
              </span>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center pb-6 text-emerald-100/40 text-xs">
        Developed by Zunair Qadeer · more games on the way
      </footer>
    </div>
  );
}
