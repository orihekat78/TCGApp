// rules: 07-action-flow.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B03070 } from '@/cards/ct-p03/B03070';
import { B03070P } from '@/cards/ct-p03/B03070P';
import { B04007 } from '@/cards/ct-p04/B04007';
import { B04058 } from '@/cards/ct-p04/B04058';
import { B09013 } from '@/cards/ct-p09/B09013';
import { D08005 } from '@/cards/ct-d08/D08005';
import { PR028 } from '@/cards/pr-01/PR028';
import { PR032 } from '@/cards/pr-01/PR032';
import { event } from '@/engine/event';
import { readPendingEffectOptionalAuthority, withIsolatedPendingRuntimeState } from '@/engine/effect/runtime-state';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, CharacterState, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

const ACTOR: CardDef = {
  id: 'QA_TURN1_ACTOR', no: 'QA_TURN1_ACTOR', kind: 'character', names: ['毛利小五郎'],
  colors: ['青'], level: 7, ap: 9000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const TARGET: CardDef = {
  id: 'QA_TURN1_TARGET', no: 'QA_TURN1_TARGET', kind: 'character', names: ['対象'],
  colors: ['赤'], level: 7, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const HIGH_TARGET: CardDef = {
  id: 'QA_TURN1_HIGH_TARGET', no: 'QA_TURN1_HIGH_TARGET', kind: 'character', names: ['高レベル対象'],
  colors: ['赤'], level: 8, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const HAND_CARD: CardDef = {
  id: 'QA_TURN1_HAND', no: 'QA_TURN1_HAND', kind: 'event', colors: ['赤'], level: 1,
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const LOW_ACTOR: CardDef = {
  id: 'QA_TURN1_LOW_ACTOR', no: 'QA_TURN1_LOW_ACTOR', kind: 'character', names: ['別人'],
  colors: ['青'], level: 7, ap: 7000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const AP_BUFFER: CardDef = {
  id: 'QA_TURN1_AP_BUFFER', no: 'QA_TURN1_AP_BUFFER', kind: 'character', names: ['応援役'],
  colors: ['青'], level: 2, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: {
      hook: 'action:declare',
      matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: {} },
    },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$trigger.byUid', delta: 2000, scope: 'turn' } },
    description: '自分のキャラがアクションしたとき、そのキャラをAP+2000。', ruleRefs: [],
  }],
  ruleRefs: [],
};
const RESOLUTION_SLEEPER: CardDef = {
  id: 'QA_TURN1_RESOLUTION_SLEEPER', no: 'QA_TURN1_RESOLUTION_SLEEPER', kind: 'character', names: ['先行解決役'],
  colors: ['青'], level: 2, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: {
      hook: 'evidence:gain',
      matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'byUid', side: 'self' },
    },
    limit: { kind: 'turn', n: 1 },
    effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: 'source', state: 'sleep' } },
    description: '同時発動した効果の解決順検証用。', ruleRefs: [],
  }],
  ruleRefs: [],
};

const GAIN_CARDS = [B04058, PR028, PR032, B03070, B03070P] as const;

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function evidence(cardId: string) {
  return { cardId, faceUp: false, origin: { turn: 0, via: 'opening' as const } };
}

function gainState(card: CardDef, state: CharacterState): GameState {
  const game = createEmptyGameState();
  game.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  game.players.self.scene = [
    sceneChar(card.id, 'source', { state }),
    sceneChar(ACTOR.id, 'actor-1'),
    sceneChar(ACTOR.id, 'actor-2'),
  ];
  game.players.self.deck = ['QA_SELF_GAIN_1', 'QA_SELF_GAIN_2'];
  game.players.opp.case = {
    cardId: 'QA_OPP_CASE', status: 'case-front', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {},
  } as GameState['players']['self']['case'];
  game.players.opp.evidence = [evidence('QA_OPP_EVIDENCE_1'), evidence('QA_OPP_EVIDENCE_2')];
  game.players.opp.scene = [sceneChar(TARGET.id, 'decline-target', { state: 'sleep' })];
  game.players.opp.hand = [HAND_CARD.id];
  return game;
}

