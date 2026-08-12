const { execFileSync } = require('node:child_process');
const { existsSync, lstatSync, mkdtempSync, readdirSync, realpathSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const { buildAuthorityPacket, loadPriorAuthority } = require('./authority-refresh.cjs');

function comparablePath(value) {
  return path.resolve(String(value).trim()).replaceAll('\\', '/').toLowerCase();
}

function defaultGit(_command, args, options) {
  return execFileSync('git', args, { ...options, encoding: 'utf8' });
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function plainRealDirectory(directory, label) {
  const absolute = path.resolve(directory);
  const stat = lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a plain directory`);
  return realpathSync.native(absolute);
}

function assertExternalTempBase(projectRoot, tempBase) {
  const project = plainRealDirectory(projectRoot, 'authority project root');
  const base = plainRealDirectory(tempBase, 'authority temporary base');
  if (base === project || isWithin(project, base)) {
    throw new Error('authority temporary base must be external to the project');
  }
  return { project, base };
}

function assertExternalEmptyTemp(project, tempRoot, operations = {}) {
  const lstat = operations.lstat ?? lstatSync;
  const realpath = operations.realpath ?? realpathSync.native;
  const readdir = operations.readdir ?? readdirSync;
  const absolute = path.resolve(tempRoot);
  const before = lstat(absolute);
  if (!before.isDirectory() || before.isSymbolicLink()) throw new Error('authority temporary root must be a plain directory');
  const temporary = realpath(absolute);
  if (temporary === project || isWithin(project, temporary) || isWithin(temporary, project)) {
    throw new Error('authority temporary root must be external to the project');
  }
  if (readdir(temporary).length !== 0) throw new Error('authority temporary root must be empty');
  const after = lstat(absolute);
  if (!after.isDirectory() || after.isSymbolicLink()
    || after.dev !== before.dev || after.ino !== before.ino
    || realpath(absolute) !== temporary) {
    throw new Error('authority temporary root identity changed during admission');
  }
  return { temporary, device: after.dev, inode: after.ino };
}

function removeFailedTemp(project, tempPin) {
  if (!tempPin || !existsSync(tempPin.temporary)) return;
  const stat = lstatSync(tempPin.temporary);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return;
  const temporary = realpathSync.native(tempPin.temporary);
  if (temporary !== tempPin.temporary || stat.dev !== tempPin.device || stat.ino !== tempPin.inode) return;
  if (temporary === project || isWithin(temporary, project)) return;
  rmSync(temporary, { recursive: true, force: true });
}

function assertCleanSynchronizedMain(projectRoot, git = defaultGit) {
  const run = (args) => String(git('git', args, { cwd: projectRoot, encoding: 'utf8' })).trim();
  const topLevel = run(['rev-parse', '--show-toplevel']);
  if (comparablePath(topLevel) !== comparablePath(projectRoot)) throw new Error('authority project root is not the Git top level');
  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') throw new Error(`authority branch must be main, received ${branch || 'detached'}`);
  const status = run(['status', '--porcelain=v1', '--untracked-files=all']);
  if (status) throw new Error('authority worktree must be clean');
  const head = run(['rev-parse', 'HEAD']);
  const originMain = run(['rev-parse', 'origin/main']);
  if (!/^[a-f0-9]{40}$/.test(head) || head !== originMain) throw new Error('authority HEAD must equal origin/main');
  return { head, branch };
}

async function runAuthorityPacketCli({
  projectRoot = path.resolve(__dirname, '..', '..'),
  git = defaultGit,
  tempBase = tmpdir(),
  makeTemp = (prefix) => mkdtempSync(prefix),
  build = buildAuthorityPacket,
  loadPrior = loadPriorAuthority,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const gitState = assertCleanSynchronizedMain(projectRoot, git);
  const { project, base } = assertExternalTempBase(projectRoot, tempBase);
  let tempPin;
  try {
    const createdTemp = makeTemp(path.join(base, 'conan-authority-refresh-'));
    tempPin = assertExternalEmptyTemp(project, createdTemp);
    const tempRoot = tempPin.temporary;
    const prior = loadPrior(projectRoot);
    const fetchedAt = now().toISOString();
    const packet = await build({
      projectRoot,
      tempRoot,
      fetchedAt,
      releaseCommit: gitState.head,
      prior,
      fetchImpl,
    });
    const postBuildGitState = assertCleanSynchronizedMain(projectRoot, git);
    if (postBuildGitState.head !== gitState.head) throw new Error('authority Git state changed during acquisition');
    return {
      schemaVersion: 1,
      packetPath: path.join(tempRoot, 'packet.json'),
      releaseCommit: gitState.head,
      sourceDigest: packet.sourceDigests.officialCards,
      diff: packet.diff,
    };
  } catch (error) {
    removeFailedTemp(project, tempPin);
    throw error;
  }
}

async function main() {
  const result = await runAuthorityPacketCli();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertCleanSynchronizedMain,
  assertExternalEmptyTemp,
  assertExternalTempBase,
  runAuthorityPacketCli,
};
