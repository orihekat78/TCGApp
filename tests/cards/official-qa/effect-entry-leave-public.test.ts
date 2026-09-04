// qa: card:B02066:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B03012:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04007:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B04022:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B05099:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B07075:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 15-abilities-effects.md, 17-icons.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02066 } from '@/cards/ct-p02/B02066';
import { B02066P } from '@/cards/ct-p02/B02066P';
import { B03012 } from '@/cards/ct-p03/B03012';
import { B04007 } from '@/cards/ct-p04/B04007';
import { B04022 } from '@/cards/ct-p04/B04022';
import { B04022P } from '@/cards/ct-p04/B04022P';
import { B05099 } from '@/cards/ct-p05/B05099';
import { B05099P } from '@/cards/ct-p05/B05099P';
import { B07075 } from '@/cards/ct-p07/B07075';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa';
const ATTACKER = 'QA_ENTRY_LEAVE_ATTACKER';
const DRAW = 'QA_ENTRY_LEAVE_DRAW';
const FILLER = 'QA_ENTRY_LEAVE_FILLER';
const YELLOW_PARTNER = 'QA_ENTRY_LEAVE_YELLOW_PARTNER';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const MARY = character('QA_ENTRY_MARY', { names: ['メアリー'], level: 5, abilities: [enterDraw] });
const KUDO = character('QA_ENTRY_KUDO', { names: ['工藤新一'], level: 6, abilities: [enterDraw] });
const SHIRATORI = character('QA_ENTRY_SHIRATORI', { names: ['白鳥任三郎'], level: 6, abilities: [enterDraw] });
const HATTORI = character('QA_ENTRY_HATTORI', { names: ['服部平次'], level: 4, abilities: [enterDraw] });
const POLICE = character('QA_ENTRY_POLICE', { traits: ['警察'], level: 4, abilities: [enterDraw] });
const SHERRY = character('QA_ENTRY_SHERRY', { names: ['シェリー'], level: 5, abilities: [enterDraw] });

const MARY_DECOY = character('QA_ENTRY_MARY_DECOY', { names: ['メアリー'], level: 6 });
const KUDO_DECOY = character('QA_ENTRY_KUDO_DECOY', { names: ['工藤新一'], level: 7 });
const SHIRATORI_DECOY = character('QA_ENTRY_SHIRATORI_DECOY', { names: ['白鳥任三郎'], level: 7 });
const HATTORI_DECOY = character('QA_ENTRY_HATTORI_DECOY', { names: ['服部平次'], level: 5 });
const POLICE_DECOY = character('QA_ENTRY_POLICE_DECOY', { traits: ['警察'], level: 5 });
const SHERRY_DECOY = character('QA_ENTRY_SHERRY_DECOY', { names: ['シェリー'], level: 6 });

const fixtures: CardDef[] = [
  character(ATTACKER, { level: 8, ap: 10000 }), character(DRAW), character(FILLER),
  { ...character(YELLOW_PARTNER, { colors: ['黄'] }), kind: 'partner', ap: undefined, lp: undefined },
  MARY, KUDO, SHIRATORI, HATTORI, POLICE, SHERRY,
  MARY_DECOY, KUDO_DECOY, SHIRATORI_DECOY, HATTORI_DECOY, POLICE_DECOY, SHERRY_DECOY,
];

type LeaveEntryCase = {
  source: CardDef;
  abilityId: string;
  target: CardDef;
  decoy: CardDef;
  from: 'hand' | 'remove';
  enteredState: 'active' | 'sleep';
  parallel?: CardDef;
  yellowPartner?: boolean;
};

