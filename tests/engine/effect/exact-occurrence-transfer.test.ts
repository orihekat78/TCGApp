import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { runAtom } from '@/engine/effect/atom-handlers';
import { resolveEffectPicks, tryRePickFromAtom } from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeCtx } from '../../helpers/fixtures';

describe('exact occurrence transfer', () => {
  it('moves the selected duplicate from remove and binds its destination', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'handAddFromRemove', {
        player: 'self', cardIds: ['DUP'], selectedDeckIndexes: [2], bind: '$moved',
      }, ctx);
    });

    expect(after.players.self.remove).toEqual(['DUP', 'X']);
    expect(after.players.self.hand).toEqual(['DUP']);
    expect(ctx.bindings.$moved).toEqual([
      { kind: 'card', cardId: 'DUP', area: 'hand', player: 'self', index: 0 },
    ]);
  });

  it('fails closed when the selected remove occurrence became stale', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'handAddFromRemove', {
        player: 'self', cardIds: ['DUP'], selectedDeckIndexes: [1], bind: '$moved',
      }, ctx);
    });

    expect(after.players.self.remove).toEqual(['DUP', 'X', 'DUP']);
    expect(after.players.self.hand).toEqual([]);
    expect(ctx.bindings.$moved).toEqual([]);
  });

  it('moves the selected duplicate from deck and binds its hand occurrence', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.deck = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'handAddFromDeck', {
        player: 'self', cardIds: ['DUP'], selectedDeckIndexes: [2], bind: '$moved',
      }, ctx);
    });

    expect(after.players.self.deck).toEqual(['DUP', 'X']);
    expect(after.players.self.hand).toEqual(['DUP']);
    expect(ctx.bindings.$moved).toEqual([
      { kind: 'card', cardId: 'DUP', area: 'hand', player: 'self', index: 0 },
    ]);
  });

  it('prunes only the moved duplicate deck binding and rebases later deck indices', () => {
    const ctx = makeCtx({
      bindings: {
        $revealed: [
          { kind: 'card', cardId: 'DUP', area: 'deck', player: 'self', index: 0 },
          { kind: 'card', cardId: 'X', area: 'deck', player: 'self', index: 1 },
          { kind: 'card', cardId: 'DUP', area: 'deck', player: 'self', index: 2 },
        ],
      },
    });
    const state = createEmptyGameState();
    state.players.self.deck = ['DUP', 'X', 'DUP'];

    produce(state, (draft) => {
      runAtom(draft, 'handAddFromDeck', {
        player: 'self', cardIds: ['DUP'], selectedDeckIndexes: [2], bind: '$moved',
      }, ctx);
    });

    expect(ctx.bindings.$revealed).toEqual([
      { kind: 'card', cardId: 'DUP', area: 'deck', player: 'self', index: 0 },
      { kind: 'card', cardId: 'X', area: 'deck', player: 'self', index: 1 },
    ]);
  });

  it('moves the selected duplicate from remove to partner area and binds it', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'toPartnerArea', {
        player: 'self', target: 'DUP', selectedCardIndex: 0, bind: '$moved',
      }, ctx);
    });

    expect(after.players.self.remove).toEqual(['X', 'DUP']);
    expect(after.players.self.partnerAreaCards).toEqual(['DUP']);
    expect(ctx.bindings.$moved).toEqual([
      { kind: 'card', cardId: 'DUP', area: 'partner-area', player: 'self', index: 0 },
    ]);
  });

  it('resolves a bound card target for partner area and fails closed when its index is stale', () => {
    const ctx = makeCtx({
      bindings: { $picked: [{ kind: 'card', cardId: 'DUP', area: 'remove', player: 'self', index: 1 }] },
    });
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'toPartnerArea', {
        player: 'self', target: '$picked.cardId', selectedCardIndex: '$picked.index', bind: '$moved',
      }, ctx);
    });

    expect(after.players.self.remove).toEqual(['DUP', 'X']);
    expect(after.players.self.partnerAreaCards ?? []).toEqual([]);
    expect(ctx.bindings.$moved).toEqual([]);
  });

  it('preserves the selected occurrence in bindPick for a later destination choice', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    produce(state, (draft) => {
      runAtom(draft, 'bindPick', {
        cardIds: ['DUP'],
        selectedDeckIndexes: [2],
        target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
        bind: '$picked',
      }, ctx);
    });

    expect(ctx.bindings.$picked).toEqual([
      { kind: 'card', cardId: 'DUP', area: 'remove', player: 'self', index: 2 },
    ]);
  });

  it('fails closed if bindPick occurrence is no longer at its selected index', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    produce(state, (draft) => {
      runAtom(draft, 'bindPick', {
        cardIds: ['DUP'],
        selectedDeckIndexes: [1],
        target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
        bind: '$picked',
      }, ctx);
    });

    expect(ctx.bindings.$picked).toEqual([]);
  });

  it('keeps the AI-selected remove occurrence index on a multi-card transfer atom', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    const resolved = resolveEffectPicks(state, {
      kind: 'atom',
      verb: 'handAddFromRemove',
      args: {
        player: 'self',
        cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 } },
      },
    } as never, ctx, { byPlayer: 'self', humanChooser: false }) as { args: Record<string, unknown> };

    expect(resolved.args).toMatchObject({ cardIds: ['DUP'], selectedDeckIndexes: [0] });
  });

  it('keeps AI union-pick source area, player, and index with the selected occurrence', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    state.players.self.partnerAreaCards = ['DUP'];

    const resolved = resolveEffectPicks(state, {
      kind: 'atom',
      verb: 'handAddFromRemove',
      args: {
        player: 'self',
        cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: ['partner-area', 'remove'], side: 'self' }, n: { min: 0, max: 1 } },
      },
    } as never, ctx, { byPlayer: 'self', humanChooser: false }) as { args: Record<string, unknown> };

    expect(resolved.args.selectedCardOccurrences).toEqual([
      { cardId: 'DUP', area: 'partner-area', player: 'self', index: 0 },
    ]);
  });

  it('gives human union candidates distinct occurrence UIDs with source area, player, and index', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    state.players.self.partnerAreaCards = ['DUP'];
    _clearPendingEffectPickQueue();

    tryRePickFromAtom(state, {
      kind: 'atom', verb: 'handAddFromRemove', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: ['remove', 'partner-area'], side: 'self' }, n: { min: 0, max: 1 } },
      },
    }, ctx, { byPlayer: 'self' });

    const pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates).toEqual([
      { uid: 'card:self:remove:DUP#0', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 0 },
      { uid: 'card:self:partner-area:DUP#0', cardId: 'DUP', player: 'self', kind: 'card', area: 'partner-area', index: 0 },
    ]);
  });

  it('resolves a direct explicit AI re-pick synchronously without surfacing a human modal', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    _clearPendingEffectPickQueue();

    tryRePickFromAtom(state, {
      kind: 'atom', verb: 'handAddFromRemove', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 } },
      },
    }, ctx, { byPlayer: 'self', humanChooser: false });

    expect(_peekPendingEffectPickQueueLength()).toBe(0);
    expect(state.players.self.remove).toEqual([]);
    expect(state.players.self.hand).toEqual(['DUP']);
  });

  it('moves the human-selected union occurrence, even when the same card ID and index exist in remove', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    state.players.self.partnerAreaCards = ['DUP'];
    const pending = {
      player: 'self',
      ownerPlayer: 'self',
      candidates: [
        { uid: 'card:self:remove:0:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 0 },
        { uid: 'card:self:partner-area:0:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'partner-area', index: 0 },
      ],
      atomVerb: 'handAddFromRemove',
      atomArgs: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: ['remove', 'partner-area'], side: 'self' }, n: { min: 0, max: 1 } },
      },
      nMin: 0, nMax: 1,
      source: { cardId: 'TEST', abilityId: 'a1', uid: 'test#1' },
    } as never;

    applyPickAndContinuation(state, pending, 'card:self:partner-area:0:DUP');

    expect(state.players.self.remove).toEqual(['DUP']);
    expect(state.players.self.partnerAreaCards).toEqual([]);
    expect(state.players.self.hand).toEqual(['DUP']);
  });

  it('moves a duplicate multi-pick in the chosen order across union areas', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    state.players.self.partnerAreaCards = ['DUP'];
    const pending = {
      player: 'self', ownerPlayer: 'self',
      candidates: [
        { uid: 'card:self:remove:0:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 0 },
        { uid: 'card:self:remove:2:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 2 },
        { uid: 'card:self:partner-area:0:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'partner-area', index: 0 },
      ],
      atomVerb: 'handAddFromRemove',
      atomArgs: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: ['remove', 'partner-area'], side: 'self' }, n: { min: 0, max: 2 } },
      },
      nMin: 0, nMax: 2,
      source: { cardId: 'TEST', abilityId: 'a1', uid: 'test#1' },
    } as never;
    const selected = ['card:self:partner-area:0:DUP', 'card:self:remove:2:DUP'];

    applyPickAndContinuation(state, pending, selected[0]!, selected);

    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(state.players.self.partnerAreaCards).toEqual([]);
    expect(state.players.self.hand).toEqual(['DUP', 'DUP']);
  });

  it('rejects a stale union multi-pick atomically without hidden movement or log', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    state.players.self.partnerAreaCards = ['DUP'];
    const pending = {
      player: 'self', ownerPlayer: 'self',
      candidates: [
        { uid: 'card:self:remove:2:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 2 },
        { uid: 'card:self:partner-area:1:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'partner-area', index: 1 },
      ],
      atomVerb: 'handAddFromRemove',
      atomArgs: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: ['remove', 'partner-area'], side: 'self' }, n: { min: 0, max: 2 } },
      },
      nMin: 0, nMax: 2,
      source: { cardId: 'TEST', abilityId: 'a1', uid: 'test#1' },
    } as never;
    const selected = ['card:self:remove:2:DUP', 'card:self:partner-area:1:DUP'];
    const before = structuredClone(state);

    applyPickAndContinuation(state, pending, selected[0]!, selected);

    expect(state.players.self.remove).toEqual(before.players.self.remove);
    expect(state.players.self.partnerAreaCards).toEqual(before.players.self.partnerAreaCards);
    expect(state.players.self.hand).toEqual(before.players.self.hand);
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:handAddFromRemove', result: 'stale-selection' });
  });

  it('keeps legacy string cardId transfer behavior', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'handAddFromRemove', { player: 'self', target: 'DUP' }, makeCtx());
    });

    expect(after.players.self.remove).toEqual(['X', 'DUP']);
    expect(after.players.self.hand).toEqual(['DUP']);
  });

  it('moves the chosen duplicate from hand to scene without removing the first matching card', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['DUP', 'X', 'DUP'];

    const after = produce(state, (draft) => {
      runAtom(draft, 'sceneEnter', {
        player: 'self', cardId: 'DUP',
        target: { kind: 'pick', query: { area: 'hand', side: 'self' } },
        selectedCardOccurrences: [{ cardId: 'DUP', area: 'hand', player: 'self', index: 2 }],
      }, makeCtx());
    });

    expect(after.players.self.scene.map((card) => card.cardId)).toEqual(['DUP']);
    expect(after.players.self.hand).toEqual(['DUP', 'X']);
  });
});
