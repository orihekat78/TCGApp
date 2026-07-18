import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Playmat } from '@/ui/components/Playmat';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { createEmptyGameState } from '@/engine/state-factory';
import { useGameStateStore, type PendingEffectPick } from '@/ui/state/store';
import { useEvidenceFlipPickerStore } from '@/ui/hooks/useEvidenceFlipPicker';
import { useStackedCardCostPickerStore } from '@/ui/hooks/useStackedCardCostPicker';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import type { HandCardMeta } from '@/ui/components/HandZone';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId,
  color: 'green',
  ap: 1000,
  lp: 1,
  lv: 1,
});

const resolveHandCard = (cardId: string): HandCardMeta => ({
  cardId,
  name: cardId,
  color: cardId.startsWith('G') ? 'green' : 'blue',
  type: 'キャラ',
  cost: 1,
  ap: 1000,
  lp: 1,
  lv: 1,
});

function pending(overrides: Partial<PendingEffectPick>): PendingEffectPick {
  return {
    player: 'self',
    candidates: [],
    atomVerb: 'deckRevealUntil',
    atomArgs: {},
    nMin: 0,
    nMax: 1,
    source: { cardId: 'B04026', abilityId: 'a1' },
    ...overrides,
  };
}

describe('Playmat user bug wave', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      gameState: null,
      pendingEffectPick: null,
      pendingDeckReveal: null,
      pendingDeckReorder: null,
      activeActionId: null,
      spectatorMode: false,
      aiSpeedMs: 0,
    });
    useEvidenceFlipPickerStore.getState()._reset();
    useStackedCardCostPickerStore.setState({ current: null, _resolver: null });
    dispatchEngineActionMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps a manually opened self remove-area browser visible', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['R1'];
    act(() => {
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });

    const area = container.querySelector('.remove-area.side-self');
    expect(area).not.toBeNull();
    act(() => area!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('.card-list-modal')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-item-R1-0"]')).not.toBeNull();
  });

  it('shows the full B04026 reveal window and makes only eligible cards pickable', () => {
    const state = createEmptyGameState();
    const pick = pending({
      candidates: [{ uid: 'G1#1', cardId: 'G1', player: 'self' }],
    });
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: pick,
      pendingDeckReveal: {
        player: 'self',
        revealed: ['X1', 'G1', 'X2'],
        matched: null,
        awaitingPick: true,
      },
    });

    act(() => {
      root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
    });

    expect(container.querySelectorAll('.card-list-item')).toHaveLength(3);
    expect(container.querySelector('[data-testid="card-list-pick-G1#1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-item-X1-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-item-X2-2"]')).not.toBeNull();
  });

  it('lets CardListModal exclusively own an active deck-window pick', () => {
    const state = createEmptyGameState();
    const pick = pending({
      atomVerb: 'sceneEnter',
      atomArgs: { target: { query: { area: 'deck' } } },
      candidates: [{ uid: 'G1#0', cardId: 'G1', player: 'self' }],
    });
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: pick,
      pendingDeckReveal: {
        player: 'self',
        revealed: ['G1', 'X1'],
        matched: 'G1',
      },
    });

    act(() => {
      root.render(
        <>
          <Playmat gameState={state} resolveCard={resolveCard} />
          <DeckRevealOverlay />
        </>,
      );
    });

    expect(container.querySelector('.card-list-modal')).not.toBeNull();
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
  });

  it('routes the second duplicate public remove pick through CardListModal to effectPickResolve', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D08024', 'D08024'];
    const secondUid = 'remove:public:second';
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: pending({
        atomVerb: 'handAddFromRemove',
        candidates: [
          { uid: 'remove:public:first', cardId: 'D08024', player: 'self' },
          { uid: secondUid, cardId: 'D08024', player: 'self' },
        ],
        nMin: 1,
        nMax: 1,
      }),
    });
    act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));

    const second = container.querySelector<HTMLButtonElement>(`[data-testid="card-list-pick-${secondUid}"]`)!;
    expect(second).toBeInstanceOf(HTMLButtonElement);
    act(() => second.click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'effectPickResolve', pickedUid: secondUid });
  });

  it('keeps evidence-flip candidates face-down while public evidence can open details', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'D08003', faceUp: true, origin: { turn: 1, via: 'reasoning' } },
      { cardId: 'D08004', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({ gameState: state });
    useEvidenceFlipPickerStore.setState({
      current: { side: 'self', sourceName: 'flip', candidates: [{ index: 1, cardId: 'D08004' }], nMin: 1, nMax: 1 },
      _resolver: null,
    });
    act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));

    const publicEvidence = container.querySelector<HTMLButtonElement>('[data-testid="card-list-evidence-faceup-0"]')!;
    expect(publicEvidence).not.toBeNull();
    act(() => publicEvidence.click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => publicEvidence.dispatchEvent(contextMenu));
    expect(contextMenu.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    const faceDownCandidate = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-evidence:self:1"]')!;
    expect(faceDownCandidate).not.toBeNull();
    expect(faceDownCandidate.getAttribute('aria-label')).toContain('非公開');
    expect(faceDownCandidate.textContent).toBe('非公開');
    expect(faceDownCandidate.querySelector('.card-list-item-art')).toBeNull();
    expect(faceDownCandidate.querySelector('.card-list-item-id')).toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:1"]')).toBeNull();
  });

  it('opens stacked-cost CardList details through click and contextmenu', () => {
    useStackedCardCostPickerStore.setState({
      current: { sourceName: 'stack', candidates: [{ instanceId: 'stack:0', cardId: 'D08003' }], nMin: 1, nMax: 1 },
      _resolver: null,
    });
    act(() => root.render(<Playmat gameState={createEmptyGameState()} resolveCard={resolveCard} />));

    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-stack:0"]')!).click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    const stackedCandidate = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-stack:0"]')!;
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => stackedCandidate.dispatchEvent(contextMenu));
    expect(contextMenu.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
  });

  it('hosts hand sceneEnter in HandZone with exact duplicate occurrence candidates', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['G1', 'G1', 'B1'];
    const pick = pending({
      atomVerb: 'sceneEnter',
      atomArgs: { target: { query: { area: 'hand' } } },
      candidates: [{ uid: 'G1#1', cardId: 'G1', player: 'self' }],
    });
    useGameStateStore.setState({ gameState: state, pendingEffectPick: pick });

    act(() => {
      root.render(
        <Playmat
          gameState={state}
          resolveCard={resolveCard}
          resolveHandCard={resolveHandCard}
        />,
      );
    });

    const handCards = container.querySelectorAll('.hand-card');
    expect(handCards).toHaveLength(3);
    expect(handCards[0]?.classList.contains('hand-card--pickable')).toBe(false);
    expect(handCards[1]?.classList.contains('hand-card--pickable')).toBe(true);
    expect(handCards[2]?.classList.contains('hand-card--pickable')).toBe(false);
    expect(container.querySelector('[data-testid="hand-zone-pick-skip"]')).not.toBeNull();
  });

  it('shows the full hand and an explicit no-target banner for empty optional sceneEnter', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['G1', 'B1'];
    const pick = pending({
      atomVerb: 'sceneEnter',
      atomArgs: { target: { query: { area: 'hand' } } },
      candidates: [],
    });
    useGameStateStore.setState({ gameState: state, pendingEffectPick: pick });

    act(() => {
      root.render(
        <Playmat
          gameState={state}
          resolveCard={resolveCard}
          resolveHandCard={resolveHandCard}
        />,
      );
    });

    expect(container.querySelectorAll('.hand-card')).toHaveLength(2);
    expect(container.querySelectorAll('.hand-card--pickable')).toHaveLength(0);
    expect(container.querySelector('.hand-zone-pick-banner')?.textContent)
      .toContain('登場できる対象はありません');
    expect(container.querySelector('[data-testid="hand-zone-pick-skip"]')).not.toBeNull();
  });
});
