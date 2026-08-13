// qaId=card:B07102:99f16dd6a248501c9d63a44dd85b2d6097ef720865e4181d1b451669f04b05d7
// Official answer: when the deck empties during this draw, cards removed from
// hand by the preceding step are already in remove and join that refresh.
import { beforeEach, describe, expect, it } from 'vitest';
import { B07102 } from '@/cards/ct-p07/B07102';
import { event } from '@/engine/event';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const QA_ID = 'card:B07102:99f16dd6a248501c9d63a44dd85b2d6097ef720865e4181d1b451669f04b05d7';

const cutin: AbilityDef = {
  id: 'cutin',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } },
  description: '【カットイン】',
};

function card(id: string, abilities: AbilityDef[] = []): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['黒'],
    level: 3,
    ap: 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
  };
}

function state(): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.hand = ['CK1', 'CK2'];
  return value;
}

function enterAndResolve(value: GameState): void {
  const entered = mutate.scene.enter(value, 'self', 'B07102', { named: true, viaEffect: false });
  event.emit(
    value,
    'enter',
    { uid: entered.uid, viaEffect: false, enterOrder: entered.enterOrder, enterOrderThisTurn: entered.enterOrderThisTurn },
    { player: 'self', cardId: 'B07102', uid: entered.uid },
  );
  runAllUntilEmpty(value);
}

function chooseBoth(value: GameState): void {
  const pick = _drainPendingEffectPickSide();
  const uids = pick!.candidates.map((candidate) => candidate.uid);
  applyPickAndContinuation(value, pick!, uids[0]!, uids);
  runAllUntilEmpty(value);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  register(B07102);
  register(card('CK1', [cutin]));
  register(card('CK2', [cutin]));
  register(card('D1'));
  register(card('D2'));
  register(card('D3'));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B07102 official Q&A — refresh includes cards removed by the preceding step', () => {
  it(`${QA_ID}: positive short deck refreshes CK1/CK2, then completes the draw`, () => {
    const value = state();
    value.players.self.deck = ['D1'];
    enterAndResolve(value);
    chooseBoth(value);

    expect(value.refreshCount.self, `${QA_ID}: refresh occurs mid-draw`).toBe(1);
    expect(value.players.opp.evidence, `${QA_ID}: refresh opponent gains evidence`).toHaveLength(1);
    expect(value.players.self.remove, `${QA_ID}: removed CK1/CK2 joined refresh`).toEqual([]);
    expect([...value.players.self.hand, ...value.players.self.deck].sort(), `${QA_ID}: refreshed cards remain in circulation`).toEqual(['CK1', 'CK2', 'D1']);
    expect(value.players.self.hand, `${QA_ID}: draw resumes after refresh`).toHaveLength(2);
  });

  it(`${QA_ID}: negative sufficient-deck control leaves CK1/CK2 in remove`, () => {
    const value = state();
    value.players.self.deck = ['D1', 'D2', 'D3'];
    enterAndResolve(value);
    chooseBoth(value);
    expect(value.refreshCount.self, `${QA_ID}: no deck exhaustion`).toBe(0);
    expect(value.players.self.remove.sort(), `${QA_ID}: no refresh means removed cards stay removed`).toEqual(['CK1', 'CK2']);
    expect(value.players.self.hand, `${QA_ID}: ordinary draw`).toEqual(['D1', 'D2']);
  });

  it(`${QA_ID}: optional zero removal draws zero and cannot cause refresh`, () => {
    const value = state();
    value.players.self.deck = ['D1'];
    enterAndResolve(value);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.nMin, `${QA_ID}: 好きな枚数 permits zero`).toBe(0);
    applyPickSkipAndContinuation(value, pick!, false);
    runAllUntilEmpty(value);
    expect(value.refreshCount.self, `${QA_ID}: zero removal binds draw count zero`).toBe(0);
    expect(value.players.self.hand.sort(), `${QA_ID}: hand unchanged`).toEqual(['CK1', 'CK2']);
  });
});
