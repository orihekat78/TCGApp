// gate5 RUNTIME behavior — B06011 毛利蘭 (character, 青, Lv6 AP6000 LP0, 高校生|毛利探偵事務所|空手家)
//
// 公式テキスト:
//   【パートナー青】【登場時】自分のデッキのカードを上からレベル7以上の〚カード名［工藤新一］〛が
//     出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、
//     デッキをシャッフルする。
//
// rules: 14-refresh.md / 15-abilities-effects.md / 17-icons.md (【パートナー青】条件アイコン /
//        条件未達=「そもそも能力を持っていない扱い」) / 19-special-rules.md (split-name) /
//        26-qa-deck-refresh.md (出るまで公開型 / reveal中はデッキ扱い)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('B06011') で 毛利蘭 を現場に登場 → enter hook 発火 → triggered listener →
//   deckRevealUntil(no-maxN, forced auto-take) → conditional handAddFromDeck → deckToBottomBound →
//   deckShuffle。__humanPlayerSide=null (AI 経路: no-maxN は chooseMatch を持たず pick を surface
//   しない = 先頭 match 自動取得)。
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   deckRevealUntil の filter:{ levelMin:7, cardName:'工藤新一' } を engine が **実際に AND 評価**
//   しているか。targetFilterToPredicate (atom-handlers.ts:65-110) が levelMin (l.89) と cardName
//   (l.102-106 via allCardNameComponentsForDef) を両方 honor し、両不一致は false を返す。
//
// decoy/negative (filter が実評価されている証明):
//   D1 (name decoy):  deck 先頭に レベル8 だが カード名≠工藤新一 のキャラを置く。filter が無視されるなら
//       「最初のカード」= D1 が matched され手札に入る (BUG-117/118 型バグ)。filter が honor されるなら
//       D1 を skip する (cardName 不一致) → デッキ下へ。
//   D2 (level decoy): 2番目に カード名=工藤新一 だが レベル6 (<7) のキャラを置く。levelMin が honor
//       されるなら skip (level 不足) → デッキ下へ。
//   MATCH:            3番目に レベル7 かつ カード名=工藤新一 → これが matched → 手札へ。
//   N1 (no match):    工藤新一Lv7以上 が deck に1枚も無い → $matched 空 → 手札 add 0、全 reveal デッキ下。
//   N2 (cond unmet):  パートナーが 非青 → 【パートナー青】不成立 → 能力そのものが発動しない
//                     (rules/17「持っていない扱い」) → deck/hand 不変。

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
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

// ---- synthetic decoy/match/partner defs (prefix DEC_B06011_ で id 衝突回避) ----
// MATCH: レベル7 かつ カード名=工藤新一 — 唯一 filter を満たす → 手札へ。
const MATCH = 'DEC_B06011_MATCH_SHINICHI_L7';
// D1 name decoy: レベル8 (≥7) だが カード名=工藤優作 (≠工藤新一) — cardName filter で弾かれるべき。先頭配置。
const NAME_DECOY = 'DEC_B06011_NAMEDECOY_YUSAKU_L8';
// D2 level decoy: カード名=工藤新一 だが レベル6 (<7) — levelMin filter で弾かれるべき。
const LEVEL_DECOY = 'DEC_B06011_LEVELDECOY_SHINICHI_L6';
// filler (deck を 0 にせず refresh 回避)。filter 非該当の無名キャラ。
const FILLER = 'DEC_B06011_FILLER';
// 青パートナー / 非青パートナー (【パートナー青】条件 ON/OFF の decoy)。
const PARTNER_BLUE = 'DEC_B06011_PARTNER_BLUE';
const PARTNER_RED = 'DEC_B06011_PARTNER_RED';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(MATCH, { names: ['工藤新一'], level: 7 }));
  registerCardDef(ch(NAME_DECOY, { names: ['工藤優作'], level: 8 }));       // level OK, name 不一致
  registerCardDef(ch(LEVEL_DECOY, { names: ['工藤新一'], level: 6 }));      // name OK, level 不足
  registerCardDef(ch(FILLER, { names: ['filler'], level: 1 }));
  registerCardDef(ch(PARTNER_BLUE, { kind: 'partner' as CardDef['kind'], names: ['青探偵'], colors: ['青'] }));
  registerCardDef(ch(PARTNER_RED, { kind: 'partner' as CardDef['kind'], names: ['赤探偵'], colors: ['赤'] }));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const countHand = (s: GameState, id: string) => s.players.self.hand.filter((c) => c === id).length;

