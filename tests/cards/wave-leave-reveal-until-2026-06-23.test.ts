// wave leave-reveal-until (2026-06-23, cards/wave-leave-reveal-until) — engine変更0
//
// 検証対象 (7 枚): B05021 森達夫 (leave reveal-until cardName[毛利小五郎]→hand) / B03019 フサエ
//   (a1 同型 cardName[阿笠博士], a2 ヒラメキ draw) / B05077 ジョディ・サンテミリオン (leave reveal-until
//   cardName[ジョディ・スターリング] levelMax4 → 登場) / B07086 榎本杉人 (a1 ミスリード1, a2 leave reveal-until
//   cardName[榎本梓]→hand + 加えた場合 discard1) / B07043 寺井黄之助 (leave choice[盗一/快斗/キッド]
//   → reveal-until → hand) / B02058 + B02058P 赤井秀一 (a1 登場時 handCountAtLeastOther→opp discard1,
//   a2 leave reveal-until cardName[沖矢昴]→hand)。
//
// engine変更0: leave:to-remove selfOnly + condition{turn:opp} (D05007 a1) + deckRevealUntil reveal-until
//   [no maxN] → handAddFromDeck/sceneEnter → deckToBottomBound → deckShuffle (B06053 a1) の既存 settled path 合成。
//   B02058 a1 = conditional{handCountAtLeastOther:opp}→discard{opp,1} (cond/eval.ts:135 Task D E1、exemplar B07067 a1 /
//   discard opp = D04010)。choice DSL = D02013。misreadX = D01010。
// 重要: reveal-until は非match (=$revealed) を deckToBottomBound で「デッキ下」へ戻す (remove でない、wave-08 reveal-N と相違)。
//   B07086 の discard は conditional 内 (加えた場合のみ) ゆえ非match時 over-fire しない (公式Q&A)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { GameState } from '@/engine/types';
import { B05021 } from '@/cards/ct-p05/B05021';
import { B03019 } from '@/cards/ct-p03/B03019';
import { B05077 } from '@/cards/ct-p05/B05077';
import { B07086 } from '@/cards/ct-p07/B07086';
import { B07043 } from '@/cards/ct-p07/B07043';
import { B02058 } from '@/cards/ct-p02/B02058';
import { B02058P } from '@/cards/ct-p02/B02058P';

const FB = 'D08017'; // card-back filler (deck 底上げ用、reveal 中 refresh 回避 / cardName 非一致 decoy)
const policy = new HeuristicPolicy();

function oppTurn(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
  return s;
}
function drive(s: GameState, uid: string): GameState {
  return produce(s, (d) => {
    mutate.scene.removeToRemove(d, uid, 'effect'); // 自身 leave → leave:to-remove selfOnly 発火
    runAllUntilEmpty(d);
    drainAiEffectPicks(d, policy);
  });
}

