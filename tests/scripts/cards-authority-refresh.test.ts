import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];
const RELEASE_COMMIT = 'a'.repeat(40);

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'conan-authority-refresh-test-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function officialCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    card_id: '0001',
    title: 'Card one',
    card_num: 'B00001',
    show_hide: '表示',
    date: '2026-01-01 00:00:00',
    package: 'CT-P01 set',
    category1: null,
    category2: null,
    category3: null,
    region: '日本',
    main_thumb: 'B00001.jpg',
    main_path: 'one.jpg',
    sub_thumb: null,
    sub_path: null,
    color: '青',
    type: 'キャラ',
    rarity: 'C',
    cost: '1',
    ap: '1000',
    lp: '1',
    feature: 'Effect one',
    drawing: '原作',
    flavor_txt: null,
    difficulty_first: null,
    difficulty_second: null,
    illustrator: null,
    copyright: 'copyright',
    hirameki: null,
    cut_in: null,
    q_a: null,
    linkto: null,
    contain: null,
    henso: null,
    created_at: '2026-01-01T00:00:00.000000Z',
    updated_at: '2026-01-01T00:00:00.000000Z',
    rcp_showhide: 1,
    rcp_limit: 3,
    rcp_caution: null,
    rcp_sameid_limit: 3,
    release_date: '2026-01-01 00:00:00',
    ...overrides,
  };
}

function officialResponse(payload: unknown, overrides: Record<string, unknown> = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return {
    ok: true,
    status: 200,
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1',
    redirected: false,
    headers: new Headers({ 'content-type': 'application/json', 'content-length': String(bytes.byteLength) }),
    arrayBuffer: async () => bytes.buffer,
    ...overrides,
  };
}

function officialPage(cards: unknown[]) {
  return { data: cards, total: cards.length, lastPage: 1, page: 1 };
}

function refreshPacketArtifact(packet: { artifacts: Array<{ bytes: number; path: string; sha256: string }> }, packetRoot: string, artifactPath: string) {
  const artifact = packet.artifacts.find((entry) => entry.path === artifactPath);
  if (!artifact) throw new Error(`missing fixture artifact: ${artifactPath}`);
  const bytes = readFileSync(join(packetRoot, ...artifactPath.split('/')));
  artifact.bytes = bytes.byteLength;
  artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
}

describe('official authority diff', () => {
  it('emits every exact change in ordinal order', () => {
    const { buildAuthorityDiff } = require('../../scripts/cards/authority-diff.cjs');
    const prior = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00010', fields: { title: 'old-title', feature: 'same' } },
          { cardNum: 'B00002', fields: { title: 'same', feature: 'old-feature' } },
          { cardNum: 'B00001', fields: { title: 'removed' } },
        ],
      },
      qaSnapshot: {
        items: [
          { qaId: 'qa:z', answerHash: 'same-answer' },
          { qaId: 'qa:changed', answerHash: 'old-answer' },
          { qaId: 'qa:removed', answerHash: 'old-answer' },
        ],
      },
    };
    const next = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00011', fields: { title: 'added' } },
          { cardNum: 'B00002', fields: { title: 'same', feature: 'new-feature' } },
          { cardNum: 'B00010', fields: { title: 'new-title', feature: 'same' } },
        ],
      },
      qaSnapshot: {
        items: [
          { qaId: 'qa:new', answerHash: 'new-answer' },
          { qaId: 'qa:z', answerHash: 'same-answer' },
          { qaId: 'qa:changed', answerHash: 'new-answer' },
        ],
      },
    };

    expect(buildAuthorityDiff(prior, next)).toEqual({
      schemaVersion: 1,
      added: ['B00011'],
      removed: ['B00001'],
      changedFields: [
        { cardNum: 'B00002', fields: ['feature'] },
        { cardNum: 'B00010', fields: ['title'] },
      ],
      qaAdded: ['qa:new'],
      qaRemoved: ['qa:removed'],
      qaAnswerChanged: ['qa:changed'],
    });
  });
});

