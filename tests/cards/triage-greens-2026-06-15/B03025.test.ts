// gate5 RUNTIME behavior — B03025 「え？取材？」 (event, 青, Lv6)
//
// 公式テキスト:
//   自分のデッキのカードを上から5枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、
//   残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［少年探偵団］〛のキャラを1枚まで登場させる。
//
// rules: 14-refresh.md / 15-abilities-effects.md (「〜まで」=0枚可) / 17-icons.md /
//        20-color-and-switch.md (効果による登場=色制限なし) / 26-qa-deck-refresh.md (reveal中はデッキ扱い)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('B03025') → effect:declared(event-use) trigger 発火 → runAllUntilEmpty +
//   drainAiEffectPicks (from-hand sceneEnter 短縮形 pick を AI 解決)。
//
// 検証する filter (BUG-117/118 lesson):
//   (A) deckReveal filter {trait:少年探偵団, kind:character} — top5 の非該当 (trait違い / event種別) は
//       手札に **加えられず** リムーブへ移る。
//   (B) sceneEnter filter {trait:少年探偵団, levelMax:6, kind:character} — 手札の非該当
//       (trait違い / Lv7) は **登場しない**。
//   (C) NEGATIVE: 「1枚まで」(0枚可) — deck top5 に該当キャラが居なければ手札に何も加えず全5枚リムーブ /
//       手札に該当キャラが居なければ誰も登場しない。

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

// ---- synthetic decoy defs (prefix DEC_B03025_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// deck-reveal: 該当 (少年探偵団 character)。Lv7 にして sceneEnter (levelMax6) の対象外にし、
//   from-hand 登場 pick を手札候補に一意化する (deck から手札へ加わった後も sceneEnter 候補に
//   ならないため、登場するのは手札の DEC_B03025_HAND_HIT のみ)。
const DECK_HIT = 'DEC_B03025_DECK_HIT';
// deck-reveal: decoy A — trait 違い (警察)。手札に加えられず リムーブへ。
const DECK_TRAIT_DECOY = 'DEC_B03025_DECK_TRAITDECOY';
// deck-reveal: decoy B — kind:event。手札に加えられず リムーブへ (kind filter)。
const DECK_EVENT_DECOY = 'DEC_B03025_DECK_EVENTDECOY';
// deck filler (top5 外、refresh を避けるため deck を 0 にしない)。
const DECK_FILLER = 'DEC_B03025_DECK_FILLER';

// sceneEnter: 該当 (少年探偵団 Lv6 character) — 唯一の有効候補 → 登場するはず。
const HAND_HIT = 'DEC_B03025_HAND_HIT';
// sceneEnter: decoy A — trait 違い (探偵 Lv1)。登場しない。
const HAND_TRAIT_DECOY = 'DEC_B03025_HAND_TRAITDECOY';
// sceneEnter: decoy B — 少年探偵団 だが Lv7 (> levelMax6)。登場しない。
const HAND_LV7_DECOY = 'DEC_B03025_HAND_LV7DECOY';

function registerDecoys(): void {
  registerCardDef(ch(DECK_HIT, { traits: ['少年探偵団'], level: 7 }));
  registerCardDef(ch(DECK_TRAIT_DECOY, { traits: ['警察'], level: 2 }));
  registerCardDef(ch(DECK_EVENT_DECOY, { kind: 'event', traits: [], level: 2 }));
  registerCardDef(ch(DECK_FILLER, { traits: [], level: 1 }));
  registerCardDef(ch(HAND_HIT, { traits: ['少年探偵団'], level: 6 }));
  registerCardDef(ch(HAND_TRAIT_DECOY, { traits: ['探偵'], level: 1 }));
  registerCardDef(ch(HAND_LV7_DECOY, { traits: ['少年探偵団'], level: 7 }));
}

/** 実 engine flow: イベント使用 → effect:declared trigger → 解決 + pick drain。 */
function fire(build: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case.colors = ['青']; // B03025=青 (色制限 rules/20)
  s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 ≥ level6 → 手札使用可
  build(s);
  s = produce(s, (d) => {
    handUseCard(d, 'self', 'B03025');
    // deckReveal の auto-take(AI) → handAdd → boundToRemove → from-hand sceneEnter pick まで進める
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    }
  });
  return s;
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);

