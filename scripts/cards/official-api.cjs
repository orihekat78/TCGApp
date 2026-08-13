const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { Worker } = require("node:worker_threads");

const OFFICIAL_CARDS_URL =
  "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards";
const PACKAGE_CODE = /^(CT-(?:D|P)\d{2}|PR-\d{2})\b/;
const PACKAGE_DIRECTORY = /^(?:ct-(?:d|p)\d{2}|pr-\d{2})$/;
const LOCK_OWNER_FILENAME = "owner.json";
const LIVE_CARDS_DATA_DIR = path.resolve(__dirname, "..", "..", ".claude", "specs", "cards-data");
const LOCK_NONCE = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const KERNEL_GATE_WORKER = String.raw`
  const net = require("node:net");
  const { parentPort, workerData } = require("node:worker_threads");
  const state = new Int32Array(workerData.state);
  let ready = false;
  const finishReady = (code) => {
    if (ready) return;
    ready = true;
    Atomics.store(state, 1, code);
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0);
  };
  const clients = new Set();
  const server = net.createServer((socket) => {
    clients.add(socket);
    socket.once("close", () => clients.delete(socket));
    socket.once("error", () => clients.delete(socket));
    socket.write(workerData.mode);
    Atomics.store(state, 3, 1);
    Atomics.notify(state, 3);
  });
  const listen = () => server.listen(workerData.endpoint);
  const waitForReaderRelease = () => {
    let holderMode = "";
    let settled = false;
    const socket = net.createConnection(workerData.endpoint);
    const retryListen = () => {
      if (settled || ready) return;
      settled = true;
      socket.destroy();
      listen();
    };
    socket.on("data", (chunk) => {
      holderMode += chunk.toString("utf8");
      if (holderMode === "writer") {
        settled = true;
        socket.destroy();
        finishReady(1);
      } else if (holderMode !== "reader" && !"reader".startsWith(holderMode)) {
        settled = true;
        socket.destroy();
        finishReady(2);
      }
    });
    socket.once("error", (error) => {
      if (error && (error.code === "ECONNREFUSED" || error.code === "ENOENT")) retryListen();
      else finishReady(2);
    });
    socket.once("close", () => {
      if (settled || ready) return;
      if (holderMode === "writer") finishReady(1);
      else retryListen();
    });
  };
  server.on("error", (error) => {
    if (!error || error.code !== "EADDRINUSE") finishReady(2);
    else if (!workerData.waitForReader) finishReady(1);
    else waitForReaderRelease();
  });
  server.on("listening", () => finishReady(0));
  listen();
  parentPort.once("message", () => {
    for (const socket of clients) socket.destroy();
    server.close(() => process.exit(0));
  });
  process.once("exit", () => {
    Atomics.store(state, 2, 1);
    Atomics.notify(state, 2);
  });
`;

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

function writeRawPackagesToStaging(cards, outputDir) {
  const resolvedOutputDir = path.resolve(outputDir);
  if ((sameFilesystemPath(path.dirname(resolvedOutputDir), LIVE_CARDS_DATA_DIR)
    || sameExistingDirectory(path.dirname(resolvedOutputDir), LIVE_CARDS_DATA_DIR))
    && path.basename(resolvedOutputDir).toLowerCase() === "_raw") {
    throw new Error("direct raw mutation of the live cards-data root is forbidden");
  }
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

function normalizeFilesystemNamespacePath(target) {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function transactionDirectory(baseDir) {
  const resolvedBaseDir = normalizeFilesystemNamespacePath(baseDir);
  return path.join(path.dirname(resolvedBaseDir), `.${path.basename(resolvedBaseDir)}.transactions`);
}

function cardsDataWriteLockDirectory(baseDir) {
  const resolvedBaseDir = normalizeFilesystemNamespacePath(baseDir);
  return path.join(path.dirname(resolvedBaseDir), `.${path.basename(resolvedBaseDir)}.publish.lock`);
}

function sameFilesystemPath(left, right) {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function sameExistingDirectory(left, right) {
  try {
    return sameFilesystemPath(fs.realpathSync.native(left), fs.realpathSync.native(right));
  } catch {
    return false;
  }
}

function resolveCanonicalCardsDataBaseDir(baseDir) {
  const resolved = path.resolve(baseDir);
  const parent = path.dirname(resolved);
  const parentStat = fs.lstatSync(parent);
  const canonicalParent = fs.realpathSync.native(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()
    || !sameFilesystemPath(canonicalParent, parent)) {
    throw new Error("cards-data write lock parent must use its canonical plain-directory path");
  }
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    const canonical = fs.realpathSync.native(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !sameFilesystemPath(canonical, resolved)) {
      throw new Error("cards-data write lock root must use its canonical plain-directory path");
    }
    return normalizeFilesystemNamespacePath(canonical);
  }
  return normalizeFilesystemNamespacePath(path.join(canonicalParent, path.basename(resolved)));
}

function kernelGateEndpoint(baseDir) {
  const digest = createHash("sha256").update(normalizeFilesystemNamespacePath(baseDir)).digest("hex");
  if (process.platform === "win32") return `\\\\.\\pipe\\conan-cards-data-${digest}`;
  const port = 49_152 + Number.parseInt(digest.slice(0, 4), 16) % 16_384;
  return { host: "127.0.0.1", port, exclusive: true };
}

function acquireCardsDataKernelGate(baseDir, { mode = "writer", waitForReader = false } = {}) {
  if (mode !== "reader" && mode !== "writer") throw new Error("cards-data kernel gate mode is invalid");
  const stateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 4);
  const state = new Int32Array(stateBuffer);
  const endpoint = kernelGateEndpoint(baseDir);
  const worker = new Worker(KERNEL_GATE_WORKER, {
    eval: true,
    workerData: { endpoint, state: stateBuffer, mode, waitForReader },
  });
  worker.unref();
  const waitTimeoutMs = mode === "reader" && waitForReader ? 15_000 : 5_000;
  const waitResult = Atomics.wait(state, 0, 0, waitTimeoutMs);
  const result = Atomics.load(state, 1);
  if (waitResult === "timed-out" || Atomics.load(state, 0) !== 1 || result !== 0) {
    void worker.terminate();
    if (result === 1) {
      const error = new Error("cards-data write lock is already held");
      error.code = "CARDS_DATA_BUSY";
      throw error;
    }
    throw new Error("cards-data kernel write gate could not be acquired");
  }
  return { worker, state, endpoint };
}

function assertCardsDataKernelGate(gate) {
  if (!gate || !(gate.state instanceof Int32Array) || Atomics.load(gate.state, 0) !== 1
    || Atomics.load(gate.state, 1) !== 0 || Atomics.load(gate.state, 2) !== 0) {
    throw new Error("cards-data kernel write gate is not active");
  }
}

function releaseCardsDataKernelGate(gate) {
  try {
    assertCardsDataKernelGate(gate);
    gate.worker.postMessage("release");
    Atomics.wait(gate.state, 2, 0, 5_000);
    return Atomics.load(gate.state, 2) === 1;
  } catch {
    return false;
  }
}

function cardsDataWriteLockRecoveryDirectory(baseDir) {
  return path.join(transactionDirectory(baseDir), "write-lock-recovery");
}

function readCardsDataWriteLock(lockDirectory, baseDir) {
  const stat = fs.lstatSync(lockDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || !sameFilesystemPath(fs.realpathSync.native(lockDirectory), path.resolve(lockDirectory))
    || JSON.stringify(fs.readdirSync(lockDirectory).sort()) !== JSON.stringify([LOCK_OWNER_FILENAME])) {
    throw new Error("cards-data write lock is unsafe");
  }
  const ownerPath = path.join(lockDirectory, LOCK_OWNER_FILENAME);
  const ownerStat = fs.lstatSync(ownerPath);
  if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) throw new Error("cards-data write lock owner is unsafe");
  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
  } catch (error) {
    throw new Error("cards-data write lock owner is invalid", { cause: error });
  }
  if (!owner || Array.isArray(owner) || typeof owner !== "object"
    || JSON.stringify(Object.keys(owner).sort()) !== JSON.stringify(["nonce", "pid", "schemaVersion"])
    || owner.schemaVersion !== 1 || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
    || typeof owner.nonce !== "string" || !LOCK_NONCE.test(owner.nonce)) {
    throw new Error("cards-data write lock owner is invalid");
  }
  return {
    baseDir: path.resolve(baseDir),
    lockDirectory: fs.realpathSync.native(lockDirectory),
    device: stat.dev,
    inode: stat.ino,
    pid: owner.pid,
    nonce: owner.nonce,
  };
}

