// qa: card:B06018:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// qa: card:B06028:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// qa: card:B06035:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// qa: card:B06050:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// qa: card:B06051:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// qa: card:B06072:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
// Rules: 17-icons. Event YAIBA reads only the ability owner's incident trait.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06018 } from '@/cards/ct-p06/B06018';
import { B06018P } from '@/cards/ct-p06/B06018P';
import { B06028 } from '@/cards/ct-p06/B06028';
import { B06028P } from '@/cards/ct-p06/B06028P';
import { B06035 } from '@/cards/ct-p06/B06035';
import { B06036 } from '@/cards/ct-p06/B06036';
import { B06036P } from '@/cards/ct-p06/B06036P';
import { B06050 } from '@/cards/ct-p06/B06050';
import { B06050P } from '@/cards/ct-p06/B06050P';
import { B06065 } from '@/cards/ct-p06/B06065';
import { B06065P } from '@/cards/ct-p06/B06065P';
import { B06051 } from '@/cards/ct-p06/B06051';
import { B06051P } from '@/cards/ct-p06/B06051P';
import { B06072 } from '@/cards/ct-p06/B06072';
import { B06072P } from '@/cards/ct-p06/B06072P';
import { evalCond } from '@/engine/cond/eval';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type {
  AbilityDef,
  CardDef,
  Condition,
  EffectCtx,
  GameState,
  Player,
} from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B06018' | 'B06028' | 'B06035' | 'B06050' | 'B06051' | 'B06072';
type Row = { card: CardDef; baseId: BaseId; abilityIndex: number };

const PHYSICALS: Row[] = [
  { card: B06018, baseId: 'B06018', abilityIndex: 0 },
  { card: B06018P, baseId: 'B06018', abilityIndex: 0 },
  { card: B06028, baseId: 'B06028', abilityIndex: 0 },
  { card: B06028P, baseId: 'B06028', abilityIndex: 0 },
  { card: B06035, baseId: 'B06035', abilityIndex: 1 },
  { card: B06050, baseId: 'B06050', abilityIndex: 0 },
  { card: B06050P, baseId: 'B06050', abilityIndex: 0 },
  { card: B06051, baseId: 'B06051', abilityIndex: 0 },
  { card: B06051P, baseId: 'B06051', abilityIndex: 0 },
  { card: B06072, baseId: 'B06072', abilityIndex: 0 },
  { card: B06072P, baseId: 'B06072', abilityIndex: 0 },
];

const REAL_YAIBA_CASES = [B06036, B06036P, B06065, B06065P] as const;
const YAIBA_CASE = B06036.id;
const PLAIN_CASE = 'W69-PLAIN-CASE';
const OTHER_CASE = B06065.id;
const ENTRY_SOURCE = 'W69-ENTRY-SOURCE';
const ENTRY_UID = 'wave69-entry-source';
const ACTOR = 'W69-ACTOR';
const TARGET = 'W69-TARGET';
const PAY = 'W69-PAY';
const FILLER = 'W69-FILLER';
const OPP_PENALTY = 'W69-OPP-PENALTY';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function enterAbility(cardId: string): AbilityDef {
  return {
    id: 'enter-' + cardId,
    type: 'declared',
    scope: 'on-scene',
    effect: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        cardId,
        viaEffect: true,
        target: { query: { area: 'remove', side: 'self' } },
      },
    },
    description: '',
    ruleRefs: [],
  };
}

const entryAbilities = [B06018.id, B06018P.id].map(enterAbility);
const fixtures: CardDef[] = [
  fixture(PLAIN_CASE, { kind: 'case', colors: ['青'], caseLevel: 7, caseTraits: [] }),
  fixture(ENTRY_SOURCE, { abilities: entryAbilities }),
  fixture(ACTOR, { ap: 4000 }),
  fixture(TARGET, { ap: 1000 }),
  fixture(PAY, { level: 2 }),
  fixture(FILLER),
  fixture(OPP_PENALTY),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function caseState(owner: Player, ownerCaseId: string, opponentCaseId = PLAIN_CASE): GameState {
  const state = createEmptyGameState();
  const ownerCase = readDef.card(ownerCaseId);
  const opponentCase = readDef.card(opponentCaseId);
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    cardId: ownerCaseId,
    colors: [...(ownerCase?.colors ?? ['青'])],
    status: '解決編',
    declaredUseCount: {},
  };
  state.players[other(owner)].case = {
    ...state.players[other(owner)].case,
    cardId: opponentCaseId,
    colors: [...(opponentCase?.colors ?? ['緑'])],
    status: '解決編',
    declaredUseCount: {},
  };
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave69 state');
  return state;
}

