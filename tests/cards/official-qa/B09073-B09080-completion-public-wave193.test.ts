// qa: card:B09073:6f84244014e18679f78a5ae0b96cec21787fc34c207c0c4ba6935a6b198b5b03
// qa: card:B09074:94b5f9ac6b539ddcff7e29f747ed02143be59ad6baacbb89e3a61038c9964adf
// qa: card:B09075:7505735302078534653e21e817caddde9141485ccd57604acac1b5b532a6b765
// qa: card:B09078:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B09078:60bc571b2b7fbd182856b3fc57ec8ed167504073a034957e36be8fe49059137b
// qa: card:B09078:b12f43e33fad16d06ae71349d7a99edf1e732707da24c745d2874072861502f1
// qa: card:B09080:baf591af1a71b89c3e45ee478080278addb5fcda9d66647ac2fb576ead16fb0a
// qa: card:B09080:e708bf24cffc57978de99d717908363a3a03482fcf5db48da0af7d4c282c09fa
// Rules: 14, 15, 17, 19, 24, 26. Public owner mirrors for CT-P09 Wave193.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09073 } from '@/cards/ct-p09/B09073';
import { B09074 } from '@/cards/ct-p09/B09074';
import { B09075 } from '@/cards/ct-p09/B09075';
import { B09078 } from '@/cards/ct-p09/B09078';
import { B09080 } from '@/cards/ct-p09/B09080';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
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

const FILLER = fixture('W193_FILLER');
const SHIPPU_INACTIVE = fixture('W193_SHIPPU_INACTIVE', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', condition: { kind: 'caseStatus', status: '解決編' },
    trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【解決編】【疾風】', ruleRefs: ['rules/17-icons.md'],
  }],
});
const POLICE_TARGET = fixture('W193_POLICE_TARGET', { traits: ['警察'], level: 6 });
const LOOK_CHARACTER = fixture('W193_LOOK_CHARACTER', { colors: ['黄'] });
const LOOK_EVENT = fixture('W193_LOOK_EVENT', { kind: 'event', colors: ['白'] });
const LOOK_DECOY = fixture('W193_LOOK_DECOY', { colors: ['赤'] });
const LOOK_TAIL = fixture('W193_LOOK_TAIL', { kind: 'event' });
const LEVEL_SEVEN = fixture('W193_LEVEL_SEVEN', { level: 7 });
const LEVEL_EIGHT = fixture('W193_LEVEL_EIGHT', { level: 8 });
const SATO = fixture('W193_SATO', { names: ['佐藤美和子'], ap: 3000 });
const ACTION_TARGET = fixture('W193_ACTION_TARGET', { ap: 1000 });
const ORDER_DRAW = fixture('W193_ORDER_DRAW', { kind: 'event' });
const ENTRY_AMURO = fixture('W193_ENTRY_AMURO', {
  names: ['安室透'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【登場時】カードを1枚引く。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const ENTRY_SOURCE = fixture('W193_ENTRY_SOURCE', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneEnter', args: {
      player: 'self', cardId: ENTRY_AMURO.id, viaEffect: true,
      target: { query: { area: 'remove', side: 'self' } },
    } },
    description: 'テスト用に安室透を登場させる。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const BOND_REMOVER = fixture('W193_BOND_REMOVER', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'action:declare' },
    effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: 'sato', cause: 'effect' } },
    description: 'アクション宣言時に佐藤美和子をリムーブする。', ruleRefs: ['rules/22-qa-action-contact.md'],
  }],
});
const FIXTURES = [
  FILLER, SHIPPU_INACTIVE, POLICE_TARGET, LOOK_CHARACTER, LOOK_EVENT, LOOK_DECOY, LOOK_TAIL,
  LEVEL_SEVEN, LEVEL_EIGHT, SATO, ACTION_TARGET, ORDER_DRAW, ENTRY_AMURO, ENTRY_SOURCE, BOND_REMOVER,
];

function other(player: Player): Player { return player === 'self' ? 'opp' : 'self'; }

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave193 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave193-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function sourceUid(owner: Player, cardId: string): string {
  const source = current().players[owner].scene.find(entry => entry.cardId === cardId);
  if (!source) throw new Error(`missing ${cardId}/${owner}`);
  return source.uid;
}

