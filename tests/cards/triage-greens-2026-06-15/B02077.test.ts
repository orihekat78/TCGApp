// gate5 RUNTIME behavior — B02077 安室透 (character, 黄/探偵|喫茶ポアロ, L7 AP6000 LP1)
//
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外のレベル7以上の〚特徴［探偵］〛のキャラがいる場合、
//   自分のリムーブエリアにあるレベル5以下の〚特徴［探偵］〛のキャラを1枚まで選び、スリープ状態で登場させる。
//
// rules: 15-abilities-effects.md (「〜まで」=0枚可 / 条件成立時の効果は必須) /
//        17-icons.md (【登場時】 / 条件ゲート) / 03-field-areas.md (スリープ状態) /
//        20-color-and-switch.md (効果による登場=色制限なし)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('B02077') → mutate.scene.enter で現場登場 → 'enter' hook emit (uid=登場した B02077) →
//   triggered listener a1 発火 → conditional{ if: sceneHas(excludeSelf,探偵,levelMin7), then: sceneEnter(from:remove) }。
//   then の from:remove pick を runAllUntilEmpty + drainAiEffectPicks(AI auto-take) で解決。
//
// 検証する条件/filter (BUG-117/118 lesson — DSL に条件/filter を書いても engine が評価する保証はない):
//   (COND) conditional.if = sceneHas{ filter:{trait:探偵, levelMin:7, kind:character}, excludeSelf:true, nMin:1 }
//          → 自分の現場に「このキャラ以外の」L7+ 探偵が **居る場合のみ** then が発火。
//   (THEN) sceneEnter.filter = {trait:探偵, levelMax:5, kind:character} from:'remove', enterSleep:true
//          → リムーブの L5以下 探偵 キャラのみ **スリープ状態で** 登場。
//
// DECOY (filter/条件が実評価されている証明):
//   REMOVE 側 decoy:
//     D_TRAIT (警察 L5) — trait 違い → 登場しない。
//     D_LV6   (探偵 L6) — levelMax5 超 → 登場しない。
//     D_EVENT (探偵 L5 event) — kind 違い → 登場しない。
//   SCENE 条件 decoy:
//     §COND-EXCLUDESELF: 現場に B02077 自身しか居ない (L7探偵だが excludeSelf で除外) → 条件不成立 → 登場 0。
//     §COND-TRAIT: 現場の他キャラが L7 だが 警察 (探偵でない) → 条件不成立 → 登場 0。
//     §COND-LV6:   現場の他キャラが 探偵 だが L6 (levelMin7 未満) → 条件不成立 → 登場 0。
//   NEGATIVE: 上記 §COND-* は条件不成立で then 自体が走らない (remove hit はリムーブに残る)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar as baseScene } from '../../helpers/fixtures';
import { B02077 } from '@/cards/ct-p02/B02077';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };
const sceneChar = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

// ---- synthetic decoy defs (prefix DEC_B02077_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 5, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// remove 側
const R_HIT = 'DEC_B02077_REMOVE_HIT';        // 探偵 L5 character = 唯一の有効 then 候補
const R_TRAIT = 'DEC_B02077_REMOVE_TRAIT';     // 警察 L5 → trait 違いで非対象
const R_LV6 = 'DEC_B02077_REMOVE_LV6';         // 探偵 L6 → levelMax5 超で非対象
const R_EVENT = 'DEC_B02077_REMOVE_EVENT';     // 探偵 L5 event → kind 違いで非対象
// scene 条件 decoy
const C_DET_L7 = 'DEC_B02077_COND_DET_L7';     // 探偵 L7 → 条件成立 (B02077 以外の L7+探偵)
const C_POL_L7 = 'DEC_B02077_COND_POL_L7';     // 警察 L7 → trait 違いで条件不成立
const C_DET_L6 = 'DEC_B02077_COND_DET_L6';     // 探偵 L6 → levelMin7 未満で条件不成立

