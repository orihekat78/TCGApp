// gate5 RUNTIME behavior verification — B05020 吉田歩美 (character, 青/少年探偵団, L3 AP2000 LP1)
//
// 公式テキスト:
//   a1: 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚見る。その中から
//       〚カード名［江戸川コナン］〛か〚［灰原哀］〛か〚［小嶋元太］〛か〚［円谷光彦］〛を
//       1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   a2: 【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// rules: 03-field-areas.md(現場リムーブ) / 09-cutin-disguise.md(カットイン=色制限なし/コンタクト終了で失効) /
//        14-refresh.md / 15-abilities-effects.md(「〜まで」=0枚可) /
//        17-icons.md(【相手ターン中】条件 / 「カード名を持つ」=印字判定) /
//        19-special-rules.md(複数名カード名の分割判定) / 22-qa-action-contact.md /
//        26-qa-deck-refresh.md(reveal中はデッキ扱い)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   a1 step1 deckRevealUntil の filter:{cardName:[江戸川コナン,灰原哀,小嶋元太,円谷光彦]} を
//   engine が **実際に評価** しているか。maxN:1 経路 (atom-handlers.ts:1397-1410) は
//   上から min(deck,1)=1 枚 reveal し、その 1 枚が filter match なら $matched、しなければ null。
//   filter は targetFilterToPredicate (:101-105) → cardName(配列) を allCardNameComponentsForDef
//   (rules/19 分割名) に OR membership 委譲。
//   よって「window 1 枚が上記4名のいずれか」のときだけ手札に加わり、それ以外は加わらず
//   $revealed(残り) として deckToBottomBound でデッキ下へ。
//
//   ⚠ filter が壊れて always-true なら、上記4名でない decoy が top でも手札に加わってしまう
//      (BUG-117/118 型バグ)。下記 DECOY 主張がそれを検出する。
//
// decoy/negative:
//   D1 (filter 実評価): top に **4名でない** 通常キャラ decoy を置く。filter honor なら matched=null →
//      手札 add 0、decoy はデッキ下へ。filter 無視(always-true)なら decoy が手札に入る(=バグ検出)。
//   P1 (positive): top に 小嶋元太(D08009 = 該当) を置く → 手札へ、デッキから抜ける。
//   N1 (「1枚まで」=0枚可, rules/15): human owner pick で **decline** → 該当が top でも手札に加えず
//      reveal をデッキ下へ。N1b: take → 加わる (decline channel の対)。
//   C1 (【相手ターン中】gate): 自分ターン(turn:self) では a1 が発火しない。
//   a2 (descriptor + 構造): 【カットイン】charModifyAP delta:1000 scope:'contact'。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 4名のいずれでもない通常キャラ decoy (cardName 条件のみで弾かれるべき)。
// id 衝突回避のため DEC_B05020_ prefix。filler も同様に 4名でない synthetic にして
// 「FB=D08017=円谷光彦(=該当!)」の混入事故を回避する。
function decoyChar(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: ['DEC_NAME_' + id], colors: ['青'],
    level: 4, ap: 4000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const NOTHIT = 'DEC_B05020_NOTHIT';   // 4名でない (top decoy / filter unmet 用)
const FILLER = 'DEC_B05020_FILLER';   // 4名でない (window 外 filler、refresh 回避)
const HIT = 'D08009';                  // 実在: 小嶋元太 (= 該当, character)

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);

