import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_SNAPSHOT_IDS,
  projectCalendarDate,
  registeredCardIdsFromCards,
  snapshotProjectDate,
  validateAuthorityExceptions,
  type AuthorityExceptionsFile,
  type AuthoritySnapshotHashes,
} from '../../scripts/cards/validate-authority-exceptions.js';

const HASHES: AuthoritySnapshotHashes = {
  cardCatalog: '1'.repeat(64),
  cardFaq: '2'.repeat(64),
  cardRestrictions: '3'.repeat(64),
  errata: '4'.repeat(64),
  floorRule: '5'.repeat(64),
  ruleManual: '6'.repeat(64),
};

function fixture(): AuthorityExceptionsFile {
  return {
    schemaVersion: 1,
    snapshots: { ...HASHES },
    exceptions: [
      {
        id: 'pr320-deck-name-filter',
        cardId: 'PR320',
        printings: ['PR320'],
        clauseRef: 'PR320.feature#2',
        missingAuthority: 'デッキ公開後の同名カード判定に関する公式Q&Aがない',
        blockedBehavior: 'カード名の接頭一致で代用しない',
        sourceUrls: [
          'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        ],
        status: 'blocked',
        reviewedAt: '2026-08-13',
      },
    ],
  };
}

describe('validateAuthorityExceptions', () => {
  it('accepts the strict reviewed schema with all six current snapshot hashes', () => {
    const result = validateAuthorityExceptions(fixture(), {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(),
      today: '2026-08-13',
    });

    expect(Object.keys(result.snapshots)).toEqual(AUTHORITY_SNAPSHOT_IDS);
    expect(result.exceptions).toHaveLength(1);
  });

  it('rejects unknown keys and invalid schema values', () => {
    const cases: unknown[] = [
      { ...fixture(), unexpected: true },
      { ...fixture(), schemaVersion: 2 },
      { ...fixture(), snapshots: { ...HASHES, extra: '7'.repeat(64) } },
      {
        ...fixture(),
        exceptions: [{ ...fixture().exceptions[0], unexpected: true }],
      },
      {
        ...fixture(),
        exceptions: [{ ...fixture().exceptions[0], status: 'approved' }],
      },
      {
        ...fixture(),
        exceptions: [{ ...fixture().exceptions[0], reviewedAt: '2026-02-31' }],
      },
      {
        ...fixture(),
        exceptions: [{ ...fixture().exceptions[0], reviewedAt: '2026-08-14' }],
      },
    ];

    for (const candidate of cases) {
      expect(() => validateAuthorityExceptions(candidate, {
        expectedSnapshots: HASHES,
        registeredCardIds: new Set(),
        today: '2026-08-13',
      })).toThrow();
    }
  });

  it('rejects blank or noncanonical authority rationale fields', () => {
    for (const field of ['clauseRef', 'missingAuthority', 'blockedBehavior'] as const) {
      for (const value of ['   ', ' leading', 'trailing ']) {
        const candidate = fixture();
        candidate.exceptions[0][field] = value;
        expect(() => validateAuthorityExceptions(candidate, {
          expectedSnapshots: HASHES,
          minimumReviewedAt: '2026-08-13',
          registeredCardIds: new Set(),
          today: '2026-08-13',
        })).toThrow(/invalid/i);
      }
    }
  });

  it('rejects an exception reviewed before the newest bound authority snapshot', () => {
    const candidate = fixture();
    candidate.exceptions[0].reviewedAt = '2026-08-12';

    expect(() => validateAuthorityExceptions(candidate, {
      expectedSnapshots: HASHES,
      minimumReviewedAt: '2026-08-13',
      registeredCardIds: new Set(),
      today: '2026-08-13',
    })).toThrow(/predates.*snapshot/i);
  });

  it('uses the Asia/Tokyo calendar date across the UTC rollover', () => {
    expect(projectCalendarDate(new Date('2026-08-12T15:30:00.000Z'))).toBe('2026-08-13');
    expect(projectCalendarDate(new Date('2026-08-13T14:59:59.999Z'))).toBe('2026-08-13');
    expect(snapshotProjectDate('2026-08-13T15:30:00.000Z')).toBe('2026-08-14');
  });

  it('rejects invalid or stale snapshot hashes', () => {
    for (const id of AUTHORITY_SNAPSHOT_IDS) {
      const invalid = fixture();
      invalid.snapshots[id] = 'not-a-hash';
      expect(() => validateAuthorityExceptions(invalid, {
        expectedSnapshots: HASHES,
        registeredCardIds: new Set(),
        today: '2026-08-13',
      })).toThrow(/hash/i);

      const stale = fixture();
      stale.snapshots[id] = 'f'.repeat(64);
      expect(() => validateAuthorityExceptions(stale, {
        expectedSnapshots: HASHES,
        registeredCardIds: new Set(),
        today: '2026-08-13',
      })).toThrow(/snapshot.*drift/i);
    }
  });

  it('rejects non-official, broadened, or malformed source URLs', () => {
    const urls = [
      'http://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
      'https://takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
      'https://www.takaratomy.co.jp.evil.example/cardlist/cards',
      'https://user@www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
      'https://www.takaratomy.co.jp:444/products/conan-cardgame/cardlist/cards',
      'https://www.takaratomy.co.jp/products/conan-cardgame/unreviewed',
    ];

    for (const url of urls) {
      const candidate = fixture();
      candidate.exceptions[0].sourceUrls = [url];
      expect(() => validateAuthorityExceptions(candidate, {
        expectedSnapshots: HASHES,
        registeredCardIds: new Set(),
        today: '2026-08-13',
      })).toThrow(/source URL/i);
    }
  });

  it('rejects duplicate exception, card, and printing ownership', () => {
    const duplicateId = fixture();
    duplicateId.exceptions.push({
      ...duplicateId.exceptions[0],
      cardId: 'PR319',
      printings: ['PR319'],
    });
    expect(() => validateAuthorityExceptions(duplicateId, {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(),
      today: '2026-08-13',
    })).toThrow(/duplicate exception/i);

    const duplicateCard = fixture();
    duplicateCard.exceptions.push({
      ...duplicateCard.exceptions[0],
      id: 'pr320-second-clause',
    });
    expect(() => validateAuthorityExceptions(duplicateCard, {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(),
      today: '2026-08-13',
    })).toThrow(/duplicate card ownership/i);

    const duplicatePrinting = fixture();
    duplicatePrinting.exceptions.push({
      ...duplicatePrinting.exceptions[0],
      id: 'pr320-parallel-owner',
      cardId: 'PR320P',
      printings: ['PR320', 'PR320P'],
    });
    expect(() => validateAuthorityExceptions(duplicatePrinting, {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(),
      today: '2026-08-13',
    })).toThrow(/duplicate printing ownership/i);
  });

  it('rejects a blocked printing that is registered with guessed semantics', () => {
    expect(() => validateAuthorityExceptions(fixture(), {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(['PR320']),
      today: '2026-08-13',
    })).toThrow(/blocked printing is registered/i);
  });

  it('fails closed when nonempty exceptions lack a registered-card inventory', () => {
    expect(() => validateAuthorityExceptions(fixture(), {
      expectedSnapshots: HASHES,
      today: '2026-08-13',
    })).toThrow(/registered card inventory/i);
  });

  it('requires the owned card id to appear in its printing set', () => {
    const candidate = fixture();
    candidate.exceptions[0].printings = ['PR319'];

    expect(() => validateAuthorityExceptions(candidate, {
      expectedSnapshots: HASHES,
      registeredCardIds: new Set(),
      today: '2026-08-13',
    })).toThrow(/cardId.*printings/i);
  });

  it('derives registered authority ownership from the real CardDef id field', () => {
    const registered = registeredCardIdsFromCards([
      { id: 'D08001' },
      { id: 'B01094P' },
    ]);

    expect([...registered]).toEqual(['D08001', 'B01094P']);
    expect(registered.has(undefined as unknown as string)).toBe(false);
  });

  it('is enforced by both the local pre-commit hook and CI', () => {
    const projectRoot = resolve(import.meta.dirname, '../..');
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as {
      'simple-git-hooks': { 'pre-commit': string };
    };
    const workflow = readFileSync(resolve(projectRoot, '.github/workflows/ci.yml'), 'utf8');

    expect(packageJson['simple-git-hooks']['pre-commit']).toContain(
      'npm run cards:authority:exceptions',
    );
    expect(workflow).toContain('npm run cards:authority:exceptions');
  });
});
