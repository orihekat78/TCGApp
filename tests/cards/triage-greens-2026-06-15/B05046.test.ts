// gate5 RUNTIME behavior — B05046 鈴木園子 (character, 白/高校生|鈴木財閥, L8 AP7000 LP1)
//
// 公式テキスト:
//   a1: 自分のターン終了時、自分の手札が4枚以下の場合、カードを1枚引く。
//   a2: 【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。
//   a3: 【宣言】〚手札から特徴［鈴木財閥］のキャラを1枚リムーブする〛：キャラを1枚まで選び、スリープさせる。
//
// rules: 05-turn-phases.md (エンドフェイズ = phase:end:start / ターン終了時能力) /
//        15-abilities-effects.md (「〜まで」=0枚可 / 解決時の状態参照 / 「〜の場合」条件) /
//        17-icons.md (【登場時】 / 「〜を持つ」印字判定) /
//        21-declared-ability-cost.md (【宣言】コストはすべて行う / 一部でも不可なら使用不可) /
//        03-field-areas.md (状態: active/sleep/stun, スタン→active特殊) /
//        24-qa-naming-stun.md (スタン状態の特殊挙動).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/条件 を書いても engine が実評価する保証はない):
//   a1: conditional(if handAtMost n:4 -> draw 1) の handAtMost を engine が **解決時に実評価** しているか。
//       eval.ts:115-118 handAtMost = state.players[p].hand.length <= cond.n。
//       → 手札4枚以下 → draw / 手札5枚以上 → draw しない (条件 unmet)。
//       かつ condition turn:self → 相手ターン終了では a1 発火しない。
//   a2: sceneRemove filter {levelMax:7} を engine が **実評価** しているか。
//       targetFilterToPredicate が filter.levelMax を honor。
//       → DECOY: level8 のキャラ (B05046 自身 + 合成 level8) は候補に出ない。level7以下のみ候補。
//   a3: (i) cost removeFromHand 候補 filter {trait:'鈴木財閥', kind:'character'} を candidates() が honor →
//          鈴木財閥キャラのみコスト払える (非該当 trait / event は cost.canPay=false)。
//       (ii) effect sceneSetState {state:'sleep', side:'either', n{0,1}} の side:either / 0枚可 を engine 実評価。
//
// decoy / negative:
//   a1-N1 (handAtMost unmet): 手札5枚 → ターン終了時でも draw しない (条件 unmet)。
//   a1-N2 (condition turn:self): 相手ターン終了 → a1 発火せず draw しない。
//   a2-D  (levelMax filter): level8 decoy は候補外・リムーブ不可。level7 のみリムーブ可。
//   a2-N  (0-pick): level7以下が居なければ何もリムーブされない (「1枚まで」=0枚可)。
//   a3-Dcost (cost trait/kind filter): 非鈴木財閥キャラ / 鈴木財閥イベント しか手札に無ければ cost.canPay=false。
//   a3-Deffect (sleep side:either): 相手キャラも sleep 対象になりうる (side:either)。
//   a3-N  (0-pick): sceneSetState を decline すれば誰も sleep にならない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import {
  drainAiEffectPicks,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B05046 } from '@/cards/ct-p05/B05046';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B05046_ で id 衝突回避) ----
