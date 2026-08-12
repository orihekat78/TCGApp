// Converts ignored official Q&A source into the tracked, hash-only input used by docs.
// It never writes question or answer bodies.
const fs = require('node:fs');
const path = require('node:path');
const { normalizedFaqMetadata, normalizedFaqMetadataFromBaseDir } = require('./cards-data-status.cjs');
const { sha256, compareOrdinal } = require('./qa-normalize.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const STATUS = path.join(ROOT, '.claude', 'specs', 'cards-data', 'status.json');

function normalizedFaqHash(corpus) {
  return sha256(JSON.stringify(corpus));
}

function assertStatusMatchesCorpus(status, corpus) {
  if (!status.source || typeof status.source.url !== 'string' || !status.source.url.trim() || typeof status.source.fetchedAt !== 'string' || !status.source.fetchedAt.trim()) {
    throw new Error('cards-data status must contain source URL and fetchedAt');
  }
  const expected = status.hashes?.normalizedFaq;
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('cards-data status must contain normalized FAQ hash');
  }
  const actual = normalizedFaqHash(corpus);
  if (actual !== expected) throw new Error(`normalized FAQ hash mismatch: status=${expected} raw=${actual}`);
  return actual;
}

function buildQaHashSnapshot(root = ROOT) {
  const corpus = normalizedFaqMetadata(root);
  const status = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'specs', 'cards-data', 'status.json'), 'utf8'));
  const aggregateHash = assertStatusMatchesCorpus(status, corpus);
  return {
    schemaVersion: 1,
    source: { url: status.source.url, fetchedAt: status.source.fetchedAt },
    normalizedFaqHash: aggregateHash,
    items: corpus.items.map((item) => ({
      qaId: item.qaId,
      cardId: item.cardId,
      cardNums: [...item.cardNums].sort(compareOrdinal),
      sectionHash: sha256(item.section),
      questionHash: item.questionHash,
      answerHash: item.answerHash,
    })).sort((a, b) => compareOrdinal(a.qaId, b.qaId)),
    conflicts: corpus.conflicts.map((conflict) => ({
      qaId: conflict.qaId,
      cardId: conflict.cardId,
      cardNums: [...conflict.cardNums].sort(compareOrdinal),
      answerHashes: [...conflict.answerHashes].sort(compareOrdinal),
    })).sort((a, b) => compareOrdinal(a.qaId, b.qaId)),
  };
}

function buildQaHashSnapshotFromBaseDir(baseDir) {
  const corpus = normalizedFaqMetadataFromBaseDir(baseDir);
  const status = JSON.parse(fs.readFileSync(path.join(baseDir, 'status.json'), 'utf8'));
  const aggregateHash = assertStatusMatchesCorpus(status, corpus);
  return {
    schemaVersion: 1,
    source: { url: status.source.url, fetchedAt: status.source.fetchedAt },
    normalizedFaqHash: aggregateHash,
    items: corpus.items.map((item) => ({
      qaId: item.qaId,
      cardId: item.cardId,
      cardNums: [...item.cardNums].sort(compareOrdinal),
      sectionHash: sha256(item.section),
      questionHash: item.questionHash,
      answerHash: item.answerHash,
    })).sort((a, b) => compareOrdinal(a.qaId, b.qaId)),
    conflicts: corpus.conflicts.map((conflict) => ({
      qaId: conflict.qaId,
      cardId: conflict.cardId,
      cardNums: [...conflict.cardNums].sort(compareOrdinal),
      answerHashes: [...conflict.answerHashes].sort(compareOrdinal),
    })).sort((a, b) => compareOrdinal(a.qaId, b.qaId)),
  };
}

function writeQaHashSnapshotToBaseDir(baseDir) {
  const snapshot = buildQaHashSnapshotFromBaseDir(baseDir);
  fs.writeFileSync(path.join(baseDir, 'qa-hash-snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return snapshot;
}

function writeQaHashSnapshotLocked(root = ROOT, options = {}) {
  const baseDir = path.join(root, '.claude', 'specs', 'cards-data');
  const {
    mutateCardsDataRoot,
  } = require('./official-api.cjs');
  const mutation = mutateCardsDataRoot({
    baseDir,
    mutate: ({ baseDir: stagedBaseDir }) => writeQaHashSnapshotToBaseDir(stagedBaseDir),
    ...(options.renameSync ? { renameSync: options.renameSync } : {}),
    ...(options.rmSync ? { rmSync: options.rmSync } : {}),
    ...(options.hooks ? { hooks: options.hooks } : {}),
  });
  return {
    snapshot: mutation.value,
    lockCleanupPending: mutation.lockCleanupPending ?? false,
    cleanupPending: mutation.cleanupPending,
  };
}

if (require.main === module) {
  const { snapshot, lockCleanupPending } = writeQaHashSnapshotLocked();
  process.stdout.write(`wrote ${snapshot.items.length} hash-only Q&A items\n`);
  if (lockCleanupPending) process.stderr.write('Q&A snapshot committed; cards-data write-lock cleanup is pending\n');
}

module.exports = {
  assertStatusMatchesCorpus,
  buildQaHashSnapshot,
  buildQaHashSnapshotFromBaseDir,
  normalizedFaqHash,
  writeQaHashSnapshotLocked,
  STATUS,
};
