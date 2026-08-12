const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  authorityReviewDigest,
  loadPriorAuthority,
  rederiveAuthorityPacket,
  stableJson,
  validatePublishableAuthorityPacket,
} = require('./authority-refresh.cjs');
const { assertCleanSynchronizedMain } = require('./build-authority-packet.cjs');
const {
  acquireCardsDataWriteLock,
  assertCardsDataWriteLock,
  recoverCardsDataTransactions,
  releaseCardsDataWriteLock,
  replaceStagedCardsDataRoot,
  transactionDirectory,
} = require('./official-api.cjs');

const PACKET_RELEASE = 'a9855a1672bb5ff6f7fe18aa6b0834a3959212d4';
const REVIEWED_TASK2_COMMIT = 'c92a46b7c707d4e38c7eb9d08c955efca13053ed';
const REVIEWED_INFRA_PLACEHOLDER = '__REVIEWED_INFRA_COMMIT__';
const REVIEWED_INFRA_COMMIT = 'e2d6d8ec530823d2172a50f19dcf1c1c780dca1e';
const REVIEWED_SOURCE_PACKET_SHA256 = 'b02e6216325fce07d3b5a847d6b6d7781217a4b5130999d059cb3f98a164a5d3';
const PUBLISHER_SOURCE_PATH = 'scripts/cards/publish-authority-packet.cjs';
const PACKET_ARTIFACT_PREFIX = 'snapshot/.claude/specs/cards-data/';
const PACKAGE_DIRECTORY = /^(?:ct-(?:d|p)\d{2}|pr-\d{2})$/;
const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

const EXPECTED_GENERATED_MAPPING_CHANGES = [
  'M\t.claude/auto/mapping/by-engine/cards.md',
  'M\t.claude/auto/mapping/by-rule/01-curriculum-design.md',
  'M\t.claude/auto/mapping/by-rule/01-victory-conditions.md',
  'M\t.claude/auto/mapping/by-rule/02-deck-construction.md',
  'M\t.claude/auto/mapping/by-rule/03-field-areas.md',
  'M\t.claude/auto/mapping/by-rule/04-game-setup.md',
  'M\t.claude/auto/mapping/by-rule/05-turn-phases.md',
  'M\t.claude/auto/mapping/by-rule/06-card-types.md',
  'M\t.claude/auto/mapping/by-rule/07-action-flow.md',
  'M\t.claude/auto/mapping/by-rule/08-contact.md',
  'M\t.claude/auto/mapping/by-rule/09-cutin-disguise.md',
  'M\t.claude/auto/mapping/by-rule/10-action-event.md',
  'M\t.claude/auto/mapping/by-rule/11-reasoning.md',
  'M\t.claude/auto/mapping/by-rule/12-next-hint.md',
  'M\t.claude/auto/mapping/by-rule/13-keywords.md',
  'M\t.claude/auto/mapping/by-rule/14-refresh.md',
  'M\t.claude/auto/mapping/by-rule/15-abilities-effects.md',
  'M\t.claude/auto/mapping/by-rule/15-contact-removal-observer-design.md',
  'M\t.claude/auto/mapping/by-rule/15-workflow.md',
  'M\t.claude/auto/mapping/by-rule/16-card-set.md',
  'M\t.claude/auto/mapping/by-rule/17-icons.md',
  'M\t.claude/auto/mapping/by-rule/18-mr.md',
  'M\t.claude/auto/mapping/by-rule/19-special-rules.md',
  'M\t.claude/auto/mapping/by-rule/20-color-and-switch.md',
  'M\t.claude/auto/mapping/by-rule/21-declared-ability-cost.md',
  'M\t.claude/auto/mapping/by-rule/22-qa-action-contact.md',
  'M\t.claude/auto/mapping/by-rule/23-qa-disguise-cutin.md',
  'M\t.claude/auto/mapping/by-rule/24-qa-naming-stun.md',
  'M\t.claude/auto/mapping/by-rule/25-qa-effects-resolution.md',
  'M\t.claude/auto/mapping/by-rule/26-05-11-ui-action-flows.md',
  'M\t.claude/auto/mapping/by-rule/26-05-11-ui-game-setup-flows.md',
  'M\t.claude/auto/mapping/by-rule/26-07-02.md',
  'M\t.claude/auto/mapping/by-rule/26-qa-deck-refresh.md',
  'M\t.claude/auto/mapping/by-rule/27-card-restrictions.md',
  'M\t.claude/auto/mapping/by-rule/28-errata.md',
  'M\t.claude/auto/mapping/by-spec/2026-05-11-ui-action-flows.md',
  'M\t.claude/auto/mapping/by-spec/2026-05-11-ui-game-setup-flows.md',
  'M\t.claude/auto/mapping/by-spec/card-authoring-convention.md',
  'M\t.claude/auto/mapping/by-spec/card-condition-catalog.md',
  'M\t.claude/auto/mapping/by-spec/cards-data--INDEX.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-atom-verbs.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-card-abilities.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-card-shape.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-effect-descriptor.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-events.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-flow-contact.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-flow-control.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-flow-setup.md',
  'M\t.claude/auto/mapping/by-spec/engine-api-resolver.md',
  'M\t.claude/auto/mapping/by-spec/engine-cluster15-contact-removal-observer-design.md',
  'M\t.claude/auto/mapping/by-spec/engine-wave2-action-triggers-design.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B03111.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B05063.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B07100.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B09019.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B09033.md',
  'M\t.claude/auto/mapping/by-spec/grounding--B09033P.md',
  'M\t.claude/auto/mapping/by-spec/grounding--D06003.md',
  'M\t.claude/auto/mapping/by-spec/grounding--PR265.md',
  'M\t.claude/auto/mapping/by-spec/phase-9-f-mcts.md',
  'M\t.claude/auto/mapping/by-spec/phase-9-g-replay.md',
  'M\t.claude/auto/mapping/by-spec/phase-9-h-performance.md',
  'M\t.claude/auto/mapping/by-spec/refactor-plan--phase-3b-design.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--INDEX.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--caseDeclaredEvidenceFlip.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--caseResolvedHandRemove.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--caseTraitConditioned.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--eventRemoveByAP.md',
  'M\t.claude/auto/mapping/by-spec/shared-classes--partnerColorKeyword.md',
  'M\t.claude/auto/mapping/cards-to-rules-cards.md',
  'M\t.claude/auto/mapping/cards-to-rules-engine-core.md',
  'M\t.claude/auto/mapping/cards-to-rules-engine-flow.md',
  'M\t.claude/auto/mapping/graph-rules-engine-core.md',
  'M\t.claude/auto/mapping/graph-rules-engine-flow.md',
  'M\t.claude/auto/mapping/graph-specs.md',
  'M\t.claude/auto/mapping/index.md',
  'M\t.claude/auto/mapping/rules-to-cards.md',
];

