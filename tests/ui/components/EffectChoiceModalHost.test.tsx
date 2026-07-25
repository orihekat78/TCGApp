import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectChoiceModalHost } from '@/ui/components/EffectChoiceModalHost';
import { createEmptyGameState } from '@/engine/state-factory';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EffectChoiceModalHost B04030 full-scene switch', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const gameState = createEmptyGameState();
    gameState.players.self.scene = Array.from({ length: 5 }, (_, index) => ({
      uid: `scene-${index}`, cardId: `C${index}`, state: 'active' as const, isNamed: false,
      enterOrder: index, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }));
    useGameStateStore.setState({
      gameState,
      pendingEffectChoice: {
        player: 'self', source: { player: 'self', area: 'scene', cardId: 'B04030', uid: 'kaito', abilityId: 'a1' },
        options: [{ index: 0, label: 'hand' }, { index: 1, label: 'enter', sceneEnter: true }],
      },
    });
    useSceneSwitchPickerStore.getState()._close();
    dispatchEngineActionMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('hides its full-screen choice overlay while the selected B04030 enter waits for a switch victim', async () => {
    act(() => { root.render(<EffectChoiceModalHost />); });
    const enter = container.querySelector<HTMLButtonElement>('[data-testid="cp-opt-1"]')!;

    await act(async () => { enter.click(); });

    expect(useSceneSwitchPickerStore.getState().current?.candidates).toHaveLength(5);
    expect(container.querySelector('[data-testid="choice-picker-modal"]')).toBeNull();
  });

  it.each(['B07079', 'B09047', 'B05062'])('does not open a switch before %s choice resolves', async (cardId) => {
    useGameStateStore.setState({
      pendingEffectChoice: {
        player: 'self', source: { player: 'self', area: 'scene', cardId, uid: 'other', abilityId: 'a1' },
        options: [{ index: 0, label: 'nested enter', sceneEnter: true }],
      },
    });
    act(() => { root.render(<EffectChoiceModalHost />); });

    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cp-opt-0"]')!.click(); });

    expect(useSceneSwitchPickerStore.getState().current).toBeNull();
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'choiceResolve', choiceIndex: 0 });
  });
});
