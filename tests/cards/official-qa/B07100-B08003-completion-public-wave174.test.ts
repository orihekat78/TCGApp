// qa: card:B07100:8fa59c53057ee164d956e8a94719c89402a761c9093428f38822e073eaf28600
// qa: card:B07100:9ea8c56b58d12131b2e713a3516cd705349fbc1b7b067ed5892ef06d44213d92
// qa: card:B07103:b385cc0ffa2c4f468ffbbff448fb7cd0afda5502f9a01f3e95a0a9b2e793b8a9
// qa: card:B07103:e7696529447cdd4105353e743deb4b9055acf506a6063542ebd4b356f440e195
// qa: card:B07104:8bbd69cb64076bd484e95dcb7251faa74f8a1aa69e7c4fed9505474b9472f6b5
// qa: card:B08002:38d6b9712427e63cb5c34d8546239ff023584064d48c2fd29dfde6c16445e0da
// qa: card:B08002:84d5143b0987cae82e2804fedba57aae565943673875da4a0a454211510a2384
// qa: card:B08003:43b1bf5d83d7464c9b5af3ae0c258e99ef6a2922ed2bdf104bd97082a305b22b
// qa: card:B08003:78b5e21ca1172922dfb29e7aa57e78d80ec4e95d89e821fa20c80cee89e41318
// qa: card:B08003:893ecd7cc4f7a035960d5512fce0c72bc88e82ae83d55bb7178fd7fd8649f75d
// qa: card:B08003:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stepTurn, type AIPolicy } from '@/ai/policy';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards';
import { D08021 } from '@/cards/ct-d08/D08021';
import { B07003 } from '@/cards/ct-p07/B07003';
import { B07085 } from '@/cards/ct-p07/B07085';
import { B07100 } from '@/cards/ct-p07/B07100';
import { B07103 } from '@/cards/ct-p07/B07103';
import { B07103P } from '@/cards/ct-p07/B07103P';
import { B07104 } from '@/cards/ct-p07/B07104';
import { B07104P } from '@/cards/ct-p07/B07104P';
import { B08002 } from '@/cards/ct-p08/B08002';
import { B08002P } from '@/cards/ct-p08/B08002P';
import { B08003 } from '@/cards/ct-p08/B08003';
import { B08003P } from '@/cards/ct-p08/B08003P';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B09056P } from '@/cards/ct-p09/B09056P';
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

