// qa: card:B08075:08a66550cc5178b9dd1548e89a7ad24ec27bf692e40929f7b46c0ac0a0c13339
// qa: card:B08075:92062546ddf7a403f9256b40d656a58bd5ffba9eb3b65a25c8d181a9230230aa
// qa: card:B08075:a31e2c7021df0bb1ba0ad9c0fe53f71c09fb5920e51faf164f8d71b3186a8043
// qa: card:B08076:29f624db00a993714749b8402339fe9a21755ed398075919e308d8fd6a0f1fed
// qa: card:B08076:2c6ac24b23da6af74e438157fedd31aa26136b34e324eec26bb022a7c143d0d5
// qa: card:B08076:97004958b529862e504678c4b65e5041d24574ed18fcff21b38f996b8242f6d8
// qa: card:B08078:214ed42439e572d62f31c129957af231ae3fccb9951fd560e683bb71eb0a7578
// qa: card:B08078:935ee6bbdc3b68741135748432cd4203bff13ff8087ff503e2641d8bd027e4e0
// qa: card:B08079:17f6cfff82f742694f5c3e9abfb1678b2f8daf66147b1668e467b43b1033d692
// qa: card:B08079:8694908a85d3e09bf805a1bc854d3acd563fd16a6a5f9507d14ba209ab1f51b8

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07079 } from '@/cards/ct-p07/B07079';
import { B08075 } from '@/cards/ct-p08/B08075';
import { B08076 } from '@/cards/ct-p08/B08076';
import { B08078 } from '@/cards/ct-p08/B08078';
import { B08079 } from '@/cards/ct-p08/B08079';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const SATO = fixture('W184_SATO', { names: ['佐藤美和子'], level: 4, ap: 3000 });
const TAKAGI = fixture('W184_TAKAGI', { names: ['高木渉'], level: 4, ap: 4000 });
const NON_NAME = fixture('W184_NON_NAME', { names: ['目暮十三'], level: 4, ap: 3500 });
const SATO_MATCH = fixture('W184_SATO_MATCH', { names: ['佐藤美和子'], level: 3 });
const AP_8000 = fixture('W184_AP_8000', { colors: ['青'], ap: 8000 });
const AP_8001 = fixture('W184_AP_8001', { colors: ['青'], ap: 8001 });
const ACTION_TARGET = fixture('W184_ACTION_TARGET', { colors: ['青'], ap: 1000 });
const DRAW_A = fixture('W184_DRAW_A', { kind: 'event' });
const DRAW_B = fixture('W184_DRAW_B', { kind: 'event' });
const DECOY_A = fixture('W184_DECOY_A', { kind: 'event' });
const DECOY_B = fixture('W184_DECOY_B', { kind: 'event' });
const DECOY_C = fixture('W184_DECOY_C', { kind: 'event' });
const TAIL = fixture('W184_TAIL', { kind: 'event' });

const REMOVER = fixture('W184_REMOVER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: {
        player: 'self', side: 'either', max: 1,
        filter: { kind: 'character', cardName: 'ジン' }, cause: 'effect',
      },
    },
    description: 'キャラを1枚まで選び、リムーブする。', ruleRefs: [],
  }],
});

const INACTIVE_LEAVER = fixture('W184_INACTIVE_LEAVER', {
  colors: ['青'], level: 7,
  abilities: [{
    id: 'leave-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    condition: { kind: 'caseColor', color: '赤' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【事件赤】【現場リムーブ時】カードを1枚引く。', ruleRefs: [],
  }],
});

const REFRESH_LEAVER = fixture('W184_REFRESH_LEAVER', {
  colors: ['黒'], level: 7,
  abilities: [{
    id: 'leave-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【現場リムーブ時】カードを1枚引く。', ruleRefs: [],
  }],
});

const FIXTURES = [
  SATO, TAKAGI, NON_NAME, SATO_MATCH, AP_8000, AP_8001, ACTION_TARGET,
  DRAW_A, DRAW_B, DECOY_A, DECOY_B, DECOY_C, TAIL, REMOVER,
  INACTIVE_LEAVER, REFRESH_LEAVER,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave184 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: TAIL.id }));
}

