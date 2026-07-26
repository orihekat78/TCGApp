import { beforeEach, describe, expect, it } from 'vitest';
import { B10096, B10096P } from '@/cards/ct-p10/B10096';
import { REUSE_CARDS } from '@/cards';
import { event } from '@/engine/event';
import { applyChoiceAndContinuation, applyOptionalAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectChoiceSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectChoiceSide, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const CUTIN: CardDef = { id: 'B10096_CUTIN', no: 'B10096_CUTIN', kind: 'event', names: ['Cut-in'], colors: ['黒'], level: 1, traits: [], keywords: ['カットイン'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FILLER: CardDef = { ...CUTIN, id: 'B10096_FILLER', no: 'B10096_FILLER', keywords: [] };
const ENTER: CardDef = { ...CUTIN, id: 'B10096_ENTER', no: 'B10096_ENTER', kind: 'character', names: ['Enter'], level: 1 };
const PARTNER: CardDef = { ...FILLER, id: 'B10096_PARTNER', no: 'B10096_PARTNER', kind: 'partner', names: ['Partner'], level: undefined, lp: 1 };

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function state(deck: string[], hand: string[] = [B10096.id]): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.case = { cardId: 'B10096_CASE', status: 'unresolved', requiredEvidence: 0, colors: ['黒'], declaredUseCount: {} };
  value.players.self.partner.cardId = PARTNER.id;
  value.players.self.deck = [...deck];
  value.players.self.hand = [...hand];
  value.players.self.file = Array.from({ length: 6 }, () => ({ cardId: FILLER.id, type: 'normal' as const }));
  return value;
}

function useAndAccept(value: GameState): void {
  handUseCard(value, 'self', B10096.id);
  runAllUntilEmpty(value);
  const optional = _drainPendingEffectOptionalSide();
  expect(optional?.player).toBe('self');
  applyOptionalAndContinuation(value, optional!, true);
  runAllUntilEmpty(value);
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  [B10096, B10096P, CUTIN, FILLER, ENTER, PARTNER].forEach(register);
  registerTriggeredListener();
});

describe('B10096 「何の真似だ…」', () => {
  it('keeps printed metadata and gives the P printing identical rules', () => {
    expect(B10096).toMatchObject({ id: 'B10096', no: '1151/B10096', kind: 'event', names: ['「何の真似だ…」'], colors: ['黒'], level: 6, rarity: 'C', imageUrl: '1783904232387075.jpg' });
    expect(B10096P).toMatchObject({ id: 'B10096P', no: '1151/B10096P', rarity: 'CP', imageUrl: '1783904232395553.jpg' });
    expect(B10096P.abilities).toEqual(B10096.abilities);
    expect(REUSE_CARDS.filter((card) => card.id === B10096.id || card.id === B10096P.id)).toEqual([B10096, B10096P]);
    expect(new Set(REUSE_CARDS.map((card) => card.id)).size).toBe(REUSE_CARDS.length);
  });

  it('does not open a choice when the three milled cards contain no black cut-in', () => {
    const value = state([FILLER.id, FILLER.id, FILLER.id, FILLER.id]);
    useAndAccept(value);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(value.players.self.remove).toEqual([B10096.id, FILLER.id, FILLER.id, FILLER.id]);
  });

  it('keeps the mill snapshot across refresh and surfaces exactly two human choices for one match', () => {
    const value = state([CUTIN.id, FILLER.id, FILLER.id]);
    useAndAccept(value);

    const choice = _drainPendingEffectChoiceSide();
    expect(value.refreshCount.self).toBe(1);
    expect(choice?.player).toBe('self');
    expect(choice?.options).toHaveLength(2);
  });

  it('continues human option 0 into the look-and-add pick', () => {
    const value = state([CUTIN.id, FILLER.id, FILLER.id, CUTIN.id]);
    useAndAccept(value);
    applyChoiceAndContinuation(value, _drainPendingEffectChoiceSide()!, 0);

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb).toBe('deckRevealUntil');
    applyPickAndContinuation(value, pick!, pick!.candidates[0]!.uid);
    runAllUntilEmpty(value);
    expect(value.players.self.hand).toContain(CUTIN.id);
  });

  it('continues human option 1 into the hand character pick and rejects a stale card', () => {
    const value = state([CUTIN.id, FILLER.id, FILLER.id, FILLER.id], [B10096.id, ENTER.id]);
    useAndAccept(value);
    applyChoiceAndContinuation(value, _drainPendingEffectChoiceSide()!, 1);

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb).toBe('sceneEnter');
    mutate.hand.remove(value, 'self', [ENTER.id]);
    applyPickAndContinuation(value, pick!, pick!.candidates[0]!.uid);
    runAllUntilEmpty(value);
    expect(value.players.self.scene).toEqual([]);
  });

  it('runs both effects in printed order after three matches', () => {
    const value = state([CUTIN.id, CUTIN.id, CUTIN.id, CUTIN.id], [B10096.id, ENTER.id]);
    useAndAccept(value);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    const look = _drainPendingEffectPickSide();
    expect(look?.atomVerb).toBe('deckRevealUntil');
    applyPickSkipAndContinuation(value, look!);
    runAllUntilEmpty(value);
    expect(_drainPendingEffectPickSide()?.atomVerb).toBe('sceneEnter');
  });

  it('does nothing when the deck has fewer than three cards', () => {
    const short = state([CUTIN.id, FILLER.id]);
    short.players.self.remove = [FILLER.id];
    useAndAccept(short);
    expect(short.players.self.deck).toEqual([CUTIN.id, FILLER.id]);
    expect(short.players.self.remove).toEqual([FILLER.id, B10096.id]);
    expect(short.refreshCount.self).toBe(0);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
  });
});