function b09013State(state: CharacterState): GameState {
  const game = createEmptyGameState();
  game.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  game.players.self.scene = [
    sceneChar(B09013.id, 'source', { state }),
    sceneChar(ACTOR.id, 'actor-1'),
    sceneChar(ACTOR.id, 'actor-2'),
  ];
  game.players.self.deck = ['QA_SELF_GAIN_1', 'QA_SELF_GAIN_2'];
  game.players.opp.scene = [sceneChar(TARGET.id, 'victim', { state: 'sleep' })];
  game.players.opp.case = {
    cardId: 'QA_OPP_CASE', status: 'case-front', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {},
  } as GameState['players']['self']['case'];
  game.players.opp.evidence = [evidence('QA_OPP_EVIDENCE_1'), evidence('QA_OPP_EVIDENCE_2')];
  return game;
}

function twoCopyState(card: CardDef, abilityId: 'a1' | 'a2'): GameState {
  const game = abilityId === 'a1' ? gainState(card, 'active') : b09013State('active');
  game.players.self.scene = [
    sceneChar(card.id, 'source-a'),
    sceneChar(card.id, 'source-b'),
    sceneChar(ACTOR.id, 'actor-1'),
  ];
  return game;
}

function install(state: GameState): void {
  endMatchSession();
  beginMatchSession('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function declareCase(byUid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid, targetPlayer: 'opp' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId!;
}

function judgeUnguardedCase(byUid: string): string {
  const actionId = declareCase(byUid);
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  return actionId;
}

function finishAction(actionId: string): void {
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 20 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = current().actionContexts?.[actionId];
    if (!action) break;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some((card) => card.uid === actingUid) ? 'self' : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    }
    if (useGameStateStore.getState().activeActionId === actionId) {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function proveEvidenceGainCard(card: CardDef) {
  install(gainState(card, 'active'));
  let actionId = judgeUnguardedCase('actor-1');
  expect(useGameStateStore.getState().pendingEffectOptional?.source).toMatchObject({
    cardId: card.id, abilityId: 'a1', uid: 'source', area: 'scene',
  });
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: false })).toEqual({ ok: true });
  expect(readChar.declaredUseCount(current(), 'source', 'a1', {
    abilityOrigin: 'printed', abilityIndex: 0,
  })).toBe(1);
  const declineEffect = {
    sourceState: current().players.self.scene.find((candidate) => candidate.uid === 'source')?.state,
    targetStillPresent: current().players.opp.scene.some((candidate) => candidate.uid === 'decline-target'),
    opponentHand: [...current().players.opp.hand],
  };
  finishAction(actionId);

  actionId = judgeUnguardedCase('actor-2');
  const declinedAgain = useGameStateStore.getState().pendingEffectOptional !== null;
  const countAfterRetry = readChar.declaredUseCount(current(), 'source', 'a1', {
    abilityOrigin: 'printed', abilityIndex: 0,
  });
  finishAction(actionId);

  const inactive = (['sleep', 'stun'] as const).map((state) => {
    install(gainState(card, state));
    const inactiveActionId = judgeUnguardedCase('actor-1');
    const result = {
      state,
      optional: useGameStateStore.getState().pendingEffectOptional !== null,
      count: readChar.declaredUseCount(current(), 'source', 'a1', {
        abilityOrigin: 'printed', abilityIndex: 0,
      }),
    };
    finishAction(inactiveActionId);
    return result;
  });

  return { cardId: card.id, declineEffect, declinedAgain, countAfterRetry, inactive };
}

function proveB09013() {
  install(b09013State('active'));
  let actionId = declareCase('actor-1');
  expect(useGameStateStore.getState().pendingEffectOptional?.source).toMatchObject({
    cardId: B09013.id, abilityId: 'a2', uid: 'source', area: 'scene',
  });
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.some((candidate) => candidate.uid === 'victim')).toBe(true);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'victim',
  }))).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  finishAction(actionId);
  const active = {
    sourceState: current().players.self.scene.find((card) => card.uid === 'source')?.state,
    victimRemoved: current().players.opp.remove.includes(TARGET.id),
    count: readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }),
  };

  install(b09013State('active'));
  actionId = declareCase('actor-1');
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: false })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  finishAction(actionId);
  actionId = declareCase('actor-2');
  const declineRetry = {
    optional: useGameStateStore.getState().pendingEffectOptional !== null,
    count: readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }),
  };
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  finishAction(actionId);

  const inactive = (['sleep', 'stun'] as const).map((state) => {
    install(b09013State(state));
    actionId = declareCase('actor-1');
    const result = {
      state,
      optional: useGameStateStore.getState().pendingEffectOptional !== null,
      count: readChar.declaredUseCount(current(), 'source', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      }),
    };
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    finishAction(actionId);
    return result;
  });
  return { active, declineRetry, inactive };
}

