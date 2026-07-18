import { createHash } from "node:crypto";
import { mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "conan-official-api-"));
  tempDirs.push(dir);
  return dir;
}

function page(data: unknown[], total: number, lastPage: number) {
  return { data, total, lastPage, page: 1 };
}

function response(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => payload,
  } as Response;
}

function liveStatus(cards: Array<{ card_num: string; card_id?: string; q_a?: unknown }>) {
  const { normalizedFaqMetadataFromCards } = require("../../scripts/cards/cards-data-status.cjs");
  return {
    printings: { raw: cards.length, tsv: cards.length },
    hashes: {
      rawCardNums: createHash("sha256").update(cards.map((card) => card.card_num).sort().join("\n")).digest("hex"),
      normalizedFaq: createHash("sha256").update(JSON.stringify(normalizedFaqMetadataFromCards(cards))).digest("hex"),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("official card API", () => {
  it("maps the official PR category label into the stable local PR-01 package", () => {
    const { packageCode } = require("../../scripts/cards/official-api.cjs");

    expect(packageCode("PRカード")).toBe("PR-01");
  });

  it("fetches every page and retries a transient page failure", async () => {
    const { fetchAllCards } = require("../../scripts/cards/official-api.cjs");
    const calls: string[] = [];
    const delays: number[] = [];
    let secondPageAttempts = 0;
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.includes("page=1")) {
        return response(page([{ card_num: "B01001", package: "CT-P01 set" }], 2, 2));
      }
      secondPageAttempts += 1;
      if (secondPageAttempts === 1) return response({}, false);
      return response(page([{ card_num: "B01002", package: "CT-P01 set" }], 2, 2));
    };

    await expect(fetchAllCards({ fetchImpl, retries: 1, delay: async (ms: number) => { delays.push(ms); } })).resolves.toMatchObject({
      total: 2,
      lastPage: 2,
      cards: [{ card_num: "B01001" }, { card_num: "B01002" }],
    });
    expect(calls).toHaveLength(3);
    expect(delays).toEqual([300]);
  });

  it("rejects a count mismatch before raw files are written", async () => {
    const { fetchAndWriteAllCards } = require("../../scripts/cards/official-api.cjs");
    const outputDir = join(tempDir(), "raw");
    const fetchImpl = async () =>
      response(page([{ card_num: "B01001", package: "CT-P01 set" }], 2, 1));

    await expect(fetchAndWriteAllCards({ fetchImpl, outputDir })).rejects.toThrow(
      "official card count mismatch: expected 2, received 1",
    );
    expect(existsSync(outputDir)).toBe(false);
  });

  it("rejects an invalid package before raw files are written", async () => {
    const { fetchAndWriteAllCards } = require("../../scripts/cards/official-api.cjs");
    const outputDir = tempDir();
    const fetchImpl = async () =>
      response(page([{ card_num: "B01001", package: "not an official package" }], 1, 1));

    await expect(fetchAndWriteAllCards({ fetchImpl, outputDir })).rejects.toThrow(
      "invalid official package: not an official package",
    );
    expect(readdirSync(outputDir)).toEqual([]);
  });

  it("keeps the previous raw snapshot when a staged write fails", () => {
    const { writeRawPackages } = require("../../scripts/cards/official-api.cjs");
    const outputDir = join(tempDir(), "raw");
    require("node:fs").mkdirSync(outputDir);
    writeFileSync(join(outputDir, "old-api.json"), "old\n");
    const fs = require("node:fs");
    const realWrite = fs.writeFileSync;
    let writes = 0;
    vi.spyOn(fs, "writeFileSync").mockImplementation((...args: Parameters<typeof writeFileSync>) => {
      writes += 1;
      if (writes === 2) throw new Error("disk full");
      return realWrite(...args);
    });

    expect(() => writeRawPackages([
      { card_num: "B01001", package: "CT-P01 set" },
      { card_num: "D01001", package: "CT-D01 set" },
    ], outputDir)).toThrow("disk full");
    expect(readdirSync(outputDir)).toEqual(["old-api.json"]);
  });

  it("keeps raw and generated TSV snapshots unchanged when staged regeneration fails", async () => {
    const { fetchAndRegenerateAllCards } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    const rawDir = join(baseDir, "_raw");
    const packageDir = join(baseDir, "ct-p01");
    mkdirSync(rawDir, { recursive: true });
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(rawDir, "old-api.json"), "old raw\n");
    writeFileSync(join(packageDir, "character.tsv"), "old tsv\n");

    await expect(fetchAndRegenerateAllCards({
      baseDir,
      fetchImpl: async () => response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1)),
      regenerate: () => { throw new Error("regeneration failed"); },
    })).rejects.toThrow("regeneration failed");

    expect(readFileSync(join(rawDir, "old-api.json"), "utf8")).toBe("old raw\n");
    expect(readFileSync(join(packageDir, "character.tsv"), "utf8")).toBe("old tsv\n");
  });

  it("replaces raw and generated package directories together after staged regeneration succeeds", async () => {
    const { fetchAndRegenerateAllCards } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    const rawDir = join(baseDir, "_raw");
    const packageDir = join(baseDir, "ct-p01");
    const stalePackageDir = join(baseDir, "ct-d01");
    mkdirSync(rawDir, { recursive: true });
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(stalePackageDir, { recursive: true });
    writeFileSync(join(rawDir, "old-api.json"), "old raw\n");
    writeFileSync(join(packageDir, "character.tsv"), "old tsv\n");
    writeFileSync(join(stalePackageDir, "character.tsv"), "stale tsv\n");

    await fetchAndRegenerateAllCards({
      baseDir,
      fetchImpl: async () => response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1)),
      regenerate: ({ baseDir: stagedBaseDir, rawDir: stagedRawDir }: { baseDir: string; rawDir: string }) => {
        mkdirSync(join(stagedBaseDir, "ct-p01"), { recursive: true });
        expect(readdirSync(stagedRawDir)).toEqual(["ct-p01-api.json"]);
        writeFileSync(join(stagedBaseDir, "ct-p01", "character.tsv"), "new tsv\n");
      },
    });

    expect(readdirSync(rawDir)).toEqual(["ct-p01-api.json"]);
    expect(readFileSync(join(packageDir, "character.tsv"), "utf8")).toBe("new tsv\n");
    expect(existsSync(stalePackageDir)).toBe(false);
  });
});

