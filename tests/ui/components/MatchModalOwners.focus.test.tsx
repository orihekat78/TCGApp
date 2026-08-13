import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CardListModal } from '@/ui/components/CardListModal';
import { ChoicePickerModal } from '@/ui/components/ChoicePickerModal';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { CutinDemoPickerModal } from '@/ui/components/CutinDemoPickerModal';
import { DeckReorderModalHost } from '@/ui/components/DeckReorderModalHost';
import { DeclareCardNameModal } from '@/ui/components/DeclareCardNameModal';
import { EffectRepeatOptionalModalHost } from '@/ui/components/EffectRepeatOptionalModalHost';
import { GuardPickerModal } from '@/ui/components/GuardPickerModal';
import { HiramekiDemoPickerModal } from '@/ui/components/HiramekiDemoPickerModal';
import { HiramekiPickerModal } from '@/ui/components/HiramekiPickerModal';
import { LeaveInterceptModalHost } from '@/ui/components/LeaveInterceptModalHost';
import { MisreadPickerModal } from '@/ui/components/MisreadPickerModal';
import { RpsModalHost } from '@/ui/components/RpsModalHost';
import { SetCardChoiceModalHost } from '@/ui/components/SetCardChoiceModalHost';
import { SetCardReplacementModalHost } from '@/ui/components/SetCardReplacementModalHost';
import { SouzaReorderModal } from '@/ui/components/SouzaReorderModal';
import { TutorialOverlay } from '@/ui/components/TutorialOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { useTutorialStore } from '@/ui/state/tutorialStore';

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
  escapeCalls: ReadonlyArray<[Mock, number]>;
};

type OwnerCase = {
  name: string;
  testId: string;
  create: () => OwnerFixture;
};

function noAction(...callbacks: Mock[]): ReadonlyArray<[Mock, number]> {
  return callbacks.map((callback) => [callback, 0]);
}

