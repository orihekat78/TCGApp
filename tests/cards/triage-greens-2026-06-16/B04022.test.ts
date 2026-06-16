// gate5 RUNTIME behavior — B04022 光本兵我 (character, 緑/L3 AP2000 LP1, 特徴 アイドル)
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】手札からレベル4以下の〚カード名［服部平次］〛のキャラを
//   1枚までスリープ状態で登場させる。
//
// rules: 03-field-areas.md (登場/スリープ状態) / 15-abilities-effects.md (「〜まで」=0枚可) /
//        17-icons.md (【相手ターン中】=条件 / 【現場リムーブ時】=発動タイミング) /
//        19-special-rules.md (分割名 = 全分割カード名で対象認識) /
//        20-color-and-switch.md (効果による登場=色制限なし)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1 = triggered {condition:{turn:'opp'}, trigger:{hook:'leave:to-remove', selfOnly:true},
//        effect: sceneEnter{from:'hand', max:1, viaEffect:true, enterSleep:true,
//                 filter:{cardName:'服部平次', levelMax:4, kind:'character'}}}.
//   発火経路 (現場リムーブ時 / 相手ターン中):
//     turn.player='opp' + B04022 を self.scene に置く →
//     produce 内で mutate.scene.removeToRemove(d,'<B04022 uid>','effect') + runAllUntilEmpty(d) →
//     これで self.HAND に対する from-hand sceneEnter pick が surface する。setHuman('self') で pick を覗く。
//   (scratch 実走で確認済: queue[0].atomVerb='sceneEnter', candidate uid='<cardId>#<handIndex>', nMin=0)
//
// 検証する filter / 条件 (BUG-117/118 教訓: DSL に書いても engine が評価する保証はない):
//   (F-name)  filter.cardName:'服部平次' を engine が **実評価** — 服部平次以外のキャラは候補外。
//   (F-level) filter.levelMax:4 を engine が **実評価** — level5 の 服部平次 は候補外。
//   (F-kind)  filter.kind:'character' を engine が **実評価** — 服部平次 の event は候補外。
//   (F-split) rules/19 分割名 — names に '服部平次' を含む複合名キャラ (服部平次&遠山和葉) も候補に入る。
//   (positive) 有効候補を pick → enterSleep:true で **スリープ状態** で現場登場 + 手札から splice。
//   (N-turn)  【相手ターン中】 — 自分ターン中の leave:to-remove では a1 が発火しない (condition turn:opp gate)。
//   (N-self)  selfOnly:true — B04022 以外のキャラが現場リムーブされても B04022 a1 は発火しない。
//   (N-0pick) 「1枚まで」(rules/15) — human decline (0枚選択) → 誰も登場せず候補は手札に残る。
//   (struct)  descriptor 構造 sanity (matchObject)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B04022 } from '@/cards/ct-p04/B04022';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B04022_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

// 有効候補: 服部平次 (単一名) / level4 / character → 全 filter 該当
const HIT = 'DEC_B04022_HIT';
// 有効候補(分割名 rules/19): names に '服部平次' を component として含む / level3 / character
const HIT_SPLIT = 'DEC_B04022_HIT_SPLIT';
// DECOY F-name: 服部平次 ではない (毛利蘭) / level3 / character → cardName 不一致で候補外
const D_NAME = 'DEC_B04022_D_NAME';
// DECOY F-level: 服部平次 / level5 / character → levelMax4 超で候補外
const D_LEVEL = 'DEC_B04022_D_LEVEL';
// DECOY F-kind: 服部平次 / level1 / EVENT → kind 不一致で候補外
const D_KIND = 'DEC_B04022_D_KIND';
// (N-self 用) B04022 以外の別キャラ — これが leave しても a1 は発火しない
const OTHER = 'DEC_B04022_OTHER';

