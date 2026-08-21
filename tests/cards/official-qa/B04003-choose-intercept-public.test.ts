// qa: card:B04003:29b8cf6699112a9cca3172f2425ac76e59a7d7337034c7b9985bbdab46e21912
// qa: card:B04003:2cdfbf4e0f6aa22ba6ade98705a08b6f260291f3e528e236990015cc0230538c
// qa: card:B04003:0412288994e8f254b6487f266ce8450a64d15e099f0469e55b696ac1afba9d5b
// qa: card:B04003:0f2dd59440534211a643d1e439806371409e6edd1e37cd4a219af1b9d13f7352

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B08081 } from '@/cards/ct-p08/B08081';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession, matchSessionId } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  cancelRemainder: 'card:B04003:29b8cf6699112a9cca3172f2425ac76e59a7d7337034c7b9985bbdab46e21912',
  multiTargetCancel: 'card:B04003:2cdfbf4e0f6aa22ba6ade98705a08b6f260291f3e528e236990015cc0230538c',
  resolution: 'card:B04003:0412288994e8f254b6487f266ce8450a64d15e099f0469e55b696ac1afba9d5b',
  actionNotChoose: 'card:B04003:0f2dd59440534211a643d1e439806371409e6edd1e37cd4a219af1b9d13f7352',
} as const;

function character(id: string, names = [id]): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['test'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const RAN = character('QAB04003RAN', ['毛利蘭']);
const ATTACKER = character('QAB04003ATTACKER');
const PAYMENT = character('QAB04003PAYMENT');
const MULTI_SOURCE: CardDef = {
  ...character('QAB04003MULTISOURCE'),
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'sequence', steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'either', state: 'sleep', max: 2, filter: { cardName: '毛利蘭' } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  }] as never,
};

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}

function install(state: GameState, human: 'self' | 'opp' = 'opp'): void {
  endMatchSession();
  beginMatchSession(human);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startMultiTargetEffect(pickedUids = ['ran-one', 'ran-two']): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'multi-source', abilId: 'a1' })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.map((candidate) => candidate.uid)).toEqual(expect.arrayContaining(['ran-one', 'ran-two']));
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: pickedUids[0]!, pickedUids,
  }))).toEqual({ ok: true });
}