function sameCardsDataWriteLockIdentity(left, right) {
  return left.device === right.device && left.inode === right.inode
    && left.pid === right.pid && left.nonce === right.nonce;
}

function assertOwnedCardsDataWriteLock(lockToken) {
  const current = readCardsDataWriteLock(lockToken.lockDirectory, lockToken.baseDir);
  if (current.device !== lockToken.device || current.inode !== lockToken.inode
    || current.pid !== lockToken.pid || current.nonce !== lockToken.nonce) {
    throw new Error("cards-data write lock identity changed");
  }
}

function removeLockCleanupDirectory(baseDir, directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTransactionDirectory = path.resolve(transactionDirectory(baseDir));
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || !sameFilesystemPath(fs.realpathSync.native(directory), resolvedDirectory)
    || !sameFilesystemPath(path.dirname(resolvedDirectory), resolvedTransactionDirectory)
    || !path.basename(resolvedDirectory).startsWith(".lock-cleanup-")) {
    throw new Error("cards-data write lock cleanup path is unsafe");
  }
  const entries = fs.readdirSync(resolvedDirectory).sort();
  if (JSON.stringify(entries) !== JSON.stringify([])
    && JSON.stringify(entries) !== JSON.stringify([LOCK_OWNER_FILENAME])) {
    throw new Error("cards-data write lock cleanup contents are unsafe");
  }
  if (entries.length === 1) {
    const ownerStat = fs.lstatSync(path.join(resolvedDirectory, LOCK_OWNER_FILENAME));
    if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) {
      throw new Error("cards-data write lock cleanup owner is unsafe");
    }
  }
  fs.rmSync(resolvedDirectory, { recursive: true, force: true });
}

function moveOwnedCardsDataWriteLockToCleanup(lockToken) {
  assertOwnedCardsDataWriteLock(lockToken);
  const cleanupDirectory = path.join(transactionDirectory(lockToken.baseDir), `.lock-cleanup-${randomUUID()}`);
  fs.renameSync(lockToken.lockDirectory, cleanupDirectory);
  const moved = readCardsDataWriteLock(cleanupDirectory, lockToken.baseDir);
  if (moved.device !== lockToken.device || moved.inode !== lockToken.inode
    || moved.pid !== lockToken.pid || moved.nonce !== lockToken.nonce) {
    throw new Error("cards-data write lock identity changed during cleanup isolation");
  }
  return cleanupDirectory;
}

function removeOwnedCardsDataWriteLock(lockToken) {
  removeLockCleanupDirectory(lockToken.baseDir, moveOwnedCardsDataWriteLockToCleanup(lockToken));
}

