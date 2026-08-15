// qa: card:B02004:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D10023:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:PR173:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B02075:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03113:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B04007:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05091:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05099:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05111:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05058:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B02004 } from '@/cards/ct-p02/B02004';
import { B02075 } from '@/cards/ct-p02/B02075';
import { B03113 } from '@/cards/ct-p03/B03113';
import { B04007 } from '@/cards/ct-p04/B04007';
import { B05058 } from '@/cards/ct-p05/B05058';
import { B05091 } from '@/cards/ct-p05/B05091';
import { B05099 } from '@/cards/ct-p05/B05099';
import { B05111 } from '@/cards/ct-p05/B05111';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D10023 } from '@/cards/ct-d10/D10023';
import { PR173 } from '@/cards/pr-01/PR173';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA_SUFFIX = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const ATTACKER = 'QA_RETRIEVE_ATTACKER';
const VICTIM = 'QA_RETRIEVE_VICTIM';
const KEEP = 'QA_RETRIEVE_KEEP';
const YELLOW_PARTNER = 'QA_YELLOW_PARTNER';
const BLUE_PARTNER = 'QA_BLUE_PARTNER';

const KUDO_MATCH = 'QA_KUDO_MATCH';
const KUDO_DECOY = 'QA_KUDO_DECOY';
const KUDO_EVENT = 'QA_KUDO_EVENT';
const SUZUKI_MATCH = 'QA_SUZUKI_MATCH';
const SUZUKI_DECOY = 'QA_SUZUKI_DECOY';
const SUZUKI_EVENT = 'QA_SUZUKI_EVENT';
const NAGANO_MATCH = 'QA_NAGANO_MATCH';
const NAGANO_DECOY = 'QA_NAGANO_DECOY';
const NAGANO_TRAIT_DECOY = 'QA_NAGANO_TRAIT_DECOY';
const NAGANO_EVENT = 'QA_NAGANO_EVENT';
const CUTIN_MATCH = 'QA_CUTIN_MATCH';
const CUTIN_DECOY = 'QA_CUTIN_DECOY';
const CUTIN_COLOR_DECOY = 'QA_CUTIN_COLOR_DECOY';
const CUTIN_KEYWORD_DECOY = 'QA_CUTIN_KEYWORD_DECOY';
const CUTIN_LEVEL_DECOY = 'QA_CUTIN_LEVEL_DECOY';
const CUTIN_EVENT = 'QA_CUTIN_EVENT';
const SHIRATORI_MATCH = 'QA_SHIRATORI_MATCH';
const SHIRATORI_DECOY = 'QA_SHIRATORI_DECOY';
const SHIRATORI_NAME_DECOY = 'QA_SHIRATORI_NAME_DECOY';
const SHIRATORI_EVENT = 'QA_SHIRATORI_EVENT';
const FURUYA_MATCH = 'QA_FURUYA_MATCH';
const FURUYA_DECOY = 'QA_FURUYA_DECOY';
const FURUYA_NAME_DECOY = 'QA_FURUYA_NAME_DECOY';
const FURUYA_EVENT = 'QA_FURUYA_EVENT';
const POLICE_MATCH = 'QA_POLICE_MATCH';
const POLICE_DECOY = 'QA_POLICE_DECOY';
const POLICE_TRAIT_DECOY = 'QA_POLICE_TRAIT_DECOY';
const POLICE_EVENT = 'QA_POLICE_EVENT';
const VODKA_MATCH = 'QA_VODKA_MATCH';
const VODKA_DECOY = 'QA_VODKA_DECOY';
const VODKA_NAME_DECOY = 'QA_VODKA_NAME_DECOY';
const VODKA_EVENT = 'QA_VODKA_EVENT';

const sourceCards = [B02004, D10023, PR173, B02075, B03113, B04007, B05091, B05099, B05111, B05058] as const;

type FixtureOptions = {
  names?: string[];
  colors?: CardDef['colors'];
  level?: number;
  ap?: number;
  traits?: string[];
  keywords?: string[];
};

