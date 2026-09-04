// qa: card:B03006:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:B03006:37377467cdad597a6fe6ba04a0d53e632d566c816eaf30883787f18494455515
// qa: card:B03006:4bef6ccb7a3be30a8edea1beddcf56b3c692493ea01d232ff7cb3c66f204829e
// qa: card:B03006:65709cd491955475ed0f1a461014d71f0916663a925330d1e51282fd54d837c9
// qa: card:B03006:68fb0e94dc13c307092295317aa78be4e90683f7e84fc72666b3afc6726eca17
// qa: card:B03006:950c4bb98b9fe526a2e73ea5f514307cc73bd2a98b45482770077be4a806d9a6
// qa: card:B03006:99d466bb5b8d3d19df265d685331c9162d564f4caafa3c8aeb1b9a743d99cbb6
// Rules: 07-action-flow.md, 15-abilities-effects.md, 16-card-set.md, 20-color-and-switch.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03006 } from '@/cards/ct-p03/B03006';
import { B03006P } from '@/cards/ct-p03/B03006P';
import { D08021 } from '@/cards/ct-d08/D08021';
import { B10022 } from '@/cards/ct-p10/B10022';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/pending-state';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const QA = {
  beforeGuard: 'card:B03006:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54',
  notSet: 'card:B03006:37377467cdad597a6fe6ba04a0d53e632d566c816eaf30883787f18494455515',
  reprints: 'card:B03006:4bef6ccb7a3be30a8edea1beddcf56b3c692493ea01d232ff7cb3c66f204829e',
  hostLeave: 'card:B03006:65709cd491955475ed0f1a461014d71f0916663a925330d1e51282fd54d837c9',
  privacy: 'card:B03006:68fb0e94dc13c307092295317aa78be4e90683f7e84fc72666b3afc6726eca17',
  switchCandidate: 'card:B03006:950c4bb98b9fe526a2e73ea5f514307cc73bd2a98b45482770077be4a806d9a6',
  ownerOrder: 'card:B03006:99d466bb5b8d3d19df265d685331c9162d564f4caafa3c8aeb1b9a743d99cbb6',
} as const;

const BOY_A = 'QA_B03006_BOY_A';
const BOY_B = 'QA_B03006_BOY_B';
const BOY_C = 'QA_B03006_BOY_C';
const TARGET = 'QA_B03006_TARGET';
const LEAVE_PROBE = 'QA_B03006_HIDDEN_LEAVE_PROBE';

function character(id: string, name = id, traits = ['少年探偵団']): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [name],
    colors: ['青'],
    level: 1,
    ap: id === TARGET ? 1000 : 2000,
    lp: 1,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const defs = [
  character(BOY_A, '少年A'),
  character(BOY_B, '少年B'),
  character(BOY_C, '少年C'),
  character(TARGET, '対象', []),
  {
    ...character(LEAVE_PROBE, '非公開の離場能力'),
    abilities: [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '現場からリムーブされたなら1枚引く',
      ruleRefs: [],
    }],
  },
];

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青'];
  state.players.self.file = Array.from(
    { length: 8 },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = [B03006.id];
  state.players.self.deck = ['QA_DRAW_1', 'QA_DRAW_2', 'QA_DRAW_3'];
  return state;
}

function install(state: GameState): void {
  resetPresentationQueue('qa-b03006-public-stack-lifecycle');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing state');
  return state;
}

function stackHost(): SceneCharacter {
  const host = current().players.self.scene.find((char) => char.cardId === B03006.id);
  if (!host) throw new Error('B03006 host missing');
  return host;
}

function useFromHand(action: 'normal' | { removeUid: string } = 'normal'): PendingEffectPickSide {
  const result = action === 'normal'
    ? dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03006.id })
    : dispatchEngineAction({ type: 'handUseCardSwitch', player: 'self', cardId: B03006.id, removeUid: action.removeUid });
  expect(result).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: 'self',
    atomVerb: 'charStackCard',
    nMin: 0,
    source: { cardId: B03006.id, abilityId: 'a1' },
    decisionId: expect.any(String),
  });
  return pending!;
}

