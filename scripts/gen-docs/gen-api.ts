import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, Node } from 'ts-morph';
import type {
  ArrowFunction,
  FunctionDeclaration,
  ObjectLiteralExpression,
  VariableDeclaration,
} from 'ts-morph';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown, escapeMd, formatTypeSig, smartTruncate } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const ENGINE_ROOT = resolve(PROJECT_ROOT, 'src/engine');
const OUTPUT_DIR = resolve(PROJECT_ROOT, '.claude/auto/api');

interface NamespaceSpec {
  name: string;
  entry: string;
  description: string;
}

const NAMESPACES: NamespaceSpec[] = [
  { name: 'read', entry: 'read/index.ts', description: '純粋セレクタ（GameState を読むのみ、副作用なし）' },
  { name: 'mutate', entry: 'mutate/index.ts', description: 'Immer draft 上の primitive 変更操作' },
  { name: 'invariant', entry: 'invariant/index.ts', description: '不変条件チェック（case/partner/stun semantics 等）' },
  { name: 'event', entry: 'event/index.ts', description: 'Hook on/emit/queue + EffectStackEntry 自動wrap' },
  { name: 'effect', entry: 'effect/index.ts', description: 'Atom dispatcher / DSL Resolver / Validator' },
  { name: 'dyn', entry: 'dyn/index.ts', description: '動的式評価（$self.ap / $contact.X / $cost.X / $dyn.X）' },
  { name: 'target', entry: 'target/index.ts', description: '候補抽出 + 選択検証（split-name / distinctNames 含む）' },
  { name: 'cost', entry: 'cost/index.ts', description: 'コスト判定（canPay / pay）+ viaCost フラグ管理' },
  { name: 'cond', entry: 'cond/index.ts', description: '26 Condition variants 評価' },
  { name: 'resolve', entry: 'resolve/index.ts', description: 'Effect Stack（queue/next/runOne + cancel/replace/lock）' },
  { name: 'flow', entry: 'flow/index.ts', description: 'フェイズ制御（setup / auto / main / action FSM / contact / actionCase / guard）' },
  { name: 'cards', entry: 'cards/index.ts', description: 'カード定義レジストリ + TSV パーサ' },
];

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

interface ExportedItem {
  name: string;
  /** 公開エイリアス名（aggregator が `case: caseOp` 等で renaming している場合） */
  displayName?: string;
  kind: 'function' | 'object' | 'class' | 'type' | 'const' | 'other';
  signature?: string;
  leadingComment?: string;
  members?: string[];
}

function getLeadingComment(node: Node): string | undefined {
  const fullText = node.getFullText();
  const trivia = fullText.slice(0, node.getLeadingTriviaWidth()).trim();
  if (!trivia) return undefined;
  const lines = trivia
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\/\/|\*|\/\*\*?|\*\/)\s?/, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('rules:') && !l.startsWith('spec:'));
  if (lines.length === 0) return undefined;
  // smartTruncate でセンテンス境界 / 引用符バランスを保ちつつ 200 文字以内に短縮
  return escapeMd(smartTruncate(lines.join(' '), 200));
}

function functionSignature(decl: FunctionDeclaration | ArrowFunction): string {
  const params = decl
    .getParameters()
    .map((p) => p.getText())
    .join(', ');
  const ret = decl.getReturnTypeNode()?.getText() ?? decl.getReturnType().getText();
  return formatTypeSig(`(${params}): ${ret}`);
}

function extractObjectMembers(obj: ObjectLiteralExpression): string[] {
  const members: string[] = [];
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
      members.push(prop.getName());
    } else if (Node.isMethodDeclaration(prop)) {
      members.push(prop.getName());
    }
    // SpreadAssignment (e.g. `...main`) はスキップ:
    // 個別関数は parent の re-export で関数表に出るため重複を避ける。
  }
  return members.sort();
}

// PropertyAssignment の値側の識別子を抽出 (`case: caseOp` → `{ case: 'caseOp' }`)
function extractAggregatorAliasMap(obj: ObjectLiteralExpression): Record<string, string> {
  // 戻り値: 内部 const 名 → 公開キー名
  const aliasMap: Record<string, string> = {};
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const key = prop.getName();
      const init = prop.getInitializer();
      if (init && Node.isIdentifier(init)) {
        const internalName = init.getText();
        if (internalName !== key) aliasMap[internalName] = key;
      }
    }
  }
  return aliasMap;
}

