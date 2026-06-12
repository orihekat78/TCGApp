import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface HeaderOptions {
  generator: string;
  regenerateCmd: string;
  sourceFiles: string[];
  title: string;
  description?: string;
}

function expandPath(p: string): string[] {
  if (!existsSync(p)) return [`MISSING:${p}`];
  const st = statSync(p);
  if (st.isFile()) return [p];
  if (st.isDirectory()) {
    const collected: string[] = [];
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const child = resolve(p, entry.name);
      if (entry.isDirectory()) {
        collected.push(...expandPath(child));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.md'))) {
        collected.push(child);
      }
    }
    return collected.sort();
  }
  return [`UNKNOWN:${p}`];
}

export function computeSourceHash(paths: string[]): string {
  const hash = createHash('sha256');
  const allFiles: string[] = [];
  for (const p of paths) {
    allFiles.push(...expandPath(p));
  }
  // 決定論性のため絶対パスでソート
  allFiles.sort();
  for (const file of allFiles) {
    hash.update(file);
    if (file.startsWith('MISSING:') || file.startsWith('UNKNOWN:')) {
      // 既にプレフィクス入りなので追加更新不要
      continue;
    }
    try {
      hash.update(readFileSync(file, 'utf-8'));
    } catch {
      hash.update(`READ_FAIL:${file}`);
    }
  }
  return hash.digest('hex').slice(0, 12);
}

export function renderHeader(opts: HeaderOptions): string {
  const hash = computeSourceHash(opts.sourceFiles);
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
