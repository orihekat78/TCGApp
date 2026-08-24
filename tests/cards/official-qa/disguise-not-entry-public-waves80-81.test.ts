// qa: card:B02038:768a20fc5e6e165184d999a8032847d4633ef46d0ac9edd814f3c4ebb18e8e72
// qa: card:B02044:768a20fc5e6e165184d999a8032847d4633ef46d0ac9edd814f3c4ebb18e8e72
// qa: card:B02086:768a20fc5e6e165184d999a8032847d4633ef46d0ac9edd814f3c4ebb18e8e72
// qa: card:B02043:14a8ef526b9ef00574961cab066ef5e035dbbeb7f94728142ad18aaa7e3fc498
// qa: card:B02045:14a8ef526b9ef00574961cab066ef5e035dbbeb7f94728142ad18aaa7e3fc498
// qa: card:B02047:14a8ef526b9ef00574961cab066ef5e035dbbeb7f94728142ad18aaa7e3fc498
// qa: card:B03050:14a8ef526b9ef00574961cab066ef5e035dbbeb7f94728142ad18aaa7e3fc498
// Rules: 08-contact, 09-cutin-disguise, 15-abilities-effects, 17-icons,
// 23-qa-disguise-cutin.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const OLD_WHITE = 'W80-OLD-WHITE';
const OLD_SERA = 'W81-OLD-SERA';
const CONTACT_TARGET = 'W80-CONTACT-TARGET';
const CONTACT_TARGET_TWO = 'W80-CONTACT-TARGET-TWO';
const WHITE_LOW = 'W80-WHITE-LOW';
const ENTRY_TARGET = 'W80-ENTRY-TARGET';
const DECK_DECOY = 'W80-DECK-DECOY';
const DECK_TAIL = 'W80-DECK-TAIL';
const WHITE_CASE = 'W80-WHITE-CASE';
const RED_CASE = 'W81-RED-CASE';
const BLACK_CASE = 'W80-BLACK-CASE';
const WHITE_PARTNER = 'W80-WHITE-PARTNER';
const FILE_CARD = 'W80-FILE';
const COST_A = 'W80-COST-A';
const COST_B = 'W80-COST-B';
const OLD_INVALID = 'W81-OLD-INVALID';
const ENTER_OBSERVER = 'W80-ENTER-OBSERVER';
const ACTOR_UID = 'wave80-actor';
const TARGET_UID = 'wave80-target';

type Row = {
  cardId:
    | 'B02038' | 'B02038P' | 'B02041' | 'B02041P' | 'B02044' | 'B02044P'
    | 'B02086' | 'B02086P' | 'B02043' | 'B02045' | 'B02047' | 'B03050';
  file: number;
  caseId: string;
  disguiseAbility?: string;
  enterAbility?: string;
  replacedCardId?: string;
  opponentTurn?: boolean;
};

const WAVE80_TARGETS: Row[] = [
  { cardId: 'B02038', file: 6, caseId: WHITE_CASE, disguiseAbility: 'a1', enterAbility: 'a2' },
  { cardId: 'B02038P', file: 6, caseId: WHITE_CASE, disguiseAbility: 'a1', enterAbility: 'a2' },
  { cardId: 'B02044', file: 4, caseId: WHITE_CASE, disguiseAbility: 'a2', enterAbility: 'a1' },
  { cardId: 'B02044P', file: 4, caseId: WHITE_CASE, disguiseAbility: 'a2', enterAbility: 'a1' },
  { cardId: 'B02086', file: 5, caseId: BLACK_CASE, disguiseAbility: 'a2', enterAbility: 'a3' },
  { cardId: 'B02086P', file: 5, caseId: BLACK_CASE, disguiseAbility: 'a2', enterAbility: 'a3' },
];

const WAVE80_CONTROL: Row[] = [
  { cardId: 'B02041', file: 6, caseId: WHITE_CASE, disguiseAbility: 'a2', enterAbility: 'a1' },
  { cardId: 'B02041P', file: 6, caseId: WHITE_CASE, disguiseAbility: 'a2', enterAbility: 'a1' },
];