function fixtureCard(id: string, options: FixtureOptions = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: options.names ?? [id],
    colors: options.colors ?? ['青'],
    level: options.level ?? 1,
    ap: options.ap ?? 1000,
    lp: 1,
    traits: options.traits ?? [],
    keywords: options.keywords ?? [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function fixtureEvent(id: string, options: FixtureOptions = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'event',
    names: options.names ?? [id],
    colors: options.colors ?? ['青'],
    level: options.level ?? 1,
    traits: options.traits ?? [],
    keywords: options.keywords ?? [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const fixtureCards: CardDef[] = [
  fixtureCard(ATTACKER, { ap: 9000 }),
  fixtureCard(VICTIM),
  fixtureCard(KEEP),
  fixtureCard(YELLOW_PARTNER, { colors: ['黄'] }),
  fixtureCard(BLUE_PARTNER, { colors: ['青'] }),
  fixtureCard(KUDO_MATCH, { names: ['工藤新一'] }),
  fixtureCard(KUDO_DECOY, { names: ['工藤優作'] }),
  fixtureEvent(KUDO_EVENT, { names: ['工藤新一'] }),
  fixtureCard(SUZUKI_MATCH, { traits: ['鈴木財閥'] }),
  fixtureCard(SUZUKI_DECOY, { traits: ['財閥'] }),
  fixtureEvent(SUZUKI_EVENT, { traits: ['鈴木財閥'] }),
  fixtureCard(NAGANO_MATCH, { level: 6, traits: ['長野県警'] }),
  fixtureCard(NAGANO_DECOY, { level: 7, traits: ['長野県警'] }),
  fixtureCard(NAGANO_TRAIT_DECOY, { level: 6, traits: ['警視庁'] }),
  fixtureEvent(NAGANO_EVENT, { level: 6, traits: ['長野県警'] }),
  fixtureCard(CUTIN_MATCH, { names: ['ベルモット'], colors: ['黒'], level: 6, keywords: ['カットイン'] }),
  fixtureCard(CUTIN_DECOY, { names: ['シェリー'], colors: ['黒'], level: 5, keywords: ['カットイン'] }),
  fixtureCard(CUTIN_COLOR_DECOY, { names: ['ベルモット'], colors: ['白'], level: 6, keywords: ['カットイン'] }),
  fixtureCard(CUTIN_KEYWORD_DECOY, { names: ['ベルモット'], colors: ['黒'], level: 6 }),
  fixtureCard(CUTIN_LEVEL_DECOY, { names: ['ベルモット'], colors: ['黒'], level: 7, keywords: ['カットイン'] }),
  fixtureEvent(CUTIN_EVENT, { names: ['ベルモット'], colors: ['黒'], level: 6, keywords: ['カットイン'] }),
  fixtureCard(SHIRATORI_MATCH, { names: ['白鳥任三郎'], level: 6 }),
  fixtureCard(SHIRATORI_DECOY, { names: ['白鳥任三郎'], level: 7 }),
  fixtureCard(SHIRATORI_NAME_DECOY, { names: ['佐藤美和子'], level: 6 }),
  fixtureEvent(SHIRATORI_EVENT, { names: ['白鳥任三郎'], level: 6 }),
  fixtureCard(FURUYA_MATCH, { names: ['降谷零'], level: 6 }),
  fixtureCard(FURUYA_DECOY, { names: ['降谷零'], level: 7 }),
  fixtureCard(FURUYA_NAME_DECOY, { names: ['風見裕也'], level: 6 }),
  fixtureEvent(FURUYA_EVENT, { names: ['降谷零'], level: 6 }),
  fixtureCard(POLICE_MATCH, { level: 4, traits: ['警察'] }),
  fixtureCard(POLICE_DECOY, { level: 5, traits: ['警察'] }),
  fixtureCard(POLICE_TRAIT_DECOY, { level: 4, traits: ['探偵'] }),
  fixtureEvent(POLICE_EVENT, { level: 4, traits: ['警察'] }),
  fixtureCard(VODKA_MATCH, { names: ['ウォッカ'], level: 5 }),
  fixtureCard(VODKA_DECOY, { names: ['ウォッカ'], level: 6 }),
  fixtureCard(VODKA_NAME_DECOY, { names: ['ジン'], level: 5 }),
  fixtureEvent(VODKA_EVENT, { names: ['ウォッカ'], level: 5 }),
];

type RetrievalCase = {
  card: CardDef;
  abilityId: string;
  matchId: string;
  decoyId: string;
  kindDecoyId: string;
  extraDecoyIds?: string[];
  atomVerb: 'handAddFromRemove' | 'sceneEnter';
  destination: 'hand' | 'scene';
  enterState?: 'active' | 'sleep';
};

function qa(card: CardDef): string {
  return `card:${card.id}:${QA_SUFFIX}`;
}

function restartSession(player: Player): void {
  endMatchSession();
  beginMatchSession(player);
}

function stateFor(spec: RetrievalCase, turn: Player, partnerCardId = YELLOW_PARTNER): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: spec.card.id, uid: 'source', state: 'sleep' }),
    makeChar({ cardId: VICTIM, uid: 'victim', state: 'active' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
  ];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.remove = [
    spec.matchId,
    spec.decoyId,
    ...(spec.extraDecoyIds ?? []),
    spec.kindDecoyId,
    spec.matchId,
  ];
  state.players.self.hand = [KEEP];
  state.players.self.partner.cardId = partnerCardId;
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function removeSourceThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function expectLeaveTrigger(spec: RetrievalCase): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === spec.card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === spec.abilityId
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${spec.card.id}: exact leave trigger provenance`).toMatchObject({
    source: { cardId: spec.card.id, uid: 'source', abilityId: spec.abilityId, player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function pendingFor(spec: RetrievalCase) {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${spec.card.id}: public retrieval decision`).toMatchObject({
    atomVerb: spec.atomVerb,
    nMin: 0,
    nMax: 1,
    source: { cardId: spec.card.id, abilityId: spec.abilityId },
  });
  expect(pending!.candidates.map((candidate) => candidate.cardId), `${spec.card.id}: two eligible physical matches only`).toEqual([
    spec.matchId,
    spec.matchId,
  ]);
  return pending!;
}

function resolvePick(spec: RetrievalCase, pickedUid: string | null): void {
  const pending = pendingFor(spec);
  const matching = pending.candidates.filter((candidate) => candidate.cardId === pickedUid);
  const resolvedUid = pickedUid === null ? null : matching.at(-1)?.uid;
  if (pickedUid === null) expect(resolvedUid, `${spec.card.id}: public decline`).toBeNull();
  else {
    expect(matching, `${spec.card.id}: duplicate physical candidates have distinct authority`).toHaveLength(2);
    expect(matching[1]!.uid, `${spec.card.id}: select non-first occurrence by UID`).not.toBe(matching[0]!.uid);
  }
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: resolvedUid ?? null,
  }))).toEqual({ ok: true });
}

