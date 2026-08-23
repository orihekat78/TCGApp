// qa: card:B09070:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09071:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09074:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09075:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09076:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09084:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B10070:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:D11003:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:D11004:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:D11014:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
// qa: card:B09070:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:B09071:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:B09074:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:B09075:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:B09084:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:B10070:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:D11003:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:D11004:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:D11009:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:D11014:fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002
// qa: card:D11014:5d372fbd4d8831b3e59f945a7dd79ed55444cc43b8ba3baa33569492633d402d
// Rules: 13, 15, 17. Real CardDefs entered by an effect through the public dispatcher.

import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09070 } from '@/cards/ct-p09/B09070';
import { B09070P } from '@/cards/ct-p09/B09070P';
import { B09071 } from '@/cards/ct-p09/B09071';
import { B09071P } from '@/cards/ct-p09/B09071P';
import { B09071P2 } from '@/cards/ct-p09/B09071P2';
import { B09074 } from '@/cards/ct-p09/B09074';
import { B09074P } from '@/cards/ct-p09/B09074P';
import { B09074P2 } from '@/cards/ct-p09/B09074P2';
import { B09075 } from '@/cards/ct-p09/B09075';
import { B09075P } from '@/cards/ct-p09/B09075P';
import { B09076 } from '@/cards/ct-p09/B09076';
import { B09076P } from '@/cards/ct-p09/B09076P';
import { B09084 } from '@/cards/ct-p09/B09084';
import { B10070, B10070P } from '@/cards/ct-p10/B10070';
import { D11003 } from '@/cards/ct-d11/D11003';
import { D11004 } from '@/cards/ct-d11/D11004';
import { D11009 } from '@/cards/ct-d11/D11009';
import { D11010 } from '@/cards/ct-d11/D11010';
import { D11014 } from '@/cards/ct-d11/D11014';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const QA = 'fd46e3e8955490f444afdb47fbaa606489da5b870cf6d88ae747987457e8c002';
const QA_FIRST_ENTRY = 'c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb';
const CARDS = [B09070, B09071, B09074, B09075, B09076, B09084, B10070, D11003, D11004, D11009, D11014] as const;
const ENTRY_SOURCE = 'QA_SHIPPU_ENTRY_SOURCE';
const ENTRY_SOURCE_UID = 'qa-entry-source';
const ELIGIBLE = 'QA_SHIPPU_ELIGIBLE';
const DRAW = 'QA_SHIPPU_DRAW';
const PLAIN = 'QA_SHIPPU_PLAIN';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 4, ap: 4000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  };
}

function enterAbility(cardId: string): AbilityDef {
  return {
    id: `enter-${cardId}`, type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } },
    },
    description: '', ruleRefs: [],
  };
}

const enterOpponentD11003: AbilityDef = {
  id: 'enter-opponent-D11003', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'atom', verb: 'sceneEnter',
    args: { player: 'opp', cardId: D11003.id, viaEffect: true, target: { query: { area: 'remove', side: 'opp' } } },
  },
  description: '', ruleRefs: [],
};

const entrySource = card(ENTRY_SOURCE, {
  abilities: [
    ...CARDS.map((definition) => enterAbility(definition.id)),
    enterAbility(PLAIN),
    enterOpponentD11003,
  ],
});
const eligible = card(ELIGIBLE, { traits: ['警察', '神奈川県警'] });
const drawCard = card(DRAW);
const plain = card(PLAIN);

function base(definition: CardDef, caseStatus: '事件編' | '解決編' = '解決編'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = { cardId: 'QA_CASE', status: caseStatus, requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  state.players.opp.case = { cardId: 'QA_OPP_CASE', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  state.players.self.scene = [sceneChar(ENTRY_SOURCE, ENTRY_SOURCE_UID, { enterOrderThisTurn: undefined })];
  state.players.self.remove = [definition.id];
  state.players.self.file = ['QA_FILE'];
  state.players.self.deck = [DRAW];
  state.players.opp.deck = [DRAW];
  state.turnState.self.enterCountThisTurn = 0;
  return state;
}

function install(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: state });
}

function current(): GameState {
  return useGameStateStore.getState().gameState!;
}

