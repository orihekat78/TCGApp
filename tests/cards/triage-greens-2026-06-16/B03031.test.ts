// gate5 RUNTIME behavior — B03031 大岡紅葉 (character, 緑/高校生, Lv6 AP5000 LP1)
//
// 公式テキスト:
//   effect (a1) 【パートナー緑】【登場時】自分のデッキのカードを上からレベル8以上の〚カード名［服部平次］〛が
//               出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、
//               デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。
//   hirameki (a2) 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//               〚カード名［服部平次］〛を1枚まで選び、手札に加える。
//
// rules:
//   10-action-event.md (【ヒラメキ】= 証拠が action[事件] でリムーブされるとき発動 / 発動するか否かは相手の選択),
//   14-refresh.md / 26-qa-deck-refresh.md (reveal/公開中はデッキ扱い / 「N枚見て…」family / 「1枚まで」=0枚可),
//   15-abilities-effects.md (「〜する」=必須 / 「〜まで」=0枚可 / 「〜した場合」=前段適用後に後段判定),
//   17-icons.md (【パートナー緑】= ability.condition partnerColor / 条件未達なら「持っていない扱い」),
//   19-special-rules.md (カード名は分割名すべてで判定 — names[] component).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   a1 deckRevealUntil の filter:{cardName:'服部平次', levelMin:8} を engine が **両方 AND で実評価** しているか。
//     ・levelMin:8 honor → 服部平次でも Lv7 は match しない (skip しデッキ下)。
//     ・cardName:'服部平次' honor → Lv8 でも別カード名は match しない (skip しデッキ下)。
//     BUG-117/118 型バグ (filter 無視) なら「最初に出た任意のカード」を拾ってしまう。
//   a1 condition {kind:'partnerColor', color:'緑'} を engine が **実評価** しているか。
//     ・パートナーが緑でない (青) ときは a1 が **発火しない** (rules/17 §条件アイコン: 持っていない扱い)。
//   a1 「それを手札に加える」(必須) → 該当 Lv8服部平次 を手札へ。
//   a1 「カードを手札に加えた場合、手札を1枚リムーブする」(必須 / 'する') を engine が **実行** しているか。
//     ・該当を加えたら **必ず** 手札を1枚 discard する。手札に decoy が居れば AI は decoy を捨てる。
//     ・手札が「加えた服部平次」のみのときでも mandatory に1枚捨てる (= 服部平次自身が remove へ)。
//   a1 「残りの公開したカードをデッキの下に移し、デッキをシャッフルする」: 公開済み非該当はデッキ下へ。
//   a1 EDGE: デッキ0枚 → 公開0 → 何も加えず何も捨てない (conditional 不成立, rules/26 reveal-what-available)。
//   a2 が evidence:remove-by-action (on-evidence) で **実発火** し pendingHirameki に surface するか。
//   a2 handAddFromRemove の filter:{cardName:'服部平次'} を engine が **実評価** しているか (fire 結果で実証)。
//   a2 「1枚まで」(rules/15) — ヒラメキ skip = 「発動しない」選択 (rules/10) → 0-pick channel (何も加えない)。
//
// driver (verb を直接呼ばない):
//   a1: handUseCard(self,'B03031') で 手札→現場に登場させ enter hook を emit (= 公式の「手札の使用」経路、
//       B01052/B02019 と同一機構)。緑事件 (rules/20 色制限) + FILE6 (rules/12 level6 使用可) を base に整える。
//       deckRevealUntil は forced reveal (chooseMatch なし) → pick は surface せず、discard は AI auto-pick
//       (drainAiEffectPicks) で解決 → 盤面 state で検証 (probe で全経路を ground-truth 済)。
//   a2: B02025 と同一の emitHirameki ハーネス (engine.event.emit → _drainPendingHirameki →
//       useGameStateStore.setState → dispatchEngineAction({type:'hiramekiResolve', choice:'fire'|'skip'}))。
//       fire は AI auto-pick で handAddFromRemove を解決、skip は no-op。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
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
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B03031 } from '@/cards/ct-p03/B03031';
import { B03059 } from '@/cards/ct-p03/B03059';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- 合成 def 群 (id prefix DEC_B03031_ で衝突回避、abilities:[] = 登場/移動しても再帰トリガー無し) ----
function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    level: 0, ap: 0, lp: 5, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
// 服部平次 (names component で判定 — rules/19)。level を可変にして levelMin:8 decoy を作る。
function heijiDef(id: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: ['服部平次'], colors: ['緑'],
    level, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
// level8 だが 服部平次 ではない別カード名 (= cardName decoy)
function otherL8Def(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: ['別人'], colors: ['緑'],
    level: 8, ap: 8000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function fillerDef(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const PARTNER_GREEN = 'DEC_B03031_PARTNER_GREEN'; // 緑パートナー → 【パートナー緑】成立
const PARTNER_BLUE = 'DEC_B03031_PARTNER_BLUE';   // 青パートナー → 【パートナー緑】不成立 (a1 非発火)
const HEIJI_L8 = 'DEC_B03031_HEIJI_L8';           // 服部平次 Lv8 → a1 の唯一の有効候補
const HEIJI_L7 = 'DEC_B03031_HEIJI_L7';           // 服部平次 Lv7 → DECOY (levelMin:8 違反)
const OTHER_L8 = 'DEC_B03031_OTHER_L8';           // 別人 Lv8 → DECOY (cardName 違反)
const HAND_DECOY = 'DEC_B03031_HAND_DECOY';       // 手札 decoy (discard 対象になる手札カード)
const FILLER = 'DEC_B03031_FILLER';               // top 外 filler

function registerDecoys(): void {
  registerCardDef(partnerDef(PARTNER_GREEN, ['緑']));
  registerCardDef(partnerDef(PARTNER_BLUE, ['青']));
  registerCardDef(heijiDef(HEIJI_L8, 8));
  registerCardDef(heijiDef(HEIJI_L7, 7));
  registerCardDef(otherL8Def(OTHER_L8));
  registerCardDef(fillerDef(HAND_DECOY));
  registerCardDef(fillerDef(FILLER));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

const FB = { type: 'card-back' as const, cardId: 'FB' };

// 「手札の使用」(handUseCard) で B03031 を登場させられる base state。
//   緑事件 (rules/20 色制限) + FILE6 (rules/12 level6 使用可) + 緑パートナー or 指定パートナー。
function enterBase(deck: string[], hand: string[], partnerId: string): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = hand;
  s.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
  s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); // FILE6 ≥ level6
  s.players.self.deck = deck;
  return s;
}

// ---- a2 base: B03031 を self.evidence に / self.remove に候補+decoy ----
function a2State(remove: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.evidence = [{ cardId: 'B03031', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
  s.players.self.remove = [...remove];
  s.players.self.deck = Array(6).fill('d');
  return s;
}

// ヒラメキ fire/skip ドライブ (B02025.test.ts / bug-140-hirameki-batch.test.ts と同一ハーネス)。
function emitHirameki(s: GameState, choice: 'fire' | 'skip'): GameState {
  engine.event.emit(
    s,
    'evidence:remove-by-action',
    { player: 'self', ev: { cardId: 'B03031' } },
    { player: 'opp', uid: 'opp-attacker' },
  );
  const pending = _drainPendingHirameki();
  expect(pending, 'ヒラメキ pending が side-channel に set される').not.toBeNull();
  expect(pending!.cardId).toBe('B03031');
  expect(pending!.abilityId).toBe('a2');
  expect(pending!.player, 'pending.player = self (証拠を失った側)').toBe('self');
  useGameStateStore.setState({ gameState: s, pendingHirameki: pending });
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice });
  expect(r.ok, `hiramekiResolve ${choice} ok`).toBe(true);
  expect(useGameStateStore.getState().pendingHirameki, 'pending クリア').toBeNull();
  return useGameStateStore.getState().gameState!;
}

describe('B03031 大岡紅葉 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetHiramekiRegistered();
    _resetActionContexts();
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

  // ===== a1 happy path: 該当 (服部平次 Lv8) を手札へ + mandatory discard 1 =====
  it('a1: 緑パートナーで登場 → デッキ上の 服部平次 Lv8 を手札へ + 手札を1枚リムーブ (必須 discard)', () => {
    // deck top: [FILLER(先頭非該当), HEIJI_L8(=該当), F外]。手札に HAND_DECOY → discard は HAND_DECOY を捨てる。
    let s = enterBase([FILLER, HEIJI_L8, 'd1'], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // discard 1 の AI auto-pick
    });

    expect(s.players.self.scene.some((c) => c.cardId === 'B03031'), 'B03031 が現場へ登場').toBe(true);
    // 「それを手札に加える」(必須) — 服部平次 Lv8 は手札へ、デッキから抜ける
    expect(inHand(s, HEIJI_L8), '服部平次 Lv8 を手札へ (必須 add)').toBe(true);
    expect(inDeck(s, HEIJI_L8), 'HEIJI_L8 はデッキから抜けた').toBe(false);
    // 「カードを手札に加えた場合、手札を1枚リムーブする」(必須 discard) — AI は HAND_DECOY を捨てる
    expect(inRemove(s, HAND_DECOY), 'mandatory discard: 手札 decoy が remove へ').toBe(true);
    expect(inHand(s, HAND_DECOY), 'HAND_DECOY は手札から消えた (discard)').toBe(false);
    // 手札に残るのは HEIJI_L8 のみ (B03031 は消費、HAND_DECOY は discard)
    expect([...s.players.self.hand].sort(), '手札 = [HEIJI_L8] のみ').toEqual([HEIJI_L8]);
    // 「残りの公開したカードをデッキの下に移し」: 先頭 FILLER (該当前に公開) はデッキ下に残る
    expect(inDeck(s, FILLER), '公開済み非該当 FILLER はデッキ下に残る').toBe(true);
  });

  // ===== a1 DECOY (levelMin): 服部平次 Lv7 は match しない (levelMin:8 実評価) =====
  it('a1 DECOY (levelMin): デッキ先頭が 服部平次 Lv7 でも match せず skip → さらに奥の Lv8 を拾う (levelMin:8 実評価)', () => {
    // top: [HEIJI_L7(=cardName一致だが Lv7 で levelMin違反), HEIJI_L8(=該当)]。
    //   levelMin 無視なら先頭 HEIJI_L7 を拾う (BUG-117 型)。honor なら skip し HEIJI_L8 を拾う。
    let s = enterBase([HEIJI_L7, HEIJI_L8, 'd1'], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(inHand(s, HEIJI_L8), '服部平次 Lv8 (該当) を手札へ').toBe(true);
    expect(inDeck(s, HEIJI_L8), 'HEIJI_L8 はデッキから抜けた').toBe(false);
    // DECOY: Lv7 服部平次 は手札に入らず、公開済みとしてデッキ下へ残る
    expect(inHand(s, HEIJI_L7), 'decoy(服部平次 Lv7, levelMin違反)は手札に入らない').toBe(false);
    expect(inDeck(s, HEIJI_L7), 'decoy(服部平次 Lv7)はデッキに残る (下へ)').toBe(true);
  });

  // ===== a1 DECOY (cardName): Lv8 でも別カード名は match しない (cardName:服部平次 実評価) =====
  it('a1 DECOY (cardName): デッキ先頭が 別人 Lv8 でも match せず skip → 服部平次 Lv8 を拾う (cardName 実評価)', () => {
    // top: [OTHER_L8(=Lv8だが別カード名), HEIJI_L8(=該当)]。
    //   cardName 無視 (levelMin だけ評価) なら先頭 OTHER_L8 を拾う。honor なら skip し HEIJI_L8。
    let s = enterBase([OTHER_L8, HEIJI_L8, 'd1'], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(inHand(s, HEIJI_L8), '服部平次 Lv8 (該当) を手札へ').toBe(true);
    expect(inDeck(s, HEIJI_L8), 'HEIJI_L8 はデッキから抜けた').toBe(false);
    // DECOY: 別人 Lv8 は手札に入らず、公開済みとしてデッキ下へ残る
    expect(inHand(s, OTHER_L8), 'decoy(別人 Lv8, cardName違反)は手札に入らない').toBe(false);
    expect(inDeck(s, OTHER_L8), 'decoy(別人 Lv8)はデッキに残る (下へ)').toBe(true);
  });

  // ===== a1 NEGATIVE (filter unmet): デッキ全体に 服部平次 Lv8 不在 → 何も加えず discard も起きない =====
  it('a1 NEGATIVE: デッキに 服部平次 Lv8 が不在 (服部平次 Lv7 + 別人 Lv8) → 何も手札に加えず discard も起きない', () => {
    // 全公開しても levelMin/cardName 両方を満たすカードが居ない → $matched=[] → conditional 不成立。
    let s = enterBase([HEIJI_L7, OTHER_L8, FILLER], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // 何も手札に加わらない (HEIJI_L7/OTHER_L8 とも該当外)
    expect(inHand(s, HEIJI_L7), 'Lv7 服部平次 は手札に入らない').toBe(false);
    expect(inHand(s, OTHER_L8), 'Lv8 別人 は手札に入らない').toBe(false);
    // discard も起きない (「加えた場合」が不成立 → 後段 discard も発動しない)
    expect(inHand(s, HAND_DECOY), '手札 decoy はそのまま (add が無いので discard も無い)').toBe(true);
    expect(inRemove(s, HAND_DECOY), 'HAND_DECOY は remove に移らない (discard 不発)').toBe(false);
    // 手札 = [HAND_DECOY] のみ (B03031 消費、新規追加なし)
    expect([...s.players.self.hand].sort(), '手札 = [HAND_DECOY] のみ').toEqual([HAND_DECOY]);
  });

  // ===== a1 mandatory discard (decoy 無し): 手札が「加えた服部平次」のみでも必ず1枚捨てる =====
  it('a1 mandatory discard: 手札に他カードが無くても、加えた服部平次自身を discard する (「〜する」=必須)', () => {
    // 手札は B03031 のみ → 使用後 手札空 → 服部平次 Lv8 を add → discard 1 の対象が服部平次しか無い。
    let s = enterBase([HEIJI_L8, 'd1', 'd2'], ['B03031'], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // mandatory discard が発動 → 加えた服部平次自身が remove へ → 手札は空
    expect(inRemove(s, HEIJI_L8), 'mandatory discard: 他に手札が無いので服部平次自身を捨てる').toBe(true);
    expect(s.players.self.hand.length, '手札は空 (add した1枚を即 discard)').toBe(0);
  });

  // ===== a1 condition NEGATIVE (partnerColor): 緑でないパートナーでは a1 非発火 =====
  it('a1 condition NEGATIVE (partner 青): パートナーが緑でない → a1 非発火 → デッキの服部平次Lv8 も手札に入らない', () => {
    let s = enterBase([FILLER, HEIJI_L8, 'd1'], ['B03031', HAND_DECOY], PARTNER_BLUE);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.scene.some((c) => c.cardId === 'B03031'), 'B03031 自体は登場 (登場は条件不問)').toBe(true);
    // a1 非発火 → reveal/add/discard いずれも起きない
    expect(inHand(s, HEIJI_L8), '青パートナー → a1 非発火 → 服部平次も手札に入らない').toBe(false);
    expect(inDeck(s, HEIJI_L8), '服部平次 Lv8 はデッキに残る (a1 非発火)').toBe(true);
    expect(inHand(s, HAND_DECOY), '手札 decoy はそのまま (discard 不発)').toBe(true);
    expect(inRemove(s, HAND_DECOY), 'discard も起きない').toBe(false);
    // デッキ枚数不変 (reveal/toBottom が起きないので 3 枚のまま)
    expect(s.players.self.deck.length, 'デッキ枚数不変 (a1 非発火)').toBe(3);
  });

  // ===== a1 EDGE (デッキ0枚): 公開0 → 何も加えず discard も起きない =====
  it('a1 EDGE (デッキ0枚): 公開0 → conditional 不成立 → 何も手札に加えず discard も起きない', () => {
    let s = enterBase([], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.scene.some((c) => c.cardId === 'B03031'), 'B03031 登場').toBe(true);
    expect(inHand(s, HAND_DECOY), '手札 decoy はそのまま (add 無し → discard 無し)').toBe(true);
    expect(inRemove(s, HAND_DECOY), 'discard 不発').toBe(false);
    expect([...s.players.self.hand].sort(), '手札 = [HAND_DECOY] のみ').toEqual([HAND_DECOY]);
    expect(s.players.self.deck.length, 'デッキ0枚のまま').toBe(0);
  });

  // ===== a1 forced reveal (tier-1): pick は surface しない =====
  it('a1: deckRevealUntil は chooseMatch 無し forced reveal → human でも player pick が surface しない', () => {
    setHuman('self'); // human でも pick が立たないことを確認 (forced reveal)
    let s = enterBase([FILLER, HEIJI_L8, 'd1'], ['B03031', HAND_DECOY], PARTNER_GREEN);

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B03031');
      runAllUntilEmpty(d);
    });
    // reveal-until の pick は無い。discard の pick は human では surface しうるので、ここでは
    // 「reveal フェーズで deckRevealUntil の pick が立っていない」= 服部平次 add が機械的に確定したことを確認。
    const revealPicks = pickQueue().filter((p) => p.atomVerb === 'deckRevealUntil');
    expect(revealPicks.length, 'deckRevealUntil の pick は forced reveal → surface しない').toBe(0);
    expect(inHand(s, HEIJI_L8), 'forced: 服部平次 Lv8 は機械的に手札へ').toBe(true);
  });

  // ===== a2 trigger: 【ヒラメキ】が evidence:remove-by-action で実発火し pending に surface =====
  it('a2 trigger: B03031 が証拠から action[事件] でリムーブされると ヒラメキ pending が {cardId:B03031, abilityId:a2} で立つ', () => {
    const s = a2State([HEIJI_L8]);
    engine.event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03031' } }, { player: 'opp', uid: 'atk' });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ (on-evidence trigger 実発火)').not.toBeNull();
    expect(pending?.cardId, 'pending.cardId = B03031').toBe('B03031');
    expect(pending?.abilityId, 'pending.abilityId = a2').toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 trigger NEGATIVE: 証拠でない別カードの action リムーブでは B03031 のヒラメキは立たない', () => {
    const s = a2State([HEIJI_L8]);
    engine.event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: FILLER } }, { player: 'opp', uid: 'atk' });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ無しカードのリムーブでは pending 立たない').toBeNull();
  });

  // ===== a2 fire + DECOY: 服部平次 のみ手札へ、別人 (cardName decoy) は remove に残る =====
  it('a2 + DECOY: ヒラメキ fire → 服部平次(HEIJI_L8) のみ手札へ、別人(OTHER_L8) は remove 残留 (cardName filter 実評価)', () => {
    const s0 = a2State([HEIJI_L8, OTHER_L8]);
    const after = emitHirameki(s0, 'fire');

    expect(inHand(after, HEIJI_L8), '服部平次 が手札へ (filter 該当)').toBe(true);
    expect(after.players.self.hand.length, '手札 +1 (max:1)').toBe(1);
    // DECOY: 別人 (cardName 違反) は手札に入らず remove に残る (= cardName filter 実評価の証明)
    expect(inHand(after, OTHER_L8), '別人 decoy は手札に入らない').toBe(false);
    expect(inRemove(after, OTHER_L8), '別人 decoy は remove に残る').toBe(true);
    expect(inRemove(after, HEIJI_L8), '服部平次 は remove から抜けた').toBe(false);
  });

  // ===== a2 NEGATIVE (skip): ヒラメキ skip = 「発動しない」選択 (rules/10) → 0-pick channel =====
  it('a2 NEGATIVE (skip): ヒラメキ skip では何も手札に加わらない / remove pile 不変 (「1枚まで」=0枚可)', () => {
    const s0 = a2State([HEIJI_L8, OTHER_L8]);
    const after = emitHirameki(s0, 'skip');
    expect(after.players.self.hand.length, 'skip → 手札 増えない').toBe(0);
    expect([...after.players.self.remove].sort(), 'skip → remove pile 不変')
      .toEqual([HEIJI_L8, OTHER_L8].sort());
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered enter(selfOnly)+partnerColor緑, sequence(deckRevealUntil{cardName,levelMin8}→conditional[handAddFromDeck,discard1]→deckToBottomBound→deckShuffle); a2=ヒラメキ handAddFromRemove{cardName:服部平次,max:1}', () => {
    const [a1, a2] = B03031.abilities;
    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.condition, 'a1 condition partnerColor 緑').toMatchObject({ kind: 'partnerColor', color: '緑' });
    expect(a1.trigger, 'a1 trigger enter selfOnly').toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps).toHaveLength(4);
    // step0: deckRevealUntil forced (chooseMatch/maxN なし) filter{cardName:服部平次, levelMin:8}
    expect(eff.steps[0]).toMatchObject({
      kind: 'atom',
      verb: 'deckRevealUntil',
      args: { player: 'self', filter: { cardName: '服部平次', levelMin: 8 }, bind: '$revealed', bindMatch: '$matched' },
    });
    const revealArgs = (eff.steps[0] as { args: Record<string, unknown> }).args;
    expect(revealArgs.maxN, 'forced reveal-until: maxN 無し').toBeUndefined();
    expect(revealArgs.chooseMatch, 'forced reveal-until: chooseMatch 無し').toBeUndefined();
    // step1: conditional($matched matched) → sequence[handAddFromDeck, discard n:1]
    expect(eff.steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
          { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        ],
      },
    });
    // step2/3: deckToBottomBound $revealed → deckShuffle
    expect(eff.steps[2]).toMatchObject({ kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } });
    expect(eff.steps[3]).toMatchObject({ kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } });
    // a2 (hirameki)
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger, 'a2 hirameki hook').toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb: string }).verb).toBe('handAddFromRemove');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({
      player: 'self', max: 1, filter: { cardName: '服部平次' },
    });
    // a2 は同セット B03059 a2 (同一ヒラメキ文型、cardName 違い) と構造同型
    const b03059a2 = B03059.abilities[1];
    expect(a2.trigger, 'a2 trigger が B03059 a2 と一致').toEqual(b03059a2.trigger);
    expect((a2.effect as { verb: string }).verb, 'a2 verb が B03059 a2 と一致').toBe((b03059a2.effect as { verb: string }).verb);
  });
});
