// qa: card:B06005:199a933934b344f7715091799edd9442eca983c85cb7953418d8f7e9f0d4f2a6
// qa: card:B06006:199a933934b344f7715091799edd9442eca983c85cb7953418d8f7e9f0d4f2a6
// qa: card:B06008:199a933934b344f7715091799edd9442eca983c85cb7953418d8f7e9f0d4f2a6
// qa: card:B08002:68d445866ed87d221a9315fc087e0d32239a90ec310f21e941fa4d351c217273
// qa: card:B08003:10bd9f3489bbc88f8f3e3ac0f0e6b110dfe51b7c1965ed803cfb0b89324189d3
// qa: card:B08006:2c1155eae7578c77693fb91fa23a0be3cb78c471038868be1123694a6f6b1118
// qa: card:B08008:2c1155eae7578c77693fb91fa23a0be3cb78c471038868be1123694a6f6b1118
// qa: card:D08021:10bd9f3489bbc88f8f3e3ac0f0e6b110dfe51b7c1965ed803cfb0b89324189d3
// qa: card:D10009:199a933934b344f7715091799edd9442eca983c85cb7953418d8f7e9f0d4f2a6
// qa: card:D10010:199a933934b344f7715091799edd9442eca983c85cb7953418d8f7e9f0d4f2a6
// qa: card:PR289:2c1155eae7578c77693fb91fa23a0be3cb78c471038868be1123694a6f6b1118
// qa: card:PR295:2c1155eae7578c77693fb91fa23a0be3cb78c471038868be1123694a6f6b1118
// Rules: 05, 07, 13, 15, 16, 17, 18, 21, 22, 25.
// Public actions and decisions prove that under-cards remain physical identities,
// but do not become scene characters or contribute names, traits, or abilities.

import { produce } from 'immer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06005 } from '@/cards/ct-p06/B06005';
import { B06005P } from '@/cards/ct-p06/B06005P';
import { B06006 } from '@/cards/ct-p06/B06006';
import { B06008 } from '@/cards/ct-p06/B06008';
import { B06008P } from '@/cards/ct-p06/B06008P';
import { B08002 } from '@/cards/ct-p08/B08002';
import { B08002P } from '@/cards/ct-p08/B08002P';
import { B08003 } from '@/cards/ct-p08/B08003';
import { B08003P } from '@/cards/ct-p08/B08003P';
import { B08006 } from '@/cards/ct-p08/B08006';
import { B08008 } from '@/cards/ct-p08/B08008';
import { D08021 } from '@/cards/ct-d08/D08021';
import { D10009 } from '@/cards/ct-d10/D10009';
import { D10010 } from '@/cards/ct-d10/D10010';
import { B10022 } from '@/cards/ct-p10/B10022';
import { PR289 } from '@/cards/pr-01/PR289';
import { PR295 } from '@/cards/pr-01/PR295';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

const PROBE = character('W33-STACK-PROBE', {
  names: ['重なり能力プローブ'],
  traits: ['少年探偵団'],
  abilities: [
    {
      id: 'action-probe',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'action:declare', selfOnly: false },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '現場でアクションが宣言されたなら1枚引く。',
      ruleRefs: [],
    },
    {
      id: 'leave-probe',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '現場からリムーブされたなら1枚引く。',
      ruleRefs: [],
    },
  ],
});
const BOY_2 = character('W33-BOY-2', { names: ['少年二'], traits: ['少年探偵団'] });
const BOY_3 = character('W33-BOY-3', { names: ['少年三'], traits: ['少年探偵団'] });
const BOY_4 = character('W33-BOY-4', { names: ['少年四'], traits: ['少年探偵団'] });
const BOY_5 = character('W33-BOY-5', { names: ['少年五'], traits: ['少年探偵団'] });
const BOY_L8 = character('W33-BOY-L8', { names: ['少年八'], level: 8, traits: ['少年探偵団'] });
const BLUE_HOST = character('W33-BLUE-HOST', { names: ['青ホスト'], colors: ['青'] });
const RAN = character('W33-RAN', { names: ['毛利蘭'] });
const TARGET = character('W33-TARGET', { names: ['対象'], colors: ['赤'], ap: 1000 });
const DRAW_1 = character('W33-DRAW-1');
const DRAW_2 = character('W33-DRAW-2');
const CASE_SR: CardDef = {
  id: 'W33-CASE-SR', no: 'test/W33-CASE-SR', kind: 'case', names: ['事件'],
  colors: ['青'], traits: [], caseTraits: ['シャッフルロマンス'], caseLevel: 7,
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const FIXTURES = [PROBE, BOY_2, BOY_3, BOY_4, BOY_5, BOY_L8, BLUE_HOST, RAN, TARGET, DRAW_1, DRAW_2, CASE_SR];

function character(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...overrides,
  };
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青'];
  state.players.self.file = Array.from(
    { length: 9 },
    () => ({ type: 'card-back' as const, cardId: 'W33-FILE' }),
  );
  state.players.self.deck = [DRAW_1.id, DRAW_2.id];
  return state;
}

