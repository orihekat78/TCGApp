import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('gen-card-probes', () => {
  it('emits every nested and sibling choice path with an exact branch witness', () => {
    const root = mkdtempSync(join(tmpdir(), 'conan-probe-'));
    try {
      const specs = {
        cards: [{ id: 'B04008', rep: 'B04008', abilities: [{
          id: 'nested-cost', type: 'declared', scope: 'on-scene', description: '', ruleRefs: [],
          effect: { kind: 'atom', verb: 'noop', args: {} },
          cost: {
            kind: 'pay', items: [
              { kind: 'choice', items: [
                { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
                { kind: 'choice', items: [
                  { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 2, max: 2 }, chooser: 'self' }, n: 2 },
                  { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 3, max: 3 }, chooser: 'self' }, n: 3 },
                ] },
              ] },
              { kind: 'choice', items: [
                { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 4, max: 4 }, chooser: 'self' }, n: 4 },
                { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 5, max: 5 }, chooser: 'self' }, n: 5 },
              ] },
            ],
          },
        }] }],
      };
      const specPath = join(root, 'spec.json');
      const out = join(root, 'out');
      writeFileSync(specPath, JSON.stringify(specs));
      execFileSync('node', ['scripts/gen-card-probes.cjs', '--specs', specPath, '--ids', 'B04008', '--out', out], { cwd: process.cwd() });
      const generated = readFileSync(join(out, 'B04008.gen.test.ts'), 'utf8');

      for (const path of ['[\n          0,\n          0\n        ]', '[\n          0,\n          1\n        ]', '[\n          1,\n          0,\n          0\n        ]', '[\n          1,\n          0,\n          1\n        ]', '[\n          1,\n          1,\n          0\n        ]', '[\n          1,\n          1,\n          1\n        ]']) {
        expect(generated).toContain(path);
      }
      expect(generated.match(/happy-path \(cost choice/g)).toHaveLength(6);
      expect(generated).toContain('removeFromHand unpayable (empty hand)');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps sibling optional and sequence-tail picks after declining an earlier optional effect', () => {
    const root = mkdtempSync(join(tmpdir(), 'conan-probe-'));
    try {
      const specs = {
        cards: [{ id: 'B04008', rep: 'B04008', abilities: [{
          id: 'optional-before-pick', type: 'declared', scope: 'on-scene', description: '', ruleRefs: [],
          effect: {
            kind: 'sequence',
            steps: [
              { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
              {
                kind: 'optional',
                effect: { kind: 'atom', verb: 'charSetCard', args: { side: 'self', n: 1, filter: { kind: 'character' } } },
              },
              { kind: 'atom', verb: 'charSetCard', args: { side: 'self', n: 1, filter: { kind: 'character' } } },
            ],
          },
        }] }],
      };
      const specPath = join(root, 'spec.json');
      const out = join(root, 'out');
      writeFileSync(specPath, JSON.stringify(specs));
      execFileSync('node', ['scripts/gen-card-probes.cjs', '--specs', specPath, '--ids', 'B04008', '--out', out], { cwd: process.cwd() });
      const generated = readFileSync(join(out, 'B04008.gen.test.ts'), 'utf8');
      const encodedScenarios = generated.match(/const SCENARIOS: ProbeScenario\[\] = ([\s\S]*?);\n\ndescribe/)?.[1];
      expect(encodedScenarios).toBeDefined();
      const scenarios = JSON.parse(encodedScenarios!) as Array<{ name: string; script: unknown[] }>;
      const decline = scenarios.find((scenario) => scenario.name.includes('optional-decline'));

      expect(decline?.script).toEqual([
        'optional:decline',
        'optional:take',
        { pickCardId: '__IN_0' },
        { pickCardId: '__IN_1' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
