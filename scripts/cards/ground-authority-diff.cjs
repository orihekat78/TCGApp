const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadPriorAuthorityFromFiles,
  stableJson,
  validateAuthorityPacket,
} = require('./authority-refresh.cjs');
const { compareOrdinal } = require('./qa-normalize.cjs');

function parseGroundAuthorityArgs(args) {
  if (args.length !== 2 || args[0] !== '--packet' || !args[1] || args[1].startsWith('-')
    || path.basename(args[1]) !== 'packet.json') {
    throw new Error('ground authority diff only accepts --packet <external packet.json>');
  }
  return { packetPath: args[1] };
}

function readPacketFile(packetPath) {
  const before = fs.lstatSync(packetPath);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('authority packet must be a regular file');
  const bytes = fs.readFileSync(packetPath, 'utf8');
  const after = fs.lstatSync(packetPath);
  if (!after.isFile() || after.isSymbolicLink()
    || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size) {
    throw new Error('authority packet identity changed while reading');
  }
  try {
    return JSON.parse(bytes);
  } catch {
    throw new Error('authority packet is not valid JSON');
  }
}

function exactAddedPrintings(packet) {
  const added = packet?.diff?.added;
  if (!Array.isArray(added) || added.some((id) => typeof id !== 'string')) {
    throw new Error('authority packet added printings are invalid');
  }
  const sorted = [...added].sort(compareOrdinal);
  if (new Set(added).size !== added.length || stableJson(added) !== stableJson(sorted)) {
    throw new Error('authority packet added printings must be unique and sorted');
  }
  return [...added];
}

