import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide, _drainPendingDeckRevealSide } from '@/engine/effect/atom-handlers';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { B04026 } from '@/cards/ct-p04/B04026';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/pending-state';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckReorderSide?: unknown;
  __pendingDeckRevealSide?: unknown;
};

function card(id: string, color: '緑' | '赤', level = 1): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: [color], level,
    ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function effectCtx(): EffectCtx {
  return {
    source: { cardId: 'B04026', uid: 'hand:self:B04026', abilityId: 'a1', player: 'self', area: 'hand' },
    bindings: {},
    dyn: { runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
  };
}

function b04026Effect(): Effect {
  const effect = B04026.abilities[0]?.effect;
  if (!effect) throw new Error('B04026 a1 effect missing');
  return effect;
}

function base(deck: string[], fileCount = 1): GameState {
  const s = createEmptyGameState();
  s.turn.number = 2;
  s.turn.player = 'self';
  s.turn.phase = 'main';
  s.players.self.deck = [...deck];
  s.players.self.file = Array.from({ length: fileCount }, () => ({ type: 'card-back' as const }));
  return s;
}

function queue(): PendingEffectPickSide[] {
  return globals.__pendingEffectPickQueue ?? [];
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  globals.__pendingEffectPickQueue = [];
  globals.__pendingDeckReorderSide = null;
  globals.__pendingDeckRevealSide = null;
  resetCardDefRegistry();
  registerCardDef(B04026);
  registerCardDef(card('GREEN', '緑'));
  registerCardDef(card('RED-A', '赤'));
  registerCardDef(card('RED-B', '赤'));
  registerCardDef(card('TAIL', '赤'));
  const store = useGameStateStore.getState();
  store.setGameState(null);
  store.setPendingEffectPick(null);
  store.setPendingDeckReveal(null);
  store.setPendingDeckReorder(null);
});

afterAll(() => {
  globals.__humanPlayerSide = null;
});

describe('BUG-191 B04026 reorder continuation', () => {
  it('keeps the remaining window in place until confirm, then resumes hand sceneEnter', () => {
    let state = produce(base(['GREEN', 'RED-A', 'RED-B', 'TAIL']), draft => {
      runEffect(draft, b04026Effect(), effectCtx());
    });
    const revealPick = queue()[0]!;
    expect(revealPick.atomVerb).toBe('deckRevealUntil');
    globals.__pendingEffectPickQueue = [];

    state = produce(state, draft => {
      applyPickAndContinuation(draft, revealPick, revealPick.candidates[0]!.uid);
    });
    const reorder = _drainPendingDeckReorderSide();

    expect(state.players.self.deck).toEqual(['RED-A', 'RED-B', 'TAIL']);
    expect(state.players.self.hand).toEqual(['GREEN']);
    expect(queue()).toHaveLength(0);
    expect(reorder?.cardIds).toEqual(['RED-A', 'RED-B']);
    expect((reorder as { continuation?: unknown } | null)?.continuation).toBeDefined();

    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingDeckReorder(reorder!);
    const pending = useGameStateStore.getState().pendingDeckReorder!;
    const result = dispatchEngineAction(bindPendingDecision(pending, { type: 'deckReorderResolve', order: ['RED-B', 'RED-A'] }));

    expect(result).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.deck).toEqual(['TAIL', 'RED-B', 'RED-A']);
    expect(after.pendingDeckReorder).toBeNull();
    expect(after.pendingEffectPick?.atomVerb).toBe('sceneEnter');
    expect(after.pendingEffectPick?.candidates.map(candidate => candidate.cardId)).toEqual(['GREEN']);
  });

  it('moves two duplicate card occurrences without collapsing them', () => {
    const state = base(['RED-A', 'TAIL', 'RED-A']);
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingDeckReorder({
      player: 'self',
      cardIds: ['RED-A', 'RED-A'],
      deckSnapshot: ['RED-A', 'TAIL', 'RED-A'],
      occurrences: [{ cardId: 'RED-A', index: 0 }, { cardId: 'RED-A', index: 2 }],
    });

    const pending = useGameStateStore.getState().pendingDeckReorder!;
    expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'deckReorderResolve', order: ['RED-A', 'RED-A'] }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual(['TAIL', 'RED-A', 'RED-A']);
  });

  it('rejects a wrong multiset and keeps the pending decision', () => {
    const state = base(['RED-A', 'RED-B', 'TAIL']);
    const pending = {
      player: 'self' as const,
      cardIds: ['RED-A', 'RED-B'],
      deckSnapshot: ['RED-A', 'RED-B', 'TAIL'],
      occurrences: [{ cardId: 'RED-A', index: 0 }, { cardId: 'RED-B', index: 1 }],
    };
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingDeckReorder(pending);

    const surfaced = useGameStateStore.getState().pendingDeckReorder!;
    const result = dispatchEngineAction(bindPendingDecision(surfaced, { type: 'deckReorderResolve', order: ['RED-A', 'TAIL'] }));

    expect(result.ok).toBe(false);
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual(['RED-A', 'RED-B', 'TAIL']);
    expect(useGameStateStore.getState().pendingDeckReorder).toMatchObject(pending);
  });

  it('rejects a stale deck snapshot before moving any occurrence', () => {
    const state = base(['TAIL', 'RED-A', 'RED-B']);
    const pending = {
      player: 'self' as const,
      cardIds: ['RED-A', 'RED-B'],
      deckSnapshot: ['RED-A', 'RED-B', 'TAIL'],
      occurrences: [{ cardId: 'RED-A', index: 0 }, { cardId: 'RED-B', index: 1 }],
    };
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingDeckReorder(pending);

    const surfaced = useGameStateStore.getState().pendingDeckReorder!;
    const result = dispatchEngineAction(bindPendingDecision(surfaced, { type: 'deckReorderResolve', order: ['RED-B', 'RED-A'] }));

    expect(result.ok).toBe(false);
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual(['TAIL', 'RED-A', 'RED-B']);
    expect(useGameStateStore.getState().pendingDeckReorder).toMatchObject(pending);
  });
});