const WAVE81_TARGETS: Row[] = [
  { cardId: 'B02043', file: 5, caseId: WHITE_CASE },
  { cardId: 'B02045', file: 4, caseId: WHITE_CASE, disguiseAbility: 'a2' },
  { cardId: 'B02047', file: 6, caseId: WHITE_CASE, disguiseAbility: 'a2' },
  {
    cardId: 'B03050', file: 5, caseId: RED_CASE, disguiseAbility: 'a2',
    replacedCardId: OLD_SERA, opponentTurn: true,
  },
];

const DISGUISE_ROWS = [...WAVE80_TARGETS, ...WAVE80_CONTROL, ...WAVE81_TARGETS];

const enterObserver: CardDef = fixture(ENTER_OBSERVER, {
  abilities: [{
    id: 'observe-enter', type: 'triggered', scope: 'on-scene',
    trigger: {
      hook: 'enter',
      matcherCondition: {
        kind: 'triggerCharMatches', side: 'self', excludeSource: true,
        payloadKey: 'uid', filter: { kind: 'character' },
      },
    },
    effect: {
      kind: 'atom', verb: 'charSetTurnEffect',
      args: { uid: '$self', key: 'externalEnterObserved_turn', val: true },
    },
    description: '別の自分のキャラが登場したとき、観測する。', ruleRefs: [],
  } as never],
});

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3,
    ap: 3000, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Waves80-81 state');
  return state;
}

function fileCards(count: number) {
  return Array.from({ length: count }, () => ({ type: 'card-back' as const, cardId: FILE_CARD }));
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function contactState(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  const turnPlayer = row.opponentTurn ? other(owner) : owner;
  state.turn = { number: 22, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  const caseDef = [WHITE_CASE, RED_CASE, BLACK_CASE].map(id => ({ id, def: fixture(id) }))
    .find(item => item.id === row.caseId)!.def;
  caseDef.colors = row.caseId === RED_CASE ? ['赤'] : row.caseId === BLACK_CASE ? ['黒'] : ['白'];
  state.players[owner].case = {
    ...state.players[owner].case, cardId: row.caseId, colors: [...caseDef.colors],
  };
  state.players[owner].partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(row.file);
  state.players[owner].hand = [row.cardId];
  state.players[owner].deck = [DECK_TAIL, DECK_TAIL, DECK_TAIL];
  const actorCardId = row.replacedCardId ?? OLD_WHITE;
  state.players[owner].scene = [
    sceneChar(actorCardId, ACTOR_UID, { state: row.opponentTurn ? 'sleep' : 'active' }),
    sceneChar(ENTER_OBSERVER, `${owner}-enter-observer`),
  ];
  state.players[other(owner)].scene = [sceneChar(CONTACT_TARGET, TARGET_UID, {
    state: row.opponentTurn ? 'active' : 'sleep',
  })];
  state.players[other(owner)].deck = [DECK_TAIL, DECK_TAIL];
  return state;
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(card => card.uid === uid) ? 'self' : 'opp';
}

function reachOwnerContactWindow(row: Row, owner: Player): string {
  const byUid = row.opponentTurn ? TARGET_UID : ACTOR_UID;
  const targetUid = row.opponentTurn ? ACTOR_UID : TARGET_UID;
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid, targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 14; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('contact ended before disguise window');
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      if (player === owner && actingUid === ACTOR_UID) return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('owner disguise window not reached');
}

function disguisePublicly(row: Row, owner: Player): string {
  const actionId = reachOwnerContactWindow(row, owner);
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: owner,
    choice: { kind: 'disguise', cardId: row.cardId },
  })).toEqual({ ok: true });
  return actionId;
}

