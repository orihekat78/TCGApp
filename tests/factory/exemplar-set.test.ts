import { describe, it, expect } from 'vitest';
const { buildExemplarSet } = require('../../scripts/build-exemplar-set.cjs');
const { classify } = require('../../scripts/card-classify.cjs');

describe('buildExemplarSet', () => {
  it('全カードの token を union、skeleton を集合化', () => {
    const shipped = [
      { id: 'X1', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 1 } }] },
      { id: 'X2', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 2 } }] },
    ];
    const e = buildExemplarSet(shipped);
    expect(e.tokens).toContain('verb:draw');
    expect(e.cards).toBe(2);
    expect(e.skeletons.length).toBe(1); // n だけ違う → 同一 skeleton
  });

  // 回帰: __shared / __eventUse 候補は spec-form。runtime exemplar (codegen 後=annotation 消失) には
  // その token/skeleton が無く false-T2 になる。出荷済カードの spec-form corpus を union して解消する。
  it('shared-class 候補: runtime-only exemplar では false-T2、spec corpus union で T0', () => {
    const runtime = [{ id: 'R', abilities: [{ id: 'a1', type: 'icon-misread', scope: 'on-scene',
      effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'noop' }] }, description: 'd' }] }];
    const candSpec = [{ __shared: 'misreadX', args: { inner: {} } }];
    const exRuntimeOnly = buildExemplarSet(runtime);
    expect(classify(candSpec, exRuntimeOnly).tier).toBe('T2'); // bug: shared:misreadX が runtime exemplar に無い
    const corpus = [{ id: 'C', abilities: candSpec }]; // 出荷済カードの spec-form
    const exWithCorpus = buildExemplarSet(runtime, corpus);
    expect(exWithCorpus.tokens).toContain('shared:misreadX');
    expect(classify(candSpec, exWithCorpus).tier).toBe('T0'); // fixed
  });

  it('eventUse 候補も spec corpus union で token 表現される', () => {
    const runtime = [{ id: 'R', abilities: [{ id: 'a1', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', n: 1 }, description: 'd' }] }];
    const candSpec = [{ id: 'a1', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', selfOnly: true, __eventUse: true }, effect: { kind: 'atom', verb: 'draw', n: 1 }, description: 'd' }];
    expect(buildExemplarSet(runtime).tokens).not.toContain('trig:eventUse');
    expect(buildExemplarSet(runtime, [{ id: 'C', abilities: candSpec }]).tokens).toContain('trig:eventUse');
  });
});
