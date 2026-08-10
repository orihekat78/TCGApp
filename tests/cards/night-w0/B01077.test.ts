// tests/cards/night-w0/B01077 「赤井…秀一!?」 (event) probe — DEFER解禁 (atomDiscardRandom, 2026-07-11)
//   a1 (event-use 本体): 【パートナー赤】相手は手札1枚ランダムリムーブ → キャラ1枚まで選び ターン終了まで〚ブレット〛付与。
//     production 経路 = effect:declared {kind:'event-use'} emit (handUseCard と同 payload) + runAllUntilEmpty。
//   a2 (【ヒラメキ】): 相手は手札1枚リムーブ (相手選択)。UI hiramekiResolve 相当 (resolveEffectPicks→queue→runAll)。
//   BUG-174: owner='opp' 逆側 pin (event を相手が使用 → discardRandom は真の相手 = 'self' 手札に当たる)。
// rules: 10 (hirameki) / 13 (ブレット=ガード不可) / 15 (「1枚まで」=0可) / 17 (【パートナー赤】未成立=効果なしイベント)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def as readDef } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as charRead } from '@/engine/read/char';
import { B01077 } from '@/cards/ct-p01/B01077';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

// ---- fixtures ----
function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const PRED: CardDef = { id: 'PRED', no: 'PRED', kind: 'partner', names: ['P赤'], colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PBLUE: CardDef = { id: 'PBLUE', no: 'PBLUE', kind: 'partner', names: ['P青'], colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FIXTURES: CardDef[] = [
  B01077, PRED, PBLUE,
  mkChar('TGT', { names: ['ターゲット'] }), mkChar('SELF1', { names: ['自陣'] }),
  mkChar('H1'), mkChar('H2'), mkChar('H3'),
];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _resetPendingHirameki();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

/** owner が事件編ターン中に partner=partnerId を持つ盤面 */
function base(owner: 'self' | 'opp', partnerId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players[owner].partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  return s;
}

/** a1 = イベント使用の実 production emit (handUseCard 内部と同 payload)。 */
function useEvent(s: GameState, owner: 'self' | 'opp'): void {
  event.emit(
    s, 'effect:declared',
    { kind: 'event-use', cardId: 'B01077', player: owner },
    { player: owner, cardId: 'B01077' },
  );
  runAllUntilEmpty(s);
}

/** a2 = UI hiramekiResolve の engine 経路を複製 (B06028 test と同型): pending の effect を AI 解決 → queue → runAll。 */
function fireHirameki(s0: GameState, owner: 'self' | 'opp'): GameState {
  return produce(s0, (draft) => {
    const def = readDef.card('B01077')!;
    const ability = def.abilities.find((a) => a.id === 'a2')!;
    const ctx: EffectCtx = {
      source: { player: owner, cardId: 'B01077', area: 'evidence' },
      bindings: {},
      triggerPayload: { player: owner, ev: { cardId: 'B01077' } },
    } as EffectCtx;
    const ai = new HeuristicPolicy();
    const resolved = resolveEffectPicks(draft, ability.effect as never, ctx, {
      chooseAtomTarget: ai.chooseAtomTarget?.bind(ai),
      byPlayer: owner,
    });
    event.queue(
      draft, resolved as never,
      { player: owner, cardId: 'B01077', area: 'evidence' },
      'evidence:remove-by-action',
      { player: owner, ev: { cardId: 'B01077' } },
    );
    runAllUntilEmpty(draft);
  });
}

// ============================================================
// A. descriptor — DSL が印字と 1対1
// ============================================================
describe('B01077 descriptor (印字 ⇔ DSL 1対1)', () => {
  it('メタ: event / 赤 / Lv4 / names 単一 (分割なし)', () => {
    expect(B01077.kind).toBe('event');
    expect(B01077.colors).toEqual(['赤']);
    expect(B01077.level).toBe(4);
    expect(B01077.names).toEqual(['「赤井…秀一!?」']);
  });
  it('a1 = on-hand event-use, condition partnerColor 赤, sequence[discardRandom opp, choice{charGrantKeyword ブレット/turn}]', () => {
    const a1 = B01077.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-hand');
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '赤' });
    const seq = a1.effect as { kind: string; steps: unknown[] };
    expect(seq.kind).toBe('sequence');
    const s0 = seq.steps[0] as { verb: string; args: Record<string, unknown> };
    expect(s0.verb).toBe('discardRandom');
    expect(s0.args).toMatchObject({ player: 'opp', n: 1 });
    const choice = seq.steps[1] as { kind: string; options: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(choice.kind).toBe('choice');
    const grant = choice.options[0]!;
    expect(grant.verb).toBe('charGrantKeyword');
    expect(grant.args).toMatchObject({ uid: '$pick', kw: 'ブレット', scope: 'turn' });
    expect((grant.args.target as { n: { min: number; max: number } }).n).toEqual({ min: 0, max: 1 }); // 「1枚まで」= 0可
    expect((grant.args.target as { query: { side: string } }).query.side).toBe('either'); // 「キャラ」= 両現場
  });
  it('a2 = 【ヒラメキ】on-evidence evidence:remove-by-action optional, discard opp n:1', () => {
    const a2 = B01077.abilities.find((a) => a.id === 'a2')!;
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } });
  });
});

