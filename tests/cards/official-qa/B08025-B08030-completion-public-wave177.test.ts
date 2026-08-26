// qa: card:B08025:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// qa: card:B08027:afd4ca647a0552c346f957948f003f072f421349497d85449fee9254a659c600
// qa: card:B08027:ea3d2d5ee4772bb44ad647fbe7be00723f771fda72c2eee7faf55fc5df38b525
// qa: card:B08027:ec597b045373ea7dd834d813060880a6d6fbf0d19c03975381d1945a45cea50f
// qa: card:B08028:79e28e7fa78e2d090aa94a8dd2079a8c24caa3eb38cfb5ff00eaf821ca69e1ec
// qa: card:B08028:af0cdf511d18e1a0179030dc1fd324092d8a99b6b538bf8aadf398e60529891b
// qa: card:B08030:3d207a0dc96f9343d7f6d42ed94ccf8ed9c1fefb23e811660428b40fae1095f9

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08025 } from '@/cards/ct-p08/B08025';
import { B08025P } from '@/cards/ct-p08/B08025P';
import { B08027 } from '@/cards/ct-p08/B08027';
import { B08028 } from '@/cards/ct-p08/B08028';
import { B08019 } from '@/cards/ct-p08/B08019';
import { B08030 } from '@/cards/ct-p08/B08030';
import { B08030P } from '@/cards/ct-p08/B08030P';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const GREEN_PARTNER = fixture('W177_GREEN_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const FILLER = fixture('W177_FILLER', { kind: 'event', ap: undefined, lp: undefined });
const OWNER_OLD = fixture('W177_OWNER_OLD', { kind: 'event', ap: undefined, lp: undefined });
const OPP_OLD = fixture('W177_OPP_OLD', { kind: 'event', ap: undefined, lp: undefined });
const COST_VICTIM = fixture('W177_COST_VICTIM');
const DISCARD = fixture('W177_DISCARD', { kind: 'event', ap: undefined, lp: undefined });
const EVID_SELF_A = fixture('W177_EVID_SELF_A', { kind: 'event', ap: undefined, lp: undefined });
const EVID_SELF_B = fixture('W177_EVID_SELF_B', { kind: 'event', ap: undefined, lp: undefined });
const EVID_SELF_UP = fixture('W177_EVID_SELF_UP', { kind: 'event', ap: undefined, lp: undefined });
const EVID_OPP_A = fixture('W177_EVID_OPP_A', { kind: 'event', ap: undefined, lp: undefined });
const EVID_OPP_B = fixture('W177_EVID_OPP_B', { kind: 'event', ap: undefined, lp: undefined });
const EVID_OPP_TOP = fixture('W177_EVID_OPP_TOP', { kind: 'event', ap: undefined, lp: undefined });
const ENTER_EVENT = fixture('W177_ENTER_EVENT', {
  kind: 'event', level: 1, ap: undefined, lp: undefined,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { cardId: B08027.id, kind: 'character' } },
    },
    description: '手札のB08027を1枚まで登場させる。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const FIXTURES = [
  GREEN_PARTNER, FILLER, OWNER_OLD, OPP_OLD, COST_VICTIM, DISCARD,
  EVID_SELF_A, EVID_SELF_B, EVID_SELF_UP, EVID_OPP_A, EVID_OPP_B, EVID_OPP_TOP,
  ENTER_EVENT,
];
const B08025_PRINTS = [B08025, B08025P] as const;
const B08030_PRINTS = [B08030, B08030P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave177 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function evidence(cardId: string, faceUp: boolean) {
  return { cardId, faceUp, origin: { turn: 1, via: 'opening' as const } };
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave177-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null, pickedUids?: string[]): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, ...(pickedUids ? { pickedUids } : {}),
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
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave177: B08025/P deck-top-three cost is owner-only', () => {
  it.each(B08025_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner rejects deck2 despite a full opponent deck', ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players[owner].deck = [FILLER.id, OWNER_OLD.id];
      state.players[other(owner)].deck = [FILLER.id, OPP_OLD.id, DISCARD.id, EVID_OPP_A.id];
      install(state, owner, `${card.id}-${owner}-owner-deck-cost`);
      const before = JSON.stringify(current());

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      }), 'B08025/B08025P cannot pay from the opponent deck')
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    },
  );

  it.each(B08025_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner pays exact owner top three and leaves opponent zones unchanged', ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players[owner].deck = [FILLER.id, OWNER_OLD.id, DISCARD.id, EVID_SELF_A.id];
      state.players[opponent].deck = [EVID_OPP_A.id, EVID_OPP_B.id, EVID_OPP_TOP.id, OPP_OLD.id];
      const opponentDeck = [...state.players[opponent].deck];
      install(state, owner, `${card.id}-${owner}-positive-owner-deck-cost`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      }), 'B08025/B08025P pays from the relative owner deck').toEqual({ ok: true });
      expect(current().players[owner].remove).toEqual([FILLER.id, OWNER_OLD.id, DISCARD.id]);
      expect(current().players[owner].deck).toEqual([EVID_SELF_A.id]);
      expect(current().players[opponent].deck).toEqual(opponentDeck);
      expect(current().players[opponent].remove).toEqual([]);
    },
  );
});

