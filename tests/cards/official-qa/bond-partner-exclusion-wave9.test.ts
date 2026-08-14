// qa: card:B02004:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B02005:a9e2b55ade434427e86e8e7b1f9b5a0166ea3b0f412c460bdb09e162d8bbc736
// qa: card:B01006:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B04003:ad9d39118ac40e1d7ecaefd452fddc993c9022604d0e60a2cb9c152955319f63

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B01006 } from '@/cards/ct-p01/B01006';
import { B02004 } from '@/cards/ct-p02/B02004';
import { B02005 } from '@/cards/ct-p02/B02005';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D02015 } from '@/cards/ct-d02/D02015';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  B02004: 'card:B02004:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4',
  B02005: 'card:B02005:a9e2b55ade434427e86e8e7b1f9b5a0166ea3b0f412c460bdb09e162d8bbc736',
  B01006: 'card:B01006:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4',
  B04003: 'card:B04003:ad9d39118ac40e1d7ecaefd452fddc993c9022604d0e60a2cb9c152955319f63',
} as const;

function def(id: string, names: string[], color = '青', ap = 1000): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names, colors: [color], level: 1,
    ap, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const KUDO = def('W9_KUDO', ['工藤新一']);
const CONAN = def('W9_CONAN', ['江戸川コナン']);
const EIRI = def('W9_EIRI', ['妃英理']);
const KOGORO = def('W9_KOGORO', ['毛利小五郎'], '青', 3000);
const RAN = def('W9_RAN', ['毛利蘭'], '青', 4000);
const TARGET = def('W9_TARGET', ['対象'], '青', 1000);
const DECOY = def('W9_DECOY', ['別対象'], '青', 1000);
const GREEN_PARTNER = def('W9_GREEN_PARTNER', ['緑パートナー'], D02015.colors[0]!);

function base(turnPlayer: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.deck = ['SELF_DRAW_1', 'SELF_DRAW_2', 'SELF_DRAW_3'];
  state.players.opp.deck = ['OPP_DRAW_1', 'OPP_DRAW_2', 'OPP_DRAW_3'];
  return state;
}

function setPartner(state: GameState, player: Player, cardId: string): void {
  state.players[player].partner = { cardId, state: 'active', location: 'partner-area' } as never;
}

function install(state: GameState, human: Player): void {
  endMatchSession();
  beginMatchSession(human);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function prepareEventState(partnerCardId: string): GameState {
  const state = base('opp');
  state.players.opp.hand = [D02015.id];
  state.players.opp.case.colors = [D02015.colors[0]!];
  state.players.opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  setPartner(state, 'opp', GREEN_PARTNER.id);
  setPartner(state, 'self', partnerCardId);
  return state;
}

function useD02015(): NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']> {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: D02015.id })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  return pending!;
}

function useB10022(): NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']> {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazuha', abilId: 'a1' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  return pending!;
}