function expectSettled(spec: RetrievalCase): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${spec.card.id}: public action terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${spec.card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingEffectOptional, `${spec.card.id}: no unresolved optional`).toBeNull();
  expect(store.pendingEffectChoice, `${spec.card.id}: no unresolved choice`).toBeNull();
  expect(store.activeActionId, `${spec.card.id}: no open action`).toBeNull();
  expect(Object.keys(current().actionContexts ?? {}), `${spec.card.id}: no retained action context`).toEqual([]);
}

function provePositive(spec: RetrievalCase): unknown {
  restartSession('self');
  install(stateFor(spec, 'opp'));
  removeSourceThroughPublicContact();
  expectLeaveTrigger(spec);
  resolvePick(spec, spec.matchId);
  expectSettled(spec);
  const state = current();
  const entered = state.players.self.scene.find((char) => char.cardId === spec.matchId);
  return {
    hand: [...state.players.self.hand],
    entered: entered ? { cardId: entered.cardId, state: entered.state } : null,
    remove: [...state.players.self.remove],
    matchOccurrences: [
      ...state.players.self.hand,
      ...state.players.self.remove,
      ...state.players.self.scene.map((char) => char.cardId),
    ].filter((cardId) => cardId === spec.matchId).length,
  };
}

function proveDecline(spec: RetrievalCase): unknown {
  restartSession('self');
  install(stateFor(spec, 'opp'));
  removeSourceThroughPublicContact();
  expectLeaveTrigger(spec);
  resolvePick(spec, null);
  expectSettled(spec);
  const state = current();
  return {
    hand: [...state.players.self.hand],
    sceneHasMatch: state.players.self.scene.some((char) => char.cardId === spec.matchId),
    remove: [...state.players.self.remove],
  };
}

