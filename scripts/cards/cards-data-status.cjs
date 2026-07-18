const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { OFFICIAL_CARDS_URL } = require("./official-api.cjs");
const { compareOrdinal, isQaShaped, loadRawQaCards, normalizeQaCards } = require("./qa-normalize.cjs");

const STATUS_FILE = path.join(".claude", "specs", "cards-data", "status.json");
const RAW_KIND = {
  "パートナー": "partner",
  "キャラ": "character",
  "イベント": "event",
  "事件": "case",
};

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function addCount(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function sortedObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([left], [right]) => compareOrdinal(left, right)));
}

function duplicateCardNums(cardNums) {
  const seen = new Set();
  const duplicates = new Set();
  for (const cardNum of cardNums) {
    if (seen.has(cardNum)) duplicates.add(cardNum);
    seen.add(cardNum);
  }
  return [...duplicates].sort(compareOrdinal);
}

function readRaw(root) {
  const rawDir = path.join(root, ".claude", "specs", "cards-data", "_raw");
  const cardNums = [];
  const packages = {};
  const kinds = {};
  if (!fs.existsSync(rawDir)) return { cardNums, packages, kinds };
  for (const file of fs.readdirSync(rawDir).sort(compareOrdinal)) {
    if (!file.endsWith("-api.json")) continue;
    const pkg = file.replace(/-api\.json$/, "");
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8"));
    if (!Array.isArray(raw.data)) throw new Error(`invalid raw package: ${file}`);
    for (const card of raw.data) {
      const cardNum = String(card.card_num ?? "").trim();
      if (!cardNum) throw new Error(`missing card_num: ${file}`);
      const kind = RAW_KIND[card.type];
      if (!kind) throw new Error(`unknown raw card kind: ${String(card.type)}`);
      cardNums.push(cardNum);
      addCount(packages, pkg);
      addCount(kinds, kind);
    }
  }
  return { cardNums, packages: sortedObject(packages), kinds: sortedObject(kinds) };
}

function readTsv(root) {
  const dataDir = path.join(root, ".claude", "specs", "cards-data");
  const cardNums = [];
  const packages = {};
  const kinds = {};
  if (!fs.existsSync(dataDir)) return { cardNums, packages, kinds };
  for (const pkg of fs.readdirSync(dataDir).sort(compareOrdinal)) {
    const dir = path.join(dataDir, pkg);
    if (pkg.startsWith("_") || !fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort(compareOrdinal)) {
      if (!file.endsWith(".tsv")) continue;
      const kind = file.replace(/\.tsv$/, "");
      const lines = fs.readFileSync(path.join(dir, file), "utf8").split(/\r?\n/).filter(Boolean);
      const cardNumIndex = lines[0]?.split("\t").indexOf("cardNum") ?? -1;
      if (cardNumIndex < 0) throw new Error(`missing cardNum column: ${pkg}/${file}`);
      for (const line of lines.slice(1)) {
        const cardNum = String(line.split("\t")[cardNumIndex] ?? "").trim();
        if (!cardNum) throw new Error(`missing cardNum: ${pkg}/${file}`);
        cardNums.push(cardNum);
        addCount(packages, pkg);
        addCount(kinds, kind);
      }
    }
  }
  return { cardNums, packages: sortedObject(packages), kinds: sortedObject(kinds) };
}

function cardNumHash(cardNums) {
  return sha256([...cardNums].sort(compareOrdinal).join("\n"));
}

function sameCardNums(rawCardNums, tsvCardNums) {
  return cardNumHash(rawCardNums) === cardNumHash(tsvCardNums)
    && rawCardNums.length === tsvCardNums.length;
}

function normalizedFaqMetadataFromCards(cards) {
  const qaCards = (cards ?? []).filter((card) => isQaShaped(card.q_a ?? card.qAndA));
  return normalizeQaCards(qaCards);
}

function normalizedFaqMetadata(root) {
  return normalizedFaqMetadataFromCards(loadRawQaCards(root));
}

function normalizedFaqHashFromCards(cards) {
  return sha256(JSON.stringify(normalizedFaqMetadataFromCards(cards)));
}

function generateCardsDataStatus(root, source = {}) {
  const raw = readRaw(root);
  const tsv = readTsv(root);
  const rawDuplicates = duplicateCardNums(raw.cardNums);
  const tsvDuplicates = duplicateCardNums(tsv.cardNums);
  if (rawDuplicates.length || tsvDuplicates.length) throw new Error("duplicate cardNum in raw or TSV data");
  if (!sameCardNums(raw.cardNums, tsv.cardNums)) throw new Error("raw/TSV cardNum mismatch");
  if (JSON.stringify(raw.packages) !== JSON.stringify(tsv.packages)) throw new Error("raw/TSV package count mismatch");
  if (JSON.stringify(raw.kinds) !== JSON.stringify(tsv.kinds)) throw new Error("raw/TSV kind count mismatch");

  const qa = normalizedFaqMetadata(root);
  return {
    schemaVersion: 1,
    source: {
      url: source.url ?? source.sourceUrl ?? OFFICIAL_CARDS_URL,
      ...(source.fetchedAt ? { fetchedAt: source.fetchedAt } : {}),
    },
    packages: { count: Object.keys(raw.packages).length, printings: raw.packages },
    kinds: raw.kinds,
    printings: { raw: raw.cardNums.length, tsv: tsv.cardNums.length },
    duplicates: { raw: rawDuplicates, tsv: tsvDuplicates },
    hashes: {
      rawCardNums: cardNumHash(raw.cardNums),
      tsvCardNums: cardNumHash(tsv.cardNums),
      normalizedFaq: sha256(JSON.stringify(qa)),
    },
  };
}

function writeCardsDataStatus(root, source) {
  const status = generateCardsDataStatus(root, source);
  const output = path.join(root, STATUS_FILE);
  fs.writeFileSync(output, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

if (require.main === module) {
  const fetchedAtIndex = process.argv.indexOf("--fetched-at");
  const fetchedAt = fetchedAtIndex >= 0 ? process.argv[fetchedAtIndex + 1] : undefined;
  const status = writeCardsDataStatus(path.resolve(__dirname, "..", ".."), { fetchedAt });
  process.stdout.write(`${JSON.stringify(status)}\n`);
}

module.exports = {
  generateCardsDataStatus,
  normalizedFaqHashFromCards,
  normalizedFaqMetadata,
  normalizedFaqMetadataFromCards,
  readRaw,
  readTsv,
  writeCardsDataStatus,
};
