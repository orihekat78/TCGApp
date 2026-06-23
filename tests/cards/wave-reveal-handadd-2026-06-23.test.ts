// wave reveal-handadd (2026-06-23, cards/wave-reveal-handadd) — engine変更0
//
// 検証対象 (10 枚 / 6 rep): B02050 中森銀三 (reveal-until keyword[変装]→hand→deck下→shuffle) /
//   B05114 弁崎桐平 (declared selfToDeckBottom: reveal-until cardName[バーボン]→hand→deck下→shuffle) /
//   B05082+P 「FBI…」(event: reveal5 upTo 特徴[FBI]キャラ→hand→remove → 手札からFBI≤6登場) /
//   B07010 円谷光彦 (a1 reveal2 upTo 少年探偵団→hand→remove + 解決編&加えた discard1 / a2 宣言 AP+3000) /
//   B09074+P+P2 松田陣平 (a1 疾風 draw / a2 reveal4 upTo keyword[疾風]→hand→deck下 + 加えた discard1) /
//   D10003+D10004 黒衣の騎士・スペイド (a1 事件[シャッフルロマンス]→突撃 continuous / a2 reveal-until cardName[シャッフルロマンス]→hand→deck下→shuffle)。
//
// engine変更0: deckRevealUntil (maxN/chooseMatch:upTo|forced) + handAddFromDeck + boundToRemove/deckToBottomBound +
//   deckShuffle + sceneEnter(from:hand) + charModifyAP + caseTraitConditioned(continuous grantKeywords) の既存 settled path 合成。
//   exemplar: B05016/B02019 (deck-look) / B06053/B07052 a2 (reveal-until) / D07008 (sceneEnter from hand) /
//   D11003 (疾風) / B07052 a1 (caseTrait突撃)。
// BUG-117/118 lesson: DSL に filter を書いても engine 実評価の保証はない → decoy を盤面/デッキに置き outcome で 1対1 検証。
//   keyword filter (変装/疾風) は実能力持ち card (D06012/B07097) を match、stub decoy を非該当に置く。
// rules: 13/14/15/17/19/20/21/26 + TSV qAndA (B02050/B05114/B05082/B07010/B09074/D10003)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { read } from '@/engine/read/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards/index';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, AbilityDef } from '@/engine/types';
import { B02050 } from '@/cards/ct-p02/B02050';
import { B05114 } from '@/cards/ct-p05/B05114';
import { B05082 } from '@/cards/ct-p05/B05082';
import { B05082P } from '@/cards/ct-p05/B05082P';
import { B07010 } from '@/cards/ct-p07/B07010';
import { B09074 } from '@/cards/ct-p09/B09074';
import { B09074P } from '@/cards/ct-p09/B09074P';
import { B09074P2 } from '@/cards/ct-p09/B09074P2';
import { D10003 } from '@/cards/ct-d10/D10003';
import { D10004 } from '@/cards/ct-d10/D10004';

const policy = new HeuristicPolicy();

// ---- stub registrars (decoy / 非keyword match target) ----
function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function pevent(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function pcase(id: string, caseTraits: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'case', names: [id], colors: ['白'], traits: [], rarity: 'C', imageUrl: '', caseLevel: 7, caseTraits, abilities: [], ruleRefs: [] };
}
const ctxFor = (cardId: string, uid = 'u'): EffectCtx => ({ source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} });
const DECOY = 'DEC_PLAIN'; // 中立 stub (変装/疾風/FBI/少年探偵団/バーボン/シャッフルロマンス いずれも非該当)
const drive = (s: GameState, eff: AbilityDef['effect'], cardId: string, uid = 'src#1'): GameState =>
  produce(s, (d) => { runEffect(d, eff!, ctxFor(cardId, uid)); _drainAllEffectPicksForTest(d, policy); });

