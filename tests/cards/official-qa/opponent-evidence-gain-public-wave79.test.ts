// qa: card:B01065:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
// qa: card:B01069:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
// qa: card:B02061:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
// Rules: 03-field-areas, 10-action-event, 13-keywords, 14-refresh,
// 15-abilities-effects, 17-icons, 25-qa-effects-resolution.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const B01065 = 'B01065';
const B01065P = 'B01065P';
const B01069 = 'B01069';
const B02061 = 'B02061';
const RED_TARGET = 'W79-RED-TARGET';
const NON_RED = 'W79-NON-RED';
const OPP_EVIDENCE = 'W79-OPP-EVIDENCE';
const OPP_TAIL = 'W79-OPP-TAIL';
const OLD_EVIDENCE = 'W79-OLD-EVIDENCE';
const OWNER_DRAW = 'W79-OWNER-DRAW';
const OWNER_TAIL = 'W79-OWNER-TAIL';
const ATTACKER = 'W79-ATTACKER';
const VICTIM = 'W79-VICTIM';
const CASE = 'W79-CASE';
const ACTION_GAIN = 'W79-ACTION-GAIN';

const ENTER_ROWS = [
  { cardId: B01069, downstream: 'draw' as const },
  { cardId: B02061, downstream: 'assault' as const },
];
const HIRAMEKI_ROWS = [B01065, B01065P, B02061] as const;

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave79 state');
  return state;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function enterState(
  cardId: typeof B01069 | typeof B02061,
  owner: Player,
  receiverDeck = [OPP_EVIDENCE, OPP_TAIL],
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 14, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].file = Array.from({ length: 6 }, () => ({
    type: 'card-back' as const, cardId: OWNER_TAIL,
  }));
  state.players[owner].hand = [cardId];
  state.players[owner].deck = [OWNER_DRAW, OWNER_TAIL];
  state.players[owner].scene = [
    sceneChar(RED_TARGET, `${owner}-red-target`),
    sceneChar(NON_RED, `${owner}-non-red`),
  ];
  state.players[other(owner)].deck = [...receiverDeck];
  state.players[other(owner)].evidence = [{
    cardId: OLD_EVIDENCE, faceUp: false, origin: { turn: 1, via: 'opening' },
  }];
  return state;
}

function enterPublicly(cardId: typeof B01069 | typeof B02061, owner: Player): string {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId })).toEqual({ ok: true });
  const source = current().players[owner].scene.find(card => card.cardId === cardId);
  expect(source).toBeTruthy();
  return source!.uid;
}

function pendingOptional(cardId: string, owner: Player) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({
    player: owner,
    source: { cardId, abilityId: 'a1', area: 'scene' },
  });
  return pending!;
}

function resolveOptional(cardId: string, owner: Player, run: boolean): void {
  const pending = pendingOptional(cardId, owner);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function leaveState(cardId: typeof B01065 | typeof B01065P, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 16, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(cardId, `${owner}-source`, { state: 'sleep' }),
    sceneChar(VICTIM, `${owner}-victim`),
  ];
  state.players[other(owner)].scene = [sceneChar(ATTACKER, `${other(owner)}-attacker`)];
  state.players[owner].deck = [OWNER_DRAW, OWNER_TAIL];
  state.players[other(owner)].deck = [OPP_EVIDENCE, OPP_TAIL];
  state.players[other(owner)].evidence = [{
    cardId: OLD_EVIDENCE, faceUp: false, origin: { turn: 1, via: 'opening' },
  }];
  return state;
}