const EXPECTED_REBASE_INFRA_CHANGES = [
  ...EXPECTED_GENERATED_MAPPING_CHANGES,
  'A\ttests/scripts/cards-data-snapshot-cli.test.ts',
  'M\t.claude/auto/progress/tests.md',
  'M\t.claude/auto/structure.md',
  'M\t.claude/specs/cards-data/_regen.js',
  'M\t.claude/specs/cards-data/_regen_all.cjs',
  'M\t.gitignore',
  'M\tpackage.json',
  'M\tscripts/card-text-crosscheck.cjs',
  'M\tscripts/cards/authority-refresh.cjs',
  'M\tscripts/cards/cards-data-status.cjs',
  'M\tscripts/cards/check-official-sync.cjs',
  'M\tscripts/cards/official-api.cjs',
  'A\tscripts/cards/publish-authority-packet.cjs',
  'M\tscripts/cards/qa-normalize.cjs',
  'M\tscripts/cards/validate-authority-exceptions.ts',
  'M\tscripts/cards/write-qa-hash-snapshot.cjs',
  'M\tscripts/compiler/tsv-corpus.cjs',
  'M\tscripts/gen-cards/gen-complex-cutins.cjs',
  'M\tscripts/gen-cards/gen-partners.cjs',
  'M\tscripts/gen-cards/gen-simple-cards.cjs',
  'M\tscripts/gen-docs/gen-qa-trace.ts',
  'M\tscripts/gen-docs/index.ts',
  'M\tscripts/gen-p-spread.cjs',
  'M\tscripts/ground-dossier.cjs',
  'M\tscripts/inventory-remaining.cjs',
  'M\tscripts/lint-icon-abilities.ts',
  'M\tscripts/lint-qa-trace.ts',
  'M\tscripts/qa-adjudication.ts',
  'M\tscripts/taskA-codegen.cjs',
  'M\tscripts/taskA-enrich.cjs',
  'M\tsrc/engine/cards/tsv-loader-fs.ts',
  'M\ttests/compiler/qa-normalize.test.ts',
  'M\ttests/scripts/cards-authority-refresh.test.ts',
  'M\ttests/scripts/gen-qa-trace.test.ts',
  'M\ttests/scripts/official-api.test.ts',
].sort(compareOrdinal);
const EXPECTED_ARMING_CHANGES = [`M\t${PUBLISHER_SOURCE_PATH}`];

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || stableJson(Object.keys(value).sort(compareOrdinal)) !== stableJson([...keys].sort(compareOrdinal))) {
    throw new Error(`${label} schema is invalid`);
  }
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function pathsOverlap(left, right) {
  return left === right || isWithin(left, right) || isWithin(right, left);
}

