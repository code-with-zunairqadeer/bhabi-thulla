import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlaygroundHome } from './components/PlaygroundHome';
import { BhabiThullaGame } from './components/BhabiThullaGame';
import { TitleManager } from './components/TitleManager';

export default function App() {
  return (
    <BrowserRouter>
      <TitleManager />
      <Routes>
        <Route path="/" element={<PlaygroundHome />} />
        <Route path="/bhabi-thulla/*" element={<BhabiThullaGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
