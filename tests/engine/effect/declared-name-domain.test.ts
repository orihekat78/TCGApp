import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { ALL_CARDS, registerAll } from '@/cards';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { runAllUntilEmpty } from '@/engine/resolve';
import { runAtom } from '@/engine/effect/atom-handlers';
import { applyRpsAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingRpsSide } from '@/engine/effect/pending-state';
import { validate } from '@/engine/effect/validate';
import {
  declaredNameCandidates,
  findDeclareNameSpec,
  isDeclaredNameAllowed,
  resolveDeclaredName,
} from '@/engine/effect/declared-name-domain';
import { assertPendingRuntimeValue } from '@/engine/effect/pending-runtime-schema';
import {
  hydratePendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';

const { loadCorpus } = require('../../../scripts/compiler/tsv-corpus.cjs') as {
  loadCorpus(root: string): Array<{ id: string; kind: string; title: string }>;
};

function card(
  id: string,
  kind: CardDef['kind'],
  names: string[],
): CardDef {
  return {
    id,
    no: id,
    kind,
    names,
    colors: ['blue'],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...(kind === 'character' ? { level: 1, ap: 1000, lp: 1 } : {}),
  } as CardDef;
}

describe('registered character declared-name domain', () => {
  beforeEach(() => {
    _resetRegistry();
    event._resetRegistry();
    resetPendingRuntimeState();
    register(card('CHAR', 'character', ['服部平次&遠山和葉']));
    register(card('MOURI_KOGORO', 'character', ['毛利小五郎']));
    register(card('MOURI_RAN', 'character', ['毛利蘭']));
    register(card('EVENT', 'event', ['事件名']));
  });

  it('canonicalizes exact, unique abbreviated, and one-error names but rejects ambiguity', () => {
    expect(resolveDeclaredName('registered-character-card-name', '  毛利小五郎  ')).toBe('毛利小五郎');
    expect(resolveDeclaredName('registered-character-card-name', '小五郎')).toBe('毛利小五郎');
    expect(resolveDeclaredName('registered-character-card-name', '毛利小五朗')).toBe('毛利小五郎');
    expect(resolveDeclaredName('registered-character-card-name', '毛利')).toBeNull();
    expect(resolveDeclaredName('registered-character-card-name', '事件名')).toBeNull();
  });

  it('canonicalizes a unique registered name across card kinds', () => {
    const domain = 'registered-card-name';
    expect(resolveDeclaredName(domain, '事件')).toBe('事件名');
    expect(declaredNameCandidates(domain)).toContain('事件名');
  });

  it('accepts the registered-card-name domain during static validation', () => {
    const result = validate({
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'registered-card-name' },
    } as unknown as Effect);
    expect(result).toEqual({ ok: true });
  });

  it('hydrates an exact legacy unrestricted queue for an explicitly migrated card-name ability', () => {
    const currentEffect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    } as Effect;
    const legacyEffect: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    };
    register({
      ...card('B04048', 'character', ['羽田秀𠮷']),
      abilities: [{
        id: 'a2', type: 'declared', scope: 'on-scene', effect: currentEffect,
        description: 'registered card-name migration fixture', ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    event.queue(
      state,
      legacyEffect,
      { player: 'self', area: 'scene', cardId: 'B04048', abilityId: 'a2', uid: 'B04048#legacy' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self', area: 'scene', cardId: 'B04048', abilityId: 'a2', uid: 'B04048#legacy',
            },
            bindings: {},
            dyn: { declaredName: 'Legacy Free Text' },
            declaredNames: { named: 'Legacy Free Text' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).not.toThrow();
  });

  it.each([
    {
      label: 'altered queued effect',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      } as Effect,
      ctxPatch: {
        dyn: { declaredName: 'Legacy Free Text' },
        declaredNames: { named: 'Legacy Free Text' },
      },
      error: /queued declaration lineage/i,
    },
    {
      label: 'dyn-only authority',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      } as Effect,
      ctxPatch: { dyn: { declaredName: 'Legacy Free Text' } },
      error: /declaredNames/i,
    },
    {
      label: 'extra declared-name key',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      } as Effect,
      ctxPatch: {
        dyn: { declaredName: 'Legacy Free Text' },
        declaredNames: { named: 'Legacy Free Text', extra: 'forged' },
      },
      error: /exactly|declaredNames/i,
    },
    {
      label: 'mismatched dyn value',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      } as Effect,
      ctxPatch: {
        dyn: { declaredName: 'Other Value' },
        declaredNames: { named: 'Legacy Free Text' },
      },
      error: /matching legacy declared name|dyn/i,
    },
    {
      label: 'wrong legacy domain map',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      } as Effect,
      ctxPatch: {
        dyn: { declaredName: 'Legacy Free Text' },
        declaredNames: { named: 'Legacy Free Text' },
        declaredNameDomains: { named: 'registered-character-card-name' },
      },
      error: /declaredNameDomains|unrestricted|not allowed/i,
    },
    {
      label: 'extra legacy domain key',
      legacyEffect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      } as Effect,
      ctxPatch: {
        dyn: { declaredName: 'Legacy Free Text' },
        declaredNames: { named: 'Legacy Free Text' },
        declaredNameDomains: { named: 'unrestricted', extra: 'unrestricted' },
      },
      error: /exactly|declaredNameDomains/i,
    },
  ])('rejects a forged migrated legacy queue with $label', ({ legacyEffect, ctxPatch, error }) => {
    const currentEffect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    } as Effect;
    register({
      ...card('B04048', 'character', ['羽田秀𠮷']),
      abilities: [{
        id: 'a2', type: 'declared', scope: 'on-scene', effect: currentEffect,
        description: 'registered card-name migration fixture', ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    event.queue(
      state,
      legacyEffect,
      { player: 'self', area: 'scene', cardId: 'B04048', abilityId: 'a2', uid: 'B04048#legacy' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self', area: 'scene', cardId: 'B04048', abilityId: 'a2', uid: 'B04048#legacy',
            },
            bindings: {},
            ...ctxPatch,
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(error);
  });

  it('writes the canonical declared name back to dyn before later atoms consume it', () => {
    const state = createEmptyGameState();
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene' },
      bindings: {},
      dyn: { declaredName: '  小五郎  ' },
    };
    runAtom(state, 'declareName', {
      bind: 'named',
      domain: 'registered-character-card-name',
    }, ctx);
    expect(ctx.declaredNames?.named).toBe('毛利小五郎');
    expect(ctx.dyn?.declaredName).toBe('毛利小五郎');
  });

  it('defers legacy no-domain declaration maps to state-aware authority validation', () => {
    const continuation = {
      remainder: [],
      ctx: {
        source: { player: 'self', area: 'scene' },
        bindings: {},
        declaredNames: { named: '毛利小五郎' },
      },
      kind: 'sequence',
    };
    expect(() => assertPendingRuntimeValue('__pendingRpsContinuation', continuation, { mode: 'persisted' }))
      .not.toThrow();
    expect(() => assertPendingRuntimeValue('__pendingRpsContinuation', {
      ...continuation,
      ctx: {
        ...continuation.ctx,
        declaredNameDomains: { named: 'registered-character-card-name' },
      },
    }, { mode: 'persisted' })).not.toThrow();
  });

  it('derives only registered character name components', () => {
    expect(declaredNameCandidates('registered-character-card-name')).toEqual([
      '服部平次',
      '服部平次&遠山和葉',
      '毛利小五郎',
      '毛利蘭',
      '遠山和葉',
    ]);
    expect(isDeclaredNameAllowed('registered-character-card-name', '服部平次')).toBe(true);
    expect(isDeclaredNameAllowed('registered-character-card-name', '事件名')).toBe(false);
    expect(isDeclaredNameAllowed('registered-character-card-name', '未登録')).toBe(false);
    expect(isDeclaredNameAllowed('unrestricted', '未登録')).toBe(true);
  });

  it('covers every registered official character printed title without admitting event-only titles', () => {
    _resetRegistry();
    registerAll();
    const official = loadCorpus(path.resolve(__dirname, '../../..'));
    const registeredCharacterIds = new Set(
      ALL_CARDS.filter((candidate) => candidate.kind === 'character').map((candidate) => candidate.id),
    );
    const characterRows = official.filter((row) => (
      row.kind === 'character' && registeredCharacterIds.has(row.id)
    ));
    const characterTitles = new Set(characterRows.map((row) => row.title));
    const candidates = new Set(declaredNameCandidates('registered-character-card-name'));
    const missing = characterRows
      .filter((row) => resolveDeclaredName('registered-character-card-name', row.title) !== row.title)
      .map((row) => `${row.id}:${row.title}`);
    const admittedEventOnlyTitles = official
      .filter((row) => row.kind === 'event' && !characterTitles.has(row.title))
      .filter((row) => candidates.has(row.title))
      .map((row) => `${row.id}:${row.title}`);

    expect(characterRows.length).toBeGreaterThan(500);
    expect(missing).toEqual([]);
    expect(admittedEventOnlyTitles).toEqual([]);
  });

  it('keeps the B10065 printings registered under their compound and component names', () => {
    _resetRegistry();
    registerAll();
    const expectedNames = ['松田陣平＆萩原研二', '松田陣平', '萩原研二'];

    for (const id of ['B10065', 'B10065P', 'B10065P2']) {
      expect(ALL_CARDS.find((candidate) => candidate.id === id)?.names).toEqual(expectedNames);
    }
    for (const name of expectedNames) {
      expect(resolveDeclaredName('registered-character-card-name', name)).toBe(name);
    }
  });

  it.each([
    {
      label: 'domain downgrade',
      sourcePatch: undefined,
      ctxPatch: {
        dyn: { declaredName: 'Canonical Name' },
        declaredNames: { named: 'Canonical Name' },
        declaredNameDomains: { named: 'unrestricted' },
      },
      error: /registered-character-card-name|domain/i,
    },
    {
      label: 'both declaration maps deleted',
      sourcePatch: undefined,
      ctxPatch: { dyn: { declaredName: 'Canonical Name' } },
      error: /declaredNames|declaredNameDomains/i,
    },
    {
      label: 'domain map deleted',
      sourcePatch: undefined,
      ctxPatch: {
        dyn: { declaredName: 'Canonical Name' },
        declaredNames: { named: 'Canonical Name' },
      },
      error: /declaredNameDomains/i,
    },
    {
      label: 'dyn and declaration map mismatch',
      sourcePatch: undefined,
      ctxPatch: {
        dyn: { declaredName: 'Other Name' },
        declaredNames: { named: 'Canonical Name' },
        declaredNameDomains: { named: 'registered-character-card-name' },
      },
      error: /dyn\.declaredName|match/i,
    },
    {
      label: 'source identity stripped to evade constrained lineage',
      sourcePatch: { cardId: '', abilityId: '', uid: '' },
      ctxPatch: { dyn: { declaredName: 'Canonical Name' } },
      queueLineage: false,
      error: /source\.cardId|source\.abilityId|identity/i,
    },
  ])('rejects persisted constrained declaration authority forgery: $label', ({ ctxPatch, error, queueLineage = true, sourcePatch }) => {
    register(card('CANONICAL', 'character', ['Canonical Name']));
    register(card('OTHER', 'character', ['Other Name']));
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'declareName',
          args: { bind: 'named', domain: 'registered-character-card-name' },
        },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    };
    const state = createEmptyGameState();
    if (queueLineage) {
      event.queue(
        state,
        effect,
        { player: 'self', area: 'scene', cardId: 'AUTH_SOURCE', abilityId: 'a1', uid: 'AUTH#1' },
        'test',
      );
    }
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'AUTH_SOURCE',
              abilityId: 'a1',
              uid: 'AUTH#1',
              ...sourcePatch,
            },
            bindings: {},
            ...ctxPatch,
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(error);
  });

  it('admits valid constrained declaration authority and legacy unrestricted continuations', () => {
    register(card('CANONICAL', 'character', ['Canonical Name']));
    const stateFor = (effect: Effect, ctxPatch: Record<string, unknown>) => {
      const state = createEmptyGameState();
      event.queue(
        state,
        effect,
        { player: 'self', area: 'scene', cardId: 'AUTH_SOURCE', abilityId: 'a1', uid: 'AUTH#1' },
        'test',
      );
      state.pendingRuntimeState = {
        token: 1,
        snapshot: [{
          key: '__pendingRpsContinuation',
          present: true,
          value: {
            remainder: [],
            ctx: {
              source: {
                player: 'self',
                area: 'scene',
                cardId: 'AUTH_SOURCE',
                abilityId: 'a1',
                uid: 'AUTH#1',
              },
              bindings: {},
              ...ctxPatch,
            },
            kind: 'sequence',
          },
        }],
      };
      return state;
    };
    const constrained: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'registered-character-card-name' },
    };
    const unrestricted: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named' },
    };

    expect(() => hydratePendingRuntimeState(stateFor(constrained, {
      dyn: { declaredName: 'Canonical Name' },
      declaredNames: { named: 'Canonical Name' },
      declaredNameDomains: { named: 'registered-character-card-name' },
    }))).not.toThrow();
    resetPendingRuntimeState();
    expect(() => hydratePendingRuntimeState(stateFor(unrestricted, {
      dyn: { declaredName: 'Legacy Free Text' },
    }))).not.toThrow();
  });

  it.each([
    { cardId: 'B04048', abilityId: 'a2', area: 'scene' as const },
    { cardId: 'B04048P', abilityId: 'a2', area: 'scene' as const },
    { cardId: 'B01095', abilityId: 'a1', area: 'hand' as const },
  ])('admits pre-domain unrestricted declaration maps for $cardId/$abilityId', ({ cardId, abilityId, area }) => {
    _resetRegistry();
    registerAll();
    const ability = ALL_CARDS
      .find((candidate) => candidate.id === cardId)
      ?.abilities.find((candidate) => candidate.id === abilityId);
    if (!ability?.effect) throw new Error(`missing ${cardId} ${abilityId} effect`);

    const state = createEmptyGameState();
    const queuedEffect = structuredClone(ability.effect) as Effect;
    if (cardId === 'B04048' || cardId === 'B04048P') {
      const firstStep = queuedEffect.kind === 'sequence' ? queuedEffect.steps[0] : undefined;
      if (firstStep?.kind !== 'atom' || firstStep.verb !== 'declareName') {
        throw new Error('missing B04048 legacy declareName step');
      }
      delete (firstStep.args as { domain?: string }).domain;
    }
    event.queue(
      state,
      queuedEffect,
      { player: 'self', area, cardId, abilityId, uid: `${cardId}#legacy` },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: { player: 'self', area, cardId, abilityId, uid: `${cardId}#legacy` },
            bindings: {},
            dyn: { declaredName: 'Legacy Free Text' },
            declaredNames: { named: 'Legacy Free Text' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).not.toThrow();
  });

  it('rejects extra declared-name keys outside the immutable constrained descriptor', () => {
    register(card('CANONICAL', 'character', ['Canonical Name']));
    const effect: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'registered-character-card-name' },
    };
    register({
      ...card('EXACT_KEYS_SOURCE', 'character', ['Exact Keys Source']),
      abilities: [{
        id: 'a1',
        type: 'declared',
        scope: 'on-scene',
        effect,
        description: 'constrained declaration',
        ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    event.queue(
      state,
      effect,
      { player: 'self', area: 'scene', cardId: 'EXACT_KEYS_SOURCE', abilityId: 'a1', uid: 'EXACT#1' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'EXACT_KEYS_SOURCE',
              abilityId: 'a1',
              uid: 'EXACT#1',
            },
            bindings: {},
            dyn: { declaredName: 'Canonical Name' },
            declaredNames: { named: 'Canonical Name', extra: 'Free Text' },
            declaredNameDomains: {
              named: 'registered-character-card-name',
              extra: 'unrestricted',
            },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(/extra|unexpected|exact/i);
  });

  it('rejects ambiguous same-source queued declaration descriptors instead of borrowing the last entry', () => {
    register(card('CANONICAL', 'character', ['Canonical Name']));
    const constrained: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'registered-character-card-name' },
    };
    register({
      ...card('SHARED_SOURCE', 'character', ['Shared Source']),
      abilities: [{
        id: 'a1',
        type: 'declared',
        scope: 'on-scene',
        effect: constrained,
        description: 'constrained declaration',
        ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    const source = {
      player: 'self' as const,
      area: 'scene' as const,
      cardId: 'SHARED_SOURCE',
      abilityId: 'a1',
      uid: 'SHARED#1',
    };
    event.queue(state, {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'other' },
    }, source, 'test');
    event.queue(state, constrained, source, 'test');
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source,
            bindings: {},
            dyn: { declaredName: 'Canonical Name' },
            declaredNames: { named: 'Canonical Name' },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(/ambiguous|queued declaration lineage/i);
  });

  it.each(['identical', 'one declaration plus resumed remainder'])(
    'admits same-source lineage with one unique descriptor: %s',
    (variant) => {
      register(card('CANONICAL', 'character', ['Canonical Name']));
      const constrained: Effect = {
        kind: 'atom',
        verb: 'declareName',
        args: { bind: 'named', domain: 'registered-character-card-name' },
      };
      const state = createEmptyGameState();
      const source = {
        player: 'self' as const,
        area: 'scene' as const,
        cardId: 'GRANTED_SOURCE',
        abilityId: 'granted-a1',
        uid: 'GRANTED#1',
      };
      event.queue(state, constrained, source, 'test');
      event.queue(
        state,
        variant === 'identical' ? constrained : { kind: 'atom', verb: 'noop', args: {} },
        source,
        'test',
      );
      state.pendingRuntimeState = {
        token: 1,
        snapshot: [{
          key: '__pendingRpsContinuation',
          present: true,
          value: {
            remainder: [],
            ctx: {
              source,
              bindings: {},
              dyn: { declaredName: 'Canonical Name' },
              declaredNames: { named: 'Canonical Name' },
              declaredNameDomains: { named: 'registered-character-card-name' },
            },
            kind: 'sequence',
          },
        }],
      };

      expect(() => hydratePendingRuntimeState(state)).not.toThrow();
    },
  );

  it('rejects persisted whitespace masquerading as a constrained optional skip', () => {
    _resetRegistry();
    registerAll();
    const ability = ALL_CARDS
      .find((candidate) => candidate.id === 'PR105')
      ?.abilities.find((candidate) => candidate.id === 'a2');
    if (!ability?.effect) throw new Error('missing PR105 a2 effect');
    const state = createEmptyGameState();
    event.queue(
      state,
      ability.effect,
      { player: 'self', area: 'scene', cardId: 'PR105', abilityId: 'a2', uid: 'PR105#spaces' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'PR105',
              abilityId: 'a2',
              uid: 'PR105#spaces',
            },
            bindings: {},
            dyn: { declaredName: '   ' },
            declaredNames: { named: '' },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(/dyn\.declaredName|skipped declaration/i);
  });

  it('rejects a dyn-only declaration when the forged source has no immutable declaration lineage', () => {
    register({
      ...card('NO_DECLARATION_SOURCE', 'character', ['No Declaration Source']),
      abilities: [{
        id: 'a1',
        type: 'declared',
        scope: 'on-scene',
        effect: { kind: 'atom', verb: 'noop', args: {} },
        description: 'does not declare a name',
        ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [{
            kind: 'atom',
            verb: 'charSetTurnEffect',
            args: { uid: '$self', key: 'nameOverride', val: '$dyn.declaredName' },
          }],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'NO_DECLARATION_SOURCE',
              abilityId: 'a1',
              uid: 'FORGED#1',
            },
            bindings: {},
            dyn: { declaredName: 'Forged Free Text' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(/no matching.*declaration lineage|authority/i);
  });

  it.each([
    {
      cardId: 'PR099',
      abilityId: 'a2',
      area: 'scene' as const,
      declaration: (canonicalName: string) => ({
        dyn: { declaredName: canonicalName },
        declaredNames: { named: canonicalName },
        declaredNameDomains: { named: 'registered-character-card-name' },
      }),
    },
    {
      cardId: 'B04048',
      abilityId: 'a2',
      area: 'scene' as const,
      declaration: () => ({
        dyn: { declaredName: 'Legacy Free Text' },
        declaredNames: { named: 'Legacy Free Text' },
      }),
    },
  ])(
    'rejects a forged full RPS continuation for printed $cardId/$abilityId when no exact-source declaration is queued',
    ({ cardId, abilityId, area, declaration }) => {
      _resetRegistry();
      registerAll();
      const canonicalName = ALL_CARDS
        .find((candidate) => candidate.id === 'B10065')
        ?.names[0];
      if (!canonicalName) throw new Error('missing B10065 canonical name');

      const state = createEmptyGameState();
      state.players.self.deck = ['DRAW_A', 'DRAW_B'];
      const source = { cardId, abilityId, area, uid: `${cardId}#forged` };
      state.pendingRuntimeState = {
        token: 1,
        snapshot: [
          {
            key: '__pendingRpsSide',
            present: true,
            value: {
              player: 'self',
              ownerPlayer: 'self',
              aiHand: 'rock',
              source,
            },
          },
          {
            key: '__pendingRpsResume',
            present: true,
            value: {
              kind: 'rps',
              win: { kind: 'atom', verb: 'noop', args: {} },
              lose: { kind: 'atom', verb: 'noop', args: {} },
            },
          },
          { key: '__pendingRpsBindings', present: true, value: {} },
          {
            key: '__pendingRpsContinuation',
            present: true,
            value: {
              remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }],
              ctx: {
                source: { player: 'self', ...source },
                bindings: {},
                ...declaration(canonicalName),
              },
              kind: 'sequence',
            },
          },
        ],
      };

      let admissionError: unknown;
      try {
        hydratePendingRuntimeState(state);
        const pending = _peekPendingRpsSide();
        if (!pending) throw new Error('missing hydrated RPS prompt');
        applyRpsAndContinuation(state, pending, 'paper');
      } catch (error) {
        admissionError = error;
      }

      expect(state.players.self.hand).toEqual([]);
      expect(admissionError).toBeInstanceOf(Error);
      expect(String(admissionError)).toMatch(/no matching queued declaration lineage/i);
    },
  );

  it.each(['PR099', 'PR105'])('admits valid constrained continuation authority for %s', (cardId) => {
    _resetRegistry();
    registerAll();
    const ability = ALL_CARDS
      .find((candidate) => candidate.id === cardId)
      ?.abilities.find((candidate) => candidate.id === 'a2');
    if (!ability?.effect) throw new Error(`missing ${cardId} a2 effect`);
    const canonicalName = ALL_CARDS
      .find((candidate) => candidate.id === 'B10065')
      ?.names[0];
    if (!canonicalName) throw new Error('missing B10065 canonical name');

    const state = createEmptyGameState();
    event.queue(
      state,
      ability.effect,
      { player: 'self', area: 'scene', cardId, abilityId: 'a2', uid: `${cardId}#1` },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId,
              abilityId: 'a2',
              uid: `${cardId}#1`,
            },
            bindings: {},
            dyn: { declaredName: canonicalName },
            declaredNames: { named: canonicalName },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).not.toThrow();
  });

  it('admits a later PR099 pause when its original declaration entry remains queued', () => {
    _resetRegistry();
    registerAll();
    const ability = ALL_CARDS
      .find((candidate) => candidate.id === 'PR099')
      ?.abilities.find((candidate) => candidate.id === 'a2');
    const canonicalName = ALL_CARDS
      .find((candidate) => candidate.id === 'B10065')
      ?.names[0];
    if (!ability?.effect || !canonicalName) throw new Error('missing PR099 or B10065 fixture');

    const state = createEmptyGameState();
    const source = {
      player: 'self' as const,
      area: 'scene' as const,
      cardId: 'PR099',
      abilityId: 'a2',
      uid: 'PR099#later-pause',
    };
    event.queue(state, ability.effect, source, 'test');
    event.queue(state, { kind: 'atom', verb: 'noop', args: {} }, source, 'test');
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source,
            bindings: {},
            dyn: { declaredName: canonicalName },
            declaredNames: { named: canonicalName },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).not.toThrow();
  });

  it('does not borrow constrained declaration authority from a different set-card occurrence', () => {
    const constrainedEffect: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'registered-character-card-name' },
    };
    register(card('HOST', 'character', ['Host']));
    const state = createEmptyGameState();
    event.queue(state, constrainedEffect, {
      player: 'self',
      area: 'scene',
      cardId: 'HOST',
      abilityId: 'set-rider',
      uid: 'host',
      setCardId: 'SET',
      setCardInstanceId: 'set:1',
    }, 'test');
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'HOST',
              abilityId: 'set-rider',
              uid: 'host',
              setCardId: 'SET',
              setCardInstanceId: 'set:2',
            },
            bindings: {},
            dyn: { declaredName: '毛利小五郎' },
            declaredNames: { named: '毛利小五郎' },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow(/no matching queued declaration lineage/i);
  });

  it('rejects printed constrained state when the only exact-source queued entry is a resumed remainder', () => {
    _resetRegistry();
    registerAll();
    const canonicalName = ALL_CARDS
      .find((candidate) => candidate.id === 'B10065')
      ?.names[0];
    if (!canonicalName) throw new Error('missing B10065 canonical name');
    const state = createEmptyGameState();
    event.queue(
      state,
      { kind: 'atom', verb: 'noop', args: {} },
      { player: 'self', area: 'scene', cardId: 'PR099', abilityId: 'a2', uid: 'PR099#1' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'PR099',
              abilityId: 'a2',
              uid: 'PR099#1',
            },
            bindings: {},
            dyn: { declaredName: canonicalName },
            declaredNames: { named: canonicalName },
            declaredNameDomains: { named: 'registered-character-card-name' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(/no matching queued declaration lineage/i);
  });

  it('does not let an unrelated constrained entry reject a queued legacy unrestricted continuation', () => {
    const unrestrictedEffect: Effect = {
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named' },
    };
    register({
      ...card('LEGACY_SOURCE', 'character', ['Legacy Source']),
      abilities: [{
        id: 'a1',
        type: 'declared',
        scope: 'on-scene',
        effect: unrestrictedEffect,
        description: 'legacy unrestricted declaration',
        ruleRefs: [],
      }],
    });
    const state = createEmptyGameState();
    event.queue(
      state,
      {
        kind: 'atom',
        verb: 'declareName',
        args: { bind: 'named', domain: 'registered-character-card-name' },
      },
      { player: 'self', area: 'scene', cardId: 'AUTH_SOURCE', abilityId: 'a1', uid: 'AUTH#1' },
      'test',
    );
    event.queue(
      state,
      unrestrictedEffect,
      { player: 'self', area: 'scene', cardId: 'LEGACY_SOURCE', abilityId: 'a1', uid: 'LEGACY#1' },
      'test',
    );
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: 'LEGACY_SOURCE',
              abilityId: 'a1',
              uid: 'LEGACY#1',
            },
            bindings: {},
            dyn: { declaredName: 'Legacy Free Text' },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).not.toThrow();
  });

  it('reads a constrained optional declaration from a nested effect', () => {
    const effect: Effect = {
      kind: 'sequence',
      steps: [{
        kind: 'atom',
        verb: 'declareName',
        args: {
          bind: 'named',
          optional: true,
          domain: 'registered-character-card-name',
        },
      }],
    };
    expect(findDeclareNameSpec(effect)).toEqual({
      bind: 'named',
      optional: true,
      domain: 'registered-character-card-name',
    });
  });

  it('rejects an unknown domain during static validation', () => {
    const result = validate({
      kind: 'atom',
      verb: 'declareName',
      args: { bind: 'named', domain: 'event-name' },
    } as unknown as Effect);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('args.domain');
  });

  it('rejects a forged event name at the atom and persisted stack boundaries', () => {
    const state = createEmptyGameState();
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene' },
      bindings: {},
      dyn: { declaredName: '事件名' },
    };
    const beforeLog = state.log.length;
    expect(() => runAtom(state, 'declareName', {
      bind: 'named',
      domain: 'registered-character-card-name',
    }, ctx)).toThrow(/rejected registered-character-card-name/);
    expect(ctx.declaredNames).toBeUndefined();
    expect(state.log).toHaveLength(beforeLog);

    const entry = event.queue(
      state,
      {
        kind: 'atom',
        verb: 'declareName',
        args: {
          bind: 'named',
          domain: 'registered-character-card-name',
        },
      },
      { player: 'self' },
      'test',
      undefined,
      undefined,
      { dyn: { declaredName: '事件名' } },
    );
    runAllUntilEmpty(state);
    expect(entry.state).toBe('cancelled');
    expect(state.log).toHaveLength(beforeLog);
  });
});