function resolvePick(pickedUid: string): void {
  const pending = useGameStateStore.getState().pendingEffectPick!;
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid }))).toEqual({ ok: true });
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [B01006, B02004, B02005, B04003, B10022, D02015, KUDO, CONAN, EIRI, KOGORO, RAN, TARGET, DECOY, GREEN_PARTNER]
    .forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('official Q&A partner-area exclusions', () => {
  it(`${QA.B02004}: a named partner does not satisfy the scene bond`, () => {
    const partnerOnly = base();
    partnerOnly.players.self.scene = [makeChar({ uid: 'ran', cardId: B02004.id })];
    partnerOnly.players.self.remove = [EIRI.id];
    setPartner(partnerOnly, 'self', KUDO.id);
    install(partnerOnly, 'self');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'ran' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick, `${QA.B02004}: partner-only`).toBeNull();
    expect(useGameStateStore.getState().gameState!.players.self.remove).toContain(EIRI.id);

    const sceneBond = base();
    sceneBond.players.self.scene = [
      makeChar({ uid: 'ran', cardId: B02004.id }),
      makeChar({ uid: 'kudo', cardId: KUDO.id }),
    ];
    sceneBond.players.self.remove = [EIRI.id];
    setPartner(sceneBond, 'self', TARGET.id);
    install(sceneBond, 'self');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'ran' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.candidates.map((candidate) => candidate.cardId), `${QA.B02004}: scene bond`).toContain(EIRI.id);
    resolvePick(pending.candidates.find((candidate) => candidate.cardId === EIRI.id)!.uid);
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((card) => card.cardId === EIRI.id)).toBe(true);
  });

  it(`${QA.B02005}: a named partner is not an eligible self-scene target`, () => {
    const partnerOnly = base();
    partnerOnly.players.self.scene = [makeChar({ uid: 'yoko', cardId: B02005.id })];
    setPartner(partnerOnly, 'self', KOGORO.id);
    install(partnerOnly, 'self');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yoko', abilId: 'a1' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick, `${QA.B02005}: partner-only`).toBeNull();
    expect(useGameStateStore.getState().gameState!.players.self.partner.cardId).toBe(KOGORO.id);

    const sceneTarget = base();
    sceneTarget.players.self.scene = [
      makeChar({ uid: 'yoko', cardId: B02005.id }),
      makeChar({ uid: 'kogoro', cardId: KOGORO.id }),
    ];
    setPartner(sceneTarget, 'self', KOGORO.id);
    install(sceneTarget, 'self');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yoko', abilId: 'a1' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.candidates.map((candidate) => candidate.uid), `${QA.B02005}: scene target`).toEqual(['kogoro']);
    resolvePick('kogoro');
    const after = useGameStateStore.getState().gameState!;
    expect(readChar.ap(after, 'kogoro')).toBe(KOGORO.ap! + 2000);
    expect(readChar.keywords(after, 'kogoro')).toContain('突撃');
  });

  it(`${QA.B01006}: a named partner does not activate bond protection`, () => {
    const partnerOnly = prepareEventState(CONAN.id);
    partnerOnly.players.self.scene = [
      makeChar({ uid: 'ai', cardId: B01006.id }),
      makeChar({ uid: 'decoy', cardId: DECOY.id }),
    ];
    install(partnerOnly, 'opp');
    expect(useD02015().candidates.map((candidate) => candidate.uid), `${QA.B01006}: partner-only`).toContain('ai');
    resolvePick('ai');
    expect(useGameStateStore.getState().gameState!.players.self.remove).toContain(B01006.id);

    const sceneBond = prepareEventState(TARGET.id);
    sceneBond.players.self.scene = [
      makeChar({ uid: 'ai', cardId: B01006.id }),
      makeChar({ uid: 'conan', cardId: CONAN.id }),
      makeChar({ uid: 'decoy', cardId: DECOY.id }),
    ];
    install(sceneBond, 'opp');
    const protectedPick = useD02015();
    expect(protectedPick.candidates.map((candidate) => candidate.uid), `${QA.B01006}: scene bond`).not.toContain('ai');
    resolvePick('decoy');
  });

  it(`${QA.B04003}: a named partner does not protect a different scene character`, () => {
    const partnerOnly = prepareEventState(RAN.id);
    partnerOnly.players.opp.hand = [];
    partnerOnly.players.opp.scene = [makeChar({ uid: 'kazuha', cardId: B10022.id })];
    partnerOnly.players.self.scene = [
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'target', cardId: TARGET.id }),
    ];
    install(partnerOnly, 'opp');
    const partnerPick = useB10022();
    expect(useGameStateStore.getState().gameState!.players.self.partner.cardId).toBe(RAN.id);
    expect(partnerPick.candidates.map((candidate) => candidate.cardId)).not.toContain(RAN.id);
    expect(partnerPick.candidates.map((candidate) => candidate.uid)).toContain('target');
    resolvePick('target');
    expect(useGameStateStore.getState().pendingChooseIntercept, `${QA.B04003}: partner-only`).toBeNull();
    expect(useGameStateStore.getState().gameState!.players.self.remove).toContain(TARGET.id);

    const sceneTarget = prepareEventState(TARGET.id);
    sceneTarget.players.opp.hand = [];
    sceneTarget.players.opp.scene = [makeChar({ uid: 'kazuha', cardId: B10022.id })];
    sceneTarget.players.self.scene = [
      makeChar({ uid: 'shinichi', cardId: B04003.id }),
      makeChar({ uid: 'ran', cardId: RAN.id }),
    ];
    install(sceneTarget, 'opp');
    const scenePick = useB10022();
    expect(scenePick.candidates.map((candidate) => candidate.cardId)).toContain(RAN.id);
    expect(scenePick.candidates.map((candidate) => candidate.uid)).toContain('ran');
    resolvePick('ran');
    const intercept = useGameStateStore.getState().pendingChooseIntercept;
    expect(intercept, `${QA.B04003}: scene target`).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(intercept!, {
      type: 'chooseInterceptResolve', discardIndex: null,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((card) => card.uid === 'ran')).toBe(true);
  });
});
