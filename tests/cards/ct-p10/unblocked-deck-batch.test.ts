import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10010 } from '@/cards/ct-p10/B10010';
import { B10088, B10088P } from '@/cards/ct-p10/B10088';
import { B10090 } from '@/cards/ct-p10/B10090';
import { applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState, SceneCharacter } from '@/engine/types';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingEffectPickQueue?: unknown[];
  __pendingDeckReorderSide?: unknown;
};

function character(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function eventCard(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors: ['黒'], level: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function scene(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  } as SceneCharacter;
}

function state(deck: string[] = []): GameState {
  const result = createEmptyGameState();
  result.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  result.players.self.deck = [...deck];
  return result;
}

function ctx(cardId: string, abilityId = 'a1', uid = 'src#1'): EffectCtx {
  return {
    source: { player: 'self', cardId, abilityId, uid, area: 'scene' },
    bindings: {}, dyn: { optionalRun: true, runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
  } as EffectCtx;
}

const CUTIN = character('CUTIN', { keywords: ['カットイン'] });
const CUTIN_EVENT = eventCard('CUTIN_EVENT', { keywords: ['カットイン'] });
const NON_MATCH = character('NON_MATCH');
const TAIL = character('TAIL');
const RECOVER = character('RECOVER', { keywords: ['カットイン'], level: 3 });

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  globals.__pendingEffectPickQueue = [];
  globals.__pendingDeckReorderSide = null;
  _clearPendingEffectPickQueue();
  _resetRegistry();
  [B10010, B10088, B10088P, B10090, CUTIN, CUTIN_EVENT, NON_MATCH, TAIL, RECOVER].forEach(register);
});

describe('B10010 工藤新一', () => {
  it('offers only the two printed character-name branches, then discards after taking one', () => {
    const shinichi = character('SEARCH_SHINICHI', { names: ['工藤新一'] });
    const ran = character('SEARCH_RAN', { names: ['毛利蘭'] });
    const eventDecoy = eventCard('SEARCH_EVENT', { names: ['工藤新一'] });
    [shinichi, ran, eventDecoy].forEach(register);
    let result = produce(state([eventDecoy.id, shinichi.id, ran.id, TAIL.id]), draft => runEffect(draft, B10010.abilities[1]!.effect!, ctx('B10010', 'a2')));
    const pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([shinichi.id, ran.id]);
    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[1]!.uid));
    const reorder = _drainPendingDeckReorderSide()!;
    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder, [TAIL.id, shinichi.id, eventDecoy.id]));
    result = produce(result, draft => runAllUntilEmpty(draft));
    const discard = _drainPendingEffectPickSide()!;
    expect(discard.candidates.map(candidate => candidate.cardId)).toEqual([ran.id]);
    result = produce(result, draft => applyPickAndContinuation(draft, discard, discard.candidates[0]!.uid));
    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.remove).toContain(ran.id);
    expect(result.players.self.deck).toEqual([TAIL.id, shinichi.id, eventDecoy.id]);
  });

  it('allows decline and preserves the chosen bottom order for all four cards', () => {
    const shinichi = character('DECLINE_SHINICHI', { names: ['工藤新一'] });
    register(shinichi);
    let result = produce(state([shinichi.id, NON_MATCH.id, TAIL.id, CUTIN.id]), draft => runEffect(draft, B10010.abilities[1]!.effect!, ctx('B10010', 'a2')));
    const pick = _drainPendingEffectPickSide()!;
    result = produce(result, draft => applyPickSkipAndContinuation(draft, pick));
    const reorder = _drainPendingDeckReorderSide()!;
    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder, [CUTIN.id, TAIL.id, NON_MATCH.id, shinichi.id]));
    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.deck).toEqual([CUTIN.id, TAIL.id, NON_MATCH.id, shinichi.id]);
  });
});

describe('B10088 / B10090 exact-three removal', () => {
  it('does nothing with fewer than three deck cards', () => {
    const result = produce(state([CUTIN.id, CUTIN_EVENT.id]), draft => {
      draft.players.self.scene = [scene('B10090', 'vodka#1')];
      runEffect(draft, B10090.abilities[0]!.effect!, ctx('B10090', 'a1', 'vodka#1'));
      runAllUntilEmpty(draft);
    });
    expect(result.players.self.deck).toEqual([CUTIN.id, CUTIN_EVENT.id]);
    expect(result.players.self.remove).toEqual([]);
    expect(read.char.keywords(result, 'vodka#1')).not.toContain('突撃');
  });

  it('removes exactly three bound top cards and grants the branch only when all three match', () => {
    const allMatch = produce(state([CUTIN.id, CUTIN_EVENT.id, RECOVER.id, TAIL.id]), draft => {
      draft.players.self.scene = [scene('B10090', 'vodka#1')];
      runEffect(draft, B10090.abilities[0]!.effect!, ctx('B10090', 'a1', 'vodka#1'));
      runAllUntilEmpty(draft);
    });
    expect(allMatch.players.self.remove).toEqual([CUTIN.id, CUTIN_EVENT.id, RECOVER.id]);
    expect(allMatch.players.self.deck).toEqual([TAIL.id]);
    expect(read.char.keywords(allMatch, 'vodka#1')).toContain('突撃');

    const oneMiss = produce(state([CUTIN.id, NON_MATCH.id, RECOVER.id, TAIL.id]), draft => {
      draft.players.self.scene = [scene('B10090', 'vodka#1')];
      runEffect(draft, B10090.abilities[0]!.effect!, ctx('B10090', 'a1', 'vodka#1'));
      runAllUntilEmpty(draft);
    });
    expect(oneMiss.players.self.remove).toEqual([CUTIN.id, NON_MATCH.id, RECOVER.id]);
    expect(read.char.keywords(oneMiss, 'vodka#1')).not.toContain('突撃');
  });

  it('uses provenance binding for B10088 re-entry', () => {
    const bourbonEffect = B10088.abilities[0]!.effect!;
    expect(JSON.stringify(bourbonEffect)).toContain('boundMatchCountAtLeast');
    expect(JSON.stringify(bourbonEffect)).toContain('sceneEnter');
    expect(B10088P.abilities).toEqual(B10088.abilities);
  });

  it('lets B10088 re-enter an eligible one of the exact three cards', () => {
    let result = produce(state([CUTIN.id, CUTIN_EVENT.id, RECOVER.id, TAIL.id]), draft => {
      draft.players.self.scene = [scene('B10088', 'bourbon#1')];
      runEffect(draft, B10088.abilities[0]!.effect!, ctx('B10088', 'a1', 'bourbon#1'));
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.cardId)).toContain(RECOVER.id);
    const recover = pick.candidates.find(candidate => candidate.cardId === RECOVER.id)!;
    result = produce(result, draft => applyPickAndContinuation(draft, pick, recover.uid));
    runAllUntilEmpty(result);
    expect(result.players.self.scene.map(char => char.cardId)).toContain(RECOVER.id);
  });
});
