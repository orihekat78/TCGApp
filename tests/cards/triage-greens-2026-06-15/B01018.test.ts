// gate5 RUNTIME behavior verification — B01018 宮野志保 (character, 青/科学者, L5 AP5000 LP1)
//
// 公式テキスト:
//   a1: 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［江戸川コナン］〛が
//       出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、
//       デッキをシャッフルする。
//   a2: 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// rules: 03-field-areas.md(現場リムーブ) / 10-action-event.md(ヒラメキ=任意発動) /
//        14-refresh.md / 17-icons.md(【相手ターン中】条件 / 「〜を持つ/名前を持つ」は印字判定) /
//        19-special-rules.md(複数名カード名の分割判定) / 26-qa-deck-refresh.md(reveal中はデッキ扱い)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   a1 step1 deckRevealUntil の filter:{cardName:'江戸川コナン'} を engine が **実際に評価** しているか。
//   no-maxN 経路 (atom-handlers.ts:1408-1416) は deck 先頭から 1 枚ずつ reveal し、最初の **filter match**
//   で停止する。filter は targetFilterToPredicate (:65) → cardName 分岐 (:101-105) が
//   allCardNameComponentsForDef (rules/19 で &/『』/() 分割) に委譲。
//   よって「カード名 江戸川コナン」のカードのみで停止し、それを手札へ。
//
// decoy/negative (filter が実評価されている証明):
//   D1: deck 先頭に **江戸川コナンでない** 通常キャラ (DEC_B01018_NOTCONAN) を置く。filter が無視される
//       なら「最初のカード」= decoy で停止して decoy が手札に入る (BUG-117/118 型バグ)。filter が
//       honor されるなら decoy を skip して 江戸川コナン(B01011) で停止し、decoy はデッキ下へ。
//   N1: deck 全体に 江戸川コナン が 1 枚も無い → 全公開して $matched 空 → 手札に何も加えず、
//       公開した全カードをデッキ下へ (conditional 不成立)。
//   a1-cond: 【相手ターン中】(turn.player='opp') gate — 自分ターン(turn:self)では発火しない。
//   a2: 【ヒラメキ】evidence:remove-by-action で fire→draw / skip(任意発動)→draw しない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

