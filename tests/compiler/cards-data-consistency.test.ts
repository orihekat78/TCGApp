import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const tempDirs: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "conan-cards-data-status-"));
  tempDirs.push(root);
  return root;
}

function writeFixture(root: string, rawCardNums: string[], tsvCardNums = rawCardNums): void {
  const dataRoot = path.join(root, ".claude", "specs", "cards-data");
  const rawDir = path.join(dataRoot, "_raw");
  const tsvDir = path.join(dataRoot, "ct-p10");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(tsvDir, { recursive: true });
  writeFileSync(path.join(rawDir, "ct-p10-api.json"), JSON.stringify({ data: rawCardNums.map((card_num, index) => ({
    card_num,
    card_id: String(index + 1).padStart(4, "0"),
    type: "キャラ",
    q_a: JSON.stringify({ "Rule・Question": `Answer ${index + 1}` }),
  })) }));
  writeFileSync(path.join(tsvDir, "character.tsv"), [
    "cardNum\tcardId\ttitle",
    ...tsvCardNums.map((cardNum, index) => `${cardNum}\t${String(index + 1).padStart(4, "0")}\tCard ${index + 1}`),
  ].join("\n"));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("cards-data consistency status", () => {
  it("keeps current snapshot counts out of the INDEX", () => {
    const index = readFileSync(path.join(ROOT, ".claude", "specs", "cards-data", "INDEX.md"), "utf8");

    expect(index).toContain("[status.json]");
    expect(index).not.toMatch(/\b\d[\d,]*\s+(?:packages|printings)\b/i);
    expect(index).not.toMatch(/\bCT-P10\b/i);
  });

  it("hashes normalized Q&A and records only deterministic source metadata", () => {
    const { generateCardsDataStatus, normalizedFaqMetadata } = require("../../scripts/cards/cards-data-status.cjs");
    const root = tempRoot();
    writeFixture(root, ["P10001", "P10002"]);

    const status = generateCardsDataStatus(root, {
      fetchedAt: "2026-07-18T00:00:00.000Z",
      sourceUrl: "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards",
    });

    expect(status).toMatchObject({
      schemaVersion: 1,
      source: {
        fetchedAt: "2026-07-18T00:00:00.000Z",
        url: "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards",
      },
      packages: { count: 1, printings: { "ct-p10": 2 } },
      kinds: { character: 2 },
      printings: { raw: 2, tsv: 2 },
      duplicates: { raw: [], tsv: [] },
    });
    expect(status.hashes).toMatchObject({ rawCardNums: expect.stringMatching(/^[a-f0-9]{64}$/), tsvCardNums: expect.stringMatching(/^[a-f0-9]{64}$/), normalizedFaq: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(normalizedFaqMetadata(root).items).toHaveLength(2);
    expect(JSON.stringify(status)).not.toContain("Answer 1");
  });

  it("reports raw and TSV card-number drift", () => {
    const { generateCardsDataStatus } = require("../../scripts/cards/cards-data-status.cjs");
    const root = tempRoot();
    writeFixture(root, ["P10001", "P10002"], ["P10001", "P10003"]);

    expect(() => generateCardsDataStatus(root)).toThrow("raw/TSV cardNum mismatch");
  });

  it("excludes non-Q&A source notes from the normalized FAQ hash", () => {
    const { generateCardsDataStatus } = require("../../scripts/cards/cards-data-status.cjs");
    const root = tempRoot();
    writeFixture(root, ["P10001"]);
    const rawFile = path.join(root, ".claude", "specs", "cards-data", "_raw", "ct-p10-api.json");
    writeFileSync(rawFile, JSON.stringify({ data: [{
      card_num: "P10001", card_id: "0001", type: "キャラ", q_a: "See the official rules manual.",
    }] }));

    expect(generateCardsDataStatus(root).hashes.normalizedFaq).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps ingress and status metadata identical while excluding B08023 manual notes", () => {
    const { createHash } = require("node:crypto");
    const { loadQaCorpus } = require("../../scripts/compiler/tsv-corpus.cjs");
    const { generateCardsDataStatus, normalizedFaqMetadata } = require("../../scripts/cards/cards-data-status.cjs");
    const root = tempRoot();
    writeFixture(root, ["B08022", "B08023", "B08023P", "B08024"]);
    const rawDir = path.join(root, ".claude", "specs", "cards-data", "_raw");
    const rawPath = path.join(rawDir, "ct-p10-api.json");
    const raw = JSON.parse(readFileSync(rawPath, "utf8"));
    raw.data[0].q_a = "Q: Included question\nA: Included answer";
    raw.data[1].q_a = "manual-reference note";
    raw.data[2].q_a = "manual-reference note";
    raw.data[3].q_a = JSON.stringify({ Question: "Included JSON answer" });
    writeFileSync(rawPath, JSON.stringify(raw));

    const ingress = loadQaCorpus(root);
    const statusCorpus = normalizedFaqMetadata(root);
    const status = generateCardsDataStatus(root);
    const hash = createHash("sha256").update(JSON.stringify(ingress)).digest("hex");

    expect(ingress).toEqual(statusCorpus);
    expect(ingress).toMatchObject({ items: expect.any(Array), conflicts: [] });
    expect(ingress.items).toHaveLength(2);
    expect(ingress.items.filter((item: { cardNums: string[] }) => item.cardNums.some((cardNum) => /^B08023P?$/.test(cardNum)))).toEqual([]);
    expect(status.hashes.normalizedFaq).toBe(hash);
  });
});

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, ".claude", "specs", "cards-data", "_raw");
const STATUS_FILE = path.join(ROOT, ".claude", "specs", "cards-data", "status.json");
const trackedStatus = require("../../.claude/specs/cards-data/status.json");
const hasLocalSnapshot = existsSync(STATUS_FILE) && existsSync(RAW_DIR)
  && Object.keys(trackedStatus.packages.printings).every((pkg) => (
    existsSync(path.join(ROOT, ".claude", "specs", "cards-data", pkg))
    && existsSync(path.join(RAW_DIR, `${pkg}-api.json`))
  ));

describe.skipIf(!hasLocalSnapshot)("cards-data consistency (local official cache)", () => {
  it("matches the tracked status without exposing local official text", () => {
    const { generateCardsDataStatus } = require("../../scripts/cards/cards-data-status.cjs");
    expect(generateCardsDataStatus(ROOT, trackedStatus.source)).toEqual(trackedStatus);
  });
});