function gitFileExists(projectRoot, releaseCommit, relative) {
  try {
    execFileSync('git', ['cat-file', '-e', `${releaseCommit}:${relative}`], { cwd: projectRoot, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function verifyReleaseCommit(projectRoot, releaseCommit) {
  if (!/^[a-f0-9]{40}$/.test(releaseCommit ?? '')) throw new Error('authority packet releaseCommit is invalid');
  let resolved;
  try {
    resolved = execFileSync('git', ['rev-parse', '--verify', `${releaseCommit}^{commit}`], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('authority packet release commit is unavailable');
  }
  if (resolved !== releaseCommit) throw new Error('authority packet release commit did not resolve exactly');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', releaseCommit, 'HEAD'], { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    throw new Error('authority packet release commit is not an ancestor of HEAD');
  }
}

function loadPriorAuthorityAtReleaseCommit({
  projectRoot,
  releaseCommit,
  verifyCommit = verifyReleaseCommit,
  readGitFile = (commit, relative) => execFileSync('git', ['show', `${commit}:${relative}`], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  }),
  gitFileExists: fileExists = (commit, relative) => gitFileExists(projectRoot, commit, relative),
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(releaseCommit ?? '')) throw new Error('authority packet releaseCommit is invalid');
  verifyCommit(projectRoot, releaseCommit);
  return loadPriorAuthorityFromFiles({
    readFile: (relative) => {
      try {
        return readGitFile(releaseCommit, relative);
      } catch {
        throw new Error(`authority release commit file is unavailable: ${relative}`);
      }
    },
    fileExists: (relative) => fileExists(releaseCommit, relative),
  });
}

function snapshotPacketArtifacts(packet, packetRoot) {
  if (!Array.isArray(packet?.artifacts)) return [];
  return packet.artifacts.map((artifact) => {
    const file = path.resolve(packetRoot, artifact.path);
    const relative = path.relative(packetRoot, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('authority packet artifact escaped packet root');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('authority packet artifact is not a regular file');
    const ancestors = [];
    for (let directory = path.dirname(file); ; directory = path.dirname(directory)) {
      const directoryStat = fs.lstatSync(directory);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('authority packet source ancestor is unsafe');
      ancestors.push({ path: directory, dev: directoryStat.dev, ino: directoryStat.ino });
      if (path.resolve(directory) === path.resolve(packetRoot)) break;
    }
    return { file, relative: artifact.path, dev: stat.dev, ino: stat.ino, size: stat.size, sha256: artifact.sha256, ancestors };
  });
}

function listRegularFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return listRegularFiles(root, child);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('authority packet source set changed while grounding');
    return [child.split(path.sep).join('/')];
  });
}

function assertPacketArtifactsUnchanged(snapshot, packetRoot) {
  const cardsDataPrefix = 'snapshot/.claude/specs/cards-data/';
  const expected = snapshot
    .filter((entry) => entry.relative?.startsWith(cardsDataPrefix))
    .map((entry) => entry.relative.slice(cardsDataPrefix.length))
    .sort(compareOrdinal);
  if (expected.length) {
    const actual = listRegularFiles(path.join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data')).sort(compareOrdinal);
    if (stableJson(actual) !== stableJson(expected)) throw new Error('authority packet source set changed while grounding');
  }
  for (const expected of snapshot) {
    const stat = fs.lstatSync(expected.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== expected.dev || stat.ino !== expected.ino || stat.size !== expected.size) {
      throw new Error('authority packet source changed while grounding');
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(expected.file)).digest('hex');
    if (digest !== expected.sha256) throw new Error('authority packet source changed while grounding');
  }
}

function snapshotPacketTree(packetRoot, relative = '') {
  const directory = path.join(packetRoot, relative);
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('authority packet tree is unsafe');
  const entries = [{ relative: relative || '.', type: 'directory', dev: stat.dev, ino: stat.ino }];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) entries.push(...snapshotPacketTree(packetRoot, child));
    else {
      const file = path.join(packetRoot, child);
      const fileStat = fs.lstatSync(file);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error('authority packet tree is unsafe');
      entries.push({ relative: child.split(path.sep).join('/'), type: 'file', dev: fileStat.dev, ino: fileStat.ino, size: fileStat.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
    }
  }
  return entries.sort((left, right) => compareOrdinal(left.relative, right.relative));
}

function assertPacketTreeUnchanged(snapshot, packetRoot) {
  if (stableJson(snapshotPacketTree(packetRoot)) !== stableJson(snapshot)) throw new Error('authority packet tree changed while grounding');
}

function assertAncestorsUnchanged(ancestors) {
  for (const expected of ancestors) {
    const stat = fs.lstatSync(expected.path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== expected.dev || stat.ino !== expected.ino) {
      throw new Error('authority packet source ancestor changed while grounding');
    }
  }
}

function canonicalDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} is unsafe`);
  return fs.realpathSync.native(directory);
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function admitExternalTempDirectory(tempBase, packetRoot, projectRoot, prefix) {
  const base = canonicalDirectory(tempBase, 'authority temp base');
  const packet = canonicalDirectory(packetRoot, 'authority packet root');
  const project = canonicalDirectory(projectRoot, 'authority project root');
  if (isInside(base, packet) || isInside(base, project)) throw new Error('authority temp base must be outside packet and project roots');
  const created = fs.mkdtempSync(path.join(base, prefix));
  const resolved = fs.realpathSync.native(created);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || isInside(resolved, packet) || isInside(resolved, project)) {
    throw new Error('authority temporary directory is unsafe');
  }
  return { path: resolved, dev: stat.dev, ino: stat.ino };
}

function assertPinnedDirectory(pin, label) {
  const stat = fs.lstatSync(pin.path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== pin.dev || stat.ino !== pin.ino || fs.realpathSync.native(pin.path) !== pin.path) {
    throw new Error(`${label} changed while grounding`);
  }
}

function stageValidatedTsv(snapshot, {
  packetRoot, projectRoot, tempBase = os.tmpdir(),
  makeStage = () => admitExternalTempDirectory(tempBase, packetRoot, projectRoot, 'conan-authority-ground-input-'),
  writeStaged = fs.writeFileSync,
} = {}) {
  const stage = makeStage();
  try {
    const files = snapshot.filter((entry) => entry.relative?.endsWith('.tsv')).map((entry, index) => {
      assertAncestorsUnchanged(entry.ancestors);
      const fd = fs.openSync(entry.file, 'r');
      let bytes;
      try {
        const before = fs.fstatSync(fd);
        if (!before.isFile() || before.dev !== entry.dev || before.ino !== entry.ino || before.size !== entry.size) throw new Error('authority packet source changed while grounding');
        bytes = fs.readFileSync(fd);
        const after = fs.fstatSync(fd);
        if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size) throw new Error('authority packet source changed while grounding');
      } finally { fs.closeSync(fd); }
      assertAncestorsUnchanged(entry.ancestors);
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('authority packet source changed while grounding');
      const staged = path.join(stage.path, `${String(index).padStart(4, '0')}.tsv`);
      writeStaged(staged, bytes, { flag: 'wx' });
      const stagedStat = fs.lstatSync(staged);
      if (!stagedStat.isFile() || stagedStat.isSymbolicLink() || crypto.createHash('sha256').update(fs.readFileSync(staged)).digest('hex') !== entry.sha256) throw new Error('authority staged TSV is unsafe');
      return { file: staged, dev: stagedStat.dev, ino: stagedStat.ino, size: stagedStat.size, sha256: entry.sha256 };
    });
    assertPinnedDirectory(stage, 'authority TSV stage');
    return { ...stage, files };
  } catch (error) {
    let residue;
    let cleanupError;
    try { residue = removeStage(stage); } catch (caught) { cleanupError = caught; }
    throw residueError(error, residue, cleanupError);
  }
}

function removeStage(stage, {
  rename = fs.renameSync,
  exists = fs.existsSync,
} = {}) {
  assertPinnedDirectory(stage, 'authority TSV stage');
  if (Array.isArray(stage.files)) assertStagedTsvUnchanged(stage);
  const isolatedPath = path.join(path.dirname(stage.path), `.${path.basename(stage.path)}.cleanup-${crypto.randomUUID()}`);
  if (exists(isolatedPath)) throw new Error('authority TSV stage cleanup path already exists');
  try {
    rename(stage.path, isolatedPath);
  } catch {
    throw new Error('authority TSV stage cleanup isolation failed');
  }
  const isolated = {
    ...stage,
    path: isolatedPath,
    files: Array.isArray(stage.files)
      ? stage.files.map((file) => ({ ...file, file: path.join(isolatedPath, path.basename(file.file)) }))
      : undefined,
  };
  try {
    assertPinnedDirectory(isolated, 'authority TSV stage cleanup');
    if (Array.isArray(isolated.files)) assertStagedTsvUnchanged(isolated);
  } catch (error) {
    throw new Error('authority TSV stage cleanup identity changed', { cause: error });
  }
  // Do not recursively delete a path after it has been exposed to another actor.
  // A verified isolated stage is intentionally left as an owned external residue.
  return isolatedPath;
}

function residueError(error, stagedResiduePath, cleanupError) {
  const inherited = typeof error?.stagedResiduePath === 'string' ? error.stagedResiduePath : null;
  const paths = [...new Set([stagedResiduePath, inherited].filter(Boolean))];
  const primary = stagedResiduePath ?? inherited;
  const message = paths.length > 1
    ? `${error instanceof Error ? error.message : String(error)}; staged residue conflict: ${paths.join(', ')}`
    : primary
      ? `${error instanceof Error ? error.message : String(error)}; staged residue: ${primary}`
      : `${error instanceof Error ? error.message : String(error)}; staged residue unavailable${cleanupError ? `: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}` : ''}`;
  const wrapped = new Error(message, { cause: error });
  wrapped.stagedResiduePath = primary ?? null;
  if (paths.length > 1) wrapped.stagedResiduePaths = paths;
  if (cleanupError) wrapped.cleanupError = cleanupError;
  return wrapped;
}

function assertStagedTsvUnchanged(stage) {
  assertPinnedDirectory(stage, 'authority TSV stage');
  for (const expected of stage.files) {
    const stat = fs.lstatSync(expected.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== expected.dev || stat.ino !== expected.ino || stat.size !== expected.size
      || crypto.createHash('sha256').update(fs.readFileSync(expected.file)).digest('hex') !== expected.sha256) {
      throw new Error('authority staged TSV changed while grounding');
    }
  }
}

function assertGroundOutput(snapshot, when) {
  if (!Number.isInteger(snapshot?.dev) || !Number.isInteger(snapshot?.ino)) return;
  const stat = fs.lstatSync(snapshot.path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== snapshot.dev || stat.ino !== snapshot.ino) {
    throw new Error(`authority grounding output changed ${when}`);
  }
  if (when === 'before child' && fs.readdirSync(snapshot.path).length !== 0) {
    throw new Error('authority grounding output changed before child');
  }
}

function createGroundOutput(packetRoot, projectRoot, { tempBase = os.tmpdir() } = {}) {
  return admitExternalTempDirectory(tempBase, packetRoot, projectRoot ?? packetRoot, 'conan-authority-ground-');
}

function groundingEnvironment(cardsDataDir) {
  const inherited = process.env;
  const keys = ['ComSpec', 'PATH', 'PATHEXT', 'SystemDrive', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR'];
  const env = Object.fromEntries(keys
    .filter((key) => typeof inherited[key] === 'string' && inherited[key])
    .map((key) => [key, inherited[key]]));
  env.CONAN_CARDS_DATA_DIR = cardsDataDir;
  return env;
}

function runGroundAuthorityDiff({
  projectRoot = path.resolve(__dirname, '..', '..'),
  packetPath,
  loadPriorAtCommit = (releaseCommit, root) => loadPriorAuthorityAtReleaseCommit({ projectRoot: root, releaseCommit }),
  readPacket = readPacketFile,
  validatePacket = validateAuthorityPacket,
  capturePacket = snapshotPacketArtifacts,
  assertUnchanged = assertPacketArtifactsUnchanged,
  captureTree = snapshotPacketTree,
  assertTreeUnchanged = assertPacketTreeUnchanged,
  stageTsv = stageValidatedTsv,
  removeStagedTsv = removeStage,
  assertStagedTsv = assertStagedTsvUnchanged,
  createOutput = createGroundOutput,
  assertOutput = assertGroundOutput,
  makeEnvironment = groundingEnvironment,
  verifyCommit = verifyReleaseCommit,
  ground = (ids, { outputPath, allowedTsv, env }) => execFileSync(
    process.execPath,
    [path.join(projectRoot, 'scripts', 'ground-dossier.cjs'), '--out', outputPath, ...allowedTsv.flatMap((entry) => ['--tsv', entry.file, '--tsv-sha', entry.sha256]), ...ids],
    { cwd: projectRoot, encoding: 'utf8', env },
  ),
} = {}) {
  if (!packetPath) throw new Error('ground authority diff requires --packet <external packet.json>');
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedPacketPath = path.resolve(packetPath);
  const packetRoot = path.dirname(resolvedPacketPath);
  const packet = readPacket(resolvedPacketPath);
  const prior = loadPriorAtCommit(packet?.basis?.releaseCommit, resolvedProjectRoot);
  validatePacket(packet, prior, { packetRoot, projectRoot: resolvedProjectRoot });
  const sourceSnapshot = capturePacket(packet, packetRoot);
  const ids = exactAddedPrintings(packet);
  assertUnchanged(sourceSnapshot, packetRoot);
  const treeSnapshot = sourceSnapshot.length ? captureTree(packetRoot) : [];
  if (treeSnapshot.length) assertTreeUnchanged(treeSnapshot, packetRoot);
  if (ids.length === 0) {
    if (sourceSnapshot.length) verifyCommit(resolvedProjectRoot, packet.basis.releaseCommit);
    return { ids, packetPath: resolvedPacketPath, outputPath: null, stagedResiduePath: null, grounded: false };
  }
  let stage = null;
  let outputSnapshot;
  let stagedResiduePath = null;
  let operationError;
  let cleanupError;
  try {
    stage = sourceSnapshot.length ? stageTsv(sourceSnapshot, { packetRoot, projectRoot: resolvedProjectRoot }) : null;
    assertUnchanged(sourceSnapshot, packetRoot);
    if (treeSnapshot.length) assertTreeUnchanged(treeSnapshot, packetRoot);
    const output = createOutput(packetRoot, resolvedProjectRoot);
    outputSnapshot = typeof output === 'string' ? { path: output } : output;
    assertOutput(outputSnapshot, 'before child');
    if (stage) assertStagedTsv(stage);
    ground(ids, {
      outputPath: outputSnapshot.path,
      allowedTsv: stage?.files ?? [],
      env: makeEnvironment(stage?.path ?? path.join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data')),
    });
    assertUnchanged(sourceSnapshot, packetRoot);
    if (treeSnapshot.length) assertTreeUnchanged(treeSnapshot, packetRoot);
    assertOutput(outputSnapshot, 'after child');
    if (sourceSnapshot.length) verifyCommit(resolvedProjectRoot, packet.basis.releaseCommit);
  } catch (error) {
    operationError = error;
  } finally {
    if (stage) {
      try { stagedResiduePath = removeStagedTsv(stage); } catch (error) {
        if (!operationError) operationError = error;
        else cleanupError = error;
      }
    }
  }
  if (operationError) throw residueError(operationError, stagedResiduePath, cleanupError);
  return { ids, packetPath: resolvedPacketPath, outputPath: outputSnapshot.path, stagedResiduePath, grounded: true };
}

function main() {
  const { packetPath } = parseGroundAuthorityArgs(process.argv.slice(2));
  const result = runGroundAuthorityDiff({ packetPath });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  exactAddedPrintings,
  assertPacketArtifactsUnchanged,
  assertPacketTreeUnchanged,
  createGroundOutput,
  loadPriorAuthorityAtReleaseCommit,
  groundingEnvironment,
  parseGroundAuthorityArgs,
  readPacketFile,
  removeStage,
  residueError,
  runGroundAuthorityDiff,
  snapshotPacketTree,
  snapshotPacketArtifacts,
  stageValidatedTsv,
  assertStagedTsvUnchanged,
};
