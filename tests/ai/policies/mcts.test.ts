// MCTSPolicy — Phase 9-F MVP unit tests
// spec: .claude/specs/phase-9-f-mcts.md
//
// 検証範囲:
//   - 空 candidates → null
//   - 単一 candidate → 即返却
//   - 全 endTurn → endTurn 返却
//   - 複数 candidates → 候補リスト内のいずれかを返却
//   - choose は決定論的 (同じ seed/state なら同じ move を選ぶ)
//   - optional method (chooseGuard 等) は HeuristicPolicy へ delegate

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';
import type { Move } from '@/ai/move-enumerator';
import { MCTSPolicy } from '@/ai/policies/mcts';

function makeCard(id: string, opts: { ap?: number; lp?: number } = {}): CardDef {
  return {
    id,
    name: id,
    type: 'character',
    levels: [1],
    colors: ['赤'],
    traits: [],
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1,
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function makeBaseState(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
  });
}

describe('MCTSPolicy', () => {
  let policy: MCTSPolicy;

  beforeEach(() => {
    resetDefRegistry();
    _resetUidCounter();
    registerCardDef(makeCard('P-SELF', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('P-OPP', { ap: 2000, lp: 1 }));
    // Fast rollouts to keep test runtime small
    policy = new MCTSPolicy({ seed: 'mcts-test', rollouts: 2, rolloutMaxTurns: 10 });
  });

  it('returns null when candidates is empty', () => {
    const s = makeBaseState();
    expect(policy.choose(s, [], 'self')).toBeNull();
  });

  it('returns the single candidate directly (no rollout)', () => {
    const s = makeBaseState();
    const move: Move = { kind: 'endTurn' };
    expect(policy.choose(s, [move], 'self')).toEqual(move);
  });

  it('returns endTurn when all candidates are endTurn', () => {
    const s = makeBaseState();
    const moves: Move[] = [{ kind: 'endTurn' }, { kind: 'endTurn' }];
    const result = policy.choose(s, moves, 'self');
    expect(result?.kind).toBe('endTurn');
  });

  it('returns one of the candidates from the input list', () => {
    const s = makeBaseState();
    const a: Move = { kind: 'partnerAbility', abilityId: 'a1' } as Move;
    const b: Move = { kind: 'endTurn' };
    const result = policy.choose(s, [a, b], 'self');
    expect([a, b]).toContain(result);
  });

  it('has name "mcts-rollout"', () => {
    expect(policy.name).toBe('mcts-rollout');
  });

  it('delegates chooseHiramekiTrigger to HeuristicPolicy (returns true by default)', () => {
    const s = makeBaseState();
    const result = policy.chooseHiramekiTrigger?.(s, { cardId: 'X', abilityId: 'a1' });
    expect(result).toBe(true);
  });

  it('delegates chooseSouzaOrder to HeuristicPolicy (passes through ids)', () => {
    const s = makeBaseState();
    const ids = ['c1', 'c2', 'c3'];
    const result = policy.chooseSouzaOrder?.(s, 'self', ids);
    expect(result).toEqual(ids);
  });

  it('delegates chooseMisreadTriggers to HeuristicPolicy', () => {
    const s = makeBaseState();
    // Empty candidates → empty array (rules/13 §資源温存)
    const result = policy.chooseMisreadTriggers?.(s, 'self-1', []);
    expect(result).toEqual([]);
  });
});
