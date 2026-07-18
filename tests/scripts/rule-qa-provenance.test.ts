import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, '.claude/rules/qa-sources.json');
const sourceId = 'official-community-qa';
const deferId = 'DEFER-QA-POST-ID';
const ruleFiles = [22, 23, 24, 25, 26].map((number) =>
  resolve(root, `.claude/rules/${number}-qa-${({
    22: 'action-contact',
    23: 'disguise-cutin',
    24: 'naming-stun',
    25: 'effects-resolution',
    26: 'deck-refresh',
  } as Record<number, string>)[number]}.md`),
);

type QaSource = {
  id: string;
  sourceId: string;
  status: 'verified' | 'unverified';
  url: string;
  postId?: string;
  deferId?: string;
  summaryHash: string;
};

type Manifest = {
  sourceMetadata: Array<{ id: string; exhaustive: boolean }>;
  deferrals: Record<string, { status: 'open'; reason: string }>;
  refs: QaSource[];
};

function assertionBullets(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    // Top-level prose bullets are rulings. Nested examples and related-rule links are not.
    .filter((line) => /^- (?!\[)/.test(line));
}

function refIds(bullet: string): string[] {
  return [...bullet.matchAll(/<!-- qa-ref: ([a-z0-9-]+) -->/g)].map((match) => match[1]);
}

function summaryHash(bullets: string[]): string {
  const summary = bullets
    .map((bullet) => bullet.replace(/\s*<!-- qa-ref: [a-z0-9-]+ -->/g, '').trim())
    .join('\n');
  return createHash('sha256').update(summary, 'utf8').digest('hex');
}

function validate(manifest: Manifest): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(manifest.sourceMetadata.map((source) => source.id));
  const refIdsSeen = new Set<string>();

  for (const ref of manifest.refs) {
    if (refIdsSeen.has(ref.id)) errors.push(`duplicate ref: ${ref.id}`);
    refIdsSeen.add(ref.id);
    if (!sourceIds.has(ref.sourceId)) errors.push(`missing source: ${ref.id}`);
    if (!ref.url.startsWith('https://')) errors.push(`missing url: ${ref.id}`);
    if (!/^[a-f0-9]{64}$/.test(ref.summaryHash)) errors.push(`invalid summary hash: ${ref.id}`);
    if (ref.status === 'verified' && !ref.postId) errors.push(`verified ref lacks postId: ${ref.id}`);
    if (ref.status === 'unverified' && (!ref.deferId || !manifest.deferrals[ref.deferId])) {
      errors.push(`unverified ref lacks BUG/DEFER: ${ref.id}`);
    }
  }

  const community = manifest.sourceMetadata.find((source) => source.id === sourceId);
  if (!community || community.exhaustive !== false) errors.push('community source must be exhaustive:false');

  for (const path of ruleFiles) {
    const bullets = assertionBullets(path);
    const ids = bullets.flatMap(refIds);
    const expectedId = `qa-${path.match(/\\(\d{2})-/)?.[1]}-community-index`;
    for (const bullet of bullets) {
      if (refIds(bullet).length !== 1) errors.push(`exactly one qa-ref required: ${bullet}`);
    }
    if (new Set(ids).size !== 1 || ids[0] !== expectedId) errors.push(`unexpected refs in ${path}`);
    const ref = manifest.refs.find((entry) => entry.id === expectedId);
    if (!ref) errors.push(`dangling qa-ref: ${expectedId}`);
    else if (ref.summaryHash !== summaryHash(bullets)) errors.push(`summary hash drift: ${expectedId}`);
  }

  return errors;
}

describe('Q&A rules provenance', () => {
  it('tracks every ruling bullet with one source-backed qa-ref', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    expect(validate(manifest)).toEqual([]);
  });

  it('rejects duplicate, dangling, verified-without-postId, unverified-without-DEFER, and hash drift', () => {
    if (!existsSync(manifestPath)) {
      expect(existsSync(manifestPath)).toBe(true);
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    const invalid: Manifest = structuredClone(manifest);
    invalid.refs.push({ ...invalid.refs[0] });
    invalid.refs[1] = { ...invalid.refs[1], sourceId: 'missing-source', status: 'verified', postId: undefined };
    invalid.refs[2] = { ...invalid.refs[2], deferId: undefined };
    invalid.refs[3] = { ...invalid.refs[3], summaryHash: '0'.repeat(64) };

    expect(validate(invalid).join('\n')).toMatch(/duplicate ref/);
    expect(validate(invalid).join('\n')).toMatch(/missing source/);
    expect(validate(invalid).join('\n')).toMatch(/verified ref lacks postId/);
    expect(validate(invalid).join('\n')).toMatch(/unverified ref lacks BUG\/DEFER/);
    expect(validate(invalid).join('\n')).toMatch(/summary hash drift/);
  });
});