function evidence(cardId: string, faceUp: boolean): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave184-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function chooseCard(pending: PendingPick, cardId: string | null, switchRemoveUid?: string): void {
  const pickedUid = cardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === cardId)?.uid;
  if (cardId !== null) expect(pickedUid, `${cardId} must be selectable`).toBeTruthy();
  choose(pending, pickedUid ?? null, switchRemoveUid);
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function resolveDeckOrder(order?: string[]): void {
  surfacePendingSideChannels();
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (!reorder) return;
  expect(dispatchEngineAction(bindPendingDecision(reorder, {
    type: 'deckReorderResolve', order: order ?? [...reorder.cardIds],
  }))).toEqual({ ok: true });
}

function closeCaseAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 6 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(card => card.uid === uid) ? 'self' : 'opp';
}

function reachContact(owner: Player, actorUid: string, targetUid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: actorUid, targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('contact ended before disguise');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = ownerOf(actingUid!);
      if (player === owner && actingUid === actorUid) return actionId;
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player, choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('owner contact window not reached');
}

function removeB08078(owner: Player): void {
  const opponent = other(owner);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: `${opponent}-remover`, abilId: 'a1' }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (pending) chooseCard(pending, B08078.id);
  expect(current().players[owner].scene.some(card => card.cardId === B08078.id)).toBe(false);
  expect(current().players[owner].remove).toContain(B08078.id);
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave184: B08075 ordered options', () => {
  it.each(['self', 'opp'] as const)('owner=%s resolves each option once and may take zero matching cards', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08075.id];
    state.players[owner].scene = [
      sceneChar(SATO.id, 'sato', { state: 'sleep' }),
      sceneChar(TAKAGI.id, 'takagi'),
    ];
    state.players[owner].deck = [SATO_MATCH.id, DECOY_A.id, DECOY_B.id, DECOY_C.id, TAIL.id];
    install(state, owner, `${owner}-B08075-options`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08075.id }))
      .toEqual({ ok: true });
    resolveOptional(B08075.id, 'a1', true);
    choose(pendingPick(B08075.id, 'a1', 'sceneSetState'), 'sato');
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', true);
    const reveal = pendingPick(B08075.id, 'a1', 'deckRevealUntil');
    expect(reveal.candidates.map(candidate => candidate.cardId)).toEqual([SATO_MATCH.id]);
    choose(reveal, null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingDeckReorder?.cardIds)
      .toEqual([SATO_MATCH.id, DECOY_A.id, DECOY_B.id, DECOY_C.id]);
    const bottomOrder = [DECOY_C.id, SATO_MATCH.id, DECOY_A.id, DECOY_B.id];
    resolveDeckOrder(bottomOrder);

    expect(current().players[owner].scene.find(card => card.uid === 'sato')?.state).toBe('active');
    expect(current().players[owner].hand).not.toContain(SATO_MATCH.id);
    expect(current().players[owner].deck).toEqual([TAIL.id, ...bottomOrder]);
    expect(current().players[owner].remove).toContain(B08075.id);
    const store = useGameStateStore.getState();
    expect([store.pendingEffectOptional, store.pendingEffectPick, store.pendingDeckReorder])
      .toEqual([null, null, null]);
  });

  it.each(['self', 'opp'] as const)('owner=%s may skip all three options without side effects', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08075.id];
    state.players[owner].scene = [
      sceneChar(SATO.id, 'sato', { state: 'sleep' }), sceneChar(TAKAGI.id, 'takagi'),
    ];
    state.players[owner].deck = [SATO_MATCH.id, DECOY_A.id, DECOY_B.id, DECOY_C.id, TAIL.id];
    install(state, owner, `${owner}-B08075-all-skip`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08075.id }))
      .toEqual({ ok: true });
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', false);
    expect(current().players[owner].scene.find(card => card.uid === 'sato')?.state).toBe('sleep');
    expect(read.char.hasKeyword(current(), 'takagi', '突撃[キャラ]')).toBe(false);
    expect(current().players[owner].deck)
      .toEqual([SATO_MATCH.id, DECOY_A.id, DECOY_B.id, DECOY_C.id, TAIL.id]);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s may take one match and explicitly order only the remainder', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08075.id];
    state.players[owner].deck = [SATO_MATCH.id, DECOY_A.id, DECOY_B.id, DECOY_C.id, TAIL.id];
    install(state, owner, `${owner}-B08075-positive-take`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08075.id }))
      .toEqual({ ok: true });
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', true);
    chooseCard(pendingPick(B08075.id, 'a1', 'deckRevealUntil'), SATO_MATCH.id);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingDeckReorder?.cardIds)
      .toEqual([DECOY_A.id, DECOY_B.id, DECOY_C.id]);
    const bottomOrder = [DECOY_C.id, DECOY_A.id, DECOY_B.id];
    resolveDeckOrder(bottomOrder);
    expect(current().players[owner].hand).toContain(SATO_MATCH.id);
    expect(current().players[owner].deck).toEqual([TAIL.id, ...bottomOrder]);
  });

  it.each(['self', 'opp'] as const)('owner=%s may action again after option one reactivates Sato', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08075.id];
    state.players[owner].scene = [sceneChar(SATO.id, 'sato')];
    state.players[opponent].evidence = [evidence(DECOY_A.id, false), evidence(DECOY_B.id, false)];
    state.players[owner].deck = [TAIL.id, DECOY_A.id];
    install(state, owner, `${owner}-B08075-repeat-action`);

    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'sato', targetPlayer: opponent }))
      .toEqual({ ok: true });
    closeCaseAction(useGameStateStore.getState().activeActionId!);
    expect(current().players[owner].scene.find(card => card.uid === 'sato')?.state).toBe('sleep');

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08075.id }))
      .toEqual({ ok: true });
    resolveOptional(B08075.id, 'a1', true);
    choose(pendingPick(B08075.id, 'a1', 'sceneSetState'), 'sato');
    resolveOptional(B08075.id, 'a1', false);
    resolveOptional(B08075.id, 'a1', false);
    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'sato', targetPlayer: opponent }))
      .toEqual({ ok: true });
  });
});

