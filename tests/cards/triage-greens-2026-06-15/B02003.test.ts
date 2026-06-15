// gate5 RUNTIME behavior — B02003 工藤新一 (character, 青/探偵|高校生, Lv8 AP7000 LP2)
//
// 公式テキスト (recs/B02003.json):
//   【パートナー青】【登場時】レベル7以下のキャラを1枚まで選び、デッキの下に移す。
//   【宣言】【ターン1】〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時までLP＋1する。
//
// rules: 15-abilities-effects.md (「〜まで」=0枚可 / 「〜する」=必須) / 17-icons.md (【パートナー青】【ターン1】
//        条件アイコン=未達なら能力を持たない扱い) / 19-special-rules.md (cardName split-name 判定 / LP下限なし) /
//        21-declared-ability-cost.md (【宣言】コスト無し) / 24-qa-naming-stun.md (発動済みは回数カウント)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が実評価する保証はない):
//   a1 = enter trigger + condition{partnerColor 青} + sceneToDeck{side:either, max:1, filter:{levelMax:7}, pos:bottom}
//        → (1) partnerColor 青 が triggered.ts:228 evalCond で gate されているか (黄パートナーで不発火)
//        → (2) filter.levelMax:7 が candidates.ts:314 で実評価されているか (Lv8 decoy を候補から除外)
//        → (3) pos:'bottom' で対象キャラ所有者のデッキ下へ (mutate.scene.toDeck)
//   a2 = declared + limit{turn:1} + charModifyLP{delta:+1, max:1, side:either, filter:{cardName:毛利蘭}, scope:turn}
//        → (4) filter.cardName:毛利蘭 が candidates.ts:260 で実評価されているか (別名 decoy を候補から除外)
//        → (5) 毛利蘭 のみ lpMod_turn +1 / decoy は不変
//        → (6) 【ターン1】= 1回使用後 canDeclaredAbility=false (rules/17)
//
// decoy / negative (filter/condition が実評価されている証明):
//   a1 D1: Lv8 の自キャラ decoy (DEC_B02003_LV8) — levelMax:7 で候補外 → 移動されずデッキにも入らない。
//   a1 N1: パートナー黄 (非青) → condition 不成立 → pick が一切 surface せず何も移動しない。
//   a1 N2: 「〜まで」(rules/15) human decline (0-pick) → 候補が居ても何も移動しない。
//   a2 D1: 別名 (江戸川コナン) の自キャラ decoy — cardName:毛利蘭 で候補外 → LP 不変。
//   a2 N : 「〜まで」(rules/15) human decline (0-pick) → LP 不変だが 【ターン1】は発動済み扱いで再使用不可 (rules/24)。
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1: handUseCard('B02003') → enter emit → triggered listener queue → runAllUntilEmpty + drain
//   a2: useDeclaredAbility(uid,'a2') → effect:declared → runAllUntilEmpty + drain

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  drainAiEffectPicks,
  _drainAllEffectPicksForTest,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';
import { B02003 } from '@/cards/ct-p02/B02003';

const FB = { type: 'card-back' as const, cardId: 'D08017' };
const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// ---- synthetic decoy defs (prefix DEC_B02003_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// a1 候補: Lv7 = filter levelMax:7 を満たす唯一の有効候補 → デッキ下へ移るはず。
const A1_HIT_LV7 = 'DEC_B02003_A1_LV7';
// a1 decoy: Lv8 = levelMax:7 超 → 候補外 (移動されない)。
const A1_DECOY_LV8 = 'DEC_B02003_A1_LV8';

// a2 候補: カード名[毛利蘭] = filter cardName を満たす唯一の有効候補 → LP+1 されるはず。
const A2_HIT_RAN = 'DEC_B02003_A2_RAN';
// a2 decoy: 別名 (探偵) → cardName:毛利蘭 不一致 → 候補外 (LP不変)。
const A2_DECOY_OTHER = 'DEC_B02003_A2_OTHER';

function registerDecoys(): void {
  registerCardDef(ch(A1_HIT_LV7, { level: 7, names: [A1_HIT_LV7] }));
  registerCardDef(ch(A1_DECOY_LV8, { level: 8, names: [A1_DECOY_LV8] }));
  registerCardDef(ch(A2_HIT_RAN, { level: 4, names: ['毛利蘭'] }));        // カード名[毛利蘭]
  registerCardDef(ch(A2_DECOY_OTHER, { level: 4, names: ['江戸川コナン'] })); // 別名 decoy
}

