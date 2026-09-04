// qa: card:B08004:1a671f1699203588abc9b63b4ed1d94a1f5f07bf485a87e3994b1ec8ac4c4733
// qa: card:B08009:5bc4c2fb8ed9afc8431ba7b8e65a4fead59eca31cea20b10d135b9d4a4f03348
// qa: card:B08009:6b40bc9cc445b5df49373927a5f69d9cdec6822bf54820ddc202ad2320813f28
// qa: card:B08010:38eccfde695687765d7108092c527e0313a757b9727e6bbc3611a6c36a683c31
// qa: card:B08012:607ba7d26dee013822b17565ac5c9f2c03c2516cb035b4afd1c2af790202b7f2
// qa: card:B08014:2a32c78cf7b62305190752b36573450f943b15042251bf77b5df43534033469c
// qa: card:B08014:90bfc974760d0d9a615b85f1de072d737a508ae0235dfb8379a4406e3af1c039
// qa: card:B08016:07fa73b6ca16df88298a7eb2ba6d9709a8c57c77e947d70f0fd00bc2b45e2867

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07086 } from '@/cards/ct-p07/B07086';
import { B08004 } from '@/cards/ct-p08/B08004';
import { B08004P } from '@/cards/ct-p08/B08004P';
import { B08009 } from '@/cards/ct-p08/B08009';
import { B08010 } from '@/cards/ct-p08/B08010';
import { B08012 } from '@/cards/ct-p08/B08012';
import { B08012P } from '@/cards/ct-p08/B08012P';
import { B08014 } from '@/cards/ct-p08/B08014';
import { B08014P } from '@/cards/ct-p08/B08014P';
import { B08016 } from '@/cards/ct-p08/B08016';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HAIBARA = fixture('W175_HAIBARA', { names: ['灰原哀'], level: 5 });
const BLACK_A = fixture('W175_BLACK_A', { colors: ['黒'] });
const BLACK_B = fixture('W175_BLACK_B', { colors: ['黒'] });
const BLACK_C = fixture('W175_BLACK_C', { colors: ['黒'] });
const DECK_CARD = fixture('W175_DECK_CARD', { kind: 'event' });
const CHAR_TARGET = fixture('W175_CHAR_TARGET', { ap: 1000 });
const WALL_TARGET = fixture('W175_WALL_TARGET', { ap: 15000 });
const HIGO_BOND = fixture('W175_HIGO_BOND', { names: ['比護隆佑'] });
const SANADA_BOND = fixture('W175_SANADA_BOND', { names: ['真田貴大'] });
const BOND_REMOVER = fixture('W175_BOND_REMOVER', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'action:declare' },
    effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: 'bond', cause: 'effect' } },
    description: 'アクション宣言時にbondをリムーブする。',
    ruleRefs: ['rules/22-qa-action-contact.md'],
  }],
});
const MR_SELECTOR = fixture('W175_MR_SELECTOR', {
  rarity: 'MR',
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-partner-area',
    effect: {
      kind: 'atom', verb: 'charModifyAP',
      args: { player: 'self', side: 'self', max: 1, delta: 1000, scope: 'turn' },
    },
    description: '自分のキャラを1枚まで選びAP+1000する。', ruleRefs: ['rules/18-mr.md'],
  }],
});
const NON_MR_SELECTOR = fixture('W175_NON_MR_SELECTOR', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'charModifyAP',
      args: { player: 'self', side: 'self', max: 1, delta: 1000, scope: 'turn' },
    },
    description: '自分のキャラを1枚まで選びAP+1000する。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const OPP_MR_SELECTOR = fixture('W175_OPP_MR_SELECTOR', {
  rarity: 'MR',
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'action:declare' },
    effect: {
      kind: 'atom', verb: 'charModifyAP',
      args: { player: 'self', side: 'opp', max: 1, delta: 1000, scope: 'turn' },
    },
    description: '相手のキャラを1枚まで選びAP+1000する。', ruleRefs: ['rules/18-mr.md'],
  }],
});
const ATTACKER = fixture('W175_ATTACKER', { ap: 9000 });
const FIXTURES = [
  HAIBARA, BLACK_A, BLACK_B, BLACK_C, DECK_CARD, CHAR_TARGET, WALL_TARGET,
  HIGO_BOND, SANADA_BOND, BOND_REMOVER, MR_SELECTOR, NON_MR_SELECTOR,
  OPP_MR_SELECTOR, ATTACKER,
];
const B08004_PRINTS = [B08004, B08004P] as const;
const B08012_PRINTS = [B08012, B08012P] as const;
const B08014_PRINTS = [B08014, B08014P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave175 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave175-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: DECK_CARD.id }));
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
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

