// gate5 RUNTIME behavior — B01076 「開けるんだキャメル…」 (event, 赤, Lv6)
//
// 公式テキスト:
//   自分のリムーブエリアにあるレベル6以下の【赤】のキャラを1枚まで選び、登場させる。
//
// rules:
//   03-field-areas.md (現場 / 状態 / 効果による登場 = 名乗り状態・active),
//   15-abilities-effects.md (「〜まで」=0枚可 / 単一 atom = 後続 chain なし),
//   17-icons.md (イベント = 使用したとき効果本文が発動),
//   20-color-and-switch.md (手札の使用は事件の色制限 / 効果による登場 = 色制限なし).
//
// 実 engine flow で駆動 (verb を直接呼ばない、B03025 / B02038 と同一ハーネス):
//   handUseCard('self','B01076') で B01076 を「手札の使用」→ hand-use-card.ts が
//   emit 'effect:declared' {kind:'event-use', cardId:'B01076'} →
//   triggered listener が a1 (scope:'on-hand', hook:'effect:declared', selfOnly,
//   matcher kind==='event-use') を発火 → atom sceneEnter {from:'remove', max:1, viaEffect:true,
//   filter:{color:'赤', levelMax:6, kind:'character'}} の remove-area pick を
//   runAllUntilEmpty + drainAiEffectPicks(AI auto-take) で解決。
//   (B03025 = event-use 駆動の exemplar、B02038 = from:'remove' decoy 構造の exemplar。)
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない、実機で踏む):
//   (A) sceneEnter.filter {color:'赤', levelMax:6, kind:'character'} を engine が **実評価** するか。
//       remove に有効候補(赤/L6/char) + 3 decoy を仕込み、有効のみが登場・decoy は remove 残留。
//       DECOY: 色違い(青L6char) / levelMax超(赤L7char) / kind違い(赤L6event)。各 decoy はちょうど
//       1 filter のみを破る (filter が「無視」されればどれかが登場し、各 assertion が落ちる)。
//   (B) 効果による登場 = 名乗り(named) かつ active 状態 (enterSleep 無し → スリープではない、rules/03)。
//   (C) NEGATIVE (0枚): 「1枚まで」(rules/15) = 0枚可。remove に有効候補が無い (decoy のみ) →
//       何も登場しない。本テキストは単一 atom (後続 chain '〜する/そうした場合' なし) のため
//       0枚解決は silent no-op が公式通り (BUG-111 の trailing-step トラップは該当せず)。
//   (D) NEGATIVE (selfOnly): 別イベント(OTHER_EVENT)を使用しても B01076 の a1 は発火しない
//       (on-hand selfOnly は payload.cardId === 'B01076' を要求 — triggered.ts selfOnlyMatches)。
//
// concern: 無し (全 assertion は公式テキストの mandate を grounded engine 挙動で確認)。

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
import { B01076 } from '@/cards/ct-p01/B01076';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

// ---- synthetic decoy defs (prefix DEC_B01076_ で id 衝突回避。abilities:[] で再帰トリガー無し) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 6, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// remove 側候補/decoy — それぞれちょうど 1 つの filter を破る
const R_HIT = 'DEC_B01076_REMOVE_HIT';     // 赤 L6 character = 唯一の有効 sceneEnter 候補
const R_COLOR = 'DEC_B01076_REMOVE_COLOR'; // 青 L6 character → color:赤 違反で非対象
const R_LV7 = 'DEC_B01076_REMOVE_LV7';     // 赤 L7 character → levelMax:6 超で非対象
const R_EVENT = 'DEC_B01076_REMOVE_EVENT'; // 赤 L6 event     → kind:character 違反で非対象
// selfOnly 反証用の別イベント (能力なし) — 使用しても B01076 の a1 は発火しない
const OTHER_EVENT = 'DEC_B01076_OTHER_EVENT';