const BLACK_PARTNER = fixture('W174_BLACK_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1, colors: ['黒'],
});
const BLUE_PARTNER = fixture('W174_BLUE_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1, colors: ['青'],
});
const RED_PARTNER = fixture('W174_RED_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1, colors: ['赤'],
});
const BLUE_GRANTED = fixture('W174_BLUE_GRANTED', { colors: ['青'], level: 7 });
const HAND_KEEP = fixture('W174_HAND_KEEP', { kind: 'event' });
const DRAW = fixture('W174_DRAW', { kind: 'event' });
const REFRESH_A = fixture('W174_REFRESH_A', { kind: 'event' });
const REFRESH_B = fixture('W174_REFRESH_B', { kind: 'event' });
const MILL_A = fixture('W174_MILL_A', { kind: 'event' });
const MILL_B = fixture('W174_MILL_B', { kind: 'event' });
const MILL_C = fixture('W174_MILL_C', { kind: 'event' });
const FILLER = fixture('W174_FILLER', { ap: 2000 });
const LEVEL8_TARGET = fixture('W174_LEVEL8_TARGET', { level: 8, ap: 5000, lp: 2 });
const LEVEL7_TARGET = fixture('W174_LEVEL7_TARGET', { level: 7, ap: 4000 });
const LEVEL_PROBE = fixture('W174_LEVEL_PROBE', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 }, cause: 'effect' },
    },
    description: '相手のレベル7以下のキャラを1枚までリムーブする。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const GOOD_ENTER = fixture('W174_GOOD_ENTER', {
  level: 8, traits: ['少年探偵団'],
  abilities: [{
    id: 'enter-draw', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【登場時】カードを1枚引く。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const BAD_LEVEL9 = fixture('W174_BAD_LEVEL9', { level: 9, traits: ['少年探偵団'] });
const STACK_FILLER = fixture('W174_STACK_FILLER', { level: 1 });
const FIXTURES = [
  BLACK_PARTNER, BLUE_PARTNER, RED_PARTNER, BLUE_GRANTED, HAND_KEEP, DRAW, REFRESH_A, REFRESH_B,
  MILL_A, MILL_B, MILL_C, FILLER, LEVEL8_TARGET, LEVEL7_TARGET, LEVEL_PROBE,
  GOOD_ENTER, BAD_LEVEL9, STACK_FILLER,
];
const B07103_PRINTS = [B07103, B07103P] as const;
const B07104_PRINTS = [B07104, B07104P] as const;
const B08002_PRINTS = [B08002, B08002P] as const;
const B08003_PRINTS = [B08003, B08003P] as const;
const B09056_PRINTS = [B09056, B09056P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave174 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave174-${label}`);
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

function chooseMany(pending: PendingPick, pickedUids: string[]): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: pickedUids[0] ?? null, pickedUids,
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
}

function resolveChoice(cardId: string, abilityId: string, choiceIndex: number): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectChoice;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'choiceResolve', choiceIndex })))
    .toEqual({ ok: true });
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: DRAW.id }));
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

function b07100State(owner: Player, opponentHand: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黒'];
  state.players[owner].partner = {
    cardId: BLACK_PARTNER.id, state: 'active', location: 'partner-area',
  };
  state.players[owner].file = fileCards(B07100.level ?? 0);
  state.players[owner].hand = [B07100.id];
  state.players[other(owner)].hand = [...opponentHand];
  state.players[other(owner)].deck = [DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave174: B07100 reads printed and dynamically granted hand Cut-In', () => {
  it.each(['self', 'opp'] as const)('owner=%s can select an inactive conditional printed Cut-In', owner => {
    install(b07100State(owner, [B07085.id]), owner, `${owner}-inactive-printed-cutin`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07100.id }))
      .toEqual({ ok: true });
    const discard = pendingPick(B07100.id, 'a1', 'discard');
    expect(discard.candidates.map(candidate => candidate.cardId), 'B07100 inactive printed Cut-In')
      .toContain(B07085.id);
    choose(discard, null);
    expect(current().players[other(owner)].hand).toEqual([B07085.id]);
  });

  it.each(['self', 'opp'] as const)('owner=%s can select a blue hand card granted Cut-In by B07003', owner => {
    install(b07100State(owner, [B07003.id, BLUE_GRANTED.id]), owner, `${owner}-granted-cutin`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07100.id }))
      .toEqual({ ok: true });
    const discard = pendingPick(B07100.id, 'a1', 'discard');
    expect(discard.candidates.map(candidate => candidate.cardId), 'B07100 dynamically granted Cut-In')
      .toContain(BLUE_GRANTED.id);
    choose(discard, discard.candidates.find(candidate => candidate.cardId === BLUE_GRANTED.id)!.uid);
    expect(current().players[other(owner)].remove).toContain(BLUE_GRANTED.id);
  });
});

function b07103HandState(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黒'];
  state.players[owner].file = fileCards(card.level ?? 0);
  state.players[owner].hand = [card.id, HAND_KEEP.id];
  state.players[owner].deck = [DRAW.id];
  state.players[owner].remove = [REFRESH_A.id];
  return state;
}

describe('official QA Wave174: B07103/P refresh and effective-level timing', () => {
  it.each(B07103_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner refreshes immediately after sole-card draw, before mandatory discard',
    ({ card, owner }) => {
      install(b07103HandState(card, owner), owner, `${card.id}-${owner}-draw-refresh-discard`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const discard = pendingPick(card.id, 'a1', 'discard');
      expect(current().refreshCount[owner], 'B07103/B07103P refresh precedes discard').toBe(1);
      expect(current().players[owner].deck).toEqual([REFRESH_A.id]);
      expect(discard.candidates.map(candidate => candidate.cardId).sort())
        .toEqual([DRAW.id, HAND_KEEP.id].sort());
      choose(discard, discard.candidates.find(candidate => candidate.cardId === HAND_KEEP.id)!.uid);
      expect(current().players[owner].hand).toEqual([DRAW.id]);
    },
  );

  it.each(B07103_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner changes only effective level and later level filters until turn end',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.status = '解決編';
      state.players[owner].scene = [
        sceneChar(card.id, 'source'), sceneChar(LEVEL_PROBE.id, 'probe'),
      ];
      state.players[other(owner)].scene = [sceneChar(LEVEL8_TARGET.id, 'level-target', { state: 'sleep' })];
      state.players[owner].deck = Array.from({ length: 10 }, () => DRAW.id);
      state.players[other(owner)].deck = Array.from({ length: 10 }, () => DRAW.id);
      install(state, owner, `${card.id}-${owner}-level-reference`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a2', 'charModifyLevel'), 'level-target');
      expect(read.char.level(current(), 'level-target')).toBe(7);
      expect(read.char.ap(current(), 'level-target')).toBe(5000);
      expect(read.char.lp(current(), 'level-target')).toBe(2);
      expect(current().players[other(owner)].scene.find(character => character.uid === 'level-target')?.state)
        .toBe('sleep');

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'probe', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      const later = pendingPick(LEVEL_PROBE.id, 'a1', 'sceneRemove');
      expect(later.candidates.map(candidate => candidate.uid), 'B07103/B07103P later levelMax7 reference')
        .toContain('level-target');
      choose(later, null);
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      expect(read.char.level(current(), 'level-target')).toBe(8);
    },
  );
});

function b07104State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黒'];
  state.players[owner].partner = {
    cardId: BLACK_PARTNER.id, state: 'active', location: 'partner-area',
  };
  state.players[owner].file = fileCards(card.level ?? 0);
  state.players[owner].hand = [card.id];
  state.players[owner].scene = [sceneChar(FILLER.id, 'own-1'), sceneChar(FILLER.id, 'own-2')];
  state.players[other(owner)].scene = [sceneChar(FILLER.id, 'opp-1')];
  state.players[owner].deck = [MILL_A.id, MILL_B.id, MILL_C.id];
  state.players[owner].remove = [REFRESH_A.id, REFRESH_B.id];
  return state;
}

describe('official QA Wave174: B07104/P aggregates scene-count mill before refresh', () => {
  it.each(B07104_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner mills only the three-card remainder for a six-card total, refreshes, and stops',
    ({ card, owner }) => {
      install(b07104State(card, owner), owner, `${card.id}-${owner}-aggregate-short-mill`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
      choose(pendingPick(card.id, 'a1', 'charGrantKeyword'), null);

      expect(current().refreshCount[owner], 'B07104/B07104P aggregate mill refresh count').toBe(1);
      expect(current().players[owner].deck).toHaveLength(5);
      expect(current().players[owner].deck).toEqual(expect.arrayContaining([
        MILL_A.id, MILL_B.id, MILL_C.id, REFRESH_A.id, REFRESH_B.id,
      ]));
      expect(current().players[owner].remove, 'B07104/B07104P does not mill after refresh')
        .toEqual([card.id]);
    },
  );

  it.each(B07104_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner CPU evaluates aggregate mill after its real scene removal',
    ({ card, owner }) => {
      const state = b07104State(card, owner);
      state.players[owner].deck = Array.from({ length: 10 }, () => MILL_A.id);
      state.players[owner].remove = [];
      install(state, other(owner), `${card.id}-${owner}-cpu-post-remove-count`);
      const targetPolicy = new HeuristicPolicy();
      const policy: AIPolicy = {
        name: 'wave174-hand-use',
        choose: (_state, moves) => moves.find(move => (
          move.kind === 'handUseCard' && move.cardId === card.id
        )) ?? null,
        chooseAtomTarget: targetPolicy.chooseAtomTarget.bind(targetPolicy),
      };
      const step = stepTurn(current(), policy, owner);
      expect(step.move).toMatchObject({ kind: 'handUseCard', cardId: card.id });
      const after = step.nextState;

      expect(after.players[owner].scene).toHaveLength(2);
      expect(after.players[other(owner)].scene, 'CPU removes an opposing scene character')
        .toHaveLength(0);
      expect(after.players[owner].deck, 'remaining two scene characters produce mill n=4, never stale n=6')
        .toHaveLength(6);
    },
  );
});

function b08002State(card: CardDef, owner: Player, target: CardDef, deck: string[], remove: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = {
    cardId: BLUE_PARTNER.id, state: 'active', location: 'partner-area',
  };
  state.players[owner].case.status = '解決編';
  state.players[owner].scene = [sceneChar(card.id, 'mr-source'), sceneChar(B07103.id, 'level-source')];
  state.players[other(owner)].scene = [sceneChar(target.id, 'remove-target', { state: 'sleep' })];
  state.players[owner].deck = [...deck];
  state.players[owner].remove = [...remove];
  return state;
}

describe('official QA Wave174: B08002/P mills the removed effective level and stops after refresh', () => {
  it.each(B08002_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner snapshots effective level7 after B07103 reduces printed level8',
    ({ card, owner }) => {
      install(
        b08002State(card, owner, LEVEL8_TARGET, Array.from({ length: 10 }, () => MILL_A.id), []),
        owner,
        `${card.id}-${owner}-effective-level-seven`,
      );
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'level-source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: true });
      choose(pendingPick(B07103.id, 'a2', 'charModifyLevel'), 'remove-target');
      expect(read.char.level(current(), 'remove-target')).toBe(7);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'mr-source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'remove-target');
      expect(current().players[owner].deck, 'B08002/B08002P mill count uses removed effective level')
        .toHaveLength(3);
      expect(current().players[owner].remove).toHaveLength(7);
      expect(current().players[other(owner)].remove).toContain(LEVEL8_TARGET.id);
    },
  );

  it.each(B08002_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may remove level7 with only three deck cards, refreshes all, and stops',
    ({ card, owner }) => {
      install(
        b08002State(card, owner, LEVEL7_TARGET, [MILL_A.id, MILL_B.id, MILL_C.id], [REFRESH_A.id]),
        owner,
        `${card.id}-${owner}-short-deck`,
      );
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'mr-source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'remove-target');

      expect(current().refreshCount[owner]).toBe(1);
      expect(current().players[owner].deck).toHaveLength(4);
      expect(current().players[owner].deck).toEqual(expect.arrayContaining([
        MILL_A.id, MILL_B.id, MILL_C.id, REFRESH_A.id,
      ]));
      expect(current().players[owner].remove, 'B08002/B08002P no post-refresh remainder mill').toEqual([]);
    },
  );
});

describe('official QA Wave174: B08003/P stack and full-scene parent ordering', () => {
  it.each(B08003_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may stack the level8 結成 少年探偵団 just removed by its entry switch',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['青'];
      state.players[owner].file = fileCards(card.level ?? 0);
      state.players[owner].hand = [card.id];
      state.players[owner].scene = [
        sceneChar(D08021.id, 'switch-boy'),
        ...Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER.id, `filler-${index}`)),
      ];
      install(state, owner, `${card.id}-${owner}-switch-stack`);

      expect(dispatchEngineAction({
        type: 'handUseCardSwitch', player: owner, cardId: card.id, removeUid: 'switch-boy',
      })).toEqual({ ok: true });
      const stack = pendingPick(card.id, 'a1', 'charStackCard');
      const team = stack.candidates.find(candidate => candidate.cardId === D08021.id)!;
      expect(team, 'B08003/B08003P switched 結成 少年探偵団 candidate').toBeDefined();
      chooseMany(stack, [team.uid]);

      const source = current().players[owner].scene.find(character => character.cardId === card.id)!;
      expect(source.stackedCards).toEqual([
        expect.objectContaining({ cardId: D08021.id, instanceId: expect.any(String) }),
      ]);
      expect(current().players[owner].remove).not.toContain(D08021.id);
    },
  );

  it.each(B08003_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner switches out itself for the cost-selected entrant, finishes discard, then runs enter draw',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner = {
        cardId: BLUE_PARTNER.id, state: 'active', location: 'partner-area',
      };
      const source = sceneChar(card.id, 'agasa', { state: 'active' });
      source.stackedCards = [
        { cardId: GOOD_ENTER.id, instanceId: 'stack:agasa:good' },
        { cardId: BAD_LEVEL9.id, instanceId: 'stack:agasa:high' },
        { cardId: STACK_FILLER.id, instanceId: 'stack:agasa:filler' },
      ];
      state.players[owner].scene = [
        source,
        ...Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER.id, `full-${index}`)),
      ];
      state.players[owner].hand = [HAND_KEEP.id];
      state.players[owner].deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-parent-tail`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'agasa', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeStackedCards: { instanceIds: [
          'stack:agasa:good', 'stack:agasa:high', 'stack:agasa:filler',
        ] } },
      })).toEqual({ ok: true });
      const switchPick = pendingPick(card.id, 'a2', 'sceneEnter');
      expect(switchPick.candidates.map(candidate => candidate.uid)).toContain('agasa');
      choose(switchPick, 'agasa');

      const discard = pendingPick(card.id, 'a2', 'discard');
      expect(current().players[owner].hand, 'B08003/B08003P entrant enter trigger waits for parent discard')
        .toEqual([HAND_KEEP.id]);
      choose(discard, discard.candidates.find(candidate => candidate.cardId === HAND_KEEP.id)!.uid);

      expect(current().players[owner].scene.some(character => character.uid === 'agasa')).toBe(false);
      expect(current().players[owner].scene.some(character => character.cardId === GOOD_ENTER.id)).toBe(true);
      expect(current().players[owner].hand, 'B08003/B08003P entrant enter draw runs after parent tail')
        .toEqual([DRAW.id]);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([
        card.id, BAD_LEVEL9.id, STACK_FILLER.id, HAND_KEEP.id,
      ]));
    },
  );
});

