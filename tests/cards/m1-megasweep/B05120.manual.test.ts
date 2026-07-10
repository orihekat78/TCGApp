// m1-megasweep probe — B05120 集められた名探偵 (case, engine変更0)
//
// 印字 (ground truth, payloads/B05120.json fullTexts.effect):
//   a1: この事件が解決編になったとき、相手はカードを1枚引く。
//   a2: 自分は〚特徴［探偵］〛以外のキャラを手札から使用できない。
//       （ネクストヒントでの使用も「手札から使用」に含まれる）  ← novel refusedLine
//
// rules: 01 (解決編移行 一方通行), 06 (イベントは種別対象外), 12/20 (手札の使用 gate),
//        15 (「〜以外」)。qA: 効果登場/カットイン/変装/ヒラメキ は本制限外 (別経路ゆえ本 gate を通らない)。
//
// novel 経路 = production dispatch:
//   a1: mutate.case.toResolved(d, p) → case:to-resolved emit → triggered listener → draw player:'opp'
//       (resolvePlayer は ctx.source.player=case所有者 相対 → 自分の事件解決なら相手が引く)。
//   a2: canHandUseCard(state, p, cardId) 実 gate。handUseCharRestrictAllows が case def の
//       continuousModifier.handUseRestrictFilter{trait:探偵} を走査。
// BUG-174: owner='opp' で挙動が反転しないことを a1 reversal / a2 source-pin で確認。
// BUG-117/118: filter 条件外 (非探偵キャラ) を非候補 / イベントは kind 対象外で許可、を assert。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { canHandUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, CardDef } from '@/engine/types';
import { B05120 } from '@/cards/ct-p05/B05120';

type CaseStatus = GameState['players']['self']['case']['status'];
type Player = 'self' | 'opp';

const FB = { type: 'card-back' as const, cardId: 'FILL' };
const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

// 手札の使用 gate fixtures — 色 ⊆ 事件(全5色) / level 1 ≤ file
function chDef(id: string, traits: string[] = []): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 1, ap: 3000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
}
function evtDef(id: string): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 1,
    traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
}
// restrict 不在の plain case (a2 source-pin 用)
const PLAIN_CASE: CardDef = { id: 'PLAINCASE', no: '9/PLAINCASE', kind: 'case', names: ['plain'],
  colors: ['青', '緑', '白', '赤', '黄'], caseTraits: [], traits: [], rarity: 'C', imageUrl: '',
  abilities: [], ruleRefs: [] } as unknown as CardDef;

const TANTEI = 'TANTEI';       // 特徴[探偵] キャラ → 許可
const NONTANTEI = 'NONTANTEI'; // 非探偵 キャラ → 不許可 (decoy)
const EV = 'EV_CARD';          // イベント (kind 対象外 → 許可)

function withCase(p: Player, cardId: string, status: CaseStatus): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: p, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players[p].case = { cardId, status, requiredEvidence: 7, colors: ['青', '緑', '白', '赤', '黄'], declaredUseCount: {} };
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  registerCardDef(B05120);
  registerCardDef(PLAIN_CASE);
  registerCardDef(chDef(TANTEI, ['探偵']));
  registerCardDef(chDef(NONTANTEI, []));
  registerCardDef(evtDef(EV));
  registerTriggeredListener();
});

function resolve(s0: GameState, p: Player): GameState {
  return produce(s0, (d) => {
    mutate.case.toResolved(d, p);
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    runAllUntilEmpty(d);
  });
}

describe('B05120 a1 — case:to-resolved (production hook) → 相手が1ドロー', () => {
  it('自分の事件 事件編→解決編 → 相手(opp)が deck top を1枚引く / 自分は引かない', () => {
    const s = withCase('self', 'B05120', '事件編');
    s.players.opp.deck = ['OPPTOP', 'D1', 'D2'];
    s.players.self.deck = ['SELFTOP', 'D3'];
    const after = resolve(s, 'self');
    expect(after.players.self.case.status, '解決編へ移行').toBe('解決編');
    expect(after.players.opp.hand, '相手が deck top を引く').toContain('OPPTOP');
    expect(after.players.opp.hand.length, '相手 +1 枚').toBe(1);
    expect(after.players.self.hand, '自分は引かない').not.toContain('SELFTOP');
    expect(after.players.self.hand.length, '自分の手札は不変').toBe(0);
  });

  it('reversal pin (BUG-174): 相手(opp)の事件が解決編 → 引くのは自分(self)、相手は引かない', () => {
    const s = withCase('opp', 'B05120', '事件編');
    s.players.self.deck = ['SELFTOP', 'D1', 'D2'];
    s.players.opp.deck = ['OPPTOP', 'D3'];
    const after = resolve(s, 'opp');
    expect(after.players.opp.case.status, 'opp 解決編へ移行').toBe('解決編');
    expect(after.players.self.hand, 'source=opp 相対の「相手」= self が引く').toContain('SELFTOP');
    expect(after.players.self.hand.length, 'self +1 枚').toBe(1);
    expect(after.players.opp.hand.length, '事件所有者(opp)は引かない').toBe(0);
  });

  it('negative: 既に解決編 → toResolved は no-op、a1 再発火せず誰も引かない', () => {
    const s = withCase('self', 'B05120', '解決編');
    s.players.opp.deck = ['OPPTOP', 'D1'];
    const after = resolve(s, 'self');
    expect(after.players.opp.hand.length, '再発火なし → 相手手札不変').toBe(0);
  });
});

describe('B05120 a2 — handUseRestrictFilter{trait:探偵}: 探偵以外のキャラは手札使用不可', () => {
  it('探偵キャラは許可 / 非探偵キャラは不許可 (decoy) / イベントは kind 対象外で許可', () => {
    const s = withCase('self', 'B05120', '事件編');
    s.players.self.hand = [TANTEI, NONTANTEI, EV];
    s.players.self.file = [FB, FB, FB]; // level 1 ≤ file
    expect(canHandUseCard(s, 'self', TANTEI), '特徴[探偵] キャラ → 許可').toBe(true);
    expect(canHandUseCard(s, 'self', NONTANTEI), '非探偵 キャラ → 不許可 (decoy)').toBe(false);
    expect(canHandUseCard(s, 'self', EV), 'イベントは種別対象外 → 許可 (rules/06)').toBe(true);
  });

  it('source pin (BUG-174): restrict は自分の事件(B05120)由来 — opp が B05120 事件でも opp 側に適用', () => {
    // owner='opp' の事件が B05120 のとき、restrict は opp 自身の手札使用に効く (side 反転しない)
    const s = withCase('opp', 'B05120', '事件編');
    s.players.opp.hand = [TANTEI, NONTANTEI];
    s.players.opp.file = [FB, FB, FB];
    expect(canHandUseCard(s, 'opp', TANTEI), 'opp 事件 B05120 → opp の探偵は許可').toBe(true);
    expect(canHandUseCard(s, 'opp', NONTANTEI), 'opp 事件 B05120 → opp の非探偵は不許可').toBe(false);
  });

  it('source pin (BUG-174): restrict は B05120 由来 — plain case では非探偵キャラも許可', () => {
    const s = withCase('self', 'PLAINCASE', '事件編');
    s.players.self.hand = [NONTANTEI];
    s.players.self.file = [FB, FB, FB];
    expect(canHandUseCard(s, 'self', NONTANTEI), 'restrict 不在 case → 非探偵も許可').toBe(true);
  });
});
