// qa: card:B07057:ec2375a3f1cb75173b86dce90a88c98de54b4cb067e31cb4cab39e70cf95a397
// qa: card:B07058:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4
// qa: card:B07063:4817933d3e6d75ad5a8cf8fb0d4dba37ecef8e73b6dc38f289f373fbcb0cc17c
// qa: card:B07063:6b43e7ba79236923475384e74095e6c8239d462b6b081ea0f62e4d27c5f0822d
// qa: card:B07063:75edfe05459c88c1631a546713e3bb9b549373aecfc4fd478e7b993763d00cb0
// qa: card:B07063:9ff6b1c95533df252cb9c0ccaa9eec999b9e41014863ce76c108522b00b523f7
// qa: card:B07065:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07068:426886de8581b320e3ebb09308f95cdb635a8c7c5a9cea88b3333ff26606f83d
// qa: card:B07068:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B07068:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07057 } from '@/cards/ct-p07/B07057';
import { B07057P } from '@/cards/ct-p07/B07057P';
import { B07058 } from '@/cards/ct-p07/B07058';
import { B07058P } from '@/cards/ct-p07/B07058P';
import { B07063 } from '@/cards/ct-p07/B07063';
import { B07063P } from '@/cards/ct-p07/B07063P';
import { B07065 } from '@/cards/ct-p07/B07065';
import { B07065P } from '@/cards/ct-p07/B07065P';
import { B07068 } from '@/cards/ct-p07/B07068';
import { B07068P } from '@/cards/ct-p07/B07068P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const RED_PARTNER = fixture('W170_RED_PARTNER', { kind: 'partner', level: undefined, ap: undefined, lp: 1, colors: ['赤'] });
const RED_MAGIC_CASE = fixture('W170_RED_MAGIC_CASE', {
  kind: 'case', level: undefined, ap: undefined, lp: undefined, traits: [], caseTraits: ['赤魔術'],
});
const PLAIN_CASE = fixture('W170_PLAIN_CASE', { kind: 'case', level: undefined, ap: undefined, lp: undefined });
const KID = fixture('W170_KID', { names: ['黒羽快斗'], ap: 4000 });
const TARGET = fixture('W170_TARGET', { ap: 3000 });
const DRAW = fixture('W170_DRAW', { kind: 'event' });
const HAND = fixture('W170_HAND', { kind: 'event' });
const WHITE_L3 = fixture('W170_WHITE_L3', { colors: ['白'], level: 3 });
const ACTOR_7000 = fixture('W170_ACTOR_7000', { ap: 7000 });
const ACTOR_6000 = fixture('W170_ACTOR_6000', { ap: 6000 });
const HS_EFFECTIVE_ZERO = fixture('W170_HS_EFFECTIVE_ZERO', { lp: 1, traits: ['高校生'] });
const HS_PRINTED_ZERO = fixture('W170_HS_PRINTED_ZERO', { lp: 0, traits: ['高校生'] });
const HS_NEGATIVE = fixture('W170_HS_NEGATIVE', { lp: 0, traits: ['高校生'] });
const FILLER = fixture('W170_FILLER', { ap: 2000 });
const RED_ENTRY = fixture('W170_RED_ENTRY', {
  colors: ['赤'], level: 5,
  abilities: [{
    id: 'enter-draw', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【登場時】カードを1枚引く。', ruleRefs: ['rules/17-icons.md'],
  }],
});
const BOOSTER = fixture('W170_BOOSTER', {
  abilities: [{
    id: 'boost', type: 'triggered', scope: 'on-scene', trigger: { hook: 'action:declare' },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$trigger.byUid', delta: 2000, scope: 'turn' } },
    description: 'アクションしたキャラをAP+2000。', ruleRefs: ['rules/07-action-flow.md'],
  }],
});
const FIXTURES = [
  RED_PARTNER, RED_MAGIC_CASE, PLAIN_CASE, KID, TARGET, DRAW, HAND, WHITE_L3,
  ACTOR_7000, ACTOR_6000, HS_EFFECTIVE_ZERO, HS_PRINTED_ZERO, HS_NEGATIVE, FILLER, RED_ENTRY, BOOSTER,
];
const B07057_PRINTS = [B07057, B07057P] as const;
const B07058_PRINTS = [B07058, B07058P] as const;
const B07063_PRINTS = [B07063, B07063P] as const;
const B07065_PRINTS = [B07065, B07065P] as const;
const B07068_PRINTS = [B07068, B07068P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: DRAW.id }));
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave170 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave170-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(
  pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>,
  pickedUid: string | null,
  switchRemoveUid?: string,
): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
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

