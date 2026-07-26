// B02023 遠山和葉 — 裏向きセットの宣言コスト。
// rules: 15-abilities-effects.md, 16-card-set.md, 21-declared-ability-cost.md

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B02023 } from '@/cards/ct-p02/B02023';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import type { GameState } from '@/engine/types';

const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

const setHuman = (side: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
};

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}

function facedown(cardId: string, instanceId = `set:${cardId}`) {
  return { cardId, faceUp: false, instanceId };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B02023);
  registerTriggeredListener();
  setHuman(null);
});

afterEach(() => {
  // This suite exercises the human-only exact-witness boundary. Do not leak
  // that global test seam into legacy AI/direct-flow regression files.
  setHuman(null);
  useGameStateStore.getState().resetMatchSessionState();
});

describe('B02023 a2 — source state, optional target, and turn recovery', () => {
  it('rejects a payable human public activation until an exact occurrence witness is supplied', () => {
    setHuman('self');
    const state = base();
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A', 'set:A')] }),
    ];
    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2')).toBe(false);
    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', {
      removeSetCard: { hostUids: ['kazuha'], instanceIds: ['set:A'] },
    })).toBe(true);
  });

  it('public dispatch rejects a witness-less human activation without mutating the stored state', () => {
    setHuman('self');
    const state = base();
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A', 'set:A')] }),
    ];
    useGameStateStore.getState().setGameState(state);
    const before = useGameStateStore.getState().gameState!;

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazuha', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);

    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: 'kazuha',
      abilId: 'a2',
      costParams: { removeSetCard: { hostUids: ['kazuha'], instanceIds: ['set:A'] } },
    })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.remove).toContain('SET-A');
  });

  it.each(['active', 'sleep', 'stun'] as const)(
    'source=%s may pay its own facedown set-card cost',
    (sourceState) => {
      setHuman('self');
      const state = base();
      state.players.self.scene = [
        sceneChar('B02023', 'kazuha', { state: sourceState, setCards: [facedown('SET-A', 'set:A')] }),
        sceneChar('TARGET', 'target'),
      ];
      const cost = { removeSetCard: { hostUids: ['kazuha'], instanceIds: ['set:A'] } };
      expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', cost)).toBe(true);
      const after = produce(state, (draft) => {
        activateDeclaredAbility(draft, 'kazuha', 'a2', cost);
        runAllUntilEmpty(draft);
      });
      expect(after.players.self.remove).toContain('SET-A');
    },
  );

  it('may decline the up-to-one effect after paying the cost', () => {
    setHuman('self');
    const state = base();
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A', 'set:A')] }),
      sceneChar('TARGET', 'target'),
    ];
    const cost = { removeSetCard: { hostUids: ['kazuha'], instanceIds: ['set:A'] } };
    const afterUse = produce(state, (draft) => {
      activateDeclaredAbility(draft, 'kazuha', 'a2', cost);
      runAllUntilEmpty(draft);
    });
    const pending = queue()[0]!;
    const afterDecline = produce(afterUse, (draft) => {
      applyPickSkipAndContinuation(draft, pending, false);
    });
    expect(afterDecline.players.self.remove).toContain('SET-A');
    expect(afterDecline.players.self.scene.find((char) => char.uid === 'target')!.state).toBe('active');
    expect(afterDecline.players.self.scene.find((char) => char.uid === 'kazuha')!.declaredUseCount.a2).toBe(1);
  });

  it('rejects a second use this turn and clears the limit at next turn start', () => {
    setHuman('self');
    const state = base();
    state.players.self.scene = [sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A', 'set:A')] })];
    const cost = { removeSetCard: { hostUids: ['kazuha'], instanceIds: ['set:A'] } };
    const afterUse = produce(state, (draft) => activateDeclaredAbility(draft, 'kazuha', 'a2', cost));
    expect(canActivateDeclaredAbility(afterUse, 'kazuha', 'a2', cost)).toBe(false);
    const nextTurn = produce(afterUse, (draft) => mutate.flag.resetTurnFlags(draft, 'self'));
    expect(nextTurn.players.self.scene.find((char) => char.uid === 'kazuha')!.declaredUseCount).toEqual({});
  });
});

