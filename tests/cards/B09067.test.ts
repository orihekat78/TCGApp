import { beforeEach, describe, expect, it } from 'vitest';
import { B09067 } from '@/cards/ct-p09/B09067';
import { B09067P } from '@/cards/ct-p09/B09067P';
import { event } from '@/engine/event';
import { _clearPendingEffectChoiceSide, _drainPendingEffectChoiceSide } from '@/engine/effect/pending-state';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyChoiceAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { registerAll } from '@/cards';
import { _resetRegistry, register } from '@/engine/read/def';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';

const BACK = { type: 'card-back' as const, cardId: 'D08017' };

function sceneChar(uid: string) {
  return {
    uid, cardId: 'D04013', state: 'active' as const, isNamed: false,
    enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  };
}

function resetRuntime(): void {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  registerAll();
  register(B09067);
  register(B09067P);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
}

function usable(cardId: 'B09067' | 'B09067P', hand: string[] = ['D04013']) {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤'];
  state.players.self.file = [BACK, BACK, BACK, BACK, BACK];
  state.players.self.hand = [cardId, ...hand];
  state.players.self.scene = [sceneChar('char'), sceneChar('event'), sceneChar('bullet')];
  return state;
}

describe('B09067 よしキャメル…走れ!!', () => {
  beforeEach(resetRuntime);

  it('keeps the printed three-way choice and Camel replacement branch', () => {
    const effect = B09067.abilities[0]!.effect as { kind: string; options: Array<{ kind: string; steps?: Array<{ kind: string; verb?: string; args?: Record<string, unknown>; then?: { steps?: unknown[] } }> }> };
    expect(effect.kind).toBe('choice');
    expect(effect.options).toHaveLength(3);
    expect(effect.options[0]!.steps?.[0]).toMatchObject({ kind: 'atom', verb: 'discard', args: { max: 1, bind: '$camel', filter: { cardName: 'アンドレ・キャメル' } } });
    expect(effect.options[0]!.steps?.[1]).toMatchObject({ kind: 'conditional', if: { kind: 'bound', key: '$camel', presence: 'matched' } });
    expect(effect.options[0]!.steps?.[1]?.then?.steps).toHaveLength(3);
  });

  it('has an independent identical P definition', () => {
    expect(B09067P).not.toBe(B09067);
    expect(B09067P.abilities.map(a => a.description)).toEqual(B09067.abilities.map(a => a.description));
    const pEffect = B09067P.abilities[0]!.effect as { kind: string; options: Array<{ kind: string; steps?: unknown[] }> };
    expect(pEffect.kind).toBe('choice');
    expect(pEffect.options).toHaveLength(3);
    expect(pEffect.options[0]!.steps).toHaveLength(2);
  });

  it('production event-use: Camel discard resolves three grants in printed order', () => {
    const state = usable('B09067');

    handUseCard(state, 'self', 'B09067');
    runAllUntilEmpty(state);
    const choice = _drainPendingEffectChoiceSide();
    expect(choice?.options).toHaveLength(3);
    applyChoiceAndContinuation(state, choice!, 0);

    const camel = _drainPendingEffectPickSide();
    expect(camel?.atomVerb).toBe('discard');
    expect(camel?.candidates.map(c => c.cardId)).toEqual(['D04013']);
    applyPickAndContinuation(state, camel!, camel!.candidates[0]!.uid);

    for (const uid of ['char', 'event', 'bullet']) {
      const grant = _drainPendingEffectPickSide();
      expect(grant?.atomVerb).toBe('charGrantKeyword');
      expect(grant?.candidates.map(c => c.uid)).toContain(uid);
      applyPickAndContinuation(state, grant!, uid);
    }

    expect(readChar.hasKeyword(state, 'char', '突撃[キャラ]')).toBe(true);
    expect(readChar.hasKeyword(state, 'event', '突撃[事件]')).toBe(true);
    expect(readChar.hasKeyword(state, 'bullet', 'ブレット')).toBe(true);
    expect(state.players.self.remove).toContain('D04013');
  });

  it('production event-use: Camel decline takes only the selected fallback grant', () => {
    const state = usable('B09067');
    handUseCard(state, 'self', 'B09067');
    runAllUntilEmpty(state);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);
    const camel = _drainPendingEffectPickSide();
    expect(camel?.atomVerb).toBe('discard');
    applyPickSkipAndContinuation(state, camel!, false);

    const fallback = _drainPendingEffectPickSide();
    expect(fallback?.atomVerb).toBe('charGrantKeyword');
    applyPickAndContinuation(state, fallback!, 'char');
    expect(readChar.hasKeyword(state, 'char', '突撃[キャラ]')).toBe(true);
    expect(readChar.hasKeyword(state, 'event', '突撃[事件]')).toBe(false);
    expect(readChar.hasKeyword(state, 'bullet', 'ブレット')).toBe(false);
    expect(state.players.self.remove).not.toContain('D04013');
  });

  it('Camel discard exposes only the named character, and zero candidates falls back safely', () => {
    const validAndDecoy = usable('B09067', ['D04013', 'B09067P']);
    handUseCard(validAndDecoy, 'self', 'B09067');
    runAllUntilEmpty(validAndDecoy);
    applyChoiceAndContinuation(validAndDecoy, _drainPendingEffectChoiceSide()!, 0);
    expect(_drainPendingEffectPickSide()?.candidates.map(c => c.cardId)).toEqual(['D04013']);

    resetRuntime();
    const zero = usable('B09067', []);
    handUseCard(zero, 'self', 'B09067');
    runAllUntilEmpty(zero);
    applyChoiceAndContinuation(zero, _drainPendingEffectChoiceSide()!, 0);
    const fallback = _drainPendingEffectPickSide();
    expect(fallback?.atomVerb).toBe('charGrantKeyword');
    expect(fallback?.candidates.map(c => c.uid)).toEqual(['char', 'event', 'bullet']);
  });

  it.each(['B09067', 'B09067P'] as const)('AI drains %s through the Camel replacement branch', (cardId) => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const state = usable(cardId);
    handUseCard(state, 'self', cardId);
    for (let i = 0; i < 8; i++) {
      runAllUntilEmpty(state);
      drainAiEffectPicks(state, new HeuristicPolicy());
    }
    expect(readChar.hasKeyword(state, 'char', '突撃[キャラ]')).toBe(true);
    expect(readChar.hasKeyword(state, 'char', '突撃[事件]')).toBe(true);
    expect(readChar.hasKeyword(state, 'char', 'ブレット')).toBe(true);
    expect(state.players.self.remove).toContain('D04013');
  });
});
