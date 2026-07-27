import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const approvedClassifications = new Map([
  ['validated-rule', 'validated'],
  ['validated-card', 'validated'],
  ['reviewed-card-implementation', 'reviewed'],
  ['reviewed-policy', 'reviewed'],
]);
const allowedOperations = new Set([
  'visible-click',
  'visible-keyboard',
  'visible-read',
  'visible-screenshot',
  'visible-scroll',
  'public-navigation',
]);

function isRepositoryPath(path) {
  return typeof path === 'string'
    && path.length > 0
    && !path.includes('\\')
    && !path.includes(':')
    && !path.startsWith('/')
    && !path.split('/').includes('..');
}

function normalizedLines(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function validateRuntimePacketInputs(inputs, readText) {
  const errors = [];
  const { manifest, registry } = inputs ?? {};

  if (!/^[0-9a-f]{40}$/i.test(inputs?.sourceCommit ?? '')) {
    errors.push('sourceCommit must be a 40-character Git commit');
  }
  if (typeof inputs?.generatedAt !== 'string'
    || Number.isNaN(Date.parse(inputs.generatedAt))
    || new Date(inputs.generatedAt).toISOString() !== inputs.generatedAt) {
    errors.push('generatedAt must be a canonical ISO timestamp');
  }
  if (inputs?.isWorktreeClean !== true) errors.push('worktree is dirty');
  if (manifest?.schemaVersion !== 1) errors.push('manifest schemaVersion must be 1');
  if (!/^\d{3}$/.test(manifest?.row ?? '')) errors.push('row must be three digits');
  if (typeof manifest?.ruleBaseline !== 'string' || manifest.ruleBaseline.length === 0) {
    errors.push('ruleBaseline is required');
  }
  if (manifest?.informationMode !== 'public-ui-only') {
    errors.push('informationMode must be public-ui-only');
  }
  if (!Array.isArray(manifest?.allowedOperations) || manifest.allowedOperations.length === 0) {
    errors.push('at least one allowed operation is required');
  } else {
    for (const operation of manifest.allowedOperations) {
      if (!allowedOperations.has(operation)) errors.push(`not an allowed operation: ${operation}`);
    }
    if (new Set(manifest.allowedOperations).size !== manifest.allowedOperations.length) {
      errors.push('allowedOperations contains duplicates');
    }
  }

  if (registry?.schemaVersion !== 1 || !Array.isArray(registry?.sources)) {
    errors.push('source registry schema is invalid');
  }
  const registeredById = new Map();
  const registeredPaths = new Set();
  for (const source of registry?.sources ?? []) {
    if (typeof source?.sourceId !== 'string' || source.sourceId.length === 0) {
      errors.push('registry sourceId is required');
      continue;
    }
    if (registeredById.has(source.sourceId)) {
      errors.push(`duplicate registry sourceId: ${source.sourceId}`);
    }
    registeredById.set(source.sourceId, source);
    if (!isRepositoryPath(source.path)) {
      errors.push(`registry source path escapes repository: ${source.path}`);
    } else if (registeredPaths.has(source.path)) {
      errors.push(`duplicate registry source path: ${source.path}`);
    } else {
      registeredPaths.add(source.path);
    }
  }

  if (!Array.isArray(manifest?.sources) || manifest.sources.length === 0) {
    errors.push('at least one registered source is required');
  }
  const seenSourceIds = new Set();
  for (const reference of manifest?.sources ?? []) {
    const source = registeredById.get(reference?.sourceId);
    if (!source) {
      errors.push(`source is not registered: ${reference?.sourceId}`);
      continue;
    }
    if (seenSourceIds.has(reference.sourceId)) {
      errors.push(`duplicate manifest sourceId: ${reference.sourceId}`);
    }
    seenSourceIds.add(reference.sourceId);
    if (approvedClassifications.get(source.classification) !== source.status) {
      errors.push(`registry source is not approved: ${reference.sourceId}`);
    }
    if (typeof source.sourceVersion !== 'string' || source.sourceVersion.length === 0) {
      errors.push(`registry sourceVersion is required: ${reference.sourceId}`);
    }
    if (source.classification === 'validated-rule'
      && source.sourceVersion !== manifest.ruleBaseline) {
      errors.push(
        `rule source ${reference.sourceId} version ${source.sourceVersion} does not match rule baseline ${manifest.ruleBaseline}`,
      );
    }
    const text = isRepositoryPath(source.path) ? readText(source.path) : undefined;
    if (typeof text !== 'string') {
      errors.push(`source is missing: ${source.path}`);
      continue;
    }
    const lineCount = normalizedLines(text).length;
    if (!Number.isInteger(reference.lineStart)
      || !Number.isInteger(reference.lineEnd)
      || reference.lineStart < 1
      || reference.lineEnd < reference.lineStart
      || reference.lineEnd > lineCount) {
      errors.push(`line range is outside source ${reference.sourceId}: ${reference.lineStart}-${reference.lineEnd}/${lineCount}`);
    }
  }

  if (!Array.isArray(manifest?.unresolved)) {
    errors.push('unresolved must be an array');
  } else {
    for (const requirement of manifest.unresolved) {
      errors.push(`unresolved requirement: ${requirement}`);
    }
  }
  return errors;
}

export function buildRuntimePacket(inputs, readText) {
  const errors = validateRuntimePacketInputs(inputs, readText);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const registeredById = new Map(inputs.registry.sources.map((source) => [source.sourceId, source]));
  const sources = [...inputs.manifest.sources]
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
    .map((reference) => {
      const registered = registeredById.get(reference.sourceId);
      const fullText = readText(registered.path).replace(/\r\n/g, '\n');
      const content = normalizedLines(fullText)
        .slice(reference.lineStart - 1, reference.lineEnd)
        .join('\n');
      return {
        sourceId: registered.sourceId,
        path: registered.path,
        classification: registered.classification,
        status: registered.status,
        sourceVersion: registered.sourceVersion,
        lineStart: reference.lineStart,
        lineEnd: reference.lineEnd,
        sha256: sha256(fullText),
        contentSha256: sha256(content),
        content,
      };
    });
  const packet = {
    schemaVersion: 2,
    sourceCommit: inputs.sourceCommit.toLowerCase(),
    generatedAt: inputs.generatedAt,
    row: inputs.manifest.row,
    ruleBaseline: inputs.manifest.ruleBaseline,
    informationMode: inputs.manifest.informationMode,
    allowedOperations: [...inputs.manifest.allowedOperations],
    sources,
  };
  return {
    ...packet,
    packetSha256: sha256(JSON.stringify(packet)),
  };
}

export function verifyRuntimePacket(packet, registry, expected, readText) {
  const errors = [];
  if (packet?.schemaVersion !== 2) errors.push('packet schemaVersion must be 2');
  const { packetSha256, ...packetBody } = packet ?? {};
  if (typeof packetSha256 !== 'string' || sha256(JSON.stringify(packetBody)) !== packetSha256) {
    errors.push('packetSha256 does not match packet content');
  }
  if (packet?.sourceCommit !== expected?.sourceCommit?.toLowerCase()) {
    errors.push('sourceCommit does not match expected repository HEAD');
  }
  if (packet?.row !== expected?.row) errors.push('row does not match expected row');
  if (packet?.informationMode !== 'public-ui-only') {
    errors.push('packet informationMode must be public-ui-only');
  }
  if (typeof packet?.generatedAt !== 'string'
    || Number.isNaN(Date.parse(packet.generatedAt))
    || new Date(packet.generatedAt).toISOString() !== packet.generatedAt) {
    errors.push('packet generatedAt is invalid');
  }
  if (!Array.isArray(packet?.allowedOperations) || packet.allowedOperations.length === 0) {
    errors.push('packet allowedOperations is empty');
  } else {
    for (const operation of packet.allowedOperations) {
      if (!allowedOperations.has(operation)) errors.push(`packet operation is forbidden: ${operation}`);
    }
  }

  const registeredById = new Map(
    (registry?.sources ?? []).map((source) => [source.sourceId, source]),
  );
  const seenSourceIds = new Set();
  if (!Array.isArray(packet?.sources) || packet.sources.length === 0) {
    errors.push('packet sources are empty');
  }
  for (const source of packet?.sources ?? []) {
    if (seenSourceIds.has(source.sourceId)) {
      errors.push(`duplicate packet sourceId: ${source.sourceId}`);
    }
    seenSourceIds.add(source.sourceId);
    const registered = registeredById.get(source.sourceId);
    if (!registered) {
      errors.push(`packet source is not registered: ${source.sourceId}`);
      continue;
    }
    const provenanceMatches = registered.path === source.path
      && registered.classification === source.classification
      && registered.status === source.status
      && registered.sourceVersion === source.sourceVersion
      && approvedClassifications.get(registered.classification) === registered.status;
    if (!provenanceMatches) {
      errors.push(`registry provenance does not match: ${source.sourceId}`);
    }
    if (source.classification === 'validated-rule'
      && source.sourceVersion !== packet.ruleBaseline) {
      errors.push(`packet rule baseline does not match: ${source.sourceId}`);
    }
    const text = isRepositoryPath(source.path) ? readText(source.path) : undefined;
    if (typeof text !== 'string') {
      errors.push(`packet source is missing: ${source.path}`);
      continue;
    }
    const fullText = text.replace(/\r\n/g, '\n');
    if (sha256(fullText) !== source.sha256) {
      errors.push(`source file hash does not match: ${source.sourceId}`);
    }
    const lines = normalizedLines(fullText);
    if (!Number.isInteger(source.lineStart)
      || !Number.isInteger(source.lineEnd)
      || source.lineStart < 1
      || source.lineEnd < source.lineStart
      || source.lineEnd > lines.length) {
      errors.push(`packet line range is invalid: ${source.sourceId}`);
      continue;
    }
    const expectedContent = lines.slice(source.lineStart - 1, source.lineEnd).join('\n');
    if (source.content !== expectedContent || source.contentSha256 !== sha256(expectedContent)) {
      errors.push(`packet source content does not match: ${source.sourceId}`);
    }
  }
  return errors;
}

export function parseCliArguments(args) {
  const parsed = {
    manifestPath: undefined,
    registryPath: undefined,
    outputPath: undefined,
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--')) throw new Error(`unknown argument: ${flag}`);
    if (typeof value !== 'string' || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }
    if (flag === '--manifest') parsed.manifestPath = value;
    else if (flag === '--registry') parsed.registryPath = value;
    else if (flag === '--output') parsed.outputPath = value;
    else throw new Error(`unknown argument: ${flag}`);
  }
  if (!parsed.manifestPath || !parsed.registryPath) {
    throw new Error(
      'Usage: node scripts/build-tcg-runtime-packet.mjs --manifest <path> --registry <path> [--output <path>]',
    );
  }
  for (const path of Object.values(parsed)) {
    if (path !== undefined && !isRepositoryPath(path)) {
      throw new Error(`CLI path escapes repository: ${path}`);
    }
  }
  return parsed;
}

async function readRepositoryText(path) {
  const target = resolve(repositoryRoot, path);
  if (target !== repositoryRoot && !target.startsWith(`${repositoryRoot}${sep}`)) return undefined;
  try {
    return await readFile(target, 'utf8');
  } catch {
    return undefined;
  }
}

async function readJson(path, label) {
  const text = await readRepositoryText(path);
  if (text === undefined) throw new Error(`${label} is missing: ${path}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON: ${path}`);
  }
}

