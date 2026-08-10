import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { HiramekiDemoBanner } from '@/ui/components/HiramekiDemoBanner';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  isMatchSessionActive,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('HiramekiDemoBanner session ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    endMatchSession();
    const session = beginMatchSession('self');
    expect(commitMatchSession(session, createEmptyGameState())).toBe(true);
    useGameStateStore.setState({
      hiramekiDemoMode: 'completed',
      hiramekiDemoSelectedCardId: 'B04028',
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<HiramekiDemoBanner />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
  });

  it('ends the owned match session when the demo exits', () => {
    const exit = container.querySelector<HTMLButtonElement>('[data-testid="hirameki-demo-banner-exit"]');
    expect(exit).not.toBeNull();
    act(() => exit!.click());

    expect(isMatchSessionActive()).toBe(false);
    expect(useGameStateStore.getState()).toMatchObject({
      gameState: null,
      activeActionId: null,
      pendingHirameki: null,
      hiramekiDemoMode: 'idle',
      hiramekiDemoSelectedCardId: null,
    });
  });

  it('ends the previous session before returning to card selection', () => {
    const reset = container.querySelector<HTMLButtonElement>('[data-testid="hirameki-demo-banner-reset"]');
    expect(reset).not.toBeNull();
    act(() => reset!.click());

    expect(isMatchSessionActive()).toBe(false);
    expect(useGameStateStore.getState()).toMatchObject({
      gameState: null,
      activeActionId: null,
      pendingHirameki: null,
      hiramekiDemoMode: 'picking',
      hiramekiDemoSelectedCardId: null,
    });
  });
});