const owners: OwnerCase[] = [
  {
    name: 'CutinDemoPickerModal', testId: 'cutin-demo-picker',
    create: () => {
      const onPick = vi.fn();
      const onClose = vi.fn();
      return { node: <CutinDemoPickerModal onPick={onPick} onClose={onClose} />, escapeCalls: [[onClose, 1], [onPick, 0]] };
    },
  },
  {
    name: 'DeckReorderModalHost', testId: 'deck-reorder-modal',
    create: () => {
      useGameStateStore.setState({ pendingDeckReorder: { player: 'self', cardIds: ['D08003', 'D11003'] } });
      return { node: <DeckReorderModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'DeclareCardNameModal', testId: 'declare-card-name-modal',
    create: () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      return {
        node: <DeclareCardNameModal open prompt="Declare" candidateNames={['Conan']} onConfirm={onConfirm} onCancel={onCancel} />,
        escapeCalls: [[onCancel, 1], [onConfirm, 0]],
      };
    },
  },
  {
    name: 'EffectRepeatOptionalModalHost', testId: 'repeat-optional-picker-modal',
    create: () => {
      useGameStateStore.setState({
        pendingEffectRepeatOptional: {
          player: 'self', remaining: 1, source: { uid: 'repeat-source' },
        } as never,
      });
      return { node: <EffectRepeatOptionalModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'GuardPickerModal', testId: 'guard-picker-modal',
    create: () => {
      const onPick = vi.fn();
      const onSkip = vi.fn();
      return {
        node: <GuardPickerModal open mustGuard candidates={[{ uid: 'guard-1', cardId: 'D08003', name: 'Guard', ap: 3000, lp: 1 }]} onPick={onPick} onSkip={onSkip} />,
        escapeCalls: noAction(onPick, onSkip),
      };
    },
  },
  {
    name: 'HiramekiDemoPickerModal', testId: 'hirameki-demo-picker',
    create: () => {
      const onPick = vi.fn();
      const onClose = vi.fn();
      return { node: <HiramekiDemoPickerModal onPick={onPick} onClose={onClose} />, escapeCalls: [[onClose, 1], [onPick, 0]] };
    },
  },
  {
    name: 'HiramekiPickerModal', testId: 'hirameki-picker-modal',
    create: () => {
      const onFire = vi.fn();
      const onSkip = vi.fn();
      return {
        node: <HiramekiPickerModal open cardId="D08003" cardName="Hirameki" abilityText="Draw" onFire={onFire} onSkip={onSkip} />,
        escapeCalls: noAction(onFire, onSkip),
      };
    },
  },
  {
    name: 'LeaveInterceptModalHost', testId: 'leave-intercept-modal',
    create: () => {
      useGameStateStore.setState({
        gameState: {
          players: {
            self: { scene: [{ uid: 'interceptor', cardId: 'B01092' }, { uid: 'target', cardId: 'D08003' }] },
            opp: { scene: [] },
          },
        } as never,
        pendingLeaveIntercept: { player: 'self', interceptorUid: 'interceptor', targetUid: 'target' } as never,
      });
      return { node: <LeaveInterceptModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'MisreadPickerModal', testId: 'misread-picker-modal',
    create: () => {
      const onConfirm = vi.fn();
      const onSkip = vi.fn();
      return {
        node: <MisreadPickerModal open decisionKey="misread-1" reasoningName="Reasoning" reasoningLp={2} candidates={[{ uid: 'target-1', cardId: 'D08003', cardName: 'Target', x: 1 }]} onConfirm={onConfirm} onSkip={onSkip} />,
        escapeCalls: noAction(onConfirm, onSkip),
      };
    },
  },
  {
    name: 'RpsModalHost', testId: 'rps-modal',
    create: () => {
      useGameStateStore.setState({ pendingRps: { player: 'self' } as never });
      return { node: <RpsModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'SetCardChoiceModalHost', testId: 'set-card-choice-modal',
    create: () => {
      useGameStateStore.setState({
        pendingSetCardChoice: {
          player: 'self', hostUid: 'host-1', entries: [{ instanceId: 'set-1', ordinal: 1 }], source: { uid: 'source-1' },
        } as never,
      });
      return { node: <SetCardChoiceModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'SetCardReplacementModalHost', testId: 'set-card-replacement-modal',
    create: () => {
      useGameStateStore.setState({
        pendingSetCardReplacement: {
          player: 'self', fromUid: 'from-1', setCardInstanceId: 'set-1',
          candidates: [{ uid: 'target-1', cardId: 'D08003' }], source: { uid: 'source-1' },
        } as never,
      });
      return { node: <SetCardReplacementModalHost />, escapeCalls: [[dispatchEngineActionMock, 0]] };
    },
  },
  {
    name: 'SouzaReorderModal', testId: 'souza-modal',
    create: () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      return {
        node: <SouzaReorderModal open deckTop={[{ cardId: 'D08003', name: 'One' }, { cardId: 'D11003', name: 'Two' }]} onConfirm={onConfirm} onCancel={onCancel} />,
        escapeCalls: noAction(onCancel, onConfirm),
      };
    },
  },
  {
    name: 'TutorialOverlay', testId: 'tutorial-overlay',
    create: () => {
      useTutorialStore.setState({ currentStep: 0 });
      return { node: <TutorialOverlay />, escapeCalls: [] };
    },
  },
];

function pressTab(shiftKey = false): void {
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab', shiftKey, bubbles: true, cancelable: true,
  })));
}

function pressEscape(): void {
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, cancelable: true,
  })));
}

