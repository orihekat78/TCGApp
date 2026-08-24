// qa: card:B01039:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:B02031:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:B02052:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:B02067:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// Rules: 03-field-areas, 06-card-types, 13-keywords, 15-abilities-effects,
// 16-card-set, 17-icons, 25-qa-effects-resolution.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
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
import { sceneChar } from '../../helpers/fixtures';

const GREEN = 'W78-GREEN';
const GREEN_DETECTIVE = 'W78-GREEN-DETECTIVE';
const RED = 'W78-RED';
const KAITO = 'W78-KAITO';
const PLAIN = 'W78-PLAIN';
const FILE_CARD = 'W78-FILE';
const DECK_CARD = 'W78-DECK';

type Row = {
  cardId: 'B01039' | 'B02031' | 'B02031P' | 'B02052' | 'B02052P' | 'B02067' | 'B02067P';
  color: string;
  abilityId: 'a0' | 'a1';
  valid: string;
  decoy: string;
};

const ROWS: Row[] = [
  { cardId: 'B01039', color: '緑', abilityId: 'a1', valid: GREEN, decoy: RED },
  { cardId: 'B02031', color: '緑', abilityId: 'a1', valid: GREEN_DETECTIVE, decoy: GREEN },
  { cardId: 'B02031P', color: '緑', abilityId: 'a1', valid: GREEN_DETECTIVE, decoy: GREEN },
  { cardId: 'B02052', color: '白', abilityId: 'a1', valid: KAITO, decoy: PLAIN },
  { cardId: 'B02052P', color: '白', abilityId: 'a1', valid: KAITO, decoy: PLAIN },
  { cardId: 'B02067', color: '赤', abilityId: 'a0', valid: RED, decoy: GREEN },
  { cardId: 'B02067P', color: '赤', abilityId: 'a0', valid: RED, decoy: GREEN },
];

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave78 state');
  return state;
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

function stateFor(row: Row, owner: Player, withHost = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 20, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = [row.color];
  state.players[owner].file = Array.from({ length: 7 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD,
  }));
  state.players[owner].hand = [row.cardId];
  state.players[owner].deck = [DECK_CARD, DECK_CARD];
  state.players[owner].scene = [
    ...(withHost ? [sceneChar(row.valid, `${owner}-valid`)] : []),
    sceneChar(row.decoy, `${owner}-decoy`),
  ];
  state.players[other(owner)].deck = [DECK_CARD, DECK_CARD];
  state.players[other(owner)].scene = [sceneChar(row.valid, `${other(owner)}-foreign`)];
  return state;
}

function beginSet(row: Row, owner: Player) {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: owner,
    atomVerb: 'charSetCard',
    nMin: 1,
    nMax: 1,
    source: { cardId: row.cardId, abilityId: row.abilityId },
  });
  expect(pending?.candidates.map(candidate => candidate.uid)).toEqual([`${owner}-valid`]);
  return pending!;
}

