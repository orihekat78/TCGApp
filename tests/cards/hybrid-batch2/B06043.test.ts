// hybrid-batch2 probe — B06043 恋と推理の剣道大会 (case)
//
// 公式テキスト (refusedLine = a2 novel句):
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。
//   その中から〚カード名［服部平次］〛か〚［遠山和葉］〛を1枚まで公開して手札に加え、残りを好きな順番で
//   デッキの下に移す。この能力は自分の現場に〚カード名［服部平次］〛か〚［遠山和葉］〛がいる場合に宣言できる。
//   (a1 = compiledRest: この事件が解決編に移行したとき、自分は手札を1枚リムーブする — 本 probe は a2 に集中)
//
// novel 経路: 事件カード declared (uid='case:self') / cost flipFaceUpEvidence n:2 /
//   condition AND[caseStatus:解決編, bond{cardName:[服部平次,遠山和葉]}] /
//   effect sequence[ deckRevealUntil{maxN:3, chooseMatch:'upTo', filter{cardName:[…],kind:character}},
//     conditional{ if $matched matched → handAddFromDeck $matched.cardId }, deckToBottomBound $revealed ]
//
// B06043 は B07051 桃井恵子 (deckRevealUntil maxN:1 forced) の親戚。差分 = chooseMatch:'upTo'
// (「1枚まで」→ human owner に pick を surface、decline=加えない可 B08020 公式Q&A) + 事件 declared の
// cost/condition。ゆえに本 probe は forced-first-match (AI) に加え human decline / owner=opp pick を pin。
//
// rules: 15 (「〜まで」=0枚可 / chooseMatch:'upTo' decline), 17 (【ターン1】【解決編】 条件外=持たない扱い),
//        21 (宣言 cost = flipFaceUpEvidence 2つ全部行えなければ使用不可), 26-qa-deck-refresh (deck-look 取得選択)
//
// production dispatch: activateDeclaredAbility(uid,'a2',{flipFaceUpEvidence:{indices}}) + runAllUntilEmpty (BUG-171)。
// human pick: _drainPendingEffectPickSide → applyPickAndContinuation(take) / applyPickSkipAndContinuation(decline)。
// BUG-174 owner='opp' pin: opp が case:opp を宣言 (setHuman('opp')) → opp deck/hand/evidence 側で pick 解決。
// BUG-117/118 decoy: cardName filter 外 (江戸川コナン) / 名無しフィラーが window に居ても match されないことを assert。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import {
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import { B06043 } from '@/cards/ct-p06/B06043';
import type { CardDef, GameState, EffectCtx, EvidenceCard } from '@/engine/types';

// --- fixtures (DEC_ prefix で実カードと非衝突) ---
const HEIJI = 'DEC_B06043_HEIJI';   // names[服部平次] character — bond + deck match
const WAKA = 'DEC_B06043_WAKA';     // names[遠山和葉] character — deck match
const CONAN = 'DEC_B06043_CONAN';   // names[江戸川コナン] character — cardName filter 外 decoy
const D1 = 'DEC_B06043_D1';         // 名無しフィラー (character, name=id) — 非match
const D2 = 'DEC_B06043_D2';
const D3 = 'DEC_B06043_D3';
const TAIL = 'DEC_B06043_TAIL';
const X = 'DEC_B06043_X';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerFixtures(): void {
  registerCardDef(B06043);
  registerCardDef(ch(HEIJI, { names: ['服部平次'] }));
  registerCardDef(ch(WAKA, { names: ['遠山和葉'] }));
  registerCardDef(ch(CONAN, { names: ['江戸川コナン'] }));
  for (const id of [D1, D2, D3, TAIL, X]) registerCardDef(ch(id));
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });

// case:self を【解決編】+ bond(HEIJI) + 裏証拠2 + deck をセットした base。
function base(opts: {
  side?: 'self' | 'opp';
  status?: string;
  bond?: boolean;
  facedown?: number;
  deck?: string[];
} = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.case.cardId = 'B06043';
  p.case.status = (opts.status ?? '解決編') as GameState['players']['self']['case']['status'];
  p.case.colors = ['緑'];
  p.scene = (opts.bond ?? true) ? [sceneChar(HEIJI, 'h1')] : [];
  const fd = opts.facedown ?? 2;
  p.evidence = Array.from({ length: fd }, (_, i) => ev(`SE${i}`));
  p.deck = opts.deck ?? [WAKA, D1, D2, TAIL];
  return s;
}

const uidFor = (side: 'self' | 'opp') => (side === 'self' ? 'case:self' : 'case:opp');

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerFixtures();
  registerTriggeredListener();
});

