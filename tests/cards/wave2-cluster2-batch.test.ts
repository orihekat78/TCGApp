// engine拡張 wave#2 cluster2 — ability-presence filter 解禁 10枚の実 flow 検証 (decoy 付き)
// 対象: B03131 / B03128 / B08005(+P) / B08016 / B08094(+P) / B09104 / B09073(+P)
// novel 部分 = filter.keyword '現場リムーブ時'/'疾風'/'カットイン' の各 area 経路 +
//   boundToRemove (X6) + 相手ターン中 trigger の human 経路 (X8)
// rules: 13/17 (キーワード/アイコン・印字静的判定), 14/26 (リフレッシュ), 15 (まで=0可/してもよい), 21 (宣言コスト)
// spec: .claude/specs/engine-wave2-ability-filter-design.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { pay } from '@/engine/cost/pay';
import {
  drainAiEffectPicks,
  _drainAllEffectPicksForTest,
  applyOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import type { GameState, CardDef, AbilityDef, EffectCtx, Cost } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };
const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// ---- synthetic decoys (正準形状の印字能力を持つ/持たない) ----
const NOOP = { kind: 'atom', verb: 'noop', args: {} } as AbilityDef['effect'];
const abSceneRemove: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 条件アイコン付きでも「持つ」(印字静的判定)
  effect: NOOP, description: '【相手ターン中】【現場リムーブ時】(decoy)',
};
const abShippu: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: NOOP, description: '【疾風1】(decoy)',
};
const abCutin: AbilityDef = {
  id: 'c1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true },
  effect: NOOP, description: '【カットイン】(decoy)',
};
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: [id], colors: ['黒'], level: 4,
    ap: 4000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function registerDecoys(): void {
  engineCards.register(def('REM-B', { abilities: [abSceneRemove] }));               // 黒・現リム時持ちキャラ
  engineCards.register(def('REM-W', { colors: ['白'], abilities: [abSceneRemove] })); // 白・現リム時持ち (色 decoy)
  engineCards.register(def('PLAIN-B', {}));                                          // 黒・無能力 (keyword decoy)
  engineCards.register(def('CUTIN-B', { abilities: [abCutin] }));                    // 黒・カットイン持ちキャラ
  engineCards.register(def('CUTIN-W', { colors: ['白'], abilities: [abCutin] }));    // 白・カットイン持ち (色 decoy)
  engineCards.register(def('CUTIN-EVT-B', { kind: 'event', ap: undefined, lp: undefined, abilities: [abCutin] })); // 黒カットインイベント (「カード」filterで含む)
  engineCards.register(def('SHIPPU-8', { level: 8, abilities: [abShippu] }));        // 疾風持ち Lv8
  engineCards.register(def('SHIPPU-4', { level: 4, abilities: [abShippu] }));        // 疾風持ち Lv4
  engineCards.register(def('AP9000', { ap: 9000 }));                                 // AP decoy
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  registerAll();
  registerDecoys();
  registerTriggeredListener();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
});