function proveOwnerOrder(card: CardDef, abilityId: 'a1' | 'a2') {
  install(twoCopyState(card, abilityId));
  const actionId = abilityId === 'a1' ? judgeUnguardedCase('actor-1') : declareCase('actor-1');
  const initial = pendingOwnerOrderGroup(current(), 'self').filter((entry) =>
    entry.source.cardId === card.id && entry.source.abilityId === abilityId);
  expect(initial.map((entry) => entry.source.uid)).toEqual(['source-a', 'source-b']);
  const firstSource = initial.find(entry => entry.source.uid === 'source-a')!.source;
  const secondSource = initial.find(entry => entry.source.uid === 'source-b')!.source;
  expect(readChar.declaredUseCount(current(), 'source-a', abilityId, {
    abilityOrigin: firstSource.abilityOrigin,
    abilityIndex: firstSource.abilityIndex,
  })).toBe(1);
  expect(readChar.declaredUseCount(current(), 'source-b', abilityId, {
    abilityOrigin: secondSource.abilityOrigin,
    abilityIndex: secondSource.abilityIndex,
  })).toBe(1);

  const second = initial.find((entry) => entry.source.uid === 'source-b')!;
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: second.id, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = pendingOwnerOrderGroup(current(), 'self').filter((entry) =>
    entry.source.cardId === card.id && entry.source.abilityId === abilityId);
  expect(ordered.map((entry) => entry.source.uid)).toEqual(['source-b', 'source-a']);
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
  })).toEqual({ ok: true });

  const resolvedSources: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const pending = useGameStateStore.getState().pendingEffectOptional;
    expect(pending?.source.cardId).toBe(card.id);
    withIsolatedPendingRuntimeState(current(), () => undefined);
    expect(
      readPendingEffectOptionalAuthority(current()),
      `${card.id} optional authority ${index + 1} runtime=${JSON.stringify(current().pendingRuntimeState)}`,
    ).not.toBeNull();
    resolvedSources.push(pending!.source.uid!);
    expect(
      dispatchCurrentDecision({ type: 'optionalResolve', run: false }),
      `${card.id} optional ${index + 1} source=${pending?.source.uid}`,
    ).toEqual({ ok: true });
  }
  if (abilityId === 'a2') {
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  }
  finishAction(actionId);
  return { cardId: card.id, ordered: ['source-b', 'source-a'], resolvedSources };
}

function proveB03070ZeroBounceStillDiscards() {
  const state = gainState(B03070, 'active');
  state.players.opp.scene = [
    sceneChar(TARGET.id, 'eligible-level-7', { state: 'sleep' }),
    sceneChar(HIGH_TARGET.id, 'level-8-decoy', { state: 'sleep' }),
  ];
  state.players.opp.hand = [HAND_CARD.id];
  install(state);
  const actionId = judgeUnguardedCase('actor-1');
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.nMin).toBe(0);
  expect(pick?.candidates.map((candidate) => candidate.uid)).toEqual(['eligible-level-7']);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  const discardPick = useGameStateStore.getState().pendingEffectPick;
  expect(discardPick).toMatchObject({
    player: 'opp', ownerPlayer: 'self', atomVerb: 'discard', nMin: 1, nMax: 1,
    source: { cardId: B03070.id, abilityId: 'a1', uid: 'source', area: 'scene' },
  });
  expect(discardPick?.candidates.map((candidate) => candidate.uid)).toEqual([
    `card:opp:hand:${HAND_CARD.id}#0`,
  ]);
  expect(dispatchEngineAction(bindPendingDecision(discardPick!, {
    type: 'effectPickResolve', pickedUid: discardPick!.candidates[0]!.uid,
  }))).toEqual({ ok: true });
  const beforeFinish = current();
  const result = {
    sourceState: beforeFinish.players.self.scene.find((candidate) => candidate.uid === 'source')?.state,
    eligibleStillPresent: beforeFinish.players.opp.scene.some((candidate) => candidate.uid === 'eligible-level-7'),
    level8StillPresent: beforeFinish.players.opp.scene.some((candidate) => candidate.uid === 'level-8-decoy'),
    opponentHand: [...beforeFinish.players.opp.hand],
    opponentRemove: [...beforeFinish.players.opp.remove],
  };
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  finishAction(actionId);
  return result;
}