// a2: level7以下キャラ (候補) / level8キャラ (DECOY: levelMax7 超で候補外)。
const LV7 = 'DEC_B05046_LV7';
const LV8 = 'DEC_B05046_LV8';
// a3 cost: 鈴木財閥キャラ (cost 払える) / 非鈴木財閥キャラ (trait decoy) / 鈴木財閥イベント (kind decoy)。
const SUZUKI_CHAR = 'DEC_B05046_SUZUKI_CHAR';
const NONSUZUKI_CHAR = 'DEC_B05046_NONSUZUKI_CHAR';
const SUZUKI_EVENT = 'DEC_B05046_SUZUKI_EVENT';
// a3 effect: sleep 対象 (自/相手現場)。
const TARGET_SELF = 'DEC_B05046_TARGET_SELF';
const TARGET_OPP = 'DEC_B05046_TARGET_OPP';
// filler (deck refresh 回避)。
const FILLER = 'DEC_B05046_FILLER';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'],
    level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(LV7, { level: 7 }));
  registerCardDef(ch(LV8, { level: 8 }));
  registerCardDef(ch(SUZUKI_CHAR, { traits: ['鈴木財閥'], level: 4 }));
  registerCardDef(ch(NONSUZUKI_CHAR, { traits: ['警察'], level: 4 }));
  registerCardDef(ev(SUZUKI_EVENT, { traits: ['鈴木財閥'] })); // 鈴木財閥 だが kind:event → cost候補外
  registerCardDef(ch(TARGET_SELF, { level: 3 }));
  registerCardDef(ch(TARGET_OPP, { level: 3 }));
  registerCardDef(ch(FILLER, { level: 1 }));
}

// 【登場時】(a2) 発火用 base: B05046 を手札から登場 (白/L8 → 事件白 + FILE8 で色/レベルゲート通過)。
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B05046'];
  s.players.self.case.colors = ['白'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB, FB]; // FILE8 ≥ level8 (rules/12)
  return s;
}

const inScene = (s: GameState, side: 'self' | 'opp', id: string) =>
  s.players[side].scene.some((c) => c.cardId === id);
const sceneState = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid)?.state;

