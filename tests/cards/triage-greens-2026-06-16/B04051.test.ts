// gate5 RUNTIME behavior — B04051 宮野明美 (character, 赤/L6 AP5000 LP1, 特徴なし)
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から〚カード名［赤井秀一］〛か〚カード名［諸星大］〛か〚カード名［ライ］〛が
//     出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// rules: 10-action-event.md (【ヒラメキ】= 証拠が action[事件] でリムーブされるとき発動) /
//        14-refresh.md (リフレッシュ) / 15-abilities-effects.md (「〜する」= 必須・可能な限り) /
//        17-icons.md (【登場時】/「〜を持つ」印字判定) / 19-special-rules.md (複数名カード分割) /
//        26-qa-deck-refresh.md (公開中はデッキ扱い / 「出るまで1枚ずつ公開→それを手札へ」型 = 必ず加える).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1 (登場時 deckRevealUntil — cardName OR filter):
//     handUseCard(self, 'B04051') で 赤事件 + FILE6 (rules/12/20) の base から B04051 を手札→現場へ登場、
//     enter hook を emit (= 公式の「手札の使用」経路、B01052.test.ts と同じ機構)。triggered listener が
//     selfOnly 'enter' を a1 に dispatch → runAllUntilEmpty で sequence を解決。
//     deckRevealUntil は maxN なし + chooseMatch なし = forced reveal (tier-1, pick 非surface) のため、
//     検証は runAllUntilEmpty 後の **盤面 state** で行う (pickQueue ではない)。
//   a2 (ヒラメキ on 証拠 action[事件] リムーブ):
//     B04051 を self.evidence に置き、emit 'evidence:remove-by-action'{player:'self', ev:{cardId:'B04051'}}
//     → handleEvidenceRemovedHook が pushPendingHirameki → _drainPendingHirameki →
//        dispatchEngineAction({type:'hiramekiResolve', choice:'fire'|'skip'}) で fire=draw1 / skip=no-op を駆動
//        (B02025.test.ts emitHirameki ハーネスと同型。dispatchEngineAction 内部で runAllUntilEmpty まで走る)。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に filter を書いても engine が評価する保証はない):
//   (a1-match)   filter:{cardName:['赤井秀一','諸星大','ライ']} を engine が **実評価**。3 名のいずれかが
//                「出るまで」公開 → match した 1 枚を手札へ。match の上にある 非該当カードは「残り」=
//                デッキ下へ (手札に入らない) = cardName filter 実評価の証拠
//                (atom-handlers.ts targetFilterToPredicate :101-105 — wave#2 cluster2 で cardName honor)。
//   (a1-OR)      3 名は「か」= OR。赤井秀一 だけでなく 諸星大 / ライ でも match することを個別に踏む。
//   (a1-DECOY)   3 名でない別名カード (灰原哀) を match 候補の **上** に置く → 公開されるが手札に入らず
//                デッキ下へ。filter 無視 (BUG-117/118 型) なら最初の公開カード=灰原哀 が拾われてしまう。
//   (a1-N)       デッキに 3 名いずれも不在 → 全 reveal、$matched=[] → handAddFromDeck conditional 不発
//                (何も手札に加わらない)。必須末尾 (デッキ下移動 + シャッフル) は依然実行 = デッキ枚数/集合不変。
//                ※「そのカードがあったら加える」chain-gate ではなく「(無ければ加えない)可能な限り」型なので
//                  BUG-111 trap には該当しない (handAddFromDeck は match presence GUARD であり 0-pick modal でない)。
//   (a1-edge)    デッキ0枚: 公開0枚 → 何も加わらない / scene は B04051 自身のみ。
//   (a1-self)    selfOnly: 別キャラの登場では B04051 の a1 は発火しない (deck reveal が起きない)。
//   (a1-tier1)   forced reveal — human でも player pick (pickQueue) は surface しない。
//   (a2-fire)    ヒラメキ fire → カードを1枚引く (deck -1 / hand +1)。
//   (a2-skip)    ヒラメキ skip = 「発動しない」選択 (rules/10) → 何も引かない (0-pick 相当)。
//   (a2-trigger) on-evidence trigger 実発火 (pending {cardId:B04051, abilityId:a2, player:self})。
//   (struct)     descriptor 構造 sanity (toMatchObject)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B04051 } from '@/cards/ct-p04/B04051';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

