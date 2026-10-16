import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useTable } from './game/useTable';
import { HomeScreen } from './components/HomeScreen';
import { TableScreen } from './components/TableScreen';
import { ResultsScreen } from './components/ResultsScreen';
function TableRoute({ config, onFinish, onLeave, }) {
    const table = useTable(config);
    const finished = table.match.phase === 'finished';
    useEffect(() => {
        if (finished) {
            const id = window.setTimeout(() => onFinish(table.match), 1200);
            return () => window.clearTimeout(id);
        }
    }, [finished, onFinish, table.match]);
    return _jsx(TableScreen, { table: table, nickname: config.nickname, onLeave: onLeave });
}
export default function App() {
    const [screen, setScreen] = useState('home');
    const [config, setConfig] = useState(null);
    const [gameKey, setGameKey] = useState(0);
    const [finalMatch, setFinalMatch] = useState(null);
    const start = useCallback((c) => {
        setConfig(c);
        setFinalMatch(null);
        setGameKey((k) => k + 1);
        setScreen('table');
    }, []);
    const finish = useCallback((m) => {
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
        return _jsx(TableRoute, { config: config, onFinish: finish, onLeave: goHome }, gameKey);
    }
    if (screen === 'results' && finalMatch) {
        return _jsx(ResultsScreen, { match: finalMatch, onRematch: rematch, onHome: goHome });
    }
    return _jsx(HomeScreen, { onStart: start });
}