describe('B05020 吉田歩美 — gate5 runtime behavior', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerAll();
    registerCardDef(decoyChar(NOTHIT));
    registerCardDef(decoyChar(FILLER));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // base: 相手ターン中、B05020 が自分の現場にいる
  function base(turnPlayer: 'self' | 'opp' = 'opp'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 6, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05020', 'ayumi#1')];
    return s;
  }

  // ===== a1 P1 (positive, AI 経路): top=小嶋元太(該当) → 手札へ、$revealed 空 =====
  it('a1 P1: 相手ターン中の現場リムーブで 上1枚=小嶋元太(該当) を手札へ、デッキから抜ける (AI auto-take)', () => {
    let s = base('opp');
    // window=top1=HIT(該当)。下に filler を 2 枚 (window 外、refresh 回避)。
    s.players.self.deck = [HIT, FILLER, FILLER];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    expect(inHand(s, HIT), '小嶋元太(該当)を手札へ').toBe(true);
    expect(inDeck(s, HIT), 'HIT はデッキから抜けた').toBe(false);
    expect(s.players.self.hand.length, '手札に加わったのはちょうど1枚').toBe(1);
    // window=1枚で matched → $revealed(残り)=空 → デッキ下移動なし。deck は HIT 抜けた分だけ減る
    expect(s.players.self.deck.length, 'デッキは手札へ移った1枚分だけ減る').toBe(startDeckLen - 1);
    expect(inDeck(s, FILLER), 'window 外 filler はデッキに残る').toBe(true);
  });

  // ===== a1 D1 (DECOY = filter 実評価の証明): top=4名でない decoy → 手札 add 0、デッキ下へ =====
  it('a1 D1 + DECOY: 上1枚=4名でない decoy は手札に加えず デッキ下へ (cardName filter 実評価)', () => {
    let s = base('opp');
    // window=top1=NOTHIT(4名でない)。filter honor → matched=null → 手札 add 0、decoy はデッキ下へ。
    //   filter が壊れて always-true なら NOTHIT が手札に入る (= BUG-117/118 型バグ検出)。
    s.players.self.deck = [NOTHIT, FILLER, FILLER];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect');
      runAllUntilEmpty(d);
    });

    // DECOY 主張: 4名でない decoy は手札に入らない (filter が実評価されている証明)
    expect(inHand(s, NOTHIT), 'decoy(4名でない)は手札に入らない (cardName filter 実評価)').toBe(false);
    expect(s.players.self.hand.length, '手札 add 0 (該当が無い)').toBe(0);
    // 残り(=reveal した decoy)はデッキ下へ。デッキ枚数不変 (手札に1枚も入らない)
    expect(inDeck(s, NOTHIT), 'decoy は残り公開分としてデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (1枚も手札に入らない)').toBe(startDeckLen);
    // deckToBottomBound: NOTHIT(reveal済) が下へ → 末尾。未公開 FILLER が先頭側に来る
    expect(s.players.self.deck[s.players.self.deck.length - 1], 'reveal した decoy が下へ').toBe(NOTHIT);
  });

  // ===== a1 N1 (「1枚まで」=0枚可, rules/15): human owner decline — 該当があっても手札に加えない =====
  it('a1 N1: human decline (0-pick) — 上1枚=小嶋元太(該当) でも手札に加えず デッキ下へ (「〜まで」=0枚可)', () => {
    setHuman('self'); // owner='self' → pick が surface
    let s = base('opp');
    s.players.self.deck = [HIT, FILLER, FILLER];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect');
      runAllUntilEmpty(d); // human 経路: pick を surface して pause
    });
    // decline 前は手札にまだ入らない
    expect(inHand(s, HIT), 'decline 前は手札にまだ入らない').toBe(false);
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'deckRevealUntil pick が surface').toBe('deckRevealUntil');
    expect(pending?.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.candidates.map((c) => c.cardId), '候補は該当 HIT のみ (cardName filter)').toEqual([HIT]);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(inHand(s, HIT), 'decline: HIT は手札に入らない').toBe(false);
    expect(inDeck(s, HIT), 'HIT は残りとしてデッキへ').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (手札 add 0)').toBe(startDeckLen);
  });

  // ===== a1 N1b (decline channel の対): human take — pick で取得すれば手札に入る =====
  it('a1 N1b: human take — pick で小嶋元太(該当)を選択すると手札に加わる', () => {
    setHuman('self');
    let s = base('opp');
    s.players.self.deck = [HIT, FILLER, FILLER];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.candidates.map((c) => c.cardId), '候補は HIT のみ').toEqual([HIT]);
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pending.candidates[0]!.uid);
    });
    expect(inHand(s, HIT), 'take: HIT を手札へ').toBe(true);
    expect(inDeck(s, HIT), 'HIT はデッキから抜けた').toBe(false);
  });

  // ===== a1 C1 (【相手ターン中】gate): 自分ターン中は a1 が発火しない =====
  it('a1 C1: 自分ターン中 (turn:self) の現場リムーブでは a1 が発火しない (【相手ターン中】gate)', () => {
    let s = base('self'); // 自分ターン
    s.players.self.deck = [HIT, FILLER, FILLER];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect');
      runAllUntilEmpty(d);
    });

    // 自分ターンでは a1 不発 → 該当は手札に加わらずデッキに残る
    expect(inHand(s, HIT), '自分ターンでは HIT を手札に加えない').toBe(false);
    expect(inDeck(s, HIT), 'HIT はデッキに残る').toBe(true);
    expect(s.players.self.hand.length, '自分ターンでは手札変化なし').toBe(0);
    expect(s.players.self.deck.length, 'デッキ枚数不変').toBe(startDeckLen);
  });

  // ===== a1 D1-human (filter 実評価, human 経路でも): top=decoy → pick surface 無し → 手札 add 0 =====
  it('a1 D1-human: human owner でも top=4名でない decoy は pick が surface せず 手札 add 0 (match 0件)', () => {
    setHuman('self');
    let s = base('opp');
    s.players.self.deck = [NOTHIT, FILLER, FILLER];
    const startDeckLen = s.players.self.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'ayumi#1', 'effect');
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, '該当0件でも公開確認をsurface').toBe('deckRevealUntil');
    expect(pending?.candidates, '選択可能候補は0件').toEqual([]);
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(inHand(s, NOTHIT), 'decoy は手札に入らない (filter 実評価)').toBe(false);
    expect(s.players.self.hand.length, '手札 add 0').toBe(0);
    expect(inDeck(s, NOTHIT), 'decoy はデッキに残る (下へ)').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変').toBe(startDeckLen);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=leave:to-remove(selfOnly)+turn:opp / deckRevealUntil maxN:1 chooseMatch:upTo filter{cardName:[4名]} / a2=カットイン charModifyAP+1000', () => {
    const def = engine.cards.get('B05020')!;
    const [a1, a2] = def.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    const steps = (a1.effect as { steps: Array<{ kind: string; verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0].verb).toBe('deckRevealUntil');
    expect(steps[0].args).toMatchObject({
      maxN: 1, chooseMatch: 'upTo',
      filter: { cardName: ['江戸川コナン', '灰原哀', '小嶋元太', '円谷光彦'] },
      bind: '$revealed', bindMatch: '$matched',
    });
    expect(steps[1].kind).toBe('conditional');
    expect(steps[2].verb).toBe('deckToBottomBound');
    // a2 = 【カットイン】 charModifyAP +1000 scope:contact
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect((a2.effect as { verb?: string; args?: Record<string, unknown> }).verb).toBe('charModifyAP');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({
      uid: '$contact.byUid', delta: 1000, scope: 'contact',
    });
  });
});
