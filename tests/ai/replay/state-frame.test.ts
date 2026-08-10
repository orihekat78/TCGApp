import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  assertReplayLogV3,
  buildReplayLogV3,
  canonicalReplayJson,
  replayStateAt,
  replayStates,
  replayStepCount,
} from '@/ai/replay/state-frame';
import type { CausalEventKind, CausalLogEntryV1 } from '@/engine/types';

function stateFor(sessionId: string, turn: number, cardId: string) {
  const state = createEmptyGameState();
  state.causalLog = { schemaVersion: 1, sessionId, nextSequence: 1 };
  state.turn.number = turn;
  state.turn.phase = 'main';
  state.players.self.case.cardId = cardId;
  return state;
}

function appendCausalEntry(
  state: ReturnType<typeof createEmptyGameState>,
  kind: CausalEventKind,
  actor: 'self' | 'opp' = 'self',
): void {
  const allocator = state.causalLog!;
  const sequence = allocator.nextSequence;
  const entry: CausalLogEntryV1 = {
    schemaVersion: 1,
    eventId: `${allocator.sessionId}:${sequence}`,
    sessionId: allocator.sessionId,
    sequence,
    ts: sequence,
    player: actor,
    actor,
    turn: state.turn.number,
    action: `causal.${kind}`,
    kind,
    ...(kind === 'game-result' ? {
      source: { visibility: 'public' as const, kind: 'player' as const, label: actor, side: actor },
      target: actor === 'self' ? 'opp' : 'self',
      result: 'success',
      targets: [{
        visibility: 'public' as const,
        kind: 'player' as const,
        label: actor === 'self' ? 'opp' : 'self',
        side: actor === 'self' ? 'opp' as const : 'self' as const,
      }],
      outcome: { type: 'state' as const, state: 'success' as const },
    } : {
      targets: [],
      outcome: { type: 'none' as const },
    }),
  };
  state.log.push(entry);
  allocator.nextSequence += 1;
}

function setTerminalResult(
  state: ReturnType<typeof createEmptyGameState>,
  winner: 'self' | 'opp',
  reason: 'evidence' | 'deck-out' | 'concede' | 'alt-lose',
): void {
  appendCausalEntry(state, 'game-result', winner);
  state.gameResult = { winner, reason };
}

