import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffMarkdown, writeMarkdown } from '../../scripts/gen-docs/lib/markdown';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('markdown EOL comparison', () => {
  it('ignores LF versus CRLF while retaining content sensitivity', () => {
    const root = mkdtempSync(join(tmpdir(), 'conan-markdown-eol-'));
    roots.push(root);
    const path = join(root, 'generated.md');

    writeMarkdown(path, '# title\r\n\r\nbody\r\n');

    expect(diffMarkdown(path, '# title\n\nbody\n')).toEqual({
      path,
      changed: false,
      missing: false,
    });
    expect(diffMarkdown(path, '# title\n\nchanged\n').changed).toBe(true);
  });
});
