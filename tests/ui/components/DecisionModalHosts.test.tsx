import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChooseInterceptModalHost } from '@/ui/components/ChooseInterceptModalHost';
import { SetCardReplacementModalHost } from '@/ui/components/SetCardReplacementModalHost';
import { SetCardChoiceModalHost } from '@/ui/components/SetCardChoiceModalHost';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type DecisionHost = typeof ChooseInterceptModalHost
  | typeof SetCardReplacementModalHost
  | typeof SetCardChoiceModalHost;

function gameState(hand: string[] = []) {
  return {
    players: {
      self: { hand, scene: [{ uid: 'host-1', cardId: 'B01001' }] },
      opp: { hand: [], scene: [] },
    },
  } as never;
}

function renderHost(Host: DecisionHost) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Host />));
  return { container, root };
}

function unmount(root: Root, container: HTMLDivElement): void {
  act(() => root.unmount());
  container.remove();
}

describe('decision modal hosts', () => {
  beforeEach(() => {
    useGameStateStore.setState({
      gameState: gameState(),
      pendingChooseIntercept: null,
      pendingSetCardReplacement: null,
      pendingSetCardChoice: null,
    });
    dispatchEngineActionMock.mockClear();
  });

  afterEach(() => {
    useGameStateStore.setState({
      pendingChooseIntercept: null,
      pendingSetCardReplacement: null,
      pendingSetCardChoice: null,
    });
  });

  it('keeps duplicate hand cards index-distinct and resolves the chosen discard index after details close', () => {
    useGameStateStore.setState({
      gameState: gameState(['B01001', 'B01001']),
      pendingChooseIntercept: {
        player: 'self',
        protector: { uid: 'protector-1', cardId: 'B01001', abilityId: 'a1' },
        targetUid: 'target-1',
      },
    });
    const { container, root } = renderHost(ChooseInterceptModalHost);

    const tiles = [...container.querySelectorAll<HTMLElement>('[data-instance-id]')];
    expect(tiles.map((tile) => tile.dataset.instanceId)).toEqual(['hand:self:0', 'hand:self:1']);
    expect(container.querySelectorAll('.selectable-card-tile img')).toHaveLength(2);
    expect(container.querySelector('button button')).toBeNull();
    const details = container.querySelectorAll<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(details).toHaveLength(2);
    act(() => details[1]!.click());
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="choose-intercept-modal"]')).not.toBeNull();

    act(() => (container.querySelector('[data-instance-id="hand:self:1"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'chooseInterceptResolve', discardIndex: 1 });
    unmount(root, container);
  });

  it('keeps the intercept decline available when the hand is empty', () => {
    useGameStateStore.setState({
      pendingChooseIntercept: {
        player: 'self',
        protector: { uid: 'protector-1', cardId: 'B01001', abilityId: 'a1' },
        targetUid: 'target-1',
      },
    });
    const { container, root } = renderHost(ChooseInterceptModalHost);

    expect(container.querySelectorAll('[data-instance-id]')).toHaveLength(0);
    act(() => (container.querySelector('[data-testid="choose-intercept-decline"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'chooseInterceptResolve', discardIndex: null });
    unmount(root, container);
  });

  it('resolves a set-card replacement from its native candidate selector and keeps details in the pending modal', () => {
    useGameStateStore.setState({
      pendingSetCardReplacement: {
        player: 'self', fromUid: 'from-1', setCardInstanceId: 'set-1',
        candidates: [{ uid: 'candidate-1', cardId: 'B01001' }],
        source: { uid: 'source-1' } as never,
      },
    });
    const { container, root } = renderHost(SetCardReplacementModalHost);

    const candidate = container.querySelector<HTMLButtonElement>('[data-testid="set-card-replacement-candidate-1"]');
    expect(candidate).toBeInstanceOf(HTMLButtonElement);
    expect(container.querySelector('.selectable-card-tile img')).not.toBeNull();
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(detail).not.toBeNull();
    act(() => detail!.click());
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    act(() => (container.querySelector('.card-expand-close') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="set-card-replacement-modal"]')).not.toBeNull();

    act(() => candidate!.click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'setCardReplacementResolve', targetUid: 'candidate-1' });
    unmount(root, container);

    dispatchEngineActionMock.mockClear();
    useGameStateStore.setState({
      pendingSetCardReplacement: {
        player: 'self', fromUid: 'from-1', setCardInstanceId: 'set-1', candidates: [], source: { uid: 'source-1' } as never,
      },
    });
    const empty = renderHost(SetCardReplacementModalHost);
    act(() => (empty.container.querySelector('[data-testid="set-card-replacement-decline"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'setCardReplacementResolve', targetUid: null });
    unmount(empty.root, empty.container);
  });

  it('renders set-card choices as opaque ordinal tiles and resolves only the selected instance id', () => {
    useGameStateStore.setState({
      gameState: {
        players: {
          self: { hand: [], scene: [{ uid: 'host-1', cardId: 'HOST-SECRET-ID' }] },
          opp: { hand: [], scene: [] },
        },
      } as never,
      pendingSetCardChoice: {
        player: 'self', hostUid: 'host-1',
        entries: [{ instanceId: 'set-instance-1', ordinal: 1 }, { instanceId: 'set-instance-2', ordinal: 2 }],
        source: { uid: 'source-1', cardId: 'SET-SECRET-ID' } as never,
      },
    });
    const { container, root } = renderHost(SetCardChoiceModalHost);

    const html = container.innerHTML;
    expect(container.querySelectorAll('.selectable-card-tile--hidden')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="selectable-card-tile-detail"]')).toHaveLength(0);
    expect(html).not.toContain('HOST-SECRET-ID');
    expect(html).not.toContain('SET-SECRET-ID');
    expect(html).not.toContain('cardId');
    expect([...container.querySelectorAll<HTMLElement>('[aria-label]')].map((element) => element.getAttribute('aria-label')).join(' ')).not.toContain('SECRET');
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(0);
    const choices = [...container.querySelectorAll<HTMLButtonElement>('button[data-testid^="set-card-choice-"]')];
    expect(choices.map((choice) => choice.getAttribute('aria-label'))).toEqual(['Set card 1 を選択', 'Set card 2 を選択']);
    expect(choices.map((choice) => choice.dataset.instanceId)).toEqual(['set-instance-1', 'set-instance-2']);
    expect(choices.every((choice) => choice.querySelector('img.card-art.selectable-card-tile__back-art') !== null)).toBe(true);
    expect(choices.every((choice) => choice.querySelector('img')?.getAttribute('src')?.startsWith('data:image/svg+xml') === true)).toBe(true);
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
    act(() => (container.querySelector('[data-instance-id="set-instance-2"]') as HTMLButtonElement).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'setCardChoiceResolve', instanceId: 'set-instance-2' });
    unmount(root, container);
  });
});
