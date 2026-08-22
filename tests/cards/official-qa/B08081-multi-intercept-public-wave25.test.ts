// qa: card:B08081:6b3d06f3573c39d85fe728b4613bf4458ef9a1849c52f036ac9bf48314a44dd7
// qa: card:B08081:7bb52b7841de3a6861f7375dfd900c553a815d7d9c5d6fc388418b2078e81504
// qa: card:B08081:d889f1124f88bd5349a26b958a18b82b1763750edd4fba8e540934e467d2c49a
// qa: card:B08081:ec933c10dd93bfe7d7fc6c3414d149fe16e71e7cdf8c5eabc016c26080d4f0ce
// Rules: 15-abilities-effects.md, 17-icons.md, 25-qa-effects-resolution.md.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { B08081 } from '@/cards/ct-p08/B08081';
import { B08081P } from '@/cards/ct-p08/B08081P';
import { stepTurn, type AIPolicy } from '@/ai/policy';
import { _resetRegistry, register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const TARGET = 'QA_B08081_TARGET';
const SOURCE = 'QA_B08081_SOURCE';
const PAYMENT_A = 'QA_B08081_PAYMENT_A';
const PAYMENT_B = 'QA_B08081_PAYMENT_B';
const DRAW = 'QA_B08081_DRAW';
const TAIL = 'QA_B08081_TAIL';

const END_AFTER_DECISIONS: AIPolicy = {
  name: 'end-after-decisions',
  choose: (_state, candidates) => candidates.find(candidate => candidate.kind === 'endTurn') ?? null,
};

function character(id: string, colors = ['青']): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors, level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const DECLARED_SOURCE: CardDef = {
  ...character(SOURCE),
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'sequence', steps: [
        {
          kind: 'atom', verb: 'sceneSetState',
          args: { player: 'self', side: 'either', state: 'sleep', max: 2 },
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  }] as never,
};

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.hand = [PAYMENT_A, PAYMENT_B];
  state.players.opp.deck = [DRAW, TAIL];
  state.players.opp.scene = [makeChar({ uid: 'source', cardId: SOURCE })];
  state.players.self.scene = [
    makeChar({ uid: 'target', cardId: TARGET }),
    makeChar({ uid: 'hirota-1', cardId: B08081.id }),
    makeChar({ uid: 'hirota-2', cardId: B08081.id }),
  ];
  return state;
}

function install(state: GameState): void {
  endMatchSession();
  beginMatchSession('opp');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startSelection(pickedUids: string[] = ['target']): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.map(candidate => candidate.uid)).toContain('target');
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: pickedUids[0]!,
    ...(pickedUids.length > 1 ? { pickedUids } : {}),
  }))).toEqual({ ok: true });
}

function roundTrip(): void {
  const restored = JSON.parse(JSON.stringify(current())) as GameState;
  expect(restored.pendingRuntimeState).toBeDefined();
  expect(useGameStateStore.getState().setGameState(null)).toBe(true);
  expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
}

function useCount(uid: string): number {
  return readChar.declaredUseCount(current(), uid, 'a2');
}

