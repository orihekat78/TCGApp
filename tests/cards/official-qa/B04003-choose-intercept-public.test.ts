// qa: card:B04003:29b8cf6699112a9cca3172f2425ac76e59a7d7337034c7b9985bbdab46e21912
// qa: card:B04003:2cdfbf4e0f6aa22ba6ade98705a08b6f260291f3e528e236990015cc0230538c
// qa: card:B04003:0412288994e8f254b6487f266ce8450a64d15e099f0469e55b696ac1afba9d5b
// qa: card:B04003:0f2dd59440534211a643d1e439806371409e6edd1e37cd4a219af1b9d13f7352

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { B04003 } from '@/cards/ct-p04/B04003';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
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

const RAN = character('QA_B04003_RAN', ['毛利蘭']);
const ATTACKER = character('QA_B04003_ATTACKER');
const PAYMENT = character('QA_B04003_PAYMENT');
const MULTI_SOURCE: CardDef = {
  ...character('QA_B04003_MULTI_SOURCE'),
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

function startMultiTargetEffect(): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'multi-source', abilId: 'a1' })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.map((candidate) => candidate.uid)).toEqual(expect.arrayContaining(['ran-one', 'ran-two']));
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'ran-one', pickedUids: ['ran-one', 'ran-two'],
  }))).toEqual({ ok: true });
}

beforeAll(() => {
  _resetRegistry();
  _resetTriggeredRegistered();
  [B04003, RAN, ATTACKER, PAYMENT, MULTI_SOURCE].forEach(register);
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
});