function extractFromVariable(decl: VariableDeclaration): { item: ExportedItem | null; aliasMap?: Record<string, string> } {
  const name = decl.getName();
  const init = decl.getInitializer();
  if (!init) {
    return { item: { name, kind: 'const', leadingComment: getLeadingComment(decl.getVariableStatementOrThrow()) } };
  }
  if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
    return {
      item: {
        name,
        kind: 'function',
        signature: functionSignature(init as ArrowFunction),
        leadingComment: getLeadingComment(decl.getVariableStatementOrThrow()),
      },
    };
  }
  if (Node.isObjectLiteralExpression(init)) {
    return {
      item: {
        name,
        kind: 'object',
        members: extractObjectMembers(init),
        leadingComment: getLeadingComment(decl.getVariableStatementOrThrow()),
      },
      aliasMap: extractAggregatorAliasMap(init),
    };
  }
  return {
    item: {
      name,
      kind: 'const',
      leadingComment: getLeadingComment(decl.getVariableStatementOrThrow()),
    },
  };
}

function collectExports(
  project: Project,
  entryPath: string,
  namespaceName: string,
): { items: ExportedItem[]; aggregatorAliasMap: Record<string, string> } {
  const sf = project.getSourceFileOrThrow(entryPath);
  const items: ExportedItem[] = [];
  const seen = new Set<string>();
  let aggregatorAliasMap: Record<string, string> = {};

  for (const [name, decls] of sf.getExportedDeclarations()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const decl = decls[0];
    if (!decl) continue;

    if (Node.isFunctionDeclaration(decl)) {
      items.push({
        name,
        kind: 'function',
        signature: functionSignature(decl),
        leadingComment: getLeadingComment(decl),
      });
    } else if (Node.isVariableDeclaration(decl)) {
      const { item, aliasMap } = extractFromVariable(decl);
      if (item) items.push({ ...item, name });
      if (aliasMap && name === namespaceName) {
        aggregatorAliasMap = aliasMap;
      }
    } else if (Node.isClassDeclaration(decl)) {
      items.push({ name, kind: 'class' });
    } else if (
      Node.isTypeAliasDeclaration(decl) ||
      Node.isInterfaceDeclaration(decl)
    ) {
      items.push({ name, kind: 'type' });
    } else {
      items.push({ name, kind: 'other' });
    }
  }
  // 内部 const 名 → 公開キー名 を ExportedItem.displayName に反映
  for (const item of items) {
    if (aggregatorAliasMap[item.name]) {
      item.displayName = aggregatorAliasMap[item.name];
    }
  }
  items.sort((a, b) => {
    const order = { object: 0, function: 1, class: 2, const: 3, type: 4, other: 5 };
    return order[a.kind] - order[b.kind] || a.name.localeCompare(b.name);
  });
  return { items, aggregatorAliasMap };
}

function renderNamespaceMd(ns: NamespaceSpec, items: ExportedItem[], sourceFiles: string[]): string {
  const header = renderHeader({
    title: `🤖 engine.${ns.name}`,
    generator: 'scripts/gen-docs/gen-api.ts',
    regenerateCmd: 'npm run docs:api',
    sourceFiles,
    description: ns.description,
  });

  const aggregator = items.find((i) => i.kind === 'object' && i.name === ns.name);
  const otherObjects = items.filter((i) => i.kind === 'object' && i.name !== ns.name);
  const functions = items.filter((i) => i.kind === 'function');
  const types = items.filter((i) => i.kind === 'type');
  const others = items.filter((i) => i.kind !== 'function' && i.kind !== 'object' && i.kind !== 'type');

  const sections: string[] = [];

  if (aggregator?.members?.length) {
    sections.push('## アグリゲータ (`engine.' + ns.name + '`)\n');
    sections.push('以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:\n');
    for (const m of aggregator.members) {
      sections.push(`- \`${m}\``);
    }
    sections.push('');
  }

  if (otherObjects.length) {
    sections.push('## サブ namespace\n');
    sections.push('| 名前 | メンバー |');
    sections.push('| ---- | -------- |');
    for (const o of otherObjects) {
      const displayed = o.displayName ?? o.name;
      const aliasNote = o.displayName && o.displayName !== o.name ? ` _(internal: \`${o.name}\`)_` : '';
      sections.push(
        `| \`${displayed}\`${aliasNote} | ${(o.members ?? []).map((m) => `\`${m}\``).join(', ') || '—'} |`,
      );
    }
    sections.push('');
  }

  if (functions.length) {
    sections.push('## 関数\n');
    sections.push('| 名前 | シグネチャ | 説明 |');
    sections.push('| ---- | ---------- | ---- |');
    for (const f of functions) {
      sections.push(
        `| \`${f.name}\` | \`${escapeMd(f.signature ?? '')}\` | ${escapeMd(f.leadingComment ?? '')} |`,
      );
    }
    sections.push('');
  }

  if (types.length) {
    sections.push('## 型エクスポート\n');
    for (const t of types) {
      sections.push(`- \`${t.name}\``);
    }
    sections.push('');
  }

  if (others.length) {
    sections.push('## その他のエクスポート\n');
    for (const o of others) {
      sections.push(`- \`${o.name}\` _(${o.kind})_`);
    }
    sections.push('');
  }

  sections.push('---\n');
  sections.push('## ソース\n');
  for (const src of sourceFiles) {
    const rel = src.replace(PROJECT_ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
    sections.push(`- [\`${rel}\`](../../../${rel})`);
  }
  sections.push('');

  return header + sections.join('\n') + '\n';
}