function conditionFor(row: Row): Condition {
  const ability = row.card.abilities[row.abilityIndex]!;
  if (row.baseId !== 'B06050') {
    if (!ability.condition) throw new Error(row.card.id + ': missing YAIBA condition');
    return ability.condition;
  }
  if (ability.effect.kind !== 'choice') throw new Error(row.card.id + ': missing cut-in choice');
  const option = ability.effect.options[1];
  if (!option || option.kind !== 'conditional') throw new Error(row.card.id + ': missing YAIBA option');
  return option.if;
}

function ctxFor(row: Row, owner: Player): EffectCtx {
  const area = row.baseId === 'B06028' || row.baseId === 'B06035'
    ? 'evidence'
    : row.baseId === 'B06050' || row.baseId === 'B06072'
      ? 'hand'
      : 'scene';
  return {
    source: {
      player: owner,
      uid: 'wave69-source',
      cardId: row.card.id,
      abilityId: row.card.abilities[row.abilityIndex]!.id,
      abilityOrigin: 'printed',
      abilityIndex: row.abilityIndex,
      area,
    },
    bindings: {},
    ...(row.baseId === 'B06051'
      ? { triggerPayload: { side: other(owner), cause: 'contact-ap', byUid: 'wave69-source' } }
      : {}),
  };
}

function entryState(cardId: string, caseId: string, owner: Player = 'self'): GameState {
  const state = caseState(owner, caseId);
  state.players[owner].scene = [sceneChar(ENTRY_SOURCE, ENTRY_UID)];
  state.players[owner].remove = [cardId];
  return state;
}

function dispatchEntry(cardId: string, owner: Player = 'self') {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: ENTRY_UID,
    abilId: 'enter-' + cardId,
    abilityOrigin: 'printed',
    abilityIndex: entryAbilities.findIndex(ability => ability.id === 'enter-' + cardId),
  });
}

function handState(
  cardId: string,
  caseId: string,
  owner: Player = 'self',
  opponentCaseId = PLAIN_CASE,
): GameState {
  const state = caseState(owner, caseId, opponentCaseId);
  state.players[owner].hand = [cardId];
  state.players[owner].file = Array.from({ length: 9 }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: 'W69-FILE-' + index,
  }));
  return state;
}

function hiramekiState(cardId: string, caseId: string): GameState {
  const state = caseState('self', caseId);
  state.turn.player = 'opp';
  state.players.self.evidence = [
    { cardId, faceUp: true, origin: { turn: 1, via: 'effect' } },
  ];
  state.players.self.scene = [sceneChar(TARGET, 'wave69-hirameki-target')];
  state.players.opp.scene = [sceneChar(ACTOR, 'wave69-hirameki-attacker')];
  state.players.self.deck = [FILLER, FILLER];
  state.players.opp.deck = [FILLER, FILLER];
  return state;
}

