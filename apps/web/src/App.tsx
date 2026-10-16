import { useCallback, useEffect, useState } from 'react';
import { Match } from '@bhabi-thulla/game-engine';
import { TableConfig, useTable } from './game/useTable';
import { HomeScreen } from './components/HomeScreen';
import { TableScreen } from './components/TableScreen';
import { ResultsScreen } from './components/ResultsScreen';

type Screen = 'home' | 'table' | 'results';

function TableRoute({
  config,
  onFinish,
  onLeave,
}: {
  config: TableConfig;
  onFinish: (m: Match) => void;
  onLeave: () => void;
}) {
  const table = useTable(config);
  const finished = table.match.phase === 'finished';

  useEffect(() => {
    if (finished) {
      const id = window.setTimeout(() => onFinish(table.match), 1200);
      return () => window.clearTimeout(id);
    }
  }, [finished, onFinish, table.match]);

  return <TableScreen table={table} nickname={config.nickname} onLeave={onLeave} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [finalMatch, setFinalMatch] = useState<Match | null>(null);

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

  const goHome = useCallback(() => {
    setScreen('home');
    setFinalMatch(null);
  }, []);

  if (screen === 'table' && config) {
    return <TableRoute key={gameKey} config={config} onFinish={finish} onLeave={goHome} />;
  }
  if (screen === 'results' && finalMatch) {
    return <ResultsScreen match={finalMatch} onRematch={rematch} onHome={goHome} />;
  }
  return <HomeScreen onStart={start} />;
}