describe("local official Q&A source", () => {
  it("reads local raw Q&A by card number when raw cache is available", () => {
    const { readLocalQaByCardNum } = require("../../scripts/cards/check-official-sync.cjs");
    const root = tempDir();
    const rawDir = join(root, ".claude", "specs", "cards-data", "_raw");
    writeFileSync(join(root, ".gitkeep"), "");
    require("node:fs").mkdirSync(rawDir, { recursive: true });
    writeFileSync(
      join(rawDir, "ct-p01-api.json"),
      JSON.stringify({ data: [{ card_num: "B01001", q_a: "old answer" }] }),
    );

    expect([...readLocalQaByCardNum(root)]).toEqual([["B01001", "old answer"]]);
  });
});

describe("official sync stale checker", () => {
  it("reports the expected CT-P10 baseline delta as machine JSON data", () => {
    const { compareOfficialSync, syncExitCode } = require("../../scripts/cards/check-official-sync.cjs");
    const localCards = Array.from({ length: 2074 }, (_, index) => ({
      cardNum: `B${String(index).padStart(5, "0")}`,
      qAndA: "",
    }));
    const result = compareOfficialSync({
      officialCards: [
        ...localCards.map(({ cardNum }) => ({ card_num: cardNum, q_a: "" })),
        ...Array.from({ length: 166 }, (_, index) => ({
          card_num: `D${String(index).padStart(5, "0")}`,
          q_a: "",
        })),
      ],
      localCards,
    });

    expect(result).toMatchObject({ added: 166, removed: 0, qaChanged: 0 });
    expect(syncExitCode(result)).toBe(1);
  });

  it("reports a changed local Q&A value", () => {
    const { compareOfficialSync } = require("../../scripts/cards/check-official-sync.cjs");

    expect(compareOfficialSync({
      officialCards: [{ card_num: "B01001", q_a: "new answer" }],
      localCards: [{ cardNum: "B01001", qAndA: "old answer" }],
    })).toMatchObject({ added: 0, removed: 0, qaChanged: 1 });
  });
});