function admitPlainDirectory(directory, label, { requireEmpty = false } = {}) {
  const absolute = path.resolve(directory);
  const before = fs.lstatSync(absolute);
  if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`${label} must be a plain directory`);
  const resolved = fs.realpathSync.native(absolute);
  if (requireEmpty && fs.readdirSync(resolved).length !== 0) throw new Error(`${label} must be empty`);
  const after = fs.lstatSync(absolute);
  if (!after.isDirectory() || after.isSymbolicLink()
    || after.dev !== before.dev || after.ino !== before.ino
    || fs.realpathSync.native(absolute) !== resolved) {
    throw new Error(`${label} identity changed during admission`);
  }
  return { resolved, device: after.dev, inode: after.ino };
}

function assertPinnedDirectory(pin, label) {
  const stat = fs.lstatSync(pin.resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || stat.dev !== pin.device || stat.ino !== pin.inode
    || fs.realpathSync.native(pin.resolved) !== pin.resolved) {
    throw new Error(`${label} identity changed`);
  }
}

function assertExternalDirectory(projectRoot, directory, label, options) {
  const project = admitPlainDirectory(projectRoot, 'authority project root');
  const candidate = admitPlainDirectory(directory, label, options);
  if (pathsOverlap(project.resolved, candidate.resolved)) throw new Error(`${label} must be external to the project`);
  return candidate;
}

