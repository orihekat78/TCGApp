// Gap3 — Cost `stunChar` (engine additive wave 2026-06-24)。
// 宣言コスト〚アクティブ状態の[X]を1枚スタンさせる〛(B08004 江戸川コナン)。sleepChar と完全対称に
// 新 Cost kind を canPay (active 候補存在で payable) + pay (mutate.scene.setState stun) に配線する。
// 既存カードは stunChar コスト未使用 → 回帰0 (additive)。
//
// 検証:
//   §1 canPay=true — active な対象が現場に存在。
//   §2 canPay=false — 対象が sleep のみ (active 候補なし、コスト文「アクティブ状態の」)。
//   §3 canPay=false — 対象が既 stun (active でない)。
//   §4 canPay=false — 対象が現場に不在。
//   §5 E2E — 宣言能力 (cost=stunChar) 発動で対象が stun 化 + 後続 effect (draw) が解決。
// rules: 03 §スタン特殊挙動, 21 §宣言能力コスト, 24 §スタン
// 出典 card (card-session が errata 反映の上 出荷): B08004 江戸川コナン。
// spec: .claude/specs/engine-additive-wave-2026-06-24.md

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

// stunChar コスト: 自陣現場の 特徴[組織] を1枚スタン (B08004 の [灰原哀] を fixture trait に置換)。
const STUN_COST = {
  kind: 'stunChar',
  target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '組織' } }, n: { min: 1, max: 1 }, chooser: 'self' },
} as unknown as Cost;

// 宣言者: cost=stunChar, effect=draw 1 (B08004 は「このキャラをアクティブにする」だが engine 検証には draw で十分)。
const DECL: CardDef = ch('DECL', {
  abilities: [{ id: 'a1', type: 'declared', scope: 'on-scene', cost: STUN_COST, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【宣言】stunChar cost → draw1', ruleRefs: [] }],
});
const HAIBARA: CardDef = ch('HAIBARA', { names: ['灰原哀'], traits: ['組織'] });

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
  registerTriggeredListener();
});

describe('Gap3 §1-4 — canPay gating (active 候補存在を要求)', () => {
  it('§1 active [組織] 存在 → canPay=true', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'active' }));
    expect(canPay(s, STUN_COST, ctxFor('u-decl'))).toBe(true);
  });
  it('§2 [組織] が sleep のみ → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'sleep' }));
    expect(canPay(s, STUN_COST, ctxFor('u-decl'))).toBe(false);
  });
  it('§3 [組織] が既 stun → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'stun' }));
    expect(canPay(s, STUN_COST, ctxFor('u-decl'))).toBe(false);
  });
  it('§4 [組織] 不在 → canPay=false', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    expect(canPay(s, STUN_COST, ctxFor('u-decl'))).toBe(false);
  });
});

describe('Gap3 §5 — E2E 宣言能力 (cost=stunChar) 発動', () => {
  it('対象 [組織] が stun 化 + 後続 draw が解決', () => {
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
    expect(after.players.self.scene.find((c) => c.uid === 'u-hb')!.state).toBe('stun');
    expect(after.players.self.hand.length).toBe(handBefore + 1);
    expect(after.players.self.deck.length).toBe(deckBefore - 1);
  });
});

describe('Gap3 §6 — 「1枚」counts faithful (複数 active 候補でも n.max のみ stun)', () => {
  // 敵対 review CONCERN: ctx.picked 未配線で over-pay (全 active stun) する sleepChar 由来 BUG-156 を
  // stunChar (新規) では n.max honor で防ぐ。2 active [組織] → ちょうど 1 枚のみ stun (他は active 維持)。
  it('2 active [組織] のうち stun は 1 枚のみ', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-decl', cardId: 'DECL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb1', cardId: 'HAIBARA', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-hb2', cardId: 'HAIBARA', state: 'active' }));
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-decl', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const stunnedCount = ['u-hb1', 'u-hb2'].filter((u) => after.players.self.scene.find((c) => c.uid === u)!.state === 'stun').length;
    expect(stunnedCount).toBe(1);
  });
});
