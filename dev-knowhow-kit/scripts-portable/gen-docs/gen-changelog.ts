import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const ENTRIES_DIR = resolve(PROJECT_ROOT, '.claude/changelog-entries');
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'CHANGELOG.md');

const UNRELEASED_FILE = '_unreleased.md';
const FOOTER_FILE = '_footer.md';
const ENTRY_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{2}-.+\.md$/;

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

function readEntry(name: string): string {
  return readFileSync(resolve(ENTRIES_DIR, name), 'utf-8').replace(/\s+$/, '');
}

function listEntryFiles(): string[] {
  return readdirSync(ENTRIES_DIR)
    .filter((n) => ENTRY_PATTERN.test(n))
    .sort()
    .reverse();
}

function renderChangelogMd(): string {
  const header = renderHeader({
    title: 'Changelog',
    generator: 'scripts/gen-docs/gen-changelog.ts',
    regenerateCmd: 'npm run docs:changelog',
    sourceFiles: [ENTRIES_DIR, resolve(HERE, 'gen-changelog.ts')],
    description:
      '「何ができたか」を時系列で記録する。個別エントリのソースは [`.claude/changelog-entries/`](.claude/changelog-entries/) にあり、Phase / Round 完了時にそこへファイルを追加する。日次の詳細ログは [`.claude/sessions/`](.claude/sessions/) に、現セッション scratchpad は [`.claude/memory.md`](.claude/memory.md) にある。形式は [Keep a Changelog](https://keepachangelog.com/) に準拠 (セマンティックバージョン番号は採用せず Phase/Round 名で区切る)。日付は Asia/Tokyo (YYYY-MM-DD)。',
  });

  const unreleasedBody = readEntry(UNRELEASED_FILE);
  const footerBody = readEntry(FOOTER_FILE);
  const entryFiles = listEntryFiles();
  const entryBodies = entryFiles.map(readEntry);

  const sections: string[] = [];
  sections.push('## [Unreleased]');
  sections.push(unreleasedBody);
  for (const body of entryBodies) {
    sections.push(body);
  }
  sections.push(footerBody);

  return header + sections.join('\n\n') + '\n';
}

export function runGenChangelog(opts: RunOptions): RunResult {
  const expected = renderChangelogMd();
  const diff = diffMarkdown(OUTPUT_PATH, expected);
  if (opts.checkOnly) {
    return {
      changedFiles: diff.changed ? [OUTPUT_PATH] : [],
      totalFiles: 1,
    };
  }
  if (diff.changed) {
    writeMarkdown(OUTPUT_PATH, expected);
    return { changedFiles: [OUTPUT_PATH], totalFiles: 1 };
  }
  return { changedFiles: [], totalFiles: 1 };
}
