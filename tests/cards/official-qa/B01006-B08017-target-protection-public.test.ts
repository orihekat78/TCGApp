// qa: card:B01006:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b
// qa: card:B03030:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b
// qa: card:B05008:30651b7ee5f0a59b4c20d0e807141d2ea57f534baf2b03bf5e409e462a5b66a8
// qa: card:B05048:dd999e26dc327f362b16b4e1a8cf5780f8462b4214f3e38bf3dd502288f4fd84
// qa: card:B08017:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b
// Official Q&A: an opponent's effect cannot select the protected character.
// This exercises the shipped hand-use -> public pending decision route.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B01006 } from '@/cards/ct-p01/B01006';
import { B03030 } from '@/cards/ct-p03/B03030';
import { B05008 } from '@/cards/ct-p05/B05008';
import { B05048 } from '@/cards/ct-p05/B05048';
import { B08017 } from '@/cards/ct-p08/B08017';
import { D02015 } from '@/cards/ct-d02/D02015';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  B01006: 'card:B01006:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b',
  B03030: 'card:B03030:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b',
  B05008: 'card:B05008:30651b7ee5f0a59b4c20d0e807141d2ea57f534baf2b03bf5e409e462a5b66a8',
  B05048: 'card:B05048:dd999e26dc327f362b16b4e1a8cf5780f8462b4214f3e38bf3dd502288f4fd84',
  B08017: 'card:B08017:b4700accb91f4e296c848f701b9e1cbef24d22b2f328348428dff879f61a302b',
} as const;

type BondCard = typeof B01006 | typeof B03030 | typeof B05008;
type ProtectionCard = BondCard | typeof B05048;

function def(id: string, names = [id], color = D02015.colors[0]!, ap = 1000): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: [color], level: 1, ap, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function auraName(card: CardDef): string {
  const modifier = card.abilities.find((ability) => ability.type === 'continuous')?.continuousModifier;
  const condition = card.abilities.find((ability) => ability.type === 'continuous')?.condition;
  const aura = modifier?.untargetableByOppEffectAura;
  if (aura && 'cardName' in aura && typeof aura.cardName === 'string') return aura.cardName;
  if (condition && 'cardName' in condition && typeof condition.cardName === 'string') return condition.cardName;
  throw new Error(`missing protection name for ${card.id}`);
}

function bondName(card: CardDef): string {
  const condition = card.abilities.find((ability) => ability.type === 'continuous')?.condition;
  if (condition && 'cardName' in condition && typeof condition.cardName === 'string') return condition.cardName;
  throw new Error(`missing bond name for ${card.id}`);
}

function stateFor(targetOwner: Player, protectedCard: CardDef, options: {
  bond?: string;
  bearer?: CardDef;
  state?: 'active' | 'sleep';
  set?: { faceUp: boolean; state: 'active' | 'sleep' };
} = {}): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  for (const player of ['self', 'opp'] as const) {
    state.players[player].case.colors = [D02015.colors[0]!];
    state.players[player].file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
    state.players[player].partner = { cardId: `PARTNER_${player}`, state: 'active', location: 'partner-area' } as never;
  }
  state.players.self.hand = [D02015.id];
  state.players[targetOwner].scene = [
    makeChar({ uid: 'protected', cardId: protectedCard.id, state: options.state ?? options.set?.state ?? 'active', setCards: options.set ? [{ cardId: B08017.id, faceUp: options.set.faceUp }] : [] }),
    makeChar({ uid: 'decoy', cardId: 'DECOY' }),
    makeChar({ uid: 'decoy-two', cardId: 'DECOY_TWO' }),
  ];
  if (options.bond) state.players[targetOwner].scene.push(makeChar({ uid: 'bond', cardId: 'BOND' }));
  if (options.bearer) state.players[targetOwner].scene.push(makeChar({ uid: 'bearer', cardId: options.bearer.id }));
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dispatchD02015(qa: string) {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: D02015.id }), `${qa}: ${D02015.id}/hand`).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick, `${qa}: ${D02015.id}/pending`).toBeTruthy();
  return pick!;
}

