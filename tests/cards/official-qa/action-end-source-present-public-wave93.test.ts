// qa: card:B04030:76f3670ceb57dfb996531dae5f61c2fefd2e21bed4287242a3866a4218a951c3
// qa: card:B06077:76f3670ceb57dfb996531dae5f61c2fefd2e21bed4287242a3866a4218a951c3
// qa: card:PR289:76f3670ceb57dfb996531dae5f61c2fefd2e21bed4287242a3866a4218a951c3
// qa: card:PR295:76f3670ceb57dfb996531dae5f61c2fefd2e21bed4287242a3866a4218a951c3
// Rules: 22-qa-action-contact.md. The acting source must still be on scene at action:end.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { registerAll } from '@/cards';
import { flow } from '@/engine';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B04030P } from '@/cards/ct-p04/B04030P';
import { B06077 } from '@/cards/ct-p06/B06077';
import { B06077P } from '@/cards/ct-p06/B06077P';
import { PR289 } from '@/cards/pr-01/PR289';
import { PR295 } from '@/cards/pr-01/PR295';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const TARGET = 'QA_W93_TARGET';
const KID = 'QA_W93_KID';
const FBI = 'QA_W93_FBI';
const FILLER = 'QA_W93_FILLER';
const RED_PARTNER = 'QA_W93_RED_PARTNER';

const ROWS = [B04030, B04030P, B06077, B06077P, PR289, PR295] as const;

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `QA/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}

const FIXTURES = [
  fixture(TARGET),
  fixture(KID, { names: ['怪盗キッド'], colors: ['白'], level: 1 }),
  fixture(FBI, { colors: ['赤'], level: 1, traits: ['FBI'] }),
  fixture(FILLER),
  fixture(RED_PARTNER, { kind: 'partner', level: undefined, ap: undefined, colors: ['赤'] }),
];

function stateFor(card: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 7, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: RED_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.file = Array.from({ length: 7 }, (_value, index) => ({ type: 'card-back' as const, cardId: `QA_W93_FILE_${index}` }));
  state.players.self.hand = [FBI, FILLER];
  state.players.self.deck = [KID, FILLER, FILLER, FILLER, FILLER];
  state.players.self.scene = [makeChar({
    cardId: card.id,
    uid: 'source',
    state: 'active',
    stackedCards: card.id === PR289.id || card.id === PR295.id
      ? [{ cardId: FILLER, instanceId: `${card.id}:stack:0` }]
      : 0,
  })];
  state.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  resetPresentationQueue(`qa-wave93-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave93 game state');
  return state;
}

function driveThroughJudge(): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toEqual(expect.any(String));
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  for (let index = 0; index < 12; index += 1) {
    const context = flow.action._getContext(current(), actionId!);
    if (!context) throw new Error('Wave93 action ended before judge');
    if (context.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
      return actionId!;
    }
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = uid === 'source' ? 'self' : 'opp';
      expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player, choice: { kind: 'pass' } })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  }
  throw new Error('Wave93 action did not reach judge');
}

function closeAction(actionId: string): void {
  for (let index = 0; index < 3 && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
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
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave93 action:end requires its source to remain on scene', () => {
  it.each(ROWS)('$id does not queue its action-end ability after leaving during that action', card => {
    install(stateFor(card), card.id);
    const actionId = driveThroughJudge();
    expect(useGameStateStore.getState().dispatch(state => produce(state, draft => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
    }))).toBe(true);
    const deckBefore = [...current().players.self.deck];
    const handBefore = [...current().players.self.hand];

    closeAction(actionId);
    surfacePendingSideChannels();

    // Card-bound source-presence matrix: B04030 B04030P B06077 B06077P PR289 PR295.
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().pendingEffects.some(entry => entry.source.cardId === card.id)).toBe(false);
    expect(current().players.self.scene.some(entry => entry.uid === 'source')).toBe(false);
    expect(current().players.self.remove).toContain(card.id);
    expect(current().players.self.deck).toEqual(deckBefore);
    expect(current().players.self.hand).toEqual(handBefore);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});