function removeSourceThroughPublicContact(owner: Player): void {
  const attacker = `${other(owner)}-attacker`;
  const source = `${owner}-source`;
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: attacker, targetUid: source }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' },
  })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function settleAction(): void {
  for (let step = 0; step < 3; step += 1) {
    const actionId = useGameStateStore.getState().activeActionId;
    if (!actionId) return;
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function hiramekiState(cardId: (typeof HIRAMEKI_ROWS)[number], owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 18, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: CASE, status: '事件編', colors: ['赤'],
  };
  state.players[owner].evidence = [{
    cardId, faceUp: false, origin: { turn: 1, via: 'opening' },
  }];
  state.players[owner].deck = [OWNER_DRAW, OWNER_TAIL];
  state.players[owner].scene = [sceneChar(VICTIM, `${owner}-victim`)];
  state.players[other(owner)].deck = [ACTION_GAIN, OPP_TAIL];
  state.players[other(owner)].scene = [sceneChar(ATTACKER, `${other(owner)}-attacker`)];
  return state;
}

function openHirameki(owner: Player): void {
  expect(dispatchEngineAction({
    type: 'actionDeclareCase', byUid: `${other(owner)}-attacker`, targetPlayer: owner,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetPendingHirameki();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(RED_TARGET), fixture(NON_RED, { colors: ['緑'] }), fixture(OPP_EVIDENCE),
    fixture(OPP_TAIL), fixture(OLD_EVIDENCE), fixture(OWNER_DRAW), fixture(OWNER_TAIL),
    fixture(ATTACKER, { colors: ['青'], level: 6, ap: 9000 }), fixture(VICTIM),
    fixture(ACTION_GAIN), fixture(CASE, { kind: 'case', caseLevel: 7, caseTraits: [] }),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingHirameki();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave79: opponent evidence gain is a real optional transfer', () => {
  it.each(ENTER_ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner publicly accepts before the opponent gains hidden top evidence',
    ({ cardId, downstream, owner }) => {
      install(enterState(cardId, owner), `${cardId}:wave79-accept-${owner}`, owner);
      const sourceUid = enterPublicly(cardId, owner);
      expect(current().players[other(owner)].evidence).toEqual([
        expect.objectContaining({ cardId: OLD_EVIDENCE }),
      ]);

      resolveOptional(cardId, owner, true);
      if (downstream === 'assault') {
        surfacePendingSideChannels();
        const pick = useGameStateStore.getState().pendingEffectPick;
        expect(pick).toMatchObject({ player: owner, atomVerb: 'charGrantKeyword' });
        expect(pick?.candidates.map(candidate => candidate.uid)).toEqual([`${owner}-red-target`]);
        expect(dispatchEngineAction(bindPendingDecision(pick!, {
          type: 'effectPickResolve', pickedUid: `${owner}-red-target`,
        }))).toEqual({ ok: true });
      }

      const receiver = current().players[other(owner)];
      // Card-bound enter targets: B01069 and B02061.
      expect(receiver.evidence).toEqual([
        expect.objectContaining({ cardId: OLD_EVIDENCE, faceUp: false }),
        expect.objectContaining({ cardId: OPP_EVIDENCE, faceUp: false }),
      ]);
      expect(receiver.deck).toEqual([OPP_TAIL]);
      expect(JSON.stringify(current().log)).not.toContain(OPP_EVIDENCE);
      if (downstream === 'draw') {
        expect(current().players[owner].hand).toContain(OWNER_DRAW);
        expect(current().players[owner].deck).toEqual([OWNER_TAIL]);
      } else {
        expect(readChar.hasKeyword(current(), `${owner}-red-target`, '突撃[事件]')).toBe(true);
        expect(readChar.hasKeyword(current(), sourceUid, '突撃[事件]')).toBe(false);
        expect(current().players[owner].hand).not.toContain(OWNER_DRAW);
      }
    },
  );

  it.each(ENTER_ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner publicly declines without evidence or downstream effects',
    ({ cardId, owner }) => {
      install(enterState(cardId, owner), `${cardId}:wave79-decline-${owner}`, owner);
      const sourceUid = enterPublicly(cardId, owner);
      resolveOptional(cardId, owner, false);
      expect(current().players[other(owner)].evidence).toEqual([
        expect.objectContaining({ cardId: OLD_EVIDENCE }),
      ]);
      expect(current().players[other(owner)].deck).toEqual([OPP_EVIDENCE, OPP_TAIL]);
      expect(current().players[owner].hand).not.toContain(OWNER_DRAW);
      expect(readChar.hasKeyword(current(), `${owner}-red-target`, '突撃[事件]')).toBe(false);
      expect(readChar.hasKeyword(current(), sourceUid, '突撃[事件]')).toBe(false);
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    },
  );

  it.each(ENTER_ROWS)(
    '$cardId exact-one receiver deck commits hidden evidence, then deck-out stops downstream effects',
    ({ cardId }) => {
      const state = enterState(cardId, 'self', [OPP_EVIDENCE]);
      state.players.opp.evidence = [];
      install(state, `${cardId}:wave79-exact-one-deck-out`, 'self');
      const sourceUid = enterPublicly(cardId, 'self');
      resolveOptional(cardId, 'self', true);
      surfacePendingSideChannels();
      expect(current().players.opp.evidence).toEqual([
        expect.objectContaining({ cardId: OPP_EVIDENCE, faceUp: false }),
      ]);
      expect(current().players.opp.deck).toEqual([]);
      expect(current().gameResult).toEqual({ winner: 'self', reason: 'deck-out' });
      expect(current().players.self.hand).not.toContain(OWNER_DRAW);
      expect(readChar.hasKeyword(current(), 'self-red-target', '突撃[事件]')).toBe(false);
      expect(readChar.hasKeyword(current(), sourceUid, '突撃[事件]')).toBe(false);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );

  it.each(
    ([B01065, B01065P] as const).flatMap(cardId => (
      ['self', 'opp'] as const
    ).map(owner => ({ cardId, owner }))),
  )('$cardId owner $owner publicly gives the opponent hidden top evidence after its contact leave', ({ cardId, owner }) => {
    install(leaveState(cardId, owner), `${cardId}:wave79-leave-accept-${owner}`, owner);
    removeSourceThroughPublicContact(owner);
    expect(current().players[owner].remove).toContain(cardId);
    resolveOptional(cardId, owner, true);
    // Card-bound leave targets: B01065 and B01065P.
    expect(current().players[other(owner)].evidence).toEqual([
      expect.objectContaining({ cardId: OLD_EVIDENCE, faceUp: false }),
      expect.objectContaining({ cardId: OPP_EVIDENCE, faceUp: false }),
    ]);
    expect(current().players[other(owner)].deck).toEqual([OPP_TAIL]);
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({ player: owner, atomVerb: 'sceneRemove' });
    expect(pick?.candidates.map(candidate => candidate.uid)).toEqual([`${owner}-victim`]);
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: `${owner}-victim`,
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.some(card => card.uid === `${owner}-victim`)).toBe(false);
    settleAction();
  });

  it.each([B01065, B01065P] as const)(
    '$cardId public decline keeps the opponent deck and downstream victim intact',
    (cardId) => {
      install(leaveState(cardId, 'self'), `${cardId}:wave79-leave-decline`, 'self');
      removeSourceThroughPublicContact('self');
      resolveOptional(cardId, 'self', false);
      expect(current().players.opp.evidence).toEqual([
        expect.objectContaining({ cardId: OLD_EVIDENCE }),
      ]);
      expect(current().players.opp.deck).toEqual([OPP_EVIDENCE, OPP_TAIL]);
      expect(current().players.self.scene.some(card => card.uid === 'self-victim')).toBe(true);
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      settleAction();
    },
  );

  it.each(HIRAMEKI_ROWS.flatMap(cardId => (
    ['self', 'opp'] as const
  ).map(owner => ({ cardId, owner }))))(
    '$cardId owner $owner fires Hirameki through the public case-action decision',
    ({ cardId, owner }) => {
      install(hiramekiState(cardId, owner), `${cardId}:wave79-hirameki-fire-${owner}`, owner);
      openHirameki(owner);
      expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
        player: owner, cardId, abilityId: 'a2', effectValid: true,
      });
      expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
      if (cardId === B02061) {
        expect(current().players[owner].hand).toContain(OWNER_DRAW);
      } else {
        surfacePendingSideChannels();
        const pick = useGameStateStore.getState().pendingEffectPick;
        expect(pick).toMatchObject({ player: owner, atomVerb: 'sceneSetState' });
        expect(pick?.candidates.map(candidate => candidate.uid).sort()).toEqual([
          `${owner}-victim`, `${other(owner)}-attacker`,
        ].sort());
        expect(dispatchEngineAction(bindPendingDecision(pick!, {
          type: 'effectPickResolve', pickedUid: `${owner}-victim`,
        }))).toEqual({ ok: true });
        expect(current().players[owner].scene[0]?.state).toBe('sleep');
      }
      settleAction();
      expect(current().players[owner].remove).toContain(cardId);
    },
  );

  it.each(HIRAMEKI_ROWS)(
    '$cardId public Hirameki skip causes no draw, sleep, or unresolved decision',
    (cardId) => {
      install(hiramekiState(cardId, 'self'), `${cardId}:wave79-hirameki-skip`, 'self');
      openHirameki('self');
      expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' })).toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players.self.hand).not.toContain(OWNER_DRAW);
      expect(current().players.self.scene[0]?.state).toBe('active');
      settleAction();
      expect(current().players.self.remove).toContain(cardId);
    },
  );

  it('B02061 reauthenticates a saved optional before evidence transfer', () => {
    install(enterState(B02061, 'self'), 'B02061:wave79-save-optional', 'self');
    enterPublicly(B02061, 'self');
    const oldOptional = pendingOptional(B02061, 'self');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectOptional!;
    expect(restored.decisionId).not.toBe(oldOptional.decisionId);

    const before = current();
    const beforeJson = JSON.stringify(before);
    const presentation = {
      revision: getPresentationQueue().revision(),
      epoch: getPresentationQueue().currentEpoch(),
      items: getPresentationQueue().items(),
    };
    expect(dispatchEngineAction(bindPendingDecision(oldOptional, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect({
      revision: getPresentationQueue().revision(),
      epoch: getPresentationQueue().currentEpoch(),
      items: getPresentationQueue().items(),
    }).toEqual(presentation);

    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.opp.evidence.at(-1)).toMatchObject({
      cardId: OPP_EVIDENCE, faceUp: false,
    });
  });

  it.each(ENTER_ROWS)('$cardId CPU takes the optional-skip route without hidden side effects', ({ cardId }) => {
    const state = enterState(cardId, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'handUseCard' && candidate.cardId === cardId
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.evidence).toEqual([
      expect.objectContaining({ cardId: OLD_EVIDENCE }),
    ]);
    expect(after.players.self.deck).toEqual([OPP_EVIDENCE, OPP_TAIL]);
    expect(after.players.opp.hand).not.toContain(OWNER_DRAW);
    expect(readChar.hasKeyword(after, 'opp-red-target', '突撃[事件]')).toBe(false);
  });
});