function expectSettled(label: string): void {
  const store = useGameStateStore.getState();
  expect({
    effectPick: store.pendingEffectPick !== null,
    effectChoice: store.pendingEffectChoice !== null,
    effectOptional: store.pendingEffectOptional !== null,
    chooseIntercept: store.pendingChooseIntercept !== null,
    leaveIntercept: store.pendingLeaveIntercept !== null,
    setCardChoice: store.pendingSetCardChoice !== null,
    setCardReplacement: store.pendingSetCardReplacement !== null,
    repeatOptional: store.pendingEffectRepeatOptional !== null,
    hirameki: store.pendingHirameki !== null,
    misread: store.pendingMisread !== null,
    deckRevealAwaitingPick: store.pendingDeckReveal?.awaitingPick === true,
    effectHandReveal: store.pendingPublicHandReveal?.lifetime === 'effect',
    deckReorder: store.pendingDeckReorder !== null,
    deckPlace: store.pendingDeckPlace !== null,
    rps: store.pendingRps !== null,
    activeEffects: current().pendingEffects.filter((entry) => entry.state === 'pending' || entry.state === 'resolving').map((entry) => entry.id),
  }, `${label}: public lifecycle settles`).toEqual({
    effectPick: false, effectChoice: false, effectOptional: false,
    chooseIntercept: false, leaveIntercept: false,
    setCardChoice: false, setCardReplacement: false, repeatOptional: false,
    hirameki: false, misread: false, deckRevealAwaitingPick: false,
    effectHandReveal: false, deckReorder: false, deckPlace: false, rps: false,
    activeEffects: [],
  });
}

function settled<T>(label: string, result: T): T {
  expectSettled(label);
  return result;
}

function enter(definition: CardDef): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: `enter-${definition.id}`,
  }), `${definition.id}: effect-driven public entry`).toEqual({ ok: true });
  expect(current().players.self.scene.some((entry) => entry.cardId === definition.id), `${definition.id}: entered scene`).toBe(true);
}

