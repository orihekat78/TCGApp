import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { CardExpandModal } from '@/ui/components/CardExpandModal';
import { CardListModal } from '@/ui/components/CardListModal';
import { ChoicePickerModal } from '@/ui/components/ChoicePickerModal';
import { ChooseInterceptModalHost } from '@/ui/components/ChooseInterceptModalHost';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { CutInDisguisePickerModal } from '@/ui/components/CutInDisguisePickerModal';
import { DeckPlaceModalHost } from '@/ui/components/DeckPlaceModalHost';
import { EffectOptionalModalHost } from '@/ui/components/EffectOptionalModalHost';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { LogPanel } from '@/ui/components/LogPanel';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { _resetMulliganStore, useMulliganStore } from '@/ui/hooks/useMulligan';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({
  dispatchEngineAction: dispatchEngineActionMock,
  surfacePendingSideChannels: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type OwnerFixture = {
  node: ReactNode;
  rootSelector: string;
  initialFocusSelector?: string;
  keyEventTarget?: 'document' | 'window';
  escapeCalls: ReadonlyArray<[Mock, number]>;
};

type OwnerCase = {
  name: string;
  create: () => OwnerFixture;
};

const owners: readonly OwnerCase[] = [
  {
    name: 'CardExpandModal',
    create: () => {
      const onClose = vi.fn();
      return {
        node: <CardExpandModal cardId="D08015" onClose={onClose} />,
        rootSelector: '.card-expand-modal-backdrop',
        initialFocusSelector: '.card-expand-close',
        keyEventTarget: 'window',
        escapeCalls: [[onClose, 1]],
      };
    },
  },
  {
    name: 'CardListModal',
    create: () => {
      const onClose = vi.fn();
      return {
        node: <CardListModal kind="deck" side="self" cards={['D08003']} onClose={onClose} />,
        rootSelector: '.card-list-modal-backdrop',
        initialFocusSelector: '.card-list-modal-close',
        escapeCalls: [[onClose, 1]],
      };
    },
  },
  {
    name: 'ChoicePickerModal',
    create: () => {
      const onCancel = vi.fn();
      return {
        node: <ChoicePickerModal open sourceName="Choice" options={[{ index: 0, label: 'Pick' }]} onPick={vi.fn()} onCancel={onCancel} />,
        rootSelector: '[data-testid="choice-picker-modal"]',
        escapeCalls: [[onCancel, 1]],
      };
    },
  },
  {
    name: 'ChooseInterceptModalHost',
    create: () => {
      useGameStateStore.setState({
        gameState: { players: { self: { hand: ['D08003'], scene: [] }, opp: { hand: [], scene: [] } } } as never,
        pendingChooseIntercept: {
          player: 'self', protector: { uid: 'protector-1', cardId: 'B01001', abilityId: 'a1' }, targetUid: 'target-1',
        } as never,
      });
      return {
        node: <ChooseInterceptModalHost />,
        rootSelector: '[data-testid="choose-intercept-modal"]',
        escapeCalls: [[dispatchEngineActionMock, 0]],
      };
    },
  },
  {
    name: 'ConfirmModal',
    create: () => {
      const onReject = vi.fn();
      return {
        node: <ConfirmModal current={{ kind: 'standard', title: 'Confirm', body: 'Body', okLabel: 'OK', cancelLabel: 'Cancel' }} onAccept={vi.fn()} onReject={onReject} />,
        rootSelector: '.confirm-modal-backdrop',
        initialFocusSelector: '.confirm-ok',
        escapeCalls: [[onReject, 1]],
      };
    },
  },
  {
    name: 'CutInDisguisePickerModal',
    create: () => ({
      node: <CutInDisguisePickerModal open actorLabel="1番目" candidates={[{ uid: 'D08015#0', cardId: 'D08015', name: 'Cut-in', kind: 'cutin' }]} onPickCutIn={vi.fn()} onPickDisguise={vi.fn()} onPass={vi.fn()} />,
      rootSelector: '[data-testid="cid-picker-modal"]',
      initialFocusSelector: '[data-testid="cid-cutin-D08015#0"]',
      escapeCalls: [[dispatchEngineActionMock, 0]],
    }),
  },
  {
    name: 'DeckPlaceModalHost',
    create: () => {
      useGameStateStore.setState({ pendingDeckPlace: { ownerPlayer: 'self', cardIds: ['D08003'] } as never });
      return {
        node: <DeckPlaceModalHost />,
        rootSelector: '[data-testid="deck-place-modal"]',
        escapeCalls: [[dispatchEngineActionMock, 0]],
      };
    },
  },
  {
    name: 'EffectOptionalModalHost',
    create: () => {
      useGameStateStore.setState({ pendingEffectOptional: { player: 'self', source: { uid: 'source-1', cardId: 'D08003', abilityId: 'a1' } } as never });
      return {
        node: <EffectOptionalModalHost />,
        rootSelector: '[data-testid="optional-picker-modal"]',
        escapeCalls: [[dispatchEngineActionMock, 0]],
      };
    },
  },
  {
    name: 'EffectPickerModal',
    create: () => {
      const gameState = createEmptyGameState();
      gameState.players.self.evidence = [{ cardId: 'D08015', faceUp: true, origin: { turn: 1, via: 'reasoning' } }];
      useGameStateStore.setState({
        gameState,
        pendingEffectPick: {
          player: 'self', candidates: [{ uid: 'evidence:self:0', cardId: 'D08015', player: 'self' }],
          atomVerb: 'charSetCard', atomArgs: {}, nMin: 1, nMax: 1, source: { cardId: 'B04026', abilityId: 'a1' },
        } as never,
      });
      return {
        node: <EffectPickerModal />,
        rootSelector: '[data-testid="effect-picker-modal"]',
        escapeCalls: [[dispatchEngineActionMock, 0]],
      };
    },
  },
  {
    name: 'GameSetupModal',
    create: () => ({
      node: <GameSetupModal />,
      rootSelector: '.game-setup-modal-overlay',
      escapeCalls: [[dispatchEngineActionMock, 0]],
    }),
  },
  {
    name: 'LogPanel',
    create: () => {
      const onClose = vi.fn();
      return {
        node: <LogPanel entries={[]} open onClose={onClose} />,
        rootSelector: '.log-panel.open',
        initialFocusSelector: '.log-panel-close',
        escapeCalls: [[onClose, 1]],
      };
    },
  },
  {
    name: 'MulliganModal',
    create: () => {
      const resolve = vi.fn();
      useMulliganStore.getState()._setResolver(resolve);
      useMulliganStore.getState()._setCurrent({ player: 'self', hand: ['D08015'] });
      return {
        node: <MulliganModal />,
        rootSelector: '.mulligan-modal-backdrop',
        initialFocusSelector: '.mulligan-skip',
        keyEventTarget: 'window',
        escapeCalls: [[resolve, 1]],
      };
    },
  },
];

function pressTab(target: 'document' | 'window', shiftKey = false): void {
  const eventTarget = target === 'window'
    ? window
    : document.activeElement instanceof HTMLElement ? document.activeElement : document;
  act(() => eventTarget.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', shiftKey, bubbles: true, cancelable: true,
  })));
}