describe('B05046 鈴木園子 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ============================================================
  // a1: 自分のターン終了時、手札4枚以下 → カードを1枚引く (handAtMost 実評価 + turn:self)
  // ============================================================
  it('a1: 自ターン終了時 手札4枚 (≤4) → 1ドロー (handAtMost 成立)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // B05046 を現場に (on-scene triggered ability の host)。手札ちょうど4枚。
    s.players.self.scene = [sceneChar('B05046', 'sonoko#1')];
    s.players.self.hand = ['D08017', 'D08017', 'D08017', 'D08017']; // 手札4枚 → handAtMost 4 成立
    s.players.self.deck = ['DEC_B05046_DRAWN', 'D08017', 'D08017'];
    registerCardDef(ch('DEC_B05046_DRAWN', { level: 1 }));

    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;
    s = produce(s, (d) => {
      endTurn(d, 'self');         // phase:end:start emit → a1 (turn:self) queue
      runAllUntilEmpty(d);        // conditional(handAtMost4) 解決時評価 → draw
    });

    expect(s.players.self.hand.length, '手札4枚以下 → 1ドロー (手札+1)').toBe(handBefore + 1);
    expect(s.players.self.deck.length, 'デッキ-1').toBe(deckBefore - 1);
    expect(s.players.self.hand.includes('DEC_B05046_DRAWN'), 'デッキトップを引いた').toBe(true);
  });

  it('a1 NEGATIVE (handAtMost unmet): 自ターン終了時 手札5枚 (>4) → ドローしない (条件 unmet)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05046', 'sonoko#1')];
    s.players.self.hand = ['D08017', 'D08017', 'D08017', 'D08017', 'D08017']; // 手札5枚 → handAtMost4 不成立
    s.players.self.deck = ['DEC_B05046_DRAWN', 'D08017', 'D08017'];
    registerCardDef(ch('DEC_B05046_DRAWN', { level: 1 }));

    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });

    // a1 は発火するが conditional の handAtMost が解決時 unmet → draw 実行されない (rules/15)
    expect(s.players.self.hand.length, '手札5枚 (>4) → ドローしない (手札不変)').toBe(handBefore);
    expect(s.players.self.deck.length, 'デッキ不変').toBe(deckBefore);
    expect(s.players.self.hand.includes('DEC_B05046_DRAWN'), 'デッキトップは引かれていない').toBe(false);
  });

  it('a1 NEGATIVE (condition turn:self): 相手ターン終了時 → a1 発火せず ドローしない', () => {
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05046', 'sonoko#1')];
    s.players.self.hand = ['D08017', 'D08017']; // 2枚 (handAtMost4 自体は成立する)
    s.players.self.deck = ['DEC_B05046_DRAWN', 'D08017', 'D08017'];
    registerCardDef(ch('DEC_B05046_DRAWN', { level: 1 }));

    const handBefore = s.players.self.hand.length;
    s = produce(s, (d) => {
      endTurn(d, 'opp');          // 相手ターン終了 → condition turn:self 不成立 → a1 不発
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand.length, '相手ターン終了 → a1 不発 (手札不変)').toBe(handBefore);
    expect(s.players.self.hand.includes('DEC_B05046_DRAWN'), '相手ターン終了ではドローしない').toBe(false);
  });

  // ============================================================
  // a2: 【登場時】レベル7以下のキャラを1枚まで選び、リムーブ (levelMax7 filter 実評価)
  // ============================================================
  it('a2 + DECOY: 登場で 相手の level7 をリムーブ可、level8 decoy は候補外 (levelMax7 実評価)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = enterBase();
    s.players.self.deck = [FILLER, FILLER]; // refresh 回避
    // 相手現場に level7 (候補) + level8 (DECOY: levelMax7 超)。side:'either'。
    s.players.opp.scene = [
      sceneChar(LV7, 'lv7#1', { state: 'sleep' }),
      sceneChar(LV8, 'lv8#1', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B05046'); // enter emit → a2 発火
      runAllUntilEmpty(d);              // human 経路: sceneRemove pick を surface
    });

    expect(inScene(s, 'self', 'B05046'), 'B05046 が登場').toBe(true);
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick が surface (= a2 発火)').toBe('sceneRemove');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId);
    // DECOY 主張: level8 (LV8 / B05046自身=L8) は候補外。level7以下のみ。
    expect(candCardIds, 'level8 decoy (LV8) は候補外').not.toContain(LV8);
    expect(candCardIds, 'level8 の B05046 自身も候補外').not.toContain('B05046');
    expect(candCardIds, 'level7 (LV7) は候補').toContain(LV7);

    // pick で level7 を選択 → リムーブされる
    const lv7Cand = pending!.candidates.find((c) => c.cardId === LV7)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, lv7Cand.uid);
    });
    expect(inScene(s, 'opp', LV7), 'level7 (LV7) はリムーブされた').toBe(false);
    expect(s.players.opp.remove.includes(LV7), 'LV7 は相手リムーブエリアへ').toBe(true);
    expect(inScene(s, 'opp', LV8), 'level8 decoy (LV8) は盤面に残る').toBe(true);
  });

  it('a2 NEGATIVE (0-pick): level7以下が居なければ誰もリムーブされない (「1枚まで」=0枚可)', () => {
    setHuman('self');
    let s = enterBase();
    s.players.self.deck = [FILLER, FILLER];
    // 相手現場に level8 のみ (候補不在)。B05046 自身も L8。
    s.players.opp.scene = [sceneChar(LV8, 'lv8#1', { state: 'sleep' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B05046');
      runAllUntilEmpty(d);
    });
    expect(inScene(s, 'self', 'B05046'), 'B05046 登場').toBe(true);
    // 候補 (level7以下) が一人も居ない場合、engine は sceneRemove の pick を surface しない
    // (probe で確認: pending=false)。level8 は levelMax7 filter で候補外。
    expect(pickQueue().length, 'level8 のみ → 候補0 → pick surface せず').toBe(0);
    expect(inScene(s, 'opp', LV8), 'level8 decoy はリムーブされない (候補外)').toBe(true);
    expect(s.players.opp.remove.includes(LV8), 'LV8 はリムーブエリアに移らない').toBe(false);
  });

  it('a2 (AI): 唯一の候補 level7 を自動リムーブ / level8 decoy は不変', () => {
    setHuman(null); // AI 経路 (自動 pick)
    let s = enterBase();
    s.players.self.deck = [FILLER, FILLER];
    s.players.opp.scene = [
      sceneChar(LV7, 'lv7#1', { state: 'sleep' }),
      sceneChar(LV8, 'lv8#1', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B05046');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(inScene(s, 'opp', LV7), 'AI: level7 はリムーブされた').toBe(false);
    expect(s.players.opp.remove.includes(LV7), 'LV7 は相手リムーブへ').toBe(true);
    expect(inScene(s, 'opp', LV8), 'AI: level8 decoy は不変 (levelMax7)').toBe(true);
  });

  // ============================================================
  // a3: 【宣言】〚手札から特徴［鈴木財閥］のキャラを1枚リムーブ〛：キャラを1枚まで選び、スリープ
  // ============================================================
  it('a3 cost DECOY: cost 候補 filter {trait:鈴木財閥, kind:character} 実評価 — 鈴木財閥キャラのみ payable', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05046', 'sonoko#1', { state: 'active' })];
    const a3 = B05046.abilities.find((a) => a.id === 'a3')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B05046', uid: 'sonoko#1', abilityId: 'a3', player: 'self', area: 'scene' },
      bindings: {},
    };

    // (i) 手札に鈴木財閥キャラ → cost payable
    const okHand = produce(s, (d) => { d.players.self.hand = [SUZUKI_CHAR]; });
    expect(engineCost.canPay(okHand, a3.cost!, ctx), '手札に鈴木財閥キャラ → cost 払える').toBe(true);

    // (ii) DECOY: 手札が非鈴木財閥キャラ (trait違い) のみ → cost.canPay=false
    const traitDecoy = produce(s, (d) => { d.players.self.hand = [NONSUZUKI_CHAR]; });
    expect(engineCost.canPay(traitDecoy, a3.cost!, ctx), '非鈴木財閥キャラ → cost 払えない (trait filter)').toBe(false);

    // (iii) DECOY: 手札が鈴木財閥イベント (kind違い) のみ → cost.canPay=false (kind:character)
    const kindDecoy = produce(s, (d) => { d.players.self.hand = [SUZUKI_EVENT]; });
    expect(engineCost.canPay(kindDecoy, a3.cost!, ctx), '鈴木財閥イベント → cost 払えない (kind:character filter)').toBe(false);

    // (iv) 手札 0 枚 → cost 払えない
    const empty = produce(s, (d) => { d.players.self.hand = []; });
    expect(engineCost.canPay(empty, a3.cost!, ctx), '手札0枚 → cost 払えない').toBe(false);
  });

  it('a3 + DECOY: 宣言で 鈴木財閥キャラを手札リムーブ → 相手キャラ(side:either)を sleep / 非鈴木財閥は手札に残る', () => {
    setHuman('self'); // pick を覗いて候補/効果を検証
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B05046', 'sonoko#1', { state: 'active' }),
      sceneChar(TARGET_SELF, 'tself#1', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(TARGET_OPP, 'topp#1', { state: 'active' })];
    // 手札: 鈴木財閥キャラ (cost 対象) + 非鈴木財閥キャラ (cost decoy: 残るべき)
    s.players.self.hand = [SUZUKI_CHAR, NONSUZUKI_CHAR];

    expect(canDeclaredAbility(s, 'sonoko#1', 'a3'), 'a3 宣言可').toBe(true);
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'sonoko#1', 'a3'); // cost removeFromHand pay (先頭 match=鈴木財閥キャラ) + effect queue
      runAllUntilEmpty(d);                          // sceneSetState(sleep) pick を surface
    });

    // ---- cost: 鈴木財閥キャラ (SUZUKI_CHAR) が手札からリムーブ。非鈴木財閥は残る ----
    expect(s.players.self.hand.includes(SUZUKI_CHAR), 'cost: 鈴木財閥キャラを手札リムーブ').toBe(false);
    expect(s.players.self.remove.includes(SUZUKI_CHAR), '鈴木財閥キャラはリムーブエリアへ').toBe(true);
    expect(s.players.self.hand.includes(NONSUZUKI_CHAR), 'DECOY: 非鈴木財閥キャラは手札に残る (cost対象外)').toBe(true);
    expect(s.players.self.hand.length, '手札-1 (cost で1枚リムーブ)').toBe(handBefore - 1);

    // ---- effect: sceneSetState(sleep) pick が surface。side:either → 自/相手両キャラが候補 ----
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneSetState pick が surface').toBe('sceneSetState');
    expect(pending?.nMin, '「1枚まで」=0枚可').toBe(0);
    const candKeys = pending!.candidates.map((c) => c.player + ':' + c.uid).sort();
    expect(candKeys, 'side:either → 自(sonoko/tself) + 相手(topp) が候補').toEqual(
      ['opp:topp#1', 'self:sonoko#1', 'self:tself#1'].sort(),
    );

    // 相手キャラ (topp#1) を sleep にする (side:either の positive)
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, 'topp#1');
    });
    expect(sceneState(s, 'topp#1'), '相手キャラを sleep 化 (side:either)').toBe('sleep');
    expect(sceneState(s, 'tself#1'), '未選択の自キャラは active のまま').toBe('active');
  });

  it('a3 NEGATIVE (0-pick): sceneSetState を decline すれば誰も sleep にならない (cost は支払済み)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B05046', 'sonoko#1', { state: 'active' }),
      sceneChar(TARGET_SELF, 'tself#1', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(TARGET_OPP, 'topp#1', { state: 'active' })];
    s.players.self.hand = [SUZUKI_CHAR];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'sonoko#1', 'a3');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」=0枚可)
    });
    // decline: 誰も sleep にならない
    expect(sceneState(s, 'topp#1'), 'decline: 相手キャラは active のまま').toBe('active');
    expect(sceneState(s, 'tself#1'), 'decline: 自キャラも active のまま').toBe('active');
    // cost は支払済み (rules/21: cost-first) → 鈴木財閥キャラは手札から消費されている
    expect(s.players.self.remove.includes(SUZUKI_CHAR), 'cost (鈴木財閥キャラリムーブ) は支払済み').toBe(true);
    expect(s.players.self.hand.includes(SUZUKI_CHAR), 'cost で手札から消費').toBe(false);
  });

  it('a3 effect: スタンのキャラを sleep 指定 → スタンのまま (rules/24 スタン特殊挙動)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05046', 'sonoko#1', { state: 'active' })];
    // スタン状態のキャラを sleep 対象にする (rules/03/24: スタンに sleep 効果 → スタンのまま)
    s.players.opp.scene = [sceneChar(TARGET_OPP, 'topp#1', { state: 'stun' })];
    s.players.self.hand = [SUZUKI_CHAR];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'sonoko#1', 'a3');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, 'topp#1');
    });
    // rules/24: スタン状態のキャラが「スリープさせる」効果を受けても状態はスタンのまま
    expect(sceneState(s, 'topp#1'), 'スタンのキャラに sleep 効果 → スタンのまま (rules/24)').toBe('stun');
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1=phase:end:start(turn:self) conditional(handAtMost4→draw1), a2=enter sceneRemove{levelMax7}, a3=declared removeFromHand{鈴木財閥,character}→sceneSetState{sleep,either,0-1}', () => {
    const [a1, a2, a3] = B05046.abilities;

    // a1
    expect(a1.trigger).toMatchObject({ hook: 'phase:end:start' });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.effect).toMatchObject({
      kind: 'conditional',
      if: { kind: 'handAtMost', player: 'self', n: 4 },
      then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });

    // a2
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a2.effect).toMatchObject({
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } },
    });

    // a3
    expect(a3.type).toBe('declared');
    expect(a3.cost).toMatchObject({
      kind: 'removeFromHand',
      target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: '鈴木財閥', kind: 'character' } }, n: { min: 1, max: 1 } },
      n: 1,
    });
    expect(a3.effect).toMatchObject({
      kind: 'atom', verb: 'sceneSetState',
      args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 } } },
    });
  });
});
