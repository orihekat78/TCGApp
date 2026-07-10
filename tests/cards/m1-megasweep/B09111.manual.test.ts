// tests/cards/m1-megasweep/B09111.manual — 外交官殺人事件 (case) 手書き probe (engine 実評価)
//
// 印字 (ground truth, .tmp/_hybrid_run/payloads/B09111.json fullTexts.effect):
//   a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：
//       カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、
//       相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。
//       この効果によって指定したカード名のカードがリムーブされた場合、
//       レベル6のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
//
// novel句 (全て production dispatch 経路で engine 実評価):
//   a1 triggered: hook 'case:to-resolved' selfOnly → discard{n:1,player:self}。
//      → partnerAssist で FILE7 到達 → 解決編移行で a1 が pendingEffects に queue、実 discard まで解決。
//      → opp の無関係な解決編では self の a1 は発火しない (selfOnly matcher)。
//   a2 declared (case:self, cost flipFaceUpEvidence min2/max2, limit turn1, condition caseStatus 解決編):
//      chain = declareName{named} → fileRemoveTop{opp,bind:removed} → fileAdd{opp}
//              → conditional if boundNameMatchesDeclared{removed⇔named} then
//                 charGrantKeyword{player:self, side:either, max:1, filter:{lv6,character}, 突撃[キャラ], scope:turn}
//      → 指定名がリムーブされた FILE カードの名前と一致した場合のみ then 枝 (grant pick) が surface。
//      → 「1枚まで」= 0 選択許容 (skip)。decoy = 非 lv6 キャラは grant 候補から除外。
//      → FILE リムーブ自体は一致/不一致に依らず実行 (removal unconditional)。
//
// production dispatch:
//   - a1: runAtom('partnerAssist') → runAllUntilEmpty → _drainAllEffectPicksForTest (実 emit 経路)
//   - a2 gate: canDeclaredAbility (condition caseStatus + limit + canPay)
//   - a2 発火: activateDeclaredAbility('case:self','a2',{flipFaceUpEvidence,declaredName}) + runAllUntilEmpty
//        (BUG-171。cost/declareName は costParams 経由 = UI/AI と同一 dyn channel)
//        immer draft 必須 (fileRemoveTop popTop が current() を呼ぶ) → produce でラップ
//   - grant pick: __humanPlayerSide=owner で human queue に surface → _drainPendingEffectPickSide で
//        候補検査 (decoy 除外) + applyPickAndContinuation/Skip で確定
//   - owner='opp' 反転 pin (BUG-174): a2 を case:opp 所有で 1 scenario (自分=opp 追従を確認)
//   - beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)
//
// rules: 01-victory-conditions.md (解決編), 12-next-hint.md (FILE), 13-keywords.md (突撃),
//        15-abilities-effects.md, 17-icons.md, 19-special-rules.md (分割名), 21-declared-ability-cost.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { makeChar } from '../../helpers/fixtures';
import { B09111 } from '@/cards/ct-p09/B09111';
import type { CardDef, GameState, Player, AbilityDef, EffectCtx } from '@/engine/types';

type Side = Player;

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as CardDef;
}

// FILE 上に置く / boundNameMatchesDeclared が lookupCardDef で名前照合するカード
const KUDO = cdef('KUDO', { names: ['工藤新一'] }); // 一致 scenario の FILE top
const RAN = cdef('RAN', { names: ['毛利蘭'] });      // 別名 (不一致確認用)
// grant 対象: レベル6キャラ (filter levelMin/Max 6, kind character)
const L6A = cdef('L6A', { level: 6, names: ['六番探偵'] });
const L6B = cdef('L6B', { level: 6, names: ['六番刑事'] });
// decoy: レベル4キャラ (filter lv6 外 → grant 候補に出ない)
const L4D = cdef('L4D', { level: 4, names: ['四番少年'] });
// a1 assist 用パートナー / FILE / deck filler
const PART = cdef('PART', { kind: 'partner', colors: ['青'], lp: 3 });
const FILLER = cdef('FILLER', {});
const FIXTURES = [KUDO, RAN, L6A, L6B, L4D, PART, FILLER];

function setHuman(s: Side | null): void {
  (globalThis as { __humanPlayerSide?: Side | null }).__humanPlayerSide = s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerCardDef(B09111);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman(null);
});

const other = (p: Side): Side => (p === 'self' ? 'opp' : 'self');

