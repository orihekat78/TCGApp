const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const OFFICIAL_CARDS_URL =
  "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards";
const PACKAGE_CODE = /^(CT-(?:D|P)\d{2}|PR-\d{2})\b/;
const PACKAGE_DIRECTORY = /^(?:ct-(?:d|p)\d{2}|pr-\d{2})$/;

function packageCode(packageName) {
  if (packageName === "PRカード") return "PR-01";
  const match = typeof packageName === "string" && packageName.match(PACKAGE_CODE);
  if (!match) throw new Error(`invalid official package: ${packageName}`);
  return match[1];
}

function validatePage(payload) {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("invalid official card response: data must be an array");
  }
  if (!Number.isInteger(payload.total) || payload.total < 0) {
    throw new Error("invalid official card response: total must be a non-negative integer");
  }
  if (!Number.isInteger(payload.lastPage) || payload.lastPage < 1) {
    throw new Error("invalid official card response: lastPage must be a positive integer");
  }
  return payload;
}

async function fetchJson(url, fetchImpl, retries) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      if (!response || !response.ok) {
        throw new Error(`official card request failed: ${response?.status ?? "no response"}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function pageUrl(page) {
  const url = new URL(OFFICIAL_CARDS_URL);
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchAllCards({
  fetchImpl = globalThis.fetch,
  retries = 2,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("official card fetch implementation is required");
  if (!Number.isInteger(retries) || retries < 0) throw new Error("retries must be a non-negative integer");

  const first = validatePage(await fetchJson(pageUrl(1), fetchImpl, retries));
  const cards = [...first.data];
  for (let page = 2; page <= first.lastPage; page += 1) {
    await delay(300);
    const next = validatePage(await fetchJson(pageUrl(page), fetchImpl, retries));
    if (next.total !== first.total || next.lastPage !== first.lastPage) {
      throw new Error("official card pagination metadata changed during fetch");
    }
    cards.push(...next.data);
  }
  if (cards.length !== first.total) {
    throw new Error(`official card count mismatch: expected ${first.total}, received ${cards.length}`);
  }
  return { total: first.total, lastPage: first.lastPage, cards };
}

function groupByPackage(cards) {
  const groups = new Map();
  for (const card of cards) {
    const code = packageCode(card?.package);
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(card);
  }
  return groups;
}

function writeRawPackages(cards, outputDir) {
  const groups = groupByPackage(cards);
  const parentDir = path.dirname(outputDir);
  fs.mkdirSync(parentDir, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(outputDir)}.tmp-`));
  const backupDir = `${outputDir}.backup-${process.pid}`;
  const written = [];
  let movedExisting = false;
  try {
    for (const [code, packageCards] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const filename = `${code.toLowerCase()}-api.json`;
      fs.writeFileSync(path.join(tempDir, filename), `${JSON.stringify({ data: packageCards }, null, 2)}\n`, "utf8");
      written.push(filename);
    }
    if (fs.existsSync(outputDir)) {
      fs.renameSync(outputDir, backupDir);
      movedExisting = true;
    }
    fs.renameSync(tempDir, outputDir);
    if (movedExisting) fs.rmSync(backupDir, { recursive: true, force: true });
    return written;
  } catch (error) {
    if (movedExisting && !fs.existsSync(outputDir) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, outputDir);
    }
    throw error;
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function packageDirectories(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PACKAGE_DIRECTORY.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function transactionDirectory(baseDir) {
  const resolvedBaseDir = path.resolve(baseDir);
  return path.join(path.dirname(resolvedBaseDir), `.${path.basename(resolvedBaseDir)}.transactions`);
}

function assertPlainDirectory(target, label) {
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`unsafe cards-data ${label}: ${target}`);
  }
}

function assertManagedRootPath(baseDir, target, kind) {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedTarget = path.resolve(target);
  const parentDir = path.dirname(resolvedBaseDir);
  const expectedPrefix = `.${path.basename(resolvedBaseDir)}.${kind}-`;
  if (path.dirname(resolvedTarget) !== parentDir || !path.basename(resolvedTarget).startsWith(expectedPrefix)) {
    throw new Error(`unsafe cards-data transaction ${kind} path: ${target}`);
  }
  if (fs.existsSync(resolvedTarget)) assertPlainDirectory(resolvedTarget, `transaction ${kind}`);
  return resolvedTarget;
}

