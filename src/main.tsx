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

if (import.meta.env.DEV || import.meta.env.VITE_E2E_BRIDGE === 'true') {
  (globalThis as unknown as { __game?: unknown }).__game = {
    store: useGameStateStore,
    getState: () => useGameStateStore.getState(),
    setGameState: (
      gs: ReturnType<typeof createSampleGameState>,
      options?: { preserveRuntime?: boolean },
    ) => useGameStateStore.getState().setGameState(gs, options),
    createSampleGameState,
    dispatch: dispatchEngineAction,
    flow: engine.flow,
    read: engine.read,
    cond: engine.cond,
    testApi: import('./e2e/test-api.js').then(({ e2eTestApi }) => e2eTestApi),
    getActionContext: (id: string) => {
      const state = useGameStateStore.getState().gameState;
      return state ? engine.flow.action._getContext(state, id) : undefined;
    },
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
