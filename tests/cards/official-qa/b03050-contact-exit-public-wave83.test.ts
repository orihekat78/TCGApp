// qa: card:B03050:19fb99eecd85e2306c2887c5c7eb1210d8e663ec05473fb8f45d59e9f1475925
// Rules: 08-contact, 09-cutin-disguise, 15-abilities-effects, 22-qa-action-contact.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SERA = 'W83-B03050-SERA';
const ATTACKER = 'W83-B03050-ATTACKER';
const WHITE_CASE = 'W83-B03050-WHITE-CASE';
const FILE_CARD = 'W83-B03050-FILE';
const EVIDENCE_TOP = 'W83-B03050-EVIDENCE';
const CUTIN = 'W83-B03050-OPP-CUTIN';
const DEFENDER_UID = 'wave83-b03050-defender';
const ATTACKER_UID = 'wave83-b03050-attacker';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B03050 contact-exit state');
  return state;
}

function state(): GameState {
  const next = createEmptyGameState();
  next.turn = { number: 28, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  next.players.self.case = {
    ...next.players.self.case,
    cardId: WHITE_CASE,
    colors: ['白'],
  };
  next.players.self.file = Array.from({ length: 5 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD,
  }));
  next.players.self.hand = ['B03050'];
  next.players.self.deck = [EVIDENCE_TOP, FILE_CARD];
  next.players.self.scene = [sceneChar(SERA, DEFENDER_UID, { state: 'sleep' })];
  next.players.opp.hand = [CUTIN];
  next.players.opp.scene = [sceneChar(ATTACKER, ATTACKER_UID, { state: 'active' })];
  return next;
}

function install(label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  const next = state();
  startCausalSession(next, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(next)).toBe(true);
}

function reachDefenderFirstWindow(): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: ATTACKER_UID, targetUid: DEFENDER_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('B03050 contact ended before action-1');
    if (context.phase === 'action-1') {
      expect(context.firstUid).toBe(DEFENDER_UID);
      expect(context.secondUid).toBe(ATTACKER_UID);
      return actionId;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('B03050 defender first window not reached');
}

function openSelfRemoveOptional(): string {
  const actionId = reachDefenderFirstWindow();
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: 'self',
    choice: { kind: 'disguise', cardId: 'B03050' },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  expect(useGameStateStore.getState().pendingEffectOptional?.source)
    .toMatchObject({ cardId: 'B03050', abilityId: 'a2' });
  return actionId;
}

function acceptSelfRemove(actionId: string): void {
  const optional = useGameStateStore.getState().pendingEffectOptional!;
  expect(dispatchEngineAction(bindPendingDecision(optional, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
  expect(current().players.self.scene.some(card => card.uid === DEFENDER_UID)).toBe(false);
  expect(current().players.self.evidence).toHaveLength(1);
  expect(flow.action._getContext(current(), actionId)?.phase).toBe('action-1');
}

function expectContactClosesBeforeOpponent(actionId: string, contactEndCount: () => number): void {
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  const context = flow.action._getContext(current(), actionId);
  expect(context?.phase).toBe('contact-end');
  expect(context?.firstUid).toBeUndefined();
  expect(context?.secondUid).toBeUndefined();
  expect(contactEndCount()).toBe(1);
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: 'opp', choice: { kind: 'cutin', cardId: CUTIN },
  })).toEqual({ ok: false, reason: 'not-allowed' });
  expect(current().players.opp.hand).toContain(CUTIN);
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(flow.action._getContext(current(), actionId)).toBeUndefined();
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(SERA, { names: ['世良真純'], colors: ['赤'], ap: 1000, lp: 2 }),
    fixture(ATTACKER, { colors: ['青'], ap: 9000, lp: 2 }),
    fixture(WHITE_CASE, { kind: 'case', colors: ['白'], caseLevel: 7, caseTraits: [] }),
    fixture(FILE_CARD), fixture(EVIDENCE_TOP),
    fixture(CUTIN, {
      kind: 'event', abilities: [{
        id: 'cutin', type: 'triggered', scope: 'on-hand',
        trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
        effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } },
        description: '【カットイン】', ruleRefs: [],
      } as never],
    }),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('B03050 official QA: self-removal ends contact before the opponent action', () => {
  it('closes a public first-actor contact immediately after the accepted self-removal', () => {
    install('B03050:wave83-first-actor-remove');
    let contactEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });
    const actionId = openSelfRemoveOptional();

    acceptSelfRemove(actionId);
    // The opponent must not receive action-2 after B03050 leaves the contact.
    expectContactClosesBeforeOpponent(actionId, () => contactEnds);
  });

  it('preserves the same termination after pending optional save hydration', () => {
    install('B03050:wave83-save-remove');
    let contactEnds = 0;
    event.on('contact:end', () => { contactEnds += 1; });
    const actionId = openSelfRemoveOptional();
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    const stale = useGameStateStore.getState().pendingEffectOptional!;

    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectOptional!;
    expect(restored.decisionId).not.toBe(stale.decisionId);

    acceptSelfRemove(actionId);
    expectContactClosesBeforeOpponent(actionId, () => contactEnds);
  });
});
