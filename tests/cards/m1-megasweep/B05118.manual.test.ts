// m1-megasweep probe — B05118 裏切りの制裁 (case, engine変更0)
//
// 印字 (ground truth, payloads/B05118.json fullTexts.effect):
//   a1: この事件が解決編になったとき、相手はカードを1枚引く。
//   a2: 自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。   ← novel refusedLine
//       【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。 ← novel refusedLine
//
// qA (payload): 【黒】以外のパートナーと併用は可能だが、その場合は書き換えない (通常 solve のまま)。
//
// rules: 01 (勝敗・事件解決・一方通行), 13 (アシスト/事件解決), 15/25 (即時「相手はゲームに敗北する」),
//        17 (継続能力), 20 (色), 21 (cost「証拠を事件レベル数リムーブ」)。
//
// novel 経路 = production dispatch:
//   a1: mutate.case.toResolved(d, p) → case:to-resolved emit → triggered listener → draw player:'opp'
//       (resolvePlayer は ctx.source.player=case所有者 相対 → 自分の事件解決なら相手が引く)。
//   a2: read.game.partnerSolveOverride が case 継続能力 continuousModifier.partnerSolveOverride を
//       ability.condition (partnerColor 黒) honor で走査 → mutate.partner.solveCase が override 有効時
//       証拠を requiredEvidence(=事件レベル)数リムーブ + alt-lose 決着に差し替え (通常 evidence 勝利の代わり)。
//       B05118 本体を case として登録 (合成 caseDef ではなく実カードの a2 を評価)。
//
// BUG-174: owner='opp' で挙動が反転しないこと — a1 reversal / a2 opp 対称 で pin。
// off-variant: partner 非黒 → partnerColor gate 不成立 → override 不発火 (通常 evidence 勝利)。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。
//
// 注: a1 draw / a2 override はいずれも filter-based の対象選択を持たない (draw=無条件、override=boolean)
//     ため「filter 外 decoy が選ばれない」「〜まで=0選択」scenario は本カードでは意味を持たない。
//     条件分岐の否定は partner 非黒 off-variant で担保する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { game } from '@/engine/read/game';
import { partner as partnerMutate } from '@/engine/mutate/partner';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import type { GameState, CardDef, EvidenceCard } from '@/engine/types';
import { B05118 } from '@/cards/ct-p05/B05118';

type CaseStatus = GameState['players']['self']['case']['status'];
type Player = 'self' | 'opp';

function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors, traits: [], keywords: [],
    rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], lp: 5 } as unknown as CardDef;
}
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'effect' } });

const PA_BLACK = 'PA_BLACK'; // 黒 → 書き換え成立
const PA_RED = 'PA_RED';     // 非黒 → 書き換え不成立 (公式Q&A)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  registerCardDef(B05118);
  registerCardDef(partnerDef(PA_BLACK, ['黒']));
  registerCardDef(partnerDef(PA_RED, ['赤']));
  registerTriggeredListener();
});

// a1: 事件編 の state (case:to-resolved を production hook で踏む)
function withCase(p: Player, status: CaseStatus): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: p, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players[p].case = { cardId: 'B05118', status, requiredEvidence: 7, colors: ['赤', '黒'], declaredUseCount: {} } as GameState['players']['self']['case'];
  return s;
}

// a2: 解決編 + partner active + 証拠 で solveCase 可能な state
function winnable(p: Player, partnerId: string, evCount: number, required: number): GameState {
  return produce(createEmptyGameState(), (d) => {
    const pl = d.players[p];
    pl.case.cardId = 'B05118';
    pl.case.status = '解決編';
    pl.case.requiredEvidence = required;
    pl.evidence = Array.from({ length: evCount }, (_, i) => ev(`E${i}`));
    pl.partner.cardId = partnerId;
    pl.partner.state = 'active';
    pl.partner.location = 'partner-area';
    d.turnState[p].assistedThisTurn = false;
  });
}