describe('official authority acquisition', () => {
  it.each([
    {
      name: 'a redirect response',
      response: officialResponse(officialPage([officialCard()]), {
        status: 302,
        ok: false,
        url: 'https://attacker.invalid/cards?page=1',
        redirected: true,
      }),
      error: /redirect/i,
    },
    {
      name: 'a non-JSON response',
      response: officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
      error: /content type/i,
    },
    {
      name: 'an oversized response header',
      response: officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'application/json', 'content-length': '2049' }),
      }),
      error: /byte limit/i,
    },
  ])('rejects $name without retrying', async ({ response, error }) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    let calls = 0;

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => {
        calls += 1;
        return response;
      },
      maxResponseBytes: 2048,
      delay: async () => undefined,
    })).rejects.toThrow(error);
    expect(calls).toBe(1);
  });

  it.each([
    ['a missing card number', [officialCard({ card_num: '' })], /missing card_num/i],
    ['duplicate card numbers', [officialCard(), officialCard()], /duplicate card_num/i],
    ['an unknown response field', [officialCard({ unexpected: 'field' })], /schema/i],
  ])('rejects %s', async (_name, cards, error) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(error);
  });

  it.each([
    ['a duplicate numeric ID', [officialCard(), officialCard({ card_num: 'B00002', card_id: '0002' })], /duplicate numeric id.*1/i],
    ['an invalid updated timestamp', [officialCard({ updated_at: 'not-a-timestamp' })], /invalid updated_at.*B00001/i],
    ['an impossible updated date', [officialCard({ updated_at: '2026-02-31T00:00:00Z' })], /invalid updated_at.*B00001/i],
    ['an invalid created timestamp', [officialCard({ created_at: '2026-01-01' })], /invalid created_at.*B00001/i],
  ])('rejects %s in fetched authority', async (_name, cards, error) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(error);
  });

  it('accepts the official null created_at representation while retaining the field', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    const snapshot = await fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage([officialCard({ created_at: null })])),
      delay: async () => undefined,
    });

    expect(snapshot.cards).toHaveLength(1);
    expect(snapshot.cards[0]).toHaveProperty('created_at', null);
  });

  it('enforces the byte limit when Content-Length is absent', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'application/json' }),
      }),
      maxResponseBytes: 64,
      delay: async () => undefined,
    })).rejects.toThrow(/byte limit/i);
  });

  it('rejects a catalog that changes between two complete acquisitions', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    let calls = 0;

    await expect(acquireStableOfficialCards({
      fetchImpl: async () => {
        calls += 1;
        const title = calls === 1 ? 'First value' : 'Changed value';
        return officialResponse(officialPage([officialCard({ title })]));
      },
      delay: async () => undefined,
    })).rejects.toThrow(/changed between acquisitions/i);
    expect(calls).toBe(2);
  });

  it('canonicalizes response object and card order before comparing acquisitions', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    const first = officialCard({ card_num: 'B00002', id: 2, card_id: '0002' });
    const second = officialCard();
    let calls = 0;

    const snapshot = await acquireStableOfficialCards({
      fetchImpl: async () => {
        calls += 1;
        const cards = calls === 1
          ? [first, second]
          : [Object.fromEntries(Object.entries(second).reverse()), Object.fromEntries(Object.entries(first).reverse())];
        return officialResponse(officialPage(cards));
      },
      delay: async () => undefined,
    });

    expect(snapshot.cards.map((card: { card_num: string }) => card.card_num)).toEqual(['B00001', 'B00002']);
    expect(snapshot.acquisitionDigests).toEqual([snapshot.digest, snapshot.digest]);
  });

  it('acquires and compares every page in both complete snapshots', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    const cards = [officialCard(), officialCard({ id: 2, card_id: '0002', card_num: 'B00002' })];
    let calls = 0;

    const snapshot = await acquireStableOfficialCards({
      fetchImpl: async (url: string) => {
        calls += 1;
        const page = Number(new URL(url).searchParams.get('page'));
        return officialResponse({ data: [cards[page - 1]], total: 2, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    });

    expect(calls).toBe(4);
    expect(snapshot.cards.map((card: { card_num: string }) => card.card_num)).toEqual(['B00001', 'B00002']);
  });

  it('rejects duplicate card numbers split across pages', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        return officialResponse({ data: [officialCard({ id: page })], total: 2, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    })).rejects.toThrow(/duplicate card_num.*B00001/i);
  });

  it('rejects pagination metadata drift on a later page', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        const card = officialCard({ id: page, card_id: String(page).padStart(4, '0'), card_num: `B${String(page).padStart(5, '0')}` });
        return officialResponse({ data: [card], total: page === 1 ? 2 : 3, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    })).rejects.toThrow(/pagination metadata changed/i);
  });
});