describe('official QA Wave177: B08027 transfer includes live sources and is not refresh', () => {
  it.each(['self', 'opp'] as const)('owner=%s transfers B08027 and its used entry event without refresh', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['緑'];
    state.players[owner].file = fileCards(1);
    state.players[owner].hand = [ENTER_EVENT.id, B08027.id];
    state.players[owner].deck = [FILLER.id];
    state.players[opponent].deck = [DISCARD.id];
    state.players[owner].remove = [OWNER_OLD.id];
    state.players[opponent].remove = [OPP_OLD.id];
    state.players[owner].evidence = [evidence(EVID_SELF_UP.id, false)];
    state.players[opponent].evidence = [evidence(EVID_OPP_A.id, false)];
    install(state, owner, `${owner}-event-entry-transfer`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: ENTER_EVENT.id }))
      .toEqual({ ok: true });
    const enter = pendingPick(ENTER_EVENT.id, 'a1', 'sceneEnter');
    choose(enter, enter.candidates.find(candidate => candidate.cardId === B08027.id)!.uid);
    resolveOptional(B08027.id, 'a1', true);

    expect(current().players[owner].remove).toEqual([]);
    expect(current().players[opponent].remove).toEqual([]);
    expect(current().players[owner].deck, 'B08027 source joins its own remove-area transfer')
      .toEqual(expect.arrayContaining([B08027.id, ENTER_EVENT.id, OWNER_OLD.id, FILLER.id]));
    expect(current().players[opponent].deck).toEqual(expect.arrayContaining([OPP_OLD.id, DISCARD.id]));
    expect(current().refreshCount[owner], 'B08027 transfer is not refresh').toBe(0);
    expect(current().refreshCount[opponent]).toBe(0);
    expect(current().players[owner].evidence).toEqual([evidence(EVID_SELF_UP.id, false)]);
    expect(current().players[opponent].evidence).toEqual([evidence(EVID_OPP_A.id, false)]);
  });

  it.each(['self', 'opp'] as const)('owner=%s may decline without changing either transfer zone', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['緑'];
    state.players[owner].file = fileCards(1);
    state.players[owner].hand = [ENTER_EVENT.id, B08027.id];
    state.players[owner].deck = [FILLER.id];
    state.players[opponent].deck = [DISCARD.id];
    state.players[owner].remove = [OWNER_OLD.id];
    state.players[opponent].remove = [OPP_OLD.id];
    install(state, owner, `${owner}-event-entry-decline`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: ENTER_EVENT.id }))
      .toEqual({ ok: true });
    const enter = pendingPick(ENTER_EVENT.id, 'a1', 'sceneEnter');
    choose(enter, enter.candidates.find(candidate => candidate.cardId === B08027.id)!.uid);
    const before = {
      ownerDeck: [...current().players[owner].deck], opponentDeck: [...current().players[opponent].deck],
      ownerRemove: [...current().players[owner].remove], opponentRemove: [...current().players[opponent].remove],
    };
    resolveOptional(B08027.id, 'a1', false);

    expect(current().players[owner].scene.some(character => character.cardId === B08027.id),
      'B08027 decline keeps its source in scene').toBe(true);
    expect(current().players[owner].deck).toEqual(before.ownerDeck);
    expect(current().players[opponent].deck).toEqual(before.opponentDeck);
    expect(current().players[owner].remove).toEqual(before.ownerRemove);
    expect(current().players[opponent].remove).toEqual(before.opponentRemove);
    expect(current().refreshCount).toEqual({ self: 0, opp: 0 });
  });
});

