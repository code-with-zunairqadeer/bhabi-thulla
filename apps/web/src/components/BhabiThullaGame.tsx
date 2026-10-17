import { useCallback, useState } from 'react';
import { Link, Routes, Route, useNavigate } from 'react-router-dom';
import { Match } from '@bhabi-thulla/game-engine';
import { TableConfig, useTable, GameSpeed, SPEEDS } from '../game/useTable';
import { online } from '../game/online';
import { unlockAudio } from '../game/sound';
import { HomeScreen } from './HomeScreen';
import { TableScreen } from './TableScreen';
import { ResultsScreen } from './ResultsScreen';
import { OnlineRoom, rememberRoom } from './OnlineRoom';
import { useEffect } from 'react';

type Screen = 'setup' | 'table' | 'results';

function TableRoute({
  config,
  speed,
  onSpeedChange,
  onFinish,
  onLeave,
  onRematch,
}: {
  config: TableConfig;
  speed: GameSpeed;
  onSpeedChange: (s: GameSpeed) => void;
  onFinish: (m: Match) => void;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const table = useTable({ ...config, pace: SPEEDS[speed] });
  const finished = table.match.phase === 'finished';

  useEffect(() => {
    if (finished) {
      // TableRoute is only used with the local useTable, whose match really
      // is an engine Match (TableState types it as the structural MatchView).
      const id = window.setTimeout(() => onFinish(table.match as Match), 1200);
      return () => window.clearTimeout(id);
    }
  }, [finished, onFinish, table.match]);

  return (
    <TableScreen
      table={table}
      nickname={config.nickname}
      speed={speed}
      onSpeedChange={onSpeedChange}
      onLeave={onLeave}
      onRematch={onRematch}
    />
  );
}

/** Bhabi Thulla inside the playground: setup → table → results, plus online rooms. */
export function BhabiThullaGame() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [finalMatch, setFinalMatch] = useState<Match | null>(null);
  const [speed, setSpeed] = useState<GameSpeed>('relaxed');
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const navigate = useNavigate();

  const start = useCallback((c: TableConfig) => {
    setConfig(c);
    setFinalMatch(null);
    setGameKey((k) => k + 1);
    setScreen('table');
  }, []);

  const finish = useCallback((m: Match) => {
    setFinalMatch(m);
    setScreen('results');
  }, []);

  const rematch = useCallback(() => {
    setFinalMatch(null);
    setGameKey((k) => k + 1);
    setScreen('table');
  }, []);

  const goSetup = useCallback(() => {
    setScreen('setup');
    setFinalMatch(null);
  }, []);

  const hostLive = useCallback(
    async (name: string, seats: number) => {
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        unlockAudio();
        const code = await online.host(name, { seats, pace: 'relaxed', botFill: true });
        rememberRoom(code, name);
        navigate(`online/${code}`);
      } catch (e) {
        setOnlineError(e instanceof Error ? e.message : 'Could not open the table.');
      } finally {
        setOnlineBusy(false);
      }
    },
    [navigate],
  );

  const joinLive = useCallback(
    async (name: string, code: string) => {
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        unlockAudio();
        await online.join(name, code);
        rememberRoom(code.toUpperCase(), name);
        navigate(`online/${code.toUpperCase()}`);
      } catch (e) {
        setOnlineError(e instanceof Error ? e.message : 'Could not join the table.');
      } finally {
        setOnlineBusy(false);
      }
    },
    [navigate],
  );

  return (
    <Routes>
      <Route path="online/:code" element={<OnlineRoom />} />
      <Route
        path="*"
        element={
          screen === 'table' && config ? (
            <TableRoute
              key={gameKey}
              config={config}
              speed={speed}
              onSpeedChange={setSpeed}
              onFinish={finish}
              onLeave={goSetup}
              onRematch={rematch}
            />
          ) : screen === 'results' && finalMatch ? (
            <ResultsScreen match={finalMatch} onRematch={rematch} onHome={goSetup} />
          ) : (
            <div>
              <div className="felt px-4 sm:px-6 pt-4">
                <Link
                  to="/"
                  className="text-emerald-100/70 text-sm font-semibold hover:text-amber-200"
                >
                  ← All games
                </Link>
              </div>
              <HomeScreen
                onStart={start}
                onHostLive={hostLive}
                onJoinLive={joinLive}
                onlineBusy={onlineBusy}
                onlineError={onlineError}
              />
            </div>
          )
        }
      />
    </Routes>
  );
}