describe('BUG-190 B04026 zero-match decisions', () => {
  it('surfaces a full short-deck reveal skip, then reorder, then a zero-candidate hand decision', () => {
    let state = produce(base(['RED-A', 'RED-B']), draft => {
      runEffect(draft, b04026Effect(), effectCtx());
    });
    const reveal = _drainPendingDeckRevealSide();
    const revealPick = queue()[0]!;

    expect(reveal).toMatchObject({ player: 'self', revealed: ['RED-A', 'RED-B'], matched: null, awaitingPick: true });
    expect(revealPick.atomVerb).toBe('deckRevealUntil');
    expect(revealPick.candidates).toEqual([]);
    expect(state.players.self.deck).toEqual(['RED-A', 'RED-B']);
    globals.__pendingEffectPickQueue = [];

    state = produce(state, draft => {
      applyPickSkipAndContinuation(draft, revealPick);
    });
    const reorder = _drainPendingDeckReorderSide();
    expect(state.players.self.deck).toEqual(['RED-A', 'RED-B']);
    expect(queue()).toHaveLength(0);
    expect(reorder?.cardIds).toEqual(['RED-A', 'RED-B']);

    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingDeckReorder(reorder!);
    const pendingReorder = useGameStateStore.getState().pendingDeckReorder!;
    expect(dispatchEngineAction(bindPendingDecision(pendingReorder, { type: 'deckReorderResolve', order: ['RED-B', 'RED-A'] }))).toEqual({ ok: true });
    const afterReorder = useGameStateStore.getState();
    expect(afterReorder.gameState!.players.self.deck).toEqual(['RED-B', 'RED-A']);
    expect(afterReorder.pendingEffectPick?.atomVerb).toBe('sceneEnter');
    expect(afterReorder.pendingEffectPick?.candidates).toEqual([]);
    expect(afterReorder.pendingEffectPick?.nMin).toBe(0);

    const pendingPick = useGameStateStore.getState().pendingEffectPick!;
    expect(dispatchEngineAction(bindPendingDecision(pendingPick, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