describe('official QA Wave177: B08028 selects arbitrary evidence as one batch', () => {
  it.each(['self', 'opp'] as const)('owner=%s flips all own selections before choosing arbitrary opponent positions', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08028.id, 'source'), sceneChar(COST_VICTIM.id, 'cost-victim')];
    state.players[owner].evidence = [
      evidence(EVID_SELF_UP.id, true), evidence(EVID_SELF_A.id, false),
      evidence(FILLER.id, true), evidence(EVID_SELF_B.id, false),
    ];
    state.players[opponent].evidence = [
      evidence(EVID_OPP_A.id, false), evidence(FILLER.id, true),
      evidence(EVID_OPP_B.id, false), evidence(EVID_OPP_TOP.id, false),
    ];
    state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
    state.players[opponent].deck = Array.from({ length: 10 }, () => FILLER.id);
    install(state, owner, `${owner}-evidence-batch`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    const ownPick = pendingPick(B08028.id, 'a1', 'evidenceFlip');
    const ownSelected = [EVID_SELF_A.id, EVID_SELF_B.id]
      .map(cardId => ownPick.candidates.find(candidate => candidate.cardId === cardId)!.uid);
    choose(ownPick, ownSelected[0]!, ownSelected);

    const opponentPick = pendingPick(B08028.id, 'a1', 'evidenceFlip');
    expect(current().players[owner].evidence.filter(item => (
      item.cardId === EVID_SELF_A.id || item.cardId === EVID_SELF_B.id
    )).every(item => item.faceUp), 'B08028 flips the selected own batch before the opponent decision').toBe(true);
    expect(opponentPick.nMax).toBe(2);
    const originalOrder = current().players[opponent].evidence.map(item => item.cardId);
    const opponentSelected = [EVID_OPP_A.id, EVID_OPP_B.id]
      .map(cardId => opponentPick.candidates.find(candidate => candidate.cardId === cardId)!.uid);
    choose(opponentPick, opponentSelected[0]!, opponentSelected);

    expect(current().players[opponent].evidence.map(item => item.cardId),
      'B08028 arbitrary evidence positions retain zone order').toEqual(originalOrder);
    expect(current().players[opponent].evidence.find(item => item.cardId === EVID_OPP_A.id)?.faceUp).toBe(true);
    expect(current().players[opponent].evidence.find(item => item.cardId === EVID_OPP_B.id)?.faceUp).toBe(true);
    expect(current().players[opponent].evidence.find(item => item.cardId === EVID_OPP_TOP.id)?.faceUp).toBe(false);
  });

  it.each(['self', 'opp'] as const)('owner=%s choosing zero own evidence skips the opponent pick', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08028.id, 'source'), sceneChar(COST_VICTIM.id, 'cost-victim')];
    state.players[owner].evidence = [evidence(EVID_SELF_A.id, false)];
    state.players[opponent].evidence = [evidence(EVID_OPP_A.id, false)];
    install(state, owner, `${owner}-evidence-zero`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    choose(pendingPick(B08028.id, 'a1', 'evidenceFlip'), null);
    surfacePendingSideChannels();

    expect(current().players[owner].evidence[0]?.faceUp, 'B08028 zero own selection preserves own evidence').toBe(false);
    expect(current().players[opponent].evidence[0]?.faceUp).toBe(false);
    expect(useGameStateStore.getState().pendingEffectPick, 'B08028 bound count zero opens no opponent pick').toBeNull();
  });
});

describe('official QA Wave177: B08030/P Assist resolution is mandatory', () => {
  it.each(B08030_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner becomes resolved immediately when Assist reaches FILE7', ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = {
        cardId: card.id, status: '事件編', requiredEvidence: card.caseLevel ?? 7,
        colors: ['緑'], declaredUseCount: {},
      };
      state.players[owner].partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].file = fileCards((card.caseLevel ?? 7) - 1);
      state.players[owner].hand = [DISCARD.id];
      state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
      state.players[other(owner)].deck = Array.from({ length: 10 }, () => FILLER.id);
      install(state, owner, `${card.id}-${owner}-mandatory-resolution`);

      expect(dispatchEngineAction({ type: 'assist', player: owner })).toEqual({ ok: true });
      expect(current().players[owner].case.status,
        'B08030/B08030P FILE threshold resolution has no decline window').toBe('解決編');
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
      expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
      const discard = pendingPick(card.id, 'a1', 'discard');
      choose(discard, discard.candidates.find(candidate => candidate.cardId === DISCARD.id)!.uid);
      expect(current().players[owner].case.status).toBe('解決編');
    },
  );

  it.each(B08030_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner pays arbitrary own evidence and buffs the combined-name Iori only', ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 177, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = {
        cardId: card.id, status: '解決編', requiredEvidence: card.caseLevel ?? 7,
        colors: ['緑'], declaredUseCount: {},
      };
      state.players[owner].scene = [sceneChar(B08019.id, 'combined-name')];
      state.players[owner].evidence = [evidence(EVID_SELF_UP.id, true), evidence(EVID_SELF_A.id, false)];
      state.players[opponent].evidence = [evidence(EVID_OPP_A.id, false)];
      state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
      state.players[opponent].deck = Array.from({ length: 10 }, () => FILLER.id);
      install(state, owner, `${card.id}-${owner}-combined-name-buff`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { flipFaceUpEvidence: { indices: [1] } },
      })).toEqual({ ok: true });
      const target = pendingPick(card.id, 'a2', 'charModifyAP');
      expect(target.candidates.map(candidate => candidate.uid),
        'B08030/B08030P accepts the combined-name Iori target').toEqual(['combined-name']);
      choose(target, 'combined-name');

      expect(current().players[owner].evidence[1]?.faceUp, 'B08030/B08030P arbitrary owner evidence cost').toBe(true);
      expect(current().players[opponent].evidence[0]?.faceUp).toBe(false);
      expect(read.char.ap(current(), 'combined-name')).toBe((B08019.ap ?? 0) + 2000);
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      expect(read.char.ap(current(), 'combined-name')).toBe(B08019.ap);
    },
  );
});