// ============================================================
// a2 board builder
//   owner が case を持つ。fileRemoveTop/fileAdd の player:'opp' は owner 相対 → other(owner)。
//   grant player:'self' は owner 相対 → owner の現場。cost source = owner。
// ============================================================
interface A2Opts {
  status?: '事件編' | '解決編';   // 既定 解決編
  fileTopCardId?: string;         // other(owner) FILE 最上部 (removal 対象)。既定 'KUDO'
  evidenceFaceDown?: number;      // owner の裏向き証拠数。既定 2
  ownerScene?: { cardId: string; uid: string }[]; // grant 候補 (owner 現場)
}
function boardA2(owner: Side, opts: A2Opts = {}): GameState {
  const { status = '解決編', fileTopCardId = 'KUDO', evidenceFaceDown = 2,
    ownerScene = [{ cardId: 'L6A', uid: 'u-l6a' }, { cardId: 'L4D', uid: 'u-l4d' }] } = opts;
  const s = createEmptyGameState();
  s.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const p = s.players[owner];
  const q = s.players[other(owner)];
  p.case = { cardId: 'B09111', status, requiredEvidence: owner === 'self' ? 7 : 6, colors: ['青', '緑'], declaredUseCount: {} } as GameState['players']['self']['case'];
  // cost: owner の裏向き証拠
  p.evidence = Array.from({ length: evidenceFaceDown }, (_v, i) => ({ cardId: `EV${i}`, faceUp: false, origin: { turn: 1, via: 'effect' as const } }));
  // removal 対象: other(owner) の FILE 最上部 (= 配列末尾)
  q.file = [{ type: 'card-back' as const, cardId: 'FILLER' }, { type: 'card-back' as const, cardId: fileTopCardId }];
  // fileAdd (other(owner) デッキ → FILE) の補給
  q.deck = ['FILLER', 'FILLER', 'FILLER'];
  // grant 候補 (owner 現場)
  p.scene = ownerScene.map((c) => makeChar({ uid: c.uid, cardId: c.cardId, state: 'active' }));
  return s;
}

// a2 production dispatch: activate (cost/declareName params) + effect 解決。
//   grant pick は human queue へ surface → 手動 drain (候補記録 + pick/skip)。
interface A2Run {
  state: GameState;
  picks: { verb: string; candidates: { uid: string; cardId: string }[] }[];
}
function runA2(s0: GameState, owner: Side, declaredName: string, pickAction: string | 'skip' | 'none'): A2Run {
  setHuman(owner); // grant pick (player owner) を human queue に surface
  const uid = owner === 'self' ? 'case:self' : 'case:opp';
  let st = produce(s0, (d) => {
    activateDeclaredAbility(d, uid, 'a2', { flipFaceUpEvidence: { indices: [0, 1] }, declaredName });
    runAllUntilEmpty(d);
  });
  const picks: A2Run['picks'] = [];
  for (let guard = 0; guard < 20; guard++) {
    const pick = _drainPendingEffectPickSide();
    if (!pick) break;
    picks.push({ verb: pick.atomVerb, candidates: pick.candidates.map((c) => ({ uid: c.uid, cardId: c.cardId })) });
    st = produce(st, (d) => {
      if (pickAction === 'skip' || pickAction === 'none') {
        applyPickSkipAndContinuation(d, pick, false);
      } else {
        applyPickAndContinuation(d, pick, pickAction);
      }
      runAllUntilEmpty(d);
    });
  }
  setHuman(null);
  return { state: st, picks };
}

// ============================================================
// shape (descriptor 骨格)
// ============================================================
describe('B09111 外交官殺人事件 — shape', () => {
  it('case / colors / a1 triggered discard / a2 declared chain+flip cost', () => {
    expect(B09111.id).toBe('B09111');
    expect(B09111.kind).toBe('case');
    expect(B09111.colors).toEqual(['青', '緑']);

    const a1 = B09111.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'case:to-resolved', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'discard', args: { n: 1, player: 'self' } });

    const a2 = B09111.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({ kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } });
    expect(a2.effect?.kind).toBe('chain');
  });
});

