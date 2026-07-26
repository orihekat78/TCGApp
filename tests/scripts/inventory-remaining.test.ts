import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

describe('inventory-remaining', () => {
  it('refreshes registered IDs and scopes deterministic JSON inventory to --pkg', () => {
    const stdout = execFileSync(
      process.execPath,
      ['scripts/inventory-remaining.cjs', '--pkg', 'ct-p10', '--json'],
      { cwd: ROOT, encoding: 'utf8' },
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
  });
});