describe('wave leave-reveal-until — 【現場リムーブ時】reveal-until-X → hand/登場 (engine変更0)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---------- B05021 森達夫: leave → reveal-until cardName[毛利小五郎] → hand ----------
  it('B05021: 相手ターン現場リムーブ — 非該当(FB)を飛ばし 毛利小五郎(D01005) を手札へ / 非該当はデッキ下(remove でない)', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B05021', 'mori#1')];
    s.players.self.deck = [FB, 'D01005', FB, FB]; // top: FB(非毛利小五郎 decoy) → D01005(match)
    s = drive(s, 'mori#1');
    expect(s.players.self.hand, '毛利小五郎 D01005 を手札に加える').toContain('D01005');
    expect(s.players.self.deck, 'D01005 はデッキから抜けた').not.toContain('D01005');
    expect(s.players.self.deck, '非該当 FB はデッキ下へ戻る (remove でない)').toContain(FB);
    expect(s.players.self.remove, '非該当 FB は remove へ行かない (reveal-until)').toEqual(['B05021']);
  });

  it('B05021: 自分ターンでは発火しない (turn:opp gate)', () => {
    let s = oppTurn();
    s.turn.player = 'self';
    s.players.self.scene = [sceneChar('B05021', 'mori#1')];
    s.players.self.deck = ['D01005', FB, FB];
    s = drive(s, 'mori#1');
    expect(s.players.self.hand, '自分ターンは何も加えない').toHaveLength(0);
    expect(s.players.self.deck, 'D01005 はデッキに残る').toContain('D01005');
  });

  // ---------- B03019 フサエ: a1 cardName[阿笠博士] → hand / a2 ヒラメキ draw (構造) ----------
  it('B03019: 相手ターン現場リムーブ — 阿笠博士(D08019) を手札へ', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B03019', 'fusae#1')];
    s.players.self.deck = [FB, 'D08019', FB, FB];
    s = drive(s, 'fusae#1');
    expect(s.players.self.hand, '阿笠博士 D08019 を手札に加える').toContain('D08019');
    expect(s.players.self.deck, 'D08019 はデッキから抜けた').not.toContain('D08019');
  });

  it('B03019: no-match (阿笠博士 不在) — 何も加えず、公開した全カードはデッキ下へ (remove でない)、shuffle (公式Q&A)', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B03019', 'fusae#1')];
    s.players.self.deck = [FB, FB, FB]; // 阿笠博士 不在 → 全公開・非match
    s = drive(s, 'fusae#1');
    expect(s.players.self.hand, '阿笠博士 不在 → 何も手札に加えない').toHaveLength(0);
    expect(s.players.self.deck.filter((c) => c === FB), '公開した FB は全てデッキ下へ戻る (3枚残存)').toHaveLength(3);
    expect(s.players.self.remove, 'remove は自身 leave のみ (公開カードは remove でない)').toEqual(['B03019']);
  });

  it('B03019: a2 = 【ヒラメキ】draw 構造 (evidence:remove-by-action optional, draw self 1)', () => {
    const a2 = B03019.abilities[1];
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb: string; args: unknown }).verb).toBe('draw');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({ player: 'self', n: 1 });
  });

  // ---------- B05077 ジョディ・サンテミリオン: leave → reveal-until cardName+levelMax4 → 登場 ----------
  it('B05077: levelMax4 — 同名 Lv7(B01063) は除外、Lv3(B04057) を 登場(active) させる', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B05077', 'jodi#1')];
    // top: B01063(ジョディ・スターリング Lv7 = 同名だが levelMax4 超過 decoy) → B04057(ジョディ・スターリング Lv3 match)
    s.players.self.deck = ['B01063', 'B04057', FB, FB];
    s = drive(s, 'jodi#1');
    const entered = s.players.self.scene.find((c) => c.cardId === 'B04057');
    expect(entered, 'Lv3 ジョディ・スターリング B04057 が登場').toBeTruthy();
    expect(entered?.state, '「登場させる」= 通常(active)、スリープでない').toBe('active');
    expect(s.players.self.scene.find((c) => c.cardId === 'B01063'), '同名 Lv7 は levelMax4 で登場しない').toBeFalsy();
    expect(s.players.self.deck, '同名 Lv7 B01063 はデッキ下へ戻る (登場せず)').toContain('B01063');
    expect(s.players.self.deck, 'B04057 はデッキから抜けた').not.toContain('B04057');
  });

  // ---------- B07086 榎本杉人: a1 ミスリード1 / a2 leave reveal-until + 加えた場合 discard1 ----------
  it('B07086: 加えた場合 — 榎本梓(B01086) を手札に加え、手札を1枚 discard (net hand +1-1=元数)', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B07086', 'enom#1')];
    s.players.self.hand = ['B01016']; // discard 候補 (余剰手札 1)
    s.players.self.deck = [FB, 'B01086', FB, FB];
    s = drive(s, 'enom#1');
    expect(s.players.self.deck, '榎本梓 B01086 はデッキから抜けた (手札へ)').not.toContain('B01086');
    expect(s.players.self.hand, '加えた(+1) → discard(-1) で手札 1 枚').toHaveLength(1);
    // discard された 1 枚 (B01016 か B01086 いずれか) が remove へ (B07086 自身 + discard = 2)
    expect(s.players.self.remove.length, '自身 leave + discard1 = remove 2 枚').toBe(2);
  });

  it('B07086: over-fire guard — 榎本梓が無ければ加えず discard も発火しない (公式Q&A)', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B07086', 'enom#1')];
    s.players.self.hand = ['B01016'];
    s.players.self.deck = [FB, FB, FB]; // 榎本梓 不在 → 加えない
    s = drive(s, 'enom#1');
    expect(s.players.self.hand, '加えていないので discard 不発 (手札 B01016 残存)').toEqual(['B01016']);
    expect(s.players.self.remove, 'remove は自身 leave のみ (discard 不発)').toEqual(['B07086']);
  });

  it('B07086: a1 = 〚ミスリード1〛 (icon-misread)', () => {
    expect(B07086.abilities[0].type).toBe('icon-misread');
  });

  // ---------- B07043 寺井黄之助: leave → choice(3名) → reveal-until → hand ----------
  it('B07043: AI は option0(黒羽盗一) を実行 — 黒羽盗一(B02046) を手札へ', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B07043', 'terai#1')];
    s.players.self.deck = [FB, 'B02046', FB, FB]; // 黒羽盗一 B02046
    s = drive(s, 'terai#1');
    expect(s.players.self.hand, 'choice option0 (黒羽盗一 B02046) を手札へ').toContain('B02046');
    expect(s.players.self.deck, 'B02046 はデッキから抜けた').not.toContain('B02046');
  });

  it('B07043: choice 3択構造 (黒羽盗一/黒羽快斗/怪盗キッド)', () => {
    const eff = B07043.abilities[0].effect as { kind: string; options: unknown[] };
    expect(eff.kind).toBe('choice');
    expect(eff.options).toHaveLength(3);
  });

  // ---------- B02058 赤井秀一: a1 登場時 handCountAtLeastOther→opp discard1 / a2 leave reveal-until ----------
  // a1 は実 enter hook 経由で駆動 (remove から効果登場 → enter hook → a1 queue → 解決)。
  // runEffect で conditional 直叩きすると discard の pick が event pipeline を通らず drain されないため不可。
  const enterFromRemove = (s: GameState): GameState =>
    produce(s, (d) => {
      d.players.self.remove = ['B02058'];
      runEffect(
        d,
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B02058', from: 'remove', viaEffect: true } } as never,
        makeCtx({ source: { player: 'self', area: 'scene' } }),
      );
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });

  it('B02058 a1: 相手手札 >= 自手札 なら 相手が手札1枚 discard', () => {
    let s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['X']; // 自 1
    s.players.opp.hand = ['Y']; // 相手 1 (>= 1 → 成立)
    s = enterFromRemove(s);
    expect(s.players.self.scene.find((c) => c.cardId === 'B02058'), 'B02058 登場').toBeTruthy();
    expect(s.players.opp.hand, '相手手札 1>=1 成立 → 相手 discard1').toHaveLength(0);
    expect(s.players.opp.remove, 'discard した Y は相手 remove へ').toContain('Y');
  });

  it('B02058 a1: 相手手札 < 自手札 なら discard しない', () => {
    let s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['X', 'Z']; // 自 2
    s.players.opp.hand = ['Y']; // 相手 1 (< 2 → 不成立)
    s = enterFromRemove(s);
    expect(s.players.opp.hand, '相手手札 1<2 → discard 不発').toEqual(['Y']);
  });

  it('B02058 a2: 相手ターン現場リムーブ — 沖矢昴(B02059) を手札へ', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B02058', 'akai#1')];
    s.players.self.deck = [FB, 'B02059', FB, FB];
    s = drive(s, 'akai#1');
    expect(s.players.self.hand, '沖矢昴 B02059 を手札に加える').toContain('B02059');
    expect(s.players.self.deck, 'B02059 はデッキから抜けた').not.toContain('B02059');
  });

  // ---------- parallel 同一性 ----------
  it('B02058 / B02058P: abilities 構造同一 (parallel)', () => {
    expect(B02058P.abilities).toEqual(B02058.abilities);
  });

  // ---------- 全カード leave 構造同型 ----------
  it('leave 系 a (B05021/B03019a1/B05077/B07086a2/B07043/B02058a2): trigger=leave:to-remove selfOnly + turn:opp', () => {
    const leaveAbilities = [B05021.abilities[0], B03019.abilities[0], B05077.abilities[0], B07086.abilities[1], B07043.abilities[0], B02058.abilities[1]];
    for (const a of leaveAbilities) {
      expect(a.trigger).toEqual({ hook: 'leave:to-remove', selfOnly: true });
      expect(a.condition).toEqual({ kind: 'turn', player: 'opp' });
    }
  });
});
