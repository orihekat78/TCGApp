import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import {
  appendCausal,
  normalizeGameLog,
  normalizeLogEntry,
  projectPublicCausalRef,
  startCausalSession,
  traverseCausalLog,
  validateCausalLog,
} from '@/engine/log/causal';
import type {
  CausalLogEntryV1,
  GameState,
  LegacyLogEntry,
  SceneCharacter,
} from '@/engine/types';

const publicPlayerLocator = {
  kind: 'player' as const,
  side: 'opp' as const,
};

describe('causal log graph', () => {
  it('allocates deterministic event IDs and sequence from GameState', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'match-42');

    const source = appendCausal(state, {
      actor: 'opp',
      kind: 'use',
      source: publicPlayerLocator,
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    const result = appendCausal(state, {
      actor: 'opp',
      kind: 'draw',
      parentEventId: source.eventId,
      targets: [publicPlayerLocator],
      outcome: { type: 'count', amount: 1, unit: 'card' },
    });

    expect(source).toMatchObject({
      schemaVersion: 1,
      eventId: 'match-42:1',
      sessionId: 'match-42',
      sequence: 1,
      player: 'opp',
      action: 'causal.use',
    });
    expect(result).toMatchObject({
      eventId: 'match-42:2',
      sequence: 2,
      parentEventId: 'match-42:1',
      action: 'causal.draw',
    });
    expect(result.targets[0]).toEqual({
      visibility: 'public',
      kind: 'player',
      label: '相手',
      side: 'opp',
    });
    expect(state.causalLog).toEqual({ schemaVersion: 1, sessionId: 'match-42', nextSequence: 3 });
    expect(state.log).toEqual([source, result]);
  });

  it('persists validated semantic tags for normalized consumers', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'tagged');
    const tagged = appendCausal(state, {
      actor: 'self', kind: 'declare', tags: ['contact', 'hirameki'],
      targets: [], outcome: { type: 'state', state: 'success' },
    });

    expect(tagged.tags).toEqual(['contact', 'hirameki']);
    expect(normalizeGameLog(state, { legacySessionId: 'legacy' }).nodes[0].tags)
      .toEqual(['contact', 'hirameki']);
    expect(() => appendCausal(state, {
      actor: 'self', kind: 'declare', tags: ['contact', 'contact'],
      targets: [], outcome: { type: 'none' },
    })).toThrow(/tags/i);
  });

  it('projects public card identity from live state instead of accepting labels from producers', () => {
    const state = populatedPublicState();

    expect(projectPublicCausalRef(state, { kind: 'scene-card', side: 'opp', uid: 'opp-scene' }))
      .toMatchObject({ kind: 'card', side: 'opp', zone: 'scene', cardNumber: 'PUBLIC-SCENE' });
    expect(projectPublicCausalRef(state, { kind: 'partner-card', side: 'opp' }))
      .toMatchObject({ kind: 'card', side: 'opp', zone: 'partner', cardNumber: 'PUBLIC-PARTNER' });
    expect(projectPublicCausalRef(state, { kind: 'case-card', side: 'opp' }))
      .toMatchObject({ kind: 'card', side: 'opp', zone: 'case', cardNumber: 'PUBLIC-CASE' });
    expect(projectPublicCausalRef(state, {
      kind: 'set-card', side: 'opp', hostUid: 'opp-scene', instanceId: 'set-up',
    })).toMatchObject({ kind: 'card', side: 'opp', zone: 'scene', cardNumber: 'PUBLIC-SET' });
    expect(projectPublicCausalRef(state, { kind: 'evidence-card', side: 'opp', index: 0 }))
      .toMatchObject({ kind: 'card', side: 'opp', zone: 'evidence', cardNumber: 'PUBLIC-EVIDENCE' });
    expect(projectPublicCausalRef(state, { kind: 'file-card', side: 'opp', index: 0 }))
      .toMatchObject({ kind: 'card', side: 'opp', zone: 'file', cardNumber: 'PUBLIC-FILE' });
    expect(projectPublicCausalRef(state, { kind: 'zone', side: 'opp', zone: 'hand' }))
      .toEqual({ visibility: 'public', kind: 'zone', label: '相手の手札', side: 'opp', zone: 'hand' });

    expect(() => projectPublicCausalRef(state, {
      visibility: 'public', kind: 'card', label: 'forged', cardNumber: 'SECRET-HAND',
    } as never)).toThrow(/locator/i);
  });

  it('never projects hidden or stale card identity', () => {
    const state = populatedPublicState();

    expect(() => projectPublicCausalRef(state, {
      kind: 'set-card', side: 'opp', hostUid: 'opp-scene', instanceId: 'set-down',
    })).toThrow(/hidden|public/i);
    expect(() => projectPublicCausalRef(state, { kind: 'evidence-card', side: 'opp', index: 1 }))
      .toThrow(/hidden|public/i);
    expect(() => projectPublicCausalRef(state, { kind: 'file-card', side: 'opp', index: 1 }))
      .toThrow(/hidden|public/i);
    expect(projectPublicCausalRef(state, { kind: 'file-card', side: 'opp', index: 2 }))
      .toMatchObject({
        kind: 'card', side: 'opp', zone: 'file', cardNumber: 'PUBLIC-ASSISTED-PARTNER',
      });
    state.players.opp.partner.cardId = 'PUBLIC-ASSISTED-PARTNER';
    state.players.opp.partner.location = 'file-area';
    expect(projectPublicCausalRef(state, { kind: 'partner-card', side: 'opp' }))
      .toMatchObject({
        kind: 'card', side: 'opp', zone: 'file', cardNumber: 'PUBLIC-ASSISTED-PARTNER',
      });
    expect(() => projectPublicCausalRef(state, { kind: 'scene-card', side: 'opp', uid: 'missing' }))
      .toThrow(/stale|missing/i);
    expect(() => projectPublicCausalRef(state, {
      kind: 'set-card', side: 'self', hostUid: 'opp-scene', instanceId: 'set-up',
    })).toThrow(/stale|missing/i);
    expect(() => projectPublicCausalRef(state, { kind: 'evidence-card', side: 'opp', index: 99 }))
      .toThrow(/stale|missing/i);
    expect(() => projectPublicCausalRef(state, { kind: 'hand-card', side: 'opp', index: 0 } as never))
      .toThrow(/locator/i);
    expect(() => projectPublicCausalRef(state, { kind: 'deck-card', side: 'self', index: 0 } as never))
      .toThrow(/locator/i);
  });

  it('rejects private visibility, hidden identifiers, and unknown causal entry fields', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'public-only');

    expect(() => appendCausal(state, {
      actor: 'self',
      kind: 'select',
      source: { ...publicPlayerLocator, cardId: 'secret-card' } as never,
      targets: [],
      outcome: { type: 'none' },
    })).toThrow(/locator|unknown/i);

    expect(() => normalizeLogEntry({ ...entry(1), hiddenCardId: 'secret-card' } as never, {
      sessionId: 'ignored', sequence: 1,
    })).toThrow(/hiddenCardId|unknown/i);
    expect(() => normalizeLogEntry({ ...entry(1), cardId: 'secret-card' } as never, {
      sessionId: 'ignored', sequence: 1,
    })).toThrow(/cardId|unknown/i);
  });

  it.each(['hand', 'deck'] as const)(
    'rejects a prebuilt causal card identity in the hidden %s zone',
    (zone) => {
      const forged = entry(1, {
        source: {
          visibility: 'public',
          kind: 'card',
          label: `SECRET-${zone}`,
          side: 'opp',
          zone,
          cardNumber: `SECRET-${zone}`,
        },
      });

      expect(() => normalizeLogEntry(forged, { sessionId: 'ignored', sequence: 99 }))
        .toThrow(/hidden|public|zone/i);
      expect(() => validateCausalLog([forged]))
        .toThrow(/hidden|public|zone/i);
    },
  );

  it('normalizes legacy logs without copying target or result text', () => {
    const legacy: LegacyLogEntry = {
      ts: 10,
      player: 'opp',
      turn: 2,
      action: 'deck.draw',
      target: 'hidden-card-id',
      targetAudience: 'opp',
      result: 'private result detail',
    };

    const normalized = normalizeLogEntry(legacy, { sessionId: 'legacy-1', sequence: 7 });

    expect(normalized).toMatchObject({
      schemaVersion: 1,
      eventId: 'legacy-1:7',
      sessionId: 'legacy-1',
      sequence: 7,
      actor: 'opp',
      kind: 'draw',
      targets: [],
      outcome: { type: 'none' },
    });
    expect(normalized.target).toBeUndefined();
    expect(normalized.result).toBeUndefined();
    expect(normalized.targetAudience).toBeUndefined();
  });

  it('keeps case status transitions distinct from a winning case resolution', () => {
    const state = createEmptyGameState();
    state.players.self.case.cardId = 'PUBLIC-CASE';
    startCausalSession(state, 'case-status');

    const transition = appendCausal(state, {
      actor: 'self',
      kind: 'case-status-change',
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'case-card', side: 'self' }],
      outcome: { type: 'case-status', from: 'incident', to: 'resolved' },
    });

    expect(transition).toMatchObject({
      action: 'causal.case-status-change',
      kind: 'case-status-change',
      outcome: { type: 'case-status', from: 'incident', to: 'resolved' },
      result: 'incident->resolved',
    });
  });

  it('accepts only directional public evidence face changes with a positive count', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'face-change');

    expect(appendCausal(state, {
      actor: 'self',
      kind: 'evidence',
      targets: [{ kind: 'zone', side: 'opp', zone: 'evidence' }],
      outcome: { type: 'face-change', from: 'face-down', to: 'face-up', count: 2 },
    })).toMatchObject({
      outcome: { type: 'face-change', from: 'face-down', to: 'face-up', count: 2 },
      result: 'face-down->face-up:2',
    });

    for (const outcome of [
      { type: 'face-change', from: 'face-up', to: 'face-up', count: 1 },
      { type: 'face-change', from: 'face-down', to: 'face-up', count: 0 },
      { type: 'face-change', from: 'hidden', to: 'face-up', count: 1 },
    ]) {
      expect(() => appendCausal(state, {
        actor: 'self', kind: 'evidence', targets: [], outcome: outcome as never,
      })).toThrow(/face|outcome/i);
    }
  });

  it('accepts face-change and activate only with their truthful outcomes', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'state-vocabulary');

    expect(appendCausal(state, {
      actor: 'self', kind: 'face-change', targets: [],
      outcome: { type: 'face-change', from: 'face-down', to: 'face-up', count: 1 },
    })).toMatchObject({ action: 'causal.face-change' });
    expect(appendCausal(state, {
      actor: 'opp', kind: 'activate', targets: [],
      outcome: { type: 'state', state: 'active' },
    })).toMatchObject({ action: 'causal.activate' });

    expect(() => appendCausal(state, {
      actor: 'self', kind: 'face-change', targets: [], outcome: { type: 'none' },
    })).toThrow(/kind|outcome/i);
    expect(() => appendCausal(state, {
      actor: 'self', kind: 'activate', targets: [], outcome: { type: 'state', state: 'sleep' },
    })).toThrow(/kind|outcome/i);
  });

  it('normalizes legacy case status logs without rewriting historic case-resolve entries', () => {
    const transitioned = normalizeLogEntry({
      ts: 1, player: 'self', turn: 1, action: 'effect:caseToResolved',
    }, { sessionId: 'legacy-case', sequence: 1 });
    expect(transitioned).toMatchObject({
      kind: 'case-status-change', action: 'causal.case-status-change', outcome: { type: 'none' },
    });

    expect(validateCausalLog([entry(1, {
      action: 'causal.case-resolve',
      kind: 'case-resolve',
      outcome: { type: 'state', state: 'success' },
      result: 'success',
    })])[0]).toMatchObject({ kind: 'case-resolve', action: 'causal.case-resolve' });
  });

  it('derives only allowlisted public presentation semantics from legacy logs', () => {
    const contactHit: LegacyLogEntry = {
      ts: 1, player: 'self', turn: 1, action: 'contact-judge',
      result: '6000 VS 4000 -> HIT',
    };
    const contactMiss: LegacyLogEntry = {
      ...contactHit, ts: 2, result: '2000 VS 4000 -> MISS',
    };
    const refresh: LegacyLogEntry = {
      ts: 3, player: 'opp', turn: 1, action: 'refresh', result: 'private deck detail',
    };
    const state = createEmptyGameState();
    state.log.push(contactHit, contactMiss, refresh);

    const hit = normalizeLogEntry(contactHit, { sessionId: 'legacy', sequence: 1 });
    expect(hit.tags).toEqual(['contact']);
    expect(hit.outcome).toEqual({ type: 'state', state: 'success' });
    expect(hit.result).toBeUndefined();

    const nodes = normalizeGameLog(state, { legacySessionId: 'legacy' }).nodes;
    expect(nodes[1]).toMatchObject({
      tags: ['contact'], outcome: { type: 'state', state: 'failed' },
    });
    expect(nodes[2]).toMatchObject({ tags: ['refresh'], outcome: { type: 'none' } });

    const unknown = normalizeLogEntry({
      ...contactHit, result: 'private resolution detail',
    }, { sessionId: 'legacy', sequence: 4 });
    expect(unknown.outcome).toEqual({ type: 'none' });
  });

  it('fails closed on unsupported versions, malformed scalars, and unknown legacy fields', () => {
    expect(() => normalizeLogEntry({ ...entry(1), schemaVersion: 2 } as never, {
      sessionId: 'legacy', sequence: 1,
    })).toThrow(/unsupported.*version/i);
    expect(() => validateCausalLog([{ ...entry(1), ts: Number.NaN }])).toThrow(/timestamp/i);
    expect(() => validateCausalLog([{ ...entry(1), turn: -1 }])).toThrow(/turn/i);
    expect(() => validateCausalLog([{ ...entry(1), parentEventId: 1 as never }])).toThrow(/edge/i);
    expect(() => normalizeLogEntry({
      ts: 1, player: 'self', turn: 1, action: 'draw', privateCardId: 'SECRET',
    } as never, { sessionId: 'legacy', sequence: 1 })).toThrow(/privateCardId|unknown/i);
  });

  it('rejects malformed topology and returns a stable topological traversal', () => {
    const entries: CausalLogEntryV1[] = [
      entry(1),
      entry(2, { parentEventId: 'graph:1' }),
      entry(3, { correlationEventId: 'graph:1' }),
    ];

    expect(validateCausalLog(entries)).toEqual(entries);
    expect(traverseCausalLog([entries[2], entries[0], entries[1]])).toEqual(entries);

    expect(() => validateCausalLog([entries[0], { ...entries[0] }])).toThrow(/duplicate/i);
    expect(() => validateCausalLog([entries[0], { ...entries[1], parentEventId: 'graph:99' }])).toThrow(/missing/i);
    expect(() => validateCausalLog([entries[0], { ...entries[1], parentEventId: 'other:1' }])).toThrow(/cross-session|session/i);
    expect(() => validateCausalLog([entries[0], { ...entries[1], parentEventId: 'graph:3' }, entries[2]])).toThrow(/forward/i);

    const cyclic = [
      entry(1, { parentEventId: 'graph:2' }),
      entry(2, { parentEventId: 'graph:1' }),
    ];
    expect(() => validateCausalLog(cyclic)).toThrow(/cycle/i);
  });

  it('continues exactly after JSON restore and rejects stale allocators', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'round-trip');
    appendCausal(state, {
      actor: 'self', kind: 'evidence', targets: [publicPlayerLocator],
      outcome: { type: 'count', amount: 1, unit: 'evidence' },
    });

    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    const second = appendCausal(restored, {
      actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' },
    });
    expect(second.eventId).toBe('round-trip:2');
    expect(restored.causalLog?.nextSequence).toBe(3);

    const staleLow = JSON.parse(JSON.stringify(restored)) as typeof state;
    staleLow.causalLog!.nextSequence = 1;
    expect(() => appendCausal(staleLow, {
      actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' },
    })).toThrow(/allocator|sequence/i);

    const staleHigh = JSON.parse(JSON.stringify(restored)) as typeof state;
    staleHigh.causalLog!.nextSequence = 99;
    expect(() => appendCausal(staleHigh, {
      actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' },
    })).toThrow(/allocator|sequence/i);
  });

  it('clears the causal session and rejects causal-shaped entries through the legacy writer', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'clear-me');
    appendCausal(state, { actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' } });

    expect(() => mutate.log.append(state, entry(2) as never)).toThrow(/causal|legacy/i);
    mutate.log.clear(state);
    expect(state.log).toEqual([]);
    expect(state.causalLog).toBeUndefined();
    expect(() => appendCausal(state, {
      actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' },
    })).toThrow(/not initialized/i);

    startCausalSession(state, 'fresh');
    expect(appendCausal(state, {
      actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' },
    }).eventId).toBe('fresh:1');
  });

  it('routes legacy engine producers into the active causal session without private text', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'live-producers');

    mutate.log.append(state, {
      ts: Date.now(),
      player: 'self',
      turn: 3,
      action: 'handUseCard',
      target: 'SECRET-HAND-CARD',
      result: 'private resolution detail',
    });
    mutate.log.append(state, {
      ts: Date.now(),
      player: 'opp',
      turn: 3,
      action: 'contact-judge',
      result: '6000 VS 4000 -> HIT',
    });

    expect(state.log).toHaveLength(2);
    expect(state.log[0]).toMatchObject({
      schemaVersion: 1,
      eventId: 'live-producers:1',
      sequence: 1,
      actor: 'self',
      kind: 'use',
      targets: [],
      outcome: { type: 'none' },
    });
    expect(state.log[1]).toMatchObject({
      schemaVersion: 1,
      eventId: 'live-producers:2',
      sequence: 2,
      actor: 'opp',
      kind: 'declare',
      tags: ['contact'],
      outcome: { type: 'state', state: 'success' },
    });
    expect(JSON.stringify(state.log)).not.toContain('SECRET-HAND-CARD');
    expect(JSON.stringify(state.log)).not.toContain('private resolution detail');
  });

  it('appends one public terminal causal event through the game-result primitive', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'terminal-producer');

    mutate.gameResult.set(state, 'self', 'evidence');
    mutate.gameResult.set(state, 'self', 'evidence');
    mutate.gameResult.set(state, 'opp', 'deck-out');
    mutate.log.append(state, {
      ts: Date.now(),
      player: 'opp',
      turn: state.turn.number,
      action: 'post-terminal-summary',
    });

    expect(state.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({
      schemaVersion: 1,
      eventId: 'terminal-producer:1',
      actor: 'self',
      kind: 'game-result',
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'player', side: 'opp' }],
      outcome: { type: 'state', state: 'success' },
    });
    expect(() => appendCausal(state, {
      actor: 'self',
      kind: 'summary',
      source: publicPlayerLocator,
      targets: [],
      outcome: { type: 'state', state: 'success' },
    })).toThrow('Cannot append a causal event after game-result');
  });

  it('normalizes one mixed legacy/causal graph without private legacy text', () => {
    const state = createEmptyGameState();
    state.log = [
      { ts: 1, player: 'self', turn: 1, action: 'contact-judge', target: 'SECRET', result: 'SECRET' },
      entry(1),
      { ts: 3, player: 'opp', turn: 1, action: 'hirameki:resolve', targetAudience: 'opp' },
    ];
    state.causalLog = { schemaVersion: 1, sessionId: 'graph', nextSequence: 2 };

    const graph = normalizeGameLog(state, { legacySessionId: 'legacy-mixed' });
    expect(graph.sessionId).toBe('graph');
    expect(graph.nodes.map((node) => ({ id: node.id, order: node.order, origin: node.origin }))).toEqual([
      { id: 'legacy-mixed:legacy:1', order: 1, origin: 'legacy' },
      { id: 'graph:1', order: 2, origin: 'causal' },
      { id: 'legacy-mixed:legacy:3', order: 3, origin: 'legacy' },
    ]);
    expect(graph.nodes[0].tags).toContain('contact');
    expect(graph.nodes[2].tags).toContain('hirameki');
    expect(JSON.stringify(graph)).not.toContain('SECRET');
    expect(graph.nodes[0].targets).toEqual([]);
  });

  it('produces an identical public graph for self, opponent, and spectator consumers', () => {
    const state = populatedPublicState();
    startCausalSession(state, 'viewer-neutral');
    appendCausal(state, {
      actor: 'opp', kind: 'select',
      source: { kind: 'scene-card', side: 'opp', uid: 'opp-scene' },
      targets: [{ kind: 'player', side: 'self' }],
      outcome: { type: 'state', state: 'success' },
    });

    const selfGraph = normalizeGameLog(state, { legacySessionId: 'legacy' });
    const opponentGraph = normalizeGameLog(state, { legacySessionId: 'legacy' });
    const spectatorGraph = normalizeGameLog(state, { legacySessionId: 'legacy' });
    expect(opponentGraph).toEqual(selfGraph);
    expect(spectatorGraph).toEqual(selfGraph);
  });
});

