import { describe, it, expect } from 'vitest';
const { fingerprint } = require('../../scripts/card-fingerprint.cjs');
const rm = (ap: number) => [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: ap }, max: 1 } }];

describe('fingerprint', () => {
  it('色/数値だけ違う2枚は同一 skeletonHash + 正しい token', () => {
    const x = fingerprint(rm(8000)); const y = fingerprint(rm(5000));
    expect(x.skeletonHash).toBe(y.skeletonHash);
    expect(x.tokens).toEqual(expect.arrayContaining(['verb:sceneRemove', 'filter:apMax', 'kind:sleepSelf', 'type:declared']));
  });
  it('構造が違えば skeletonHash も違う', () => {
    const y = fingerprint([{ type: 'declared', description: 'd', effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 }, { kind: 'atom', verb: 'draw', n: 1 }] } }]);
    expect(fingerprint(rm(8000)).skeletonHash).not.toBe(y.skeletonHash);
    expect(y.tokens).toContain('verb:draw');
  });
  it('closure(関数) は token closure を立てる', () => {
    expect(fingerprint([{ type: 'continuous', description: 'd', continuousModifier: { grantKeywords: () => [] } }]).tokens).toContain('closure');
  });
});
