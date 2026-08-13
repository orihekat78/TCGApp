import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import type { PendingEffectPickSide } from '@/engine/effect/pending-state';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({
  dispatchEngineAction: dispatchEngineActionMock,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function pending(forcedUids: string[], nMax: number): PendingEffectPickSide {
  return {
    player: 'self',
    candidates: [
      { uid: 'forced-1', cardId: 'FORCED_1', player: 'opp', kind: 'char' },
      { uid: 'forced-2', cardId: 'FORCED_2', player: 'opp', kind: 'char' },
      { uid: 'plain', cardId: 'PLAIN', player: 'opp', kind: 'char' },
    ],
    atomVerb: 'charSetCard',
    atomArgs: {},
    nMin: 1,
    nMax,
    source: { cardId: 'EVENT', abilityId: 'a1' },
    forcedUids,
  };
}

describe('EffectPickerModal forced candidate cardinality', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    dispatchEngineActionMock.mockClear();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      spectatorMode: false,
      pendingEffectPick: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('locks the required candidate but keeps an ordinary candidate available for the spare slot', () => {
    act(() => {
      useGameStateStore.setState({ pendingEffectPick: pending(['forced-1'], 2) });
      root.render(<EffectPickerModal />);
    });

    const forced = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-forced-1"]')!;
    const plain = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-plain"]')!;
    expect(forced.getAttribute('aria-pressed')).toBe('true');
    expect(plain.disabled).toBe(false);

    act(() => plain.click());
    expect(plain.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="effect-picker-confirm"]')!.disabled).toBe(false);
  });

  it('allows either forced candidate when only one can be selected and blocks ordinary candidates', () => {
    act(() => {
      useGameStateStore.setState({ pendingEffectPick: pending(['forced-1', 'forced-2'], 1) });
      root.render(<EffectPickerModal />);
    });

    const forced1 = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-forced-1"]')!;
    const forced2 = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-forced-2"]')!;
    const plain = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-plain"]')!;
    expect(forced1.disabled).toBe(false);
    expect(forced2.disabled).toBe(false);
    expect(plain.disabled).toBe(true);

    act(() => forced2.click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({
      type: 'effectPickResolve',
      pickedUid: 'forced-2',
    });
  });

  it('renders the generic multi-picker for a real sceneRemove continuation', () => {
    act(() => {
      useGameStateStore.setState({
        pendingEffectPick: { ...pending(['forced-1'], 2), atomVerb: 'sceneRemove' },
      });
      root.render(<EffectPickerModal />);
    });

    expect(container.querySelector('[data-testid="effect-picker-modal"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="effect-pick-cand-forced-1"]')).not.toBeNull();
  });
});