// 江戸川コナンでない通常キャラ decoy (cardName 条件のみで弾かれるべき)。
// id 衝突回避のため DEC_B01018_ prefix。
function notConan(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: ['DEC_NAME_' + id], colors: ['青'],
    level: 4, ap: 4000, lp: 1, traits: ['科学者'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);

describe('B01018 宮野志保 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerAll();
    registerCardDef(notConan('DEC_B01018_NOTCONAN'));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ===== a1 + DECOY: 【相手ターン中】【現場リムーブ時】 cardName filter 実評価 =====
  it('a1 + DECOY: 相手ターン中の現場リムーブで 上から「江戸川コナン」が出るまで公開→手札へ、先頭の非コナンdecoyは skip しデッキ下 (cardName filter 実評価)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
    s.players.self.scene = [sceneChar('B01018', 'shiho#1')];
    // deck top: [非コナンdecoy(先頭), 江戸川コナン(B01011), 別の江戸川コナン(B01008), filler]。
    //   filter が無視されるなら先頭の decoy で停止して decoy が手札に入る (BUG-117/118 型バグ)。
    //   filter が honor されるなら decoy を skip して B01011 で停止 → B01011 を手札へ。
    s.players.self.deck = ['DEC_B01018_NOTCONAN', 'B01011', 'B01008', 'D08017'];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'shiho#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    // 江戸川コナン(B01011) を手札へ、デッキから抜ける
    expect(inHand(s, 'B01011'), '最初に出た江戸川コナン(B01011)を手札へ').toBe(true);
    expect(inDeck(s, 'B01011'), 'B01011 はデッキから抜けた').toBe(false);
    // DECOY 主張: 非コナン decoy は手札に入らず、残り(公開分)としてデッキ下へ
    expect(inHand(s, 'DEC_B01018_NOTCONAN'), 'decoy(非コナン)は手札に入らない (cardName filter 実評価)').toBe(false);
    expect(inDeck(s, 'DEC_B01018_NOTCONAN'), 'decoy は残り公開分としてデッキ下に残る').toBe(true);
    // 2枚目の江戸川コナン(B01008) は最初の match で停止しているので公開されず、デッキに残る
    expect(inDeck(s, 'B01008'), '停止後の B01008 は公開されずデッキに残る').toBe(true);
    expect(inDeck(s, 'D08017'), '未公開の filler はデッキに残る').toBe(true);
    // デッキ枚数: 手札に1枚抜けた分だけ減る (deckToBottom/shuffle は枚数不変)
    expect(s.players.self.deck.length, 'デッキは手札へ移った1枚分だけ減る').toBe(startDeckLen - 1);
    // 手札に加わったのはちょうど1枚 (江戸川コナンのみ)
    expect(s.players.self.hand.length, '手札に加わったのは江戸川コナン1枚のみ').toBe(1);
  });

  // ===== a1 N1: 江戸川コナンがデッキに無い → 全公開して手札 add 0、全部デッキ下 =====
  it('a1 N1: デッキに江戸川コナンが無ければ全公開→手札に加えず公開分は全てデッキ下 (filter unmet)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B01018', 'shiho#1')];
    // deck に江戸川コナンは1枚も無い (非コナンdecoy + 円谷光彦 filler)
    s.players.self.deck = ['DEC_B01018_NOTCONAN', 'D08017'];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'shiho#1', 'effect');
      runAllUntilEmpty(d);
    });

    // 何も手札に加えない ($matched 空 → conditional 不成立)
    expect(inHand(s, 'DEC_B01018_NOTCONAN'), '江戸川コナン不在 → decoy も手札に入らない').toBe(false);
    expect(inHand(s, 'D08017'), '江戸川コナン不在 → filler も手札に入らない').toBe(false);
    expect(s.players.self.hand.length, '手札 add 0').toBe(0);
    // 全公開カードはデッキに残る (下へ)。デッキ枚数不変
    expect(inDeck(s, 'DEC_B01018_NOTCONAN'), 'decoy はデッキに残る').toBe(true);
    expect(inDeck(s, 'D08017'), 'filler はデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (1枚も手札に入らない)').toBe(startDeckLen);
  });

  // ===== a1 condition: 【相手ターン中】gate — 自分ターンでは発火しない =====
  it('a1 condition: 自分ターン中 (turn:self) の現場リムーブでは a1 が発火しない (【相手ターン中】gate)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false }; // 自分ターン
    s.players.self.scene = [sceneChar('B01018', 'shiho#1')];
    s.players.self.deck = ['B01011', 'B01008', 'D08017'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'shiho#1', 'effect');
      runAllUntilEmpty(d);
    });

    // 自分ターンでは a1 不発 → 江戸川コナンは手札に加わらずデッキに残る
    expect(inHand(s, 'B01011'), '自分ターンでは江戸川コナンを手札に加えない').toBe(false);
    expect(inDeck(s, 'B01011'), 'B01011 はデッキに残る').toBe(true);
    expect(s.players.self.hand.length, '自分ターンでは手札変化なし').toBe(0);
  });

  // ===== a2: 【ヒラメキ】evidence:remove-by-action で fire→1ドロー / skip→ドローしない =====
  describe('a2 【ヒラメキ】(evidence:remove-by-action)', () => {
    function fullReset(): void {
      engine.cards._resetRegistry();
      event._resetRegistry();
      _resetUidCounter();
      _resetPendingHirameki();
      _resetHiramekiRegistered();
      _resetTriggeredRegistered();
      registerAll();
      registerHiramekiListener();
      registerTriggeredListener();
      useGameStateStore.setState({
        gameState: null,
        activeActionId: null,
        pendingHirameki: null,
        pendingMisread: null,
      });
    }

    function makeStateWithEvidence(): GameState {
      const s = createEmptyGameState();
      // B01018 が証拠としてリムーブされる → 自身の【ヒラメキ】が発火
      s.players.self.evidence = [{ cardId: 'B01018', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
      s.players.self.deck = Array(10).fill('D08017');
      return s;
    }

    beforeEach(() => {
      fullReset();
    });

    it('fire → デッキから1ドロー (hand +1 / deck -1)', () => {
      const s = makeStateWithEvidence();
      const startHand = s.players.self.hand.length;
      const startDeck = s.players.self.deck.length;
      const { pending } = openCaseHirameki(s, 'B01018');
      expect(pending, 'B01018 の【ヒラメキ】が発火 (pending set)').not.toBeNull();
      expect(pending.cardId, 'pending は B01018 のヒラメキ').toBe('B01018');
      const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' });
      expect(r.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.hand.length, 'fire → 手札 +1').toBe(startHand + 1);
      expect(after.players.self.deck.length, 'fire → デッキ -1').toBe(startDeck - 1);
    });

    it('NEGATIVE: skip (任意発動を見送り) → ドローしない (rules/10)', () => {
      const s = makeStateWithEvidence();
      const startHand = s.players.self.hand.length;
      const startDeck = s.players.self.deck.length;
      const { pending } = openCaseHirameki(s, 'B01018');
      expect(pending, 'ヒラメキが発火 (任意発動 surface)').not.toBeNull();
      const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' });
      expect(r.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.hand.length, 'skip → 手札不変 (ドローしない)').toBe(startHand);
      expect(after.players.self.deck.length, 'skip → デッキ不変').toBe(startDeck);
    });
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=leave:to-remove(selfOnly)+turn:opp / deckRevealUntil filter{cardName:江戸川コナン} / a2=ヒラメキ draw', () => {
    // 動的 import 不要 — registerAll() 済みなので def registry から取得
    const def = engine.cards.get('B01018')!;
    const [a1, a2] = def.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    const step0 = (a1.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps[0];
    expect(step0.verb).toBe('deckRevealUntil');
    expect(step0.args).toMatchObject({ filter: { cardName: '江戸川コナン' } });
    // no-maxN / no-chooseMatch (tier1: player pick surface 無し)
    expect(step0.args?.maxN, 'maxN 無し (出るまで型)').toBeUndefined();
    expect(step0.args?.chooseMatch, 'chooseMatch 無し (pick surface 無し)').toBeUndefined();
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb?: string }).verb).toBe('draw');
  });
});
