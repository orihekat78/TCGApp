import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { computeLogicalTextSourceHash, renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown, smartTruncate } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const DICTIONARY_PATH = resolve(HERE, 'structure-dictionary.json');
const GENERATOR_PATH = resolve(HERE, 'gen-structure.ts');
const DICTIONARY_REL_PATH = 'scripts/gen-docs/structure-dictionary.json';
const GENERATOR_REL_PATH = 'scripts/gen-docs/gen-structure.ts';
const STRUCTURE_INPUT_PATHS = [DICTIONARY_REL_PATH, GENERATOR_REL_PATH] as const;
const OUTPUT_PATH = resolve(PROJECT_ROOT, '.claude/auto/structure.md');

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

interface Dictionary {
  directories: Record<string, string>;
  files: Record<string, string>;
}

interface FsEntry {
  relPath: string;
  name: string;
  isDir: boolean;
  depth: number;
  children?: FsEntry[];
}

const EXCLUDE_DIRS = new Set<string>([
  'node_modules',
  'worktrees',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vite',
  '.vitest',
  '.tmp',
  '.vscode',
  '.idea',
  '.playwright-mcp',
  'test-results',
  'playwright-report',
  'blob-report',
  '.claudian',
  '.superpowers',
  'dist-meta', // meta-app build 出力 (gitignored) — local build 有無で structure.md が揺れるのを防ぐ
]);

const EXCLUDE_REL_PATHS = new Set<string>([
  '.obsidian/plugins',
  '.claude/settings.local.json',
  'playwright/.cache',
  '.serena/cache', // gitignored env 固有 LSP cache — CI (fresh checkout) との差分を防ぐため除外
  '.serena/project.local.yml', // env 固有 serena local 設定 (M3 2026-07-10)
  '.claude/scheduled_tasks.lock', // schedule plugin の runtime lock (M3 2026-07-10)
]);

const EXCLUDE_FILE_PATTERNS: RegExp[] = [
  /\.log$/,
  /\.mp4$/,
  /\.png$/,
  /\.DS_Store$/,
  /^\.env(\..+)?$/,
];

export function renderStructureRootSummary(projectRoot: string): string {
  void projectRoot;
  return '- **対象ルート**: `.`';
}

interface TreeNode {
  directories: Map<string, TreeNode>;
  files: Set<string>;
}

export interface GitIndexEntry {
  mode: string;
  blobId: string;
  stage: 0;
  path: string;
}

export interface GitIndexSnapshot {
  entries: GitIndexEntry[];
  contentByPath: ReadonlyMap<string, string>;
}

export type GitStageReader = (projectRoot: string) => string;
export type GitBlobBatchReader = (projectRoot: string, blobIds: readonly string[]) => Buffer;