// ============================================================
// a1 — case:to-resolved → 自分手札 1 リムーブ (production trigger 経路)
// ============================================================
describe('B09111 a1 — 解決編移行で手札1リムーブ', () => {
  it('S1 partnerAssist で FILE7 → 解決編 → a1 discard が実際に手札を1枚リムーブ', () => {
    const base = createEmptyGameState();
    base.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    base.players.self.case = { cardId: 'B09111', status: '事件編', requiredEvidence: 7, colors: ['青', '緑'], declaredUseCount: {} } as GameState['players']['self']['case'];
    base.players.self.partner = { cardId: 'PART', state: 'active', location: 'partner-area' } as GameState['players']['self']['partner'];
    base.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'FILLER' })); // 6 + partner assist = 7
    base.players.self.hand = ['KUDO', 'RAN'];

    let st = produce(base, (d) => {
      runAtom(d, 'partnerAssist', { player: 'self' }, { source: { player: 'self', area: 'case' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
    });
    expect(st.players.self.case.status, 'FILE7 で解決編へ移行').toBe('解決編');
    // a1 の discard を実解決 (AI drain)
    st = produce(st, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    st = produce(st, (d) => runAllUntilEmpty(d));

    expect(st.players.self.hand.length, '手札 2→1 (a1 discard 1枚)').toBe(1);
    expect(st.players.self.remove.length, 'リムーブ先へ 1枚').toBe(1);
  });

  it('S2 selfOnly: opp の無関係な事件が解決編でも self の a1 は発火しない', () => {
    const base = createEmptyGameState();
    base.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    // opp は別の事件 (a1 を持たない) / self が B09111 を持つが self は解決編にしない
    base.players.self.case = { cardId: 'B09111', status: '事件編', requiredEvidence: 7, colors: ['青', '緑'], declaredUseCount: {} } as GameState['players']['self']['case'];
    base.players.opp.case = { cardId: 'RAN', status: '事件編', requiredEvidence: 6, colors: ['黄'], declaredUseCount: {} } as GameState['players']['opp']['case'];
    base.players.opp.partner = { cardId: 'PART', state: 'active', location: 'partner-area' } as GameState['players']['opp']['partner'];
    base.players.opp.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'FILLER' }));
    base.players.self.hand = ['KUDO', 'RAN'];

    const st = produce(base, (d) => {
      runAtom(d, 'partnerAssist', { player: 'self' }, { source: { player: 'opp', area: 'case' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
    });
    expect(st.players.opp.case.status, 'opp が解決編へ').toBe('解決編');
    const selfDiscards = st.pendingEffects.filter((e) => JSON.stringify(e.effect).includes('"discard"') && e.source.player === 'self');
    expect(selfDiscards.length, 'self の a1 は発火しない (selfOnly)').toBe(0);
    expect(st.players.self.hand.length, 'self 手札不変').toBe(2);
  });
});

// ============================================================
// a2 gate — condition caseStatus 解決編 / cost canPay
// ============================================================
describe('B09111 a2 gate — 【解決編】+ 裏向き証拠2つ', () => {
  it('S3 happy: 解決編 + 裏向き証拠2 → 宣言可', () => {
    const s = boardA2('self');
    expect(canDeclaredAbility(s, 'case:self', 'a2')).toBe(true);
  });

  it('S4 off-variant condition: 事件編 → caseStatus 不成立で宣言不可', () => {
    const s = boardA2('self', { status: '事件編' });
    expect(canDeclaredAbility(s, 'case:self', 'a2')).toBe(false);
  });

  it('S5 off-variant cost (canPay gate): 裏向き証拠2つで支払可 / 1つでは不可 (「2つ表向きにできない場合は使用不可」)', () => {
    const cost = (B09111.abilities[1] as AbilityDef).cost!;
    const ctx = { source: { player: 'self', uid: 'case:self', cardId: 'B09111', abilityId: 'a2', area: 'case' }, bindings: {} } as unknown as EffectCtx;
    // canDeclaredAbility は cost を判定しない (limit/condition/area のみ) — cost の床は canPay
    expect(canDeclaredAbility(boardA2('self'), 'case:self', 'a2'), '解決編+limit未消費 → gate 通過').toBe(true);
    expect(canPay(boardA2('self', { evidenceFaceDown: 2 }), cost, ctx), '裏向き証拠2 → 支払可').toBe(true);
    expect(canPay(boardA2('self', { evidenceFaceDown: 1 }), cost, ctx), '裏向き証拠1 → 支払不可').toBe(false);
  });
});

// ============================================================
// a2 発火 — declareName ⇔ removed FILE 名 一致で 突撃[キャラ] 付与
// ============================================================
describe('B09111 a2 発火 — 指定名一致で lv6 に 突撃[キャラ]', () => {
  it('S6 happy 一致: FILE top=工藤新一 & 指定=工藤新一 → 除去 + fileAdd + lv6 に付与 / decoy(lv4) 除外 / cost で証拠2表向き', () => {
    const s0 = boardA2('self');
    const { state, picks } = runA2(s0, 'self', '工藤新一', 'u-l6a');

    // FILE 除去 (opp の最上部 KUDO が消える → FILLER のみ残 + fileAdd で補給)
    expect(state.players.opp.file.some((f) => f.cardId === 'KUDO'), 'opp FILE top(工藤新一) がリムーブ').toBe(false);
    expect(state.players.opp.remove.includes('KUDO'), 'KUDO は opp リムーブへ').toBe(true);
    // grant pick が surface
    expect(picks.length, 'grant pick が 1 回 surface').toBe(1);
    expect(picks[0]!.verb, 'charGrantKeyword pick').toBe('charGrantKeyword');
    // decoy: lv4 は候補から除外 / lv6 のみ候補
    const candIds = picks[0]!.candidates.map((c) => c.cardId);
    expect(candIds, 'decoy lv4(L4D) は候補外').not.toContain('L4D');
    expect(candIds, 'lv6(L6A) は候補').toContain('L6A');
    // 付与: 選んだ lv6 に 突撃[キャラ]
    expect(read.char.keywords(state, 'u-l6a'), '選択 lv6 に 突撃[キャラ] 付与').toContain('突撃[キャラ]');
    expect(read.char.keywords(state, 'u-l4d'), 'decoy lv4 は未付与').not.toContain('突撃[キャラ]');
    // cost: 証拠2つが表向き
    expect(state.players.self.evidence.filter((e) => e.faceUp).length, 'cost で裏向き証拠2つが表向き').toBe(2);
  });

  it('S7 不一致: FILE top=工藤新一 & 指定=毛利蘭 → 除去は起きるが grant pick は surface しない (突撃付与なし)', () => {
    const s0 = boardA2('self');
    const { state, picks } = runA2(s0, 'self', '毛利蘭', 'none');

    expect(state.players.opp.file.some((f) => f.cardId === 'KUDO'), '不一致でも FILE 除去は実行').toBe(false);
    expect(picks.length, '一致しないので grant pick は surface しない').toBe(0);
    expect(read.char.keywords(state, 'u-l6a'), '突撃[キャラ] 付与なし').not.toContain('突撃[キャラ]');
  });

  it('S8 「1枚まで」= 0選択許容: 一致でも grant を skip → 付与なし・throw なし', () => {
    const s0 = boardA2('self');
    const { state, picks } = runA2(s0, 'self', '工藤新一', 'skip');

    expect(picks.length, '一致で grant pick は surface する').toBe(1);
    expect(read.char.keywords(state, 'u-l6a'), '0選択(skip) → 未付与').not.toContain('突撃[キャラ]');
    expect(state.players.opp.file.some((f) => f.cardId === 'KUDO'), 'FILE 除去は実行済み').toBe(false);
  });

  it('S9 limit turn1: 1回宣言後は再宣言不可', () => {
    const s0 = boardA2('self');
    const { state } = runA2(s0, 'self', '工藤新一', 'u-l6a');
    expect(canDeclaredAbility(state, 'case:self', 'a2'), 'limit turn1 消費済み → 再宣言不可').toBe(false);
  });

  it('S10 owner=opp pin (BUG-174): 自分=owner 追従 — opp の lv6 に付与 / other(opp)=self の FILE が除去', () => {
    const s0 = boardA2('opp');
    const { state, picks } = runA2(s0, 'opp', '工藤新一', 'u-l6a');

    expect(picks.length, 'owner=opp でも grant pick が surface').toBe(1);
    expect(read.char.keywords(state, 'u-l6a'), 'owner=opp: 自分(=opp)現場の lv6 に付与 (反転せず)').toContain('突撃[キャラ]');
    expect(state.players.self.file.some((f) => f.cardId === 'KUDO'), 'owner=opp: 相手(=self) FILE top が除去').toBe(false);
    expect(state.players.self.remove.includes('KUDO'), 'KUDO は self リムーブへ').toBe(true);
  });
});
