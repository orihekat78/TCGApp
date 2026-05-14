import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const SRC_ROOT = resolve(PROJECT_ROOT, 'src');
const RULES_ROOT = resolve(PROJECT_ROOT, '.claude/rules');
const OUTPUT_DIR = resolve(PROJECT_ROOT, '.claude/auto/mapping');

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

// 引用部品: 'NN-name.md' 形式のルールファイル名のみ抽出
const RULE_PATTERN = /(\d{2}-[a-z0-9-]+\.md)/g;
const RULE_COMMENT_HEAD = /^\s*\/\/\s*rules:/i;
const COMMENT_LINE = /^\s*\/\//;
// 継承コメント: `// rules: 同 D08003` → D08003 を参照
const INHERIT_PATTERN = /同\s*(D\d{5})/g;

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function listRuleFiles(): string[] {
  if (!existsSync(RULES_ROOT)) return [];
  return readdirSync(RULES_ROOT)
    .filter((n) => /^\d{2}-.+\.md$/.test(n))
    .sort();
}

interface FileRef {
  filePath: string;
  relativePath: string;
  rules: Set<string>;
  /** `// rules: 同 D08003` 形式で参照しているソースID (cardId) */
  inheritsFrom: Set<string>;
}

function extractRuleReferences(filePath: string): { rules: Set<string>; inheritsFrom: Set<string> } {
  const rules = new Set<string>();
  const inheritsFrom = new Set<string>();
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  let inRulesBlock = false;
  // 先頭 30 行までを走査（コメントヘッダ + α）。途中の `// rules:` も拾う。
  const scanLimit = Math.min(lines.length, 30);
  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (RULE_COMMENT_HEAD.test(line)) {
      inRulesBlock = true;
      collectFromLine(line, rules, inheritsFrom);
      continue;
    }
    if (inRulesBlock) {
      if (COMMENT_LINE.test(line) && !RULE_COMMENT_HEAD.test(line)) {
        collectFromLine(line, rules, inheritsFrom);
      } else {
        inRulesBlock = false;
      }
    }
  }
  return { rules, inheritsFrom };
}

function collectFromLine(line: string, sink: Set<string>, inheritsFrom: Set<string>): void {
  for (const m of line.matchAll(RULE_PATTERN)) {
    if (m[1]) sink.add(m[1]);
  }
  for (const m of line.matchAll(INHERIT_PATTERN)) {
    if (m[1]) inheritsFrom.add(m[1]);
  }
}

/** カードID (D08003 等) からファイルパスへの解決 */
function buildCardIdIndex(refs: FileRef[]): Map<string, FileRef> {
  const idx = new Map<string, FileRef>();
  for (const r of refs) {
    const match = r.relativePath.match(/\/(D\d{5})\.ts$/);
    if (match && match[1]) idx.set(match[1], r);
  }
  return idx;
}

/** 継承を解決し、各 FileRef.rules を継承元の rules で補完する (1 段のみ) */
function resolveInheritance(refs: FileRef[]): void {
  const cardIdx = buildCardIdIndex(refs);
  for (const r of refs) {
    if (r.inheritsFrom.size === 0) continue;
    for (const cardId of r.inheritsFrom) {
      const parent = cardIdx.get(cardId);
      if (parent) {
        for (const rule of parent.rules) r.rules.add(rule);
      }
    }
  }
}

function classifyArea(rel: string): string {
  if (rel.startsWith('cards/_shared')) return 'cards/_shared';
  if (rel.startsWith('cards/ct-d08')) return 'cards/ct-d08';
  if (rel.startsWith('cards/ct-d11')) return 'cards/ct-d11';
  if (rel.startsWith('cards')) return 'cards (他)';
  if (rel.startsWith('engine/flow')) return 'engine/flow';
  if (rel.startsWith('engine/mutate')) return 'engine/mutate';
  if (rel.startsWith('engine/read')) return 'engine/read';
  if (rel.startsWith('engine/effect')) return 'engine/effect';
  if (rel.startsWith('engine/invariant')) return 'engine/invariant';
  if (rel.startsWith('engine/types')) return 'engine/types';
  if (rel.startsWith('engine')) return 'engine (他)';
  if (rel.startsWith('ai')) return 'ai';
  return 'その他';
}

interface SplitGroup {
  fileName: string;
  title: string;
  areas: string[];
}

