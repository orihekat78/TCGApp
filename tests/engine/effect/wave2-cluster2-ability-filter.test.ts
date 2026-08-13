// engine拡張 wave#2 cluster2 — ability-presence filter pin tests
// X1: defHasKeyword 現場リムーブ時/疾風 (印字静的判定 — 公式Q&A 8件: 条件アイコンの有効性は問わない)
// X1b: targetFilterToPredicate の keyword/cardName silent-drop 解消 (BUG-117/118 同型) +
//      boundMatchesFilter の keyword/kind/ap/lp silent-drop 解消 (第3サイト)
// X6: boundToRemove — bound window をリムーブエリアへ + 移送完了後 refresh guard (B09073 qAndA)
// X7: mill の refresh guard 欠落修正 (BUG-137 — B09104 qAndA「可能な限りリムーブ→その後リフレッシュ」)
// rules: 13-keywords.md, 17-icons.md, 14-refresh.md, 26-qa-deck-refresh.md, 15-abilities-effects.md, 19-special-rules.md
// spec: .claude/specs/engine-wave2-ability-filter-design.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { evalCond } from '@/engine/cond/eval';
import { defHasKeyword } from '@/engine/read/keyword';
import { cards as engineCards } from '@/engine/cards/index';
import { makeCtx } from '../../helpers/fixtures';
import type { CardDef, AbilityDef, Candidate, EffectStackEntry, GameState } from '@/engine/types';

// ---------------------------------------------------------------------------
// synthetic defs (正準形状: 現リム時=D05007 / 疾風=D11014 / カットイン=Option C)
// ---------------------------------------------------------------------------

function defWith(over: Partial<CardDef>): CardDef {
  return {
    id: 'T-X', no: '9999/T-X', kind: 'character', names: ['テスト'], colors: ['青'],
    level: 3, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

const NOOP_EFFECT = { kind: 'atom', verb: 'noop', args: {} } as AbilityDef['effect'];

/** 【相手ターン中】【現場リムーブ時】… — 条件アイコン付きでも「持つ」(静的判定) */
const abSceneRemove: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: NOOP_EFFECT, description: '【相手ターン中】【現場リムーブ時】(test)',
};

/** observer 型 (selfOnly なし、「キャラがリムーブされたとき」) — 現リム時を持つとは判定しない */
const abLeaveObserver: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  effect: NOOP_EFFECT, description: 'キャラがリムーブされたとき (observer, test)',
};

/** multi-hook (hooks[] 配列形) に leave:to-remove を含む場合も「持つ」 */
const abMultiHook: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'action:declare', hooks: ['leave:to-remove'], selfOnly: true },
  effect: NOOP_EFFECT, description: 'multi-hook 現リム時 (test)',
};

/** 【疾風1】 — enter + selfOnly + matcherCondition enterOrderEquals (D11014 正準) */
const abShippu: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: NOOP_EFFECT, description: '【疾風1】(test)',
};

/** 【登場時】 — enter + selfOnly だが matcherCondition 無し → 疾風ではない (重要 negative) */
const abEnterPlain: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: NOOP_EFFECT, description: '【登場時】(test)',
};

/** カットイン (Option C: on-hand + effect:declared + optional) */
const abCutin: AbilityDef = {
  id: 'c1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true },
  effect: NOOP_EFFECT, description: '【カットイン】AP＋1000 (test)',
};

// ---------------------------------------------------------------------------
// X1: defHasKeyword 述語
// ---------------------------------------------------------------------------

