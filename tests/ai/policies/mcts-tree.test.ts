// Phase 9-F.2 (Cleanup 6-B) — MCTSTreePolicy (UCB1 tree) tests

import { describe, it, expect } from 'vitest';
import { MCTSTreePolicy } from '@/ai/policies/mcts-tree';
import type { Move } from '@/ai/move-enumerator';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate';

function makeBase() {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
  });
}

describe('MCTSTreePolicy — smoke', () => {
  it('exposes name "mcts-tree-ucb1"', () => {
    const p = new MCTSTreePolicy({ iterations: 5 });
    expect(p.name).toBe('mcts-tree-ucb1');
  });

  it('returns null for empty candidates', () => {
    const p = new MCTSTreePolicy({ iterations: 5 });
    const s = makeBase();
    expect(p.choose(s, [], 'self')).toBeNull();
  });

  it('returns the single candidate without iteration', () => {
    const p = new MCTSTreePolicy({ iterations: 5 });
    const s = makeBase();
    const m: Move = { kind: 'endTurn' };
    expect(p.choose(s, [m], 'self')).toBe(m);
  });

  it('returns endTurn when all candidates are endTurn', () => {
    const p = new MCTSTreePolicy({ iterations: 5 });
    const s = makeBase();
    const m: Move = { kind: 'endTurn' };
    expect(p.choose(s, [m, m], 'self')).toBe(m);
  });

  it('runs iterations + returns a candidate move (small budget)', () => {
    const p = new MCTSTreePolicy({ iterations: 10, rolloutMaxTurns: 3 });
    const s = makeBase();
    // 簡易な複数候補 (endTurn + reasoning) を渡し、何かが選ばれることを確認
    const candidates: Move[] = [
      { kind: 'endTurn' },
      { kind: 'reasoning', uid: 'partner:self' },
    ];
    const got = p.choose(s, candidates, 'self');
    expect(got).not.toBeNull();
    expect(candidates).toContain(got);
  });
});