// ============================================================
// B. a1 本体 (owner='self') — production event-use emit
// ============================================================
describe('B01077 a1 — 相手手札ランダムリムーブ + ブレット付与 (owner=self)', () => {
  it('正例: 相手手札1枚リムーブ → 相手キャラ TGT に〚ブレット〛(ターン終了まで)', () => {
    const s = base('self', 'PRED');
    s.players.self.hand = ['B01077'];
    s.players.opp.hand = ['H1', 'H2'];
    const tgt = mutate.scene.enter(s, 'opp', 'TGT', {});
    const mine = mutate.scene.enter(s, 'self', 'SELF1', {});
    useEvent(s, 'self');
    // discardRandom: 相手手札 2→1 (どのカードかは無作為 = 枚数のみ)
    expect(s.players.opp.hand.length, '相手手札 1枚リムーブ').toBe(1);
    expect(s.players.opp.remove.length, 'リムーブへ 1枚').toBe(1);
    // grant pick surface → TGT を選ぶ
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'ブレット付与 pick が surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」= 0可').toBe(0);
    expect(pick!.nMax).toBe(1);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map((c) => c.cardId).sort(), 'side either = 自陣も相手も候補').toEqual(['SELF1', 'TGT']);
    applyPickAndContinuation(s, pick!, tgt.uid, [tgt.uid]);
    runAllUntilEmpty(s);
    expect(charRead.hasKeyword(s, tgt.uid, 'ブレット'), '選択 TGT は〚ブレット〛保持').toBe(true);
    expect(charRead.hasKeyword(s, mine.uid, 'ブレット'), '非選択 自陣は付与されない').toBe(false);
  });

  it('QA: 相手手札0枚でも キャラを選んでブレット付与できる (実行できる効果を解決)', () => {
    const s = base('self', 'PRED');
    s.players.self.hand = ['B01077'];
    s.players.opp.hand = []; // 手札0
    const tgt = mutate.scene.enter(s, 'opp', 'TGT', {});
    useEvent(s, 'self');
    expect(s.players.opp.hand.length, '相手手札0 → discardRandom は no-op').toBe(0);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'discardRandom 空振りでも grant pick は surface (sequence ungated)').toBeTruthy();
    applyPickAndContinuation(s, pick!, tgt.uid, [tgt.uid]);
    runAllUntilEmpty(s);
    expect(charRead.hasKeyword(s, tgt.uid, 'ブレット')).toBe(true);
  });

  it('「1枚まで」= 0枚選択も可 (skip) → 誰にも付与されない', () => {
    const s = base('self', 'PRED');
    s.players.self.hand = ['B01077'];
    s.players.opp.hand = ['H1'];
    const tgt = mutate.scene.enter(s, 'opp', 'TGT', {});
    useEvent(s, 'self');
    const pick = _drainPendingEffectPickSide();
    expect(pick).toBeTruthy();
    applyPickSkipAndContinuation(s, pick!, false); // 0枚選択
    runAllUntilEmpty(s);
    expect(charRead.hasKeyword(s, tgt.uid, 'ブレット'), '0枚 → 付与なし').toBe(false);
  });

  it('条件外 decoy: 【パートナー赤】不成立 (青パートナー) → 効果なし (rules/17)', () => {
    const s = base('self', 'PBLUE');
    s.players.self.hand = ['B01077'];
    s.players.opp.hand = ['H1', 'H2'];
    mutate.scene.enter(s, 'opp', 'TGT', {});
    useEvent(s, 'self');
    expect(_drainPendingEffectPickSide(), 'grant pick は出ない').toBeNull();
    expect(s.players.opp.hand.length, '相手手札も不変 (discardRandom 不発)').toBe(2);
  });
});