function resolveStack(pending: PendingEffectPickSide, uids: string[]): ReturnType<typeof dispatchEngineAction> {
  if (uids.length === 0) {
    return dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: null,
    }));
  }
  return dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: uids[0]!,
    pickedUids: uids,
  }));
}

function stacked(cardIds: string[]): SceneCharacter['stackedCards'] {
  return cardIds.map((cardId, index) => ({ cardId, instanceId: `stack:team:${index}` }));
}

function actionState(stackCardIds: string[]): GameState {
  const state = base();
  state.players.self.hand = [];
  state.players.self.scene = [sceneChar(B03006.id, 'team', {
    stackedCards: stacked(stackCardIds),
    isNamed: false,
  })];
  state.players.opp.scene = [sceneChar(TARGET, 'target', { state: 'sleep' })];
  return state;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  defs.forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B03006 official-QA public stack lifecycle', () => {
  it(`${QA.reprints}: offers all three printings separately but rejects selecting the same printed name twice`, () => {
    const state = base();
    state.players.self.remove = [B03006.id, B03006P.id, D08021.id, BOY_A];
    install(state);
    const pending = useFromHand();
    expect(pending.candidates.map((candidate) => candidate.cardId)).toEqual([
      B03006.id, B03006P.id, D08021.id, BOY_A,
    ]);
    const uid = (cardId: string) => pending.candidates.find((candidate) => candidate.cardId === cardId)!.uid;
    const before = JSON.stringify(current());

    expect(resolveStack(pending, [uid(B03006.id), uid(D08021.id)]))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);

    expect(resolveStack(pending, [uid(B03006P.id), uid(BOY_A)])).toEqual({ ok: true });
    expect(stackHost().stackedCards).toEqual([
      expect.objectContaining({ cardId: B03006P.id }),
      expect.objectContaining({ cardId: BOY_A }),
    ]);
    expect(current().players.self.remove).toEqual([B03006.id, D08021.id]);
  });

  it(`${QA.notSet}: keeps a publicly selected under-card in stackedCards, never setCards or scene`, () => {
    const state = base();
    state.players.self.remove = [BOY_A];
    install(state);
    const pending = useFromHand();
    expect(resolveStack(pending, [pending.candidates[0]!.uid])).toEqual({ ok: true });

    expect(stackHost().stackedCards).toEqual([
      expect.objectContaining({ cardId: BOY_A, instanceId: expect.any(String) }),
    ]);
    expect(stackHost().setCards).toEqual([]);
    expect(current().players.self.scene.map((char) => char.cardId)).toEqual([B03006.id]);
  });

  it(`${QA.hostLeave}: moves every exact under-card to its owner's remove when the host leaves`, () => {
    const state = base();
    state.players.self.scene = [sceneChar(B10022.id, 'remover')];
    state.players.self.remove = [BOY_A, BOY_B];
    install(state);
    const stackPick = useFromHand();
    expect(resolveStack(stackPick, stackPick.candidates.map((candidate) => candidate.uid)))
      .toEqual({ ok: true });
    const hostUid = stackHost().uid;

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    const removePick = useGameStateStore.getState().pendingEffectPick!;
    expect(removePick.candidates.some((candidate) => candidate.uid === hostUid)).toBe(true);
    expect(dispatchEngineAction(bindPendingDecision(removePick, {
      type: 'effectPickResolve', pickedUid: hostUid,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.some((char) => char.uid === hostUid)).toBe(false);
    expect(current().players.self.remove.slice().sort()).toEqual([B03006.id, BOY_A, BOY_B].sort());
    expect(current().players.opp.remove).toEqual([]);
  });

  it(`${QA.privacy}: moves an under-card without exposing or firing its hidden on-scene ability`, () => {
    const state = base();
    state.players.self.scene = [sceneChar(B10022.id, 'remover')];
    state.players.self.remove = [LEAVE_PROBE];
    install(state);
    const stackPick = useFromHand();
    expect(resolveStack(stackPick, [stackPick.candidates[0]!.uid])).toEqual({ ok: true });
    const hostUid = stackHost().uid;

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    const removePick = useGameStateStore.getState().pendingEffectPick!;
    expect(dispatchEngineAction(bindPendingDecision(removePick, {
      type: 'effectPickResolve', pickedUid: hostUid,
    }))).toEqual({ ok: true });

    expect(current().players.self.remove.slice().sort()).toEqual([B03006.id, LEAVE_PROBE].sort());
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.deck).toEqual(['QA_DRAW_1', 'QA_DRAW_2', 'QA_DRAW_3']);
    expect(current().pendingEffects.every((entry) => entry.source.cardId !== LEAVE_PROBE)).toBe(true);
    expect(JSON.stringify(current().log)).not.toContain(LEAVE_PROBE);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it(`${QA.switchCandidate}: includes the exact public switch victim in the enter-trigger remove candidates`, () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(BOY_A, 'switch-victim'),
      sceneChar(BOY_B, 'filler-1'),
      sceneChar(BOY_B, 'filler-2'),
      sceneChar(BOY_C, 'filler-3'),
      sceneChar(BOY_C, 'filler-4'),
    ];
    state.players.self.remove = [BOY_B];
    install(state);
    const pending = useFromHand({ removeUid: 'switch-victim' });
    const switched = pending.candidates.find((candidate) => candidate.cardId === BOY_A)!;

    expect(switched).toMatchObject({ player: 'self', area: 'remove', cardId: BOY_A });
    expect(resolveStack(pending, [switched.uid])).toEqual({ ok: true });
    expect(current().players.self.scene.some((char) => char.uid === 'switch-victim')).toBe(false);
    expect(stackHost().stackedCards).toEqual([expect.objectContaining({ cardId: BOY_A })]);
  });

  it(`${QA.beforeGuard}: resolves the stack-three action trigger before the guard decision`, () => {
    install(actionState([BOY_A, BOY_B, BOY_C]));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'team', targetUid: 'target' }))
      .toEqual({ ok: true });

    expect(current().players.self.hand).toEqual(['QA_DRAW_1']);
    expect(current().players.self.deck).toEqual(['QA_DRAW_2', 'QA_DRAW_3']);
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toEqual(expect.any(String));
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
      .toEqual({ ok: true });

    install(actionState([BOY_A, BOY_B]));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'team', targetUid: 'target' }))
      .toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.deck).toEqual(['QA_DRAW_1', 'QA_DRAW_2', 'QA_DRAW_3']);
  });

  it(`${QA.ownerOrder}: lets the owner order stack-five draw and evidence before guard`, () => {
    install(actionState([BOY_A, BOY_B, BOY_C, B03006P.id, D08021.id]));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'team', targetUid: 'target' }))
      .toEqual({ ok: true });
    const group = current().pendingEffects.filter((entry) => entry.state === 'pending');
    expect(group.map((entry) => entry.source.abilityId).sort()).toEqual(['a3', 'a4']);
    expect(new Set(group.map((entry) => entry.triggerBatch)).size).toBe(1);
    const evidence = group.find((entry) => entry.source.abilityId === 'a4')!;

    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: evidence.id, order: 0, player: 'self' }))
      .toEqual({ ok: true });
    const ordered = current().pendingEffects
      .filter((entry) => entry.state === 'pending')
      .sort((a, b) => (a.ownerChosenOrder ?? Infinity) - (b.ownerChosenOrder ?? Infinity));
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
    })).toEqual({ ok: true });

    expect(current().players.self.evidence.map((card) => card.cardId)).toEqual(['QA_DRAW_1']);
    expect(current().players.self.hand).toEqual(['QA_DRAW_2']);
    expect(current().players.self.deck).toEqual(['QA_DRAW_3']);
    expect(useGameStateStore.getState().activeActionId).toEqual(expect.any(String));
  });
});
