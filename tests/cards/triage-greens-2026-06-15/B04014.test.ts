// gate5 RUNTIME behavior — B04014 「最後の切り札」 (event, 青, Lv5)
//
// 公式テキスト:
//   【パートナー青】【解決編】以下から1つ選んで行う。
//    ・キャラを2枚まで選び、スリープさせる。カードを1枚引く。
//    ・レベル6以下のキャラを1枚まで選び、リムーブする。
//    ・キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//
// rules: 13-keywords.md (突撃) / 15-abilities-effects.md (「〜まで」=0枚可 / 「〜する」必須) /
//        17-icons.md (【パートナー青】【解決編】条件アイコン = 充足しないと能力そのものを持たない) /
//        20-color-and-switch.md (色制限: 青イベントは事件青 + FILE5 で使用可) / 03-field-areas.md (状態)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('B04014') → effect:declared(event-use) trigger 発火 (条件 partnerColor青 & caseStatus解決編 充足)
//   → top-level choice surface (__pendingEffectChoiceSide) → applyChoiceAndContinuation(idx) で option 解決
//   → option 内の短縮形 scene pick が __pendingEffectPickQueue に surface → applyPickAndContinuation で解決。
//   human 経路 (__humanPlayerSide='self') を使い、3 option を 1 つずつ決定論的に検証する。
//
// 検証する filter / 条件 (BUG-117/118 lesson: DSL に書いても engine が評価する保証はない):
//   (DECOY/必須) option2 sceneRemove filter {levelMax:6} — レベル7のキャラは候補に出ず、リムーブ不可。
//     filter が無視されるなら Lv7 decoy も候補化されてしまう。
//   (条件) 【パートナー青】【解決編】 — 充足時のみ trigger 発火。非青パートナー / 事件編では choice が surface しない
//     (= 能力を持たない扱い rules/17)。
//   (NEGATIVE) 「〜まで」(0枚可 rules/15):
//     - option0 sleep 0-pick でも 「カードを1枚引く」は必須なので draw は実行される (draw-before-sleep 不変式)。
//     - option2 突撃付与 0-pick → どのキャラも突撃を得ない。
//   (DECOY) option2: pick した 1 体のみ突撃を得る。未 pick の別キャラは突撃を得ない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectChoiceSide,
  _peekPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { char as charRead } from '@/engine/read/char';
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

// ---- synthetic defs (prefix DEC_B04014_ で id 衝突回避) ----
// 青パートナー (partnerColor 青 条件用)。色なしだと条件不成立になる。
const PARTNER_BLUE = 'DEC_B04014_PARTNER_BLUE';
// 非青パートナー (条件 decoy: 赤 → partnerColor 青 不成立)。
const PARTNER_RED = 'DEC_B04014_PARTNER_RED';
// 現場キャラ (レベル別)。option2 filter {levelMax:6} の boundary 検証に使う。
const CH_L4 = 'DEC_B04014_CH_L4';   // Lv4 → levelMax6 圏内 (リムーブ可)
const CH_L6 = 'DEC_B04014_CH_L6';   // Lv6 → boundary (≤6 なのでリムーブ可)
const CH_L7 = 'DEC_B04014_CH_L7';   // Lv7 → levelMax6 圏外 (DECOY: リムーブ不可・候補外)

function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    level: undefined as unknown as number, ap: 0, lp: 5, traits: [], keywords: [],
    rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function charDef(id: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level, ap: 3000, lp: 2, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function registerDecoys(): void {
  registerCardDef(partnerDef(PARTNER_BLUE, ['青']));
  registerCardDef(partnerDef(PARTNER_RED, ['赤']));
  registerCardDef(charDef(CH_L4, 4));
  registerCardDef(charDef(CH_L6, 6));
  registerCardDef(charDef(CH_L7, 7));
}

/**
 * B04014 を使用できる base state を作る (青パートナー + 事件青解決編 + FILE5)。
 * build() で scene / deck を追加してから handUseCard を呼ぶ。
 */
function baseState(build: (s: GameState) => void): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: PARTNER_BLUE, state: 'active', location: 'partner-area' };
  s.players.self.case = {
    cardId: '', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {},
  };
  s.players.self.file = [FB, FB, FB, FB, FB]; // FILE5 ≥ B04014.level(5) → 手札使用可 (色=青も成立)
  s.players.self.hand = ['B04014'];
  build(s);
  return s;
}

/** handUseCard → trigger 発火 → choice surface まで進める (まだ option 未決定)。 */
function fireUntilChoice(s: GameState): GameState {
  return produce(s, (d) => {
    handUseCard(d, 'self', 'B04014');
    runAllUntilEmpty(d);
  });
}