function readRegularJson(file, label) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is invalid JSON`, { cause: error });
  }
}

function readPinnedRegularJson(file, label) {
  const absolute = path.resolve(file);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const resolved = fs.realpathSync.native(absolute);
  const bytes = fs.readFileSync(resolved);
  const after = fs.lstatSync(absolute);
  if (!after.isFile() || after.isSymbolicLink()
    || after.dev !== before.dev || after.ino !== before.ino
    || fs.realpathSync.native(absolute) !== resolved) {
    throw new Error(`${label} identity changed during read`);
  }
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    throw new Error(`${label} is invalid JSON`, { cause: error });
  }
}

function defaultGit(_command, args, options) {
  return execFileSync('git', args, { ...options, encoding: 'utf8' });
}

function gitValue(projectRoot, git, args) {
  return String(git('git', args, { cwd: projectRoot, encoding: 'utf8' })).trim();
}

function singleParent(projectRoot, git, commit, label) {
  const values = gitValue(projectRoot, git, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/);
  if (values.length !== 2 || values[0] !== commit || !COMMIT.test(values[1])) {
    throw new Error(`${label} must have exactly one reviewed parent`);
  }
  return values[1];
}

function gitLines(projectRoot, git, args) {
  return gitValue(projectRoot, git, args)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.replaceAll('\\', '/'))
    .sort(compareOrdinal);
}

function normalizeArmedPublisherSource(source, reviewedInfraCommit) {
  const armed = `const REVIEWED_INFRA_COMMIT = '${reviewedInfraCommit}';`;
  const placeholder = `const REVIEWED_INFRA_COMMIT = '${REVIEWED_INFRA_PLACEHOLDER}';`;
  if (!COMMIT.test(reviewedInfraCommit) || source.split(armed).length !== 2) {
    throw new Error('authority publisher infrastructure attestation is not armed');
  }
  return source.replace(armed, placeholder);
}

function synchronizedMainRefState(projectRoot, git = defaultGit) {
  const topLevel = gitValue(projectRoot, git, ['rev-parse', '--show-toplevel']);
  if (path.resolve(topLevel) !== path.resolve(projectRoot)) throw new Error('authority project root is not the Git top level');
  const branch = gitValue(projectRoot, git, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') throw new Error(`authority branch must be main, received ${branch || 'detached'}`);
  const head = gitValue(projectRoot, git, ['rev-parse', 'HEAD']);
  const originMain = gitValue(projectRoot, git, ['rev-parse', 'origin/main']);
  if (!COMMIT.test(head) || head !== originMain) throw new Error('authority HEAD must equal origin/main');
  return { head, branch };
}

function assertPublisherAttestation(projectRoot, git, state, operations = {}) {
  const reviewedInfraCommit = operations.reviewedInfraCommit ?? REVIEWED_INFRA_COMMIT;
  if (!COMMIT.test(reviewedInfraCommit)) throw new Error('authority publisher infrastructure attestation is not armed');
  const infra = singleParent(projectRoot, git, state.head, 'authority publisher arming commit');
  const task2 = singleParent(projectRoot, git, infra, 'authority publisher infrastructure commit');
  const packetRelease = singleParent(projectRoot, git, task2, 'authority Task 2 commit');
  if (infra !== reviewedInfraCommit || task2 !== REVIEWED_TASK2_COMMIT || packetRelease !== PACKET_RELEASE) {
    throw new Error('authority publisher lineage does not match the reviewed Task 2 bridge');
  }
  const infraChanges = gitLines(projectRoot, git, [
    'diff-tree', '--no-commit-id', '--name-status', '-r', '--no-renames', REVIEWED_TASK2_COMMIT, infra,
  ]);
  if (stableJson(infraChanges) !== stableJson(EXPECTED_REBASE_INFRA_CHANGES)) {
    throw new Error('authority publisher commit contains an unreviewed path change');
  }
  const armingChanges = gitLines(projectRoot, git, [
    'diff-tree', '--no-commit-id', '--name-status', '-r', '--no-renames', infra, state.head,
  ]);
  if (stableJson(armingChanges) !== stableJson(EXPECTED_ARMING_CHANGES)) {
    throw new Error('authority publisher arming commit contains an unreviewed path change');
  }
  const currentSource = operations.currentSource
    ?? String(git('git', ['show', `${state.head}:${PUBLISHER_SOURCE_PATH}`], { cwd: projectRoot, encoding: 'utf8' }));
  const reviewedSource = operations.reviewedSource
    ?? String(git('git', ['show', `${infra}:${PUBLISHER_SOURCE_PATH}`], { cwd: projectRoot, encoding: 'utf8' }));
  if (normalizeArmedPublisherSource(currentSource, reviewedInfraCommit) !== reviewedSource) {
    throw new Error('authority publisher arming commit changed bytes beyond the reviewed attestation');
  }
  return state;
}

function assertPublisherGitState(projectRoot, git = defaultGit, operations = {}) {
  const state = assertCleanSynchronizedMain(projectRoot, git);
  return assertPublisherAttestation(projectRoot, git, state, operations);
}

const assertRebaseGitState = assertPublisherGitState;

function clearPinnedDirectory(pin) {
  assertPinnedDirectory(pin, 'authority output root');
  for (const entry of fs.readdirSync(pin.resolved)) {
    fs.rmSync(path.join(pin.resolved, entry), { recursive: true, force: true });
  }
}

async function rederiveAuthorityPacketForPublication({
  projectRoot,
  packetPath,
  outputRoot,
  git = defaultGit,
  expectedSourcePacketSha256 = REVIEWED_SOURCE_PACKET_SHA256,
} = {}) {
  const state = assertRebaseGitState(projectRoot, git);
  const outputPin = assertExternalDirectory(projectRoot, outputRoot, 'authority rederived packet root', { requireEmpty: true });
  const prior = loadPriorAuthority(projectRoot);
  try {
    const rederived = await rederiveAuthorityPacket({
      projectRoot,
      sourcePacketPath: packetPath,
      outputRoot: outputPin.resolved,
      expectedSourcePacketSha256,
      expectedSourceReleaseCommit: PACKET_RELEASE,
      releaseCommit: state.head,
      prior,
    });
    const postState = assertRebaseGitState(projectRoot, git);
    if (postState.head !== state.head) throw new Error('authority Git state changed during rederivation');
    return {
      schemaVersion: 1,
      packetPath: path.join(outputPin.resolved, 'packet.json'),
      originalPacketSha256: expectedSourcePacketSha256,
      originalReleaseCommit: PACKET_RELEASE,
      releaseCommit: state.head,
      reviewDigest: authorityReviewDigest(rederived),
    };
  } catch (error) {
    clearPinnedDirectory(outputPin);
    throw error;
  }
}

function validateAuthorityApproval(approval) {
  exactKeys(approval, ['dispositions', 'packetDigest', 'schemaVersion'], 'authority publication approval');
  if (approval.schemaVersion !== 1 || !HASH.test(approval.packetDigest) || !Array.isArray(approval.dispositions)) {
    throw new Error('authority publication approval schema is invalid');
  }
  const keys = approval.dispositions.map((entry) => {
    exactKeys(entry, ['identity', 'kind', 'packetDigest'], 'authority disposition');
    if (!['added', 'removed', 'changed', 'qa'].includes(entry.kind)
      || typeof entry.identity !== 'string' || !entry.identity
      || entry.packetDigest !== approval.packetDigest) {
      throw new Error('authority disposition schema is invalid');
    }
    return `${entry.kind}:${entry.identity}`;
  });
  if (new Set(keys).size !== keys.length || stableJson(keys) !== stableJson([...keys].sort(compareOrdinal))) {
    throw new Error('authority dispositions must be unique and sorted');
  }
  return approval;
}

function loadAuthorityApproval(approvalPath) {
  return validateAuthorityApproval(readPinnedRegularJson(approvalPath, 'authority publication approval').value);
}

function loadAuthorityApprovalRecord(approvalPath) {
  const record = readPinnedRegularJson(approvalPath, 'authority publication approval');
  return { ...record, approval: validateAuthorityApproval(record.value) };
}

function managedAuthorityFiles(root, current = root) {
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`authority cards-data contains a symlink: ${absolute}`);
    if (stat.isDirectory()) {
      files.push(...managedAuthorityFiles(root, absolute));
    } else if (stat.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'));
    } else {
      throw new Error(`authority cards-data contains a non-file entry: ${absolute}`);
    }
  }
  return files.sort(compareOrdinal);
}

function expectedManagedPaths(packet) {
  return packet.artifacts.map((entry) => entry.path.slice(PACKET_ARTIFACT_PREFIX.length)).sort(compareOrdinal);
}

function verifyManagedAuthorityRoot(root, packet) {
  const expected = expectedManagedPaths(packet);
  const actual = [];
  for (const name of ['status.json', 'qa-hash-snapshot.json', 'authority-field-index.json']) {
    if (fs.existsSync(path.join(root, name))) actual.push(name);
  }
  for (const name of fs.readdirSync(root)) {
    if (name === '_raw' || PACKAGE_DIRECTORY.test(name)) {
      actual.push(...managedAuthorityFiles(root, path.join(root, name)));
    }
  }
  actual.sort(compareOrdinal);
  if (stableJson(actual) !== stableJson(expected)) throw new Error('installed authority file set does not match packet');
  for (const artifact of packet.artifacts) {
    const relative = artifact.path.slice(PACKET_ARTIFACT_PREFIX.length);
    const bytes = fs.readFileSync(path.join(root, ...relative.split('/')));
    if (bytes.byteLength !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error(`installed authority artifact changed: ${relative}`);
    }
  }
}

function copyStaticCardsData(baseDir, stagedBaseDir) {
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.name === '_raw' || PACKAGE_DIRECTORY.test(entry.name)
      || ['status.json', 'qa-hash-snapshot.json', 'authority-field-index.json'].includes(entry.name)) continue;
    const source = path.join(baseDir, entry.name);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`authority static cards-data contains a symlink: ${source}`);
    fs.cpSync(source, path.join(stagedBaseDir, entry.name), { recursive: true, dereference: false });
  }
}

function staticCardsDataTree(root, current = root) {
  const entries = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => compareOrdinal(left.name, right.name))) {
    if (current === root && (entry.name === '_raw' || PACKAGE_DIRECTORY.test(entry.name)
      || ['status.json', 'qa-hash-snapshot.json', 'authority-field-index.json'].includes(entry.name))) continue;
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`authority static cards-data contains a symlink: ${absolute}`);
    if (stat.isDirectory()) {
      entries.push({ path: relative, type: 'directory' });
      entries.push(...staticCardsDataTree(root, absolute));
    } else if (stat.isFile()) {
      const bytes = fs.readFileSync(absolute);
      entries.push({ path: relative, type: 'file', bytes: bytes.byteLength, sha256: sha256(bytes) });
    } else {
      throw new Error(`authority static cards-data contains a non-file entry: ${absolute}`);
    }
  }
  return entries;
}

function copyPacketArtifacts(packetRoot, stagedBaseDir, packet) {
  for (const artifact of packet.artifacts) {
    const relative = artifact.path.slice(PACKET_ARTIFACT_PREFIX.length);
    const target = path.join(stagedBaseDir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(packetRoot, ...artifact.path.split('/')), target);
  }
}

function assertGitRefsUnchanged(projectRoot, git, expectedHead) {
  const branch = gitValue(projectRoot, git, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = gitValue(projectRoot, git, ['rev-parse', 'HEAD']);
  const originMain = gitValue(projectRoot, git, ['rev-parse', 'origin/main']);
  if (branch !== 'main' || head !== expectedHead || originMain !== expectedHead) {
    throw new Error('authority Git refs changed during publication');
  }
}

function removeManagedStage(stagePin) {
  if (!stagePin || !fs.existsSync(stagePin.resolved)) return;
  try {
    assertPinnedDirectory(stagePin, 'authority staged cards-data root');
    fs.rmSync(stagePin.resolved, { recursive: true, force: true });
  } catch {
    // A transaction owns any path whose identity no longer matches this pin.
  }
}

function assertStaticCardsDataSnapshot(baseDir, stagedBaseDir, expectedSnapshot) {
  if (stableJson(staticCardsDataTree(baseDir)) !== expectedSnapshot) {
    throw new Error('authority static cards-data changed during publication');
  }
  if (stableJson(staticCardsDataTree(stagedBaseDir)) !== expectedSnapshot) {
    throw new Error('authority staged static cards-data does not match the reviewed source');
  }
}

function publishAuthorityPacket({
  projectRoot,
  packetPath,
  approvalPath,
  git = defaultGit,
} = {}) {
  const initialRefState = synchronizedMainRefState(projectRoot, git);
  assertPublisherAttestation(projectRoot, git, initialRefState);
  const baseDir = path.join(projectRoot, '.claude', 'specs', 'cards-data');
  const lockToken = acquireCardsDataWriteLock(baseDir);
  let stagePin;
  let publicationResult;
  try {
    const startupRecovery = recoverCardsDataTransactions({ baseDir, lockToken });
    if (startupRecovery.cleanupPending || startupRecovery.rejected) {
      throw new Error('authority publication startup recovery is incomplete');
    }
    const gitState = assertPublisherGitState(projectRoot, git);
    if (gitState.head !== initialRefState.head) throw new Error('authority HEAD changed during startup recovery');
    const packetRoot = path.dirname(path.resolve(packetPath));
    const packetPin = assertExternalDirectory(projectRoot, packetRoot, 'authority packet root');
    if (path.resolve(packetPath) !== path.join(packetPin.resolved, 'packet.json')) {
      throw new Error('authority packet path must be packet.json at the packet root');
    }
    const packet = readRegularJson(packetPath, 'authority packet');
    if (packet.basis?.releaseCommit !== gitState.head) throw new Error('authority packet is not bound to current HEAD');
    const prior = loadPriorAuthority(projectRoot, { lockToken });
    const priorSnapshot = stableJson(prior);
    const staticSnapshot = stableJson(staticCardsDataTree(baseDir));
    const approvalRecord = loadAuthorityApprovalRecord(approvalPath);
    const approval = approvalRecord.approval;
    if (authorityReviewDigest(packet) !== approval.packetDigest) throw new Error('authority approval digest does not match packet');
    validatePublishableAuthorityPacket(packet, prior, approval.dispositions, {
      packetRoot: packetPin.resolved,
      projectRoot,
    });
    assertGitRefsUnchanged(projectRoot, git, gitState.head);

    const journalDir = transactionDirectory(baseDir);
    if (fs.existsSync(journalDir) && fs.readdirSync(journalDir).length !== 0) {
      throw new Error('authority cards-data has an unfinished transaction');
    }
    const stagedBaseDir = fs.mkdtempSync(path.join(path.dirname(baseDir), '.cards-data.stage-'));
    stagePin = admitPlainDirectory(stagedBaseDir, 'authority staged cards-data root', { requireEmpty: true });
    copyStaticCardsData(baseDir, stagePin.resolved);
    copyPacketArtifacts(packetPin.resolved, stagePin.resolved, packet);
    verifyManagedAuthorityRoot(stagePin.resolved, packet);
    assertPinnedDirectory(packetPin, 'authority packet root');
    assertPublisherGitState(projectRoot, git);
    if (stableJson(loadPriorAuthority(projectRoot, { lockToken })) !== priorSnapshot) {
      throw new Error('authority prior changed during publication');
    }
    assertStaticCardsDataSnapshot(baseDir, stagePin.resolved, staticSnapshot);
    assertCardsDataWriteLock(baseDir, lockToken);
    let transaction;
    try {
      transaction = replaceStagedCardsDataRoot({
        baseDir,
        stagedBaseDir: stagePin.resolved,
        lockToken,
        hooks: {
          afterInstalled: () => {
            verifyManagedAuthorityRoot(baseDir, packet);
            assertGitRefsUnchanged(projectRoot, git, gitState.head);
            assertCardsDataWriteLock(baseDir, lockToken);
          },
        },
      });
    } catch (error) {
      const recovery = recoverCardsDataTransactions({ baseDir, lockToken });
      let rollbackComplete = recovery.cleanupPending === 0 && recovery.rejected === 0;
      try {
        rollbackComplete = rollbackComplete
          && stableJson(loadPriorAuthority(projectRoot, { lockToken })) === priorSnapshot
          && stableJson(staticCardsDataTree(baseDir)) === staticSnapshot;
      } catch {
        rollbackComplete = false;
      }
      if (!rollbackComplete) {
        throw new AggregateError([error], 'authority publication failed and rollback was incomplete');
      }
      throw error;
    }
    if (transaction.cleanupPending) {
      const recovery = recoverCardsDataTransactions({ baseDir, lockToken });
      if (recovery.cleanupPending || recovery.rejected) throw new Error('authority publication cleanup is incomplete');
    }
    verifyManagedAuthorityRoot(baseDir, packet);
    assertCardsDataWriteLock(baseDir, lockToken);
    publicationResult = {
      schemaVersion: 1,
      releaseCommit: gitState.head,
      packetDigest: approval.packetDigest,
      approvalSha256: sha256(approvalRecord.bytes),
      artifacts: packet.artifacts.length,
      diff: packet.diff,
      lockCleanupPending: false,
    };
    return publicationResult;
  } finally {
    removeManagedStage(stagePin);
    if (!releaseCardsDataWriteLock(baseDir, lockToken) && publicationResult) {
      publicationResult.lockCleanupPending = true;
    }
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['rederive', 'publish'].includes(command)) throw new Error('usage: authority publish command must be rederive or publish');
  const allowed = command === 'rederive' ? ['--out', '--packet'] : ['--approval', '--packet'];
  if (rest.length !== 4) throw new Error(`usage: authority ${command} arguments are invalid`);
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!allowed.includes(rest[index]) || values[rest[index]]) throw new Error(`usage: authority ${command} arguments are invalid`);
    values[rest[index]] = rest[index + 1];
  }
  if (allowed.some((key) => !values[key])) throw new Error(`usage: authority ${command} arguments are invalid`);
  return { command, values };
}

async function main() {
  const { command, values } = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(__dirname, '..', '..');
  const result = command === 'rederive'
    ? await rederiveAuthorityPacketForPublication({ projectRoot, packetPath: values['--packet'], outputRoot: values['--out'] })
    : publishAuthorityPacket({ projectRoot, packetPath: values['--packet'], approvalPath: values['--approval'] });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_ARMING_CHANGES,
  EXPECTED_REBASE_INFRA_CHANGES,
  PACKET_RELEASE,
  REVIEWED_INFRA_COMMIT,
  REVIEWED_INFRA_PLACEHOLDER,
  REVIEWED_SOURCE_PACKET_SHA256,
  REVIEWED_TASK2_COMMIT,
  assertPublisherGitState,
  assertRebaseGitState,
  assertStaticCardsDataSnapshot,
  loadAuthorityApproval,
  publishAuthorityPacket,
  rebaseAuthorityPacket: rederiveAuthorityPacketForPublication,
  rederiveAuthorityPacketForPublication,
  verifyManagedAuthorityRoot,
};
