import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export const MAX_LINES = 100;

export function writeMarkdown(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function lineCount(content: string): number {
  return content.split('\n').length;
}

export interface DiffResult {
  path: string;
  changed: boolean;
  missing: boolean;
}

function normalizeEol(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

export function diffMarkdown(path: string, expected: string): DiffResult {
  if (!existsSync(path)) {
    return { path, changed: true, missing: true };
  }
  const actual = readFileSync(path, 'utf-8');
  return {
    path,
    changed: normalizeEol(actual) !== normalizeEol(expected),
    missing: false,
  };
}

export function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function formatTypeSig(sig: string): string {
  return sig.replace(/\s+/g, ' ').trim();
}

/**
 * 文字列を最大 N 文字に短縮する。
 * - 文末 ('.' / '。' / '/') の直後で切る (sentence boundary 優先)
 * - 開き引用符 ('...) が未閉鎖になる位置は避ける (バランスチェック)
 * - 末尾に '…' を付与
 */
export function smartTruncate(s: string, maxLen: number): string {
  const text = s.trim();
  if (text.length <= maxLen) return text;
  // 1. 最後の文末記号で切れるか試す
  const slice = text.slice(0, maxLen);
  const sentenceEndRe = /[.。/](?=[^.。/]*$)/;
  const match = slice.match(sentenceEndRe);
  let cutAt = maxLen;
  if (match && match.index !== undefined && match.index > maxLen * 0.5) {
    cutAt = match.index + 1;
  }
  let cut = text.slice(0, cutAt);
  // 2. シングルクォートが奇数個 → 1個削って閉鎖を保つ
  const singleQuoteCount = (cut.match(/'/g) ?? []).length;
  if (singleQuoteCount % 2 === 1) {
    const lastQuote = cut.lastIndexOf("'");
    if (lastQuote >= 0) cut = cut.slice(0, lastQuote);
  }
  return cut.trimEnd() + '…';
}