const CASES: Record<string, LeaveEntryCase> = {
  B02066: { source: B02066, abilityId: 'a2', target: MARY, decoy: MARY_DECOY, from: 'remove', enteredState: 'sleep', parallel: B02066P },
  B03012: { source: B03012, abilityId: 'a1', target: KUDO, decoy: KUDO_DECOY, from: 'hand', enteredState: 'active' },
  B04007: { source: B04007, abilityId: 'a1', target: SHIRATORI, decoy: SHIRATORI_DECOY, from: 'remove', enteredState: 'sleep' },
  B04022: { source: B04022, abilityId: 'a1', target: HATTORI, decoy: HATTORI_DECOY, from: 'hand', enteredState: 'sleep', parallel: B04022P },
  B05099: { source: B05099, abilityId: 'a1', target: POLICE, decoy: POLICE_DECOY, from: 'remove', enteredState: 'sleep', parallel: B05099P, yellowPartner: true },
  B07075: { source: B07075, abilityId: 'a1', target: SHERRY, decoy: SHERRY_DECOY, from: 'hand', enteredState: 'sleep' },
};

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(spec: LeaveEntryCase): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ cardId: spec.source.id, uid: 'source', state: 'sleep' })];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.deck = [DRAW, FILLER];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  if (spec.yellowPartner) state.players.self.partner = { cardId: YELLOW_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self[spec.from] = [spec.target.id, spec.decoy.id];
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-effect-entry-leave-${spec.source.id}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
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

function finishAction(sourceId: string): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${sourceId}: terminal advance`).toEqual({ ok: true });
  }
}

function prove(spec: LeaveEntryCase): unknown {
  install(spec);
  removeSourceThroughPublicContact();
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${spec.source.id}: exact leave-entry authority`).toMatchObject({
    player: 'self', atomVerb: 'sceneEnter', nMin: 0, nMax: 1,
    source: { cardId: spec.source.id, uid: 'source', abilityId: spec.abilityId },
  });
  const target = pending!.candidates.find((candidate) => candidate.cardId === spec.target.id);
  expect(target, `${spec.source.id}: eligible entered card`).toBeTruthy();
  expect(pending!.candidates.some((candidate) => candidate.cardId === spec.decoy.id), `${spec.source.id}: invalid level excluded`).toBe(false);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: target!.uid,
  }))).toEqual({ ok: true });
  finishAction(spec.source.id);

  const state = current();
  const entered = state.players.self.scene.find((char) => char.cardId === spec.target.id);
  const actions = state.log.map((entry) => entry.action);
  const store = useGameStateStore.getState();
  return {
    sourceInRemove: state.players.self.remove.includes(spec.source.id),
    entered: { cardId: entered?.cardId, state: entered?.state },
    enterAbilityDrew: state.players.self.hand.includes(DRAW),
    orderedAfterEntry: actions.lastIndexOf('effect:draw') > actions.lastIndexOf('effect:sceneEnter'),
    originRetainsDecoy: state.players.self[spec.from].includes(spec.decoy.id),
    originReleasedTarget: !state.players.self[spec.from].includes(spec.target.id),
    sourceEffectsSettled: state.pendingEffects.filter((entry) => entry.source.cardId === spec.source.id && entry.state !== 'resolved').length,
    allEffectsSettled: state.pendingEffects.every((entry) => entry.state === 'resolved'),
    pending: [store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice],
    activeAction: store.activeActionId,
    runtime: state.pendingRuntimeState,
    parallel: spec.parallel ? spec.parallel.abilities : spec.source.abilities,
  };
}

function expected(spec: LeaveEntryCase): unknown {
  return {
    sourceInRemove: true,
    entered: { cardId: spec.target.id, state: spec.enteredState },
    enterAbilityDrew: true,
    orderedAfterEntry: true,
    originRetainsDecoy: true,
    originReleasedTarget: true,
    sourceEffectsSettled: 0,
    allEffectsSettled: true,
    pending: [null, null, null],
    activeAction: null,
    runtime: undefined,
    parallel: spec.source.abilities,
  };
}

function proveSharedDecline(): void {
  const spec = CASES.B02066!;
  install(spec);
  removeSourceThroughPublicContact();
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, 'B02066: optional leave-entry authority').toMatchObject({
    player: 'self', atomVerb: 'sceneEnter', nMin: 0, nMax: 1,
    source: { cardId: B02066.id, uid: 'source', abilityId: 'a2' },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  finishAction(B02066.id);

  const state = current();
  const store = useGameStateStore.getState();
  expect(state.players.self.remove).toEqual(expect.arrayContaining([B02066.id, spec.target.id, spec.decoy.id]));
  expect(state.players.self.scene.some((char) => char.cardId === spec.target.id)).toBe(false);
  expect(state.players.self.deck).toEqual([DRAW, FILLER]);
  expect(state.log.map((entry) => entry.action)).not.toContain('effect:sceneEnter');
  expect(state.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
  expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice]).toEqual([null, null, null]);
  expect(store.activeActionId).toBeNull();
  expect(state.pendingRuntimeState).toBeUndefined();
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('effect entry official Q&A — opponent-turn leave effects fire enter abilities', () => {
  it(`card:B02066:${QA}`, () => expect(prove(CASES.B02066!), 'B02066 public leave enters Mary and fires her enter ability').toEqual(expected(CASES.B02066!)));
  it(`card:B03012:${QA}`, () => expect(prove(CASES.B03012!), 'B03012 public leave enters Kudo and fires his enter ability').toEqual(expected(CASES.B03012!)));
  it(`card:B04007:${QA}`, () => expect(prove(CASES.B04007!), 'B04007 public leave enters Shiratori and fires his enter ability').toEqual(expected(CASES.B04007!)));
  it(`card:B04022:${QA}`, () => expect(prove(CASES.B04022!), 'B04022 public leave enters Hattori and fires his enter ability').toEqual(expected(CASES.B04022!)));
  it(`card:B05099:${QA}`, () => expect(prove(CASES.B05099!), 'B05099 public leave enters Police and fires its enter ability').toEqual(expected(CASES.B05099!)));
  it(`card:B07075:${QA}`, () => expect(prove(CASES.B07075!), 'B07075 public leave enters Sherry and fires her enter ability').toEqual(expected(CASES.B07075!)));
  it('shared optional-decline guard settles without entering a character', proveSharedDecline);
});
