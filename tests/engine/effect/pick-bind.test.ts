// Task D E0 (2026-06-12): pick-bind writeback — 1 つの pick を後続 atom で共有する機構。
//
// 「キャラを1枚まで選び、ターン終了時まで AP+1000 し、〚突撃〛を与える」(B07070/B07090/B09032 形)
// は 1 pick に 2 atom を適用する必要があるが、従来は charGrantKeyword 側の uid を解決する
// 手段が無く DEFERRED だった (B07093 a1 前例)。
//
// 設計: PA 短縮形 atom に `bind: '$picked'` を書くと、解決済み uid が runAtom 実行時に
// ctx.bindings['$picked'] へ writeback され、同一 sequence/chain の後続 atom が
// `uid: '$picked.uid'` で参照できる (deckRevealUntil の $matched / sceneEnter の $entered と同型)。
// human (applyPickAndContinuation 経由) と AI (初期 walk の同期解決 → runtime 実行) の
// 両経路をカバーするため、writeback は runAtom の汎用 preamble で行う。
//
// rules: 15-abilities-effects.md (効果解決順・bind 共有)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { char as readChar } from '@/engine/read/char';
import type { GameState, SceneCharacter, Effect, EffectCtx } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';

function sceneChar(cardId: string, uid: string, ap = 5000): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: ap, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function setupState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('D08015', 'a1'), sceneChar('D08015', 'a2')];
  return s;
}

describe('Task D E0: pick-bind writeback (1 pick を複数 atom で共有)', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('human 経路: continuation の後続 atom が $picked.uid で同一キャラを参照できる (B07070 形)', () => {
    const s = setupState();
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08015' }, bindings: {} } as EffectCtx;
    const remainder: Effect[] = [
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } } as Effect,
    ];
    const pending: PendingEffectPickSide = {
      player: 'self',
      candidates: [
        { uid: 'a1', cardId: 'D08015', player: 'self' },
        { uid: 'a2', cardId: 'D08015', player: 'self' },
      ],
      atomVerb: 'charModifyAP',
      atomArgs: { uid: '$pick', player: 'self', delta: 1000, scope: 'turn', bind: '$picked' },
      nMin: 0, nMax: 1,
      source: { cardId: 'D08015', abilityId: 'a1' },
      continuation: { remainder, ctx },
    } as unknown as PendingEffectPickSide;

    applyPickAndContinuation(s, pending, 'a2');

    expect(readChar.ap(s, 'a2'), '選んだ a2 に AP+1000').toBe(6000);
    expect(readChar.keywords(s, 'a2'), 'a2 に 突撃 が付与される').toContain('突撃');
    expect(readChar.ap(s, 'a1'), 'a1 は不変').toBe(5000);
    expect(readChar.keywords(s, 'a1')).not.toContain('突撃');
  });

  it('AI 経路: 初期 walk の同期解決後、runtime の別 ctx でも bind が解決される', () => {
    const s = setupState();
    const walkCtx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08015' }, bindings: {} } as EffectCtx;
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', player: 'self', delta: 1000, scope: 'turn', bind: '$picked', target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 0, max: 1 }, chooser: 'owner' } } },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } },
      ],
    } as Effect;
    // AI walk: chooseAtomTarget 無し → cands[0] (a1) を同期選択
    const resolved = resolveEffectPicks(s, effect, walkCtx, { byPlayer: 'self' });
    // runtime: entryToCtx 相当の新 ctx (walk の bindings は引き継がれない前提を模す)
    const runtimeCtx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08015' }, bindings: {} } as EffectCtx;
    runEffect(s, resolved as never, runtimeCtx);
    runAllUntilEmpty(s);

    expect(readChar.ap(s, 'a1'), 'AI が選んだ a1 に AP+1000').toBe(6000);
    expect(readChar.keywords(s, 'a1'), 'a1 に 突撃 が付与される').toContain('突撃');
    expect(readChar.ap(s, 'a2'), 'a2 は不変').toBe(5000);
  });

  it('multi-pick: bind は選択した全キャラを蓄積し、$picked.uid は先頭を指す', () => {
    const s = setupState();
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08015' }, bindings: {} } as EffectCtx;
    const remainder: Effect[] = [
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } } as Effect,
    ];
    const pending: PendingEffectPickSide = {
      player: 'self',
      candidates: [
        { uid: 'a1', cardId: 'D08015', player: 'self' },
        { uid: 'a2', cardId: 'D08015', player: 'self' },
      ],
      atomVerb: 'charModifyAP',
      atomArgs: { uid: '$pick', player: 'self', delta: 1000, scope: 'turn', bind: '$picked' },
      nMin: 0, nMax: 2,
      source: { cardId: 'D08015', abilityId: 'a1' },
      continuation: { remainder, ctx },
    } as unknown as PendingEffectPickSide;

    applyPickAndContinuation(s, pending, 'a1', ['a1', 'a2']);

    expect(readChar.ap(s, 'a1')).toBe(6000);
    expect(readChar.ap(s, 'a2')).toBe(6000);
    // bind は全 picked を蓄積、resolveBindRef は先頭 (a1) を返す
    expect((ctx.bindings as Record<string, unknown[]>)['$picked']).toHaveLength(2);
    expect(readChar.keywords(s, 'a1')).toContain('突撃');
  });

  it('回帰: bind 無し atom は bindings を書かない', () => {
    const s = setupState();
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'D08015' }, bindings: {} } as EffectCtx;
    runEffect(s, { kind: 'atom', verb: 'charModifyAP', args: { uid: 'a1', delta: 1000, scope: 'turn' } } as never, ctx);
    expect(Object.keys(ctx.bindings as object)).toHaveLength(0);
    expect(readChar.ap(s, 'a1')).toBe(6000);
  });
});
