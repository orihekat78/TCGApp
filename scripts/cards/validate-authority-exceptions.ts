import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
type CardsDataSnapshot = { baseDir: string; lockToken: unknown; recovery: unknown };
type WithCardsDataSnapshot = <T>(options: { baseDir: string; read: (snapshot: CardsDataSnapshot) => T }) => T;
const { withCardsDataSnapshot } = require('./official-api.cjs') as { withCardsDataSnapshot: WithCardsDataSnapshot };

export const AUTHORITY_SNAPSHOT_IDS = [
  'cardCatalog',
  'cardFaq',
  'cardRestrictions',
  'errata',
  'floorRule',
  'ruleManual',
] as const;

export type AuthoritySnapshotId = (typeof AUTHORITY_SNAPSHOT_IDS)[number];
export type AuthoritySnapshotHashes = Record<AuthoritySnapshotId, string>;

export type AuthorityException = {
  id: string;
  cardId: string;
  printings: string[];
  clauseRef: string;
  missingAuthority: string;
  blockedBehavior: string;
  sourceUrls: string[];
  status: 'blocked';
  reviewedAt: string;
};

export type AuthorityExceptionsFile = {
  schemaVersion: 1;
  snapshots: AuthoritySnapshotHashes;
  exceptions: AuthorityException[];
};

export const RULE_AUTHORITY_SOURCES = {
  cardRestrictions: {
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/card_limit/limit/',
    fetchedAt: '2026-08-13',
    sha256: '9efdfa51ef55205607a5c26295020d75624910004187eca5ace9c954897a16e8',
    assertion: 'prohibited=2;restricted=2',
  },
  errata: {
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/errata',
    fetchedAt: '2026-08-13',
    sha256: '2f61606a9f7f61f0d2531a30edd4652eb6e0e9d3a70f31b667df48ba1d432764',
    assertion: 'correction-groups=7;latest-effective=2026-08-08',
  },
  floorRule: {
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/pdf/rule/floor_rule.pdf',
    fetchedAt: '2026-08-13',
    sha256: 'b71650d9e463c64fc4a7384107b3efed913685531e3bcb9dd3aed92ace5a1d00',
    assertion: 'version=1.36;pages=21;updated=2026-04-25',
  },
  ruleManual: {
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/pdf/rule/rule_manual.pdf',
    fetchedAt: '2026-08-13',
    sha256: '2a3caf3372e66656cd9ac0c5ba9dc8fc4177c176317f4f97086975c1c9e65d41',
    assertion: 'version=2.5;pages=27',
  },
} as const;

const CARDS_URL = 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards';
const HASH = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9-]{2,79}$/;
const CARD_ID = /^[A-Z][A-Za-z0-9]{2,19}$/;
const EXCEPTION_KEYS = [
  'blockedBehavior',
  'cardId',
  'clauseRef',
  'id',
  'missingAuthority',
  'printings',
  'reviewedAt',
  'sourceUrls',
  'status',
] as const;

