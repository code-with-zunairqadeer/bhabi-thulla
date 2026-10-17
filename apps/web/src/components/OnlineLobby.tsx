/**
 * OnlineLobby — the pre-game room. Big shareable code, player list with
 * ready states, host settings (seats / pace / bot fill), ready-up and start.
 */
import { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Turtle,
  Rabbit,
  Zap,
  Users,
} from 'lucide-react';
import type { Pace } from '@bhabi-thulla/protocol';
import { online, type OnlineSnapshot } from '../game/online';
import { clickSound } from '../game/sound';

const PACE_META: { id: Pace; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'relaxed', label: 'Relaxed', icon: <Turtle size={16} />, hint: 'Slow & social' },
  { id: 'normal', label: 'Normal', icon: <Rabbit size={16} />, hint: 'Steady' },
  { id: 'fast', label: 'Fast', icon: <Zap size={16} />, hint: 'Quick' },
];

export function OnlineLobby({ snap, nickname }: { snap: OnlineSnapshot; nickname: string }) {
  const room = snap.room;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!room) return null;
  const me = room.players.find((p) => p.guestId === snap.guestId);
  const isHost = room.hostGuestId === snap.guestId;
  const allReady = room.players.every((p) => p.ready || !p.connected);
  const botSeats = Math.max(0, room.settings.seats - room.players.length);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    clickSound();
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      /* clipboard unavailable — the code is still visible */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="felt min-h-dvh flex flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md">
        <p className="text-teal-300/80 text-xs tracking-[0.3em] uppercase mb-1 text-center">
          Table lobby
        </p>
        <h1 className="text-3xl font-black text-amber-100 text-center mb-5">
          {isHost ? 'Your table is open' : `${room.players.find((p) => p.guestId === room.hostGuestId)?.name ?? 'Host'}'s table`}
        </h1>

        {/* Room code */}
        <button
          type="button"
          onClick={copyCode}
          title="Copy room code"
          className="w-full panel rounded-2xl p-5 mb-5 text-center transition hover:border-amber-200/40 active:scale-[0.99]"
        >
          <p className="text-emerald-100/60 text-xs uppercase tracking-widest mb-1">
            Share this code with your friends
          </p>
          <p className="text-4xl font-black tracking-[0.25em] text-amber-200">{room.code}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100/60">
            {copied ? <Check size={14} className="text-teal-300" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Tap to copy'}
          </p>
        </button>

        {/* Players */}
        <div className="panel rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-bold text-emerald-100/80 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users size={15} /> Players ({room.players.length}/{room.settings.seats})
          </h2>
          <ul className="space-y-2">
            {room.players.map((p) => (
              <li
                key={p.guestId}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                  p.connected ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/20 opacity-50'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-800 to-emerald-950 font-black text-amber-100 ring-1 ring-amber-200/30">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-amber-50 truncate">
                    {p.name}
                    {p.guestId === snap.guestId && (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-teal-300">you</span>
                    )}
                  </span>
                  <span className="block text-xs text-emerald-100/50">
                    {!p.connected ? 'reconnecting…' : p.ready ? 'ready ✓' : 'not ready'}
                  </span>
                </span>
                {p.guestId === room.hostGuestId && (
                  <Crown size={16} className="text-amber-300 shrink-0" aria-label="Host" />
                )}
                {p.ready && p.connected && (
                  <Check size={16} className="text-teal-300 shrink-0" aria-label="Ready" />
                )}
              </li>
            ))}
            {botSeats > 0 && room.settings.botFill && (
              <li className="text-xs text-emerald-100/45 px-1">
                + {botSeats} bot{botSeats === 1 ? '' : 's'} will fill the empty seat{botSeats === 1 ? '' : 's'}.
              </li>
            )}
          </ul>
        </div>

        {/* Host settings */}
        {isHost && (
          <div className="panel rounded-2xl p-5 mb-5">
            <h2 className="text-sm font-bold text-emerald-100/80 uppercase tracking-wider mb-3">
              Table settings
            </h2>
            <p className="text-xs text-emerald-100/50 mb-1.5">Seats</p>
            <div className="grid grid-cols-4 gap-2 mb-4" role="radiogroup" aria-label="Seats">
              {[4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={room.settings.seats === n}
                  disabled={busy}
                  onClick={() => { clickSound(); void run(() => online.updateSettings({ seats: n })); }}
                  className={`rounded-xl py-2.5 text-sm font-black transition active:scale-95 disabled:opacity-50 ${
                    room.settings.seats === n
                      ? 'bg-amber-300 text-emerald-950 shadow'
                      : 'border border-white/10 bg-white/5 text-emerald-100/70 hover:border-amber-200/40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-emerald-100/50 mb-1.5">Pace</p>
            <div className="grid grid-cols-3 gap-2 mb-4" role="radiogroup" aria-label="Pace">
              {PACE_META.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={room.settings.pace === p.id}
                  disabled={busy}
                  onClick={() => { clickSound(); void run(() => online.updateSettings({ pace: p.id })); }}
                  className={`rounded-xl py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-50 flex flex-col items-center gap-0.5 ${
                    room.settings.pace === p.id
                      ? 'bg-amber-300 text-emerald-950 shadow'
                      : 'border border-white/10 bg-white/5 text-emerald-100/70 hover:border-amber-200/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5">{p.icon}{p.label}</span>
                  <span className={`text-[10px] font-semibold ${room.settings.pace === p.id ? 'text-emerald-900/70' : 'text-emerald-100/40'}`}>{p.hint}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-semibold text-emerald-100/80">
                Fill empty seats with bots
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={room.settings.botFill}
                disabled={busy}
                onClick={() => { clickSound(); void run(() => online.updateSettings({ botFill: !room.settings.botFill })); }}
                className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${
                  room.settings.botFill ? 'bg-amber-300' : 'bg-white/10 border border-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    room.settings.botFill ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-xl border border-red-300/30 bg-red-950/50 px-4 py-2.5 text-sm text-red-200 text-center">
            {error}
          </p>
        )}

        {/* Actions */}
        {isHost ? (
          <button
            type="button"
            disabled={busy || !allReady}
            onClick={() => { clickSound(); void run(() => online.startMatch()); }}
            className="w-full rounded-2xl bg-amber-300 py-4 text-lg font-black text-emerald-950 shadow-[0_0_24px_rgba(252,211,77,0.35)] transition hover:bg-amber-200 active:scale-[0.99] disabled:opacity-40 disabled:saturate-50 flex items-center justify-center gap-2"
          >
            <Play size={20} /> {busy ? 'Starting…' : allReady ? 'Deal the cards' : 'Waiting for ready-ups…'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => { clickSound(); void run(() => online.setReady(!me?.ready)); }}
            className={`w-full rounded-2xl py-4 text-lg font-black transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 ${
              me?.ready
                ? 'border border-white/15 bg-white/5 text-emerald-100/80 hover:border-amber-200/40'
                : 'bg-amber-300 text-emerald-950 shadow-[0_0_24px_rgba(252,211,77,0.35)] hover:bg-amber-200'
            }`}
          >
            <Check size={20} /> {me?.ready ? "Not ready after all" : "I'm ready!"}
          </button>
        )}

        <button
          type="button"
          onClick={() => { clickSound(); online.leave(); }}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-emerald-100/70 transition hover:border-red-300/40 hover:text-red-200 active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Leave table
        </button>

        <p className="mt-6 text-center text-[11px] text-emerald-100/35">
          Playing as <span className="text-amber-200/70 font-semibold">{nickname}</span> · Developed by{' '}
          <span className="text-amber-200/70 font-semibold">Zunair Qadeer</span>
        </p>
      </div>
    </div>
  );
}