function resolveDraw(s0: GameState, p: Player): GameState {
  return produce(s0, (d) => {
    mutate.case.toResolved(d, p);
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    runAllUntilEmpty(d);
  });
}

describe('B05118 a1 — case:to-resolved (production hook) → 相手が1ドロー', () => {
  it('自分の事件 事件編→解決編 → 相手(opp)が deck top を1枚引く / 自分は引かない', () => {
    const s = withCase('self', '事件編');
    s.players.opp.deck = ['OPPTOP', 'D1', 'D2'];
    s.players.self.deck = ['SELFTOP', 'D3'];
    const after = resolveDraw(s, 'self');
    expect(after.players.self.case.status, '解決編へ移行').toBe('解決編');
    expect(after.players.opp.hand, '相手が deck top を引く').toContain('OPPTOP');
    expect(after.players.opp.hand.length, '相手 +1 枚').toBe(1);
    expect(after.players.self.hand.length, '自分の手札は不変').toBe(0);
  });

  it('reversal pin (BUG-174): 相手(opp)の事件が解決編 → 引くのは自分(self)、相手は引かない', () => {
    const s = withCase('opp', '事件編');
    s.players.self.deck = ['SELFTOP', 'D1', 'D2'];
    s.players.opp.deck = ['OPPTOP', 'D3'];
    const after = resolveDraw(s, 'opp');
    expect(after.players.opp.case.status, 'opp 解決編へ移行').toBe('解決編');
    expect(after.players.self.hand, 'source=opp 相対の「相手」= self が引く').toContain('SELFTOP');
    expect(after.players.self.hand.length, 'self +1 枚').toBe(1);
    expect(after.players.opp.hand.length, '事件所有者(opp)は引かない').toBe(0);
  });
});

describe('B05118 a2 — partnerSolveOverride{partnerColor黒}: 【事件解決】を alt-lose 書き換え', () => {
  it('partner 黒 → override 有効 → solveCase で証拠 requiredEvidence 数リムーブ + alt-lose + partner sleep', () => {
    const s0 = winnable('self', PA_BLACK, 3, 2);
    expect(game.partnerSolveOverride(s0, 'self'), 'B05118 a2 + partner 黒 → true').toBe(true);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult, '相手はゲームに敗北 = winner self / alt-lose').toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(s1.players.self.evidence.length, '3 - 2 = 1 残る (事件レベル=required=2 だけリムーブ)').toBe(1);
    expect(s1.players.self.remove.length, '2 枚リムーブへ').toBe(2);
    expect(s1.players.self.partner.state, '【スリープ】cost → partner sleep').toBe('sleep');
  });

  it('off-variant (BUG-174 / 公式Q&A): partner 非黒 → override 不成立 → 通常 evidence 勝利 (証拠不変)', () => {
    const s0 = winnable('self', PA_RED, 2, 2);
    expect(game.partnerSolveOverride(s0, 'self'), 'partner 赤 → partnerColor gate 不成立 → false').toBe(false);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult, '書き換えなし → 通常勝利 evidence').toEqual({ winner: 'self', reason: 'evidence' });
    expect(s1.players.self.evidence.length, '証拠は不変 (リムーブされない)').toBe(2);
  });

  it('opp 対称 pin (BUG-174): opp の B05118 事件 + partner 黒 → opp 側で override 有効・自反転しない', () => {
    const s0 = winnable('opp', PA_BLACK, 2, 2);
    expect(game.partnerSolveOverride(s0, 'opp'), 'opp 側でも走査対称').toBe(true);
    // self 側は B05118 事件を持たない → override 不発火 (side pin)
    expect(game.partnerSolveOverride(s0, 'self'), 'self は B05118 事件なし → false').toBe(false);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'opp'));
    expect(s1.gameResult, 'winner = 効果所有者 opp / alt-lose').toEqual({ winner: 'opp', reason: 'alt-lose' });
    expect(s1.players.opp.evidence.length, 'opp 証拠 2 - 2 = 0').toBe(0);
  });
});
