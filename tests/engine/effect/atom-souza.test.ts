// tests/engine/effect/atom-souza.test.ts — Phase 5 advance Souza atom unit test
//
// rules: 13-keywords.md §捜査X
// spec: Phase 5 advance Sub-task A

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { event } from '@/engine/event/index';
import type { GameState, EffectCtx } from '@/engine/types';
import { RandomPolicy } from '@/ai/policies/random';
import { HeuristicPolicy } from '@/ai/policies/heuristic';

function makeCtx(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'TEST', uid: 'test-uid', abilityId: 'a1' },
    rng: Math.random,
    dyn: {} as never,
  } as never;
}

function makeStateWithDeck(player: 'self' | 'opp', deck: string[]): GameState {
  const s = createEmptyGameState();
  s.players[player].deck = [...deck];
  return s;
}

describe('atom souza (Phase 5 advance Sub-task A)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
  });

  it('Test 1: deck X 以上 → top X が peek 順で bottom へ移動', () => {
    const s = makeStateWithDeck('opp', ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'opp', x: 3 }, makeCtx());
    });
    // top 3 (A, B, C) が下へ移動
    expect(after.players.opp.deck).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });

  it('Test 2: deck X 未満 → 残り全部 bottom へ移動 (実数のみ操作)', () => {
    const s = makeStateWithDeck('self', ['X', 'Y']);
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'self', x: 5 }, makeCtx());
    });
    expect(after.players.self.deck).toEqual(['X', 'Y']);
    // X=5 だが 2 枚しかないので top 2 (X, Y) を抜いて末尾に push → 結果同じ
  });

  it('Test 3: deck 空 → no-op + log 1 件', () => {
    const s = makeStateWithDeck('opp', []);
    const before = s.log.length;
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'opp', x: 3 }, makeCtx());
    });
    expect(after.players.opp.deck).toEqual([]);
    expect(after.log.length).toBe(before + 1);
    expect(after.log[after.log.length - 1].result).toContain('no-op');
  });

  it('Test 4: X=0 → no-op (deck 不変)', () => {
    const s = makeStateWithDeck('opp', ['A', 'B', 'C']);
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'opp', x: 0 }, makeCtx());
    });
    expect(after.players.opp.deck).toEqual(['A', 'B', 'C']);
  });

  it('Test 5: 自身のデッキも対象に取れる (player=self)', () => {
    const s = makeStateWithDeck('self', ['1', '2', '3', '4', '5']);
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'self', x: 2 }, makeCtx());
    });
    expect(after.players.self.deck).toEqual(['3', '4', '5', '1', '2']);
  });

  it('Test 6: log エントリに action=souza と revealed N が記録', () => {
    const s = makeStateWithDeck('opp', ['A', 'B', 'C', 'D']);
    const after = produce(s, (draft) => {
      runAtom(draft, 'souza', { player: 'opp', x: 3 }, makeCtx());
    });
    const last = after.log[after.log.length - 1];
    expect(last.action).toBe('souza');
    expect(last.player).toBe('opp');
    expect(last.result).toContain('revealed 3');
  });
});

describe('AIPolicy chooseSouzaOrder (Phase 5 advance)', () => {
  it('HeuristicPolicy: peek 順そのまま', () => {
    const policy = new HeuristicPolicy();
    const s = createEmptyGameState();
    const result = policy.chooseSouzaOrder?.(s, 'opp', ['A', 'B', 'C']);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('RandomPolicy: 入力配列の permutation を返す (要素同一)', () => {
    const policy = new RandomPolicy({ seed: 'souza-test-42' });
    const s = createEmptyGameState();
    const input = ['A', 'B', 'C', 'D'];
    const result = policy.chooseSouzaOrder?.(s, 'opp', input);
    expect(result?.length).toBe(input.length);
    expect([...(result ?? [])].sort()).toEqual([...input].sort());
  });

  it('RandomPolicy: 単要素は不変', () => {
    const policy = new RandomPolicy({ seed: 'x' });
    const s = createEmptyGameState();
    const result = policy.chooseSouzaOrder?.(s, 'self', ['only']);
    expect(result).toEqual(['only']);
  });
});