const FB = { type: 'card-back' as const, cardId: 'FB' };

// ---- 合成 def 群 (id prefix DEC_B04051_ で衝突回避、abilities:[] = 登場/公開しても再帰トリガー無し) ----
// a1 の cardName filter は CardDef.names を allCardNameComponentsForDef で分解して照合するため、
// decoy の names に対象名 / 非対象名を持たせて filter を実評価させる。
const AKAI    = 'DEC_B04051_AKAI';    // names:['赤井秀一'] → filter 該当 (1番目の名)
const MOROBOSHI = 'DEC_B04051_MOROBOSHI'; // names:['諸星大'] → filter 該当 (2番目の名 / OR)
const RYE     = 'DEC_B04051_RYE';     // names:['ライ'] → filter 該当 (3番目の名 / OR)
const HAIBARA = 'DEC_B04051_HAIBARA'; // names:['灰原哀'] → DECOY (3名いずれでもない → 手札に入らない)
const RAN     = 'DEC_B04051_RAN';     // names:['毛利蘭'] → DECOY (非該当)
const OTHER   = 'DEC_B04051_OTHER';   // 別の現場登場用 (selfOnly 検証 / filler)

function charDef(id: string, names: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['赤'],
    level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}

function registerDecoys(): void {
  registerCardDef(charDef(AKAI, ['赤井秀一']));
  registerCardDef(charDef(MOROBOSHI, ['諸星大']));
  registerCardDef(charDef(RYE, ['ライ']));
  registerCardDef(charDef(HAIBARA, ['灰原哀']));
  registerCardDef(charDef(RAN, ['毛利蘭']));
  registerCardDef(charDef(OTHER, ['江戸川コナン']));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const deckCount = (id: string, s: GameState) => s.players.self.deck.filter((c) => c === id).length;

// 手札の使用 (handUseCard) で B04051 を登場させられる base。
// 赤事件 (rules/20 色制限: B04051=赤) + FILE6 (rules/12 level6 使用可)。deck は呼出側が組む。
function baseForHandUse(deck: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B04051'];
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); // FILE6 ≥ level6
  s.players.self.deck = deck;
  return s;
}

// a2 base: B04051 を self.evidence / self.deck に draw 用カードを積む。
function a2State(deck: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.evidence = [{ cardId: 'B04051', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
  s.players.self.deck = deck;
  return s;
}

// ヒラメキ fire/skip ドライブ (B02025.test.ts emitHirameki と同一ハーネス)。
function emitHirameki(s: GameState, choice: 'fire' | 'skip'): GameState {
  const { pending } = openCaseHirameki(s, 'B04051');
  expect(pending, 'ヒラメキ pending が side-channel に set される').not.toBeNull();
  expect(pending.cardId).toBe('B04051');
  expect(pending.abilityId).toBe('a2');
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice });
  expect(r.ok, `hiramekiResolve ${choice} ok`).toBe(true);
  expect(useGameStateStore.getState().pendingHirameki, 'pending クリア').toBeNull();
  return useGameStateStore.getState().gameState!;
}