function registerDecoys(): void {
  registerCardDef(ch(R_HIT, { colors: ['赤'], level: 6 }));
  registerCardDef(ch(R_COLOR, { colors: ['青'], level: 6 }));
  registerCardDef(ch(R_LV7, { colors: ['赤'], level: 7 }));
  registerCardDef(ch(R_EVENT, { kind: 'event', colors: ['赤'], level: 6 }));
  registerCardDef(ch(OTHER_EVENT, { kind: 'event', colors: ['赤'], level: 1 }));
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

/**
 * 実 engine flow: B01076 を「手札の使用」→ effect:declared(event-use) trigger →
 *   sceneEnter(from:remove) pick を AI(auto-take) で解決。
 * 事件赤 (rules/20: handUseCard 自体は事件の色制限を受ける) + FILE6 (≥ level6) を仕込む。
 */
function fire(build: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B01076'];
  s.players.self.case.colors = ['赤']; // B01076 = 赤 (色制限 rules/20)
  s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 ≥ level6 → 手札使用可
  build(s);
  s = produce(s, (d) => {
    handUseCard(d, 'self', 'B01076');
    // from:'remove' sceneEnter 短縮形 pick を AI auto-take で解決するまで進める
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    }
  });
  return s;
}

describe('B01076 「開けるんだキャメル…」 — gate5 runtime behavior', () => {
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

  // ===== A + DECOY: remove の 赤/L6/char のみ登場、3 decoy は非対象 (filter 実評価) =====
  it('A + DECOY: イベント使用で remove の 赤L6キャラ(R_HIT)を登場 / 青(色違い)・L7(超)・event(種別)decoy は登場しない', () => {
    const s = fire((st) => {
      // remove: 有効1 (R_HIT 赤L6char) + decoy3 (色違い青 / Lv7超 / event)
      st.players.self.remove = [R_HIT, R_COLOR, R_LV7, R_EVENT];
    });

    // 前提: B01076 はイベント = 使用済 (手札から消費 → リムーブエリアへ、rules/06)。
    expect(s.players.self.hand.includes('B01076'), 'B01076 (イベント) は使用済で手札に残らない').toBe(false);
    expect(inRemove(s, 'B01076'), 'B01076 (使い切りイベント) はリムーブエリアへ (rules/06)').toBe(true);

    // (THEN) 有効候補 R_HIT が現場登場、remove から抜ける
    const entered = s.players.self.scene.find((c) => c.cardId === R_HIT);
    expect(entered, '赤L6キャラ (R_HIT) が現場に登場').toBeTruthy();
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブから抜けた').toBe(false);

    // DECOY 主張 (color/levelMax/kind filter 実評価の証明):
    expect(inScene(s, R_COLOR), '青L6 decoy は登場しない (color:赤 違反)').toBe(false);
    expect(inRemove(s, R_COLOR), '青L6 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_LV7), '赤L7 decoy は登場しない (levelMax:6 超)').toBe(false);
    expect(inRemove(s, R_LV7), '赤L7 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_EVENT), '赤L6 event decoy は登場しない (kind:character 違反)').toBe(false);
    expect(inRemove(s, R_EVENT), 'event decoy はリムーブに残る').toBe(true);

    // 現場登場は R_HIT のちょうど 1 体 (max:1)
    expect(s.players.self.scene.length, '現場 = R_HIT の 1 体のみ').toBe(1);
    // remove = 非該当 3 decoy (R_HIT だけ抜けた) + 使用済 B01076 = 4 枚
    expect(s.players.self.remove.length, 'remove = 非該当 3 decoy + 使用済 B01076 = 4 枚').toBe(4);
  });

  // ===== B: 効果による登場 = 名乗り(named) かつ active 状態 (enterSleep 無し → スリープではない) =====
  it('B: 蘇生したキャラは active かつ 名乗り(named)状態で登場する (enterSleep 無し / rules/03 効果登場)', () => {
    const s = fire((st) => {
      st.players.self.remove = [R_HIT, R_COLOR]; // 有効1 + 色違い decoy
    });

    const entered = s.players.self.scene.find((c) => c.cardId === R_HIT);
    expect(entered, 'R_HIT が登場').toBeTruthy();
    // enterSleep 無し → active 状態 (スリープで登場しない)
    expect(entered?.state, 'active 状態で登場 (スリープではない)').toBe('active');
    // 効果による登場 = 名乗り状態 (rules/03 / 06 同ターン登場)
    expect(entered?.isNamed, '名乗り状態 (効果登場、同ターン推理/アクション不可)').toBe(true);
  });

  // ===== C: NEGATIVE (0枚) — remove に有効候補無し → 何も登場しない (「〜まで」=0枚可、後続 chain 無し) =====
  it('C NEGATIVE (候補無): remove に 赤/L6以下/char が無い (decoy のみ) → 何も登場しない (「〜まで」=0枚可)', () => {
    const s = fire((st) => {
      st.players.self.remove = [R_COLOR, R_LV7, R_EVENT]; // すべて非該当 → 候補 0
    });

    expect(inScene(s, R_COLOR), '青L6 は登場しない').toBe(false);
    expect(inScene(s, R_LV7), '赤L7 は登場しない').toBe(false);
    expect(inScene(s, R_EVENT), '赤L6 event は登場しない').toBe(false);
    // 候補0 で no-op → 現場は空 (単一 atom = 後続 mandatory step 無し → 0枚でも他の効果は無い)
    expect(s.players.self.scene.length, '現場登場 0 (候補0 で silent no-op)').toBe(0);
    // remove = 3 decoy はすべて残る + 使用済 B01076 = 4 枚 (decoy は 1 枚も登場/消費されない)
    expect(s.players.self.remove.length, 'remove = 3 decoy + 使用済 B01076 = 4 枚').toBe(4);
    expect(inRemove(s, 'B01076'), 'B01076 (使い切りイベント) はリムーブエリアへ').toBe(true);
    expect(inRemove(s, R_COLOR), '青L6 decoy はリムーブに残る').toBe(true);
    expect(inRemove(s, R_LV7), '赤L7 decoy はリムーブに残る').toBe(true);
    expect(inRemove(s, R_EVENT), 'event decoy はリムーブに残る').toBe(true);
  });

  // ===== D: NEGATIVE (selfOnly) — 別イベントの使用では B01076 の a1 は発火しない =====
  it('D NEGATIVE (selfOnly): 別イベント(OTHER_EVENT)を使用しても B01076 の a1 は発火せず remove から登場しない', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = [OTHER_EVENT];
    s.players.self.case.colors = ['赤']; // OTHER_EVENT=赤L1 → 色/level gate 通過
    s.players.self.file = [FB, FB]; // FILE2 ≥ level1
    s.players.self.remove = [R_HIT]; // 有効候補は居るが B01076 の a1 が発火しなければ登場しない

    s = produce(s, (d) => {
      handUseCard(d, 'self', OTHER_EVENT);
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        drainAiEffectPicks(d, new HeuristicPolicy());
      }
    });

    // selfOnly: payload.cardId = OTHER_EVENT ≠ B01076 → a1 不発
    expect(inScene(s, R_HIT), 'selfOnly: 別イベント使用では a1 不発 → R_HIT は登場しない').toBe(false);
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブに残る (a1 未発火)').toBe(true);
    expect(s.players.self.scene.length, '現場登場 0 (a1 未発火)').toBe(0);
  });

  // ===== descriptor 構造 sanity (GOLD 同形 matchObject) =====
  it('descriptor: a1 = triggered on-hand effect:declared(event-use,selfOnly) sceneEnter from:remove max1 viaEffect filter{赤,L6,char}', () => {
    const [a1] = B01076.abilities;
    expect(B01076.kind, 'B01076 は event').toBe('event');
    expect(B01076.abilities.length, 'ability は a1 の 1 つのみ').toBe(1);

    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.scope, 'a1 on-hand').toBe('on-hand');
    expect(a1.trigger, 'a1 effect:declared selfOnly').toMatchObject({ hook: 'effect:declared', selfOnly: true });
    // event-use matcher は closure のため shape のみ確認 (matcher の実発火は上記 A〜D で grounded)
    expect(typeof (a1.trigger as { matcher?: unknown }).matcher, 'a1 trigger に event-use matcher closure').toBe('function');

    expect(a1.effect, 'a1 sceneEnter from:remove max1 viaEffect filter{赤,L6,char}').toMatchObject({
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        max: 1,
        viaEffect: true,
        filter: { color: '赤', levelMax: 6, kind: 'character' },
      },
    });
    // enterSleep を持たない (= active 登場) ことを明示確認 (B 検証の descriptor 裏付け)
    expect((a1.effect as { args?: { enterSleep?: unknown } }).args?.enterSleep, 'enterSleep 無し (active 登場)').toBeUndefined();
  });
});
