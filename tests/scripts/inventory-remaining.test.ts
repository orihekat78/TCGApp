import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

describe('inventory-remaining', () => {
  it('refreshes registered IDs and scopes deterministic JSON inventory to --pkg', () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'conan-inventory-catalog-'));
    try {
      const pkgDir = path.join(fixtureRoot, 'ct-p10');
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(
        path.join(pkgDir, 'character.tsv'),
        'cardNum\ttitle\tcolor\tlevel\teffect\tcutIn\thirameki\thenso\nB10097\tfixture\tblue\t1\t\t\t\t\n',
      );
      const stdout = execFileSync(
        process.execPath,
        ['scripts/inventory-remaining.cjs', '--pkg', 'ct-p10', '--json'],
        { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CONAN_CARDS_DATA_DIR: fixtureRoot } },
      );
      const inventory = JSON.parse(stdout) as {
        pkg: string;
        registered: number;
        total: number;
        cards: Array<{ num: string }>;
      };

      expect(inventory.pkg).toBe('ct-p10');
      expect(inventory.registered).toBeGreaterThan(2000);
      expect(inventory.total).toBe(inventory.cards.length);
      expect(inventory.cards.map((card) => card.num)).toEqual(
        [...inventory.cards.map((card) => card.num)].sort(),
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