function fileCards(count: number): Array<{ type: 'card-back'; cardId: string }> {
  return Array.from({ length: count }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function pendingPick(cardId: string, owner: Player, abilityId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${cardId}: ${atomVerb} public authority`).toMatchObject({
    ownerPlayer: owner, atomVerb, source: { cardId, abilityId },
  });
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>, pickedUid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function settle(): void {
  surfacePendingSideChannels();
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  expect(current().pendingEffects.filter(entry => entry.state !== 'resolved').map(entry => ({
    state: entry.state, source: entry.source.cardId, ability: entry.source.abilityId,
  }))).toEqual([]);
}

function finishCharacterAction(actionId: string, firstPlayer: Player): void {
  const secondPlayer = other(firstPlayer);
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: firstPlayer, choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: secondPlayer, choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  flow.action._resetActionContexts();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave193: public owner mirrors', () => {
  it.each(['self', 'opp'] as const)('B09073 owner=%s recognizes an inactive printed Shippu ability', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '事件編';
    state.players[owner].scene = [sceneChar(B09073.id, 'source'), sceneChar(SHIPPU_INACTIVE.id, 'inactive')];
    install(state, owner, `${owner}-B09073-printed-shippu`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0 })).toEqual({ ok: true });
    choose(pendingPick(B09073.id, owner, 'a1', 'sceneRemove'), null);
    expect(current().players[owner].scene.find(entry => entry.uid === 'source')?.state).toBe('sleep');
    settle();
  });

  it.each(['self', 'opp'] as const)('B09074 owner=%s may resolve Shippu before its ordinary enter ability', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.turnState[owner].enterCountThisTurn = 0;
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(4);
    state.players[owner].hand = [B09074.id];
    state.players[owner].deck = [LOOK_TAIL.id, LOOK_DECOY.id, LOOK_EVENT.id, LOOK_CHARACTER.id, LOOK_DECOY.id];
    install(state, owner, `${owner}-B09074-order`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B09074.id })).toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), owner);
    expect(group.map(entry => entry.source.abilityId).sort()).toEqual(['a1', 'a2']);
    const shippu = group.find(entry => entry.source.abilityId === 'a1')!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', player: owner, entryId: shippu.id, order: 0 })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner);
    expect(ordered[0]?.source.abilityId).toBe('a1');
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id) })).toEqual({ ok: true });
    const ordinaryPick = pendingPick(B09074.id, owner, 'a2', 'deckRevealUntil');
    expect(ordinaryPick.candidates).toEqual([]);
    choose(ordinaryPick, null);
    expect(current().players[owner].hand).toContain(LOOK_TAIL.id);
    settle();
  });

  it.each(['self', 'opp'] as const)('B09075 owner=%s may switch out the newly entered source for its Shippu entrant', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '解決編';
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(7);
    state.turnState[owner].enterCountThisTurn = 0;
    state.players[owner].scene = Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER.id, `fill-${index}`));
    state.players[owner].hand = [B09075.id];
    state.players[owner].remove = [POLICE_TARGET.id];
    install(state, owner, `${owner}-B09075-full-scene`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B09075.id })).toEqual({ ok: true });
    const source = sourceUid(owner, B09075.id);
    const pick = pendingPick(B09075.id, owner, 'a1', 'sceneEnter');
    const entrant = pick.candidates.find(candidate => candidate.cardId === POLICE_TARGET.id);
    expect(entrant).toBeTruthy();
    choose(pick, entrant!.uid, source);
    expect(current().players[owner].scene.some(entry => entry.cardId === POLICE_TARGET.id)).toBe(true);
    expect(current().players[owner].remove).toContain(B09075.id);
    settle();
  });

  it.each(['self', 'opp'] as const)('B09078 owner=%s independently takes the character and declines the event', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '事件編';
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(4);
    state.players[owner].hand = [B09078.id];
    state.players[owner].deck = [LOOK_CHARACTER.id, LOOK_EVENT.id, LOOK_DECOY.id, LOOK_TAIL.id];
    install(state, owner, `${owner}-B09078-independent-picks`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B09078.id })).toEqual({ ok: true });
    const characterPick = pendingPick(B09078.id, owner, 'a1', 'handAddFromDeck');
    const character = characterPick.candidates.find(candidate => candidate.cardId === LOOK_CHARACTER.id);
    expect(character).toBeTruthy();
    choose(characterPick, character!.uid);
    choose(pendingPick(B09078.id, owner, 'a1', 'handAddFromDeck'), null);
    expect(current().players[owner].hand).toContain(LOOK_CHARACTER.id);
    expect(current().players[owner].hand).not.toContain(LOOK_EVENT.id);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([LOOK_EVENT.id, LOOK_DECOY.id]));
    settle();
  });

  it.each(['self', 'opp'] as const)('B09078 owner=%s applies its level reduction to later level reads', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '解決編';
    state.players[owner].scene = [sceneChar(B09078.id, 'source'), sceneChar(ENTRY_SOURCE.id, 'entry-source')];
    state.players[owner].remove = [ENTRY_AMURO.id];
    state.players[owner].deck = [ORDER_DRAW.id];
    state.players[other(owner)].scene = [sceneChar(LEVEL_SEVEN.id, 'level-seven'), sceneChar(LEVEL_EIGHT.id, 'level-eight')];
    install(state, owner, `${owner}-B09078-level`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'entry-source', abilId: 'a1' })).toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), owner);
    const b09078 = group.find(entry => entry.source.cardId === B09078.id);
    const amuro = group.find(entry => entry.source.cardId === ENTRY_AMURO.id);
    expect([b09078?.source.abilityId, amuro?.source.abilityId]).toEqual(['a2', 'a1']);
    expect(dispatchEngineAction({ type: 'setEffectOrder', player: owner, entryId: b09078!.id, order: 0 })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner);
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id) })).toEqual({ ok: true });
    const pick = pendingPick(B09078.id, owner, 'a2', 'charModifyLevel');
    const target = pick.candidates.find(candidate => candidate.uid === 'level-seven');
    expect(target).toBeTruthy();
    choose(pick, target!.uid);
    expect(readChar.level(current(), 'level-seven')).toBe(6);
    expect(readChar.level(current(), 'level-eight')).toBe(8);
    settle();
  });

  it.each(['self', 'opp'] as const)('B09078 owner=%s may order its group trigger before the entered character trigger', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '解決編';
    state.players[owner].scene = [sceneChar(B09078.id, 'source'), sceneChar(ENTRY_SOURCE.id, 'entry-source')];
    state.players[owner].remove = [ENTRY_AMURO.id];
    state.players[owner].deck = [ORDER_DRAW.id];
    state.players[other(owner)].scene = [sceneChar(LEVEL_SEVEN.id, 'level-seven')];
    install(state, owner, `${owner}-B09078-order`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'entry-source', abilId: 'a1' })).toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), owner);
    const b09078 = group.find(entry => entry.source.cardId === B09078.id)!;
    const amuro = group.find(entry => entry.source.cardId === ENTRY_AMURO.id)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', player: owner, entryId: b09078.id, order: 0 })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner);
    expect(ordered.map(entry => entry.id)).toEqual([b09078.id, amuro.id]);
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id) })).toEqual({ ok: true });
    const pick = pendingPick(B09078.id, owner, 'a2', 'charModifyLevel');
    choose(pick, pick.candidates.find(candidate => candidate.uid === 'level-seven')!.uid);
    expect(current().players[owner].hand).toContain(ORDER_DRAW.id);
    settle();
  });

  it.each(['self', 'opp'] as const)('B09080 owner=%s grants and immediately removes the opponent-turn Sato aura', owner => {
    const turnPlayer = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 193, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09080.id, 'source', { state: 'sleep' }), sceneChar(SATO.id, 'sato'), sceneChar(BOND_REMOVER.id, 'remover')];
    state.players[turnPlayer].scene = [sceneChar(ACTION_TARGET.id, 'actor', { state: 'active' })];
    install(state, turnPlayer, `${owner}-B09080-aura`);
    expect(readChar.ap(current(), 'sato')).toBe(4000);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'source' })).toEqual({ ok: true });
    expect(current().players[owner].scene.some(entry => entry.uid === 'sato')).toBe(false);
    expect(readChar.ap(current(), 'source')).toBe(5000);
  });

  it.each(['self', 'opp'] as const)('B09080 owner=%s completes a named Assault action after its Bond is lost', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 193, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09080.id, 'actor', { state: 'active', isNamed: true }),
      sceneChar(SATO.id, 'sato'), sceneChar(BOND_REMOVER.id, 'remover'),
    ];
    state.players[owner].deck = [LOOK_TAIL.id];
    state.players[other(owner)].scene = [sceneChar(ACTION_TARGET.id, 'target', { state: 'sleep' })];
    install(state, owner, `${owner}-B09080-action`);
    expect(readChar.keywords(current(), 'actor')).toContain('突撃');
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(current().players[owner].scene.some(entry => entry.uid === 'sato')).toBe(false);
    expect(readChar.keywords(current(), 'actor')).not.toContain('突撃');
    finishCharacterAction(actionId, other(owner));
    expect(current().players[other(owner)].remove).toContain(ACTION_TARGET.id);
  });
});
