// qa: card:B08087:1f49f9f42b38c241ebd655d06681a4cb1c6030ffaa8345da75416cb84193fc80
// qa: card:B08091:1f49f9f42b38c241ebd655d06681a4cb1c6030ffaa8345da75416cb84193fc80
// Rules: 15-abilities-effects.md, 17-icons.md. Public action/decision path only.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B08087 } from '@/cards/ct-p08/B08087';
import { B08091 } from '@/cards/ct-p08/B08091';
import { B10022 } from '@/cards/ct-p10/B10022';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  B08087: 'card:B08087:1f49f9f42b38c241ebd655d06681a4cb1c6030ffaa8345da75416cb84193fc80',
  B08091: 'card:B08091:1f49f9f42b38c241ebd655d06681a4cb1c6030ffaa8345da75416cb84193fc80',
} as const;

const ATTACKER = 'QA_LEAVE_ATTACKER';

function attacker(): CardDef {
  return {
    id: ATTACKER, no: ATTACKER, kind: 'character', names: [ATTACKER], colors: ['blue'],
    level: 1, ap: 9000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function initial(card: CardDef, turn: 'self' | 'opp', faceUp = [true, false, true]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.scene = [
    makeChar({ cardId: card.id, uid: 'source', state: 'sleep' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
  ];
  state.players.self.evidence = faceUp.map((isFaceUp, index) => ({
    cardId: index === 1 ? 'SELF-DOWN-DECOY' : 'SAME-ID', faceUp: isFaceUp, origin: { turn: 0, via: 'opening' as const },
  }));
  state.players.opp.evidence = [{ cardId: 'SAME-ID', faceUp: true, origin: { turn: 0, via: 'opening' } }];
  state.players.self.remove = ['SAME-ID'];
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing state');
  return state;
}

function removeSourceThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function removeSourceThroughOwnDeclaredAbility(): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' }, nMin: 0, nMax: 1 });
  expect(pending?.candidates.some((candidate) => candidate.uid === 'source')).toBe(true);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: 'source',
  }))).toEqual({ ok: true });
}

function pendingA2() {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ source: { abilityId: 'a2' }, nMin: 0, nMax: 1 });
  return pending!;
}

function evidenceFaces(): boolean[] {
  return current().players.self.evidence.map((evidence) => evidence.faceUp);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [B08087, B08091, B10022, attacker()].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => endMatchSession());

describe('B08087 opponent-turn leave evidence public dispatch', () => {
  it(QA.B08087, () => {
    install(initial(B08087, 'opp'));
    removeSourceThroughPublicContact();
    expect(current().players.self.remove).toContain(B08087.id);
    const pending = pendingA2();
    expect(pending.candidates.map((candidate) => candidate.uid)).toEqual(['evidence:self:0', 'evidence:self:2']);
    expect(pending.candidates.every((candidate) => (
      candidate.player === 'self' && candidate.area === 'evidence' && candidate.kind === 'evidence'
    ))).toBe(true);
    expect(current().players.opp.evidence[0]?.faceUp).toBe(true);
    expect(current().players.self.remove).toContain('SAME-ID');

    const before = evidenceFaces();
    expect(dispatchEngineAction(bindPendingDecision({ ...pending, decisionId: `${pending.decisionId}-stale` }, {
      type: 'effectPickResolve', pickedUid: 'evidence:self:2',
    }))).toMatchObject({ ok: false });
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);
    expect(evidenceFaces()).toEqual(before);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: 'evidence:self:99',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);
    expect(evidenceFaces()).toEqual(before);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: 'evidence:self:2',
    }))).toEqual({ ok: true });
    expect(current().players.self.evidence.map((evidence) => evidence.cardId)).toEqual(['SAME-ID', 'SELF-DOWN-DECOY', 'SAME-ID']);
    expect(evidenceFaces()).toEqual([true, false, false]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    endMatchSession();
    beginMatchSession('self');
    install(initial(B08087, 'self'));
    removeSourceThroughOwnDeclaredAbility();
    expect(current().players.self.remove).toContain(B08087.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(evidenceFaces()).toEqual([true, false, true]);
  });
});

describe('B08091 opponent-turn leave evidence public dispatch', () => {
  it(QA.B08091, () => {
    install(initial(B08091, 'opp'));
    removeSourceThroughPublicContact();
    const pending = pendingA2();
    expect(pending.candidates.map((candidate) => candidate.uid)).toEqual(['evidence:self:0', 'evidence:self:2']);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(evidenceFaces()).toEqual([true, false, true]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    endMatchSession();
    beginMatchSession('self');
    install(initial(B08091, 'opp', [false, false, false]));
    removeSourceThroughPublicContact();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(evidenceFaces()).toEqual([false, false, false]);

    endMatchSession();
    beginMatchSession('self');
    install(initial(B08091, 'self'));
    removeSourceThroughOwnDeclaredAbility();
    expect(current().players.self.remove).toContain(B08091.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(evidenceFaces()).toEqual([true, false, true]);
  });
});
