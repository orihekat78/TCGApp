import { beforeEach, describe, expect, it } from 'vitest';
import { _drainPendingContactStartAxId } from '@/engine/effect/atom-handlers/_shared';
import { run as runEffect } from '@/engine/effect/resolver';
import { _resetActionContexts, action as flowAction } from '@/engine/flow/action/state-machine';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar('HOST', 'host'), sceneChar('ALLY', 'sleeping-ally', { state: 'sleep' })];
  state.players.opp.scene = [sceneChar('TARGET', 'target')];
  return state;
}

function ctx(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1', area: 'scene' },
    bindings: { actor: [{ kind: 'char', uid: 'sleeping-ally', cardId: 'ALLY', player: 'self' }], target: [{ kind: 'char', uid: 'target', cardId: 'TARGET', player: 'opp' }] },
  } as EffectCtx;
}

const selected: Effect = { kind: 'atom', verb: 'startContact', args: { actorUid: '$actor.uid', targetUid: '$target.uid' } };

beforeEach(() => _resetActionContexts());

describe('startContact selected actor', () => {
  it('uses a bound sleeping friendly actor instead of the ability source', () => {
    const state = base();
    runEffect(state, selected, ctx());
    const id = _drainPendingContactStartAxId();
    expect(flowAction._getContext(state, id!)?.byUid).toBe('sleeping-ally');
    expect(state.players.self.scene.find((char) => char.uid === 'sleeping-ally')?.state).toBe('sleep');
  });

  it('allows a same-name selected actor and survives source departure after picks', () => {
    const state = base();
    state.players.self.scene.find((char) => char.uid === 'sleeping-ally')!.cardId = 'HOST';
    state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'host');
    runEffect(state, selected, ctx());
    const id = _drainPendingContactStartAxId();
    expect(flowAction._getContext(state, id!)?.byUid).toBe('sleeping-ally');
  });

  it('keeps omitted actorUid compatible with the source actor', () => {
    const state = base();
    runEffect(state, { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } }, ctx());
    const id = _drainPendingContactStartAxId();
    expect(flowAction._getContext(state, id!)?.byUid).toBe('host');
  });

  it('fails closed for stale or invalid selected actors and targets', () => {
    for (const mutate of [
      (state: GameState) => { state.players.self.scene.find((char) => char.uid === 'sleeping-ally')!.state = 'active'; },
      (state: GameState) => { state.players.self.scene = state.players.self.scene.filter((char) => char.uid !== 'sleeping-ally'); },
      (state: GameState) => { state.players.opp.scene = []; },
    ]) {
      _resetActionContexts();
      const state = base();
      mutate(state);
      runEffect(state, selected, ctx());
      expect(_drainPendingContactStartAxId()).toBeNull();
    }
  });

  it('treats either optional pick declining as a no-op', () => {
    for (const bindings of [{ target: ctx().bindings.target }, { actor: ctx().bindings.actor }]) {
      const state = base();
      runEffect(state, selected, { ...ctx(), bindings } as EffectCtx);
      expect(_drainPendingContactStartAxId()).toBeNull();
    }
  });
});
