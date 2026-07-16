// BUG-111 family (continuation-nest): pick が `sequence[chain[pausing-pick, step2], step3]` のように
// 2 重 (chain の内側 + sequence の外側) に囲まれて pause すると、chain が pick.continuation に
// [step2] を同梱した直後、親 sequence が同じ pick の continuation を [step3] で **上書き** して
// しまい、chain remainder (step2) が脱落する (resolver.ts L48 が L75 を上書き)。
//
// 不変条件: 中断 pick の解決後、内側 (chain) の残り step → 外側 (sequence) の残り step の順に
// すべて実行されること。さらに内側 remainder 自身が再 pause したら、外側 remainder は新 pick へ
// 引き継がれること (nest の再帰)。
//
// 解禁対象カード: B06033 / B06033P 「わが味方となるべし!!」
//   a1 = sequence[ chain[evidenceToHand max:1, handToEvidence n:1], sceneEnter{lv6 緑 YAIBA} ]
//
// rules: 15-abilities-effects.md (未解決効果の解決順 / sequence 各 step 独立) / 25-qa-effects-resolution.md
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'a1' }, bindings: {} };
}

function clearSideChannels(): void {
  _clearPendingEffectPickQueue();
  delete (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide;
}

describe('BUG-111 continuation-nest — sequence[chain[pausing-pick, step2], step3] の継続上書き', () => {
  beforeAll(() => registerAll());
  beforeEach(() => clearSideChannels());

  it('Case 1 (nest 保持): chain 内 pick の解決後、chain remainder(step2) と sequence remainder(step3) を両方実行する', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'EV1', faceUp: false, origin: { turn: 0, via: 'init' } });
    s.players.self.deck.push('DRAW1', 'GAIN1'); // DRAW1=chain step2 draw / GAIN1=sequence step3 evidenceGain

    // sequence[ chain[ evidenceToHand{pick max:1}, draw{n:1} ], evidenceGain{n:1} ]
    const eff: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'chain',
          steps: [
            { kind: 'atom', verb: 'evidenceToHand' as never, args: { player: 'self', max: 1 } },
            { kind: 'atom', verb: 'draw' as never, args: { player: 'self', n: 1 } },
          ],
        },
        { kind: 'atom', verb: 'evidenceGain' as never, args: { player: 'self', n: 1 } },
      ],
    };

    runEffect(s, eff, ctxSelf());
    _drainAllEffectPicksForTest(s);

    // chain step1 evidenceToHand: EV1 を証拠→手札
    expect(s.players.self.hand, 'evidenceToHand: EV1 が手札へ').toContain('EV1');
    // chain step2 draw: DRAW1 を deck→hand (← RED ではここが脱落)
    expect(s.players.self.hand, 'chain remainder(draw) が実行され DRAW1 が手札へ').toContain('DRAW1');
    // sequence step3 evidenceGain: GAIN1 を deck→証拠
    expect(s.players.self.evidence.map(e => e.cardId), 'sequence remainder(evidenceGain) が GAIN1 を証拠化').toContain('GAIN1');
    // deck は両方消費されて空
    expect(s.players.self.deck, 'deck 2 枚とも消費').toEqual([]);
  });

  it('Case 2 (再 pause 引継ぎ): chain remainder 自身が pause したら、sequence remainder は新 pick に引き継がれる', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'EV1', faceUp: false, origin: { turn: 0, via: 'init' } });
    s.players.self.hand.push('H0');
    s.players.self.deck.push('DRAW1'); // sequence step3 draw

    // sequence[ chain[ evidenceToHand{pick max:1}, discard{pick n:1} ], draw{n:1} ]
    //   evidenceToHand → 手札 +EV1, discard(再 pause) → 手札 -1, draw → 手札 +DRAW1
    const eff: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'chain',
          steps: [
            { kind: 'atom', verb: 'evidenceToHand' as never, args: { player: 'self', max: 1 } },
            { kind: 'atom', verb: 'discard' as never, args: { player: 'self', n: 1 } },
          ],
        },
        { kind: 'atom', verb: 'draw' as never, args: { player: 'self', n: 1 } },
      ],
    };

    runEffect(s, eff, ctxSelf());
    _drainAllEffectPicksForTest(s);

    // GREEN: evidenceToHand(+EV1) → discard(-1, 再 pause) → draw(+DRAW1) で hand 長 = 2。
    // RED: chain remainder(discard) が脱落し continuation=[draw] のみ → discard 不実行 → hand 長 = 3。
    expect(s.players.self.hand, 'chain remainder(discard) が実行され手札が 1 枚減る (2-1+1=2)').toHaveLength(2);
    // sequence remainder(draw) が discard の再 pause を跨いで実行され DRAW1 が手札へ
    expect(s.players.self.hand, 'sequence remainder(draw) が再 pause を跨いで実行').toContain('DRAW1');
    // DRAW1 取得で deck が空になった直後、BUG-166/176 の公式refreshで
    // discard済みH0が新deckへ戻る。DRAW1が手札にあることが継続実行の証明。
    expect(s.players.self.deck, 'exact exhaustion後にremoveのH0をrefresh').toEqual(['H0']);
    expect(s.players.self.remove, 'refresh後のremoveは空').toEqual([]);
  });
});