function prepareCardsDataWriteLockCandidate(baseDir) {
  const resolvedBaseDir = path.resolve(baseDir);
  const journalDirectory = transactionDirectory(resolvedBaseDir);
  fs.mkdirSync(journalDirectory, { recursive: true });
  const journalStat = fs.lstatSync(journalDirectory);
  if (!journalStat.isDirectory() || journalStat.isSymbolicLink()
    || !sameFilesystemPath(fs.realpathSync.native(journalDirectory), path.resolve(journalDirectory))) {
    throw new Error("cards-data write lock transaction root must use its canonical plain-directory path");
  }
  const candidateDirectory = path.join(journalDirectory, `.lock-candidate-${randomUUID()}`);
  fs.mkdirSync(candidateDirectory);
  try {
    const owner = { schemaVersion: 1, pid: process.pid, nonce: randomUUID() };
    fs.writeFileSync(path.join(candidateDirectory, LOCK_OWNER_FILENAME), `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
    return readCardsDataWriteLock(candidateDirectory, resolvedBaseDir);
  } catch (error) {
    if (fs.existsSync(candidateDirectory)) {
      const stat = fs.lstatSync(candidateDirectory);
      const entries = stat.isDirectory() && !stat.isSymbolicLink()
        ? fs.readdirSync(candidateDirectory).sort()
        : [];
      if (stat.isDirectory() && !stat.isSymbolicLink()
        && sameFilesystemPath(fs.realpathSync.native(candidateDirectory), candidateDirectory)
        && sameFilesystemPath(path.dirname(candidateDirectory), journalDirectory)
        && (entries.length === 0 || JSON.stringify(entries) === JSON.stringify([LOCK_OWNER_FILENAME]))) {
        fs.rmSync(candidateDirectory, { recursive: true, force: true });
      }
    }
    throw error;
  }
}

function removeIncompleteLockCandidate(baseDir, candidateDirectory) {
  const directory = path.resolve(transactionDirectory(baseDir));
  const candidate = path.resolve(candidateDirectory);
  if (!sameFilesystemPath(path.dirname(candidate), directory)
    || !/^\.lock-candidate-[a-f0-9-]{36}$/.test(path.basename(candidate))) {
    throw new Error("cards-data write lock candidate path is unsafe");
  }
  const stat = fs.lstatSync(candidate);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || !sameFilesystemPath(fs.realpathSync.native(candidate), candidate)) {
    throw new Error("cards-data write lock candidate is unsafe");
  }
  const entries = fs.readdirSync(candidate).sort();
  if (entries.length > 1 || (entries.length === 1 && entries[0] !== LOCK_OWNER_FILENAME)) {
    throw new Error("cards-data write lock candidate contents are unsafe");
  }
  if (entries.length === 1) {
    const ownerStat = fs.lstatSync(path.join(candidate, LOCK_OWNER_FILENAME));
    if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) {
      throw new Error("cards-data write lock candidate owner is unsafe");
    }
  }
  fs.rmSync(candidate, { recursive: true, force: true });
}

function cleanupOrphanedCardsDataWriteLocks(baseDir, activeCandidate) {
  const directory = transactionDirectory(baseDir);
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory).sort()) {
    if (name.startsWith(".lock-cleanup-")) {
      removeLockCleanupDirectory(baseDir, path.join(directory, name));
      continue;
    }
    if (name.startsWith(".lock-candidate-")) {
      const candidateDirectory = path.join(directory, name);
      if (activeCandidate && sameFilesystemPath(candidateDirectory, activeCandidate.lockDirectory)) continue;
      try {
        removeOwnedCardsDataWriteLock(readCardsDataWriteLock(candidateDirectory, baseDir));
      } catch (error) {
        if (!fs.existsSync(candidateDirectory)) continue;
        removeIncompleteLockCandidate(baseDir, candidateDirectory);
      }
      continue;
    }
    if (!name.startsWith(".stale-lock-")) continue;
    removeOwnedCardsDataWriteLock(readCardsDataWriteLock(path.join(directory, name), baseDir));
  }
}

function acquireCardsDataLock(baseDir, {
  afterReadStaleLock = () => undefined,
  kernelGateMode = "writer",
  waitForReader = false,
} = {}) {
  const resolvedBaseDir = resolveCanonicalCardsDataBaseDir(baseDir);
  const kernelGate = acquireCardsDataKernelGate(resolvedBaseDir, {
    mode: kernelGateMode,
    waitForReader,
  });
  const lockDirectory = cardsDataWriteLockDirectory(resolvedBaseDir);
  const recoveryDirectory = cardsDataWriteLockRecoveryDirectory(resolvedBaseDir);
  let candidate;
  let acquired = false;
  try {
    candidate = prepareCardsDataWriteLockCandidate(resolvedBaseDir);
    cleanupOrphanedCardsDataWriteLocks(resolvedBaseDir, candidate);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const currentCandidate = readCardsDataWriteLock(candidate.lockDirectory, resolvedBaseDir);
      if (!sameCardsDataWriteLockIdentity(currentCandidate, candidate)) {
        throw new Error("cards-data write lock candidate identity changed");
      }
      if (fs.existsSync(recoveryDirectory)) {
        const recovering = readCardsDataWriteLock(recoveryDirectory, resolvedBaseDir);
        const isolatedRecovery = path.join(transactionDirectory(resolvedBaseDir), `.stale-lock-${randomUUID()}`);
        try {
          fs.renameSync(recoveryDirectory, isolatedRecovery);
        } catch (error) {
          if (!fs.existsSync(recoveryDirectory)) continue;
          throw new Error("cards-data stale write lock recovery could not be isolated", { cause: error });
        }
        const isolated = readCardsDataWriteLock(isolatedRecovery, resolvedBaseDir);
        if (isolated.device !== recovering.device || isolated.inode !== recovering.inode
          || isolated.pid !== recovering.pid || isolated.nonce !== recovering.nonce) {
          throw new Error("cards-data stale write lock recovery identity changed");
        }
        removeOwnedCardsDataWriteLock(isolated);
        continue;
      }
      try {
        fs.renameSync(candidate.lockDirectory, lockDirectory);
        const installed = readCardsDataWriteLock(lockDirectory, resolvedBaseDir);
        if (!sameCardsDataWriteLockIdentity(installed, candidate)) {
          throw new Error("cards-data write lock candidate identity changed during installation");
        }
        acquired = true;
        return { ...installed, kernelGate };
      } catch (error) {
        if (!fs.existsSync(lockDirectory)) continue;
        const existing = readCardsDataWriteLock(lockDirectory, resolvedBaseDir);
        afterReadStaleLock(existing);
        try {
          fs.renameSync(lockDirectory, recoveryDirectory);
        } catch (renameError) {
          if (!fs.existsSync(lockDirectory) || fs.existsSync(recoveryDirectory)) continue;
          throw new Error("cards-data stale write lock could not be isolated", { cause: renameError });
        }
        const recovering = readCardsDataWriteLock(recoveryDirectory, resolvedBaseDir);
        if (recovering.device !== existing.device || recovering.inode !== existing.inode
          || recovering.pid !== existing.pid || recovering.nonce !== existing.nonce) {
          throw new Error("cards-data stale write lock identity changed during isolation");
        }
      }
    }
    throw new Error("cards-data write lock could not be acquired");
  } finally {
    if (candidate && fs.existsSync(candidate.lockDirectory)) {
      try {
        removeOwnedCardsDataWriteLock(candidate);
      } catch {
        // Preserve an object whose admitted identity changed.
      }
    }
    if (!acquired) releaseCardsDataKernelGate(kernelGate);
  }
}

function acquireCardsDataWriteLock(baseDir, { afterReadStaleLock = () => undefined } = {}) {
  return acquireCardsDataLock(baseDir, { afterReadStaleLock });
}

function assertCardsDataWriteLock(baseDir, lockToken) {
  const resolvedBaseDir = resolveCanonicalCardsDataBaseDir(baseDir);
  if (!lockToken || !sameFilesystemPath(lockToken.baseDir, resolvedBaseDir)
    || !sameFilesystemPath(path.resolve(lockToken.lockDirectory), cardsDataWriteLockDirectory(resolvedBaseDir))) {
    throw new Error("cards-data write lock token is invalid");
  }
  assertCardsDataKernelGate(lockToken.kernelGate);
  assertOwnedCardsDataWriteLock(lockToken);
}

function releaseCardsDataWriteLock(baseDir, lockToken) {
  let removed = false;
  try {
    assertCardsDataWriteLock(baseDir, lockToken);
    removeOwnedCardsDataWriteLock(lockToken);
    removed = true;
  } catch {
    removed = false;
  } finally {
    if (!releaseCardsDataKernelGate(lockToken?.kernelGate)) removed = false;
  }
  return removed;
}

function assertPlainDirectory(target, label) {
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`unsafe cards-data ${label}: ${target}`);
  }
}

function assertManagedRootPath(baseDir, target, kind) {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedTarget = path.resolve(target);
  const parentDir = path.dirname(resolvedBaseDir);
  const expectedPrefix = `.${path.basename(resolvedBaseDir)}.${kind}-`;
  const targetName = path.basename(resolvedTarget);
  const prefixMatches = process.platform === "win32"
    ? targetName.toLowerCase().startsWith(expectedPrefix.toLowerCase())
    : targetName.startsWith(expectedPrefix);
  if (!sameFilesystemPath(path.dirname(resolvedTarget), parentDir) || !prefixMatches) {
    throw new Error(`unsafe cards-data transaction ${kind} path: ${target}`);
  }
  if (fs.existsSync(resolvedTarget)) assertPlainDirectory(resolvedTarget, `transaction ${kind}`);
  return resolvedTarget;
}

function pinManagedRootDirectory(baseDir, target, kind) {
  const resolvedTarget = assertManagedRootPath(baseDir, target, kind);
  const stat = fs.lstatSync(resolvedTarget);
  const canonical = fs.realpathSync.native(resolvedTarget);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || !sameFilesystemPath(canonical, resolvedTarget)) {
    throw new Error(`unsafe cards-data transaction ${kind} identity: ${target}`);
  }
  return {
    baseDir: path.resolve(baseDir),
    target: resolvedTarget,
    kind,
    device: stat.dev,
    inode: stat.ino,
  };
}

function assertPinnedManagedRootDirectory(pin) {
  const resolvedTarget = assertManagedRootPath(pin.baseDir, pin.target, pin.kind);
  const stat = fs.lstatSync(resolvedTarget);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || stat.dev !== pin.device || stat.ino !== pin.inode
    || !sameFilesystemPath(fs.realpathSync.native(resolvedTarget), resolvedTarget)) {
    throw new Error(`cards-data transaction ${pin.kind} identity changed`);
  }
  return resolvedTarget;
}

function removePinnedManagedRootDirectory(pin) {
  try {
    const resolvedTarget = assertPinnedManagedRootDirectory(pin);
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function assertBaseRoot(baseDir) {
  const resolvedBaseDir = path.resolve(baseDir);
  const parent = path.dirname(resolvedBaseDir);
  const parentStat = fs.lstatSync(parent);
  const canonicalParent = fs.realpathSync.native(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()
    || !sameFilesystemPath(canonicalParent, parent)) {
    throw new Error(`unsafe cards-data base root: ${baseDir}`);
  }
  if (!fs.existsSync(resolvedBaseDir)) return path.join(canonicalParent, path.basename(resolvedBaseDir));
  assertPlainDirectory(resolvedBaseDir, "base root");
  return fs.realpathSync.native(resolvedBaseDir);
}

function assertJournalDirectory(baseDir) {
  const directory = transactionDirectory(baseDir);
  if (fs.existsSync(directory)) assertPlainDirectory(directory, "transaction journal directory");
  return directory;
}

function writeTransaction(journalPath, transaction) {
  const tempPath = `${journalPath}.tmp-${randomUUID()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(transaction)}\n`, "utf8");
  fs.renameSync(tempPath, journalPath);
}

function directoryIdentity(target, label) {
  assertPlainDirectory(target, label);
  const stat = fs.lstatSync(target);
  if (!sameFilesystemPath(fs.realpathSync.native(target), path.resolve(target))) {
    throw new Error(`unsafe cards-data ${label} identity: ${target}`);
  }
  return { device: String(stat.dev), inode: String(stat.ino) };
}

function assertDirectoryIdentity(target, identity, label) {
  const current = directoryIdentity(target, label);
  if (current.device !== identity.device || current.inode !== identity.inode) {
    throw new Error(`cards-data ${label} identity changed: ${target}`);
  }
  return path.resolve(target);
}

function removeOwnedDirectoryIfPresent(target, identity, rmSync, label) {
  if (!fs.existsSync(target)) return true;
  try {
    const resolvedTarget = assertDirectoryIdentity(target, identity, label);
    rmSync(resolvedTarget, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function removeJournalIfPresent(journalPath, rmSync) {
  if (!fs.existsSync(journalPath)) return true;
  try {
    const stat = fs.lstatSync(journalPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    rmSync(journalPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function quarantineJournal(baseDir, journalPath) {
  const directory = assertJournalDirectory(baseDir);
  const quarantineDir = path.join(directory, "quarantine");
  if (fs.existsSync(quarantineDir)) assertPlainDirectory(quarantineDir, "transaction journal quarantine");
  else fs.mkdirSync(quarantineDir, { recursive: true });
  const suffix = `${randomUUID()}.rejected`;
  fs.renameSync(journalPath, path.join(quarantineDir, `${path.basename(journalPath)}.${suffix}`));
  const ownerPath = `${journalPath}.owner`;
  if (fs.existsSync(ownerPath)) {
    const ownerStat = fs.lstatSync(ownerPath);
    if (ownerStat.isFile() && !ownerStat.isSymbolicLink()) {
      fs.renameSync(ownerPath, path.join(quarantineDir, `${path.basename(ownerPath)}.${suffix}`));
    }
  }
}

function readTransaction(baseDir, journalPath) {
  const stat = fs.lstatSync(journalPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`unsafe cards-data transaction journal: ${journalPath}`);
  const transaction = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const resolvedBaseDir = assertBaseRoot(baseDir);
  const transactionKeys = ["backupDir", "baseDir", "stagedBaseDir", "state", "transactionId", "version"];
  if (JSON.stringify(Object.keys(transaction).sort()) !== JSON.stringify(transactionKeys)
    || transaction.version !== 2 || typeof transaction.transactionId !== "string"
    || !LOCK_NONCE.test(transaction.transactionId)
    || !sameFilesystemPath(path.resolve(transaction.baseDir ?? ""), resolvedBaseDir)
    || typeof transaction.stagedBaseDir !== "string" || typeof transaction.backupDir !== "string") {
    throw new Error(`invalid cards-data transaction journal: ${journalPath}`);
  }
  const ownerPath = `${journalPath}.owner`;
  const ownerStat = fs.lstatSync(ownerPath);
  if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) {
    throw new Error(`unsafe cards-data transaction owner: ${ownerPath}`);
  }
  const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
  const ownerKeys = [
    "backupDir", "baseDir", "originalDevice", "originalInode", "schemaVersion",
    "stageDevice", "stageInode", "stagedBaseDir", "transactionId",
  ];
  if (JSON.stringify(Object.keys(owner).sort()) !== JSON.stringify(ownerKeys)
    || owner.schemaVersion !== 1 || owner.transactionId !== transaction.transactionId
    || !sameFilesystemPath(path.resolve(owner.baseDir ?? ""), resolvedBaseDir)
    || !sameFilesystemPath(path.resolve(owner.stagedBaseDir ?? ""), path.resolve(transaction.stagedBaseDir))
    || !sameFilesystemPath(path.resolve(owner.backupDir ?? ""), path.resolve(transaction.backupDir))
    || typeof owner.stageDevice !== "string" || !/^\d+$/.test(owner.stageDevice)
    || typeof owner.stageInode !== "string" || !/^\d+$/.test(owner.stageInode)
    || typeof owner.originalDevice !== "string" || !/^\d+$/.test(owner.originalDevice)
    || typeof owner.originalInode !== "string" || !/^\d+$/.test(owner.originalInode)) {
    throw new Error(`invalid cards-data transaction owner: ${ownerPath}`);
  }
  return {
    ...transaction,
    baseDir: resolvedBaseDir,
    stagedBaseDir: assertManagedRootPath(resolvedBaseDir, transaction.stagedBaseDir, "stage"),
    backupDir: assertManagedRootPath(resolvedBaseDir, transaction.backupDir, "backup"),
    ownerPath,
    stageIdentity: { device: owner.stageDevice, inode: owner.stageInode },
    originalIdentity: { device: owner.originalDevice, inode: owner.originalInode },
  };
}

function removeTransactionMetadataIfPresent(transaction, journalPath, rmSync) {
  const journalRemoved = removeJournalIfPresent(journalPath, rmSync);
  const ownerRemoved = journalRemoved && removeJournalIfPresent(transaction.ownerPath, rmSync);
  return journalRemoved && ownerRemoved;
}

function recoverOrphanTransactionOwners(baseDir, rmSync = fs.rmSync) {
  const directory = assertJournalDirectory(baseDir);
  if (!fs.existsSync(directory)) return 0;
  let recovered = 0;
  for (const name of fs.readdirSync(directory).filter((entry) => /^[a-f0-9-]{36}\.json\.owner$/.test(entry)).sort()) {
    const ownerPath = path.join(directory, name);
    const journalPath = ownerPath.slice(0, -".owner".length);
    const hasInterruptedJournal = fs.readdirSync(directory)
      .some((entry) => entry.startsWith(`${path.basename(journalPath)}.tmp-`));
    if (fs.existsSync(journalPath) || hasInterruptedJournal) continue;
    if (!removeJournalIfPresent(ownerPath, rmSync)) {
      throw new Error(`orphan cards-data transaction owner cleanup failed: ${ownerPath}`);
    }
    recovered += 1;
  }
  return recovered;
}

function journalPaths(baseDir) {
  const directory = assertJournalDirectory(baseDir);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(directory, name));
}

function recoverInterruptedJournalWrites(baseDir, rmSync = fs.rmSync) {
  const directory = assertJournalDirectory(baseDir);
  if (!fs.existsSync(directory)) return 0;
  const temporaryNames = fs.readdirSync(directory)
    .filter((name) => /^[a-f0-9-]{36}\.json\.tmp-[a-f0-9-]{36}$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  const grouped = new Map();
  for (const name of temporaryNames) {
    const journalName = name.slice(0, name.indexOf(".tmp-"));
    const values = grouped.get(journalName) ?? [];
    values.push(name);
    grouped.set(journalName, values);
  }
  let recovered = 0;
  for (const [journalName, names] of grouped) {
    if (names.length !== 1) throw new Error(`ambiguous interrupted cards-data transaction journal: ${journalName}`);
    const temporaryPath = path.join(directory, names[0]);
    const stat = fs.lstatSync(temporaryPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`unsafe interrupted cards-data transaction journal: ${temporaryPath}`);
    }
    const journalPath = path.join(directory, journalName);
    if (fs.existsSync(journalPath)) {
      if (!removeJournalIfPresent(temporaryPath, rmSync)) {
        throw new Error(`interrupted cards-data transaction journal cleanup failed: ${temporaryPath}`);
      }
    } else {
      fs.renameSync(temporaryPath, journalPath);
    }
    recovered += 1;
  }
  return recovered;
}

function recoverCardsDataTransactionsLocked({ baseDir, renameSync = fs.renameSync, rmSync = fs.rmSync }) {
  const journalWritesRecovered = recoverInterruptedJournalWrites(baseDir, rmSync);
  const orphanOwnersRecovered = recoverOrphanTransactionOwners(baseDir, rmSync);
  let recovered = 0;
  let cleanupPending = 0;
  let rejected = 0;
  for (const journalPath of journalPaths(baseDir)) {
    let transaction;
    try {
      transaction = readTransaction(baseDir, journalPath);
    } catch {
      quarantineJournal(baseDir, journalPath);
      rejected += 1;
      continue;
    }
    let baseExists = fs.existsSync(baseDir);
    let backupExists = fs.existsSync(transaction.backupDir);
    let stageExists = fs.existsSync(transaction.stagedBaseDir);
    try {
      if (backupExists) {
        assertDirectoryIdentity(transaction.backupDir, transaction.originalIdentity, "transaction backup");
      }
      if (stageExists) {
        assertDirectoryIdentity(transaction.stagedBaseDir, transaction.stageIdentity, "transaction stage");
      }
      if (baseExists) {
        const baseIdentity = directoryIdentity(baseDir, "transaction base");
        const isOriginal = baseIdentity.device === transaction.originalIdentity.device
          && baseIdentity.inode === transaction.originalIdentity.inode;
        const isStage = baseIdentity.device === transaction.stageIdentity.device
          && baseIdentity.inode === transaction.stageIdentity.inode;
        if (!isOriginal && !isStage) throw new Error("cards-data transaction base identity changed");
      }
    } catch {
      quarantineJournal(baseDir, journalPath);
      rejected += 1;
      continue;
    }
    const rollbackStates = new Set(["prepared", "backup-moved", "installing", "verifying"]);
    if (transaction.state === "installed") {
      if (!baseExists && backupExists) {
        renameSync(transaction.backupDir, baseDir);
        transaction.state = "rolled-back";
        writeTransaction(journalPath, transaction);
        recovered += 1;
        baseExists = true;
        backupExists = false;
      } else if (!baseExists) {
        throw new Error(`cards-data installed transaction requires a base or backup root: ${journalPath}`);
      }
    } else if (transaction.state === "rolled-back") {
      if (!baseExists) {
        throw new Error(`cards-data rolled-back transaction requires the restored base root: ${journalPath}`);
      }
    } else if (rollbackStates.has(transaction.state)) {
      if (backupExists) {
        if (baseExists) {
          if (stageExists) throw new Error(`cards-data rollback stage already exists: ${journalPath}`);
          assertDirectoryIdentity(baseDir, transaction.stageIdentity, "installed transaction base");
          renameSync(baseDir, transaction.stagedBaseDir);
          stageExists = true;
        }
        assertDirectoryIdentity(transaction.backupDir, transaction.originalIdentity, "transaction backup");
        renameSync(transaction.backupDir, baseDir);
        baseExists = true;
        backupExists = false;
        transaction.state = "rolled-back";
        writeTransaction(journalPath, transaction);
        recovered += 1;
      } else if (baseExists && stageExists && transaction.state === "prepared") {
        // The transaction was journaled but the first rename never happened.
      } else if (baseExists && stageExists) {
        // The prior root was restored before the rollback state could be persisted.
        transaction.state = "rolled-back";
        writeTransaction(journalPath, transaction);
        recovered += 1;
      } else {
        throw new Error(`cards-data rollback requires a base/backup or restored base/stage pair: ${journalPath}`);
      }
    } else {
      throw new Error(`invalid cards-data transaction state: ${transaction.state}`);
    }

    const backupRemoved = removeOwnedDirectoryIfPresent(
      transaction.backupDir,
      transaction.originalIdentity,
      rmSync,
      "transaction backup cleanup target",
    );
    const stageRemoved = removeOwnedDirectoryIfPresent(
      transaction.stagedBaseDir,
      transaction.stageIdentity,
      rmSync,
      "transaction stage cleanup target",
    );
    if (backupRemoved && stageRemoved && removeTransactionMetadataIfPresent(transaction, journalPath, rmSync)) continue;
    cleanupPending += 1;
  }
  return { recovered, journalWritesRecovered, orphanOwnersRecovered, cleanupPending, rejected };
}

function recoverCardsDataTransactions(options) {
  const { baseDir, lockToken } = options;
  const ownedLock = lockToken === undefined;
  const activeLock = lockToken ?? acquireCardsDataWriteLock(baseDir);
  let result;
  try {
    assertCardsDataWriteLock(baseDir, activeLock);
    result = recoverCardsDataTransactionsLocked(options);
    return result;
  } finally {
    if (ownedLock && !releaseCardsDataWriteLock(baseDir, activeLock) && result) {
      result.lockCleanupPending = true;
    }
  }
}

function withCardsDataSnapshot({ baseDir, lockToken, read }) {
  if (typeof read !== "function") throw new Error("cards-data snapshot reader must be a function");
  const ownedLock = lockToken === undefined;
  const activeLock = lockToken ?? acquireCardsDataLock(baseDir, {
    kernelGateMode: "reader",
    waitForReader: true,
  });
  let operationError;
  try {
    assertCardsDataWriteLock(baseDir, activeLock);
    const recovery = recoverCardsDataTransactionsLocked({ baseDir });
    if (recovery.cleanupPending !== 0 || recovery.rejected !== 0) {
      throw new Error("cards-data snapshot recovery is incomplete");
    }
    assertCardsDataWriteLock(baseDir, activeLock);
    const resolvedBaseDir = assertBaseRoot(baseDir);
    const value = read({ baseDir: resolvedBaseDir, lockToken: activeLock, recovery });
    if (value && typeof value.then === "function") {
      throw new Error("cards-data snapshot reader must be synchronous");
    }
    assertCardsDataWriteLock(baseDir, activeLock);
    return value;
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (ownedLock && !releaseCardsDataWriteLock(baseDir, activeLock)) {
      const cleanupError = new Error("cards-data snapshot write-lock cleanup is pending");
      if (operationError) {
        throw new AggregateError([operationError, cleanupError], "cards-data snapshot read and cleanup failed");
      }
      throw cleanupError;
    }
  }
}

function replaceStagedCardsDataRootLocked({
  baseDir,
  stagedBaseDir,
  renameSync = fs.renameSync,
  rmSync = fs.rmSync,
  hooks = {},
}) {
  const resolvedBaseDir = assertBaseRoot(baseDir);
  const resolvedStagedBaseDir = assertManagedRootPath(resolvedBaseDir, stagedBaseDir, "stage");
  const parentDir = path.dirname(resolvedBaseDir);
  const journalDir = transactionDirectory(resolvedBaseDir);
  fs.mkdirSync(journalDir, { recursive: true });
  const backupDir = path.join(parentDir, `.${path.basename(resolvedBaseDir)}.backup-${randomUUID()}`);
  const transactionId = randomUUID();
  const journalPath = path.join(journalDir, `${transactionId}.json`);
  const ownerPath = `${journalPath}.owner`;
  const stageIdentity = directoryIdentity(resolvedStagedBaseDir, "transaction stage");
  const originalIdentity = directoryIdentity(resolvedBaseDir, "transaction base");
  const owner = {
    schemaVersion: 1,
    transactionId,
    baseDir: resolvedBaseDir,
    stagedBaseDir: resolvedStagedBaseDir,
    backupDir,
    stageDevice: stageIdentity.device,
    stageInode: stageIdentity.inode,
    originalDevice: originalIdentity.device,
    originalInode: originalIdentity.inode,
  };
  const transaction = {
    version: 2,
    transactionId,
    baseDir: resolvedBaseDir,
    stagedBaseDir: resolvedStagedBaseDir,
    backupDir,
    state: "prepared",
  };
  fs.writeFileSync(ownerPath, `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
  try {
    writeTransaction(journalPath, transaction);
  } catch (error) {
    removeJournalIfPresent(ownerPath, fs.rmSync);
    throw error;
  }

  assertDirectoryIdentity(resolvedBaseDir, originalIdentity, "transaction base");
  renameSync(resolvedBaseDir, backupDir);
  transaction.state = "backup-moved";
  writeTransaction(journalPath, transaction);
  hooks.afterBackupMoved?.();

  transaction.state = "installing";
  writeTransaction(journalPath, transaction);
  assertDirectoryIdentity(resolvedStagedBaseDir, stageIdentity, "transaction stage");
  renameSync(resolvedStagedBaseDir, resolvedBaseDir);
  transaction.state = "verifying";
  writeTransaction(journalPath, transaction);
  hooks.afterInstalled?.();

  transaction.state = "installed";
  writeTransaction(journalPath, transaction);

  const backupRemoved = removeOwnedDirectoryIfPresent(
    backupDir,
    originalIdentity,
    rmSync,
    "transaction backup cleanup target",
  );
  const metadataRemoved = backupRemoved && removeTransactionMetadataIfPresent(
    { ownerPath },
    journalPath,
    rmSync,
  );
  return { cleanupPending: !backupRemoved || !metadataRemoved };
}

function replaceStagedCardsDataRoot(options) {
  const { baseDir, lockToken } = options;
  const ownedLock = lockToken === undefined;
  const activeLock = lockToken ?? acquireCardsDataWriteLock(baseDir);
  let result;
  try {
    assertCardsDataWriteLock(baseDir, activeLock);
    result = replaceStagedCardsDataRootLocked(options);
    return result;
  } finally {
    if (ownedLock && !releaseCardsDataWriteLock(baseDir, activeLock) && result) {
      result.lockCleanupPending = true;
    }
  }
}

function copyStaticCardsData(baseDir, stagedBaseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.name === "_raw" || (entry.isDirectory() && PACKAGE_DIRECTORY.test(entry.name))) continue;
    fs.cpSync(path.join(baseDir, entry.name), path.join(stagedBaseDir, entry.name), { recursive: true });
  }
}

