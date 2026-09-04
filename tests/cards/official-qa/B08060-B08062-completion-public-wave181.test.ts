// qa: card:B08060:1e6decec598c8178c0ef59895411a3e6043a00f96c40f3608c98b25e915c134b
// qa: card:B08060:facf6c9556574acdc0201d4086f9f1696d7a3754e6fab629e34962b6618eb9c9
// qa: card:B08062:b097293b6a6225b8cccaede88fa026b80533236923f2b41e17beb8b1b3921b26

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08060 } from '@/cards/ct-p08/B08060';
import { B08062 } from '@/cards/ct-p08/B08062';
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
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const MATCH_LEVEL_SEVEN = fixture('W181_MATCH_LEVEL_SEVEN', { level: 7, ap: 5000 });
const SECOND_LEVEL_SEVEN = fixture('W181_SECOND_LEVEL_SEVEN', { level: 7, ap: 6000 });
const REVEAL_DECOY = fixture('W181_REVEAL_DECOY', { level: 3, colors: ['青'] });
const ELIGIBLE_HAND = fixture('W181_ELIGIBLE_HAND', { level: 2 });
const SPARE_EVENT = fixture('W181_SPARE_EVENT', { kind: 'event' });
const TAIL_EVENT = fixture('W181_TAIL_EVENT', { kind: 'event' });
const SATO = fixture('W181_SATO', { names: ['佐藤美和子'], ap: 3000 });
const TAKAGI = fixture('W181_TAKAGI', { names: ['高木渉'], ap: 4000 });
const MOB = fixture('W181_MOB', { names: ['目暮十三'], ap: 2000 });
const FIXTURES = [
  MATCH_LEVEL_SEVEN, SECOND_LEVEL_SEVEN, REVEAL_DECOY, ELIGIBLE_HAND,
  SPARE_EVENT, TAIL_EVENT, SATO, TAKAGI, MOB,
];

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave181 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave181-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolvePick(pending: PendingPick, cardId: string | null): void {
  const pickedUid = cardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === cardId)?.uid;
  if (cardId !== null) expect(pickedUid, `${cardId} must be a pending candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: pickedUid ?? null,
  }))).toEqual({ ok: true });
}

function b08060State(includeExistingEligible: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 181, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤'];
  state.players.self.file = Array.from(
    { length: 7 },
    () => ({ type: 'card-back' as const, cardId: TAIL_EVENT.id }),
  );
  state.players.self.hand = [
    B08060.id,
    ...(includeExistingEligible ? [ELIGIBLE_HAND.id] : []),
    SPARE_EVENT.id,
  ];
  state.players.self.deck = [
    REVEAL_DECOY.id,
    MATCH_LEVEL_SEVEN.id,
    SECOND_LEVEL_SEVEN.id,
    TAIL_EVENT.id,
  ];
  state.players.opp.deck = [TAIL_EVENT.id, TAIL_EVENT.id];
  return state;
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

describe('official QA Wave181: B08060 mandatory acquisition and optional entry', () => {
  it('allows an explicit zero choice for the final hand-to-scene step', () => {
    install(b08060State(true), 'self', 'B08060-zero-entry');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08060.id }))
      .toEqual({ ok: true });
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
    resolvePick(discard!, SPARE_EVENT.id);

    const sceneEnter = useGameStateStore.getState().pendingEffectPick;
    expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(sceneEnter?.candidates.map(candidate => candidate.cardId)).toEqual(
      expect.arrayContaining([MATCH_LEVEL_SEVEN.id, ELIGIBLE_HAND.id]),
    );
    resolvePick(sceneEnter!, null);

    expect(current().players.self.scene).toEqual([]);
    expect(current().players.self.hand).toEqual(expect.arrayContaining([
      MATCH_LEVEL_SEVEN.id, ELIGIBLE_HAND.id,
    ]));
    expect(current().players.self.remove).toEqual(expect.arrayContaining([B08060.id, SPARE_EVENT.id]));
  });

  it('puts the first revealed level seven into hand without a decline decision', () => {
    install(b08060State(false), 'self', 'B08060-mandatory-first-level-seven');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08060.id }))
      .toEqual({ ok: true });

    expect(current().players.self.hand).toContain(MATCH_LEVEL_SEVEN.id);
    expect(current().players.self.hand).not.toContain(SECOND_LEVEL_SEVEN.id);
    expect(current().players.self.deck).toContain(SECOND_LEVEL_SEVEN.id);
    const nextDecision = useGameStateStore.getState().pendingEffectPick;
    expect(nextDecision).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();

    resolvePick(nextDecision!, SPARE_EVENT.id);
    resolvePick(useGameStateStore.getState().pendingEffectPick!, null);
    expect(current().players.self.hand).toContain(MATCH_LEVEL_SEVEN.id);
  });
});

describe('official QA Wave181: B08062 automatic continuous aura', () => {
  it('applies immediately with no activation window and disappears immediately when a decoy enters', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partnerAreaMR = {
      cardId: B08062.id, uid: 'partnerMR:self', state: 'active',
    } as GameState['players']['self']['partnerAreaMR'];
    state.players.self.scene = [
      sceneChar(SATO.id, 'sato'),
      sceneChar(TAKAGI.id, 'takagi'),
    ];
    install(state, 'self', 'B08062-continuous');

    expect(read.char.ap(current(), 'sato')).toBe((SATO.ap ?? 0) + 1000);
    expect(read.char.ap(current(), 'takagi')).toBe((TAKAGI.ap ?? 0) + 1000);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    const withDecoy = structuredClone(current());
    withDecoy.players.self.scene.push(sceneChar(MOB.id, 'mob'));
    expect(useGameStateStore.getState().setGameState(withDecoy)).toBe(true);

    expect(read.char.ap(current(), 'sato')).toBe(SATO.ap);
    expect(read.char.ap(current(), 'takagi')).toBe(TAKAGI.ap);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });
});

describe('official QA Wave181: owner=opp mirrors', () => {
  it('mirrors B08060 mandatory acquisition and zero scene entry on opp', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['赤'];
    state.players.opp.file = Array.from(
      { length: 7 },
      () => ({ type: 'card-back' as const, cardId: TAIL_EVENT.id }),
    );
    state.players.opp.hand = [B08060.id, ELIGIBLE_HAND.id, SPARE_EVENT.id];
    state.players.opp.deck = [REVEAL_DECOY.id, MATCH_LEVEL_SEVEN.id, SECOND_LEVEL_SEVEN.id, TAIL_EVENT.id];
    state.players.self.deck = [TAIL_EVENT.id, TAIL_EVENT.id];
    install(state, 'opp', 'B08060-opp-owner');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: B08060.id }))
      .toEqual({ ok: true });
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ player: 'opp', atomVerb: 'discard', nMin: 1, nMax: 1 });
    resolvePick(discard!, SPARE_EVENT.id);
    const sceneEnter = useGameStateStore.getState().pendingEffectPick;
    expect(sceneEnter).toMatchObject({ player: 'opp', atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    resolvePick(sceneEnter!, null);

    expect(current().players.opp.hand).toEqual(expect.arrayContaining([
      MATCH_LEVEL_SEVEN.id, ELIGIBLE_HAND.id,
    ]));
    expect(current().players.opp.scene).toEqual([]);
    expect(current().players.self.deck).toEqual([TAIL_EVENT.id, TAIL_EVENT.id]);
  });

  it('mirrors B08062 automatic PA-MR aura on opp', () => {
    const state = createEmptyGameState();
    state.turn = { number: 181, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.partnerAreaMR = {
      cardId: B08062.id, uid: 'partnerMR:opp', state: 'active',
    } as GameState['players']['opp']['partnerAreaMR'];
    state.players.opp.scene = [
      sceneChar(SATO.id, 'opp-sato'),
      sceneChar(TAKAGI.id, 'opp-takagi'),
    ];
    state.players.self.scene = [sceneChar(MOB.id, 'self-decoy')];
    install(state, 'opp', 'B08062-opp-owner');

    expect(read.char.ap(current(), 'opp-sato')).toBe((SATO.ap ?? 0) + 1000);
    expect(read.char.ap(current(), 'opp-takagi')).toBe((TAKAGI.ap ?? 0) + 1000);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();

    const withDecoy = structuredClone(current());
    withDecoy.players.opp.scene.push(sceneChar(MOB.id, 'opp-mob'));
    expect(useGameStateStore.getState().setGameState(withDecoy)).toBe(true);
    expect(read.char.ap(current(), 'opp-sato')).toBe(SATO.ap);
    expect(read.char.ap(current(), 'opp-takagi')).toBe(TAKAGI.ap);
  });
});
