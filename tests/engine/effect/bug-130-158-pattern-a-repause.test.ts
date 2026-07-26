import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01094 } from '@/cards/ct-p01/B01094';
import { B01094P } from '@/cards/ct-p01/B01094P';
import {
  applyChoiceAndContinuation,
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyRepeatOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectRepeatOptionalSide,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  _drainPendingEffectRepeatOptionalSide,
} from '@/engine/effect/pending-state';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { event } from '@/engine/event';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { run as runEffect } from '@/engine/effect/resolver';
import { read } from '@/engine/read';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

describe('BUG-130/158 Pattern-A continuation re-pause', () => {
  beforeEach(() => {
    registerAll();
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectOptionalSide();
    _clearPendingEffectRepeatOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  it('re-walks an explicit Pattern-A tail after a runtime short-form pick', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('D08015', 'first'), sceneChar('D08015', 'second')];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'a1' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom', verb: 'charModifyAP',
              args: { delta: 1000, max: 1, side: 'self', scope: 'turn', bind: '$picked' },
            },
            {
              kind: 'atom', verb: 'charGrantKeyword',
              args: { uid: '$picked.uid', kw: 'infiltrate', scope: 'turn' },
            },
          ],
        },
        {
          kind: 'atom', verb: 'sceneSetState',
          args: {
            uid: '$pick', state: 'sleep',
            target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
          },
        },
        {
          kind: 'atom', verb: 'charSetTurnEffect',
          args: {
            uid: '$pick', key: 'actionTargetsActive', val: true,
            target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
          },
        },
      ],
    };

    const resolved = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, source: { cardId: 'TEST', abilityId: 'a1' },
    });
    runEffect(state, resolved, ctx);
    runAllUntilEmpty(state);

    const first = _drainPendingEffectPickSide();
    expect(first?.atomVerb).toBe('charModifyAP');
    applyPickAndContinuation(state, first!, 'second');

    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb).toBe('sceneSetState');
    applyPickAndContinuation(state, second!, 'first');

    const third = _drainPendingEffectPickSide();
    expect(third?.atomVerb, 'continuation must surface its own Pattern-A pick').toBe('charSetTurnEffect');
    applyPickAndContinuation(state, third!, 'second');
    expect(read.char.ap(state, 'second')).toBe(3000);
    expect(state.players.self.scene.find(char => char.uid === 'first')?.state).toBe('sleep');
    expect(state.players.self.scene.find(char => char.uid === 'second')?.turnEffects?.actionTargetsActive).toBe(true);
  });

  it.each([B01094, B01094P])(
    '$id a1 human event-use resolves printed picks: remove to hand, then grant',
    card => {
      const state = createEmptyGameState();
      state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.case.colors = ['黄'];
      state.players.self.file = Array.from(
        { length: 4 },
        () => ({ type: 'card-back' as const, cardId: 'D08015' }),
      );
      state.players.self.hand = [card.id];
      state.players.self.remove = ['D11003'];
      state.players.self.scene = [sceneChar('D08015', 'grant-target')];
      state.players.self.deck = ['D08015', 'D08015'];

      handUseCard(state, 'self', card.id);
      runAllUntilEmpty(state);

      const add = _drainPendingEffectPickSide();
      expect(add?.atomVerb).toBe('handAddFromRemove');
      expect(add?.candidates.map(candidate => candidate.cardId)).toEqual(['D11003']);
      applyPickAndContinuation(state, add!, add!.candidates[0]!.uid);

      const grant = _drainPendingEffectPickSide();
      expect(grant?.atomVerb).toBe('charGrantKeyword');
      expect(grant?.candidates.map(candidate => candidate.uid)).toContain('grant-target');
      applyPickAndContinuation(state, grant!, 'grant-target');

      expect(state.players.self.hand).toContain('D11003');
      expect(state.players.self.remove).toContain(card.id);
      expect(read.char.hasKeyword(state, 'grant-target', '突撃[キャラ]')).toBe(true);
      expect(_drainPendingEffectPickSide()).toBeNull();
    },
  );

  it('defers an optional wrapper until the preceding runtime pick resolves', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'optional' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
        },
        { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, source: { cardId: 'TEST', abilityId: 'optional' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    expect(add.atomVerb).toBe('handAddFromRemove');
    expect(_drainPendingEffectOptionalSide()).toBeNull();
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);

    const optional = _drainPendingEffectOptionalSide();
    expect(optional).not.toBeNull();
    applyOptionalAndContinuation(state, optional!, true);
    expect(state.players.self.hand).toHaveLength(2);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectOptionalSide()).toBeNull();
  });

  it('defers repeatOptional until the preceding runtime pick is declined', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'repeat' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
        },
        { kind: 'repeatOptional', max: 1, body: { kind: 'atom', verb: 'noop', args: {} } },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, source: { cardId: 'TEST', abilityId: 'repeat' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    expect(add.atomVerb).toBe('handAddFromRemove');
    expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
    applyPickSkipAndContinuation(state, add, false);

    const repeat = _drainPendingEffectRepeatOptionalSide();
    expect(repeat).not.toBeNull();
    applyRepeatOptionalAndContinuation(state, repeat!, false);
    expect(state.players.self.hand).toHaveLength(0);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
  });

  const decisionCases: Array<{ label: string; decision: Effect }> = [
    {
      label: 'choice',
      decision: {
        kind: 'choice', chooser: 'owner',
        options: [
          { kind: 'atom', verb: 'noop', args: {} },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      },
    },
    {
      label: 'optional',
      decision: { kind: 'optional', effect: { kind: 'atom', verb: 'noop', args: {} } },
    },
    {
      label: 'traitChoice',
      decision: {
        kind: 'traitChoice', bind: '$trait',
        then: { kind: 'atom', verb: 'noop', args: {} },
      },
    },
    {
      label: 'repeatOptional',
      decision: {
        kind: 'repeatOptional', max: 1,
        body: { kind: 'atom', verb: 'noop', args: {} },
      },
    },
  ];

  it.each(decisionCases)(
    'keeps an outer mutation behind nested $label until the decision resolves',
    ({ label, decision }) => {
      const state = createEmptyGameState();
      state.players.self.remove = ['D11003'];
      state.players.self.deck = ['D08015', 'D08015'];
      const ctx: EffectCtx = {
        source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: label },
        bindings: {},
      };
      const effect: Effect = {
        kind: 'sequence',
        steps: [
          {
            kind: 'sequence',
            steps: [
              {
                kind: 'atom', verb: 'handAddFromRemove',
                args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
              },
              decision,
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      };

      runEffect(state, resolveEffectPicks(state, effect, ctx, {
        byPlayer: 'self', humanChooser: true, source: { cardId: 'TEST', abilityId: label },
      }), ctx);
      const add = _drainPendingEffectPickSide()!;
      expect(add.atomVerb).toBe('handAddFromRemove');
      applyPickAndContinuation(state, add, add.candidates[0]!.uid);

      // The outer draw belongs after the nested decision, not merely after PB.
      expect(state.players.self.deck).toHaveLength(2);
      if (label === 'choice' || label === 'traitChoice') {
        applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
      } else if (label === 'optional') {
        applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);
      } else {
        applyRepeatOptionalAndContinuation(state, _drainPendingEffectRepeatOptionalSide()!, false);
      }

      expect(state.players.self.deck).toHaveLength(1);
      expect(_drainPendingEffectPickSide()).toBeNull();
      expect(_drainPendingEffectChoiceSide()).toBeNull();
      expect(_drainPendingEffectOptionalSide()).toBeNull();
      expect(_drainPendingEffectRepeatOptionalSide()).toBeNull();
    },
  );

  it.each(['self', 'opp'] as const)(
    'keeps nested choice order for a $s human owner',
    owner => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = owner;
      const state = createEmptyGameState();
      state.players[owner].remove = ['D11003'];
      state.players[owner].deck = ['D08015', 'D08015'];
      const ctx: EffectCtx = {
        source: { player: owner, area: 'scene', cardId: 'TEST', abilityId: owner },
        bindings: {},
      };
      const effect: Effect = {
        kind: 'sequence',
        steps: [
          {
            kind: 'sequence',
            steps: [
              {
                kind: 'atom', verb: 'handAddFromRemove',
                args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
              },
              {
                kind: 'choice', chooser: 'owner',
                options: [
                  { kind: 'atom', verb: 'noop', args: {} },
                  { kind: 'atom', verb: 'noop', args: {} },
                ],
              },
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      };
      runEffect(state, resolveEffectPicks(state, effect, ctx, {
        byPlayer: owner, humanChooser: true, humanPlayer: owner,
        source: { cardId: 'TEST', abilityId: owner },
      }), ctx);
      const add = _drainPendingEffectPickSide()!;
      applyPickAndContinuation(state, add, add.candidates[0]!.uid);
      expect(state.players[owner].deck).toHaveLength(2);
      const choice = _drainPendingEffectChoiceSide();
      expect(choice?.player).toBe(owner);
      applyChoiceAndContinuation(state, choice!, 0);
      expect(state.players[owner].deck).toHaveLength(1);
    },
  );

  it('runs the AI nested decision and outer mutation without human pending state', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'ai' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom', verb: 'handAddFromRemove',
              args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
            },
            {
              kind: 'choice', chooser: 'owner',
              options: [
                { kind: 'atom', verb: 'noop', args: {} },
                { kind: 'atom', verb: 'noop', args: {} },
              ],
            },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    };
    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: false, humanPlayer: null,
      source: { cardId: 'TEST', abilityId: 'ai' },
    }), ctx);
    runAllUntilEmpty(state);

    expect(state.players.self.hand).toHaveLength(2);
    expect(state.players.self.deck).toHaveLength(1);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(_drainPendingEffectChoiceSide()).toBeNull();
  });

  it('runs an observer queued by the decision after the resumed outer mutation', () => {
    const observedDeckLengths: number[] = [];
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'observer' },
      bindings: {},
    };
    const decision: Effect = {
      kind: 'choice', chooser: 'owner',
      options: [
        {
          kind: 'custom',
          fn: current => event.queue(
            current,
            { kind: 'custom', fn: observed => observedDeckLengths.push(observed.players.self.deck.length) },
            { player: 'self', cardId: 'TEST' },
            'effect:observer-order',
          ),
        },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom', verb: 'handAddFromRemove',
              args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
            },
            decision,
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    };
    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'observer' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);
    expect(state.players.self.deck).toHaveLength(2);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(state.players.self.deck).toHaveLength(1);
    expect(observedDeckLengths).toEqual([1]);
  });

  it('surfaces a zero-candidate hand sceneEnter before its later Pattern-A pick', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('D08015', 'grant-target')];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'zero-enter' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'sceneEnter',
          args: {
            player: 'self', from: 'hand', cardId: '$pick.cardId',
            target: {
              kind: 'pick',
              query: { area: 'hand', side: 'self', filter: { kind: 'character', color: '緑' } },
              n: { min: 0, max: 1 }, chooser: 'self',
            },
          },
        },
        {
          kind: 'atom', verb: 'charGrantKeyword',
          args: {
            uid: '$pick', kw: '突撃[キャラ]', scope: 'turn',
            target: {
              kind: 'pick', query: { area: 'scene', side: 'self' },
              n: { min: 0, max: 1 }, chooser: 'self',
            },
          },
        },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'zero-enter' },
    }), ctx);

    const enter = _drainPendingEffectPickSide();
    expect(enter?.atomVerb).toBe('sceneEnter');
    expect(enter?.candidates).toEqual([]);
    applyPickSkipAndContinuation(state, enter!);

    const grant = _drainPendingEffectPickSide();
    expect(grant?.atomVerb).toBe('charGrantKeyword');
    applyPickAndContinuation(state, grant!, 'grant-target');
    expect(read.char.hasKeyword(state, 'grant-target', '突撃[キャラ]')).toBe(true);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it.each(['choice', 'optional', 'repeatOptional'] as const)(
    'preserves a direct chain gate across deferred $decision',
    decision => {
      const state = createEmptyGameState();
      state.players.self.remove = ['D11003'];
      state.players.self.deck = ['D08015', 'D08015'];
      const stop: Effect = {
        kind: 'custom',
        fn: (_current, decisionCtx) => { (decisionCtx.dyn ??= {}).chainStepNoApply = true; },
      };
      const wrapper: Effect = decision === 'choice'
        ? { kind: 'choice', chooser: 'owner', options: [stop, { kind: 'atom', verb: 'noop', args: {} }] }
        : decision === 'optional'
          ? { kind: 'optional', effect: stop }
          : { kind: 'repeatOptional', max: 1, body: stop };
      const ctx: EffectCtx = {
        source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: `chain-${decision}` },
        bindings: {},
      };
      const effect: Effect = {
        kind: 'chain',
        steps: [
          {
            kind: 'atom', verb: 'handAddFromRemove',
            args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
          },
          wrapper,
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      };
      runEffect(state, resolveEffectPicks(state, effect, ctx, {
        byPlayer: 'self', humanChooser: true,
        source: { cardId: 'TEST', abilityId: `chain-${decision}` },
      }), ctx);
      const add = _drainPendingEffectPickSide()!;
      applyPickAndContinuation(state, add, add.candidates[0]!.uid);

      if (decision === 'choice') {
        applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
      } else if (decision === 'optional') {
        applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);
      } else {
        applyRepeatOptionalAndContinuation(state, _drainPendingEffectRepeatOptionalSide()!, true);
      }

      expect(state.players.self.deck).toHaveLength(2);
      expect(_drainPendingEffectPickSide()).toBeNull();
    },
  );

  it.each(['choice', 'optional', 'repeatOptional'] as const)(
    'preserves a chain gate nested inside a sequence for deferred $decision',
    decision => {
      const state = createEmptyGameState();
      state.players.self.remove = ['D11003'];
      state.players.self.deck = ['D08015', 'D08015'];
      const stop: Effect = {
        kind: 'custom',
        fn: (_current, decisionCtx) => { (decisionCtx.dyn ??= {}).chainStepNoApply = true; },
      };
      const wrapper: Effect = decision === 'choice'
        ? { kind: 'choice', chooser: 'owner', options: [stop, { kind: 'atom', verb: 'noop', args: {} }] }
        : decision === 'optional'
          ? { kind: 'optional', effect: stop }
          : { kind: 'repeatOptional', max: 1, body: stop };
      const ctx: EffectCtx = {
        source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: `nested-${decision}` },
        bindings: {},
      };
      const effect: Effect = {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom', verb: 'handAddFromRemove',
            args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
          },
          {
            kind: 'chain',
            steps: [wrapper, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }],
          },
        ],
      };
      runEffect(state, resolveEffectPicks(state, effect, ctx, {
        byPlayer: 'self', humanChooser: true,
        source: { cardId: 'TEST', abilityId: `nested-${decision}` },
      }), ctx);
      const add = _drainPendingEffectPickSide()!;
      applyPickAndContinuation(state, add, add.candidates[0]!.uid);
      if (decision === 'choice') {
        applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
      } else if (decision === 'optional') {
        applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);
      } else {
        applyRepeatOptionalAndContinuation(state, _drainPendingEffectRepeatOptionalSide()!, true);
      }
      expect(state.players.self.deck).toHaveLength(2);
    },
  );

  it('retains chain gating through deeply nested sequence wrappers', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const stop: Effect = {
      kind: 'custom',
      fn: (_current, decisionCtx) => { (decisionCtx.dyn ??= {}).chainStepNoApply = true; },
    };
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'deep-chain' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
        },
        {
          kind: 'sequence',
          steps: [{
            kind: 'chain',
            steps: [
              {
                kind: 'sequence',
                steps: [{
                  kind: 'choice', chooser: 'owner',
                  options: [stop, { kind: 'atom', verb: 'noop', args: {} }],
                }],
              },
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            ],
          }],
        },
      ],
    };
    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'deep-chain' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.deck).toHaveLength(2);
  });

  it('resets a stale sequence no-apply signal when entering a fresh nested chain', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'fresh-chain' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
        },
        {
          kind: 'custom',
          fn: (_current, staleCtx) => { (staleCtx.dyn ??= {}).chainStepNoApply = true; },
        },
        {
          kind: 'chain',
          steps: [
            {
              kind: 'choice', chooser: 'owner',
              options: [
                { kind: 'atom', verb: 'noop', args: {} },
                { kind: 'atom', verb: 'noop', args: {} },
              ],
            },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          ],
        },
      ],
    };
    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'fresh-chain' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.deck).toHaveLength(1);
  });

  it('surfaces a reachable choice inside a bound conditional chain after a human pick', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'conditional-chain' },
      bindings: {
        '$ready': [{ kind: 'card', cardId: 'D11003', area: 'remove', player: 'self' }],
      },
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character' } },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$ready', presence: 'matched' },
          then: {
            kind: 'chain',
            steps: [
              {
                kind: 'choice', chooser: 'owner',
                options: [
                  { kind: 'atom', verb: 'noop', args: {} },
                  { kind: 'atom', verb: 'noop', args: {} },
                ],
              },
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            ],
          },
        },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'conditional-chain' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);

    const choice = _drainPendingEffectChoiceSide();
    expect(choice, 'the conditional chain must not silently use choice option 0').not.toBeNull();
    expect(state.players.self.deck).toHaveLength(2);
    applyChoiceAndContinuation(state, choice!, 1);
    expect(state.players.self.deck).toHaveLength(1);
  });

  it('does not surface a deferred choice from a non-taken conditional branch', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'conditional-false' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character' } },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$ready', presence: 'matched' },
          then: {
            kind: 'chain',
            steps: [{
              kind: 'choice', chooser: 'owner',
              options: [
                { kind: 'atom', verb: 'noop', args: {} },
                { kind: 'atom', verb: 'noop', args: {} },
              ],
            }],
          },
          else: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'TEST', abilityId: 'conditional-false' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(state.players.self.deck).toHaveLength(1);
  });

  it('keeps an AI-owned choice inside a taken conditional non-interactive', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.self.deck = ['D08015', 'D08015'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'conditional-ai' },
      bindings: {
        '$ready': [{ kind: 'card', cardId: 'D11003', area: 'remove', player: 'self' }],
      },
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character' } },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$ready', presence: 'matched' },
          then: {
            kind: 'chain',
            steps: [
              {
                kind: 'choice', chooser: 'opp',
                options: [
                  { kind: 'atom', verb: 'noop', args: {} },
                  { kind: 'atom', verb: 'noop', args: {} },
                ],
              },
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            ],
          },
        },
      ],
    };

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, humanPlayer: 'self',
      source: { cardId: 'TEST', abilityId: 'conditional-ai' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(state.players.self.deck).toHaveLength(1);
  });

  it('preserves the AI target policy across a human-to-CPU continuation', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['D11003'];
    state.players.opp.scene = [
      sceneChar('D08015', 'ai-first'),
      sceneChar('D08015', 'ai-second'),
    ];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'mixed-owner' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'handAddFromRemove',
          args: { player: 'self', max: 1, filter: { kind: 'character', color: '黄' } },
        },
        {
          kind: 'atom', verb: 'sceneSetState',
          args: {
            uid: '$pick', state: 'sleep',
            target: {
              kind: 'pick', query: { area: 'scene', side: 'opp' },
              n: { min: 1, max: 1 }, chooser: 'opp-of-owner',
            },
          },
        },
      ],
    };
    let policyCalls = 0;
    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, humanPlayer: 'self',
      chooseAtomTarget: (_current, _verb, _args, candidates) => {
        policyCalls++;
        return candidates.find(candidate => candidate.kind === 'char' && candidate.uid === 'ai-second') ?? null;
      },
      source: { cardId: 'TEST', abilityId: 'mixed-owner' },
    }), ctx);
    const add = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, add, add.candidates[0]!.uid);

    expect(policyCalls).toBe(1);
    expect(state.players.opp.scene.find(char => char.uid === 'ai-first')?.state).toBe('active');
    expect(state.players.opp.scene.find(char => char.uid === 'ai-second')?.state).toBe('sleep');
    expect(_drainPendingEffectPickSide()).toBeNull();
  });
});
