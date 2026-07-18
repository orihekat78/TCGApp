const fs = require("node:fs");
const path = require("node:path");

const OFFICIAL_CARDS_URL =
  "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards";
const PACKAGE_CODE = /^(CT-(?:D|P)\d{2}|PR-\d{2})\b/;

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

async function fetchAndWriteAllCards(options = {}) {
  const snapshot = await fetchAllCards(options);
  const outputDir = options.outputDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data", "_raw");
  return { ...snapshot, written: writeRawPackages(snapshot.cards, outputDir) };
}

module.exports = {
  OFFICIAL_CARDS_URL,
  fetchAllCards,
  fetchAndWriteAllCards,
  packageCode,
  writeRawPackages,
};
