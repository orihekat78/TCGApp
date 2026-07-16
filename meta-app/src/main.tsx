import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/meta.css';
// Phase 11: src/ のエンジンを 5174 でも利用するためカード登録を起動時に実行
// (src/App.tsx と同じパターン — bundle 単位の副作用なので 5173 と独立)
import { registerAll } from '@/cards/index';
import { useGameStateStore } from '@/ui/state/store';

registerAll();

if (import.meta.env.DEV) {
  (globalThis as unknown as { __metaGame?: unknown }).__metaGame = {
    getState: () => useGameStateStore.getState(),
  };
}

// spec: .claude/specs/meta-ui/01-project-setup.md
const mount = document.getElementById('meta-root');
if (!mount) {
  throw new Error('meta-app: #meta-root not found in index.html');
}

createRoot(mount).render(
  <StrictMode>
    <App />
  </StrictMode>
);
