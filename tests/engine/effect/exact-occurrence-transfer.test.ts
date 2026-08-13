import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { runAtom } from '@/engine/effect/atom-handlers';
import { resolveEffectPicks, tryRePickFromAtom } from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { cardOccurrenceUid, cardOccurrenceWitness, isLiveCardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { boundCandidate, candidates } from '@/engine/target/candidates';
import { makeCtx } from '../../helpers/fixtures';

describe('exact occurrence transfer', () => {
  it.each([
    ['top evidence to hand', 'evidenceToHand', { player: 'self', fromTop: true }],
    ['picked evidence to hand', 'evidenceToHand', { player: 'self', target: 'EVIDENCE' }],
    ['picked evidence to deck bottom', 'evidenceToDeckBottom', { player: 'self', target: 'EVIDENCE' }],
  ] as const)('invalidates an evidence occurrence after %s', (_label, verb, args) => {
    const state = createEmptyGameState();
    state.players.self.evidence = [{
      cardId: 'EVIDENCE', faceUp: true, origin: { turn: 1, via: 'effect' },
    }];
    const witness = cardOccurrenceWitness(state, 'self', 'evidence');

    runAtom(state, verb, args, makeCtx());

    expect(state.players.self.evidence).toEqual([]);
    expect(isLiveCardOccurrenceWitness(state, 'self', 'evidence', witness)).toBe(false);
  });

  it.each([
    ['handAddFromRemove', { player: 'self', target: 'DUP' }],
    ['removeAreaToDeckTop', { player: 'self', target: 'DUP' }],
    ['removeAreaAllToDeckBottom', { player: 'self' }],
    ['toPartnerArea', { player: 'self', target: 'DUP' }],
  ] as const)('invalidates the exact remove witness after %s consumes it', (_verb, args) => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const witness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, _verb, args, makeCtx());

    expect(isLiveCardOccurrenceWitness(state, 'self', 'remove', witness)).toBe(false);
  });

  it.each([
    ['handAddFromRemove', { player: 'self', target: 'MISSING' }],
    ['removeAreaToDeckTop', { player: 'self', target: 'MISSING' }],
    ['toPartnerArea', { player: 'self', target: 'MISSING' }],
  ] as const)('preserves the remove witness when %s is a no-op', (_verb, args) => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const witness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, _verb, args, makeCtx());

    expect(isLiveCardOccurrenceWitness(state, 'self', 'remove', witness)).toBe(true);
  });

  it('drops a stale remove binding instead of falling through to a generic card candidate', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const witness = cardOccurrenceWitness(state, 'self', 'remove');
    const binding = {
      kind: 'card', uid: cardOccurrenceUid('self', 'remove', 'DUP', 0), cardId: 'DUP', player: 'self', area: 'remove', index: 0, occurrenceWitness: witness,
    };
    const ctx = makeCtx({ bindings: { $picked: [binding] } });

    expect(boundCandidate(state, binding, 'self')).toMatchObject({ occurrenceWitness: witness });
    expect(candidates(state, { kind: 'fromBound', bindKey: '$picked' }, ctx)).toHaveLength(1);

    mutate.remove.removeFromHere(state, 'self', ['DUP']);
    mutate.remove.add(state, 'self', ['DUP']);

    expect(boundCandidate(state, binding, 'self')).toBeUndefined();
    expect(candidates(state, { kind: 'fromBound', bindKey: '$picked' }, ctx)).toEqual([]);
  });

  it('round-trips a canonical remove occurrence uid through boundCandidate', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    const binding = {
      kind: 'card',
      uid: cardOccurrenceUid('self', 'remove', 'DUP', 0),
      cardId: 'DUP',
      player: 'self',
      area: 'remove',
      index: 0,
      occurrenceWitness,
    };

    expect(boundCandidate(state, binding, 'self')).toMatchObject(binding);
    mutate.remove.removeFromHere(state, 'self', ['DUP']);
    mutate.remove.add(state, 'self', ['DUP']);
    expect(boundCandidate(state, binding, 'self')).toBeUndefined();
  });

  it.each(['handAddFromRemove', 'toPartnerArea'] as const)(
    'rejects a witnessless physical binding in %s',
    (verb) => {
      const state = createEmptyGameState();
      state.players.self.remove = ['DUP', 'X', 'DUP'];
      const ctx = makeCtx({
        bindings: {
          $picked: [{ kind: 'card', cardId: 'DUP', player: 'self', area: 'remove', index: 2 }],
        },
      });

      runAtom(state, verb, { player: 'self', target: '$picked.cardId', bind: '$moved' }, ctx);

      expect(state.players.self.remove).toEqual(['DUP', 'X', 'DUP']);
      expect(state.players.self.hand).toEqual([]);
      expect(state.players.self.partnerAreaCards ?? []).toEqual([]);
      expect(ctx.bindings.$moved).toEqual([]);
      expect(ctx.dyn?.chainStepNoApply).toBe(true);
    },
  );

  it.each(['handAddFromRemove', 'toPartnerArea'] as const)(
    'uses the live physical binding index when %s omits selectedCardIndex',
    (verb) => {
      const state = createEmptyGameState();
      state.players.self.remove = ['DUP', 'X', 'DUP'];
      const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
      const ctx = makeCtx({
        bindings: {
          $picked: [{ kind: 'card', cardId: 'DUP', player: 'self', area: 'remove', index: 2, occurrenceWitness }],
        },
      });

      runAtom(state, verb, { player: 'self', target: '$picked.cardId', bind: '$moved' }, ctx);

      expect(state.players.self.remove).toEqual(['DUP', 'X']);
      expect(verb === 'handAddFromRemove' ? state.players.self.hand : state.players.self.partnerAreaCards).toEqual(['DUP']);
    },
  );

  it.each(['handAddFromRemove', 'toPartnerArea'] as const)(
    'rejects an explicit index that disagrees with the physical binding in %s',
    (verb) => {
      const state = createEmptyGameState();
      state.players.self.remove = ['DUP', 'X', 'DUP'];
      const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
      const ctx = makeCtx({
        bindings: {
          $picked: [{ kind: 'card', cardId: 'DUP', player: 'self', area: 'remove', index: 2, occurrenceWitness }],
        },
      });

      runAtom(state, verb, {
        player: 'self', target: '$picked.cardId', selectedCardIndex: 0, bind: '$moved',
      }, ctx);

      expect(state.players.self.remove).toEqual(['DUP', 'X', 'DUP']);
      expect(state.players.self.hand).toEqual([]);
      expect(state.players.self.partnerAreaCards ?? []).toEqual([]);
      expect(ctx.bindings.$moved).toEqual([]);
      expect(ctx.dyn?.chainStepNoApply).toBe(true);
    },
  );

  it.each(['handAddFromRemove', 'toPartnerArea'] as const)(
    'rejects an ABA-replaced physical binding in %s',
    (verb) => {
      const state = createEmptyGameState();
      state.players.self.remove = ['DUP', 'X', 'DUP'];
      const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
      const ctx = makeCtx({
        bindings: {
          $picked: [{ kind: 'card', cardId: 'DUP', player: 'self', area: 'remove', index: 2, occurrenceWitness }],
        },
      });
      mutate.remove.removeFromHere(state, 'self', ['DUP']);
      mutate.remove.add(state, 'self', ['DUP']);
      const epochBeforeConsume = state.indexedZoneEpochs!.self.remove;

      runAtom(state, verb, { player: 'self', target: '$picked.cardId', bind: '$moved' }, ctx);

      expect(state.players.self.remove).toEqual(['X', 'DUP', 'DUP']);
      expect(state.players.self.hand).toEqual([]);
      expect(state.players.self.partnerAreaCards ?? []).toEqual([]);
      expect(state.indexedZoneEpochs!.self.remove).toBe(epochBeforeConsume);
      expect(ctx.bindings.$moved).toEqual([]);
      expect(ctx.dyn?.chainStepNoApply).toBe(true);
    },
  );

  it('keeps the legacy generic card binding fallback', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const ctx = makeCtx({ bindings: { $picked: [{ cardId: 'DUP' }] } });

    runAtom(state, 'handAddFromRemove', {
      player: 'self', target: '$picked.cardId', bind: '$moved',
    }, ctx);

    expect(state.players.self.remove).toEqual(['X', 'DUP']);
    expect(state.players.self.hand).toEqual(['DUP']);
  });

  it('moves the selected duplicate from remove and binds its destination', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

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
      { kind: 'card', cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness: cardOccurrenceWitness(state, 'self', 'remove') },
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
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    const resolved = resolveEffectPicks(state, {
      kind: 'atom',
      verb: 'handAddFromRemove',
      args: {
        player: 'self',
        cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 } },
      },
    } as never, ctx, { byPlayer: 'self', humanChooser: false }) as { args: Record<string, unknown> };

    expect(resolved.args).toMatchObject({
      cardIds: ['DUP'],
      selectedDeckIndexes: [0],
      selectedCardOccurrences: [{
        uid: cardOccurrenceUid('self', 'remove', 'DUP', 0),
        cardId: 'DUP',
        area: 'remove',
        player: 'self',
        index: 0,
        occurrenceWitness,
      }],
    });
  });

  it('keeps the canonical uid on an AI-selected single-card occurrence', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    const resolved = resolveEffectPicks(state, {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        cardId: '$pick.cardId',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 } },
      },
    } as never, ctx, { byPlayer: 'self', humanChooser: false }) as { args: Record<string, unknown> };

    expect(resolved.args.selectedCardOccurrences).toEqual([{
      uid: cardOccurrenceUid('self', 'remove', 'DUP', 0),
      cardId: 'DUP',
      area: 'remove',
      player: 'self',
      index: 0,
      occurrenceWitness,
    }]);
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
      { uid: cardOccurrenceUid('self', 'partner-area', 'DUP', 0), cardId: 'DUP', area: 'partner-area', player: 'self', index: 0 },
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
      { uid: 'card:self:remove:DUP#0', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 0, occurrenceWitness: cardOccurrenceWitness(state, 'self', 'remove') },
      { uid: 'card:self:partner-area:DUP#0', cardId: 'DUP', player: 'self', kind: 'card', area: 'partner-area', index: 0 },
    ]);
  });

  it('does not expose hidden remove-zone contents through a pending UI candidate', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['PUBLIC', 'HIDDEN-IDENTITY'];
    _clearPendingEffectPickQueue();

    tryRePickFromAtom(state, {
      kind: 'atom', verb: 'handAddFromRemove', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 } },
      },
    }, ctx, { byPlayer: 'self' });

    const pending = _drainPendingEffectPickSide()!;
    expect(pending.candidates[0]?.occurrenceWitness).not.toContain('HIDDEN-IDENTITY');
    expect(pending.candidates[0]?.occurrenceWitness).toMatch(/^occ:/);
  });

  it('rejects an ABA-replaced remove occurrence even when its card ID and index are restored', () => {
    const ctx = makeCtx();
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    _clearPendingEffectPickQueue();

    tryRePickFromAtom(state, {
      kind: 'atom', verb: 'handAddFromRemove', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 1, max: 1 } },
      },
    }, ctx, { byPlayer: 'self' });

    const pending = _drainPendingEffectPickSide()!;
    state.players.self.deck = ['CONTINUATION'];
    pending.continuation = {
      kind: 'sequence',
      remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }],
      ctx,
    };
    // The selected physical card leaves; a content-equal duplicate then takes its place.
    mutate.remove.removeFromHere(state, 'self', ['DUP']);
    mutate.remove.add(state, 'self', ['DUP']);
    applyPickAndContinuation(state, pending, pending.candidates[0]!.uid);

    expect(state.players.self.remove).toEqual(['DUP']);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.deck).toEqual(['CONTINUATION']);
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:pick', result: 'stale-selection' });
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
        { uid: 'card:self:remove:0:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 0, occurrenceWitness: cardOccurrenceWitness(state, 'self', 'remove') },
        { uid: 'card:self:remove:2:DUP', cardId: 'DUP', player: 'self', kind: 'card', area: 'remove', index: 2, occurrenceWitness: cardOccurrenceWitness(state, 'self', 'remove') },
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
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:pick', result: 'stale-selection' });
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

  it('rejects an exact remove occurrence whose canonical uid names another copy', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, 'handAddFromRemove', {
      player: 'self', target: 'DUP',
      selectedCardOccurrences: [{
        uid: cardOccurrenceUid('self', 'remove', 'DUP', 0),
        cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness,
      }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP', 'X', 'DUP']);
    expect(state.players.self.hand).toEqual([]);
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:handAddFromRemove', result: 'stale-selection' });
  });

  it('keeps canonical evidence occurrences on an autonomous multi-pick', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
    ];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'evidence');

    const resolved = resolveEffectPicks(state, {
      kind: 'atom', verb: 'evidenceFlip', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'evidence', side: 'self', faceDown: true }, n: { min: 0, max: 2 } },
      },
    } as never, makeCtx(), { byPlayer: 'self', humanChooser: false }) as { args: Record<string, unknown> };

    expect(resolved.args.selectedCardOccurrences).toEqual([
      { uid: 'evidence:self:0', cardId: 'DUP', area: 'evidence', player: 'self', index: 0, occurrenceWitness },
      { uid: 'evidence:self:1', cardId: 'DUP', area: 'evidence', player: 'self', index: 1, occurrenceWitness },
    ]);
  });

  it('keeps the human-selected evidence occurrence through pending-pick application', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'X', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
    ];
    const ctx = makeCtx();
    _clearPendingEffectPickQueue();
    tryRePickFromAtom(state, {
      kind: 'atom', verb: 'evidenceFlip', args: {
        player: 'self', cardIds: '$pick.cardIds',
        target: { kind: 'pick', query: { area: 'evidence', side: 'self', faceDown: true }, n: { min: 0, max: 1 } },
      },
    }, ctx, { byPlayer: 'self' });
    const pending = _drainPendingEffectPickSide()!;

    applyPickAndContinuation(state, pending, 'evidence:self:2', ['evidence:self:2']);

    expect(state.players.self.evidence.map(({ faceUp }) => faceUp)).toEqual([false, false, true]);
  });

  it.each([
    ['evidenceFlip', false, true],
    ['evidenceFlipDown', true, false],
  ] as const)('%s changes the selected duplicate evidence occurrence', (verb, beforeFaceUp, afterFaceUp) => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: beforeFaceUp, origin: { turn: 1, via: 'effect' } },
      { cardId: 'X', faceUp: beforeFaceUp, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: beforeFaceUp, origin: { turn: 1, via: 'effect' } },
    ];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'evidence');

    runAtom(state, verb, {
      player: 'self', target: 'DUP',
      selectedCardOccurrences: [{ uid: 'evidence:self:2', cardId: 'DUP', area: 'evidence', player: 'self', index: 2, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.evidence.map((evidence) => evidence.faceUp)).toEqual([
      beforeFaceUp, beforeFaceUp, afterFaceUp,
    ]);
  });

  it.each(['evidenceToHand', 'evidenceToDeckBottom'] as const)(
    '%s moves the selected duplicate evidence occurrence',
    (verb) => {
      const state = createEmptyGameState();
      state.players.self.evidence = [
        { cardId: 'DUP', faceUp: true, origin: { turn: 1, via: 'effect' } },
        { cardId: 'X', faceUp: true, origin: { turn: 1, via: 'effect' } },
        { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      ];
      const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'evidence');

      runAtom(state, verb, {
        player: 'self', target: 'DUP',
        selectedCardOccurrences: [{ uid: 'evidence:self:2', cardId: 'DUP', area: 'evidence', player: 'self', index: 2, occurrenceWitness }],
      }, makeCtx());

      expect(state.players.self.evidence.map(({ cardId }) => cardId)).toEqual(['DUP', 'X']);
      expect(verb === 'evidenceToHand' ? state.players.self.hand : state.players.self.deck).toEqual(['DUP']);
    },
  );

  it('flips the exact duplicate evidence occurrences in a multi-pick', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'X', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
    ];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'evidence');

    runAtom(state, 'evidenceFlip', {
      player: 'self', cardIds: ['DUP'],
      selectedCardOccurrences: [{ uid: 'evidence:self:2', cardId: 'DUP', area: 'evidence', player: 'self', index: 2, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.evidence.map((evidence) => evidence.faceUp)).toEqual([false, false, true]);
  });

  it('rejects duplicate exact evidence occurrences atomically in a multi-pick', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
    ];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'evidence');
    const occurrence = {
      uid: 'evidence:self:0', cardId: 'DUP', area: 'evidence' as const,
      player: 'self' as const, index: 0, occurrenceWitness,
    };

    runAtom(state, 'evidenceFlip', {
      player: 'self', cardIds: ['DUP', 'DUP'],
      selectedCardOccurrences: [occurrence, occurrence],
    }, makeCtx());

    expect(state.players.self.evidence.map((evidence) => evidence.faceUp)).toEqual([false, false]);
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:evidenceFlip', result: 'stale-selection' });
  });

  it.each(['evidenceFlip', 'evidenceFlipDown', 'evidenceToHand', 'evidenceToDeckBottom'] as const)(
    '%s rejects an ABA-replaced evidence occurrence',
    (verb) => {
      const initial = createEmptyGameState();
      const selectedFaceUp = verb !== 'evidenceFlip';
      initial.players.self.evidence = [
        { cardId: 'DUP', faceUp: selectedFaceUp, origin: { turn: 1, via: 'effect' } },
      ];
      const occurrenceWitness = cardOccurrenceWitness(initial, 'self', 'evidence');
      const state = structuredClone(produce(initial, (draft) => {
        mutate.evidence.removeTop(draft, 'self');
        mutate.evidence.gainCard(draft, 'self', 'DUP', selectedFaceUp, { turn: 1, via: 'effect' }, 'none');
      }));
      const before = structuredClone(state);

      runAtom(state, verb, {
        player: 'self', target: 'DUP',
        selectedCardOccurrences: [{ uid: 'evidence:self:0', cardId: 'DUP', area: 'evidence', player: 'self', index: 0, occurrenceWitness }],
      }, makeCtx());

      expect(state.players.self.evidence).toEqual(before.players.self.evidence);
      expect(state.players.self.hand).toEqual([]);
      expect(state.players.self.deck).toEqual([]);
    },
  );

  it('moves the selected duplicate from remove to deck top', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, 'removeAreaToDeckTop', {
      player: 'self', target: 'DUP',
      selectedCardOccurrences: [{ uid: cardOccurrenceUid('self', 'remove', 'DUP', 2), cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(state.players.self.deck).toEqual(['DUP']);
  });

  it('enters the selected duplicate from remove in the single scene-enter path', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, 'sceneEnter', {
      player: 'self', cardId: 'DUP', sourceRequired: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(state.players.self.scene.map((card) => card.cardId)).toEqual(['DUP']);
  });

  it('rejects a stale non-autonomous single scene-enter occurrence', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    mutate.remove.add(state, 'self', ['X']);

    runAtom(state, 'sceneEnter', {
      player: 'self', cardId: 'DUP', sourceRequired: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'remove', player: 'self', index: 0, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(state.players.self.scene).toEqual([]);
  });

  it('rejects an autonomous scene-enter occurrence after remove/re-add ABA', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    mutate.remove.removeFromHere(state, 'self', ['DUP']);
    mutate.remove.add(state, 'self', ['DUP']);

    runAtom(state, 'sceneEnter', {
      player: 'self', cardId: 'DUP', sourceRequired: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'remove', player: 'self', index: 0, occurrenceWitness }],
      __causalDecisionActor: 'self',
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP']);
    expect(state.players.self.scene).toEqual([]);
  });

  it('does not fall back by card ID when an autonomous scene-enter index is stale', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    mutate.remove.removeFromHere(state, 'self', ['DUP']);

    runAtom(state, 'sceneEnter', {
      player: 'self', cardId: 'DUP', sourceRequired: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness }],
      __causalDecisionActor: 'self',
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['X', 'DUP']);
    expect(state.players.self.scene).toEqual([]);
  });

  it('enters the selected duplicate from remove in the multi scene-enter path', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');

    runAtom(state, 'sceneEnter', {
      player: 'self', cardIds: ['DUP'], sourceRequired: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'remove', player: 'self', index: 2, occurrenceWitness }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(state.players.self.scene.map((card) => card.cardId)).toEqual(['DUP']);
  });

  it('enters the selected union occurrence instead of a same-ID remove copy', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    state.players.self.partnerAreaCards = ['DUP'];

    runAtom(state, 'sceneEnter', {
      player: 'self', cardId: 'DUP', sourceRequired: true,
      target: { kind: 'pick', query: { area: ['remove', 'partner-area'], side: 'self' } },
      selectedCardOccurrences: [{ cardId: 'DUP', area: 'partner-area', player: 'self', index: 0 }],
    }, makeCtx());

    expect(state.players.self.remove).toEqual(['DUP']);
    expect(state.players.self.partnerAreaCards).toEqual([]);
    expect(state.players.self.scene.map((card) => card.cardId)).toEqual(['DUP']);
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
