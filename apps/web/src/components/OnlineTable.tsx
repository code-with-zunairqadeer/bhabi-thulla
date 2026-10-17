/**
 * OnlineTable — the approved table UI, driven by the server. The
 * useOnlineTable adapter rotates seats so "me" is seat 0, so TableScreen
 * renders a live game exactly like a practice table.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableScreen } from './TableScreen';
import { useOnlineTable } from '../game/useOnlineTable';
import { online, type OnlineSnapshot } from '../game/online';
import type { GameSpeed } from '../game/useTable';

export function OnlineTable({ snap, nickname }: { snap: OnlineSnapshot; nickname: string }) {
  const navigate = useNavigate();
  const table = useOnlineTable(snap);
  const [pace] = useState<GameSpeed>((snap.game?.pace as GameSpeed) ?? 'relaxed');

  useEffect(() => {
    if (snap.status === 'idle') navigate('/bhabi-thulla', { replace: true });
  }, [snap.status, navigate]);

  if (!snap.game || !table) {
    return (
      <div className="felt min-h-dvh flex items-center justify-center">
        <p className="text-emerald-100/60 text-sm animate-pulse">Joining the table…</p>
      </div>
    );
  }

  return (
    <TableScreen
      table={table}
      nickname={nickname}
      speed={pace}
      onSpeedChange={() => {}}
      onLeave={() => online.leave()}
      onRematch={() => {}}
      online
    />
  );
}