/** 実 engine flow: 毛利蘭 を手札から登場 → enter 発火 → deckRevealUntil sequence 解決。 */
function fire(build: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case.colors = ['青'];           // B06011=青 (色制限 rules/20)
  s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 ≥ level6 → 手札使用可 (rules/12)
  s.players.self.partner.cardId = PARTNER_BLUE;   // 既定: 【パートナー青】成立
  build(s);
  s = produce(s, (d) => {
    handUseCard(d, 'self', 'B06011');
    // no-maxN forced path は pick を surface しないが、堅牢性のため drain も回す。
    for (let i = 0; i < 4; i++) {
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    }
  });
  return s;
}

describe('B06011 毛利蘭 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ===== POSITIVE + DECOY: filter {levelMin:7, cardName:'工藤新一'} を AND 実評価している証明 =====
  it('登場 → 先頭の name/level decoy を skip し 工藤新一Lv7 を手札へ、decoy はデッキ下 (filter 実評価)', () => {
    const s = fire((st) => {
      // deck top: [name-decoy(Lv8,工藤優作), level-decoy(工藤新一,Lv6), MATCH(工藤新一,Lv7), filler...]。
      //   filter が無視されるなら先頭 name-decoy が matched され手札に入る (BUG-117/118 型バグ)。
      //   filter が honor されるなら name-decoy(name不一致) と level-decoy(level不足) を skip し MATCH を拾う。
      st.players.self.deck = [NAME_DECOY, LEVEL_DECOY, MATCH, FILLER, FILLER, FILLER];
      st.players.self.hand = ['B06011'];
    });

    // 毛利蘭 が現場に登場している
    expect(inScene(s, 'B06011'), '毛利蘭が登場').toBe(true);

    // (核) MATCH (工藤新一 Lv7) を手札に加える / デッキから抜ける
    expect(inHand(s, MATCH), '工藤新一Lv7 (MATCH) を手札に加える').toBe(true);
    expect(inDeck(s, MATCH), 'MATCH はデッキから抜けた').toBe(false);

    // DECOY 主張1 (cardName filter): 先頭の 工藤優作Lv8 は カード名不一致 → 手札に入らずデッキ下へ。
    //   filter が評価されていなければ「最初のカード」= NAME_DECOY が拾われていたはず。
    expect(inHand(s, NAME_DECOY), 'decoy: 工藤優作Lv8 は手札に入らない (cardName 不一致)').toBe(false);
    expect(inDeck(s, NAME_DECOY), 'name-decoy はデッキに残る (下へ)').toBe(true);

    // DECOY 主張2 (levelMin filter): 工藤新一だが Lv6 (<7) は レベル不足 → 手札に入らずデッキ下へ。
    expect(inHand(s, LEVEL_DECOY), 'decoy: 工藤新一Lv6 は手札に入らない (levelMin 不足)').toBe(false);
    expect(inDeck(s, LEVEL_DECOY), 'level-decoy はデッキに残る (下へ)').toBe(true);

    // 手札に加わったのは ちょうど MATCH 1枚 (毛利蘭は登場で手札から抜けている)
    expect(s.players.self.hand.length, '手札は MATCH 1枚のみ (毛利蘭は登場済)').toBe(1);
    expect(countHand(s, MATCH), 'MATCH は1枚だけ手札に').toBe(1);

    // 全 deck カード (MATCH 以外) は依然 deck に在る (shuffle 後なので順序は不問、集合で検証)
    expect(s.players.self.deck.length, 'deck = 6 - 1(MATCH手札) = 5').toBe(5);
  });

  // ===== N1: deck に 工藤新一Lv7以上 が不在 → 手札 add 0、全 reveal デッキ下 (filter unmet, 「出るまで」全公開) =====
  it('N1: 工藤新一Lv7以上 が deck に無い → 手札に何も加えず、公開した全カードはデッキに残る', () => {
    const s = fire((st) => {
      // 工藤新一Lv7+ が 1枚も無い (name-decoy=工藤優作Lv8 / level-decoy=工藤新一Lv6 / filler のみ)。
      // 「出るまで公開」型は match 不在なら全デッキを公開 → matched 空 → conditional skip → 全部デッキ下。
      st.players.self.deck = [NAME_DECOY, LEVEL_DECOY, FILLER, FILLER];
      st.players.self.hand = ['B06011'];
    });

    expect(inScene(s, 'B06011'), '毛利蘭が登場').toBe(true);
    // 何も手札に加わらない (毛利蘭は登場で手札から抜けたので手札 0)
    expect(s.players.self.hand.length, 'match 不在 → 手札に何も加えない (毛利蘭登場済で手札0)').toBe(0);
    expect(inHand(s, NAME_DECOY), 'name-decoy は手札に入らない').toBe(false);
    expect(inHand(s, LEVEL_DECOY), 'level-decoy は手札に入らない').toBe(false);
    // 公開した全カードはデッキに残る (デッキ下へ移し shuffle)。枚数不変。
    expect(inDeck(s, NAME_DECOY), 'name-decoy はデッキに残る').toBe(true);
    expect(inDeck(s, LEVEL_DECOY), 'level-decoy はデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'deck 枚数不変 (手札に1枚も入らない)').toBe(4);
  });

  // ===== N2: 【パートナー青】条件未達 (非青パートナー) → 能力そのものが発動しない (rules/17) =====
  it('N2: パートナーが赤 (非青) → 【パートナー青】不成立 → deck-reveal 自体が発動せず deck/hand 不変', () => {
    const s = fire((st) => {
      st.players.self.partner.cardId = PARTNER_RED; // 非青 → 条件不成立
      st.players.self.deck = [NAME_DECOY, LEVEL_DECOY, MATCH, FILLER, FILLER, FILLER];
      st.players.self.hand = ['B06011'];
    });

    expect(inScene(s, 'B06011'), '毛利蘭は登場する (登場自体は条件無関係)').toBe(true);
    // 能力未発動: MATCH (工藤新一Lv7) は手札に入らず deck に残ったまま
    expect(inHand(s, MATCH), '条件未達: MATCH は手札に入らない').toBe(false);
    expect(inDeck(s, MATCH), '条件未達: MATCH は deck に残る').toBe(true);
    // 手札は空 (毛利蘭は登場で手札から抜ける、それ以外は何も加わらない)
    expect(s.players.self.hand.length, '条件未達: 手札に何も加えない').toBe(0);
    // deck 枚数不変 (deck-reveal が一切走らない)
    expect(s.players.self.deck.length, '条件未達: deck 枚数不変 (deck操作なし)').toBe(6);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = enter/selfOnly + partnerColor青 + deckRevealUntil{levelMin7,cardName工藤新一}(no maxN)', async () => {
    const { B06011 } = await import('@/cards/ct-p06/B06011');
    const a1 = B06011.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '青' });
    const steps = (a1.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({
      verb: 'deckRevealUntil',
      args: { filter: { levelMin: 7, cardName: '工藤新一' }, bind: '$revealed', bindMatch: '$matched' },
    });
    // no-maxN: maxN/chooseMatch を持たない (forced auto-take, pick 非 surface)
    expect((steps[0].args as Record<string, unknown>).maxN).toBeUndefined();
    expect((steps[0].args as Record<string, unknown>).chooseMatch).toBeUndefined();
  });
});