beforeAll(() => {
  _resetRegistry();
  [B08081, B08081P, DECLARED_SOURCE, character(TARGET), character(PAYMENT_A), character(PAYMENT_B), character(DRAW), character(TAIL)]
    .forEach(register);
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B08081 official-QA multi-copy choose intercept public dispatch', () => {
  it('queues every simultaneous copy, survives JSON restore, rejects stale authority, and resumes once', () => {
    install(base());
    startSelection();

    expect(useCount('hirota-1')).toBe(1);
    expect(useCount('hirota-2')).toBe(1);
    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(order).toMatchObject({
      kind: 'order', player: 'self',
      choices: expect.arrayContaining([
        expect.objectContaining({ protector: expect.objectContaining({ uid: 'hirota-1' }) }),
        expect.objectContaining({ protector: expect.objectContaining({ uid: 'hirota-2' }) }),
      ]),
    });
    expect(dispatchEngineAction(bindPendingDecision(order!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-2', targetUid: 'target',
    }))).toEqual({ ok: true });
    roundTrip();

    const first = useGameStateStore.getState().pendingChooseIntercept;
    expect(first).toMatchObject({ kind: 'response', protector: { uid: 'hirota-2' } });
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });

    const second = useGameStateStore.getState().pendingChooseIntercept;
    expect(second).toMatchObject({ kind: 'response', protector: { uid: 'hirota-1' } });
    const beforeStale = JSON.stringify(current());
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeStale);

    expect(dispatchEngineAction(bindPendingDecision(second!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });
    expect({
      targetState: current().players.self.scene.find(card => card.uid === 'target')?.state,
      remove: current().players.opp.remove,
      hand: current().players.opp.hand,
      deck: current().players.opp.deck,
    }).toEqual({
      targetState: 'sleep',
      remove: [PAYMENT_A, PAYMENT_B],
      hand: [DRAW],
      deck: [TAIL],
    });
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(current().pendingRuntimeState).toBeUndefined();
    expectNoChooseInterceptWitnesses(current());
  });

  it('transactionally rejects forged persisted owner and protector authority', () => {
    install(base());
    startSelection();

    const store = useGameStateStore.getState();
    const liveState = store.gameState;
    const livePrompt = store.pendingChooseIntercept;
    expect(livePrompt).toMatchObject({ kind: 'order', player: 'self' });

    const forge = (mutate: (side: any, resume: any) => void): GameState => {
      const forged = JSON.parse(JSON.stringify(current())) as GameState;
      const snapshot = forged.pendingRuntimeState!.snapshot;
      const side = snapshot.find(entry => entry.key === '__pendingChooseInterceptSide')!.value;
      const resume = snapshot.find(entry => entry.key === '__pendingChooseInterceptResume')!.value;
      mutate(side, resume);
      return forged;
    };

    const forgedOwner = forge((side, resume) => {
      side.player = 'opp';
      resume.guard.player = 'opp';
    });
    expect(() => useGameStateStore.getState().setGameState(forgedOwner))
      .toThrow(/Invalid pendingChooseIntercept/);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBe(livePrompt);

    const forgedProtector = forge((side, resume) => {
      const forgedIdentity = { uid: 'source', cardId: SOURCE, abilityId: 'a1' };
      side.choices[0].protector = { ...forgedIdentity };
      resume.guard.choices[0].protector = { ...forgedIdentity };
      resume.remainingGuards[0].protector = { ...forgedIdentity };
    });
    expect(() => useGameStateStore.getState().setGameState(forgedProtector))
      .toThrow(/Invalid pendingChooseIntercept/);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBe(livePrompt);

    const forgedDuplicate = forge((side, resume) => {
      const duplicate = JSON.parse(JSON.stringify(side.choices[1]));
      side.choices = [duplicate, JSON.parse(JSON.stringify(duplicate))];
      resume.guard.choices = JSON.parse(JSON.stringify(side.choices));
      resume.remainingGuards = JSON.parse(JSON.stringify(side.choices));
    });
    expect(() => useGameStateStore.getState().setGameState(forgedDuplicate))
      .toThrow(/Invalid pendingChooseIntercept/);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBe(livePrompt);

    expect(dispatchEngineAction(bindPendingDecision(livePrompt!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-1', targetUid: 'target',
    }))).toEqual({ ok: true });
    const liveResponseState = useGameStateStore.getState().gameState!;
    const liveResponsePrompt = useGameStateStore.getState().pendingChooseIntercept;
    expect(liveResponsePrompt).toMatchObject({ kind: 'response', protector: { uid: 'hirota-1' } });

    const forgedOmission = JSON.parse(JSON.stringify(liveResponseState)) as GameState;
    const omissionSnapshot = forgedOmission.pendingRuntimeState!.snapshot as Array<{ key: string; value?: any }>;
    const omissionResume = omissionSnapshot.find(entry => entry.key === '__pendingChooseInterceptResume')!.value;
    omissionResume.remainingGuards = [];
    expect(() => useGameStateStore.getState().setGameState(forgedOmission))
      .toThrow(/Invalid pendingChooseIntercept/);
    expect(useGameStateStore.getState().gameState).toBe(liveResponseState);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBe(liveResponsePrompt);
  });

  it('a decline on a later simultaneous copy cancels the whole chosen effect and its tail', () => {
    install(base());
    startSelection();

    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(dispatchEngineAction(bindPendingDecision(order!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-1', targetUid: 'target',
    }))).toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingChooseIntercept;
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });
    const second = useGameStateStore.getState().pendingChooseIntercept;
    expect(second?.protector.uid).toBe('hirota-2');
    expect(dispatchEngineAction(bindPendingDecision(second!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.find(card => card.uid === 'target')?.state).toBe('active');
    expect(current().players.opp.remove).toEqual([PAYMENT_A]);
    expect(current().players.opp.hand).toEqual([PAYMENT_B]);
    expect(current().players.opp.deck).toEqual([DRAW, TAIL]);
    expect([useCount('hirota-1'), useCount('hirota-2')]).toEqual([1, 1]);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
  });

  it('one decline cancels the effect for every simultaneously selected character and the remaining sequence', () => {
    const state = base();
    state.players.self.scene.splice(1, 0, makeChar({ uid: 'target-2', cardId: TARGET }));
    state.players.self.scene = state.players.self.scene.filter(card => card.uid !== 'hirota-2');
    install(state);
    startSelection(['target', 'target-2']);

    const intercept = useGameStateStore.getState().pendingChooseIntercept;
    expect(intercept?.protector.uid).toBe('hirota-1');
    expect(dispatchEngineAction(bindPendingDecision(intercept!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.filter(card => card.cardId === TARGET).map(card => card.state))
      .toEqual(['active', 'active']);
    expect(current().players.opp.hand).toEqual([PAYMENT_A, PAYMENT_B]);
    expect(current().players.opp.deck).toEqual([DRAW, TAIL]);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
  });

  it('fires every copy when the selected group contains one B08081 itself', () => {
    install(base());
    startSelection(['hirota-1', 'target']);

    expect([useCount('hirota-1'), useCount('hirota-2')]).toEqual([1, 1]);
    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(order).toMatchObject({ kind: 'order', player: 'self' });
    expect(dispatchEngineAction(bindPendingDecision(order!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-2', targetUid: 'hirota-1',
    }))).toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingChooseIntercept;
    expect(first).toMatchObject({ kind: 'response', protector: { uid: 'hirota-2' }, targetUid: 'hirota-1' });
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });
    const second = useGameStateStore.getState().pendingChooseIntercept;
    expect(second).toMatchObject({ kind: 'response', protector: { uid: 'hirota-1' }, targetUid: 'target' });
    expect(dispatchEngineAction(bindPendingDecision(second!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.map(card => card.state)).toEqual(['active', 'active', 'active']);
    expect(current().players.opp.hand).toEqual([PAYMENT_B]);
    expect(current().players.opp.deck).toEqual([DRAW, TAIL]);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
  });

  it('keeps the parallel B08081P copy in the same simultaneous owner-ordered queue', () => {
    const state = base();
    state.players.self.scene.find(card => card.uid === 'hirota-2')!.cardId = B08081P.id;
    install(state);
    startSelection();

    expect([useCount('hirota-1'), useCount('hirota-2')]).toEqual([1, 1]);
    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(order).toMatchObject({
      kind: 'order',
      choices: expect.arrayContaining([
        expect.objectContaining({ protector: expect.objectContaining({
          uid: 'hirota-1', cardId: B08081.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        }) }),
        expect.objectContaining({ protector: expect.objectContaining({
          uid: 'hirota-2', cardId: B08081P.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        }) }),
      ]),
    });
    expect(dispatchEngineAction(bindPendingDecision(order!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-2', targetUid: 'target',
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingChooseIntercept)
      .toMatchObject({ kind: 'response', protector: { uid: 'hirota-2', cardId: B08081P.id } });
  });

  it('keeps resolving already-triggered siblings after the first B08081 refusal negates the source effect', () => {
    install(base());
    startSelection();

    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(dispatchEngineAction(bindPendingDecision(order!, {
      type: 'chooseInterceptOrderResolve', protectorUid: 'hirota-1', targetUid: 'target',
    }))).toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingChooseIntercept;
    expect(first).toMatchObject({ kind: 'response', protector: { uid: 'hirota-1' } });
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });

    const surviving = useGameStateStore.getState().pendingChooseIntercept;
    expect(surviving).toMatchObject({ kind: 'response', protector: { uid: 'hirota-2' } });
    expect(dispatchEngineAction(bindPendingDecision(surviving!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.find(card => card.uid === 'target')?.state).toBe('active');
    expect(current().players.opp.remove).toEqual([PAYMENT_A]);
    expect(current().players.opp.hand).toEqual([PAYMENT_B]);
    expect(current().players.opp.deck).toEqual([DRAW, TAIL]);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(current().pendingRuntimeState).toBeUndefined();
  });

  it('lets restored autonomous policy drain owner order, both payments, and the continuation once', () => {
    install(base());
    startSelection();
    expect(useGameStateStore.getState().pendingChooseIntercept).toMatchObject({ kind: 'order' });

    const restored = JSON.parse(JSON.stringify(current())) as GameState;
    expect(restored.pendingRuntimeState).toBeDefined();
    endMatchSession();

    const step = stepTurn(restored, END_AFTER_DECISIONS, 'opp');
    expect(step.move?.kind).toBe('endTurn');

    expect({
      targetState: step.nextState.players.self.scene.find(card => card.uid === 'target')?.state,
      remove: step.nextState.players.opp.remove,
      hand: step.nextState.players.opp.hand,
      deck: step.nextState.players.opp.deck,
    }).toEqual({
      targetState: 'sleep',
      remove: [PAYMENT_A, PAYMENT_B],
      hand: [DRAW],
      deck: [TAIL],
    });
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(step.nextState.pendingRuntimeState).toBeUndefined();
    expectNoChooseInterceptWitnesses(step.nextState);
  });

  it('transactionally rejects added, duplicate, and mismatched persisted selected UIDs', () => {
    install(baseWithSecondTarget());
    startSelection();
    const liveState = current();
    const livePrompt = useGameStateStore.getState().pendingChooseIntercept;

    for (const mode of ['added', 'duplicate', 'mismatch'] as const) {
      const forged = JSON.parse(JSON.stringify(liveState)) as GameState;
      const resume = chooseInterceptResume(forged);
      if (mode === 'added') resume.pickedUids = ['target', 'target-2'];
      if (mode === 'duplicate') resume.pickedUids = ['target', 'target'];
      if (mode === 'mismatch') {
        resume.pickedUid = 'target-2';
        resume.pickedUids = ['target'];
      }
      expect(() => useGameStateStore.getState().setGameState(forged))
        .toThrow(/Invalid pendingChooseIntercept/);
      expect(useGameStateStore.getState().gameState).toBe(liveState);
      expect(useGameStateStore.getState().pendingChooseIntercept).toBe(livePrompt);
    }

    roundTrip();
    expect(payAllB08081()).toBe(2);
    expect(current().players.self.scene.filter(card => card.uid.startsWith('target')).map(card => card.state))
      .toEqual(['sleep', 'active']);
    expect(current().players.opp.deck).toEqual([TAIL]);
    expectNoChooseInterceptWitnesses(current());
  });

  it('transactionally rejects deleting or reordering selected targets that produced no extra reaction', () => {
    install(baseWithSecondTarget());
    startSelection(['target', 'target-2']);
    const liveState = current();
    const livePrompt = useGameStateStore.getState().pendingChooseIntercept;

    for (const mode of ['deleted', 'reordered'] as const) {
      const forged = JSON.parse(JSON.stringify(liveState)) as GameState;
      const resume = chooseInterceptResume(forged);
      if (mode === 'deleted') resume.pickedUids = ['target'];
      else {
        resume.pickedUid = 'target-2';
        resume.pickedUids = ['target-2', 'target'];
      }
      expect(() => useGameStateStore.getState().setGameState(forged))
        .toThrow(/Invalid pendingChooseIntercept/);
      expect(useGameStateStore.getState().gameState).toBe(liveState);
      expect(useGameStateStore.getState().pendingChooseIntercept).toBe(livePrompt);
    }

    roundTrip();
    expect(payAllB08081()).toBe(2);
    expect(current().players.self.scene.filter(card => card.uid.startsWith('target')).map(card => card.state))
      .toEqual(['sleep', 'sleep']);
    expectNoChooseInterceptWitnesses(current());
  });
});

function baseWithSecondTarget(): GameState {
  const state = base();
  state.players.self.scene.splice(1, 0, makeChar({ uid: 'target-2', cardId: TARGET }));
  return state;
}

function chooseInterceptResume(state: GameState): { pickedUid: string; pickedUids?: string[] } {
  return state.pendingRuntimeState!.snapshot
    .find(entry => entry.key === '__pendingChooseInterceptResume')!.value as {
      pickedUid: string;
      pickedUids?: string[];
    };
}

function payAllB08081(): number {
  let paid = 0;
  while (useGameStateStore.getState().pendingChooseIntercept) {
    const pending = useGameStateStore.getState().pendingChooseIntercept!;
    if (pending.kind === 'order') {
      const next = pending.choices[0]!;
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'chooseInterceptOrderResolve',
        protectorUid: next.protector.uid,
        targetUid: next.targetUid,
      }))).toEqual({ ok: true });
    }
    const response = useGameStateStore.getState().pendingChooseIntercept!;
    expect(dispatchEngineAction(bindPendingDecision(response, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });
    paid += 1;
  }
  return paid;
}

function expectNoChooseInterceptWitnesses(state: GameState): void {
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      expect(char.turnEffects.chooseInterceptBatchWitnesses).toBeUndefined();
    }
  }
}
