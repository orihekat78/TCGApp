// qa: card:B08038:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179
// qa: card:D11007:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179
// qa: card:D11008:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179
// qa: card:PR304:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B08038 } from '@/cards/ct-p08/B08038';
import { B08038P } from '@/cards/ct-p08/B08038P';
import { D11007 } from '@/cards/ct-d11/D11007';
import { D11008 } from '@/cards/ct-d11/D11008';
import { PR304 } from '@/cards/pr-01/PR304';
import { event } from '@/engine/event';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import * as flow from '@/engine/flow';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA_ID = '64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179';
const SIGNAL_ID = 'WAVE94_SIGNAL';
const OTHER_ID = 'WAVE94_OTHER';
const FILLER_ID = 'WAVE94_FILLER';

function card(id: string, kind: 'character' | 'event', ap = 0, abilities: AbilityDef[] = []): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: ['赤'],
    level: kind === 'event' ? 0 : 6,
    ap,
    lp: kind === 'character' ? 1 : undefined,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
  };
}

const SIGNAL = card(SIGNAL_ID, 'event', 0, [{
  id: 'signal',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (payload: unknown) => (payload as { kind?: unknown } | undefined)?.kind === 'event-use',
  },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: 'Public event-use signal for an effect-generated contact.',
  ruleRefs: [],
}]);

const OTHER = card(OTHER_ID, 'character', 7000, [{
  id: 'react-contact',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'effect:declared',
    matcher: (payload: unknown) => (payload as { cardId?: unknown } | undefined)?.cardId === SIGNAL_ID,
  },
  effect: { kind: 'atom', verb: 'startContact', args: { targetUid: 'subject' } },
  description: 'Generate a contact with the signal user side.',
  ruleRefs: ['rules/08-contact.md'],
}]);

const FILLER = card(FILLER_ID, 'character', 1000);
const WAVE94_CARDS = [B08038, B08038P, D11007, D11008, PR304] as const;

function baseState(subject: CardDef, effectGenerated: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤', ...subject.colors];
  state.players.self.hand = effectGenerated ? [SIGNAL_ID, FILLER_ID] : [FILLER_ID];
  state.players.self.deck = [FILLER_ID, FILLER_ID, FILLER_ID];
  state.players.opp.deck = [FILLER_ID, FILLER_ID, FILLER_ID];
  state.players.self.scene = [makeChar({ cardId: subject.id, uid: 'subject' })];
  state.players.opp.scene = [makeChar({
    cardId: OTHER_ID,
    uid: 'other',
    state: effectGenerated ? 'active' : 'sleep',
  })];
  if (!effectGenerated) {
    state.players.opp.scene.push(makeChar({ cardId: OTHER_ID, uid: 'guarder', state: 'active' }));
  }
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function currentState(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function expectTriggerPrompt(subject: CardDef): void { // Card-bound matrix: B08038 B08038P D11007 D11008 PR304.
  const source = subject.id.startsWith('B08038')
    ? useGameStateStore.getState().pendingEffectOptional?.source
    : useGameStateStore.getState().pendingEffectPick?.source;
  expect(source).toMatchObject({ cardId: subject.id, uid: 'subject' });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(flow.action._getContext(currentState(), actionId!)?.phase).toBe('contact-order-pending');
}

function resetHarness(): void {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  for (const definition of [...WAVE94_CARDS, SIGNAL, OTHER, FILLER]) register(definition);
  registerTriggeredListener();
  beginMatchSession('self');
}

beforeEach(() => resetHarness());
afterEach(() => endMatchSession());

describe(`Wave94 contact participant public dispatch ${QA_ID}`, () => {
  it.each(WAVE94_CARDS)('$id triggers before contact order after guard redirection', (subject) => {
    install(baseState(subject, false));
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'subject', targetUid: 'other' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: 'guarder' }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! }))
      .toEqual({ ok: true });

    expectTriggerPrompt(subject);
  });

  it.each(WAVE94_CARDS)('$id surfaces its trigger as the effect-contact bUid participant', (subject) => {
    install(baseState(subject, true));

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: SIGNAL_ID }))
      .toEqual({ ok: true });

    expectTriggerPrompt(subject);
  });

  it('does not trigger B08038 when it guards during the opponent turn', () => {
    const state = baseState(B08038, false);
    state.turn.player = 'opp';
    state.players.opp.scene[0]!.state = 'active';
    state.players.self.scene.push(makeChar({ cardId: FILLER_ID, uid: 'target', state: 'sleep' }));
    install(state);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'other', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: 'subject' }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(flow.action._getContext(currentState(), actionId!)?.phase).toBe('action-1');
  });
});