function registerDecoys(): void {
  registerCardDef(ch(HIT, { names: ['服部平次'], level: 4 }));
  registerCardDef(ch(HIT_SPLIT, { names: ['服部平次&遠山和葉'], level: 3 }));
  registerCardDef(ch(D_NAME, { names: ['毛利蘭'], level: 3 }));
  registerCardDef(ch(D_LEVEL, { names: ['服部平次'], level: 5 }));
  registerCardDef(ch(D_KIND, { kind: 'event', names: ['服部平次'], level: 1, ap: 0, lp: 0 }));
  registerCardDef(ch(OTHER, { names: ['鈴木園子'], level: 2 }));
}

// 相手ターン中 / B04022 を self.scene に置く base。
function base(turnPlayer: 'self' | 'opp' = 'opp'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('B04022', 'mh#1', { state: 'active' })];
  s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
  s.players.opp.deck = ['e1', 'e2'];
  return s;
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const enteredChar = (s: GameState, id: string) => s.players.self.scene.find((c) => c.cardId === id);

describe('B04022 光本兵我 — gate5 runtime behavior', () => {
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

  // ===== F-name / F-level / F-kind / F-split + DECOY: pick 候補集合の実評価 =====
  it('相手ターン中の現場リムーブ時に from-hand sceneEnter pick が surface — 候補は 服部平次/Lv4以下/character のみ (decoy 3種除外, 分割名は該当)', () => {
    setHuman('self');
    let s = base('opp');
    // 手札: 有効候補2 (単一名 HIT / 分割名 HIT_SPLIT) + decoy 3種
    s.players.self.hand = [HIT, HIT_SPLIT, D_NAME, D_LEVEL, D_KIND];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'mh#1', 'effect'); // B04022 自身を現場リムーブ → leave:to-remove(self)
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneEnter pick が surface (= a1 発火)').toBe('sceneEnter');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.nMax, '「1枚まで」 上限1').toBe(1);

    const cand = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張 (BUG-117/118: filter 実評価の証明)
    expect(cand, 'F-name: 服部平次でない (毛利蘭) は候補外').not.toContain(D_NAME);
    expect(cand, 'F-level: level5 の 服部平次 は候補外 (levelMax4 超)').not.toContain(D_LEVEL);
    expect(cand, 'F-kind: 服部平次 の event は候補外 (kind:character)').not.toContain(D_KIND);
    // 有効候補
    expect(cand, '服部平次 (単一名/Lv4/character) は候補').toContain(HIT);
    expect(cand, 'F-split: names に 服部平次 を含む複合名 (rules/19) も候補').toContain(HIT_SPLIT);
    // ちょうど 2 候補
    expect(cand, '候補は有効2枚のみ').toEqual([HIT, HIT_SPLIT].sort());
  });

  // ===== positive: pick で HIT を選択 → スリープ状態で現場登場 + 手札から splice =====
  it('pick で 服部平次 (HIT) を選択 → スリープ状態で現場登場し、手札から抜ける (decoy/もう1候補は手札に残る)', () => {
    setHuman('self');
    let s = base('opp');
    s.players.self.hand = [HIT, HIT_SPLIT, D_NAME, D_LEVEL, D_KIND];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'mh#1', 'effect');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const hitCand = pending.candidates.find((c) => c.cardId === HIT)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, hitCand.uid);
    });

    // HIT が現場に登場
    expect(inScene(s, HIT), '服部平次 (HIT) が手札から現場登場').toBe(true);
    // enterSleep:true → スリープ状態 (rules/03)
    expect(enteredChar(s, HIT)?.state, '登場した HIT は スリープ状態 (enterSleep:true)').toBe('sleep');
    // 手札から抜ける (重複防止)
    expect(inHand(s, HIT), '登場した HIT は手札から抜けた').toBe(false);
    // pick されなかった候補・decoy は手札に残る
    expect(inHand(s, HIT_SPLIT), '選ばれなかった候補 HIT_SPLIT は手札に残る').toBe(true);
    expect(inHand(s, D_NAME) && inHand(s, D_LEVEL) && inHand(s, D_KIND), 'decoy 3枚は手札に残る').toBe(true);
    // decoy は登場していない
    expect(inScene(s, D_LEVEL) || inScene(s, D_NAME) || inScene(s, D_KIND), 'decoy は登場しない').toBe(false);
  });

  // ===== N-turn: 【相手ターン中】未達 — 自分ターン中の leave:to-remove では発火しない =====
  it('NEGATIVE (turn:opp gate): 自分ターン中の現場リムーブでは a1 が発火しない (sceneEnter pick が立たない)', () => {
    setHuman('self');
    let s = base('self'); // 自分ターン中 → 【相手ターン中】不成立
    s.players.self.hand = [HIT];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'mh#1', 'effect');
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '自分ターン中 → a1 非発火 (condition turn:opp gate)').toBe(0);
    // pendingEffects にも leave:to-remove 由来は queue されない (condition gate)
    expect(s.pendingEffects.some((pe) => pe.triggeredBy.hook === 'leave:to-remove'),
      '自分ターン中: leave:to-remove は queue されない').toBe(false);
    // HIT は手札に残ったまま (登場していない)
    expect(inHand(s, HIT), 'HIT は手札に残る (登場せず)').toBe(true);
  });

  // ===== N-self: selfOnly — B04022 以外のキャラが leave しても発火しない =====
  it('NEGATIVE (selfOnly): B04022 以外のキャラ (OTHER) が現場リムーブされても B04022 a1 は発火しない', () => {
    setHuman('self');
    let s = base('opp'); // 相手ターン中 (turn 条件は満たす)
    // B04022 はそのまま現場に残し、別キャラ OTHER を追加 → OTHER を leave させる
    s.players.self.scene = [
      sceneChar('B04022', 'mh#1', { state: 'active' }),
      sceneChar(OTHER, 'oth#1', { state: 'active' }),
    ];
    s.players.self.hand = [HIT];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'oth#1', 'effect'); // OTHER を現場リムーブ (B04022 ではない)
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, 'OTHER の leave では B04022 a1 非発火 (selfOnly:true gate)').toBe(0);
    expect(inHand(s, HIT), 'HIT は手札に残る (登場せず)').toBe(true);
    // B04022 自身は現場に残る
    expect(inScene(s, 'B04022'), 'B04022 自身は現場に残る').toBe(true);
  });

  // ===== N-0pick: 「1枚まで」=0枚可 — human decline → 誰も登場しない =====
  it('NEGATIVE (0-pick): human が登場 0枚を選択 (「1枚まで」=0可 rules/15) → 誰も登場せず候補は手札に残る', () => {
    setHuman('self');
    let s = base('opp');
    s.players.self.hand = [HIT]; // 有効候補は居るが decline する

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'mh#1', 'effect');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'sceneEnter pick が surface').toBe('sceneEnter');
    expect(pending.nMin, 'nMin=0 (decline 可能)').toBe(0);
    expect(pending.candidates.map((c) => c.cardId), '候補は HIT のみ').toEqual([HIT]);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0枚選択 (decline)
    });

    expect(inScene(s, HIT), 'decline: HIT は登場しない').toBe(false);
    expect(inHand(s, HIT), 'decline: HIT は手札に残る').toBe(true);
    // 現場は (B04022 は既にリムーブ済なので) 空
    expect(s.players.self.scene.length, 'decline: 誰も新規登場していない').toBe(0);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = triggered {condition:turn:opp, trigger:leave:to-remove+selfOnly, sceneEnter from:hand enterSleep filter{cardName:服部平次,levelMax:4,kind:character}}', () => {
    const [a1] = B04022.abilities;
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    const eff = a1.effect as { kind: string; verb: string; args: Record<string, unknown> };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('sceneEnter');
    expect(eff.args).toMatchObject({
      player: 'self',
      from: 'hand',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { cardName: '服部平次', levelMax: 4, kind: 'character' },
    });
  });
});
