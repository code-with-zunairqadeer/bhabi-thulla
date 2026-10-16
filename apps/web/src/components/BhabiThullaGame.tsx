import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Match } from '@bhabi-thulla/game-engine';
import { TableConfig, useTable, GameSpeed, SPEEDS } from '../game/useTable';
import { HomeScreen } from './HomeScreen';
import { TableScreen } from './TableScreen';
import { ResultsScreen } from './ResultsScreen';

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
      const id = window.setTimeout(() => onFinish(table.match), 1200);
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

/** Bhabi Thulla inside the playground: setup → table → results. */
export function BhabiThullaGame() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [finalMatch, setFinalMatch] = useState<Match | null>(null);
  const [speed, setSpeed] = useState<GameSpeed>('relaxed');

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

  if (screen === 'table' && config) {
    return (
      <TableRoute
        key={gameKey}
        config={config}
        speed={speed}
        onSpeedChange={setSpeed}
        onFinish={finish}
        onLeave={goSetup}
        onRematch={rematch}
      />
    );
  }
  if (screen === 'results' && finalMatch) {
    return <ResultsScreen match={finalMatch} onRematch={rematch} onHome={goSetup} />;
  }
  return (
    <div>
      <div className="felt px-4 sm:px-6 pt-4">
        <Link to="/" className="text-emerald-100/70 text-sm font-semibold hover:text-amber-200">
          ← All games
        </Link>
      </div>
      <HomeScreen onStart={start} />
    </div>
  );
}
