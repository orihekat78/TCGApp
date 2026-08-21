import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineAction } = vi.hoisted(() => ({ dispatchEngineAction: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction }));

function pending(player: 'self' | 'opp') {
  return {
    player,
    candidates: [{ uid: `${player}-candidate`, cardId: 'D08015', player }],
    atomVerb: 'stackedCardPick',
    atomArgs: {},
    nMin: 1,
    nMax: 1,
    source: { cardId: 'B06005', abilityId: 'a2' },
  } as never;
}

function Harness(): null {
  useEffectPickFlowDriver();
  return null;
}

describe('useEffectPickFlowDriver decision ownership', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    useGameStateStore.setState({
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingChooseIntercept: null,
      pendingEffectRepeatOptional: null,
      pendingRps: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
      pendingDecisionSeq: 0,
      spectatorMode: false,
    });
    dispatchEngineAction.mockReset();
  });

  it('auto-resolves a self-owned pick when spectating', () => {
    act(() => {
      useGameStateStore.setState({ spectatorMode: true });
      useGameStateStore.getState().setPendingEffectPick(pending('self'));
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledWith({
      type: 'effectPickResolve',
      pickedUid: 'self-candidate',
      pickedUids: ['self-candidate'],
      decisionId: 'decision:1',
    });
    act(() => root.unmount());
  });

  it('waits when the actual human owns the opponent-side pick', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    act(() => useGameStateStore.getState().setPendingEffectPick(pending('opp')));
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it.each([
    {
      name: 'RPS',
      arrange: () => useGameStateStore.getState().setPendingRps({
        player: 'opp',
        ownerPlayer: 'opp',
        aiHand: 'rock',
        source: { cardId: 'B01001', abilityId: 'a1', uid: 'source' },
      }),
      action: { type: 'rpsResolve', hand: 'paper', decisionId: 'decision:1' },
    },
    {
      name: 'set-card choice',
      arrange: () => useGameStateStore.getState().setPendingSetCardChoice({
        player: 'opp',
        hostUid: 'host',
        entries: [
          { instanceId: 'first', ordinal: 0 },
          { instanceId: 'last', ordinal: 1 },
        ],
        source: { cardId: 'B01001', abilityId: 'a1', uid: 'source' },
      }),
      action: { type: 'setCardChoiceResolve', instanceId: 'last', decisionId: 'decision:1' },
    },
    {
      name: 'set-card replacement',
      arrange: () => useGameStateStore.getState().setPendingSetCardReplacement({
        player: 'opp',
        fromUid: 'from',
        setCardInstanceId: 'set-card',
        candidates: [
          { uid: 'first', cardId: 'B01001' },
          { uid: 'second', cardId: 'B01002' },
        ],
        source: { cardId: 'B01001', abilityId: 'a1', uid: 'source' },
      }),
      action: { type: 'setCardReplacementResolve', targetUid: 'first', decisionId: 'decision:1' },
    },
    {
      name: 'deck reorder',
      arrange: () => useGameStateStore.getState().setPendingDeckReorder({
        player: 'opp',
        cardIds: ['B01001', 'B01002'],
      }),
      action: {
        type: 'deckReorderResolve',
        order: ['B01001', 'B01002'],
        decisionId: 'decision:1',
      },
    },
    {
      name: 'deck placement by ownerPlayer',
      arrange: () => useGameStateStore.getState().setPendingDeckPlace({
        player: 'self',
        ownerPlayer: 'opp',
        cardIds: ['B01001', 'B01002'],
        deckSnapshot: ['B01001', 'B01002'],
        occurrences: [
          { cardId: 'B01001', index: 0 },
          { cardId: 'B01002', index: 1 },
        ],
        ctx: {} as never,
      }),
      action: {
        type: 'deckPlaceResolve',
        top: ['B01001', 'B01002'],
        bottom: [],
        decisionId: 'decision:1',
      },
    },
  ])('auto-resolves a restored non-human $name decision', ({ arrange, action }) => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    act(arrange);
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledTimes(1);
    expect(dispatchEngineAction).toHaveBeenCalledWith(action);
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it('does not overtake an earlier human-owned decision', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    act(() => {
      useGameStateStore.getState().setPendingEffectChoice({
        player: 'self',
        source: { cardId: 'B01001', abilityId: 'a1', uid: 'source' },
        options: [{ index: 0 }],
      });
      useGameStateStore.getState().setPendingRps({
        player: 'opp',
        ownerPlayer: 'opp',
        aiHand: 'rock',
        source: { cardId: 'B01001', abilityId: 'a1', uid: 'source' },
      });
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