const SPLIT_GROUPS: SplitGroup[] = [
  {
    fileName: 'cards-to-rules-cards.md',
    title: 'カード → ルール マッピング',
    areas: ['cards/_shared', 'cards/ct-d08', 'cards/ct-d11', 'cards (他)', 'ai'],
  },
  {
    fileName: 'cards-to-rules-engine-core.md',
    title: 'Engine (types/read/mutate) → ルール マッピング',
    areas: ['engine/types', 'engine/read', 'engine/mutate'],
  },
  {
    fileName: 'cards-to-rules-engine-flow.md',
    title: 'Engine (effect/flow/invariant) → ルール マッピング',
    areas: ['engine/effect', 'engine/flow', 'engine/invariant', 'engine (他)', 'その他'],
  },
];

function renderGroupMapping(refs: FileRef[], group: SplitGroup): string {
  const header = renderHeader({
    title: `🤖 ${group.title}`,
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT],
    description: '`// rules: NN-name.md, ...` コメントから抽出。ファイル容量制約のためエリア別に分割。',
  });
  const byArea = new Map<string, FileRef[]>();
  for (const r of refs) {
    const area = classifyArea(r.relativePath);
    if (!group.areas.includes(area)) continue;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(r);
  }

  const lines: string[] = [];
  const groupTotal = [...byArea.values()].reduce((a, b) => a + b.length, 0);
  lines.push(`このグループ: **${groupTotal}** ファイル（[全体 index](./index.md)）\n`);

  for (const area of group.areas) {
    const list = byArea.get(area);
    if (!list || list.length === 0) continue;
    lines.push(`## ${area} (${list.length})\n`);
    lines.push('| ソース | 参照ルール |');
    lines.push('| ------ | --------- |');
    for (const r of list.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      const ruleLinks = [...r.rules]
        .sort()
        .map((rule) => `[\`${rule}\`](../../rules/${rule})`)
        .join(' / ');
      let display: string;
      if (r.rules.size > 0 && r.inheritsFrom.size > 0) {
        const inheritNote = ` _(継承: ${[...r.inheritsFrom].sort().join(', ')})_`;
        display = ruleLinks + inheritNote;
      } else if (r.rules.size > 0) {
        display = ruleLinks;
      } else if (r.inheritsFrom.size > 0) {
        // 継承元が未解決 (cardIdx に無い) のケース
        display = `_(継承先のみ: ${[...r.inheritsFrom].sort().join(', ')})_`;
      } else {
        display = '_(参照なし)_';
      }
      lines.push(`| [\`src/${r.relativePath}\`](../../../src/${r.relativePath}) | ${display} |`);
    }
    lines.push('');
  }
  return header + lines.join('\n');
}

function renderMappingIndex(refs: FileRef[], allRules: string[]): string {
  const header = renderHeader({
    title: '🤖 ルール ↔ ソース マッピング index',
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT, RULES_ROOT],
    description: '`// rules:` コメントから生成した双方向マッピングのハブ。',
  });
  const lines: string[] = [];
  const totalFiles = refs.length;
  const filesWithRules = refs.filter((r) => r.rules.size > 0).length;
  const totalRefs = refs.reduce((a, r) => a + r.rules.size, 0);
  const referencedRules = new Set<string>();
  for (const r of refs) for (const rule of r.rules) referencedRules.add(rule);

  lines.push('## サマリ\n');
  lines.push(`- ソースファイル: **${totalFiles}** (うち \`// rules:\` 参照あり: **${filesWithRules}**)`);
  lines.push(`- 参照総数: **${totalRefs}**`);
  lines.push(`- 参照されているルール: **${referencedRules.size}/${allRules.length}**`);
  lines.push('');
  lines.push('## マッピング一覧\n');
  lines.push('### ソース → ルール（エリア別分割）\n');
  for (const g of SPLIT_GROUPS) {
    lines.push(`- [\`${g.fileName}\`](./${g.fileName}) — ${g.title}`);
  }
  lines.push('');
  lines.push('### ルール → ソース\n');
  lines.push('- [`rules-to-cards.md`](./rules-to-cards.md) — 各ルールがどのソースから参照されているか');
  lines.push('');
  lines.push('---\n');
  lines.push('## ソース\n');
  lines.push('- [`src/`](../../../src/)');
  lines.push('- [`.claude/rules/`](../../rules/)');
  return header + lines.join('\n');
}

