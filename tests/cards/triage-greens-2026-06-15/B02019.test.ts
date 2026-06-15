// gate5 RUNTIME behavior — B02019 伊織無我 (character, 緑, Lv7 AP6000 LP1, 特徴[執事])
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から5枚見る。その中から【緑】のイベントを1枚まで公開して手札に加え、
//     残りをシャッフルしてデッキの下に移す。
//   自分のターン終了時、カードがセットされているキャラを1枚まで選び、アクティブにする。
//
// rules:
//   03-field-areas.md (状態: active/sleep/stun, スタン→active は代わりにsleep),
//   05-turn-phases.md (エンドフェイズ = phase:end:start),
//   14-refresh.md / 26-qa-deck-refresh.md (reveal 中はデッキ扱い),
//   15-abilities-effects.md (「〜まで」=0枚可),
//   16-card-set.md (カードがセットされている = setCards.length>0),
//   17-icons.md (【登場時】 / 「〜を持つ」印字判定),
//   20-color-and-switch.md (色制限 / 効果による登場は色制限なし),
//   24-qa-naming-stun.md (スタン特殊挙動).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   a1 deckRevealUntil の filter:{color:'緑', kind:'event'} を engine が **実際に評価** しているか。
//     targetFilterToPredicate (atom-handlers.ts:66-110) が color(L74) と kind(L93) を両方チェックする。
//     → 緑イベントのみ match。緑でないイベント / 緑キャラ は skip され、残りとしてデッキ下へ。
//   a2 sceneSetState の pick filter:{hasSetCards:true} を engine が **実際に評価** しているか。
//     matchOneFilter (candidates.ts:323-325) が c.setCards.length>0 を判定する。
//     → セットカードを持つキャラのみ候補。持たないキャラは候補に入らず active 化されない。
//
// decoy / negative (filter が実評価されている証明):
//   a1-D1 (color): 緑でないイベント (DEC_B02019_BLUE_EVENT, 青) を window 先頭に置く。
//     filter が無視されるなら「最初の event」= 青 decoy が拾われる。honor されるなら skip。
//   a1-D2 (kind):  緑だが character (DEC_B02019_GREEN_CHAR) を window に置く。kind:'event' で弾かれるべき。
//   a1-N (0-pick): window に緑イベントが居なければ手札0、全部デッキ下 (「1枚まで」=0枚可、conditional 不成立)。
//   a2-D (hasSetCards): セットカード無しの sleep キャラ (DEC_B02019_NOSET) は active 化されない (sleep のまま)。
//   a2-N (0-pick decline): human が 0枚を選べば セットカード持ちが居ても active 化しない。
//   a2-stun (rules/03/24): スタン状態のセットカード持ちを「アクティブにする」→ 代わりに sleep になる。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  drainAiEffectPicks,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B02019 } from '@/cards/ct-p02/B02019';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B02019_ で id 衝突回避) ----
function ev(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors,
    level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function ch(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors,
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const GREEN_EVENT = 'DEC_B02019_GREEN_EVENT';   // 緑イベント = a1 の唯一の有効候補
const BLUE_EVENT = 'DEC_B02019_BLUE_EVENT';     // 青イベント = color decoy (緑でない)
const GREEN_CHAR = 'DEC_B02019_GREEN_CHAR';     // 緑キャラ = kind decoy (event でない)
const FILLER = 'DEC_B02019_FILLER';             // top5 外 filler (refresh 回避)

function registerDecoys(): void {
  registerCardDef(ev(GREEN_EVENT, ['緑']));
  registerCardDef(ev(BLUE_EVENT, ['青']));
  registerCardDef(ch(GREEN_CHAR, ['緑']));
  registerCardDef(ch(FILLER, ['緑']));
}

// セットカード付き sleep キャラ (a2 の有効候補)。setCards.length>0 で hasSetCards:true。
function setCardChar(uid: string, state: 'sleep' | 'stun' = 'sleep'): SceneCharacter {
  return sceneChar('D08017', uid, { state, setCards: [{ cardId: 'D08017', faceUp: false }] });
}

// 【登場時】(a1) 発火用 base: B02019 を手札から登場 (緑/L7 → 事件緑 + FILE7 で色/レベルゲート通過)
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B02019'];
  s.players.self.case.colors = ['緑'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7 (rules/12)
  return s;
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const sceneState = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid)?.state;

describe('B02019 伊織無我 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== a1 + DECOY: 【登場時】 deck-look — filter:{color:'緑', kind:'event'} 実評価の証明 =====
  it('a1 + DECOY: 登場で 上5枚中 緑イベント(GREEN_EVENT) を手札へ、青イベント・緑キャラ decoy は skip しデッキ下 (color & kind filter 実評価)', () => {
    let s = enterBase();
    // deck top5: [青event(先頭), 緑char, 緑event(=該当), filler, filler] + 下に filler。
    //   filter が無視されるなら「最初の event」= 青 decoy が拾われる (BUG-117/118 型バグ)。
    //   color filter が honor されるなら 青 をskip、kind filter が honor されるなら 緑char もskip → 緑event を拾う。
    s.players.self.deck = [BLUE_EVENT, GREEN_CHAR, GREEN_EVENT, FILLER, FILLER, FILLER, FILLER];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02019');
      runAllUntilEmpty(d); // AI 経路: 緑event を自動取得
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B02019'), 'B02019 が登場').toBeTruthy();
    // 該当 (緑イベント) を手札へ
    expect(inHand(s, GREEN_EVENT), '緑イベント GREEN_EVENT を手札へ').toBe(true);
    expect(inDeck(s, GREEN_EVENT), 'GREEN_EVENT はデッキから抜けた').toBe(false);
    // DECOY 主張: 青イベント (color違い) は手札に入らない → 残りとしてデッキへ
    expect(inHand(s, BLUE_EVENT), 'decoy(青イベント, color違い)は手札に入らない').toBe(false);
    expect(inDeck(s, BLUE_EVENT), 'decoy(青イベント)はデッキに残る (下へ)').toBe(true);
    // DECOY 主張: 緑キャラ (kind違い) は手札に入らない → 残りとしてデッキへ
    expect(inHand(s, GREEN_CHAR), 'decoy(緑キャラ, kind違い)は手札に入らない').toBe(false);
    expect(inDeck(s, GREEN_CHAR), 'decoy(緑キャラ)はデッキに残る (下へ)').toBe(true);
    // look 対象外 (top5 外) の filler は先頭側に残り、reveal 済みの非該当 (青ev/緑char/filler) はデッキ下へ。
    // 手札に1枚 (緑event) のみ移動 → デッキ枚数は 7-1=6。
    expect(s.players.self.deck.length, 'デッキ枚数 = 7 - 1(緑eventのみ手札へ)').toBe(6);
  });

  // ===== a1-N: window に緑イベント無し → $matched 空 → 手札0、全部デッキ下 (conditional 不成立 / 0枚可) =====
  it('a1 NEGATIVE: 上5枚に緑イベント不在 (青event + 緑char + filler) → 手札に何も加えず全reveal デッキ下 (filter unmet)', () => {
    let s = enterBase();
    s.players.self.deck = [BLUE_EVENT, GREEN_CHAR, BLUE_EVENT, FILLER, FILLER, FILLER];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02019');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B02019'), 'B02019 登場').toBeTruthy();
    expect(
      s.players.self.hand.filter((c) => c === BLUE_EVENT || c === GREEN_CHAR).length,
      '緑イベントが無いので何も手札に加えない',
    ).toBe(0);
    expect(inDeck(s, BLUE_EVENT), 'decoy(青イベント)はデッキに残る').toBe(true);
    expect(inDeck(s, GREEN_CHAR), 'decoy(緑キャラ)はデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (手札に1枚も入らない)').toBe(6);
  });

  // ===== a2 + DECOY: 自分のターン終了時 — pick filter:{hasSetCards:true} 実評価の証明 =====
  it('a2 + DECOY: 自分のターン終了時、セットカード持ち sleep キャラ(SET)を active 化、セット無し sleep(NOSET)は sleep のまま (hasSetCards filter 実評価)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // B02019 を現場に (on-scene triggered ability の host)。host 自身も sleep にしておき、
    // セットカード無しなので filter で候補外 → active 化されないことを assert する
    // (filter が無視されると host/NOSET が候補に混入し、AI 順次で誤って active 化されうる)。
    s.players.self.scene = [
      sceneChar('B02019', 'host', { state: 'sleep' }),      // セット無し sleep → 候補外 → sleep のまま
      setCardChar('SET'),                                   // セット持ち sleep → active 化されるべき
      sceneChar('D08017', 'NOSET', { state: 'sleep' }),     // セット無し sleep → 候補外 → sleep のまま
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');               // phase:end:start emit → a2 (turn:self) queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: 唯一の候補 SET を pick → active
    });

    // 該当 (セットカード持ち) は active 化
    expect(sceneState(s, 'SET'), 'セットカード持ち SET が active 化').toBe('active');
    // DECOY 主張: セットカード無しは候補に入らず active 化されない (sleep のまま)
    expect(sceneState(s, 'NOSET'), 'セット無し NOSET は候補外 → sleep のまま').toBe('sleep');
    expect(sceneState(s, 'host'), 'セット無し host(B02019自身) も候補外 → sleep のまま').toBe('sleep');
  });

  // ===== a2-stun: スタン状態のセット持ちを「アクティブにする」→ 代わりに sleep (rules/03/24) =====
  it('a2 stun特殊挙動: スタンのセットカード持ちを active 化対象に選んでも 代わりに sleep になる (スタンは active にならない)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02019', 'host'),
      setCardChar('STUN', 'stun'),  // セット持ち stun → active 指定でも sleep になる
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // rules/03/24: スタン状態でアクティブにする効果を受けた → active ではなく sleep になる
    expect(sceneState(s, 'STUN'), 'スタンのセット持ちは active にならず sleep になる').toBe('sleep');
  });

  // ===== a2-N: 「1枚まで」(0枚可) human decline — セット持ちが居ても active 化しない =====
  it('a2 NEGATIVE: human decline (0-pick) — セットカード持ちが居ても active 化せず sleep のまま (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02019', 'host'),
      setCardChar('SET'),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d); // human 経路: pick を surface して pause (drainAiEffectPicks は呼ばない)
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'a2 sceneSetState pick が surface').toBe('sceneSetState');
    expect(pending?.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);
    expect(
      pending?.candidates.map((c) => c.uid),
      '候補はセットカード持ち SET のみ (hasSetCards filter)',
    ).toEqual(['SET']);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(sceneState(s, 'SET'), 'decline: SET は active 化されず sleep のまま').toBe('sleep');
  });

  // ===== a2-take: human take — pick で選択すれば active 化する (decline channel の対) =====
  it('a2 take: human take — pick でセット持ち(SET)を選択すると active 化する', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02019', 'host'),
      setCardChar('SET'),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pending.candidates[0]!.uid);
    });
    expect(sceneState(s, 'SET'), 'take: SET を active 化').toBe('active');
  });

  // ===== a2 condition: 相手ターン終了時は発火しない (condition turn:self) =====
  it('a2 condition: 相手ターン終了時 (turn:opp) では a2 は発火せず セット持ちは sleep のまま', () => {
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B02019', 'host'),
      setCardChar('SET'),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'opp'); // 相手のターン終了 → condition turn:self 不成立 → a2 不発
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(sceneState(s, 'SET'), '相手ターン終了では a2 不発 → SET は sleep のまま').toBe('sleep');
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=enter deck-look filter{color:緑,kind:event}, a2=phase:end:start(turn:self) sceneSetState active filter{hasSetCards}', () => {
    const [a1, a2] = B02019.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const a1reveal = ((a1.effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args) as Record<string, unknown>;
    expect(a1reveal).toMatchObject({ maxN: 5, chooseMatch: 'upTo', filter: { color: '緑', kind: 'event' } });

    expect(a2.trigger).toMatchObject({ hook: 'phase:end:start' });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'self' });
    const a2atom = (a2.effect as { options: Array<{ args?: Record<string, unknown> }> }).options[0].args as {
      state?: string;
      target?: { query?: { filter?: Record<string, unknown> }; n?: { min?: number; max?: number } };
    };
    expect(a2atom.state, 'sceneSetState state=active').toBe('active');
    expect(a2atom.target?.query?.filter, 'pick filter hasSetCards:true').toMatchObject({ hasSetCards: true });
    expect(a2atom.target?.n, '1枚まで = 0枚可').toMatchObject({ min: 0, max: 1 });
  });
});
