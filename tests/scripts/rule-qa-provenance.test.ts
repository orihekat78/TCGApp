import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, '.claude/rules/qa-sources.json');
const sourceId = 'official-community-qa';
const deferId = 'DEFER-QA-POST-ID';
const sourceUrl = 'https://conan-tcg.commmune.com/view/box?boxId=talk002';

type RuleFile = { number: number; path: string; content: string };
type JsonRecord = Record<string, unknown>;

const ruleFiles: RuleFile[] = [
  [22, 'action-contact'],
  [23, 'disguise-cutin'],
  [24, 'naming-stun'],
  [25, 'effects-resolution'],
  [26, 'deck-refresh'],
].map(([number, name]) => {
  const path = resolve(root, `.claude/rules/${number}-qa-${name}.md`);
  return { number, path, content: readFileSync(path, 'utf8') };
});

const expectedCounts = new Map([[22, 15], [23, 11], [24, 12], [25, 21], [26, 29]]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, expected: string[]): boolean {
  return Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function adjudicationBlocks(content: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] | undefined;
  for (const line of content.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      if (current) blocks.push(current);
      current = undefined;
    } else if (/^- (?!\[)/.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function qaRefIds(block: string[]): string[] {
  return [...block.join('\n').matchAll(/<!-- qa-ref: ([a-z0-9-]+) -->/g)].map((match) => match[1]);
}

function canonicalBlock(block: string[]): string {
  return block
    .map((line) => line
      .replace(/[ \t]*<!-- qa-ref: [a-z0-9-]+ -->/g, '')
      .replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

function summaryHash(blocks: string[][]): string {
  return createHash('sha256')
    .update(blocks.map(canonicalBlock).join('\n'), 'utf8')
    .digest('hex');
}

function validate(manifest: unknown, files = ruleFiles): string[] {
  const errors: string[] = [];
  if (!isRecord(manifest)) return ['manifest must be an object'];
  if (!hasExactKeys(manifest, ['schemaVersion', 'sourceMetadata', 'deferrals', 'refs'])) {
    errors.push('manifest has unknown or missing fields');
  }
  if (manifest.schemaVersion !== 1) errors.push('invalid schema version');
  const metadataValid = Array.isArray(manifest.sourceMetadata) && manifest.sourceMetadata.length === 1;
  const deferralsValid = isRecord(manifest.deferrals);
  const refsValid = Array.isArray(manifest.refs);
  if (!metadataValid) {
    errors.push('sourceMetadata must contain exactly one source');
  }
  if (!deferralsValid) errors.push('deferrals must be an object');
  if (!refsValid) errors.push('refs must be an array');
  if (!metadataValid || !deferralsValid || !refsValid) return errors;

  const metadata = manifest.sourceMetadata[0];
  if (!isRecord(metadata)) {
    errors.push('source metadata must be an object');
  } else {
    if (!hasExactKeys(metadata, ['id', 'kind', 'url', 'fetchedAt', 'exhaustive', 'note'])) {
      errors.push('source metadata has unknown or missing fields');
    }
    if (metadata.id !== sourceId || metadata.kind !== 'official-community') errors.push('invalid source metadata kind');
    if (metadata.url !== sourceUrl || !String(metadata.url).startsWith('https://')) errors.push('invalid source metadata url');
    if (metadata.fetchedAt !== '2026-07-18') errors.push('invalid source metadata fetchedAt');
    if (metadata.exhaustive !== false) errors.push('community source must be exhaustive:false');
    if (typeof metadata.note !== 'string' || metadata.note.trim() === '') errors.push('invalid source metadata note');
  }

  const deferrals = manifest.deferrals;
  if (!hasExactKeys(deferrals, [deferId])) errors.push('unknown or missing deferral');
  const defer = deferrals[deferId];
  if (!isRecord(defer)) {
    errors.push('deferral must be an object');
  } else {
    if (!hasExactKeys(defer, ['status', 'reason'])) errors.push('deferral has unknown or missing fields');
    if (defer.status !== 'open' || typeof defer.reason !== 'string' || defer.reason.trim() === '') {
      errors.push('invalid deferral status or reason');
    }
  }

  const refs = manifest.refs;
  const refIds = new Set<string>();
  for (const ref of refs) {
    if (!isRecord(ref)) {
      errors.push('ref must be an object');
      continue;
    }
    const id = ref.id;
    if (typeof id !== 'string') {
      errors.push('ref lacks id');
      continue;
    }
    if (refIds.has(id)) errors.push(`duplicate ref: ${id}`);
    refIds.add(id);
    if (ref.sourceId !== sourceId) errors.push(`missing source: ${id}`);
    if (typeof ref.url !== 'string' || ref.url !== sourceUrl) errors.push(`invalid url: ${id}`);
    if (typeof ref.summaryHash !== 'string' || !/^[a-f0-9]{64}$/.test(ref.summaryHash)) {
      errors.push(`invalid summary hash: ${id}`);
    }
    if (ref.status === 'verified') {
      if (!hasExactKeys(ref, ['id', 'sourceId', 'status', 'url', 'postId', 'summaryHash'])) {
        errors.push(`verified ref has unknown or missing fields: ${id}`);
      }
      if (typeof ref.postId !== 'string' || ref.postId.trim() === '') errors.push(`verified ref lacks postId: ${id}`);
    } else if (ref.status === 'unverified') {
      if (!hasExactKeys(ref, ['id', 'sourceId', 'status', 'url', 'deferId', 'summaryHash'])) {
        errors.push(`unverified ref has unknown or missing fields: ${id}`);
      }
      if (ref.deferId !== deferId || !isRecord(deferrals[deferId])) {
        errors.push(`unverified ref lacks BUG/DEFER: ${id}`);
      }
    } else {
      errors.push(`invalid ref status: ${id}`);
    }
  }

  let total = 0;
  for (const file of files) {
    const blocks = adjudicationBlocks(file.content);
    const expectedCount = expectedCounts.get(file.number);
    if (blocks.length !== expectedCount) errors.push(`unexpected ruling count: ${file.number}`);
    total += blocks.length;
    const expectedId = `qa-${file.number}-community-index`;
    const ids = blocks.flatMap(qaRefIds);
    for (const block of blocks) {
      if (qaRefIds(block).length !== 1) errors.push(`exactly one qa-ref required: ${block[0]}`);
    }
    if (new Set(ids).size !== 1 || ids[0] !== expectedId) errors.push(`dangling or unexpected refs: ${file.path}`);
    const ref = refs.find((entry) => isRecord(entry) && entry.id === expectedId);
    if (!ref) errors.push(`dangling qa-ref: ${expectedId}`);
    else if (ref.summaryHash !== summaryHash(blocks)) errors.push(`summary hash drift: ${expectedId}`);
  }
  if (total !== 88) errors.push(`unexpected total ruling count: ${total}`);

  return errors;
}

function loadManifest(): unknown {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
}

function withContent(fileNumber: number, replace: (content: string) => string): RuleFile[] {
  return ruleFiles.map((file) => file.number === fileNumber ? { ...file, content: replace(file.content) } : file);
}

describe('Q&A rules provenance', () => {
  it('tracks every full ruling block with one source-backed qa-ref', () => {
    expect(existsSync(manifestPath)).toBe(true);
    expect(validate(loadManifest())).toEqual([]);
  });

  it('derives rule identity from explicit metadata on POSIX paths', () => {
    const posixFiles = ruleFiles.map((file) => ({
      ...file,
      path: `/repo/.claude/rules/${file.number}.md`,
    }));
    expect(validate(loadManifest(), posixFiles)).toEqual([]);
  });

  it('rejects drift in continuation, nested example, and table/body content', () => {
    const continuation = validate(loadManifest(), withContent(22, (content) => content.replace('発動し、**その場で解決される**。', '発動し、**後で解決される**。'))).join('\n');
    const nested = validate(loadManifest(), withContent(22, (content) => content.replace('途中で突撃を失っても完了する', '途中で突撃を失うと中断する'))).join('\n');
    const table = validate(loadManifest(), withContent(22, (content) => content.replace('発動し、**その場で解決される**。', '発動し、**その場で解決される**。\n|確認|値|\n|---|---|\n|順序|宣言時|'))).join('\n');

    expect(continuation).toMatch(/summary hash drift: qa-22-community-index/);
    expect(nested).toMatch(/summary hash drift: qa-22-community-index/);
    expect(table).toMatch(/summary hash drift: qa-22-community-index/);
  });

  it('rejects duplicate, dangling, invalid schema, and invalid source states', () => {
    const invalid = structuredClone(loadManifest()) as JsonRecord;
    const refs = invalid.refs as JsonRecord[];
    refs.push({ ...refs[0] });
    refs[1] = { ...refs[1], sourceId: 'missing-source', status: 'verified', postId: undefined };
    refs[2] = { ...refs[2], deferId: undefined, extra: true };
    refs[3] = { ...refs[3], summaryHash: '0'.repeat(64), status: 'unknown', extra: true };
    (invalid.sourceMetadata as JsonRecord[])[0] = { ...(invalid.sourceMetadata as JsonRecord[])[0], exhaustive: true, extra: true };
    (invalid.deferrals as JsonRecord)[deferId] = { status: 'closed', reason: '' };
    invalid.extra = true;
    const danglingFiles = withContent(22, (content) => content.replace('qa-22-community-index', 'qa-22-missing'));
    const errors = `${validate(invalid).join('\n')}\n${validate(loadManifest(), danglingFiles).join('\n')}`;

    expect(errors).toMatch(/duplicate ref/);
    expect(errors).toMatch(/missing source/);
    expect(errors).toMatch(/verified ref lacks postId/);
    expect(errors).toMatch(/unverified ref has unknown or missing fields/);
    expect(errors).toMatch(/invalid ref status/);
    expect(errors).toMatch(/invalid deferral status or reason/);
    expect(errors).toMatch(/community source must be exhaustive:false/);
    expect(errors).toMatch(/manifest has unknown or missing fields/);
    expect(errors).toMatch(/dangling or unexpected refs/);
  });
});
