const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { regenerateAll } = require('../../.claude/specs/cards-data/_regen_all.cjs');
const { buildAuthorityDiff } = require('./authority-diff.cjs');
const { generateCardsDataStatus } = require('./cards-data-status.cjs');
const { fetchAllCards, OFFICIAL_CARDS_URL, packageCode, writeRawPackages } = require('./official-api.cjs');
const { compareOrdinal } = require('./qa-normalize.cjs');
const { buildQaHashSnapshot } = require('./write-qa-hash-snapshot.cjs');

const OFFICIAL_ORIGIN = 'https://www.takaratomy.co.jp';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_KEYS = ['data', 'lastPage', 'page', 'total'];
const CARD_KEYS = [
  'ap', 'card_id', 'card_num', 'category1', 'category2', 'category3', 'color', 'contain',
  'copyright', 'cost', 'created_at', 'cut_in', 'date', 'difficulty_first', 'difficulty_second',
  'drawing', 'feature', 'flavor_txt', 'henso', 'hirameki', 'id', 'illustrator', 'linkto', 'lp',
  'main_path', 'main_thumb', 'package', 'rarity', 'rcp_caution', 'rcp_limit', 'rcp_sameid_limit',
  'rcp_showhide', 'region', 'release_date', 'show_hide', 'sub_path', 'sub_thumb', 'title', 'type',
  'updated_at', 'q_a',
].sort(compareOrdinal);
const CARD_NUM = /^(?:B|D)\d{5}(?:P\d*|Sec\d+)?$|^PR\d{3}$/;
const OFFICIAL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort(compareOrdinal).map((key) => [key, stableValue(value[key])]),
  );
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} schema must be an object`);
  const actual = Object.keys(value).sort(compareOrdinal);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} schema keys changed`);
}

function isValidOfficialTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = OFFICIAL_TIMESTAMP.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const date = new Date(parsed);
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
}

function requestPage(url) {
  const parsed = new URL(url);
  const official = new URL(OFFICIAL_CARDS_URL);
  if (parsed.origin !== OFFICIAL_ORIGIN || parsed.pathname !== official.pathname) {
    throw new Error(`official card request escaped approved origin: ${url}`);
  }
  const page = Number(parsed.searchParams.get('page'));
  if (!Number.isInteger(page) || page < 1 || [...parsed.searchParams.keys()].some((key) => key !== 'page')) {
    throw new Error(`official card request has an invalid page: ${url}`);
  }
  return page;
}

function validateOfficialCard(card) {
  exactKeys(card, CARD_KEYS, 'official card');
  if (!Number.isInteger(card.id) || card.id < 1) throw new Error('official card schema has an invalid id');
  for (const [key, value] of Object.entries(card)) {
    if (key === 'id') continue;
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`official card schema has a non-scalar ${key}`);
    }
  }
  const cardNum = String(card.card_num ?? '').trim();
  if (!cardNum) throw new Error('official card schema has a missing card_num');
  if (!CARD_NUM.test(cardNum)) throw new Error(`official card schema has an invalid card_num: ${cardNum}`);
  for (const key of ['card_id', 'title', 'package', 'type', 'updated_at']) {
    if (typeof card[key] !== 'string' || !card[key].trim()) throw new Error(`official card schema has a missing ${key}`);
  }
  if (card.created_at !== null && !isValidOfficialTimestamp(card.created_at)) {
    throw new Error(`official card schema has an invalid created_at: ${cardNum}`);
  }
  if (!isValidOfficialTimestamp(card.updated_at)) {
    throw new Error(`official card schema has an invalid updated_at: ${cardNum}`);
  }
  packageCode(card.package);
  return card;
}

function validateOfficialCardSet(cards) {
  if (!Array.isArray(cards)) throw new Error('official card set must be an array');
  const seenCardNums = new Set();
  const seenIds = new Set();
  for (const card of cards) {
    validateOfficialCard(card);
    if (seenCardNums.has(card.card_num)) throw new Error(`duplicate card_num in official snapshot: ${card.card_num}`);
    if (seenIds.has(card.id)) throw new Error(`duplicate numeric id in official snapshot: ${card.id}`);
    seenCardNums.add(card.card_num);
    seenIds.add(card.id);
  }
  return cards;
}

function validateOfficialPage(payload, requestedPage) {
  exactKeys(payload, PAGE_KEYS, 'official card response');
  if (!Array.isArray(payload.data)) throw new Error('official card response schema data must be an array');
  if (!Number.isInteger(payload.total) || payload.total < 0) throw new Error('official card response schema total is invalid');
  if (!Number.isInteger(payload.lastPage) || payload.lastPage < 1 || payload.lastPage > 200) {
    throw new Error('official card response schema lastPage is invalid');
  }
  if (payload.page !== requestedPage || requestedPage > payload.lastPage) {
    throw new Error(`official card response page mismatch: expected ${requestedPage}, received ${payload.page}`);
  }
  payload.data.forEach(validateOfficialCard);
  return payload;
}

