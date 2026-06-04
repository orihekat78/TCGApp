/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useGameStateStore } from './ui/state/store';
import { dispatchEngineAction } from './ui/hooks/useEngineDispatch';
import { createSampleGameState } from './ui/fixtures/sampleGameState';
import { useChoicePicker, useChoicePickerStore } from './ui/hooks/useChoicePicker';
import * as engine from './engine';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

if (import.meta.env.DEV) {
  (globalThis as unknown as { __game?: unknown }).__game = {
    store: useGameStateStore,
    getState: () => useGameStateStore.getState(),
    setGameState: (gs: ReturnType<typeof createSampleGameState>) =>
      useGameStateStore.setState({ gameState: gs }),
    createSampleGameState,
    dispatch: dispatchEngineAction,
    flow: engine.flow,
    read: engine.read,
    cond: engine.cond,
    getActionContext: (id: string) => engine.flow.action._getContext(id),
    // BUG-108: E2E が ChoicePickerModal の実 DOM render + option click を検証するための bridge。
    choicePicker: {
      ask: (req: Parameters<ReturnType<typeof useChoicePicker>['ask']>[0]) => useChoicePicker().ask(req),
      store: useChoicePickerStore,
    },
  };
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
