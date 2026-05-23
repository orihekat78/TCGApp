// BUG-077: D08013 a1 step 2 evidenceToHand end-to-end simulation
//
// ユーザー実機検証で「ログには証拠 → 手札と出るが、evidence -1 / hand +1 されない」報告。
// unit test (atom-target-normalize.test.ts) では target を直接 array で渡して PASS。
// 本 test は effectPickResolve dispatch 経路をシミュレートして UI 経路の問題を切り分ける。

import { describe, it, expect, beforeEach } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EffectCtx } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene' }, bindings: {} };
}

describe('BUG-077: D08013 a1 step 2 evidenceToHand e2e flow', () => {
  beforeEach(() => {
    (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide = null;
  });

  it('Phase A: atom-handler の awaiting-pick → tryRePickFromAtom で side-channel set', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'effect' } });
    s.players.self.evidence.push({ cardId: 'Y', faceUp: false, origin: { turn: 0, via: 'effect' } });

    // pre-resolve atom (target=pick query)
    const atomArgs = {
      player: 'self',
      target: {
        kind: 'pick',
        query: { area: 'evidence', side: 'self' },
        n: { min: 1, max: 1 },
      },
    };
    runAtom(s, 'evidenceToHand', atomArgs, ctxSelf());

    const side = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; atomArgs: unknown; candidates: { uid: string; cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side).toBeTruthy();
    expect(side?.atomVerb).toBe('evidenceToHand');
    expect(side?.candidates.length).toBe(2);
    expect(side?.candidates.map(c => c.cardId).sort()).toEqual(['X', 'Y']);
    // evidence はまだ -1 されていない (awaiting-pick で skip)
    expect(s.players.self.evidence.length).toBe(2);
    expect(s.players.self.hand.length).toBe(0);
  });

  it('Phase B: effectPickResolve simulation → resolved atom 実行で evidence -1 / hand +1', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'effect' } });

    // Phase A: side-channel set
    const atomArgs = {
      player: 'self',
      target: {
        kind: 'pick',
        query: { area: 'evidence', side: 'self' },
        n: { min: 1, max: 1 },
      },
    };
    runAtom(s, 'evidenceToHand', atomArgs, ctxSelf());
    const side = (globalThis as { __pendingEffectPickSide?: { atomArgs: Record<string, unknown>; candidates: { uid: string; cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side).toBeTruthy();

    // Phase B: effectPickResolve simulation (useEngineDispatch.ts:effectPickResolve と同じロジック)
    const pickedUid = side!.candidates[0]!.uid;
    const cand = side!.candidates.find((c) => c.uid === pickedUid);
    expect(cand).toBeTruthy();
    const resolvedArgs = { ...side!.atomArgs, target: [cand!.cardId] };

    // resolved atom を runAtom で実行
    runAtom(s, 'evidenceToHand', resolvedArgs, ctxSelf());

    // 期待: evidence -1 / hand +1
    expect(s.players.self.evidence.length, '証拠 -1').toBe(0);
    expect(s.players.self.hand, '手札 +1').toEqual(['X']);
  });

  it('Phase C: cand.cardId が evidence の cardId と一致することを直接 verify', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'effect' } });

    const atomArgs = {
      player: 'self',
      target: { kind: 'pick', query: { area: 'evidence', side: 'self' }, n: { min: 1, max: 1 } },
    };
    runAtom(s, 'evidenceToHand', atomArgs, ctxSelf());
    const side = (globalThis as { __pendingEffectPickSide?: { candidates: { uid: string; cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side?.candidates[0]?.cardId).toBe('X');
    expect(side?.candidates[0]?.uid).toBe('evidence:self:0');
  });

  it('Phase D: useEngineDispatch effectPickResolve ロジック完全再現 (event.queue + runAllUntilEmpty)', async () => {
    const { event } = await import('@/engine/event/index');
    const { runAllUntilEmpty } = await import('@/engine/resolve/stack');

    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'effect' } });

    // Phase A: side-channel set
    runAtom(
      s,
      'evidenceToHand',
      {
        player: 'self',
        target: { kind: 'pick', query: { area: 'evidence', side: 'self' }, n: { min: 1, max: 1 } },
      },
      ctxSelf(),
    );
    const side = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; atomArgs: Record<string, unknown>; candidates: { uid: string; cardId: string }[]; source: { cardId: string; abilityId: string }; player: 'self' | 'opp' } | null }).__pendingEffectPickSide;
    expect(side).toBeTruthy();

    // Phase D: useEngineDispatch.ts:effectPickResolve のロジック完全再現
    const pickedUid = side!.candidates[0]!.uid;
    const pendingArgs = side!.atomArgs as { uid?: unknown };
    const isPatternA = pendingArgs.uid === '$pick';
    let resolvedAtom: { kind: 'atom'; verb: string; args: Record<string, unknown> };
    if (isPatternA) {
      const { target: _omit, ...restArgs } = side!.atomArgs;
      void _omit;
      resolvedAtom = { kind: 'atom', verb: side!.atomVerb, args: { ...restArgs, uid: pickedUid } };
    } else {
      const cand = side!.candidates.find((c) => c.uid === pickedUid);
      resolvedAtom = { kind: 'atom', verb: side!.atomVerb, args: { ...side!.atomArgs, target: [cand!.cardId] } };
    }

    // engine.queue + runAllUntilEmpty (UI dispatch と同じ経路)
    event.queue(s, resolvedAtom as never, { player: 'self', cardId: '' }, 'effect:human-pick-resolved', { picked: pickedUid, source: side!.source });
    runAllUntilEmpty(s);

    // 期待: evidence -1 / hand +1
    expect(s.players.self.evidence.length, 'evidence -1').toBe(0);
    expect(s.players.self.hand, 'hand +1').toEqual(['X']);
  });

  // Phase E (Playwright trace 2026-05-23 で発覚): D08013 a1 の sequence で
  // [evidenceGain, evidenceToHand(PB), discard(PB)] のような複数 PB pick atom がある場合、
  // 初期 walk (resolveEffectPicks humanChooser=true) で step 2 evidenceToHand は
  // cands=0 (evidence empty before step 1 executes) → no side-channel set。
  // 続けて step 3 discard が初期 walk で cands=hand 5 枚 → side-channel set。
  // 結果、runtime で step 2 awaiting-pick の tryRePickFromAtom が
  // globalThis already set で bails → UI が discard modal を表示。
  it('Phase E: 初期 walk で後続 PB が side-channel を奪わない (sequence [evidenceGain, evidenceToHand, discard])', async () => {
    const { resolveEffectPicks } = await import('@/engine/effect/resolve-picks');
    const { run: runEffect } = await import('@/engine/effect/resolver');

    const s = createEmptyGameState();
    s.players.self.deck.push('DECK1');
    s.players.self.hand.push('H1', 'H2', 'H3', 'H4', 'H5');

    const sequence = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'evidenceGain' as never, args: { player: 'self', n: 1 } },
        {
          kind: 'choice' as const,
          chooser: 'self' as const,
          options: [
            {
              kind: 'atom' as const,
              verb: 'evidenceToHand' as never,
              args: { player: 'self', target: { kind: 'pick', query: { area: 'evidence', side: 'self' }, n: { min: 1, max: 1 } } },
            },
          ],
        },
        {
          kind: 'choice' as const,
          chooser: 'self' as const,
          options: [
            {
              kind: 'atom' as const,
              verb: 'discard' as never,
              args: { player: 'self', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 } } },
            },
          ],
        },
      ],
    };

    // 初期 walk (triggered.ts と同じ humanChooser=true)
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08013', abilityId: 'a1' }, bindings: {} };
    const resolved = resolveEffectPicks(s, sequence, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: 'D08013', abilityId: 'a1' } });

    // 初期 walk 後の side-channel: PB atom は runtime で set すべき。
    // 期待: side-channel は null (初期 walk では set されない)
    const sideAfterInitWalk = (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide;
    expect(sideAfterInitWalk, '初期 walk では PB atom の side-channel を set しない').toBeFalsy();

    // runtime drain (event.queue → runAllUntilEmpty 相当)
    runEffect(s, resolved, ctx);

    // runtime drain 後: step 1 evidenceGain で +1、step 2 awaiting-pick で side-channel
    // (evidenceToHand) set、step 3 awaiting-pick は guard で bail。
    const sideAfterRuntime = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; candidates: { cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(sideAfterRuntime, 'runtime で side-channel が set される').toBeTruthy();
    expect(sideAfterRuntime?.atomVerb, 'step 2 (evidenceToHand) が modal owner').toBe('evidenceToHand');
    expect(sideAfterRuntime?.candidates?.[0]?.cardId, 'cand は step 1 が追加した evidence の cardId').toBe('DECK1');
  });
});
