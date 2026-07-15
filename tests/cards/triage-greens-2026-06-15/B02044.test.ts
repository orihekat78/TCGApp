// gate5 runtime behavior verification — B02044 怪盗キッド (character, 白/怪盗, L4 AP3000 LP1)
//   公式テキスト:
//     【登場時】【変装時】自分のデッキのカードを上から2枚見る。その中から【変装】を持つキャラを
//       1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//     【変装】【事件白】【FILE4】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//   rules: 09-cutin-disguise.md(変装/canDisguise), 14-refresh.md, 15-abilities-effects.md(「〜まで」=0枚可),
//          17-icons.md(【事件白】【FILE4】条件アイコン / 「〜を持つ」印字判定), 23-qa-disguise-cutin.md,
//          26-qa-deck-refresh.md(deck-look 中はデッキ扱い)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   deckRevealUntil の filter:{keyword:'変装', kind:'character'} を engine が **実際に評価** しているか。
//   targetFilterToPredicate (atom-handlers.ts:66-110) が filter.keyword を defHasKeyword('変装') に委譲し、
//   defHasKeyword は ICON_KEYWORD_PREDICATES['変装'] = (ab)=>ab.type==='icon-disguise' で判定する
//   (read/keyword.ts)。よって icon-disguise ability を持つキャラのみが match する。
//
// decoy/negative (filter が実評価されている証明):
//   D1: deck 先頭に **非変装の通常キャラ** (DEC_B02044_PLAINCHAR) を置く。filter が無視されるなら
//       「最初の character」= decoy が拾われる。filter が honor されるなら decoy を skip し B02045(変装) を拾う。
//   N1: window に変装キャラが 1 枚も無い (通常キャラ + イベント decoy) → $matched 空 → 手札 0、両方デッキ下
//       (conditional 不成立)。
//   N2: 「1枚まで」(rules/15) — human decline (0-pick) → 変装キャラがあっても手札に加えない、全部デッキ下。
//   a2: 【変装時】(disguise:into) でも同一 deck-look が発火する。
//   a3: 【変装】icon-disguise ゲート 【事件白】&【FILE4】 — 条件達/未達で canDisguise が切替わる (decoy条件)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B02044 } from '@/cards/ct-p02/B02044';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckRevealSide?: { matched: string | null; awaitingPick?: boolean } | null;
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 非変装の通常キャラ decoy (kind:'character' は満たすが icon-disguise ability を持たない)。
// filter:{keyword:'変装', kind:'character'} の keyword 条件のみで弾かれるべき。
function plainChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 4000, lp: 1, traits: ['怪盗'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function plainEvent(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'],
    level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// 【登場時】(a1) 発火用 base: B02044 を手札から登場 (白/L4 → 事件白 + FILE4 で色/レベルゲート通過)
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B02044'];
  s.players.self.case.colors = ['白'];
  s.players.self.file = [FB, FB, FB, FB]; // FILE4 ≥ level4 (rules/12)
  return s;
}

describe('B02044 怪盗キッド — gate5 runtime behavior', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    g.__pendingDeckRevealSide = null;
    setHuman(null);
  });

  // ===== a1: 【登場時】 deck-look — filter:{keyword:'変装'} を実評価している証明 =====
  it('a1 + DECOY: 登場で 上2枚中 変装(B02045) を手札へ、先頭の非変装decoy は skip しデッキ下 (keyword filter 実評価)', () => {
    registerCardDef(plainChar('DEC_B02044_PLAINCHAR'));
    let s = enterBase();
    // deck top2: [非変装の通常キャラ(先頭), 変装キャラ B02045] + 下に filler。
    //   filter が無視されるなら「最初の character」= DEC が拾われる (BUG-117/118 型バグ)。
    //   filter が honor されるなら DEC を skip し B02045 を拾う。
    s.players.self.deck = ['DEC_B02044_PLAINCHAR', 'B02045', 'D08013'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02044');
      runAllUntilEmpty(d); // AI 経路: 先頭 match 自動取得
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B02044'), 'B02044 が登場').toBeTruthy();
    expect(s.players.self.hand, '変装持ち B02045 を手札へ').toContain('B02045');
    // DECOY 主張: 非変装キャラは手札に入らず、残りとしてデッキ下へ
    expect(s.players.self.hand, 'decoy(非変装キャラ)は手札に入らない').not.toContain('DEC_B02044_PLAINCHAR');
    expect(s.players.self.deck, 'B02045 はデッキから抜けた').not.toContain('B02045');
    expect(s.players.self.deck, 'decoy はデッキに残る (下へ)').toContain('DEC_B02044_PLAINCHAR');
    // deckToBottomBound: 残り(D08013 既存先頭 + decoy)。decoy は末尾、look されなかった D08013 が先頭。
    expect(s.players.self.deck[0], 'look 対象外の D08013 が先頭のまま').toBe('D08013');
    expect(s.players.self.deck[s.players.self.deck.length - 1], 'decoy が下へ').toBe('DEC_B02044_PLAINCHAR');
  });

  // ===== N1: window に変装キャラ無し → $matched 空 → 手札0、全部デッキ下 (conditional 不成立) =====
  it('a1 N1: 上2枚が 非変装キャラ + イベント → 変装が無いので手札に加えず両方デッキ下 (filter unmet)', () => {
    registerCardDef(plainChar('DEC_B02044_PLAINCHAR'));
    registerCardDef(plainEvent('DEC_B02044_EVENT'));
    let s = enterBase();
    s.players.self.deck = ['DEC_B02044_PLAINCHAR', 'DEC_B02044_EVENT', 'D08013'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02044');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B02044'), 'B02044 登場').toBeTruthy();
    expect(s.players.self.hand.filter((c) => c === 'DEC_B02044_PLAINCHAR' || c === 'DEC_B02044_EVENT').length,
      '変装が無いので何も手札に加えない').toBe(0);
    // 両 reveal はデッキ下、look 外の D08013 が先頭
    expect(s.players.self.deck[0], 'look 外 D08013 が先頭').toBe('D08013');
    expect(s.players.self.deck.includes('DEC_B02044_PLAINCHAR'), 'decoyキャラはデッキに残る').toBe(true);
    expect(s.players.self.deck.includes('DEC_B02044_EVENT'), 'decoyイベントはデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変(手札に1枚も入らない)').toBe(3);
  });

  // ===== N2: 「1枚まで」(rules/15) human decline — 変装があっても手札に加えない =====
  it('a1 N2: human decline (0-pick) — 変装(B02045)があっても手札に加えず全reveal デッキ下 (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = enterBase();
    s.players.self.deck = ['B02045', 'D08013', 'D08017'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02044');
      runAllUntilEmpty(d); // human 経路: pick を surface して pause
    });
    expect(s.players.self.hand, 'decline 前は手札にまだ入らない').not.toContain('B02045');
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'deckRevealUntil pick が surface').toBe('deckRevealUntil');
    expect(pending?.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.candidates.map((c) => c.cardId), '候補は変装持ち B02045 のみ (keyword filter)').toEqual(['B02045']);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(s.players.self.hand, 'decline: B02045 は手札に入らない').not.toContain('B02045');
    expect(s.players.self.deck.includes('B02045'), 'B02045 は残りとしてデッキへ').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変').toBe(3);
  });

  // ===== N2b: human take — pick で取得すれば手札に入る (decline channel の対) =====
  it('a1 N2b: human take — pick で変装(B02045)を選択すると手札に加わる', () => {
    setHuman('self');
    let s = enterBase();
    s.players.self.deck = ['B02045', 'D08013', 'D08017'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02044');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pending.candidates[0]!.uid);
    });
    expect(s.players.self.hand, 'take: B02045 を手札へ').toContain('B02045');
    expect(s.players.self.deck.includes('B02045'), 'B02045 はデッキから抜けた').toBe(false);
  });

  // ===== a2: 【変装時】(disguise:into) でも同一 deck-look が発火 =====
  it('a2: 【変装時】(disguise でコンタクト中キャラと入替) で 上2枚から変装(B02045)を手札へ、非変装decoy は skip', () => {
    registerCardDef(plainChar('DEC_B02044_PLAINCHAR'));
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // コンタクト中の自キャラ (uid='atk', cardId='D08017' = 非変装 filler) と入替える
    s.players.self.scene = [sceneChar('D08017', 'atk')];
    s.players.opp.scene = [sceneChar('D08017', 'dft')];
    s.players.self.hand = ['B02044'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB]; // 事件白 + FILE4 で B02044 の変装ゲート成立
    // deck top2: [非変装decoy 先頭, 変装 B02045]。disguise() は元 atk(D08017) を下へ push してから deck-look。
    s.players.self.deck = ['DEC_B02044_PLAINCHAR', 'B02045', 'D08013'];
    const ax: ActionContext = {
      id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 3000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
    };
    expect(canDisguise(s, ax, 'self', 'B02044'), '事件白+FILE4 → 変装可').toBe(true);

    s = produce(s, (d) => {
      disguise(d, ax, 'self', 'B02044'); // disguise:into emit → a2 発火
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装で cardId が B02044 に').toBe('B02044');
    expect(s.players.self.hand, '【変装時】deck-look で変装持ち B02045 を手札へ').toContain('B02045');
    expect(s.players.self.hand, 'decoy(非変装)は手札に入らない').not.toContain('DEC_B02044_PLAINCHAR');
    expect(s.players.self.deck.includes('B02045'), 'B02045 はデッキから抜けた').toBe(false);
    expect(s.players.self.deck.includes('DEC_B02044_PLAINCHAR'), 'decoy はデッキに残る').toBe(true);
  });

  // ===== a3: 【変装】icon-disguise ゲート 【事件白】&【FILE4】 — 条件達/未達で canDisguise 切替 =====
  it('a3 + DECOY条件: 変装ゲート 【事件白】&【FILE4】 — 白+FILE4で可 / 事件赤(非白)・FILE3で不可', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('D08017', 'atk')];
    s.players.opp.scene = [sceneChar('D08017', 'dft')];
    s.players.self.hand = ['B02044'];
    const ax: ActionContext = {
      id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 3000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
    };

    // 事件白 + FILE4 → 可
    const ok = produce(s, (d) => { d.players.self.case.colors = ['白']; d.players.self.file = [FB, FB, FB, FB]; });
    expect(canDisguise(ok, ax, 'self', 'B02044'), '事件白+FILE4 → 変装可').toBe(true);
    // DECOY条件1: 事件赤 (白でない) → 不可 (caseColor 白 不成立)
    const wrongColor = produce(ok, (d) => { d.players.self.case.colors = ['赤']; });
    expect(canDisguise(wrongColor, ax, 'self', 'B02044'), '事件白でない → 変装不可').toBe(false);
    // DECOY条件2: FILE3 (4未満) → 不可 (fileAtLeast 4 不成立)
    const lowFile = produce(ok, (d) => { d.players.self.file = [FB, FB, FB]; });
    expect(canDisguise(lowFile, ax, 'self', 'B02044'), 'FILE3 → 変装不可').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=enter/a2=disguise:into 同一 deck-look filter{keyword:変装,kind:character}, a3=icon-disguise(白&FILE4)', () => {
    const [a1, a2, a3] = B02044.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a2.trigger).toMatchObject({ hook: 'disguise:into', selfOnly: true });
    const reveal = (ab: typeof a1) => ((ab.effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args) as Record<string, unknown>;
    expect(reveal(a1)).toMatchObject({ maxN: 2, chooseMatch: 'upTo', filter: { keyword: '変装', kind: 'character' } });
    expect(reveal(a2)).toMatchObject({ maxN: 2, chooseMatch: 'upTo', filter: { keyword: '変装', kind: 'character' } });
    expect(a3).toMatchObject({ type: 'icon-disguise' });
    expect(a3.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'caseColor', color: '白' }, { kind: 'fileAtLeast', n: 4 }] });
  });
});
