// Official Q&A: B03023 脇田兼則
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 26-qa-deck-refresh.md
// 「相手はデッキ上から1枚公開し、その後元に戻す」は deckRevealUntil の非移動 window。

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingDeckRevealSide } from '@/engine/effect/atom-handlers';
import { registerAll } from '@/cards';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const ENTERING = 'QA_B03023_ENTERING';
const TOP = 'QA_B03023_TOP';
const NEXT = 'QA_B03023_NEXT';

type Globals = {
  __pendingDeckRevealSide?: unknown;
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const globals = globalThis as Globals;

const enteringDef: CardDef = {
  id: ENTERING,
  no: `QA/${ENTERING}`,
  kind: 'character',
  names: ['QA entrant'],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: ['毛利探偵事務所'],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const deckDef = (id: string): CardDef => ({
  ...enteringDef,
  id,
  no: `QA/${id}`,
  names: [id],
  traits: [],
});

function base(deck: string[], wakitaCount = 1): GameState {
  _resetUidCounter();
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青'];
  state.players.self.file = [{ type: 'card-back', cardId: 'FILE' }];
  state.players.self.hand = [ENTERING];
  state.players.self.scene = Array.from({ length: wakitaCount }, (_, index) => sceneChar('B03023', `wakita-${index + 1}`));
  state.players.opp.deck = [...deck];
  return state;
}

function enterThroughPublicFlow(state: GameState, confirmSameTimingOrder = false): GameState {
  useGameStateStore.setState({ gameState: state, pendingDeckReveal: null, pendingEffectPick: null });
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: ENTERING }).ok).toBe(true);
  if (confirmSameTimingOrder) {
    const current = useGameStateStore.getState().gameState!;
    const group = current.pendingEffects.filter(entry => entry.state === 'pending' && entry.source.player === 'self');
    expect(group).toHaveLength(2);
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: group[0]!.id, order: 0, player: 'self' }).ok).toBe(true);
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: group.map(entry => entry.id), player: 'self' }).ok).toBe(true);
  }
  return useGameStateStore.getState().gameState!;
}

function combinationState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青'];
  state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = ['B04012'];
  state.players.self.scene = [sceneChar('B03023', 'wakita-combo')];
  state.players.self.deck = [ENTERING];
  state.players.opp.deck = [TOP, NEXT];
  return state;
}

function orderCombination(firstCardId: 'B03023' | 'B04012'): void {
  useGameStateStore.setState({ gameState: combinationState(), pendingDeckReveal: null, pendingEffectPick: null });
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B04012' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().gameState!.pendingEffects
    .filter(entry => entry.state === 'pending' && (entry.source.cardId === 'B03023' || entry.source.cardId === 'B04012'));
  expect(pending.map(entry => entry.source.cardId).sort()).toEqual(['B03023', 'B04012']);
  const first = pending.find(entry => entry.source.cardId === firstCardId)!;
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: first.id, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = useGameStateStore.getState().gameState!.pendingEffects
    .filter(entry => entry.state === 'pending' && (entry.source.cardId === 'B03023' || entry.source.cardId === 'B04012'))
    .sort((a, b) => (a.ownerChosenOrder ?? Infinity) - (b.ownerChosenOrder ?? Infinity));
  expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ordered.map(entry => entry.id), player: 'self' })).toEqual({ ok: true });

  const firstSurface = useGameStateStore.getState().pendingDeckReveal;
  expect(firstSurface?.source?.cardId).toBe(firstCardId);
  if (firstCardId === 'B03023') {
    expect(firstSurface).toMatchObject({ visibility: 'public', viewer: 'all', player: 'opp', revealed: [TOP] });
  } else {
    expect(firstSurface).toMatchObject({ visibility: 'private', viewer: 'self', player: 'self', awaitingPick: true });
  }

  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source.cardId).toBe('B04012');
  expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid })).toEqual({ ok: true });

  const afterPickSurface = useGameStateStore.getState().pendingDeckReveal;
  expect(afterPickSurface?.source?.cardId).toBe('B03023');
  expect(afterPickSurface).toMatchObject({ visibility: 'public', viewer: 'all', player: 'opp', revealed: [TOP] });

  useGameStateStore.getState().setPendingDeckReveal(null);
  surfacePendingSideChannels();
  const nextSurface = useGameStateStore.getState().pendingDeckReveal;
  expect(nextSurface?.source?.cardId).toBe('B04012');
  expect(nextSurface).toMatchObject({ visibility: 'private', viewer: 'self', player: 'self', matched: ENTERING });

  const revealLogs = useGameStateStore.getState().gameState!.log.filter(entry => entry.action === 'effect:deckRevealUntil');
  expect(revealLogs.slice(0, 2).map(entry => entry.player)).toEqual(
    firstCardId === 'B03023' ? ['opp', 'self'] : ['self', 'opp'],
  );
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerAll();
  registerCardDef(enteringDef);
  registerCardDef(deckDef(TOP));
  registerCardDef(deckDef(NEXT));
  registerTriggeredListener();
  globals.__pendingDeckRevealSide = null;
  globals.__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, pendingDeckReveal: null, pendingEffectPick: null });
});