beforeAll(() => {
  _resetRegistry();
  _resetTriggeredRegistered();
  [B02067, B04003, B08081, RAN, ATTACKER, PAYMENT, MULTI_SOURCE].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B04003 official-QA choose-intercept public dispatch', () => {
  it(`${QA.cancelRemainder} / ${QA.multiTargetCancel}: declining one protected target cancels the remaining selected target`, () => {
    const state = base();
    state.players.opp.deck = ['QA_B04003_DRAW'];
    state.players.opp.scene = [makeChar({ uid: 'multi-source', cardId: MULTI_SOURCE.id })];
    state.players.self.scene = [
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'ran-one', cardId: RAN.id }),
      makeChar({ uid: 'ran-two', cardId: RAN.id }),
    ];
    install(state);

    startMultiTargetEffect();
    const intercept = useGameStateStore.getState().pendingChooseIntercept;
    expect(intercept, `${QA.cancelRemainder}: first selection`).toMatchObject({ targetUid: 'ran-one', player: 'opp' });
    expect(dispatchEngineAction(bindPendingDecision(intercept!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });

    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.scene.find((card) => card.uid === 'ran-one')?.state, `${QA.multiTargetCancel}: selected target`).toBe('active');
    expect(after.gameState!.players.self.scene.find((card) => card.uid === 'ran-two')?.state, `${QA.cancelRemainder}: remaining target`).toBe('active');
    expect(after.pendingChooseIntercept, `${QA.cancelRemainder}: terminal`).toBeNull();
    expect(after.gameState!.players.opp.hand, `${QA.cancelRemainder}: later draw cancelled`).toEqual([]);
    expect(after.gameState!.players.opp.deck, `${QA.cancelRemainder}: later deck unchanged`).toEqual(['QA_B04003_DRAW']);
  });

  it(`${QA.resolution}: payment resolves the selected target, then the remaining target in public order`, () => {
    const state = base();
    state.players.opp.hand = [PAYMENT.id];
    state.players.opp.deck = ['QA_B04003_DRAW', 'QA_B04003_STILL'];
    state.players.opp.scene = [makeChar({ uid: 'multi-source', cardId: MULTI_SOURCE.id })];
    state.players.self.scene = [
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'ran-one', cardId: RAN.id }),
      makeChar({ uid: 'ran-two', cardId: RAN.id }),
    ];
    install(state);

    startMultiTargetEffect();
    const intercept = useGameStateStore.getState().pendingChooseIntercept;
    expect(intercept, `${QA.resolution}: response`).toMatchObject({ targetUid: 'ran-one', player: 'opp' });
    expect(dispatchEngineAction(bindPendingDecision(intercept!, {
      type: 'chooseInterceptResolve', discardIndex: 0,
    }))).toEqual({ ok: true });

    const after = useGameStateStore.getState();
    expect(after.gameState!.players.opp.remove, `${QA.resolution}: payment`).toContain(PAYMENT.id);
    expect(after.gameState!.players.opp.hand, `${QA.resolution}: remainder`).toContain('QA_B04003_DRAW');
    expect(after.gameState!.players.self.scene.find((card) => card.uid === 'ran-one')?.state, `${QA.resolution}: first target`).toBe('sleep');
    expect(after.gameState!.players.self.scene.find((card) => card.uid === 'ran-two')?.state, `${QA.resolution}: remaining target`).toBe('sleep');
    expect(after.pendingChooseIntercept, `${QA.resolution}: one-per-turn`).toBeNull();
  });

  it(`${QA.actionNotChoose}: an ordinary action does not create an effect-selection response`, () => {
    const state = base();
    state.turn.player = 'self';
    state.players.self.scene = [makeChar({ uid: 'attacker', cardId: ATTACKER.id })];
    state.players.opp.scene = [
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'ran', cardId: RAN.id, state: 'sleep' }),
    ];
    install(state, 'self');

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'ran' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingChooseIntercept, `${QA.actionNotChoose}: no effect selection`).toBeNull();
  });

  it.each([
    ['set host first', ['ran-one', 'ran-two'], false],
    ['protected target first', ['ran-two', 'ran-one'], true],
  ] as const)('collects B02067 cancel and every B08081 reaction before owner ordering: %s', (_label, pickedUids, payFirst) => {
    const state = base();
    state.players.opp.hand = [PAYMENT.id, PAYMENT.id, PAYMENT.id];
    state.players.opp.deck = ['QA_B04003_DRAW'];
    state.players.opp.scene = [makeChar({ uid: 'multi-source', cardId: MULTI_SOURCE.id })];
    state.players.self.scene = [
      makeChar({ uid: 'ran-one', cardId: RAN.id, setCards: [{ cardId: B02067.id, faceUp: true }] }),
      makeChar({ uid: 'ran-two', cardId: RAN.id }),
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'hirota-1', cardId: B08081.id }),
      makeChar({ uid: 'hirota-2', cardId: B08081.id }),
    ];
    install(state);

    startMultiTargetEffect([...pickedUids]);

    const order = useGameStateStore.getState().pendingChooseIntercept;
    expect(order).toMatchObject({
      kind: 'order',
      player: 'self',
      choices: expect.arrayContaining([
        expect.objectContaining({ resolution: 'cancel', protector: expect.objectContaining({ cardId: B02067.id }) }),
        expect.objectContaining({ resolution: 'discard-or-cancel', protector: expect.objectContaining({ uid: 'hirota-1' }) }),
        expect.objectContaining({ resolution: 'discard-or-cancel', protector: expect.objectContaining({ uid: 'hirota-2' }) }),
      ]),
    });
    const firstTarget = pickedUids[0]!;
    expect(order?.kind === 'order' ? order.choices.map(reactionKey).sort() : []).toEqual([
      `cancel:${B02067.id}:ran-one:ran-one`,
      `discard-or-cancel:${B04003.id}:shinichi:${firstTarget}`,
      `discard-or-cancel:${B08081.id}:hirota-1:${firstTarget}`,
      `discard-or-cancel:${B08081.id}:hirota-2:${firstTarget}`,
    ].sort());
    expect(currentUseCounts()).toEqual({ choker: 1, shinichi: 1, hirota1: 1, hirota2: 1 });

    let activeOrder = order!;
    let resolvedDiscardReactions = 0;
    if (payFirst && activeOrder.kind === 'order') {
      const paymentReaction = activeOrder.choices.find(choice => choice.resolution === 'discard-or-cancel');
      expect(paymentReaction).toBeDefined();
      expect(dispatchEngineAction(bindPendingDecision(activeOrder, {
        type: 'chooseInterceptOrderResolve',
        protectorUid: paymentReaction!.protector.uid,
        targetUid: paymentReaction!.targetUid,
      }))).toEqual({ ok: true });
      const payment = useGameStateStore.getState().pendingChooseIntercept;
      expect(payment).toMatchObject({ kind: 'response', resolution: 'discard-or-cancel' });
      expect(dispatchEngineAction(bindPendingDecision(payment!, {
        type: 'chooseInterceptResolve', discardIndex: 0,
      }))).toEqual({ ok: true });
      resolvedDiscardReactions += 1;
      activeOrder = useGameStateStore.getState().pendingChooseIntercept!;
      expect(activeOrder).toMatchObject({ kind: 'order' });
      expect(activeOrder.kind === 'order' ? new Set(activeOrder.choices.map(reactionKey)).size : 0).toBe(3);
    }
    const cancel = activeOrder.kind === 'order'
      ? activeOrder.choices.find(choice => choice.resolution === 'cancel')
      : undefined;
    expect(cancel).toBeDefined();
    expect(dispatchEngineAction(bindPendingDecision(activeOrder, {
      type: 'chooseInterceptOrderResolve',
      protectorUid: cancel!.protector.uid,
      targetUid: cancel!.targetUid,
    }))).toEqual({ ok: true });

    for (let step = 0; step < 3; step += 1) {
      const pending = useGameStateStore.getState().pendingChooseIntercept;
      if (!pending) break;
      if (pending.kind === 'order') {
        const next = pending.choices.find(choice => choice.resolution === 'discard-or-cancel');
        expect(next).toBeDefined();
        expect(dispatchEngineAction(bindPendingDecision(pending, {
          type: 'chooseInterceptOrderResolve',
          protectorUid: next!.protector.uid,
          targetUid: next!.targetUid,
        }))).toEqual({ ok: true });
      }
      const response = useGameStateStore.getState().pendingChooseIntercept;
      expect(response).toMatchObject({ kind: 'response', resolution: 'discard-or-cancel' });
      expect(dispatchEngineAction(bindPendingDecision(response!, {
        type: 'chooseInterceptResolve', discardIndex: 0,
      }))).toEqual({ ok: true });
      resolvedDiscardReactions += 1;
    }

    const after = useGameStateStore.getState();
    expect(after.pendingChooseIntercept).toBeNull();
    expect(after.gameState!.pendingRuntimeState).toBeUndefined();
    expect(after.gameState!.players.self.scene.filter(card => card.uid.startsWith('ran-')).map(card => card.state))
      .toEqual(['active', 'active']);
    expect(after.gameState!.players.opp).toMatchObject({
      hand: [],
      remove: [PAYMENT.id, PAYMENT.id, PAYMENT.id],
      deck: ['QA_B04003_DRAW'],
    });
    expect(resolvedDiscardReactions).toBe(3);
    expect(currentUseCounts()).toEqual({ choker: 1, shinichi: 1, hirota1: 1, hirota2: 1 });
  });

  it('keeps B02067 cancellation authoritative across restore while every sibling resolves', () => {
    installAllInterceptors();
    chooseB02067First();
    roundTripCurrentState();

    expect(payAllRemainingInterceptors()).toBe(3);
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.scene.filter(card => card.uid.startsWith('ran-')).map(card => card.state))
      .toEqual(['active', 'active']);
    expect(after.gameState!.players.opp.remove).toEqual([PAYMENT.id, PAYMENT.id, PAYMENT.id]);
    expect(after.gameState!.players.opp.deck).toEqual(['QA_B04003_DRAW']);
    expect(after.gameState!.pendingRuntimeState).toBeUndefined();
  });

  it('keeps draining siblings after B02067 and a later refusal survive restore', () => {
    installAllInterceptors();
    chooseB02067First();
    const order = useGameStateStore.getState().pendingChooseIntercept!;
    const first = order.kind === 'order'
      ? order.choices.find(choice => choice.resolution === 'discard-or-cancel')
      : undefined;
    expect(first).toBeDefined();
    expect(dispatchEngineAction(bindPendingDecision(order, {
      type: 'chooseInterceptOrderResolve',
      protectorUid: first!.protector.uid,
      targetUid: first!.targetUid,
    }))).toEqual({ ok: true });
    const response = useGameStateStore.getState().pendingChooseIntercept!;
    expect(dispatchEngineAction(bindPendingDecision(response, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });
    roundTripCurrentState();

    expect(payAllRemainingInterceptors()).toBe(2);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.filter(card => card.uid.startsWith('ran-')).map(card => card.state))
      .toEqual(['active', 'active']);
    expect(after.players.opp.remove).toEqual([PAYMENT.id, PAYMENT.id]);
    expect(after.players.opp.deck).toEqual(['QA_B04003_DRAW']);
  });

  it('transactionally rejects forged cancellation state before and after B02067 resolves', () => {
    installAllInterceptors();
    const liveBefore = useGameStateStore.getState().gameState!;
    const promptBefore = useGameStateStore.getState().pendingChooseIntercept;
    const forgedBefore = JSON.parse(JSON.stringify(liveBefore)) as GameState;
    const beforeResume = forgedBefore.pendingRuntimeState!.snapshot
      .find(entry => entry.key === '__pendingChooseInterceptResume')!.value as { effectCancelled?: boolean };
    beforeResume.effectCancelled = true;
    expect(() => useGameStateStore.getState().setGameState(forgedBefore))
      .toThrow(/Invalid pendingChooseIntercept/);
    expect(useGameStateStore.getState().gameState).toBe(liveBefore);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBe(promptBefore);

    chooseB02067First();
    const liveAfter = useGameStateStore.getState().gameState!;
    const promptAfter = useGameStateStore.getState().pendingChooseIntercept;
    for (const mode of ['false', 'missing'] as const) {
      const forgedAfter = JSON.parse(JSON.stringify(liveAfter)) as GameState;
      const afterResume = forgedAfter.pendingRuntimeState!.snapshot
        .find(entry => entry.key === '__pendingChooseInterceptResume')!.value as { effectCancelled?: boolean };
      if (mode === 'false') afterResume.effectCancelled = false;
      else delete afterResume.effectCancelled;
      expect(() => useGameStateStore.getState().setGameState(forgedAfter))
        .toThrow(/Invalid pendingChooseIntercept/);
      expect(useGameStateStore.getState().gameState).toBe(liveAfter);
      expect(useGameStateStore.getState().pendingChooseIntercept).toBe(promptAfter);
    }
  });

  it('closes a B02067-first mixed batch as one causal chain after every sibling payment', async () => {
    const {
      isCausalLogEntry,
      startCausalSession,
      validateCausalLog,
      validateGameCausalState,
    } = await import('@/engine/log/causal');
    installAllInterceptors((state, sessionId) => startCausalSession(state, sessionId));
    chooseB02067First();
    roundTripCurrentState();

    expect(payAllRemainingInterceptors()).toBe(3);
    const after = useGameStateStore.getState().gameState!;
    const nodes = validateCausalLog(after.log.filter(isCausalLogEntry));
    expect(validateGameCausalState(after)).toEqual(nodes);
    const rootIndex = nodes.findIndex(node => (
      node.kind === 'declare'
      && node.source.kind === 'card'
      && node.source.cardNumber === MULTI_SOURCE.id
    ));
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    const chain = nodes.slice(rootIndex);
    expect(chain.slice(1).every((node, index) => node.parentEventId === chain[index]!.eventId)).toBe(true);
    expect(chain.filter(node => node.kind === 'discard')).toHaveLength(3);
    expect(chain.filter(node => node.kind === 'cancel')).toHaveLength(1);
    expect(chain.at(-1)?.kind).toBe('cancel');
    expect(chain.some(node => node.kind === 'sleep' || node.kind === 'draw' || node.kind === 'summary')).toBe(false);
    expectNoChooseInterceptWitnesses(after);
  });
});