function b08004State(card: CardDef, owner: Player, ownAiActive: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 175, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['青', '黒'];
  state.players[owner].file = fileCards(5);
  state.players[owner].scene = [
    sceneChar(card.id, 'source', { state: 'sleep' }),
    sceneChar(HAIBARA.id, 'own-ai', { state: ownAiActive ? 'active' : 'sleep' }),
  ];
  state.players[other(owner)].scene = [sceneChar(HAIBARA.id, 'opp-ai', { state: 'active' })];
  state.players[owner].remove = [BLACK_A.id, BLACK_B.id, BLACK_C.id];
  return state;
}

describe('official QA Wave175: B08004/P stun cost is owner-only', () => {
  it.each(B08004_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner stuns its own active Ai and activates the source',
    ({ card, owner }) => {
      install(b08004State(card, owner, true), owner, `${card.id}-${owner}-own-ai`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { stunChar: { uids: ['own-ai'] } },
      })).toEqual({ ok: true });
      expect(current().players[owner].scene.find(character => character.uid === 'own-ai')?.state).toBe('stun');
      expect(current().players[owner].scene.find(character => character.uid === 'source')?.state).toBe('active');
      expect(current().players[other(owner)].scene.find(character => character.uid === 'opp-ai')?.state).toBe('active');
    },
  );

  it.each(B08004_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner rejects an opponent Ai when no own active Ai can pay',
    ({ card, owner }) => {
      install(b08004State(card, owner, false), owner, `${card.id}-${owner}-opponent-ai`);
      const before = JSON.stringify(current());
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { stunChar: { uids: ['opp-ai'] } },
      }), 'B08004/B08004P stun cost owner-only').toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    },
  );
});

describe('official QA Wave175: B08009 exact deck-top-two cost is owner-only', () => {
  it.each(['self', 'opp'] as const)('owner=%s rejects deck1 even when the opponent deck has enough cards', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 175, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08009.id, 'source', { state: 'active' })];
    state.players[owner].deck = [DECK_CARD.id];
    state.players[other(owner)].deck = Array.from({ length: 5 }, () => DECK_CARD.id);
    install(state, owner, `${owner}-deck-one`);
    const before = JSON.stringify(current());

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    }), 'B08009 exact owner deck-top-two cost').toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current()), 'B08009 rejected cost leaves the owner state unchanged').toBe(before);
  });
});

function finishCharacterAction(actionId: string, firstPlayer: Player): void {
  const secondPlayer = other(firstPlayer);
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: firstPlayer, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: secondPlayer, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

describe('official QA Wave175: Bond Assault loss does not cancel an action already started', () => {
  it.each(['self', 'opp'] as const)('B08010 owner=%s completes character contact after 比護隆佑 leaves', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 175, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B08010.id, 'actor', { state: 'active', isNamed: true }),
      sceneChar(HIGO_BOND.id, 'bond'), sceneChar(BOND_REMOVER.id, 'remover'),
    ];
    state.players[owner].deck = [DECK_CARD.id, DECK_CARD.id];
    state.players[other(owner)].scene = [sceneChar(CHAR_TARGET.id, 'target', { state: 'sleep' })];
    install(state, owner, `${owner}-b08010-bond-loss`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(current().players[owner].scene.some(character => character.uid === 'bond')).toBe(false);
    expect(read.char.keywords(current(), 'actor')).not.toContain('突撃[キャラ]');
    finishCharacterAction(actionId, other(owner));
    expect(current().players[other(owner)].remove, 'B08010 action continues after Bond loss').toContain(CHAR_TARGET.id);
    expect(current().players[owner].hand).toEqual([DECK_CARD.id]);
  });

  it.each(B08012_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner completes case evidence resolution after 真田貴大 leaves',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 175, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [
        sceneChar(card.id, 'actor', { state: 'active', isNamed: true }),
        sceneChar(SANADA_BOND.id, 'bond'), sceneChar(BOND_REMOVER.id, 'remover'),
      ];
      state.players[owner].deck = [DECK_CARD.id, DECK_CARD.id, DECK_CARD.id];
      state.players[other(owner)].case.status = '事件編';
      state.players[other(owner)].evidence = [{
        cardId: DECK_CARD.id, faceUp: false, origin: { turn: 1, via: 'opening' },
      }];
      install(state, owner, `${card.id}-${owner}-bond-loss`);

      expect(dispatchEngineAction({
        type: 'actionDeclareCase', byUid: 'actor', targetPlayer: other(owner),
      })).toEqual({ ok: true });
      const actionId = useGameStateStore.getState().activeActionId!;
      expect(current().players[owner].scene.some(character => character.uid === 'bond')).toBe(false);
      expect(read.char.keywords(current(), 'actor')).not.toContain('突撃[事件]');
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      expect(current().players[owner].evidence, 'B08012/B08012P case action continues after Bond loss').toHaveLength(1);
      expect(current().players[owner].hand).toEqual([DECK_CARD.id]);
    },
  );
});

