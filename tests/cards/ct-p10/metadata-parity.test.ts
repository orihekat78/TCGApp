import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REUSE_CARDS } from '@/cards/_reuse';

type OfficialRow = Record<string, string> & { kind: string };

function officialRows(): Map<string, OfficialRow> {
  const dir = join(process.cwd(), '.claude/specs/cards-data/ct-p10');
  const rows = new Map<string, OfficialRow>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.tsv'))) {
    const lines = readFileSync(join(dir, file), 'utf8').split(/\r?\n/).filter(Boolean);
    const header = lines[0]!.split('\t');
    for (const line of lines.slice(1)) {
      const cols = line.split('\t');
      const row = Object.fromEntries(header.map((key, i) => [key, cols[i] ?? ''])) as OfficialRow;
      row.kind = file.replace('.tsv', '');
      rows.set(row.cardNum, row);
    }
  }
  return rows;
}

function parts(value: string): string[] {
  return value.split(/[|,，]/).map((item) => item.trim()).filter(Boolean);
}

describe('CT-P10 official metadata parity', () => {
  const official = officialRows();
  const registered = REUSE_CARDS.filter((card) => card.id.startsWith('B10'));

  it.each(registered)('$id matches its official printing metadata', (card) => {
    const row = official.get(card.id);
    expect(row, `missing official row for ${card.id}`).toBeDefined();
    if (!row) return;

    expect(card.kind).toBe(row.kind);
    expect(card.colors).toEqual(parts(row.color));
    expect(card.traits ?? []).toEqual(parts(row.features ?? ''));
    expect(card.rarity).toBe(row.rarity);
    expect(card.imageUrl).toBe(row.imagePath);
    expect(card.no).toBe(`${row.cardId}/${row.cardNum}`);

    for (const field of ['level', 'ap', 'lp'] as const) {
      if (row[field]) expect(card[field]).toBe(Number(row[field]));
    }

    const titleParts = row.title.split('＆');
    expect(card.names.includes(row.title) || titleParts.every((name) => card.names.includes(name))).toBe(true);
  });
});