describe('X1: defHasKeyword — 現場リムーブ時 / 疾風 (印字静的判定)', () => {
  it('現場リムーブ時: selfOnly:true の leave:to-remove trigger を持つ → true (条件アイコン付きでも)', () => {
    expect(defHasKeyword(defWith({ abilities: [abSceneRemove] }), '現場リムーブ時')).toBe(true);
  });

  it('現場リムーブ時: selfOnly 無し observer 型は false', () => {
    expect(defHasKeyword(defWith({ abilities: [abLeaveObserver] }), '現場リムーブ時')).toBe(false);
  });

  it('現場リムーブ時: hooks[] 配列形 (multi-hook) でも true', () => {
    expect(defHasKeyword(defWith({ abilities: [abMultiHook] }), '現場リムーブ時')).toBe(true);
  });

  it('疾風: enter + selfOnly + matcherCondition enterOrderEquals → true', () => {
    expect(defHasKeyword(defWith({ abilities: [abShippu] }), '疾風')).toBe(true);
  });

  it('疾風: 【登場時】(matcherCondition 無し) は false / 突撃 keyword も false', () => {
    expect(defHasKeyword(defWith({ abilities: [abEnterPlain] }), '疾風')).toBe(false);
    expect(defHasKeyword(defWith({ keywords: ['突撃'] }), '疾風')).toBe(false);
  });

  it('回帰: 通常 keywords[] (突撃) / カットイン ability は従来通り', () => {
    expect(defHasKeyword(defWith({ keywords: ['突撃'] }), '突撃')).toBe(true);
    expect(defHasKeyword(defWith({ kind: 'event', ap: undefined, lp: undefined, abilities: [abCutin] }), 'カットイン')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// X1b-a: targetFilterToPredicate (deckRevealUntil 経路) の keyword/cardName
// ---------------------------------------------------------------------------

function registerSynthetics(): void {
  engineCards.register(defWith({ id: 'T-PLAIN', names: ['プレーン'] }));
  engineCards.register(defWith({ id: 'T-REM', names: ['現リム持ち'], abilities: [abSceneRemove] }));
  engineCards.register(defWith({ id: 'T-SHIPPU', names: ['疾風持ち'], abilities: [abShippu], level: 8 }));
  engineCards.register(defWith({
    id: 'T-EVT', kind: 'event', ap: undefined, lp: undefined,
    names: ['カットインイベント'], colors: ['黒'], abilities: [abCutin],
  }));
  engineCards.register(defWith({ id: 'T-NAME', names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'] }));
}

function withDeck(deck: string[]): GameState {
  const s = createEmptyGameState();
  return { ...s, players: { ...s.players, self: { ...s.players.self, deck } } };
}

describe('X1b: targetFilterToPredicate — keyword/cardName silent-drop 解消', () => {
  beforeEach(() => {
    engineCards._resetRegistry();
    registerSynthetics();
  });

  it('filter.keyword:現場リムーブ時 が deckRevealUntil 窓で効く (従来は drop され先頭 character が match)', () => {
    const s = withDeck(['T-PLAIN', 'T-REM', 'T-EVT']);
    const ctx = makeCtx();
    produce(s, draft => {
      runAtom(draft, 'deckRevealUntil',
        { player: 'self', filter: { keyword: '現場リムーブ時', kind: 'character' }, maxN: 3, bind: 'r', bindMatch: 'm' }, ctx);
    });
    expect(ctx.bindings['m']).toHaveLength(1);
    expect((ctx.bindings['m'][0] as { cardId: string }).cardId).toBe('T-REM');
  });

  it('filter.keyword:カットイン がイベントにも効く (kind 制限なし=「カード」)', () => {
    const s = withDeck(['T-PLAIN', 'T-EVT']);
    const ctx = makeCtx();
    produce(s, draft => {
      runAtom(draft, 'deckRevealUntil',
        { player: 'self', filter: { keyword: 'カットイン', color: '黒' }, maxN: 2, bind: 'r', bindMatch: 'm' }, ctx);
    });
    expect(ctx.bindings['m']).toHaveLength(1);
    expect((ctx.bindings['m'][0] as { cardId: string }).cardId).toBe('T-EVT');
  });

  it('filter.cardName が分割名 components で効く (rules/19)', () => {
    const s = withDeck(['T-PLAIN', 'T-NAME']);
    const ctx = makeCtx();
    produce(s, draft => {
      runAtom(draft, 'deckRevealUntil',
        { player: 'self', filter: { cardName: '工藤新一' }, maxN: 2, bind: 'r', bindMatch: 'm' }, ctx);
    });
    expect(ctx.bindings['m']).toHaveLength(1);
    expect((ctx.bindings['m'][0] as { cardId: string }).cardId).toBe('T-NAME');
  });
});

// ---------------------------------------------------------------------------
// X1b-b: boundMatchesFilter の keyword/kind/ap/lp silent-drop 解消
// ---------------------------------------------------------------------------

describe('X1b: boundMatchesFilter — keyword/kind/ap/lp を honor (第3の drop サイト)', () => {
  beforeEach(() => {
    engineCards._resetRegistry();
    registerSynthetics();
  });

  const boundOf = (cardId: string) => ({
    bindings: { b: [{ kind: 'card', cardId, area: 'deck', player: 'self' } as Candidate] },
  });

  it('keyword: カットインを持たないカードは false (従来は drop され true)', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { keyword: 'カットイン' } }, makeCtx(boundOf('T-PLAIN')))).toBe(false);
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { keyword: 'カットイン' } }, makeCtx(boundOf('T-EVT')))).toBe(true);
  });

  it('kind: event は kind:character で false', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { kind: 'character' } }, makeCtx(boundOf('T-EVT')))).toBe(false);
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { kind: 'character' } }, makeCtx(boundOf('T-PLAIN')))).toBe(true);
  });

  it('apMin/lpMin: printed 値で判定 (ap1000 は apMin2000 で false)', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { apMin: 2000 } }, makeCtx(boundOf('T-PLAIN')))).toBe(false);
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { apMax: 2000 } }, makeCtx(boundOf('T-PLAIN')))).toBe(true);
  });

  it('回帰: levelMin は従来通り (B09073 a2 levelMin:8)', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { levelMin: 8 } }, makeCtx(boundOf('T-SHIPPU')))).toBe(true);
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: { levelMin: 8 } }, makeCtx(boundOf('T-PLAIN')))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// X6: boundToRemove
// ---------------------------------------------------------------------------