describe('B02003 工藤新一 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null); // 既定: AI 経路 (自動 take)
  });

  // ============================================================
  // a1: 【パートナー青】【登場時】 sceneToDeck (levelMax7, 1枚まで, デッキ下)
  // ============================================================

  // base: 青パートナー (D08001=江戸川コナン青) を置き、case 青 + FILE8 で B02003(Lv8) を手札使用可能化。
  function a1Base(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'D08001'; // 青 → 【パートナー青】成立
    s.players.self.hand = ['B02003'];
    s.players.self.case.colors = ['青'];       // B02003=青 (色制限 rules/20)
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB, FB]; // FILE8 ≥ level8 → 手札使用可
    s.players.self.deck = ['D08017']; // refresh 回避 filler
    return s;
  }

  it('a1 + DECOY: 青パートナーで登場 → Lv7候補をデッキ下へ、Lv8 decoy は候補外で残留 (levelMax:7 実評価)', () => {
    setHuman('self'); // pending を覗いて候補集合を decoy 検証
    let s = a1Base();
    s.players.self.scene = [
      sceneChar(A1_HIT_LV7, 'hit#1'),    // Lv7 = 有効候補
      sceneChar(A1_DECOY_LV8, 'dec#1'),  // Lv8 = 候補外
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02003');
      runAllUntilEmpty(d);
    });

    // (2) DECOY 証明: pending 候補は Lv7 の hit#1 のみ (Lv8 decoy + Lv8 自身 B02003 は levelMax:7 で除外)
    expect(_peekPendingEffectPickQueueLength(), 'sceneToDeck pick が surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb, 'verb=sceneToDeck').toBe('sceneToDeck');
    expect(pending.nMin, '「〜まで」=0枚可').toBe(0);
    expect(pending.candidates.map((c) => c.uid).sort(), 'Lv7 のみ候補 (Lv8 decoy/自身は除外)').toEqual(['hit#1']);

    // resolve (human modal 代行)
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));

    // (3) Lv7 候補がデッキ下へ移動、Lv8 decoy は現場に残る
    expect(s.players.self.scene.some((c) => c.cardId === A1_HIT_LV7), 'Lv7 候補は現場から消えた').toBe(false);
    expect(s.players.self.scene.some((c) => c.cardId === A1_DECOY_LV8), 'Lv8 decoy は現場に残る').toBe(true);
    expect(s.players.self.deck[s.players.self.deck.length - 1], 'Lv7 候補が所有者デッキの一番下へ').toBe(A1_HIT_LV7);
    expect(s.players.self.deck.includes(A1_DECOY_LV8), 'Lv8 decoy はデッキに入らない').toBe(false);
    // B02003 自身は Lv8 → 自分は動かず現場に残る
    expect(s.players.self.scene.some((c) => c.cardId === 'B02003'), 'B02003 自身(Lv8)は現場に残る').toBe(true);
  });

  it('a1 N1: パートナー黄 (非青) → condition 不成立で pick が surface せず 何も移動しない', () => {
    setHuman('self');
    let s = a1Base();
    s.players.self.partner.cardId = 'D05001'; // 黄 (安室透) → 【パートナー青】不成立
    s.players.self.scene = [sceneChar(A1_HIT_LV7, 'hit#1')]; // Lv7 候補は居る

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02003');
      runAllUntilEmpty(d);
    });

    // (1) condition gate: 青でないので triggered listener が effect を queue しない → pick 0
    expect(_peekPendingEffectPickQueueLength(), '青パートナー不在 → pick 一切 surface せず').toBe(0);
    expect(s.players.self.scene.some((c) => c.cardId === A1_HIT_LV7), 'Lv7 候補は現場に残る (移動なし)').toBe(true);
    expect(s.players.self.deck.includes(A1_HIT_LV7), 'デッキにも入らない').toBe(false);
    expect(s.players.self.scene.some((c) => c.cardId === 'B02003'), 'B02003 自身は登場済').toBe(true);
  });

  it('a1 N2: 「〜まで」(rules/15) human decline (0-pick) → 候補があっても何も移動しない', () => {
    setHuman('self');
    let s = a1Base();
    s.players.self.scene = [sceneChar(A1_HIT_LV7, 'hit#1')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02003');
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚 decline 可').toBe(0);

    // decline (0枚)
    (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    expect(s.players.self.scene.some((c) => c.cardId === A1_HIT_LV7), 'decline: Lv7 候補は現場に残る').toBe(true);
    expect(s.players.self.deck.includes(A1_HIT_LV7), 'decline: デッキに入らない').toBe(false);
  });

  // ============================================================
  // a2: 【宣言】【ターン1】 charModifyLP +1 turn (cardName 毛利蘭, 1枚まで)
  // ============================================================

  function a2Base(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02003', 'shin#1'),         // 宣言能力の発動元
      sceneChar(A2_HIT_RAN, 'ran#1'),        // カード名[毛利蘭] = 有効候補
      sceneChar(A2_DECOY_OTHER, 'oth#1'),    // 別名 (江戸川コナン) = 候補外
    ];
    return s;
  }

  it('a2 + DECOY: 毛利蘭 のみ LP+1 / 別名 decoy は候補外で LP 不変 (cardName:毛利蘭 実評価)', () => {
    setHuman('self'); // pending を覗いて候補集合を decoy 検証
    let s = a2Base();

    const ranBefore = readChar.lp(s, 'ran#1');
    const othBefore = readChar.lp(s, 'oth#1');

    expect(canDeclaredAbility(s, 'shin#1', 'a2'), '宣言可能').toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B02003', uid: 'shin#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'shin#1', 'a2', ctx);
      runAllUntilEmpty(d);
    });

    // (4) DECOY 証明: 候補は cardName[毛利蘭]=ran#1 のみ (別名 oth#1 / 発動元 shin#1=工藤新一 は除外)
    expect(_peekPendingEffectPickQueueLength(), 'charModifyLP pick が surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb, 'verb=charModifyLP').toBe('charModifyLP');
    expect(pending.candidates.map((c) => c.uid).sort(), '毛利蘭 のみ候補 (別名 decoy 除外)').toEqual(['ran#1']);

    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));

    // (5) 毛利蘭 LP+1 / decoy 不変
    expect(readChar.lp(s, 'ran#1'), '毛利蘭 LP +1').toBe(ranBefore + 1);
    expect(readChar.lp(s, 'oth#1'), '別名 decoy は LP 不変').toBe(othBefore);
  });

  it('a2 (6): 【ターン1】 — 1回使用後は canDeclaredAbility=false (rules/17)', () => {
    let s = a2Base(); // AI 経路 (自動 take)

    expect(canDeclaredAbility(s, 'shin#1', 'a2'), '初回は使用可').toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B02003', uid: 'shin#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'shin#1', 'a2', ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    // AI 経路でも 毛利蘭 が LP+1 されている (候補唯一)
    expect(readChar.lp(s, 'ran#1'), 'AI 経路でも 毛利蘭 LP +1').toBe(2); // base LP1 + 1
    // 【ターン1】: 2 回目は不可
    expect(canDeclaredAbility(s, 'shin#1', 'a2'), '同ターン 2 回目は使用不可 (ターン1)').toBe(false);
  });

  it('a2 N: 「〜まで」decline (0-pick) → LP 不変だが 【ターン1】は発動済み扱いで再使用不可 (rules/24)', () => {
    setHuman('self');
    let s = a2Base();
    const ranBefore = readChar.lp(s, 'ran#1');

    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B02003', uid: 'shin#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'shin#1', 'a2', ctx);
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚 decline 可').toBe(0);

    // decline (0枚)
    (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    expect(readChar.lp(s, 'ran#1'), 'decline: 毛利蘭 LP 不変').toBe(ranBefore);
    // rules/24: 発動済みは内容が解決できなくても回数カウント → 再使用不可
    expect(canDeclaredAbility(s, 'shin#1', 'a2'), 'decline でも 【ターン1】消費済 → 再使用不可').toBe(false);
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1=enter+partnerColor青+sceneToDeck(levelMax7,bottom) / a2=declared+turn1+charModifyLP(毛利蘭,turn)', () => {
    const [a1, a2] = B02003.abilities;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '青' });
    expect((a1.effect as { verb: string; args: Record<string, unknown> }).verb).toBe('sceneToDeck');
    expect((a1.effect as { args: Record<string, unknown> }).args).toMatchObject({ side: 'either', max: 1, filter: { levelMax: 7 }, pos: 'bottom' });

    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect((a2.effect as { verb: string; args: Record<string, unknown> }).verb).toBe('charModifyLP');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({ delta: 1, max: 1, side: 'either', filter: { cardName: '毛利蘭' }, scope: 'turn' });
  });
});