function proveB03070HiramekiBeforeGain() {
  endMatchSession();
  const state = createEmptyGameState();
  state.players.self.scene = [sceneChar(B03070.id, 'source')];
  state.players.self.deck = ['QA_SELF_GAIN_1'];
  const { actionId } = openCaseHirameki(state, B04007.id, {
    evidencePlayer: 'opp', actorCardId: D08005.id, humanPlayer: 'opp', sessionLabel: 'b03070-hirameki-before-gain',
  });
  expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.some((candidate) => candidate.uid === 'source')).toBe(true);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'source',
  }))).toEqual({ ok: true });
  const beforeGain = {
    sourceState: current().players.self.scene.find((candidate) => candidate.uid === 'source')?.state,
    evidenceGained: current().players.self.evidence.length,
    optional: useGameStateStore.getState().pendingEffectOptional !== null,
    count: readChar.declaredUseCount(current(), 'source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    }),
  };
  finishAction(actionId);
  const afterGain = {
    sourceState: current().players.self.scene.find((candidate) => candidate.uid === 'source')?.state,
    evidenceGained: current().players.self.evidence.length,
    optional: useGameStateStore.getState().pendingEffectOptional !== null,
    count: readChar.declaredUseCount(current(), 'source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    }),
  };
  return { beforeGain, afterGain };
}

function proveResolutionTimeStateAfterQueue() {
  const state = gainState(B04058, 'active');
  state.players.self.scene.splice(1, 0, sceneChar(RESOLUTION_SLEEPER.id, 'resolution-sleeper'));
  install(state);
  const actionId = judgeUnguardedCase('actor-1');
  const initial = pendingOwnerOrderGroup(current(), 'self');
  expect(initial.map((entry) => entry.source.cardId)).toEqual([B04058.id, RESOLUTION_SLEEPER.id]);
  const sleeper = initial.find((entry) => entry.source.cardId === RESOLUTION_SLEEPER.id)!;
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: sleeper.id, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = pendingOwnerOrderGroup(current(), 'self');
  expect(ordered.map((entry) => entry.source.cardId)).toEqual([RESOLUTION_SLEEPER.id, B04058.id]);
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
  })).toEqual({ ok: true });
  const result = {
    sourceState: current().players.self.scene.find((card) => card.uid === 'source')?.state,
    optional: useGameStateStore.getState().pendingEffectOptional !== null,
    count: readChar.declaredUseCount(current(), 'source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    }),
  };
  finishAction(actionId);
  return result;
}

function proveB09013DeclaredTargetRemoval() {
  install(b09013State('active'));
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor-1', targetUid: 'victim' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  const pending = useGameStateStore.getState().pendingEffectOptional;
  const phaseBeforeGuard = current().actionContexts?.[actionId]?.phase;
  const guardBeforeResolution = dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null });
  expect(useGameStateStore.getState().pendingEffectOptional).toEqual(pending);
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.some((candidate) => candidate.uid === 'victim')).toBe(true);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'victim',
  }))).toEqual({ ok: true });
  const guardAfterRemoval = dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null });
  const activeActionId = useGameStateStore.getState().activeActionId;
  const judgeAfterRemoval = dispatchEngineAction({ type: 'actionJudge', actionId });
  return {
    phaseBeforeGuard,
    guardBeforeResolution,
    victimRemoved: current().players.opp.remove.includes(TARGET.id),
    activeActionId,
    guardAfterRemoval,
    judgeAfterRemoval,
  };
}