describe('X6: boundToRemove — bound window をリムーブエリアへ', () => {
  beforeEach(() => {
    engineCards._resetRegistry();
    registerSynthetics();
  });

  const cand = (cardId: string): Candidate => ({ kind: 'card', cardId, area: 'deck', player: 'self' });

  it('bound の cardId 群をデッキから splice してリムーブエリアへ', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'BASE'] } } };
    const ctx = makeCtx({ bindings: { r: [cand('A'), cand('B')] } });
    const result = produce(s, draft => {
      runAtom(draft, 'boundToRemove', { player: 'self', bindKey: 'r' }, ctx);
    });
    expect(result.players.self.deck).toEqual(['BASE']);
    expect(result.players.self.remove).toEqual(['A', 'B']);
  });

  it('移送完了でデッキ 0 → refresh (移したカード自身も shuffle 対象, B09073 qAndA / rules/26)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'], remove: ['C'] } } };
    const ctx = makeCtx({ bindings: { r: [cand('A'), cand('B')] } });
    const result = produce(s, draft => {
      runAtom(draft, 'boundToRemove', { player: 'self', bindKey: 'r' }, ctx);
    });
    // refresh: remove (A,B,C) がデッキへ、remove 空、相手が証拠+1 (rules/14)
    expect(result.players.self.deck).toHaveLength(3);
    expect(result.players.self.remove).toEqual([]);
    expect(result.players.opp.evidence).toHaveLength(1);
    expect(result.gameResult).toBeUndefined();
  });

  it('bound 空は no-op (refresh も起きない)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [], remove: [] } } };
    const ctx = makeCtx({ bindings: { r: [] } });
    const result = produce(s, draft => {
      runAtom(draft, 'boundToRemove', { player: 'self', bindKey: 'r' }, ctx);
    });
    expect(result.gameResult).toBeUndefined();
    expect(result.refreshCount.self).toBe(0);
    expect(result.log.some(entry => entry.action === 'effect:boundToRemove')).toBe(false);
    expect(result.players.opp.evidence).toHaveLength(0);
  });

  it('refresh ordering flags require literal true', () => {
    let handAddState = createEmptyGameState();
    handAddState = { ...handAddState, players: { ...handAddState.players, self: { ...handAddState.players.self, deck: ['A'], remove: ['R'] } } };
    const handAdd = produce(handAddState, draft => {
      runAtom(draft, 'handAddFromDeck', { player: 'self', cardId: 'A', deferRefresh: 1 }, makeCtx());
    });
    expect(handAdd.players.self.hand).toEqual(['A']);
    expect(handAdd.players.self.deck).toEqual(['R']);
    expect(handAdd.refreshCount.self).toBe(1);

    let emptyBoundState = createEmptyGameState();
    emptyBoundState = { ...emptyBoundState, players: { ...emptyBoundState.players, self: { ...emptyBoundState.players.self, remove: ['R'] } } };
    const emptyBound = produce(emptyBoundState, draft => {
      runAtom(draft, 'boundToRemove', { player: 'self', bindKey: 'r', refreshAfter: 1 }, makeCtx({ bindings: { r: [] } }));
    });
    expect(emptyBound.players.self.deck).toEqual([]);
    expect(emptyBound.players.self.remove).toEqual(['R']);
    expect(emptyBound.refreshCount.self).toBe(0);
    expect(emptyBound.log.some(entry => entry.action === 'effect:boundToRemove')).toBe(false);
  });

  it('accepted one-card remainder refresh emits the tagged remove-to-deck causal operation', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['R'];
    startCausalSession(state, 'bound-remove-accepted-one-card-refresh');
    const result = produce(state, draft => {
      runOne(draft, {
        id: 'bound-remove-accepted-one-card-refresh-entry',
        source: { player: 'self', cardId: 'PRIVATE-SOURCE', uid: 'private-source', abilityId: 'a1', area: 'scene' },
        triggeredBy: { hook: 'manual' },
        triggeredAt: { turn: 1, phase: 'main', nano: 1 },
        effect: { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
        state: 'pending',
      } satisfies EffectStackEntry);
    });
    const graph = validateCausalLog(result.log);
    expect(graph).toContainEqual(expect.objectContaining({
      tags: ['refresh'],
      source: expect.objectContaining({ kind: 'zone', side: 'self', zone: 'remove' }),
      targets: [expect.objectContaining({ kind: 'zone', side: 'self', zone: 'deck' })],
      outcome: { type: 'move', from: 'remove', to: 'deck', count: 1 },
    }));
  });
});