describe("official live-status checker", () => {
  it("matches tracked card-number and normalized FAQ hashes without writing local data", async () => {
    const { compareLiveStatus, runLiveStatusCheck, liveStatusExitCode } = require("../../scripts/cards/check-official-sync.cjs");
    const cards = [{ card_num: "B00001", card_id: "card-a", q_a: "Q: Match?\nA: Yes" }];
    const status = liveStatus(cards);
    expect(compareLiveStatus({ officialCards: cards, status })).toMatchObject({ changed: false, officialTotal: 1, expectedTotal: 1, normalizedFaqHashChanged: false });
    expect(liveStatusExitCode(compareLiveStatus({ officialCards: cards, status }))).toBe(0);

    const root = tempDir();
    const statusPath = join(root, ".claude", "specs", "cards-data");
    mkdirSync(statusPath, { recursive: true });
    writeFileSync(join(statusPath, "status.json"), JSON.stringify(status));
    await expect(runLiveStatusCheck({ root, fetchImpl: async () => response(page(cards, 1, 1)) })).resolves.toMatchObject({ changed: false });
  });

  it("fails on live count, card-number, or normalized FAQ hash drift", () => {
    const { compareLiveStatus, liveStatusExitCode, runLiveStatusCheck, LIVE_STATUS_SOURCE_FAILURE_EXIT_CODE } = require("../../scripts/cards/check-official-sync.cjs");
    const status = liveStatus([{ card_num: "B00001", card_id: "card-a", q_a: "Q: Same?\nA: Old" }]);
    const drift = compareLiveStatus({ officialCards: [{ card_num: "B00002" }, { card_num: "B00003" }], status });
    expect(drift).toMatchObject({ changed: true, countChanged: true, cardNumHashChanged: true, normalizedFaqHashChanged: true });
    expect(liveStatusExitCode(drift)).toBe(1);
    expect(LIVE_STATUS_SOURCE_FAILURE_EXIT_CODE).toBe(2);
  });

  it("fails when a same-count same-card live Q&A answer changes", () => {
    const { compareLiveStatus, liveStatusExitCode } = require("../../scripts/cards/check-official-sync.cjs");
    const tracked = [{ card_num: "B00001", card_id: "card-a", q_a: "Q: Same?\nA: Old" }];
    const live = [{ card_num: "B00001", card_id: "card-a", q_a: "Q: Same?\nA: New" }];
    const result = compareLiveStatus({ officialCards: live, status: liveStatus(tracked) });

    expect(result).toMatchObject({ countChanged: false, cardNumHashChanged: false, normalizedFaqHashChanged: true, changed: true });
    expect(liveStatusExitCode(result)).toBe(1);
  });

  it("surfaces source and malformed live Q&A failures", async () => {
    const { runLiveStatusCheck } = require("../../scripts/cards/check-official-sync.cjs");
    await expect(runLiveStatusCheck({ root: tempDir(), fetchImpl: async () => { throw new Error("source down"); } })).rejects.toThrow("source down");

    const root = tempDir();
    const statusPath = join(root, ".claude", "specs", "cards-data");
    mkdirSync(statusPath, { recursive: true });
    writeFileSync(join(statusPath, "status.json"), JSON.stringify(liveStatus([{ card_num: "B00001", card_id: "card-a", q_a: "Q: Valid?\nA: Yes" }])));
    await expect(runLiveStatusCheck({ root, fetchImpl: async () => response(page([
      { card_num: "B00001", card_id: "card-a", q_a: "Q: malformed without answer" },
    ], 1, 1)) })).rejects.toThrow(/Q&A parse error/);
  });
});
