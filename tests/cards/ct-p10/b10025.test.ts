import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10025 } from '@/cards/ct-p10/B10025';
import { event } from '@/engine/event';
import { run as runEffect } from '@/engine/effect/resolver';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'event', names: [id], colors: ['青'], level: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIRST_MATCH = card('B10025_MATCH', { colors: ['緑'], level: 7, abilities: [{ id: 'h', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: 'ヒラメキ', ruleRefs: [] }] });
const SECOND_MATCH = card('B10025_SECOND', { colors: ['緑'], level: 7, abilities: FIRST_MATCH.abilities });
const DECOY = card('B10025_DECOY');
const REFRESH = card('B10025_REFRESH');
const TARGET: CardDef = { ...card('B10025_TARGET'), kind: 'character', ap: 1000, lp: 1 };

function state(deck: string[] = []): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.deck = [...deck];
  return s;
}

function ctx(): EffectCtx {
  return { source: { cardId: B10025.id, abilityId: 'a2', uid: 'kogoro', player: 'self', area: 'scene' }, bindings: {} };
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue(); _resetRegistry();
  [B10025, FIRST_MATCH, SECOND_MATCH, DECOY, REFRESH, TARGET].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
});

describe('CT-P10 B10025 鬼丸猛', () => {
  it('takes the first matching green level-7 Hirameki event forcibly and does not open a reorder modal', () => {
    const s = state([DECOY.id, FIRST_MATCH.id, SECOND_MATCH.id]);
    runEffect(s, B10025.abilities[1]!.effect!, ctx());

    expect(s.players.self.hand).toEqual([FIRST_MATCH.id]);
    expect(s.players.self.deck).toEqual(expect.arrayContaining([DECOY.id, SECOND_MATCH.id]));
    expect(_drainPendingDeckReorderSide()).toBeNull();
    expect(s.log.some(entry => entry.action === 'effect:deckShuffle')).toBe(true);
  });

  it('returns and shuffles every revealed card when no match exists', () => {
    const s = state([DECOY.id]);
    runEffect(s, B10025.abilities[1]!.effect!, ctx());

    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.deck).toEqual([DECOY.id]);
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('refreshes after taking a one-card matching deck and then continues without a reorder prompt', () => {
    const s = state([FIRST_MATCH.id]);
    s.players.self.remove = [REFRESH.id];
    runEffect(s, B10025.abilities[1]!.effect!, ctx());

    expect(s.players.self.hand).toEqual([FIRST_MATCH.id]);
    expect(s.players.self.deck).toEqual([REFRESH.id]);
    expect(s.refreshCount.self).toBe(1);
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('sleeps one character at most once per own resolved-case turn after gaining evidence', () => {
    const s = state();
    s.players.self.case.status = '解決編';
    s.players.self.scene = [{ cardId: B10025.id, uid: 'kogoro', state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} }];
    s.players.opp.scene = [{ cardId: TARGET.id, uid: 'target', state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} }];
    event.emit(s, 'evidence:gain', { player: 'self', gained: 1 }, { player: 'self', cardId: 'ACTION' });
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide()!;
    const chosen = pick.candidates.find(candidate => candidate.uid === 'target')!;
    applyPickAndContinuation(s, pick, chosen.uid);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene[0]!.state).toBe('sleep');

    event.emit(s, 'evidence:gain', { player: 'self', gained: 1 }, { player: 'self', cardId: 'ACTION' });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it('spends turn-1 separately for every own copy on evidence gain', () => {
    const s = state();
    s.players.self.case.status = '解決編';
    const copy = (uid: string, enterOrder: number) => ({ cardId: B10025.id, uid, state: 'active' as const, isNamed: false, enterOrder, enterOrderThisTurn: enterOrder, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
    s.players.self.scene = [copy('kogoro-1', 1), copy('kogoro-2', 2)];
    event.emit(s, 'evidence:gain', { player: 'self', gained: 1 }, { player: 'self', cardId: 'ACTION' });
    expect(s.players.self.scene.map(char => char.declaredUseCount.a3)).toEqual([1, 1]);

    event.emit(s, 'evidence:gain', { player: 'self', gained: 1 }, { player: 'self', cardId: 'ACTION' });
    expect(s.players.self.scene.map(char => char.declaredUseCount.a3)).toEqual([1, 1]);
  });

  it('has the sole printed metadata and no B10025P TSV printing', () => {
    expect(B10025).toMatchObject({ id: 'B10025', no: '1086/B10025', names: ['鬼丸猛'], colors: ['緑'], level: 8, ap: 8000, lp: 0, traits: ['高校生'], rarity: 'R', imageUrl: '1783904116831251.jpg' });
  });
});