function proveB09013DoesNotTriggerAfterApBuff() {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    sceneChar(B09013.id, 'source'),
    sceneChar(AP_BUFFER.id, 'buffer'),
    sceneChar(LOW_ACTOR.id, 'low-actor'),
  ];
  state.players.opp.scene = [sceneChar(TARGET.id, 'victim', { state: 'sleep' })];
  install(state);
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'low-actor', targetUid: 'victim' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  const result = {
    actorAp: readChar.ap(current(), 'low-actor'),
    optional: useGameStateStore.getState().pendingEffectOptional !== null,
    count: readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    }),
  };
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  finishCharacterAction(actionId);
  return result;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  [
    ...GAIN_CARDS, B04007, B09013, D08005, ACTOR, TARGET, HIGH_TARGET, HAND_CARD, LOW_ACTOR, AP_BUFFER,
    RESOLUTION_SLEEPER,
  ].forEach(register);
  registerHiramekiListener();
  registerTriggeredListener();
});

afterEach(() => endMatchSession());

describe('turn-1 resolution-time state gates through public action flow', () => {
  // qa: card:B04058:40d532e87bf9986a2404633398ce55c0b9c2a9b3e49f25e51b00c534170dc432
  // qa: card:B04058:fa780841147e70681c7138d6155bc94c62ff0cca26bab1331784ad16c666e688
  it('B04058 active decline consumes turn1; sleep/stun also fire once without optional', () => {
    expect(proveEvidenceGainCard(B04058)).toEqual({
      cardId: 'B04058',
      declineEffect: { sourceState: 'active', targetStillPresent: true, opponentHand: [HAND_CARD.id] },
      declinedAgain: false, countAfterRetry: 1,
      inactive: [
        { state: 'sleep', optional: false, count: 1 },
        { state: 'stun', optional: false, count: 1 },
      ],
    });
  });
  // qa: card:PR028:21664ef6f28c9f0abee7ad3bb6edcdc9ed2b844a329ab2f3ee804cf1be611407
  // qa: card:PR028:27e9bc7eccc5b9b7bd054d1af390433dd65457f2b96a2b408fa21788957fbdb1
  it('PR028 runs the same public turn1 resolution contract', () => {
    expect(proveEvidenceGainCard(PR028)).toEqual({
      cardId: 'PR028',
      declineEffect: { sourceState: 'active', targetStillPresent: true, opponentHand: [HAND_CARD.id] },
      declinedAgain: false, countAfterRetry: 1,
      inactive: [
        { state: 'sleep', optional: false, count: 1 },
        { state: 'stun', optional: false, count: 1 },
      ],
    });
  });
  // qa: card:PR032:21664ef6f28c9f0abee7ad3bb6edcdc9ed2b844a329ab2f3ee804cf1be611407
  // qa: card:PR032:27e9bc7eccc5b9b7bd054d1af390433dd65457f2b96a2b408fa21788957fbdb1
  it('PR032 runs the same public turn1 resolution contract', () => {
    expect(proveEvidenceGainCard(PR032)).toEqual({
      cardId: 'PR032',
      declineEffect: { sourceState: 'active', targetStillPresent: true, opponentHand: [HAND_CARD.id] },
      declinedAgain: false, countAfterRetry: 1,
      inactive: [
        { state: 'sleep', optional: false, count: 1 },
        { state: 'stun', optional: false, count: 1 },
      ],
    });
  });
  // qa: card:B03070:c22d67c7b5828b06d5241bc20910cbf3e33c90a2b06cc9efb62a78da9cac54a6
  // qa: card:B03070:b8b9a722c505fe1e593ea910566b2dd360e7c6d4186b0e57544eded5fbcd59e7
  // qa: card:B03070:ee39ebda7696f4fa935d1c7bbaf8bcc6eb107b806a8aed39db22233c41f48e4c
  it('B03070 runs the same public turn1 resolution contract', () => {
    expect(proveEvidenceGainCard(B03070)).toEqual({
      cardId: 'B03070',
      declineEffect: { sourceState: 'active', targetStillPresent: true, opponentHand: [HAND_CARD.id] },
      declinedAgain: false, countAfterRetry: 1,
      inactive: [
        { state: 'sleep', optional: false, count: 1 },
        { state: 'stun', optional: false, count: 1 },
      ],
    });
  });
  it('B03070P preserves the printing-specific public source identity', () => {
    expect(proveEvidenceGainCard(B03070P).cardId).toBe('B03070P');
  });
  // qa: card:B09013:b08ad006119a2e096ff0e69b16891aefa65fa55db9fb94b244664317c8824959
  it('B09013 active branch resolves publicly; sleep/stun still consume turn1 without optional', () => {
    expect(proveB09013()).toEqual({
      active: { sourceState: 'sleep', victimRemoved: true, count: 1 },
      declineRetry: { optional: false, count: 1 },
      inactive: [
        { state: 'sleep', optional: false, count: 1 },
        { state: 'stun', optional: false, count: 1 },
      ],
    });
  });

  // qa: card:B04058:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
  it('B04058 copies fire mandatorily and resolve in their owner-selected public order', () => {
    expect(proveOwnerOrder(B04058, 'a1')).toEqual({
      cardId: 'B04058', ordered: ['source-b', 'source-a'], resolvedSources: ['source-b', 'source-a'],
    });
  });
  // qa: card:PR028:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
  it('PR028 copies fire mandatorily and resolve in their owner-selected public order', () => {
    expect(proveOwnerOrder(PR028, 'a1')).toEqual({
      cardId: 'PR028', ordered: ['source-b', 'source-a'], resolvedSources: ['source-b', 'source-a'],
    });
  });
  // qa: card:PR032:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
  it('PR032 copies fire mandatorily and resolve in their owner-selected public order', () => {
    expect(proveOwnerOrder(PR032, 'a1')).toEqual({
      cardId: 'PR032', ordered: ['source-b', 'source-a'], resolvedSources: ['source-b', 'source-a'],
    });
  });
  // qa: card:B03070:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
  it('B03070 copies fire mandatorily and resolve in their owner-selected public order', () => {
    expect(proveOwnerOrder(B03070, 'a1')).toEqual({
      cardId: 'B03070', ordered: ['source-b', 'source-a'], resolvedSources: ['source-b', 'source-a'],
    });
  });
  // qa: card:B09013:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
  it('B09013 copies fire mandatorily and resolve in their owner-selected public order', () => {
    expect(proveOwnerOrder(B09013, 'a2')).toEqual({
      cardId: 'B09013', ordered: ['source-b', 'source-a'], resolvedSources: ['source-b', 'source-a'],
    });
  });

  // qa: card:B03070:37ef1587bfd096c60d9640a4b438f831c31bd72c00ca99251068d391cbfba449
  it('B03070 still discards after choosing zero eligible scene characters', () => {
    expect(proveB03070ZeroBounceStillDiscards()).toEqual({
      sourceState: 'sleep', eligibleStillPresent: true, level8StillPresent: true,
      opponentHand: [], opponentRemove: ['QA_OPP_EVIDENCE_2', HAND_CARD.id],
    });
  });
  // qa: card:B03070:9b241f8ee496242738ad0f7b07935ff42b74ceb64aba276395b952ff4a380c1b
  it('B03070 cannot self-sleep after the opponent Hirameki resolves before evidence gain', () => {
    expect(proveB03070HiramekiBeforeGain()).toEqual({
      beforeGain: { sourceState: 'sleep', evidenceGained: 0, optional: false, count: 0 },
      afterGain: { sourceState: 'sleep', evidenceGained: 1, optional: false, count: 1 },
    });
  });
  it('B04058 consumes turn1 but suppresses its optional when an earlier queued effect sleeps it before resolution', () => {
    expect(proveResolutionTimeStateAfterQueue()).toEqual({ sourceState: 'sleep', optional: false, count: 1 });
  });

  // qa: card:B09013:3bfd51910f11886d10cbdad8fb505a8a76f3ad9604e2aedfe30b1314f04c5555
  // qa: card:B09013:69ca8be8b9721965a589188e1994a458302be6888cbb6c364d8d008028b7ded9
  it('B09013 fires before guard and removing the declared character ends that action', () => {
    expect(proveB09013DeclaredTargetRemoval()).toEqual({
      phaseBeforeGuard: 'guard-window',
      guardBeforeResolution: { ok: false, reason: 'not-allowed' },
      victimRemoved: true,
      activeActionId: null,
      guardAfterRemoval: { ok: false, reason: 'not-allowed' },
      judgeAfterRemoval: { ok: false, reason: 'not-allowed' },
    });
  });
  // qa: card:B09013:a00a4fcb627dc02701efb6fdc742f723f5d1af776484e45166ccc74175e2b82f
  it('B09013 does not newly fire when another declaration trigger raises AP to 8000 later', () => {
    expect(proveB09013DoesNotTriggerAfterApBuff()).toEqual({ actorAp: 9000, optional: false, count: 0 });
  });
});
