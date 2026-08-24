// qa: card:B08079:63af9346bf0cdf05f7fe697c62740abf76d9e08bc098d298f2d22eb00f875eea
// qa: card:B08084:63af9346bf0cdf05f7fe697c62740abf76d9e08bc098d298f2d22eb00f875eea
// qa: card:B08089:63af9346bf0cdf05f7fe697c62740abf76d9e08bc098d298f2d22eb00f875eea

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08079 } from '@/cards/ct-p08/B08079';
import { B08079P } from '@/cards/ct-p08/B08079P';
import { B08084 } from '@/cards/ct-p08/B08084';
import { B08089 } from '@/cards/ct-p08/B08089';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [
  { card: B08079, abilityId: 'a2' },
  { card: B08079P, abilityId: 'a2' },
  { card: B08084, abilityId: 'a1' },
  { card: B08089, abilityId: 'a1' },
] as const;
const ATTACKER = fixture('W111_ATTACKER', { ap: 10000 });
const DRAWN = fixture('W111_DRAWN');
const TAIL = fixture('W111_TAIL');
const PENALTY_A = fixture('W111_PENALTY_A');
const PENALTY_B = fixture('W111_PENALTY_B');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave111 state');
  return state;
}

function install(
  source: CardDef,
  owner: Player,
  deck: readonly string[],
  caseStatus: '事件編' | '解決編' = '解決編',
): void {
  const attackerOwner = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 4, player: attackerOwner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = caseStatus;
  state.players[owner].scene = [sceneChar(source.id, 'source', { state: 'sleep' })];
  state.players[owner].deck = [...deck];
  state.players[owner].remove = [];
  state.players[attackerOwner].scene = [sceneChar(ATTACKER.id, 'attacker')];
  state.players[attackerOwner].deck = [PENALTY_A.id, PENALTY_B.id];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function removeThroughPublicContact(owner: Player): string {
  const attackerOwner = other(owner);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(current().actionContexts?.[actionId]).toMatchObject({ firstUid: 'source', secondUid: 'attacker' });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: attackerOwner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  return actionId;
}

function expectRefresh(source: CardDef, owner: Player): void {
  const attackerOwner = other(owner);
  expect(current().players[owner].scene.some(card => card.uid === 'source')).toBe(false);
  expect(current().refreshCount[owner]).toBe(1);
  expect(current().players[owner].deck).toEqual([source.id]);
  expect(current().players[owner].remove).toEqual([]);
  expect(current().players[attackerOwner].evidence).toHaveLength(1);
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [ATTACKER, DRAWN, TAIL, PENALTY_A, PENALTY_B]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave111: leave source joins the immediate refresh pool', () => {
  // Card-bound physical rows: B08079 B08079P B08084 B08089.
  it.each(SOURCES.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner refreshes from the removed source before mandatory discard',
    ({ row, owner }) => {
      install(row.card, owner, [DRAWN.id]);
      removeThroughPublicContact(owner);
      expectRefresh(row.card, owner);
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending).toMatchObject({
        atomVerb: 'discard', player: owner,
        source: { cardId: row.card.id, abilityId: row.abilityId },
      });
      expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([DRAWN.id]);
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: pending!.candidates[0]!.uid,
      }))).toEqual({ ok: true });
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toEqual([DRAWN.id]);
      expect(current().players[owner].deck).toEqual([row.card.id]);
    },
  );

  it.each(['self', 'opp'] as const)('B08089 owner %s in incident phase refreshes without discard', owner => {
    install(B08089, owner, [DRAWN.id], '事件編');
    removeThroughPublicContact(owner);
    expectRefresh(B08089, owner);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[owner].hand).toEqual([DRAWN.id]);
  });

  it.each(SOURCES)('$row.card.id owner-turn removal does not trigger or refresh', row => {
    install(row.card, 'self', [DRAWN.id]);
    const state = structuredClone(current());
    state.turn.player = 'self';
    const removed = produce(state, draft => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
    });
    expect(useGameStateStore.getState().setGameState(removed)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.self.deck).toEqual([DRAWN.id]);
    expect(current().players.self.remove).toEqual([row.card.id]);
  });

  it.each(['self', 'opp'] as const)('B08084 owner %s with a nonempty tail draws without refresh', owner => {
    install(B08084, owner, [DRAWN.id, TAIL.id]);
    removeThroughPublicContact(owner);
    expect(current().refreshCount[owner]).toBe(0);
    expect(current().players[owner].deck).toEqual([TAIL.id]);
    expect(current().players[owner].remove).toEqual([B08084.id]);
    expect(current().players[other(owner)].evidence).toHaveLength(0);
  });
});
