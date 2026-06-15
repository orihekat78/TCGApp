// gate5 runtime behavior verification — B03086 伊達航 (character, 黄/警察|警視庁, L6 AP5000 LP1)
//   公式テキスト:
//     【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［警察］〛のキャラを
//       1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//   rules: 14-refresh.md(boundToRemove 後 deck0 で refresh), 15-abilities-effects.md(「〜まで」=0枚可),
//          17-icons.md(【登場時】 / 「特徴を持つ」印字判定), 20-color-and-switch.md(手札使用の色制限),
//          26-qa-deck-refresh.md(deck-look 中はデッキ扱い / 「残りをリムーブエリアに移す」完了時に refresh 判定)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   deckRevealUntil の filter:{trait:'警察', kind:'character'} を engine が **実際に評価** しているか。
//   targetFilterToPredicate (atom-handlers.ts:78-81 trait / :92 kind) が
//     filter.trait を d.traits.includes('警察')、filter.kind を d.kind==='character' で判定する。
//   よって 特徴[警察] の **キャラ** のみが match する (非警察キャラ / 警察を持つ event は弾かれる)。
//
// B02044 sibling との差分 (= 本カード固有の text-match):
//   (1) trigger は 【登場時】(enter) のみ (変装 variant 無し)。
//   (2) filter は trait:'警察' (keyword:'変装' ではない)。
//   (3) maxN は 3 (上から3枚)。
//   (4) 残りは **リムーブエリア** へ (boundToRemove) — B02044 の「デッキの下」(deckToBottomBound) ではない。
//       → 残り公開カードは s.players.self.remove に入り、deck からは消える。これが最重要 text-match。
//
// decoy/negative (filter が実評価されている証明 + 「〜まで」=0枚可):
//   D1: deck 先頭に **非警察の通常キャラ** (DEC_B03086_NONPOLICE, 特徴[探偵]) を置く。filter が無視されるなら
//       「最初の character」= decoy が拾われる (BUG-117/118 型バグ)。filter が honor されるなら decoy を
//       skip し 特徴[警察] の DEC_B03086_POLICE を拾う。decoy はリムーブエリアへ。
//   D2: deck に 特徴[警察] を持つ **event** (DEC_B03086_POLICE_EVENT) を混ぜる。kind:'character' filter が
//       honor されていれば event は match せず、警察キャラのみ拾われる (kind 条件の実評価証明)。
//   N1: window 3枚に 特徴[警察] の **キャラ** が 1枚も無い → $matched 空 → 手札 0、3枚すべてリムーブエリア
//       (conditional 不成立)。
//   N2: 「1枚まで」(rules/15) human decline (0-pick) → 警察キャラがあっても手札に加えず全reveal リムーブへ。
//   N2b: human take — pick で警察キャラを選択すると手札に加わる (decline channel の対)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { B03086 } from '@/cards/ct-p03/B03086';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckRevealSide?: { matched: string | null; awaitingPick?: boolean } | null;
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 特徴[警察] を持つ通常キャラ decoy/target (filter:{trait:'警察', kind:'character'} を満たす)
function policeChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 4, ap: 4000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
// 非警察キャラ decoy (kind:'character' は満たすが trait[警察] を持たない = 探偵)。trait 条件で弾かれるべき。
function nonPoliceChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 4, ap: 4000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
// 特徴[警察] を持つ **event** decoy。trait は満たすが kind:'character' で弾かれるべき (kind 実評価証明)。
function policeEvent(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['黄'],
    level: 1, ap: 0, lp: 0, traits: ['警察'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// 【登場時】(a1) 発火用 base: B03086 を手札から登場 (黄/L6 → 事件黄 + FILE6 で色/レベルゲート通過 rules/20,12)
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B03086'];
  s.players.self.case.colors = ['黄'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 ≥ level6 (rules/12)
  return s;
}

describe('B03086 伊達航 — gate5 runtime behavior', () => {
  beforeEach(() => {
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

  // ===== a1 + DECOY(trait): 上3枚中 警察キャラを手札へ、先頭の非警察decoy は skip しリムーブへ =====
  it('a1 + DECOY(trait): 登場で上3枚中 警察キャラ(POLICE)を手札へ、先頭の非警察decoy はskip → 残りはリムーブエリア', () => {
    registerCardDef(nonPoliceChar('DEC_B03086_NONPOLICE'));
    registerCardDef(policeChar('DEC_B03086_POLICE'));
    let s = enterBase();
    // deck top3: [非警察キャラ(先頭), 警察キャラ, filler], 下に look 外 filler。
    //   filter が無視されるなら「最初の character」= 非警察 decoy が拾われる (BUG-117/118 型バグ)。
    //   filter が honor されるなら 非警察を skip し 警察キャラを拾う。
    s.players.self.deck = ['DEC_B03086_NONPOLICE', 'DEC_B03086_POLICE', 'D08013', 'D08017'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03086'); // enter emit → a1 発火
      runAllUntilEmpty(d); // AI 経路: 先頭 match 自動取得
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B03086'), 'B03086 が登場').toBeTruthy();
    expect(s.players.self.hand, '警察キャラ DEC_B03086_POLICE を手札へ').toContain('DEC_B03086_POLICE');
    // DECOY 主張: 非警察キャラは手札に入らない (trait filter 実評価の証明)
    expect(s.players.self.hand, 'decoy(非警察キャラ)は手札に入らない').not.toContain('DEC_B03086_NONPOLICE');
    // 警察キャラはデッキから抜けた (手札へ)
    expect(s.players.self.deck, '警察キャラはデッキから抜けた').not.toContain('DEC_B03086_POLICE');
    // 残り (非警察 decoy + look 内 filler D08013) は **リムーブエリア** へ (boundToRemove = text 「残りをリムーブエリアに移す」)
    expect(s.players.self.remove, '残り: 非警察decoy はリムーブエリアへ').toContain('DEC_B03086_NONPOLICE');
    expect(s.players.self.remove, '残り: look 内 filler D08013 もリムーブエリアへ').toContain('D08013');
    // リムーブされたカードはデッキに残っていない
    expect(s.players.self.deck, '残りはデッキから抜けた(非警察decoy)').not.toContain('DEC_B03086_NONPOLICE');
    expect(s.players.self.deck, '残りはデッキから抜けた(D08013)').not.toContain('D08013');
    // look 外の D08017 はデッキに残る (3枚しか見ていない証明)
    expect(s.players.self.deck, 'look 外 D08017 はデッキに残る').toContain('D08017');
    // 残りはデッキ下ではない (B02044 と違い deckToBottomBound ではないことの確認)
    expect(s.players.self.remove.length, 'リムーブエリアに残り2枚').toBe(2);
  });

  // ===== D2: kind filter 実評価 — 警察を持つ event は match せず、警察キャラのみ拾う =====
  it('a1 + DECOY(kind): 警察event は kind:character filter で弾かれ、警察キャラのみ手札へ (kind 実評価)', () => {
    registerCardDef(policeEvent('DEC_B03086_POLICE_EVENT'));
    registerCardDef(policeChar('DEC_B03086_POLICE'));
    let s = enterBase();
    // deck top3: [警察event(先頭), 警察キャラ, filler]。
    //   trait のみ評価なら event(先頭) が拾われる。kind:'character' も honor されれば event を skip しキャラを拾う。
    s.players.self.deck = ['DEC_B03086_POLICE_EVENT', 'DEC_B03086_POLICE', 'D08013', 'D08017'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03086');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '警察キャラを手札へ').toContain('DEC_B03086_POLICE');
    expect(s.players.self.hand, 'decoy(警察event)は手札に入らない (kind:character で弾く)').not.toContain('DEC_B03086_POLICE_EVENT');
    // 警察event は残りとしてリムーブエリアへ
    expect(s.players.self.remove, '警察event はリムーブエリアへ').toContain('DEC_B03086_POLICE_EVENT');
    expect(s.players.self.deck, '警察event はデッキから抜けた').not.toContain('DEC_B03086_POLICE_EVENT');
  });

  // ===== N1: window 3枚に 警察キャラ無し → 手札0、全部リムーブエリア (conditional 不成立) =====
  it('a1 N1: 上3枚が 非警察キャラ + 警察event + filler → 警察キャラが無いので手札0、3枚すべてリムーブエリア (filter unmet)', () => {
    registerCardDef(nonPoliceChar('DEC_B03086_NONPOLICE'));
    registerCardDef(policeEvent('DEC_B03086_POLICE_EVENT'));
    let s = enterBase();
    s.players.self.deck = ['DEC_B03086_NONPOLICE', 'DEC_B03086_POLICE_EVENT', 'D08013', 'D08017'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03086');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B03086'), 'B03086 登場').toBeTruthy();
    // 警察キャラが window に無いので何も手札に加えない
    expect(
      s.players.self.hand.filter((c) => c === 'DEC_B03086_NONPOLICE' || c === 'DEC_B03086_POLICE_EVENT' || c === 'D08013').length,
      '警察キャラが無いので何も手札に加えない',
    ).toBe(0);
    // window 3枚すべてリムーブエリアへ
    expect(s.players.self.remove, '非警察キャラはリムーブへ').toContain('DEC_B03086_NONPOLICE');
    expect(s.players.self.remove, '警察eventはリムーブへ').toContain('DEC_B03086_POLICE_EVENT');
    expect(s.players.self.remove, 'filler D08013 もリムーブへ').toContain('D08013');
    expect(s.players.self.remove.length, 'window 3枚すべてリムーブ').toBe(3);
    // look 外 D08017 はデッキに残る (1枚)
    expect(s.players.self.deck, 'look 外 D08017 はデッキに残る').toEqual(['D08017']);
  });

  // ===== N2: 「1枚まで」(rules/15) human decline (0-pick) — 警察キャラがあっても手札に加えない =====
  it('a1 N2: human decline (0-pick) — 警察キャラ(POLICE)があっても手札に加えず全reveal リムーブへ (「〜まで」=0枚可)', () => {
    setHuman('self');
    registerCardDef(policeChar('DEC_B03086_POLICE'));
    let s = enterBase();
    s.players.self.deck = ['DEC_B03086_POLICE', 'D08013', 'D08017', 'D08020'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03086');
      runAllUntilEmpty(d); // human 経路: pick を surface して pause
    });
    expect(s.players.self.hand, 'decline 前は手札にまだ入らない').not.toContain('DEC_B03086_POLICE');
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'deckRevealUntil pick が surface').toBe('deckRevealUntil');
    expect(pending?.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.candidates.map((c) => c.cardId), '候補は警察キャラ DEC_B03086_POLICE のみ (trait+kind filter)').toEqual(['DEC_B03086_POLICE']);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(s.players.self.hand, 'decline: 警察キャラは手札に入らない').not.toContain('DEC_B03086_POLICE');
    // decline → window 全部(警察キャラ含む)が「残り」としてリムーブエリアへ (公式: 加えなければ全部残り)
    expect(s.players.self.remove, 'decline: 警察キャラも残りとしてリムーブへ').toContain('DEC_B03086_POLICE');
    expect(s.players.self.remove, 'decline: filler D08013 もリムーブへ').toContain('D08013');
    expect(s.players.self.remove, 'decline: filler D08017 もリムーブへ').toContain('D08017');
    expect(s.players.self.remove.length, 'window 3枚すべてリムーブ').toBe(3);
    expect(s.players.self.deck, 'look 外 D08020 はデッキに残る').toEqual(['D08020']);
  });

  // ===== N2b: human take — pick で警察キャラを選択すると手札に入る (decline channel の対) =====
  it('a1 N2b: human take — pick で警察キャラ(POLICE)を選択すると手札に加わり、残りはリムーブへ', () => {
    setHuman('self');
    registerCardDef(policeChar('DEC_B03086_POLICE'));
    let s = enterBase();
    s.players.self.deck = ['DEC_B03086_POLICE', 'D08013', 'D08017', 'D08020'];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03086');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pending.candidates[0]!.uid);
    });
    expect(s.players.self.hand, 'take: 警察キャラを手札へ').toContain('DEC_B03086_POLICE');
    expect(s.players.self.deck.includes('DEC_B03086_POLICE'), '警察キャラはデッキから抜けた').toBe(false);
    // 残り (filler 2枚) はリムーブエリアへ
    expect(s.players.self.remove, '残り filler D08013 はリムーブへ').toContain('D08013');
    expect(s.players.self.remove, '残り filler D08017 はリムーブへ').toContain('D08017');
    expect(s.players.self.remove.length, '残り2枚がリムーブ (警察キャラは手札)').toBe(2);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=enter selfOnly, deck-look maxN:3 chooseMatch:upTo filter{trait:警察,kind:character}, 残り=boundToRemove', () => {
    const [a1] = B03086.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({
      verb: 'deckRevealUntil',
      args: { maxN: 3, chooseMatch: 'upTo', filter: { trait: '警察', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
    });
    // 残りはリムーブエリアへ (boundToRemove) — B02044 の deckToBottomBound ではないことを pin
    expect(steps[2]).toMatchObject({ verb: 'boundToRemove', args: { bindKey: '$revealed' } });
    expect(B03086).toMatchObject({ kind: 'character', colors: ['黄'], level: 6, ap: 5000, lp: 1, traits: ['警察', '警視庁'] });
  });
});
