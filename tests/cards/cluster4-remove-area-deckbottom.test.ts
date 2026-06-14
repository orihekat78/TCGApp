// cluster4 — remove-area → deck-bottom 解禁6枚を実 engine 経路で駆動する挙動テスト
// 新規 engine プリミティブ (cost removeAreaToDeckBottom / verb removeAreaAllToDeckBottom) と
// 各カードの配線を、decoy/自己他者を盤面に置いた決定論ケースで 1対1 検証する。
// rules: 09/14/15/21/23/26 + TSV qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAtom } from '@/engine/effect/atom-handlers';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, Cost } from '@/engine/types';
import { B08051 } from '@/cards/ct-p08/B08051';
import { B08066 } from '@/cards/ct-p08/B08066';
import { B03059 } from '@/cards/ct-p03/B03059';
import { B08027 } from '@/cards/ct-p08/B08027';

function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3');
  s.players.opp.deck.push('e1', 'e2');
  s.turn = { number: 2, player: 'self' } as GameState['turn'];
  return s;
}

const ctxFor = (cardId: string, uid: string): EffectCtx => ({
  source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
});

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
});

// ───────────────────────── 新 cost: removeAreaToDeckBottom ─────────────────────────
describe('cost removeAreaToDeckBottom (新プリミティブ)', () => {
  const cost: Cost = {
    kind: 'removeAreaToDeckBottom',
    target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '白', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
    n: 1,
  };

  it('canPay: 自分のリムーブに該当(白キャラ)あり → true', () => {
    registerCardDef(plain('shiroC', { colors: ['白'] }));
    const s = base();
    s.players.self.remove.push('shiroC');
    expect(canPay(s, cost, ctxFor('X', 'ux'))).toBe(true);
  });

  it('canPay: 該当が無い → false (rules/21 全部行えなければ使用不可)', () => {
    registerCardDef(plain('akaC', { colors: ['赤'] }));
    const s = base();
    s.players.self.remove.push('akaC'); // 白でない decoy
    expect(canPay(s, cost, ctxFor('X', 'ux'))).toBe(false);
  });

  it('canPay: 該当が相手のリムーブにのみ → false (side:self、Q&A「相手のカードは移せない」)', () => {
    registerCardDef(plain('shiroC', { colors: ['白'] }));
    const s = base();
    s.players.opp.remove.push('shiroC');
    expect(canPay(s, cost, ctxFor('X', 'ux'))).toBe(false);
  });

  it('pay: 該当カードがリムーブ→自分のデッキ最下へ移る (リムーブ-1 / デッキ+1 / leave hook 不発)', () => {
    registerCardDef(plain('shiroC', { colors: ['白'] }));
    const s = base();
    s.players.self.remove.push('shiroC');
    const deckBefore = s.players.self.deck.length;
    let leaveFired = false;
    const after = produce(s, (d) => {
      event.on('leave:to-remove', () => { leaveFired = true; });
      pay(d, cost, ctxFor('X', 'ux'));
    });
    expect(after.players.self.remove).not.toContain('shiroC');
    expect(after.players.self.deck.length).toBe(deckBefore + 1);
    expect(after.players.self.deck[after.players.self.deck.length - 1]).toBe('shiroC'); // 最下
    expect(leaveFired).toBe(false); // rules/09・23: デッキ下移動はリムーブでない
  });
});

// ───────────────────────── 新 verb: removeAreaAllToDeckBottom ─────────────────────────
describe('verb removeAreaAllToDeckBottom (B08027 新プリミティブ)', () => {
  it('自分と相手のリムーブ全部を各自のデッキ下へ移す', () => {
    const s = base();
    s.players.self.remove.push('sr1', 'sr2');
    s.players.opp.remove.push('or1');
    const after = produce(s, (d) => {
      runAtom(d, 'removeAreaAllToDeckBottom', {}, ctxFor('B08027', 'u'));
    });
    expect(after.players.self.remove).toHaveLength(0);
    expect(after.players.opp.remove).toHaveLength(0);
    expect(after.players.self.deck).toContain('sr1');
    expect(after.players.self.deck).toContain('sr2');
    expect(after.players.opp.deck).toContain('or1');
  });

  it('リムーブが空のプレイヤーでも throw せずシャッフルのみ実行 (公式テキスト literal)', () => {
    const s = base();
    // 両者 remove 空
    expect(() => produce(s, (d) => runAtom(d, 'removeAreaAllToDeckBottom', {}, ctxFor('B08027', 'u')))).not.toThrow();
  });
});