describe('official QA Wave184: B08076 owner costs and resolution-time names', () => {
  it.each(['self', 'opp'] as const)('owner=%s cannot pay evidence or scene costs with opponent cards', owner => {
    const opponent = other(owner);
    const evidenceReject = createEmptyGameState();
    evidenceReject.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    evidenceReject.players[owner].case = {
      ...evidenceReject.players[owner].case, cardId: B08076.id, colors: ['黄'], status: '解決編',
    };
    evidenceReject.players[owner].scene = [sceneChar(SATO.id, 'sato'), sceneChar(TAKAGI.id, 'takagi')];
    evidenceReject.players[owner].evidence = [evidence(DECOY_A.id, false)];
    evidenceReject.players[opponent].evidence = [evidence(DECOY_B.id, false), evidence(DECOY_C.id, false)];
    install(evidenceReject, owner, `${owner}-B08076-evidence-reject`);
    const beforeEvidence = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: {
        flipFaceUpEvidence: { indices: [0, 1] },
        sceneToDeckBottom: { uids: ['takagi'] },
      },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeEvidence);

    const sceneReject = createEmptyGameState();
    sceneReject.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    sceneReject.players[owner].case = {
      ...sceneReject.players[owner].case, cardId: B08076.id, colors: ['黄'], status: '解決編',
    };
    sceneReject.players[owner].scene = [sceneChar(SATO.id, 'sato'), sceneChar(TAKAGI.id, 'takagi')];
    sceneReject.players[opponent].scene = [sceneChar(NON_NAME.id, 'opponent-scene')];
    sceneReject.players[owner].evidence = [evidence(DECOY_A.id, false), evidence(DECOY_B.id, false)];
    install(sceneReject, owner, `${owner}-B08076-scene-reject`);
    const beforeScene = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: {
        flipFaceUpEvidence: { indices: [0, 1] },
        sceneToDeckBottom: { uids: ['opponent-scene'] },
      },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeScene);
  });

  it.each(['self', 'opp'] as const)('owner=%s rechecks all names after removing the only decoy as cost', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case = {
      ...state.players[owner].case, cardId: B08076.id, colors: ['黄'], status: '解決編',
    };
    state.players[owner].scene = [sceneChar(SATO.id, 'sato'), sceneChar(NON_NAME.id, 'decoy')];
    state.players[owner].evidence = [
      evidence(DECOY_A.id, false), evidence(DECOY_B.id, true), evidence(DECOY_C.id, false),
    ];
    state.players[owner].remove = [SATO_MATCH.id];
    state.players[owner].deck = [TAIL.id];
    install(state, owner, `${owner}-B08076-post-cost`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: {
        flipFaceUpEvidence: { indices: [0, 2] },
        sceneToDeckBottom: { uids: ['decoy'] },
      },
    })).toEqual({ ok: true });
    const enter = pendingPick(B08076.id, 'a2', 'sceneEnter');
    chooseCard(enter, SATO_MATCH.id);
    expect(current().players[owner].scene.some(card => card.uid === 'decoy')).toBe(false);
    expect(current().players[owner].scene.find(card => card.cardId === SATO_MATCH.id)?.state).toBe('sleep');
    expect(current().players[owner].evidence.map(card => card.faceUp)).toEqual([true, true, true]);
    expect(current().players[owner].evidence.map(card => card.cardId))
      .toEqual([DECOY_A.id, DECOY_B.id, DECOY_C.id]);
  });

  it.each(['self', 'opp'] as const)('owner=%s treats Sato and Miyamoto as a Sato name at resolution', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case = {
      ...state.players[owner].case, cardId: B08076.id, colors: ['黄'], status: '解決編',
    };
    state.players[owner].scene = [sceneChar(B07079.id, 'split-sato'), sceneChar(TAKAGI.id, 'takagi')];
    state.players[owner].evidence = [evidence(DECOY_A.id, false), evidence(DECOY_B.id, false)];
    state.players[owner].remove = [SATO_MATCH.id];
    state.players[owner].deck = [TAIL.id];
    install(state, owner, `${owner}-B08076-split-name`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: {
        flipFaceUpEvidence: { indices: [0, 1] },
        sceneToDeckBottom: { uids: ['takagi'] },
      },
    })).toEqual({ ok: true });
    chooseCard(pendingPick(B08076.id, 'a2', 'sceneEnter'), SATO_MATCH.id);
    expect(current().players[owner].scene.find(card => card.cardId === SATO_MATCH.id)?.state).toBe('sleep');
  });
});

