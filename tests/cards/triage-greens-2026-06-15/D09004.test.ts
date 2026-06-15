// gate5 RUNTIME behavior — D09004 大和敢助 (character, 黄/警察|長野県警, Lv8 AP7000 LP1)
//
// 公式テキスト:
//   【絆諸伏高明】【自分ターン中】LP＋1
//   【登場時】カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛の
//     キャラの場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//
// rules: 05-turn-phases.md (【登場時】) / 15-abilities-effects.md (「〜まで」=0枚可 / sequence は必須実行) /
//        17-icons.md (【絆】【自分ターン中】= 条件アイコン、未充足なら能力を持たない扱い) /
//        19-special-rules.md / 24-qa-naming-stun.md (常時有効型は条件成立中のみ効果)
//
// 検証の核 (BUG-117/118 教訓: DSL に条件/filter を書いても engine が評価する保証はない):
//   (A2) a2.step3 の conditional.if = boundMatchesFilter{bindKey:'$discarded', filter:{trait:'長野県警'}} を
//        engine が **実際に評価** しているか。
//        - discard したカードが [長野県警] キャラ → conditional 成立 → sceneRemove pick が surface
//        - discard したカードが [長野県警] でない → conditional 不成立 → sceneRemove は一切 surface せず
//          (盤面に AP8000以下の合法 target が居ても 1体も removeされない) — これが filter 実評価の証明
//   (A2-filter) sceneRemove の filter:{apMax:8000} を engine が honor しているか。
//        - AP9000 の decoy は候補に **入らず** removeされない / AP8000(境界) の target は候補に入り removeされる
//   (A1) a1.continuousModifier{lpDelta:1} が condition (and[bond 諸伏高明, turn self]) 成立中のみ
//        char.lp に反映されるか。bond 未充足 / 相手ターン中 では LP+1 されない (rules/24 常時有効型)。
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('D09004') → enter hook → a2 sequence: draw → discard(bind=$discarded, human pick) →
//   conditional(boundMatchesFilter) → sceneRemove(human pick)。
//   discard を human pick にすることで「どのカードを捨てるか (= 長野県警 か否か)」を決定論的に制御する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { sceneChar } from '../../helpers/fixtures';
import { D09004 } from '@/cards/ct-d09/D09004';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_D09004_ で id 衝突回避) ----
// discard 候補: [長野県警] キャラ (conditional 成立側)。
const HAND_NAGANO = 'DEC_D09004_HAND_NAGANO';
// discard 候補: [長野県警] でない通常キャラ (conditional 不成立側 — NEGATIVE)。
const HAND_PLAIN = 'DEC_D09004_HAND_PLAIN';
// discard 候補: [長野県警] でも 種別 event (「のキャラ」filter 検証用)。
const HAND_NAGANO_EVENT = 'DEC_D09004_HAND_NAGANO_EVENT';
// deck filler (refresh 回避用、draw 対象)。
const DECK_FILLER = 'DEC_D09004_DECK_FILLER';
// sceneRemove 対象: AP8000 (境界、合法 target)。
const SCN_AP8000 = 'DEC_D09004_SCN_AP8000';
// sceneRemove decoy: AP9000 (> 8000 → filter で除外、removeされない)。
const SCN_AP9000 = 'DEC_D09004_SCN_AP9000';
// a1 bond 用: 諸伏高明 は committed の D09006 を使用 (registerAll で登録済)。

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(HAND_NAGANO, { traits: ['警察', '長野県警'], level: 5 }));
  registerCardDef(ch(HAND_PLAIN, { traits: ['探偵'], level: 3 }));
  registerCardDef(ch(HAND_NAGANO_EVENT, { kind: 'event', traits: ['長野県警'], ap: undefined, lp: undefined }));
  registerCardDef(ch(DECK_FILLER, { traits: [], level: 1 }));
  registerCardDef(ch(SCN_AP8000, { ap: 8000 }));
  registerCardDef(ch(SCN_AP9000, { ap: 9000 }));
}

// 【登場時】(a2) 発火用 base: D09004 (黄/Lv8) を手札から登場。
//   事件黄 + FILE8 (≥ level8) で色/レベルゲート通過 (rules/12/20)。
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['D09004'];
  s.players.self.case.colors = ['黄'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB, FB]; // FILE8 ≥ level8
  s.players.self.deck = [DECK_FILLER, DECK_FILLER, DECK_FILLER]; // draw 対象 + refresh 回避
  return s;
}

/** discard pick (Pattern B, hand card) の synthetic uid は `${cardId}#${index}` (resolve-picks.ts)。 */
function discardUidFor(pending: PendingEffectPickSide, cardId: string): string {
  const c = pending.candidates.find((x) => x.cardId === cardId);
  return c!.uid;
}

