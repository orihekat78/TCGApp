import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const WAIT_MS = 50;
const TIMEOUT_MS = 120_000;
const INCOMPLETE_OWNER_STALE_MS = 5_000;

type LockOwner = {
  pid: number;
  createdAt: number;
  token: string;
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return String((error as { code?: unknown }).code);
}

function lockDirectory(repoRoot: string): string {
  const identity = createHash("sha256")
    .update(`${resolve(repoRoot).toLowerCase()}\0${process.ppid}`)
    .digest("hex")
    .slice(0, 16);
  return join(tmpdir(), `conan-private-hosted-dist-${identity}.lock`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

async function staleLock(directory: string): Promise<boolean> {
  const owner = await readFile(join(directory, "owner"), "utf8")
    .then((text) => JSON.parse(text) as Partial<LockOwner>)
    .catch(() => undefined);
  if (
    typeof owner?.pid === "number" &&
    typeof owner.createdAt === "number" &&
    typeof owner.token === "string"
  ) {
    return !processIsAlive(owner.pid);
  }
  const lockStat = await stat(directory).catch(() => undefined);
  return Boolean(
    lockStat && Date.now() - lockStat.mtimeMs > INCOMPLETE_OWNER_STALE_MS,
  );
}

async function reclaimStaleLock(directory: string): Promise<void> {
  if (!(await staleLock(directory))) return;
  const tombstone = `${directory}.stale-${process.pid}-${randomUUID()}`;
  try {
    await rename(directory, tombstone);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    return;
  }
  await rm(tombstone, { recursive: true, force: true });
}

/** Serializes tests that build or inspect the checkout-owned dist directory. */
export async function acquireRepositoryDistLock(
  repoRoot = process.cwd(),
): Promise<() => Promise<void>> {
  const directory = lockDirectory(repoRoot);
  const deadline = Date.now() + TIMEOUT_MS;

  while (true) {
    try {
      await mkdir(directory);
      const owner: LockOwner = {
        pid: process.pid,
        createdAt: Date.now(),
        token: randomUUID(),
      };
      try {
        await writeFile(join(directory, "owner"), JSON.stringify(owner), "utf8");
      } catch (error) {
        await rm(directory, { recursive: true, force: true });
        throw error;
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        const currentToken = await readFile(join(directory, "owner"), "utf8")
          .then((text) => (JSON.parse(text) as Partial<LockOwner>).token)
          .catch(() => undefined);
        if (currentToken === owner.token) {
          await rm(directory, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      await reclaimStaleLock(directory);
      if (Date.now() >= deadline) {
        throw new Error("timed out waiting for repository dist test lock", {
          cause: error,
        });
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, WAIT_MS));
    }
  }
}
