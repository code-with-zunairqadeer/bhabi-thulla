import { useState } from 'react';
import { Plus, KeyRound, Play, Bot, Wifi } from 'lucide-react';
import { BotDifficulty } from '@bhabi-thulla/game-engine';
import { TableConfig, SPEEDS } from '../game/useTable';
import { clickSound, unlockAudio } from '../game/sound';

interface Props {
  onStart: (config: TableConfig) => void;
  onHostLive: (name: string, seats: number) => void;
  onJoinLive: (name: string, code: string) => void;
  onlineBusy: boolean;
  onlineError: string | null;
}

type Tab = 'host' | 'join';

export function HomeScreen({ onStart, onHostLive, onJoinLive, onlineBusy, onlineError }: Props) {
  const [tab, setTab] = useState<Tab>('host');
  const [nickname, setNickname] = useState('');
  const [numSeats, setNumSeats] = useState(4);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);

  const name = nickname.trim();
  const valid = name.length >= 2 && name.length <= 24;

  const switchTab = (t: Tab) => {
    clickSound();
    setTab(t);
  };

  const dealIn = () => {
    if (!valid) return;
    unlockAudio();
    clickSound();
    onStart({ nickname: name, numSeats, difficulty, pace: SPEEDS.relaxed });
  };

  const hostLive = () => {
    if (!valid || onlineBusy) return;
    unlockAudio();
    clickSound();
    onHostLive(name, numSeats);
  };

  const joinLive = () => {
    if (!valid || code.length !== 6 || onlineBusy) return;
    unlockAudio();
    clickSound();
    onJoinLive(name, code);
  };

  return (
    <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-2">Zunair Qadeer Playground</p>
        <h1 className="text-5xl font-black text-amber-100 tracking-tight mb-1">Bhabi Thulla</h1>
        <p className="text-emerald-100/70 mb-8">Host a live table or enter a friend's code to play together.</p>

        {/* Host / Join tabs */}
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1 mb-5"
          role="tablist"
          aria-label="Table mode"
        >
          {(
            [
              ['host', 'Host New Table', <Plus key="i" size={15} />],
              ['join', 'Join with Code', <KeyRound key="i" size={15} />],
            ] as [Tab, string, React.ReactNode][]
          ).map(([t, label, icon]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition ${
                tab === t
                  ? 'bg-amber-300 text-emerald-950 shadow'
                  : 'text-emerald-100/70 hover:text-amber-100 hover:bg-white/5'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {tab === 'host' ? (
          <div className="panel rounded-2xl p-6 text-left space-y-5">
            <div>
              <label htmlFor="nickname" className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
                Your player name
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
              <span className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
                Total players
              </span>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Seats">
                {[4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={numSeats === n}
                    onClick={() => {
                      clickSound();
                      setNumSeats(n);
                    }}
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
              <p className="text-emerald-100/50 text-xs mt-1.5">
                {Math.floor(52 / numSeats)} cards each{52 % numSeats > 0 ? ` · ${52 % numSeats} sit out` : ''} · empty seats are bots.
              </p>
            </div>

            <div>
              <span className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
                Bot difficulty <span className="normal-case font-semibold text-emerald-100/40">(practice only)</span>
              </span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Difficulty">
                {(['easy', 'normal'] as BotDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => {
                      clickSound();
                      setDifficulty(d);
                    }}
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
              disabled={!valid || onlineBusy}
              onClick={hostLive}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-300 py-3 font-black text-emerald-950 text-lg tracking-wide transition hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <Wifi size={18} /> {onlineBusy ? 'Opening…' : 'Host Live Table'}
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={dealIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 font-bold text-emerald-100/75 text-sm transition hover:border-amber-200/40 hover:text-amber-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <Bot size={16} /> Practice vs bots instead
            </button>
            {onlineError && (
              <p className="text-red-200 text-xs leading-relaxed rounded-lg bg-red-950/50 border border-red-300/20 px-3 py-2">
                {onlineError}
              </p>
            )}
          </div>
        ) : (
          <div className="panel rounded-2xl p-6 text-left space-y-5">
            <div>
              <label htmlFor="join-name" className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
                Your player name
              </label>
              <input
                id="join-name"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={24}
                placeholder="e.g. Zunair"
                className="w-full rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-3 py-2.5 text-amber-50 placeholder:text-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300/70"
              />
            </div>
            <div>
              <label htmlFor="table-code" className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
                Table code
              </label>
              <input
                id="table-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="e.g. XK7Q2D"
                className="w-full rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-3 py-2.5 text-amber-50 placeholder:text-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300/70 tracking-[0.3em] font-mono"
              />
            </div>
            <button
              type="button"
              disabled={!valid || code.length !== 6 || onlineBusy}
              onClick={joinLive}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-300 py-3 font-black text-emerald-950 text-lg tracking-wide transition hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <KeyRound size={18} /> {onlineBusy ? 'Joining…' : 'Join Table'}
            </button>
            {onlineError ? (
              <p className="text-red-200 text-xs leading-relaxed rounded-lg bg-red-950/50 border border-red-300/20 px-3 py-2">
                {onlineError}
              </p>
            ) : (
              <p className="text-emerald-100/50 text-xs leading-relaxed rounded-lg bg-emerald-950/40 border border-emerald-700/30 px-3 py-2">
                Enter the 6-letter code your friend shared. You'll land in their lobby — ready up and the host deals.
              </p>
            )}
          </div>
        )}

        <p className="text-emerald-100/40 text-xs mt-6">Developed by Zunair Qadeer</p>
      </div>
    </div>
  );
}