describe('Wave174 horizontal: B09056/P aggregate opponent-scene mill shares the refresh stop', () => {
  it.each(B09056_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner mills only the short opponent deck, refreshes, and stops before later iterations',
    ({ card, owner }) => {
      const targetSide = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['赤', '黒'];
      state.players[owner].partner = {
        cardId: RED_PARTNER.id, state: 'active', location: 'partner-area',
      };
      state.players[owner].file = fileCards(card.level ?? 0);
      state.players[owner].hand = [card.id];
      state.players[targetSide].scene = [
        sceneChar(FILLER.id, 'opp-1'), sceneChar(FILLER.id, 'opp-2'), sceneChar(FILLER.id, 'opp-3'),
      ];
      state.players[targetSide].deck = [MILL_A.id, MILL_B.id, MILL_C.id];
      state.players[targetSide].remove = [REFRESH_A.id, REFRESH_B.id];
      install(state, owner, `${card.id}-${owner}-horizontal-short-mill`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      resolveOptional(card.id, 'a1', true);
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
      resolveChoice(card.id, 'a1', 1);

      expect(current().refreshCount[targetSide], 'B09056/B09056P aggregate mill refresh count').toBe(1);
      expect(current().players[targetSide].deck).toHaveLength(5);
      expect(current().players[targetSide].deck).toEqual(expect.arrayContaining([
        MILL_A.id, MILL_B.id, MILL_C.id, REFRESH_A.id, REFRESH_B.id,
      ]));
      expect(current().players[targetSide].remove, 'B09056/B09056P no post-refresh mill').toEqual([]);
    },
  );

  it.each(B09056_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner counts the opponent scene after the preceding removal',
    ({ card, owner }) => {
      const targetSide = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 174, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['赤', '黒'];
      state.players[owner].partner = {
        cardId: RED_PARTNER.id, state: 'active', location: 'partner-area',
      };
      state.players[owner].file = fileCards(card.level ?? 0);
      state.players[owner].hand = [card.id];
      state.players[targetSide].scene = [
        sceneChar(FILLER.id, 'opp-1'), sceneChar(FILLER.id, 'opp-2'), sceneChar(FILLER.id, 'opp-3'),
      ];
      state.players[targetSide].deck = Array.from({ length: 10 }, () => MILL_A.id);
      install(state, owner, `${card.id}-${owner}-post-remove-count`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      resolveOptional(card.id, 'a1', true);
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'opp-1');
      resolveChoice(card.id, 'a1', 1);

      expect(current().players[targetSide].scene).toHaveLength(2);
      expect(current().players[targetSide].deck, 'two remaining opponent characters produce mill n=4')
        .toHaveLength(6);
    },
  );
});
