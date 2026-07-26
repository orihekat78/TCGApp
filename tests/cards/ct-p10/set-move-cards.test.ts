import { beforeEach, describe, expect, it } from 'vitest';
import { B10003, B10003P } from '@/cards/ct-p10/B10003';
import { B10007, B10007P } from '@/cards/ct-p10/B10007';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyPickAndContinuation, applySetCardChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _drainPendingSetCardChoiceSide, resetPendingEffectSession } from '@/engine/effect/pending-state';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { EffectCtx } from '@/engine/types';

function ctx(cardId: string, uid: string): EffectCtx {
  return { source: { player: 'self', uid, cardId, abilityId: 'a2', area: 'scene' }, bindings: {} };
}

beforeEach(() => {
  resetDefRegistry();
  register(B10003); register(B10003P); register(B10007); register(B10007P);
  _clearPendingEffectPickQueue(); resetPendingEffectSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('CT-P10 set-card movement', () => {
  it('B10003: action-end choice wires face-down self set-card to hand or another eligible soccer player', () => {
    const actionEnd = B10003.abilities.find((ability) => ability.id === 'a4')!;
    expect(actionEnd).toMatchObject({ type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, trigger: { hook: 'action:end', selfOnly: true } });
    const options = (actionEnd.effect as { options: unknown[] }).options;
    expect(options[0]).toMatchObject({ kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'hand' } });
    expect(options[1]).toMatchObject({ kind: 'chain', steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$host', filter: { kind: 'character', trait: 'サッカー選手', hasFaceDownSetCards: false } } },
      { kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'scene', hostUid: '$host.uid' } },
    ] });
  });

  it('B10003: AI chooses the hand branch and moves one opaque physical occurrence', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('B10003', 'shinichi', { setCards: [
      { cardId: 'DUP', faceUp: false, instanceId: 'set:a' },
      { cardId: 'DUP', faceUp: false, instanceId: 'set:b' },
    ] })];

    runEffect(state, B10003.abilities.find((ability) => ability.id === 'a4')!.effect!, ctx('B10003', 'shinichi'));

    expect(state.players.self.hand).toEqual(['DUP']);
    expect(state.players.self.scene[0]!.setCards.map((entry) => entry.instanceId)).toEqual(['set:a']);
  });

  it('B10007: a full scene still filters to the legal host; selected duplicate stays face-down with its instance id', () => {
    const state = createEmptyGameState();
    const source = sceneChar('B10007', 'source', { setCards: [
      { cardId: 'DUP', faceUp: false, instanceId: 'set:a' },
      { cardId: 'DUP', faceUp: false, instanceId: 'set:b' },
    ] });
    const blocked = sceneChar('B10007', 'blocked', { setCards: [{ cardId: 'OTHER', faceUp: false, instanceId: 'set:blocked' }] });
    const blockedTwo = sceneChar('B10007', 'blocked-two', { setCards: [{ cardId: 'OTHER', faceUp: false, instanceId: 'set:blocked-two' }] });
    const blockedThree = sceneChar('B10007', 'blocked-three', { setCards: [{ cardId: 'OTHER', faceUp: false, instanceId: 'set:blocked-three' }] });
    const destination = sceneChar('B10007', 'destination');
    state.players.self.scene = [source, blocked, blockedTwo, blockedThree, destination];
    const ability = B10007.abilities.find((candidate) => candidate.id === 'a2')!;

    runEffect(state, ability.effect!, ctx('B10007', 'source'));
    const hostPick = _drainPendingEffectPickSide();
    expect(hostPick?.candidates.map((candidate) => candidate.uid)).toEqual(['destination']);
    applyPickAndContinuation(state, hostPick!, 'destination');
    const setPick = _drainPendingSetCardChoiceSide();
    expect(setPick?.entries).toHaveLength(2);
    expect(JSON.stringify(setPick)).not.toContain('DUP');
    applySetCardChoiceAndContinuation(state, setPick!, 'set:b');

    expect(state.players.self.scene.find((char) => char.uid === 'source')?.setCards.map((entry) => entry.instanceId)).toEqual(['set:a']);
    expect(state.players.self.scene.find((char) => char.uid === 'destination')?.setCards).toEqual([{ cardId: 'DUP', faceUp: false, instanceId: 'set:b' }]);
  });

  it('B10007: a destination that disappears after opaque selection makes the move fail closed', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [
      sceneChar('B10007', 'source', { setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:source' }] }),
      sceneChar('B10007', 'destination'),
    ];
    const effect = B10007.abilities.find((candidate) => candidate.id === 'a2')!.effect!;

    runEffect(state, effect, ctx('B10007', 'source'));
    const hostPick = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, hostPick!, 'destination');
    const setPick = _drainPendingSetCardChoiceSide();
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'destination');
    applySetCardChoiceAndContinuation(state, setPick!, 'set:source');

    expect(state.players.self.scene.find((char) => char.uid === 'source')?.setCards).toEqual([{ cardId: 'SECRET', faceUp: false, instanceId: 'set:source' }]);
  });

  it('B10007: a source that disappears after opaque selection makes the move fail closed', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [
      sceneChar('B10007', 'source', { setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:source' }] }),
      sceneChar('B10007', 'destination'),
    ];
    const effect = B10007.abilities.find((candidate) => candidate.id === 'a2')!.effect!;

    runEffect(state, effect, ctx('B10007', 'source'));
    const hostPick = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, hostPick!, 'destination');
    const setPick = _drainPendingSetCardChoiceSide();
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'source');
    applySetCardChoiceAndContinuation(state, setPick!, 'set:source');

    expect(state.players.self.scene.find((char) => char.uid === 'destination')?.setCards).toEqual([]);
  });

  it('B10007: no other legal host is an allowed zero-target selection; source is not moved', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('B10007', 'source', { setCards: [{ cardId: 'SECRET', faceUp: false, instanceId: 'set:source' }] })];
    const ability = B10007.abilities.find((candidate) => candidate.id === 'a2')!;

    runEffect(state, ability.effect!, ctx('B10007', 'source'));

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(state.players.self.scene[0]!.setCards).toEqual([{ cardId: 'SECRET', faceUp: false, instanceId: 'set:source' }]);
  });

  it('P printings keep their corresponding text behavior and only vary printing metadata', () => {
    for (const [base, parallel] of [[B10003, B10003P], [B10007, B10007P]] as Array<[typeof B10003, typeof B10003P]>) {
      expect({ ...parallel, id: base.id, no: base.no, rarity: base.rarity, imageUrl: base.imageUrl }).toEqual(base);
    }
  });
});
