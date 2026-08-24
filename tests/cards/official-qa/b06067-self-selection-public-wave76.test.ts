// qa: card:B06067:28660457e46b234b8eda0f8ef2c6f3353a37a1739cfebe4112b7bfffed415436
// Rules: 07-action-flow, 08-contact, 13-keywords, 15-abilities-effects,
// 17-icons, 21-declared-ability-cost, 22-qa-action-contact.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate';
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

type Row = { cardId: 'B06067' | 'B06067P' };
const ROWS: Row[] = [{ cardId: 'B06067' }, { cardId: 'B06067P' }];
const POLICE = 'W76-POLICE';
const POLICE_TWO = 'W76-POLICE-TWO';
const NON_POLICE = 'W76-NON-POLICE';
const OPP_POLICE = 'W76-OPP-POLICE';
const ACTIVE_TARGET = 'W76-ACTIVE-TARGET';
const VICTIM_A = 'W76-VICTIM-A';
const VICTIM_B = 'W76-VICTIM-B';
const COST_A = 'W76-COST-A';
const COST_B = 'W76-COST-B';
const DRAW_A = 'W76-DRAW-A';
const DRAW_B = 'W76-DRAW-B';
const TAIL = 'W76-TAIL';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['白'], level: 3,
    ap: kind === 'character' ? 3000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(POLICE, { traits: ['警察'], ap: 9000 }),
  fixture(POLICE_TWO, { traits: ['警察'], ap: 9000 }),
  fixture(NON_POLICE, { traits: ['探偵'], ap: 9000 }),
  fixture(OPP_POLICE, { traits: ['警察'], ap: 4000 }),
  fixture(ACTIVE_TARGET, { ap: 4000 }),
  fixture(VICTIM_A, { ap: 1000 }), fixture(VICTIM_B, { ap: 1000 }),
  fixture(COST_A), fixture(COST_B), fixture(DRAW_A), fixture(DRAW_B), fixture(TAIL),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave76 state');
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

function grantState(row: Row, owner: Player, hand = [COST_A, COST_B]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 10, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(row.cardId, `${owner}-source`),
    sceneChar(POLICE, `${owner}-police`),
    sceneChar(NON_POLICE, `${owner}-non-police`),
  ];
  state.players[other(owner)].scene = [
    sceneChar(OPP_POLICE, `${other(owner)}-opp-police`),
    sceneChar(ACTIVE_TARGET, `${other(owner)}-active-target`),
  ];
  state.players[owner].hand = [...hand];
  state.players[owner].deck = [DRAW_A, DRAW_B, TAIL];
  state.players[other(owner)].deck = [TAIL, TAIL, TAIL];
  return state;
}

function dispatchGrant(row: Row, owner: Player, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: `${owner}-source`, abilId: 'a3',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { removeFromHand: { indices } },
  });
}

function pendingGrant(row: Row, owner: Player) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.source).toMatchObject({
    cardId: row.cardId, uid: `${owner}-source`, abilityId: 'a3', abilityOrigin: 'printed', abilityIndex: 1,
  });
  return pending!;
}

function resolveGrant(row: Row, owner: Player, pickedUid: string | null): void {
  const pending = pendingGrant(row, owner);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function triggerState(row: Row, owner: Player, twoAttackers = false): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 12, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(row.cardId, `${owner}-source`),
    sceneChar(POLICE, `${owner}-police`),
    ...(twoAttackers ? [sceneChar(POLICE_TWO, `${owner}-police-two`)] : []),
  ];
  state.players[other(owner)].scene = [
    sceneChar(VICTIM_A, `${other(owner)}-victim-a`, { state: 'sleep' }),
    ...(twoAttackers ? [sceneChar(VICTIM_B, `${other(owner)}-victim-b`, { state: 'sleep' })] : []),
  ];
  state.players[owner].deck = [DRAW_A, DRAW_B, TAIL];
  state.players[other(owner)].deck = [TAIL, TAIL, TAIL];
  return state;
}

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 24 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = current().actionContexts?.[actionId];
    if (!action) break;
    if (action.phase === 'guard-window') {
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    } else if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const alreadyActed = action.phase === 'action-1'
        ? action.firstActed
        : action.phase === 'action-2'
          ? action.secondActed
          : action.firstRedoActed;
      if (alreadyActed !== undefined) {
        expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
        continue;
      }
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(card => card.uid === actingUid) ? 'self' : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction(action.judgeResolved === true
        ? { type: 'actionAdvance', actionId }
        : { type: 'actionJudge', actionId })).toEqual({ ok: true });
    } else {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function runPublicContact(owner: Player, attackerUid: string, targetUid: string): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: attackerUid, targetUid }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  finishCharacterAction(actionId!);
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
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

