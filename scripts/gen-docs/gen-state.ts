import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, Node } from 'ts-morph';
import type {
  SourceFile,
  TypeAliasDeclaration,
  TypeLiteralNode,
  TypeNode,
} from 'ts-morph';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown, smartTruncate } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const TYPES_FILE = resolve(PROJECT_ROOT, 'src/engine/types/game-state.ts');
const OUTPUT = resolve(PROJECT_ROOT, '.claude/auto/state/game-state.md');

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

interface FieldInfo {
  name: string;
  typeText: string;
  optional: boolean;
}

interface ClassInfo {
  name: string;
  fields: FieldInfo[];
  comment?: string;
}

interface Edge {
  from: string;
  to: string;
  label: string;
}

// Mermaid classDiagram で安全に使える名前に変換
function safeMermaidName(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, '_');
}

function simplifyType(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractFields(typeLiteral: TypeLiteralNode): FieldInfo[] {
  const fields: FieldInfo[] = [];
  for (const member of typeLiteral.getMembers()) {
    if (Node.isPropertySignature(member)) {
      const typeNode = member.getTypeNode();
      fields.push({
        name: member.getName(),
        typeText: typeNode ? simplifyType(typeNode.getText()) : 'unknown',
        optional: member.hasQuestionToken(),
      });
    } else if (Node.isIndexSignatureDeclaration(member)) {
      const keyParam = member.getKeyName();
      const keyType = member.getKeyType().getText();
      const valueType = member.getReturnType().getText();
      fields.push({
        name: `[${keyParam}: ${keyType}]`,
        typeText: simplifyType(valueType),
        optional: false,
      });
    }
  }
  return fields;
}

// 型参照を辿る: TypeReferenceNode のみ抽出。Union/Intersection はテキストとして扱う。
function collectReferencedTypes(typeNode: TypeNode | undefined, sink: Set<string>): void {
  if (!typeNode) return;
  if (Node.isTypeReference(typeNode)) {
    sink.add(typeNode.getTypeName().getText());
  }
  typeNode.forEachDescendant((child) => {
    if (Node.isTypeReference(child)) {
      sink.add(child.getTypeName().getText());
    }
  });
}

function classFromTypeAlias(decl: TypeAliasDeclaration): ClassInfo | null {
  const name = decl.getName();
  const typeNode = decl.getTypeNode();
  if (!typeNode) return null;
  if (Node.isTypeLiteral(typeNode)) {
    return { name, fields: extractFields(typeNode) };
  }
  return null;
}

function findTypeAlias(sf: SourceFile, name: string): TypeAliasDeclaration | undefined {
  return sf.getTypeAlias(name);
}

const EXCLUDED_REFS = new Set([
  'string',
  'number',
  'boolean',
  'unknown',
  'any',
  'never',
  'void',
  'null',
  'undefined',
  'Record',
  'Array',
  'Map',
  'Set',
  'Date',
]);

function compactType(text: string): string {
  // 匿名 object 型 ({ a: T; b: U }) はフィールド数だけ示す
  const objMatch = text.match(/^\{(.+)\}\s*$/s);
  if (objMatch) {
    const inner = objMatch[1]!.trim();
    const fieldCount = inner.split(';').filter((s) => s.trim()).length;
    return `«object×${fieldCount}»`;
  }
  // smartTruncate でセンテンス境界 + 引用符バランスを保つ
  if (text.length > 45) return smartTruncate(text, 45);
  return text;
}

function renderClass(c: ClassInfo): string {
  const safe = safeMermaidName(c.name);
  const lines = [`  class ${safe} {`];
  for (const f of c.fields) {
    const opt = f.optional ? '?' : '';
    const safeName = f.name.replace(/[^A-Za-z0-9_\[\]:]/g, '_');
    const safeType = compactType(f.typeText).replace(/["`]/g, "'");
    lines.push(`    +${safeName}${opt}: ${safeType}`);
  }
  lines.push('  }');
  return lines.join('\n');
}

function renderMermaid(classes: ClassInfo[], edges: Edge[]): string {
  // Note: classDiagram は `direction` 行をサポートしないため指定しない (Mermaid 仕様)
  const lines = ['```mermaid', 'classDiagram'];
  for (const c of classes) {
    lines.push(renderClass(c));
  }
  for (const e of edges) {
    lines.push(`  ${safeMermaidName(e.from)} --> ${safeMermaidName(e.to)} : ${e.label}`);
  }
  lines.push('```');
  return lines.join('\n');
}

export function runGenState(options: RunOptions): RunResult {
  const project = new Project({
    tsConfigFilePath: resolve(PROJECT_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFileAtPath(TYPES_FILE);
  const sf = project.getSourceFileOrThrow(TYPES_FILE);

  // Root: GameState
  const root = sf.getTypeAliasOrThrow('GameState');
  const rootClass = classFromTypeAlias(root);
  if (!rootClass) {
    throw new Error('GameState must be a type literal');
  }

  // BFS で同ファイル内の参照型のみ展開
  const classes: ClassInfo[] = [rootClass];
  const pendingEdges: Edge[] = [];
  const seen = new Set<string>(['GameState']);
  const classNames = new Set<string>(['GameState']);
  const queue: string[] = [];

  // Collect refs via AST walk on the root type literal
  const rootTypeNode = root.getTypeNodeOrThrow() as TypeLiteralNode;
  for (const member of rootTypeNode.getMembers()) {
    if (!Node.isPropertySignature(member)) continue;
    const propName = member.getName();
    const tn = member.getTypeNode();
    if (!tn) continue;
    const refs = new Set<string>();
    collectReferencedTypes(tn, refs);
    for (const r of refs) {
      if (EXCLUDED_REFS.has(r)) continue;
      if (!seen.has(r)) {
        seen.add(r);
        queue.push(r);
      }
      pendingEdges.push({ from: 'GameState', to: r, label: propName });
    }
  }

  while (queue.length > 0) {
    const name = queue.shift()!;
    const decl = findTypeAlias(sf, name);
    if (!decl) continue;
    const cls = classFromTypeAlias(decl);
    if (!cls) continue;
    classes.push(cls);
    classNames.add(cls.name);

    const tn = decl.getTypeNodeOrThrow();
    if (Node.isTypeLiteral(tn)) {
      for (const member of tn.getMembers()) {
        if (!Node.isPropertySignature(member)) continue;
        const propName = member.getName();
        const innerTn = member.getTypeNode();
        if (!innerTn) continue;
        const refs = new Set<string>();
        collectReferencedTypes(innerTn, refs);
        for (const r of refs) {
          if (EXCLUDED_REFS.has(r)) continue;
          if (!seen.has(r)) {
            seen.add(r);
            queue.push(r);
          }
          pendingEdges.push({ from: name, to: r, label: propName });
        }
      }
    }
  }

  // クラス化できなかった型 (CardId 等の primitive alias、外部ファイル参照) へのエッジは破棄
  const edges = pendingEdges.filter((e) => classNames.has(e.to));

  const header = renderHeader({
    title: '🤖 GameState shape',
    generator: 'scripts/gen-docs/gen-state.ts',
    regenerateCmd: 'npm run docs:state',
    sourceFiles: [TYPES_FILE],
    description: '`src/engine/types/game-state.ts` から抽出した GameState の構造図。',
  });

  const mermaid = renderMermaid(classes, edges);
  const md =
    header +
    `${classes.length} 型・${edges.length} 関係を抽出。\`«object×N»\` は匿名 object 型（N フィールド）の省略表記。\n\n` +
    '## Mermaid classDiagram\n\n' +
    mermaid +
    '\n\n---\n\n## ソース\n\n- [`src/engine/types/game-state.ts`](../../../src/engine/types/game-state.ts)\n';

  const diff = diffMarkdown(OUTPUT, md);
  if (diff.changed && !options.checkOnly) {
    writeMarkdown(OUTPUT, md);
  }
  return {
    changedFiles: diff.changed ? [OUTPUT] : [],
    totalFiles: 1,
  };
}