function proveSelfTurnNoTrigger(spec: RetrievalCase): unknown {
  restartSession('self');
  install(stateFor(spec, 'self'));
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = pending!.candidates.find((candidate) => candidate.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  const state = current();
  return {
    sourceInRemove: state.players.self.remove.filter((cardId) => cardId === spec.card.id).length,
    remove: [...state.players.self.remove],
    triggerCount: state.pendingEffects.filter((entry) => (
      entry.source.cardId === spec.card.id
        && entry.source.abilityId === spec.abilityId
        && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
    pendingPick: useGameStateStore.getState().pendingEffectPick,
  };
}

function proveOtherCharacterLeavesNoTrigger(spec: RetrievalCase): unknown {
  restartSession('self');
  const state = stateFor(spec, 'opp');
  state.players.self.scene.find((char) => char.uid === 'victim')!.state = 'sleep';
  install(state);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'victim' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expectSettled(spec);
  return {
    sourceStillOnScene: current().players.self.scene.some((char) => char.uid === 'source'),
    victimInRemove: current().players.self.remove.includes(VICTIM),
    triggerCount: current().pendingEffects.filter((entry) => (
      entry.source.cardId === spec.card.id
        && entry.source.abilityId === spec.abilityId
        && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
    pendingPick: useGameStateStore.getState().pendingEffectPick,
  };
}

function proveRetrieval(spec: RetrievalCase): unknown {
  return {
    positive: provePositive(spec),
    decline: proveDecline(spec),
    selfTurn: proveSelfTurnNoTrigger(spec),
    otherLeaves: proveOtherCharacterLeavesNoTrigger(spec),
  };
}

function expectedProof(spec: RetrievalCase): unknown {
  return {
    positive: {
      hand: spec.destination === 'hand' ? [KEEP, spec.matchId] : [KEEP],
      entered: spec.destination === 'scene' ? { cardId: spec.matchId, state: spec.enterState } : null,
      remove: [spec.matchId, spec.decoyId, ...(spec.extraDecoyIds ?? []), spec.kindDecoyId, spec.card.id],
      matchOccurrences: 2,
    },
    decline: {
      hand: [KEEP],
      sceneHasMatch: false,
      remove: [spec.matchId, spec.decoyId, ...(spec.extraDecoyIds ?? []), spec.kindDecoyId, spec.matchId, spec.card.id],
    },
    selfTurn: {
      sourceInRemove: 1,
      remove: [spec.matchId, spec.decoyId, ...(spec.extraDecoyIds ?? []), spec.kindDecoyId, spec.matchId, spec.card.id],
      triggerCount: 0,
      pendingPick: null,
    },
    otherLeaves: {
      sourceStillOnScene: true,
      victimInRemove: true,
      triggerCount: 0,
      pendingPick: null,
    },
  };
}

const B02004_CASE: RetrievalCase = { card: B02004, abilityId: 'a2', matchId: KUDO_MATCH, decoyId: KUDO_DECOY, kindDecoyId: KUDO_EVENT, atomVerb: 'handAddFromRemove', destination: 'hand' };
const D10023_CASE: RetrievalCase = { ...B02004_CASE, card: D10023 };
const PR173_CASE: RetrievalCase = { ...B02004_CASE, card: PR173 };
const B05058_CASE: RetrievalCase = { card: B05058, abilityId: 'a2', matchId: SUZUKI_MATCH, decoyId: SUZUKI_DECOY, kindDecoyId: SUZUKI_EVENT, atomVerb: 'handAddFromRemove', destination: 'hand' };
const B02075_CASE: RetrievalCase = { card: B02075, abilityId: 'a1', matchId: NAGANO_MATCH, decoyId: NAGANO_DECOY, kindDecoyId: NAGANO_EVENT, extraDecoyIds: [NAGANO_TRAIT_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'sleep' };
const B03113_CASE: RetrievalCase = { card: B03113, abilityId: 'a1', matchId: CUTIN_MATCH, decoyId: CUTIN_DECOY, kindDecoyId: CUTIN_EVENT, extraDecoyIds: [CUTIN_COLOR_DECOY, CUTIN_KEYWORD_DECOY, CUTIN_LEVEL_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'sleep' };
const B04007_CASE: RetrievalCase = { card: B04007, abilityId: 'a1', matchId: SHIRATORI_MATCH, decoyId: SHIRATORI_DECOY, kindDecoyId: SHIRATORI_EVENT, extraDecoyIds: [SHIRATORI_NAME_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'sleep' };
const B05091_CASE: RetrievalCase = { card: B05091, abilityId: 'a2', matchId: FURUYA_MATCH, decoyId: FURUYA_DECOY, kindDecoyId: FURUYA_EVENT, extraDecoyIds: [FURUYA_NAME_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'sleep' };
const B05099_CASE: RetrievalCase = { card: B05099, abilityId: 'a1', matchId: POLICE_MATCH, decoyId: POLICE_DECOY, kindDecoyId: POLICE_EVENT, extraDecoyIds: [POLICE_TRAIT_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'sleep' };
const B05111_CASE: RetrievalCase = { card: B05111, abilityId: 'a1', matchId: VODKA_MATCH, decoyId: VODKA_DECOY, kindDecoyId: VODKA_EVENT, extraDecoyIds: [VODKA_NAME_DECOY], atomVerb: 'sceneEnter', destination: 'scene', enterState: 'active' };

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [...sourceCards, B10022, ...fixtureCards].forEach(register);
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('opponent-turn leave retrieves exact remove occurrence through public dispatch', () => {
  it(qa(B02004), () => {
    expect(proveRetrieval(B02004_CASE), `${B02004.id}: exact Kudo occurrence to hand; decline and self-turn preserve remove`).toEqual(expectedProof(B02004_CASE));
  });

  it(qa(D10023), () => {
    expect(proveRetrieval(D10023_CASE), `${D10023.id}: clone independently uses exact Kudo occurrence`).toEqual(expectedProof(D10023_CASE));
  });

  it(qa(PR173), () => {
    expect(proveRetrieval(PR173_CASE), `${PR173.id}: promo independently uses exact Kudo occurrence`).toEqual(expectedProof(PR173_CASE));
  });

  it(qa(B05058), () => {
    expect(proveRetrieval(B05058_CASE), `${B05058.id}: Suzuki-trait match only moves to hand`).toEqual(expectedProof(B05058_CASE));
  });

  it(qa(B02075), () => {
    expect(proveRetrieval(B02075_CASE), `${B02075.id}: eligible Nagano character enters sleeping`).toEqual(expectedProof(B02075_CASE));
  });

  it(qa(B03113), () => {
    expect(proveRetrieval(B03113_CASE), `${B03113.id}: black Cut-in match enters; Sherry decoy stays removed`).toEqual(expectedProof(B03113_CASE));
  });

  it(qa(B04007), () => {
    expect(proveRetrieval(B04007_CASE), `${B04007.id}: eligible Shiratori enters sleeping`).toEqual(expectedProof(B04007_CASE));
  });

  it(qa(B05091), () => {
    expect(proveRetrieval(B05091_CASE), `${B05091.id}: eligible Furuya enters sleeping`).toEqual(expectedProof(B05091_CASE));
  });

  it(qa(B05099), () => {
    const proof = proveRetrieval(B05099_CASE);
    restartSession('self');
    install(stateFor(B05099_CASE, 'opp', BLUE_PARTNER));
    removeSourceThroughPublicContact();
    const wrongPartner = {
      sourceInRemove: current().players.self.remove.includes(B05099.id),
      matchInRemove: current().players.self.remove.includes(POLICE_MATCH),
      triggerCount: current().pendingEffects.filter((entry) => entry.source.cardId === B05099.id).length,
      pendingPick: useGameStateStore.getState().pendingEffectPick,
    };
    expect({ proof, wrongPartner }, `${B05099.id}: yellow-partner gate and sleeping Police entry`).toEqual({
      proof: expectedProof(B05099_CASE),
      wrongPartner: { sourceInRemove: true, matchInRemove: true, triggerCount: 0, pendingPick: null },
    });
  });

  it(qa(B05111), () => {
    expect(proveRetrieval(B05111_CASE), `${B05111.id}: eligible Vodka enters active`).toEqual(expectedProof(B05111_CASE));
  });
});
