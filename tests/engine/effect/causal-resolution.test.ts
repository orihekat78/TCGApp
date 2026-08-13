import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyChoiceAndContinuation,
  applyDeckReorderAndContinuation,
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyRepeatOptionalAndContinuation,
  applyRpsAndContinuation,
  applySetCardChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
} from '@/engine/effect/resolve-picks';
import {
  _clearPendingEffectRepeatOptionalSide,
  _clearPendingRpsSide,
  _drainPendingEffectRepeatOptionalSide,
  _drainPendingRpsSide,
  _drainPendingSetCardChoiceSide,
  _takePendingSetCardChoiceResume,
} from '@/engine/effect/pending-state';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { appendCausal, startCausalSession, validateCausalLog } from '@/engine/log/causal';
import {
  ensureEffectCausalTrace,
  restoreEffectCausalTrace,
} from '@/engine/log/effect-causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import { cardOccurrenceUid } from '@/engine/target/card-occurrence';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, CausalLogEntryV1, EffectCtx, EffectStackEntry, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';

const PUBLIC_MR: CardDef = {
  id: 'PUBLIC-MR',
  no: 'PUBLIC-MR',
  kind: 'character',
  names: ['Public MR'],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'MR',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const PUBLIC_EVENT: CardDef = {
  id: 'PUBLIC-EVENT',
  no: 'PUBLIC-EVENT',
  kind: 'event',
  names: ['Public Event'],
  colors: [],
  level: 0,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

function runCausalAtom(options: {
  sessionId: string;
  verb: string;
  args: Record<string, unknown>;
  setup?: (state: GameState) => void;
  source?: EffectStackEntry['source'];
  dyn?: EffectStackEntry['dyn'];
}): GameState {
  const state = createEmptyGameState();
  options.setup?.(state);
  startCausalSession(state, options.sessionId);
  return produce(state, (draft) => {
    runOne(draft, {
      id: `${options.sessionId}-entry`,
      source: options.source ?? {
        player: 'self',
        cardId: 'PRIVATE-SOURCE-ID',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: options.verb as never, args: options.args },
      ...(options.dyn ? { dyn: options.dyn } : {}),
      state: 'pending',
    });
  });
}

describe('structured causal effect resolution', () => {
  beforeEach(() => {
    resetDefRegistry();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    _clearPendingEffectRepeatOptionalSide();
    _clearPendingRpsSide();
    _drainPendingSetCardChoiceSide();
    _takePendingSetCardChoiceResume();
    _drainPendingDeckReorderSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    resetDefRegistry();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    _clearPendingEffectRepeatOptionalSide();
    _clearPendingRpsSide();
    _drainPendingSetCardChoiceSide();
    _takePendingSetCardChoiceResume();
    _drainPendingDeckReorderSide();
    vi.restoreAllMocks();
    delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
  });

  it('publishes a public draw operation between the effect declaration and summary', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['PRIVATE-DRAW-1', 'PRIVATE-DRAW-2', 'PRIVATE-DRAW-3'];
    startCausalSession(state, 'effect-draw-two');
    const entry: EffectStackEntry = {
      id: 'draw-two-entry',
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE-ID',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      state: 'pending',
    };

    runOne(state, entry);

    expect(state.players.self.hand).toEqual(['PRIVATE-DRAW-1', 'PRIVATE-DRAW-2']);
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => ({
      kind: node.kind,
      parentEventId: node.parentEventId,
      source: node.source,
      targets: node.targets,
      outcome: node.outcome,
    }))).toEqual([
      {
        kind: 'declare',
        parentEventId: undefined,
        source: {
          visibility: 'public',
          kind: 'player',
          label: '自分',
          side: 'self',
        },
        targets: [],
        outcome: { type: 'state', state: 'active' },
      },
      {
        kind: 'draw',
        parentEventId: 'effect-draw-two:1',
        source: {
          visibility: 'public',
          kind: 'zone',
          label: '自分のデッキ',
          side: 'self',
          zone: 'deck',
        },
        targets: [{
          visibility: 'public',
          kind: 'zone',
          label: '自分の手札',
          side: 'self',
          zone: 'hand',
        }],
        outcome: { type: 'move', from: 'deck', to: 'hand', count: 2 },
      },
      {
        kind: 'summary',
        parentEventId: 'effect-draw-two:2',
        source: {
          visibility: 'public',
          kind: 'player',
          label: '自分',
          side: 'self',
        },
        targets: [],
        outcome: { type: 'state', state: 'success' },
      },
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-DRAW');
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-SOURCE-ID');
    expect(JSON.stringify(state.log)).not.toContain('private-source-uid');
  });

  it('publishes the actual draw-up count without exposing drawn identities', () => {
    const state = runCausalAtom({
      sessionId: 'effect-draw-up',
      verb: 'drawUpToHandSize',
      args: { player: 'self', n: 3 },
      setup: (draft) => {
        draft.players.self.hand = ['PRIVATE-HELD'];
        draft.players.self.deck = ['PRIVATE-DRAW-1'];
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
      node.outcome,
    ])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['draw', 'effect-draw-up:1', { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['game-result', 'effect-draw-up:2', { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-DRAW');
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-HELD');
  });

  it('publishes only the actual discard count and no private hand identity', () => {
    const state = runCausalAtom({
      sessionId: 'effect-discard',
      verb: 'discard',
      args: { player: 'self', target: ['PRIVATE-HAND-1'] },
      setup: (draft) => {
        draft.players.self.hand = ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['discard', 'effect-discard:1', { type: 'move', from: 'hand', to: 'remove', count: 1 }],
      ['summary', 'effect-discard:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: 'self', zone: 'hand' },
      targets: [{ kind: 'zone', side: 'self', zone: 'remove' }],
    });
    expect(state.players.self.hand).toEqual(['PRIVATE-HAND-2']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-HAND');
  });

  it('does not invent a discard operation for an empty random discard', () => {
    const state = runCausalAtom({
      sessionId: 'effect-discard-empty',
      verb: 'discardRandom',
      args: { player: 'opp', n: 2 },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['summary', 'effect-discard-empty:1'],
    ]);
  });

  it('publishes an off-owner scene-to-hand move with public zones only', () => {
    const state = runCausalAtom({
      sessionId: 'effect-scene-to-hand',
      verb: 'sceneToHand',
      args: { uid: 'opp-target' },
      source: {
        player: 'self',
        cardId: 'PUBLIC-SOURCE',
        uid: 'self-source',
        abilityId: 'a1',
        area: 'scene',
      },
      setup: (draft) => {
        draft.players.self.scene = [sceneChar('PUBLIC-SOURCE', 'self-source')];
        draft.players.opp.scene = [sceneChar('PRIVATE-TARGET-ID', 'opp-target')];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'effect-scene-to-hand:1', { type: 'move', from: 'scene', to: 'hand', count: 1 }],
      ['summary', 'effect-scene-to-hand:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[0]?.source).toMatchObject({ kind: 'card', side: 'self', zone: 'scene' });
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: 'opp', zone: 'scene' },
      targets: [{ kind: 'zone', side: 'opp', zone: 'hand' }],
    });
    expect(state.players.opp.hand).toEqual(['PRIVATE-TARGET-ID']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-TARGET-ID');
    expect(JSON.stringify(state.log)).not.toContain('opp-target');
  });

  it.each([
    {
      label: 'scene to remove',
      sessionId: 'effect-scene-to-remove',
      verb: 'sceneRemove',
      args: { uid: 'opp-target' },
      setup: (draft: GameState) => {
        draft.players.opp.scene = [sceneChar('PRIVATE-SCENE-REMOVE', 'opp-target')];
      },
      fromSide: 'opp',
      toSide: 'opp',
      from: 'scene',
      to: 'remove',
    },
    {
      label: 'scene to deck',
      sessionId: 'effect-scene-to-deck',
      verb: 'sceneToDeck',
      args: { uid: 'opp-target', pos: 'bottom' },
      setup: (draft: GameState) => {
        draft.players.opp.scene = [sceneChar('PRIVATE-SCENE-DECK', 'opp-target')];
      },
      fromSide: 'opp',
      toSide: 'opp',
      from: 'scene',
      to: 'deck',
    },
    {
      label: 'deck to hand',
      sessionId: 'effect-deck-to-hand',
      verb: 'handAddFromDeck',
      args: { player: 'opp', cardId: 'PRIVATE-DECK-HAND' },
      setup: (draft: GameState) => {
        draft.players.opp.deck = ['PRIVATE-DECK-HAND', 'PRIVATE-DECK-KEEP'];
      },
      fromSide: 'opp',
      toSide: 'opp',
      from: 'deck',
      to: 'hand',
    },
    {
      label: 'remove to hand',
      sessionId: 'effect-remove-to-hand',
      verb: 'handAddFromRemove',
      args: { player: 'opp', target: 'PRIVATE-REMOVE-HAND' },
      setup: (draft: GameState) => {
        draft.players.opp.remove = ['PRIVATE-REMOVE-HAND'];
      },
      fromSide: 'opp',
      toSide: 'opp',
      from: 'remove',
      to: 'hand',
    },
    {
      label: 'remove to scene',
      sessionId: 'effect-remove-to-scene',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        cardId: 'D08001',
        sourceRequired: true,
        target: { query: { area: 'remove', side: 'opp' } },
      },
      setup: (draft: GameState) => {
        draft.players.opp.remove = ['D08001'];
      },
      fromSide: 'opp',
      toSide: 'self',
      from: 'remove',
      to: 'scene',
    },
  ] as const)('publishes the actual $label move without a private card identity', ({
    sessionId,
    verb,
    args,
    setup,
    fromSide,
    toSide,
    from,
    to,
  }) => {
    const state = runCausalAtom({ sessionId, verb, args, setup });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual(verb === 'sceneEnter'
      ? [
        ['declare', undefined, { type: 'state', state: 'active' }],
        ['zone-move', `${sessionId}:1`, { type: 'move', from, to, count: 1 }],
        ['enter', `${sessionId}:2`, { type: 'state', state: 'success' }],
        ['summary', `${sessionId}:3`, { type: 'state', state: 'success' }],
      ]
      : [
        ['declare', undefined, { type: 'state', state: 'active' }],
        ['zone-move', `${sessionId}:1`, { type: 'move', from, to, count: 1 }],
        ['summary', `${sessionId}:2`, { type: 'state', state: 'success' }],
      ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: fromSide, zone: from },
      targets: [{ kind: 'zone', side: toSide, zone: to }],
    });
    expect(graph[1]?.source).not.toHaveProperty('cardNumber');
    expect(graph[1]?.targets[0]).not.toHaveProperty('cardNumber');
  });

  it.each([
    ['sceneRemove', { uid: 'missing-scene' }],
    ['sceneToDeck', { uid: 'missing-scene' }],
    ['handAddFromDeck', { player: 'opp', cardId: 'PRIVATE-DECK-HAND', selectedCardIndex: 1 }],
    ['handAddFromRemove', { player: 'opp', target: 'PRIVATE-REMOVE-HAND', selectedCardIndex: 1 }],
    ['sceneEnter', {
      player: 'opp',
      cardId: 'D08001',
      sourceRequired: true,
      target: { query: { area: 'remove', side: 'opp' } },
    }],
  ] as const)('does not invent a zone move for a no-op %s', (verb, args) => {
    const state = runCausalAtom({
      sessionId: `effect-${verb}-noop`,
      verb,
      args,
      setup: (draft) => {
        if (verb === 'handAddFromDeck') draft.players.opp.deck = ['PRIVATE-DECK-HAND', 'PRIVATE-PAD'];
        if (verb === 'handAddFromRemove') draft.players.opp.remove = ['PRIVATE-REMOVE-HAND', 'PRIVATE-PAD'];
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
  });

  it.each([
    {
      sessionId: 'effect-deck-to-hand-multi',
      verb: 'handAddFromDeck',
      args: {
        player: 'opp',
        cardIds: ['PRIVATE-A', 'PRIVATE-B'],
        selectedDeckIndexes: [0, 2],
      },
      setup: (draft: GameState) => {
        draft.players.opp.deck = ['PRIVATE-A', 'PRIVATE-PAD', 'PRIVATE-B', 'PRIVATE-TAIL'];
      },
      from: 'deck',
    },
    {
      sessionId: 'effect-remove-to-hand-multi',
      verb: 'handAddFromRemove',
      args: {
        player: 'opp',
        cardIds: ['PRIVATE-A', 'PRIVATE-B'],
        target: { query: { area: 'remove', side: 'opp' } },
        selectedCardOccurrences: [
          {
            uid: cardOccurrenceUid('opp', 'remove', 'PRIVATE-A', 0),
            player: 'opp',
            area: 'remove',
            index: 0,
            cardId: 'PRIVATE-A',
            occurrenceWitness: 'occ:v1:opp:remove:0',
          },
          {
            uid: cardOccurrenceUid('opp', 'remove', 'PRIVATE-B', 2),
            player: 'opp',
            area: 'remove',
            index: 2,
            cardId: 'PRIVATE-B',
            occurrenceWitness: 'occ:v1:opp:remove:0',
          },
        ],
      },
      setup: (draft: GameState) => {
        draft.players.opp.remove = ['PRIVATE-A', 'PRIVATE-PAD', 'PRIVATE-B'];
      },
      from: 'remove',
    },
    {
      sessionId: 'effect-partner-to-hand-multi',
      verb: 'handAddFromRemove',
      args: {
        player: 'opp',
        cardIds: ['PRIVATE-A', 'PRIVATE-B'],
        target: { query: { area: 'partner-area', side: 'opp' } },
        selectedCardOccurrences: [
          {
            uid: cardOccurrenceUid('opp', 'partner-area', 'PRIVATE-A', 0),
            player: 'opp',
            area: 'partner-area',
            index: 0,
            cardId: 'PRIVATE-A',
          },
          {
            uid: cardOccurrenceUid('opp', 'partner-area', 'PRIVATE-B', 2),
            player: 'opp',
            area: 'partner-area',
            index: 2,
            cardId: 'PRIVATE-B',
          },
        ],
      },
      setup: (draft: GameState) => {
        draft.players.opp.partnerAreaCards = ['PRIVATE-A', 'PRIVATE-PAD', 'PRIVATE-B'];
      },
      from: 'partner',
    },
  ] as const)('publishes one count-2 operation for the $verb array branch', ({
    sessionId,
    verb,
    args,
    setup,
    from,
  }) => {
    const state = runCausalAtom({ sessionId, verb, args, setup });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', `${sessionId}:1`, { type: 'move', from, to: 'hand', count: 2 }],
      ['summary', `${sessionId}:2`, { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: from },
      targets: [{ kind: 'zone', side: 'opp', zone: 'hand' }],
    });
  });

  it.each([
    {
      sessionId: 'effect-file-add',
      verb: 'fileAdd',
      args: { player: 'opp', n: 2 },
      setup: (draft: GameState) => {
        draft.players.opp.deck = ['PRIVATE-FILE-1', 'PRIVATE-FILE-2', 'PRIVATE-TAIL'];
      },
      kind: 'zone-move',
      from: 'deck',
      to: 'file',
      count: 2,
    },
    {
      sessionId: 'effect-file-to-hand',
      verb: 'filePopToHand',
      args: { player: 'opp', n: 2 },
      setup: (draft: GameState) => {
        draft.players.opp.file = [
          { type: 'card-back', cardId: 'PRIVATE-FILE-1' },
          { type: 'card-back', cardId: 'PRIVATE-FILE-2' },
        ];
      },
      kind: 'zone-move',
      from: 'file',
      to: 'hand',
      count: 2,
    },
    {
      sessionId: 'effect-file-to-remove',
      verb: 'fileRemoveTop',
      args: { player: 'opp', n: 2 },
      setup: (draft: GameState) => {
        draft.players.opp.file = [
          { type: 'card-back', cardId: 'PRIVATE-FILE-1' },
          { type: 'card-back', cardId: 'PRIVATE-FILE-2' },
        ];
      },
      kind: 'zone-move',
      from: 'file',
      to: 'remove',
      count: 2,
    },
    {
      sessionId: 'effect-evidence-lose',
      verb: 'evidenceLose',
      args: { player: 'opp', n: 2 },
      setup: (draft: GameState) => {
        draft.players.opp.evidence = [
          { cardId: 'PRIVATE-EVIDENCE-1', faceUp: false, origin: { turn: 0, via: 'init' } },
          { cardId: 'PRIVATE-EVIDENCE-2', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
      kind: 'evidence',
      from: 'evidence',
      to: 'remove',
      count: 2,
    },
    {
      sessionId: 'effect-evidence-to-deck',
      verb: 'evidenceToDeck',
      args: { player: 'opp', n: 2 },
      setup: (draft: GameState) => {
        draft.players.opp.evidence = [
          { cardId: 'PRIVATE-EVIDENCE-1', faceUp: false, origin: { turn: 0, via: 'init' } },
          { cardId: 'PRIVATE-EVIDENCE-2', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
      kind: 'evidence',
      from: 'evidence',
      to: 'deck',
      count: 2,
    },
    {
      sessionId: 'effect-evidence-to-deck-bottom',
      verb: 'evidenceToDeckBottom',
      args: { player: 'opp', target: 'PRIVATE-EVIDENCE-1' },
      setup: (draft: GameState) => {
        draft.players.opp.evidence = [
          { cardId: 'PRIVATE-EVIDENCE-1', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
      kind: 'evidence',
      from: 'evidence',
      to: 'deck',
      count: 1,
    },
    {
      sessionId: 'effect-hand-to-evidence',
      verb: 'handToEvidence',
      args: { player: 'opp', target: ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'] },
      setup: (draft: GameState) => {
        draft.players.opp.hand = ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'];
      },
      kind: 'evidence',
      from: 'hand',
      to: 'evidence',
      count: 2,
    },
    {
      sessionId: 'effect-self-to-evidence',
      verb: 'selfToEvidence',
      args: { player: 'opp' },
      setup: (draft: GameState) => {
        draft.players.opp.remove = ['PRIVATE-SOURCE-ID'];
      },
      kind: 'evidence',
      from: 'remove',
      to: 'evidence',
      count: 1,
    },
    {
      sessionId: 'effect-remove-to-partner',
      verb: 'toPartnerArea',
      args: { player: 'opp', target: 'PRIVATE-PARTNER' },
      setup: (draft: GameState) => {
        draft.players.opp.remove = ['PRIVATE-PARTNER'];
      },
      kind: 'zone-move',
      from: 'remove',
      to: 'partner',
      count: 1,
    },
    {
      sessionId: 'effect-hand-to-file',
      verb: 'handToFileBottom',
      args: { player: 'opp', target: ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'] },
      setup: (draft: GameState) => {
        draft.players.opp.hand = ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'];
      },
      kind: 'zone-move',
      from: 'hand',
      to: 'file',
      count: 2,
    },
    {
      sessionId: 'effect-scene-to-evidence',
      verb: 'sceneToEvidence',
      args: { uid: 'opp-evidence-target' },
      setup: (draft: GameState) => {
        draft.players.opp.scene = [sceneChar('PRIVATE-SCENE-EVIDENCE', 'opp-evidence-target')];
      },
      kind: 'evidence',
      from: 'scene',
      to: 'evidence',
      count: 1,
    },
  ] as const)('publishes the actual $from-to-$to count for $verb', ({
    sessionId,
    verb,
    args,
    setup,
    kind,
    from,
    to,
    count,
  }) => {
    const state = runCausalAtom({ sessionId, verb, args, setup });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      [kind, `${sessionId}:1`, { type: 'move', from, to, count }],
      ['summary', `${sessionId}:2`, { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: from },
      targets: [{ kind: 'zone', side: 'opp', zone: to }],
    });
    expect(graph[1]?.source).not.toHaveProperty('cardNumber');
    expect(graph[1]?.targets[0]).not.toHaveProperty('cardNumber');
  });

  it.each([
    ['filePopToHand', { player: 'opp', n: 2 }],
    ['fileRemoveTop', { player: 'opp', n: 2 }],
    ['evidenceLose', { player: 'opp', n: 2 }],
    ['evidenceToDeck', { player: 'opp', n: 2 }],
    ['evidenceToDeckBottom', { player: 'opp', target: 'PRIVATE-MISSING' }],
    ['handToEvidence', { player: 'opp', target: ['PRIVATE-MISSING'] }],
    ['selfToEvidence', { player: 'opp' }],
    ['toPartnerArea', { player: 'opp', target: 'PRIVATE-MISSING' }],
    ['handToFileBottom', { player: 'opp', target: ['PRIVATE-MISSING'] }],
    ['sceneToEvidence', { uid: 'PRIVATE-MISSING' }],
  ] as const)('does not invent a FILE or evidence move for empty %s', (verb, args) => {
    const state = runCausalAtom({ sessionId: `effect-${verb}-empty`, verb, args });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
  });

  it('publishes effect-driven event use as one public hand-to-remove move', () => {
    registerCardDef(PUBLIC_EVENT);
    const state = runCausalAtom({
      sessionId: 'effect-use-event-from-hand',
      verb: 'useEventFromHand',
      args: { player: 'opp', target: [PUBLIC_EVENT.id] },
      setup: (draft) => {
        draft.players.opp.hand = [PUBLIC_EVENT.id];
      },
    });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['use', 'effect-use-event-from-hand:1', { type: 'state', state: 'active' }],
      ['zone-move', 'effect-use-event-from-hand:2', { type: 'move', from: 'hand', to: 'remove', count: 1 }],
      ['summary', 'effect-use-event-from-hand:3', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: 'hand' },
      targets: [],
    });
    expect(graph[2]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: 'hand' },
      targets: [{ kind: 'zone', side: 'opp', zone: 'remove' }],
    });
    expect(JSON.stringify(graph)).not.toContain(PUBLIC_EVENT.id);
  });

  it('publishes a name declaration without exposing the declared name or binding key', () => {
    const privateName = 'PRIVATE-DECLARED-NAME';
    const privateBind = 'PRIVATE-BIND-KEY';
    const state = runCausalAtom({
      sessionId: 'effect-declare-name',
      verb: 'declareName',
      args: { bind: privateBind },
      dyn: { declaredName: privateName },
    });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['declare', 'effect-declare-name:1', { type: 'state', state: 'success' }],
      ['summary', 'effect-declare-name:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'player', side: 'self' },
      targets: [],
    });
    expect(JSON.stringify(graph)).not.toContain(privateName);
    expect(JSON.stringify(graph)).not.toContain(privateBind);
  });

  it.each([
    ['sceneRemove', { uid: 'opp-mr', cause: 'effect' }],
    ['sceneToHand', { uid: 'opp-mr' }],
    ['sceneToDeck', { uid: 'opp-mr', pos: 'bottom' }],
    ['sceneToEvidence', { uid: 'opp-mr', faceUp: true }],
  ] as const)('publishes the actual MR redirect instead of the requested %s destination', (verb, args) => {
    registerCardDef(PUBLIC_MR);
    const sessionId = `effect-${verb}-mr-redirect`;
    const state = runCausalAtom({
      sessionId,
      verb,
      args,
      setup: (draft) => {
        draft.turn.player = 'self';
        draft.players.opp.scene = [sceneChar(PUBLIC_MR.id, 'opp-mr')];
      },
    });
    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);

    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', `${sessionId}:1`, { type: 'move', from: 'scene', to: 'partner', count: 1 }],
      ['summary', `${sessionId}:2`, { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: 'scene' },
      targets: [{ kind: 'zone', side: 'opp', zone: 'partner' }],
    });
    expect(state.players.opp.partnerAreaMR?.cardId).toBe(PUBLIC_MR.id);
    expect(state.players.opp.scene).toHaveLength(0);
    expect(state.players.opp.deck).not.toContain(PUBLIC_MR.id);
    expect(state.players.opp.remove).not.toContain(PUBLIC_MR.id);
    expect(state.players.opp.evidence).toHaveLength(0);
  });

  it.each([
    ['matching live source', 'PUBLIC-SOURCE', 'card'],
    ['mismatched live source identity', 'MISMATCHED-SOURCE', 'player'],
    ['stale source', 'PUBLIC-SOURCE', 'player'],
  ] as const)('projects a %s without trusting stale effect context', (_label, cardId, expectedKind) => {
    const state = runCausalAtom({
      sessionId: `effect-source-${expectedKind}-${cardId}`,
      verb: 'draw',
      args: { player: 'self', n: 1 },
      source: {
        player: 'self', cardId, uid: 'source-uid', abilityId: 'a1', area: 'scene',
      },
      setup: (draft) => {
        draft.players.self.deck = ['PRIVATE-DRAW'];
        if (_label !== 'stale source') {
          draft.players.self.scene = [sceneChar('PUBLIC-SOURCE', 'source-uid')];
        }
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[])[0]?.source?.kind).toBe(expectedKind);
  });

  it.each([
    ['sleep', 'sleep'],
    ['stun', 'stun'],
  ] as const)('publishes an actual %s transition against a public scene target', (requested, kind) => {
    const state = runCausalAtom({
      sessionId: `effect-${kind}`,
      verb: 'sceneSetState',
      args: { uid: 'opp-target', state: requested },
      setup: (draft) => {
        draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'opp-target')];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      [kind, `effect-${kind}:1`, { type: 'state', state: requested }],
      ['summary', `effect-${kind}:2`, { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      targets: [{ kind: 'card', side: 'opp', zone: 'scene' }],
    });
  });

  it('publishes an activate transition when a sleeping public scene target becomes active', () => {
    const state = runCausalAtom({
      sessionId: 'effect-activate',
      verb: 'sceneSetState',
      args: { uid: 'opp-target', state: 'active' },
      setup: (draft) => {
        draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'opp-target', { state: 'sleep' })];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['activate', 'effect-activate:1', { type: 'state', state: 'active' }],
      ['summary', 'effect-activate:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      targets: [{ kind: 'card', side: 'opp', zone: 'scene' }],
    });
  });

  it('does not invent a sleep transition when stun keeps the card stunned', () => {
    const state = runCausalAtom({
      sessionId: 'effect-sleep-noop',
      verb: 'sceneSetState',
      args: { uid: 'opp-target', state: 'sleep' },
      setup: (draft) => {
        draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'opp-target', { state: 'stun' })];
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind)).toEqual([
      'declare',
      'summary',
    ]);
  });

  it.each([
    ['charModifyAP', -1000, 'ap'],
    ['charModifyLP', 2, 'lp'],
    ['charModifyLevel', 1, 'level'],
  ] as const)('publishes the actual %s value delta', (verb, delta, unit) => {
    const state = runCausalAtom({
      sessionId: `effect-${unit}`,
      verb,
      args: { uid: 'opp-target', delta, scope: 'turn' },
      setup: (draft) => {
        draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'opp-target')];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['value-change', `effect-${unit}:1`, { type: 'count', amount: delta, unit }],
      ['summary', `effect-${unit}:2`, { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]?.targets).toEqual([
      expect.objectContaining({ kind: 'card', side: 'opp', zone: 'scene' }),
    ]);
  });

  it('does not publish a level change for a zero delta', () => {
    const state = runCausalAtom({
      sessionId: 'effect-level-noop',
      verb: 'charModifyLevel',
      args: { uid: 'opp-target', delta: 0, scope: 'turn' },
      setup: (draft) => {
        draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'opp-target')];
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
  });

  it('publishes only the actual evidence gained from a private deck', () => {
    const state = runCausalAtom({
      sessionId: 'effect-evidence',
      verb: 'evidenceGain',
      args: { player: 'self', n: 3 },
      setup: (draft) => {
        draft.players.self.deck = ['PRIVATE-EVIDENCE-1', 'PRIVATE-EVIDENCE-2'];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['evidence', 'effect-evidence:1', { type: 'move', from: 'deck', to: 'evidence', count: 2 }],
      ['game-result', 'effect-evidence:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'deck' },
      targets: [{ kind: 'zone', side: 'self', zone: 'evidence' }],
    });
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-EVIDENCE');
  });

  it('publishes a case status transition without claiming a case-resolution win', () => {
    const state = runCausalAtom({
      sessionId: 'effect-case-status',
      verb: 'caseToResolved',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.case.cardId = 'PUBLIC-CASE';
        draft.players.self.case.status = '事件編';
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['case-status-change', 'effect-case-status:1', { type: 'case-status', from: 'incident', to: 'resolved' }],
      ['summary', 'effect-case-status:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      targets: [{ kind: 'card', side: 'self', zone: 'case', cardNumber: 'PUBLIC-CASE' }],
    });
  });

  it('does not publish a case status operation when the case is already resolved', () => {
    const state = runCausalAtom({
      sessionId: 'effect-case-status-noop',
      verb: 'caseToResolved',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.case.cardId = 'PUBLIC-CASE';
        draft.players.self.case.status = '解決編';
      },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
  });

  it('publishes partner sleep, case resolution, then the terminal result', () => {
    const state = runCausalAtom({
      sessionId: 'effect-partner-solve',
      verb: 'partnerSolveCase',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = 'active';
        draft.players.self.case.cardId = 'PUBLIC-CASE';
        draft.players.self.case.status = '解決編';
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['sleep', 'effect-partner-solve:1', { type: 'state', state: 'sleep' }],
      ['case-resolve', 'effect-partner-solve:2', { type: 'state', state: 'success' }],
      ['game-result', 'effect-partner-solve:3', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      targets: [{ kind: 'card', side: 'self', zone: 'partner', cardNumber: 'PUBLIC-PARTNER' }],
    });
    expect(graph[2]).toMatchObject({
      source: { kind: 'card', side: 'self', zone: 'partner', cardNumber: 'PUBLIC-PARTNER' },
      targets: [{ kind: 'card', side: 'self', zone: 'case', cardNumber: 'PUBLIC-CASE' }],
    });
  });

  it('publishes only actual evidence face-up changes without evidence identities', () => {
    const state = runCausalAtom({
      sessionId: 'effect-evidence-face-up',
      verb: 'evidenceFlip',
      args: { player: 'opp', all: true },
      setup: (draft) => {
        draft.players.opp.evidence = [
          { cardId: 'PRIVATE-UP', faceUp: true, origin: { turn: 0, via: 'init' } },
          { cardId: 'PRIVATE-DOWN-1', faceUp: false, origin: { turn: 0, via: 'init' } },
          { cardId: 'PRIVATE-DOWN-2', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['evidence', 'effect-evidence-face-up:1', { type: 'face-change', from: 'face-down', to: 'face-up', count: 2 }],
      ['summary', 'effect-evidence-face-up:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: 'opp', zone: 'evidence' },
      targets: [{ kind: 'zone', side: 'opp', zone: 'evidence' }],
    });
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('does not publish evidence face operations when no card changes face', () => {
    const faceUp = runCausalAtom({
      sessionId: 'effect-evidence-face-up-noop',
      verb: 'evidenceFlip',
      args: { player: 'opp', all: true },
      setup: (draft) => {
        draft.players.opp.evidence = [
          { cardId: 'PRIVATE-UP', faceUp: true, origin: { turn: 0, via: 'init' } },
        ];
      },
    });
    const faceDown = runCausalAtom({
      sessionId: 'effect-evidence-face-down-noop',
      verb: 'evidenceFlipDown',
      args: { player: 'self', cardIds: ['PRIVATE-DOWN'] },
      setup: (draft) => {
        draft.players.self.evidence = [
          { cardId: 'PRIVATE-DOWN', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
    });

    expect(validateCausalLog(faceUp.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
    expect(validateCausalLog(faceDown.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
  });

  it('publishes only actual evidence face-down changes without evidence identities', () => {
    const state = runCausalAtom({
      sessionId: 'effect-evidence-face-down',
      verb: 'evidenceFlipDown',
      args: { player: 'self', cardIds: ['PRIVATE-UP', 'PRIVATE-DOWN'] },
      setup: (draft) => {
        draft.players.self.evidence = [
          { cardId: 'PRIVATE-UP', faceUp: true, origin: { turn: 0, via: 'init' } },
          { cardId: 'PRIVATE-DOWN', faceUp: false, origin: { turn: 0, via: 'init' } },
        ];
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['evidence', 'effect-evidence-face-down:1', { type: 'face-change', from: 'face-up', to: 'face-down', count: 1 }],
      ['summary', 'effect-evidence-face-down:2', { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('links the effect source, committed decision, and result across pause and resume', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'C'];
    startCausalSession(state, 'effect-choice');
    const entry: EffectStackEntry = {
      id: 'choice-entry',
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE-ID',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'choice',
        chooser: 'self',
        options: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);

    const paused = state.log as CausalLogEntryV1[];
    expect(paused).toHaveLength(1);
    expect(paused[0]).toMatchObject({
      eventId: 'effect-choice:1',
      kind: 'declare',
      source: { kind: 'player', side: 'self' },
      outcome: { type: 'state', state: 'active' },
    });

    const pending = _drainPendingEffectChoiceSide();
    expect(pending).not.toBeNull();
    applyChoiceAndContinuation(state, pending!, 0);

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => ({
      kind: node.kind,
      parentEventId: node.parentEventId,
      outcome: node.outcome,
    }))).toEqual([
      { kind: 'declare', parentEventId: undefined, outcome: { type: 'state', state: 'active' } },
      { kind: 'select', parentEventId: 'effect-choice:1', outcome: { type: 'state', state: 'success' } },
      { kind: 'draw', parentEventId: 'effect-choice:2', outcome: { type: 'move', from: 'deck', to: 'hand', count: 1 } },
      { kind: 'summary', parentEventId: 'effect-choice:3', outcome: { type: 'state', state: 'success' } },
    ]);
    expect(state.players.self.hand).toEqual(['A']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-SOURCE-ID');
    expect(JSON.stringify(state.log)).not.toContain('private-source-uid');
  });

  it('keeps a parallel pause on one causal trace until its tail completes', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['OPTION', 'TAIL', 'SPARE'];
    startCausalSession(state, 'effect-parallel-choice');
    const entry: EffectStackEntry = {
      id: 'parallel-choice-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'parallel',
        steps: [
          {
            kind: 'choice',
            chooser: 'self',
            options: [
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
              { kind: 'parallel', steps: [] },
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare']);
    const pending = _drainPendingEffectChoiceSide();
    applyChoiceAndContinuation(state, pending!, 0);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-parallel-choice:1'],
      ['draw', 'effect-parallel-choice:2'],
      ['draw', 'effect-parallel-choice:3'],
      ['summary', 'effect-parallel-choice:4'],
    ]);
    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });

  it('adopts completed parallel siblings before linking a later human decision', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['BEFORE', 'OPTION', 'TAIL', 'SPARE'];
    startCausalSession(state, 'effect-parallel-before-choice');
    const entry: EffectStackEntry = {
      id: 'parallel-before-choice-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'parallel',
        steps: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          {
            kind: 'choice',
            chooser: 'self',
            options: [
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
              { kind: 'parallel', steps: [] },
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['draw', 'effect-parallel-before-choice:1'],
    ]);
    expect(state.players.self.hand).toEqual(['BEFORE']);

    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['draw', 'effect-parallel-before-choice:1'],
      ['select', 'effect-parallel-before-choice:2'],
      ['draw', 'effect-parallel-before-choice:3'],
      ['draw', 'effect-parallel-before-choice:4'],
      ['summary', 'effect-parallel-before-choice:5'],
    ]);
    expect(state.players.self.hand).toEqual(['BEFORE', 'OPTION', 'TAIL']);
  });

  it('keeps a nested choice then RPS pause on one linear causal trace', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL', 'SPARE'];
    startCausalSession(state, 'effect-choice-rps');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const entry: EffectStackEntry = {
      id: 'choice-rps-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'parallel',
            steps: [
              {
                kind: 'choice',
                chooser: 'self',
                options: [
                  { kind: 'parallel', steps: [] },
                  { kind: 'parallel', steps: [] },
                ],
              },
              {
                kind: 'rps',
                win: { kind: 'parallel', steps: [] },
                lose: { kind: 'parallel', steps: [] },
              },
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map(node => node.kind))
      .toEqual(['declare']);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    expect(state.players.self.hand).toEqual([]);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map(node => node.kind))
      .toEqual(['declare', 'select']);

    const pendingRps = _drainPendingRpsSide()!;
    const winningHand = pendingRps.aiHand === 'rock'
      ? 'paper'
      : pendingRps.aiHand === 'paper' ? 'scissors' : 'rock';
    applyRpsAndContinuation(state, pendingRps, winningHand);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map(node => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-choice-rps:1'],
      ['select', 'effect-choice-rps:2'],
      ['draw', 'effect-choice-rps:3'],
      ['summary', 'effect-choice-rps:4'],
    ]);
    expect(state.players.self.hand).toEqual(['TAIL']);
  });

  it('records an optional decline as a successful decision with no invented effect result', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A'];
    startCausalSession(state, 'effect-optional');
    resolveEffectPicks(state, {
      kind: 'optional',
      chooser: 'owner',
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    }, {
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      bindings: {},
    }, {
      byPlayer: 'self',
      humanChooser: true,
      source: { cardId: 'PRIVATE', abilityId: 'a1' },
    });
    const pending = _drainPendingEffectOptionalSide();
    expect(pending).not.toBeNull();
    applyOptionalAndContinuation(state, pending!, false);

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'effect-optional:1'],
      ['summary', 'effect-optional:2'],
    ]);
    expect(state.players.self.hand).toEqual([]);
  });

  it('keeps repeat-optional pending inside the originating causal chain', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B'];
    startCausalSession(state, 'effect-repeat');
    const entry: EffectStackEntry = {
      id: 'repeat-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'repeatOptional',
        max: 1,
        body: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
      state: 'pending',
    };

    runOne(state, entry);

    const pending = _drainPendingEffectRepeatOptionalSide();
    expect(pending).not.toBeNull();
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
    ]);

    applyRepeatOptionalAndContinuation(state, pending!, true);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-repeat:1'],
      ['draw', 'effect-repeat:2'],
      ['summary', 'effect-repeat:3'],
    ]);
    expect(state.players.self.hand).toEqual(['A']);
  });

  it('keeps rock-paper-scissors inside one causal chain across the human decision', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // CPU chooses rock.
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B'];
    startCausalSession(state, 'effect-rps');
    const entry: EffectStackEntry = {
      id: 'rps-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'rps',
        win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        lose: { kind: 'parallel', steps: [] },
      },
      state: 'pending',
    };

    runOne(state, entry);

    const pending = _drainPendingRpsSide();
    expect(pending).not.toBeNull();
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
    ]);

    applyRpsAndContinuation(state, pending!, 'paper');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-rps:1'],
      ['draw', 'effect-rps:2'],
      ['summary', 'effect-rps:3'],
    ]);
    expect(state.players.self.hand).toEqual(['A']);
  });

  it('advances the same causal tail for every rock-paper-scissors tie retry', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.4); // rock, then paper.
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B'];
    startCausalSession(state, 'effect-rps-tie');
    const entry: EffectStackEntry = {
      id: 'rps-tie-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'rps',
        win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        lose: { kind: 'parallel', steps: [] },
      },
      state: 'pending',
    };

    runOne(state, entry);
    const first = _drainPendingRpsSide();
    applyRpsAndContinuation(state, first!, 'rock');

    const retry = _drainPendingRpsSide();
    expect(retry?.aiHand).toBe('paper');
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-rps-tie:1'],
    ]);

    applyRpsAndContinuation(state, retry!, 'scissors');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-rps-tie:1'],
      ['select', 'effect-rps-tie:2'],
      ['draw', 'effect-rps-tie:3'],
      ['summary', 'effect-rps-tie:4'],
    ]);
  });

  it('keeps an opaque set-card choice inside one public causal chain', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('HOST', 'host', {
      setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:hidden' }],
    })];
    startCausalSession(state, 'effect-set-card');
    const entry: EffectStackEntry = {
      id: 'set-card-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'moveSetCard',
        hostUid: 'host',
        face: 'down',
        destination: { area: 'hand' },
      },
      state: 'pending',
    };

    runOne(state, entry);

    const pending = _drainPendingSetCardChoiceSide();
    expect(pending?.entries).toEqual([{ instanceId: 'set:hidden', ordinal: 1, hidden: true }]);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
    ]);

    applySetCardChoiceAndContinuation(state, pending!, 'set:hidden');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-set-card:1'],
      ['summary', 'effect-set-card:2'],
    ]);
    expect(state.players.self.hand).toEqual(['SECRET']);
    expect(JSON.stringify(state.log)).not.toContain('SECRET');
    expect(JSON.stringify(state.log)).not.toContain('set:hidden');
  });

  it('emits nothing for a forged set-card response', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('HOST', 'host', {
      setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:hidden' }],
    })];
    startCausalSession(state, 'effect-set-invalid');
    runOne(state, {
      id: 'set-invalid-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'moveSetCard', hostUid: 'host', face: 'down', destination: { area: 'hand' } },
      state: 'pending',
    });
    const pending = _drainPendingSetCardChoiceSide();

    applySetCardChoiceAndContinuation(state, pending!, 'set:forged');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind)).toEqual(['declare']);
    expect(state.players.self.scene[0]?.setCards).toHaveLength(1);
  });

  it('closes a consumed set-card response as a fizzle when its occurrence became stale', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('HOST', 'host', {
      setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:hidden' }],
    })];
    startCausalSession(state, 'effect-set-stale');
    runOne(state, {
      id: 'set-stale-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'moveSetCard', hostUid: 'host', face: 'down', destination: { area: 'hand' } },
      state: 'pending',
    });
    const pending = _drainPendingSetCardChoiceSide();
    state.players.self.scene = [];

    applySetCardChoiceAndContinuation(state, pending!, 'set:hidden');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
      node.outcome,
    ])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['select', 'effect-set-stale:1', { type: 'state', state: 'success' }],
      ['fizzle', 'effect-set-stale:2', { type: 'state', state: 'fizzled' }],
    ]);
  });

  it('keeps deck reorder confirmation inside the originating causal chain', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['P1', 'P2', 'TAIL'];
    startCausalSession(state, 'effect-reorder');
    const entry: EffectStackEntry = {
      id: 'reorder-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: { player: 'self', bindKey: '$moved', order: 'arbitrary' },
      },
      bindings: {
        $moved: [
          { kind: 'card', cardId: 'P1', area: 'deck', player: 'self', index: 0 },
          { kind: 'card', cardId: 'P2', area: 'deck', player: 'self', index: 1 },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);

    const pending = _drainPendingDeckReorderSide();
    expect(pending?.cardIds).toEqual(['P1', 'P2']);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
    ]);

    applyDeckReorderAndContinuation(state, pending!, ['P2', 'P1']);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-reorder:1'],
      ['summary', 'effect-reorder:2'],
    ]);
    expect(state.players.self.deck).toEqual(['TAIL', 'P2', 'P1']);
    expect(JSON.stringify(state.log)).not.toContain('P1');
    expect(JSON.stringify(state.log)).not.toContain('P2');
  });

  it('keeps an already-bottom deck reorder inside the originating causal chain', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL', 'P1', 'P2'];
    startCausalSession(state, 'effect-bottom-reorder');
    runOne(state, {
      id: 'bottom-reorder-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'atom',
        verb: 'deckBottomReorderBound',
        args: { player: 'self', bindKey: '$moved' },
      },
      bindings: {
        $moved: [
          { kind: 'card', cardId: 'P1', area: 'deck', player: 'self', index: 1 },
          { kind: 'card', cardId: 'P2', area: 'deck', player: 'self', index: 2 },
        ],
      },
      state: 'pending',
    });

    const pending = _drainPendingDeckReorderSide();
    expect(pending?.cardIds).toEqual(['P1', 'P2']);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind)).toEqual(['declare']);

    applyDeckReorderAndContinuation(state, pending!, ['P2', 'P1']);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-bottom-reorder:1'],
      ['summary', 'effect-bottom-reorder:2'],
    ]);
    expect(state.players.self.deck).toEqual(['TAIL', 'P2', 'P1']);
  });

  it('keeps a Souza reorder inside the originating causal chain', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['P1', 'P2', 'TAIL'];
    startCausalSession(state, 'effect-souza-reorder');
    runOne(state, {
      id: 'souza-reorder-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: 'souza', args: { player: 'self', x: 2 } },
      state: 'pending',
    });

    const pending = _drainPendingDeckReorderSide();
    expect(pending?.cardIds).toEqual(['P1', 'P2']);
    expect(state.players.self.deck).toEqual(['TAIL', 'P1', 'P2']);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind)).toEqual(['declare']);

    applyDeckReorderAndContinuation(state, pending!, ['P2', 'P1']);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-souza-reorder:1'],
      ['summary', 'effect-souza-reorder:2'],
    ]);
    expect(state.players.self.deck).toEqual(['TAIL', 'P2', 'P1']);
  });

  it('keeps one open causal chain while a resumed continuation pauses a second time', () => {
    const state = createEmptyGameState();
    state.players.self.evidence.push({
      cardId: 'EV1',
      faceUp: false,
      origin: { turn: 0, via: 'init' },
    });
    state.players.self.hand.push('H0');
    state.players.self.deck.push('DRAW1');
    startCausalSession(state, 'effect-repause');
    const entry: EffectStackEntry = {
      id: 'repause-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'chain',
            steps: [
              { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
              { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
            ],
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);
    const first = _drainPendingEffectPickSide();
    expect(first?.atomVerb).toBe('evidenceToHand');
    applyPickAndContinuation(state, first!, first!.candidates[0]!.uid);

    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb).toBe('discard');
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-repause:1'],
      ['evidence', 'effect-repause:2'],
    ]);

    applyPickAndContinuation(state, second!, second!.candidates[0]!.uid);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-repause:1'],
      ['evidence', 'effect-repause:2'],
      ['select', 'effect-repause:3'],
      ['discard', 'effect-repause:4'],
      ['draw', 'effect-repause:5'],
      ['zone-move', 'effect-repause:6'],
      ['summary', 'effect-repause:7'],
    ]);
    expect(state.players.self.hand).toContain('DRAW1');
  });

  it('keeps the causal chain open when a skipped pick continues into another pause', () => {
    const state = createEmptyGameState();
    state.players.self.evidence.push({
      cardId: 'EV1',
      faceUp: false,
      origin: { turn: 0, via: 'init' },
    });
    state.players.self.hand.push('H0');
    state.players.self.deck.push('DRAW1');
    startCausalSession(state, 'effect-skip-repause');
    const entry: EffectStackEntry = {
      id: 'skip-repause-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
          { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };

    runOne(state, entry);
    const skipped = _drainPendingEffectPickSide();
    expect(skipped?.atomVerb).toBe('evidenceToHand');
    applyPickSkipAndContinuation(state, skipped!, false);

    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb).toBe('discard');
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-skip-repause:1'],
    ]);

    applyPickAndContinuation(state, second!, second!.candidates[0]!.uid);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [
      node.kind,
      node.parentEventId,
    ])).toEqual([
      ['declare', undefined],
      ['select', 'effect-skip-repause:1'],
      ['select', 'effect-skip-repause:2'],
      ['discard', 'effect-skip-repause:3'],
      ['draw', 'effect-skip-repause:4'],
      ['zone-move', 'effect-skip-repause:5'],
      ['summary', 'effect-skip-repause:6'],
    ]);
    expect(state.players.self.hand).toContain('DRAW1');
  });

  it('links a terminal result directly to its resolving effect without a trailing summary', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'effect-terminal');
    const entry: EffectStackEntry = {
      id: 'terminal-entry',
      source: { player: 'self', cardId: 'PRIVATE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: 'opponentLoses', args: { player: 'self' } },
      state: 'pending',
    };

    runOne(state, entry);

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['game-result', 'effect-terminal:1'],
    ]);
    expect(state.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
  });

  it('converts a child correlation into one idempotent trace', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'effect-correlation');
    const parent = appendCausal(state, {
      actor: 'self',
      kind: 'activate',
      source: { kind: 'player', side: 'self' },
      targets: [],
      outcome: { type: 'state', state: 'active' },
    });
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', abilityId: 'a1' },
      bindings: {},
      causal: { correlationEventId: parent.eventId },
    };

    const first = ensureEffectCausalTrace(state, ctx);
    const second = ensureEffectCausalTrace(state, ctx);

    expect(second).toBe(first);
    expect(ctx.causal).toEqual({ trace: first });
    expect(state.log).toHaveLength(2);
    expect(state.log[1]).toMatchObject({
      kind: 'declare',
      correlationEventId: parent.eventId,
    });
  });

  it('removes a stale child correlation when restoring a paused trace', () => {
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', abilityId: 'a1' },
      bindings: {},
      causal: { correlationEventId: 'stale-parent' },
    };

    const restored = restoreEffectCausalTrace(ctx, {
      rootEventId: 'effect-root',
      tailEventId: 'effect-tail',
      awaitingResume: true,
    });

    expect(ctx.causal).toEqual({ trace: restored });
  });
});