// ───────────────────────── B08027 長門秀臣 (登場時 optional → verb) ─────────────────────────
describe('B08027 (実カード): このキャラをリムーブしてもよい→全リムーブをデッキ下へ', () => {
  it('optional 受諾: 自身も含め両リムーブをデッキ下へ (Q&A: 自身も含む)', () => {
    registerCardDef(B08027);
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-nagato', cardId: 'B08027', state: 'active' }));
    s.players.self.remove.push('sr1');
    s.players.opp.remove.push('or1');
    const ctx: EffectCtx = { source: { cardId: 'B08027', uid: 'u-nagato', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => {
      runEffect(d, B08027.abilities[0]!.effect!, ctx);
    });
    // 自身が現場を離れリムーブ経由でデッキへ (自己含む)
    expect(after.players.self.scene.find((c) => c.uid === 'u-nagato')).toBeUndefined();
    expect(after.players.self.deck).toContain('B08027'); // 自身も含めて移動
    expect(after.players.self.deck).toContain('sr1');
    expect(after.players.self.remove).toHaveLength(0);
    expect(after.players.opp.deck).toContain('or1');
    expect(after.players.opp.remove).toHaveLength(0);
  });

  it('optional 拒否: 何も起きない (リムーブも移動もしない)', () => {
    registerCardDef(B08027);
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-nagato', cardId: 'B08027', state: 'active' }));
    s.players.self.remove.push('sr1');
    const ctx: EffectCtx = { source: { cardId: 'B08027', uid: 'u-nagato', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: false } };
    const after = produce(s, (d) => {
      runEffect(d, B08027.abilities[0]!.effect!, ctx);
    });
    expect(after.players.self.scene.find((c) => c.uid === 'u-nagato')).toBeDefined();
    expect(after.players.self.remove).toContain('sr1');
  });
});

// ───────────────────────── B08051 赤井秀一 (登場時 condition → 突撃) ─────────────────────────
describe('B08051 (実カード): リムーブに[宮野明美]ある場合のみ登場時に突撃', () => {
  function setup(removeName: string | null) {
    registerCardDef(B08051);
    registerCardDef(plain('miyano', { names: ['宮野明美'] }));
    registerCardDef(plain('decoy', { names: ['服部平次'] }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-akai', cardId: 'B08051', state: 'active', enterOrderThisTurn: 1 }));
    if (removeName) s.players.self.remove.push(removeName);
    return s;
  }
  it('[宮野明美] が remove にある → 登場時に〚突撃〛取得', () => {
    const s = setup('miyano');
    const after = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'u-akai', player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B08051', uid: 'u-akai' });
      runAllUntilEmpty(d);
    });
    expect(read.char.hasKeyword(after, 'u-akai', '突撃')).toBe(true);
  });
  it('[宮野明美] が無い (decoy のみ) → 突撃を持たない', () => {
    const s = setup('decoy');
    const after = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'u-akai', player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B08051', uid: 'u-akai' });
      runAllUntilEmpty(d);
    });
    expect(read.char.hasKeyword(after, 'u-akai', '突撃')).toBe(false);
  });
});

// ───────────────────────── B03059 土井塔克樹 (宣言: cost removeAreaToDeckBottom + AP pick) ─────────────────────────
describe('B03059 (実カード): 宣言能力で白キャラをリムーブ→デッキ下、キャラAP+1000', () => {
  it('cost 払いで白キャラが remove→デッキ下へ移り、AP+1000 pick が解決する', () => {
    registerCardDef(B03059);
    registerCardDef(plain('shiroC', { colors: ['白'] }));
    registerCardDef(plain('tgt', { ap: 4000 }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-doi', cardId: 'B03059', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-tgt', cardId: 'tgt', state: 'active' }));
    s.players.self.remove.push('shiroC');
    const deckBefore = s.players.self.deck.length;
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-doi', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    // cost: 白キャラが remove から消えデッキ最下へ
    expect(after.players.self.remove).not.toContain('shiroC');
    expect(after.players.self.deck.length).toBe(deckBefore + 1);
    expect(after.players.self.deck[after.players.self.deck.length - 1]).toBe('shiroC');
    // effect: いずれかのキャラに AP+1000 (turn scope) — u-tgt が +1000 (base 4000 → 5000)
    expect(read.char.ap(after, 'u-tgt')).toBe(5000);
  });
});

// ───────────────────────── B08066 上原由衣 (宣言: sleepSelf + cost) ─────────────────────────
describe('B08066 (実カード): 宣言で自身スリープ + 長野県警キャラを remove→デッキ下', () => {
  it('cost pay[sleepSelf, removeAreaToDeckBottom]: 自身スリープ + 長野県警キャラ移動', () => {
    registerCardDef(B08066);
    registerCardDef(plain('nagano', { traits: ['長野県警'] }));
    registerCardDef(plain('naganoScene', { traits: ['長野県警'] }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-uehara', cardId: 'B08066', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-ns', cardId: 'naganoScene', state: 'active' }));
    s.players.self.remove.push('nagano');
    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-uehara', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    // cost sleepSelf
    expect(after.players.self.scene.find((c) => c.uid === 'u-uehara')!.state).toBe('sleep');
    // cost: 長野県警キャラが remove→デッキ下
    expect(after.players.self.remove).not.toContain('nagano');
    expect(after.players.self.deck[after.players.self.deck.length - 1]).toBe('nagano');
    // effect: 「〚特徴［長野県警］〛のキャラを1枚まで選び突撃を与える」=> 候補 (u-ns / 自身 u-uehara, ともに
    //   長野県警) のいずれかに〚突撃〛が付与される (どちらを選ぶかは chooser 次第。rules/15 either-side)。
    const granted = read.char.hasKeyword(after, 'u-ns', '突撃') || read.char.hasKeyword(after, 'u-uehara', '突撃');
    expect(granted).toBe(true);
  });
});
