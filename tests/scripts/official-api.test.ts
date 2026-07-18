import { mkdtempSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("official card API", () => {
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