function assertBaseRoot(baseDir) {
  const resolvedBaseDir = path.resolve(baseDir);
  if (fs.existsSync(resolvedBaseDir)) assertPlainDirectory(resolvedBaseDir, "base root");
  return resolvedBaseDir;
}

function assertJournalDirectory(baseDir) {
  const directory = transactionDirectory(baseDir);
  if (fs.existsSync(directory)) assertPlainDirectory(directory, "transaction journal directory");
  return directory;
}

function writeTransaction(journalPath, transaction) {
  const tempPath = `${journalPath}.tmp-${randomUUID()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(transaction)}\n`, "utf8");
  fs.renameSync(tempPath, journalPath);
}

function removePlainDirectoryIfPresent(target, rmSync) {
  if (!fs.existsSync(target)) return true;
  try {
    assertPlainDirectory(target, "transaction cleanup target");
    rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function removeJournalIfPresent(journalPath, rmSync) {
  if (!fs.existsSync(journalPath)) return true;
  try {
    const stat = fs.lstatSync(journalPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    rmSync(journalPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function quarantineJournal(baseDir, journalPath) {
  const directory = assertJournalDirectory(baseDir);
  const quarantineDir = path.join(directory, "quarantine");
  if (fs.existsSync(quarantineDir)) assertPlainDirectory(quarantineDir, "transaction journal quarantine");
  else fs.mkdirSync(quarantineDir, { recursive: true });
  fs.renameSync(journalPath, path.join(quarantineDir, `${path.basename(journalPath)}.${randomUUID()}.rejected`));
}

function readTransaction(baseDir, journalPath) {
  const stat = fs.lstatSync(journalPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`unsafe cards-data transaction journal: ${journalPath}`);
  const transaction = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const resolvedBaseDir = assertBaseRoot(baseDir);
  if (path.resolve(transaction.baseDir ?? "") !== resolvedBaseDir || typeof transaction.stagedBaseDir !== "string" || typeof transaction.backupDir !== "string") {
    throw new Error(`invalid cards-data transaction journal: ${journalPath}`);
  }
  return {
    ...transaction,
    baseDir: resolvedBaseDir,
    stagedBaseDir: assertManagedRootPath(resolvedBaseDir, transaction.stagedBaseDir, "stage"),
    backupDir: assertManagedRootPath(resolvedBaseDir, transaction.backupDir, "backup"),
  };
}

function journalPaths(baseDir) {
  const directory = assertJournalDirectory(baseDir);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(directory, name));
}

function recoverCardsDataTransactions({ baseDir, renameSync = fs.renameSync, rmSync = fs.rmSync }) {
  let recovered = 0;
  let cleanupPending = 0;
  let rejected = 0;
  for (const journalPath of journalPaths(baseDir)) {
    let transaction;
    try {
      transaction = readTransaction(baseDir, journalPath);
    } catch {
      quarantineJournal(baseDir, journalPath);
      rejected += 1;
      continue;
    }
    const baseExists = fs.existsSync(baseDir);
    const backupExists = fs.existsSync(transaction.backupDir);
    if (!baseExists && backupExists) {
      renameSync(transaction.backupDir, baseDir);
      recovered += 1;
    } else if (!baseExists) {
      throw new Error(`cards-data transaction recovery requires a base or backup root: ${journalPath}`);
    }

    const backupRemoved = removePlainDirectoryIfPresent(transaction.backupDir, rmSync);
    const stageRemoved = removePlainDirectoryIfPresent(transaction.stagedBaseDir, rmSync);
    if (backupRemoved && stageRemoved && removeJournalIfPresent(journalPath, rmSync)) continue;
    cleanupPending += 1;
  }
  return { recovered, cleanupPending, rejected };
}

function replaceStagedCardsDataRoot({
  baseDir,
  stagedBaseDir,
  renameSync = fs.renameSync,
  rmSync = fs.rmSync,
  hooks = {},
}) {
  const resolvedBaseDir = assertBaseRoot(baseDir);
  const resolvedStagedBaseDir = assertManagedRootPath(resolvedBaseDir, stagedBaseDir, "stage");
  const parentDir = path.dirname(resolvedBaseDir);
  const journalDir = transactionDirectory(resolvedBaseDir);
  fs.mkdirSync(journalDir, { recursive: true });
  const backupDir = path.join(parentDir, `.${path.basename(resolvedBaseDir)}.backup-${randomUUID()}`);
  const journalPath = path.join(journalDir, `${randomUUID()}.json`);
  const transaction = { version: 1, baseDir: resolvedBaseDir, stagedBaseDir: resolvedStagedBaseDir, backupDir, state: "prepared" };
  writeTransaction(journalPath, transaction);

  renameSync(resolvedBaseDir, backupDir);
  transaction.state = "backup-moved";
  writeTransaction(journalPath, transaction);
  hooks.afterBackupMoved?.();

  renameSync(resolvedStagedBaseDir, resolvedBaseDir);
  transaction.state = "installed";
  writeTransaction(journalPath, transaction);

  const backupRemoved = removePlainDirectoryIfPresent(backupDir, rmSync);
  const journalRemoved = backupRemoved && removeJournalIfPresent(journalPath, rmSync);
  return { cleanupPending: !backupRemoved || !journalRemoved };
}

function copyStaticCardsData(baseDir, stagedBaseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.name === "_raw" || (entry.isDirectory() && PACKAGE_DIRECTORY.test(entry.name))) continue;
    fs.cpSync(path.join(baseDir, entry.name), path.join(stagedBaseDir, entry.name), { recursive: true });
  }
}

function validateStagedCardsData({ stagedBaseDir, written }) {
  const rawDir = path.join(stagedBaseDir, "_raw");
  if (!fs.existsSync(rawDir)) throw new Error("staged cards-data is missing raw packages");
  for (const filename of written) {
    const rawPath = path.join(rawDir, filename);
    if (!fs.existsSync(rawPath)) throw new Error(`staged cards-data is missing ${filename}`);
    const payload = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    if (!Array.isArray(payload.data)) throw new Error(`staged cards-data is invalid: ${filename}`);
  }
}

function defaultRegenerate({ baseDir, rawDir }) {
  const { regenerateAll } = require("../../.claude/specs/cards-data/_regen_all.cjs");
  return regenerateAll({ baseDir, rawDir });
}

async function fetchAndRegenerateAllCards(options = {}) {
  const baseDir = options.baseDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data");
  recoverCardsDataTransactions({ baseDir });
  const snapshot = await fetchAllCards(options);
  const parentDir = path.dirname(baseDir);
  const stagedBaseDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(baseDir)}.stage-`));
  const rawDir = path.join(stagedBaseDir, "_raw");
  const regenerate = options.regenerate ?? defaultRegenerate;
  try {
    copyStaticCardsData(baseDir, stagedBaseDir);
    const written = writeRawPackages(snapshot.cards, rawDir);
    regenerate({ baseDir: stagedBaseDir, rawDir });
    validateStagedCardsData({ stagedBaseDir, written });
    const transaction = replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      ...(options.renameSync ? { renameSync: options.renameSync } : {}),
      ...(options.rmSync ? { rmSync: options.rmSync } : {}),
    });
    return { ...snapshot, written, ...transaction };
  } catch (error) {
    recoverCardsDataTransactions({ baseDir });
    throw error;
  } finally {
    fs.rmSync(stagedBaseDir, { recursive: true, force: true });
  }
}

async function fetchAndWriteAllCards(options = {}) {
  const snapshot = await fetchAllCards(options);
  const outputDir = options.outputDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data", "_raw");
  return { ...snapshot, written: writeRawPackages(snapshot.cards, outputDir) };
}

module.exports = {
  OFFICIAL_CARDS_URL,
  fetchAllCards,
  fetchAndRegenerateAllCards,
  fetchAndWriteAllCards,
  packageCode,
  packageDirectories,
  recoverCardsDataTransactions,
  replaceStagedCardsDataRoot,
  transactionDirectory,
  writeRawPackages,
};
