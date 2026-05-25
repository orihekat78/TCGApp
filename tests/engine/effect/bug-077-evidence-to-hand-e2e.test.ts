// BUG-077: D08013 a1 step 2 evidenceToHand end-to-end simulation
//
// ユーザー実機検証で「ログには証拠 → 手札と出るが、evidence -1 / hand +1 されない」報告。
// unit test (atom-target-normalize.test.ts) では target を直接 array で渡して PASS。
// 本 test は effectPickResolve dispatch 経路をシミュレートして UI 経路の問題を切り分ける。

import { describe, it, expect, beforeEach } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { EffectCtx } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene' }, bindings: {} };
}

describe('BUG-077: D08013 a1 step 2 evidenceToHand e2e flow', () => {
  beforeEach(() => {
    _clearPendingEffectPickQueue();
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

  // 物理動作 atom 短縮形対応: card DSL 上 `{ player, n }` だけで pick query を engine 既定で
  // 補完する仕組みの動作確認 (substituteAtomPick + atom-handler 両方)。
  it('Phase F: 短縮形 {player, n} のみで evidenceToHand が awaiting-pick 経由で side-channel set', async () => {
    const { resolveEffectPicks } = await import('@/engine/effect/resolve-picks');
    const { run: runEffect } = await import('@/engine/effect/resolver');

    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'EV1', faceUp: false, origin: { turn: 0, via: 'init' } });

    // 短縮形 sequence: evidenceToHand を target 無しで呼ぶ
    const sequence = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'evidenceToHand' as never, args: { player: 'self', n: 1 } },
      ],
    };

    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08013', abilityId: 'a1' }, bindings: {} };
    const resolved = resolveEffectPicks(s, sequence, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: 'D08013', abilityId: 'a1' } });

    // 初期 walk: PB は side-channel set を抑止 → null のまま
    expect((globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide, '初期 walk では set しない').toBeFalsy();

    // runtime drain: atom-handler が defaults 補完 → tryRePickFromAtom → side-channel set
    runEffect(s, resolved, ctx);

    const side = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; candidates: { cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side?.atomVerb).toBe('evidenceToHand');
    expect(side?.candidates?.[0]?.cardId).toBe('EV1');
  });

  it('Phase G: 短縮形 + AI heuristic 経路 (humanChooser=false) で evidenceToHand が target 配列に解決', async () => {
    const { resolveEffectPicks } = await import('@/engine/effect/resolve-picks');

    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'EV-A', faceUp: false, origin: { turn: 0, via: 'init' } });

    const atom = { kind: 'atom' as const, verb: 'evidenceToHand' as never, args: { player: 'self', n: 1 } };
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08013', abilityId: 'a1' }, bindings: {} };

    // humanChooser=false (AI path) で短縮形を walk → cands[0] 採用 → target: [cardId]
    const resolved = resolveEffectPicks(s, atom, ctx, { byPlayer: 'self' }) as { args: { target?: unknown } };
    expect(Array.isArray(resolved.args.target), 'AI 経路では target が cardId 配列に解決').toBe(true);
    expect(resolved.args.target).toEqual(['EV-A']);
  });

  // BUG-078: D08013 a1 の step 2 (evidenceToHand) 解決後に step 3 (discard) modal が表示されない問題。
  // queue 化により、初回 drain で step 2 / step 3 が queue に順次 push されることを検証する。
  it('BUG-078 fix: D08013 a1 sequence の初回 drain で step 2 + step 3 が queue に push される', async () => {
    const { resolveEffectPicks, _peekPendingEffectPickQueueLength, _drainPendingEffectPickSide } = await import('@/engine/effect/resolve-picks');
    const { run: runEffect } = await import('@/engine/effect/resolver');

    const s = createEmptyGameState();
    s.players.self.deck.push('DECK1'); // step 1 evidenceGain で取り込まれる
    s.players.self.hand.push('H1', 'H2', 'H3', 'H4', 'H5');

    // D08013 a1 と同型の sequence (短縮形)
    const sequence = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'evidenceGain' as never,   args: { player: 'self', n: 1 } },
        { kind: 'atom' as const, verb: 'evidenceToHand' as never, args: { player: 'self', n: 1 } },
        { kind: 'atom' as const, verb: 'discard' as never,        args: { player: 'self', n: 1 } },
      ],
    };

    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08013', abilityId: 'a1' }, bindings: {} };
    const resolved = resolveEffectPicks(s, sequence, ctx, { humanChooser: true, byPlayer: 'self', source: { cardId: 'D08013', abilityId: 'a1' } });

    // 初回 drain (event.queue + runAllUntilEmpty 相当)
    runEffect(s, resolved, ctx);

    // queue に step 2 (evidenceToHand) と step 3 (discard) が両方 push されていること
    expect(_peekPendingEffectPickQueueLength(), 'queue に 2 件 push').toBe(2);

    const first = _drainPendingEffectPickSide();
    expect(first?.atomVerb, 'queue 先頭は step 2 evidenceToHand').toBe('evidenceToHand');
    expect(first?.candidates?.[0]?.cardId, 'step 1 で追加された evidence cardId').toBe('DECK1');

    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb, 'queue 末尾は step 3 discard').toBe('discard');
    expect(second?.candidates?.length, 'discard 候補は hand 5 枚').toBe(5);
  });

  // D08003 driver: 拡張 1 (filter) — discard 短縮形に filter 追加で候補を絞り込める
  it('Phase I: discard 短縮形 + filter で候補が絞り込まれる', async () => {
    const { resolveEffectPicks } = await import('@/engine/effect/resolve-picks');
    const { registerAll } = await import('@/cards/index');
    registerAll();

    const s = createEmptyGameState();
    // 手札に [少年探偵団] 2 枚 + 別 trait 1 枚
    // D08013 = 吉田歩美 [少年探偵団]、D08015 = 小嶋元太 [少年探偵団]、D11003 = [警察/神奈川県警]
    s.players.self.hand.push('D08013', 'D08015', 'D11003');

    const atom = {
      kind: 'atom' as const,
      verb: 'discard' as never,
      args: { player: 'self', n: 1, filter: { trait: '少年探偵団' } },
    };
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08003', abilityId: 'a1' }, bindings: {} };

    // AI 経路 (humanChooser=false) で resolved に → target が [cardId of first 少年探偵団]
    const resolved = resolveEffectPicks(s, atom, ctx, { byPlayer: 'self' }) as { args: { target?: unknown } };
    expect(Array.isArray(resolved.args.target)).toBe(true);
    // filter 適用で D08013 or D08015 のみ候補 (D11003 警察系は除外)
    const target = resolved.args.target as string[];
    expect(['D08013', 'D08015']).toContain(target[0]);
  });

  // D08003 driver: 拡張 2 (max) — max: 1 で n.min=0/max=1 = 「1枚まで」
  it('Phase J: 短縮形 max: N で n.min=0/max=N (任意 pick) になる', async () => {
    const { resolveEffectPicks, _drainPendingEffectPickSide } = await import('@/engine/effect/resolve-picks');

    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'EV1', faceUp: false, origin: { turn: 0, via: 'init' } });

    const atom = {
      kind: 'atom' as const,
      verb: 'evidenceToHand' as never,
      args: { player: 'self', max: 1 }, // max: 1 → n.min=0, n.max=1
    };
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'a1' }, bindings: {} };

    // humanChooser=true + _fromAtomHandler=true (runtime path) で side-channel set
    resolveEffectPicks(s, atom, ctx, { humanChooser: true, _fromAtomHandler: true, byPlayer: 'self', source: { cardId: 'TEST', abilityId: 'a1' } });

    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb).toBe('evidenceToHand');
    expect(side?.nMin, 'max: 1 で n.min=0 (skip 可)').toBe(0);
    expect(side?.nMax, 'max: 1 で n.max=1').toBe(1);
  });

  // D08003 driver: filter + max 組合せ (a1 step 1 と同じ shape の sanity check)
  it('Phase K: 短縮形 {player, max, filter} 組合せ動作', async () => {
    const { resolveEffectPicks, _drainPendingEffectPickSide } = await import('@/engine/effect/resolve-picks');
    const { registerAll } = await import('@/cards/index');
    registerAll();

    const s = createEmptyGameState();
    // D08013 = [少年探偵団]、D11003 = [警察] (少年探偵団 でない)
    s.players.self.hand.push('D08013', 'D11003');

    const atom = {
      kind: 'atom' as const,
      verb: 'discard' as never,
      args: { player: 'self', max: 1, filter: { trait: '少年探偵団' } },
    };
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08003', abilityId: 'a1' }, bindings: {} };

    resolveEffectPicks(s, atom, ctx, { humanChooser: true, _fromAtomHandler: true, byPlayer: 'self', source: { cardId: 'D08003', abilityId: 'a1' } });

    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb).toBe('discard');
    expect(side?.nMin).toBe(0);
    expect(side?.nMax).toBe(1);
    // filter 適用で D08013 のみ候補
    expect(side?.candidates?.length, 'filter で [少年探偵団] のみ 1 件').toBe(1);
    expect(side?.candidates?.[0]?.cardId).toBe('D08013');
  });

  // D08003 driver: 拡張 3 (sceneRemove 短縮形 PA) — { player, max, side, filter } で
  // PA pick が awaiting-pick になり scene 候補が side-channel に push される
  it('Phase L: sceneRemove 短縮形 PA で scene 候補が side-channel set', async () => {
    const { _drainPendingEffectPickSide } = await import('@/engine/effect/resolve-picks');
    const { registerAll } = await import('@/cards/index');
    registerAll();

    const s = createEmptyGameState();
    // 両 side の scene に char 配置 (D11003 = 警察 AP6000、D08018 = 少年探偵団 AP1000)
    s.players.self.scene.push({ cardId: 'D11003', uid: 'D11003#0', state: 'active', ap: 6000, lp: 1, level: 8, namedThisTurn: false, mods: { ap: 0, lp: 0, scope: 'turn' } });
    s.players.opp.scene.push({ cardId: 'D08018', uid: 'D08018#0', state: 'active', ap: 1000, lp: 1, level: 2, namedThisTurn: false, mods: { ap: 0, lp: 0, scope: 'turn' } });

    // sceneRemove 短縮形 (D08003 a1 step 2 と同じ shape): AP≤8000 両 side
    runAtom(s, 'sceneRemove', { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } }, ctxSelf());

    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb, 'sceneRemove pick awaiting').toBe('sceneRemove');
    expect(side?.nMin, 'max: 1 で n.min=0').toBe(0);
    expect(side?.nMax, 'max: 1 で n.max=1').toBe(1);
    // 両 side の scene char が候補に入る (apMax 8000 で両方該当)
    const candUids = side?.candidates?.map(c => c.uid).sort() ?? [];
    expect(candUids, '両 side の AP≤8000 候補').toEqual(['D08018#0', 'D11003#0']);
  });
});
