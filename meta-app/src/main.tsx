import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/meta.css';

if (import.meta.env.DEV) {
  void import('@/ui/state/store').then(({ useGameStateStore }) => {
    (globalThis as unknown as { __metaGame?: unknown }).__metaGame = {
      getState: () => useGameStateStore.getState(),
    };
  });
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