async function runCli(args) {
  const options = parseCliArguments(args);
  const manifest = await readJson(options.manifestPath, 'manifest');
  const registry = await readJson(options.registryPath, 'source registry');
  const referencedIds = new Set((manifest.sources ?? []).map((source) => source.sourceId));
  const referencedPaths = (registry.sources ?? [])
    .filter((source) => referencedIds.has(source.sourceId))
    .map((source) => source.path);
  const contents = new Map(await Promise.all(
    referencedPaths.map(async (path) => [path, await readRepositoryText(path)]),
  ));
  const [{ stdout: sourceCommit }, { stdout: status }] = await Promise.all([
    execFile('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }),
    execFile('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repositoryRoot }),
  ]);
  const packet = buildRuntimePacket(
    {
      manifest,
      registry,
      sourceCommit: sourceCommit.trim(),
      generatedAt: new Date().toISOString(),
      isWorktreeClean: status.trim().length === 0,
    },
    (path) => contents.get(path),
  );
  const verificationErrors = verifyRuntimePacket(
    packet,
    registry,
    { sourceCommit: sourceCommit.trim(), row: manifest.row },
    (path) => contents.get(path),
  );
  if (verificationErrors.length > 0) throw new Error(verificationErrors.join('\n'));
  const output = `${JSON.stringify(packet, null, 2)}\n`;
  if (options.outputPath) {
    await writeFile(resolve(repositoryRoot, options.outputPath), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
