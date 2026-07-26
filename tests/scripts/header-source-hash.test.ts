import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeSourceHash } from '../../scripts/gen-docs/lib/header';

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'conan-header-hash-'));
  roots.push(root);
  mkdirSync(join(root, 'src', 'nested'), { recursive: true });
  writeFileSync(join(root, 'src', 'alpha.ts'), 'export const alpha = 1;\n');
  writeFileSync(join(root, 'src', 'nested', 'note.md'), '# note\n');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('computeSourceHash clone-root independence', () => {
  it('returns the same hash for identical relative trees under different roots', () => {
    const rootA = makeRoot();
    const rootB = makeRoot();

    expect(computeSourceHash([join(rootA, 'src')], rootA)).toBe(
      computeSourceHash([join(rootB, 'src')], rootB),
    );
    expect(computeSourceHash([join(rootA, 'src')], rootA)).toBe(
      computeSourceHash([join(rootA, 'src').replaceAll('\\', '/')], rootA),
    );
    expect(computeSourceHash([join(rootA, 'missing.ts')], rootA)).toBe(
      computeSourceHash([join(rootB, 'missing.ts')], rootB),
    );
  });

  it('remains sensitive to file contents and project-relative logical paths', () => {
    const root = makeRoot();
    const sourceDir = join(root, 'src');
    const baseline = computeSourceHash([sourceDir], root);

    writeFileSync(join(sourceDir, 'alpha.ts'), 'export const alpha = 2;\n');
    expect(computeSourceHash([sourceDir], root)).not.toBe(baseline);

    writeFileSync(join(sourceDir, 'alpha.ts'), 'export const alpha = 1;\n');
    renameSync(join(sourceDir, 'alpha.ts'), join(sourceDir, 'renamed.ts'));
    expect(computeSourceHash([sourceDir], root)).not.toBe(baseline);
  });

  it('treats LF and CRLF source checkouts as the same logical content', () => {
    const lfRoot = makeRoot();
    const crlfRoot = makeRoot();
    writeFileSync(
      join(crlfRoot, 'src', 'alpha.ts'),
      'export const alpha = 1;\r\n',
    );
    writeFileSync(join(crlfRoot, 'src', 'nested', 'note.md'), '# note\r\n');

    expect(computeSourceHash([join(lfRoot, 'src')], lfRoot)).toBe(
      computeSourceHash([join(crlfRoot, 'src')], crlfRoot),
    );
  });

  it('normalizes EOL for explicit text sources regardless of extension', () => {
    const lfRoot = makeRoot();
    const crlfRoot = makeRoot();
    writeFileSync(join(lfRoot, 'dictionary.json'), '{\n  "key": "value"\n}\n');
    writeFileSync(join(crlfRoot, 'dictionary.json'), '{\r\n  "key": "value"\r\n}\r\n');

    expect(computeSourceHash([join(lfRoot, 'dictionary.json')], lfRoot)).toBe(
      computeSourceHash([join(crlfRoot, 'dictionary.json')], crlfRoot),
    );
  });
});
