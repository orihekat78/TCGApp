// wave decklook-enter-handadd (2026-06-23, cards/wave-decklook-enter-handadd) — engine変更0
//
// 検証対象 (4 rep / 7 枚): B05016/B05016P (reveal3 upTo 特徴[少年探偵団]キャラ→hand→remove),
//   B09079 (reveal3 upTo カード名[高木渉]→hand→remove), B06048/B06048P (reveal3 upTo 特徴[YAIBA]カード→
//   hand→remove + 解決編 tail discard), B06053/B06053P (reveal-until 特徴[YAIBA]イベント→hand→deck下→shuffle)。
// exemplar: B07035 a1 (reveal3 upTo + handAdd + boundToRemove + caseStatus tail) / B06010 a1 (reveal-until +
//   handAdd + deckToBottomBound + deckShuffle)。filter honor (trait/cardName/kind) は targetFilterToPredicate
//   (src/engine/effect/atom-handlers/_shared.ts、BUG-117/118 以降) を engine 実コードで裏取り済。
//
// YAIBA event trait backfill: B06048 の「のカード」(キャラ OR イベント) と B06053 の「のイベント」は
//   特徴[YAIBA] のイベントを対象にするが、event.tsv に features 列が無く実装済 YAIBA イベント
//   (B06035 風神剣 / B06033 わが味方) は従来 traits:[] で永久非マッチだった。本 wave で公式 API
//   category1=YAIBA を per-card 補完 (先例 ef29f608 赤魔術) し、event 枝を live 化。本 test がその witness。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { AbilityDef, GameState } from '@/engine/types';
import { B05016 } from '@/cards/ct-p05/B05016';
import { B05016P } from '@/cards/ct-p05/B05016P';
import { B09079 } from '@/cards/ct-p09/B09079';
import { B06048 } from '@/cards/ct-p06/B06048';
import { B06048P } from '@/cards/ct-p06/B06048P';
import { B06053 } from '@/cards/ct-p06/B06053';
import { B06053P } from '@/cards/ct-p06/B06053P';
import { B06033 } from '@/cards/ct-p06/B06033';
import { B06033P } from '@/cards/ct-p06/B06033P';
import { B06035 } from '@/cards/ct-p06/B06035';

const FB = 'D08017'; // card-back filler (deck 底上げ用、reveal 中 refresh 回避)
const steps = (ab: AbilityDef) => (ab.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown>; if?: unknown; then?: unknown }> }).steps;
const reveal = (ab: AbilityDef) => steps(ab)[0].args as Record<string, unknown>;