function pick(cardId: string): void {
  const pending = useGameStateStore.getState().pendingEffectPick;
  const candidate = pending?.candidates.find((entry) => entry.cardId === cardId);
  expect(candidate, `${cardId}: public effect pick candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function shippuFired(cardId: string): boolean {
  return current().players.self.scene.find((entry) => entry.cardId === cardId)?.turnEffects.shippuFiredCharThisTurn === true;
}

function proveB09070() {
  const state = base(B09070);
  state.players.self.remove.push(ELIGIBLE);
  install(state);
  enter(B09070);
  pick(ELIGIBLE);
  return settled(B09070.id, { cardId: B09070.id, hand: current().players.self.hand, fired: shippuFired(B09070.id) });
}

function proveB09071() {
  install(base(B09071));
  enter(B09071);
  return settled(B09071.id, { cardId: B09071.id, actionTargetsActive: current().players.self.scene.find((entry) => entry.cardId === B09071.id)?.turnEffects.actionTargetsActive, fired: shippuFired(B09071.id) });
}

function proveB09074() {
  install(base(B09074));
  enter(B09074);
  const group = pendingOwnerOrderGroup(current(), 'self');
  const ordered = [...group].sort((left, right) => left.source.abilityId === 'a1' ? -1 : right.source.abilityId === 'a1' ? 1 : 0);
  expect(ordered.map((entry) => entry.source.abilityId), 'B09074: Shippu resolves before the ordinary enter ability').toEqual(['a1', 'a2']);
  expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id) })).toEqual({ ok: true });
  return settled(B09074.id, { cardId: B09074.id, hand: current().players.self.hand, fired: shippuFired(B09074.id) });
}

function proveB09075() {
  const state = base(B09075, '解決編');
  state.players.self.remove.push(ELIGIBLE);
  install(state);
  enter(B09075);
  pick(ELIGIBLE);
  return settled(B09075.id, { cardId: B09075.id, scene: current().players.self.scene.map((entry) => entry.cardId), fired: shippuFired(B09075.id) });
}

function proveB09076() {
  const state = base(B09076);
  state.players.opp.evidence = [
    { cardId: ELIGIBLE, faceUp: false, origin: { turn: 1, via: 'opening' } },
    { cardId: PLAIN, faceUp: false, origin: { turn: 1, via: 'opening' } }, { cardId: DRAW, faceUp: true, origin: { turn: 1, via: 'opening' } },
  ];
  install(state);
  enter(B09076);
  expect(useGameStateStore.getState().pendingEffectPick?.candidates.map((entry) => entry.cardId), 'B09076: only face-down evidence is selectable').toEqual([ELIGIBLE, PLAIN]);
  pick(ELIGIBLE);
  return settled(B09076.id, {
    cardId: B09076.id, evidence: current().players.opp.evidence.map(({ cardId, faceUp }) => [cardId, faceUp]),
    fired: shippuFired(B09076.id),
  });
}

function proveB09084() {
  install(base(B09084, '事件編'));
  enter(B09084);
  return settled(B09084.id, { cardId: B09084.id, keywords: current().players.self.scene.find((entry) => entry.cardId === B09084.id)?.turnEffects.grantedKeywords, fired: shippuFired(B09084.id) });
}

function proveB10070() {
  const state = base(B10070);
  state.players.opp.scene = [sceneChar(ELIGIBLE, 'opp-low')];
  install(state);
  enter(B10070);
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional?.source).toMatchObject({ cardId: B10070.id, abilityId: 'a2' });
  expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });
  pick(ELIGIBLE);
  return settled(B10070.id, {
    cardId: B10070.id,
    state: current().players.self.scene.find((entry) => entry.cardId === B10070.id)?.state,
    removed: current().players.opp.remove,
    fired: shippuFired(B10070.id),
  });
}

function proveEvidence(definition: typeof D11003 | typeof D11004) {
  install(base(definition));
  enter(definition);
  return settled(definition.id, { cardId: definition.id, evidence: current().players.self.evidence.map((entry) => entry.cardId), fired: shippuFired(definition.id) });
}

function proveD11009() {
  const state = base(D11009);
  state.players.opp.scene = [sceneChar(ELIGIBLE, 'opp-target')];
  install(state);
  enter(D11009);
  pick(ELIGIBLE);
  return settled(D11009.id, { cardId: D11009.id, state: current().players.opp.scene[0]?.state, fired: shippuFired(D11009.id) });
}

function proveD11014() {
  const state = base(D11014);
  state.players.opp.scene = [sceneChar(ELIGIBLE, 'opp-target', { apOverride: 500 })];
  install(state);
  enter(D11014);
  pick(ELIGIBLE);
  return settled(D11014.id, {
    cardId: D11014.id,
    apMod: current().players.opp.scene[0]?.turnEffects.apMod_turn,
    ap: readChar.ap(current(), 'opp-target'),
    stillInScene: current().players.opp.scene.some(entry => entry.uid === 'opp-target'),
    targetRemoved: current().players.opp.remove.includes(ELIGIBLE),
    fired: shippuFired(D11014.id),
  });
}

function proveSecondEntryDoesNotFire() {
  const state = base(D11003);
  state.players.self.remove.unshift(PLAIN);
  install(state);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: `enter-${PLAIN}` })).toEqual({ ok: true });
  enter(D11003);
  return settled('second-entry control', { evidence: current().players.self.evidence.length, enterOrder: current().players.self.scene.find((entry) => entry.cardId === D11003.id)?.enterOrderThisTurn, fired: shippuFired(D11003.id) });
}

function proveOpponentTurnOwnerMirror() {
  const state = base(D11003);
  state.turn.player = 'opp';
  state.players.self.scene = [];
  state.players.opp.scene = [sceneChar(ENTRY_SOURCE, ENTRY_SOURCE_UID, { enterOrderThisTurn: undefined })];
  state.players.self.remove = [D11003.id];
  state.players.opp.remove = [];
  state.players.opp.evidence = [];
  state.turnState.self.enterCountThisTurn = 0;
  install(state);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: ENTRY_SOURCE_UID, abilId: enterOpponentD11003.id })).toEqual({ ok: true });
  const entrant = current().players.self.scene.find((entry) => entry.cardId === D11003.id);
  return settled('opponent-turn mirror', {
    ownerEvidence: current().players.self.evidence.map((entry) => entry.cardId),
    otherGotDraw: current().players.opp.evidence.some((entry) => entry.cardId === DRAW),
    fired: entrant?.turnEffects.shippuFiredCharThisTurn === true,
  });
}

function proveCaseGates() {
  const b09075 = base(B09075, '事件編');
  b09075.players.self.remove.push(ELIGIBLE);
  install(b09075);
  enter(B09075);
  const wrongB09075 = {
    fired: shippuFired(B09075.id),
    pending: useGameStateStore.getState().pendingEffectPick !== null,
    eligibleStillRemoved: current().players.self.remove.includes(ELIGIBLE),
  };
  expectSettled('B09075 wrong-case control');

  install(base(B09084, '解決編'));
  enter(B09084);
  const optional = useGameStateStore.getState().pendingEffectOptional;
  const wrongB09084 = {
    fired: shippuFired(B09084.id),
    keywords: current().players.self.scene.find((entry) => entry.cardId === B09084.id)?.turnEffects.grantedKeywords,
    otherEnterAbility: optional?.source.abilityId,
  };
  expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: false }))).toEqual({ ok: true });
  expectSettled('B09084 wrong-case control');
  return { wrongB09075, wrongB09084 };
}

function shippuMatcher(definition: CardDef): unknown {
  return definition.abilities.find((ability) => ability.trigger?.hook === 'enter'
    && ability.trigger.matcherCondition?.kind === 'enterOrderEquals')?.trigger?.matcherCondition;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  register(entrySource);
  register(eligible);
  register(drawCard);
  register(plain);
  register(card('QA_CASE', { kind: 'case' }));
  register(card('QA_OPP_CASE', { kind: 'case' }));
  register(card('QA_FILE', { kind: 'event' }));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null, pendingEffectOptional: null });
});

describe('Shippu triggered by effect-driven scene entry', () => {
  it(`${QA}/${QA_FIRST_ENTRY}: B09070 effect entry fires the real remove-to-hand Shippu`, () => expect(proveB09070()).toEqual({ cardId: 'B09070', hand: [ELIGIBLE], fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: B09071 effect entry grants its real action-target text`, () => expect(proveB09071()).toEqual({ cardId: 'B09071', actionTargetsActive: true, fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: B09074 effect entry fires its real draw Shippu`, () => expect(proveB09074()).toEqual({ cardId: 'B09074', hand: [DRAW], fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: B09075 effect entry fires its real Police re-entry Shippu`, () => expect(proveB09075()).toEqual({ cardId: 'B09075', scene: [ENTRY_SOURCE, 'B09075', ELIGIBLE], fired: true }));
  it(`${QA_FIRST_ENTRY}: B09076 effect entry flips only the selected face-down evidence`, () => expect(proveB09076()).toEqual({
    cardId: 'B09076', evidence: [[ELIGIBLE, true], [PLAIN, false], [DRAW, true]], fired: true,
  }));
  it(`${QA}/${QA_FIRST_ENTRY}: B09084 effect entry grants its real incident assault keyword`, () => expect(proveB09084()).toEqual({ cardId: 'B09084', keywords: ['突撃[事件]'], fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: B10070 effect entry opens and resolves its real optional Shippu`, () => expect(proveB10070()).toEqual({ cardId: 'B10070', state: 'sleep', removed: [ELIGIBLE], fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: D11003 effect entry fires its real evidence gain`, () => expect(proveEvidence(D11003)).toEqual({ cardId: 'D11003', evidence: [DRAW], fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: D11004 effect entry fires its shared real evidence gain`, () => expect(proveEvidence(D11004)).toEqual({ cardId: 'D11004', evidence: [DRAW], fired: true }));
  it(`${QA}: D11009 effect entry opens and resolves its real sleep Shippu`, () => expect(proveD11009()).toEqual({ cardId: 'D11009', state: 'sleep', fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: D11014 effect entry keeps a negative-AP target in scene`, () => expect(proveD11014()).toEqual({
    cardId: 'D11014', apMod: -1000, ap: -500, stillInScene: true, targetRemoved: false, fired: true,
  }));
  it(`${QA}/${QA_FIRST_ENTRY}: effect entry still requires the first self entry of the turn`, () => expect(proveSecondEntryDoesNotFire()).toEqual({ evidence: 0, enterOrder: 2, fired: false }));
  it(`${QA}/${QA_FIRST_ENTRY}: effect entry also fires for the owner during the opponent turn`, () => expect(proveOpponentTurnOwnerMirror()).toEqual({ ownerEvidence: [DRAW], otherGotDraw: false, fired: true }));
  it(`${QA}/${QA_FIRST_ENTRY}: every target CardDef uses the exact first-entry Shippu condition`, () => expect(CARDS.map((definition) => [definition.id, shippuMatcher(definition)])).toEqual(CARDS.map((definition) => [definition.id, { kind: 'enterOrderEquals', n: 1 }])));
  it(`${QA}: case-gated Shippu effects do not fire in the other case status`, () => expect(proveCaseGates()).toEqual({
    wrongB09075: { fired: false, pending: false, eligibleStillRemoved: true },
    wrongB09084: { fired: false, keywords: undefined, otherEnterAbility: 'a2' },
  }));
  it(`${QA}: alternate printings preserve the certified Shippu abilities`, () => expect([
    [B09070P.id, B09070P.abilities, B09070.abilities],
    [B09071P.id, B09071P.abilities, B09071.abilities], [B09071P2.id, B09071P2.abilities, B09071.abilities],
    [B09074P.id, B09074P.abilities, B09074.abilities], [B09074P2.id, B09074P2.abilities, B09074.abilities],
    [B09075P.id, B09075P.abilities, B09075.abilities], [B09076P.id, [B09076P.abilities[0]], [B09076.abilities[0]]],
    [B10070P.id, B10070P.abilities, B10070.abilities],
    [D11010.id, D11010.abilities, D11009.abilities],
  ].every(([, variant, baseAbilities]) => variant === baseAbilities || JSON.stringify(variant) === JSON.stringify(baseAbilities))).toBe(true));
});