async function readStrictJson(url, response, maxResponseBytes) {
  if (!response || response.redirected || (response.status >= 300 && response.status < 400)) {
    throw new Error(`official card redirect is forbidden: ${url}`);
  }
  if (response.status !== 200 || !response.ok) throw new Error(`official card request failed: ${response?.status ?? 'no response'}`);
  if (response.url !== url) throw new Error(`official card response URL mismatch: ${response.url ?? 'missing URL'}`);
  const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) throw new Error(`official card content type is not JSON: ${contentType || 'missing'}`);
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength !== null && contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isInteger(declared) || declared < 0 || declared > maxResponseBytes) {
      throw new Error(`official card response exceeds byte limit: ${contentLength}`);
    }
  }
  if (typeof response.arrayBuffer !== 'function') throw new Error('official card response body is unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxResponseBytes) throw new Error(`official card response exceeds byte limit: ${bytes.byteLength}`);
  let payload;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('official card response body is invalid JSON');
  }
  return validateOfficialPage(payload, requestPage(url));
}

async function fetchOfficialCardsOnce({
  fetchImpl = globalThis.fetch,
  maxResponseBytes = MAX_RESPONSE_BYTES,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  delay,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('official card fetch implementation is required');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1) throw new Error('official card byte limit is invalid');
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new Error('official card timeout is invalid');
  const strictFetch = async (url) => {
    requestPage(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      const payload = await readStrictJson(url, response, maxResponseBytes);
      return { ok: true, status: 200, json: async () => payload };
    } finally {
      clearTimeout(timeout);
    }
  };
  const snapshot = await fetchAllCards({ fetchImpl: strictFetch, retries: 0, ...(delay ? { delay } : {}) });
  validateOfficialCardSet(snapshot.cards);
  const cards = [...snapshot.cards].sort((left, right) => compareOrdinal(left.card_num, right.card_num));
  return { ...snapshot, cards, digest: sha256(Buffer.from(stableJson(cards))) };
}

