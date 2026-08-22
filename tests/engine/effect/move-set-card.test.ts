import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { applySetCardChoiceAndContinuation } from '@/engine/effect/apply-pick';
import {
  _drainPendingSetCardChoiceSide,
  _peekPendingSetCardChoiceResume,
  resetPendingEffectSession,
  setPendingSetCardChoiceRemainder,
} from '@/engine/effect/pending-state';
import { validate } from '@/engine/effect/validate';
import { event } from '@/engine/event';
import { sceneChar } from '../../helpers/fixtures';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

type Destination = { area: 'evidence'; faceUp: boolean } | { area: 'hand' } | { area: 'scene'; hostUid: string };

function moveSetCard(hostUid: string, face: 'down' | 'up' | 'any', destination: Destination): Effect {
  return { kind: 'moveSetCard', hostUid, face, destination } as never;
}

function ctx(): EffectCtx {
  return { source: { player: 'self', uid: 'source', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' }, bindings: {} };
}

function stateWithHosts(): GameState {
  const state = createEmptyGameState();
  state.players.self.scene = [
    sceneChar('SOURCE', 'source'),
    sceneChar('HOST', 'from', { setCards: [
      { cardId: 'UP', faceUp: true, instanceId: 'set:up' },
      { cardId: 'SECRET', faceUp: false, instanceId: 'set:down-a' },
      { cardId: 'SECRET', faceUp: false, instanceId: 'set:down-b' },
    ] }),
    sceneChar('HOST', 'to'),
  ];
  return state;
}

beforeEach(() => {
  resetPendingEffectSession();
  event._resetRegistry();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('moveSetCard', () => {
  it('AI deterministically moves the last matching physical occurrence to its owner hand', () => {
    const state = stateWithHosts();
    let leavePayload: unknown = null;
    event.on('setcard:leave', (_state, payload) => { leavePayload = payload; });

    runEffect(state, moveSetCard('from', 'down', { area: 'hand' }), ctx());

    expect(state.players.self.hand).toEqual(['SECRET']);
    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:up', 'set:down-a']);
    expect(leavePayload).toMatchObject({ hostUid: 'from', setCardInstanceId: 'set:down-b', destination: { area: 'hand' } });
  });

  it('keeps a human face-down choice opaque, then resumes its continuation after moving the chosen occurrence', () => {
    const state = stateWithHosts();
    state.players.self.deck = ['DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    runEffect(state, moveSetCard('from', 'down', { area: 'hand' }), ctx());

    const pending = _drainPendingSetCardChoiceSide();
    expect(pending).toMatchObject({ hostUid: 'from', destination: { area: 'hand' }, entries: [{ instanceId: 'set:down-a', ordinal: 2 }, { instanceId: 'set:down-b', ordinal: 3 }] });
    expect(JSON.stringify(pending)).not.toContain('SECRET');
    setPendingSetCardChoiceRemainder([{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], 'sequence');

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.hand).toEqual(['SECRET', 'DRAW']);
    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:up', 'set:down-b']);
  });

  it('keeps the exact set-card source in the compatibility continuation frame', () => {
    const state = stateWithHosts();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const source = ctx();
    source.source.setCardId = 'SET-SOURCE';
    source.source.setCardInstanceId = 'set:source:2';

    runEffect(state, moveSetCard('from', 'down', { area: 'hand' }), source);
    const pending = _drainPendingSetCardChoiceSide();
    expect(pending?.source).toMatchObject({
      setCardId: 'SET-SOURCE',
      setCardInstanceId: 'set:source:2',
    });

    setPendingSetCardChoiceRemainder([
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ], 'sequence');

    expect(_peekPendingSetCardChoiceResume()?.continuation?.ctx.source).toMatchObject({
      setCardId: 'SET-SOURCE',
      setCardInstanceId: 'set:source:2',
    });
  });

  it('moves to another same-owner host without emitting set-card leave or enter and preserves face and instance', () => {
    const state = stateWithHosts();
    let leaves = 0;
    let enters = 0;
    event.on('setcard:leave', () => { leaves++; });
    event.on('setcard:enter', () => { enters++; });

    runEffect(state, moveSetCard('from', 'down', { area: 'scene', hostUid: 'to' }), ctx());

    expect(state.players.self.scene.find((char) => char.uid === 'to')?.setCards).toContainEqual({ cardId: 'SECRET', faceUp: false, instanceId: 'set:down-b' });
    expect(leaves).toBe(0);
    expect(enters).toBe(0);
  });

  it('resolves source and scene destination BindRefs before choosing an occurrence', () => {
    const state = stateWithHosts();
    const boundCtx = { ...ctx(), bindings: { from: [{ uid: 'from' }], to: [{ uid: 'to' }] } } as EffectCtx;

    runEffect(state, moveSetCard('$from.uid', 'down', { area: 'scene', hostUid: '$to.uid' }), boundCtx);

    expect(state.players.self.scene.find((char) => char.uid === 'to')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:down-b']);
  });

  it('fails closed before splice when the chosen destination disappears', () => {
    const state = stateWithHosts();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, moveSetCard('from', 'down', { area: 'scene', hostUid: 'to' }), ctx());
    const pending = _drainPendingSetCardChoiceSide();
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'to');

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:up', 'set:down-a', 'set:down-b']);
    expect(state.players.self.hand).toEqual([]);
  });

  it('continues a sequence tail when a validated human selection becomes stale', () => {
    const state = stateWithHosts();
    state.players.self.deck = ['DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, { kind: 'sequence', steps: [
      moveSetCard('from', 'down', { area: 'scene', hostUid: 'to' }),
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] }, ctx());
    const pending = _drainPendingSetCardChoiceSide();
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'to');

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards).toHaveLength(3);
    expect(state.players.self.hand).toEqual(['DRAW']);
  });

  it('stops a chain tail when a validated human selection becomes stale', () => {
    const state = stateWithHosts();
    state.players.self.deck = ['DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, { kind: 'chain', steps: [
      moveSetCard('from', 'down', { area: 'scene', hostUid: 'to' }),
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] }, ctx());
    const pending = _drainPendingSetCardChoiceSide();
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'to');

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards).toHaveLength(3);
    expect(state.players.self.hand).toEqual([]);
  });

  it('rechecks the exact selected occurrence face at confirmation and continues a stale sequence as a no-op', () => {
    const state = stateWithHosts();
    state.players.self.deck = ['DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, moveSetCard('from', 'down', { area: 'hand' }), ctx());
    const pending = _drainPendingSetCardChoiceSide();
    state.players.self.scene.find((char) => char.uid === 'from')!.setCards[1]!.faceUp = true;
    setPendingSetCardChoiceRemainder([{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], 'sequence');

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:up', 'set:down-a', 'set:down-b']);
    expect(state.players.self.hand).toEqual(['DRAW']);
  });

  it('rejects a cross-owner scene destination without removing the source occurrence', () => {
    const state = stateWithHosts();
    state.players.opp.scene = [sceneChar('HOST', 'opp-host')];

    runEffect(state, moveSetCard('from', 'any', { area: 'scene', hostUid: 'opp-host' }), ctx());

    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards).toHaveLength(3);
    expect(state.players.opp.scene[0]?.setCards).toEqual([]);
  });

  it('keeps legacy setCardToEvidence behavior unchanged', () => {
    const state = stateWithHosts();

    runEffect(state, { kind: 'setCardToEvidence', hostUid: 'from' }, ctx());

    expect(state.players.self.evidence.map((entry) => entry.cardId)).toEqual(['SECRET']);
    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards).toHaveLength(2);
  });

  it('backfills missing and duplicate instance IDs from old saves before exposing a choice', () => {
    const state = stateWithHosts();
    state.players.self.scene.find((char) => char.uid === 'from')!.setCards = [
      { cardId: 'A', faceUp: false },
      { cardId: 'A', faceUp: false, instanceId: 'legacy:duplicate' },
      { cardId: 'B', faceUp: false, instanceId: 'legacy:duplicate' },
    ];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    runEffect(state, moveSetCard('from', 'down', { area: 'hand' }), ctx());

    const entries = _drainPendingSetCardChoiceSide()!.entries;
    expect(entries.map((entry) => entry.instanceId)).toHaveLength(3);
    expect(new Set(entries.map((entry) => entry.instanceId)).size).toBe(3);
    expect(entries.every((entry) => entry.instanceId.length > 0)).toBe(true);
  });

  it('pauses parallel at a human move prompt and resumes its tail without overwriting the decision', () => {
    const state = stateWithHosts();
    state.players.self.deck = ['DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, { kind: 'parallel', steps: [
      moveSetCard('from', 'down', { area: 'hand' }),
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] }, ctx());
    const pending = _drainPendingSetCardChoiceSide();
    expect(state.players.self.hand).toEqual([]);

    applySetCardChoiceAndContinuation(state, pending!, 'set:down-a');

    expect(state.players.self.hand).toEqual(['SECRET', 'DRAW']);
  });

  it('does not consume a resume on forged payload, and publishes only face-up entries for up/any choices', () => {
    const state = stateWithHosts();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, moveSetCard('from', 'any', { area: 'hand' }), ctx());
    const pending = _drainPendingSetCardChoiceSide()!;
    expect(pending.entries).toEqual([
      { instanceId: 'set:up', ordinal: 1, hidden: false, cardId: 'UP' },
      { instanceId: 'set:down-a', ordinal: 2, hidden: true },
      { instanceId: 'set:down-b', ordinal: 3, hidden: true },
    ]);

    applySetCardChoiceAndContinuation(state, { ...pending, destination: { area: 'evidence', faceUp: true } }, 'set:up');
    expect(state.players.self.scene.find((char) => char.uid === 'from')?.setCards).toHaveLength(3);

    applySetCardChoiceAndContinuation(state, pending, 'set:up');
    expect(state.players.self.hand).toEqual(['UP']);
  });

  it('accepts a JSON-roundtripped move descriptor inside a forEach tree', () => {
    const effect = JSON.parse(JSON.stringify({
      kind: 'forEach',
      over: { kind: 'fromBound', bindKey: '$hosts' },
      do: moveSetCard('$each.uid', 'down', { area: 'hand' }),
    })) as Effect;
    expect(validate(effect).ok).toBe(true);
  });

  it('pauses forEach after each human move and resumes the remaining host without pending overwrite', () => {
    const state = stateWithHosts();
    state.players.self.scene.push(sceneChar('HOST', 'from-two', { setCards: [{ cardId: 'SECOND', faceUp: false, instanceId: 'set:second' }] }));
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(state, {
      kind: 'forEach',
      over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { hasFaceDownSetCards: true } } },
      do: moveSetCard('$each.uid', 'down', { area: 'hand' }),
    }, ctx());

    const first = _drainPendingSetCardChoiceSide();
    expect(first?.hostUid).toBe('from');
    applySetCardChoiceAndContinuation(state, first!, 'set:down-a');
    const second = _drainPendingSetCardChoiceSide();
    expect(second?.hostUid).toBe('from-two');
    applySetCardChoiceAndContinuation(state, second!, 'set:second');

    expect(state.players.self.hand).toEqual(['SECRET', 'SECOND']);
  });
});