describe('B04051 宮野明美 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetHiramekiRegistered();
    _resetUidCounter();
    _resetPendingHirameki();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    registerHiramekiListener();
    setHuman(null);
    useGameStateStore.setState({
      gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null,
    });
  });

  // ===== a1-match + DECOY: cardName OR filter 実評価 (赤井秀一) =====
  it('a1 + DECOY: 上に非該当(灰原哀/毛利蘭)、その下に 赤井秀一 → 赤井秀一 のみ手札へ / 非該当は公開されデッキ下 (cardName filter 実評価)', () => {
    // deck top: [灰原哀(非該当), 毛利蘭(非該当), 赤井秀一(=該当), OTHER...]。
    // filter 無視 (BUG-117/118 型) なら最初の公開=灰原哀 が拾われる。honor なら 2 枚 skip し 赤井秀一 を拾う。
    let s = baseForHandUse([HAIBARA, RAN, AKAI, OTHER, OTHER]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(inHand(s, AKAI), '赤井秀一 (該当) を手札へ').toBe(true);
    expect(inDeck(s, AKAI), '赤井秀一 はデッキから抜けた').toBe(false);
    // DECOY: 非該当名は手札に入らず、公開分はデッキ下へ残る
    expect(inHand(s, HAIBARA), 'decoy(灰原哀, 非該当名)は手札に入らない').toBe(false);
    expect(inHand(s, RAN), 'decoy(毛利蘭, 非該当名)は手札に入らない').toBe(false);
    expect(inDeck(s, HAIBARA), 'decoy(灰原哀)はデッキに残る (下へ)').toBe(true);
    expect(inDeck(s, RAN), 'decoy(毛利蘭)はデッキに残る (下へ)').toBe(true);
    // 手札に移ったのは 赤井秀一 1 枚のみ → デッキ 5-1=4
    expect(s.players.self.deck.length, 'デッキ枚数 = 5 - 1(該当のみ手札へ)').toBe(4);
  });

  // ===== a1-OR: 諸星大 (2番目の名) でも match =====
  it('a1 OR (諸星大): 上に非該当、その下に 諸星大 → 諸星大 を手札へ (OR 2番目の名を実評価)', () => {
    let s = baseForHandUse([HAIBARA, MOROBOSHI, OTHER, OTHER]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(inHand(s, MOROBOSHI), '諸星大 (OR 2番目) を手札へ').toBe(true);
    expect(inDeck(s, MOROBOSHI), '諸星大 はデッキから抜けた').toBe(false);
    expect(inHand(s, HAIBARA), 'decoy(灰原哀)は手札に入らない').toBe(false);
    expect(inDeck(s, HAIBARA), 'decoy(灰原哀)はデッキに残る').toBe(true);
  });

  // ===== a1-OR: ライ (3番目の名) でも match =====
  it('a1 OR (ライ): 上に非該当、その下に ライ → ライ を手札へ (OR 3番目の名を実評価)', () => {
    let s = baseForHandUse([RAN, RYE, OTHER, OTHER]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(inHand(s, RYE), 'ライ (OR 3番目) を手札へ').toBe(true);
    expect(inDeck(s, RYE), 'ライ はデッキから抜けた').toBe(false);
    expect(inHand(s, RAN), 'decoy(毛利蘭)は手札に入らない').toBe(false);
    expect(inDeck(s, RAN), 'decoy(毛利蘭)はデッキに残る').toBe(true);
  });

  // ===== a1-stop-at-first: 「出るまで」= 最初の該当で停止 → 下にある別該当は公開されない =====
  it('a1 stop-at-first: 上から 赤井秀一(該当) → その下の 諸星大 は公開されずデッキ上に残る (「出るまで1枚ずつ」= 最初の match で停止)', () => {
    // top: [赤井秀一(該当・最上), 諸星大(該当・2枚目), OTHER...]。最初の 赤井秀一 で停止 → 諸星大 は触れない。
    let s = baseForHandUse([AKAI, MOROBOSHI, OTHER, OTHER]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(inHand(s, AKAI), '最初の該当 赤井秀一 を手札へ').toBe(true);
    expect(inHand(s, MOROBOSHI), '2 枚目の該当 諸星大 は手札に入らない (停止済)').toBe(false);
    expect(inDeck(s, MOROBOSHI), '諸星大 はデッキに残る (公開すらされていない)').toBe(true);
    // 赤井秀一 が最上 = 公開 1 枚で match → デッキ下移動は 0 枚。デッキは 4-1=3。
    expect(s.players.self.deck.length, 'デッキ枚数 = 4 - 1(赤井秀一のみ手札へ)').toBe(3);
  });

  // ===== a1-N: 3名いずれも不在 → 何も手札に加えず、必須末尾(下移動+シャッフル)は実行 =====
  it('a1 NEGATIVE (no match): デッキに 赤井秀一/諸星大/ライ いずれも不在 → 手札に何も加わらない / デッキ集合は不変 (必須シャッフルは実行)', () => {
    const deck = [HAIBARA, RAN, OTHER, OTHER];
    let s = baseForHandUse([...deck]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    // 何も手札に加わらない (handAddFromDeck conditional 不発)。手札は B04051 消費後に新規追加なし。
    expect(s.players.self.hand.length, '手札に新規追加なし (3名不在)').toBe(0);
    expect(inHand(s, HAIBARA), '非該当 灰原哀 も手札に入らない').toBe(false);
    expect(inHand(s, RAN), '非該当 毛利蘭 も手札に入らない').toBe(false);
    // 必須の「デッキ下へ移し、シャッフル」は実行されるが、デッキの **集合** (membership/count) は不変。
    expect(s.players.self.deck.length, 'デッキ枚数不変 (全 reveal→下移動、手札へ移らず)').toBe(4);
    expect(deckCount(HAIBARA, s), '灰原哀 はデッキに 1 枚残存').toBe(1);
    expect(deckCount(RAN, s), '毛利蘭 はデッキに 1 枚残存').toBe(1);
    expect(deckCount(OTHER, s), 'OTHER はデッキに 2 枚残存').toBe(2);
  });

  // ===== a1-edge: デッキ0枚 → 何も起きない =====
  it('a1 edge (デッキ0枚): 公開0枚 → 手札追加なし / scene は B04051 自身のみ', () => {
    let s = baseForHandUse([]); // deck 空

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand.length, 'デッキ0枚 → 手札に何も加わらない').toBe(0);
    expect(s.players.self.deck.length, 'デッキ0枚のまま').toBe(0);
    const me = s.players.self.scene.find((c) => c.cardId === 'B04051');
    expect(me, 'B04051 自身は現場に登場').toBeTruthy();
    expect(s.players.self.scene.filter((c) => c.cardId !== 'B04051').length, 'B04051 以外は現場に登場しない').toBe(0);
  });

  // ===== a1-selfOnly NEGATIVE: 別キャラの登場では B04051 の a1 は発火しない =====
  it('a1 selfOnly NEGATIVE: 別キャラ(OTHER)を登場させても B04051 の a1 は発火しない (deck reveal が起きない)', () => {
    // B04051 を既に現場に置き、別キャラ OTHER を手札の使用で登場させる。
    // selfOnly:true → OTHER の enter では B04051 の a1 は dispatch されない → deck から該当が手札へ移らない。
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.hand = [OTHER];
    s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
    s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB }));
    s.players.self.deck = [AKAI, OTHER, OTHER]; // 該当 赤井秀一 を deck top に置く (誤発火なら手札へ移る)
    // B04051 は既に現場 (登場済み、enter は再emitされない)
    s.players.self.scene = [sceneChar('B04051', 'akemi#1', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', OTHER);
      runAllUntilEmpty(d);
    });

    expect(inHand(s, AKAI), '別キャラ登場では B04051 a1 不発 → 赤井秀一 は手札に移らない').toBe(false);
    expect(inDeck(s, AKAI), '赤井秀一 はデッキに残る (a1 不発)').toBe(true);
  });

  // ===== a1-tier1: forced reveal — player pick は surface しない =====
  it('a1 tier1: forced reveal — human でも player pick (pickQueue) は surface しない (maxN/chooseMatch なし)', () => {
    setHuman('self'); // human でも pick が出ないことを確認
    let s = baseForHandUse([HAIBARA, AKAI, OTHER]);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04051');
      runAllUntilEmpty(d);
    });

    expect(pickQueue().length, 'deckRevealUntil は maxN/chooseMatch 無し forced reveal → pick 無し').toBe(0);
    // 結果は盤面で確定済み (赤井秀一 が手札へ)。
    expect(inHand(s, AKAI), 'forced: 赤井秀一 は手札へ').toBe(true);
  });

  // ===== a2-trigger: 【ヒラメキ】が evidence:remove-by-action で実発火し pending に surface =====
  it('a2 trigger: B04051 が証拠から action[事件] でリムーブされると ヒラメキ pending が {cardId:B04051, abilityId:a2, player:self} で立つ', () => {
    const s0 = a2State(['d1', 'd2']);

    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B04051' } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ (on-evidence trigger 実発火)').not.toBeNull();
    expect(pending?.cardId, 'pending.cardId = B04051').toBe('B04051');
    expect(pending?.abilityId, 'pending.abilityId = a2').toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 trigger NEGATIVE: 証拠でない別カードの action リムーブでは B04051 のヒラメキは立たない', () => {
    const s0 = a2State(['d1', 'd2']);

    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: OTHER } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ無しカード(B04051以外)のリムーブでは pending 立たない').toBeNull();
  });

  // ===== a2-fire: ヒラメキ fire → カードを1枚引く (deck -1 / hand +1) =====
  it('a2 fire: ヒラメキ fire で カードを1枚引く (deck 上から hand へ / deck -1, hand +1)', () => {
    const s0 = a2State(['top', 'd2', 'd3']);
    const handBefore = s0.players.self.hand.length;
    const deckBefore = s0.players.self.deck.length;

    const after = emitHirameki(s0, 'fire');

    expect(after.players.self.hand.length, 'fire → 手札 +1').toBe(handBefore + 1);
    expect(after.players.self.deck.length, 'fire → デッキ -1').toBe(deckBefore - 1);
    expect(after.players.self.hand, 'デッキ上 (top) を引いた').toContain('top');
    expect(after.players.self.deck, 'top はデッキから抜けた').not.toContain('top');
  });

  // ===== a2-skip: ヒラメキ skip = 「発動しない」(rules/10) → 何も引かない =====
  it('a2 skip: ヒラメキ skip では カードを引かない (deck/hand 不変)', () => {
    const s0 = a2State(['top', 'd2', 'd3']);
    const deckBefore = s0.players.self.deck.length;

    const after = emitHirameki(s0, 'skip');

    expect(after.players.self.hand.length, 'skip → 手札 増えない').toBe(0);
    expect(after.players.self.deck.length, 'skip → デッキ 不変').toBe(deckBefore);
    expect(after.players.self.deck, 'top はデッキに残る').toContain('top');
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered enter(selfOnly) sequence(deckRevealUntil{cardName OR3, no maxN}→handAddFromDeck→deckToBottomBound→deckShuffle), a2=ヒラメキ(evidence:remove-by-action optional) draw1', () => {
    const [a1, a2] = B04051.abilities;
    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps).toHaveLength(4);
    // step1: deckRevealUntil filter{cardName:[3名]}, maxN 無し, chooseMatch 無し
    expect(eff.steps[0]).toMatchObject({
      kind: 'atom',
      verb: 'deckRevealUntil',
      args: { player: 'self', filter: { cardName: ['赤井秀一', '諸星大', 'ライ'] }, bind: '$revealed', bindMatch: '$matched' },
    });
    const revealArgs = (eff.steps[0] as { args: Record<string, unknown> }).args;
    expect(revealArgs.maxN, 'maxN 無し (出るまで公開 — N枚見る型でない)').toBeUndefined();
    expect(revealArgs.chooseMatch, 'chooseMatch 無し (tier-1 forced reveal)').toBeUndefined();
    // step2: match → handAddFromDeck (presence GUARD; not 0-pick modal)
    expect(eff.steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
    });
    // step3: 残りをデッキ下
    expect(eff.steps[2]).toMatchObject({
      kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' },
    });
    // step4: シャッフル
    expect(eff.steps[3]).toMatchObject({
      kind: 'atom', verb: 'deckShuffle', args: { player: 'self' },
    });
    // a2 (ヒラメキ — draw1)
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });
});