describe('official authority packet', () => {
  it('builds the exact packet entirely under an external temporary root', async () => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const card = officialCard();
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex([card], {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };

    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([card])),
      delay: async () => undefined,
    });

    expect(packet.diff).toEqual({
      schemaVersion: 1,
      added: [],
      removed: [],
      changedFields: [],
      qaAdded: [],
      qaRemoved: [],
      qaAnswerChanged: [],
    });
    expect(packet.status.printings).toEqual({ raw: 1, tsv: 1 });
    expect(packet.sourceDigests.acquisitions).toEqual([
      packet.sourceDigests.officialCards,
      packet.sourceDigests.officialCards,
    ]);
    expect(packet.artifacts.length).toBeGreaterThan(3);
    expect(packet.artifacts.every((entry: { path: string }) => !entry.path.startsWith('..'))).toBe(true);
    expect(readdirSync(projectRoot)).toEqual([]);
    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).not.toThrow();
  });

  it('rejects a raw and TSV card-number mismatch before producing a packet', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } }, fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
      regenerate: ({ baseDir }: { baseDir: string }) => {
        const directory = join(baseDir, 'ct-p01');
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, 'character.tsv'), 'cardNum\nB00002\n', 'utf8');
      },
    })).rejects.toThrow(/raw\/TSV cardNum mismatch/i);
    expect(existsSync(join(packetRoot, 'packet.json'))).toBe(false);
  });

  it('rejects conflicting official answers for one Q&A identity', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const cards = [
      officialCard({ q_a: JSON.stringify({ Question: 'First answer' }) }),
      officialCard({
        id: 2,
        card_num: 'B00001P',
        main_path: 'two.jpg',
        q_a: JSON.stringify({ Question: 'Conflicting answer' }),
      }),
    ];

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } }, fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(/Q&A conflict/i);
  });

  it.each([
    ['a removed printing', [], /removed printing B00001/i],
    ['an existing-card text change', [officialCard({ title: 'Changed title' })], /unreviewed card change B00001.*title/i],
  ])('keeps %s reviewable but not publishable', async (_name, cards, error) => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const priorCard = officialCard();
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex([priorCard], {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    });

    expect(() => validatePublishableAuthorityPacket(packet, prior, [], { packetRoot, projectRoot })).toThrow(error);
  });

  it('rejects artifact tampering after packet construction', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const artifact = join(packetRoot, ...packet.artifacts[0].path.split('/'));
    writeFileSync(artifact, 'tampered\n', 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/artifact bytes changed/i);
  });

  it('rejects a regenerated TSV semantic change and invalidates its prior review digest', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const originalReviewDigest = authorityReviewDigest(packet);
    const forged = structuredClone(packet);
    const artifact = forged.artifacts.find((entry: { path: string }) => entry.path.endsWith('.tsv'));
    expect(artifact).toBeDefined();
    const artifactPath = join(packetRoot, ...artifact.path.split('/'));
    const changed = readFileSync(artifactPath, 'utf8').replace('Card one', 'TAMPERED');
    expect(changed).toContain('TAMPERED');
    writeFileSync(artifactPath, changed, 'utf8');
    const changedBytes = readFileSync(artifactPath);
    artifact.bytes = changedBytes.byteLength;
    artifact.sha256 = createHash('sha256').update(changedBytes).digest('hex');
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(forged, null, 2)}\n`, 'utf8');

    expect(authorityReviewDigest(forged)).not.toBe(originalReviewDigest);
    expect(() => validateAuthorityPacket(forged, prior, { packetRoot, projectRoot })).toThrow(/TSV artifacts do not match raw/i);
  });

  it('rejects forged embedded metadata even when artifact bytes stay unchanged', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const forged = structuredClone(packet);
    forged.fieldIndex.cards[0].fields.title = 'f'.repeat(64);
    forged.diff = require('../../scripts/cards/authority-diff.cjs').buildAuthorityDiff(prior, forged);

    expect(() => validateAuthorityPacket(forged, prior, { packetRoot, projectRoot })).toThrow(/not bound to artifacts/i);
  });

  it('rejects duplicate numeric IDs when validating a self-consistent offline packet', async () => {
    const {
      buildAuthorityPacket,
      stableJson,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([
        officialCard(),
        officialCard({ id: 2, card_id: '0002', card_num: 'B00002' }),
      ])),
      delay: async () => undefined,
    });
    const rawArtifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith('-api.json'));
    expect(rawArtifact).toBeDefined();
    const rawPath = join(packetRoot, ...rawArtifact.path.split('/'));
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
    raw.data[1].id = 1;
    writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const sourceDigest = createHash('sha256').update(Buffer.from(stableJson(raw.data))).digest('hex');
    packet.sourceDigests.officialCards = sourceDigest;
    packet.sourceDigests.acquisitions = [sourceDigest, sourceDigest];
    packet.fieldIndex.cards[1].fields.id = createHash('sha256').update(Buffer.from(stableJson(1))).digest('hex');
    const fieldIndexArtifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith('authority-field-index.json'));
    expect(fieldIndexArtifact).toBeDefined();
    const fieldIndexPath = join(packetRoot, ...fieldIndexArtifact.path.split('/'));
    writeFileSync(fieldIndexPath, `${JSON.stringify(packet.fieldIndex, null, 2)}\n`, 'utf8');
    refreshPacketArtifact(packet, packetRoot, rawArtifact.path);
    refreshPacketArtifact(packet, packetRoot, fieldIndexArtifact.path);
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/duplicate numeric id.*1/i);
  });

  it('rejects a TSV validation temp base inside the project before writing', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const previousTemp = process.env.TEMP;
    const previousTmp = process.env.TMP;
    process.env.TEMP = projectRoot;
    process.env.TMP = projectRoot;
    try {
      expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/validation temporary root.*external/i);
    } finally {
      if (previousTemp === undefined) delete process.env.TEMP;
      else process.env.TEMP = previousTemp;
      if (previousTmp === undefined) delete process.env.TMP;
      else process.env.TMP = previousTmp;
    }
    expect(readdirSync(projectRoot).some((entry) => entry.startsWith('conan-authority-tsv-verify-'))).toBe(false);
  });

  it('preserves a victim directory swapped into the TSV validation temp path', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const validationRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${validationRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(victimRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => validationRoot,
      validationRegenerate: () => {
        renameSync(validationRoot, admittedRoot);
        renameSync(victimRoot, validationRoot);
      },
    })).toThrow(/temporary root identity changed/i);
    expect(readFileSync(join(validationRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a project directory returned as the TSV validation temp without deleting it', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const protectedRoot = join(projectRoot, 'must-survive');
    mkdirSync(protectedRoot);
    writeFileSync(join(protectedRoot, 'sentinel.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => protectedRoot,
    })).toThrow(/validation temporary root.*external/i);
    expect(readFileSync(join(protectedRoot, 'sentinel.txt'), 'utf8')).toBe('preserve me');
  });

  it('rejects a populated external TSV validation temp without deleting it', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const populatedRoot = tempDir();
    writeFileSync(join(populatedRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => populatedRoot,
    })).toThrow(/validation temporary root must be empty/i);
    expect(readFileSync(join(populatedRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
  });

  it('rejects a junction swapped into the TSV validation temp during admission without deleting its target', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const validationRoot = tempDir();
    const admittedRoot = `${validationRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(projectRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => validationRoot,
      validationAdmissionOperations: {
        readdir: (candidate: string) => {
          const entries = readdirSync(candidate);
          renameSync(validationRoot, admittedRoot);
          symlinkSync(projectRoot, validationRoot, 'junction');
          return entries;
        },
      },
    })).toThrow(/identity changed during admission/i);
    expect(readFileSync(join(projectRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects raw package files whose contents were swapped without semantic card changes', async () => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const cards = [
      officialCard(),
      officialCard({ id: 2, card_id: '0002', card_num: 'B00002', package: 'CT-P02 set', main_path: 'two.jpg' }),
    ];
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex(cards, {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    });
    expect(packet.diff.changedFields).toEqual([]);
    const rawArtifacts = packet.artifacts.filter((entry: { path: string }) => entry.path.endsWith('-api.json'));
    expect(rawArtifacts.map((entry: { path: string }) => entry.path)).toHaveLength(2);
    const firstPath = join(packetRoot, ...rawArtifacts[0].path.split('/'));
    const secondPath = join(packetRoot, ...rawArtifacts[1].path.split('/'));
    const first = readFileSync(firstPath);
    const second = readFileSync(secondPath);
    writeFileSync(firstPath, second);
    writeFileSync(secondPath, first);
    refreshPacketArtifact(packet, packetRoot, rawArtifacts[0].path);
    refreshPacketArtifact(packet, packetRoot, rawArtifacts[1].path);
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validatePublishableAuthorityPacket(packet, prior, [], { packetRoot, projectRoot })).toThrow(/raw package.*ct-p0[12]/i);
  });

  it('rejects an impossible fetchedAt across a self-consistent packet', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const impossible = '2026-02-31T00:00:00Z';
    packet.source.fetchedAt = impossible;
    packet.status.source.fetchedAt = impossible;
    packet.fieldIndex.source.fetchedAt = impossible;
    for (const [suffix, value] of [
      ['status.json', packet.status],
      ['authority-field-index.json', packet.fieldIndex],
    ] as const) {
      const artifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith(suffix));
      expect(artifact).toBeDefined();
      writeFileSync(join(packetRoot, ...artifact.path.split('/')), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      refreshPacketArtifact(packet, packetRoot, artifact.path);
    }
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/fetchedAt is invalid|source is invalid/i);
  });

  it('binds an approval to the exact packet review digest', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const disposition = { kind: 'added', identity: 'B00001', packetDigest: authorityReviewDigest(packet) };

    expect(() => validatePublishableAuthorityPacket(packet, prior, [disposition], { packetRoot, projectRoot })).not.toThrow();
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [{ ...disposition, packetDigest: '0'.repeat(64) }],
      { packetRoot, projectRoot },
    )).toThrow(/disposition digest mismatch/i);
  });

  it('requires exact dispositions for every card and Q&A delta', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const baselineRoot = tempDir();
    const packetRoot = tempDir();
    const emptyPrior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const oldCards = [
      officialCard({ q_a: JSON.stringify({ 'Question one': 'Old answer' }) }),
      officialCard({ id: 2, card_id: '0002', card_num: 'B00002', main_path: 'two.jpg', q_a: JSON.stringify({ 'Question removed': 'Removed answer' }) }),
    ];
    const baseline = await buildAuthorityPacket({
      projectRoot,
      tempRoot: baselineRoot,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: emptyPrior,
      fetchImpl: async () => officialResponse(officialPage(oldCards)),
      delay: async () => undefined,
    });
    const prior = { status: baseline.status, fieldIndex: baseline.fieldIndex, qaSnapshot: baseline.qaSnapshot };
    const nextCards = [
      officialCard({ title: 'Changed title', q_a: JSON.stringify({ 'Question one': 'New answer' }) }),
      officialCard({ id: 3, card_id: '0003', card_num: 'B00003', main_path: 'three.jpg', q_a: JSON.stringify({ 'Question added': 'Added answer' }) }),
    ];
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(nextCards)),
      delay: async () => undefined,
    });
    expect(packet.diff.added).toEqual(['B00003']);
    expect(packet.diff.removed).toEqual(['B00002']);
    expect(packet.diff.changedFields).toEqual([{ cardNum: 'B00001', fields: ['q_a', 'title'] }]);
    expect(packet.diff.qaAdded).toHaveLength(1);
    expect(packet.diff.qaRemoved).toHaveLength(1);
    expect(packet.diff.qaAnswerChanged).toHaveLength(1);
    const packetDigest = authorityReviewDigest(packet);
    const dispositions = [
      ...packet.diff.added.map((identity: string) => ({ kind: 'added', identity, packetDigest })),
      ...packet.diff.removed.map((identity: string) => ({ kind: 'removed', identity, packetDigest })),
      ...packet.diff.changedFields.map(({ cardNum: identity }: { cardNum: string }) => ({ kind: 'changed', identity, packetDigest })),
      ...new Set([...packet.diff.qaAdded, ...packet.diff.qaRemoved, ...packet.diff.qaAnswerChanged]),
    ].flatMap((entry) => typeof entry === 'string' ? [{ kind: 'qa', identity: entry, packetDigest }] : [entry]);

    expect(() => validatePublishableAuthorityPacket(packet, prior, dispositions, { packetRoot, projectRoot })).not.toThrow();
    for (let index = 0; index < dispositions.length; index += 1) {
      expect(() => validatePublishableAuthorityPacket(
        packet,
        prior,
        dispositions.filter((_, candidate) => candidate !== index),
        { packetRoot, projectRoot },
      )).toThrow(/not approved|unreviewed/i);
    }
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [...dispositions, dispositions[0]],
      { packetRoot, projectRoot },
    )).toThrow(/duplicate authority disposition/i);
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [...dispositions, { kind: 'changed', identity: 'B99999', packetDigest }],
      { packetRoot, projectRoot },
    )).toThrow(/does not match a packet change/i);
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      dispositions.map((entry, index) => index === 0 ? { ...entry, kind: 'changed' } : entry),
      { packetRoot, projectRoot },
    )).toThrow(/unreviewed added printing/i);
  });

  it('rejects a temporary root nested under the project', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = join(projectRoot, 'packet');
    mkdirSync(packetRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/external to the project/i);
  });

  it('rejects a project nested under the temporary root and a non-empty temporary root', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const packetRoot = tempDir();
    const projectRoot = join(packetRoot, 'project');
    mkdirSync(projectRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/external to the project/i);

    const external = tempDir();
    writeFileSync(join(external, 'occupied'), 'x');
    await expect(buildAuthorityPacket({
      projectRoot: tempDir(),
      tempRoot: external,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/must be empty/i);
  });

  it('rejects a temporary-root junction swap before any post-regeneration write', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const originalRoot = `${packetRoot}-original`;
    tempDirs.push(originalRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
      regenerate: () => {
        renameSync(packetRoot, originalRoot);
        symlinkSync(projectRoot, packetRoot, process.platform === 'win32' ? 'junction' : 'dir');
      },
    })).rejects.toThrow(/temporary root/i);
    expect(readdirSync(projectRoot)).toEqual([]);
  });
});

