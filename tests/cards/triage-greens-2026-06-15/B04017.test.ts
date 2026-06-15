// gate5 RUNTIME behavior — B04017 服部平次 (character, 緑, Lv8 AP8000 LP2, 特徴[探偵|高校生])
//
// 公式テキスト:
//   【パートナー緑】【自分ターン中】【ターン1】〚カード名［遠山和葉］〛が自分の現場に登場したとき、
//   AP8000以下のキャラを1枚まで選び、リムーブする。
//
// rules: 15-abilities-effects.md (「〜まで」=0枚可 / 必須効果) / 17-icons.md (【パートナー色】【自分ターン中】
//        【ターン1】条件アイコン / 条件未達=能力非所持扱い) / 19-special-rules.md (カード名分割) /
//        24-qa-naming-stun.md (条件発動型は解決不可でも【ターンN】カウント)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   bearer 服部平次(B04017) を self.scene に置く → 遠山和葉(D06006) を手札から登場 (handUseCard)
//   → enter hook emit → triggered listener が B04017 a1 の trigger(matcherCondition cardName:遠山和葉)
//   + condition(partnerColor緑 & turn self) + limit(turn n:1) を gate → sceneRemove 短縮形 pick を surface。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない):
//   (A) trigger matcher cardName:'遠山和葉' — 別カード名のキャラが登場しても **発火しない**。
//   (B) effect filter apMax:8000 — AP>8000 のキャラは候補に出ず **リムーブ対象にならない** (DECOY)。
//   (C) condition partnerColor:'緑' — partner が緑でなければ **発火しない** (NEGATIVE)。
//   (D) limit turn:n1 — 同ターン2体目の遠山和葉登場では **再発火しない**、ただし【ターン1】は消費済 (rules/24)。
//   (E) 「1枚まで」(rules/15) — human decline (0-pick) で **誰もリムーブしない** (NEGATIVE channel)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B04017_ で id 衝突回避) ----
function ch(id: string, ap: number, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// effect 対象候補 (AP8000以下) — 唯一の "removeしたい" 対象。opp 現場に置く (side:either の検証も兼ねる)。
const TARGET_AP8000 = 'DEC_B04017_TARGET_AP8000';
// DECOY: AP9000 (>8000) — filter apMax:8000 で候補から弾かれるべき。リムーブされない。
const DECOY_AP9000 = 'DEC_B04017_DECOY_AP9000';
// trigger 非該当: カード名が遠山和葉でない別キャラ (登場しても a1 は発火しない)。
const OTHER_NAME = 'DEC_B04017_OTHER_NAME';

function registerDecoys(): void {
  registerCardDef(ch(TARGET_AP8000, 8000));
  registerCardDef(ch(DECOY_AP9000, 9000));
  registerCardDef(ch(OTHER_NAME, 5000, { names: ['毛利蘭'] }));
}

/**
 * bearer 服部平次(B04017) を self.scene に置いた base state。
 * 【パートナー緑】= partner D02001 (服部平次 partner 緑) / 【自分ターン中】= turn.player self /
 * 色制限 = case 緑 (遠山和葉=緑) / FILE6 ≥ 遠山和葉 level6。
 */
function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner.cardId = 'D02001'; // 服部平次 partner (緑) → 【パートナー緑】成立
  s.players.self.case.colors = ['緑'];       // 遠山和葉(緑) を手札使用するための色制限 (rules/20)
  s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 ≥ level6 (rules/12)
  // bearer (B04017 服部平次, AP8000) を現場に。uid='hattori' (登場する遠山和葉とは別 uid)
  s.players.self.scene = [sceneChar('B04017', 'hattori')];
  s.players.self.hand = ['D06006']; // 遠山和葉 (緑 Lv6 AP5000)
  return s;
}

const inOppScene = (s: GameState, id: string) => s.players.opp.scene.some((c) => c.cardId === id);
const inOppRemove = (s: GameState, id: string) => s.players.opp.remove.includes(id);

