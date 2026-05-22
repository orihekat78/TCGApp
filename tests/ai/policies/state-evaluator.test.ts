// Phase 9-F.2 (Cleanup 6-A) — defaultStateEvaluator tests

import { describe, it, expect } from 'vitest';
import { defaultStateEvaluator } from '@/ai/policies/state-evaluator';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate';

function makeBase() {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
  });
}

describe('defaultStateEvaluator', () => {
  it('returns 0 for symmetric initial state', () => {
    const s = makeBase();
    const v = defaultStateEvaluator(s, 'self');
    expect(v).toBeCloseTo(0, 5);
  });

  it('returns +1 if self has gameResult.winner=self', () => {
    const s = produce(makeBase(), (d) => {
      d.gameResult = { winner: 'self', reason: 'evidence', turn: 5 };
    });
    expect(defaultStateEvaluator(s, 'self')).toBe(1);
    expect(defaultStateEvaluator(s, 'opp')).toBe(-1);
  });

  it('positive when self has more evidence than opp', () => {
    const s = produce(makeBase(), (d) => {
      d.players.self.evidence = Array.from({ length: 5 }, () => ({
        cardId: 'card-back',
        faceUp: false as const,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
    });
    const v = defaultStateEvaluator(s, 'self');
    expect(v).toBeGreaterThan(0);
  });

  it('negative when opp has more file (closer to assist)', () => {
    const s = produce(makeBase(), (d) => {
      d.players.opp.file = Array.from({ length: 6 }, (_, i) => `f${i}`);
    });
    const v = defaultStateEvaluator(s, 'self');
    expect(v).toBeLessThan(0);
  });

  it('penalty when own partner is sleep', () => {
    const sActive = makeBase();
    const sSleep = produce(makeBase(), (d) => {
      d.players.self.partner.state = 'sleep';
    });
    const vActive = defaultStateEvaluator(sActive, 'self');
    const vSleep = defaultStateEvaluator(sSleep, 'self');
    expect(vSleep).toBeLessThan(vActive);
  });

  it('output is clamped to [-1, 1]', () => {
    const s = produce(makeBase(), (d) => {
      d.players.self.evidence = Array.from({ length: 100 }, () => ({
        cardId: 'card-back',
        faceUp: false as const,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      d.players.self.file = Array.from({ length: 100 }, (_, i) => `f${i}`);
    });
    const v = defaultStateEvaluator(s, 'self');
    expect(v).toBeLessThanOrEqual(1);
    expect(v).toBeGreaterThanOrEqual(-1);
  });
});