// Card-bound physical sources: B06067 and B06067P.
describe('official QA Wave76: B06067 can grant its declared effect to itself', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId publicly pays the non-first $owner hand occurrence and selects itself',
    ({ owner, ...row }) => {
      install(grantState(row, owner), `${row.cardId}:wave76-self-${owner}`, owner);
      expect(dispatchGrant(row, owner, [1])).toEqual({ ok: true });
      const pick = pendingGrant(row, owner);
      expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${owner}-source`);
      expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${owner}-police`);
      expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${other(owner)}-opp-police`);
      expect(pick.candidates.map(candidate => candidate.uid)).not.toContain(`${owner}-non-police`);
      resolveGrant(row, owner, `${owner}-source`);

      expect(current().players[owner].hand).toEqual([COST_A]);
      expect(current().players[owner].remove).toEqual([COST_B]);
      expect(current().players[owner].scene[0]?.turnEffects.actionTargetsActive).toBe(true);
      expect(current().players[other(owner)].scene.every(card => !card.turnEffects.actionTargetsActive)).toBe(true);
    },
  );

  it.each(ROWS)('$cardId zero target still pays exactly one hand card and consumes turn use', row => {
    install(grantState(row, 'self'), `${row.cardId}:wave76-zero`, 'self');
    expect(dispatchGrant(row, 'self', [0])).toEqual({ ok: true });
    resolveGrant(row, 'self', null);
    expect(current().players.self.hand).toEqual([COST_B]);
    expect(current().players.self.remove).toEqual([COST_A]);
    expect([...current().players.self.scene, ...current().players.opp.scene]
      .every(card => !card.turnEffects.actionTargetsActive)).toBe(true);
    expect(readChar.declaredUseCount(current(), 'self-source', 'a3', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
  });

  it.each(ROWS)('$cardId rejects zero, duplicate, over-count, and out-of-range hand payment atomically', row => {
    for (const indices of [[], [0, 0], [0, 1], [99]]) {
      install(grantState(row, 'self'), `${row.cardId}:wave76-bad-${indices.join('-')}`, 'self');
      const before = current();
      const beforeJson = JSON.stringify(before);
      const beforeRuntimeJson = JSON.stringify(before.pendingRuntimeState);
      const beforePending = useGameStateStore.getState().pendingEffectPick;
      const beforePresentation = {
        revision: getPresentationQueue().revision(),
        epoch: getPresentationQueue().currentEpoch(),
        items: getPresentationQueue().items(),
      };
      expect(dispatchGrant(row, 'self', indices)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(JSON.stringify(current().pendingRuntimeState)).toBe(beforeRuntimeJson);
      expect(readChar.declaredUseCount(current(), 'self-source', 'a3', {
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toBe(0);
      expect(useGameStateStore.getState().pendingEffectPick).toBe(beforePending);
      expect({
        revision: getPresentationQueue().revision(),
        epoch: getPresentationQueue().currentEpoch(),
        items: getPresentationQueue().items(),
      }).toEqual(beforePresentation);
    }
  });

  it.each(ROWS)('$cardId rejects an empty hand before any turn-use or decision change', row => {
    install(grantState(row, 'self', []), `${row.cardId}:wave76-empty`, 'self');
    const before = current();
    expect(dispatchGrant(row, 'self', [])).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(readChar.declaredUseCount(current(), 'self-source', 'a3', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(0);
  });

  it('B06067 grant makes its source publicly able to action an active opposing character', () => {
    const row: Row = { cardId: 'B06067' };
    install(grantState(row, 'self'), 'B06067:wave76-active-action', 'self');
    expect(dispatchGrant(row, 'self', [0])).toEqual({ ok: true });
    resolveGrant(row, 'self', 'self-source');
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'self-source', targetUid: 'opp-active-target',
    })).toEqual({ ok: true });
  });

  it('B06067 can grant an opponent Police occurrence without changing another occurrence', () => {
    const row: Row = { cardId: 'B06067' };
    install(grantState(row, 'self'), 'B06067:wave76-opponent-target', 'self');
    expect(dispatchGrant(row, 'self', [0])).toEqual({ ok: true });
    resolveGrant(row, 'self', 'opp-opp-police');
    expect(current().players.opp.scene.find(card => card.uid === 'opp-opp-police')?.turnEffects.actionTargetsActive)
      .toBe(true);
    expect(current().players.self.scene.every(card => !card.turnEffects.actionTargetsActive)).toBe(true);
  });

  it('B06067 turn grant survives save hydration and expires at turn end', () => {
    const row: Row = { cardId: 'B06067' };
    install(grantState(row, 'self'), 'B06067:wave76-save', 'self');
    expect(dispatchGrant(row, 'self', [0])).toEqual({ ok: true });
    const pending = pendingGrant(row, 'self');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    const restored = useGameStateStore.getState().pendingEffectPick!;
    expect(restored.decisionId).not.toBe(pending.decisionId);
    expect(restored.source).toMatchObject(pending.source);
    expect(restored.candidates.map(candidate => candidate.uid)).toEqual(pending.candidates.map(candidate => candidate.uid));
    const beforeStale = current();
    const beforeStaleJson = JSON.stringify(beforeStale);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: 'self-source',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(beforeStale);
    expect(JSON.stringify(current())).toBe(beforeStaleJson);
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'effectPickResolve', pickedUid: 'self-source',
    }))).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.turnEffects.actionTargetsActive).toBe(true);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().players.self.scene[0]?.turnEffects.actionTargetsActive).not.toBe(true);
  });

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner draws when another own Police removes an opponent by contact',
    ({ owner, ...row }) => {
      install(triggerState(row, owner), `${row.cardId}:wave76-trigger-${owner}`, owner);
      runPublicContact(owner, `${owner}-police`, `${other(owner)}-victim-a`);
      expect(current().players[owner].hand).toEqual([DRAW_A]);
      expect(current().players[owner].deck).toEqual([DRAW_B, TAIL]);
      expect(current().players[other(owner)].remove).toContain(VICTIM_A);
      expect(readChar.declaredUseCount(current(), `${owner}-source`, 'a2', {
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toBe(1);
    },
  );

  it.each(ROWS)('$cardId does not draw when the observer itself wins the contact', row => {
    const state = triggerState(row, 'self');
    state.players.self.scene = [sceneChar(row.cardId, 'self-source')];
    install(state, `${row.cardId}:wave76-exclude-source`, 'self');
    runPublicContact('self', 'self-source', 'opp-victim-a');
    expect(current().players.self.hand).toEqual([]);
    expect(readChar.declaredUseCount(current(), 'self-source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(0);
  });

  it.each(ROWS)('$cardId ignores a non-Police contact winner and effect removal', row => {
    let state = triggerState(row, 'self');
    state.players.self.scene[1] = sceneChar(NON_POLICE, 'self-non-police');
    install(state, `${row.cardId}:wave76-non-police`, 'self');
    runPublicContact('self', 'self-non-police', 'opp-victim-a');
    expect(current().players.self.hand).toEqual([]);

    state = triggerState(row, 'self');
    const afterEffect = produce(state, draft => {
      mutate.scene.removeToRemove(draft, 'opp-victim-a', 'effect', 'self-police');
      runAllUntilEmpty(draft);
    });
    expect(afterEffect.players.self.hand).toEqual([]);
    expect(readChar.declaredUseCount(afterEffect, 'self-source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(0);
  });

  it('B06067 draws only once across two valid contacts in one turn', () => {
    const row: Row = { cardId: 'B06067' };
    install(triggerState(row, 'self', true), 'B06067:wave76-turn1', 'self');
    runPublicContact('self', 'self-police', 'opp-victim-a');
    runPublicContact('self', 'self-police-two', 'opp-victim-b');
    expect(current().players.self.hand).toEqual([DRAW_A]);
    expect(current().players.self.deck).toEqual([DRAW_B, TAIL]);
  });

  it.each(ROWS)('$cardId CPU pays its own hand and resolves the sole Police grant target', row => {
    const state = grantState(row, 'opp', [COST_A]);
    state.players.opp.scene = [sceneChar(row.cardId, 'opp-source')];
    state.players.self.scene = [sceneChar(NON_POLICE, 'self-non-police')];
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'declaredAbility' && candidate.uid === 'opp-source' && candidate.abilityId === 'a3'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.remove).toEqual([COST_A]);
    expect(after.players.opp.scene[0]?.turnEffects.actionTargetsActive).toBe(true);
    expect(after.players.self.scene[0]?.turnEffects.actionTargetsActive).not.toBe(true);
  });

  it('B06067 CPU contact path preserves the owner-relative draw trigger', () => {
    const row: Row = { cardId: 'B06067' };
    const state = triggerState(row, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'actionAgainstChar'
      && candidate.byUid === 'opp-police'
      && candidate.targetUid === 'self-victim-a'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.hand).toEqual([DRAW_A]);
    expect(after.players.self.remove).toContain(VICTIM_A);
  });
});
