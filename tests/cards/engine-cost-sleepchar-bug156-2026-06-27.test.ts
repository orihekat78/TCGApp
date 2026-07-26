// BUG-156 — Cost `sleepChar` over-pay 修正 (2026-06-27)。
// sleepChar pay は `targets = ctx.picked ?? cands` を全件 sleep していた (ctx.picked は cost 経路で
// production 未配線 → cands=全 active 一致を sleep)。`n.max` を honor せず 2+ active 候補で全 sleep
// (rules/15「1枚」違反)。stunChar (engine-cost-stunchar test §6) と完全同形の cap に是正する。
//
// 検証 (stunChar test mirror、sleep semantics):
//   §1 canPay=true — active 候補存在。
//   §2 canPay=false — sleep のみ (active 候補なし)。
//   §3 canPay=false — 既 stun (active でない)。
//   §4 canPay=false — 対象不在。
//   §5 E2E — 宣言能力 (cost=sleepChar) で対象が sleep 化 + 後続 effect (draw) 解決。
//   §6 ★RED→GREEN — 2 active 候補でも sleep は n.max(=1) のみ (over-pay 修正の核)。
// rules: 03 §状態, 11 §推理(sleep), 21 §宣言能力コスト
// spec: .claude/specs/engine-bugfix-156-157-cost-recursion.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/evaluate';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, Cost } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// sleepChar コスト: 自陣現場の 特徴[組織] を1枚スリープ (D01003/B03060 同型、trait filter)。
const SLEEP_COST = {
  kind: 'sleepChar',
  target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '組織' } }, n: { min: 1, max: 1 }, chooser: 'self' },
} as unknown as Cost;

const DECL: CardDef = ch('DECL', {
  abilities: [{ id: 'a1', type: 'declared', scope: 'on-scene', cost: SLEEP_COST, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【宣言】sleepChar cost → draw1', ruleRefs: [] }],
});
const HAIBARA: CardDef = ch('HAIBARA', { names: ['灰原哀'], traits: ['組織'] });

// §7 用: 14/15 出荷カードと同形の excludeSelf cost (D01003/B03060 型)。actor 自身が trait 一致でも除外される。
const SLEEP_COST_EXSELF = {
  kind: 'sleepChar',
  target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { trait: '組織' } }, n: { min: 1, max: 1 }, chooser: 'self' },
} as unknown as Cost;
const DECL_EXSELF: CardDef = ch('DECLX', { traits: ['組織'], // 自身も [組織] だが excludeSelf で候補外
  abilities: [{ id: 'a1', type: 'declared', scope: 'on-scene', cost: SLEEP_COST_EXSELF, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【宣言】excludeSelf sleepChar → draw1', ruleRefs: [] }],
});

// §8 用: 複合コスト pay[sleepSelf, sleepChar] (B03060/B05074 型)。sleepSelf で自身 sleep + sleepChar で 1 枚 cap。
const DECL_COMPOSITE: CardDef = ch('DECLC', { // 自身 trait なし → sleepChar(組織) 候補外、sleepSelf で sleep
  abilities: [{ id: 'a1', type: 'declared', scope: 'on-scene', cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, SLEEP_COST] } as unknown as Cost, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【宣言】pay[sleepSelf, sleepChar] → draw1', ruleRefs: [] }],
});

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3');
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
const ctxFor = (uid: string): EffectCtx => ({ source: { cardId: 'DECL', uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerCardDef(DECL);
  registerCardDef(HAIBARA);
  registerCardDef(DECL_EXSELF);
  registerCardDef(DECL_COMPOSITE);
  registerTriggeredListener();
});

describe('BUG-156 §1-4 — canPay gating (active 候補存在を要求)', () => {
  it('§1 active [組織] 存在 → canPay=true', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'active' }));
    expect(canPay(s, SLEEP_COST, ctxFor('u-decl'))).toBe(true);
  });
  it('§2 [組織] が sleep のみ → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'sleep' }));
    expect(canPay(s, SLEEP_COST, ctxFor('u-decl'))).toBe(false);
  });
  it('§3 [組織] が既 stun → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'stun' }));
    expect(canPay(s, SLEEP_COST, ctxFor('u-decl'))).toBe(false);
  });
  it('§4 [組織] 不在 → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    expect(canPay(s, SLEEP_COST, ctxFor('u-decl'))).toBe(false);
  });
});

describe('BUG-156 §5 — E2E 宣言能力 (cost=sleepChar) 発動', () => {
  it('対象 [組織] が sleep 化 + 後続 draw が解決', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'active' }));
    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-decl', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    expect(after.players.self.scene.find((c) => c.uid === 'u-hb')!.state).toBe('sleep');
    expect(after.players.self.hand.length).toBe(handBefore + 1);
    expect(after.players.self.deck.length).toBe(deckBefore - 1);
  });
});

describe('BUG-156 §6 — over-pay 修正: 複数 active 候補でも n.max のみ sleep', () => {
  // 修正前は ctx.picked 未配線で over-pay (全 active sleep)。2 active [組織] → ちょうど 1 枚のみ sleep。
  it('2 active [組織] のうち sleep は 1 枚のみ (他は active 維持)', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb1', cardId: 'HAIBARA', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb2', cardId: 'HAIBARA', state: 'active' }));
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-decl', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const sleptCount = ['u-hb1', 'u-hb2'].filter((u) => after.players.self.scene.find((c) => c.uid === u)!.state === 'sleep').length;
    expect(sleptCount).toBe(1);
  });
});

describe('BUG-156 §7 — excludeSelf cost (出荷 14/15 と同形) でも n.max cap', () => {
  // 敵対 review concern: §6 は excludeSelf 非使用。出荷の大半は excludeSelf:true (D01003/B03060/B07016)。
  // actor 自身も [組織] だが excludeSelf で候補外 → 残 2 active [組織] のうち 1 枚のみ sleep、actor は active 維持。
  it('2 active [組織](他) のうち sleep は 1 枚、excludeSelf の actor は active 維持', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-dx', cardId: 'DECLX', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb1', cardId: 'HAIBARA', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb2', cardId: 'HAIBARA', state: 'active' }));
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-dx', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const sleptCount = ['u-hb1', 'u-hb2'].filter((u) => after.players.self.scene.find((c) => c.uid === u)!.state === 'sleep').length;
    expect(sleptCount).toBe(1);
    expect(after.players.self.scene.find((c) => c.uid === 'u-dx')!.state).toBe('active'); // excludeSelf
  });
});

describe('BUG-156 §8 — 複合コスト pay[sleepSelf, sleepChar] でも sleepChar item は 1 枚 cap', () => {
  // 敵対 review concern: §5 は standalone sleepChar。出荷 4枚 (B03060/B04070/B05074/B09082) は pay 複合。
  // payInner の pay-case は item ごとに再帰 → 各 sleepChar item が独立に n.max=1 cap。
  it('actor は sleepSelf で sleep、sleepChar は 2 active [組織] のうち 1 枚のみ', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-dc', cardId: 'DECLC', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb1', cardId: 'HAIBARA', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb2', cardId: 'HAIBARA', state: 'active' }));
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-dc', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    expect(after.players.self.scene.find((c) => c.uid === 'u-dc')!.state).toBe('sleep'); // sleepSelf
    const sleptCount = ['u-hb1', 'u-hb2'].filter((u) => after.players.self.scene.find((c) => c.uid === u)!.state === 'sleep').length;
    expect(sleptCount).toBe(1);
  });
});