describe('B04014 「最後の切り札」 — gate5 runtime', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    g.__pendingEffectPickQueue = [];
    setHuman('self'); // human 経路: choice / pick を surface して手動決定
  });

  // ============================================================
  // 条件アイコン: 【パートナー青】&【解決編】を engine が実評価しているか
  // ============================================================
  it('条件: 青パートナー + 解決編 → choice が surface する', () => {
    const s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L4, 'c1')];
      st.players.self.deck = ['D08017', 'D08017'];
    }));
    const choice = _peekPendingEffectChoiceSide();
    expect(choice, '条件充足 → top-level choice が surface').not.toBeNull();
    expect(choice?.options.length, '3 option').toBe(3);
    // B04014 は使用後リムーブへ (rules/06)
    expect(s.players.self.remove, 'イベントは使用後リムーブ').toContain('B04014');
    expect(s.players.self.hand, 'イベントは手札から抜ける').not.toContain('B04014');
  });

  it('条件 DECOY: パートナー赤 (非青) → 能力を持たない扱い、choice surface せず', () => {
    const s0 = baseState((st) => {
      st.players.self.partner = { cardId: PARTNER_RED, state: 'active', location: 'partner-area' };
      st.players.self.scene = [sceneChar(CH_L4, 'c1')];
      st.players.self.deck = ['D08017', 'D08017'];
    });
    fireUntilChoice(s0);
    expect(_peekPendingEffectChoiceSide(), 'partnerColor青 不成立 → choice surface しない').toBeNull();
    expect(pickQueue().length, 'pick も surface しない').toBe(0);
  });

  it('条件 DECOY: 事件編 (非解決編) → 能力を持たない扱い、choice surface せず', () => {
    const s0 = baseState((st) => {
      st.players.self.case.status = '事件編';
      st.players.self.scene = [sceneChar(CH_L4, 'c1')];
      st.players.self.deck = ['D08017', 'D08017'];
    });
    fireUntilChoice(s0);
    expect(_peekPendingEffectChoiceSide(), 'caseStatus解決編 不成立 → choice surface しない').toBeNull();
    expect(pickQueue().length, 'pick も surface しない').toBe(0);
  });

  // ============================================================
  // option0: ・キャラを2枚まで選び、スリープさせる。カードを1枚引く。
  // ============================================================
  it('option0: 2枚まで sleep + 必須 draw — 2体 sleep & 手札+1 (両 side either)', () => {
    let s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L4, 'c1'), sceneChar(CH_L6, 'c2')];
      st.players.opp.scene = [sceneChar(CH_L4, 'o1')]; // side:'either' → 相手キャラも候補
      st.players.self.deck = ['D08017', 'D08013'];
    }));
    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;

    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 0); });

    // option0 = sequence:[draw, sceneSetState(sleep,max2,either)]。draw は choice 解決直後に実行され、
    // sleep の pick が surface する。
    expect(s.players.self.hand.length, 'draw: 手札+1 (必須 draw)').toBe(handBefore + 1);
    expect(s.players.self.deck.length, 'draw: デッキ-1').toBe(deckBefore - 1);

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sleep pick が surface').toBe('sceneSetState');
    expect(pending?.nMin, '「2枚まで」=0枚可').toBe(0);
    expect(pending?.nMax, '上限2枚').toBe(2);
    // side:'either' → 候補に自他両 side のキャラが含まれる
    const candIds = pending!.candidates.map((c) => c.player + ':' + c.uid).sort();
    expect(candIds, 'either: 自c1/c2 + 相手o1 が候補').toEqual(['opp:o1', 'self:c1', 'self:c2']);

    // 自分の 2 体を sleep にする (multi-pick)
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, 'c1', ['c1', 'c2']);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'c1')?.state, 'c1 が sleep').toBe('sleep');
    expect(s.players.self.scene.find((c) => c.uid === 'c2')?.state, 'c2 が sleep').toBe('sleep');
    expect(s.players.opp.scene.find((c) => c.uid === 'o1')?.state, '未選択の相手キャラは active のまま').toBe('active');
  });

  it('option0 NEGATIVE: sleep 0-pick でも 「カードを1枚引く」は必須 → draw は実行される', () => {
    let s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L4, 'c1'), sceneChar(CH_L6, 'c2')];
      st.players.self.deck = ['D08017', 'D08013'];
    }));
    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;

    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 0); });
    // draw は choice 解決直後 (sleep pick より前) に既に実行済み — draw-before-sleep 不変式の核
    expect(s.players.self.hand.length, '0-pick 前に draw 済 (必須 draw)').toBe(handBefore + 1);
    expect(s.players.self.deck.length, 'デッキ-1').toBe(deckBefore - 1);

    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => { applyPickSkipAndContinuation(d, pending); });
    // 0-pick: 誰も sleep にならない。draw は既に実行済みなので巻き戻らない。
    expect(s.players.self.scene.every((c) => c.state === 'active'), '0-pick: 全員 active のまま').toBe(true);
    expect(s.players.self.hand.length, 'draw は 0-pick の影響を受けない (commutative)').toBe(handBefore + 1);
  });

  // ============================================================
  // option1: ・レベル6以下のキャラを1枚まで選び、リムーブする。  ← 必須 filter DECOY
  // ============================================================
  it('option1 + DECOY: levelMax6 — Lv6 はリムーブ可 / Lv7 は候補外 (filter 実評価)', () => {
    let s = fireUntilChoice(baseState((st) => {
      // c1=Lv6 (リムーブ可), c2=Lv7 (DECOY: 候補外), o1=Lv4 相手 (either)
      st.players.self.scene = [sceneChar(CH_L6, 'c1'), sceneChar(CH_L7, 'c2')];
      st.players.opp.scene = [sceneChar(CH_L4, 'o1')];
      st.players.self.deck = ['D08017', 'D08013'];
    }));

    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 1); });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick が surface').toBe('sceneRemove');
    expect(pending?.nMin, '「1枚まで」=0枚可').toBe(0);
    expect(pending?.nMax, '上限1枚').toBe(1);
    // DECOY 主張: levelMax6 圏外の Lv7 (c2) は候補に含まれない。Lv6(c1) + Lv4相手(o1) のみ。
    const candUids = pending!.candidates.map((c) => c.uid).sort();
    expect(candUids, 'Lv7 (c2) は候補外、Lv6(c1)+Lv4相手(o1) が候補').toEqual(['c1', 'o1']);
    expect(pending!.candidates.some((c) => c.uid === 'c2'), 'DECOY: Lv7 は候補に出ない').toBe(false);

    // Lv6 の c1 をリムーブ
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => { applyPickAndContinuation(d, pending!, 'c1'); });
    expect(s.players.self.scene.some((c) => c.uid === 'c1'), 'Lv6 c1 はリムーブされた').toBe(false);
    expect(s.players.self.remove.includes(CH_L6), 'c1 はリムーブエリアへ').toBe(true);
    expect(s.players.self.scene.some((c) => c.uid === 'c2'), 'DECOY: Lv7 c2 は現場に残る').toBe(true);
    expect(s.players.opp.scene.some((c) => c.uid === 'o1'), '未選択の相手 o1 は残る').toBe(true);
  });

  it('option1 NEGATIVE: 0-pick → 誰もリムーブされない (「〜まで」=0枚可)', () => {
    let s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L6, 'c1')];
      st.players.self.deck = ['D08017', 'D08013'];
    }));
    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 1); });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => { applyPickSkipAndContinuation(d, pending); });
    expect(s.players.self.scene.some((c) => c.uid === 'c1'), '0-pick: c1 は残る').toBe(true);
    expect(s.players.self.remove.includes(CH_L6), '0-pick: リムーブ無し').toBe(false);
  });

  // ============================================================
  // option2: ・キャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。
  // ============================================================
  it('option2 + DECOY: 突撃付与 — pick した 1 体のみ突撃を得る / 未 pick は得ない', () => {
    let s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L4, 'c1'), sceneChar(CH_L6, 'c2')];
      st.players.self.deck = ['D08017', 'D08013'];
    }));
    // 付与前は両者突撃を持たない
    expect(charRead.hasKeyword(s, 'c1', '突撃'), '付与前 c1 は突撃なし').toBe(false);

    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 2); });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'charGrantKeyword pick が surface').toBe('charGrantKeyword');
    expect(pending?.nMin, '「1枚まで」=0枚可').toBe(0);
    expect(pending?.nMax, '上限1枚').toBe(1);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => { applyPickAndContinuation(d, pending!, 'c1'); });
    // DECOY: pick した c1 のみ突撃。未 pick の c2 は得ない。
    expect(charRead.hasKeyword(s, 'c1', '突撃'), 'pick した c1 は突撃を得る').toBe(true);
    expect(charRead.hasKeyword(s, 'c2', '突撃'), 'DECOY: 未 pick の c2 は突撃を得ない').toBe(false);
    // turn scope に積まれている (ターン終了時まで)
    const c1 = s.players.self.scene.find((c) => c.uid === 'c1')!;
    expect((c1.turnEffects['grantedKeywords'] as string[] | undefined), 'turn scope grantedKeywords に突撃').toContain('突撃');
  });

  it('option2 NEGATIVE: 0-pick → どのキャラも突撃を得ない', () => {
    let s = fireUntilChoice(baseState((st) => {
      st.players.self.scene = [sceneChar(CH_L4, 'c1'), sceneChar(CH_L6, 'c2')];
      st.players.self.deck = ['D08017', 'D08013'];
    }));
    const choice = _peekPendingEffectChoiceSide()!;
    s = produce(s, (d) => { applyChoiceAndContinuation(d, choice, 2); });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => { applyPickSkipAndContinuation(d, pending); });
    expect(charRead.hasKeyword(s, 'c1', '突撃'), '0-pick: c1 は突撃なし').toBe(false);
    expect(charRead.hasKeyword(s, 'c2', '突撃'), '0-pick: c2 は突撃なし').toBe(false);
  });
});