function replayDigest(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalReplayJson(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64-${hash.toString(16).padStart(16, '0')}`;
}

describe('ReplayLogV3 state-frame graph', () => {
  it('reconstructs every accepted GameState without dispatching engine actions', () => {
    const sessionId = 'match-replay-v3';
    const initial = stateFor(sessionId, 1, 'CASE-A');
    const middle = structuredClone(initial);
    middle.players.self.hand.push('D08001');
    const terminal = structuredClone(middle);
    terminal.turn.number = 2;
    setTerminalResult(terminal, 'self', 'evidence');

    const log = buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, middle, terminal],
    });

    expect(replayStepCount(log)).toBe(2);
    expect(replayStateAt(log, 0)).toEqual(initial);
    expect(replayStateAt(log, 1)).toEqual(middle);
    expect(replayStateAt(log, 2)).toEqual(terminal);
    expect(replayStates(log)).toEqual([initial, middle, terminal]);
    expect(log.frames.map((frame) => frame.parentFrameId)).toEqual([
      log.initialFrameId,
      log.frames[0]!.frameId,
    ]);
  });

  it('deduplicates unchanged commits while keeping contiguous graph sequences', () => {
    const sessionId = 'match-replay-dedupe';
    const initial = stateFor(sessionId, 1, 'CASE-A');
    const terminal = structuredClone(initial);
    setTerminalResult(terminal, 'opp', 'deck-out');

    const log = buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'spectator',
      states: [initial, structuredClone(initial), terminal],
    });

    expect(log.frames).toHaveLength(1);
    expect(log.frames[0]).toMatchObject({ sequence: 1, parentFrameId: log.initialFrameId });
  });

  it('requires each frame to declare the exact ordered causal-event delta', () => {
    const sessionId = 'match-replay-causal-delta';
    const initial = stateFor(sessionId, 1, 'D08026');
    const middle = structuredClone(initial);
    appendCausalEntry(middle, 'draw');
    const terminal = structuredClone(middle);
    setTerminalResult(terminal, 'self', 'evidence');

    const log = buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, middle, terminal],
    });
    expect(log.frames.map((frame) => frame.causalEventIds)).toEqual([
      [`${sessionId}:1`],
      [`${sessionId}:2`],
    ]);

    const omitted = structuredClone(log);
    omitted.frames[0]!.causalEventIds = [];
    expect(() => assertReplayLogV3(omitted)).toThrow(/causal event delta/i);

    const stale = structuredClone(log);
    stale.frames[1]!.causalEventIds = [`${sessionId}:1`];
    expect(() => assertReplayLogV3(stale)).toThrow(/causal event delta/i);

    const duplicate = structuredClone(log);
    duplicate.frames[0]!.causalEventIds = [`${sessionId}:1`, `${sessionId}:1`];
    expect(() => assertReplayLogV3(duplicate)).toThrow(/causal event delta/i);
  });

  it('rejects conflicting terminal transitions and every post-terminal mutation', () => {
    const sessionId = 'match-replay-terminal-boundary';
    const initial = stateFor(sessionId, 1, 'D08026');
    const terminal = structuredClone(initial);
    setTerminalResult(terminal, 'self', 'evidence');

    const contradictory = structuredClone(terminal);
    appendCausalEntry(contradictory, 'game-result');
    contradictory.gameResult = { winner: 'opp', reason: 'deck-out' };
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-contradictory`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, terminal, contradictory],
    })).toThrow(/terminal|game-result/i);

    const postTerminal = structuredClone(terminal);
    postTerminal.players.self.hand.push('D08001');
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-post-terminal`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, terminal, postTerminal],
    })).toThrow(/post-terminal|terminal/i);
  });

  it('rejects causal events appended after game-result', () => {
    const sessionId = 'match-replay-terminal-order';
    const initial = stateFor(sessionId, 1, 'D08026');
    const terminal = structuredClone(initial);
    appendCausalEntry(terminal, 'game-result');
    appendCausalEntry(terminal, 'summary');
    terminal.gameResult = { winner: 'self', reason: 'evidence' };

    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, terminal],
    })).toThrow(/after.*game-result|terminal.*event/i);
  });

  it('requires one terminal event whose actor, source, and target match the winner', () => {
    const sessionId = 'match-replay-terminal-semantics';
    const initial = stateFor(sessionId, 1, 'D08026');

    const missing = structuredClone(initial);
    missing.gameResult = { winner: 'opp', reason: 'deck-out' };
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-missing`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, missing],
    })).toThrow(/game-result|terminal event/i);

    const mismatchedActor = structuredClone(initial);
    appendCausalEntry(mismatchedActor, 'game-result');
    mismatchedActor.gameResult = { winner: 'opp', reason: 'deck-out' };
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-actor`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, mismatchedActor],
    })).toThrow(/actor|winner/i);

    const mismatchedSource = structuredClone(initial);
    appendCausalEntry(mismatchedSource, 'game-result');
    mismatchedSource.gameResult = { winner: 'self', reason: 'evidence' };
    (mismatchedSource.log[0] as CausalLogEntryV1).source = {
      visibility: 'public', kind: 'player', label: 'CPU', side: 'opp',
    };
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-source`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, mismatchedSource],
    })).toThrow(/source|winner/i);

    const mismatchedTarget = structuredClone(initial);
    appendCausalEntry(mismatchedTarget, 'game-result');
    mismatchedTarget.gameResult = { winner: 'self', reason: 'evidence' };
    (mismatchedTarget.log[0] as CausalLogEntryV1).targets = [{
      visibility: 'public', kind: 'player', label: 'プレイヤー', side: 'self',
    }];
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-target`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, mismatchedTarget],
    })).toThrow(/target|loser/i);

    const mismatchedOutcome = structuredClone(initial);
    appendCausalEntry(mismatchedOutcome, 'game-result');
    mismatchedOutcome.gameResult = { winner: 'self', reason: 'evidence' };
    (mismatchedOutcome.log[0] as CausalLogEntryV1).outcome = {
      type: 'state', state: 'fizzled',
    };
    (mismatchedOutcome.log[0] as CausalLogEntryV1).result = 'fizzled';
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-outcome`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, mismatchedOutcome],
    })).toThrow(/outcome|success/i);

    const mismatchedTurn = structuredClone(initial);
    mismatchedTurn.turn.number = 9;
    appendCausalEntry(mismatchedTurn, 'game-result');
    mismatchedTurn.gameResult = { winner: 'self', reason: 'evidence' };
    (mismatchedTurn.log[0] as CausalLogEntryV1).turn = 1;
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-turn`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, mismatchedTurn],
    })).toThrow(/event turn|terminal turn/i);
  });

  it('rejects the same terminal semantic corruption when loading a stored V3 artifact', () => {
    const sessionId = 'match-replay-stored-terminal-semantics';
    const terminal = stateFor(sessionId, 1, 'D08026');
    setTerminalResult(terminal, 'self', 'evidence');
    const valid = buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [terminal],
    });

    const missing = structuredClone(valid);
    missing.initialState.log = [];
    missing.initialState.causalLog!.nextSequence = 1;
    missing.initialStateDigest = replayDigest(missing.initialState);
    expect(() => assertReplayLogV3(missing)).toThrow(/game-result|terminal event/i);

    const actorMismatch = structuredClone(valid);
    const actorEvent = actorMismatch.initialState.log[0] as CausalLogEntryV1;
    actorEvent.actor = 'opp';
    actorEvent.player = 'opp';
    actorMismatch.initialStateDigest = replayDigest(actorMismatch.initialState);
    expect(() => assertReplayLogV3(actorMismatch)).toThrow(/actor|winner/i);

    const sourceMismatch = structuredClone(valid);
    const sourceEvent = sourceMismatch.initialState.log[0] as CausalLogEntryV1;
    sourceEvent.source = { visibility: 'public', kind: 'player', label: 'opp', side: 'opp' };
    sourceMismatch.initialStateDigest = replayDigest(sourceMismatch.initialState);
    expect(() => assertReplayLogV3(sourceMismatch)).toThrow(/source|winner/i);

    const targetMismatch = structuredClone(valid);
    const targetEvent = targetMismatch.initialState.log[0] as CausalLogEntryV1;
    targetEvent.targets = [{ visibility: 'public', kind: 'player', label: 'self', side: 'self' }];
    targetEvent.target = 'self';
    targetMismatch.initialStateDigest = replayDigest(targetMismatch.initialState);
    expect(() => assertReplayLogV3(targetMismatch)).toThrow(/target|loser/i);

    const outcomeMismatch = structuredClone(valid);
    (outcomeMismatch.initialState.log[0] as CausalLogEntryV1).outcome = {
      type: 'state', state: 'fizzled',
    };
    (outcomeMismatch.initialState.log[0] as CausalLogEntryV1).result = 'fizzled';
    outcomeMismatch.initialStateDigest = replayDigest(outcomeMismatch.initialState);
    expect(() => assertReplayLogV3(outcomeMismatch)).toThrow(/outcome|success/i);

    const turnMismatch = structuredClone(valid);
    turnMismatch.initialState.turn.number = 9;
    (turnMismatch.initialState.log[0] as CausalLogEntryV1).turn = 1;
    turnMismatch.initialStateDigest = replayDigest(turnMismatch.initialState);
    expect(() => assertReplayLogV3(turnMismatch)).toThrow(/event turn|terminal turn/i);
  });

  it('keeps causal history as an immutable prefix across every frame', () => {
    const sessionId = 'match-replay-causal-prefix';
    const initial = stateFor(sessionId, 1, 'D08026');
    appendCausalEntry(initial, 'draw');
    appendCausalEntry(initial, 'discard');

    const rewritten = structuredClone(initial);
    (rewritten.log[0] as CausalLogEntryV1).turn += 1;
    setTerminalResult(rewritten, 'self', 'evidence');
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-rewrite`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, rewritten],
    })).toThrow(/causal.*prefix/i);

    const removed = structuredClone(initial);
    removed.log.pop();
    removed.causalLog!.nextSequence = 2;
    setTerminalResult(removed, 'self', 'evidence');
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-remove`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, removed],
    })).toThrow(/causal.*prefix/i);

    const reordered = structuredClone(initial);
    reordered.log.reverse();
    setTerminalResult(reordered, 'self', 'evidence');
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-reorder`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, reordered],
    })).toThrow(/causal.*order|causal.*prefix/i);
  });

  it('rejects causal allocator rollback even when event entries are unchanged', () => {
    const sessionId = 'match-replay-causal-allocator';
    const initial = stateFor(sessionId, 1, 'D08026');
    appendCausalEntry(initial, 'draw');
    const terminal = structuredClone(initial);
    terminal.causalLog!.nextSequence = 1;
    terminal.gameResult = { winner: 'self', reason: 'evidence' };

    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, terminal],
    })).toThrow(/causal.*allocator/i);
  });

  it('rejects unknown versions, cross-session state, and prototype-mutating patches', () => {
    expect(() => assertReplayLogV3({ schemaVersion: 99 })).toThrow(/version/i);

    const initial = stateFor('match-a', 1, 'CASE-A');
    const foreign = stateFor('match-b', 2, 'CASE-B');
    foreign.gameResult = { winner: 'self', reason: 'evidence' };
    expect(() => buildReplayLogV3({
      artifactId: 'replay-match-a',
      sessionId: 'match-a',
      viewerMode: 'solo-self',
      states: [initial, foreign],
    })).toThrow(/session/i);

    const terminal = structuredClone(initial);
    setTerminalResult(terminal, 'self', 'evidence');
    const log = buildReplayLogV3({
      artifactId: 'replay-match-a',
      sessionId: 'match-a',
      viewerMode: 'solo-self',
      states: [initial, terminal],
    });
    const corrupted = structuredClone(log);
    corrupted.frames[0]!.patches = [{ op: 'set', path: ['__proto__', 'polluted'], value: true }];
    expect(() => assertReplayLogV3(corrupted)).toThrow(/unsafe|prototype/i);
  });

  it('rejects unsupported causal-entry schemas in initial and patched states', () => {
    const sessionId = 'match-replay-unknown-causal';
    const unknownInitial = stateFor(sessionId, 1, 'CASE-A');
    unknownInitial.log.push({ schemaVersion: 2, action: 'future-causal' } as never);
    const unknownTerminal = structuredClone(unknownInitial);
    unknownTerminal.gameResult = { winner: 'self', reason: 'evidence' };
    expect(() => buildReplayLogV3({
      artifactId: `replay-${sessionId}-initial`,
      sessionId,
      viewerMode: 'solo-self',
      states: [unknownInitial, unknownTerminal],
    })).toThrow(/causal.*schema/i);

    const cleanInitial = stateFor(sessionId, 1, 'CASE-A');
    const cleanTerminal = structuredClone(cleanInitial);
    setTerminalResult(cleanTerminal, 'self', 'evidence');
    const log = buildReplayLogV3({
      artifactId: `replay-${sessionId}-patched`,
      sessionId,
      viewerMode: 'solo-self',
      states: [cleanInitial, cleanTerminal],
    });
    const corrupted = structuredClone(log);
    corrupted.frames[0]!.patches.push({
      op: 'set',
      path: ['log'],
      value: [{ schemaVersion: 2, action: 'future-causal' }],
    });
    expect(() => assertReplayLogV3(corrupted)).toThrow(/causal.*schema/i);
  });
});
