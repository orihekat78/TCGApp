import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const CARDS_ROOT = resolve(PROJECT_ROOT, 'src/cards');
const TESTS_ROOT = resolve(PROJECT_ROOT, 'tests');
const OUTPUT_DIR = resolve(PROJECT_ROOT, '.claude/auto/progress');
const VITEST_SUMMARY = resolve(PROJECT_ROOT, '.tmp/vitest-summary.json');

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      out.push(full);
    }
  }
  return out;
}

interface DeckStats {
  deck: string;
  total: number;
  ids: string[];
}

function collectDeckStats(): DeckStats[] {
  const decks: DeckStats[] = [];
  if (!existsSync(CARDS_ROOT)) return decks;
  for (const entry of readdirSync(CARDS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_shared') continue;
    const deckDir = resolve(CARDS_ROOT, entry.name);
    const files = listTsFiles(deckDir);
    const ids = files
      .map((f) => f.split(/[\\/]/).pop()!.replace(/\.ts$/, ''))
      .sort();
    decks.push({ deck: entry.name, total: ids.length, ids });
  }
  return decks.sort((a, b) => a.deck.localeCompare(b.deck));
}

function collectSharedClasses(): string[] {
  const sharedDir = resolve(CARDS_ROOT, '_shared');
  if (!existsSync(sharedDir)) return [];
  return readdirSync(sharedDir)
    .filter((n) => n.endsWith('.ts') && n !== 'index.ts')
    .map((n) => n.replace(/\.ts$/, ''))
    .sort();
}

function collectTestFiles(): { total: number; byArea: Record<string, number> } {
  const byArea: Record<string, number> = {};
  let total = 0;
  function walk(dir: string, area: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, area || entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        const key = area || 'root';
        byArea[key] = (byArea[key] ?? 0) + 1;
        total += 1;
      }
    }
  }
  if (!existsSync(TESTS_ROOT)) return { total: 0, byArea };
  for (const entry of readdirSync(TESTS_ROOT, { withFileTypes: true })) {
    const full = resolve(TESTS_ROOT, entry.name);
    if (entry.isDirectory()) walk(full, entry.name);
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      byArea['root'] = (byArea['root'] ?? 0) + 1;
      total += 1;
    }
  }
  return { total, byArea };
}

interface VitestSummary {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults?: unknown[];
  startTime?: number;
}

function readVitestSummary(): VitestSummary | null {
  if (!existsSync(VITEST_SUMMARY)) return null;
  try {
    const raw = readFileSync(VITEST_SUMMARY, 'utf-8');
    return JSON.parse(raw) as VitestSummary;
  } catch {
    return null;
  }
}

function renderCardsMd(decks: DeckStats[], shared: string[]): string {
  const header = renderHeader({
    title: '🤖 カード実装進捗',
    generator: 'scripts/gen-docs/gen-progress.ts',
    regenerateCmd: 'npm run docs:progress',
    sourceFiles: [CARDS_ROOT],
    description: '`src/cards/` 配下のファイル数をデッキ別に集計。`_shared` 配下は別表に分離。',
  });
  const total = decks.reduce((a, b) => a + b.total, 0);
  const lines: string[] = [];
  lines.push('## デッキ別実装数\n');
  lines.push('| デッキ | 実装数 |');
  lines.push('| ----- | ------ |');
  for (const d of decks) {
    lines.push(`| \`${d.deck}\` | ${d.total} |`);
  }
  lines.push(`| **合計** | **${total}** |`);
  lines.push('');
  lines.push('## 実装済カードID一覧\n');
  for (const d of decks) {
    lines.push(`### \`${d.deck}\` (${d.total} 枚)\n`);
    lines.push(d.ids.map((id) => `\`${id}\``).join(' / '));
    lines.push('');
  }
  lines.push(`## 共通クラス (\`_shared/\` ${shared.length} 件)\n`);
  for (const s of shared) {
    lines.push(`- \`${s}\``);
  }
  lines.push('');
  lines.push('---\n');
  lines.push('## ソース\n');
  lines.push('- [`src/cards/`](../../../src/cards/)');
  lines.push('');
  return header + lines.join('\n');
}

function renderTestsMd(stats: { total: number; byArea: Record<string, number> }, vitest: VitestSummary | null): string {
  const header = renderHeader({
    title: '🤖 テスト進捗',
    generator: 'scripts/gen-docs/gen-progress.ts',
    regenerateCmd: 'npm run docs:progress',
    sourceFiles: [TESTS_ROOT],
    description: '`tests/` 配下のテストファイル数を領域別に集計。最新の vitest 結果（あれば）も併記。',
  });
  const lines: string[] = [];
  lines.push('## テストファイル数\n');
  lines.push('| 領域 | ファイル数 |');
  lines.push('| --- | ---------- |');
  const entries = Object.entries(stats.byArea).sort();
  for (const [area, n] of entries) {
    lines.push(`| \`${area}\` | ${n} |`);
  }
  lines.push(`| **合計** | **${stats.total}** |`);
  lines.push('');

  if (vitest && typeof vitest.numTotalTests === 'number') {
    const passed = vitest.numPassedTests ?? 0;
    const failed = vitest.numFailedTests ?? 0;
    const ts = vitest.startTime ? new Date(vitest.startTime).toISOString() : 'unknown';
    lines.push('## 最新 vitest 実行サマリ\n');
    lines.push(`- **実行日時**: ${ts}`);
    lines.push(`- **テスト総数**: ${vitest.numTotalTests}`);
    lines.push(`- **PASS**: ${passed}`);
    lines.push(`- **FAIL**: ${failed}`);
    if (vitest.testResults) {
      lines.push(`- **テストファイル**: ${vitest.testResults.length}`);
    }
    lines.push('');
  } else {
    lines.push('## 最新 vitest 実行サマリ\n');
    lines.push(`> ⚠️ \`.tmp/vitest-summary.json\` が見つかりません。`);
    lines.push('> 詳細な PASS/FAIL 数を表示するには次のコマンドを実行してください:');
    lines.push('');
    lines.push('```sh');
    lines.push('npx vitest run --reporter=json --outputFile=.tmp/vitest-summary.json');
    lines.push('npm run docs:progress');
    lines.push('```');
    lines.push('');
  }

  lines.push('---\n');
  lines.push('## ソース\n');
  lines.push('- [`tests/`](../../../tests/)');
  if (vitest) lines.push('- `.tmp/vitest-summary.json` (vitest reporter 出力)');
  lines.push('');
  return header + lines.join('\n');
}

export function runGenProgress(options: RunOptions): RunResult {
  const decks = collectDeckStats();
  const shared = collectSharedClasses();
  const tests = collectTestFiles();
  const vitest = readVitestSummary();

  // 触ったファイル一覧を一定の順序で記録
  void statSync; // keep for potential future use

  const changed: string[] = [];

  const cardsMd = renderCardsMd(decks, shared);
  const cardsPath = resolve(OUTPUT_DIR, 'cards.md');
  if (diffMarkdown(cardsPath, cardsMd).changed) {
    if (!options.checkOnly) writeMarkdown(cardsPath, cardsMd);
    changed.push(cardsPath);
  }

  const testsMd = renderTestsMd(tests, vitest);
  const testsPath = resolve(OUTPUT_DIR, 'tests.md');
  if (diffMarkdown(testsPath, testsMd).changed) {
    if (!options.checkOnly) writeMarkdown(testsPath, testsMd);
    changed.push(testsPath);
  }

  return { changedFiles: changed, totalFiles: 2 };
}