// ---------------------------------------------------------------------------
// X7: mill refresh guard (BUG-137)
// ---------------------------------------------------------------------------

describe('X7: mill — デッキ枯渇時の refresh guard (BUG-137)', () => {
  it('デッキ < n: 可能な限りリムーブ → refresh → 残りは追加リムーブしない (rules/26)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'], remove: ['C'] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'mill', { player: 'self', n: 4 }, makeCtx());
    });
    // A,B リムーブ → デッキ0 → refresh: remove (A,B,C) シャッフルしてデッキへ、相手証拠+1
    expect(result.players.self.deck).toHaveLength(3);
    expect(result.players.self.remove).toEqual([]);
    expect(result.players.opp.evidence).toHaveLength(1);
    // refresh 後に残り 2 枚を追加でリムーブしない (デッキ 3 枚のまま)
    expect(result.gameResult).toBeUndefined();
  });

  it('デッキちょうど n 枚 → リムーブ後 0 で refresh (rules/14 即座)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'], remove: [] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'mill', { player: 'self', n: 2 }, makeCtx());
    });
    expect(result.players.self.deck).toHaveLength(2); // A,B が refresh でデッキへ戻る
    expect(result.players.self.remove).toEqual([]);
    expect(result.players.opp.evidence).toHaveLength(1);
  });

  it('refresh 不能 (リムーブ 0 枚) → 敗北 (rules/14)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [], remove: [] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'mill', { player: 'self', n: 2 }, makeCtx());
    });
    expect(result.gameResult?.winner).toBe('opp');
  });

  it('回帰: デッキ十分なら refresh しない', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'mill', { player: 'self', n: 2 }, makeCtx());
    });
    expect(result.players.self.deck).toEqual(['C']);
    expect(result.players.self.remove).toEqual(['A', 'B']);
    expect(result.players.opp.evidence).toHaveLength(0);
  });
});