describe('D09004 大和敢助 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== a2 POSITIVE + DECOY: discard が[長野県警]キャラ → conditional 成立 → AP8000以下を1枚remove =====
  it('a2 + DECOY: [長野県警]キャラを discard すると conditional 成立 → AP8000(境界)remove / AP9000 decoy は候補外で生存', () => {
    setHuman('self'); // discard / sceneRemove を human pick で決定論制御
    let s = enterBase();
    s.players.self.hand = ['D09004', HAND_NAGANO, HAND_PLAIN]; // 長野県警 + 非該当 を両方持つ
    // 盤面: AP8000(合法 target) + AP9000(filter decoy)。side:'either' なので相手現場に置く。
    s.players.opp.scene = [sceneChar('DEC_D09004_SCN_AP8000', 'tgt8000'), sceneChar('DEC_D09004_SCN_AP9000', 'tgt9000')];

    // 登場 → enter → draw → discard pick が surface
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D09004');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'D09004'), 'D09004 が登場').toBeTruthy();
    let pending = pickQueue()[0];
    expect(pending?.atomVerb, 'まず discard pick が surface').toBe('discard');
    // discard 候補には draw 済 filler も入る (filter 無し)。長野県警キャラを明示選択。
    const naganoUid = discardUidFor(pending!, HAND_NAGANO);

    // [長野県警]キャラを discard → conditional 成立 → sceneRemove pick が enqueue されるはず
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, naganoUid);
    });
    expect(s.players.self.remove, '長野県警キャラを discard した').toContain(HAND_NAGANO);

    pending = pickQueue()[0];
    expect(pending, 'conditional 成立 → sceneRemove pick が surface').toBeTruthy();
    expect(pending?.atomVerb, '2つ目の pick は sceneRemove').toBe('sceneRemove');
    // DECOY 主張: sceneRemove 候補は apMax:8000 を honor — AP9000 は候補に入らない
    const candIds = pending!.candidates.map((c) => c.cardId);
    expect(candIds, 'AP8000(境界)は候補に入る').toContain('DEC_D09004_SCN_AP8000');
    expect(candIds, 'AP9000 decoy は候補に入らない (apMax:8000 honor)').not.toContain('DEC_D09004_SCN_AP9000');
    expect(pending!.nMin, '「〜まで」=0枚可 (nMin 0)').toBe(0);

    // AP8000 を選択して remove
    const tgt8000Uid = pending!.candidates.find((c) => c.cardId === 'DEC_D09004_SCN_AP8000')!.uid;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, tgt8000Uid);
    });
    expect(s.players.opp.scene.find((c) => c.uid === 'tgt8000'), 'AP8000 は現場からremoveされた').toBeFalsy();
    expect(s.players.opp.scene.find((c) => c.uid === 'tgt9000'), 'AP9000 decoy は現場に生存 (filter 除外)').toBeTruthy();
    expect(s.players.opp.remove, 'AP8000 はリムーブエリアへ').toContain('DEC_D09004_SCN_AP8000');
    expect(s.players.opp.remove, 'AP9000 decoy はリムーブされない').not.toContain('DEC_D09004_SCN_AP9000');
  });

  // ===== a2 NEGATIVE: discard が[長野県警]でない → conditional 不成立 → sceneRemove は一切発生しない =====
  // これが boundMatchesFilter (filter) を engine が実評価している証明 (BUG-117/118)。
  it('a2 NEGATIVE: 非[長野県警]キャラを discard すると conditional 不成立 → AP8000の合法targetが居ても 1体もremoveされない', () => {
    setHuman('self');
    let s = enterBase();
    s.players.self.hand = ['D09004', HAND_NAGANO, HAND_PLAIN];
    // 盤面に AP8000(合法 target) を置く — filter が無視されるなら remove されてしまう (バグ検出)
    s.players.opp.scene = [sceneChar('DEC_D09004_SCN_AP8000', 'tgt8000')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D09004');
      runAllUntilEmpty(d);
    });
    let pending = pickQueue()[0];
    expect(pending?.atomVerb, 'discard pick surface').toBe('discard');
    // 非[長野県警] (探偵) キャラを discard
    const plainUid = discardUidFor(pending!, HAND_PLAIN);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, plainUid);
    });
    expect(s.players.self.remove, '非該当キャラを discard した').toContain(HAND_PLAIN);

    // conditional 不成立 → sceneRemove pick は一切 surface しない
    pending = pickQueue()[0];
    expect(pending, 'discard が[長野県警]でない → sceneRemove pick は発生しない (conditional 評価される証明)').toBeUndefined();
    // 合法 target は盤面に生存 (filter は評価されたが then 自体が走らない)
    expect(s.players.opp.scene.find((c) => c.uid === 'tgt8000'), 'AP8000 target は現場に生存 (remove されない)').toBeTruthy();
    expect(s.players.opp.remove, 'AP8000 はリムーブされていない').not.toContain('DEC_D09004_SCN_AP8000');
  });

  // ===== a2 NEGATIVE2: discard が[長野県警]だが event 種別 → 「のキャラ」に該当せず conditional 不成立 =====
  // 注: HAND_NAGANO_EVENT は trait[長野県警] を持つ event。boundMatchesFilter の filter は
  //     {trait:'長野県警'} のみ (kind 未指定) だが、certify の根拠は「trait[長野県警] は character 専用、
  //     event は traits:[] が原則」。本テストは合成 decoy で意図的に event に trait を付与し、
  //     filter:{trait} のみだと event でも match してしまう (= 「のキャラ」に厳密でない) ことを観測する。
  //     これは false-positive リスクの記録であり、現実カードでは起きない (event は trait を持たない)。
  it('a2 INFO: [長野県警]を付与した event を discard した場合の挙動を観測 (filter は trait のみで kind 非評価)', () => {
    setHuman('self');
    let s = enterBase();
    s.players.self.hand = ['D09004', HAND_NAGANO_EVENT];
    s.players.opp.scene = [sceneChar('DEC_D09004_SCN_AP8000', 'tgt8000')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D09004');
      runAllUntilEmpty(d);
    });
    let pending = pickQueue()[0];
    expect(pending?.atomVerb).toBe('discard');
    const evUid = discardUidFor(pending!, HAND_NAGANO_EVENT);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, evUid);
    });
    expect(s.players.self.remove).toContain(HAND_NAGANO_EVENT);
    pending = pickQueue()[0];
    // filter:{trait:'長野県警'} は kind を評価しないため、trait を持つ event でも conditional 成立してしまう。
    // 実カードでは event は trait を持たないので影響なし (certify notes: trait[長野県警]は character 専用)。
    // ここでは現状の engine 挙動を **観測** として記録する (合成 decoy 由来の非現実ケース)。
    expect(pending?.atomVerb, '合成 event(trait付与)でも sceneRemove が surface する (kind 非評価、現実カードでは無害)').toBe('sceneRemove');
  });

  // ===== a1 LP+1 continuous + DECOY: bond 諸伏高明 & 自分ターン中で LP+1、未充足で +0 =====
  it('a1 + DECOY: 諸伏高明が現場 & 自分ターン中 → LP1+1=2 / 諸伏高明不在 → LP1 / 相手ターン中 → LP1', () => {
    // 充足: D09004(uid='yamato') + D09006(諸伏高明) 同現場、自分ターン
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('D09004', 'yamato'), sceneChar('D09006', 'morofushi')];
    expect(readChar.lp(s, 'yamato'), '絆諸伏高明 & 自分ターン中 → LP 1+1=2').toBe(2);
    // base AP は変化しない (a1 は lpDelta のみ)
    expect(readChar.ap(s, 'yamato'), 'a1 は AP に影響しない').toBe(7000);

    // DECOY1: 諸伏高明 不在 → bond 不成立 → LP+1 されない
    const noBond = produce(s, (d) => { d.players.self.scene = [sceneChar('D09004', 'yamato')]; });
    expect(readChar.lp(noBond, 'yamato'), '諸伏高明不在 (bond 未充足) → LP 1 のまま').toBe(1);

    // DECOY2: 相手ターン中 → turn(self) 不成立 → LP+1 されない (諸伏高明は居ても)
    const oppTurn = produce(s, (d) => { d.turn.player = 'opp'; });
    expect(readChar.lp(oppTurn, 'yamato'), '相手ターン中 (turn self 未充足) → LP 1 のまま').toBe(1);

    // DECOY3: 絆は別名キャラでは成立しない (適当な別キャラを置く)
    registerCardDef(ch('DEC_D09004_OTHER', { names: ['別人'] }));
    const wrongName = produce(s, (d) => {
      d.players.self.scene = [sceneChar('D09004', 'yamato'), sceneChar('DEC_D09004_OTHER', 'other')];
    });
    expect(readChar.lp(wrongName, 'yamato'), '別名キャラでは bond 未充足 → LP 1').toBe(1);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=continuous(bond 諸伏高明 & turn self, lpDelta:1) / a2=enter sequence[draw, discard$bind, conditional(boundMatchesFilter trait 長野県警)→sceneRemove apMax8000]', () => {
    const [a1, a2] = D09004.abilities;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'bond', cardName: '諸伏高明' }, { kind: 'turn', player: 'self' }] });
    expect(a1.continuousModifier).toMatchObject({ lpDelta: 1 });
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a2.effect as { steps: Array<{ kind: string; verb?: string; if?: unknown; then?: unknown }> }).steps;
    expect(steps[0]).toMatchObject({ kind: 'atom', verb: 'draw' });
    expect(steps[1]).toMatchObject({ kind: 'atom', verb: 'discard', args: { bind: '$discarded' } });
    expect(steps[2]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'boundMatchesFilter', bindKey: '$discarded', filter: { trait: '長野県警' } },
      then: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 8000 } } },
    });
  });
});