function finishAction(actionId: string): void {
  for (let step = 0; step < 24 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) break;
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const acted = context.phase === 'action-1'
        ? context.firstActed
        : context.phase === 'action-2'
          ? context.secondActed
          : context.firstRedoActed;
      if (acted !== undefined) {
        expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
        continue;
      }
      const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: ownerOf(uid!), choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (context.phase === 'judge') {
      expect(dispatchEngineAction(context.judgeResolved === true
        ? { type: 'actionAdvance', actionId }
        : { type: 'actionJudge', actionId })).toEqual({ ok: true });
    } else {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function entryState(row: Row, owner: Player, withObserver = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 24, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = row.caseId === BLACK_CASE ? ['黒'] : ['白'];
  state.players[owner].partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(8);
  state.players[owner].hand = [row.cardId];
  state.players[owner].deck = ['B02043', DECK_DECOY, DECK_TAIL];
  state.players[owner].remove = [WHITE_LOW];
  state.players[owner].scene = [
    sceneChar(ENTRY_TARGET, `${owner}-entry-target`),
    ...(withObserver ? [sceneChar(ENTER_OBSERVER, `${owner}-enter-observer`)] : []),
  ];
  state.players[other(owner)].deck = [DECK_TAIL, DECK_TAIL];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(OLD_WHITE, { names: ['変装元'], colors: ['白'], ap: 1000, lp: 2 }),
    fixture(OLD_SERA, { names: ['世良真純'], colors: ['赤'], ap: 1000, lp: 2 }),
    fixture(OLD_INVALID, { names: ['不適格変装元'], colors: ['青'], ap: 1000, lp: 1 }),
    fixture(CONTACT_TARGET, { colors: ['青'], ap: 9000 }),
    fixture(CONTACT_TARGET_TWO, { colors: ['青'], ap: 9000 }),
    fixture(WHITE_LOW, { colors: ['白'], level: 4 }),
    fixture(ENTRY_TARGET, { colors: ['赤'], names: ['対象'] }),
    fixture(DECK_DECOY, { colors: ['青'] }), fixture(DECK_TAIL), fixture(FILE_CARD),
    fixture(COST_A), fixture(COST_B),
    fixture(WHITE_CASE, { kind: 'case', colors: ['白'], caseLevel: 7, caseTraits: [] }),
    fixture(RED_CASE, { kind: 'case', colors: ['赤'], caseLevel: 7, caseTraits: [] }),
    fixture(BLACK_CASE, { kind: 'case', colors: ['黒'], caseLevel: 7, caseTraits: [] }),
    fixture(WHITE_PARTNER, { kind: 'partner', colors: ['白'], level: 0, lp: 5 }),
    enterObserver,
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Waves80-81: disguise is not entry', () => {
  it.each(DISGUISE_ROWS)('$cardId public disguise emits only its disguise rider', (row) => {
    install(contactState(row, 'self'), `${row.cardId}:waves80-81-disguise`, 'self');
    disguisePublicly(row, 'self');
    const sourceHooks = current().pendingEffects
      .filter(effect => effect.source.cardId === row.cardId)
      .map(effect => ({ hook: effect.triggeredBy.hook, abilityId: effect.source.abilityId }));
    // Card-bound targets: B02038/P, B02044/P, B02086/P, B02043, B02045, B02047, B03050.
    expect(sourceHooks).toEqual(row.disguiseAbility
      ? [{ hook: 'disguise:into', abilityId: row.disguiseAbility }]
      : []);
    expect(current().pendingEffects.some(effect => (
      effect.source.cardId === row.cardId && effect.triggeredBy.hook === 'enter'
    ))).toBe(false);
    expect(current().pendingEffects.some(effect => (
      effect.source.cardId === ENTER_OBSERVER && effect.triggeredBy.hook === 'enter'
    ))).toBe(false);
    expect(current().players.self.scene.find(card => card.cardId === ENTER_OBSERVER)
      ?.turnEffects.externalEnterObserved_turn).not.toBe(true);
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(row.cardId);
    expect(current().players.self.deck.at(-1)).toBe(row.replacedCardId ?? OLD_WHITE);
  });

  it.each([...WAVE80_TARGETS, ...WAVE80_CONTROL])(
    '$cardId public hand entry emits only its enter rider',
    (row) => {
      install(entryState(row, 'self'), `${row.cardId}:wave80-entry`, 'self');
      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: row.cardId }))
        .toEqual({ ok: true });
      const sourceHooks = current().pendingEffects
        .filter(effect => effect.source.cardId === row.cardId)
        .map(effect => ({ hook: effect.triggeredBy.hook, abilityId: effect.source.abilityId }));
      // Card-bound Wave80 targets and matched B02041/P control.
      expect(sourceHooks).toEqual([{ hook: 'enter', abilityId: row.enterAbility }]);
      expect(current().pendingEffects.some(effect => (
        effect.source.cardId === row.cardId && effect.triggeredBy.hook === 'disguise:into'
      ))).toBe(false);
      expect(current().pendingEffects.some(effect => (
        effect.source.cardId === ENTER_OBSERVER && effect.triggeredBy.hook === 'enter'
      ))).toBe(true);
      expect(current().players.self.scene.some(card => card.cardId === row.cardId)).toBe(true);
    },
  );

  it.each([...WAVE80_TARGETS.filter(row => !row.cardId.endsWith('P')), ...WAVE81_TARGETS])(
    '$cardId preserves hook separation for owner=opp',
    (row) => {
      install(contactState(row, 'opp'), `${row.cardId}:waves80-81-opp`, 'opp');
      disguisePublicly(row, 'opp');
      expect(current().pendingEffects.some(effect => (
        effect.source.cardId === row.cardId && effect.triggeredBy.hook === 'enter'
      ))).toBe(false);
      expect(current().players.opp.scene.find(card => card.cardId === ENTER_OBSERVER)
        ?.turnEffects.externalEnterObserved_turn).not.toBe(true);
      expect(current().players.opp.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(row.cardId);
      expect(current().players.self.scene[0]?.cardId).toBe(CONTACT_TARGET);
    },
  );

  it.each(WAVE81_TARGETS)(
    '$cardId normal public hand entry fires the external enter observer positive control',
    (row) => {
      install(entryState(row, 'self'), `${row.cardId}:wave81-entry-positive`, 'self');
      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: row.cardId }))
        .toEqual({ ok: true });
      expect(current().pendingEffects.some(effect => (
        effect.source.cardId === ENTER_OBSERVER && effect.triggeredBy.hook === 'enter'
      ))).toBe(true);
      expect(current().players.self.scene.find(card => card.cardId === ENTER_OBSERVER)
        ?.turnEffects.externalEnterObserved_turn).toBe(true);
    },
  );

  it.each(['B02038', 'B02038P'] as const)(
    '$cardId public disguise draws and applies only its contact AP rider',
    (cardId) => {
      const row = WAVE80_TARGETS.find(candidate => candidate.cardId === cardId)!;
      install(contactState(row, 'self'), `${cardId}:wave80-disguise-rider`, 'self');
      disguisePublicly(row, 'self');
      expect(current().players.self.hand).toContain(DECK_TAIL);
      expect(readChar.ap(current(), ACTOR_UID)).toBe(7000);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );

  it.each([
    { cardId: 'B02038' as const, picked: true },
    { cardId: 'B02038P' as const, picked: false },
  ])('$cardId public entry offers only the eligible remove character (picked=$picked)', ({ cardId, picked }) => {
    const row = WAVE80_TARGETS.find(candidate => candidate.cardId === cardId)!;
    install(entryState(row, 'self', false), `${cardId}:wave80-entry-rider`, 'self');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({ player: 'self', atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([WHITE_LOW]);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: picked ? pending!.candidates[0]!.uid : null,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene.some(card => card.cardId === WHITE_LOW)).toBe(picked);
    if (picked) {
      expect(current().players.self.scene.find(card => card.cardId === WHITE_LOW)?.state).toBe('sleep');
    } else {
      expect(current().players.self.remove).toContain(WHITE_LOW);
    }
  });

  it.each(['B02044', 'B02044P'] as const)(
    '$cardId public entry takes the sole disguise match and bottoms the decoy',
    (cardId) => {
      const row = WAVE80_TARGETS.find(candidate => candidate.cardId === cardId)!;
      install(entryState(row, 'self', false), `${cardId}:wave80-entry-look`, 'self');
      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
      surfacePendingSideChannels();
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending).toMatchObject({ player: 'self', atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
      expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual(['B02043']);
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: pending!.candidates[0]!.uid,
      }))).toEqual({ ok: true });
      expect(current().players.self.hand).toContain('B02043');
      expect(current().players.self.deck).toEqual([DECK_TAIL, DECK_DECOY]);
    },
  );

  it('B02086 opponent accepts publicly, chooses its own discard, and leaves the defender unprotected', () => {
    const base = WAVE80_TARGETS.find(candidate => candidate.cardId === 'B02086')!;
    const row = { ...base, opponentTurn: true };
    const state = contactState(row, 'self');
    state.players.opp.hand = [COST_A, COST_B];
    install(state, 'B02086:wave80-opponent-accept', 'opp');
    const actionId = disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional).toMatchObject({
      player: 'opp', ownerPlayer: 'self', source: { cardId: 'B02086', abilityId: 'a2' },
    });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ player: 'opp', atomVerb: 'discard' });
    expect(discard?.candidates.map(candidate => candidate.cardId)).toEqual([COST_A, COST_B]);
    const costB = discard!.candidates.find(candidate => candidate.cardId === COST_B)!;
    expect(dispatchEngineAction(bindPendingDecision(discard!, {
      type: 'effectPickResolve', pickedUid: costB.uid,
    }))).toEqual({ ok: true });
    expect(current().players.opp.remove).toContain(COST_B);
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).not.toBe(true);
    finishAction(actionId);
    expect(current().players.self.scene.some(card => card.uid === ACTOR_UID)).toBe(false);
  });

  it('B02086P saved opponent decline reauthenticates and protects only this action contact', () => {
    const base = WAVE80_TARGETS.find(candidate => candidate.cardId === 'B02086P')!;
    const row = { ...base, opponentTurn: true };
    const state = contactState(row, 'self');
    state.players.opp.hand = [COST_A];
    install(state, 'B02086P:wave80-opponent-decline-save', 'opp');
    const actionId = disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    const oldOptional = useGameStateStore.getState().pendingEffectOptional!;
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectOptional!;
    expect(restored.decisionId).not.toBe(oldOptional.decisionId);
    expect(dispatchEngineAction(bindPendingDecision(oldOptional, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).toBe(true);
    finishAction(actionId);
    expect(current().players.self.scene[0]?.cardId).toBe('B02086P');
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).not.toBe(true);
  });

  it('B02086 zero-hand opponent cannot accept an impossible discard and gets the else branch', () => {
    const base = WAVE80_TARGETS.find(candidate => candidate.cardId === 'B02086')!;
    const row = { ...base, opponentTurn: true };
    const state = contactState(row, 'self');
    state.players.opp.hand = [];
    install(state, 'B02086:wave80-zero-hand', 'opp');
    const actionId = disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).toBe(true);
    finishAction(actionId);
    expect(current().players.self.scene[0]?.cardId).toBe('B02086');
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).not.toBe(true);
  });

  it('B02086 rechecks hand feasibility when a restored opponent accepts a stale optional', () => {
    const base = WAVE80_TARGETS.find(candidate => candidate.cardId === 'B02086')!;
    const row = { ...base, opponentTurn: true };
    const state = contactState(row, 'self');
    state.players.opp.hand = [COST_A];
    install(state, 'B02086:wave80-restored-empty-accept', 'opp');
    disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    saved.players.opp.hand = [];
    saved.players.opp.remove.push(COST_A);
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectOptional!;
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).toBe(true);
  });

  it('B02045 public disguise applies its up-to-one AP rider and expires it at turn end', () => {
    const row = WAVE81_TARGETS.find(candidate => candidate.cardId === 'B02045')!;
    install(contactState(row, 'self'), 'B02045:wave81-ap-rider', 'self');
    const actionId = disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({ player: 'self', atomVerb: 'charModifyAP', nMin: 0, nMax: 1 });
    expect(pending?.candidates.map(candidate => candidate.uid).sort()).toEqual([
      ACTOR_UID, TARGET_UID, 'self-enter-observer',
    ].sort());
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: TARGET_UID,
    }))).toEqual({ ok: true });
    expect(readChar.ap(current(), TARGET_UID)).toBe(7000);
    finishAction(actionId);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.ap(current(), TARGET_UID)).toBe(9000);
  });

  it.each([
    { label: 'valid', replacedCardId: OLD_WHITE, remains: true },
    { label: 'invalid', replacedCardId: OLD_INVALID, remains: false },
  ])('B02047 $label replaced character controls public contact immunity', ({ label, replacedCardId, remains }) => {
    const base = WAVE81_TARGETS.find(candidate => candidate.cardId === 'B02047')!;
    const row = { ...base, opponentTurn: true, replacedCardId };
    const state = contactState(row, 'self');
    if (remains) {
      state.players.opp.scene.push(sceneChar(CONTACT_TARGET_TWO, 'opp-second-attacker'));
    }
    install(state, `B02047:wave81-${label}`, 'self');
    const actionId = disguisePublicly(row, 'self');
    finishAction(actionId);
    expect(current().players.self.scene.some(card => card.uid === ACTOR_UID)).toBe(remains);
    if (remains) {
      expect(current().players.self.scene[0]?.turnEffects.contactImmune).toBe(false);
      expect(current().players.self.scene[0]?.turnEffects.contactImmune_action).not.toBe(true);
      expect(readChar.hasTextAbility(current(), ACTOR_UID, 'contactImmune')).toBe(false);
      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'opp-second-attacker', targetUid: ACTOR_UID,
      })).toEqual({ ok: true });
      const secondActionId = useGameStateStore.getState().activeActionId!;
      expect(dispatchEngineAction({
        type: 'actionGuard', actionId: secondActionId, guarderUid: null,
      })).toEqual({ ok: true });
      finishAction(secondActionId);
      expect(current().players.self.scene.some(card => card.uid === ACTOR_UID)).toBe(false);
      expect(current().players.self.remove).toContain('B02047');
    } else {
      expect(current().players.self.remove).toContain('B02047');
    }
  });

  it.each(['self', 'opp'] as const)(
    'B03050 owner $owner publicly accepts its opponent-turn Sera rider and gains evidence',
    (owner) => {
      const row = WAVE81_TARGETS.find(candidate => candidate.cardId === 'B03050')!;
      install(contactState(row, owner), `B03050:wave81-accept-${owner}`, owner);
      const actionId = disguisePublicly(row, owner);
      surfacePendingSideChannels();
      const optional = useGameStateStore.getState().pendingEffectOptional;
      expect(optional).toMatchObject({ player: owner, source: { cardId: 'B03050', abilityId: 'a2' } });
      expect(dispatchEngineAction(bindPendingDecision(optional!, {
        type: 'optionalResolve', run: true,
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene.some(card => card.uid === ACTOR_UID)).toBe(false);
      expect(current().players[owner].evidence).toEqual([
        expect.objectContaining({ cardId: DECK_TAIL, faceUp: false }),
      ]);
      finishAction(actionId);
    },
  );

  it('B03050 public decline keeps the character and gives no evidence before contact resumes', () => {
    const row = WAVE81_TARGETS.find(candidate => candidate.cardId === 'B03050')!;
    install(contactState(row, 'self'), 'B03050:wave81-decline', 'self');
    disguisePublicly(row, 'self');
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional!;
    expect(dispatchEngineAction(bindPendingDecision(optional, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.cardId).toBe('B03050');
    expect(current().players.self.evidence).toEqual([]);
  });
});