function validateStagedCardsData({ stagedBaseDir, written }) {
  const rawDir = path.join(stagedBaseDir, "_raw");
  if (!fs.existsSync(rawDir)) throw new Error("staged cards-data is missing raw packages");
  for (const filename of written) {
    const rawPath = path.join(rawDir, filename);
    if (!fs.existsSync(rawPath)) throw new Error(`staged cards-data is missing ${filename}`);
    const payload = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    if (!Array.isArray(payload.data)) throw new Error(`staged cards-data is invalid: ${filename}`);
  }
}

function defaultRegenerate({ baseDir, rawDir }) {
  const { regenerateAll } = require("../../.claude/specs/cards-data/_regen_all.cjs");
  return regenerateAll({ baseDir, rawDir });
}

async function fetchAndRegenerateAllCards(options = {}) {
  const baseDir = options.baseDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data");
  const lockToken = acquireCardsDataWriteLock(baseDir);
  const parentDir = path.dirname(baseDir);
  let stagedBaseDir;
  let stagePin;
  let result;
  try {
    recoverCardsDataTransactions({ baseDir, lockToken });
    const snapshot = await fetchAllCards(options);
    stagedBaseDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(baseDir)}.stage-`));
    stagePin = pinManagedRootDirectory(baseDir, stagedBaseDir, "stage");
    const rawDir = path.join(stagedBaseDir, "_raw");
    const regenerate = options.regenerate ?? defaultRegenerate;
    copyStaticCardsData(baseDir, stagedBaseDir);
    const written = writeRawPackagesToStaging(snapshot.cards, rawDir);
    regenerate({ baseDir: stagedBaseDir, rawDir });
    assertPinnedManagedRootDirectory(stagePin);
    validateStagedCardsData({ stagedBaseDir, written });
    const transaction = replaceStagedCardsDataRoot({
      baseDir,
      stagedBaseDir,
      ...(options.renameSync ? { renameSync: options.renameSync } : {}),
      ...(options.rmSync ? { rmSync: options.rmSync } : {}),
      lockToken,
    });
    stagePin = undefined;
    stagedBaseDir = undefined;
    result = { ...snapshot, written, ...transaction };
  } catch (error) {
    try {
      recoverCardsDataTransactions({ baseDir, lockToken });
    } catch {
      // Preserve the originating writer failure; its journal remains fail-closed.
    }
    throw error;
  } finally {
    if (stagePin) removePinnedManagedRootDirectory(stagePin);
    if (!releaseCardsDataWriteLock(baseDir, lockToken) && result) result.lockCleanupPending = true;
  }
  return result;
}

function copyCardsDataTree(sourceRoot, destinationRoot, current = sourceRoot) {
  if (!fs.existsSync(sourceRoot)) return;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const source = path.join(current, entry.name);
    const relative = path.relative(sourceRoot, source);
    const destination = path.join(destinationRoot, relative);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`cards-data root contains a symlink: ${source}`);
    if (stat.isDirectory()) {
      fs.mkdirSync(destination, { recursive: true });
      copyCardsDataTree(sourceRoot, destinationRoot, source);
    } else if (stat.isFile()) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    } else {
      throw new Error(`cards-data root contains a non-file entry: ${source}`);
    }
  }
}

function mutateCardsDataRoot(options = {}) {
  const { baseDir, lockToken, mutate, hooks = {} } = options;
  if (typeof mutate !== "function") throw new Error("cards-data root mutator must be a function");
  const ownedLock = lockToken === undefined;
  const activeLock = lockToken ?? acquireCardsDataWriteLock(baseDir);
  let stagedBaseDir;
  let stagePin;
  let result;
  let operationError;
  try {
    assertCardsDataWriteLock(baseDir, activeLock);
    const recovery = recoverCardsDataTransactionsLocked({ baseDir });
    if (recovery.cleanupPending !== 0 || recovery.rejected !== 0) {
      throw new Error("cards-data root mutation recovery is incomplete");
    }
    const resolvedBaseDir = assertBaseRoot(baseDir);
    stagedBaseDir = fs.mkdtempSync(path.join(path.dirname(resolvedBaseDir), `.${path.basename(resolvedBaseDir)}.stage-`));
    stagePin = pinManagedRootDirectory(baseDir, stagedBaseDir, "stage");
    copyCardsDataTree(resolvedBaseDir, stagedBaseDir);
    const value = mutate({ baseDir: stagedBaseDir, lockToken: activeLock });
    if (value && typeof value.then === "function") throw new Error("cards-data root mutator must be synchronous");
    assertPinnedManagedRootDirectory(stagePin);
    assertCardsDataWriteLock(baseDir, activeLock);
    const transaction = replaceStagedCardsDataRootLocked({
      baseDir,
      stagedBaseDir,
      ...(options.renameSync ? { renameSync: options.renameSync } : {}),
      ...(options.rmSync ? { rmSync: options.rmSync } : {}),
      hooks,
    });
    stagePin = undefined;
    stagedBaseDir = undefined;
    result = { value, ...transaction };
    return result;
  } catch (error) {
    operationError = error;
    try {
      recoverCardsDataTransactionsLocked({ baseDir });
    } catch {
      // Preserve the originating mutation failure; its journal remains fail-closed.
    }
    throw error;
  } finally {
    if (stagePin) removePinnedManagedRootDirectory(stagePin);
    if (ownedLock && !releaseCardsDataWriteLock(baseDir, activeLock)) {
      const cleanupError = new Error("cards-data root mutation write-lock cleanup is pending");
      if (operationError) throw new AggregateError([operationError, cleanupError], "cards-data root mutation and cleanup failed");
      if (result) result.lockCleanupPending = true;
      else throw cleanupError;
    }
  }
}

async function fetchAndWriteAllCards(options = {}) {
  const outputDir = options.outputDir ?? path.join(__dirname, "..", "..", ".claude", "specs", "cards-data", "_raw");
  if (path.basename(path.resolve(outputDir)) !== "_raw") {
    throw new Error("official raw output directory must be the cards-data _raw directory");
  }
  const outputBaseDir = path.dirname(path.resolve(outputDir));
  if (options.baseDir !== undefined && path.resolve(options.baseDir) !== outputBaseDir) {
    throw new Error("official raw output root does not match the cards-data write lock root");
  }
  const baseDir = outputBaseDir;
  const lockToken = acquireCardsDataWriteLock(baseDir);
  let result;
  let operationError;
  try {
    const recovery = recoverCardsDataTransactions({ baseDir, lockToken });
    if (recovery.cleanupPending !== 0 || recovery.rejected !== 0) {
      throw new Error("official raw refresh cards-data recovery is incomplete");
    }
    const snapshot = await fetchAllCards(options);
    groupByPackage(snapshot.cards);
    const outputName = path.basename(path.resolve(outputDir));
    const mutation = mutateCardsDataRoot({
      baseDir,
      lockToken,
      mutate: ({ baseDir: stagedBaseDir }) => writeRawPackagesToStaging(snapshot.cards, path.join(stagedBaseDir, outputName)),
      ...(options.renameSync ? { renameSync: options.renameSync } : {}),
      ...(options.rmSync ? { rmSync: options.rmSync } : {}),
      ...(options.hooks ? { hooks: options.hooks } : {}),
    });
    result = { ...snapshot, written: mutation.value, cleanupPending: mutation.cleanupPending };
    return result;
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (!releaseCardsDataWriteLock(baseDir, lockToken)) {
      const cleanupError = new Error("official raw refresh write-lock cleanup is pending");
      if (operationError) throw new AggregateError([operationError, cleanupError], "official raw refresh and cleanup failed");
      if (result) result.lockCleanupPending = true;
      else throw cleanupError;
    }
  }
}

module.exports = {
  OFFICIAL_CARDS_URL,
  acquireCardsDataWriteLock,
  assertCardsDataWriteLock,
  cardsDataWriteLockDirectory,
  fetchAllCards,
  fetchAndRegenerateAllCards,
  fetchAndWriteAllCards,
  mutateCardsDataRoot,
  packageCode,
  packageDirectories,
  recoverCardsDataTransactions,
  releaseCardsDataWriteLock,
  replaceStagedCardsDataRoot,
  transactionDirectory,
  withCardsDataSnapshot,
  writeRawPackagesToStaging,
};
