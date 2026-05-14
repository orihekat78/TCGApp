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
// Spec 参照: `// spec: .claude/specs/foo.md` 形式
const SPEC_PATTERN = /\.claude[/\\]specs[/\\]([\w\-/]+\.md)/g;
const SPEC_COMMENT_HEAD = /^\s*\/\/\s*spec:/i;

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
  /** `// spec: .claude/specs/...md` 形式で参照している spec ファイル名 (basename) */
  specs: Set<string>;
  /** `// rules: 同 D08003` 形式で参照しているソースID (cardId) */
  inheritsFrom: Set<string>;
}

function extractRuleReferences(filePath: string): { rules: Set<string>; specs: Set<string>; inheritsFrom: Set<string> } {
  const rules = new Set<string>();
  const specs = new Set<string>();
  const inheritsFrom = new Set<string>();
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  let inRulesBlock = false;
  let inSpecBlock = false;
  // 先頭 30 行までを走査（コメントヘッダ + α）
  const scanLimit = Math.min(lines.length, 30);
  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (RULE_COMMENT_HEAD.test(line)) {
      inRulesBlock = true;
      inSpecBlock = false;
      collectFromLine(line, rules, specs, inheritsFrom);
      continue;
    }
    if (SPEC_COMMENT_HEAD.test(line)) {
      inSpecBlock = true;
      inRulesBlock = false;
      collectFromLine(line, rules, specs, inheritsFrom);
      continue;
    }
    if ((inRulesBlock || inSpecBlock) && COMMENT_LINE.test(line)) {
      collectFromLine(line, rules, specs, inheritsFrom);
    } else {
      inRulesBlock = false;
      inSpecBlock = false;
    }
  }
  return { rules, specs, inheritsFrom };
}