function reactionKey(reaction: { resolution?: string; protector: { cardId: string; uid: string }; targetUid: string }): string {
  return `${reaction.resolution ?? 'discard-or-cancel'}:${reaction.protector.cardId}:${reaction.protector.uid}:${reaction.targetUid}`;
}

function currentUseCounts(): { choker: number; shinichi: number; hirota1: number; hirota2: number } {
  const scene = useGameStateStore.getState().gameState!.players.self.scene;
  return {
    choker: scene.find(card => card.uid === 'ran-one')?.declaredUseCount.a1 ?? 0,
    shinichi: scene.find(card => card.uid === 'shinichi')?.declaredUseCount.a1 ?? 0,
    hirota1: scene.find(card => card.uid === 'hirota-1')?.declaredUseCount.a2 ?? 0,
    hirota2: scene.find(card => card.uid === 'hirota-2')?.declaredUseCount.a2 ?? 0,
  };
}

function installAllInterceptors(prepare?: (state: GameState, sessionId: string) => void): void {
  const state = base();
  state.players.opp.hand = [PAYMENT.id, PAYMENT.id, PAYMENT.id];
  state.players.opp.deck = ['QA_B04003_DRAW'];
  state.players.opp.scene = [makeChar({ uid: 'multi-source', cardId: MULTI_SOURCE.id })];
  state.players.self.scene = [
    makeChar({ uid: 'ran-one', cardId: RAN.id, setCards: [{ cardId: B02067.id, faceUp: true }] }),
    makeChar({ uid: 'ran-two', cardId: RAN.id }),
    makeChar({ uid: 'shinichi', cardId: B04003.id }),
    makeChar({ uid: 'hirota-1', cardId: B08081.id }),
    makeChar({ uid: 'hirota-2', cardId: B08081.id }),
  ];
  if (prepare) {
    endMatchSession();
    const session = beginMatchSession('opp');
    prepare(state, matchSessionId(session));
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  } else {
    install(state);
  }
  startMultiTargetEffect();
}