async function acquireStableOfficialCards(options = {}) {
  const first = await fetchOfficialCardsOnce(options);
  const second = await fetchOfficialCardsOnce(options);
  if (first.digest !== second.digest) throw new Error('official card catalog changed between acquisitions');
  return { ...first, acquisitionDigests: [first.digest, second.digest] };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(stableValue(value), null, 2)}\n`, 'utf8');
}

function buildAuthorityFieldIndex(cards, source) {
  if (!source || source.url !== OFFICIAL_CARDS_URL || !isValidOfficialTimestamp(source.fetchedAt)) {
    throw new Error('authority field index source is invalid');
  }
  validateOfficialCardSet(cards);
  const indexed = [...cards]
    .sort((left, right) => compareOrdinal(left.card_num, right.card_num))
    .map((card) => {
      const fields = Object.fromEntries(
        CARD_KEYS
          .filter((key) => key !== 'card_num')
          .map((key) => [key, sha256(Buffer.from(stableJson(card[key])))]),
      );
      return { cardNum: card.card_num, updatedAt: card.updated_at, fields };
    });
  return {
    schemaVersion: 1,
    source: { url: source.url, fetchedAt: source.fetchedAt },
    cards: indexed,
  };
}

function cardNumHash(cardNums) {
  return sha256(Buffer.from([...cardNums].sort(compareOrdinal).join('\n')));
}

function extractCatalogCardNums(source) {
  const text = String(source);
  const declaration = 'export const CARD_CATALOG: readonly CardDef[] = ';
  const start = text.indexOf(declaration);
  if (start < 0) throw new Error('tracked catalog export is missing');
  const valueStart = start + declaration.length;
  const valueEnd = text.indexOf(';', valueStart);
  if (valueEnd < 0) throw new Error('tracked catalog export is unterminated');
  let catalog;
  try {
    catalog = JSON.parse(text.slice(valueStart, valueEnd));
  } catch {
    throw new Error('tracked catalog export is not canonical JSON');
  }
  if (!Array.isArray(catalog)) throw new Error('tracked catalog export must be an array');
  const cardNums = catalog.map((card) => String(card?.num ?? '').trim());
  if (!cardNums.length) throw new Error('tracked catalog contains no card numbers');
  const seen = new Set();
  for (const cardNum of cardNums) {
    if (!CARD_NUM.test(cardNum)) throw new Error(`tracked catalog contains an invalid card number: ${cardNum}`);
    if (seen.has(cardNum)) throw new Error(`tracked catalog contains duplicate card number: ${cardNum}`);
    seen.add(cardNum);
  }
  return cardNums.sort(compareOrdinal);
}

function loadPriorAuthority(projectRoot) {
  const root = path.resolve(projectRoot);
  const cardsDataRoot = path.join(root, '.claude', 'specs', 'cards-data');
  const status = JSON.parse(fs.readFileSync(path.join(cardsDataRoot, 'status.json'), 'utf8'));
  const qaSnapshot = JSON.parse(fs.readFileSync(path.join(cardsDataRoot, 'qa-hash-snapshot.json'), 'utf8'));
  if (status.source?.url !== OFFICIAL_CARDS_URL || !isValidOfficialTimestamp(status.source?.fetchedAt)) {
    throw new Error('tracked authority status source is invalid');
  }
  if (status.hashes?.rawCardNums !== status.hashes?.tsvCardNums
    || status.printings?.raw !== status.printings?.tsv
    || status.hashes?.normalizedFaq !== qaSnapshot.normalizedFaqHash) {
    throw new Error('tracked authority status evidence does not match');
  }
  if (qaSnapshot.source?.url !== status.source.url
    || qaSnapshot.source?.fetchedAt !== status.source.fetchedAt
    || !isValidOfficialTimestamp(qaSnapshot.source?.fetchedAt)) {
    throw new Error('tracked authority Q&A source does not match status');
  }
  if (qaSnapshot.conflicts?.length) throw new Error('tracked authority contains a Q&A conflict');
  const fieldIndexPath = path.join(cardsDataRoot, 'authority-field-index.json');
  if (fs.existsSync(fieldIndexPath)) {
    const fieldIndex = JSON.parse(fs.readFileSync(fieldIndexPath, 'utf8'));
    validateFieldIndex(fieldIndex);
    if (fieldIndex.source.url !== status.source.url || fieldIndex.source.fetchedAt !== status.source.fetchedAt) {
      throw new Error('tracked authority field-index source does not match status');
    }
    const cardNums = fieldIndex.cards?.map((card) => card.cardNum) ?? [];
    if (cardNums.length !== status.printings.raw || cardNumHash(cardNums) !== status.hashes.rawCardNums) {
      throw new Error('tracked authority field-index card-number hash does not match status');
    }
    return { status, fieldIndex, qaSnapshot };
  }
  const catalog = fs.readFileSync(path.join(root, 'meta-app', 'src', 'data', 'cardCatalog.generated.ts'), 'utf8');
  const cardNums = extractCatalogCardNums(catalog);
  if (cardNums.length !== status.printings.raw || cardNumHash(cardNums) !== status.hashes.rawCardNums) {
    throw new Error('tracked catalog card-number hash does not match status');
  }
  return {
    status,
    fieldIndex: {
      schemaVersion: 1,
      bootstrap: true,
      source: { url: status.source.url, fetchedAt: status.source.fetchedAt },
      cards: cardNums.map((cardNum) => ({ cardNum, updatedAt: null, fields: {} })),
    },
    qaSnapshot,
  };
}

function buildAuthorityDiffForPacket(prior, next) {
  if (!prior?.fieldIndex?.bootstrap) return buildAuthorityDiff(prior, next);
  const priorFetchedAt = prior.status?.source?.fetchedAt ?? prior.fieldIndex.source?.fetchedAt;
  if (!isValidOfficialTimestamp(priorFetchedAt)) throw new Error('bootstrap authority fetchedAt is invalid');
  const fetchedAt = Date.parse(priorFetchedAt);
  const nextByCard = new Map((next.fieldIndex?.cards ?? []).map((card) => [card.cardNum, card]));
  const effectivePriorCards = [];
  const effectiveNextCards = (next.fieldIndex?.cards ?? []).map((card) => ({ ...card, fields: { ...card.fields } }));
  const effectiveNextByCard = new Map(effectiveNextCards.map((card) => [card.cardNum, card]));
  for (const card of prior.fieldIndex.cards ?? []) {
    const nextCard = nextByCard.get(card.cardNum);
    if (!nextCard) {
      effectivePriorCards.push(card);
      continue;
    }
    if (!isValidOfficialTimestamp(nextCard.updatedAt)) throw new Error(`bootstrap authority card has invalid updatedAt: ${card.cardNum}`);
    const updatedAt = Date.parse(nextCard.updatedAt);
    const updatedAfterSnapshot = updatedAt > fetchedAt;
    effectivePriorCards.push({
      ...card,
      fields: updatedAfterSnapshot ? { ...nextCard.fields, $bootstrap: 'prior' } : { ...nextCard.fields },
    });
    if (updatedAfterSnapshot) effectiveNextByCard.get(card.cardNum).fields.$bootstrap = 'next';
  }
  return buildAuthorityDiff(
    { ...prior, fieldIndex: { ...prior.fieldIndex, cards: effectivePriorCards } },
    { ...next, fieldIndex: { ...next.fieldIndex, cards: effectiveNextCards } },
  );
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function assertPlainDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a plain directory`);
}

