const fs = require("node:fs");
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

if (require.main === module) {
  runOfficialSyncCheck()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = syncExitCode(result);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = 2;
    });
}

module.exports = { compareOfficialSync, readLocalCards, readLocalQaByCardNum, runOfficialSyncCheck, syncExitCode };