function b08014State(card: CardDef, owner: Player, sourceKind: 'scene-mr' | 'partner-mr' | 'non-mr' | 'opp-mr'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 175, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(card.id, 'ran', { state: 'active', isNamed: true })];
  if (sourceKind === 'scene-mr') state.players[owner].scene.push(sceneChar(MR_SELECTOR.id, 'selector'));
  if (sourceKind === 'partner-mr') {
    state.players[owner].partnerAreaMR = sceneChar(MR_SELECTOR.id, `partnerMR:${owner}`);
  }
  if (sourceKind === 'non-mr') state.players[owner].scene.push(sceneChar(NON_MR_SELECTOR.id, 'selector'));
  if (sourceKind === 'opp-mr') state.players[other(owner)].scene.push(sceneChar(OPP_MR_SELECTOR.id, 'opp-selector'));
  state.players[other(owner)].scene.push(sceneChar(WALL_TARGET.id, 'wall', { state: 'sleep' }));
  state.players[owner].deck = Array.from({ length: 10 }, () => DECK_CARD.id);
  state.players[other(owner)].deck = Array.from({ length: 10 }, () => DECK_CARD.id);
  return state;
}

function selectRan(sourceUid: string, sourceCardId: string): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid, abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
  })).toEqual({ ok: true });
  const pick = pendingPick(sourceCardId, 'a1', 'charModifyAP');
  expect(pick.candidates.map(candidate => candidate.uid)).toContain('ran');
  choose(pick, 'ran');
}

function actAndEnd(owner: Player): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'ran', targetUid: 'wall' }))
    .toEqual({ ok: true });
  finishCharacterAction(useGameStateStore.getState().activeActionId!, owner);
  expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
}

describe('official QA Wave175: B08014/P remembers only own MR selection, including pre-action selection', () => {
  it.each(B08014_PRINTS.flatMap(card => (['self', 'opp'] as const).flatMap(owner => (
    (['scene-mr', 'partner-mr'] as const).map(sourceKind => ({ card, owner, sourceKind }))
  ))))('$card.id owner=$owner selected before action by own $sourceKind stays in scene at turn end',
    ({ card, owner, sourceKind }) => {
      install(b08014State(card, owner, sourceKind), owner, `${card.id}-${owner}-${sourceKind}`);
      selectRan(sourceKind === 'scene-mr' ? 'selector' : `partnerMR:${owner}`, MR_SELECTOR.id);
      actAndEnd(owner);
      expect(current().players[owner].scene.some(character => character.uid === 'ran'), // B08014/B08014P
        'B08014/B08014P own MR pre-action selection').toBe(true);
      expect(current().players[owner].hand).not.toContain(card.id);
    });

  it.each(B08014_PRINTS)('$id selected by an own non-MR still returns to hand', card => {
    install(b08014State(card, 'self', 'non-mr'), 'self', `${card.id}-non-mr`);
    selectRan('selector', NON_MR_SELECTOR.id);
    actAndEnd('self');
    expect(current().players.self.scene.some(character => character.uid === 'ran')).toBe(false);
    expect(current().players.self.hand, 'B08014/B08014P non-MR selection does not count').toContain(card.id);
  });

  it.each(['self', 'opp'] as const)('B08014 owner=%s selected by opponent MR still returns to hand', owner => {
    const selector = other(owner);
    install(b08014State(B08014, owner, 'opp-mr'), selector, `${owner}-opponent-mr`);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'ran', targetUid: 'wall' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    const pick = pendingPick(OPP_MR_SELECTOR.id, 'a1', 'charModifyAP');
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('ran');
    choose(pick, 'ran');
    finishCharacterAction(actionId, owner);
    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(current().players[owner].scene.some(character => character.uid === 'ran')).toBe(false);
    expect(current().players[owner].hand, 'B08014 opponent MR selection does not count').toContain(B08014.id);
  });
});

function removeB08016ByContact(owner: Player): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'wakita' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

describe('official QA Wave175: B08016 leave source joins refresh during draw two', () => {
  it.each(['self', 'opp'] as const)('owner=%s refreshes both the source and paid leave-trigger card', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 175, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08016.id, 'wakita', { state: 'sleep' })];
    state.players[owner].hand = [B07086.id];
    state.players[owner].deck = [DECK_CARD.id];
    state.players[other(owner)].scene = [sceneChar(ATTACKER.id, 'attacker', { state: 'active' })];
    install(state, owner, `${owner}-leave-source-refresh`);

    removeB08016ByContact(owner);
    resolveOptional(B08016.id, 'a2', true);
    const discard = pendingPick(B08016.id, 'a2', 'discard');
    choose(discard, discard.candidates.find(candidate => candidate.cardId === B07086.id)!.uid);

    expect(current().refreshCount[owner], 'B08016 draw two refresh').toBe(1);
    expect(current().players[owner].remove).toEqual([]);
    expect(current().players[owner].hand).toContain(DECK_CARD.id);
    expect([...current().players[owner].hand, ...current().players[owner].deck]
      .filter(cardId => cardId === B08016.id)).toHaveLength(1);
    expect([...current().players[owner].hand, ...current().players[owner].deck]
      .filter(cardId => cardId === B07086.id)).toHaveLength(1);
  });
});