function renderIndexMd(specs: { ns: NamespaceSpec; count: number }[], sourceFiles: string[]): string {
  const header = renderHeader({
    title: '🤖 engine public API — namespace 一覧',
    generator: 'scripts/gen-docs/gen-api.ts',
    regenerateCmd: 'npm run docs:api',
    sourceFiles,
    description: '`src/engine/index.ts` から公開されている 12 namespace の自動生成リファレンス。',
  });
  const lines = [
    '| namespace | エクスポート数 | 説明 |',
    '| --------- | -------------- | ---- |',
  ];
  for (const { ns, count } of specs) {
    lines.push(`| [\`${ns.name}\`](${ns.name}.md) | ${count} | ${escapeMd(ns.description)} |`);
  }
  lines.push('', '## 全体構造\n');
  lines.push('`engine` オブジェクトは `src/engine/index.ts` で 12 namespace を統合公開している。');
  lines.push('');
  lines.push('## 関連');
  lines.push('');
  lines.push('- [`.claude/auto/README.md`](../README.md) — 自動生成ドキュメント運用ガイド');
  lines.push('- [`HUB.md`](../../../HUB.md) — プロジェクトHUB');
  lines.push('');
  return header + lines.join('\n');
}

export function runGenApi(options: RunOptions): RunResult {
  const project = new Project({
    tsConfigFilePath: resolve(PROJECT_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  const allEntryPaths = NAMESPACES.map((ns) => resolve(ENGINE_ROOT, ns.entry));
  project.addSourceFilesAtPaths([
    resolve(ENGINE_ROOT, '**/*.ts'),
    resolve(ENGINE_ROOT, 'index.ts'),
  ]);

  const changed: string[] = [];
  const indexSpecs: { ns: NamespaceSpec; count: number }[] = [];

  for (const ns of NAMESPACES) {
    const entryPath = resolve(ENGINE_ROOT, ns.entry);
    const { items } = collectExports(project, entryPath, ns.name);
    const sourceFiles = [entryPath];
    const md = renderNamespaceMd(ns, items, sourceFiles);
    const outPath = resolve(OUTPUT_DIR, `${ns.name}.md`);
    indexSpecs.push({ ns, count: items.length });

    if (options.checkOnly) {
      const diff = diffMarkdown(outPath, md);
      if (diff.changed) changed.push(outPath);
    } else {
      const diff = diffMarkdown(outPath, md);
      if (diff.changed) {
        writeMarkdown(outPath, md);
        changed.push(outPath);
      }
    }
  }

  const indexPath = resolve(OUTPUT_DIR, 'index.md');
  const indexMd = renderIndexMd(indexSpecs, [resolve(ENGINE_ROOT, 'index.ts'), ...allEntryPaths]);
  if (options.checkOnly) {
    const diff = diffMarkdown(indexPath, indexMd);
    if (diff.changed) changed.push(indexPath);
  } else {
    const diff = diffMarkdown(indexPath, indexMd);
    if (diff.changed) {
      writeMarkdown(indexPath, indexMd);
      changed.push(indexPath);
    }
  }

  return { changedFiles: changed, totalFiles: NAMESPACES.length + 1 };
}