// ============================================================
// C. a1 owner='opp' 逆側 pin (BUG-174)
// ============================================================
describe('B01077 a1 — owner=opp 逆側 pin (BUG-174)', () => {
  it('相手 (opp) がイベント使用 → discardRandom は真の相手 = self 手札に当たる (逆側反転しない)', () => {
    setHuman('opp'); // 使用者 opp を human 扱い → その grant pick が pending に surface
    const s = base('opp', 'PRED'); // opp のターン & opp partner=赤
    s.players.opp.hand = ['B01077', 'H1']; // 使用者 opp の手札 (event + decoy H1)
    s.players.self.hand = ['H2', 'H3', 'H1']; // 真の相手 = self
    const myTgt = mutate.scene.enter(s, 'self', 'TGT', {});
    useEvent(s, 'opp');
    // discardRandom {player:'opp'} は source=opp 相対 → 真の相手 self の手札を1枚 (逆側反転しない)
    expect(s.players.self.hand.length, 'self (真の相手) 手札 3→2').toBe(2);
    expect(s.players.opp.hand, 'opp (使用者) 手札は不変 = 反転して自分の手札を捨てていない').toContain('H1');
    expect(s.players.opp.hand.length, 'opp 手札 2枚のまま').toBe(2);
    expect(s.players.self.remove.length, 'self のリムーブへ 1枚').toBe(1);
    // grant pick (either) を適用: self 現場の TGT に付与
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'grant pick surface').toBeTruthy();
    applyPickAndContinuation(s, pick!, myTgt.uid, [myTgt.uid]);
    runAllUntilEmpty(s);
    expect(charRead.hasKeyword(s, myTgt.uid, 'ブレット')).toBe(true);
  });
});

// ============================================================
// D. a2 【ヒラメキ】相手は手札を1枚リムーブする
// ============================================================
describe('B01077 a2 — ヒラメキ: 相手手札1枚リムーブ', () => {
  it('正例 (owner=self): 相手 (opp) が手札を1枚リムーブ', () => {
    setHuman(null);
    const s0 = base('self', 'PRED');
    s0.players.opp.hand = ['H1', 'H2'];
    const s = fireHirameki(s0, 'self');
    expect(s.players.opp.hand.length, '相手手札 2→1').toBe(1);
    expect(s.players.opp.remove.length, 'リムーブへ 1枚').toBe(1);
  });

  it('owner=opp 逆側: 真の相手 = self が手札を1枚リムーブ', () => {
    setHuman(null);
    const s0 = base('opp', 'PRED');
    s0.players.self.hand = ['H1', 'H2', 'H3'];
    const s = fireHirameki(s0, 'opp');
    expect(s.players.self.hand.length, 'self (真の相手) 手札 3→2').toBe(2);
    expect(s.players.opp.hand.length, 'opp (所有者) 手札は不変').toBe(0);
  });

  it('相手手札0枚 → no-op (可能な限り, rules/15)', () => {
    setHuman(null);
    const s0 = base('self', 'PRED');
    s0.players.opp.hand = [];
    const s = fireHirameki(s0, 'self');
    expect(s.players.opp.hand.length).toBe(0);
    expect(s.players.opp.remove.length).toBe(0);
  });
});
