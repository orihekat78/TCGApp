// evidence-top-to-hand — evidenceToHand の新 fromTop フラグ (「証拠を上から1つ」= deterministic 最上) と
//   B03077 a1 optional{chain[evidenceToHand{fromTop}, handToEvidence]} の挙動テスト。
// engine変更: atom-handlers.ts evidenceToHand に fromTop 分岐 1 つ追加 (純 additive、新 verb なし)。
//   fromTop=true で pick path をスキップし証拠スタック最上 (末尾=1番上、removeTop と整合) を手札へ。
//   証拠0 なら no-op + __chainStepNoApply で chain break (filePopToHand と同型)。
//
// 検証 (非MVP = smoke では踏めない → 実 engine 駆動の専用テスト):
//   §1 ★fromTop=top★ 証拠 [E_BOTTOM, E_TOP] で fromTop → 末尾 E_TOP のみ手札へ (上から=最上、下からではない)。
//   §2 ★境界:0枚★ 証拠0 で fromTop → no-op + __chainStepNoApply=true (chain break シグナル)。
//   §3 fromTop は残り証拠の順序を保つ (top 1 枚のみ除去)。
//   §4 ★swap opt-in★ B03077 a1 を optionalRun:true で実 engine 駆動 → step1 fromTop(top を手札) →
//      step2 handToEvidence(手札 pick を裏向き証拠 top)。net 証拠数不変、入替が証拠 top 裏向き。
//   §5 ★chain break opt-in/0証拠★ a1 optionalRun:true + 証拠0 → step1 no-op → step2 skip (手札/証拠 unchanged)。
//   §6 ★opt-out★ a1 optionalRun:false → 何も起きない (してもよい decline)。
//   §7 出荷カード構造 — B03077 登録 + a1 optional{chain[evidenceToHand{fromTop:true}, handToEvidence]} / a2 ヒラメキ draw。
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§証拠化), 14-refresh.md (§draw),
//        15-abilities-effects.md (§してもよい/そうした場合), 17-icons.md (§登場時)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B03077 } from '@/cards/ct-p03/B03077';
import type { EffectCtx, EvidenceCard, GameState } from '@/engine/types';

const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });
// Phase 3c: chain break 信号は ctx.dyn 経由 (旧 globalThis __chainStepNoApply)。factory が dyn を pre-init し、
// chainFlag は捕捉済 ctx の dyn を読む (書込み無しケースで .toBe(false) を維持するため pre-init false)。
const ctx = (): EffectCtx => ({ source: { player: 'self', area: 'scene', cardId: 'B03077', abilityId: 'a1' }, bindings: {}, dyn: { chainStepNoApply: false } } as unknown as EffectCtx);
const chainFlag = (c: EffectCtx) => (c.dyn as { chainStepNoApply?: boolean } | undefined)?.chainStepNoApply;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
});

describe('evidenceToHand fromTop — runAtom 直接駆動 (§1-3)', () => {
  it('§1 上から1つ = 末尾(最上)のみ手札へ (下からではない)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = [];
      d.players.self.evidence = [ev('E_BOTTOM'), ev('E_TOP')]; // index0=下, 末尾=上
    });
    const c = ctx();
    const after = produce(s0, (d) => {
      runAtom(d, 'evidenceToHand', { player: 'self', fromTop: true }, c);
    });
    expect(after.players.self.hand).toEqual(['E_TOP']);            // 最上 E_TOP のみ
    expect(after.players.self.evidence.map((e) => e.cardId)).toEqual(['E_BOTTOM']); // 下は残る
    expect(chainFlag(c)).toBe(false);                            // 実効果あり → break しない (Phase 3c: ctx.dyn)
  });

  it('§2 境界: 証拠0枚 → no-op + chainStepNoApply=true', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['HX'];
      d.players.self.evidence = [];
    });
    const c = ctx();
    const after = produce(s0, (d) => {
      runAtom(d, 'evidenceToHand', { player: 'self', fromTop: true }, c);
    });
    expect(after.players.self.hand).toEqual(['HX']);              // 手札 unchanged
    expect(after.players.self.evidence).toHaveLength(0);          // 証拠 unchanged
    expect(chainFlag(c)).toBe(true);                             // chain break シグナル (Phase 3c: ctx.dyn)
  });

  it('§3 残り証拠の順序を保つ (top1枚のみ除去)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = [];
      d.players.self.evidence = [ev('E1'), ev('E2'), ev('E3')]; // E3=top
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'evidenceToHand', { player: 'self', fromTop: true }, ctx());
    });
    expect(after.players.self.hand).toEqual(['E3']);
    expect(after.players.self.evidence.map((e) => e.cardId)).toEqual(['E1', 'E2']); // 順序保持
  });
});