function populatedPublicState(): GameState {
  const state = createEmptyGameState();
  state.players.opp.partner.cardId = 'PUBLIC-PARTNER';
  state.players.opp.case.cardId = 'PUBLIC-CASE';
  state.players.opp.scene = [scene({
    cardId: 'PUBLIC-SCENE', uid: 'opp-scene',
    setCards: [
      { cardId: 'PUBLIC-SET', faceUp: true, instanceId: 'set-up' },
      { cardId: 'SECRET-SET', faceUp: false, instanceId: 'set-down' },
    ],
  })];
  state.players.opp.evidence = [
    { cardId: 'PUBLIC-EVIDENCE', faceUp: true, origin: { turn: 1, via: 'effect' } },
    { cardId: 'SECRET-EVIDENCE', faceUp: false, origin: { turn: 1, via: 'effect' } },
  ];
  state.players.opp.file = [
    { type: 'card-back', cardId: 'PUBLIC-FILE', faceUp: true },
    { type: 'card-back', cardId: 'SECRET-FILE' },
    { type: 'assisted-partner', cardId: 'PUBLIC-ASSISTED-PARTNER' },
  ];
  state.players.opp.hand = ['SECRET-HAND'];
  state.players.self.deck = ['SECRET-DECK'];
  return state;
}

function scene(patch: Partial<SceneCharacter>): SceneCharacter {
  return {
    cardId: 'CARD',
    uid: 'uid',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: [],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...patch,
  };
}

function entry(sequence: number, patch: Partial<CausalLogEntryV1> = {}): CausalLogEntryV1 {
  return {
    schemaVersion: 1,
    eventId: `graph:${sequence}`,
    sessionId: 'graph',
    sequence,
    ts: sequence,
    turn: 1,
    player: 'self',
    actor: 'self',
    action: 'causal.draw',
    kind: 'draw',
    targets: [],
    outcome: { type: 'none' },
    ...patch,
  };
}