describe('wave#2 cluster2 — ability-presence filter 解禁カード batch', () => {
  // ---- B03131 a1: 宣言【ターン1】 カットイン黒 scene pick → 突撃付与 ----
  it('B03131 a1: 【カットイン】黒のみ候補 (色/keyword decoy 除外)、突撃がターン付与される', () => {
    setHuman('self'); // pending を覗いて候補集合を decoy 検証する
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B03131', 'ram#1'),
      sceneChar('CUTIN-B', 'cb#1'),
      sceneChar('CUTIN-W', 'cw#1'),  // 色 decoy → 除外
      sceneChar('PLAIN-B', 'pb#1'),  // keyword decoy → 除外
    ];
    expect(canDeclaredAbility(s, 'ram#1', 'a1')).toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B03131', uid: 'ram#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'ram#1', 'a1', ctx);
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const cand = queue()[0]!.candidates.map((c) => c.uid).sort();
    expect(cand, 'カットイン+黒 のみ候補').toEqual(['cb#1']);
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    expect(readChar.keywords(s, 'cb#1'), '突撃 付与').toContain('突撃');
    expect(readChar.keywords(s, 'pb#1')).not.toContain('突撃');
  });

  // ---- B03128 a1: deck-look2 カットイン黒「カード」(イベント含む) ----
  it('B03128 a1: 窓2枚で黒カットインイベントが match (keyword decoy は素通り) → 手札へ、残りデッキ下', () => {
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.hand = ['B03128'];
    s.players.self.deck = ['PLAIN-B', 'CUTIN-EVT-B', 'AP9000']; // 窓2 = [PLAIN-B(decoy), CUTIN-EVT-B(match)]
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03128');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: 先頭 match 自動取得 (BUG-132 契約)
    });
    expect(s.players.self.hand, 'イベントも「カード」filter で取得').toContain('CUTIN-EVT-B');
    expect(s.players.self.deck, '残り (decoy) はデッキ下へ').toEqual(['AP9000', 'PLAIN-B']);
  });

  it('B03128 a1: 窓内に黒カットインが無ければ何も加えない (白カットイン=色 decoy)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.hand = ['B03128'];
    s.players.self.deck = ['CUTIN-W', 'PLAIN-B', 'CUTIN-EVT-B']; // 窓2 に match なし (CUTIN-EVT-B は3枚目=窓外)
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03128');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.deck, '窓2枚はデッキ下へ').toEqual(['CUTIN-EVT-B', 'CUTIN-W', 'PLAIN-B']);
  });

  // ---- B08016: a1 gate (事件青&黒+事件編) / a2 相手ターン中・現リム時 optional ----
  it('B08016 a1: 事件が青&黒でなければ発動しない (gate)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case.colors = ['青']; // 黒なし → caseColor and 不成立
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.hand = ['B08016'];
    s.players.self.deck = ['PLAIN-B', 'CUTIN-B', 'REM-B'];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B08016');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand, 'gate 不成立 → 窓が開かず手札変化なし').toEqual([]);
    expect(s.players.self.deck).toEqual(['PLAIN-B', 'CUTIN-B', 'REM-B']);
  });

  it('B08016 a2: 相手ターン中・現リム時 → 手札の現リム時持ちキャラのみ discard 候補 → draw2 (human 経路 X8)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B08016', 'wakita#1')];
    s.players.self.hand = ['REM-B', 'CUTIN-EVT-B', 'PLAIN-B']; // 現リム時持ちキャラは REM-B のみ
    s.players.self.deck = ['D08017', 'D08017', 'D08017'];
    s = produce(s, (d) => {
      runAtom(d, 'sceneRemove', { uid: 'wakita#1', cause: 'effect' }, { source: { player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide();
    expect(opt, 'optional が human に surface').not.toBeNull();
    expect(opt!.player).toBe('self');
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, true);
    });
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const cand = queue()[0]!.candidates.map((c) => c.cardId).sort();
    expect(cand, '現リム時持ちキャラのみ (イベント/無能力は除外)').toEqual(['REM-B']);
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    expect(s.players.self.remove).toContain('REM-B');
    expect(s.players.self.hand, 'REM-B discard 後 draw2').toEqual(['CUTIN-EVT-B', 'PLAIN-B', 'D08017', 'D08017']);
  });

  // ---- B08005 hirameki 相当: remove-area pick の 現リム時+黒+キャラ filter (matchOneFilter 経路) ----
  it('B08005 hirameki filter: リムーブエリア pick が 現リム時+黒+キャラ のみ候補化 (色/種別 decoy 除外)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.remove = ['REM-B', 'REM-W', 'PLAIN-B', 'CUTIN-EVT-B'];
    produce(s, (d) => {
      runAtom(d, 'handAddFromRemove',
        { player: 'self', max: 1, filter: { keyword: '現場リムーブ時', color: '黒', kind: 'character' } },
        { source: { cardId: 'B08005', player: 'self', area: 'evidence' }, bindings: {} } as EffectCtx);
    });
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const cand = queue()[0]!.candidates.map((c) => c.cardId);
    expect(cand, '黒+現リム時+キャラのみ').toEqual(['REM-B']);
  });

  // ---- B08094 a2: case 宣言 + 証拠2表向きコスト + 窓3 現リム時 filter ----
  it('B08094 a2: 灰原哀が現場に居るときのみ宣言可。コストで証拠2表向き → 窓3から現リム時キャラを手札へ', () => {
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case = { ...s.players.self.case, cardId: 'B08094', colors: ['青', '黒'], status: '解決編' };
    s.players.self.evidence = [
      { cardId: 'D08017', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
      { cardId: 'D08017', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    s.players.self.deck = ['PLAIN-B', 'REM-W', 'AP9000', 'D08017']; // 窓3 = [PLAIN-B, REM-W(現リム時・白), AP9000] — 白でも「現リム時を持つキャラ」に該当
    // 宣言可 gate: 灰原哀 不在 → false
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '灰原哀/シェリー不在 → 宣言不可').toBe(false);
    s.players.self.scene = [sceneChar('B08005', 'haibara#1')]; // B08005 names=['灰原哀']
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '灰原哀が現場 → 宣言可').toBe(true);
    const cost: Cost = { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } };
    s = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: 'B08094', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
        bindings: {},
        dyn: { costParams: { flipFaceUpEvidence: { indices: [0, 1] } } },
      };
      pay(d, cost, ctx);
      useDeclaredAbility(d, 'case:self', 'a2', ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.evidence.every((e) => e.faceUp), 'コスト: 証拠2枚表向き').toBe(true);
    expect(s.players.self.hand, '現リム時持ち (REM-W) を取得 — 条件アイコン付きでも印字判定').toContain('REM-W');
    expect(s.players.self.deck, '残り窓2枚はデッキ下 + 窓外1枚').toEqual(['D08017', 'PLAIN-B', 'AP9000']);
  });

  // ---- B09104 a1: either + excludeSelf + 現リム時 filter ----
  it('B09104 a1: 候補 = 両現場の現リム時持ち (自身は excludeSelf、無能力は filter 除外) → 突撃付与', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB];
    s.players.self.hand = ['B09104'];
    s.players.self.scene = [sceneChar('REM-B', 'mine#1'), sceneChar('PLAIN-B', 'plain#1')];
    s.players.opp.scene = [sceneChar('REM-W', 'theirs#1')];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B09104');
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const cand = queue()[0]!.candidates.map((c) => c.uid).sort();
    expect(cand, '両現場の現リム時持ちのみ (自身/無能力 除外)').toEqual(['mine#1', 'theirs#1']);
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const granted = ['mine#1', 'theirs#1'].filter((u) => readChar.keywords(s, u).includes('突撃'));
    expect(granted, '1枚に突撃付与').toHaveLength(1);
  });

  // ---- B09073 a1: 宣言可 cond = 自現場に疾風持ち / cost sleepSelf / AP8000以下 filter ----
  it('B09073 a1: 疾風持ちが自現場に居るときのみ宣言可 (相手現場では不可)、AP9000 は候補外', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B09073', 'hagi#1')];
    s.players.opp.scene = [sceneChar('SHIPPU-4', 'oppShippu#1'), sceneChar('AP9000', 'big#1')];
    expect(canDeclaredAbility(s, 'hagi#1', 'a1'), '疾風持ちは相手現場のみ → 宣言不可 (side:self)').toBe(false);
    s.players.self.scene = [sceneChar('B09073', 'hagi#1'), sceneChar('SHIPPU-8', 'myShippu#1')];
    expect(canDeclaredAbility(s, 'hagi#1', 'a1'), '自現場に疾風持ち → 宣言可').toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B09073', uid: 'hagi#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
      pay(d, { kind: 'sleepSelf' }, ctx);
      useDeclaredAbility(d, 'hagi#1', 'a1', ctx);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'hagi#1')?.state, 'コスト: 自身スリープ').toBe('sleep');
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    const cand = queue()[0]!.candidates.map((c) => c.uid);
    expect(cand, 'AP9000 (decoy) は候補外、AP8000以下のみ').not.toContain('big#1');
    expect(cand).toContain('oppShippu#1'); // AP4000 — side:'either' で相手現場も対象
  });

  // ---- B09073 a2: 窓3 疾風 filter → handAdd → boundToRemove → levelMin8 discard (AI 経路) ----
  it('B09073 a2: 疾風 Lv8 を取得 → 残りはリムーブエリアへ (デッキ下ではない) → Lv8 以上なので手札1リムーブ', () => {
    let s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B09073', 'hagi#1')];
    s.players.self.hand = ['D08017'];
    s.players.self.deck = ['PLAIN-B', 'SHIPPU-8', 'CUTIN-B', 'AP9000']; // 窓3 = [PLAIN-B, SHIPPU-8(match), CUTIN-B]
    s = produce(s, (d) => {
      runAtom(d, 'sceneRemove', { uid: 'hagi#1', cause: 'effect' }, { source: { player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: match 自動取得 + discard pick 解決
    });
    expect(s.players.self.hand, '疾風 Lv8 を手札に').toContain('SHIPPU-8');
    expect(s.players.self.hand, 'Lv8 以上を加えたので手札1枚リムーブ (D08017 が出る)').not.toContain('D08017');
    expect([...s.players.self.remove].sort(), '残り窓2枚 + 自身 + discard がリムーブエリア').toEqual(
      ['B09073', 'CUTIN-B', 'D08017', 'PLAIN-B'].sort(),
    );
    expect(s.players.self.deck, 'デッキは窓外のみ (残りはデッキ下に行かない)').toEqual(['AP9000']);
  });

  it('B09073 a2: 取得カードが Lv8 未満なら discard しない (boundMatchesFilter levelMin:8)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B09073', 'hagi#1')];
    s.players.self.hand = ['D08017'];
    s.players.self.deck = ['SHIPPU-4', 'PLAIN-B', 'CUTIN-B'];
    s = produce(s, (d) => {
      runAtom(d, 'sceneRemove', { uid: 'hagi#1', cause: 'effect' }, { source: { player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect([...s.players.self.hand].sort(), 'Lv4 取得 → discard なし').toEqual(['D08017', 'SHIPPU-4'].sort());
  });
});
