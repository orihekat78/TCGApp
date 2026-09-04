import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07022 } from '@/cards/ct-p07/B07022';
import { B08082 } from '@/cards/ct-p08/B08082';
import { B09036 } from '@/cards/ct-p09/B09036';
import { B09036P } from '@/cards/ct-p09/B09036P';
import { B10009 } from '@/cards/ct-p10/B10009';
import { B10093 } from '@/cards/ct-p10/B10093';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const RAN: CardDef = {
  id: 'W169_RAN', no: 'TEST/W169_RAN', kind: 'character', names: ['毛利蘭'], colors: ['青'],
  level: 3, ap: 3000, lp: 1, traits: ['高校生'], keywords: [], rarity: 'T', imageUrl: '',
  abilities: [], ruleRefs: [],
};
const LEAVE: CardDef = {
  id: 'W169_LEAVE', no: 'TEST/W169_LEAVE', kind: 'character', names: ['離場能力持ち'], colors: ['白'],
  level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '【現場リムーブ時】何もしない。', ruleRefs: ['rules/17-icons.md'],
  }], ruleRefs: ['rules/17-icons.md'],
};
const DRAW: CardDef = {
  id: 'W169_DRAW', no: 'TEST/W169_DRAW', kind: 'event', names: ['draw'], colors: ['白'], level: 1,
  traits: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [],
};

const ROWS = [
  { card: B07022, caseColors: ['緑'], file: 5, revealId: RAN.id, optional: false },
  { card: B08082, caseColors: ['黒'], file: 5, revealId: LEAVE.id, optional: false },
  { card: B09036, caseColors: ['白'], file: 8, revealId: RAN.id, optional: true },
  { card: B09036P, caseColors: ['白'], file: 8, revealId: RAN.id, optional: true },
  { card: B10009, caseColors: ['青'], file: 5, revealId: RAN.id, optional: true },
  { card: B10093, caseColors: ['青', '黒'], file: 4, revealId: RAN.id, optional: false },
] as const;

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing horizontal reveal state');
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  [RAN, LEAVE, DRAW].forEach(register);
  registerTriggeredListener();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('printed hand reveals use the shared public presentation lifecycle', () => {
  it.each(ROWS)('$card.id publishes the selected hand card and can hide it after resolution', ({ card, caseColors, file, revealId, optional }) => {
    const state = createEmptyGameState();
    state.turn = { number: 169, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = [...caseColors];
    state.players.self.file = Array.from({ length: file }, () => ({ type: 'card-back' as const }));
    state.players.self.hand = [card.id, revealId];
    state.players.self.deck = [DRAW.id, DRAW.id];
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id }))
      .toEqual({ ok: true });
    if (optional) {
      surfacePendingSideChannels();
      const decision = useGameStateStore.getState().pendingEffectOptional;
      expect(decision).toMatchObject({ source: { cardId: card.id } });
      expect(dispatchEngineAction(bindPendingDecision(decision!, { type: 'optionalResolve', run: true })))
        .toEqual({ ok: true });
    }

    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({ atomVerb: 'handReveal', source: { cardId: card.id } });
    const target = pick!.candidates.find(candidate => candidate.cardId === revealId)!;
    expect(dispatchEngineAction(bindPendingDecision(pick!, { type: 'effectPickResolve', pickedUid: target.uid })))
      .toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'self', audience: 'all', cardIds: [revealId], lifetime: 'presentation',
      source: { cardId: card.id },
    });
    expect(current().players.self.hand).toContain(revealId);
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });
});
