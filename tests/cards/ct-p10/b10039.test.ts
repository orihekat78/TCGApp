import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10039, B10039P } from '@/cards/ct-p10/B10039';
import { REUSE_CARDS } from '@/cards';
import { applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { event } from '@/engine/event';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingDeckReorderSide?: unknown;
  __pendingDeckRevealSide?: { visibility?: string; viewer?: string; awaitingPick?: boolean; matched?: string | null } | null;
};

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors: ['青'], level: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const GREEN = card('B10039_GREEN', { colors: ['緑'] });
const WHITE = card('B10039_WHITE', { colors: ['白'] });
const DECOY = card('B10039_DECOY');
const TAIL = card('B10039_TAIL');
const PAY = card('B10039_PAY');
const REFRESH = card('B10039_REFRESH');

const leaveSelf: AbilityDef = {
  id: 'leave-self', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '自身が現場からリムーブされたとき、カードを1枚引く。', ruleRefs: [],
};
const VICTIM = card('B10039_VICTIM', {
  kind: 'character', level: 1, ap: 1000, lp: 1, abilities: [leaveSelf],
});

function state(deck: string[] = []): GameState {
  const result = createEmptyGameState();
  result.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  result.players.self.case = { cardId: 'CASE', status: '解決編', requiredEvidence: 0, colors: ['緑', '白'], declaredUseCount: {} };
  result.players.self.deck = [...deck];
  return result;
}

function enterSearch(result: GameState): void {
  const entered = mutate.scene.enter(result, 'self', B10039.id, { active: true });
  event.emit(result, 'enter', { uid: entered.uid, viaEffect: false, enterOrder: entered.enterOrder, enterOrderThisTurn: entered.enterOrderThisTurn }, { player: 'self', cardId: B10039.id, uid: entered.uid });
  runAllUntilEmpty(result);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _clearPendingEffectPickQueue();
  _resetRegistry();
  [B10039, B10039P, GREEN, WHITE, DECOY, TAIL, PAY, REFRESH, VICTIM].forEach(register);
  registerTriggeredListener();
  globals.__humanPlayerSide = 'self';
  globals.__pendingDeckReorderSide = null;
  globals.__pendingDeckRevealSide = null;
});

describe('CT-P10 B10039 白馬探', () => {
  it('registers exactly the two official printings with matching metadata', () => {
    const registered = REUSE_CARDS.filter(card => card.id === B10039.id || card.id === B10039P.id);

    expect(registered).toHaveLength(2);
    expect(registered.map(card => card.id)).toEqual([B10039.id, B10039P.id]);
    expect(registered).toEqual([B10039, B10039P]);
  });

  it('lets its controller take one green or white card privately, discard once, and choose the remaining bottom order', () => {
    let result = state([DECOY.id, GREEN.id, WHITE.id, TAIL.id]);
    result.players.self.hand = [PAY.id];
    enterSearch(result);
    const pick = _drainPendingEffectPickSide()!;

    expect(pick.atomVerb).toBe('deckRevealUntil');
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([GREEN.id, WHITE.id]);
    expect(globals.__pendingDeckRevealSide).toMatchObject({ visibility: 'private', viewer: 'self', awaitingPick: true });
    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[1]!.uid));

    const discard = _drainPendingEffectPickSide()!;
    expect(discard.atomVerb).toBe('discard');
    result = produce(result, draft => applyPickAndContinuation(draft, discard, discard.candidates.find(candidate => candidate.cardId === PAY.id)!.uid));
    const reorder = _drainPendingDeckReorderSide()!;
    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder, [TAIL.id, GREEN.id, DECOY.id]));

    expect(result.players.self.hand).toEqual([WHITE.id]);
    expect(result.players.self.remove).toEqual([PAY.id]);
    expect(result.players.self.deck).toEqual([TAIL.id, GREEN.id, DECOY.id]);
  });

  it('allows choosing no qualifying card and moves every looked card to the bottom in the chosen order', () => {
    let result = state([GREEN.id, DECOY.id, WHITE.id, TAIL.id]);
    enterSearch(result);
    const pick = _drainPendingEffectPickSide()!;

    result = produce(result, draft => applyPickSkipAndContinuation(draft, pick));
    const reorder = _drainPendingDeckReorderSide()!;
    result = produce(result, draft => applyDeckReorderAndContinuation(draft, reorder, [TAIL.id, WHITE.id, DECOY.id, GREEN.id]));

    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.remove).toEqual([]);
    expect(result.players.self.deck).toEqual([TAIL.id, WHITE.id, DECOY.id, GREEN.id]);
  });

  it('looks through a short deck and refreshes only after its one eligible card is taken', () => {
    let result = state([GREEN.id]);
    result.players.self.remove = [REFRESH.id];
    enterSearch(result);
    const pick = _drainPendingEffectPickSide()!;

    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[0]!.uid));
    const discard = _drainPendingEffectPickSide()!;
    result = produce(result, draft => applyPickAndContinuation(draft, discard, discard.candidates.find(candidate => candidate.cardId === GREEN.id)!.uid));

    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.remove).toEqual([GREEN.id]);
    expect(result.players.self.deck).toEqual([REFRESH.id]);
    expect(result.refreshCount.self).toBe(1);
  });

  it('does not start its entry search unless the own case has both green and white', () => {
    const result = state([GREEN.id]);
    result.players.self.case.colors = ['緑'];
    enterSearch(result);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(result.players.self.deck).toEqual([GREEN.id]);
  });

  it('connects the printed restriction only during its own resolved-case turn', () => {
    const active = state();
    mutate.scene.enter(active, 'self', B10039.id, { active: true });
    const suppressed = mutate.scene.enter(active, 'opp', VICTIM.id, { active: true });
    mutate.scene.removeToRemove(active, suppressed.uid, 'contact-ap');
    expect(active.pendingEffects).toHaveLength(0);

    const inactive = state();
    inactive.turn.player = 'opp';
    mutate.scene.enter(inactive, 'self', B10039.id, { active: true });
    const preserved = mutate.scene.enter(inactive, 'opp', VICTIM.id, { active: true });
    mutate.scene.removeToRemove(inactive, preserved.uid, 'contact-ap');
    expect(inactive.pendingEffects.map(effect => effect.source.cardId)).toEqual([VICTIM.id]);
  });

  it('offers and resolves Hirameki after this card leaves own evidence, then keeps the promo identical', () => {
    const result = state([TAIL.id]);
    result.players.self.evidence = [{ cardId: B10039.id, faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    event.emit(result, 'evidence:remove-by-action', { player: 'self', ev: { cardId: B10039.id }, byUid: 'attacker' }, { player: 'opp', uid: 'attacker' });
    const pending = _drainPendingHirameki()!;
    expect(pending).toMatchObject({ player: 'self', cardId: B10039.id, abilityId: 'a2' });
    runEffect(result, B10039.abilities[2]!.effect!, { source: { cardId: B10039.id, abilityId: 'a2', player: 'self', area: 'evidence' }, bindings: {} });
    expect(result.players.self.hand).toEqual([TAIL.id]);
    expect(B10039P.abilities).toEqual(B10039.abilities);
    expect(B10039).toMatchObject({ no: '1099/B10039', names: ['白馬探'], colors: ['白'], level: 4, ap: 3000, lp: 1, traits: ['探偵', '高校生'], rarity: 'R', imageUrl: '1783904137988913.jpg' });
    expect(B10039P).toMatchObject({ no: '1099/B10039P', rarity: 'RP', imageUrl: '1783904137995147.jpg' });
  });
});