function chooseB02067First(): void {
  const order = useGameStateStore.getState().pendingChooseIntercept;
  const cancel = order?.kind === 'order'
    ? order.choices.find(choice => choice.resolution === 'cancel')
    : undefined;
  expect(cancel).toBeDefined();
  expect(dispatchEngineAction(bindPendingDecision(order!, {
    type: 'chooseInterceptOrderResolve',
    protectorUid: cancel!.protector.uid,
    targetUid: cancel!.targetUid,
  }))).toEqual({ ok: true });
}

function roundTripCurrentState(): void {
  const restored = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;
  expect(restored.pendingRuntimeState).toBeDefined();
  expect(useGameStateStore.getState().setGameState(null)).toBe(true);
  expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
}

function payAllRemainingInterceptors(): number {
  let paid = 0;
  while (useGameStateStore.getState().pendingChooseIntercept) {
    const pending = useGameStateStore.getState().pendingChooseIntercept!;
    if (pending.kind === 'order') {
      const next = pending.choices.find(choice => choice.resolution === 'discard-or-cancel');
      expect(next).toBeDefined();
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'chooseInterceptOrderResolve',
        protectorUid: next!.protector.uid,
        targetUid: next!.targetUid,
      }))).toEqual({ ok: true });
    }
    const response = useGameStateStore.getState().pendingChooseIntercept!;
    expect(response).toMatchObject({ kind: 'response', resolution: 'discard-or-cancel' });
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
