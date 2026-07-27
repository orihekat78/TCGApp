import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Playmat } from '@/ui/components/Playmat';
import { createEmptyGameState } from '@/engine/state-factory';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

const { dispatchEngineActionMock, surfacePendingSideChannelsMock } = vi.hoisted(() => ({
  dispatchEngineActionMock: vi.fn(),
  surfacePendingSideChannelsMock: vi.fn(),
}));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({
  dispatchEngineAction: dispatchEngineActionMock,
  surfacePendingSideChannels: surfacePendingSideChannelsMock,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId,
  color: 'black',
  ap: 4000,
  lp: 0,
  lv: 4,
});

describe('B10094 mixed declared-ability source picker', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
    useTargetPickerStore.getState()._reset();
    dispatchEngineActionMock.mockClear();
    surfacePendingSideChannelsMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useTargetPickerStore.getState()._reset();
  });

  it('shows every public legal occurrence in one decision, returns the exact UID, and cancels without reopening', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [{
      uid: 'scene-source', cardId: 'B10094', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }];
    state.players.self.evidence = [
      { cardId: 'B10094', faceUp: true, origin: 'action' },
      { cardId: 'B10094', faceUp: false, origin: 'action' },
    ];
    state.players.self.file = [
      { type: 'card-back', cardId: 'B10094', faceUp: true },
      { type: 'card-back', cardId: 'B10094', faceUp: false },
    ];
    useTargetPickerStore.getState()._setPhase({
      phase: 'picking',
      purpose: 'declared-ability:source',
      candidates: ['scene-source', 'evidence:self:0', 'file:self:0'],
    });

    act(() => {
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });

    expect(container.querySelectorAll('.card-list-pick-shell')).toHaveLength(3);
    expect(container.querySelector('[data-testid="card-list-pick-scene-source"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-evidence:self:0"]')).not.toBeNull();
    const filePick = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-file:self:0"]');
    expect(filePick).not.toBeNull();

    act(() => filePick!.click());
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
    expect(container.querySelector('.card-list-modal')).toBeNull();

    act(() => {
      useTargetPickerStore.getState()._setPhase({
        phase: 'picking',
        purpose: 'declared-ability:source',
        candidates: ['scene-source', 'evidence:self:0', 'file:self:0'],
      });
    });
    expect(container.querySelector('.card-list-modal')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
    expect(container.querySelector('.card-list-modal')).toBeNull();
  });

  it('opens one public-area decision for evidence plus case, hand, and physical PA-MR sources', () => {
    const state = createEmptyGameState();
    state.players.self.case.cardId = 'CASE';
    state.players.self.hand = ['HAND', 'HAND'];
    state.players.self.evidence = [{ cardId: 'EVIDENCE', faceUp: true, origin: 'action' }];
    state.players.self.partnerAreaMR = {
      uid: 'physical-pa-mr', cardId: 'PA-MR', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    };
    act(() => {
      useTargetPickerStore.getState()._setPhase({
        phase: 'picking', purpose: 'declared-ability:source',
        candidates: ['evidence:self:0', 'case:self', 'hand:self:1', 'physical-pa-mr'],
      });
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });

    expect(container.querySelectorAll('.card-list-pick-shell')).toHaveLength(4);
    expect(container.querySelectorAll('[data-action-id][aria-disabled="true"]')).toHaveLength(8);
    expect(container.querySelector<HTMLButtonElement>('.end-turn-btn')?.disabled).toBe(true);
    for (const uid of ['evidence:self:0', 'case:self', 'hand:self:1', 'physical-pa-mr']) {
      expect(container.querySelector(`[data-testid="card-list-pick-${uid}"]`)).not.toBeNull();
      expect(container.querySelector(`[data-testid="card-list-pick-detail-${uid}"]`)).not.toBeNull();
    }
    expect(container.querySelector('.card-list-modal')?.textContent).toContain('Partner area');
  });

  it('keeps a scene-only source on the board and accepts the physical PA-MR UID', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [{
      uid: 'scene-source', cardId: 'B10094', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }];
    state.players.self.partnerAreaMR = {
      uid: 'physical-pa-mr', cardId: 'PA-MR', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    };
    act(() => {
      useTargetPickerStore.getState()._setPhase({ phase: 'picking', purpose: 'declared-ability:source', candidates: ['scene-source'] });
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });
    expect(container.querySelector('.card-list-modal')).toBeNull();
    expect(container.querySelector('[data-uid="scene-source"]')?.classList.contains('candidate')).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });

    act(() => useTargetPickerStore.getState()._setPhase({ phase: 'picking', purpose: 'declared-ability:source', candidates: ['physical-pa-mr'] }));
    const paMr = container.querySelector<HTMLElement>('[data-testid="pa-mr-self"]');
    expect(paMr?.classList.contains('candidate')).toBe(true);
    act(() => paMr!.click());
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
  });

  it('declines an optional direct scene effect pick with Escape', () => {
    const state = createEmptyGameState();
    state.players.opp.scene = [{
      uid: 'opp-scene', cardId: 'B01040', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }];
    act(() => {
      useGameStateStore.setState({
        pendingEffectPick: {
          player: 'self',
          candidates: [{ uid: 'opp-scene', cardId: 'B01040', player: 'opp', kind: 'char' }],
          atomVerb: 'sceneSetState', atomArgs: {}, nMin: 0, nMax: 1,
          source: {} as never,
        },
      });
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });

    expect(container.querySelector('[data-testid="scene-pick-skip"]')).not.toBeNull();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'effectPickResolve', pickedUid: null });
  });
});