describe('wave reveal-handadd — reveal/deck-look→hand-add (engine変更0)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    _resetUidCounter();
    registerAll();
    registerTriggeredListener();
    registerCardDef(pchar(DECOY));
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ============ B02050 中森銀三: reveal-until keyword[変装] ============
  it('B02050: 変装持ち(D06012=怪盗キッド)が出るまで公開→手札 / 非変装(DECOY)はデッキ下(remove でない)→shuffle', () => {
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, 'D06012', DECOY, DECOY]; // top: DECOY(非変装) → D06012(変装 match)
    const after = drive(s, B02050.abilities[0].effect, 'B02050');
    expect(after.players.self.hand, '変装持ち D06012 を手札へ').toContain('D06012');
    expect(after.players.self.deck, 'D06012 はデッキから抜ける').not.toContain('D06012');
    expect(after.players.self.deck, '非変装 DECOY はデッキ下へ戻る (remove でない)').toContain(DECOY);
    expect(after.players.self.remove.length, 'reveal-until は remove へ送らない').toBe(0);
  });

  it('B02050: デッキに変装持ちが無ければ何も加えず全部デッキに残る (公式Q&A 全公開→shuffle)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, DECOY];
    const after = drive(s, B02050.abilities[0].effect, 'B02050');
    expect(after.players.self.hand.length, '何も加えない').toBe(0);
    expect(after.players.self.deck.length, '全部デッキに残る').toBe(2);
  });

  // ============ B05114 弁崎桐平: declared selfToDeckBottom + reveal-until cardName[バーボン] ============
  it('B05114: cardName[バーボン]が出るまで公開→手札 / 非該当はデッキ下→shuffle', () => {
    registerCardDef(pchar('BOURBON', { names: ['バーボン'] }));
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, 'BOURBON', DECOY];
    const after = drive(s, B05114.abilities[0].effect, 'B05114');
    expect(after.players.self.hand, 'バーボン を手札へ').toContain('BOURBON');
    expect(after.players.self.deck, '非該当 DECOY はデッキ下').toContain(DECOY);
    expect(after.players.self.remove.length, 'reveal-until は remove へ送らない').toBe(0);
  });

  it('B05114: cost = selfToDeckBottom (スリープ無し、declared)', () => {
    const a1 = B05114.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.cost).toEqual({ kind: 'selfToDeckBottom' });
  });

  // ============ B05082 「FBI…」(event): reveal5 upTo FBIキャラ→hand→remove → 手札からFBI≤6登場 ============
  it('B05082: 上5枚から特徴[FBI]キャラ(match)を手札→非該当(DECOY)はremove→手札のFBI≤6を登場', () => {
    registerCardDef(pchar('FBI_DECK', { traits: ['FBI'], level: 4 })); // deck-reveal match
    registerCardDef(pchar('FBI_HAND', { traits: ['FBI'], level: 6 })); // hand sceneEnter match (≤6)
    registerCardDef(pevent('FBI_EV', { traits: ['FBI'] }));            // FBI *event* = kind:character 違反 decoy
    const s = createEmptyGameState();
    // top5 = [FBI_EV, FBI_DECK, DECOY×3] を reveal、以降の DECOY×3 は deck に残し boundToRemove 後の refresh を回避
    s.players.self.deck = ['FBI_EV', 'FBI_DECK', DECOY, DECOY, DECOY, DECOY, DECOY, DECOY];
    s.players.self.hand = ['FBI_HAND'];
    const after = drive(s, B05082.abilities[0].effect, 'B05082');
    expect(after.players.self.hand, 'FBI_DECK を手札へ').toContain('FBI_DECK');
    expect(after.players.self.remove, '非該当 DECOY は remove へ (boundToRemove)').toContain(DECOY);
    expect(after.players.self.remove, 'FBI_EV(event) は match せず remove へ').toContain('FBI_EV');
    expect(after.players.self.scene.some((c) => c.cardId === 'FBI_HAND'), '手札の FBI≤6 を登場').toBe(true);
    expect(after.players.self.hand, '登場した FBI_HAND は手札から抜ける').not.toContain('FBI_HAND');
  });

  it('B05082P: P 版も同一効果 (event-use trigger + reveal→hand→remove→sceneEnter)', () => {
    const a1 = B05082P.abilities[0];
    expect(a1.scope).toBe('on-hand');
    const steps = (a1.effect as { steps: Array<{ verb?: string }> }).steps;
    expect(steps.map((x) => x.verb).filter(Boolean)).toEqual(['deckRevealUntil', 'boundToRemove', 'sceneEnter']);
  });

  // ============ B07010 円谷光彦: a1 reveal2 + 解決編&加えた discard1 / a2 宣言 AP+3000 ============
  it('B07010 a1: 少年探偵団(match)を手札→非該当remove / 【解決編】かつ加えた → 手札1リムーブ', () => {
    registerCardDef(pchar('SHONEN', { traits: ['少年探偵団'] }));
    const s = createEmptyGameState();
    s.players.self.case = { cardId: 'c', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } as GameState['players']['self']['case'];
    s.players.self.deck = [DECOY, 'SHONEN', DECOY];
    s.players.self.hand = ['H1', 'H2']; // discard 対象
    const after = drive(s, B07010.abilities[0].effect, 'B07010');
    expect(after.players.self.hand, 'SHONEN を手札へ').toContain('SHONEN');
    expect(after.players.self.remove, '非該当 DECOY は remove へ').toContain(DECOY);
    // 加えた(SHONEN) + 解決編 → 手札1リムーブ。元手札 H1/H2 + SHONEN = 3 → 1 discard で 2
    expect(after.players.self.hand.length, '解決編&加えた → 手札1リムーブ').toBe(2);
  });

  it('B07010 a1: 【事件編】では加えても discard しない (caseStatus gate)', () => {
    registerCardDef(pchar('SHONEN', { traits: ['少年探偵団'] }));
    const s = createEmptyGameState();
    s.players.self.case = { cardId: 'c', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } as GameState['players']['self']['case'];
    s.players.self.deck = ['SHONEN', DECOY];
    s.players.self.hand = ['H1', 'H2'];
    const after = drive(s, B07010.abilities[0].effect, 'B07010');
    expect(after.players.self.hand, 'SHONEN 追加で 3 枚 (discard なし)').toHaveLength(3);
  });

  it('B07010 a1: 解決編でも加えなかった(no-match)なら discard しない (over-fire guard)', () => {
    const s = createEmptyGameState();
    s.players.self.case = { cardId: 'c', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } as GameState['players']['self']['case'];
    s.players.self.deck = [DECOY, DECOY]; // 少年探偵団 不在 → no-match
    s.players.self.hand = ['H1', 'H2'];
    const after = drive(s, B07010.abilities[0].effect, 'B07010');
    expect(after.players.self.hand, 'no-match → discard なし').toHaveLength(2);
  });

  it('B07010 a2: 宣言 sleepSelf + charModifyAP{少年探偵団, +3000, turn}', () => {
    const a2 = B07010.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.cost).toEqual({ kind: 'sleepSelf' });
    expect((a2.effect as { verb: string; args: Record<string, unknown> }).verb).toBe('charModifyAP');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({ delta: 3000, scope: 'turn', filter: { trait: '少年探偵団' } });
  });

  // ============ B09074 松田陣平: a1 疾風 draw / a2 reveal4 keyword[疾風] + 加えた discard ============
  it('B09074 a1: 疾風 = enter+enterOrderEquals(1) → draw1', () => {
    const a1 = B09074.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } });
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, DECOY];
    const after = drive(s, a1.effect, 'B09074');
    expect(after.players.self.hand, '疾風 draw1').toHaveLength(1);
  });

  it('B09074 a2: 疾風持ち(D11003=萩原千速)を手札→非該当(DECOY)はデッキ下 + 加えた→手札1リムーブ', () => {
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, 'D11003', DECOY, DECOY]; // D11003 = 疾風 ability 持ち (enterOrderEquals, match)
    s.players.self.hand = ['H1', 'H2'];
    const after = drive(s, B09074.abilities[1].effect, 'B09074');
    expect(after.players.self.hand, '疾風持ち D11003 を手札へ').toContain('D11003');
    expect(after.players.self.deck, '非該当 DECOY はデッキ下 (remove でない)').toContain(DECOY);
    expect(after.players.self.remove, 'reveal 公開カードは remove へ行かない (deckToBottom)').not.toContain(DECOY);
    // 加えた(D11003) → 手札1リムーブ。元 H1/H2 + D11003 = 3 → 1 discard で 2 (discard 分が remove に1枚)
    expect(after.players.self.hand.length, '加えた→手札1リムーブ').toBe(2);
    expect(after.players.self.remove.length, 'discard した手札1枚のみ remove').toBe(1);
  });

  it('B09074 a2: 疾風持ち不在(no-match)なら discard しない (over-fire guard)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, DECOY, DECOY, DECOY];
    s.players.self.hand = ['H1', 'H2'];
    const after = drive(s, B09074.abilities[1].effect, 'B09074');
    expect(after.players.self.hand, 'no-match → discard なし').toHaveLength(2);
  });

  it('B09074P/P2: P 版も同一 2能力 (疾風 a1 + 登場時 a2)', () => {
    for (const card of [B09074P, B09074P2]) {
      expect(card.abilities[0].trigger).toMatchObject({ matcherCondition: { kind: 'enterOrderEquals', n: 1 } });
      expect((card.abilities[1].effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args).toMatchObject({ filter: { keyword: '疾風', kind: 'character' }, maxN: 4 });
    }
  });

  // ============ D10003/D10004 黒衣の騎士・スペイド: a1 caseTrait突撃 / a2 reveal-until cardName ============
  it('D10003 a1: 事件が特徴[シャッフルロマンス]を持つ間のみ continuous で突撃 (caseTrait gate)', () => {
    registerCardDef(pcase('SHUFFLE_CASE', ['シャッフルロマンス']));
    registerCardDef(pcase('PLAIN_CASE', ['まじっく快斗']));
    const s1 = createEmptyGameState();
    s1.players.self.case = { cardId: 'SHUFFLE_CASE', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as GameState['players']['self']['case'];
    s1.players.self.scene = [makeChar({ cardId: 'D10003', uid: 'spade#1', state: 'active' })];
    expect(read.char.keywords(s1, 'spade#1'), 'シャッフルロマンス事件 → 突撃').toContain('突撃');
    const s2 = createEmptyGameState();
    s2.players.self.case = { cardId: 'PLAIN_CASE', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as GameState['players']['self']['case'];
    s2.players.self.scene = [makeChar({ cardId: 'D10003', uid: 'spade#1', state: 'active' })];
    expect(read.char.keywords(s2, 'spade#1'), '非シャッフルロマンス事件 → 突撃なし').not.toContain('突撃');
  });

  it('D10003 a1 構造: caseTraitConditioned(シャッフルロマンス) + continuous grantKeywords[突撃]', () => {
    const a1 = D10003.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'caseTrait', trait: 'シャッフルロマンス' });
    expect((a1.continuousModifier as { grantKeywords: () => string[] }).grantKeywords()).toEqual(['突撃']);
    // 二重prefix回帰防止 (敵対review WARN): caseTraitConditioned が 【事件X】 を1回だけ付与する
    expect(a1.description, 'description は【事件シャッフルロマンス】が1回だけ (二重prefix無し)').toBe('【事件シャッフルロマンス】〚突撃〛（登場したターンからすぐにアクションできる）');
  });

  it('D10003 a2: cardName[シャッフルロマンス]を手札へ→非該当はデッキ下→shuffle', () => {
    registerCardDef(pevent('SHUFFLE_EV', { names: ['シャッフルロマンス'] }));
    const s = createEmptyGameState();
    s.players.self.deck = [DECOY, 'SHUFFLE_EV', DECOY];
    const after = drive(s, D10003.abilities[1].effect, 'D10003');
    expect(after.players.self.hand, 'シャッフルロマンス を手札へ').toContain('SHUFFLE_EV');
    expect(after.players.self.deck, '非該当 DECOY はデッキ下').toContain(DECOY);
    expect(after.players.self.remove.length, 'reveal-until は remove へ送らない').toBe(0);
  });

  it('D10004: 別アート版も D10003 と同一 2能力 + names 全分割 (rules/19)', () => {
    expect(D10004.names).toEqual(['黒衣の騎士・スペイド（工藤新一）', '黒衣の騎士・スペイド', '工藤新一']);
    expect(D10004.abilities[0].condition).toEqual({ kind: 'caseTrait', trait: 'シャッフルロマンス' });
    expect((D10004.abilities[1].effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args).toMatchObject({ filter: { cardName: 'シャッフルロマンス' } });
  });
});