function renderRulesToCards(refs: FileRef[], allRules: string[]): string {
  const header = renderHeader({
    title: '🤖 ルール → ソース マッピング',
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [RULES_ROOT, SRC_ROOT],
    description: '各公式ルールがどのソースファイルから参照されているか。未参照ルールは要確認。',
  });

  // ルール → 参照ファイル
  const ruleToFiles = new Map<string, string[]>();
  for (const rule of allRules) ruleToFiles.set(rule, []);
  for (const r of refs) {
    for (const rule of r.rules) {
      if (!ruleToFiles.has(rule)) ruleToFiles.set(rule, []);
      ruleToFiles.get(rule)!.push(r.relativePath);
    }
  }

  const lines: string[] = [];
  const referenced = [...ruleToFiles.entries()].filter(([, v]) => v.length > 0);
  const unreferenced = [...ruleToFiles.entries()].filter(([, v]) => v.length === 0);

  lines.push(`**${referenced.length}/${ruleToFiles.size}** ルールが少なくとも1ファイルから参照されている。\n`);

  lines.push('## 参照あり\n');
  lines.push('| ルール | 参照数 | 参照元 (抜粋) |');
  lines.push('| ----- | ------ | ------------- |');
  for (const [rule, files] of referenced.sort()) {
    const sorted = files.sort();
    const preview =
      sorted.length <= 4
        ? sorted.map((f) => `\`${f}\``).join(', ')
        : sorted.slice(0, 3).map((f) => `\`${f}\``).join(', ') + ` ほか ${sorted.length - 3} 件`;
    lines.push(`| [\`${rule}\`](../../rules/${rule}) | ${files.length} | ${preview} |`);
  }
  lines.push('');

  if (unreferenced.length > 0) {
    lines.push('## 参照なし (要確認)\n');
    lines.push('以下のルールはコード側から `// rules:` コメントで参照されていない。');
    lines.push('実装上参照すべきだが漏れているか、純粋に対戦運用ルール（フロアルール等）でコード非該当の可能性あり。\n');
    for (const [rule] of unreferenced.sort()) {
      lines.push(`- [\`${rule}\`](../../rules/${rule})`);
    }
    lines.push('');
  }

  lines.push('---\n');
  lines.push('## ソース\n');
  lines.push('- [`.claude/rules/`](../../rules/)');
  lines.push('- [`src/`](../../../src/)');
  lines.push('');
  return header + lines.join('\n');
}

export function runGenMapping(options: RunOptions): RunResult {
  const sourceFiles = listSourceFiles(SRC_ROOT);
  const allRules = listRuleFiles();

  const refs: FileRef[] = [];
  for (const f of sourceFiles) {
    const { rules, inheritsFrom } = extractRuleReferences(f);
    refs.push({
      filePath: f,
      relativePath: relative(SRC_ROOT, f).replace(/\\/g, '/'),
      rules,
      inheritsFrom,
    });
  }

  // 継承コメント (`// rules: 同 D08003`) を解決
  resolveInheritance(refs);

  const changed: string[] = [];

  const indexMd = renderMappingIndex(refs, allRules);
  const indexPath = resolve(OUTPUT_DIR, 'index.md');
  if (diffMarkdown(indexPath, indexMd).changed) {
    if (!options.checkOnly) writeMarkdown(indexPath, indexMd);
    changed.push(indexPath);
  }

  for (const group of SPLIT_GROUPS) {
    const md = renderGroupMapping(refs, group);
    const path = resolve(OUTPUT_DIR, group.fileName);
    if (diffMarkdown(path, md).changed) {
      if (!options.checkOnly) writeMarkdown(path, md);
      changed.push(path);
    }
  }

  const rulesToCardsMd = renderRulesToCards(refs, allRules);
  const rulesToCardsPath = resolve(OUTPUT_DIR, 'rules-to-cards.md');
  if (diffMarkdown(rulesToCardsPath, rulesToCardsMd).changed) {
    if (!options.checkOnly) writeMarkdown(rulesToCardsPath, rulesToCardsMd);
    changed.push(rulesToCardsPath);
  }

  return { changedFiles: changed, totalFiles: 1 + SPLIT_GROUPS.length + 1 };
}
