// gate5 RUNTIME behavior — B01052 工藤優作 (character, 白/L7 AP5000 LP2 小説家)
//
// 公式テキスト:
//   このキャラはスリープ状態で登場する。
//   【登場時】自分のデッキのカードを上から1枚公開する。
//     公開したカードがレベル6以下のキャラの場合、登場させる。
//     公開したカードがそれ以外の場合、手札に加える。
//
// rules: 03-field-areas.md (スリープ状態) / 06-card-types.md (キャラ登場=名乗り) /
//        12-next-hint.md・20-color-and-switch.md (手札の使用の色/FILE制限) /
//        14-refresh.md・26-qa-deck-refresh.md (公開中はデッキ扱い) /
//        15-abilities-effects.md (「〜場合」=条件分岐) / 17-icons.md (【登場時】)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard(self, 'B01052') で B01052 を手札 → 現場に登場させ、enter hook を emit する
//   (= 公式の「手札の使用」経路。enter-sleep-self-batch.test.ts と同じ機構)。
//   triggered listener が selfOnly 'enter' を a1 / a2 両方に dispatch し、runAllUntilEmpty で解決。
//   a2 の deckRevealUntil は chooseMatch なし = forced reveal (tier-1, pick は surface しない)
//   ため、検証は runAllUntilEmpty 後の **盤面 state** で行う (pickQueue ではない)。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない):
//   (a1)    sceneSetState{uid:'$self', state:'sleep'} を engine が実評価 — B01052 自身が
//           sleep 状態で現場に登場する (active で登場しない)。
//   (a2-i)  deckRevealUntil filter{kind:character, levelMax:6} に **合致**する top deck カード
//           (level5 character) → sceneEnter で現場へ登場 (handAddFromDeck else は不発、相互排他)。
//   (a2-ii) DECOY (levelMax:6 違反): top deck = level7 の character → 「それ以外」= 手札へ。
//           現場には出ない (levelMax フィルタを engine が実評価している証拠 — targetFilterToPredicate
//           atom-handlers.ts:90-92 `(d.level??Infinity)>levelMax`)。
//   (a2-iii)DECOY (kind:character 違反): top deck = EVENT → 「それ以外」= 手札へ。現場には出ない
//           (kind フィルタを engine が実評価している証拠 — BUG-118 `d.kind!==filter.kind`)。
//   (a2-edge) デッキ0枚: 公開0枚 → $matched/$revealed 共に空 → 両 conditional skip
//           (何も登場せず何も手札に加わらない、rules/26 reveal-what-available)。
//
// N/A 明示 (このカードに無い mandate):
//   - 「〜枚まで」0-pick / pick surface: a2 は chooseMatch なし forced reveal なので player pick が
//     surface しない (tier-1)。0-pick channel は存在しない。
//   - 【ターンN】/ turn:opp / selfOnly-gate-negative / declared cost: a1/a2 とも selfOnly enter で
//     回数制限・ターン条件・宣言コストを持たない (spec 上 limit/condition なし)。
//   - scope:'turn' modifier: 本カードに持続修正効果は無い。
//   ※ selfOnly の負ケースは「他キャラが登場しても B01052 の a2 は発火しない」で a2-iii の延長として
//     盤面で担保される (B01052 自身の enter でのみ deck reveal が起きる)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { B01052 } from '@/cards/ct-p01/B01052';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 合成 def 群 (id prefix DEC_B01052_ で衝突回避)。abilities 空 = 登場しても再帰トリガー無し。
const FB = { type: 'card-back' as const, cardId: 'FB' };

// a2 top-deck 候補/decoy
const C_LV5 = 'DEC_B01052_CLV5';   // level5 character → filter 合致 (登場)
const C_LV7 = 'DEC_B01052_CLV7';   // level7 character → DECOY (levelMax:6 違反 → 手札)
const E_LV3 = 'DEC_B01052_ELV3';   // event level3 → DECOY (kind:character 違反 → 手札)

