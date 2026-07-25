import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { B03134 } from '@/cards/ct-p03/B03134';
import { B05081 } from '@/cards/ct-p05/B05081';

describe('Task A codegen event use conditions', () => {
  it.each([B03134, B05081])('keeps %s.useCondition in a regenerated CardDef', (card) => {
    const root = mkdtempSync(join(tmpdir(), 'conan-task-a-use-condition-'));
    try {
      const specPath = join(root, 'spec.json');
      writeFileSync(specPath, JSON.stringify([{
        rep: card.id,
        verdict: 'green',
        abilities: [],
        ruleRefs: [],
        useCondition: card.useCondition,
      }]));

      const generated = execFileSync('node', ['scripts/taskA-codegen.cjs', specPath], {
        cwd: process.cwd(), encoding: 'utf8',
      });

      expect(card.useCondition).toBeDefined();
      expect(generated).toContain('useCondition:');
      expect(generated).toContain(`kind: '${card.useCondition!.kind}'`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