describe('authority bootstrap', () => {
  it('loads a hash-verified tracked card-number set without raw field claims', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    const catalogRoot = join(projectRoot, 'meta-app', 'src', 'data');
    mkdirSync(cardsDataRoot, { recursive: true });
    mkdirSync(catalogRoot, { recursive: true });
    const cardNums = ['B00002', 'B00001'];
    const hash = require('node:crypto').createHash('sha256').update('B00001\nB00002', 'utf8').digest('hex');
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 2, tsv: 2 },
      hashes: { rawCardNums: hash, tsvCardNums: hash, normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(catalogRoot, 'cardCatalog.generated.ts'), `const decoy = { "num": "PR999" };\nexport const CARD_CATALOG: readonly CardDef[] = ${JSON.stringify(cardNums.map((num) => ({ num })), null, 2)};\nconst decoyAfter = { "num": "PR998" };\n`);

    const prior = loadPriorAuthority(projectRoot);

    expect(prior.fieldIndex).toEqual({
      schemaVersion: 1,
      bootstrap: true,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      cards: [
        { cardNum: 'B00001', updatedAt: null, fields: {} },
        { cardNum: 'B00002', updatedAt: null, fields: {} },
      ],
    });
    expect(JSON.stringify(prior)).not.toContain('Card one');
  });

  it('flags only existing printings updated after the bootstrap snapshot', () => {
    const { buildAuthorityDiffForPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const prior = {
      status: { source: { fetchedAt: '2026-01-01T00:00:00.000Z' } },
      fieldIndex: {
        bootstrap: true,
        cards: [
          { cardNum: 'B00001', fields: {}, updatedAt: null },
          { cardNum: 'B00002', fields: {}, updatedAt: null },
        ],
      },
      qaSnapshot: { items: [] },
    };
    const next = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00001', updatedAt: '2025-12-31T23:59:59.000Z', fields: { title: 'hash-1' } },
          { cardNum: 'B00002', updatedAt: '2026-01-01T00:00:01.000Z', fields: { title: 'hash-2' } },
          { cardNum: 'B00003', updatedAt: '2026-01-02T00:00:00.000Z', fields: { title: 'hash-3' } },
        ],
      },
      qaSnapshot: { items: [] },
    };

    expect(buildAuthorityDiffForPacket(prior, next)).toEqual({
      schemaVersion: 1,
      added: ['B00003'],
      removed: [],
      changedFields: [{ cardNum: 'B00002', fields: ['$bootstrap'] }],
      qaAdded: [],
      qaRemoved: [],
      qaAnswerChanged: [],
    });
  });

  it('rejects an invalid existing-printing timestamp during bootstrap review', () => {
    const { buildAuthorityDiffForPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const prior = {
      status: { source: { fetchedAt: '2026-01-01T00:00:00.000Z' } },
      fieldIndex: { bootstrap: true, cards: [{ cardNum: 'B00001', fields: {}, updatedAt: null }] },
      qaSnapshot: { items: [] },
    };
    const next = {
      fieldIndex: { cards: [{ cardNum: 'B00001', updatedAt: 'not-a-date', fields: { title: 'hash' } }] },
      qaSnapshot: { items: [] },
    };

    expect(() => buildAuthorityDiffForPacket(prior, next)).toThrow(/invalid updatedAt.*B00001/i);
  });

  it('rejects a tracked catalog whose card-number hash does not match status', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    const catalogRoot = join(projectRoot, 'meta-app', 'src', 'data');
    mkdirSync(cardsDataRoot, { recursive: true });
    mkdirSync(catalogRoot, { recursive: true });
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 1, tsv: 1 },
      hashes: { rawCardNums: '0'.repeat(64), tsvCardNums: '0'.repeat(64), normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(catalogRoot, 'cardCatalog.generated.ts'), 'export const CARD_CATALOG: readonly CardDef[] = [{ "num": "B00001" }];\n');

    expect(() => loadPriorAuthority(projectRoot)).toThrow(/catalog card-number hash/i);
  });

  it('rejects prior Q&A provenance that does not match tracked status', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    mkdirSync(cardsDataRoot, { recursive: true });
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 0, tsv: 0 },
      hashes: { rawCardNums: createHash('sha256').update('').digest('hex'), tsvCardNums: createHash('sha256').update('').digest('hex'), normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://example.invalid/cards', fetchedAt: '2025-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(cardsDataRoot, 'authority-field-index.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      cards: [],
    }));

    expect(() => loadPriorAuthority(projectRoot)).toThrow(/Q&A source.*status/i);
  });
});