function resolveSet(row: Row, owner: Player): void {
  const pending = beginSet(row, owner);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: `${owner}-valid`,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(GREEN, { colors: ['緑'] }),
    fixture(GREEN_DETECTIVE, { colors: ['緑'], traits: ['探偵'] }),
    fixture(RED, { colors: ['赤'] }),
    fixture(KAITO, { colors: ['白'], traits: ['怪盗'] }),
    fixture(PLAIN), fixture(FILE_CARD), fixture(DECK_CARD),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave78: a set event remains usable without an eligible host', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner publicly requires its sole eligible host and persists the set occurrence',
    ({ owner, ...row }) => {
      install(stateFor(row, owner), `${row.cardId}:wave78-host-${owner}`, owner);
      const pending = beginSet(row, owner);
      const before = current();
      const beforeJson = JSON.stringify(before);
      const beforePresentation = {
        revision: getPresentationQueue().revision(),
        epoch: getPresentationQueue().currentEpoch(),
        items: getPresentationQueue().items(),
      };
      for (const pickedUid of [null, `${other(owner)}-foreign`]) {
        expect(dispatchEngineAction(bindPendingDecision(pending, {
          type: 'effectPickResolve', pickedUid,
        }))).toEqual({ ok: false, reason: 'not-allowed' });
        expect(current()).toBe(before);
        expect(JSON.stringify(current())).toBe(beforeJson);
        expect(useGameStateStore.getState().pendingEffectPick).toBe(pending);
        expect({
          revision: getPresentationQueue().revision(),
          epoch: getPresentationQueue().currentEpoch(),
          items: getPresentationQueue().items(),
        }).toEqual(beforePresentation);
      }

      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'effectPickResolve', pickedUid: `${owner}-valid`,
      }))).toEqual({ ok: true });
      const host = current().players[owner].scene.find(card => card.uid === `${owner}-valid`)!;
      // Card-bound physical targets: B01039, B02031/P, B02052/P, and B02067/P.
      expect(host.setCards).toEqual([
        expect.objectContaining({ cardId: row.cardId, faceUp: true }),
      ]);
      expect(host.setCards[0]?.instanceId).toBeTruthy();
      expect(current().players[owner].remove).not.toContain(row.cardId);
      expect(current().players[owner].scene.find(card => card.uid === `${owner}-decoy`)?.setCards)
        .toEqual([]);
      expect(current().players[other(owner)].scene[0]?.setCards).toEqual([]);

      const saved = JSON.parse(JSON.stringify(current())) as GameState;
      expect(useGameStateStore.getState().setGameState(null)).toBe(true);
      expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
      expect(current().players[owner].scene.find(card => card.uid === `${owner}-valid`)?.setCards)
        .toEqual([expect.objectContaining({ cardId: row.cardId, faceUp: true })]);

      const afterLeave = produce(current(), draft => {
        mutate.scene.removeToRemove(draft, `${owner}-valid`, 'switch');
      });
      expect(afterLeave.players[owner].scene.some(card => card.uid === `${owner}-valid`)).toBe(false);
      expect(afterLeave.players[owner].remove).toEqual(expect.arrayContaining([row.valid, row.cardId]));
    },
  );

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner remains publicly usable when only invalid or opposing hosts exist',
    ({ owner, ...row }) => {
      install(stateFor(row, owner, false), `${row.cardId}:wave78-no-host-${owner}`, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
        .toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
      expect(current().players[owner].hand).not.toContain(row.cardId);
      expect(current().players[owner].remove).toContain(row.cardId);
      expect(current().players[owner].scene.every(card => card.setCards.length === 0)).toBe(true);
      expect(current().players[other(owner)].scene[0]?.setCards).toEqual([]);
    },
  );

  it('B02052P reauthenticates a saved mandatory host choice', () => {
    const row = ROWS.find(candidate => candidate.cardId === 'B02052P')!;
    install(stateFor(row, 'self'), 'B02052P:wave78-save-pending', 'self');
    const oldPending = beginSet(row, 'self');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectPick!;
    expect(restored.decisionId).not.toBe(oldPending.decisionId);
    expect(dispatchEngineAction(bindPendingDecision(oldPending, {
      type: 'effectPickResolve', pickedUid: 'self-valid',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'effectPickResolve', pickedUid: 'self-valid',
    }))).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.setCards).toEqual([
      expect.objectContaining({ cardId: row.cardId, faceUp: true }),
    ]);
  });

  it.each(ROWS)('$cardId CPU uses the event and resolves its sole host occurrence', (row) => {
    const state = stateFor(row, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'handUseCard' && candidate.cardId === row.cardId
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.scene.find(card => card.uid === 'opp-valid')?.setCards)
      .toEqual([expect.objectContaining({ cardId: row.cardId, faceUp: true })]);
  });

  it('B01039 consumes its set event and keeps the host against an opposing effect', () => {
    const row = ROWS.find(candidate => candidate.cardId === 'B01039')!;
    install(stateFor(row, 'self'), 'B01039:wave78-opponent-effect', 'self');
    resolveSet(row, 'self');
    const after = produce(current(), draft => {
      mutate.scene.removeToRemove(draft, 'self-valid', 'effect', 'opp-foreign', { byPlayer: 'opp' });
    });
    expect(after.players.self.scene.some(card => card.uid === 'self-valid')).toBe(true);
    expect(after.players.self.scene.find(card => card.uid === 'self-valid')?.setCards).toEqual([]);
    expect(after.players.self.remove).toContain('B01039');
  });

  it.each(['B02031', 'B02031P'] as const)(
    '$cardId public set grants Assault[character] and active-target action legality',
    (cardId) => {
      const row = ROWS.find(candidate => candidate.cardId === cardId)!;
      install(stateFor(row, 'self'), `${cardId}:wave78-host-consumer`, 'self');
      resolveSet(row, 'self');
      expect(readChar.hasKeyword(current(), 'self-valid', '突撃[キャラ]')).toBe(true);
      expect(readChar.hasTextAbility(current(), 'self-valid', 'actionTargetsActive')).toBe(true);
      expect(readChar.hasKeyword(current(), 'self-decoy', '突撃[キャラ]')).toBe(false);
      expect(readChar.hasTextAbility(current(), 'opp-foreign', 'actionTargetsActive')).toBe(false);
      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'self-valid', targetUid: 'opp-foreign',
      })).toEqual({ ok: true });
    },
  );
});