function install(state: GameState, label = 'state'): void {
  resetPresentationQueue(`qa-wave33-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function pending(verb?: string): PendingPick {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  if (verb) expect(pick?.atomVerb).toBe(verb);
  return pick!;
}

function resolvePick(pick: PendingPick, uids: string[]): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve',
    pickedUid: uids[0] ?? null,
    ...(uids.length > 1 ? { pickedUids: uids } : {}),
  }))).toEqual({ ok: true });
}

function host(cardId: string): SceneCharacter {
  const result = current().players.self.scene.find(character => character.cardId === cardId);
  if (!result) throw new Error(`missing host ${cardId}`);
  return result;
}

function finishContact(actionId: string, first: Player, second: Player): void {
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: first, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: second, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('Wave33 official-QA public stacked-card semantics', () => {
  it('keeps every parallel printing structurally equivalent', () => {
    expect(B06005P.abilities).toEqual(B06005.abilities);
    expect(B06008P.abilities).toEqual(B06008.abilities);
    expect(B08002P.abilities).toEqual(B08002.abilities);
    expect(B08003P.abilities).toEqual(B08003.abilities);
  });

  it('uses the B08002 partner-area declaration without adding the selected card to scene', () => {
    const state = base();
    state.players.self.partnerAreaMR = makeChar({ cardId: B08002.id, uid: 'pa-mr' });
    state.players.self.scene = [makeChar({ cardId: BLUE_HOST.id, uid: 'blue-host' })];
    state.players.self.remove = [PROBE.id];
    install(state, 'b08002');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pa-mr', abilId: 'a2' }))
      .toEqual({ ok: true });
    const hostPick = pending('bindPick');
    expect(hostPick.candidates.map(candidate => candidate.uid)).toEqual(['blue-host']);
    resolvePick(hostPick, ['blue-host']);
    const stackPick = pending('charStackCard');
    resolvePick(stackPick, [stackPick.candidates[0]!.uid]);

    expect(current().players.self.scene.map(character => character.uid)).toEqual(['blue-host']);
    expect(host(BLUE_HOST.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: PROBE.id, instanceId: expect.any(String) }),
    ]);
    expect(host(BLUE_HOST.id).setCards).toEqual([]);
  });

  it.each([
    { source: B06005, remove: [PROBE.id], stacked: PROBE.id },
    { source: B06006, remove: [], stacked: PROBE.id },
    { source: B08003, remove: [BOY_L8.id], stacked: BOY_L8.id },
  ])('$source.id enters publicly and keeps the selected physical card only under its host', ({ source, remove, stacked }) => {
    const state = base();
    state.players.self.hand = [source.id];
    state.players.self.remove = [...remove];
    if (source.id === B06006.id) state.players.self.deck = [PROBE.id, DRAW_1.id, DRAW_2.id];
    install(state, source.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: source.id }))
      .toEqual({ ok: true });
    const stackPick = pending('charStackCard');
    const selected = stackPick.candidates.find(candidate => candidate.cardId === stacked);
    expect(selected).toBeDefined();
    resolvePick(stackPick, [selected!.uid]);

    expect(current().players.self.scene.map(character => character.cardId)).toEqual([source.id]);
    expect(host(source.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: stacked, instanceId: expect.any(String) }),
    ]);
    expect(host(source.id).setCards).toEqual([]);
  });

  it('binds B08008 to one public blue host, then grants only when a remove card is stacked', () => {
    const state = base();
    state.players.self.hand = [B08008.id];
    state.players.self.scene = [makeChar({ cardId: BLUE_HOST.id, uid: 'blue-host' })];
    state.players.self.remove = [PROBE.id];
    install(state, 'b08008');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08008.id }))
      .toEqual({ ok: true });
    const hostPick = pending('bindPick');
    resolvePick(hostPick, ['blue-host']);
    const stackPick = pending('charStackCard');
    resolvePick(stackPick, [stackPick.candidates[0]!.uid]);

    expect(current().players.self.scene.map(character => character.cardId).sort())
      .toEqual([B08008.id, BLUE_HOST.id].sort());
    expect(host(BLUE_HOST.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: PROBE.id, instanceId: expect.any(String) }),
    ]);
    expect(host(BLUE_HOST.id).turnEffects.actionTargetsActive).toBe(true);
  });

  it('counts five D08021 under-cards, but never registers the stacked probe as an action source', () => {
    const state = base();
    state.players.self.hand = [D08021.id];
    state.players.self.remove = [PROBE.id, BOY_2.id, BOY_3.id, BOY_4.id, BOY_5.id];
    state.players.opp.scene = [makeChar({ cardId: TARGET.id, uid: 'target', state: 'sleep' })];
    install(state, 'd08021');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: D08021.id }))
      .toEqual({ ok: true });
    const stackPick = pending('charStackCard');
    resolvePick(stackPick, stackPick.candidates.map(candidate => candidate.uid));
    const team = host(D08021.id);

    expect(current().players.self.scene).toHaveLength(1);
    expect(team.stackedCards).toHaveLength(5);
    expect(readChar.keywords(current(), team.uid)).toContain('突撃');
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: team.uid, targetUid: 'target' }))
      .toEqual({ ok: true });
    const sources = current().pendingEffects
      .filter(entry => entry.state === 'pending')
      .map(entry => `${entry.source.cardId}:${entry.source.abilityId}`)
      .sort();
    expect(sources).toEqual([`${D08021.id}:a3`, `${D08021.id}:a4`]);
    expect(sources.some(source => source.startsWith(`${PROBE.id}:`))).toBe(false);
  });

  it('preserves B08006 hand identity through JSON round-trip and public host removal without firing it', () => {
    const state = base();
    state.players.self.hand = [PROBE.id];
    state.players.self.scene = [
      makeChar({ cardId: B08006.id, uid: 'genta' }),
      makeChar({ cardId: B10022.id, uid: 'remover' }),
    ];
    install(state, 'b08006');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'genta', abilId: 'a1' }))
      .toEqual({ ok: true });
    const removeChoice = pending('sceneRemove');
    resolvePick(removeChoice, []);
    expect(host(B08006.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: PROBE.id, instanceId: expect.any(String) }),
    ]);

    install(JSON.parse(JSON.stringify(current())) as GameState, 'b08006-round-trip');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    const hostRemove = pending('sceneRemove');
    resolvePick(hostRemove, ['genta']);

    expect(current().players.self.remove).toEqual([PROBE.id, B08006.id]);
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.deck).toEqual([DRAW_1.id, DRAW_2.id]);
    expect(current().pendingEffects.every(entry => entry.source.cardId !== PROBE.id)).toBe(true);
  });

  it.each([D10009, D10010])('$id stacks Ran publicly, then ignores that name for its end-phase bond', source => {
    const state = base();
    state.players.self.case = {
      cardId: CASE_SR.id, status: '事件編', requiredEvidence: 7,
      colors: ['青'], declaredUseCount: {},
    };
    state.players.self.scene = [
      makeChar({ cardId: source.id, uid: 'shinichi' }),
      makeChar({ cardId: RAN.id, uid: 'ran' }),
    ];
    install(state, source.id);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'shinichi', abilId: 'a2' }))
      .toEqual({ ok: true });
    const ranPick = pending('charStackCard');
    resolvePick(ranPick, ['ran']);
    expect(host(source.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: RAN.id, instanceId: expect.any(String) }),
    ]);
    expect(current().players.self.scene.map(character => character.uid)).toEqual(['shinichi']);
    expect(readChar.keywords(current(), 'shinichi')).toContain('突撃[キャラ]');

    const afterEnd = produce(current(), draft => {
      event.emit(draft, 'phase:end:start', {}, { player: 'self', cardId: source.id, uid: 'shinichi' });
      runAllUntilEmpty(draft);
    });
    expect(afterEnd.players.self.scene).toEqual([]);
    expect(afterEnd.players.self.remove).toEqual([RAN.id, source.id]);
  });

  it.each([PR289, PR295])('$id pays its public scene-stack cost without leaving a second scene character', source => {
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: source.id, uid: 'mitsuhiko' }),
      makeChar({ cardId: PROBE.id, uid: 'boy' }),
    ];
    install(state, source.id);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'mitsuhiko', abilId: 'a2' }))
      .toEqual({ ok: true });
    expect(current().players.self.scene.map(character => character.uid)).toEqual(['mitsuhiko']);
    expect(host(source.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: PROBE.id, instanceId: expect.any(String) }),
    ]);
    expect(current().players.self.hand).toEqual([DRAW_1.id]);
    expect(current().pendingEffects.every(entry => entry.source.cardId !== PROBE.id)).toBe(true);
  });

  it.each([B06008, B06008P])('$id moves itself under a public host at action end and draws once', source => {
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: source.id, uid: 'yaiba' }),
      makeChar({ cardId: BLUE_HOST.id, uid: 'blue-host' }),
    ];
    state.players.opp.scene = [makeChar({ cardId: TARGET.id, uid: 'target', state: 'sleep' })];
    install(state, source.id);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'yaiba', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    finishContact(actionId, 'opp', 'self');
    const hostPick = pending('charStackCard');
    resolvePick(hostPick, ['blue-host']);

    expect(current().players.self.scene.map(character => character.uid)).toEqual(['blue-host']);
    expect(host(BLUE_HOST.id).stackedCards).toEqual([
      expect.objectContaining({ cardId: source.id, instanceId: expect.any(String) }),
    ]);
    expect(current().players.self.hand).toEqual([DRAW_1.id]);
    expect(current().players.self.remove).toEqual([]);
  });
});