describe('wave decklook-enter-handadd — reveal→hand→remove/deck-bottom (engine変更0)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---------- 実 flow: B05016 reveal3 特徴[少年探偵団]キャラ ----------
  it('B05016: 登場で デッキ上3枚から特徴[少年探偵団]キャラ(D01011)を手札、非該当(B06016=YAIBA)はリムーブ', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B05016'];
    s.players.self.case.colors = ['青']; // B05016=青 (色制限 rules/20)
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level6
    s.players.self.deck = ['B06016', 'D01011', FB, FB, FB]; // top3: B06016(YAIBA decoy)/D01011(少年探偵団 match)/FB

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B05016');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B05016'), 'B05016 登場').toBeTruthy();
    expect(s.players.self.hand, '少年探偵団 D01011 を手札に加える').toContain('D01011');
    expect(s.players.self.deck, 'D01011 はデッキから抜けた').not.toContain('D01011');
    expect(s.players.self.hand, '非該当 B06016 は手札に入らない').not.toContain('B06016');
    expect(s.players.self.deck, '非該当 B06016 はデッキに残らない (公開窓内 → remove)').not.toContain('B06016');
    expect(s.players.self.remove, '非該当 B06016 はリムーブエリアへ').toContain('B06016');
  });

  // ---------- 実 flow: B09079 reveal3 カード名[高木渉] ----------
  it('B09079: 登場で デッキ上3枚からカード名[高木渉](B01091)を手札、非該当(D01011)はリムーブ', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B09079'];
    s.players.self.case.colors = ['黄']; // B09079=黄
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB]; // FILE4 ≥ level4
    s.players.self.deck = ['D01011', 'B01091', FB, FB, FB]; // top3: D01011(非高木渉 decoy)/B01091(高木渉 match)/FB

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B09079');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '高木渉 B01091 を手札に加える').toContain('B01091');
    expect(s.players.self.deck, 'B01091 はデッキから抜けた').not.toContain('B01091');
    expect(s.players.self.hand, '非該当 D01011 は手札に入らない').not.toContain('D01011');
    expect(s.players.self.remove, '非該当 D01011 はリムーブエリアへ').toContain('D01011');
  });

  // ---------- 実 flow: B06048 事件編 = tail discard 不発 ----------
  it('B06048 (事件編): YAIBA(B06016)を手札に加えるが、解決編でないので手札リムーブは発生しない', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06048', 'B01016']; // B01016 = 余剰手札 (discard 候補)
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '事件編'; // ← 解決編でない
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = ['D01011', 'B06016', FB, FB, FB]; // top3: D01011(非YAIBA decoy)/B06016(YAIBA match)/FB

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06048');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.deck, 'B06016 は手札へ抜けた').not.toContain('B06016');
    expect(s.players.self.hand, '事件編: 手札 = 余剰B01016 + 追加B06016 = 2枚 (discard 不発)').toHaveLength(2);
    expect(s.players.self.hand).toEqual(expect.arrayContaining(['B01016', 'B06016']));
  });

  // ---------- 実 flow: B06048 解決編 + match = tail discard 発火 ----------
  it('B06048 (解決編+match): YAIBA を手札に加え、解決編なので手札を1枚リムーブ (net 手札1枚)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06048', 'B01016'];
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '解決編'; // ← 解決編
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = ['D01011', 'B06016', FB, FB, FB];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06048');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.deck, 'B06016 は手札へ抜けた').not.toContain('B06016');
    expect(s.players.self.hand, '解決編: 余剰B01016 + 追加B06016 = 2 → discard1 → 1枚').toHaveLength(1);
  });

  // ---------- 実 flow: B06048 解決編 + no-match = discard 不発 (AND 条件の bound 側を pin) ----------
  it('B06048 (解決編+no-match): 公開窓に YAIBA 不在 → 手札追加なし → 解決編でも discard 不発', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06048', 'B01016'];
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '解決編';
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = ['D01011', 'D05013', FB, FB, FB]; // top3 に YAIBA 無し (D01011=少年探偵団, D05013=高木渉)

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06048');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '追加なし・discard なし → 余剰B01016 のみ').toEqual(['B01016']);
  });

  // ---------- 実 flow: B06048 event 枝 witness (YAIBA イベント B06035 を手札追加 = 「のカード」忠実) ----------
  it('B06048 (event枝): 特徴[YAIBA]の「カード」= イベント(B06035 風神剣)も手札追加対象 (trait backfill 後)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06048'];
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = ['D01011', 'B06035', FB, FB, FB]; // B06035 = YAIBA イベント (kind:event, traits:['YAIBA'])

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06048');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, 'YAIBA イベント B06035 を手札に加える (「カード」= キャラ/イベント問わず)').toContain('B06035');
    expect(s.players.self.deck, 'B06035 はデッキから抜けた').not.toContain('B06035');
  });

  // ---------- 実 flow: B06053 reveal-until 特徴[YAIBA]イベント → hand → 残りデッキ下 → shuffle ----------
  it('B06053: 登場で YAIBA イベント(B06035)が出るまで公開→手札、YAIBAキャラ(B06016)は kind:event 非該当でデッキ下', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06053'];
    s.players.self.case.colors = ['白']; // B06053=白 lv6
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    // 公開順: B06016(YAIBA だが kind=character → 非該当) / D01011(非YAIBA) / B06035(YAIBA event → match)
    s.players.self.deck = ['B06016', 'D01011', 'B06035', FB, FB];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06053');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B06053'), 'B06053 登場').toBeTruthy();
    expect(s.players.self.hand, 'YAIBA イベント B06035 を手札に加える').toContain('B06035');
    expect(s.players.self.deck, 'B06035 はデッキから抜けた (手札へ)').not.toContain('B06035');
    expect(s.players.self.hand, 'YAIBA キャラ B06016 は kind:event 非該当 → 手札に入らない').not.toContain('B06016');
    expect(s.players.self.deck, '非該当 B06016 はデッキ下へ (リムーブでない)').toContain('B06016');
    expect(s.players.self.remove, 'B06053 は remove を使わない (deck下+shuffle)').not.toContain('B06016');
  });

  it('B06053: デッキに YAIBA イベント不在 → 全公開・手札追加なし・全カードはデッキに残る', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B06053'];
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '事件編';
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.self.deck = ['B06016', 'D01011', FB]; // YAIBA イベント無し

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B06053');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, 'match 無し → 手札追加なし').toEqual([]);
    expect(s.players.self.deck, '全カードはデッキに残る (下へ+shuffle)').toEqual(expect.arrayContaining(['B06016', 'D01011', FB]));
  });

  // ---------- YAIBA event trait backfill regression ----------
  it('YAIBA event trait backfill: B06035 / B06033 / B06033P が traits:[YAIBA] を持つ (公式 API category1 由来)', () => {
    expect(B06035.traits, 'B06035 風神剣').toContain('YAIBA');
    expect(B06033.traits, 'B06033 わが味方').toContain('YAIBA');
    expect(B06033P.traits, 'B06033P (spread of B06033)').toContain('YAIBA');
  });

  // ---------- descriptor 構造 ----------
  it('B05016/B05016P: enter trigger + reveal3 upTo {trait:少年探偵団, kind:character} + handAdd + boundToRemove (tail なし)', () => {
    for (const c of [B05016, B05016P]) {
      const a1 = c.abilities[0] as AbilityDef;
      expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
      expect(reveal(a1)).toMatchObject({ chooseMatch: 'upTo', maxN: 3, filter: { trait: '少年探偵団', kind: 'character' } });
      const verbs = steps(a1).map((st) => st.verb ?? (st as { then?: { verb?: string } }).then?.verb);
      expect(verbs).toEqual(['deckRevealUntil', 'handAddFromDeck', 'boundToRemove']); // tail discard 無し
    }
  });

  it('B09079: reveal3 upTo {cardName:高木渉} (kind 制約なし)', () => {
    const a1 = B09079.abilities[0] as AbilityDef;
    expect(reveal(a1)).toMatchObject({ chooseMatch: 'upTo', maxN: 3, filter: { cardName: '高木渉' } });
    expect((reveal(a1).filter as Record<string, unknown>).kind, 'カード名のみ → kind 制約なし').toBeUndefined();
    const verbs = steps(a1).map((st) => st.verb ?? (st as { then?: { verb?: string } }).then?.verb);
    expect(verbs).toEqual(['deckRevealUntil', 'handAddFromDeck', 'boundToRemove']);
  });

  it('B06048/B06048P: reveal3 upTo {trait:YAIBA} (kind なし) + tail conditional and[bound,解決編]→discard', () => {
    for (const c of [B06048, B06048P]) {
      const a1 = c.abilities[0] as AbilityDef;
      expect(reveal(a1)).toMatchObject({ chooseMatch: 'upTo', maxN: 3, filter: { trait: 'YAIBA' } });
      expect((reveal(a1).filter as Record<string, unknown>).kind, '「のカード」→ kind 制約なし').toBeUndefined();
      const st = steps(a1);
      expect(st[0].verb).toBe('deckRevealUntil');
      expect((st[1] as { then: { verb: string } }).then.verb).toBe('handAddFromDeck');
      expect(st[2].verb).toBe('boundToRemove');
      const tail = st[3] as { if: { kind: string; cs: Array<{ kind: string; status?: string; presence?: string }> }; then: { verb: string } };
      expect(tail.if.kind).toBe('and');
      expect(tail.if.cs).toEqual(expect.arrayContaining([
        { kind: 'bound', key: '$matched', presence: 'matched' },
        { kind: 'caseStatus', status: '解決編' },
      ]));
      expect(tail.then.verb).toBe('discard');
    }
  });

  it('B06053/B06053P: enter + reveal-until {trait:YAIBA, kind:event} (maxN/chooseMatch なし) + handAdd + deckToBottomBound + deckShuffle', () => {
    for (const c of [B06053, B06053P]) {
      const a1 = c.abilities[0] as AbilityDef;
      expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
      expect(reveal(a1)).toMatchObject({ filter: { trait: 'YAIBA', kind: 'event' } });
      expect(reveal(a1).maxN, '「出るまで」= maxN なし').toBeUndefined();
      expect(reveal(a1).chooseMatch, '「それを手札に加える」= 強制 (upTo でない)').toBeUndefined();
      const verbs = steps(a1).map((st) => st.verb ?? (st as { then?: { verb?: string } }).then?.verb);
      expect(verbs).toEqual(['deckRevealUntil', 'handAddFromDeck', 'deckToBottomBound', 'deckShuffle']);
    }
  });

  it('P-variant は base と effect 同一 (B05016P/B06048P/B06053P)', () => {
    expect(JSON.stringify(B05016P.abilities[0].effect)).toBe(JSON.stringify(B05016.abilities[0].effect));
    expect(JSON.stringify(B06048P.abilities[0].effect)).toBe(JSON.stringify(B06048.abilities[0].effect));
    expect(JSON.stringify(B06053P.abilities[0].effect)).toBe(JSON.stringify(B06053.abilities[0].effect));
  });
});