type ValidationOptions = {
  expectedSnapshots?: AuthoritySnapshotHashes;
  minimumReviewedAt?: string;
  registeredCardIds?: ReadonlySet<string>;
  projectRoot?: string;
  today?: string;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} keys are invalid`);
  }
}

function text(value: unknown, label: string, pattern?: RegExp, max = 500): string {
  if (typeof value !== 'string'
    || value.trim() !== value
    || value.length < 3
    || value.length > max
    || /[\r\n]/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

export function projectCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (!value) throw new Error('project calendar date is unavailable');
    return value;
  };
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function snapshotProjectDate(fetchedAt: unknown): string {
  if (typeof fetchedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(fetchedAt)
    || !Number.isFinite(Date.parse(fetchedAt))) {
    throw new Error('authority snapshot timestamp is invalid');
  }
  return projectCalendarDate(new Date(fetchedAt));
}

function strictDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function officialSourceUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('authority source URL is invalid');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('authority source URL is invalid');
  }
  if (url.protocol !== 'https:'
    || url.hostname !== 'www.takaratomy.co.jp'
    || url.username
    || url.password
    || url.port
    || url.search) {
    throw new Error('authority source URL is invalid');
  }
  const base = `${url.origin}${url.pathname}`;
  const allowed = new Set([
    CARDS_URL,
    ...Object.values(RULE_AUTHORITY_SOURCES).map((source) => source.url),
  ]);
  if (!allowed.has(base)) throw new Error('authority source URL is not a reviewed source');
  return value;
}

function parseJson(path: string, label: string): Record<string, unknown> {
  try {
    return record(JSON.parse(readFileSync(path, 'utf8')), label);
  } catch (error) {
    if (error instanceof Error && error.message.includes(label)) throw error;
    throw new Error(`${label} is invalid`, { cause: error });
  }
}

function cardSnapshotDate(value: Record<string, unknown>, label: string): string {
  const source = record(value.source, `${label} source`);
  if (source.url !== CARDS_URL
    || typeof source.fetchedAt !== 'string') {
    throw new Error(`${label} source is invalid`);
  }
  try {
    return snapshotProjectDate(source.fetchedAt);
  } catch (error) {
    throw new Error(`${label} source is invalid`, { cause: error });
  }
}

function latestDate(values: readonly string[]): string {
  return [...values].sort().at(-1) ?? (() => { throw new Error('authority dates are empty'); })();
}

function currentMinimumReviewedAt(projectRoot: string): string {
  const status = parseJson(
    resolve(projectRoot, '.claude/specs/cards-data/status.json'),
    'card authority status',
  );
  const qa = parseJson(
    resolve(projectRoot, '.claude/specs/cards-data/qa-hash-snapshot.json'),
    'card FAQ snapshot',
  );
  return latestDate([
    cardSnapshotDate(status, 'card authority status'),
    cardSnapshotDate(qa, 'card FAQ snapshot'),
    ...Object.values(RULE_AUTHORITY_SOURCES).map((source) => source.fetchedAt),
  ]);
}

export function loadCurrentAuthoritySnapshotHashes(projectRoot: string): AuthoritySnapshotHashes {
  const status = parseJson(
    resolve(projectRoot, '.claude/specs/cards-data/status.json'),
    'card authority status',
  );
  const qa = parseJson(
    resolve(projectRoot, '.claude/specs/cards-data/qa-hash-snapshot.json'),
    'card FAQ snapshot',
  );
  const hashes = record(status.hashes, 'card authority status hashes');
  const cardCatalog = hashes.rawCardNums;
  const cardFaq = qa.normalizedFaqHash;
  if (typeof cardCatalog !== 'string' || !HASH.test(cardCatalog)) {
    throw new Error('card catalog snapshot hash is invalid');
  }
  if (typeof cardFaq !== 'string' || !HASH.test(cardFaq) || hashes.normalizedFaq !== cardFaq) {
    throw new Error('card FAQ snapshot hash is invalid');
  }
  return {
    cardCatalog,
    cardFaq,
    cardRestrictions: RULE_AUTHORITY_SOURCES.cardRestrictions.sha256,
    errata: RULE_AUTHORITY_SOURCES.errata.sha256,
    floorRule: RULE_AUTHORITY_SOURCES.floorRule.sha256,
    ruleManual: RULE_AUTHORITY_SOURCES.ruleManual.sha256,
  };
}

export function registeredCardIdsFromCards(
  cards: ReadonlyArray<{ id: string }>,
): ReadonlySet<string> {
  return new Set(cards.map((card) => card.id));
}

export function validateAuthorityExceptions(
  input: unknown,
  options: ValidationOptions = {},
): AuthorityExceptionsFile {
  const root = record(input, 'authority exceptions');
  exactKeys(root, ['exceptions', 'schemaVersion', 'snapshots'], 'authority exceptions');
  if (root.schemaVersion !== 1) throw new Error('authority exceptions schemaVersion must be 1');

  const snapshots = record(root.snapshots, 'authority snapshots');
  exactKeys(snapshots, AUTHORITY_SNAPSHOT_IDS, 'authority snapshots');
  const expected = options.expectedSnapshots
    ?? loadCurrentAuthoritySnapshotHashes(options.projectRoot ?? resolve(import.meta.dirname, '../..'));
  for (const id of AUTHORITY_SNAPSHOT_IDS) {
    if (typeof snapshots[id] !== 'string' || !HASH.test(snapshots[id])) {
      throw new Error(`authority snapshot hash is invalid: ${id}`);
    }
    if (snapshots[id] !== expected[id]) throw new Error(`authority snapshot drift: ${id}`);
  }

  if (!Array.isArray(root.exceptions)) throw new Error('authority exceptions must be an array');
  if (root.exceptions.length > 0 && options.registeredCardIds === undefined) {
    throw new Error('registered card inventory is required for authority exceptions');
  }
  const defaultMinimumReviewedAt = options.expectedSnapshots === undefined
    ? currentMinimumReviewedAt(options.projectRoot ?? resolve(import.meta.dirname, '../..'))
    : latestDate(Object.values(RULE_AUTHORITY_SOURCES).map((source) => source.fetchedAt));
  const minimumReviewedAt = strictDate(
    options.minimumReviewedAt ?? defaultMinimumReviewedAt,
    'minimum authority review date',
  );
  const today = strictDate(options.today ?? projectCalendarDate(), 'validation date');
  const ids = new Set<string>();
  const cardOwners = new Set<string>();
  const printingOwners = new Set<string>();
  const registered = options.registeredCardIds ?? new Set<string>();
  const exceptions = root.exceptions.map((entry, index) => {
    const candidate = record(entry, `authority exception ${index}`);
    exactKeys(candidate, EXCEPTION_KEYS, `authority exception ${index}`);
    const id = text(candidate.id, 'authority exception id', IDENTIFIER, 80);
    const cardId = text(candidate.cardId, 'authority exception cardId', CARD_ID, 20);
    if (ids.has(id)) throw new Error(`duplicate exception id: ${id}`);
    if (cardOwners.has(cardId)) throw new Error(`duplicate card ownership: ${cardId}`);
    ids.add(id);
    cardOwners.add(cardId);

    if (!Array.isArray(candidate.printings) || candidate.printings.length === 0) {
      throw new Error(`authority exception printings are invalid: ${id}`);
    }
    const printings = candidate.printings.map((printing) => text(
      printing,
      `authority exception printing: ${id}`,
      CARD_ID,
      20,
    ));
    if (printings.some((printing, printingIndex) => printingIndex > 0
      && printings[printingIndex - 1].localeCompare(printing, 'en') >= 0)) {
      throw new Error(`authority exception printings must be sorted and unique: ${id}`);
    }
    if (!printings.includes(cardId)) {
      throw new Error(`authority exception cardId must appear in printings: ${id}`);
    }
    for (const printing of printings) {
      if (printingOwners.has(printing)) throw new Error(`duplicate printing ownership: ${printing}`);
      printingOwners.add(printing);
      if (registered.has(printing)) throw new Error(`blocked printing is registered: ${printing}`);
    }
    if (registered.has(cardId)) throw new Error(`blocked printing is registered: ${cardId}`);

    if (!Array.isArray(candidate.sourceUrls) || candidate.sourceUrls.length === 0) {
      throw new Error(`authority exception source URLs are invalid: ${id}`);
    }
    const sourceUrls = candidate.sourceUrls.map(officialSourceUrl);
    if (sourceUrls.some((url, urlIndex) => urlIndex > 0
      && sourceUrls[urlIndex - 1].localeCompare(url, 'en') >= 0)) {
      throw new Error(`authority exception source URLs must be sorted and unique: ${id}`);
    }
    if (candidate.status !== 'blocked') throw new Error(`authority exception status is invalid: ${id}`);
    const reviewedAt = strictDate(candidate.reviewedAt, `authority exception reviewedAt: ${id}`);
    if (reviewedAt > today) throw new Error(`authority exception reviewedAt is in the future: ${id}`);
    if (reviewedAt < minimumReviewedAt) {
      throw new Error(`authority exception review predates an authority snapshot: ${id}`);
    }

    return {
      id,
      cardId,
      printings,
      clauseRef: text(candidate.clauseRef, `authority exception clauseRef: ${id}`, undefined, 200),
      missingAuthority: text(candidate.missingAuthority, `authority exception missingAuthority: ${id}`),
      blockedBehavior: text(candidate.blockedBehavior, `authority exception blockedBehavior: ${id}`),
      sourceUrls,
      status: 'blocked' as const,
      reviewedAt,
    };
  });

  return {
    schemaVersion: 1,
    snapshots: snapshots as AuthoritySnapshotHashes,
    exceptions,
  };
}

async function main(): Promise<void> {
  const projectRoot = resolve(import.meta.dirname, '../..');
  const dataDir = resolve(projectRoot, '.claude/specs/cards-data');
  const cardsModule = await import(pathToFileURL(resolve(projectRoot, 'src/cards/index.ts')).href);
  const registeredCardIds = registeredCardIdsFromCards(cardsModule.ALL_CARDS as Array<{ id: string }>);
  const validated = withCardsDataSnapshot({
    baseDir: dataDir,
    read: () => validateAuthorityExceptions(
      JSON.parse(readFileSync(resolve(projectRoot, '.claude/specs/authority-exceptions.json'), 'utf8')) as unknown,
      {
        projectRoot,
        expectedSnapshots: loadCurrentAuthoritySnapshotHashes(projectRoot),
        minimumReviewedAt: currentMinimumReviewedAt(projectRoot),
        registeredCardIds,
      },
    ),
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    ok: true,
    exceptions: validated.exceptions.length,
    snapshots: AUTHORITY_SNAPSHOT_IDS.length,
  })}\n`);
}

if (process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