/** B03077 a1 (optional{chain[...]}) を実 engine 経路で駆動。optionalRun を渡し、pick を AI 解決して drain。 */
function runA1(optionalRun: boolean, setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  setup(s);
  const ab = def.card('B03077')!.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const c = { source: { player: 'self', cardId: 'B03077', uid: 'src#1', abilityId: 'a1', area: 'scene' }, bindings: {}, dyn: { optionalRun } } as unknown as EffectCtx;
    runEffect(d, ab.effect as never, c);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

describe('B03077 a1 evidence-swap — optional{chain} 実 engine 駆動 (§4-6)', () => {
  it('§4 opt-in: top を手札へ → 手札1枚を裏向き証拠へ (net 証拠数不変、上から固定)', () => {
    // 証拠 [E_BOTTOM, E_TOP]、手札空。step1 fromTop → E_TOP のみ手札へ (E_BOTTOM 残)。
    // step2 handToEvidence は手札 [E_TOP] (唯一) を裏向き証拠 top へ戻す → 決定的。
    const after = runA1(true, (s) => {
      s.players.self.hand = [];
      s.players.self.evidence = [ev('E_BOTTOM', true), ev('E_TOP', true)];
    });
    expect(after.players.self.evidence).toHaveLength(2);          // net 不変 (2→1→2)
    expect(after.players.self.hand).toEqual([]);                  // 手札へ出て手札から戻る
    const top = after.players.self.evidence[after.players.self.evidence.length - 1]!;
    expect(top.cardId).toBe('E_TOP');                            // 入替が証拠 top
    expect(top.faceUp).toBe(false);                             // 裏向きで得る (公式: 1番上に裏向き)
    expect(after.players.self.evidence[0]!.cardId).toBe('E_BOTTOM'); // 下は触らない
    expect(after.players.self.evidence[0]!.faceUp).toBe(true);  // E_BOTTOM は表向きのまま
  });

  it('§5 opt-in + 証拠0 → step1 no-op で chain break → step2 skip (手札/証拠 unchanged)', () => {
    const after = runA1(true, (s) => {
      s.players.self.hand = ['HX', 'HY'];
      s.players.self.evidence = [];
    });
    expect([...after.players.self.hand].sort()).toEqual(['HX', 'HY']); // step2 走らず
    expect(after.players.self.evidence).toHaveLength(0);
  });

  it('§6 opt-out (optionalRun:false): してもよい decline → 何も起きない', () => {
    const after = runA1(false, (s) => {
      s.players.self.hand = ['HX'];
      s.players.self.evidence = [ev('E_OLD', true)];
    });
    expect(after.players.self.hand).toEqual(['HX']);
    expect(after.players.self.evidence.map((e) => e.cardId)).toEqual(['E_OLD']);
  });
});

describe('出荷カード構造 (§7)', () => {
  it('§7 B03077 水無怜奈: shape + a1 optional{chain[evidenceToHand{fromTop}, handToEvidence]} + a2 ヒラメキ draw', () => {
    expect(B03077.id).toBe('B03077');
    expect(B03077.no).toBe('0331/B03077');
    expect(B03077.kind).toBe('character');
    expect(B03077.names).toEqual(['水無怜奈']);
    expect(B03077.colors).toEqual(['赤']);
    expect(B03077.traits).toEqual(['アナウンサー']);
    expect(B03077.level).toBe(4);
    expect(B03077.ap).toBe(4000);
    expect(B03077.lp).toBe(1);
    expect(B03077.rarity).toBe('C');
    expect(B03077.imageUrl).toBe('1729133424878967.jpg');
    const a1 = B03077.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toEqual({
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
          { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', fromTop: true } },
          { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
        ],
      },
    });
    const a2 = B03077.abilities[1];
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });

  it('§7b def registry に登録済み (registerAll 経由)', () => {
    expect(def.card('B03077')?.id).toBe('B03077');
  });
});
