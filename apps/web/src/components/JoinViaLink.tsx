/**
 * JoinViaLink — landing for shared invite links (/bhabi-thulla/join/:code).
 * Shows the table code, asks for a nickname, and drops the player straight
 * into the lobby.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { online } from '../game/online';
import { clickSound, unlockAudio } from '../game/sound';
import { rememberRoom } from './OnlineRoom';

const NICK_KEY = 'bhabi.nickname';

export function loadNickname(): string {
  return localStorage.getItem(NICK_KEY) ?? '';
}

export function saveNickname(name: string): void {
  localStorage.setItem(NICK_KEY, name);
}

export function JoinViaLink() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(loadNickname());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = (code ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  const name = nickname.trim();
  const valid = name.length >= 2 && name.length <= 24 && cleanCode.length === 6;

  const join = async () => {
    if (!valid || busy) return;
    unlockAudio();
    clickSound();
    setBusy(true);
    setError(null);
    try {
      await online.join(name, cleanCode);
      saveNickname(name);
      rememberRoom(cleanCode, name);
      navigate(`/bhabi-thulla/online/${cleanCode}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the table.');
      setBusy(false);
    }
  };

  return (
    <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-2">You're invited</p>
        <h1 className="text-4xl font-black text-amber-100 mb-1">Join the table</h1>
        {cleanCode.length === 6 ? (
          <p className="text-emerald-100/70 mb-6">
            Table code <span className="font-mono font-black tracking-[0.25em] text-amber-200">{cleanCode}</span>
          </p>
        ) : (
          <p className="text-red-200/80 mb-6 text-sm">
            That invite link looks broken — ask your friend to send it again.
          </p>
        )}

        <div className="panel rounded-2xl p-6 text-left space-y-5">
          <div>
            <label htmlFor="invite-name" className="block text-xs font-black tracking-[0.18em] uppercase text-emerald-100/70 mb-1.5">
              Your player name
            </label>
            <input
              id="invite-name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
              placeholder="e.g. Zunair"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void join(); }}
              className="w-full rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-3 py-2.5 text-amber-50 placeholder:text-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300/70"
            />
          </div>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={join}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-300 py-3 font-black text-emerald-950 text-lg tracking-wide transition hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <KeyRound size={18} /> {busy ? 'Joining…' : 'Join table'}
          </button>
          {error && (
            <p className="text-red-200 text-xs leading-relaxed rounded-lg bg-red-950/50 border border-red-300/20 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <Link
          to="/bhabi-thulla"
          className="inline-block mt-6 text-emerald-100/60 text-sm font-semibold hover:text-amber-200"
        >
          ← Back to setup
        </Link>
        <p className="text-emerald-100/40 text-xs mt-4">Developed by Zunair Qadeer</p>
      </div>
    </div>
  );
}