describe('official QA Wave184: B08078 invoked leave effects', () => {
  it.each(['self', 'opp'] as const)('owner=%s may invoke an inactive printed leave ability and gets a no-op', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 184, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].scene = [sceneChar(B08078.id, `${owner}-gin`)];
    state.players[owner].hand = [INACTIVE_LEAVER.id];
    state.players[owner].deck = [DRAW_A.id, DRAW_B.id];
    state.players[opponent].scene = [sceneChar(REMOVER.id, `${opponent}-remover`)];
    install(state, owner, `${owner}-B08078-inactive-invoke`);

    removeB08078(owner);
    resolveOptional(B08078.id, 'a2', true);
    chooseCard(pendingPick(B08078.id, 'a2', 'discard'), INACTIVE_LEAVER.id);
    expect(current().players[owner].hand).toEqual([DRAW_A.id]);
    resolveOptional(B08078.id, 'a2', true);
    expect(current().players[owner].hand).toEqual([DRAW_A.id]);
    expect(current().players[owner].deck).toEqual([DRAW_B.id]);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s invokes the bound leave card after draw-triggered refresh moved it', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 184, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].scene = [sceneChar(B08078.id, `${owner}-gin`)];
    state.players[owner].hand = [REFRESH_LEAVER.id];
    state.players[owner].deck = [DRAW_A.id];
    state.players[opponent].scene = [sceneChar(REMOVER.id, `${opponent}-remover`)];
    install(state, owner, `${owner}-B08078-refresh-invoke`);

    removeB08078(owner);
    resolveOptional(B08078.id, 'a2', true);
    chooseCard(pendingPick(B08078.id, 'a2', 'discard'), REFRESH_LEAVER.id);
    expect(current().refreshCount[owner]).toBe(1);
    expect(current().players[owner].remove).not.toContain(REFRESH_LEAVER.id);
    expect(current().players[owner].hand).toEqual([DRAW_A.id]);
    const handBeforeInvoke = current().players[owner].hand.length;
    const deckBeforeInvoke = current().players[owner].deck.length;
    resolveOptional(B08078.id, 'a2', true);
    expect(current().players[owner].hand).toHaveLength(handBeforeInvoke + 1);
    expect(current().players[owner].deck).toHaveLength(deckBeforeInvoke - 1);
    expect(current().pendingEffects.some(entry => (
      entry.source.cardId === REFRESH_LEAVER.id
      && entry.source.abilityId === 'leave-draw'
      && entry.state === 'resolved'
    ))).toBe(true);
  });
});