describe('B04017 服部平次 — gate5 runtime behavior', () => {
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

  // ===== POSITIVE + DECOY (human path): 候補リストを直接検証して apMax filter を実証 =====
  it('遠山和葉 登場で a1 発火 → 候補は AP8000以下のみ (DECOY AP9000 は候補外)、選んだ対象がリムーブ', () => {
    setHuman('self');
    let s = base();
    // opp 現場: AP8000(対象) と AP9000(DECOY)。side:either なので相手キャラも候補。
    s.players.opp.scene = [sceneChar(TARGET_AP8000, 'opp-target'), sceneChar(DECOY_AP9000, 'opp-decoy')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D06006'); // 遠山和葉 登場 → enter emit → a1 発火
      runAllUntilEmpty(d);              // human path: sceneRemove pick を surface して pause
    });

    // 遠山和葉が self 現場に登場したこと (trigger 前提)
    expect(s.players.self.scene.some((c) => c.cardId === 'D06006'), '遠山和葉が登場').toBe(true);

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick が surface (a1 発火の証明)').toBe('sceneRemove');
    expect(pending?.player, '操作者は self (bearer 所有)').toBe('self');
    // 「1枚まで」= 0枚可 (rules/15)
    expect(pending?.nMin, '「〜まで」=0枚可 (nMin 0)').toBe(0);
    expect(pending?.nMax, 'max 1').toBe(1);
    // DECOY 主張: AP9000 は候補に **含まれない** (apMax:8000 filter 実評価)。
    const candIds = pending!.candidates.map((c) => c.cardId);
    expect(candIds, 'DECOY(AP9000) は候補外 — apMax:8000 filter が評価された').not.toContain(DECOY_AP9000);
    expect(candIds, 'AP8000(=境界) の対象は候補に含む (apMax は ≤ 判定)').toContain(TARGET_AP8000);
    // bearer 服部平次(AP8000, self) も side:either で候補 (「キャラ」無修飾=両現場, rules/15)
    expect(pending!.candidates.some((c) => c.uid === 'hattori'), 'bearer(self AP8000) も候補 (side:either)').toBe(true);

    // AP8000 対象を選んでリムーブ
    const pickUid = pending!.candidates.find((c) => c.cardId === TARGET_AP8000)!.uid;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, pickUid);
    });
    expect(inOppScene(s, TARGET_AP8000), 'AP8000 対象は現場から消えた').toBe(false);
    expect(inOppRemove(s, TARGET_AP8000), 'AP8000 対象はリムーブエリアへ').toBe(true);
    // DECOY は盤面に残る (リムーブされない)
    expect(inOppScene(s, DECOY_AP9000), 'DECOY(AP9000) は現場に残る — リムーブされない').toBe(true);
    expect(inOppRemove(s, DECOY_AP9000), 'DECOY はリムーブされていない').toBe(false);
  });

  // ===== NEGATIVE (E): 「1枚まで」human decline (0-pick) → 誰もリムーブしない =====
  it('NEGATIVE 「1枚まで」=0枚可: human decline で AP8000対象が居ても誰もリムーブしない', () => {
    setHuman('self');
    let s = base();
    s.players.opp.scene = [sceneChar(TARGET_AP8000, 'opp-target')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D06006');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick surface').toBe('sceneRemove');
    expect(pending?.nMin, '0枚可 (decline channel)').toBe(0);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!); // 0枚選択 (decline)
    });
    expect(inOppScene(s, TARGET_AP8000), 'decline: AP8000対象は現場に残る').toBe(true);
    expect(inOppRemove(s, TARGET_AP8000), 'decline: リムーブされない').toBe(false);
  });

  // ===== POSITIVE (AI path): 唯一候補を AI が自動 remove =====
  it('AI path: 候補が AP8000対象1枚のみ → 自動でリムーブ / DECOY(AP9000)は触れない', () => {
    let s = base();
    s.players.opp.scene = [sceneChar(TARGET_AP8000, 'opp-target'), sceneChar(DECOY_AP9000, 'opp-decoy')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D06006');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // AI は候補 (AP≤8000: bearer hattori / opp-target) から1枚 remove。DECOY は候補外。
    expect(inOppScene(s, DECOY_AP9000), 'DECOY(AP9000) は AI でもリムーブされない').toBe(true);
    expect(inOppRemove(s, DECOY_AP9000), 'DECOY はリムーブエリアに無い').toBe(false);
    // ちょうど 1 枚 remove された (self+opp 合計の現場減少 = 1)
    const removedCount =
      s.players.self.remove.filter((c) => c === 'B04017').length +
      s.players.opp.remove.filter((c) => c === TARGET_AP8000).length;
    expect(removedCount, 'AP≤8000 候補から 1 枚だけリムーブ (max1)').toBe(1);
  });

  // ===== NEGATIVE (C): condition partnerColor:緑 未達 → 発火しない =====
  it('NEGATIVE 【パートナー緑】未達: partner が緑でない (青) と a1 発火せず pick も出ない', () => {
    setHuman('self');
    let s = base();
    s.players.self.partner.cardId = 'B01013'; // 青パートナーではなく青キャラ… → 緑でない def に差し替え
    // ↑ B01013 は character(青) だが partnerColor は def.colors を見るだけなので緑でなければ条件不成立。
    s.players.opp.scene = [sceneChar(TARGET_AP8000, 'opp-target')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D06006');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some((c) => c.cardId === 'D06006'), '遠山和葉は登場する (使用自体は可)').toBe(true);
    expect(pickQueue().length, '【パートナー緑】未達 → a1 発火せず pick 0').toBe(0);
    expect(inOppScene(s, TARGET_AP8000), '対象は現場に残る (リムーブ無し)').toBe(true);
  });

  // ===== NEGATIVE (A): trigger matcher cardName — 別カード名のキャラ登場では発火しない =====
  it('NEGATIVE trigger matcher: 遠山和葉でない別キャラ(毛利蘭)登場では a1 発火しない', () => {
    setHuman('self');
    let s = base();
    s.players.self.hand = ['DEC_B04017_OTHER_NAME']; // 毛利蘭 (緑) — 遠山和葉ではない
    s.players.opp.scene = [sceneChar(TARGET_AP8000, 'opp-target')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'DEC_B04017_OTHER_NAME');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some((c) => c.cardId === OTHER_NAME), '毛利蘭は登場した').toBe(true);
    expect(pickQueue().length, 'カード名不一致 → a1 発火せず pick 0').toBe(0);
    expect(inOppScene(s, TARGET_AP8000), '対象は現場に残る').toBe(true);
  });

  // ===== NEGATIVE (D): limit 【ターン1】 — 同ターン2体目の遠山和葉登場では再発火しない =====
  // 1体目=手札使用で登場、2体目=効果による登場 (mutate.scene.enter + enter emit; rules/17 効果登場でも
  // 条件成立で発動するが【ターン1】は uid+abilityId 単位で消費済) を直接 emit。「手札の使用」の per-turn
  // cap を避けるためで、enter hook の発火経路は実 engine の handUseCard / next-hint と同一 payload。
  it('NEGATIVE 【ターン1】: 同ターン2体目の遠山和葉登場では a1 再発火しない (rules/24: limit 消費済)', () => {
    setHuman('self');
    let s = base();
    s.players.opp.scene = [
      sceneChar(TARGET_AP8000, 'opp-t1'),
      sceneChar(TARGET_AP8000, 'opp-t2'),
    ];

    // 1 体目登場 (手札使用) → a1 発火 → opp-t1 を pick して remove
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'D06006');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, '1体目: a1 発火 (pick surface)').toBe('sceneRemove');
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, pending!.candidates.find((c) => c.uid === 'opp-t1')!.uid);
    });
    expect(inOppScene(s, TARGET_AP8000), '1体目: opp-t2 はまだ残る').toBe(true);
    expect(s.players.opp.remove.filter((c) => c === TARGET_AP8000).length, '1体目で 1 枚リムーブ').toBe(1);
    // limit カウンタが bearer(hattori) の a1 で 1 に増えたこと = 消費の直接証拠 (declaredUseCount 流用)
    const hattori = s.players.self.scene.find((c) => c.uid === 'hattori');
    expect(hattori?.declaredUseCount?.['a1'], '【ターン1】カウンタ = 1 (消費済)').toBe(1);
    // 2体目の前提: bearer も partner も健在 → 再発火を妨げる唯一の要因は limit のみ
    expect(s.players.self.partner.cardId, 'partner 緑 健在').toBe('D02001');

    // 2 体目登場 (効果による登場を直接 emit) → 【ターン1】消費済なので a1 再発火しない
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      const nc = mutate.scene.enter(d, 'self', 'D06006', { named: true });
      event.emit(
        d,
        'enter',
        { uid: nc.uid, viaEffect: true, enterOrder: nc.enterOrder, enterOrderThisTurn: nc.enterOrderThisTurn },
        { player: 'self', cardId: 'D06006', uid: nc.uid },
      );
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '2体目: 【ターン1】消費済 → 再発火せず pick 0').toBe(0);
    expect(s.players.opp.remove.filter((c) => c === TARGET_AP8000).length, '2体目では追加リムーブ無し').toBe(1);
    expect(s.players.self.scene.filter((c) => c.cardId === 'D06006').length, '遠山和葉が 2 体登場済').toBe(2);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = enter/triggerCharMatches(cardName:遠山和葉)/partnerColor緑&turn self/limit turn1/sceneRemove apMax8000', () => {
    // 動的 import で実 CardDef を読む
    return import('@/cards/ct-p04/B04017').then(({ B04017 }) => {
      const a1 = B04017.abilities[0];
      expect(a1.type).toBe('triggered');
      expect(a1.trigger).toMatchObject({
        hook: 'enter',
        matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: '遠山和葉' } },
      });
      expect(a1.condition).toMatchObject({
        kind: 'and',
        cs: [{ kind: 'partnerColor', color: '緑' }, { kind: 'turn', player: 'self' }],
      });
      expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
      expect(a1.effect).toMatchObject({
        kind: 'atom', verb: 'sceneRemove',
        args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } },
      });
    });
  });
});