function admitPlainDirectory(directory, label, {
  lstat = fs.lstatSync,
  realpath = fs.realpathSync.native,
  readdir = fs.readdirSync,
  requireEmpty = false,
  validateResolved,
} = {}) {
  const absolute = path.resolve(directory);
  const before = lstat(absolute);
  if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`${label} must be a plain directory`);
  const resolved = realpath(absolute);
  validateResolved?.(resolved);
  if (requireEmpty && readdir(resolved).length !== 0) throw new Error(`${label} must be empty`);
  const after = lstat(absolute);
  if (!after.isDirectory() || after.isSymbolicLink()
    || after.dev !== before.dev || after.ino !== before.ino
    || realpath(absolute) !== resolved) {
    throw new Error(`${label} identity changed during admission`);
  }
  return { resolved, device: after.dev, inode: after.ino };
}

function pathsOverlap(left, right) {
  return left === right || isWithin(left, right) || isWithin(right, left);
}

function assertEmptyExternalTemp(projectRoot, tempRoot, operations = {}) {
  const projectPin = admitPlainDirectory(projectRoot, 'authority project root');
  const temporaryPin = admitPlainDirectory(tempRoot, 'authority temporary root', {
    ...operations,
    requireEmpty: true,
    validateResolved: (temporary) => {
      if (pathsOverlap(projectPin.resolved, temporary)) {
        throw new Error('authority temporary root must be external to the project');
      }
    },
  });
  return {
    project: projectPin.resolved,
    temporary: temporaryPin.resolved,
    device: temporaryPin.device,
    inode: temporaryPin.inode,
  };
}

function assertPinnedTemp(pin) {
  assertPlainDirectory(pin.temporary, 'authority temporary root');
  const stat = fs.lstatSync(pin.temporary);
  if (fs.realpathSync.native(pin.temporary) !== pin.temporary || stat.dev !== pin.device || stat.ino !== pin.inode) {
    throw new Error('authority temporary root identity changed');
  }
}

function removePinnedDirectory(pin) {
  if (!pin || !fs.existsSync(pin.temporary)) return false;
  const stat = fs.lstatSync(pin.temporary);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || stat.dev !== pin.device || stat.ino !== pin.inode
    || fs.realpathSync.native(pin.temporary) !== pin.temporary) return false;
  fs.rmSync(pin.temporary, { recursive: true, force: true });
  return true;
}

function removePinnedFile(pin, relativePath) {
  try {
    assertPinnedTemp(pin);
  } catch {
    return false;
  }
  fs.rmSync(path.join(pin.temporary, relativePath), { force: true });
  return true;
}

