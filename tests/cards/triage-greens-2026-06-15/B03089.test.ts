// gate5 RUNTIME behavior — B03089 黒田兵衛 (character, 黄, Lv8 AP7000 LP2, 特徴 警察|警視庁)
//
// 公式テキスト:
//   【登場時】手札からレベル5以下の〚特徴［警察］〛のキャラを1枚まで登場させるか、
//   自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
//   ターン終了時までそのキャラをAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）と
//   「ターン終了時、このキャラをリムーブする。」を与える。
//
// rules: 05-turn-phases.md (オートフェイズ/エンドフェイズ removeOnTurnEnd consume),
//        13-keywords.md (突撃 = 名乗り例外), 15-abilities-effects.md (「〜まで」=0枚可),
//        17-icons.md (【登場時】), 19-special-rules.md (AP下限なし / 分割名),
//        20-color-and-switch.md (効果による登場=色制限なし)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   登場 pick の filter {trait:'警察', levelMax:5, kind:'character'} を engine が **実評価** しているか。
//   target/candidates.matchOneFilter (candidates.ts:268 trait / :291 kind / :321 levelMax) が
//   実カード def の traits/kind/level で判定する。よって 警察 Lv≤5 character のみが候補になる。
//   さらに rider 3 連 (charModifyAP +2000 turn / charGrantKeyword 突撃 turn / charSetTurnEffect
//   removeOnTurnEnd) が **登場した $matched キャラにだけ** 掛かり、ターン終了で AP/突撃 が消え
//   removeOnTurnEnd でリムーブされるかを read.char.ap / read.char.keywords / endTurn で確認する。
//
// 登場元の真の2択 (choice 最上位):
//   - AI 経路 (humanChooser=false): choice は option0 (手札) を既定採用 → drainAiEffectPicks が
//     候補先頭を auto-take。
//   - human 経路 (setHuman('self')): choice が surface → applyChoiceAndContinuation(idx) で option
//     を選択 → 内側 sceneEnter pick が surface → applyPickAndContinuation / applyPickSkipAndContinuation。
//
// decoy/negative (filter が実評価されている証明):
//   D-trait : 特徴[探偵] Lv2 character → trait 不一致で候補外・登場不可
//   D-level : 特徴[警察] Lv6 character → levelMax5 超で候補外・登場不可
//   D-kind  : 特徴[警察] の **event** → kind 不一致で候補外・登場不可
//   N (0-pick): human が 0枚選択 (「1枚まで」=0枚可 rules/15) → 誰も登場せず rider 全不発。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  drainAiEffectPicks,
  applyChoiceAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectChoiceSide,
  _peekPendingEffectChoiceSide,
  _drainPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { read } from '@/engine/read/index';
import { endTurn } from '@/engine/flow/turn';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B03089_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 1, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// 登場 pick の唯一の有効候補 (警察 Lv5 character、base AP4000 → rider で +2000 = 6000)
const HIT = 'DEC_B03089_HIT';
// decoy A: trait 不一致 (探偵 Lv2) → 候補外
const D_TRAIT = 'DEC_B03089_TRAIT';
// decoy B: levelMax 超 (警察 だが Lv6) → 候補外
const D_LEVEL = 'DEC_B03089_LEVEL';
// decoy C: kind 不一致 (警察 の event) → 候補外
const D_KIND = 'DEC_B03089_KIND';

function registerDecoys(): void {
  registerCardDef(ch(HIT, { traits: ['警察'], level: 5, ap: 4000 }));
  registerCardDef(ch(D_TRAIT, { traits: ['探偵'], level: 2, ap: 4000 }));
  registerCardDef(ch(D_LEVEL, { traits: ['警察'], level: 6, ap: 4000 }));
  registerCardDef(ch(D_KIND, { kind: 'event', traits: ['警察'], level: 1, ap: 0, lp: 0 }));
}