function registerDecoys(): void {
  registerCardDef(ch(R_HIT, { traits: ['探偵'], level: 5 }));
  registerCardDef(ch(R_TRAIT, { traits: ['警察'], level: 5 }));
  registerCardDef(ch(R_LV6, { traits: ['探偵'], level: 6 }));
  registerCardDef(ch(R_EVENT, { kind: 'event', traits: ['探偵'], level: 5 }));
  registerCardDef(ch(C_DET_L7, { traits: ['探偵'], level: 7 }));
  registerCardDef(ch(C_POL_L7, { traits: ['警察'], level: 7 }));
  registerCardDef(ch(C_DET_L6, { traits: ['探偵'], level: 6 }));
}

/** 実 engine flow: B02077 を手札から登場 → enter hook → a1 解決 + pick drain。 */
function fire(build: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B02077'];
  s.players.self.case.colors = ['黄']; // B02077=黄 (色制限 rules/20: handUseCard 自体は色制限を受ける)
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7 → 手札使用可
  build(s);
  s = produce(s, (d) => {
    handUseCard(d, 'self', 'B02077');
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    }
  });
  return s;
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

describe('B02077 安室透 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // AI 経路 (自動 take)
  });

  // ===== 正常系: 条件成立 → remove の探偵L5 をスリープ登場、非該当decoy は対象外 =====
  it('条件成立(現場にL7探偵あり) → remove の探偵L5(R_HIT)をスリープ登場 / 非該当remove decoy は登場しない', () => {
    const s = fire((st) => {
      // 現場: B02077 以外の L7 探偵 (C_DET_L7) → 条件成立。scene 4枚 + B02077 登場で 5枚 (上限内)。
      st.players.self.scene = [sceneChar(C_DET_L7, 'cond#1')];
      // remove: 有効1 (R_HIT 探偵L5) + decoy3 (trait違い/Lv6/event)
      st.players.self.remove = [R_HIT, R_TRAIT, R_LV6, R_EVENT];
    });

    // 前提: B02077 自身が登場している
    expect(inScene(s, 'B02077'), 'B02077 が現場に登場').toBe(true);

    // (THEN) 有効候補 R_HIT がスリープ状態で登場、remove から抜ける
    const entered = s.players.self.scene.find((c) => c.cardId === R_HIT);
    expect(entered, '探偵L5 (R_HIT) が現場に登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場 (enterSleep)').toBe('sleep');
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブから抜けた').toBe(false);

    // DECOY 主張 (filter 実評価の証明):
    expect(inScene(s, R_TRAIT), '警察L5 decoy は登場しない (trait違い)').toBe(false);
    expect(inRemove(s, R_TRAIT), '警察L5 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_LV6), '探偵L6 decoy は登場しない (levelMax5超)').toBe(false);
    expect(inRemove(s, R_LV6), '探偵L6 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_EVENT), '探偵L5 event decoy は登場しない (kind違い)').toBe(false);
    expect(inRemove(s, R_EVENT), 'event decoy はリムーブに残る').toBe(true);

    // 現場登場は B02077 + 条件decoy + R_HIT のちょうど 3 体 (R_HIT は 1 枚のみ = max:1)
    expect(s.players.self.scene.length, '現場 = B02077 + 条件decoy + R_HIT の 3 体').toBe(3);
  });

  // ===== NEGATIVE §COND-EXCLUDESELF: 現場が B02077 自身のみ (excludeSelf) → 条件不成立 =====
  it('NEGATIVE excludeSelf: 現場が B02077 自身(L7探偵)のみ → このキャラ以外が居ないので条件不成立、登場0', () => {
    const s = fire((st) => {
      // 現場に他キャラを置かない。B02077 自身は L7探偵 だが excludeSelf で条件から除外される。
      st.players.self.scene = [];
      st.players.self.remove = [R_HIT]; // 有効候補は居るが then が走らないので登場しない
    });

    expect(inScene(s, 'B02077'), 'B02077 は登場している').toBe(true);
    expect(inScene(s, R_HIT), 'excludeSelf で条件不成立 → R_HIT は登場しない').toBe(false);
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブに残る (then 未発火)').toBe(true);
    expect(s.players.self.scene.length, '現場は B02077 の 1 体のみ').toBe(1);
  });

  // ===== NEGATIVE §COND-TRAIT: 現場の他キャラが L7警察 (探偵でない) → 条件不成立 =====
  it('NEGATIVE trait: 現場の他キャラが L7警察 (探偵でない) → 条件不成立、remove の探偵L5 は登場しない', () => {
    const s = fire((st) => {
      st.players.self.scene = [sceneChar(C_POL_L7, 'pol#1')]; // 警察 L7 → trait 不一致
      st.players.self.remove = [R_HIT];
    });

    expect(inScene(s, R_HIT), 'trait不一致で条件不成立 → R_HIT は登場しない').toBe(false);
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブに残る').toBe(true);
    // 現場は B02077 + 警察decoy のみ (then 未発火)
    expect(s.players.self.scene.length, '現場 = B02077 + 警察decoy の 2 体').toBe(2);
  });

  // ===== NEGATIVE §COND-LV6: 現場の他キャラが 探偵L6 (levelMin7 未満) → 条件不成立 =====
  it('NEGATIVE levelMin: 現場の他キャラが 探偵L6 (L7未満) → 条件不成立、remove の探偵L5 は登場しない', () => {
    const s = fire((st) => {
      st.players.self.scene = [sceneChar(C_DET_L6, 'det6#1')]; // 探偵 L6 → levelMin7 未満
      st.players.self.remove = [R_HIT];
    });

    expect(inScene(s, R_HIT), 'levelMin7 未満で条件不成立 → R_HIT は登場しない').toBe(false);
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブに残る').toBe(true);
    expect(s.players.self.scene.length, '現場 = B02077 + 探偵L6decoy の 2 体').toBe(2);
  });

  // ===== NEGATIVE 「1枚まで」(0枚可): 条件成立だが remove に有効候補が無い → 登場0 (例外なし) =====
  it('NEGATIVE 候補無: 条件成立だが remove に探偵L5以下が無い → 何も登場しない (「〜まで」=0枚可)', () => {
    const s = fire((st) => {
      st.players.self.scene = [sceneChar(C_DET_L7, 'cond#1')]; // 条件成立
      st.players.self.remove = [R_TRAIT, R_LV6, R_EVENT]; // すべて非該当 → then 候補 0
    });

    expect(inScene(s, R_TRAIT), '警察L5 は登場しない').toBe(false);
    expect(inScene(s, R_LV6), '探偵L6 は登場しない').toBe(false);
    expect(inScene(s, R_EVENT), '探偵L5 event は登場しない').toBe(false);
    expect(s.players.self.remove.length, 'remove の3 decoy はすべて残る').toBe(3);
    // 現場は B02077 + 条件decoy の 2 体 (then は候補0で no-op)
    expect(s.players.self.scene.length, '現場 = B02077 + 条件decoy の 2 体').toBe(2);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = enter/selfOnly, conditional(sceneHas excludeSelf 探偵 levelMin7 → sceneEnter from:remove 探偵 levelMax5 enterSleep)', () => {
    const a1 = B02077.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a1.effect as {
      kind: string;
      if: { kind: string; query: { excludeSelf?: boolean; filter: Record<string, unknown> }; nMin: number };
      then: { verb: string; args: Record<string, unknown> };
    };
    expect(eff.kind).toBe('conditional');
    expect(eff.if.kind).toBe('sceneHas');
    expect(eff.if.query.excludeSelf).toBe(true);
    expect(eff.if.query.filter).toMatchObject({ trait: '探偵', levelMin: 7, kind: 'character' });
    expect(eff.if.nMin).toBe(1);
    expect(eff.then.verb).toBe('sceneEnter');
    expect(eff.then.args).toMatchObject({
      from: 'remove', max: 1, enterSleep: true, filter: { trait: '探偵', levelMax: 5, kind: 'character' },
    });
  });
});