describe('authority packet CLI', () => {
  function gitFixture(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = {
      '--show-toplevel': 'C:/repo\n',
      '--abbrev-ref': 'main\n',
      '--porcelain=v1': '',
      HEAD: 'a'.repeat(40) + '\n',
      'origin/main': 'a'.repeat(40) + '\n',
      ...overrides,
    };
    return (_command: string, args: string[]) => {
      const key = args.includes('--show-toplevel')
        ? '--show-toplevel'
        : args.includes('--abbrev-ref')
          ? '--abbrev-ref'
          : args.includes('--porcelain=v1')
            ? '--porcelain=v1'
            : args.at(-1)!;
      return values[key];
    };
  }

  it('accepts only clean synchronized main', () => {
    const { assertCleanSynchronizedMain } = require('../../scripts/cards/build-authority-packet.cjs');
    expect(() => assertCleanSynchronizedMain('C:/repo', gitFixture())).not.toThrow();
  });

  it.each([
    ['a dirty tree', { '--porcelain=v1': ' M file.ts\n' }, /must be clean/i],
    ['a non-main branch', { '--abbrev-ref': 'feature\n' }, /branch must be main/i],
    ['a divergent HEAD', { 'origin/main': 'b'.repeat(40) + '\n' }, /must equal origin\/main/i],
  ])('rejects %s before acquisition', (_name, overrides, error) => {
    const { assertCleanSynchronizedMain } = require('../../scripts/cards/build-authority-packet.cjs');
    expect(() => assertCleanSynchronizedMain('C:/repo', gitFixture(overrides))).toThrow(error);
  });

  it('registers the fail-closed packet command', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['cards:authority:packet']).toBe('node scripts/cards/build-authority-packet.cjs');
  });

  it('removes the packet if Git state changes during acquisition', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    let dirty = false;
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const changingGit = (command: string, args: string[]) => {
      if (args.includes('--porcelain=v1') && dirty) return ' M changed.ts\n';
      return git(command, args);
    };

    await expect(runAuthorityPacketCli({
      projectRoot,
      git: changingGit,
      tempBase: tmpdir(),
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        writeFileSync(join(packetRoot, 'packet.json'), '{}\n');
        dirty = true;
        return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
      },
    })).rejects.toThrow(/must be clean/i);
    expect(existsSync(packetRoot)).toBe(false);
  });

  it.each([
    ['dirty', { '--porcelain=v1': ' M changed.ts\n' }, /must be clean/i],
    ['non-main', { '--abbrev-ref': 'feature\n' }, /branch must be main/i],
    ['diverged', { 'origin/main': `${'b'.repeat(40)}\n` }, /must equal origin\/main/i],
  ])('stops a %s CLI preflight before prior reads, temp creation, or build', async (_name, overrides, error) => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    let sideEffects = 0;
    await expect(runAuthorityPacketCli({
      projectRoot: 'C:/repo',
      git: gitFixture(overrides),
      makeTemp: () => { sideEffects += 1; return tempDir(); },
      loadPrior: () => { sideEffects += 1; return {}; },
      build: async () => { sideEffects += 1; return {}; },
    })).rejects.toThrow(error);
    expect(sideEffects).toBe(0);
  });

  it('rejects a clean postflight HEAD change and removes the full failed packet tree', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    let headReads = 0;
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const changingHead = (command: string, args: string[]) => {
      if (args.length === 2 && args[0] === 'rev-parse' && args[1] === 'HEAD') {
        headReads += 1;
        return `${(headReads === 1 ? 'a' : 'b').repeat(40)}\n`;
      }
      if (args.length === 2 && args[0] === 'rev-parse' && args[1] === 'origin/main' && headReads > 1) return `${'b'.repeat(40)}\n`;
      return git(command, args);
    };

    await expect(runAuthorityPacketCli({
      projectRoot,
      git: changingHead,
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        mkdirSync(join(packetRoot, 'snapshot'));
        writeFileSync(join(packetRoot, 'snapshot', 'raw.json'), '{}');
        writeFileSync(join(packetRoot, 'packet.json'), '{}');
        return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
      },
    })).rejects.toThrow(/Git state changed during acquisition/i);
    expect(existsSync(packetRoot)).toBe(false);
  });

  it('never deletes a replacement directory after the admitted temp identity is swapped', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(victimRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });

    await expect(runAuthorityPacketCli({
      projectRoot,
      git,
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        renameSync(packetRoot, admittedRoot);
        renameSync(victimRoot, packetRoot);
        throw new Error('forced build failure after temp swap');
      },
    })).rejects.toThrow(/forced build failure/i);

    expect(readFileSync(join(packetRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects an empty victim swapped into the temp path during admission', () => {
    const { assertExternalEmptyTemp } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    let lstatCalls = 0;

    expect(() => assertExternalEmptyTemp(projectRoot, packetRoot, {
      lstat: (candidate: string) => {
        lstatCalls += 1;
        const stat = require('node:fs').lstatSync(candidate);
        if (lstatCalls === 1) {
          renameSync(packetRoot, admittedRoot);
          renameSync(victimRoot, packetRoot);
        }
        return stat;
      },
    })).toThrow(/identity changed during admission/i);
    expect(readdirSync(packetRoot)).toEqual([]);
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a direct packet build temp swapped during admission before network or regeneration', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    let lstatCalls = 0;
    let fetchCalls = 0;
    let regenerateCalls = 0;

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: {
        status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
        fieldIndex: { cards: [] },
        qaSnapshot: { items: [] },
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return officialResponse(officialPage([officialCard()]));
      },
      delay: async () => undefined,
      regenerate: async () => {
        regenerateCalls += 1;
      },
      tempAdmissionOperations: {
        lstat: (candidate: string) => {
          lstatCalls += 1;
          const stat = require('node:fs').lstatSync(candidate);
          if (lstatCalls === 1) {
            renameSync(packetRoot, admittedRoot);
            renameSync(victimRoot, packetRoot);
          }
          return stat;
        },
      },
    })).rejects.toThrow(/identity changed during admission/i);
    expect(fetchCalls).toBe(0);
    expect(regenerateCalls).toBe(0);
    expect(readdirSync(packetRoot)).toEqual([]);
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a default temporary base inside the project before build or filesystem mutation', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const previousTemp = process.env.TEMP;
    const previousTmp = process.env.TMP;
    let buildCalls = 0;
    process.env.TEMP = projectRoot;
    process.env.TMP = projectRoot;
    try {
      await expect(runAuthorityPacketCli({
        projectRoot,
        git,
        loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
        build: async () => {
          buildCalls += 1;
          return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
        },
      })).rejects.toThrow(/temporary base.*external/i);
    } finally {
      if (previousTemp === undefined) delete process.env.TEMP;
      else process.env.TEMP = previousTemp;
      if (previousTmp === undefined) delete process.env.TMP;
      else process.env.TMP = previousTmp;
    }
    expect(buildCalls).toBe(0);
    expect(readdirSync(projectRoot)).toEqual([]);
  });
});