describe('official QA Wave170: B07057/P draw is independent of the Assault target', () => {
  it.each(B07057_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner bounces Kaito, declines the target, and still draws one',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['白'];
      state.players[owner].file = fileCards(5);
      state.players[owner].hand = [card.id];
      state.players[owner].scene = [sceneChar(KID.id, 'kaito'), sceneChar(TARGET.id, 'target')];
      state.players[owner].deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-decline-assault`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      resolveOptional(card.id, 'a1', true);
      choose(pendingPick(card.id, 'a1', 'sceneToHand'), 'kaito');
      const grant = pendingPick(card.id, 'a1', 'charGrantKeyword');
      expect(current().players[owner].hand).toEqual([KID.id, DRAW.id]);
      choose(grant, null);

      expect(current().players[owner].hand).toEqual([KID.id, DRAW.id]);
      expect(read.char.keywords(current(), 'target')).not.toContain('突撃');
      expect(current().players[owner].remove).toContain(card.id);
    },
  );
});

function b07058State(card: CardDef, owner: Player, redMagic: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: redMagic ? RED_MAGIC_CASE.id : PLAIN_CASE.id, colors: ['白'],
  };
  state.players[owner].file = fileCards(6);
  state.players[owner].hand = [card.id];
  state.players[owner].remove = [WHITE_L3.id];
  state.players[owner].deck = [DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave170: B07058/P Red Magic effect gate', () => {
  it.each(B07058_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner is usable without Red Magic but only enters with the trait',
    ({ card, owner }) => {
      install(b07058State(card, owner, false), owner, `${card.id}-${owner}-no-red`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([card.id, WHITE_L3.id]));
      expect(current().players[owner].remove).toContain(WHITE_L3.id);

      install(b07058State(card, owner, true), owner, `${card.id}-${owner}-red`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const entry = pendingPick(card.id, 'a1', 'sceneEnter');
      const candidate = entry.candidates.find(item => item.cardId === WHITE_L3.id)!;
      choose(entry, candidate.uid);
      expect(current().players[owner].scene.some(character => character.cardId === WHITE_L3.id)).toBe(true);
    },
  );
});

function caseActionState(card: CardDef, owner: Player, actorCardId: string, booster = false): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(card.id, 'sonoko'), sceneChar(actorCardId, 'actor', { state: 'active', isNamed: false }),
    ...(booster ? [sceneChar(BOOSTER.id, 'booster')] : []),
  ];
  state.players[other(owner)].evidence = [{ cardId: DRAW.id, faceUp: false, origin: { turn: 1, via: 'effect' } }];
  state.players[owner].deck = [DRAW.id, DRAW.id];
  return state;
}

function grantedDrain(state: GameState) {
  const actor = state.players.self.scene.find(character => character.uid === 'actor')
    ?? state.players.opp.scene.find(character => character.uid === 'actor');
  return (actor?.turnEffects.grantedAbilities as AbilityDef[] | undefined)
    ?.find(ability => ability.id === 'b07063_granted_drain');
}

describe('official QA Wave170: B07063/P action declaration timing', () => {
  it.each(B07063_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner fires for an AP7000 case action before guard',
    ({ card, owner }) => {
      install(caseActionState(card, owner, ACTOR_7000.id), owner, `${card.id}-${owner}-case-action`);
      expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'actor', targetPlayer: other(owner) }))
        .toEqual({ ok: true });
      expect(current().players[owner].scene.find(character => character.uid === 'actor')?.state).toBe('sleep');
      expect(grantedDrain(current())).toBeTruthy();
      const actionId = useGameStateStore.getState().activeActionId!;
      expect(flow.action._getContext(current(), actionId)?.phase).toBe('guard-window');
    },
  );

  it.each(B07063_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner does not retroactively fire after another declaration trigger boosts AP',
    ({ card, owner }) => {
      install(caseActionState(card, owner, ACTOR_6000.id, true), owner, `${card.id}-${owner}-late-boost`);
      expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'actor', targetPlayer: other(owner) }))
        .toEqual({ ok: true });
      expect(read.char.ap(current(), 'actor')).toBe(8000);
      expect(grantedDrain(current())).toBeUndefined();
    },
  );
});

describe('official QA Wave170: B07063/P selects effective LP exactly zero', () => {
  it.each(B07063_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner rejects printed LP0 modified to 1 and accepts printed LP1 modified to 0',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      state.players[owner].hand = [HAND.id];
      state.players[other(owner)].scene = [
        sceneChar(HS_EFFECTIVE_ZERO.id, 'effective-zero', { state: 'sleep', lpOverride: 0 }),
        sceneChar(HS_PRINTED_ZERO.id, 'printed-zero', { state: 'sleep', lpOverride: 1 }),
        sceneChar(HS_NEGATIVE.id, 'negative', { state: 'sleep', lpOverride: -1 }),
      ];
      install(state, owner, `${card.id}-${owner}-effective-lp`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      }), 'B07063/B07063P effective LP').toEqual({ ok: true });
      const pick = pendingPick(card.id, 'a2', 'charModifyAP');
      expect(pick.candidates.map(candidate => candidate.uid)).toEqual(['effective-zero']);
      choose(pick, 'effective-zero');
      expect(read.char.ap(current(), 'effective-zero')).toBe(2000);
      expect(current().players[other(owner)].scene.find(character => character.uid === 'effective-zero')?.state)
        .toBe('active');
    },
  );
});

function b07065State(card: CardDef, owner: Player, ownerHand: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].scene = [sceneChar(card.id, 'source')];
  if (ownerHand) state.players[owner].hand = [HAND.id];
  state.players[other(owner)].hand = [HAND.id];
  return state;
}

describe('official QA Wave170: B07065/P hand cost ownership', () => {
  it.each(B07065_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner pays only the owner hand occurrence',
    ({ card, owner }) => {
      install(b07065State(card, owner, true), owner, `${card.id}-${owner}-owner-cost`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      expect(current().players[owner].remove).toContain(HAND.id);
      expect(current().players[other(owner)].hand).toEqual([HAND.id]);
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
    },
  );

  it.each(B07065_PRINTS)('$id rejects an opponent-only hand without mutation', card => {
    const state = b07065State(card, 'self', false);
    install(state, 'self', `${card.id}-opponent-only`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

describe('official QA Wave170: B07068/P paid-card re-entry and full-scene ordering', () => {
  it.each(B07068_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner re-enters the paid card, switches out source, finishes the tail, then fires enter',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 170, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['赤'];
      state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].file = fileCards(7);
      state.players[owner].hand = [card.id, RED_ENTRY.id];
      state.players[owner].scene = Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER.id, `filler-${index}`));
      state.players[owner].deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-paid-switch`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const sourceUid = current().players[owner].scene.find(character => character.cardId === card.id)!.uid;
      resolveOptional(card.id, 'a1', true);
      const discard = pendingPick(card.id, 'a1', 'discard');
      const paid = discard.candidates.find(candidate => candidate.cardId === RED_ENTRY.id)!;
      choose(discard, paid.uid);
      const entry = pendingPick(card.id, 'a1', 'sceneEnter');
      const justPaid = entry.candidates.find(candidate => candidate.cardId === RED_ENTRY.id)!;
      expect(justPaid).toBeTruthy();
      choose(entry, justPaid.uid, sourceUid);

      expect(current().players[owner].scene.some(character => character.uid === sourceUid)).toBe(false);
      expect(current().players[owner].remove).toContain(card.id);
      const entered = current().players[owner].scene.find(character => character.cardId === RED_ENTRY.id)!;
      expect(entered.state).toBe('active');
      expect(current().players[owner].hand).toEqual([DRAW.id]);
      const actions = current().log.map(item => item.action);
      expect(actions.lastIndexOf('effect:draw')).toBeGreaterThan(actions.lastIndexOf('effect:sceneSetState'));
    },
  );
});