// ============================================================
// a2 AI (forced first-match) path — chooseMatch:'upTo' は human 不在で先頭 match を自動取得
// ============================================================
describe('B06043 a2 — deckRevealUntil upTo1(服部平次/遠山和葉) AI auto-take + rest→deck bottom', () => {
  const activate = (s0: GameState, side: 'self' | 'opp' = 'self', indices = [0, 1]) => produce(s0, (d) => {
    activateDeclaredAbility(d, uidFor(side), 'a2', { flipFaceUpEvidence: { indices } });
    runAllUntilEmpty(d);
  });

  it('deck top3 に遠山和葉 → 手札へ + 残り2枚デッキ下 + cost 裏証拠2つ表向き (AI: pick surface しない)', () => {
    const after = activate(base({ deck: [WAKA, D1, D2, TAIL] }));
    expect(after.players.self.hand.includes(WAKA), '遠山和葉 → 手札').toBe(true);
    expect(after.players.self.deck.includes(WAKA), 'WAKA は deck から抜けた').toBe(false);
    expect(after.players.self.deck, '残り[D1,D2]をデッキ下へ').toEqual([TAIL, D1, D2]);
    expect(after.players.self.evidence[0].faceUp && after.players.self.evidence[1].faceUp, 'cost=裏証拠2つ表向き').toBe(true);
    expect(_peekPendingEffectPickQueueLength(), 'AI 経路は pick を surface しない').toBe(0);
  });

  it('decoy 江戸川コナン(cardName filter 外) が window 先頭 → skip して遠山和葉を取得 / コナンはデッキ下', () => {
    const after = activate(base({ deck: [CONAN, WAKA, TAIL, X] }));
    expect(after.players.self.hand.includes(WAKA), '遠山和葉のみ手札').toBe(true);
    expect(after.players.self.hand.includes(CONAN), '江戸川コナンは手札に入らない (cardName filter 外)').toBe(false);
    expect(after.players.self.deck.includes(CONAN), 'コナンは deck に残る (残りとして下へ)').toBe(true);
    expect(after.players.self.deck, '残り[CONAN,TAIL]を下へ').toEqual([X, CONAN, TAIL]);
  });

  it('window(top3) に match 無し → 手札加算なし + 全3枚デッキ下 (cost は消費)', () => {
    const after = activate(base({ deck: [D1, D2, D3, TAIL] }));
    expect(after.players.self.hand.length, '手札に加えない').toBe(0);
    expect(after.players.self.deck, '公開3枚を下へ').toEqual([TAIL, D1, D2, D3]);
    expect(after.players.self.evidence[0].faceUp, 'match 無しでも cost は支払済').toBe(true);
  });

  it('【ターン1】: 宣言後 canDeclaredAbility=false (2回目不可)', () => {
    const after = activate(base());
    expect(canDeclaredAbility(after, 'case:self', 'a2'), '同ターン2回目は宣言不可').toBe(false);
  });
});

// ============================================================
// condition gate — 【解決編】 かつ 現場に 服部平次/遠山和葉 (bond)
// ============================================================
describe('B06043 a2 — condition AND[caseStatus:解決編, bond[服部平次/遠山和葉]]', () => {
  it('解決編 + bond あり → 宣言可', () => {
    expect(canDeclaredAbility(base({ status: '解決編', bond: true }), 'case:self', 'a2')).toBe(true);
  });
  it('事件編 (解決編でない) → 宣言不可', () => {
    expect(canDeclaredAbility(base({ status: '事件編', bond: true }), 'case:self', 'a2')).toBe(false);
  });
  it('解決編 + bond なし (現場に服部/和葉なし) → 宣言不可', () => {
    expect(canDeclaredAbility(base({ status: '解決編', bond: false }), 'case:self', 'a2')).toBe(false);
  });
});

// ============================================================
// cost gate — flipFaceUpEvidence n:{min:2,max:2} (裏証拠2つなければ使用不可, rules/21)
// ============================================================
describe('B06043 a2 — cost flipFaceUpEvidence 2つ (canPay)', () => {
  const a2 = B06043.abilities.find((a) => a.id === 'a2')!;
  const ctx: EffectCtx = {
    source: { cardId: 'B06043', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
    bindings: {},
  };
  it('裏証拠1つのみ → canPay=false (2つ表向きにできない)', () => {
    expect(engineCost.canPay(base({ facedown: 1 }), a2.cost!, ctx)).toBe(false);
  });
  it('裏証拠2つ → canPay=true', () => {
    expect(engineCost.canPay(base({ facedown: 2 }), a2.cost!, ctx)).toBe(true);
  });
});

// ============================================================
// human pick 経路 — chooseMatch:'upTo' owner が human のとき pick を surface
// ============================================================
describe('B06043 a2 — chooseMatch:upTo human pick (decline / owner=opp take)', () => {
  it('human self: match ありでも decline → 手札に加えず全公開をデッキ下 (rules/15 「まで」/ B08020 Q&A)', () => {
    setHuman('self');
    const after = produce(base({ deck: [WAKA, D1, D2, TAIL] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'human owner → pick surface').not.toBeNull();
      expect(pending!.nMin, '「1枚まで」→ 0枚可 (decline 可)').toBe(0);
      applyPickSkipAndContinuation(d, pending!); // decline (加えない)
    });
    expect(after.players.self.hand.includes(WAKA), 'decline → 遠山和葉を手札に加えない').toBe(false);
    expect(after.players.self.deck.includes(WAKA), 'WAKA は deck に残る').toBe(true);
    expect(after.players.self.deck, '公開3枚(WAKA含む)を下へ').toEqual([TAIL, WAKA, D1, D2]);
  });

  it('owner=opp (case:opp, human opp) take → opp の deck/hand/evidence 側で解決 (BUG-174 pin)', () => {
    setHuman('opp');
    const after = produce(base({ side: 'opp', deck: [WAKA, D1, D2, TAIL] }), (d) => {
      activateDeclaredAbility(d, 'case:opp', 'a2', { flipFaceUpEvidence: { indices: [0, 1] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'opp owner human → pick surface').not.toBeNull();
      expect(pending!.player, 'chooser = opp').toBe('opp');
      const cand = pending!.candidates.find((c) => c.cardId === WAKA);
      expect(cand, '遠山和葉 が候補').toBeTruthy();
      applyPickAndContinuation(d, pending!, cand!.uid); // take
    });
    expect(after.players.opp.hand.includes(WAKA), '相手の手札に遠山和葉').toBe(true);
    expect(after.players.opp.deck, '相手 deck: 残り2枚を下へ').toEqual([TAIL, D1, D2]);
    expect(after.players.opp.evidence[0].faceUp && after.players.opp.evidence[1].faceUp, '相手の裏証拠2つ表向き').toBe(true);
    expect(after.players.self.hand.length, '自分側は無影響').toBe(0);
  });
});
