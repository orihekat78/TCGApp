import { describe, it, expect } from 'vitest';
const { classify } = require('../../scripts/card-classify.cjs');
const { fingerprint } = require('../../scripts/card-fingerprint.cjs');
const proven = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 } }];

describe('classify', () => {
  it('同型出荷済 → T0', () => {
    const fp = fingerprint(proven);
    const ex = { tokens: fp.tokens, skeletons: [fp.skeletonHash] };
    const cand = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' },
      effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 5000 }, max: 1 } }];
    expect(classify(cand, ex).tier).toBe('T0');
  });
  it('token既出だが構造新規 → T1', () => {
    const ex = { tokens: ['type:declared', 'kind:atom', 'verb:sceneRemove', 'kind:sleepSelf',
      'filter:apMax', 'kind:sequence', 'verb:draw'], skeletons: ['none'] };
    const cand = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' }, effect: { kind: 'sequence',
      steps: [{ kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 }, { kind: 'atom', verb: 'draw', n: 1 }] } }];
    expect(classify(cand, ex).tier).toBe('T1');
  });
  it('未出荷 primitive → T2', () => {
    const r = classify([{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'partnerSolveCase' } }],
      { tokens: ['verb:draw'], skeletons: [] });
    expect(r.tier).toBe('T2'); expect(r.novel).toContain('verb:partnerSolveCase');
  });
  it('closure → T2', () => {
    expect(classify([{ type: 'continuous', description: 'd', continuousModifier: { grantKeywords: () => [] } }],
      { tokens: [], skeletons: [] }).tier).toBe('T2');
  });
});
