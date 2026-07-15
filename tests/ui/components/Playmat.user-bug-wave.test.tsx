import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Playmat } from '@/ui/components/Playmat';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { createEmptyGameState } from '@/engine/state-factory';
import { useGameStateStore, type PendingEffectPick } from '@/ui/state/store';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import type { HandCardMeta } from '@/ui/components/HandZone';

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
