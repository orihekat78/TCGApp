import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertStructureInputContentsStaged,
  buildEntriesFromCachedPaths,
  compareOrdinal,
  listGitCachedPaths,
  parseGitCatFileBatch,
  parseGitStageEntries,
  readGitIndexSnapshot,
  renderStructureFromSnapshot,
} from '../../scripts/gen-docs/gen-structure';

const roots: string[] = [];

function makeIndexedTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'conan-structure-index-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'scripts', 'gen-docs'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), 'ignored/\n*.tsv\n');
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  writeFileSync(join(root, 'src', 'index.ts'), '/**\n * original docs\n */\nexport {};\n');
  writeFileSync(
    join(root, 'scripts', 'gen-docs', 'structure-dictionary.json'),
    '{"directories":{},"files":{}}\n',
  );
  writeFileSync(join(root, 'scripts', 'gen-docs', 'gen-structure.ts'), 'export {};\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('tracked structure input', () => {
  it('is identical across roots despite ignored and untracked artifacts', () => {
    const cleanRoot = makeIndexedTree();
    const dirtyRoot = makeIndexedTree();
    mkdirSync(join(dirtyRoot, 'ignored', 'reports'), { recursive: true });
    writeFileSync(join(dirtyRoot, 'ignored', 'reports', 'smoke.json'), '{}\n');
    writeFileSync(join(dirtyRoot, 'cards-data.tsv'), 'id\tname\n');
    writeFileSync(join(dirtyRoot, 'untracked.txt'), 'local only\n');

    const cleanPaths = listGitCachedPaths(cleanRoot);
    const dirtyPaths = listGitCachedPaths(dirtyRoot);

    expect(dirtyPaths).toEqual(cleanPaths);
    expect(buildEntriesFromCachedPaths(dirtyPaths)).toEqual(
      buildEntriesFromCachedPaths(cleanPaths),
    );
    expect(dirtyPaths).not.toContain('ignored/reports/smoke.json');
    expect(dirtyPaths).not.toContain('cards-data.tsv');
    expect(dirtyPaths).not.toContain('untracked.txt');
  });

  it('renders descriptions from index blobs until changed content is staged', () => {
    const root = makeIndexedTree();
    const before = renderStructureFromSnapshot(readGitIndexSnapshot(root));

    writeFileSync(join(root, 'README.md'), '# unstaged heading\n');
    writeFileSync(join(root, 'src', 'index.ts'), '/**\n * unstaged docs\n */\nexport {};\n');
    expect(renderStructureFromSnapshot(readGitIndexSnapshot(root))).toBe(before);

    unlinkSync(join(root, 'README.md'));
    expect(renderStructureFromSnapshot(readGitIndexSnapshot(root))).toBe(before);

    writeFileSync(join(root, 'README.md'), '# staged heading\n');
    writeFileSync(join(root, 'src', 'index.ts'), '/**\n * staged docs\n */\nexport {};\n');
    execFileSync('git', ['add', 'README.md', 'src/index.ts'], { cwd: root });
    const after = renderStructureFromSnapshot(readGitIndexSnapshot(root));

    expect(after).not.toBe(before);
    expect(after).toContain('staged heading');
    expect(after).toContain('staged docs');
    expect(after).not.toContain('unstaged heading');
    expect(after).not.toContain('unstaged docs');
  });

  it('rejects any non-stage-0 NUL record with its path and stages', () => {
    const blobA = 'a'.repeat(40);
    const blobB = 'b'.repeat(40);
    const blobC = 'c'.repeat(40);
    const output = [
      `100644 ${blobA} 0\tspace name.md`,
      `100644 ${blobB} 0\t日本語.md`,
      `100644 ${blobC} 0\tline\nbreak.md`,
      `100644 ${'d'.repeat(40)} 2\tconflict.md`,
      '',
    ].join('\0');

    expect(() => parseGitStageEntries(output)).toThrow(/conflict\.md.*stage.*2/i);
  });

  it('preserves spaces, Unicode, and newlines in stage-0 NUL paths', () => {
    const output = [
      `100644 ${'a'.repeat(40)} 0\tspace name.md`,
      `100644 ${'b'.repeat(40)} 0\t日本語.md`,
      `100644 ${'c'.repeat(40)} 0\tline\nbreak.md`,
      '',
    ].join('\0');

    expect(parseGitStageEntries(output).map((entry) => entry.path)).toEqual([
      'line\nbreak.md',
      'space name.md',
      '日本語.md',
    ]);
  });

  it('rejects a real Git index conflict instead of rendering a partial tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'conan-structure-conflict-'));
    roots.push(root);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Structure Test'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'structure@example.invalid'], { cwd: root });
    writeFileSync(join(root, 'conflict.md'), '# base\n');
    execFileSync('git', ['add', 'conflict.md'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: root });
    execFileSync('git', ['checkout', '-q', '-b', 'side'], { cwd: root });
    writeFileSync(join(root, 'conflict.md'), '# side\n');
    execFileSync('git', ['commit', '-q', '-am', 'side'], { cwd: root });
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
    writeFileSync(join(root, 'conflict.md'), '# main\n');
    execFileSync('git', ['commit', '-q', '-am', 'main'], { cwd: root });
    expect(() => execFileSync('git', ['merge', '--no-edit', 'side'], { cwd: root })).toThrow();

    expect(() => listGitCachedPaths(root)).toThrow(/conflict\.md.*stage.*1.*2.*3/i);
  });

  it('rejects an unstaged generator change before docs rendering', () => {
    const indexContents = new Map([
      ['scripts/gen-docs/gen-structure.ts', 'export const version = 1;\n'],
      ['scripts/gen-docs/structure-dictionary.json', '{}\n'],
    ]);
    const worktreeContents = new Map(indexContents);
    worktreeContents.set('scripts/gen-docs/gen-structure.ts', 'export const version = 2;\n');

    expect(() => assertStructureInputContentsStaged(indexContents, worktreeContents)).toThrow(
      /stage inputs before docs.*gen-structure\.ts/i,
    );
  });

  it('rejects an unstaged structure dictionary change before docs rendering', () => {
    const indexContents = new Map([
      ['scripts/gen-docs/gen-structure.ts', 'export {};\n'],
      ['scripts/gen-docs/structure-dictionary.json', '{}\n'],
    ]);
    const worktreeContents = new Map(indexContents);
    worktreeContents.set('scripts/gen-docs/structure-dictionary.json', '{"files":{}}\n');

    expect(() => assertStructureInputContentsStaged(indexContents, worktreeContents)).toThrow(
      /stage inputs before docs.*structure-dictionary\.json/i,
    );
  });

  it('accepts worktree generator inputs that differ from the index only by EOL', () => {
    const indexContents = new Map([
      ['scripts/gen-docs/gen-structure.ts', 'line 1\nline 2\n'],
      ['scripts/gen-docs/structure-dictionary.json', '{}\n'],
    ]);
    const worktreeContents = new Map([
      ['scripts/gen-docs/gen-structure.ts', 'line 1\r\nline 2\r'],
      ['scripts/gen-docs/structure-dictionary.json', '{}\r\n'],
    ]);

    expect(() =>
      assertStructureInputContentsStaged(indexContents, worktreeContents),
    ).not.toThrow();
  });

  it('parses batched blob content containing newlines', () => {
    const blobId = 'e'.repeat(40);
    const content = '# heading\nbody\n';
    const output = Buffer.concat([
      Buffer.from(`${blobId} blob ${Buffer.byteLength(content)}\n`),
      Buffer.from(content),
      Buffer.from('\n'),
    ]);

    expect(parseGitCatFileBatch(output, [blobId]).get(blobId)).toBe(content);
  });

  it('fails fast when Git index reading fails', () => {
    expect(() =>
      readGitIndexSnapshot(
        'unused',
        () => {
          throw new Error('git ls-files failed');
        },
        () => Buffer.alloc(0),
      ),
    ).toThrow('git ls-files failed');
  });

  it('applies explicit excludes and locale-independent codepoint ordering', () => {
    const entries = buildEntriesFromCachedPaths([
      'z.md',
      'ä.md',
      'a.md',
      'Z.md',
      '😀.md',
      'node_modules/pkg/index.ts',
      '.obsidian/plugins/local/main.ts',
      'assets/card.png',
    ]);

    expect(entries.map((entry) => entry.relPath)).toEqual([
      'Z.md',
      'a.md',
      'z.md',
      'ä.md',
      '😀.md',
    ]);
    expect(['z', 'ä', 'a', 'Z', '😀'].sort(compareOrdinal)).toEqual([
      'Z',
      'a',
      'z',
      'ä',
      '😀',
    ]);
  });
});