function collectFromLine(line: string, rulesSink: Set<string>, specsSink: Set<string>, inheritsFrom: Set<string>): void {
  for (const m of line.matchAll(RULE_PATTERN)) {
    if (m[1]) rulesSink.add(m[1]);
  }
  for (const m of line.matchAll(SPEC_PATTERN)) {
    if (m[1]) specsSink.add(m[1].replace(/\\/g, '/'));
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

/** Engine namespace (top-level under src/engine/) を抽出。
 * - ディレクトリ名のみ対象 (例: engine/read/turn.ts → 'read')
 * - engine 直下のファイル (engine/produce.ts 等) は null を返す (namespace 扱いしない) */
function engineNamespace(rel: string): string | null {
  const m = rel.match(/^engine\/([^/]+)\//);
  if (!m) return null;
  return m[1] ?? null;
}

/** 拡張子なしのファイル名 (Obsidian wikilink 用) */
function basenameNoExt(p: string): string {
  return p.replace(/.*[/\\]/, '').replace(/\.md$/, '');
}

/** Spec 相対パスをハブファイル名（拡張子なし）に変換。
 * - `engine-api-foo.md` → `engine-api-foo`
 * - `cards-data/INDEX.md` → `cards-data--INDEX` (basename 衝突を避けるため subdir を `--` で結合) */
function specToHubName(specPath: string): string {
  return specPath.replace(/\.md$/, '').replace(/[/\\]/g, '--');
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
  lines.push('### 俯瞰図 (Mermaid)\n');
  lines.push('- [`graph-rules-engine-core.md`](./graph-rules-engine-core.md) — engine-core (types/read/mutate/event/cards) ↔ rules');
  lines.push('- [`graph-rules-engine-flow.md`](./graph-rules-engine-flow.md) — engine-flow (effect/flow/invariant/dyn/target/cost/cond/resolve) ↔ rules');
  lines.push('- [`graph-specs.md`](./graph-specs.md) — engine ↔ specs の関係図');
  lines.push('');
  lines.push('### Obsidian グラフビュー連携ハブ\n');
  lines.push('各エンティティを起点に source / rule / spec / namespace をリンクで辿れるハブファイル群。Obsidian で開くとグラフビューがエンジン ↔ ルール ↔ 仕様書の関係を描画する。\n');
  lines.push('- [`by-rule/`](./by-rule/) — 各ルールが起点のハブ（このルールを参照するソース・関連 spec・関連 engine namespace）');
  lines.push('- [`by-spec/`](./by-spec/) — 各 spec が起点のハブ');
  lines.push('- [`by-engine/`](./by-engine/) — 各 engine namespace が起点のハブ');
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

// ----- Hub generators for Obsidian graph view --------------------------------

/** by-rule/{rule}.md ハブ — このルールを参照しているソース + 関連 spec を集約 */
function renderRuleHub(rule: string, refs: FileRef[]): string {
  const sources = refs.filter((r) => r.rules.has(rule)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  // 関連 spec を抽出 (cards-analysis/ は by-spec ハブ生成対象外のため除外)
  const relatedSpecs = new Set<string>();
  for (const s of sources) for (const spec of s.specs) {
    if (!spec.startsWith('cards-analysis/')) relatedSpecs.add(spec);
  }
  // 関連 engine namespace
  const relatedNs = new Set<string>();
  for (const s of sources) {
    const ns = engineNamespace(s.relativePath);
    if (ns) relatedNs.add(ns);
  }

  const header = renderHeader({
    title: `🤖 ルール参照ハブ: ${rule}`,
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT, RULES_ROOT],
    description: `公式ルール [\`${rule}\`](../../../rules/${rule}) を参照しているソース・関連 spec・関連 engine namespace のハブ。`,
  });

  const lines: string[] = [];
  lines.push('## 🔗 ルール本体\n');
  lines.push(`- [\`${rule}\`](../../../rules/${rule})\n`);

  if (relatedNs.size > 0) {
    lines.push('## 🧩 関連 Engine Namespace\n');
    for (const ns of [...relatedNs].sort()) {
      // api/{ns}.md は gen-api.ts が出力する 12 namespace のみ存在 (types は除外)
      const apiSuffix = existsSync(resolve(PROJECT_ROOT, '.claude/auto/api', `${ns}.md`))
        ? ` — [\`api/${ns}\`](../../api/${ns}.md)`
        : '';
      lines.push(`- [\`engine.${ns}\`](../by-engine/${ns}.md)${apiSuffix}`);
    }
    lines.push('');
  }

  if (relatedSpecs.size > 0) {
    lines.push('## 📐 関連 Spec\n');
    for (const spec of [...relatedSpecs].sort()) {
      const basename = basenameNoExt(spec);
      lines.push(`- [\`${basename}\`](../by-spec/${specToHubName(spec)}.md)`);
    }
    lines.push('');
  }

  lines.push(`## 📄 参照ソース (${sources.length})\n`);
  for (const s of sources.slice(0, 20)) {
    lines.push(`- [\`src/${s.relativePath}\`](../../../../src/${s.relativePath})`);
  }
  if (sources.length > 20) {
    lines.push(`- _...ほか ${sources.length - 20} 件 (詳細は [mapping](../rules-to-cards.md) 参照)_`);
  }
  return header + lines.join('\n') + '\n';
}

/** by-spec/{spec}.md ハブ — この spec を参照しているソース + 関連 rule を集約 */
function renderSpecHub(specFile: string, refs: FileRef[]): string {
  const sources = refs.filter((r) => r.specs.has(specFile)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const relatedRules = new Set<string>();
  for (const s of sources) for (const r of s.rules) relatedRules.add(r);
  const relatedNs = new Set<string>();
  for (const s of sources) {
    const ns = engineNamespace(s.relativePath);
    if (ns) relatedNs.add(ns);
  }

  const basename = basenameNoExt(specFile);
  const header = renderHeader({
    title: `🤖 Spec 参照ハブ: ${basename}`,
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT, resolve(PROJECT_ROOT, '.claude/specs')],
    description: `仕様書 [\`${basename}\`](../../../specs/${specFile}) を参照しているソース・関連 rule・関連 engine namespace のハブ。`,
  });

  const lines: string[] = [];
  lines.push('## 📐 Spec 本体\n');
  lines.push(`- [\`${basename}\`](../../../specs/${specFile})\n`);

  if (relatedNs.size > 0) {
    lines.push('## 🧩 関連 Engine Namespace\n');
    for (const ns of [...relatedNs].sort()) {
      lines.push(`- [\`engine.${ns}\`](../by-engine/${ns}.md)`);
    }
    lines.push('');
  }

  if (relatedRules.size > 0) {
    lines.push('## 📜 関連 Rule\n');
    for (const r of [...relatedRules].sort()) {
      lines.push(`- [\`${r}\`](../by-rule/${r})`);
    }
    lines.push('');
  }

  lines.push(`## 📄 参照ソース (${sources.length})\n`);
  for (const s of sources.slice(0, 20)) {
    lines.push(`- [\`src/${s.relativePath}\`](../../../../src/${s.relativePath})`);
  }
  if (sources.length > 20) {
    lines.push(`- _...ほか ${sources.length - 20} 件_`);
  }
  return header + lines.join('\n') + '\n';
}

/** by-engine/{ns}.md ハブ — この namespace 配下のソースが参照する rules + specs を集約 */
function renderEngineHub(ns: string, refs: FileRef[]): string {
  const sources = refs.filter((r) => engineNamespace(r.relativePath) === ns)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const aggRules = new Set<string>();
  const aggSpecs = new Set<string>();
  for (const s of sources) {
    for (const r of s.rules) aggRules.add(r);
    for (const sp of s.specs) {
      // by-spec ハブ非生成のため cards-analysis/ は除外
      if (!sp.startsWith('cards-analysis/')) aggSpecs.add(sp);
    }
  }

  const header = renderHeader({
    title: `🤖 Engine ハブ: engine.${ns}`,
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [resolve(SRC_ROOT, 'engine', ns)],
    description: `\`src/engine/${ns}/\` 配下のソースが参照している rules / specs / 関連 API リファレンスのハブ。`,
  });

  const lines: string[] = [];
  const apiExists = existsSync(resolve(PROJECT_ROOT, '.claude/auto/api', `${ns}.md`));
  if (apiExists) {
    lines.push('## 🔗 API リファレンス\n');
    lines.push(`- [\`auto/api/${ns}.md\`](../../api/${ns}.md)\n`);
  } else {
    lines.push(`> 注: \`engine.${ns}\` は型定義 namespace で public API ハブ無し。ソース参照のみ。\n`);
  }

  if (aggRules.size > 0) {
    lines.push(`## 📜 参照 Rule (${aggRules.size})\n`);
    for (const r of [...aggRules].sort()) {
      lines.push(`- [\`${r}\`](../by-rule/${r})`);
    }
    lines.push('');
  }

  if (aggSpecs.size > 0) {
    lines.push(`## 📐 参照 Spec (${aggSpecs.size})\n`);
    for (const sp of [...aggSpecs].sort()) {
      lines.push(`- [\`${basenameNoExt(sp)}\`](../by-spec/${specToHubName(sp)}.md)`);
    }
    lines.push('');
  }

  lines.push(`## 📄 ソース (${sources.length})\n`);
  for (const s of sources.slice(0, 20)) {
    lines.push(`- [\`src/${s.relativePath}\`](../../../../src/${s.relativePath})`);
  }
  if (sources.length > 20) {
    lines.push(`- _...ほか ${sources.length - 20} 件_`);
  }
  return header + lines.join('\n') + '\n';
}

/** ns 集約: engine namespace ごとに referenced rules / specs を集計 */
function buildNsAggregates(refs: FileRef[]): { nsRules: Map<string, Set<string>>; nsSpecs: Map<string, Set<string>> } {
  const nsRules = new Map<string, Set<string>>();
  const nsSpecs = new Map<string, Set<string>>();
  for (const r of refs) {
    const ns = engineNamespace(r.relativePath);
    if (!ns) continue;
    if (!nsRules.has(ns)) nsRules.set(ns, new Set());
    if (!nsSpecs.has(ns)) nsSpecs.set(ns, new Set());
    for (const rule of r.rules) nsRules.get(ns)!.add(rule);
    for (const sp of r.specs) nsSpecs.get(ns)!.add(sp);
  }
  return { nsRules, nsSpecs };
}

/** engine ↔ rules グラフを namespace サブセットで描画 */
function renderGraphRulesSubset(
  refs: FileRef[],
  filename: string,
  title: string,
  nsList: string[],
): string {
  const header = renderHeader({
    title,
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT, RULES_ROOT],
    description: `engine namespace ${nsList.join(' / ')} と公式ルールの参照関係を Mermaid flowchart で表示。Obsidian グラフビュー連携は [by-rule/](./by-rule/) / [by-engine/](./by-engine/) を参照。`,
  });
  const { nsRules } = buildNsAggregates(refs);
  const filtered = new Map<string, Set<string>>();
  for (const ns of nsList) if (nsRules.has(ns)) filtered.set(ns, nsRules.get(ns)!);

  const lines: string[] = ['```mermaid', 'flowchart LR'];
  lines.push('  subgraph engine["Engine Namespaces"]');
  for (const ns of [...filtered.keys()].sort()) {
    lines.push(`    NS_${ns}["${ns}"]`);
  }
  lines.push('  end');
  const allRules = new Set<string>();
  for (const set of filtered.values()) for (const r of set) allRules.add(r);
  if (allRules.size > 0) {
    lines.push('  subgraph rules["Rules"]');
    for (const r of [...allRules].sort()) {
      const id = `R_${r.replace(/[^a-z0-9]/gi, '_')}`;
      lines.push(`    ${id}["${r.replace(/\.md$/, '')}"]`);
    }
    lines.push('  end');
  }
  for (const [ns, rs] of [...filtered.entries()].sort()) {
    for (const r of [...rs].sort()) {
      const id = `R_${r.replace(/[^a-z0-9]/gi, '_')}`;
      lines.push(`  NS_${ns} --> ${id}`);
    }
  }
  lines.push('```');
  // ファイル名は呼び出し側が決定するため、内容のみ返す
  void filename;
  return header + lines.join('\n') + '\n';
}

// engine namespace を 2 グループに分割（cards-to-rules-* と同じパーティション）
const GRAPH_RULES_CORE_NS = ['types', 'read', 'mutate', 'event', 'cards'];
const GRAPH_RULES_FLOW_NS = ['effect', 'flow', 'invariant', 'dyn', 'target', 'cost', 'cond', 'resolve'];

/** graph-specs.md — engine namespace ↔ specs の Mermaid 俯瞰図 (cards-analysis/ は除外) */
function renderGraphSpecs(refs: FileRef[]): string {
  const header = renderHeader({
    title: '🤖 関係グラフ: engine ↔ specs',
    generator: 'scripts/gen-docs/gen-mapping.ts',
    regenerateCmd: 'npm run docs:mapping',
    sourceFiles: [SRC_ROOT, resolve(PROJECT_ROOT, '.claude/specs')],
    description: 'engine namespace と仕様書の参照関係を Mermaid flowchart で表示。`cards-analysis/` 配下は 1:1 で量が多いため除外。Obsidian グラフビュー連携は [by-spec/](./by-spec/) / [by-engine/](./by-engine/) を参照。',
  });
  const { nsSpecs } = buildNsAggregates(refs);
  // cards-analysis/ を除外
  const filtered = new Map<string, Set<string>>();
  for (const [ns, set] of nsSpecs.entries()) {
    const keep = new Set<string>();
    for (const sp of set) if (!sp.startsWith('cards-analysis/')) keep.add(sp);
    if (keep.size > 0) filtered.set(ns, keep);
  }

  const lines: string[] = ['```mermaid', 'flowchart LR'];
  lines.push('  subgraph engine["Engine Namespaces"]');
  for (const ns of [...filtered.keys()].sort()) {
    lines.push(`    NS_${ns}["${ns}"]`);
  }
  lines.push('  end');
  const allSpecs = new Set<string>();
  for (const set of filtered.values()) for (const sp of set) allSpecs.add(sp);
  if (allSpecs.size > 0) {
    lines.push('  subgraph specs["Specs"]');
    for (const sp of [...allSpecs].sort()) {
      const id = `S_${sp.replace(/[^a-z0-9]/gi, '_')}`;
      lines.push(`    ${id}["${basenameNoExt(sp)}"]`);
    }
    lines.push('  end');
  }
  for (const [ns, ss] of [...filtered.entries()].sort()) {
    for (const sp of [...ss].sort()) {
      const id = `S_${sp.replace(/[^a-z0-9]/gi, '_')}`;
      lines.push(`  NS_${ns} -.-> ${id}`);
    }
  }
  lines.push('```');
  return header + lines.join('\n') + '\n';
}

export function runGenMapping(options: RunOptions): RunResult {
  const sourceFiles = listSourceFiles(SRC_ROOT);
  const allRules = listRuleFiles();

  const refs: FileRef[] = [];
  for (const f of sourceFiles) {
    const { rules, specs, inheritsFrom } = extractRuleReferences(f);
    refs.push({
      filePath: f,
      relativePath: relative(SRC_ROOT, f).replace(/\\/g, '/'),
      rules,
      specs,
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

  // 俯瞰図 (Mermaid) — 100 行制約のため engine-core / engine-flow / specs に分割
  const graphRulesCoreMd = renderGraphRulesSubset(
    refs,
    'graph-rules-engine-core.md',
    '🤖 関係グラフ (engine-core) ↔ rules',
    GRAPH_RULES_CORE_NS,
  );
  const graphRulesCorePath = resolve(OUTPUT_DIR, 'graph-rules-engine-core.md');
  if (diffMarkdown(graphRulesCorePath, graphRulesCoreMd).changed) {
    if (!options.checkOnly) writeMarkdown(graphRulesCorePath, graphRulesCoreMd);
    changed.push(graphRulesCorePath);
  }
  const graphRulesFlowMd = renderGraphRulesSubset(
    refs,
    'graph-rules-engine-flow.md',
    '🤖 関係グラフ (engine-flow) ↔ rules',
    GRAPH_RULES_FLOW_NS,
  );
  const graphRulesFlowPath = resolve(OUTPUT_DIR, 'graph-rules-engine-flow.md');
  if (diffMarkdown(graphRulesFlowPath, graphRulesFlowMd).changed) {
    if (!options.checkOnly) writeMarkdown(graphRulesFlowPath, graphRulesFlowMd);
    changed.push(graphRulesFlowPath);
  }
  const graphSpecsMd = renderGraphSpecs(refs);
  const graphSpecsPath = resolve(OUTPUT_DIR, 'graph-specs.md');
  if (diffMarkdown(graphSpecsPath, graphSpecsMd).changed) {
    if (!options.checkOnly) writeMarkdown(graphSpecsPath, graphSpecsMd);
    changed.push(graphSpecsPath);
  }

  // by-rule/{rule}.md (各ルールに紐づく source/spec/ns のハブ)
  const referencedRules = new Set<string>();
  for (const r of refs) for (const rule of r.rules) referencedRules.add(rule);
  let totalHubs = 0;
  for (const rule of referencedRules) {
    const md = renderRuleHub(rule, refs);
    const path = resolve(OUTPUT_DIR, 'by-rule', rule);
    totalHubs++;
    if (diffMarkdown(path, md).changed) {
      if (!options.checkOnly) writeMarkdown(path, md);
      changed.push(path);
    }
  }

  // by-spec/{spec}.md (各 spec に紐づく source/rule/ns のハブ)
  // cards-analysis/ は 1:1 で量が多いため除外（cards-to-rules-cards.md で網羅済）
  const referencedSpecs = new Set<string>();
  for (const r of refs) for (const sp of r.specs) {
    if (!sp.startsWith('cards-analysis/')) referencedSpecs.add(sp);
  }
  for (const spec of referencedSpecs) {
    const md = renderSpecHub(spec, refs);
    const path = resolve(OUTPUT_DIR, 'by-spec', `${specToHubName(spec)}.md`);
    totalHubs++;
    if (diffMarkdown(path, md).changed) {
      if (!options.checkOnly) writeMarkdown(path, md);
      changed.push(path);
    }
  }

  // by-engine/{ns}.md (各 namespace の rules+specs ハブ)
  const referencedNs = new Set<string>();
  for (const r of refs) {
    const ns = engineNamespace(r.relativePath);
    if (ns) referencedNs.add(ns);
  }
  for (const ns of referencedNs) {
    const md = renderEngineHub(ns, refs);
    const path = resolve(OUTPUT_DIR, 'by-engine', `${ns}.md`);
    totalHubs++;
    if (diffMarkdown(path, md).changed) {
      if (!options.checkOnly) writeMarkdown(path, md);
      changed.push(path);
    }
  }

  return { changedFiles: changed, totalFiles: 1 + SPLIT_GROUPS.length + 1 + 1 + totalHubs };
}
