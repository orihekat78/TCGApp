import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

function seedAtomicCardsDataFixture(root: string) {
  const baseDir = join(root, ".claude", "specs", "cards-data");
  const rawDir = join(baseDir, "_raw");
  const packageDir = join(baseDir, "ct-p01");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(rawDir, "ct-p01-api.json"), `${JSON.stringify({
    data: [{
      card_num: "B01001",
      card_id: "0001",
      type: "キャラ",
      package: "CT-P01 set",
      title: "fixture",
    }],
  })}\n`);
  writeFileSync(join(packageDir, "character.tsv"), "cardNum\nB01001\n");
  return { baseDir, packageDir };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("official card API", () => {
  it("does not expose direct live-root metadata writers", () => {
    expect(require("../../scripts/cards/cards-data-status.cjs")).not.toHaveProperty(
      "writeCardsDataStatusToBaseDir",
    );
    expect(require("../../scripts/cards/write-qa-hash-snapshot.cjs")).not.toHaveProperty(
      "writeQaHashSnapshotToBaseDir",
    );
  });

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
    const outputDir = join(tempDir(), "_raw");
    const fetchImpl = async () =>
      response(page([{ card_num: "B01001", package: "CT-P01 set" }], 2, 1));

    await expect(fetchAndWriteAllCards({ fetchImpl, outputDir })).rejects.toThrow(
      "official card count mismatch: expected 2, received 1",
    );
    expect(existsSync(outputDir)).toBe(false);
  });

  it("rejects an invalid package before raw files are written", async () => {
    const { fetchAndWriteAllCards } = require("../../scripts/cards/official-api.cjs");
    const outputDir = join(tempDir(), "_raw");
    const fetchImpl = async () =>
      response(page([{ card_num: "B01001", package: "not an official package" }], 1, 1));

    await expect(fetchAndWriteAllCards({ fetchImpl, outputDir })).rejects.toThrow(
      "invalid official package: not an official package",
    );
    expect(existsSync(outputDir)).toBe(false);
  });

  it("keeps the previous raw snapshot when a staged write fails", () => {
    const { writeRawPackagesToStaging } = require("../../scripts/cards/official-api.cjs");
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

    expect(() => writeRawPackagesToStaging([
      { card_num: "B01001", package: "CT-P01 set" },
      { card_num: "D01001", package: "CT-D01 set" },
    ], outputDir)).toThrow("disk full");
    expect(readdirSync(outputDir)).toEqual(["old-api.json"]);
  });

  it("rejects a realpath alias before a direct raw helper can reach the live cards-data root", () => {
    const fs = require("node:fs");
    const { writeRawPackagesToStaging } = require("../../scripts/cards/official-api.cjs");
    const aliasedBaseDir = join(tempDir(), "cards-data-alias");
    const outputDir = join(aliasedBaseDir, "_raw");
    mkdirSync(aliasedBaseDir, { recursive: true });
    const liveBaseDir = resolve(__dirname, "../../.claude/specs/cards-data");
    const realNative = fs.realpathSync.native;
    vi.spyOn(fs.realpathSync, "native").mockImplementation((target: string) => (
      resolve(target) === resolve(aliasedBaseDir) ? liveBaseDir : realNative(target)
    ));

    expect(() => writeRawPackagesToStaging([
      { card_num: "B01001", package: "CT-P01 set" },
    ], outputDir)).toThrow("direct raw mutation of the live cards-data root is forbidden");
    expect(existsSync(outputDir)).toBe(false);
  });

  it("rejects a realpath alias before a direct TSV helper can reach the live cards-data root", () => {
    const fs = require("node:fs");
    const { regenerateAll } = require("../../.claude/specs/cards-data/_regen_all.cjs");
    const aliasedBaseDir = join(tempDir(), "cards-data-alias");
    const rawDir = join(aliasedBaseDir, "_raw");
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(join(rawDir, "ct-p01-api.json"), `${JSON.stringify({ data: [] })}\n`);
    const liveBaseDir = resolve(__dirname, "../../.claude/specs/cards-data");
    const realNative = fs.realpathSync.native;
    vi.spyOn(fs.realpathSync, "native").mockImplementation((target: string) => (
      resolve(target) === resolve(aliasedBaseDir) ? liveBaseDir : realNative(target)
    ));

    expect(() => regenerateAll({ baseDir: aliasedBaseDir, rawDir })).toThrow(
      "direct TSV regeneration of the live cards-data root is forbidden",
    );
  });

  it("rejects a hostile raw package filename before TSV regeneration can escape its staging root", () => {
    const { regenerateAll } = require("../../.claude/specs/cards-data/_regen_all.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const rawDir = join(baseDir, "_raw");
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(join(rawDir, "..-api.json"), `${JSON.stringify({
      data: [{ card_num: "B01001", type: "繧ｭ繝｣繝ｩ" }],
    })}\n`);

    expect(() => regenerateAll({ baseDir, rawDir })).toThrow(/raw package filename/i);
    expect(existsSync(join(parentDir, "character.tsv"))).toBe(false);
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

  it("serializes raw refresh, regeneration, recovery, and publication through one write lock", async () => {
    const {
      acquireCardsDataWriteLock,
      fetchAndRegenerateAllCards,
      fetchAndWriteAllCards,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    const outputDir = join(baseDir, "_raw");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "old-api.json"), "old raw\n");
    const lockToken = acquireCardsDataWriteLock(baseDir);
    let fetchCalls = 0;
    const fetchImpl = async () => {
      fetchCalls += 1;
      return response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1));
    };

    await expect(fetchAndRegenerateAllCards({ baseDir, fetchImpl })).rejects.toThrow(/write lock is already held/i);
    await expect(fetchAndWriteAllCards({ baseDir, outputDir, fetchImpl })).rejects.toThrow(/write lock is already held/i);

    expect(fetchCalls).toBe(0);
    expect(readFileSync(join(outputDir, "old-api.json"), "utf8")).toBe("old raw\n");
    expect(releaseCardsDataWriteLock(baseDir, lockToken)).toBe(true);
  });

  it("recovers a write lock whose owning process exited", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const modulePath = resolve(process.cwd(), "scripts", "cards", "official-api.cjs");
    const child = spawnSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(modulePath)}).acquireCardsDataWriteLock(process.argv[1]);`,
      baseDir,
    ], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(true);

    const recovered = acquireCardsDataWriteLock(baseDir);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
    expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(false);
  });

  it("retries a transient candidate install failure when no fixed lock exists", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const fs = require("node:fs") as typeof import("node:fs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const nativeRename = fs.renameSync;
    let injected = false;
    fs.renameSync = ((from: string, to: string) => {
      if (!injected && to === cardsDataWriteLockDirectory(baseDir)) {
        injected = true;
        const error = new Error("transient OneDrive rename contention") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      }
      return nativeRename(from, to);
    }) as typeof fs.renameSync;

    try {
      const lock = acquireCardsDataWriteLock(baseDir);
      expect(injected).toBe(true);
      expect(releaseCardsDataWriteLock(baseDir, lock)).toBe(true);
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  it("fails closed after bounded candidate install retries", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const fs = require("node:fs") as typeof import("node:fs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const nativeRename = fs.renameSync;
    let attempts = 0;
    fs.renameSync = ((from: string, to: string) => {
      if (to === cardsDataWriteLockDirectory(baseDir)) {
        attempts += 1;
        const error = new Error("persistent rename denial") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      }
      return nativeRename(from, to);
    }) as typeof fs.renameSync;

    try {
      expect(() => acquireCardsDataWriteLock(baseDir)).toThrow(/write lock could not be acquired/);
      expect(attempts).toBe(8);
      expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(false);
      expect(readdirSync(transactionDirectory(baseDir))).toEqual([]);
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  it("rejects a candidate identity swap between install retries", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const fs = require("node:fs") as typeof import("node:fs");
    const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const nativeRename = fs.renameSync;
    let replacementPath = "";
    fs.renameSync = ((from: string, to: string) => {
      if (!replacementPath && to === cardsDataWriteLockDirectory(baseDir)) {
        replacementPath = from;
        const originalPath = `${from}-original`;
        nativeRename(from, originalPath);
        mkdirSync(from);
        writeFileSync(join(from, "owner.json"), `${JSON.stringify({
          schemaVersion: 1,
          pid: process.pid,
          nonce: randomUUID(),
        })}\n`);
        const error = new Error("transient rename after candidate replacement") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      }
      return nativeRename(from, to);
    }) as typeof fs.renameSync;

    try {
      expect(() => acquireCardsDataWriteLock(baseDir)).toThrow(/candidate identity changed/);
      expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(false);
      expect(existsSync(replacementPath)).toBe(true);
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  it("holds the kernel gate across stale-owner inspection and replacement", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const modulePath = resolve(process.cwd(), "scripts", "cards", "official-api.cjs");
    const child = spawnSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(modulePath)}).acquireCardsDataWriteLock(process.argv[1]);`,
      baseDir,
    ], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    let nestedError = "";

    const recovered = acquireCardsDataWriteLock(baseDir, {
      afterReadStaleLock: () => {
        try {
          acquireCardsDataWriteLock(baseDir);
        } catch (error) {
          nestedError = error instanceof Error ? error.message : String(error);
        }
      },
    });

    expect(nestedError).toMatch(/write lock is already held/i);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
  });

  it("recovers an exited owner that crashed while its lock was isolated for recovery", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const modulePath = resolve(process.cwd(), "scripts", "cards", "official-api.cjs");
    const recoveryDirectory = join(transactionDirectory(baseDir), "write-lock-recovery");
    const child = spawnSync(process.execPath, [
      "-e",
      `const api=require(${JSON.stringify(modulePath)});const fs=require('node:fs');const token=api.acquireCardsDataWriteLock(process.argv[1]);fs.renameSync(token.lockDirectory,process.argv[2]);`,
      baseDir,
      recoveryDirectory,
    ], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(false);
    expect(existsSync(recoveryDirectory)).toBe(true);

    const recovered = acquireCardsDataWriteLock(baseDir);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
    expect(existsSync(recoveryDirectory)).toBe(false);
  });

  it("removes a dead isolated-lock orphan before the next writer proceeds", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const modulePath = resolve(process.cwd(), "scripts", "cards", "official-api.cjs");
    const child = spawnSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(modulePath)}).acquireCardsDataWriteLock(process.argv[1]);`,
      baseDir,
    ], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);
    const orphan = join(transactionDirectory(baseDir), ".stale-lock-orphan");
    renameSync(cardsDataWriteLockDirectory(baseDir), orphan);

    const recovered = acquireCardsDataWriteLock(baseDir);
    expect(existsSync(orphan)).toBe(false);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
  });

  it("removes an incomplete managed lock candidate left by a crashed writer", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const candidate = join(transactionDirectory(baseDir), ".lock-candidate-11111111-1111-4111-8111-111111111111");
    mkdirSync(candidate, { recursive: true });
    writeFileSync(join(candidate, "owner.json"), "{\"schemaVersion\":");

    const recovered = acquireCardsDataWriteLock(baseDir);

    expect(existsSync(candidate)).toBe(false);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
  });

  it("recovers a stale main lock even when its pid was reused by a live process", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const lockDirectory = cardsDataWriteLockDirectory(baseDir);
    mkdirSync(lockDirectory);
    writeFileSync(join(lockDirectory, "owner.json"), `${JSON.stringify({
      schemaVersion: 1,
      pid: process.pid,
      nonce: "11111111-1111-4111-8111-111111111111",
    })}\n`);

    const recovered = acquireCardsDataWriteLock(baseDir);

    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
    expect(existsSync(lockDirectory)).toBe(false);
  });

  it("removes an empty cleanup directory left by an interrupted release", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const cleanupDirectory = join(transactionDirectory(baseDir), ".lock-cleanup-interrupted");
    mkdirSync(cleanupDirectory, { recursive: true });

    const recovered = acquireCardsDataWriteLock(baseDir);
    expect(existsSync(cleanupDirectory)).toBe(false);
    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
  });

  it("preserves and rejects malformed lock owner metadata", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const lockDirectory = cardsDataWriteLockDirectory(baseDir);
    mkdirSync(lockDirectory);
    const malformedOwner = `${JSON.stringify({ schemaVersion: 1, pid: 99999999, nonce: "------------------------------------" })}\n`;
    writeFileSync(join(lockDirectory, "owner.json"), malformedOwner);

    expect(() => acquireCardsDataWriteLock(baseDir)).toThrow(/owner is invalid/i);
    expect(readFileSync(join(lockDirectory, "owner.json"), "utf8")).toBe(malformedOwner);
  });

  it("rejects a junction alias before creating a second lock namespace", () => {
    const { acquireCardsDataWriteLock, cardsDataWriteLockDirectory } = require("../../scripts/cards/official-api.cjs");
    const root = tempDir();
    const baseDir = join(root, "cards-data");
    const aliasDir = join(root, "cards-alias");
    mkdirSync(baseDir);
    symlinkSync(baseDir, aliasDir, "junction");

    expect(() => acquireCardsDataWriteLock(aliasDir)).toThrow(/canonical plain-directory path/i);
    expect(existsSync(cardsDataWriteLockDirectory(aliasDir))).toBe(false);
  });

  it.skipIf(process.platform !== "win32")("canonicalizes Windows path casing before deriving the gate and lock paths", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "Cards-Data");
    mkdirSync(baseDir);

    const lockToken = acquireCardsDataWriteLock(baseDir.toLowerCase());

    expect(releaseCardsDataWriteLock(baseDir.toLowerCase(), lockToken)).toBe(true);
    expect(readdirSync(transactionDirectory(baseDir))).toEqual([]);
  });

  it.skipIf(process.platform !== "win32")("recovers an exited owner through a case alias while the cards-data root is absent", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "Cards-Data");
    const modulePath = resolve(process.cwd(), "scripts", "cards", "official-api.cjs");
    const child = spawnSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(modulePath)}).acquireCardsDataWriteLock(process.argv[1]);`,
      baseDir,
    ], { encoding: "utf8" });
    expect(child.status, child.stderr).toBe(0);

    const recovered = acquireCardsDataWriteLock(baseDir.toLowerCase());

    expect(releaseCardsDataWriteLock(baseDir, recovered)).toBe(true);
    expect(existsSync(cardsDataWriteLockDirectory(baseDir))).toBe(false);
  });

  it("rejects a raw writer whose declared lock root differs from its output root before network", async () => {
    const {
      acquireCardsDataWriteLock,
      fetchAndWriteAllCards,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const root = tempDir();
    const actualBaseDir = join(root, "cards-data");
    const outputDir = join(actualBaseDir, "_raw");
    const unrelatedBaseDir = join(root, "unrelated");
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(unrelatedBaseDir);
    writeFileSync(join(outputDir, "old-api.json"), "old raw\n");
    const actualLock = acquireCardsDataWriteLock(actualBaseDir);
    let fetchCalls = 0;

    await expect(fetchAndWriteAllCards({
      baseDir: unrelatedBaseDir,
      outputDir,
      fetchImpl: async () => {
        fetchCalls += 1;
        return response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1));
      },
    })).rejects.toThrow(/output root does not match/i);

    expect(fetchCalls).toBe(0);
    expect(readFileSync(join(outputDir, "old-api.json"), "utf8")).toBe("old raw\n");
    expect(releaseCardsDataWriteLock(actualBaseDir, actualLock)).toBe(true);
  });

  it("reports a contaminated write lock as cleanup-pending without deleting it", () => {
    const {
      acquireCardsDataWriteLock,
      cardsDataWriteLockDirectory,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    const lockToken = acquireCardsDataWriteLock(baseDir);
    const lockDirectory = cardsDataWriteLockDirectory(baseDir);
    writeFileSync(join(lockDirectory, "unexpected.txt"), "preserve for operator review\n");

    expect(releaseCardsDataWriteLock(baseDir, lockToken)).toBe(false);
    expect(readFileSync(join(lockDirectory, "unexpected.txt"), "utf8")).toBe("preserve for operator review\n");
  });

  it("blocks every direct cards-data metadata or TSV writer behind the shared lock", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
    } = require("../../scripts/cards/official-api.cjs");
    const { writeCardsDataStatusLocked } = require("../../scripts/cards/cards-data-status.cjs");
    const { writeQaHashSnapshotLocked } = require("../../scripts/cards/write-qa-hash-snapshot.cjs");
    const { regenerateAllLocked } = require("../../.claude/specs/cards-data/_regen_all.cjs");
    const root = tempDir();
    const baseDir = join(root, ".claude", "specs", "cards-data");
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "status.json"), "preserve status\n");
    const lockToken = acquireCardsDataWriteLock(baseDir);

    try {
      expect(() => writeCardsDataStatusLocked(root)).toThrow(/write lock is already held/i);
      expect(() => writeQaHashSnapshotLocked(root)).toThrow(/write lock is already held/i);
      expect(() => regenerateAllLocked({ baseDir })).toThrow(/write lock is already held/i);
      expect(readFileSync(join(baseDir, "status.json"), "utf8")).toBe("preserve status\n");
    } finally {
      expect(releaseCardsDataWriteLock(baseDir, lockToken)).toBe(true);
    }
  });

  it("rolls back a status writer failure through the shared root transaction", () => {
    const { writeCardsDataStatusLocked } = require("../../scripts/cards/cards-data-status.cjs");
    const root = tempDir();
    const { baseDir } = seedAtomicCardsDataFixture(root);
    const statusPath = join(baseDir, "status.json");
    writeFileSync(statusPath, "old status\n");

    expect(() => writeCardsDataStatusLocked(root, { fetchedAt: "2026-08-13T00:00:00.000Z" }, {
      hooks: { afterBackupMoved: () => { throw new Error("status interrupted"); } },
    })).toThrow("status interrupted");

    expect(readFileSync(statusPath, "utf8")).toBe("old status\n");
  });

  it("rolls back a Q&A snapshot writer failure through the shared root transaction", () => {
    const { generateCardsDataStatus } = require("../../scripts/cards/cards-data-status.cjs");
    const { writeQaHashSnapshotLocked } = require("../../scripts/cards/write-qa-hash-snapshot.cjs");
    const root = tempDir();
    const { baseDir } = seedAtomicCardsDataFixture(root);
    writeFileSync(join(baseDir, "status.json"), `${JSON.stringify(generateCardsDataStatus(root, {
      fetchedAt: "2026-08-13T00:00:00.000Z",
    }), null, 2)}\n`);
    const snapshotPath = join(baseDir, "qa-hash-snapshot.json");
    writeFileSync(snapshotPath, "old snapshot\n");

    expect(() => writeQaHashSnapshotLocked(root, {
      hooks: { afterBackupMoved: () => { throw new Error("Q&A interrupted"); } },
    })).toThrow("Q&A interrupted");

    expect(readFileSync(snapshotPath, "utf8")).toBe("old snapshot\n");
  });

  it("rolls back a TSV regeneration failure through the shared root transaction", () => {
    const { regenerateAllLocked } = require("../../.claude/specs/cards-data/_regen_all.cjs");
    const root = tempDir();
    const { baseDir, packageDir } = seedAtomicCardsDataFixture(root);
    const tsvPath = join(packageDir, "character.tsv");

    expect(() => regenerateAllLocked({
      baseDir,
      hooks: { afterBackupMoved: () => { throw new Error("TSV interrupted"); } },
    })).toThrow("TSV interrupted");

    expect(readFileSync(tsvPath, "utf8")).toBe("cardNum\nB01001\n");
  });

  it("does not delete a victim directory swapped into a failed root-mutation stage", () => {
    const { mutateCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    writeFileSync(join(baseDir, "old.txt"), "old\n");
    let swappedStage = "";

    expect(() => mutateCardsDataRoot({
      baseDir,
      mutate: ({ baseDir: stagedBaseDir }: { baseDir: string }) => {
        const ownedStage = `${stagedBaseDir}.owned`;
        const victim = tempDir();
        writeFileSync(join(victim, "sentinel.txt"), "preserve\n");
        renameSync(stagedBaseDir, ownedStage);
        renameSync(victim, stagedBaseDir);
        swappedStage = stagedBaseDir;
        throw new Error("mutation interrupted after stage swap");
      },
    })).toThrow("mutation interrupted after stage swap");

    expect(readFileSync(join(swappedStage, "sentinel.txt"), "utf8")).toBe("preserve\n");
    expect(readFileSync(join(baseDir, "old.txt"), "utf8")).toBe("old\n");
  });

  it("does not delete a victim directory swapped into a failed fetch-regeneration stage", async () => {
    const { fetchAndRegenerateAllCards } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    mkdirSync(baseDir);
    writeFileSync(join(baseDir, "old.txt"), "old\n");
    let swappedStage = "";

    await expect(fetchAndRegenerateAllCards({
      baseDir,
      fetchImpl: async () => response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1)),
      regenerate: ({ baseDir: stagedBaseDir }: { baseDir: string }) => {
        const ownedStage = `${stagedBaseDir}.owned`;
        const victim = tempDir();
        writeFileSync(join(victim, "sentinel.txt"), "preserve\n");
        renameSync(stagedBaseDir, ownedStage);
        renameSync(victim, stagedBaseDir);
        swappedStage = stagedBaseDir;
        throw new Error("regeneration interrupted after stage swap");
      },
    })).rejects.toThrow("regeneration interrupted after stage swap");

    expect(readFileSync(join(swappedStage, "sentinel.txt"), "utf8")).toBe("preserve\n");
    expect(readFileSync(join(baseDir, "old.txt"), "utf8")).toBe("old\n");
  });

  it("removes obsolete package and kind TSVs before publishing a regenerated generation", () => {
    const { regenerateAllLocked } = require("../../.claude/specs/cards-data/_regen_all.cjs");
    const root = tempDir();
    const { baseDir, packageDir } = seedAtomicCardsDataFixture(root);
    const obsoletePackageDir = join(baseDir, "ct-p02");
    mkdirSync(obsoletePackageDir);
    writeFileSync(join(packageDir, "event.tsv"), "cardNum\nB01002\n");
    writeFileSync(join(obsoletePackageDir, "character.tsv"), "cardNum\nB02001\n");

    regenerateAllLocked({ baseDir });

    expect(readdirSync(packageDir)).toEqual(["character.tsv"]);
    expect(existsSync(obsoletePackageDir)).toBe(false);
  });

  it("recovers an interrupted root swap before a live snapshot reader runs", () => {
    const {
      replaceStagedCardsDataRoot,
      withCardsDataSnapshot,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-reader-recovery");
    mkdirSync(baseDir);
    mkdirSync(stagedBaseDir);
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");

    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterBackupMoved: () => { throw new Error("interrupted"); } },
    })).toThrow("interrupted");
    expect(existsSync(baseDir)).toBe(false);

    const observed = withCardsDataSnapshot({
      baseDir,
      read: ({ recovery }: { recovery: { recovered: number } }) => ({
        marker: readFileSync(join(baseDir, "marker.txt"), "utf8"),
        recovered: recovery.recovered,
      }),
    });
    expect(observed).toEqual({ marker: "old\n", recovered: 1 });
  });

  it("returns busy without invoking a reader during the root-swap gap", () => {
    const {
      acquireCardsDataWriteLock,
      releaseCardsDataWriteLock,
      replaceStagedCardsDataRoot,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-reader-busy");
    mkdirSync(baseDir);
    mkdirSync(stagedBaseDir);
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");
    const lockToken = acquireCardsDataWriteLock(baseDir);
    const officialApiPath = resolve(__dirname, "..", "..", "scripts", "cards", "official-api.cjs");
    let childResult: ReturnType<typeof spawnSync> | undefined;

    try {
      replaceStagedCardsDataRoot({
        baseDir,
        stagedBaseDir,
        lockToken,
        hooks: {
          afterBackupMoved: () => {
            expect(existsSync(baseDir)).toBe(false);
            childResult = spawnSync(process.execPath, ["-e", `
              const { withCardsDataSnapshot } = require(${JSON.stringify(officialApiPath)});
              let called = false;
              try {
                withCardsDataSnapshot({
                  baseDir: ${JSON.stringify(baseDir)},
                  read: () => { called = true; },
                });
                process.stdout.write('UNEXPECTED_SUCCESS:' + called);
              } catch (error) {
                process.stdout.write(String(error.code) + ':' + called);
                process.exitCode = 7;
              }
            `], { encoding: "utf8", timeout: 10_000 });
          },
        },
      });
    } finally {
      expect(releaseCardsDataWriteLock(baseDir, lockToken)).toBe(true);
    }

    expect(childResult?.status).toBe(7);
    expect(childResult?.stdout).toBe("CARDS_DATA_BUSY:false");
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("new\n");
  });

  it("keeps a cross-process reader on one complete generation before publication", async () => {
    const {
      replaceStagedCardsDataRoot,
      withCardsDataSnapshot,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-generation");
    const readyPath = join(parentDir, "reader-ready");
    const officialApiPath = resolve(__dirname, "..", "..", "scripts", "cards", "official-api.cjs");
    for (const root of [baseDir, stagedBaseDir]) mkdirSync(join(root, "ct-p01"), { recursive: true });
    writeFileSync(join(baseDir, "status.json"), "old-status\n");
    writeFileSync(join(baseDir, "ct-p01", "character.tsv"), "old-tsv\n");
    writeFileSync(join(stagedBaseDir, "status.json"), "new-status\n");
    writeFileSync(join(stagedBaseDir, "ct-p01", "character.tsv"), "new-tsv\n");

    let stdout = "";
    let stderr = "";
    const child = spawn(process.execPath, ["-e", `
      const fs = require('node:fs');
      const path = require('node:path');
      const { withCardsDataSnapshot } = require(${JSON.stringify(officialApiPath)});
      const value = withCardsDataSnapshot({
        baseDir: ${JSON.stringify(baseDir)},
        read: () => {
          const first = [
            fs.readFileSync(path.join(${JSON.stringify(baseDir)}, 'status.json'), 'utf8').trim(),
            fs.readFileSync(path.join(${JSON.stringify(baseDir)}, 'ct-p01', 'character.tsv'), 'utf8').trim(),
          ];
          fs.writeFileSync(${JSON.stringify(readyPath)}, 'ready');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
          const second = [
            fs.readFileSync(path.join(${JSON.stringify(baseDir)}, 'status.json'), 'utf8').trim(),
            fs.readFileSync(path.join(${JSON.stringify(baseDir)}, 'ct-p01', 'character.tsv'), 'utf8').trim(),
          ];
          return { first, second };
        },
      });
      process.stdout.write(JSON.stringify(value));
    `]);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => { stdout += value; });
    child.stderr.on("data", (value) => { stderr += value; });
    const exitPromise = new Promise<number | null>((resolveExit) => {
      child.once("exit", (code) => resolveExit(code));
    });
    const deadline = Date.now() + 5_000;
    while (!existsSync(readyPath) && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
    expect(existsSync(readyPath)).toBe(true);
    expect(() => replaceStagedCardsDataRoot({ baseDir, stagedBaseDir })).toThrow(/write lock is already held/i);
    const exitCode = await exitPromise;
    expect({ exitCode, stderr, stdout }).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({ first: ["old-status", "old-tsv"], second: ["old-status", "old-tsv"] }),
    });

    replaceStagedCardsDataRoot({ baseDir, stagedBaseDir });
    expect(withCardsDataSnapshot({
      baseDir,
      read: () => [
        readFileSync(join(baseDir, "status.json"), "utf8").trim(),
        readFileSync(join(baseDir, "ct-p01", "character.tsv"), "utf8").trim(),
      ],
    })).toEqual(["new-status", "new-tsv"]);
  });

  it.each([
    ["after live root moves", "afterBackupMoved", 71, "old"],
    ["after staged root installs", "afterInstalled", 72, "old"],
    ["after the installed journal commits", "cleanup", 73, "new"],
  ] as const)("recovers for the next gated reader %s", (_label, crashPoint, exitStatus, expected) => {
    const { withCardsDataSnapshot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, `.cards-data.stage-crash-${exitStatus}`);
    const officialApiPath = resolve(__dirname, "..", "..", "scripts", "cards", "official-api.cjs");
    mkdirSync(baseDir);
    mkdirSync(stagedBaseDir);
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");
    const options = crashPoint === "cleanup"
      ? `rmSync: () => process.exit(${exitStatus})`
      : `hooks: { ${crashPoint}: () => process.exit(${exitStatus}) }`;
    const child = spawnSync(process.execPath, ["-e", `
      const { replaceStagedCardsDataRoot } = require(${JSON.stringify(officialApiPath)});
      replaceStagedCardsDataRoot({
        baseDir: ${JSON.stringify(baseDir)},
        stagedBaseDir: ${JSON.stringify(stagedBaseDir)},
        ${options},
      });
    `], { encoding: "utf8", timeout: 10_000 });
    expect(child.status, child.stderr).toBe(exitStatus);

    expect(withCardsDataSnapshot({
      baseDir,
      read: () => readFileSync(join(baseDir, "marker.txt"), "utf8").trim(),
    })).toBe(expected);
  });

  it("recovers the prior root after an interrupted root swap", () => {
    const { recoverCardsDataTransactions, replaceStagedCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-test");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");

    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterBackupMoved: () => { throw new Error("simulated process interruption"); } },
    })).toThrow("simulated process interruption");
    expect(existsSync(baseDir)).toBe(false);

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ recovered: 1, cleanupPending: 0 });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
  });

  it("keeps the installed root successful when backup cleanup is busy", () => {
    const { replaceStagedCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-test");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");

    const result = replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      rmSync: (target: string, options: Parameters<typeof rmSync>[1]) => {
        if (target.includes(".backup-")) throw new Error("EBUSY");
        return rmSync(target, options);
      },
    });

    expect(result).toMatchObject({ cleanupPending: true });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("new\n");
  });

  it("restores the prior root when post-install verification fails", () => {
    const { recoverCardsDataTransactions, replaceStagedCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-test");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");

    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterInstalled: () => { throw new Error("verification failed"); } },
    })).toThrow("verification failed");

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ recovered: 1, cleanupPending: 0 });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
    expect(existsSync(stagedBaseDir)).toBe(false);
  });

  it("restores the prior root when install rename succeeds and then throws", () => {
    const { recoverCardsDataTransactions, replaceStagedCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-test");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");
    let renameCalls = 0;

    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      renameSync: (from: string, to: string) => {
        renameCalls += 1;
        renameSync(from, to);
        if (renameCalls === 2) throw new Error("simulated crash after install rename");
      },
    })).toThrow("simulated crash after install rename");

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ recovered: 1, cleanupPending: 0 });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
  });

  it("promotes and recovers a journal temp left before its atomic rename", () => {
    const {
      recoverCardsDataTransactions,
      replaceStagedCardsDataRoot,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-interrupted");
    const journalDir = transactionDirectory(baseDir);
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir);
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");
    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterBackupMoved: () => { throw new Error("interrupted"); } },
    })).toThrow("interrupted");
    const journalName = readdirSync(journalDir).find((name) => name.endsWith(".json"));
    expect(journalName).toBeTruthy();
    const temporaryName = `${journalName}.tmp-22222222-2222-4222-8222-222222222222`;
    renameSync(join(journalDir, journalName!), join(journalDir, temporaryName));

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({
      recovered: 1,
      journalWritesRecovered: 1,
      cleanupPending: 0,
      rejected: 0,
    });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
    expect(existsSync(stagedBaseDir)).toBe(false);
    expect(readdirSync(journalDir)).toEqual([]);
  });

  it("counts journal-write repair separately from a root rollback", () => {
    const {
      recoverCardsDataTransactions,
      replaceStagedCardsDataRoot,
      transactionDirectory,
    } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-counts");
    mkdirSync(baseDir);
    mkdirSync(stagedBaseDir);
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");
    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterBackupMoved: () => { throw new Error("interrupted"); } },
    })).toThrow("interrupted");
    const journalDir = transactionDirectory(baseDir);
    const journalName = readdirSync(journalDir).find((name) => name.endsWith(".json"));
    expect(journalName).toBeTruthy();
    writeFileSync(
      join(journalDir, `${journalName}.tmp-33333333-3333-4333-8333-333333333333`),
      readFileSync(join(journalDir, journalName!), "utf8"),
    );

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({
      recovered: 1,
      journalWritesRecovered: 1,
      cleanupPending: 0,
      rejected: 0,
    });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
  });

  it("finishes rollback cleanup after deletion succeeds and then throws", () => {
    const { recoverCardsDataTransactions, replaceStagedCardsDataRoot } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-test");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(baseDir, "marker.txt"), "old\n");
    writeFileSync(join(stagedBaseDir, "marker.txt"), "new\n");

    expect(() => replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      hooks: { afterInstalled: () => { throw new Error("verification failed"); } },
    })).toThrow("verification failed");
    let deletedStage = false;
    expect(recoverCardsDataTransactions({
      baseDir,
      rmSync: (target: string, options: Parameters<typeof rmSync>[1]) => {
        rmSync(target, options);
        if (!deletedStage && target.includes(".stage-")) {
          deletedStage = true;
          throw new Error("simulated crash after stage deletion");
        }
      },
    })).toMatchObject({ recovered: 1, cleanupPending: 1 });

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ recovered: 0, cleanupPending: 0 });
    expect(readFileSync(join(baseDir, "marker.txt"), "utf8")).toBe("old\n");
  });

  it("recovers the prior root when installing the staged root fails", async () => {
    const { fetchAndRegenerateAllCards } = require("../../scripts/cards/official-api.cjs");
    const baseDir = join(tempDir(), "cards-data");
    const rawDir = join(baseDir, "_raw");
    const packageDir = join(baseDir, "ct-p01");
    mkdirSync(rawDir, { recursive: true });
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(rawDir, "old-api.json"), "old raw\n");
    writeFileSync(join(packageDir, "character.tsv"), "old tsv\n");
    const nativeRename = require("node:fs").renameSync;

    await expect(fetchAndRegenerateAllCards({
      baseDir,
      fetchImpl: async () => response(page([{ card_num: "B01001", package: "CT-P01 set" }], 1, 1)),
      regenerate: ({ baseDir: stagedBaseDir }: { baseDir: string }) => {
        mkdirSync(join(stagedBaseDir, "ct-p01"), { recursive: true });
        writeFileSync(join(stagedBaseDir, "ct-p01", "character.tsv"), "new tsv\n");
      },
      renameSync: (from: string, to: string) => {
        if (to === baseDir && from.includes(".cards-data.stage-")) throw new Error("install failed");
        return nativeRename(from, to);
      },
    })).rejects.toThrow("install failed");

    expect(readFileSync(join(rawDir, "old-api.json"), "utf8")).toBe("old raw\n");
    expect(readFileSync(join(packageDir, "character.tsv"), "utf8")).toBe("old tsv\n");
  });

  it("quarantines an unsafe journal without deleting its external paths", () => {
    const { recoverCardsDataTransactions, transactionDirectory } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const externalDir = join(parentDir, "external");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(externalDir, { recursive: true });
    writeFileSync(join(externalDir, "keep.txt"), "do not remove\n");
    const journalDir = transactionDirectory(baseDir);
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(join(journalDir, "unsafe.json"), JSON.stringify({
      version: 1,
      baseDir,
      stagedBaseDir: externalDir,
      backupDir: externalDir,
      state: "installed",
    }));

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ rejected: 1 });
    expect(readFileSync(join(externalDir, "keep.txt"), "utf8")).toBe("do not remove\n");
    expect(existsSync(join(journalDir, "unsafe.json"))).toBe(false);
    expect(readdirSync(join(journalDir, "quarantine"))).toHaveLength(1);
  });

  it("quarantines an unowned managed-name journal without deleting the named victim", () => {
    const { recoverCardsDataTransactions, transactionDirectory } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-victim");
    const backupDir = join(parentDir, ".cards-data.backup-forged");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(stagedBaseDir, { recursive: true });
    writeFileSync(join(stagedBaseDir, "keep.txt"), "do not remove\n");
    const journalDir = transactionDirectory(baseDir);
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(join(journalDir, "forged.json"), JSON.stringify({
      version: 1,
      baseDir,
      stagedBaseDir,
      backupDir,
      state: "installed",
    }));

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ rejected: 1 });
    expect(readFileSync(join(stagedBaseDir, "keep.txt"), "utf8")).toBe("do not remove\n");
    expect(existsSync(join(journalDir, "forged.json"))).toBe(false);
    expect(readdirSync(join(journalDir, "quarantine"))).toHaveLength(1);
  });

  it("quarantines a managed-name reparse point without following it", () => {
    const { recoverCardsDataTransactions, transactionDirectory } = require("../../scripts/cards/official-api.cjs");
    const parentDir = tempDir();
    const baseDir = join(parentDir, "cards-data");
    const externalDir = join(parentDir, "external");
    const stagedBaseDir = join(parentDir, ".cards-data.stage-link");
    const backupDir = join(parentDir, ".cards-data.backup-link");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(externalDir, { recursive: true });
    writeFileSync(join(externalDir, "keep.txt"), "do not follow\n");
    symlinkSync(externalDir, stagedBaseDir, "junction");
    const journalDir = transactionDirectory(baseDir);
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(join(journalDir, "reparse.json"), JSON.stringify({ version: 1, baseDir, stagedBaseDir, backupDir, state: "prepared" }));

    expect(recoverCardsDataTransactions({ baseDir })).toMatchObject({ rejected: 1 });
    expect(readFileSync(join(externalDir, "keep.txt"), "utf8")).toBe("do not follow\n");
  });

  it("ignores transaction journals and interrupted stage or backup roots", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");

    expect(gitignore).toContain("/.claude/specs/.cards-data.transactions/");
    expect(gitignore).toContain("/.claude/specs/.cards-data.stage-*");
    expect(gitignore).toContain("/.claude/specs/.cards-data.backup-*");
    expect(gitignore).toContain("/.claude/specs/.cards-data.publish.lock/");
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