export function compareOrdinal(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (left[i].codePointAt(0) ?? 0) - (right[i].codePointAt(0) ?? 0);
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

function shouldSkipDir(name: string, relPath: string): boolean {
  if (EXCLUDE_DIRS.has(name)) return true;
  if (EXCLUDE_REL_PATHS.has(relPath)) return true;
  return false;
}

function shouldSkipFile(name: string, relPath: string): boolean {
  if (EXCLUDE_REL_PATHS.has(relPath)) return true;
  return EXCLUDE_FILE_PATTERNS.some((re) => re.test(name));
}

function isExplicitlyExcluded(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.at(-1);
  if (fileName === undefined || shouldSkipFile(fileName, path)) return true;
  let relDir = '';
  for (const directory of parts.slice(0, -1)) {
    relDir = relDir ? `${relDir}/${directory}` : directory;
    if (shouldSkipDir(directory, relDir)) return true;
  }
  return false;
}

function readGitStageEntries(projectRoot: string): string {
  return execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

export function parseGitStageEntries(output: string): GitIndexEntry[] {
  const byPath = new Map<string, GitIndexEntry>();
  const unresolvedStagesByPath = new Map<string, Set<number>>();
  for (const record of output.split('\0')) {
    if (record.length === 0) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) throw new Error(`invalid git ls-files --stage record: ${record}`);
    const [mode, blobId, stageText, ...extra] = record.slice(0, tab).split(' ');
    if (
      !mode ||
      !/^[0-9a-f]+$/i.test(blobId) ||
      !/^[0-3]$/.test(stageText ?? '') ||
      extra.length > 0
    ) {
      throw new Error(`invalid git ls-files --stage header: ${record.slice(0, tab)}`);
    }
    const path = record.slice(tab + 1).replaceAll('\\', '/').replace(/^\.\/+/, '');
    if (path.length === 0) throw new Error('git index contains an empty path');
    if (stageText !== '0') {
      const stages = unresolvedStagesByPath.get(path) ?? new Set<number>();
      stages.add(Number(stageText));
      unresolvedStagesByPath.set(path, stages);
      continue;
    }
    byPath.set(path, { mode, blobId, stage: 0, path });
  }
  if (unresolvedStagesByPath.size > 0) {
    const details = [...unresolvedStagesByPath.entries()]
      .sort(([left], [right]) => compareOrdinal(left, right))
      .map(([path, stages]) => `${JSON.stringify(path)} stages ${[...stages].sort().join(',')}`)
      .join('; ');
    throw new Error(`Git index contains unresolved entries: ${details}`);
  }
  return [...byPath.values()].sort((a, b) => compareOrdinal(a.path, b.path));
}

function readGitBlobBatch(projectRoot: string, blobIds: readonly string[]): Buffer {
  if (blobIds.length === 0) return Buffer.alloc(0);
  return execFileSync('git', ['cat-file', '--batch'], {
    cwd: projectRoot,
    input: `${blobIds.join('\n')}\n`,
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function parseGitCatFileBatch(
  output: Buffer,
  expectedBlobIds: readonly string[],
): Map<string, string> {
  const contents = new Map<string, string>();
  let offset = 0;
  for (const expectedBlobId of expectedBlobIds) {
    const lineEnd = output.indexOf(0x0a, offset);
    if (lineEnd < 0) throw new Error(`git cat-file batch header missing: ${expectedBlobId}`);
    const header = output.subarray(offset, lineEnd).toString('utf8');
    const [blobId, type, sizeText, ...extra] = header.split(' ');
    const size = Number(sizeText);
    if (
      blobId !== expectedBlobId ||
      type !== 'blob' ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      extra.length > 0
    ) {
      throw new Error(`invalid git cat-file batch header: ${header}`);
    }
    const contentStart = lineEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      throw new Error(`truncated git cat-file batch content: ${expectedBlobId}`);
    }
    contents.set(blobId, output.subarray(contentStart, contentEnd).toString('utf8'));
    offset = contentEnd + 1;
  }
  if (offset !== output.length) throw new Error('unexpected trailing git cat-file batch output');
  return contents;
}

export function listGitCachedPaths(
  projectRoot: string,
  readStage: GitStageReader = readGitStageEntries,
): string[] {
  return parseGitStageEntries(readStage(projectRoot)).map((entry) => entry.path);
}

function needsIndexContent(path: string): boolean {
  return (
    path === DICTIONARY_REL_PATH ||
    path === GENERATOR_REL_PATH ||
    /\.(?:md|markdown|ts|tsx|js|jsx|mts|cts)$/i.test(path)
  );
}

export function readGitIndexSnapshot(
  projectRoot: string,
  readStage: GitStageReader = readGitStageEntries,
  readBlobs: GitBlobBatchReader = readGitBlobBatch,
): GitIndexSnapshot {
  const entries = parseGitStageEntries(readStage(projectRoot));
  const contentEntries = entries.filter(
    (entry) => !isExplicitlyExcluded(entry.path) && needsIndexContent(entry.path),
  );
  const blobIds = [...new Set(contentEntries.map((entry) => entry.blobId))].sort(compareOrdinal);
  const contentByBlob = parseGitCatFileBatch(readBlobs(projectRoot, blobIds), blobIds);
  const contentByPath = new Map<string, string>();
  for (const entry of contentEntries) {
    const content = contentByBlob.get(entry.blobId);
    if (content === undefined) throw new Error(`missing Git index blob: ${entry.path}`);
    contentByPath.set(entry.path, content);
  }
  return { entries, contentByPath };
}

function materializeTree(node: TreeNode, relDir: string, depth: number): FsEntry[] {
  const out: FsEntry[] = [];
  for (const name of [...node.directories.keys()].sort(compareOrdinal)) {
    const relPath = relDir ? `${relDir}/${name}` : name;
    const child = node.directories.get(name);
    if (child === undefined) continue;
    out.push({
      relPath,
      name,
      isDir: true,
      depth,
      children: materializeTree(child, relPath, depth + 1),
    });
  }
  for (const name of [...node.files].sort(compareOrdinal)) {
    out.push({
      relPath: relDir ? `${relDir}/${name}` : name,
      name,
      isDir: false,
      depth,
    });
  }
  return out;
}

export function buildEntriesFromCachedPaths(paths: readonly string[]): FsEntry[] {
  const root: TreeNode = { directories: new Map(), files: new Set() };
  for (const inputPath of paths) {
    const path = inputPath.replaceAll('\\', '/').replace(/^\.\/+/, '');
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0 || path.startsWith('/') || parts.includes('..')) continue;
    if (isExplicitlyExcluded(path)) continue;
    const fileName = parts.at(-1);
    if (fileName === undefined) continue;

    let node = root;
    let relDir = '';
    for (const directory of parts.slice(0, -1)) {
      relDir = relDir ? `${relDir}/${directory}` : directory;
      let child = node.directories.get(directory);
      if (child === undefined) {
        child = { directories: new Map(), files: new Set() };
        node.directories.set(directory, child);
      }
      node = child;
    }
    node.files.add(fileName);
  }
  return materializeTree(root, '', 0);
}

function parseDictionary(raw: string): Dictionary {
  const parsed = JSON.parse(raw) as Partial<Dictionary>;
  return {
    directories: parsed.directories ?? {},
    files: parsed.files ?? {},
  };
}

function extractMdHeading(content: string): string {
  const text = content.replace(/\r\n?/g, '\n');
  const match = text.match(/^\s*#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : '';
}

function extractTsDocComment(content: string): string {
  const text = content.replace(/\r\n?/g, '\n');
  const match = text.match(/^\s*\/\*\*\s*\n([\s\S]*?)\*\//);
  if (!match) {
    const line = text.match(/^\s*\/\/\s*(.+?)\s*$/m);
    return line ? line[1].trim() : '';
  }
  const body = match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'));
  return body[0] ?? '';
}

function describe(
  entry: FsEntry,
  dict: Dictionary,
  contentByPath: ReadonlyMap<string, string>,
): string {
  const dictMap = entry.isDir ? dict.directories : dict.files;
  const explicit = dictMap[entry.relPath];
  if (explicit) return explicit;
  if (entry.isDir) return '';
  const content = contentByPath.get(entry.relPath) ?? '';
  if (/\.(md|markdown)$/i.test(entry.name)) return extractMdHeading(content);
  if (/\.(ts|tsx|js|jsx|mts|cts)$/i.test(entry.name)) return extractTsDocComment(content);
  return '';
}

function renderEntries(
  entries: FsEntry[],
  dict: Dictionary,
  contentByPath: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    const indent = '  '.repeat(e.depth);
    const desc = describe(e, dict, contentByPath);
    const descSuffix = desc ? ` — ${smartTruncate(desc, 80)}` : '';
    if (e.isDir) {
      lines.push(`${indent}- **\`${e.name}/\`**${descSuffix}`);
      if (e.children && e.children.length > 0) {
        lines.push(...renderEntries(e.children, dict, contentByPath));
      }
    } else {
      lines.push(`${indent}- \`${e.name}\`${descSuffix}`);
    }
  }
  return lines;
}

function countEntries(entries: FsEntry[]): { dirs: number; files: number } {
  let dirs = 0;
  let files = 0;
  for (const e of entries) {
    if (e.isDir) {
      dirs += 1;
      if (e.children) {
        const sub = countEntries(e.children);
        dirs += sub.dirs;
        files += sub.files;
      }
    } else {
      files += 1;
    }
  }
  return { dirs, files };
}

function requireIndexContent(snapshot: GitIndexSnapshot, path: string): string {
  const content = snapshot.contentByPath.get(path);
  if (content === undefined) throw new Error(`required Git index content is missing: ${path}`);
  return content;
}

function normalizeTextEol(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

export function assertStructureInputContentsStaged(
  indexContents: ReadonlyMap<string, string>,
  worktreeContents: ReadonlyMap<string, string | undefined>,
): void {
  const mismatchedPaths = STRUCTURE_INPUT_PATHS.filter((path) => {
    const indexContent = indexContents.get(path);
    const worktreeContent = worktreeContents.get(path);
    return (
      indexContent === undefined ||
      worktreeContent === undefined ||
      normalizeTextEol(indexContent) !== normalizeTextEol(worktreeContent)
    );
  });
  if (mismatchedPaths.length > 0) {
    throw new Error(`stage inputs before docs: ${mismatchedPaths.join(', ')}`);
  }
}

function readStructureWorktreeInputs(projectRoot: string): Map<string, string | undefined> {
  return new Map(
    STRUCTURE_INPUT_PATHS.map((path) => {
      try {
        return [path, readFileSync(resolve(projectRoot, path), 'utf8')] as const;
      } catch {
        return [path, undefined] as const;
      }
    }),
  );
}

export function renderStructureFromSnapshot(snapshot: GitIndexSnapshot): string {
  const dictionaryContent = requireIndexContent(snapshot, DICTIONARY_REL_PATH);
  const generatorContent = requireIndexContent(snapshot, GENERATOR_REL_PATH);
  const dict = parseDictionary(dictionaryContent);
  const entries = buildEntriesFromCachedPaths(snapshot.entries.map((entry) => entry.path));
  const header = renderHeader({
    title: 'プロジェクト構造',
    generator: 'scripts/gen-docs/gen-structure.ts',
    regenerateCmd: 'npm run docs:structure',
    sourceFiles: [DICTIONARY_PATH, GENERATOR_PATH],
    sourceHash: computeLogicalTextSourceHash([
      { logicalPath: DICTIONARY_REL_PATH, content: dictionaryContent },
      { logicalPath: GENERATOR_REL_PATH, content: generatorContent },
    ]),
    description:
      'Git index上のtracked/staged path集合から明示除外を引いたフォルダ・ファイルを一覧する。説明もindex blobを正本とし、`structure-dictionary.json` の明示エントリ、Markdownの先頭heading、TypeScript等の先頭JSDoc/行コメントの順で解決する。新規ファイルを反映する場合は先にstageしてから生成する。Source hashはindex上の辞書+本ジェネレータが対象。',
  });
  const counts = countEntries(entries);
  const summary = [
    `## サマリ`,
    '',
    renderStructureRootSummary(PROJECT_ROOT),
    `- **ディレクトリ数**: ${counts.dirs}`,
    `- **ファイル数**: ${counts.files}`,
    `- **辞書エントリ**: dirs ${Object.keys(dict.directories).length} / files ${Object.keys(dict.files).length}`,
    '',
    '## ツリー',
    '',
  ];
  const tree = renderEntries(entries, dict, snapshot.contentByPath);
  const footer = [
    '',
    '---',
    '',
    '## 説明の出典',
    '',
    '1. `scripts/gen-docs/structure-dictionary.json` の明示エントリ',
    '2. (フォールバック) Markdown ファイル 1 行目の `# 見出し`',
    '3. (フォールバック) TypeScript ファイル先頭の JSDoc / 行コメント',
    '',
    '辞書に追加すべきフォルダ・主要ファイルを見つけたら `structure-dictionary.json` に追記してから `npm run docs:structure` を実行する。',
    '',
  ];
  return header + summary.join('\n') + tree.join('\n') + '\n' + footer.join('\n');
}

export function runGenStructure(opts: RunOptions): RunResult {
  const snapshot = readGitIndexSnapshot(PROJECT_ROOT);
  assertStructureInputContentsStaged(
    snapshot.contentByPath,
    readStructureWorktreeInputs(PROJECT_ROOT),
  );
  const expected = renderStructureFromSnapshot(snapshot);
  if (opts.checkOnly) {
    const diff = diffMarkdown(OUTPUT_PATH, expected);
    return {
      changedFiles: diff.changed ? [OUTPUT_PATH] : [],
      totalFiles: 1,
    };
  }
  const diff = diffMarkdown(OUTPUT_PATH, expected);
  if (diff.changed) {
    writeMarkdown(OUTPUT_PATH, expected);
    return { changedFiles: [OUTPUT_PATH], totalFiles: 1 };
  }
  return { changedFiles: [], totalFiles: 1 };
}