function expectPickAuthority(targetOwner: Player, qa: string): void {
  const store = useGameStateStore.getState();
  const pick = store.pendingEffectPick!;
  expect(pick.source, `${qa}: ${D02015.id}/source`).toMatchObject({ cardId: D02015.id, abilityId: 'a1' });
  expect(pick.player, `${qa}: ${D02015.id}/chooser`).toBe('self');
  expect(pick.candidates, `${qa}: ${D02015.id}/target-owner`).not.toHaveLength(0);
  expect(pick.candidates.every((candidate) => candidate.player === targetOwner), `${qa}: ${D02015.id}/target-owner`).toBe(true);
  expect(pick.decisionId, `${qa}: ${D02015.id}/decision`).toBeTruthy();
  expect([
    store.pendingEffectPick?.decisionId,
    store.pendingEffectChoice?.decisionId,
    store.pendingEffectOptional?.decisionId,
  ].filter((decisionId): decisionId is string => decisionId !== undefined), `${qa}: ${D02015.id}/decision-count`).toEqual([pick.decisionId]);
}

function resolvePick(targetOwner: Player, pickedUid: string, expectedCardId: string, qa: string): void {
  const pick = useGameStateStore.getState().pendingEffectPick!;
  expect(dispatchEngineAction(bindPendingDecision(pick, { type: 'effectPickResolve', pickedUid })), `${qa}: ${D02015.id}/${pickedUid}`).toEqual({ ok: true });
  const store = useGameStateStore.getState();
  expect(store.gameState!.players[targetOwner].remove, `${qa}: ${D02015.id}/${pickedUid}/remove`).toContain(expectedCardId);
  expect(store.pendingEffectPick, `${qa}: ${D02015.id}/${pickedUid}/pending`).toBeNull();
  expect(store.pendingEffectChoice, `${qa}: ${D02015.id}/${pickedUid}/runtime-choice`).toBeNull();
  expect(store.pendingEffectOptional, `${qa}: ${D02015.id}/${pickedUid}/runtime-optional`).toBeNull();
}

function expectProtectedBy(card: ProtectionCard, qa: string, options: { bond?: boolean; bearer?: boolean } = {}): void {
  const protectedCard = card === B05048 ? def('PROTECTED', [auraName(card)]) : card;
  const bond = options.bond || options.bearer ? bondName(card) : undefined;
  const bearer = options.bearer ? card : undefined;

  const opponentSource = stateFor('opp', protectedCard, { bond, bearer });
  install(opponentSource);
  const opponentPick = dispatchD02015(qa);
  expectPickAuthority('opp', qa);
  const opponentUids = opponentPick.candidates.map((candidate) => candidate.uid);
  expect(opponentUids, `${qa}: ${card.id}/protected`).not.toContain('protected');
  expect(opponentUids, `${qa}: ${card.id}/decoy`).toContain('decoy');
  resolvePick('opp', 'decoy', 'DECOY', qa);

  const sameOwnerSource = stateFor('self', protectedCard, { bond, bearer });
  install(sameOwnerSource);
  const sameOwnerPick = dispatchD02015(qa);
  expectPickAuthority('self', qa);
  expect(sameOwnerPick.candidates.map((candidate) => candidate.uid), `${qa}: ${card.id}/protected`).toContain('protected');
  resolvePick('self', 'protected', protectedCard.id, qa);

  const ordinaryAction = stateFor('opp', protectedCard, { bond, bearer, state: 'sleep' });
  ordinaryAction.players.self.scene = [makeChar({ uid: 'attacker', cardId: 'ATTACKER' })];
  install(ordinaryAction);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'protected' }), `${qa}: ${card.id}/protected`).toEqual({ ok: true });
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  register(D02015);
  register(B01006); register(B03030); register(B05008); register(B05048); register(B08017);
  register(def('BOND', [bondName(B01006), bondName(B03030), bondName(B05008), bondName(B05048)], D02015.colors[0]!, 9000));
  register(def('PROTECTED', [auraName(B05048)]));
  register(def('DECOY')); register(def('DECOY_TWO')); register(def('ATTACKER'));
  register(def('PARTNER_self', ['PARTNER_self'])); register(def('PARTNER_opp', ['PARTNER_opp']));
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => endMatchSession());