describe('B02023 遠山和葉 — 印字全節', () => {
  it('登場時 / 宣言 / ヒラメキを別 ability として登録する', () => {
    expect(B02023.abilities.map((ability) => ability.id)).toEqual(['a1', 'a2', 'a3']);
    expect(B02023.abilities[0]).toMatchObject({ type: 'triggered', trigger: { hook: 'enter', selfOnly: true } });
    expect(B02023.abilities[1]).toMatchObject({
      type: 'declared', limit: { kind: 'turn', n: 1 }, cost: { kind: 'removeSetCard', n: 1 },
      effect: { kind: 'atom', verb: 'sceneSetState' },
    });
    expect(B02023.abilities[2]).toMatchObject({ type: 'triggered', trigger: { hook: 'evidence:remove-by-action' } });
  });
});

describe('B02023 a2 — 【宣言】裏向きセット1枚をコストにキャラをスリープ', () => {
  it('複数の自分の裏向きセットから選んだ host の1枚だけをコストで表向きリムーブし、選んだ active キャラをスリープする', () => {
    setHuman('self');
    let state = base();
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A')] }),
      sceneChar('HOST', 'host-b', { setCards: [facedown('SET-B1'), facedown('SET-B2')] }),
      sceneChar('ACTIVE', 'active'),
      sceneChar('SLEEP', 'sleep', { state: 'sleep' }),
      sceneChar('STUN', 'stun', { state: 'stun' }),
    ];
    state.players.opp.scene = [sceneChar('OPP', 'opp')];

    const exactCost = { removeSetCard: { hostUids: ['host-b'], instanceIds: ['set:SET-B1'] } };
    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', exactCost)).toBe(true);
    state = produce(state, (draft) => {
      activateDeclaredAbility(draft, 'kazuha', 'a2', exactCost);
      runAllUntilEmpty(draft);
    });

    expect(state.players.self.scene.find((char) => char.uid === 'kazuha')!.setCards.map((entry) => entry.cardId)).toEqual(['SET-A']);
    expect(state.players.self.scene.find((char) => char.uid === 'host-b')!.setCards.map((entry) => entry.cardId)).toEqual(['SET-B2']);
    expect(state.players.self.remove).toContain('SET-B1');
    const pending = queue()[0]!;
    expect(pending.atomVerb).toBe('sceneSetState');
    expect(pending.candidates.map((candidate) => candidate.uid)).toEqual(expect.arrayContaining(['active', 'sleep', 'stun', 'opp']));

    state = produce(state, (draft) => applyPickAndContinuation(draft, pending, 'active'));
    expect(state.players.self.scene.find((char) => char.uid === 'active')!.state).toBe('sleep');
    expect(state.players.self.scene.find((char) => char.uid === 'sleep')!.state).toBe('sleep');
    expect(state.players.self.scene.find((char) => char.uid === 'stun')!.state).toBe('stun');
  });

  it('instanceId と hostUid が一致しない明示コストは、状態を一切変えず拒否する', () => {
    setHuman('self');
    const state = base();
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [facedown('SET-A')] }),
      sceneChar('HOST', 'host-b', { setCards: [facedown('SET-B')] }),
    ];
    const invalid = { removeSetCard: { hostUids: ['host-b'], instanceIds: ['set:SET-A'] } };

    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', invalid)).toBe(false);
    const after = produce(state, (draft) => activateDeclaredAbility(draft, 'kazuha', 'a2', invalid));
    expect(after).toBe(state);
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.self.scene.map((char) => char.setCards.map((entry) => entry.cardId))).toEqual([['SET-A'], ['SET-B']]);
    expect(after.log).toEqual([]);
    expect(after.pendingEffects).toEqual([]);
  });

  it('自分の裏向きセットが0枚なら、相手の裏向きセットがあっても public activation は拒否する', () => {
    const state = base();
    state.players.self.scene = [sceneChar('B02023', 'kazuha')];
    state.players.opp.scene = [sceneChar('OPP', 'opp', { setCards: [facedown('OPP-SET')] })];

    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', { removeSetCard: { hostUids: ['opp'], instanceIds: ['set:OPP-SET'] } })).toBe(false);
    const after = produce(state, (draft) => {
      activateDeclaredAbility(draft, 'kazuha', 'a2', { removeSetCard: { hostUids: ['opp'], instanceIds: ['set:OPP-SET'] } });
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.scene.find((char) => char.uid === 'opp')!.setCards).toHaveLength(1);
    expect(after.players.self.remove).toHaveLength(0);
    expect(after.players.self.scene.find((char) => char.uid === 'kazuha')!.declaredUseCount['a2'] ?? 0).toBe(0);
  });
});