describe('B03023 official Q&A — opponent top-card reveal', () => {
  it('deck 0: public enter resolves without a visible card and preserves the empty opponent deck', () => {
    const after = enterThroughPublicFlow(base([]));

    expect(after.players.opp.deck).toEqual([]);
    expect(globals.__pendingDeckRevealSide).toBeNull();
    expect(after.log.at(-1)).toMatchObject({ player: 'opp', action: 'effect:deckRevealUntil', result: 'revealed=0 matched=none visibility=public viewer=all' });
  });

  it('deck 1+: public enter reveals the opponent top card to the UI/log and returns it in place', () => {
    const before = [TOP, NEXT];
    const after = enterThroughPublicFlow(base(before));

    expect(after.players.opp.deck, '公開後も元の順序').toEqual(before);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'opp', visibility: 'public', viewer: 'all', revealed: [TOP], matched: TOP, presentation: 'reveal-return',
    });
    expect(after.log.at(-1)).toMatchObject({ player: 'opp', action: 'effect:deckRevealUntil', result: 'revealed=1 matched=QA_B03023_TOP visibility=public viewer=all' });
  });

  it('two B03023 trigger together but both reveal only the same original top card and each consume turn-1', () => {
    const state = base([TOP, NEXT], 2);
    // BUG-249: same-owner simultaneous effects wait for the human's chosen order.
    // This test chooses the displayed default order, then resumes the real resolver.
    const after = enterThroughPublicFlow(state, true);
    const reveals = after.log.filter(entry => entry.action === 'effect:deckRevealUntil');

    expect(after.players.opp.deck, '複数解決でも2枚目を公開しない').toEqual([TOP, NEXT]);
    expect(reveals).toHaveLength(2);
    expect(reveals.every(entry => entry.player === 'opp' && entry.result === 'revealed=1 matched=QA_B03023_TOP visibility=public viewer=all')).toBe(true);
    expect(after.players.self.scene.filter(char => char.cardId === 'B03023').map(char => char.declaredUseCount.a1)).toEqual([1, 1]);
    expect([useGameStateStore.getState().pendingDeckReveal, _drainPendingDeckRevealSide()]).toEqual([
      expect.objectContaining({ player: 'opp', revealed: [TOP], presentation: 'reveal-return' }),
      expect.objectContaining({ player: 'opp', revealed: [TOP], presentation: 'reveal-return' }),
    ]);

    const again = produce(after, draft => {
      event.emit(draft, 'enter', { uid: 'another', viaEffect: false, enterOrder: 99, enterOrderThisTurn: 99 }, { player: 'self', cardId: ENTERING, uid: 'another' });
      runAllUntilEmpty(draft);
    });
    expect(again.log.filter(entry => entry.action === 'effect:deckRevealUntil')).toHaveLength(2);
  });

  it('uses public owner-order dispatch to resolve actual B03023 before actual B04012', () => {
    orderCombination('B03023');
  });

  it('uses public owner-order dispatch to resolve actual B04012 before actual B03023', () => {
    orderCombination('B04012');
  });

  it('keeps an actual CPU B04012 private look out of the human side-channel and redacts its log', () => {
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['青'];
    state.players.opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
    state.players.opp.hand = ['B04012'];
    state.players.opp.deck = [TOP];
    useGameStateStore.setState({ gameState: state, pendingDeckReveal: null, pendingEffectPick: null });

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: 'B04012' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(_drainPendingDeckRevealSide()).toBeNull();
    const revealLog = useGameStateStore.getState().gameState!.log.find(entry => entry.action === 'effect:deckRevealUntil');
    expect(revealLog?.result).toBe('revealed=1 matched=hidden visibility=private viewer=opp');
    expect(revealLog?.result).not.toContain(TOP);
  });
});
