// WC2a RUNTIME behavior — pick chooser 'opp-of-owner' 実配線 (B05093 榎本梓 exemplar)。
//
// 公式テキスト (B05093):
//   【登場時】自分のデッキのカードを上から3枚公開する。相手はその中からイベントか〚特徴［喫茶ポアロ］〛の
//   キャラを1枚選び、自分はそれを手札に加える。残りを自分が好きな順番でデッキの下に移す。
//   Q&A: イベントか[喫茶ポアロ]キャラが公開されれば相手は必ず1枚選び、自分は必ず手札に加える。
//
// engine gap (WC2a): pick query.chooser='opp-of-owner' を resolve-picks の chokepoint が owner 相対で
//   絶対 opp 側へ解決 (pending.player=opp)。owner≠chooser の再実行座標系は BUG-175 pending.ownerPlayer。
//   → owner=self・chooser=opp: 相手 (AI) が選び、恩恵 (hand-add) は自分。
//   → owner=opp・chooser=self: 自分 (human) が選ぶ = pending.player==='self' で modal surface。
//
// 実 engine flow で駆動 (verb 直呼びしない): sceneEnter で効果登場 → 【登場時】trigger →
//   sequence[deckRevealUntil, handAddFromDeck(pick chooser:opp-of-owner), deckToBottomBound]。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import {
  _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength, _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';

// DECOY: filterAny (event OR [喫茶ポアロ]キャラ) を outcome で 1対1 証明する window カード。
const EV1 = 'WC2_EV1';           // event → branch1 (kind:'event') match
const POIR = 'WC2_POIR';         // character 特徴[喫茶ポアロ] → branch2 match
const NONMATCH = 'WC2_NONMATCH'; // character 特徴[探偵] (非[喫茶ポアロ] / 非event) → 両 branch 非該当
const FILLER = 'WC2_FILLER';     // deck 下部フィラー (公開されない = 3枚目以降)

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function pevent(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (side: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side; };

function registerDecoys(): void {
  registerCardDef(pevent(EV1));
  registerCardDef(pchar(POIR, { traits: ['喫茶ポアロ'] }));
  registerCardDef(pchar(NONMATCH, { traits: ['探偵'] }));
  registerCardDef(pchar(FILLER, { traits: [] }));
}

// sceneEnter を効果登場として駆動 (owner=player の scene に literal cardId で登場)。
function summon(player: 'self' | 'opp', cardId: string): { eff: Effect; ctx: EffectCtx } {
  // side:'self' は summoner ctx.source.player 相対 = 当該 player の remove から。
  const eff = { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } } as unknown as Effect;
  const ctx = { source: { cardId: 'SUMMONER', uid: 'sm#1', abilityId: 'a', player, area: 'scene' }, bindings: {} } as EffectCtx;
  return { eff, ctx };
}

const inHand = (s: GameState, side: 'self' | 'opp', id: string) => s.players[side].hand.includes(id);
const inDeck = (s: GameState, side: 'self' | 'opp', id: string) => s.players[side].deck.includes(id);

