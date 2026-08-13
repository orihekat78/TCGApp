import { beforeEach, describe, expect, it } from 'vitest';
import { B09055 } from '@/cards/ct-p09/B09055';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import type { Candidate, CardDef, Effect, EffectCtx } from '@/engine/types';
import { makeCtx, sceneChar } from '../../helpers/fixtures';

function chooseLastRemoveDuplicate(
  _state: ReturnType<typeof createEmptyGameState>,
  atomVerb: string,
  _args: Readonly<Record<string, unknown>>,
  candidates: ReadonlyArray<Candidate>,
): Candidate | null {
  if (atomVerb === 'handAddFromRemove') {
    return [...candidates].reverse().find(candidate => candidate.kind === 'card' && candidate.cardId === 'DUP') ?? null;
  }
  return candidates[0] ?? null;
}

function resolveForAi(state: ReturnType<typeof createEmptyGameState>, effect: Effect, ctx: EffectCtx): Effect {
  return resolveEffectPicks(state, effect, ctx, {
    byPlayer: 'self',
    humanChooser: false,
    chooseAtomTarget: chooseLastRemoveDuplicate,
    source: { cardId: 'TEST', abilityId: 'a1' },
  });
}

describe('indexed Pattern-B runtime ordering', () => {
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('selects a generic duplicate from the post-discard remove state', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['DUP'];
    state.players.self.remove = ['DUP', 'X'];
    const ctx = makeCtx();
    const effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'discard', args: {
            player: 'self',
            target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
          },
        },
        {
          kind: 'atom', verb: 'handAddFromRemove', args: {
            player: 'self',
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { cardId: 'DUP' } },
              n: { min: 1, max: 1 },
              chooser: 'owner',
            },
          },
        },
      ],
    } as Effect;

    const resolved = resolveForAi(state, effect, ctx) as Extract<Effect, { kind: 'sequence' }>;
    expect((resolved.steps[1] as Extract<Effect, { kind: 'atom' }>).args).toMatchObject({
      target: { kind: 'pick', query: { area: 'remove' } },
    });

    runEffect(state, resolved, ctx);

    expect(state.players.self.hand).toEqual(['DUP']);
    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('selects a mixed-area union duplicate from the post-discard remove state', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['DUP'];
    state.players.self.remove = ['DUP', 'X'];
    const ctx = makeCtx();
    const effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'discard', args: {
            player: 'self',
            target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
          },
        },
        {
          kind: 'atom', verb: 'handAddFromRemove', args: {
            player: 'self',
            target: {
              kind: 'pick',
              query: { area: ['remove', 'partner-area'], side: 'self', filter: { cardId: 'DUP' } },
              n: { min: 1, max: 1 },
              chooser: 'owner',
            },
          },
        },
      ],
    } as Effect;

    const resolved = resolveForAi(state, effect, ctx) as Extract<Effect, { kind: 'sequence' }>;
    expect((resolved.steps[1] as Extract<Effect, { kind: 'atom' }>).args).toMatchObject({
      target: { kind: 'pick', query: { area: ['remove', 'partner-area'] } },
    });

    runEffect(state, resolved, ctx);

    expect(state.players.self.hand).toEqual(['DUP']);
    expect(state.players.self.remove).toEqual(['DUP', 'X']);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('resolves the B09055 a2 mixed-area union for a nonhuman after removing its source', () => {
    const effect = B09055.abilities.find(ability => ability.id === 'a2')!.effect as Extract<Effect, { kind: 'sequence' }>;
    const enter = effect.steps[1] as Extract<Effect, { kind: 'atom' }>;
    const targetName = ((enter.args.target as { query: { filter: { cardName: string } } }).query.filter.cardName);
    const targetDef: CardDef = {
      id: 'B09055-TARGET',
      no: 'B09055-TARGET',
      kind: 'character',
      names: [targetName],
      colors: ['red'],
      level: 3,
      ap: 3000,
      lp: 1,
      traits: [],
      rarity: 'C',
      imageUrl: '',
      abilities: [],
      ruleRefs: [],
    };
    registerCardDef(B09055);
    registerCardDef(targetDef);

    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('B09055', 'b09055#1')];
    state.players.self.remove = [targetDef.id];
    const ctx = makeCtx({
      source: { player: 'self', area: 'scene', cardId: 'B09055', uid: 'b09055#1', abilityId: 'a2' },
    });

    const resolved = resolveForAi(state, effect, ctx) as Extract<Effect, { kind: 'sequence' }>;
    expect((resolved.steps[1] as Extract<Effect, { kind: 'atom' }>).args.target).toMatchObject({
      kind: 'pick',
      query: { area: ['partner-area', 'remove'] },
    });

    runEffect(state, resolved, ctx);

    expect(state.players.self.scene.map(card => card.cardId)).toEqual([targetDef.id]);
    expect(state.players.self.remove).toEqual(['B09055']);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('fails closed when a top-level generic duplicate is removed and re-added at the same index', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP', 'X', 'DUP'];
    const ctx = makeCtx();
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    const effect = {
      kind: 'atom', verb: 'handAddFromRemove', args: {
        player: 'self',
        target: {
          kind: 'pick',
          query: { area: 'remove', side: 'self', filter: { cardId: 'DUP' } },
          n: { min: 1, max: 1 },
          chooser: 'owner',
        },
      },
    } as Effect;

    const resolved = resolveForAi(state, effect, ctx) as Extract<Effect, { kind: 'atom' }>;
    expect((resolved.args as { selectedCardOccurrences?: unknown }).selectedCardOccurrences).toEqual([{
      uid: cardOccurrenceUid('self', 'remove', 'DUP', 2),
      cardId: 'DUP',
      area: 'remove',
      player: 'self',
      index: 2,
      occurrenceWitness,
    }]);

    mutate.remove.removeFromHere(state, 'self', ['DUP']);
    mutate.remove.add(state, 'self', ['DUP']);
    runEffect(state, resolved, ctx);

    expect(state.players.self.remove).toEqual(['X', 'DUP', 'DUP']);
    expect(state.players.self.hand).toEqual([]);
    expect(state.log.at(-1)).toMatchObject({ action: 'effect:handAddFromRemove', result: 'stale-selection' });
  });

  it('keeps human printed order and resolves the later pick from post-discard state', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['HAND'];
    state.players.self.remove = ['OLD'];
    const ctx = makeCtx();
    const effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'discard', args: {
            player: 'self',
            target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
          },
        },
        {
          kind: 'atom', verb: 'handAddFromRemove', args: {
            player: 'self',
            target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
          },
        },
      ],
    } as Effect;

    const resolved = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self',
      humanChooser: true,
      humanPlayer: 'self',
      source: { cardId: 'TEST', abilityId: 'a1' },
    });
    runEffect(state, resolved, ctx);

    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const discardPick = _drainPendingEffectPickSide()!;
    expect(discardPick.atomVerb).toBe('discard');
    applyPickAndContinuation(state, discardPick, discardPick.candidates[0]!.uid);

    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const removePick = _drainPendingEffectPickSide()!;
    expect(removePick.atomVerb).toBe('handAddFromRemove');
    expect(removePick.candidates.map(candidate => candidate.cardId)).toEqual(['OLD', 'HAND']);
  });

  it('selects multiple duplicate evidence occurrences after a prior indexed mutation', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'DUP', faceUp: false, origin: { turn: 1, via: 'effect' } },
      { cardId: 'HEAD', faceUp: false, origin: { turn: 1, via: 'effect' } },
    ];
    const ctx = makeCtx();
    const effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', fromTop: true } },
        {
          kind: 'atom', verb: 'evidenceFlip', args: {
            player: 'self',
            cardIds: '$pick.cardIds',
            target: {
              kind: 'pick',
              query: { area: 'evidence', side: 'self', faceDown: true },
              n: { min: 0, max: 2 },
              chooser: 'owner',
            },
          },
        },
      ],
    } as Effect;

    const resolved = resolveForAi(state, effect, ctx) as Extract<Effect, { kind: 'sequence' }>;
    expect((resolved.steps[1] as Extract<Effect, { kind: 'atom' }>).args).toMatchObject({
      cardIds: '$pick.cardIds',
      target: { kind: 'pick', query: { area: 'evidence' } },
    });

    runEffect(state, resolved, ctx);

    expect(state.players.self.hand).toEqual(['HEAD']);
    expect(state.players.self.evidence).toEqual([
      expect.objectContaining({ cardId: 'DUP', faceUp: true }),
      expect.objectContaining({ cardId: 'DUP', faceUp: true }),
    ]);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });
});
