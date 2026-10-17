/**
 * OnlineRoom — route component for /bhabi-thulla/online/:code. Subscribes to
 * the online client and renders lobby → table → results as the room evolves.
 * Survives a refresh: if the client is idle but a room is remembered, it
 * rejoins with the stored name and code.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { online } from '../game/online';
import { OnlineLobby } from './OnlineLobby';
import { OnlineTable } from './OnlineTable';
import { OnlineResults } from './OnlineResults';

const ROOM_KEY = 'bhabi.room';

export function rememberRoom(code: string, name: string): void {
  localStorage.setItem(ROOM_KEY, JSON.stringify({ code, name }));
}

export function forgetRoom(): void {
  localStorage.removeItem(ROOM_KEY);
}

export function OnlineRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const snap = useSyncExternalStore(online.subscribe, online.getSnapshot);
  const [rejoinError, setRejoinError] = useState<string | null>(null);

  // Refresh recovery: rejoin the remembered room.
  useEffect(() => {
    if (snap.status !== 'idle' || !code) return;
    const stored = localStorage.getItem(ROOM_KEY);
    if (!stored) {
      navigate('/bhabi-thulla', { replace: true });
      return;
    }
    try {
      const { code: storedCode, name } = JSON.parse(stored) as { code: string; name: string };
      if (storedCode.toUpperCase() !== code.toUpperCase()) {
        navigate('/bhabi-thulla', { replace: true });
        return;
      }
      online.join(name, code).catch((e: Error) => {
        setRejoinError(e.message);
        forgetRoom();
      });
    } catch {
      navigate('/bhabi-thulla', { replace: true });
    }
  }, [snap.status, code, navigate]);

  // Leaving anywhere clears the remembered room.
  useEffect(() => {
    if (snap.status === 'idle') forgetRoom();
  }, [snap.status]);

  const nickname =
    snap.room?.players.find((p) => p.guestId === snap.guestId)?.name ?? 'Player';

  if (rejoinError) {
    return (
      <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 text-center">
        <p className="text-amber-100 font-bold mb-2">Could not rejoin that table</p>
        <p className="text-emerald-100/60 text-sm mb-6">{rejoinError}</p>
        <button
          type="button"
          onClick={() => navigate('/bhabi-thulla')}
          className="rounded-2xl bg-amber-300 px-6 py-3 font-black text-emerald-950 transition hover:bg-amber-200 active:scale-95"
        >
          Back to setup
        </button>
      </div>
    );
  }

  if (snap.status === 'connecting' || snap.status === 'idle') {
    return (
      <div className="felt min-h-dvh flex items-center justify-center">
        <p className="text-emerald-100/60 text-sm animate-pulse">Connecting to the table…</p>
      </div>
    );
  }

  if (snap.status === 'error') {
    return (
      <div className="felt min-h-dvh flex flex-col items-center justify-center px-4 text-center">
        <p className="text-amber-100 font-bold mb-2">Connection trouble</p>
        <p className="text-emerald-100/60 text-sm mb-6">
          {snap.error ?? 'Could not reach the game server.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/bhabi-thulla')}
          className="rounded-2xl bg-amber-300 px-6 py-3 font-black text-emerald-950 transition hover:bg-amber-200 active:scale-95"
        >
          Back to setup
        </button>
      </div>
    );
  }

  if (snap.status === 'finished' && snap.over) {
    return <OnlineResults snap={snap} nickname={nickname} />;
  }

  if ((snap.status === 'playing' || snap.status === 'finished') && snap.game) {
    return <OnlineTable snap={snap} nickname={nickname} />;
  }

  return <OnlineLobby snap={snap} nickname={nickname} />;
}