describe('official QA Wave184: B08079 color and disguise continuous AP', () => {
  it.each(['self', 'opp'] as const)('owner=%s allows a black-plus-other case and rejects mono-black atomically', owner => {
    const opponent = other(owner);
    const accepted = createEmptyGameState();
    accepted.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    accepted.players[owner].case.colors = ['黒', '赤'];
    accepted.players[owner].scene = [sceneChar(B08079.id, 'pinga')];
    accepted.players[opponent].scene = [
      sceneChar(AP_8000.id, 'valid-ap'), sceneChar(AP_8001.id, 'invalid-ap'),
    ];
    install(accepted, owner, `${owner}-B08079-dual-case`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pinga', abilId: 'a3' }))
      .toEqual({ ok: true });
    const pick = pendingPick(B08079.id, 'a3', 'sceneRemove');
    expect(pick.candidates.some(candidate => candidate.uid === 'valid-ap')).toBe(true);
    expect(pick.candidates.some(candidate => candidate.uid === 'invalid-ap')).toBe(false);
    choose(pick, 'valid-ap');
    expect(current().players[owner].scene.find(card => card.uid === 'pinga')?.state).toBe('sleep');
    expect(current().players[opponent].remove).toContain(AP_8000.id);

    const rejected = createEmptyGameState();
    rejected.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    rejected.players[owner].case.colors = ['黒'];
    rejected.players[owner].scene = [sceneChar(B08079.id, 'pinga')];
    rejected.players[opponent].scene = [sceneChar(AP_8000.id, 'valid-ap')];
    install(rejected, owner, `${owner}-B08079-mono-black`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pinga', abilId: 'a3' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });

  it.each(['self', 'opp'] as const)('owner=%s gains AP immediately after a self-turn disguise', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 184, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黒'];
    state.players[owner].file = fileCards(7);
    state.players[owner].hand = [B08079.id];
    state.players[owner].scene = [sceneChar(SATO.id, 'actor')];
    state.players[opponent].scene = [sceneChar(ACTION_TARGET.id, 'target', { state: 'sleep' })];
    install(state, owner, `${owner}-B08079-disguise-ap`);

    const actionId = reachContact(owner, 'actor', 'target');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner,
      choice: { kind: 'disguise', cardId: B08079.id },
    })).toEqual({ ok: true });
    expect(current().players[owner].scene.find(card => card.uid === 'actor')?.cardId).toBe(B08079.id);
    expect(read.char.ap(current(), 'actor')).toBe(8000);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();

    const offTurn = structuredClone(current());
    offTurn.turn.player = opponent;
    expect(read.char.ap(offTurn, 'actor')).toBe(7000);
  });
});