// B03089 (黄 Lv8) を手札使用で登場させる base。case 黄 + FILE8 で色/レベルゲート通過。
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B03089'];
  s.players.self.case.colors = ['黄'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB, FB]; // FILE8 ≥ level8 (rules/12)
  return s;
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);
const enteredUid = (s: GameState, id: string) => s.players.self.scene.find((c) => c.cardId === id)?.uid;

describe('B03089 黒田兵衛 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== option0 (手札) AI 経路 + DECOY: filter 実評価 + rider が登場キャラのみに =====
  it('option0(手札): 登場時に手札の警察Lv5を登場 → AP+2000/突撃/ターン終了リムーブ付与。decoy(探偵/Lv6/event)は登場しない', () => {
    let s = enterBase();
    // 手札に HIT(警察Lv5=唯一の有効候補) + 3 decoy。AI choice は option0(手札)、auto-take は HIT。
    s.players.self.hand = ['B03089', HIT, D_TRAIT, D_LEVEL, D_KIND];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03089');
      for (let i = 0; i < 4; i++) {
        runAllUntilEmpty(d);
        drainAiEffectPicks(d, new HeuristicPolicy());
      }
    });

    // 親 B03089 が登場
    expect(inScene(s, 'B03089'), 'B03089 自身が登場').toBe(true);
    // 有効候補 HIT が手札から登場
    expect(inScene(s, HIT), '警察Lv5 (HIT) が手札から登場').toBe(true);
    expect(inHand(s, HIT), '登場した HIT は手札から抜けた').toBe(false);
    // DECOY 主張: filter 不一致は登場しない (BUG-117/118: filter 実評価の証明)
    expect(inScene(s, D_TRAIT), '探偵Lv2 (trait不一致) は登場しない').toBe(false);
    expect(inScene(s, D_LEVEL), '警察Lv6 (levelMax5超) は登場しない').toBe(false);
    expect(inScene(s, D_KIND), '警察event (kind不一致) は登場しない').toBe(false);
    expect(inHand(s, D_TRAIT) && inHand(s, D_LEVEL) && inHand(s, D_KIND), 'decoy 3枚は手札に残る').toBe(true);
    // 現場は B03089 + HIT のちょうど2体
    expect(s.players.self.scene.length, '現場は B03089 + HIT の2体のみ').toBe(2);

    // rider: 登場した HIT にだけ AP+2000 / 突撃 / removeOnTurnEnd
    const hitUid = enteredUid(s, HIT)!;
    expect(read.char.ap(s, hitUid), 'HIT base4000 + 2000(turn) = 6000').toBe(6000);
    expect(read.char.keywords(s, hitUid), 'HIT に突撃付与').toContain('突撃');
    const hitChar = s.players.self.scene.find((c) => c.uid === hitUid)!;
    expect(hitChar.turnEffects.removeOnTurnEnd, 'HIT に removeOnTurnEnd 付与').toBe(true);
    // 親 B03089 自身には rider が掛からない ($matched = 登場キャラのみ)
    const selfUid = enteredUid(s, 'B03089')!;
    expect(read.char.ap(s, selfUid), 'B03089 自身は base7000 のまま (rider 非対象)').toBe(7000);
    expect(read.char.keywords(s, selfUid), 'B03089 自身に突撃は付かない').not.toContain('突撃');

    // ターン終了: 突撃/AP+ が切れ、removeOnTurnEnd で HIT がリムーブされる
    const ended = produce(s, (d) => { endTurn(d, 'self'); });
    expect(inScene(ended, HIT), 'ターン終了で HIT はリムーブされる (removeOnTurnEnd)').toBe(false);
    expect(inRemove(ended, HIT), 'HIT はリムーブエリアへ').toBe(true);
    expect(inScene(ended, 'B03089'), 'B03089 自身はリムーブされない').toBe(true);
  });

  // ===== option1 (リムーブ) human 経路 + DECOY: 2択の remove 側でも filter+rider が効く =====
  it('option1(リムーブ): human が remove option を選び 警察Lv5を登場 → rider 付与。decoy はリムーブ側でも候補外', () => {
    setHuman('self');
    // 注: human choice-resume → 内側 sceneEnter(bind:'$matched') は ctx.bindings を書く。apply-* helper
    //   は内部で produce を管理し raw state を in-place mutate するため、B06050 同様に **外側 produce で
    //   包まず** raw state へ直接適用する (外側 produce で包むと entry.bindings が凍結され
    //   '$matched' 書込が non-extensible で crash する — engine仕様ではなくテスト二重 produce 由来)。
    const s = enterBase();
    // リムーブに HIT + decoy。手札には登場候補を一切置かない (option0/option1 を分離)。
    s.players.self.hand = ['B03089'];
    s.players.self.remove = [HIT, D_TRAIT, D_LEVEL, D_KIND];

    // 登場 → choice surface (raw state を in-place mutate)
    handUseCard(s, 'self', 'B03089');
    runAllUntilEmpty(s);
    const choice = _peekPendingEffectChoiceSide();
    expect(choice, '登場元の choice が surface').not.toBeNull();
    expect(choice?.options.length, '2択 (手札 / リムーブ)').toBe(2);

    // option1 (リムーブ側) を選択 → 内側 sceneEnter pick が surface
    const drained = _drainPendingEffectChoiceSide()!;
    g.__pendingEffectPickQueue = [];
    applyChoiceAndContinuation(s, drained, 1);
    const pend = pickQueue()[0];
    expect(pend, 'リムーブ登場の sceneEnter pick が surface').not.toBeUndefined();
    // DECOY 主張: 候補は HIT のみ (探偵/Lv6/event は除外) = filter 実評価
    expect(pend!.candidates.map((c) => c.cardId), 'remove 候補は 警察Lv5 (HIT) のみ').toEqual([HIT]);
    expect(pend!.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);

    // HIT を選択
    g.__pendingEffectPickQueue = [];
    applyPickAndContinuation(s, pend!, pend!.candidates[0]!.uid);

    expect(inScene(s, HIT), '警察Lv5 (HIT) がリムーブから登場').toBe(true);
    expect(inRemove(s, HIT), 'HIT はリムーブから抜けた').toBe(false);
    expect(inScene(s, D_TRAIT) || inScene(s, D_LEVEL) || inScene(s, D_KIND), 'decoy はリムーブ側でも登場しない').toBe(false);
    expect(inRemove(s, D_TRAIT) && inRemove(s, D_LEVEL) && inRemove(s, D_KIND), 'decoy 3枚はリムーブに残る').toBe(true);

    // rider: remove 経由でも HIT に AP+2000 / 突撃 / removeOnTurnEnd
    const hitUid = enteredUid(s, HIT)!;
    expect(read.char.ap(s, hitUid), 'HIT base4000 + 2000(turn) = 6000 (remove経路)').toBe(6000);
    expect(read.char.keywords(s, hitUid), 'HIT に突撃付与 (remove経路)').toContain('突撃');
    expect(s.players.self.scene.find((c) => c.uid === hitUid)!.turnEffects.removeOnTurnEnd,
      'HIT に removeOnTurnEnd 付与 (remove経路)').toBe(true);

    // ターン終了でリムーブ
    endTurn(s, 'self');
    expect(inScene(s, HIT), 'ターン終了で HIT リムーブ (remove経路)').toBe(false);
  });

  // ===== NEGATIVE: 「1枚まで」=0枚可 — human が 0枚選択 → 誰も登場せず rider 全不発 =====
  it('NEGATIVE: human が登場 0枚を選択 (「1枚まで」=0可) → 誰も登場せず AP/突撃/removeOnTurnEnd 不発', () => {
    setHuman('self');
    // raw state を in-place mutate (human choice-resume path、option1 と同理由)
    const s = enterBase();
    // 手札に有効候補 HIT を置く (option0 で 1枚まで)。が、human は decline する。
    s.players.self.hand = ['B03089', HIT];

    handUseCard(s, 'self', 'B03089');
    runAllUntilEmpty(s);
    // choice (2択) を option0 (手札) で解決
    const choice = _peekPendingEffectChoiceSide();
    expect(choice, 'choice surface').not.toBeNull();
    const drained = _drainPendingEffectChoiceSide()!;
    g.__pendingEffectPickQueue = [];
    applyChoiceAndContinuation(s, drained, 0);
    const pend = pickQueue()[0];
    expect(pend, '手札登場の sceneEnter pick が surface').not.toBeUndefined();
    expect(pend!.candidates.map((c) => c.cardId), '候補は HIT のみ').toEqual([HIT]);

    // 0枚選択 (decline)
    g.__pendingEffectPickQueue = [];
    applyPickSkipAndContinuation(s, pend!);

    // 誰も登場しない (HIT は手札に残る)
    expect(inScene(s, HIT), 'decline: HIT は登場しない').toBe(false);
    expect(inHand(s, HIT), 'decline: HIT は手札に残る').toBe(true);
    // 現場は B03089 自身のみ。rider は $matched 未解決で全 no-op。
    expect(s.players.self.scene.length, '現場は B03089 自身のみ').toBe(1);
    const selfUid = enteredUid(s, 'B03089')!;
    expect(read.char.ap(s, selfUid), 'B03089 自身 AP は base7000 のまま (rider 不発)').toBe(7000);
    expect(read.char.keywords(s, selfUid), 'B03089 自身に突撃なし (rider 不発)').not.toContain('突撃');
    expect(s.players.self.scene.find((c) => c.uid === selfUid)!.turnEffects.removeOnTurnEnd,
      'B03089 自身に removeOnTurnEnd なし (rider 不発)').not.toBe(true);

    // ターン終了で B03089 自身がリムーブされないこと (removeOnTurnEnd 不発の確認)
    endTurn(s, 'self');
    expect(inScene(s, 'B03089'), 'decline: B03089 自身はターン終了でも残る').toBe(true);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = enter/selfOnly, choice 2択 (hand-enter / remove-enter) + 各 option に rider 3連', () => {
    const a1 = read.def.card('B03089')!.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const ch0 = a1.effect as { kind: string; chooser: string; options: Array<{ kind: string; steps: Array<{ verb?: string; args?: Record<string, unknown> }> }> };
    expect(ch0.kind, '最上位 choice').toBe('choice');
    expect(ch0.options.length, '2登場元の真の2択').toBe(2);
    const [opt0, opt1] = ch0.options;
    // option0 = hand-enter, option1 = remove-enter
    expect(opt0.steps[0]).toMatchObject({ verb: 'sceneEnter', args: { from: 'hand', bind: '$matched' } });
    expect(opt1.steps[0]).toMatchObject({ verb: 'sceneEnter', args: { from: 'remove', bind: '$matched' } });
    // 両 option の sceneEnter filter = {trait:警察, levelMax:5, kind:character}
    for (const opt of [opt0, opt1]) {
      const t = (opt.steps[0].args as { target: { query: { filter: Record<string, unknown> } } }).target;
      expect(t.query.filter).toMatchObject({ trait: '警察', levelMax: 5, kind: 'character' });
      // rider 3連 = charModifyAP / charGrantKeyword / charSetTurnEffect
      expect(opt.steps.map((st) => st.verb)).toEqual(['sceneEnter', 'charModifyAP', 'charGrantKeyword', 'charSetTurnEffect']);
      expect(opt.steps[1].args).toMatchObject({ uid: '$matched.uid', delta: 2000, scope: 'turn' });
      expect(opt.steps[2].args).toMatchObject({ uid: '$matched.uid', kw: '突撃', scope: 'turn' });
      expect(opt.steps[3].args).toMatchObject({ uid: '$matched.uid', key: 'removeOnTurnEnd', val: true });
    }
  });
});
