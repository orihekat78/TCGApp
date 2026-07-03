import { dirname, resolve, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown, smartTruncate } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const DICTIONARY_PATH = resolve(HERE, 'structure-dictionary.json');
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
]);

const EXCLUDE_REL_PATHS = new Set<string>([
  '.obsidian/plugins',
  '.claude/settings.local.json',
  'playwright/.cache',
  '.serena/cache', // gitignored env 固有 LSP cache — CI (fresh checkout) との差分を防ぐため除外
]);

const EXCLUDE_FILE_PATTERNS: RegExp[] = [
  /\.log$/,
  /\.mp4$/,
  /\.png$/,
  /\.DS_Store$/,
  /^\.env(\..+)?$/,
];

function toPosix(p: string): string {
  return p.split(sep).join(posix.sep);
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

function walk(absDir: string, relDir: string, depth: number): FsEntry[] {
  const out: FsEntry[] = [];
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const ent of entries) {
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name, rel)) continue;
      const children = walk(resolve(absDir, ent.name), rel, depth + 1);
      out.push({ relPath: rel, name: ent.name, isDir: true, depth, children });
    } else if (ent.isFile()) {
      if (shouldSkipFile(ent.name, rel)) continue;
      out.push({ relPath: rel, name: ent.name, isDir: false, depth });
    }
  }
  return out;
}

function loadDictionary(): Dictionary {
  const raw = readFileSync(DICTIONARY_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<Dictionary>;
  return {
    directories: parsed.directories ?? {},
    files: parsed.files ?? {},
  };
}

function extractMdHeading(absPath: string): string {
  try {
    const text = readFileSync(absPath, 'utf-8');
    const m = text.match(/^\s*#\s+(.+?)\s*$/m);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

function extractTsDocComment(absPath: string): string {
  try {
    const text = readFileSync(absPath, 'utf-8');
    const m = text.match(/^\s*\/\*\*\s*\n([\s\S]*?)\*\//);
    if (!m) {
      const line = text.match(/^\s*\/\/\s*(.+?)\s*$/m);
      return line ? line[1].trim() : '';
    }
    const body = m[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('@'));
    return body[0] ?? '';
  } catch {
    return '';
  }
}

function describe(entry: FsEntry, dict: Dictionary, absPath: string): string {
  const dictMap = entry.isDir ? dict.directories : dict.files;
  const explicit = dictMap[entry.relPath];
  if (explicit) return explicit;
  if (entry.isDir) return '';
  if (/\.(md|markdown)$/i.test(entry.name)) return extractMdHeading(absPath);
  if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) return extractTsDocComment(absPath);
  return '';
}

function renderEntries(entries: FsEntry[], dict: Dictionary, baseAbsDir: string): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    const indent = '  '.repeat(e.depth);
    const absPath = resolve(baseAbsDir, e.relPath);
    const desc = describe(e, dict, absPath);
    const descSuffix = desc ? ` — ${smartTruncate(desc, 80)}` : '';
    if (e.isDir) {
      lines.push(`${indent}- **\`${e.name}/\`**${descSuffix}`);
      if (e.children && e.children.length > 0) {
        lines.push(...renderEntries(e.children, dict, baseAbsDir));
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

function renderStructureMd(entries: FsEntry[], dict: Dictionary): string {
  const header = renderHeader({
    title: 'プロジェクト構造',
    generator: 'scripts/gen-docs/gen-structure.ts',
    regenerateCmd: 'npm run docs:structure',
    sourceFiles: [DICTIONARY_PATH, resolve(HERE, 'gen-structure.ts')],
    description:
      'ワーキングディレクトリの全フォルダ・ファイルを一覧する。説明は `structure-dictionary.json` の明示エントリを優先し、未定義の Markdown は先頭 `# heading` を、TypeScript は先頭 JSDoc / 行コメントを自動抽出する。`.gitignore` 相当のパターン (`node_modules` / `.git` / 各種 build 出力 / `*.png` 等) は除外。Source hash は辞書 + 本ジェネレータのみが対象 (出力ファイル自身を含めると無限再生成サイクルになるため)。ファイルツリーの変化は `npm run docs:check` の差分比較が検出する。',
  });
  const counts = countEntries(entries);
  const summary = [
    `## サマリ`,
    '',
    `- **対象ルート**: \`${toPosix(relative(PROJECT_ROOT, PROJECT_ROOT)) || '.'}\` (\`${toPosix(PROJECT_ROOT)}\`)`,
    `- **ディレクトリ数**: ${counts.dirs}`,
    `- **ファイル数**: ${counts.files}`,
    `- **辞書エントリ**: dirs ${Object.keys(dict.directories).length} / files ${Object.keys(dict.files).length}`,
    '',
    '## ツリー',
    '',
  ];
  const tree = renderEntries(entries, dict, PROJECT_ROOT);
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
  const dict = loadDictionary();
  const entries = walk(PROJECT_ROOT, '', 0);
  const expected = renderStructureMd(entries, dict);
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