function pressEscape(target: 'document' | 'window'): void {
  const eventTarget = target === 'window'
    ? window
    : document.activeElement instanceof HTMLElement ? document.activeElement : document;
  act(() => eventTarget.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, cancelable: true,
  })));
}

describe('remaining live MATCH modal owner focus contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    dispatchEngineActionMock.mockClear();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    useGameStateStore.setState({
      gameState: null,
      spectatorMode: false,
      hiramekiDemoMode: 'idle',
      cutinDemoMode: 'idle',
      pendingChooseIntercept: null,
      pendingDeckPlace: null,
      pendingEffectOptional: null,
      pendingEffectPick: null,
      pendingPublicHandReveal: null,
    });
    _resetMulliganStore();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    _resetMulliganStore();
    useGameStateStore.setState({
      gameState: null,
      pendingChooseIntercept: null,
      pendingDeckPlace: null,
      pendingEffectOptional: null,
      pendingEffectPick: null,
      pendingPublicHandReveal: null,
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it.each(owners)('$name registers, initially focuses, traps both Tab directions through MatchMenu, and preserves Escape semantics', async ({ create }) => {
    const fixture = create();
    act(() => root.render(
      <>
        {fixture.node}
        <button type="button" data-match-menu-trigger="true" data-testid="persistent-match-menu-trigger">Menu</button>
      </>,
    ));
    await act(async () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

    const dialog = container.querySelector<HTMLElement>(fixture.rootSelector);
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="persistent-match-menu-trigger"]');
    expect(dialog).toBeInstanceOf(HTMLElement);
    expect(trigger).toBeInstanceOf(HTMLButtonElement);
    expect(dialog?.getAttribute('data-match-modal-registered')).toBe('true');

    const controls = [...dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const initial = fixture.initialFocusSelector
      ? dialog!.querySelector<HTMLElement>(fixture.initialFocusSelector)
      : controls[0];
    expect(controls.length).toBeGreaterThan(0);
    expect(initial).toBeInstanceOf(HTMLElement);
    expect(document.activeElement).toBe(initial);

    controls.at(-1)!.focus();
    const keyEventTarget = fixture.keyEventTarget ?? 'document';
    pressTab(keyEventTarget);
    expect(document.activeElement).toBe(trigger);
    pressTab(keyEventTarget);
    expect(document.activeElement).toBe(controls[0]);

    controls[0]!.focus();
    pressTab(keyEventTarget, true);
    expect(document.activeElement).toBe(trigger);
    pressTab(keyEventTarget, true);
    expect(document.activeElement).toBe(controls.at(-1));

    pressEscape(keyEventTarget);
    for (const [callback, count] of fixture.escapeCalls) expect(callback).toHaveBeenCalledTimes(count);
    if (fixture.escapeCalls.every(([, count]) => count === 0)) expect(dialog?.isConnected).toBe(true);
  });
});
