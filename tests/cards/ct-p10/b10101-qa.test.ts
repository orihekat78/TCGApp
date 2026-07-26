import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10101 } from '@/cards/ct-p10/B10101';
import { applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckReorderSide?: unknown;
  __pendingDeckRevealSide?: unknown;
};

function character(id: string, extra: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...extra,
  };
}

const ASSAULT = character('B10101_QA_ASSAULT', { keywords: ['突撃'] });
const BRACKET_ASSAULT = character('B10101_QA_BRACKET', { keywords: ['突撃[キャラ]'] });
const TEXT_GRANTED_ASSAULT = character('B10101_QA_TEXT_GRANTED', {
  abilities: [{
    id: 'grant-assault', type: 'continuous', scope: 'on-scene',
    continuousModifier: { grantKeywords: () => ['突撃'] },
    description: 'text-granted exact assault is not printed or condition-icon assault', ruleRefs: [],
  }],
});
const FILLER = character('B10101_QA_FILLER');
const TAIL = character('B10101_QA_TAIL');
const REFRESH = character('B10101_QA_REFRESH');

function searchEffect(): Effect {
  const grant = B10101.abilities[1]?.effect as { args?: { ability?: { effect?: Effect } } } | undefined;
  const effect = grant?.args?.ability?.effect;
  if (!effect) throw new Error('B10101 granted search effect missing');
  return effect;
}

function effectCtx(): EffectCtx {
  return {
    source: { cardId: 'B10101', abilityId: 'b10101-granted-assault-search', uid: 'giver', player: 'self', area: 'scene' },
    bindings: {}, dyn: { runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
  };
}

function state(deck: string[]): GameState {
  const result = createEmptyGameState();
  result.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  result.players.self.deck = [...deck];
  return result;
}

function queue(): PendingEffectPickSide[] {
  return globals.__pendingEffectPickQueue ?? [];
}

function start(deck: string[]): GameState {
  return produce(state(deck), draft => runEffect(draft, searchEffect(), effectCtx()));
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  globals.__pendingEffectPickQueue = [];
  globals.__pendingDeckReorderSide = null;
  globals.__pendingDeckRevealSide = null;
  _resetRegistry();
  [B10101, ASSAULT, BRACKET_ASSAULT, TEXT_GRANTED_ASSAULT, FILLER, TAIL, REFRESH].forEach(register);
});

describe('CT-P10 B10101 granted assault search Q&A', () => {
  it('inspects every card in a short deck, then resumes through the remaining-card reorder', () => {
    let result = start([FILLER.id, ASSAULT.id, TAIL.id]);
    const pick = queue()[0]!;
    expect(pick.atomVerb).toBe('deckRevealUntil');
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([ASSAULT.id]);
    globals.__pendingEffectPickQueue = [];

    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[0]!.uid));
    const reorder = _drainPendingDeckReorderSide();
    expect(result.players.self.hand).toEqual([ASSAULT.id]);
    expect(reorder?.cardIds).toEqual([FILLER.id, TAIL.id]);

    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder!, [TAIL.id, FILLER.id]));
    expect(result.players.self.deck).toEqual([TAIL.id, FILLER.id]);
  });

  it('allows declining a qualifying card and returns every revealed card through reorder', () => {
    let result = start([ASSAULT.id, FILLER.id, TAIL.id]);
    const pick = queue()[0]!;
    expect(pick.nMin).toBe(0);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([ASSAULT.id]);
    globals.__pendingEffectPickQueue = [];

    result = produce(result, draft => applyPickSkipAndContinuation(draft, pick));
    const reorder = _drainPendingDeckReorderSide();
    expect(result.players.self.hand).toEqual([]);
    expect(reorder?.cardIds).toEqual([ASSAULT.id, FILLER.id, TAIL.id]);

    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder!, [TAIL.id, FILLER.id, ASSAULT.id]));
    expect(result.players.self.deck).toEqual([TAIL.id, FILLER.id, ASSAULT.id]);
  });

  it('refreshes only after a one-card deck target is taken', () => {
    let result = start([ASSAULT.id]);
    result = produce(result, draft => {
      draft.players.self.remove = [REFRESH.id];
    });
    const pick = queue()[0]!;
    globals.__pendingEffectPickQueue = [];

    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[0]!.uid));
    expect(result.players.self.hand).toEqual([ASSAULT.id]);
    expect(result.players.self.deck).toEqual([REFRESH.id]);
    expect(result.players.self.remove).toEqual([]);
    expect(result.refreshCount.self).toBe(1);
  });

  it('does not offer an exact assault keyword supplied only by text or a bracketed keyword', () => {
    const result = start([TEXT_GRANTED_ASSAULT.id, BRACKET_ASSAULT.id, ASSAULT.id]);
    const pick = queue()[0]!;

    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([ASSAULT.id]);
  });
});