describe('live MATCH modal owner focus contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    dispatchEngineActionMock.mockClear();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    useTutorialStore.setState({ currentStep: null });
    useGameStateStore.setState({
      gameState: null,
      spectatorMode: false,
      pendingDeckReorder: null,
      pendingEffectRepeatOptional: null,
      pendingLeaveIntercept: null,
      pendingRps: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useTutorialStore.setState({ currentStep: null });
    useGameStateStore.setState({
      gameState: null,
      pendingDeckReorder: null,
      pendingEffectRepeatOptional: null,
      pendingLeaveIntercept: null,
      pendingRps: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it.each(owners)('$name registers, focuses, traps both directions, and preserves Escape semantics', ({ testId, create }) => {
    const fixture = create();
    act(() => root.render(
      <>
        {fixture.node}
        <button type="button" data-match-menu-trigger="true" data-testid="persistent-match-menu-trigger">Menu</button>
      </>,
    ));

    const dialog = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="persistent-match-menu-trigger"]');
    expect(dialog).toBeInstanceOf(HTMLElement);
    expect(dialog?.getAttribute('data-match-modal-registered')).toBe('true');
    expect(trigger).toBeInstanceOf(HTMLButtonElement);

    const controls = [...dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => !(control instanceof HTMLButtonElement || control instanceof HTMLInputElement) || !control.disabled)).toBe(true);
    expect(document.activeElement).toBe(controls[0]);

    pressTab(true);
    expect(document.activeElement).toBe(trigger);
    pressTab(true);
    expect(document.activeElement).toBe(controls.at(-1));
    pressTab();
    expect(document.activeElement).toBe(trigger);
    pressTab();
    expect(document.activeElement).toBe(controls[0]);

    pressEscape();
    for (const [callback, count] of fixture.escapeCalls) expect(callback).toHaveBeenCalledTimes(count);
    if (testId === 'tutorial-overlay') expect(useTutorialStore.getState().currentStep).toBe(0);
    if (fixture.escapeCalls.every(([, count]) => count === 0)) expect(dialog?.isConnected).toBe(true);
  });

  it('lets nested CardExpand consume Escape before the required Souza owner', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    act(() => root.render(
      <>
        <SouzaReorderModal open deckTop={[{ cardId: 'D08003', name: 'One' }]} onConfirm={onConfirm} onCancel={onCancel} />
        <button type="button" data-match-menu-trigger="true">Menu</button>
      </>,
    ));
    const owner = container.querySelector<HTMLElement>('[data-testid="souza-modal"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="selectable-card-tile-detail"]');
    expect(owner?.getAttribute('data-match-modal-registered')).toBe('true');
    expect(detail).toBeInstanceOf(HTMLButtonElement);

    act(() => detail!.click());
    const nested = container.querySelector<HTMLElement>('.card-expand-modal-backdrop');
    expect(nested?.getAttribute('data-match-modal-registered')).toBe('true');
    pressEscape();

    expect(container.querySelector('.card-expand-modal-backdrop')).toBeNull();
    expect(owner?.isConnected).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    pressEscape();
    expect(owner?.isConnected).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each([
    ['ConfirmModal', (onClose: Mock) => (
      <ConfirmModal
        current={{ kind: 'standard', title: 'Confirm', body: 'Body', okLabel: 'OK', cancelLabel: 'Cancel' }}
        onAccept={vi.fn()}
        onReject={onClose}
      />
    )],
    ['CardListModal', (onClose: Mock) => (
      <CardListModal kind="deck" side="self" cards={['D08003']} onClose={onClose} />
    )],
  ])('lets nested %s own Escape before its registered parent', (_name, nested) => {
    const parentCancel = vi.fn();
    const nestedClose = vi.fn();
    act(() => root.render(
      <>
        <ChoicePickerModal
          open
          sourceName="Parent"
          options={[{ index: 0, label: 'Option' }]}
          onPick={vi.fn()}
          onCancel={parentCancel}
        />
        {nested(nestedClose)}
      </>,
    ));

    pressEscape();

    expect(nestedClose).toHaveBeenCalledOnce();
    expect(parentCancel).not.toHaveBeenCalled();
  });

  it('does not let an aria-hidden or inert ancestor modal receive Escape', () => {
    const onCancel = vi.fn();
    act(() => root.render(
      <div hidden inert aria-hidden="true">
        <ChoicePickerModal
          open
          sourceName="Hidden"
          options={[{ index: 0, label: 'Option' }]}
          onPick={vi.fn()}
          onCancel={onCancel}
        />
      </div>,
    ));

    pressEscape();

    expect(onCancel).not.toHaveBeenCalled();
  });
});
