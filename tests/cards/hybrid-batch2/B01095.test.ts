// hybrid-batch2 probe — B01095 「僕の日本から…」 (event, 黄, Lv7)
//
// 公式テキスト (refusedLine, 全句 novel):
//   【パートナー黄】カード名を1つ指定し、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、
//   好きな順番でデッキの下に移す）する。指定したカード名のカードが発見された場合、キャラを2枚まで選び、
//   スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// DSL (src/cards/ct-p01/B01095.ts a1):
//   triggered / on-hand / hook:effect:declared selfOnly matcher(kind==='event-use')
//   condition partnerColor '黄'
//   effect sequence[ declareName{bind:'named'},
//                    souza{player:'opp', x:1, bind:'$found'},
//                    conditional{ if boundNameMatchesDeclared{bindKey:'$found', declareKey:'named'},
//                                 then sceneSetState{player:'self', state:'stun', side:'either', max:2} } ]
//
// 実 engine flow で駆動 (verb 直呼び禁止、B01076 exemplar 同一ハーネス):
//   handUseCard('self','B01095') → hand-use-card.ts:196 emit 'effect:declared' {kind:'event-use',cardId,player}
//   → triggered listener が a1 発火 (selfOnly + matcher) → condition partnerColor 黄 gate
//   → sequence を runAllUntilEmpty で解決。
//
// rules: 03 (スタン状態), 13 (捜査X), 15 (「〜まで」=0可 / 発見された参照), 17 (【パートナー色】条件外=持たない扱い),
//        20 (手札の使用 色制限), 24 (スタン特殊挙動).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import { B01095 } from '@/cards/ct-p01/B01095';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'FILL' };
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('YPART', { colors: ['黄'] }),     // 黄 パートナー (partnerColor 黄 成立)
  def('BPART', { colors: ['青'] }),     // 青 パートナー (条件外 → a1 発火せず)
  def('MATCH', { names: ['MATCH'] }),   // souza で発見される相手デッキ top (「発見された」カード)
  def('DA'), def('DB'), def('DC'),      // 相手デッキ順序 decoy
  def('TS'),                            // 自陣 stun 対象候補
  def('TO'),                            // 相手陣 stun 対象候補 (owner=opp pin, BUG-174)
];

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

// 手札の使用ゲート充足: event 黄 = case.colors に 黄 / level7 ≤ FILE7 / handUseUsed 未 / main / turn self
function base(partner = 'YPART'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B01095'];
  s.players.self.case.colors = ['黄'];
  s.players.self.partner.cardId = partner;
  s.players.self.file = Array.from({ length: 7 }, () => ({ ...FB }));
  s.players.self.deck = ['FILL', 'FILL'];
  s.players.opp.deck = ['DA', 'DB', 'DC'];
  return s;
}

const use = (s0: GameState) => produce(s0, (d) => {
  handUseCard(d, 'self', 'B01095');
  for (let i = 0; i < 4; i++) {
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    drainAiEffectPicks(d);
  }
});

const allStunned = (s: GameState) =>
  [...s.players.self.scene, ...s.players.opp.scene].filter((c) => c.state === 'stun');

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B01095, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B01095 「僕の日本から…」 — hybrid-batch2 probe (event-use trigger)', () => {
  // ===== 1. partnerColor 黄 gate (positive) + souza 実行 =====
  it('パートナー黄 → a1 発火 → 〚捜査1〛が相手デッキ top を最下へ (production 観測)', () => {
    const before = base('YPART');
    const after = use(before);
    // 手札の使用 = イベント消費 (rules/06)
    expect(after.players.self.hand.includes('B01095'), 'B01095 は使用済で手札から消える').toBe(false);
    expect(after.players.self.remove.includes('B01095'), 'B01095 はリムーブエリアへ').toBe(true);
    // 捜査1: top DA が最下へ → [DB, DC, DA]
    expect(after.players.opp.deck, '相手デッキ top1 枚が最下へ回る (捜査1)').toEqual(['DB', 'DC', 'DA']);
  });

  // ===== 2. partnerColor gate (negative) — 青パートナー → 発火しない (条件外=持たない扱い rules/17) =====
  it('パートナー青 → a1 不発 (partnerColor 黄 条件外) → 相手デッキ不変', () => {
    const before = base('BPART');
    const after = use(before);
    expect(after.players.opp.deck, '捜査が走らない → 相手デッキ順序不変').toEqual(['DA', 'DB', 'DC']);
    expect(allStunned(after).length, 'スタンも発生しない').toBe(0);
  });

  // ===== 3. souza x1 = 1 枚のみ公開・最下へ (relative reorder / bind $found の入力を isolate) =====
  it('〚捜査1〛は 1 枚だけ (top1) を最下へ、2 枚目以降は動かない', () => {
    const before = base('YPART');
    before.players.opp.deck = ['MATCH', 'DA', 'DB', 'DC'];
    const after = use(before);
    // MATCH (top) のみ最下、残りは相対順序保持
    expect(after.players.opp.deck, 'top MATCH のみ最下へ').toEqual(['DA', 'DB', 'DC', 'MATCH']);
  });

  // ===== 4. payoff branch: 発見カードが「指定したカード名」に一致した場合 スタン (最大2, either side) =====
  // ⚠ event-use トリガでは declareName の供給チャネル (ctx.dyn.declaredName) が engine 側で配線されて
  //    いない (下記 CARD_BUG 参照)。ここでは「発見された MATCH ＝ 指定名 MATCH」が成立するはずの盤面で
  //    実 production 挙動を観測する。
  it('payoff: 相手デッキ top=MATCH を発見、自陣/相手陣に stun 対象 → production では何が起きるか観測', () => {
    const before = base('YPART');
    before.players.opp.deck = ['MATCH', 'DA', 'DB'];
    before.players.self.scene = [sc('TS', 'ts1')];   // 自陣 stun 対象
    before.players.opp.scene = [sc('TO', 'to1')];    // 相手陣 stun 対象 (owner=opp pin, BUG-174)
    const after = use(before);
    // 前段 souza は実行済 (MATCH 発見 = $found に bind)
    expect(after.players.opp.deck, 'souza は実行 (MATCH 発見 → 最下)').toEqual(['DA', 'DB', 'MATCH']);
    // 観測: production event-use 経路でスタンが発生するか
    const stunned = allStunned(after);
    // 診断出力 (green/red いずれでも root-cause を残す)

    console.log('[B01095 payoff probe] stunned uids =', stunned.map((c) => c.uid));
    expect(stunned.length, 'production event-use での stun 発生枚数').toBe(0);
  });
});