function openActionHirameki(cardId: string, caseId: string) {
  install(hiramekiState(cardId, caseId), cardId + ':wave69-hirameki', 'self');
  expect(dispatchEngineAction({
    type: 'actionDeclareCase',
    byUid: 'wave69-hirameki-attacker',
    targetPlayer: 'self',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingHirameki;
  expect(pending).toMatchObject({ player: 'self', cardId });
  return { actionId, pending: pending! };
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(card => card.uid === uid) ? 'self' : 'opp';
}

function reachSelfContactWindow(state: GameState, label: string): string {
  install(state, label);
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: 'wave69-actor',
    targetUid: 'wave69-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('contact ended before self window');
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(uid!);
      if (player === 'self' && uid === 'wave69-actor') return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact',
        actionId,
        player,
        choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('self contact window not reached');
}

function cutinState(cardId: string, caseId: string): GameState {
  const state = caseState('self', caseId);
  state.players.self.scene = [sceneChar(ACTOR, 'wave69-actor')];
  state.players.opp.scene = [sceneChar(TARGET, 'wave69-target', { state: 'sleep' })];
  state.players.self.hand = [cardId];
  state.players.self.remove = [B06035.id];
  state.players.self.file = Array.from({ length: 5 }, () => ({
    type: 'card-back' as const,
    cardId: FILLER,
  }));
  return state;
}

function useYaibaCutin(cardId: string, caseId: string) {
  const actionId = reachSelfContactWindow(cutinState(cardId, caseId), cardId + ':wave69-cutin');
  expect(dispatchEngineAction({
    type: 'actionContact',
    actionId,
    player: 'self',
    choice: { kind: 'cutin', cardId },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice?.source).toMatchObject({ cardId, abilityId: 'a1' });
  expect(dispatchEngineAction(bindPendingDecision(choice!, {
    type: 'choiceResolve',
    choiceIndex: 1,
  }))).toEqual({ ok: true });
  surfacePendingSideChannels();
  return useGameStateStore.getState().pendingEffectPick;
}

function contactState(cardId: string, caseId: string): GameState {
  const state = caseState('self', caseId);
  state.players.self.scene = [sceneChar(cardId, 'wave69-contact-source', { isNamed: true })];
  state.players.opp.scene = [sceneChar(TARGET, 'wave69-contact-target', { state: 'sleep' })];
  state.players.self.hand = [PAY];
  state.players.self.deck = [];
  state.players.opp.deck = [OPP_PENALTY, FILLER];
  return state;
}

function runContactUntilOptional(cardId: string, caseId: string) {
  install(contactState(cardId, caseId), cardId + ':wave69-contact');
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: 'wave69-contact-source',
    targetUid: 'wave69-contact-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 15; step += 1) {
    const optional = useGameStateStore.getState().pendingEffectOptional;
    if (optional) return { actionId, optional };
    const context = flow.action._getContext(current(), actionId);
    if (!context) return { actionId, optional: null };
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      expect(dispatchEngineAction({
        type: 'actionContact',
        actionId,
        player: ownerOf(uid!),
        choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (context.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      surfacePendingSideChannels();
      const optional = useGameStateStore.getState().pendingEffectOptional;
      if (optional) return { actionId, optional };
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('contact did not settle');
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave69: Event YAIBA reads the ability owner incident', () => {
  // Card-bound physical rows: B06018/P B06028/P B06035 B06050/P B06051/P B06072/P.
  it.each(REAL_YAIBA_CASES)('$id real incident enables every Event YAIBA text', incident => {
    expect(incident.caseTraits).toContain('YAIBA');
    const state = caseState('self', incident.id);
    for (const row of PHYSICALS) {
      expect(evalCond(state, conditionFor(row), ctxFor(row, 'self')),
        incident.id + '/' + row.card.id).toBe(true);
    }
  });

  it.each(PHYSICALS)('$card.id condition accepts owner YAIBA and rejects opponent-only YAIBA', row => {
    const own = caseState('self', YAIBA_CASE);
    const opponentOnly = caseState('self', PLAIN_CASE, OTHER_CASE);
    const mirrored = caseState('opp', YAIBA_CASE);
    expect(evalCond(own, conditionFor(row), ctxFor(row, 'self'))).toBe(true);
    expect(evalCond(opponentOnly, conditionFor(row), ctxFor(row, 'self'))).toBe(false);
    expect(evalCond(mirrored, conditionFor(row), ctxFor(row, 'opp'))).toBe(true);
  });

  it.each([B06018.id, B06018P.id])('%s effect entry prompts only under owner YAIBA and permits decline', cardId => {
    install(entryState(cardId, YAIBA_CASE), cardId + ':wave69-entry-yes');
    expect(dispatchEntry(cardId)).toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve',
      run: false,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();

    install(entryState(cardId, PLAIN_CASE), cardId + ':wave69-entry-no');
    expect(dispatchEntry(cardId)).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().pendingEffects.some(entry => (
      entry.source.cardId === cardId && entry.source.abilityId === 'a1'
    ))).toBe(false);
  });

  it.each([B06072.id, B06072P.id])('%s ignores incident color from hand and Next Hint only under owner YAIBA', cardId => {
    install(handState(cardId, YAIBA_CASE), cardId + ':wave69-hand-yes');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
    expect(current().players.self.scene.some(entry => entry.cardId === cardId)).toBe(true);

    install(handState(cardId, PLAIN_CASE), cardId + ':wave69-hand-no');
    const before = current();
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);

    install(handState(cardId, YAIBA_CASE), cardId + ':wave69-hint-yes');
    expect(dispatchEngineAction({
      type: 'nextHint',
      player: 'self',
      optionalCardId: cardId,
    })).toEqual({ ok: true });
    expect(current().players.self.scene.some(entry => entry.cardId === cardId)).toBe(true);

    install(handState(cardId, PLAIN_CASE), cardId + ':wave69-hint-no');
    expect(dispatchEngineAction({
      type: 'nextHint',
      player: 'self',
      optionalCardId: cardId,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.scene.some(entry => entry.cardId === cardId)).toBe(false);
  });

  it.each([B06072.id, B06072P.id])('%s reads YAIBA owner-relatively through the opponent public Next Hint path', cardId => {
    install(handState(cardId, YAIBA_CASE, 'opp'), cardId + ':wave69-opp-hint-yes', 'opp');
    expect(dispatchEngineAction({
      type: 'nextHint',
      player: 'opp',
      optionalCardId: cardId,
    })).toEqual({ ok: true });
    expect(current().players.opp.scene.some(entry => entry.cardId === cardId)).toBe(true);

    install(
      handState(cardId, PLAIN_CASE, 'opp', YAIBA_CASE),
      cardId + ':wave69-opp-hint-opponent-only',
      'opp',
    );
    const before = current();
    expect(dispatchEngineAction({
      type: 'nextHint',
      player: 'opp',
      optionalCardId: cardId,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
  });

  it.each([B06028.id, B06028P.id, B06035.id])('%s Hirameki keeps fire/skip but gates its text', cardId => {
    const valid = openActionHirameki(cardId, YAIBA_CASE);
    expect(valid.pending.effectValid).toBe(true);
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' })).toEqual({ ok: true });

    const invalid = openActionHirameki(cardId, PLAIN_CASE);
    expect(invalid.pending.effectValid).toBe(false);
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(useGameStateStore.getState().pendingHirameki?.effectValid).toBe(false);
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    expect(current().players.self.scene.some(entry => entry.uid === 'wave69-hirameki-target')).toBe(true);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: invalid.actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: invalid.actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });

  it.each([B06050.id, B06050P.id])('%s YAIBA cut-in option reads only owner remove and no-ops otherwise', cardId => {
    const pick = useYaibaCutin(cardId, YAIBA_CASE);
    expect(pick?.atomVerb).toBe('handAddFromRemove');
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([B06035.id]);
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve',
      pickedUid: pick!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).toContain(B06035.id);
    expect(current().players.opp.hand).not.toContain(B06035.id);

    const noPick = useYaibaCutin(cardId, PLAIN_CASE);
    expect(noPick).toBeNull();
    expect(current().players.self.remove).toContain(B06035.id);
    expect(current().players.self.hand).not.toContain(B06035.id);
  });

  it.each([B06051.id, B06051P.id])('%s contact observer prompts only under owner YAIBA', cardId => {
    const valid = runContactUntilOptional(cardId, YAIBA_CASE);
    expect(valid.optional?.source).toMatchObject({ cardId, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(valid.optional!, {
      type: 'optionalResolve',
      run: false,
    }))).toEqual({ ok: true });

    const invalid = runContactUntilOptional(cardId, PLAIN_CASE);
    expect(invalid.optional).toBeNull();
    expect(current().pendingEffects.some(entry => (
      entry.source.cardId === cardId && entry.source.abilityId === 'a1'
    ))).toBe(false);
  });

  it('B06051 owner payment refreshes before its evidence gain', () => {
    const valid = runContactUntilOptional(B06051.id, YAIBA_CASE);
    expect(dispatchEngineAction(bindPendingDecision(valid.optional!, {
      type: 'optionalResolve',
      run: true,
    }))).toEqual({ ok: true });
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard?.atomVerb).toBe('discard');
    const pay = discard?.candidates.find(candidate => candidate.cardId === PAY);
    expect(pay).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(discard!, {
      type: 'effectPickResolve',
      pickedUid: pay!.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.hand).not.toContain(PAY);
    expect(current().players.self.evidence).toContainEqual(
      expect.objectContaining({ cardId: PAY, faceUp: false }),
    );
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toContainEqual(
      expect.objectContaining({ cardId: 'penalty-card', faceUp: false }),
    );
  });
});
