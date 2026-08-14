import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { hydratePendingRuntimeState, persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { FILE_CARD_BACK_PLACEHOLDER } from '@/engine/types';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';

const CARD = (id: string): CardDef => ({ id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });

function setup(): { state: GameState; ctx: EffectCtx; sourceUid: string; targetUid: string } {
  const state = createEmptyGameState();
  state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const source = mutate.scene.enter(state, 'self', 'SOURCE', {});
  const target = mutate.scene.enter(state, 'self', 'TARGET', {});
  source.stackedCards = [
    { cardId: 'A', instanceId: 'stack:source:a' },
    { cardId: 'B', instanceId: 'stack:source:b' },
  ];
  return {
    state, sourceUid: source.uid, targetUid: target.uid,
    ctx: { source: { player: 'self', area: 'scene', uid: source.uid, cardId: 'SOURCE' }, bindings: { '$target': [{ uid: target.uid }] }, dyn: {} } as EffectCtx,
  };
}

function effect(sourceUid: string): Effect {
  return { kind: 'chain', steps: [
    { kind: 'atom', verb: 'stackedCardPick', args: { hostUid: sourceUid, player: 'self', min: 0, max: 2, bind: '$stack', selectedInstanceIds: '$pick.uids' } },
    { kind: 'atom', verb: 'charTransferStackedCards' as never, args: { fromUid: sourceUid, toUid: '$target.uid', bind: '$stack' } },
  ] };
}

beforeEach(() => {
  resetDefRegistry();
  resetPendingRuntimeState();
  _clearPendingEffectPickQueue();
  ['SOURCE', 'TARGET', 'A', 'B'].map(CARD).forEach(registerCardDef);
});

describe('charTransferStackedCards', () => {
  it('moves the exact selected stack identities to the bound own-scene target', () => {
    const { state, ctx, sourceUid, targetUid } = setup();
    run(state, effect(sourceUid), ctx);
    const pending = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, pending!, 'stack:source:b');
    expect(state.players.self.scene.find(c => c.uid === sourceUid)!.stackedCards).toEqual([{ cardId: 'A', instanceId: 'stack:source:a' }]);
    expect(state.players.self.scene.find(c => c.uid === targetUid)!.stackedCards).toEqual([{ cardId: 'B', instanceId: 'stack:source:b' }]);
  });

  it('persists only opaque candidates, then restores the exact selected stack identity', () => {
    const { state, ctx, sourceUid, targetUid } = setup();
    run(state, effect(sourceUid), ctx);
    persistPendingRuntimeState(state);
    const persisted = structuredClone(state.pendingRuntimeState);

    expect(JSON.stringify(persisted)).not.toContain('"cardId":"A"');
    expect(JSON.stringify(persisted)).not.toContain('"cardId":"B"');

    resetPendingRuntimeState();
    state.pendingRuntimeState = persisted;
    expect(hydratePendingRuntimeState(state)).toBe(true);
    const pending = _drainPendingEffectPickSide()!;
    expect(pending.candidates).toEqual([
      { uid: 'stack:source:a', cardId: FILE_CARD_BACK_PLACEHOLDER, player: 'self', hidden: true },
      { uid: 'stack:source:b', cardId: FILE_CARD_BACK_PLACEHOLDER, player: 'self', hidden: true },
    ]);

    applyPickAndContinuation(state, pending, 'stack:source:b');
    expect(state.players.self.scene.find(c => c.uid === sourceUid)!.stackedCards)
      .toEqual([{ cardId: 'A', instanceId: 'stack:source:a' }]);
    expect(state.players.self.scene.find(c => c.uid === targetUid)!.stackedCards)
      .toEqual([{ cardId: 'B', instanceId: 'stack:source:b' }]);
  });

  it('does not transfer after a zero-card choice', () => {
    const { state, ctx, sourceUid, targetUid } = setup();
    run(state, effect(sourceUid), ctx);
    applyPickSkipAndContinuation(state, _drainPendingEffectPickSide()!, false);
    expect(state.players.self.scene.find(c => c.uid === sourceUid)!.stackedCards).toHaveLength(2);
    expect(state.players.self.scene.find(c => c.uid === targetUid)!.stackedCards).toBe(0);
  });

  it('fails closed when the bound target has left before transfer', () => {
    const { state, ctx, sourceUid, targetUid } = setup();
    run(state, effect(sourceUid), ctx);
    state.players.self.scene = state.players.self.scene.filter(c => c.uid !== targetUid);
    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, 'stack:source:a');
    expect(state.players.self.scene.find(c => c.uid === sourceUid)!.stackedCards).toEqual([
      { cardId: 'A', instanceId: 'stack:source:a' },
      { cardId: 'B', instanceId: 'stack:source:b' },
    ]);
  });

  it('upgrades a legacy numeric source stack before surfacing identities, then transfers the selected occurrence', () => {
    const { state, ctx, sourceUid, targetUid } = setup();
    state.players.self.scene.find(c => c.uid === sourceUid)!.stackedCards = 2;
    run(state, effect(sourceUid), ctx);
    const pending = _drainPendingEffectPickSide()!;
    expect(pending.candidates.map(c => c.uid)).toEqual(['legacy:' + sourceUid + ':0', 'legacy:' + sourceUid + ':1']);
    applyPickAndContinuation(state, pending, 'legacy:' + sourceUid + ':1');
    expect(state.players.self.scene.find(c => c.uid === targetUid)!.stackedCards)
      .toEqual([{ cardId: 'back-card', instanceId: 'legacy:' + sourceUid + ':1' }]);
  });
});
