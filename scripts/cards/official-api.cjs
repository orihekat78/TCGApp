const fs = require("node:fs");
const path = require("node:path");

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

function replaceStagedDirectories({ baseDir, stagedBaseDir, renameSync = fs.renameSync }) {
  const parentDir = path.dirname(baseDir);
  fs.mkdirSync(baseDir, { recursive: true });
  const backupDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(baseDir)}.backup-`));
  const names = ["_raw", ...new Set([
    ...packageDirectories(baseDir),
    ...packageDirectories(stagedBaseDir),
  ])];
  const movedExisting = [];
  const installed = [];
  let removeBackup = false;
  try {
    for (const name of names) {
      const target = path.join(baseDir, name);
      const staged = path.join(stagedBaseDir, name);
      const backup = path.join(backupDir, name);
      if (fs.existsSync(target)) {
        renameSync(target, backup);
        movedExisting.push(name);
      }
      if (fs.existsSync(staged)) {
        renameSync(staged, target);
        installed.push(name);
      }
    }
    removeBackup = true;
  } catch (error) {
    const rollbackErrors = [];
    for (const name of [...installed].reverse()) {
      const target = path.join(baseDir, name);
      const staged = path.join(stagedBaseDir, name);
      try {
        if (fs.existsSync(target)) renameSync(target, staged);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const name of [...movedExisting].reverse()) {
      const target = path.join(baseDir, name);
      const backup = path.join(backupDir, name);
      try {
        if (fs.existsSync(backup) && !fs.existsSync(target)) renameSync(backup, target);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      error.rollbackErrors = rollbackErrors;
      error.backupDir = backupDir;
    } else {
      removeBackup = true;
    }
    throw error;
  } finally {
    if (removeBackup) fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

function defaultRegenerate({ baseDir, rawDir }) {
  const { regenerateAll } = require("../../.claude/specs/cards-data/_regen_all.cjs");
  return regenerateAll({ baseDir, rawDir });
}

async function fetchAndRegenerateAllCards(options = {}) {
  const snapshot = await fetchAllCards(options);
  const baseDir = options.baseDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data");
  const parentDir = path.dirname(baseDir);
  const stagedBaseDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(baseDir)}.stage-`));
  const rawDir = path.join(stagedBaseDir, "_raw");
  const regenerate = options.regenerate ?? defaultRegenerate;
  try {
    const written = writeRawPackages(snapshot.cards, rawDir);
    regenerate({ baseDir: stagedBaseDir, rawDir });
    replaceStagedDirectories({
      baseDir,
      stagedBaseDir,
      ...(options.renameSync ? { renameSync: options.renameSync } : {}),
    });
    return { ...snapshot, written };
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
  replaceStagedDirectories,
  writeRawPackages,
};