describe('WC2a — pick chooser opp-of-owner (B05093 榎本梓 deck-reveal, 相手が選ぶ)', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    setHuman(null);
    registerAll();       // B05093 / B01048 込み
    registerDecoys();
    registerTriggeredListener();
  });

  // ============================================================
  // ① owner=self・chooser=opp: 相手 (AI) が選び、自分の手札へ。非該当は候補外。
  // ============================================================
  it('owner=self chooser=opp: 相手(AI)が event/[喫茶ポアロ] を1枚選び自分の手札へ / 非該当は選ばれない', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.remove = ['B05093'];
    s.players.self.deck = [EV1, POIR, NONMATCH, FILLER]; // top3 = EV1/POIR/NONMATCH
    setHuman('self'); // opp = 非human → drainAiEffectPicks が opp-chooser pick を解決
    const { eff, ctx } = summon('self', 'B05093');
    s = produce(s, (d) => {
      runEffect(d, eff, ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    // 恩恵 = 自分 (owner): 手札に加わったのは {EV1, POIR} のいずれか **1枚だけ**。
    const handMatches = [EV1, POIR].filter((id) => inHand(s, 'self', id));
    expect(handMatches.length, '選ばれた1枚 (event or [喫茶ポアロ]キャラ) が自分の手札へ').toBe(1);
    expect(inHand(s, 'self', NONMATCH), '非該当 [探偵]キャラは候補外 = 手札に入らない').toBe(false);
    // 残り (非選択の2枚) はデッキの下へ。NONMATCH は必ず deck に残る (加えられないため)。
    expect(inDeck(s, 'self', NONMATCH), '非該当は加えられずデッキに残る').toBe(true);
    const picked = handMatches[0]!;
    expect(inDeck(s, 'self', picked), '加えたカードは deck から抜けた').toBe(false);
    expect(_peekPendingEffectPickQueueLength(), 'pending は解決済 (queue 空)').toBe(0);
  });

  it('owner=self: 該当カードが1枚も公開されなければ何も加えず全部デッキ下 (n{1,1} 候補0 no-op)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.remove = ['B05093'];
    // top3 全て非該当 ([探偵]char ×3)。event も [喫茶ポアロ] も無し。
    registerCardDef(pchar('WC2_N2', { traits: ['探偵'] }));
    registerCardDef(pchar('WC2_N3', { traits: ['刑事'] }));
    s.players.self.deck = [NONMATCH, 'WC2_N2', 'WC2_N3', FILLER];
    setHuman('self');
    const { eff, ctx } = summon('self', 'B05093');
    s = produce(s, (d) => {
      runEffect(d, eff, ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand.length, '該当0 → 何も手札に加えない').toBe(0);
    expect(_peekPendingEffectPickQueueLength(), '候補0 は pending を積まない').toBe(0);
    // 3枚は全部デッキに残る (下へ)。
    for (const id of [NONMATCH, 'WC2_N2', 'WC2_N3']) {
      expect(inDeck(s, 'self', id), `${id} は加えられずデッキに残る`).toBe(true);
    }
  });

  // ============================================================
  // ② owner=opp・chooser=self: 自分 (human) が選ぶ = pending.player==='self' で surface。
  // ============================================================
  it('owner=opp chooser=self: 相手のカードだが選ぶのは自分(human) → pending.player=self で surface (AI drain されない)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.remove = ['B05093'];
    s.players.opp.deck = [EV1, POIR, NONMATCH, FILLER];
    setHuman('self'); // 自分 = human。owner=opp の chooser 'opp-of-owner' = self。
    const { eff, ctx } = summon('opp', 'B05093');
    s = produce(s, (d) => {
      runEffect(d, eff, ctx);
      runAllUntilEmpty(d);
      // drain しない: pending.player=self は human 用に温存されるはず。
    });
    expect(_peekPendingEffectPickQueueLength(), '未解決 pending が1件残る (human surface 待ち)').toBe(1);
    const pending = _drainPendingEffectPickSide()!;
    expect(pending.player, 'chooser=自分(human) 側に surface').toBe('self');
    expect(pending.ownerPlayer, '能力所有者は opp (BUG-175 再実行座標系)').toBe('opp');
    const candIds = pending.candidates.map((c) => c.cardId).sort();
    expect(candIds, '候補は opp デッキ window の event/[喫茶ポアロ] のみ (非該当除外)').toEqual([EV1, POIR].sort());
    expect(pending.candidates.every((c) => c.player === 'opp'), '候補は opp デッキ由来').toBe(true);
  });

  // ============================================================
  // ③ 既存 owner-chooser (chooser:'self') 回帰: B01048 の handAddFromDeck bind 経路が不変。
  //    (WC2a の chokepoint は 'opp-of-owner' のみ opp 反転、他は byte 等価 / 新 await-pick 分岐は
  //     rawCardId==='$pick.cardId' gate ゆえ $matched.cardId bind 経路を踏まない)。
  // ============================================================
  it('regression: B01048 (owner-chooser 宣言 deck-reveal, handAddFromDeck bind) は自分の手札へ加わる', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B01048', 'sono#1', { state: 'active' })];
    registerCardDef(pchar('WC2_A', {}));
    registerCardDef(pchar('WC2_B', {}));
    s.players.self.deck = ['WC2_A', 'WC2_B', FILLER];
    setHuman('self');
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'sono#1', 'a1'); // cost sleepSelf → effect queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    // filter:()=>true → 先頭 WC2_A が $matched → 自分の手札へ (owner-chooser、opp に振れていない)。
    expect(inHand(s, 'self', 'WC2_A'), 'B01048 は自分の手札に加える (owner-chooser 不変)').toBe(true);
    expect(inHand(s, 'opp', 'WC2_A'), 'opp の手札には入らない (chooser 反転していない)').toBe(false);
    expect(s.players.self.scene.find((c) => c.uid === 'sono#1')?.state, 'cost sleepSelf 適用').toBe('sleep');
  });
});
