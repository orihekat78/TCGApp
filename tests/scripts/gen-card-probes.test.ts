import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('gen-card-probes nested cost branches', () => {
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
});
