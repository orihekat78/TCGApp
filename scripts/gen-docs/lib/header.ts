import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export interface HeaderOptions {
  generator: string;
  regenerateCmd: string;
  sourceFiles: string[];
  title: string;
  description?: string;
  /** Logical path base for clone-independent source hashes. Defaults to cwd. */
  sourceRoot?: string;
  /** Optional precomputed hash for generators whose source of truth is not the worktree. */
  sourceHash?: string;
}

export interface LogicalTextSource {
  logicalPath: string;
  content: string;
}

type ExpandedSource = {
  kind: 'file' | 'missing' | 'unknown';
  logicalPath: string;
  physicalPath?: string;
};

function logicalPath(rootDir: string, physicalPath: string): string {
  const fromRoot = relative(rootDir, physicalPath) || '.';
  return fromRoot.replaceAll('\\', '/');
}

function normalizeTextEol(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function compareOrdinal(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (left[i].codePointAt(0) ?? 0) - (right[i].codePointAt(0) ?? 0);
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

function expandPath(p: string, rootDir: string): ExpandedSource[] {
  const physicalPath = resolve(rootDir, p);
  const logical = logicalPath(rootDir, physicalPath);
  if (!existsSync(physicalPath)) return [{ kind: 'missing', logicalPath: logical }];
  const st = statSync(physicalPath);
  if (st.isFile()) return [{ kind: 'file', logicalPath: logical, physicalPath }];
  if (st.isDirectory()) {
    const collected: ExpandedSource[] = [];
    for (const entry of readdirSync(physicalPath, { withFileTypes: true })) {
      const child = resolve(physicalPath, entry.name);
      if (entry.isDirectory()) {
        collected.push(...expandPath(child, rootDir));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.md'))) {
        collected.push({
          kind: 'file',
          logicalPath: logicalPath(rootDir, child),
          physicalPath: child,
        });
      }
    }
    return collected.sort((a, b) => compareOrdinal(a.logicalPath, b.logicalPath));
  }
  return [{ kind: 'unknown', logicalPath: logical }];
}

export function computeSourceHash(paths: string[], sourceRoot = process.cwd()): string {
  const hash = createHash('sha256');
  const rootDir = resolve(sourceRoot);
  const allFiles: ExpandedSource[] = [];
  for (const p of paths) {
    allFiles.push(...expandPath(p, rootDir));
  }
  allFiles.sort((a, b) =>
    compareOrdinal(a.logicalPath, b.logicalPath) || compareOrdinal(a.kind, b.kind),
  );
  for (const file of allFiles) {
    hash.update(`${file.kind.toUpperCase()}\0${file.logicalPath}\0`);
    if (file.kind !== 'file' || file.physicalPath === undefined) continue;
    try {
      const content = readFileSync(file.physicalPath, 'utf-8');
      hash.update(normalizeTextEol(content));
      hash.update('\0');
    } catch {
      hash.update(`READ_FAIL\0${file.logicalPath}\0`);
    }
  }
  return hash.digest('hex').slice(0, 12);
}

export function computeLogicalTextSourceHash(sources: readonly LogicalTextSource[]): string {
  const hash = createHash('sha256');
  const ordered = [...sources].sort((a, b) => compareOrdinal(a.logicalPath, b.logicalPath));
  for (const source of ordered) {
    const logicalPath = source.logicalPath.replaceAll('\\', '/');
    hash.update(`FILE\0${logicalPath}\0`);
    hash.update(normalizeTextEol(source.content));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export function renderHeader(opts: HeaderOptions): string {
  const hash = opts.sourceHash ?? computeSourceHash(opts.sourceFiles, opts.sourceRoot);
  const lines = [
    `# ${opts.title}`,
    '',
    `> ⚠️ このファイルは \`${opts.generator}\` により自動生成された。手で編集しない。`,
    `> 再生成: \`${opts.regenerateCmd}\``,
    `> Source hash: \`${hash}\``,
    '',
  ];
  if (opts.description) {
    lines.push(opts.description, '');
  }
  lines.push('');
  return lines.join('\n');
}