describe('B03025 「え？取材？」 — gate5 runtime', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // AI 経路 (自動 take)
  });

  it('該当キャラを手札へ + 非該当(top5)はリムーブ + 手札の該当Lv6を登場 / 非該当は登場しない', () => {
    const s = fire((st) => {
      // deck top5: DECK_HIT(少年探偵団Lv7=該当) / 非該当×4 + filler (top5外, refresh回避)
      st.players.self.deck = [DECK_TRAIT_DECOY, DECK_EVENT_DECOY, DECK_HIT, DECK_TRAIT_DECOY, DECK_EVENT_DECOY, DECK_FILLER, DECK_FILLER, DECK_FILLER];
      st.players.self.hand = ['B03025', HAND_HIT, HAND_TRAIT_DECOY, HAND_LV7_DECOY];
    });

    // (A) deckReveal filter: 該当 DECK_HIT は手札へ、デッキから抜ける
    expect(inHand(s, DECK_HIT), '少年探偵団Lv7 (DECK_HIT) を手札に加える').toBe(true);
    expect(inDeck(s, DECK_HIT), 'DECK_HIT はデッキから抜けた').toBe(false);
    // top5 の非該当 (trait違い / event種別) は手札に加えられず リムーブへ
    expect(inHand(s, DECK_TRAIT_DECOY), '警察キャラ(top5 decoy)は手札に加えない').toBe(false);
    expect(inHand(s, DECK_EVENT_DECOY), 'event種別(top5 decoy)は手札に加えない').toBe(false);
    expect(inRemove(s, DECK_TRAIT_DECOY), 'trait違い decoy はリムーブへ').toBe(true);
    expect(inRemove(s, DECK_EVENT_DECOY), 'event decoy はリムーブへ').toBe(true);
    // 残り(該当除く top5 の4枚)がリムーブへ = boundToRemove。filler は top5外なのでデッキに残る
    expect(inDeck(s, DECK_FILLER), 'top5外の filler はデッキに残る (リムーブされない)').toBe(true);
    expect(s.players.self.remove.filter((c) => c === DECK_TRAIT_DECOY || c === DECK_EVENT_DECOY).length,
      'top5 の非該当4枚がリムーブへ移る').toBe(4);

    // (B) sceneEnter filter: 手札の該当 HAND_HIT (Lv6) のみ登場、非該当は登場しない
    expect(inScene(s, HAND_HIT), '少年探偵団Lv6 (HAND_HIT) が登場').toBe(true);
    expect(inHand(s, HAND_HIT), '登場した HAND_HIT は手札から抜けた').toBe(false);
    expect(inScene(s, HAND_TRAIT_DECOY), '探偵Lv1 decoy は登場しない (trait違い)').toBe(false);
    expect(inScene(s, HAND_LV7_DECOY), '少年探偵団Lv7 decoy は登場しない (levelMax6超)').toBe(false);
    expect(inScene(s, DECK_HIT), 'deck由来の少年探偵団Lv7 は登場しない (levelMax6超)').toBe(false);
    // 非該当 decoy は手札に残る
    expect(inHand(s, HAND_TRAIT_DECOY), '探偵Lv1 decoy は手札に残る').toBe(true);
    expect(inHand(s, HAND_LV7_DECOY), '少年探偵団Lv7 decoy は手札に残る').toBe(true);
    // 現場に登場したのはちょうど1体 (少年探偵団Lv6)
    expect(s.players.self.scene.length, '現場に登場したのは 1 体のみ').toBe(1);
  });

  it('NEGATIVE: deck top5 に少年探偵団が居なければ手札に加えず全5枚リムーブ / 手札に該当が居なければ登場0', () => {
    const s = fire((st) => {
      // top5 全て非該当 (trait違い / event) → 0枚 add → 5枚すべてリムーブ
      st.players.self.deck = [DECK_TRAIT_DECOY, DECK_EVENT_DECOY, DECK_TRAIT_DECOY, DECK_EVENT_DECOY, DECK_TRAIT_DECOY, DECK_FILLER, DECK_FILLER, DECK_FILLER];
      // 手札に該当 (少年探偵団 Lv≤6) を一切置かない → 誰も登場しない
      st.players.self.hand = ['B03025', HAND_TRAIT_DECOY, HAND_LV7_DECOY];
    });

    // 0枚 add (「1枚まで」=0枚可、top5 に該当不在)
    expect(inHand(s, DECK_TRAIT_DECOY), '非該当のみ → 手札 add なし').toBe(false);
    // top5 の 5枚すべてリムーブ (DECK_TRAIT_DECOY×3 + DECK_EVENT_DECOY×2)
    expect(s.players.self.remove.filter((c) => c === DECK_TRAIT_DECOY).length, 'trait decoy ×3 リムーブ').toBe(3);
    expect(s.players.self.remove.filter((c) => c === DECK_EVENT_DECOY).length, 'event decoy ×2 リムーブ').toBe(2);
    expect(inDeck(s, DECK_FILLER), 'top5外 filler はデッキに残る').toBe(true);

    // sceneEnter: 手札に該当 (少年探偵団 Lv≤6) 不在 → 登場0
    expect(s.players.self.scene.length, '該当手札不在 → 現場登場 0').toBe(0);
    expect(inHand(s, HAND_TRAIT_DECOY), '探偵decoy は手札に残る').toBe(true);
    expect(inHand(s, HAND_LV7_DECOY), '少年探偵団Lv7 decoy は手札に残る').toBe(true);
  });
});
