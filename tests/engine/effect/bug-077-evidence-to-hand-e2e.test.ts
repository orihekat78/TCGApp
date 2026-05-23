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
});
