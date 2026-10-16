import { useState } from 'react';
import { BotDifficulty } from '@bhabi-thulla/game-engine';
import { TableConfig } from '../game/useTable';

interface Props {
  onStart: (config: TableConfig) => void;
}

export function HomeScreen({ onStart }: Props) {
  const [nickname, setNickname] = useState('');
  const [numSeats, setNumSeats] = useState(4);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');
  const [touched, setTouched] = useState(false);

  const name = nickname.trim();
  const valid = name.length >= 2 && name.length <= 24;

  return (
    <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-2">Zunair Qadeer Playground</p>
        <h1 className="text-5xl font-black text-amber-100 tracking-tight mb-1">Bhabi Thulla</h1>
        <p className="text-emerald-100/70 mb-8">The classic Pakistani card game — you versus the bots.</p>

        <div className="panel rounded-2xl p-6 text-left space-y-5">
          <div>
            <label htmlFor="nickname" className="block text-sm font-semibold text-emerald-100/90 mb-1.5">
              Your nickname
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={24}
              placeholder="e.g. Zunair"
              className="w-full rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-3 py-2.5 text-amber-50 placeholder:text-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300/70"
            />
            {touched && !valid && (
              <p className="text-red-300 text-xs mt-1">Nickname must be 2–24 characters.</p>
            )}
          </div>

          <div>
            <span className="block text-sm font-semibold text-emerald-100/90 mb-1.5">Seats at the table</span>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Seats">
              {[4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={numSeats === n}
                  onClick={() => setNumSeats(n)}
                  className={`rounded-lg py-2 font-bold transition ${
                    numSeats === n
                      ? 'bg-amber-300 text-emerald-950'
                      : 'bg-emerald-950/60 text-emerald-100/80 border border-emerald-700/50 hover:border-amber-300/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-emerald-100/50 text-xs mt-1.5">Empty seats are filled with clearly labelled bots.</p>
          </div>

          <div>
            <span className="block text-sm font-semibold text-emerald-100/90 mb-1.5">Bot difficulty</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Difficulty">
              {(['easy', 'normal'] as BotDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg py-2 font-bold capitalize transition ${
                    difficulty === d
                      ? 'bg-amber-300 text-emerald-950'
                      : 'bg-emerald-950/60 text-emerald-100/80 border border-emerald-700/50 hover:border-amber-300/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!valid}
            onClick={() => valid && onStart({ nickname: name, numSeats, difficulty })}
            className="w-full rounded-xl bg-amber-300 py-3 font-black text-emerald-950 text-lg tracking-wide transition hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Deal me in
          </button>
        </div>

        <p className="text-emerald-100/40 text-xs mt-6">Developed by Zunair Qadeer</p>
      </div>
    </div>
  );
}