function charDef(id: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function eventDef(id: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'],
    level, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

function registerDecoys(): void {
  registerCardDef(charDef(C_LV5, 5));
  registerCardDef(charDef(C_LV7, 7));
  registerCardDef(eventDef(E_LV3, 3));
}

// 手札の使用 (handUseCard) で B01052 を登場させられる base state。
// 白事件 (rules/20 色制限) + FILE7 (rules/12 level7 使用可)。deck は呼出側が組む。
function baseForHandUse(deck: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B01052'];
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
  s.players.self.file = Array.from({ length: 7 }, () => ({ ...FB })); // FILE7 ≥ level7
  s.players.self.deck = deck;
  return s;
}

describe('B01052 工藤優作 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ===== a1: 自己スリープ登場 =====
  it('a1: handUseCard で B01052 が現場に登場し、a1 で sleep 状態になる (active で登場しない)', () => {
    let s = baseForHandUse(['d1', 'd2']); // deck top は a2 で公開されるが abilities 空なので無害
    registerCardDef(charDef('d1', 5)); // top=level5 char (a2 で登場するが a1 検証には無関係)
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    const me = s.players.self.scene.find((c) => c.cardId === 'B01052');
    expect(me, 'B01052 が現場に登場').toBeTruthy();
    expect(me?.state, 'a1: sleep 状態で登場 (active ではない)').toBe('sleep');
    expect(s.players.self.hand, '手札から消費').not.toContain('B01052');
  });

  // ===== a2-i: top=level5 character → 登場 (match 枝) =====
  it('a2-i (match枝): top deck が level6以下キャラ (level5) → 現場に登場する / 手札には加わらない', () => {
    let s = baseForHandUse([C_LV5, 'x1', 'x2']); // top = C_LV5 (level5 char)
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some((c) => c.cardId === C_LV5), 'level5 char は現場へ登場 (match枝)').toBe(true);
    expect(s.players.self.deck, 'C_LV5 はデッキから抜けた').not.toContain(C_LV5);
    expect(s.players.self.hand, 'else枝 (手札追加) は発動しない — 相互排他').not.toContain(C_LV5);
  });

  // ===== a2-ii: DECOY level7 character (levelMax:6 違反) → 手札 (else 枝) =====
  it('a2-ii (DECOY levelMax): top deck が level7 キャラ → 「それ以外」で手札へ / 現場には出ない', () => {
    let s = baseForHandUse([C_LV7, 'x1', 'x2']); // top = C_LV7 (level7 char = filter 違反)
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    // levelMax:6 を engine が実評価 → level7 は match しない → sceneEnter 枝不発、handAddFromDeck 枝発動。
    expect(s.players.self.scene.some((c) => c.cardId === C_LV7), 'level7 DECOY は現場に登場しない (levelMax:6 違反)').toBe(false);
    expect(s.players.self.hand, 'level7 DECOY は手札へ (それ以外の場合)').toContain(C_LV7);
    expect(s.players.self.deck, 'C_LV7 はデッキから抜けた (公開→手札)').not.toContain(C_LV7);
  });

  // ===== a2-iii: DECOY event (kind:character 違反) → 手札 (else 枝) =====
  it('a2-iii (DECOY kind): top deck が EVENT → 「それ以外」で手札へ / 現場には出ない', () => {
    let s = baseForHandUse([E_LV3, 'x1', 'x2']); // top = E_LV3 (event level3 = kind 違反)
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    // kind:character を engine が実評価 (BUG-118) → event は match しない → 手札へ。
    expect(s.players.self.scene.some((c) => c.cardId === E_LV3), 'event DECOY は現場に登場しない (kind:character 違反)').toBe(false);
    expect(s.players.self.hand, 'event DECOY は手札へ (それ以外の場合)').toContain(E_LV3);
    expect(s.players.self.deck, 'E_LV3 はデッキから抜けた (公開→手札)').not.toContain(E_LV3);
  });

  // ===== a2-edge: デッキ0枚 → 何も起きない (両 conditional skip) =====
  it('a2-edge (デッキ0枚): 公開0枚 → 登場も手札追加も起きない (両 conditional skip)', () => {
    let s = baseForHandUse([]); // deck 空
    const handBefore = [...s.players.self.hand].filter((c) => c !== 'B01052');
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    // B01052 自身は登場済み (sleep)。それ以外に scene へ何も追加されない。
    const others = s.players.self.scene.filter((c) => c.cardId !== 'B01052');
    expect(others.length, 'B01052 以外は現場に登場しない (公開0枚)').toBe(0);
    // 手札は B01052 を除いて不変 (空デッキで何も加わらない)。
    expect(s.players.self.hand, '手札に新規追加なし').toEqual(handBefore);
    expect(s.players.self.deck.length, 'デッキ0枚のまま').toBe(0);
  });

  // ===== a2 が forced reveal (tier-1) — pick は surface しない =====
  it('a2: forced reveal — player pick (pickQueue) は surface しない', () => {
    setHuman('self'); // human でも pick が出ないことを確認
    let s = baseForHandUse([C_LV5, 'x1']);
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01052');
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, 'deckRevealUntil は chooseMatch 無し forced reveal → pick 無し').toBe(0);
    // 結果は盤面で確定済み (C_LV5 が登場)。
    expect(s.players.self.scene.some((c) => c.cardId === C_LV5), 'forced: level5 char は登場').toBe(true);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered enter(selfOnly) sceneSetState self->sleep, a2=triggered enter(selfOnly) sequence(deckRevealUntil->2 conditional)', () => {
    const [a1, a2] = B01052.abilities;
    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } });
    // a2
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a2.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps).toHaveLength(3);
    // step1: deckRevealUntil filter{kind:character, levelMax:6}, maxN:1
    expect(eff.steps[0]).toMatchObject({
      kind: 'atom',
      verb: 'deckRevealUntil',
      args: { player: 'self', filter: { kind: 'character', levelMax: 6 }, maxN: 1, bind: '$revealed', bindMatch: '$matched' },
    });
    // step2: match → sceneEnter from deck
    expect(eff.steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
    });
    // step3: else → handAddFromDeck
    expect(eff.steps[2]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$revealed', presence: 'matched' },
      then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$revealed.cardId' } },
    });
  });
});