function collectArtifacts(root, current = root) {
  const artifacts = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => compareOrdinal(a.name, b.name))) {
    const absolute = path.join(current, entry.name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`authority artifact must not be a symlink: ${absolute}`);
    if (stat.isDirectory()) {
      const resolved = fs.realpathSync.native(absolute);
      if (!isWithin(fs.realpathSync.native(root), resolved)) throw new Error(`authority artifact escaped packet root: ${absolute}`);
      artifacts.push(...collectArtifacts(root, absolute));
      continue;
    }
    if (!stat.isFile()) throw new Error(`authority artifact must be a regular file: ${absolute}`);
    const bytes = fs.readFileSync(absolute);
    artifacts.push({
      path: path.relative(root, absolute).split(path.sep).join('/'),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
  }
  return artifacts.sort((left, right) => compareOrdinal(left.path, right.path));
}

function exactArtifactFiles(packetRoot) {
  return collectArtifacts(packetRoot).filter((entry) => entry.path !== 'packet.json');
}

function validationTempRoot(
  projectRoot,
  packetRoot,
  makeTemp = (prefix) => fs.mkdtempSync(prefix),
  admissionOperations = {},
) {
  const projectPin = admitPlainDirectory(projectRoot, 'authority project root');
  const packetPin = admitPlainDirectory(packetRoot, 'authority packet root');
  const basePin = admitPlainDirectory(os.tmpdir(), 'authority validation temporary base', {
    validateResolved: (base) => {
      if ([projectPin.resolved, packetPin.resolved].some((forbidden) => base === forbidden || isWithin(forbidden, base))) {
        throw new Error('authority validation temporary root must be external to the project and packet');
      }
    },
  });
  const validationRoot = makeTemp(path.join(basePin.resolved, 'conan-authority-tsv-verify-'));
  const validationPin = admitPlainDirectory(validationRoot, 'authority validation temporary root', {
    ...admissionOperations,
    requireEmpty: true,
    validateResolved: (validation) => {
      if ([projectPin.resolved, packetPin.resolved].some((forbidden) => pathsOverlap(forbidden, validation))) {
        throw new Error('authority validation temporary root must be external to the project and packet');
      }
    },
  });
  return {
    temporary: validationPin.resolved,
    device: validationPin.device,
    inode: validationPin.inode,
  };
}

function validateTsvArtifactsAgainstRaw(projectRoot, packetRoot, rawCards, packetArtifacts, {
  admissionOperations,
  makeTemp,
  regenerate = regenerateAll,
} = {}) {
  const pin = validationTempRoot(projectRoot, packetRoot, makeTemp, admissionOperations);
  const validationPath = pin.temporary;
  try {
    const cardsDataRoot = path.join(validationPath, 'snapshot', '.claude', 'specs', 'cards-data');
    const rawRoot = path.join(cardsDataRoot, '_raw');
    writeRawPackages(rawCards, rawRoot);
    regenerate({ baseDir: cardsDataRoot, rawDir: rawRoot });
    assertPinnedTemp(pin);

    const generated = collectArtifacts(validationPath).filter((entry) => entry.path.endsWith('.tsv'));
    const supplied = packetArtifacts.filter((entry) => entry.path.endsWith('.tsv'));
    if (stableJson(generated) !== stableJson(supplied)) {
      throw new Error('authority TSV artifacts do not match raw artifacts');
    }
    for (const entry of generated) {
      const relative = entry.path.split('/');
      const expected = fs.readFileSync(path.join(validationPath, ...relative));
      const actual = fs.readFileSync(path.join(packetRoot, ...relative));
      if (!actual.equals(expected)) throw new Error('authority TSV artifacts do not match raw artifacts');
    }
    assertPinnedTemp(pin);
  } finally {
    removePinnedDirectory(pin);
  }
}

function isAllowedArtifactPath(value) {
  const prefix = 'snapshot/.claude/specs/cards-data/';
  if (!value.startsWith(prefix)) return false;
  const relative = value.slice(prefix.length);
  if (['status.json', 'qa-hash-snapshot.json', 'authority-field-index.json'].includes(relative)) return true;
  if (/^_raw\/(?:ct-(?:d|p)\d{2}|pr-\d{2})-api\.json$/.test(relative)) return true;
  return /^(?:ct-(?:d|p)\d{2}|pr-\d{2})\/(?:partner|character|event|case)\.tsv$/.test(relative);
}

function validateFieldIndex(fieldIndex, { allowBootstrap = false } = {}) {
  const expectedKeys = allowBootstrap && fieldIndex?.bootstrap
    ? ['bootstrap', 'cards', 'schemaVersion', 'source']
    : ['cards', 'schemaVersion', 'source'];
  exactKeys(fieldIndex, expectedKeys, 'authority field index');
  if (fieldIndex.schemaVersion !== 1 || !Array.isArray(fieldIndex.cards)) throw new Error('authority field index schema is invalid');
  exactKeys(fieldIndex.source, ['fetchedAt', 'url'], 'authority field index source');
  if (fieldIndex.source.url !== OFFICIAL_CARDS_URL || !isValidOfficialTimestamp(fieldIndex.source.fetchedAt)) {
    throw new Error('authority field index source is invalid');
  }
  const seen = new Set();
  const expectedFields = CARD_KEYS.filter((key) => key !== 'card_num');
  for (const card of fieldIndex.cards) {
    exactKeys(card, ['cardNum', 'fields', 'updatedAt'], 'authority field index card');
    if (!CARD_NUM.test(card.cardNum) || seen.has(card.cardNum)) throw new Error(`authority field index card is invalid: ${card.cardNum}`);
    seen.add(card.cardNum);
    if (fieldIndex.bootstrap) {
      if (card.updatedAt !== null || Object.keys(card.fields).length !== 0) throw new Error(`bootstrap authority field card is invalid: ${card.cardNum}`);
    } else {
      if (!isValidOfficialTimestamp(card.updatedAt)) throw new Error(`authority field index updatedAt is invalid: ${card.cardNum}`);
      exactKeys(card.fields, expectedFields, `authority field index fields ${card.cardNum}`);
      if (Object.values(card.fields).some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
        throw new Error(`authority field index digest is invalid: ${card.cardNum}`);
      }
    }
  }
  const sorted = [...fieldIndex.cards].sort((left, right) => compareOrdinal(left.cardNum, right.cardNum));
  if (stableJson(sorted) !== stableJson(fieldIndex.cards)) throw new Error('authority field index cards must be sorted');
}

function authorityPriorDigest(prior) {
  return sha256(Buffer.from(stableJson({
    status: prior?.status,
    fieldIndex: prior?.fieldIndex,
    qaSnapshot: prior?.qaSnapshot,
  })));
}

function validateAuthorityPacket(packet, prior, {
  packetRoot,
  projectRoot,
  validationAdmissionOperations,
  validationMakeTemp,
  validationRegenerate,
} = {}) {
  if (!packetRoot || !projectRoot) throw new Error('authority packet root and project root are required');
  exactKeys(packet, ['artifacts', 'basis', 'diff', 'fieldIndex', 'qaSnapshot', 'schemaVersion', 'source', 'sourceDigests', 'state', 'status'], 'authority packet');
  if (!packet || packet.schemaVersion !== 1 || packet.state !== 'acquired') throw new Error('authority packet schema is invalid');
  exactKeys(packet.source, ['fetchedAt', 'url'], 'authority packet source');
  if (packet.source?.url !== OFFICIAL_CARDS_URL || !isValidOfficialTimestamp(packet.source?.fetchedAt)) {
    throw new Error('authority packet source is invalid');
  }
  exactKeys(packet.basis, ['priorDigest', 'releaseCommit'], 'authority packet basis');
  if (!/^[a-f0-9]{40}$/.test(packet.basis?.releaseCommit)
    || packet.basis?.priorDigest !== authorityPriorDigest(prior)) {
    throw new Error('authority packet basis does not match prior authority');
  }
  exactKeys(packet.sourceDigests, ['acquisitions', 'officialCards'], 'authority packet source digests');
  if (!Array.isArray(packet.sourceDigests?.acquisitions)
    || packet.sourceDigests.acquisitions.length !== 2
    || packet.sourceDigests.acquisitions.some((digest) => digest !== packet.sourceDigests.officialCards)) {
    throw new Error('authority packet acquisitions do not match');
  }
  if (!/^[a-f0-9]{64}$/.test(packet.sourceDigests.officialCards)) throw new Error('authority packet source digest is invalid');
  if (packet.status?.hashes?.rawCardNums !== packet.status?.hashes?.tsvCardNums
    || packet.status?.printings?.raw !== packet.status?.printings?.tsv) {
    throw new Error('authority packet raw/TSV evidence does not match');
  }
  if (packet.status?.hashes?.normalizedFaq !== packet.qaSnapshot?.normalizedFaqHash) {
    throw new Error('authority packet Q&A evidence does not match');
  }
  if (!Array.isArray(packet.qaSnapshot?.conflicts) || packet.qaSnapshot.conflicts.length !== 0) {
    throw new Error('authority packet contains a Q&A conflict');
  }
  validateFieldIndex(packet.fieldIndex);
  const expectedDiff = buildAuthorityDiffForPacket(prior, packet);
  if (stableJson(expectedDiff) !== stableJson(packet.diff)) throw new Error('authority packet diff does not match evidence');
  if (!Array.isArray(packet.artifacts) || packet.artifacts.length < 3 || packet.artifacts.some((entry) => {
    try {
      exactKeys(entry, ['bytes', 'path', 'sha256'], 'authority packet artifact');
    } catch {
      return true;
    }
    return !entry.path || entry.path.startsWith('../') || path.isAbsolute(entry.path)
      || !isAllowedArtifactPath(entry.path)
      || !Number.isInteger(entry.bytes) || entry.bytes < 0
      || !/^[a-f0-9]{64}$/.test(entry.sha256);
  })) {
    throw new Error('authority packet artifact path is invalid');
  }
  const sortedPaths = packet.artifacts.map((entry) => entry.path).sort(compareOrdinal);
  if (new Set(sortedPaths).size !== sortedPaths.length || stableJson(sortedPaths) !== stableJson(packet.artifacts.map((entry) => entry.path))) {
    throw new Error('authority packet artifacts must be unique and sorted');
  }
  const root = fs.realpathSync.native(path.resolve(packetRoot));
  assertPlainDirectory(root, 'authority packet root');
  const project = fs.realpathSync.native(path.resolve(projectRoot));
  assertPlainDirectory(project, 'authority project root');
  if (root === project || isWithin(project, root) || isWithin(root, project)) {
    throw new Error('authority packet root must be external to the project');
  }
  const actual = exactArtifactFiles(root);
  if (stableJson(actual) !== stableJson(packet.artifacts)) throw new Error('authority packet artifact bytes changed');
  const dataRoot = path.join(root, 'snapshot');
  const cardsDataRoot = path.join(dataRoot, '.claude', 'specs', 'cards-data');
  const readArtifactJson = (name) => JSON.parse(fs.readFileSync(path.join(cardsDataRoot, name), 'utf8'));
  const artifactStatus = readArtifactJson('status.json');
  const artifactQa = readArtifactJson('qa-hash-snapshot.json');
  const artifactFieldIndex = readArtifactJson('authority-field-index.json');
  if (stableJson(artifactStatus) !== stableJson(packet.status)
    || stableJson(artifactQa) !== stableJson(packet.qaSnapshot)
    || stableJson(artifactFieldIndex) !== stableJson(packet.fieldIndex)) {
    throw new Error('authority packet metadata is not bound to artifacts');
  }
  const rawRoot = path.join(cardsDataRoot, '_raw');
  const rawCards = [];
  for (const file of fs.readdirSync(rawRoot).filter((name) => name.endsWith('-api.json')).sort(compareOrdinal)) {
    const raw = JSON.parse(fs.readFileSync(path.join(rawRoot, file), 'utf8'));
    if (!raw || Object.keys(raw).length !== 1 || !Array.isArray(raw.data)) throw new Error(`authority raw artifact schema changed: ${file}`);
    const expectedPackage = file.replace(/-api\.json$/, '').toLowerCase();
    for (const card of raw.data) {
      const actualPackage = packageCode(card?.package).toLowerCase();
      if (actualPackage !== expectedPackage) {
        throw new Error(`authority raw package ${expectedPackage} contains card from ${actualPackage}`);
      }
    }
    rawCards.push(...raw.data);
  }
  validateOfficialCardSet(rawCards);
  rawCards.sort((left, right) => compareOrdinal(left.card_num, right.card_num));
  const rawDigest = sha256(Buffer.from(stableJson(rawCards)));
  if (rawDigest !== packet.sourceDigests.officialCards) throw new Error('authority raw artifacts do not match source digest');
  validateTsvArtifactsAgainstRaw(project, root, rawCards, packet.artifacts, {
    admissionOperations: validationAdmissionOperations,
    makeTemp: validationMakeTemp,
    regenerate: validationRegenerate,
  });
  const recomputedStatus = generateCardsDataStatus(dataRoot, packet.source);
  const recomputedQa = buildQaHashSnapshot(dataRoot);
  const recomputedFieldIndex = buildAuthorityFieldIndex(rawCards, packet.source);
  if (stableJson(recomputedStatus) !== stableJson(packet.status)
    || stableJson(recomputedQa) !== stableJson(packet.qaSnapshot)
    || stableJson(recomputedFieldIndex) !== stableJson(packet.fieldIndex)) {
    throw new Error('authority packet metadata does not match raw artifacts');
  }
  const packetFile = path.join(root, 'packet.json');
  if (fs.existsSync(packetFile)) {
    const writtenPacket = JSON.parse(fs.readFileSync(packetFile, 'utf8'));
    if (stableJson(writtenPacket) !== stableJson(packet)) throw new Error('authority packet file does not match validated packet');
  }
  return packet;
}

function authorityReviewDigest(packet) {
  return sha256(Buffer.from(stableJson({
    artifacts: packet.artifacts,
    source: packet.source,
    basis: packet.basis,
    sourceDigests: packet.sourceDigests,
    diff: packet.diff,
    normalizedFaqHash: packet.qaSnapshot?.normalizedFaqHash,
  })));
}

function validatePublishableAuthorityPacket(packet, prior, dispositions = [], options = {}) {
  validateAuthorityPacket(packet, prior, options);
  const reviewDigest = authorityReviewDigest(packet);
  const approved = new Set(dispositions.map((entry) => {
    exactKeys(entry, ['identity', 'kind', 'packetDigest'], 'authority disposition');
    if (!['added', 'removed', 'changed', 'qa'].includes(entry.kind) || typeof entry.identity !== 'string' || !entry.identity) {
      throw new Error('authority disposition schema is invalid');
    }
    if (entry.packetDigest !== reviewDigest) throw new Error(`authority disposition digest mismatch: ${entry.identity ?? 'missing'}`);
    return `${entry.kind}:${entry.identity}`;
  }));
  if (approved.size !== dispositions.length) throw new Error('duplicate authority disposition');
  const used = new Set();
  for (const cardNum of packet.diff.removed) {
    if (!approved.has(`removed:${cardNum}`)) throw new Error(`removed printing ${cardNum} is not approved`);
    used.add(`removed:${cardNum}`);
  }
  for (const cardNum of packet.diff.added) {
    if (!approved.has(`added:${cardNum}`)) throw new Error(`unreviewed added printing ${cardNum}`);
    used.add(`added:${cardNum}`);
  }
  for (const change of packet.diff.changedFields) {
    if (!approved.has(`changed:${change.cardNum}`)) {
      throw new Error(`unreviewed card change ${change.cardNum}: ${change.fields.join(', ')}`);
    }
    used.add(`changed:${change.cardNum}`);
  }
  for (const qaId of [...packet.diff.qaAdded, ...packet.diff.qaRemoved, ...packet.diff.qaAnswerChanged]) {
    if (!approved.has(`qa:${qaId}`)) throw new Error(`unreviewed Q&A change ${qaId}`);
    used.add(`qa:${qaId}`);
  }
  if ([...approved].some((key) => !used.has(key))) throw new Error('authority disposition does not match a packet change');
  return packet;
}

async function buildAuthorityPacket({
  projectRoot,
  tempRoot,
  fetchedAt,
  releaseCommit,
  prior,
  fetchImpl,
  delay,
  regenerate = regenerateAll,
  tempAdmissionOperations,
} = {}) {
  const pin = assertEmptyExternalTemp(projectRoot, tempRoot, tempAdmissionOperations);
  const { temporary } = pin;
  if (!isValidOfficialTimestamp(fetchedAt)) throw new Error('authority packet fetchedAt is invalid');
  if (!/^[a-f0-9]{40}$/.test(releaseCommit)) throw new Error('authority packet releaseCommit is invalid');
  const effectivePrior = prior ?? loadPriorAuthority(projectRoot);
  const acquisition = await acquireStableOfficialCards({ fetchImpl, delay });
  assertPinnedTemp(pin);
  const dataRoot = path.join(temporary, 'snapshot');
  const cardsDataRoot = path.join(dataRoot, '.claude', 'specs', 'cards-data');
  const rawRoot = path.join(cardsDataRoot, '_raw');
  fs.mkdirSync(cardsDataRoot, { recursive: true });
  assertPinnedTemp(pin);
  writeRawPackages(acquisition.cards, rawRoot);
  await regenerate({ baseDir: cardsDataRoot, rawDir: rawRoot });
  assertPinnedTemp(pin);
  const source = { url: OFFICIAL_CARDS_URL, fetchedAt };
  const status = generateCardsDataStatus(dataRoot, source);
  writeJson(path.join(cardsDataRoot, 'status.json'), status);
  const qaSnapshot = buildQaHashSnapshot(dataRoot);
  if (qaSnapshot.conflicts.length) throw new Error(`Q&A conflict: ${qaSnapshot.conflicts[0].qaId}`);
  writeJson(path.join(cardsDataRoot, 'qa-hash-snapshot.json'), qaSnapshot);
  const fieldIndex = buildAuthorityFieldIndex(acquisition.cards, source);
  writeJson(path.join(cardsDataRoot, 'authority-field-index.json'), fieldIndex);
  const packet = {
    schemaVersion: 1,
    state: 'acquired',
    source,
    basis: { releaseCommit, priorDigest: authorityPriorDigest(effectivePrior) },
    status,
    qaSnapshot,
    fieldIndex,
    diff: buildAuthorityDiffForPacket(effectivePrior, { fieldIndex, qaSnapshot }),
    sourceDigests: {
      officialCards: acquisition.digest,
      acquisitions: acquisition.acquisitionDigests,
    },
    artifacts: exactArtifactFiles(temporary),
  };
  assertPinnedTemp(pin);
  validateAuthorityPacket(packet, effectivePrior, { packetRoot: temporary, projectRoot });
  const packetFile = path.join(temporary, 'packet.json');
  try {
    writeJson(packetFile, packet);
    assertPinnedTemp(pin);
    validateAuthorityPacket(packet, effectivePrior, { packetRoot: temporary, projectRoot });
  } catch (error) {
    removePinnedFile(pin, 'packet.json');
    throw error;
  }
  return packet;
}

module.exports = {
  CARD_KEYS,
  acquireStableOfficialCards,
  authorityReviewDigest,
  buildAuthorityFieldIndex,
  buildAuthorityDiffForPacket,
  buildAuthorityPacket,
  fetchOfficialCardsOnce,
  loadPriorAuthority,
  stableJson,
  validateAuthorityPacket,
  validateOfficialCard,
  validateOfficialCardSet,
  validateOfficialPage,
  validatePublishableAuthorityPacket,
};