describe('B01006 / B03030 / B05008 / B05048 official Q&A target protection', () => {
  it(`${QA.B01006}: active named bond protection blocks only opponent effects`, () => {
    expectProtectedBy(B01006, QA.B01006, { bond: true });
  });

  it(`${QA.B03030}: active named bond protection blocks only opponent effects`, () => {
    expectProtectedBy(B03030, QA.B03030, { bond: true });
  });

  it(`${QA.B05008}: active named bond protection blocks only opponent effects`, () => {
    expectProtectedBy(B05008, QA.B05008, { bond: true });
  });

  it(`${QA.B05048}: active bearer protection blocks only opponent effects`, () => {
    expectProtectedBy(B05048, QA.B05048, { bearer: true });
  });

  it.each([
    [B01006, QA.B01006], [B03030, QA.B03030], [B05008, QA.B05008],
  ] as const)('%s bond absent leaves its bearer selectable', (card, qa) => {
    const state = stateFor('self', card);
    install(state);
    expect(dispatchD02015(qa).candidates.map((candidate) => candidate.uid), `${qa}: ${card.id}/protected`).toContain('protected');
  });

  it(`${QA.B05048}: absent bearer leaves its named character selectable`, () => {
    const state = stateFor('self', def('PROTECTED', [auraName(B05048)]));
  install(state);
  expect(dispatchD02015(QA.B05048).candidates.map((candidate) => candidate.uid), `${QA.B05048}: ${B05048.id}/protected`).toContain('protected');
  });
});

describe('B08017 official Q&A set-host target protection', () => {
  it(`${QA.B08017}: sleeping host with a face-up set card blocks only opponent effects`, () => {
    const protectedCard = def('PROTECTED', [auraName(B08017)]);
    register(protectedCard);
    const opponentSource = stateFor('opp', protectedCard, { set: { faceUp: true, state: 'sleep' } });
    install(opponentSource);
    const opponentPick = dispatchD02015(QA.B08017);
    expectPickAuthority('opp', QA.B08017);
    expect(opponentPick.candidates.map((candidate) => candidate.uid), `${QA.B08017}: ${B08017.id}/protected`).not.toContain('protected');
    expect(opponentPick.candidates.map((candidate) => candidate.uid), `${QA.B08017}: ${B08017.id}/decoy`).toContain('decoy');
    resolvePick('opp', 'decoy', 'DECOY', QA.B08017);

    const sameOwnerSource = stateFor('self', protectedCard, { set: { faceUp: true, state: 'sleep' } });
    install(sameOwnerSource);
    expect(dispatchD02015(QA.B08017).candidates.map((candidate) => candidate.uid), `${QA.B08017}: ${B08017.id}/protected`).toContain('protected');
    expectPickAuthority('self', QA.B08017);
    resolvePick('self', 'protected', protectedCard.id, QA.B08017);

    const ordinaryAction = stateFor('opp', protectedCard, { set: { faceUp: true, state: 'sleep' } });
    ordinaryAction.players.self.scene = [makeChar({ uid: 'attacker', cardId: 'ATTACKER' })];
    install(ordinaryAction);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'protected' }), `${QA.B08017}: ${B08017.id}/protected`).toEqual({ ok: true });
  });

  it(`${QA.B08017}: active host and face-down set leave the host selectable`, () => {
    const protectedCard = def('PROTECTED', [auraName(B08017)]);
    register(protectedCard);
    for (const set of [{ faceUp: true, state: 'active' as const }, { faceUp: false, state: 'sleep' as const }]) {
      install(stateFor('opp', protectedCard, { set }));
      expect(dispatchD02015(QA.B08017).candidates.map((candidate) => candidate.uid), `${QA.B08017}: ${B08017.id}/protected`).toContain('protected');
    }
  });
});
