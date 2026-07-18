const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { fetchAllCards } = require("./official-api.cjs");

function readLocalQaByCardNum(root) {
  const rawDir = path.join(root, ".claude", "specs", "cards-data", "_raw");
  const qaByCardNum = new Map();
  if (!fs.existsSync(rawDir)) return qaByCardNum;
  for (const file of fs.readdirSync(rawDir).sort()) {
    if (!file.endsWith("-api.json")) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8"));
    for (const card of raw.data ?? []) {
      if (card.card_num) qaByCardNum.set(card.card_num, String(card.q_a ?? ""));
    }
  }
  return qaByCardNum;
}

function readLocalCards(root = path.resolve(__dirname, "..", "..")) {
  execFileSync(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/compiler/dump-shipped.ts"], {
    cwd: root,
    stdio: "ignore",
  });
  const dump = JSON.parse(
    fs.readFileSync(path.join(root, ".tmp", "compiler", "shipped-dsl.json"), "utf8"),
  );
  const qaByCardNum = readLocalQaByCardNum(root);
  return dump.cards.map((card) => ({ cardNum: card.id, qAndA: qaByCardNum.get(card.id) ?? "" }));
}

function compareOfficialSync({ officialCards, localCards }) {
  const officialByCardNum = new Map(officialCards.map((card) => [card.card_num, card]));
  const localByCardNum = new Map(localCards.map((card) => [card.cardNum, card]));
  const addedCardNums = [...officialByCardNum.keys()].filter((id) => !localByCardNum.has(id)).sort();
  const removedCardNums = [...localByCardNum.keys()].filter((id) => !officialByCardNum.has(id)).sort();
  const qaChangedCardNums = [...officialByCardNum.keys()]
    .filter((id) => {
      const local = localByCardNum.get(id);
      if (!local?.qAndA) return false;
      return String(officialByCardNum.get(id).q_a ?? "") !== local.qAndA;
    })
    .sort();
  return {
    officialTotal: officialByCardNum.size,
    localTotal: localByCardNum.size,
    added: addedCardNums.length,
    removed: removedCardNums.length,
    qaChanged: qaChangedCardNums.length,
    changed: addedCardNums.length > 0 || removedCardNums.length > 0 || qaChangedCardNums.length > 0,
  };
}

async function runOfficialSyncCheck({ root, fetchImpl } = {}) {
  const official = await fetchAllCards({ fetchImpl });
  return compareOfficialSync({ officialCards: official.cards, localCards: readLocalCards(root) });
}

function syncExitCode(result) {
  return result.changed ? 1 : 0;
}

const LIVE_STATUS_SOURCE_FAILURE_EXIT_CODE = 2;

function cardNumHash(cardNums) {
  return crypto.createHash("sha256").update([...cardNums].sort().join("\n"), "utf8").digest("hex");
}

function readTrackedStatus(root = path.resolve(__dirname, "..", "..")) {
  return JSON.parse(fs.readFileSync(path.join(root, ".claude", "specs", "cards-data", "status.json"), "utf8"));
}

/** Live, read-only comparison for scheduled/manual CI. It never refreshes raw or generated card data. */
function compareLiveStatus({ officialCards, status }) {
  const officialCardNums = officialCards.map((card) => String(card.card_num ?? "").trim());
  if (officialCardNums.some((cardNum) => !cardNum)) throw new Error("official live status includes a missing card_num");
  const expectedTotal = status?.printings?.raw;
  const expectedCardNumsHash = status?.hashes?.rawCardNums;
  if (!Number.isInteger(expectedTotal) || typeof expectedCardNumsHash !== "string") throw new Error("invalid tracked cards-data status for live comparison");
  const officialCardNumsHash = cardNumHash(officialCardNums);
  const countChanged = officialCardNums.length !== expectedTotal;
  const cardNumHashChanged = officialCardNumsHash !== expectedCardNumsHash;
  return {
    mode: "live-status",
    expectedTotal,
    officialTotal: officialCardNums.length,
    expectedCardNumsHash,
    officialCardNumsHash,
    countChanged,
    cardNumHashChanged,
    changed: countChanged || cardNumHashChanged,
  };
}

async function runLiveStatusCheck({ root = path.resolve(__dirname, "..", ".."), fetchImpl } = {}) {
  const official = await fetchAllCards({ fetchImpl });
  return compareLiveStatus({ officialCards: official.cards, status: readTrackedStatus(root) });
}

function liveStatusExitCode(result) {
  return result.changed ? 1 : 0;
}

if (require.main === module) {
  const liveStatus = process.argv.includes("--live-status");
  (liveStatus ? runLiveStatusCheck() : runOfficialSyncCheck())
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = liveStatus ? liveStatusExitCode(result) : syncExitCode(result);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = liveStatus ? LIVE_STATUS_SOURCE_FAILURE_EXIT_CODE : 2;
    });
}

module.exports = {
  LIVE_STATUS_SOURCE_FAILURE_EXIT_CODE,
  cardNumHash,
  compareLiveStatus,
  compareOfficialSync,
  liveStatusExitCode,
  readLocalCards,
  readLocalQaByCardNum,
  readTrackedStatus,
  runLiveStatusCheck,
  runOfficialSyncCheck,
  syncExitCode,
};
