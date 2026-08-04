import { execFile } from "node:child_process";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { delimiter, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { transform, transformStyleAttribute, type Dependency } from "lightningcss";
import { parse } from "parse5";
import ts from "typescript";

export type RuntimeBoundaryFinding = {
  file: string;
  code: string;
  detail: string;
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css"];
const OFFICIAL_IMAGE_BASE =
  "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/";
const NON_NETWORK_REFERENCES = [
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/XML/1998/namespace",
];
const DIST_DIAGNOSTIC_REFERENCES = [
  "https://bit.ly/3cXEKWf",
  "https://react.dev/errors/",
];
const CANONICAL_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      polyfill: false,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
`;
const NODE_HELPERS = new Set([
  "src/engine/effect/validate-spec-files.ts",
  "src/engine/cards/tsv-loader-fs.ts",
]);
const BUNDLE_MARKERS: Array<[RegExp, string]> = [
  [/\bnode:(?:fs|path|url)\b/i, "node builtin"],
  [/\b(?:readFileSync|fileURLToPath)\b/, "filesystem API"],
  [/tsv-loader-fs/i, "tsv-loader-fs"],
  [/\.claude(?:\/|\\)specs(?:\/|\\)cards-data/i, "card specification path"],
];
const PRIVILEGED_BROWSER_GLOBALS = new Set([
  "document",
  "globalThis",
  "navigator",
  "self",
  "window",
]);
const VALUE_PROPAGATING_ASSIGNMENT_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);
const isValuePropagatingAssignment = (kind: ts.SyntaxKind): boolean =>
  VALUE_PROPAGATING_ASSIGNMENT_OPERATORS.has(kind);
const DOM_NODE_BROWSER_OBJECT = "@browser:dom-node";
const BROWSER_DERIVED_OBJECT = "@browser:derived";
const OBJECT_VALUE_PREFIX = "@object:";
const objectValue = (node: ts.Node): string =>
  `${OBJECT_VALUE_PREFIX}${node.pos}:${node.end}`;
const isObjectValue = (value: string): boolean =>
  value.startsWith(OBJECT_VALUE_PREFIX) ||
  value === DOM_NODE_BROWSER_OBJECT ||
  value === BROWSER_DERIVED_OBJECT;
const isBrowserObjectValue = (value: string): boolean =>
  PRIVILEGED_BROWSER_GLOBALS.has(value) ||
  value === DOM_NODE_BROWSER_OBJECT ||
  value === BROWSER_DERIVED_OBJECT;
const browserObjectProperty = (
  owner: string | undefined,
  property: string | undefined,
): string | undefined => {
  if (!owner) return undefined;
  if (["globalThis", "self", "window"].includes(owner)) {
    if (["globalThis", "self", "window", "parent", "top", "frames", "opener"].includes(
      property ?? "",
    )) {
      return "window";
    }
    if (property === "document") return "document";
    if (property === "navigator") return "navigator";
    if (property !== undefined && /^(?:0|[1-9]\d*)$/.test(property)) return "window";
    return BROWSER_DERIVED_OBJECT;
  }
  if (owner === "document") {
    if (property === "defaultView") return "window";
    if (property === "ownerDocument") return "document";
    return DOM_NODE_BROWSER_OBJECT;
  }
  if (owner === DOM_NODE_BROWSER_OBJECT) {
    if (property === "ownerDocument") return "document";
    if (property === "defaultView") return "window";
    return DOM_NODE_BROWSER_OBJECT;
  }
  if (owner === "navigator") return BROWSER_DERIVED_OBJECT;
  if (owner === BROWSER_DERIVED_OBJECT) {
    if (["globalThis", "self", "window", "parent", "top", "frames", "opener", "defaultView"]
      .includes(property ?? "")) {
      return "window";
    }
    if (["document", "ownerDocument"].includes(property ?? "")) return "document";
    if (property === "navigator") return "navigator";
    return BROWSER_DERIVED_OBJECT;
  }
  return undefined;
};
const PERSISTENT_BROWSER_PROPERTIES = new Set([
  "caches",
  "cookie",
  "cookieStore",
  "indexedDB",
  "localStorage",
  "openDatabase",
  "sessionStorage",
  "showDirectoryPicker",
  "showOpenFilePicker",
  "showSaveFilePicker",
  "storage",
]);
const NETWORK_BROWSER_PROPERTIES = new Set([
  "EventSource",
  "fetch",
  "RTCPeerConnection",
  "sendBeacon",
  "SharedWorker",
  "WebSocket",
  "WebTransport",
  "Worker",
  "XMLHttpRequest",
]);
export type BoundaryBuildCommand = {
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

type BoundaryBuildRunner = (
  command: BoundaryBuildCommand,
) => Promise<{ stdout: string; stderr: string }>;

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function existingFile(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);
}

function buildEnvironment(): NodeJS.ProcessEnv {
  const system32 = process.platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin";
  return {
    PATH: [dirname(process.execPath), system32].join(delimiter),
    SystemRoot: process.platform === "win32" ? "C:\\Windows" : undefined,
    SYSTEMROOT: process.platform === "win32" ? "C:\\Windows" : undefined,
    ComSpec: process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : undefined,
    COMSPEC: process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : undefined,
    PATHEXT: process.platform === "win32" ? ".COM;.EXE;.BAT;.CMD" : undefined,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    CI: "1",
    NODE_ENV: "production",
  };
}

async function systemBuildRunner(
  command: BoundaryBuildCommand,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((accept, reject) => {
    execFile(
      command.file,
      command.args,
      {
        cwd: command.cwd,
        env: command.env,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) reject(error);
        else accept({ stdout, stderr });
      },
    );
  });
}

export async function runCanonicalBoundaryBuild(
  repoRoot: string,
  run: BoundaryBuildRunner = systemBuildRunner,
): Promise<{ stdout: string; stderr: string }> {
  const root = resolve(repoRoot);
  const configFindings = await inspectViteConfig(root);
  if (configFindings.length > 0) {
    throw new Error(
      `private hosted boundary rejected before build: ${configFindings
        .map(({ code, detail }) => `${code}: ${detail}`)
        .join("; ")}`,
    );
  }
  const vite = resolve(root, "node_modules/vite/bin/vite.js");
  const entry = await lstat(vite).catch(() => undefined);
  if (!entry?.isFile() || entry.isSymbolicLink()) {
    throw new Error("private hosted boundary rejected: local Vite executable is missing");
  }
  return run({
    file: process.execPath,
    args: [vite, "build", "--manifest", "--config", "vite.config.ts"],
    cwd: root,
    env: buildEnvironment(),
  });
}

async function resolveImport(
  root: string,
  importer: string,
  specifier: string,
): Promise<string | undefined> {
  if (!(specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("/"))) {
    return undefined;
  }
  const base = specifier.startsWith("@/")
    ? resolve(root, "src", specifier.slice(2))
    : specifier.startsWith("/")
      ? resolve(root, specifier.slice(1))
      : resolve(dirname(importer), specifier);
  const extension = extname(base);
  const bases = extension === ".js" || extension === ".jsx"
    ? [base.slice(0, -extension.length)]
    : [base];
  const candidates = [
    ...bases,
    ...bases.flatMap((candidate) => SOURCE_EXTENSIONS.map((suffix) => `${candidate}${suffix}`)),
    ...bases.flatMap((candidate) => SOURCE_EXTENSIONS.map((suffix) => resolve(candidate, `index${suffix}`))),
  ];
  for (const candidate of candidates) {
    if (within(root, candidate) && (await existingFile(candidate))) return candidate;
  }
  return undefined;
}

function importsFrom(sourceFile: ts.SourceFile): string[] {
  const imports: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      imports.push(node.arguments[0]!.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return imports;
}

function addFinding(
  findings: RuntimeBoundaryFinding[],
  file: string,
  code: string,
  detail: string,
): void {
  if (!findings.some((item) => item.file === file && item.code === code && item.detail === detail)) {
    findings.push({ file, code, detail });
  }
}

type ProductionGraph = {
  scripts: Map<string, ts.SourceFile>;
  styles: Map<string, string>;
  data: Map<string, string>;
};

type CssSurface = "stylesheet" | "declaration-list";

type CssAnalysis = {
  dependencies: Dependency[];
  invalid: boolean;
};

function analyzeCss(source: string, filename: string, surface: CssSurface): CssAnalysis {
  try {
    const options = {
      filename,
      code: new TextEncoder().encode(source),
      errorRecovery: false,
    };
    const result = surface === "stylesheet"
      ? transform({
          ...options,
          analyzeDependencies: { preserveImports: true },
        })
      : transformStyleAttribute({
          ...options,
          analyzeDependencies: true,
        });
    return {
      dependencies: result.dependencies ? [...result.dependencies] : [],
      invalid: result.warnings.length > 0,
    };
  } catch {
    return { dependencies: [], invalid: true };
  }
}

function cssImports(source: string, filename: string): string[] {
  const analysis = analyzeCss(source, filename, "stylesheet");
  if (analysis.invalid) return [];
  return analysis.dependencies
    .filter((dependency): dependency is Extract<Dependency, { type: "import" }> =>
      dependency.type === "import"
    )
    .map((dependency) => dependency.url)
    .filter((specifier) => !/^(?:data:|https?:|\/\/)/i.test(specifier));
}

async function productionFiles(root: string): Promise<ProductionGraph> {
  const entry = resolve(root, "src/main.tsx");
  const pending = [entry];
  const scripts = new Map<string, ts.SourceFile>();
  const styles = new Map<string, string>();
  const data = new Map<string, string>();
  while (pending.length > 0) {
    const absolute = pending.pop()!;
    if (scripts.has(absolute) || styles.has(absolute) || data.has(absolute)) continue;
    const source = await readFile(absolute, "utf8");
    const extension = extname(absolute).toLowerCase();
    if (extension === ".css") {
      styles.set(absolute, source);
      for (const specifier of cssImports(source, absolute)) {
        const imported = await resolveImport(
          root,
          absolute,
          /^(?:\.|\/|@\/)/.test(specifier) ? specifier : `./${specifier}`,
        );
        if (imported && extname(imported).toLowerCase() === ".css") pending.push(imported);
      }
      continue;
    }
    if (extension === ".json") {
      data.set(absolute, source);
      continue;
    }
    const parsed = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true);
    scripts.set(absolute, parsed);
    for (const specifier of importsFrom(parsed)) {
      const imported = await resolveImport(root, absolute, specifier);
      if (
        imported &&
        (/\.[cm]?[jt]sx?$/.test(imported) || /\.(?:css|json)$/.test(imported))
      ) {
        pending.push(imported);
      }
    }
  }
  return { scripts, styles, data };
}

function staticString(
  node: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression> = new Map(),
  resolving: ReadonlySet<string> = new Set(),
): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) {
    return staticString(node.expression, constants, resolving);
  }
  if (ts.isIdentifier(node)) {
    if (resolving.has(node.text)) return undefined;
    const initializer = constants.get(node.text);
    if (!initializer) return undefined;
    return staticString(
      initializer,
      constants,
      new Set([...resolving, node.text]),
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticString(node.left, constants, resolving);
    const right = staticString(node.right, constants, resolving);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = staticString(span.expression, constants, resolving);
      if (expression === undefined) return undefined;
      value += expression + span.literal.text;
    }
    return value;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "join" &&
    ts.isArrayLiteralExpression(node.expression.expression) &&
    node.arguments.length <= 1
  ) {
    const separator = node.arguments.length === 0
      ? ","
      : staticString(node.arguments[0]!, constants, resolving);
    if (separator === undefined) return undefined;
    const values = node.expression.expression.elements.map((element) =>
      ts.isSpreadElement(element)
        ? undefined
        : staticString(element as ts.Expression, constants, resolving),
    );
    return values.some((value) => value === undefined)
      ? undefined
      : (values as string[]).join(separator);
  }
  return undefined;
}

type AliasBinding = {
  id: number;
  name: string;
  scope: ts.Node;
};

type BrowserGlobalSet = ReadonlySet<string>;
type BrowserAliasState = ReadonlyMap<AliasBinding, BrowserGlobalSet>;

type BrowserAliasAnalysis = {
  valuesBefore: ReadonlyMap<ts.Identifier, BrowserGlobalSet>;
  propertyValuesBefore: ReadonlyMap<
    ts.PropertyAccessExpression | ts.ElementAccessExpression,
    BrowserGlobalSet
  >;
  callValues: ReadonlyMap<ts.CallExpression | ts.NewExpression, BrowserGlobalSet>;
  analyzedLocalCalls: ReadonlySet<ts.CallExpression | ts.NewExpression>;
  localFunctionReturns: ReadonlySet<ts.ReturnStatement | ts.ArrowFunction>;
  resolveBinding(node: ts.Node, name: string): AliasBinding | undefined;
  isDynamicFunctionConstructor(node: ts.Expression): boolean;
  containsTrackedBrowserObject(node: ts.Expression): boolean;
  containsDeferredTrackedBrowserObject(node: ts.Expression): boolean;
  isCapturedBinding(node: ts.Node, binding: AliasBinding): boolean;
  isInertReplayEventConstructor(node: ts.CallExpression | ts.NewExpression): boolean;
  isInertEventTargetAssignment(node: ts.BinaryExpression): boolean;
};

function isRuntimeValueIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if (
    (ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isPropertySignature(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  return true;
}

function isUnboundRuntimeIdentifier(
  node: ts.Identifier,
  analysis: BrowserAliasAnalysis,
): boolean {
  return isRuntimeValueIdentifier(node) &&
    analysis.resolveBinding(node, node.text) === undefined;
}

function privilegedBrowserGlobal(
  node: ts.Expression,
  analysis: BrowserAliasAnalysis,
): string | undefined {
  const browserObject = (expression: ts.Expression): string | undefined => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return browserObject(expression.expression);
    }
    if (ts.isAwaitExpression(expression)) return browserObject(expression.expression);
    if (ts.isCallExpression(expression)) {
      const returned = analysis.callValues.get(expression);
      const tracked = returned
        ? [...returned].find(isBrowserObjectValue)
        : undefined;
      if (tracked) return tracked;
      if (
        ts.isPropertyAccessExpression(expression.expression) ||
        ts.isElementAccessExpression(expression.expression)
      ) {
        const owner = browserObject(expression.expression.expression);
        if (owner === "document" || owner === DOM_NODE_BROWSER_OBJECT) {
          return DOM_NODE_BROWSER_OBJECT;
        }
        if (owner && isBrowserObjectValue(owner)) return BROWSER_DERIVED_OBJECT;
      }
      return undefined;
    }
    if (ts.isNewExpression(expression)) {
      const returned = analysis.callValues.get(expression);
      return returned
        ? [...returned].find(isBrowserObjectValue)
        : undefined;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const tracked = analysis.propertyValuesBefore.get(expression);
      const trackedGlobal = tracked
        ? [...tracked].find(isBrowserObjectValue)
        : undefined;
      if (trackedGlobal) return trackedGlobal;
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? staticString(expression.argumentExpression)
          : undefined;
      return browserObjectProperty(browserObject(expression.expression), property);
    }
    if (ts.isConditionalExpression(expression)) {
      return browserObject(expression.whenTrue) ?? browserObject(expression.whenFalse);
    }
    if (
      ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.CommaToken,
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(expression.operatorToken.kind)
    ) {
      return expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
          isValuePropagatingAssignment(expression.operatorToken.kind)
        ? browserObject(expression.right)
        : browserObject(expression.left) ?? browserObject(expression.right);
    }
    if (!ts.isIdentifier(expression)) return undefined;
    const binding = analysis.resolveBinding(expression, expression.text);
    if (binding) {
      return [...(analysis.valuesBefore.get(expression) ?? [])]
        .find((value) => PRIVILEGED_BROWSER_GLOBALS.has(value));
    }
    return PRIVILEGED_BROWSER_GLOBALS.has(expression.text) ? expression.text : undefined;
  };
  const value = browserObject(node);
  return value && PRIVILEGED_BROWSER_GLOBALS.has(value) ? value : undefined;
}

function directBrowserGlobal(
  node: ts.Expression,
  analysis: BrowserAliasAnalysis,
): string | undefined {
  const browserObject = (expression: ts.Expression): string | undefined => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return browserObject(expression.expression);
    }
    if (ts.isCallExpression(expression)) {
      if (
        ts.isPropertyAccessExpression(expression.expression) ||
        ts.isElementAccessExpression(expression.expression)
      ) {
        const owner = browserObject(expression.expression.expression);
        if (owner === "document" || owner === DOM_NODE_BROWSER_OBJECT) {
          return DOM_NODE_BROWSER_OBJECT;
        }
        if (owner && isBrowserObjectValue(owner)) return BROWSER_DERIVED_OBJECT;
      }
      return undefined;
    }
    if (ts.isConditionalExpression(expression)) {
      return browserObject(expression.whenTrue) ?? browserObject(expression.whenFalse);
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? staticString(expression.argumentExpression)
          : undefined;
      return browserObjectProperty(browserObject(expression.expression), property);
    }
    if (
      ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.CommaToken,
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(expression.operatorToken.kind)
    ) {
      return expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
          isValuePropagatingAssignment(expression.operatorToken.kind)
        ? browserObject(expression.right)
        : browserObject(expression.left) ?? browserObject(expression.right);
    }
    if (!ts.isIdentifier(expression) || analysis.resolveBinding(expression, expression.text)) {
      return undefined;
    }
    return PRIVILEGED_BROWSER_GLOBALS.has(expression.text) ? expression.text : undefined;
  };
  const value = browserObject(node);
  return value && PRIVILEGED_BROWSER_GLOBALS.has(value) ? value : undefined;
}

function isDynamicCodeExecution(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
  allowInertReplayEventConstructor = false,
): boolean {
  if (
    (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
    analysis.isDynamicFunctionConstructor(node.expression) &&
    !(allowInertReplayEventConstructor && analysis.isInertReplayEventConstructor(node))
  ) {
    return true;
  }
  if (
    ts.isIdentifier(node) &&
    ["eval", "Function"].includes(node.text) &&
    isUnboundRuntimeIdentifier(node, analysis)
  ) {
    if (node.text === "Function") {
      const properties: string[] = [];
      let current: ts.Expression = node;
      while (
        (ts.isPropertyAccessExpression(current.parent) ||
          ts.isElementAccessExpression(current.parent)) &&
        current.parent.expression === current
      ) {
        const parent = current.parent;
        const property = ts.isPropertyAccessExpression(parent)
          ? parent.name.text
          : parent.argumentExpression
            ? staticString(parent.argumentExpression)
            : undefined;
        if (property === undefined) break;
        properties.push(property);
        current = parent;
      }
      if (
        properties[0] === "toString" &&
        properties.slice(1).every((property) => ["apply", "call"].includes(property)) &&
        ts.isCallExpression(current.parent) &&
        current.parent.expression === current
      ) {
        return false;
      }
    }
    return true;
  }
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
    return false;
  }
  const property = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : node.argumentExpression
      ? staticString(node.argumentExpression)
      : undefined;
  return ["eval", "Function"].includes(property ?? "") &&
    privilegedBrowserGlobal(node.expression, analysis) !== undefined;
}

function isLexicalScope(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isFunctionLike(node) ||
    ts.isCatchClause(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isSwitchStatement(node)
  );
}

function collectPrivilegedBrowserAliases(root: ts.Node): BrowserAliasAnalysis {
  const scopes = new Map<ts.Node, Map<string, AliasBinding>>();
  let nextBindingId = 1;
  const nearestScope = (node: ts.Node | undefined): ts.Node => {
    let current = node;
    while (current && !isLexicalScope(current)) current = current.parent;
    return current ?? root;
  };
  const nearestFunctionScope = (node: ts.Node | undefined): ts.Node => {
    let current = node;
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
      current = current.parent;
    }
    return current ?? root;
  };
  const declare = (scope: ts.Node, name: string): AliasBinding => {
    let bindings = scopes.get(scope);
    if (!bindings) {
      bindings = new Map();
      scopes.set(scope, bindings);
    }
    const existing = bindings.get(name);
    if (existing) return existing;
    const binding = { id: nextBindingId++, name, scope };
    bindings.set(name, binding);
    return binding;
  };
  const declareName = (name: ts.BindingName, scope: ts.Node): void => {
    if (ts.isIdentifier(name)) {
      declare(scope, name.text);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declareName(element.name, scope);
    }
  };
  function collectDeclarations(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      const list = ts.isVariableDeclarationList(node.parent) ? node.parent : undefined;
      const scope = list && (list.flags & ts.NodeFlags.BlockScoped) === 0
        ? nearestFunctionScope(node.parent)
        : nearestScope(node.parent);
      declareName(node.name, scope);
    } else if (ts.isParameter(node)) {
      declareName(node.name, nearestFunctionScope(node.parent));
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      declareName(node.variableDeclaration.name, node);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      declare(nearestScope(node.parent), node.name.text);
    } else if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name
    ) {
      declare(node, node.name.text);
    } else if (ts.isImportClause(node) && node.name) {
      declare(nearestScope(node), node.name.text);
    } else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
      declare(nearestScope(node), node.name.text);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(root);
  const resolveBinding = (node: ts.Node, name: string): AliasBinding | undefined => {
    let current: ts.Node | undefined = node;
    while (current) {
      if (isLexicalScope(current)) {
        const binding = scopes.get(current)?.get(name);
        if (binding) return binding;
      }
      current = current.parent;
    }
    return undefined;
  };
  const relations: Array<{ target: AliasBinding; source: ts.Expression }> = [];
  function collectRelations(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const target = resolveBinding(node.name, node.name.text);
      if (target) relations.push({ target, source: node.initializer });
    } else if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const target = resolveBinding(node.name, node.name.text);
      if (target) relations.push({ target, source: node.initializer });
    } else if (
      ts.isBinaryExpression(node) &&
      isValuePropagatingAssignment(node.operatorToken.kind) &&
      ts.isIdentifier(node.left)
    ) {
      const target = resolveBinding(node.left, node.left.text);
      if (target) relations.push({ target, source: node.right });
    }
    ts.forEachChild(node, collectRelations);
  }
  collectRelations(root);
  const relationsByTarget = new Map<AliasBinding, Array<{ target: AliasBinding; source: ts.Expression }>>();
  for (const relation of relations) {
    const entries = relationsByTarget.get(relation.target) ?? [];
    entries.push(relation);
    relationsByTarget.set(relation.target, entries);
  }

  const localFunctions = new Map<AliasBinding, Set<ts.FunctionLikeDeclaration>>();
  const addLocalFunction = (
    binding: AliasBinding,
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    let implementations = localFunctions.get(binding);
    if (!implementations) {
      implementations = new Set();
      localFunctions.set(binding, implementations);
    }
    const previousSize = implementations.size;
    implementations.add(implementation);
    return implementations.size !== previousSize;
  };
  function collectLocalFunctions(node: ts.Node): void {
    let name: ts.Identifier | undefined;
    let implementation: ts.FunctionLikeDeclaration | undefined;
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      name = node.name;
      implementation = node;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isFunctionExpression(node.initializer) || ts.isArrowFunction(node.initializer))
    ) {
      name = node.name;
      implementation = node.initializer;
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      (ts.isFunctionExpression(node.right) || ts.isArrowFunction(node.right))
    ) {
      name = node.left;
      implementation = node.right;
    }
    if (name && implementation) {
      const binding = ts.isFunctionDeclaration(node)
        ? resolveBinding(node.parent, name.text)
        : resolveBinding(name, name.text);
      if (binding) addLocalFunction(binding, implementation);
    }
    ts.forEachChild(node, collectLocalFunctions);
  }
  collectLocalFunctions(root);
  const localClassBindings = new Set<AliasBinding>();
  function collectLocalClasses(node: ts.Node): void {
    if (ts.isClassDeclaration(node) && node.name) {
      const binding = resolveBinding(node.parent, node.name.text);
      if (binding) localClassBindings.add(binding);
    }
    ts.forEachChild(node, collectLocalClasses);
  }
  collectLocalClasses(root);
  const returnsByFunction = new Map<ts.FunctionLikeDeclaration, ts.Expression[]>();
  const collectFunctionReturns = (implementation: ts.FunctionLikeDeclaration): void => {
    if (returnsByFunction.has(implementation)) return;
    const returns: ts.Expression[] = [];
    const collectReturns = (node: ts.Node): void => {
      if (node !== implementation && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
      ts.forEachChild(node, collectReturns);
    };
    if (implementation.body) {
      if (ts.isBlock(implementation.body)) collectReturns(implementation.body);
      else returns.push(implementation.body);
    }
    returnsByFunction.set(implementation, returns);
  };
  for (const implementations of localFunctions.values()) {
    for (const implementation of implementations) collectFunctionReturns(implementation);
  }
  const callableReturns = new Map<ts.FunctionLikeDeclaration, Set<ts.FunctionLikeDeclaration>>();
  const callableValue = (node: ts.Expression): Set<ts.FunctionLikeDeclaration> => {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return callableValue(node.expression);
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      collectFunctionReturns(node);
      return new Set([node]);
    }
    if (ts.isConditionalExpression(node)) {
      return new Set([...callableValue(node.whenTrue), ...callableValue(node.whenFalse)]);
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      return new Set([...callableValue(node.left), ...callableValue(node.right)]);
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    ) {
      return callableValue(node.right);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = resolveBinding(node.expression, node.expression.text);
      const implementations = binding ? localFunctions.get(binding) : undefined;
      return new Set(
        [...(implementations ?? [])].flatMap((implementation) => [
          ...(callableReturns.get(implementation) ?? []),
        ]),
      );
    }
    if (!ts.isIdentifier(node)) return new Set();
    const binding = resolveBinding(node, node.text);
    return new Set(binding ? localFunctions.get(binding) ?? [] : []);
  };
  for (;;) {
    let changed = false;
    for (const [implementation, returns] of returnsByFunction) {
      let values = callableReturns.get(implementation);
      if (!values) {
        values = new Set();
        callableReturns.set(implementation, values);
      }
      const previousSize = values.size;
      for (const returned of returns) {
        for (const value of callableValue(returned)) values.add(value);
      }
      changed ||= values.size !== previousSize;
    }
    for (const relation of relations) {
      for (const implementation of callableValue(relation.source)) {
        changed = addLocalFunction(relation.target, implementation) || changed;
      }
    }
    if (!changed) break;
  }

  const objectAliasParents = new Map<AliasBinding, AliasBinding>();
  const canonicalObjectBinding = (binding: AliasBinding): AliasBinding => {
    const parent = objectAliasParents.get(binding);
    if (!parent) {
      objectAliasParents.set(binding, binding);
      return binding;
    }
    if (parent === binding) return binding;
    const canonical = canonicalObjectBinding(parent);
    objectAliasParents.set(binding, canonical);
    return canonical;
  };
  const unionObjectBindings = (left: AliasBinding, right: AliasBinding): void => {
    const a = canonicalObjectBinding(left);
    const b = canonicalObjectBinding(right);
    if (a === b) return;
    const [canonical, alias] = a.id < b.id ? [a, b] : [b, a];
    objectAliasParents.set(alias, canonical);
  };
  const identifierBinding = (expression: ts.Expression): AliasBinding | undefined => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isAwaitExpression(current)
    ) {
      current = current.expression;
    }
    return ts.isIdentifier(current)
      ? resolveBinding(current, current.text)
      : undefined;
  };
  for (const relation of relations) {
    const source = identifierBinding(relation.source);
    if (source) unionObjectBindings(relation.target, source);
  }

  const scopedStaticString = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): string | undefined => {
    const direct = staticString(expression);
    if (direct !== undefined) return direct;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return scopedStaticString(expression.expression, resolving);
    }
    if (ts.isConditionalExpression(expression)) {
      const values = new Set([
        scopedStaticString(expression.whenTrue, resolving),
        scopedStaticString(expression.whenFalse, resolving),
      ]);
      return values.size === 1 ? [...values][0] : undefined;
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    ) {
      return scopedStaticString(expression.right, resolving);
    }
    if (!ts.isIdentifier(expression)) return undefined;
    const binding = resolveBinding(expression, expression.text);
    if (!binding || resolving.has(binding)) return undefined;
    const values = new Set(
      (relationsByTarget.get(binding) ?? [])
        .map((relation) =>
          scopedStaticString(relation.source, new Set([...resolving, binding]))
        ),
    );
    return values.size === 1 ? [...values][0] : undefined;
  };

  const assignedPropertyName = (expression: ts.Expression): string | undefined => {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
      return scopedStaticString(expression.argumentExpression);
    }
    return undefined;
  };
  const assignedReceiver = (expression: ts.Expression): ts.Expression | undefined =>
    ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
      ? expression.expression
      : undefined;
  const syntheticEventFields = new Set([
    "_reactName",
    "_targetInst",
    "currentTarget",
    "nativeEvent",
    "target",
    "type",
  ]);
  const syntheticEventImplementations = new Set<ts.FunctionLikeDeclaration>();
  for (const implementation of returnsByFunction.keys()) {
    if (implementation.parameters.length < 5 || !implementation.body) continue;
    const fields = new Set<string>();
    const collectThisAssignments = (node: ts.Node): void => {
      if (node !== implementation && ts.isFunctionLike(node)) return;
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const receiver = assignedReceiver(node.left);
        if (receiver?.kind === ts.SyntaxKind.ThisKeyword) {
          const property = assignedPropertyName(node.left);
          if (property) fields.add(property);
        }
      }
      ts.forEachChild(node, collectThisAssignments);
    };
    collectThisAssignments(implementation);
    if ([...syntheticEventFields].every((field) => fields.has(field))) {
      syntheticEventImplementations.add(implementation);
    }
  }
  const syntheticEventObjects = new Set<AliasBinding>();
  const createsSyntheticEvent = (expression: ts.Expression): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return createsSyntheticEvent(expression.expression);
    }
    if (!ts.isNewExpression(expression) || !ts.isIdentifier(expression.expression)) {
      return false;
    }
    const binding = resolveBinding(expression.expression, expression.expression.text);
    return [...(binding ? localFunctions.get(binding) ?? [] : [])]
      .some((implementation) => syntheticEventImplementations.has(implementation));
  };
  for (;;) {
    let changed = false;
    for (const relation of relations) {
      const sourceBinding = ts.isIdentifier(relation.source)
        ? resolveBinding(relation.source, relation.source.text)
        : undefined;
      if (
        createsSyntheticEvent(relation.source) ||
        (sourceBinding !== undefined &&
          syntheticEventObjects.has(canonicalObjectBinding(sourceBinding)))
      ) {
        const previousSize = syntheticEventObjects.size;
        syntheticEventObjects.add(canonicalObjectBinding(relation.target));
        changed ||= syntheticEventObjects.size !== previousSize;
      }
    }
    if (!changed) break;
  }
  const replayEventParameters = new Set<AliasBinding>();
  const requiredReplayFields = new Set(["blockedOn", "nativeEvent", "targetContainers"]);
  const collectReplayEventParameters = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) {
      const implementation = node as ts.FunctionLikeDeclaration;
      if (!implementation.body) {
        ts.forEachChild(node, collectReplayEventParameters);
        return;
      }
      const parameterFields = new Map<AliasBinding, Set<string>>();
      for (const parameter of implementation.parameters) {
        if (!ts.isIdentifier(parameter.name)) continue;
        const binding = resolveBinding(parameter.name, parameter.name.text);
        if (!binding) continue;
        parameterFields.set(binding, new Set());
      }
      const collectFields = (child: ts.Node): void => {
        if (child !== implementation.body && ts.isFunctionLike(child)) return;
        if (
          (ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child)) &&
          ts.isIdentifier(child.expression)
        ) {
          const binding = resolveBinding(child.expression, child.expression.text);
          const fields = binding ? parameterFields.get(binding) : undefined;
          const property = ts.isPropertyAccessExpression(child)
            ? child.name.text
            : child.argumentExpression
              ? scopedStaticString(child.argumentExpression)
              : undefined;
          if (fields && property) fields.add(property);
        }
        ts.forEachChild(child, collectFields);
      };
      collectFields(implementation.body);
      for (const [binding, fields] of parameterFields) {
        if ([...requiredReplayFields].every((field) => fields.has(field))) {
          replayEventParameters.add(binding);
        }
      }
    }
    ts.forEachChild(node, collectReplayEventParameters);
  };
  collectReplayEventParameters(root);
  const isInertReplayEventConstructor = (
    node: ts.CallExpression | ts.NewExpression,
  ): boolean => {
    if (
      !ts.isNewExpression(node) ||
      node.arguments?.length !== 2 ||
      (!ts.isPropertyAccessExpression(node.expression) &&
        !ts.isElementAccessExpression(node.expression))
    ) {
      return false;
    }
    const constructorProperty = ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : node.expression.argumentExpression
        ? scopedStaticString(node.expression.argumentExpression)
        : undefined;
    if (constructorProperty !== "constructor" || !ts.isIdentifier(node.expression.expression)) {
      return false;
    }
    const receiver = node.expression.expression;
    const receiverBinding = resolveBinding(receiver, receiver.text);
    const [typeArgument, eventArgument] = node.arguments;
    if (
      !receiverBinding ||
      !typeArgument ||
      ts.isSpreadElement(typeArgument) ||
      !eventArgument ||
      ts.isSpreadElement(eventArgument) ||
      !ts.isIdentifier(eventArgument) ||
      resolveBinding(eventArgument, eventArgument.text) !== receiverBinding ||
      (!ts.isPropertyAccessExpression(typeArgument) &&
        !ts.isElementAccessExpression(typeArgument)) ||
      !ts.isIdentifier(typeArgument.expression) ||
      resolveBinding(typeArgument.expression, typeArgument.expression.text) !== receiverBinding
    ) {
      return false;
    }
    const typeProperty = ts.isPropertyAccessExpression(typeArgument)
      ? typeArgument.name.text
      : typeArgument.argumentExpression
        ? scopedStaticString(typeArgument.argumentExpression)
        : undefined;
    if (typeProperty !== "type") return false;
    let implementation: ts.FunctionLikeDeclaration | undefined;
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isFunctionLike(current)) {
        implementation = current as ts.FunctionLikeDeclaration;
        break;
      }
      current = current.parent;
    }
    if (!implementation?.body) return false;
    let dispatchesClonedEvent = false;
    let shiftsTargetContainer = false;
    let writesBlockedOn = false;
    const inspectReplayImplementation = (child: ts.Node): void => {
      if (child !== implementation!.body && ts.isFunctionLike(child)) return;
      if (ts.isCallExpression(child)) {
        const calleeProperty = assignedPropertyName(child.expression);
        dispatchesClonedEvent ||= calleeProperty === "dispatchEvent";
        shiftsTargetContainer ||= calleeProperty === "shift";
      }
      if (
        ts.isBinaryExpression(child) &&
        isValuePropagatingAssignment(child.operatorToken.kind) &&
        assignedPropertyName(child.left) === "blockedOn"
      ) {
        writesBlockedOn = true;
      }
      ts.forEachChild(child, inspectReplayImplementation);
    };
    inspectReplayImplementation(implementation.body);
    if (!dispatchesClonedEvent || !shiftsTargetContainer || !writesBlockedOn) return false;
    return (relationsByTarget.get(receiverBinding) ?? []).some((relation) => {
      if (
        !ts.isPropertyAccessExpression(relation.source) &&
        !ts.isElementAccessExpression(relation.source)
      ) {
        return false;
      }
      const property = ts.isPropertyAccessExpression(relation.source)
        ? relation.source.name.text
        : relation.source.argumentExpression
          ? scopedStaticString(relation.source.argumentExpression)
          : undefined;
      if (property !== "nativeEvent" || !ts.isIdentifier(relation.source.expression)) {
        return false;
      }
      const eventBinding = resolveBinding(
        relation.source.expression,
        relation.source.expression.text,
      );
      return eventBinding !== undefined && replayEventParameters.has(eventBinding);
    });
  };
  const isInertEventTargetAssignment = (node: ts.BinaryExpression): boolean => {
    if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
    const property = assignedPropertyName(node.left) ?? "";
    const receiver = assignedReceiver(node.left);
    if (!receiver) return false;
    if (property === "blockedOn" && ts.isIdentifier(receiver)) {
      const binding = resolveBinding(receiver, receiver.text);
      return binding !== undefined && replayEventParameters.has(binding);
    }
    if (!["nativeEventTarget", "relatedTarget", "target"].includes(property)) return false;
    if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isFunctionLike(current)) current = current.parent;
      return current !== undefined &&
        syntheticEventImplementations.has(current as ts.FunctionLikeDeclaration);
    }
    if (!ts.isIdentifier(receiver)) return false;
    const binding = resolveBinding(receiver, receiver.text);
    return binding !== undefined &&
      syntheticEventObjects.has(canonicalObjectBinding(binding));
  };

  const emptyGlobals: BrowserGlobalSet = new Set<string>();
  const unionGlobals = (...sets: BrowserGlobalSet[]): BrowserGlobalSet => {
    const result = new Set<string>();
    for (const values of sets) {
      for (const value of values) result.add(value);
    }
    return result;
  };
  const possibleAliases = new Map<AliasBinding, BrowserGlobalSet>();
  const possibleFunctionReturns = new Map<ts.FunctionLikeDeclaration, BrowserGlobalSet>();
  const returnedArgumentIndexes = new Map<ts.FunctionLikeDeclaration, ReadonlySet<number>>();
  const returnedParameters = (
    implementation: ts.FunctionLikeDeclaration,
    expression: ts.Expression,
  ): ReadonlySet<number> => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return returnedParameters(implementation, expression.expression);
    }
    if (ts.isConditionalExpression(expression)) {
      return new Set([
        ...returnedParameters(implementation, expression.whenTrue),
        ...returnedParameters(implementation, expression.whenFalse),
      ]);
    }
    if (
      ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(expression.operatorToken.kind)
    ) {
      return new Set([
        ...returnedParameters(implementation, expression.left),
        ...returnedParameters(implementation, expression.right),
      ]);
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    ) {
      return returnedParameters(implementation, expression.right);
    }
    if (!ts.isIdentifier(expression)) return new Set();
    const returned = resolveBinding(expression, expression.text);
    const index = implementation.parameters.findIndex((parameter) =>
      ts.isIdentifier(parameter.name) &&
      resolveBinding(parameter.name, parameter.name.text) === returned
    );
    return index >= 0 ? new Set([index]) : new Set();
  };
  const ensureReturnedArgumentIndexes = (
    implementation: ts.FunctionLikeDeclaration,
  ): ReadonlySet<number> => {
    collectFunctionReturns(implementation);
    const existing = returnedArgumentIndexes.get(implementation);
    if (existing) return existing;
    const indexes = new Set(
      (returnsByFunction.get(implementation) ?? [])
        .flatMap((returned) => [...returnedParameters(implementation, returned)]),
    );
    returnedArgumentIndexes.set(implementation, indexes);
    return indexes;
  };
  for (const implementation of returnsByFunction.keys()) {
    ensureReturnedArgumentIndexes(implementation);
  }
  const scopedPropertyName = (name: ts.PropertyName): string | undefined => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    return ts.isComputedPropertyName(name) ? scopedStaticString(name.expression) : undefined;
  };
  const callImplementations = (
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): Set<ts.FunctionLikeDeclaration> => {
    if (resolvingNodes.has(expression)) return new Set();
    const nextNodes = new Set(resolvingNodes).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return callImplementations(expression.expression, resolvingBindings, nextNodes);
    }
    if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
      ensureReturnedArgumentIndexes(expression);
      return new Set([expression]);
    }
    if (ts.isConditionalExpression(expression)) {
      return new Set([
        ...callImplementations(expression.whenTrue, resolvingBindings, nextNodes),
        ...callImplementations(expression.whenFalse, resolvingBindings, nextNodes),
      ]);
    }
    if (
      ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(expression.operatorToken.kind)
    ) {
      return new Set([
        ...callImplementations(expression.left, resolvingBindings, nextNodes),
        ...callImplementations(expression.right, resolvingBindings, nextNodes),
      ]);
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    ) {
      return callImplementations(expression.right, resolvingBindings, nextNodes);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding || resolvingBindings.has(binding)) return new Set();
      const nextBindings = new Set(resolvingBindings).add(binding);
      const implementations = new Set(localFunctions.get(binding) ?? []);
      for (const relation of relationsByTarget.get(binding) ?? []) {
        for (const implementation of callImplementations(
          relation.source,
          nextBindings,
          nextNodes,
        )) {
          implementations.add(implementation);
        }
      }
      return implementations;
    }
    if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
      return new Set();
    }
    const property = ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : expression.argumentExpression
        ? scopedStaticString(expression.argumentExpression)
        : undefined;
    if (property === undefined) return new Set();
    const objectSources = (
      owner: ts.Expression,
      seenBindings: ReadonlySet<AliasBinding>,
      seenNodes: ReadonlySet<ts.Node>,
    ): ts.ObjectLiteralExpression[] => {
      const sources = new Set<ts.ObjectLiteralExpression>();
      const visitedBindings = new Set(seenBindings);
      const visitedNodes = new Set(seenNodes);
      const visitOwner = (current: ts.Expression): void => {
        if (visitedNodes.has(current)) return;
        visitedNodes.add(current);
        if (
          ts.isParenthesizedExpression(current) ||
          ts.isAsExpression(current) ||
          ts.isTypeAssertionExpression(current) ||
          ts.isNonNullExpression(current) ||
          ts.isSatisfiesExpression(current) ||
          ts.isAwaitExpression(current)
        ) {
          visitOwner(current.expression);
          return;
        }
        if (ts.isObjectLiteralExpression(current)) {
          sources.add(current);
          return;
        }
        if (ts.isConditionalExpression(current)) {
          visitOwner(current.whenTrue);
          visitOwner(current.whenFalse);
          return;
        }
        if (
          ts.isBinaryExpression(current) &&
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(current.operatorToken.kind)
        ) {
          visitOwner(current.left);
          visitOwner(current.right);
          return;
        }
        if (
          ts.isBinaryExpression(current) &&
          (current.operatorToken.kind === ts.SyntaxKind.CommaToken ||
            current.operatorToken.kind === ts.SyntaxKind.EqualsToken)
        ) {
          visitOwner(current.right);
          return;
        }
        if (!ts.isIdentifier(current)) return;
        const binding = resolveBinding(current, current.text);
        if (!binding || visitedBindings.has(binding)) return;
        visitedBindings.add(binding);
        for (const relation of relationsByTarget.get(binding) ?? []) {
          visitOwner(relation.source);
        }
      };
      visitOwner(owner);
      return [...sources];
    };
    const implementations = new Set<ts.FunctionLikeDeclaration>();
    for (const object of objectSources(expression.expression, resolvingBindings, nextNodes)) {
      for (const member of object.properties) {
        if (ts.isSpreadAssignment(member)) {
          const spreadAccess = ts.factory.createPropertyAccessExpression(member.expression, property);
          for (const implementation of callImplementations(
            spreadAccess,
            resolvingBindings,
            nextNodes,
          )) {
            implementations.add(implementation);
          }
          continue;
        }
        if (scopedPropertyName(member.name) !== property) continue;
        if (ts.isPropertyAssignment(member)) {
          for (const implementation of callImplementations(
            member.initializer,
            resolvingBindings,
            nextNodes,
          )) {
            implementations.add(implementation);
          }
        } else if (ts.isShorthandPropertyAssignment(member)) {
          for (const implementation of callImplementations(
            member.name,
            resolvingBindings,
            nextNodes,
          )) {
            implementations.add(implementation);
          }
        } else if (ts.isMethodDeclaration(member)) {
          ensureReturnedArgumentIndexes(member);
          implementations.add(member);
        } else if (ts.isGetAccessorDeclaration(member)) {
          collectFunctionReturns(member);
          for (const returned of returnsByFunction.get(member) ?? []) {
            for (const implementation of callImplementations(
              returned,
              resolvingBindings,
              nextNodes,
            )) {
              implementations.add(implementation);
            }
          }
        }
      }
    }
    return implementations;
  };
  type DynamicConstructorSelection = {
    container: ts.Expression;
    property: string | undefined;
  };
  const dynamicSelectionsByBinding = new Map<
    AliasBinding,
    DynamicConstructorSelection[]
  >();
  const directDynamicConstructorBindings = new Set<AliasBinding>();
  const dynamicPropertyWrites = new Map<string, ts.Expression[]>();
  const dynamicExpressionWrites: Array<{
    target: ts.PropertyAccessExpression | ts.ElementAccessExpression;
    source?: ts.Expression;
    selection?: DynamicConstructorSelection;
    direct: boolean;
  }> = [];
  const dynamicPropertyKey = (binding: AliasBinding, property: string | undefined): string =>
    `${binding.id}:${property ?? "*"}`;
  const bindingIdentifiers = (name: ts.BindingName): ts.Identifier[] => {
    if (ts.isIdentifier(name)) return [name];
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : bindingIdentifiers(element.name)
    );
  };
  const addDynamicSelection = (
    name: ts.BindingName,
    selection: DynamicConstructorSelection,
  ): void => {
    for (const identifier of bindingIdentifiers(name)) {
      const binding = resolveBinding(identifier, identifier.text);
      if (!binding) continue;
      const selections = dynamicSelectionsByBinding.get(binding) ?? [];
      selections.push(selection);
      dynamicSelectionsByBinding.set(binding, selections);
    }
  };
  const addDynamicAssignmentSelection = (
    target: ts.Expression,
    selection: DynamicConstructorSelection,
    direct: boolean,
  ): void => {
    if (ts.isParenthesizedExpression(target)) {
      addDynamicAssignmentSelection(target.expression, selection, direct);
      return;
    }
    if (ts.isIdentifier(target)) {
      const binding = resolveBinding(target, target.text);
      if (!binding) return;
      if (direct) {
        directDynamicConstructorBindings.add(binding);
        return;
      }
      const selections = dynamicSelectionsByBinding.get(binding) ?? [];
      selections.push(selection);
      dynamicSelectionsByBinding.set(binding, selections);
      return;
    }
    if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
      dynamicExpressionWrites.push({ target, selection, direct });
      return;
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const member of target.properties) {
        if (ts.isPropertyAssignment(member)) {
          addDynamicAssignmentSelection(member.initializer, selection, direct);
        } else if (ts.isShorthandPropertyAssignment(member)) {
          addDynamicAssignmentSelection(member.name, selection, direct);
        } else if (ts.isSpreadAssignment(member)) {
          addDynamicAssignmentSelection(member.expression, selection, direct);
        }
      }
      return;
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (const element of target.elements) {
        if (ts.isOmittedExpression(element)) continue;
        addDynamicAssignmentSelection(
          ts.isSpreadElement(element) ? element.expression : element,
          selection,
          direct,
        );
      }
    }
  };
  const collectDynamicAssignmentSelections = (
    target: ts.ObjectLiteralExpression | ts.ArrayLiteralExpression,
    initializer: ts.Expression,
  ): void => {
    if (ts.isObjectLiteralExpression(target)) {
      for (const member of target.properties) {
        if (ts.isSpreadAssignment(member)) {
          addDynamicAssignmentSelection(
            member.expression,
            { container: initializer, property: undefined },
            false,
          );
          continue;
        }
        const propertyNode = member.name;
        const property = ts.isComputedPropertyName(propertyNode)
          ? scopedStaticString(propertyNode.expression)
          : scopedPropertyName(propertyNode);
        const destination = ts.isPropertyAssignment(member)
          ? member.initializer
          : ts.isShorthandPropertyAssignment(member)
            ? member.name
            : undefined;
        if (destination) {
          if (ts.isObjectLiteralExpression(destination) || ts.isArrayLiteralExpression(destination)) {
            collectDynamicAssignmentSelections(destination, initializer);
          }
          addDynamicAssignmentSelection(
            destination,
            { container: initializer, property },
            property === "constructor",
          );
        }
      }
      return;
    }
    for (const [index, element] of target.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      const destination = ts.isSpreadElement(element) ? element.expression : element;
      if (ts.isObjectLiteralExpression(destination) || ts.isArrayLiteralExpression(destination)) {
        collectDynamicAssignmentSelections(destination, initializer);
      }
      addDynamicAssignmentSelection(
        destination,
        {
          container: initializer,
          property: ts.isSpreadElement(element) ? undefined : String(index),
        },
        false,
      );
    }
  };
  const markDynamicBindingName = (name: ts.BindingName): void => {
    for (const identifier of bindingIdentifiers(name)) {
      const binding = resolveBinding(identifier, identifier.text);
      if (binding) directDynamicConstructorBindings.add(binding);
    }
  };
  const markConstructorBindingsInPattern = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) return;
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const propertyNode = element.propertyName ??
          (ts.isIdentifier(element.name) ? element.name : undefined);
        const property = propertyNode
          ? ts.isComputedPropertyName(propertyNode)
            ? scopedStaticString(propertyNode.expression)
            : scopedPropertyName(propertyNode)
          : undefined;
        if (property === "constructor") markDynamicBindingName(element.name);
        else markConstructorBindingsInPattern(element.name);
      }
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) markConstructorBindingsInPattern(element.name);
    }
  };
  const collectDynamicBindingSelections = (
    name: ts.BindingName,
    initializer: ts.Expression,
  ): void => {
    markConstructorBindingsInPattern(name);
    if (ts.isIdentifier(name)) return;
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const propertyNode = element.propertyName ??
          (ts.isIdentifier(element.name) ? element.name : undefined);
        const property = propertyNode
          ? ts.isComputedPropertyName(propertyNode)
            ? scopedStaticString(propertyNode.expression)
            : scopedPropertyName(propertyNode)
          : undefined;
        if (property === "constructor") markDynamicBindingName(element.name);
        else addDynamicSelection(element.name, { container: initializer, property });
      }
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (!ts.isOmittedExpression(element)) {
        addDynamicSelection(element.name, {
          container: initializer,
          property: element.dotDotDotToken ? undefined : String(index),
        });
      }
    }
  };
  const collectDynamicConstructorFlows = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      collectDynamicBindingSelections(node.name, node.initializer);
    }
    if (ts.isParameter(node)) markConstructorBindingsInPattern(node.name);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const target = ts.isParenthesizedExpression(node.left)
        ? node.left.expression
        : node.left;
      if (ts.isObjectLiteralExpression(target) || ts.isArrayLiteralExpression(target)) {
        collectDynamicAssignmentSelections(target, node.right);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      isValuePropagatingAssignment(node.operatorToken.kind) &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      dynamicExpressionWrites.push({ target: node.left, source: node.right, direct: false });
      if (ts.isIdentifier(node.left.expression)) {
        const owner = resolveBinding(node.left.expression, node.left.expression.text);
        if (owner) {
          const key = dynamicPropertyKey(owner, assignedPropertyName(node.left));
          const sources = dynamicPropertyWrites.get(key) ?? [];
          sources.push(node.right);
          dynamicPropertyWrites.set(key, sources);
        }
      }
    }
    ts.forEachChild(node, collectDynamicConstructorFlows);
  };
  collectDynamicConstructorFlows(root);
  const isImmediateDynamicConstructorUse = (node: ts.Expression): boolean => {
    let current: ts.Expression = node;
    while (
      ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent)
    ) {
      current = current.parent;
    }
    if (
      (ts.isCallExpression(current.parent) || ts.isNewExpression(current.parent)) &&
      current.parent.expression === current
    ) {
      return true;
    }
    if (
      (ts.isPropertyAccessExpression(current.parent) ||
        ts.isElementAccessExpression(current.parent)) &&
      current.parent.expression === current
    ) {
      const property = ts.isPropertyAccessExpression(current.parent)
        ? current.parent.name.text
        : current.parent.argumentExpression
          ? scopedStaticString(current.parent.argumentExpression)
          : undefined;
      const invocation = current.parent.parent;
      return ["apply", "bind", "call"].includes(property ?? "") &&
        (ts.isCallExpression(invocation) || ts.isNewExpression(invocation)) &&
        invocation.expression === current.parent;
    }
    return false;
  };
  // This audit is a release boundary, so unresolved runtime property keys and
  // reflection aliases must always enter the flow analysis. The old syntactic
  // fast path made the verdict depend on how an attacker spelled the key.
  let needsDynamicConstructorFlowAnalysis = true;
  const collectDynamicConstructorFlowNeed = (node: ts.Node): void => {
    if (needsDynamicConstructorFlowAnalysis) return;
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      (ts.isPropertyAccessExpression(node)
        ? node.name.text
        : node.argumentExpression
          ? scopedStaticString(node.argumentExpression)
          : undefined) === "constructor"
    ) {
      const parent = node.parent;
      const assignmentTarget = ts.isBinaryExpression(parent) &&
        parent.left === node &&
        isValuePropagatingAssignment(parent.operatorToken.kind);
      const prototypeInspection =
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node &&
        (ts.isPropertyAccessExpression(parent)
          ? parent.name.text
          : parent.argumentExpression
            ? scopedStaticString(parent.argumentExpression)
            : undefined) === "prototype";
      if (!assignmentTarget && !prototypeInspection && !isImmediateDynamicConstructorUse(node)) {
        needsDynamicConstructorFlowAnalysis = true;
        return;
      }
    }
    if (
      ts.isIdentifier(node) &&
      node.text === "Function" &&
      !resolveBinding(node, "Function") &&
      !isImmediateDynamicConstructorUse(node)
    ) {
      needsDynamicConstructorFlowAnalysis = true;
      return;
    }
    if (
      ts.isCallExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression))
    ) {
      const owner = node.expression.expression;
      const property = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : node.expression.argumentExpression
          ? scopedStaticString(node.expression.argumentExpression)
          : undefined;
      if (
        property === "get" &&
        ts.isIdentifier(owner) &&
        owner.text === "Reflect" &&
        !resolveBinding(owner, "Reflect") &&
        node.arguments[1] &&
        !ts.isSpreadElement(node.arguments[1]) &&
        scopedStaticString(node.arguments[1]) === "constructor" &&
        !isImmediateDynamicConstructorUse(node)
      ) {
        needsDynamicConstructorFlowAnalysis = true;
        return;
      }
    }
    ts.forEachChild(node, collectDynamicConstructorFlowNeed);
  };
  collectDynamicConstructorFlowNeed(root);
  type DynamicExpressionPath = {
    root: AliasBinding;
    properties: Array<string | undefined>;
  };
  const dynamicExpressionPaths = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): DynamicExpressionPath[] => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return dynamicExpressionPaths(expression.expression, resolving);
    }
    if (ts.isConditionalExpression(expression)) {
      return [
        ...dynamicExpressionPaths(expression.whenTrue, resolving),
        ...dynamicExpressionPaths(expression.whenFalse, resolving),
      ];
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind))
    ) {
      return dynamicExpressionPaths(expression.right, resolving);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding) return [];
      return [{ root: canonicalObjectBinding(binding), properties: [] }];
    }
    if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
      return [];
    }
    const property = assignedPropertyName(expression);
    return dynamicExpressionPaths(expression.expression, resolving).map((path) => ({
      root: path.root,
      properties: [...path.properties, property],
    }));
  };
  const pathsOverlap = (left: DynamicExpressionPath, right: DynamicExpressionPath): boolean =>
    left.root === right.root &&
    left.properties.length === right.properties.length &&
    left.properties.every((property, index) =>
      property === undefined ||
      right.properties[index] === undefined ||
      property === right.properties[index]
    );
  type IndexedDynamicExpressionWrite = {
    write: (typeof dynamicExpressionWrites)[number];
    targetPaths: DynamicExpressionPath[];
  };
  let dynamicExpressionWriteIndex: Map<string, IndexedDynamicExpressionWrite[]> | undefined;
  const dynamicExpressionPathBucket = (path: DynamicExpressionPath): string =>
    `${path.root.id}:${path.properties.length}`;
  const ensureDynamicExpressionWriteIndex = (): Map<
    string,
    IndexedDynamicExpressionWrite[]
  > => {
    if (dynamicExpressionWriteIndex) return dynamicExpressionWriteIndex;
    dynamicExpressionWriteIndex = new Map();
    for (const write of dynamicExpressionWrites) {
      const targetPaths = dynamicExpressionPaths(write.target);
      const entry = { write, targetPaths };
      for (const bucket of new Set(targetPaths.map(dynamicExpressionPathBucket))) {
        const entries = dynamicExpressionWriteIndex.get(bucket) ?? [];
        entries.push(entry);
        dynamicExpressionWriteIndex.set(bucket, entries);
      }
    }
    return dynamicExpressionWriteIndex;
  };
  const isGlobalNamespaceAlias = (
    expression: ts.Expression,
    name: "Object" | "Reflect",
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isGlobalNamespaceAlias(expression.expression, name, resolving);
    }
    if (!ts.isIdentifier(expression)) return false;
    const binding = resolveBinding(expression, expression.text);
    if (!binding) return expression.text === name;
    if (resolving.has(binding)) return false;
    const next = new Set(resolving).add(binding);
    return (relationsByTarget.get(binding) ?? []).some((relation) =>
      isGlobalNamespaceAlias(relation.source, name, next)
    );
  };
  const reflectedMethod = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): "apply" | "construct" | "get" | undefined => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return reflectedMethod(expression.expression, resolving);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding || resolving.has(binding)) return undefined;
      const next = new Set(resolving).add(binding);
      const methods = new Set(
        (relationsByTarget.get(binding) ?? [])
          .map((relation) => reflectedMethod(relation.source, next))
          .filter((method): method is "apply" | "construct" | "get" => method !== undefined),
      );
      return methods.size === 1 ? [...methods][0] : undefined;
    }
    if (ts.isCallExpression(expression)) {
      const callee = expression.expression;
      if (
        (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) &&
        assignedPropertyName(callee) === "bind"
      ) {
        return reflectedMethod(callee.expression, resolving);
      }
      return undefined;
    }
    if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
      return undefined;
    }
    const method = assignedPropertyName(expression);
    return ["apply", "construct", "get"].includes(method ?? "") &&
        isGlobalNamespaceAlias(expression.expression, "Reflect")
      ? method as "apply" | "construct" | "get"
      : undefined;
  };
  const reflectInvocation = (
    expression: ts.CallExpression,
  ): { method: "apply" | "construct" | "get"; offset: number } | undefined => {
    const direct = reflectedMethod(expression.expression);
    if (direct) return { method: direct, offset: 0 };
    if (
      (ts.isPropertyAccessExpression(expression.expression) ||
        ts.isElementAccessExpression(expression.expression)) &&
      assignedPropertyName(expression.expression) === "call"
    ) {
      const forwarded = reflectedMethod(expression.expression.expression);
      if (forwarded) return { method: forwarded, offset: 1 };
    }
    return undefined;
  };
  const isKnownCallableValue = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isKnownCallableValue(expression.expression, resolving);
    }
    if (
      ts.isArrowFunction(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isClassExpression(expression)
    ) {
      return true;
    }
    if (ts.isConditionalExpression(expression)) {
      return isKnownCallableValue(expression.whenTrue, resolving) ||
        isKnownCallableValue(expression.whenFalse, resolving);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding) return expression.text === "Function";
      if (resolving.has(binding)) return false;
      if (localFunctions.has(binding) || localClassBindings.has(binding)) return true;
      const next = new Set(resolving).add(binding);
      return (relationsByTarget.get(binding) ?? []).some((relation) =>
        isKnownCallableValue(relation.source, next)
      );
    }
    if (ts.isCallExpression(expression)) {
      if (callableValue(expression).size > 0) return true;
      if (
        (ts.isPropertyAccessExpression(expression.expression) ||
          ts.isElementAccessExpression(expression.expression)) &&
        assignedPropertyName(expression.expression) === "getPrototypeOf" &&
        isGlobalNamespaceAlias(expression.expression.expression, "Object")
      ) {
        const argument = argumentExpression(expression.arguments[0]);
        return argument !== undefined && isKnownCallableValue(argument, resolving);
      }
    }
    return false;
  };
  const isDefinitelyNonExecutableConstructorOwner = (expression: ts.Expression): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isDefinitelyNonExecutableConstructorOwner(expression.expression);
    }
    if (
      ts.isNumericLiteral(expression) ||
      ts.isStringLiteralLike(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      ts.isArrayLiteralExpression(expression)
    ) {
      return true;
    }
    return (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) &&
      isGlobalNamespaceAlias(expression.expression, "Object") === false &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Math" &&
      resolveBinding(expression.expression, "Math") === undefined;
  };
  function isDynamicExpressionWrite(
    expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
    resolvingBindings: ReadonlySet<AliasBinding>,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean {
    const usePaths = dynamicExpressionPaths(expression);
    if (usePaths.length === 0) return false;
    const index = ensureDynamicExpressionWriteIndex();
    const examinedWrites = new Set<(typeof dynamicExpressionWrites)[number]>();
    for (const usePath of usePaths) {
      const indexedWrites = index.get(dynamicExpressionPathBucket(usePath)) ?? [];
      for (const { write, targetPaths } of indexedWrites) {
        if (examinedWrites.has(write)) continue;
        examinedWrites.add(write);
        if (!targetPaths.some((target) => pathsOverlap(usePath, target))) continue;
        if (write.direct) return true;
        if (
          write.source &&
          isDynamicFunctionConstructor(write.source, resolvingBindings, resolvingNodes)
        ) {
          return true;
        }
        if (
          write.selection &&
          isDynamicConstructorProperty(
            write.selection.container,
            write.selection.property,
            resolvingBindings,
            resolvingNodes,
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }
  let dynamicTruthGeneration = 0;
  const dynamicExpressionTrue = new Set<ts.Expression>();
  const dynamicExpressionFalse = new WeakMap<ts.Expression, number>();
  const dynamicExpressionInProgress = new Set<ts.Expression>();
  const dynamicBindingTrue = new Set<AliasBinding>();
  const dynamicBindingFalse = new Map<AliasBinding, number>();
  const dynamicBindingInProgress = new Set<AliasBinding>();
  const dynamicPropertyTrue = new WeakMap<ts.Expression, Set<string>>();
  const dynamicPropertyFalse = new WeakMap<ts.Expression, Map<string, number>>();
  const dynamicPropertyInProgress = new WeakMap<ts.Expression, Set<string>>();
  const dynamicBindingPropertyTrue = new Map<AliasBinding, Set<string>>();
  const dynamicBindingPropertyFalse = new Map<AliasBinding, Map<string, number>>();
  const dynamicBindingPropertyInProgress = new Map<AliasBinding, Set<string>>();
  const dynamicPropertyMemoKey = (property: string | undefined): string =>
    property === undefined ? "\u0000dynamic" : property;
  const memoSetHas = (
    memo: WeakMap<ts.Expression, Set<string>>,
    owner: ts.Expression,
    key: string,
  ): boolean => memo.get(owner)?.has(key) ?? false;
  const memoSetAdd = (
    memo: WeakMap<ts.Expression, Set<string>>,
    owner: ts.Expression,
    key: string,
  ): void => {
    const values = memo.get(owner) ?? new Set<string>();
    values.add(key);
    memo.set(owner, values);
  };
  const memoSetDelete = (
    memo: WeakMap<ts.Expression, Set<string>>,
    owner: ts.Expression,
    key: string,
  ): void => {
    memo.get(owner)?.delete(key);
  };
  const bindingMemoSetHas = (
    memo: Map<AliasBinding, Set<string>>,
    binding: AliasBinding | undefined,
    key: string,
  ): boolean => binding !== undefined && (memo.get(binding)?.has(key) ?? false);
  const bindingMemoSetAdd = (
    memo: Map<AliasBinding, Set<string>>,
    binding: AliasBinding | undefined,
    key: string,
  ): void => {
    if (!binding) return;
    const values = memo.get(binding) ?? new Set<string>();
    values.add(key);
    memo.set(binding, values);
  };
  const bindingMemoSetDelete = (
    memo: Map<AliasBinding, Set<string>>,
    binding: AliasBinding | undefined,
    key: string,
  ): void => {
    if (binding) memo.get(binding)?.delete(key);
  };
  const memoGenerationHas = (
    memo: WeakMap<ts.Expression, Map<string, number>>,
    owner: ts.Expression,
    key: string,
  ): boolean => memo.get(owner)?.get(key) === dynamicTruthGeneration;
  const memoGenerationSet = (
    memo: WeakMap<ts.Expression, Map<string, number>>,
    owner: ts.Expression,
    key: string,
  ): void => {
    const values = memo.get(owner) ?? new Map<string, number>();
    values.set(key, dynamicTruthGeneration);
    memo.set(owner, values);
  };
  const bindingMemoGenerationHas = (
    memo: Map<AliasBinding, Map<string, number>>,
    binding: AliasBinding | undefined,
    key: string,
  ): boolean => binding !== undefined && memo.get(binding)?.get(key) === dynamicTruthGeneration;
  const bindingMemoGenerationSet = (
    memo: Map<AliasBinding, Map<string, number>>,
    binding: AliasBinding | undefined,
    key: string,
  ): void => {
    if (!binding) return;
    const values = memo.get(binding) ?? new Map<string, number>();
    values.set(key, dynamicTruthGeneration);
    memo.set(binding, values);
  };
  function isDynamicConstructorProperty(
    owner: ts.Expression,
    property: string | undefined,
    resolvingBindings: ReadonlySet<AliasBinding>,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean {
    const key = dynamicPropertyMemoKey(property);
    const ownerBinding = ts.isIdentifier(owner)
      ? resolveBinding(owner, owner.text)
      : undefined;
    if (
      memoSetHas(dynamicPropertyTrue, owner, key) ||
      bindingMemoSetHas(dynamicBindingPropertyTrue, ownerBinding, key)
    ) {
      return true;
    }
    if (
      memoGenerationHas(dynamicPropertyFalse, owner, key) ||
      bindingMemoGenerationHas(dynamicBindingPropertyFalse, ownerBinding, key)
    ) {
      return false;
    }
    if (
      resolvingNodes.has(owner) ||
      memoSetHas(dynamicPropertyInProgress, owner, key) ||
      bindingMemoSetHas(dynamicBindingPropertyInProgress, ownerBinding, key)
    ) {
      return false;
    }
    memoSetAdd(dynamicPropertyInProgress, owner, key);
    bindingMemoSetAdd(dynamicBindingPropertyInProgress, ownerBinding, key);
    try {
      const result = computeDynamicConstructorProperty(
        owner,
        property,
        resolvingBindings,
        resolvingNodes,
      );
      if (result) {
        memoSetAdd(dynamicPropertyTrue, owner, key);
        bindingMemoSetAdd(dynamicBindingPropertyTrue, ownerBinding, key);
        dynamicTruthGeneration++;
      } else {
        memoGenerationSet(dynamicPropertyFalse, owner, key);
        bindingMemoGenerationSet(dynamicBindingPropertyFalse, ownerBinding, key);
      }
      return result;
    } finally {
      memoSetDelete(dynamicPropertyInProgress, owner, key);
      bindingMemoSetDelete(dynamicBindingPropertyInProgress, ownerBinding, key);
    }
  }
  function computeDynamicConstructorProperty(
    owner: ts.Expression,
    property: string | undefined,
    resolvingBindings: ReadonlySet<AliasBinding>,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean {
    const nextNodes = new Set(resolvingNodes).add(owner);
    if (property === undefined && isKnownCallableValue(owner)) return true;
    if (
      ts.isParenthesizedExpression(owner) ||
      ts.isAsExpression(owner) ||
      ts.isTypeAssertionExpression(owner) ||
      ts.isNonNullExpression(owner) ||
      ts.isSatisfiesExpression(owner) ||
      ts.isAwaitExpression(owner)
    ) {
      return isDynamicConstructorProperty(
        owner.expression,
        property,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(owner)) {
      return isDynamicConstructorProperty(
        owner.whenTrue,
        property,
        resolvingBindings,
        nextNodes,
      ) || isDynamicConstructorProperty(
        owner.whenFalse,
        property,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isBinaryExpression(owner)) {
      if (
        owner.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(owner.operatorToken.kind)
      ) {
        return isDynamicConstructorProperty(
          owner.right,
          property,
          resolvingBindings,
          nextNodes,
        );
      }
      return false;
    }
    if (ts.isArrayLiteralExpression(owner)) {
      const index = property !== undefined && /^(?:0|[1-9]\d*)$/.test(property)
        ? Number(property)
        : undefined;
      return owner.elements.some((element, currentIndex) => {
        if (ts.isOmittedExpression(element) || (index !== undefined && currentIndex !== index)) {
          return false;
        }
        return isDynamicFunctionConstructor(
          ts.isSpreadElement(element) ? element.expression : element,
          resolvingBindings,
          nextNodes,
        );
      });
    }
    if (ts.isObjectLiteralExpression(owner)) {
      return owner.properties.some((member) => {
        if (ts.isSpreadAssignment(member)) {
          return isDynamicConstructorProperty(
            member.expression,
            property,
            resolvingBindings,
            nextNodes,
          );
        }
        const memberProperty = scopedPropertyName(member.name);
        if (property !== undefined && memberProperty !== property) return false;
        if (ts.isPropertyAssignment(member)) {
          return isDynamicFunctionConstructor(
            member.initializer,
            resolvingBindings,
            nextNodes,
          );
        }
        if (ts.isShorthandPropertyAssignment(member)) {
          return isDynamicFunctionConstructor(
            member.name,
            resolvingBindings,
            nextNodes,
          );
        }
        return false;
      });
    }
    if (ts.isCallExpression(owner)) {
      for (const implementation of callImplementations(owner.expression)) {
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          if (isDynamicConstructorProperty(
            returned,
            property,
            resolvingBindings,
            nextNodes,
          )) {
            return true;
          }
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(owner.arguments[index]);
          if (argument && isDynamicConstructorProperty(
            argument,
            property,
            resolvingBindings,
            nextNodes,
          )) {
            return true;
          }
        }
      }
      return false;
    }
    if (!ts.isIdentifier(owner)) return false;
    const binding = resolveBinding(owner, owner.text);
    if (!binding || resolvingBindings.has(binding)) return false;
    const nextBindings = new Set(resolvingBindings).add(binding);
    const writeSources = [
      ...(dynamicPropertyWrites.get(dynamicPropertyKey(binding, property)) ?? []),
      ...(dynamicPropertyWrites.get(dynamicPropertyKey(binding, undefined)) ?? []),
    ];
    if (writeSources.some((source) =>
      isDynamicFunctionConstructor(source, nextBindings, nextNodes)
    )) {
      return true;
    }
    return (relationsByTarget.get(binding) ?? []).some((relation) =>
      isDynamicConstructorProperty(
        relation.source,
        property,
        nextBindings,
        nextNodes,
      )
    );
  }
  function isDynamicFunctionConstructor(
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean {
    const expressionBinding = ts.isIdentifier(expression)
      ? resolveBinding(expression, expression.text)
      : undefined;
    if (
      dynamicExpressionTrue.has(expression) ||
      (expressionBinding !== undefined && dynamicBindingTrue.has(expressionBinding))
    ) {
      return true;
    }
    if (
      dynamicExpressionFalse.get(expression) === dynamicTruthGeneration ||
      (expressionBinding !== undefined &&
        dynamicBindingFalse.get(expressionBinding) === dynamicTruthGeneration)
    ) {
      return false;
    }
    if (
      resolvingNodes.has(expression) ||
      dynamicExpressionInProgress.has(expression) ||
      (expressionBinding !== undefined && dynamicBindingInProgress.has(expressionBinding))
    ) {
      return false;
    }
    dynamicExpressionInProgress.add(expression);
    if (expressionBinding) dynamicBindingInProgress.add(expressionBinding);
    try {
      const result = computeDynamicFunctionConstructor(
        expression,
        resolvingBindings,
        resolvingNodes,
      );
      if (result) {
        dynamicExpressionTrue.add(expression);
        if (expressionBinding) dynamicBindingTrue.add(expressionBinding);
        dynamicTruthGeneration++;
      } else {
        dynamicExpressionFalse.set(expression, dynamicTruthGeneration);
        if (expressionBinding) {
          dynamicBindingFalse.set(expressionBinding, dynamicTruthGeneration);
        }
      }
      return result;
    } finally {
      dynamicExpressionInProgress.delete(expression);
      if (expressionBinding) dynamicBindingInProgress.delete(expressionBinding);
    }
  }
  function computeDynamicFunctionConstructor(
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean {
    const nextNodes = new Set(resolvingNodes).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isDynamicFunctionConstructor(expression.expression, resolvingBindings, nextNodes);
    }
    if (ts.isConditionalExpression(expression)) {
      return isDynamicFunctionConstructor(expression.whenTrue, resolvingBindings, nextNodes) ||
        isDynamicFunctionConstructor(expression.whenFalse, resolvingBindings, nextNodes);
    }
    if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind)
      ) {
        return isDynamicFunctionConstructor(expression.right, resolvingBindings, nextNodes);
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return isDynamicFunctionConstructor(expression.left, resolvingBindings, nextNodes) ||
          isDynamicFunctionConstructor(expression.right, resolvingBindings, nextNodes);
      }
      return false;
    }
    if (ts.isCallExpression(expression)) {
      const memberCallee = ts.isPropertyAccessExpression(expression.expression) ||
          ts.isElementAccessExpression(expression.expression)
        ? expression.expression
        : undefined;
      const property = memberCallee ? assignedPropertyName(memberCallee) : undefined;
      const reflection = reflectInvocation(expression);
      if (reflection?.method === "get") {
        const target = argumentExpression(expression.arguments[reflection.offset]);
        const key = argumentExpression(expression.arguments[reflection.offset + 1]);
        const propertyName = key ? scopedStaticString(key) : undefined;
        if (
          target &&
          (propertyName === "constructor" || propertyName === undefined) &&
          isKnownCallableValue(target)
        ) {
          return true;
        }
      }
      if (reflection && ["apply", "construct"].includes(reflection.method)) {
        const target = argumentExpression(expression.arguments[reflection.offset]);
        if (
          target &&
          isDynamicFunctionConstructor(target, resolvingBindings, nextNodes)
        ) {
          return true;
        }
      }
      if (
        property === "get" &&
        memberCallee &&
        ts.isIdentifier(memberCallee.expression) &&
        memberCallee.expression.text === "Reflect" &&
        !resolveBinding(memberCallee.expression, "Reflect") &&
        expression.arguments[1] &&
        !ts.isSpreadElement(expression.arguments[1]) &&
        scopedStaticString(expression.arguments[1]) === "constructor"
      ) {
        return true;
      }
      if (
        ["apply", "construct"].includes(property ?? "") &&
        memberCallee &&
        ts.isIdentifier(memberCallee.expression) &&
        memberCallee.expression.text === "Reflect" &&
        !resolveBinding(memberCallee.expression, "Reflect") &&
        expression.arguments[0] &&
        !ts.isSpreadElement(expression.arguments[0]) &&
        isDynamicFunctionConstructor(
          expression.arguments[0],
          resolvingBindings,
          nextNodes,
        )
      ) {
        return true;
      }
      if (
        ["apply", "bind", "call"].includes(property ?? "") &&
        memberCallee &&
        isDynamicFunctionConstructor(
          memberCallee.expression,
          resolvingBindings,
          nextNodes,
        )
      ) {
        return true;
      }
      if (!needsDynamicConstructorFlowAnalysis) return false;
      for (const implementation of callImplementations(expression.expression)) {
        if ((returnsByFunction.get(implementation) ?? []).some((returned) =>
          isDynamicFunctionConstructor(returned, resolvingBindings, nextNodes)
        )) {
          return true;
        }
        if ([...ensureReturnedArgumentIndexes(implementation)].some((index) => {
          const argument = argumentExpression(expression.arguments[index]);
          return argument !== undefined &&
            isDynamicFunctionConstructor(argument, resolvingBindings, nextNodes);
        })) {
          return true;
        }
      }
      return false;
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding) return expression.text === "Function";
      if (resolvingBindings.has(binding)) return false;
      if (directDynamicConstructorBindings.has(binding)) return true;
      if (!needsDynamicConstructorFlowAnalysis) return false;
      const nextBindings = new Set(resolvingBindings).add(binding);
      return (relationsByTarget.get(binding) ?? []).some((relation) =>
        isDynamicFunctionConstructor(relation.source, nextBindings, nextNodes)
      ) || (dynamicSelectionsByBinding.get(binding) ?? []).some((selection) =>
        isDynamicConstructorProperty(
          selection.container,
          selection.property,
          nextBindings,
          nextNodes,
        )
      );
    }
    if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
      return false;
    }
    const property = ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : expression.argumentExpression
        ? scopedStaticString(expression.argumentExpression)
        : undefined;
    if (
      property === "value" &&
      ts.isCallExpression(expression.expression) &&
      (ts.isPropertyAccessExpression(expression.expression.expression) ||
        ts.isElementAccessExpression(expression.expression.expression)) &&
      assignedPropertyName(expression.expression.expression) === "getOwnPropertyDescriptor" &&
      isGlobalNamespaceAlias(expression.expression.expression.expression, "Object")
    ) {
      const descriptorTarget = argumentExpression(expression.expression.arguments[0]);
      const descriptorKey = argumentExpression(expression.expression.arguments[1]);
      const descriptorProperty = descriptorKey ? scopedStaticString(descriptorKey) : undefined;
      if (
        descriptorTarget &&
        (descriptorProperty === "constructor" || descriptorProperty === undefined) &&
        (isKnownCallableValue(descriptorTarget) ||
          (ts.isCallExpression(descriptorTarget) &&
            (ts.isPropertyAccessExpression(descriptorTarget.expression) ||
              ts.isElementAccessExpression(descriptorTarget.expression)) &&
            assignedPropertyName(descriptorTarget.expression) === "getPrototypeOf" &&
            isGlobalNamespaceAlias(descriptorTarget.expression.expression, "Object") &&
            argumentExpression(descriptorTarget.arguments[0]) !== undefined &&
            isKnownCallableValue(argumentExpression(descriptorTarget.arguments[0])!)))
      ) {
        return true;
      }
    }
    if (
      property === "constructor" &&
      !isDefinitelyNonExecutableConstructorOwner(expression.expression)
    ) {
      return true;
    }
    if (property === undefined && isKnownCallableValue(expression.expression)) return true;
    if (
      ["apply", "bind", "call"].includes(property ?? "") &&
      isDynamicFunctionConstructor(expression.expression, resolvingBindings, nextNodes)
    ) {
      return true;
    }
    if (isDynamicExpressionWrite(expression, resolvingBindings, nextNodes)) return true;
    if (!needsDynamicConstructorFlowAnalysis) return false;
    return isDynamicConstructorProperty(
      expression.expression,
      property,
      resolvingBindings,
      nextNodes,
    );
  }
  const possibleValue = (node: ts.Expression): BrowserGlobalSet => {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return possibleValue(node.expression);
    }
    if (ts.isConditionalExpression(node)) {
      return unionGlobals(possibleValue(node.whenTrue), possibleValue(node.whenFalse));
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      return unionGlobals(possibleValue(node.left), possibleValue(node.right));
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    ) {
      return possibleValue(node.right);
    }
    if (ts.isCallExpression(node)) {
      const implementations = callImplementations(node.expression);
      return unionGlobals(
        ...[...implementations].map((implementation) =>
          unionGlobals(
            possibleFunctionReturns.get(implementation) ?? emptyGlobals,
            ...[...ensureReturnedArgumentIndexes(implementation)]
              .map((index) => node.arguments[index])
              .filter((argument): argument is ts.Expression =>
                argument !== undefined && !ts.isSpreadElement(argument)
              )
              .map((argument) => possibleValue(argument)),
          )
        ),
      );
    }
    if (!ts.isIdentifier(node)) return emptyGlobals;
    const binding = resolveBinding(node, node.text);
    if (binding) return possibleAliases.get(binding) ?? emptyGlobals;
    return PRIVILEGED_BROWSER_GLOBALS.has(node.text)
      ? new Set([node.text])
      : emptyGlobals;
  };
  for (;;) {
    let changed = false;
    for (const relation of relations) {
      const previous = possibleAliases.get(relation.target) ?? emptyGlobals;
      const next = unionGlobals(previous, possibleValue(relation.source));
      if (next.size !== previous.size) {
        possibleAliases.set(relation.target, next);
        changed = true;
      }
    }
    for (const [implementation, returns] of returnsByFunction) {
      const previous = possibleFunctionReturns.get(implementation) ?? emptyGlobals;
      const next = unionGlobals(previous, ...returns.map((returned) => possibleValue(returned)));
      if (next.size !== previous.size) {
        possibleFunctionReturns.set(implementation, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const objectFlowGraph = new Map<AliasBinding, Set<AliasBinding>>();
  const connectObjectBindings = (left: AliasBinding, right: AliasBinding): void => {
    const a = canonicalObjectBinding(left);
    const b = canonicalObjectBinding(right);
    if (a === b) return;
    const leftEdges = objectFlowGraph.get(a) ?? new Set<AliasBinding>();
    const rightEdges = objectFlowGraph.get(b) ?? new Set<AliasBinding>();
    leftEdges.add(b);
    rightEdges.add(a);
    objectFlowGraph.set(a, leftEdges);
    objectFlowGraph.set(b, rightEdges);
  };
  const argumentExpression = (
    argument: ts.Expression | ts.SpreadElement | undefined,
  ): ts.Expression | undefined => argument
    ? ts.isSpreadElement(argument) ? argument.expression : argument
    : undefined;
  const expressionObjectBindings = (
    expression: ts.Expression,
    resolvingFunctions: ReadonlySet<ts.FunctionLikeDeclaration> = new Set(),
  ): Set<AliasBinding> => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return expressionObjectBindings(expression.expression, resolvingFunctions);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      return binding ? new Set([canonicalObjectBinding(binding)]) : new Set();
    }
    if (ts.isConditionalExpression(expression)) {
      return new Set([
        ...expressionObjectBindings(expression.whenTrue, resolvingFunctions),
        ...expressionObjectBindings(expression.whenFalse, resolvingFunctions),
      ]);
    }
    if (ts.isBinaryExpression(expression)) {
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return new Set([
          ...expressionObjectBindings(expression.left, resolvingFunctions),
          ...expressionObjectBindings(expression.right, resolvingFunctions),
        ]);
      }
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        return expressionObjectBindings(expression.right, resolvingFunctions);
      }
      return new Set();
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return expressionObjectBindings(expression.expression, resolvingFunctions);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return new Set(
        expression.elements.flatMap((element) =>
          ts.isOmittedExpression(element)
            ? []
            : [...expressionObjectBindings(
                ts.isSpreadElement(element) ? element.expression : element,
                resolvingFunctions,
              )]
        ),
      );
    }
    if (ts.isObjectLiteralExpression(expression)) {
      const bindings = new Set<AliasBinding>();
      for (const member of expression.properties) {
        let value: ts.Expression | undefined;
        if (ts.isSpreadAssignment(member)) value = member.expression;
        else if (ts.isPropertyAssignment(member)) value = member.initializer;
        else if (ts.isShorthandPropertyAssignment(member)) value = member.name;
        if (!value) continue;
        for (const binding of expressionObjectBindings(value, resolvingFunctions)) {
          bindings.add(binding);
        }
      }
      return bindings;
    }
    if (ts.isCallExpression(expression)) {
      const bindings = new Set<AliasBinding>();
      for (const implementation of callImplementations(expression.expression)) {
        if (resolvingFunctions.has(implementation)) continue;
        const nextFunctions = new Set(resolvingFunctions).add(implementation);
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(expression.arguments[index]);
          if (!argument) continue;
          for (const binding of expressionObjectBindings(argument, nextFunctions)) {
            bindings.add(binding);
          }
        }
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          for (const binding of expressionObjectBindings(returned, nextFunctions)) {
            bindings.add(binding);
          }
        }
      }
      return bindings;
    }
    return new Set();
  };
  const boundPatternBindings = (name: ts.BindingName): Set<AliasBinding> => {
    if (ts.isIdentifier(name)) {
      const binding = resolveBinding(name, name.text);
      return binding ? new Set([canonicalObjectBinding(binding)]) : new Set();
    }
    return new Set(
      name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : [...boundPatternBindings(element.name)]
      ),
    );
  };
  const assignmentPatternBindings = (expression: ts.Expression): Set<AliasBinding> => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return assignmentPatternBindings(expression.expression);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      return binding ? new Set([canonicalObjectBinding(binding)]) : new Set();
    }
    if (ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return assignmentPatternBindings(expression.left);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return new Set(
        expression.elements.flatMap((element) =>
          ts.isOmittedExpression(element)
            ? []
            : [...assignmentPatternBindings(
                ts.isSpreadElement(element) ? element.expression : element,
              )]
        ),
      );
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return new Set(
        expression.properties.flatMap((member) => {
          if (ts.isSpreadAssignment(member)) return [...assignmentPatternBindings(member.expression)];
          if (ts.isPropertyAssignment(member)) {
            return [...assignmentPatternBindings(member.initializer)];
          }
          if (ts.isShorthandPropertyAssignment(member)) {
            return [...assignmentPatternBindings(member.name)];
          }
          return [];
        }),
      );
    }
    return new Set();
  };
  const receiverBindings = (expression: ts.Expression): Set<AliasBinding> => {
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return receiverBindings(expression.expression);
    }
    return expressionObjectBindings(expression);
  };
  const containsPotentialPrivilege = (expression: ts.Expression): boolean => {
    if (possibleValue(expression).size > 0) return true;
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found || (node !== expression && (ts.isFunctionLike(node) || ts.isClassLike(node)))) {
        return;
      }
      if (
        ts.isIdentifier(node) &&
        PRIVILEGED_BROWSER_GLOBALS.has(node.text) &&
        isRuntimeValueIdentifier(node) &&
        resolveBinding(node, node.text) === undefined
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(expression);
    return found;
  };
  const privilegedParameterWriteCache = new Map<
    ts.FunctionLikeDeclaration,
    ReadonlySet<number>
  >();
  const privilegedParameterWriteIndexes = (
    implementation: ts.FunctionLikeDeclaration,
  ): ReadonlySet<number> => {
    const cached = privilegedParameterWriteCache.get(implementation);
    if (cached) return cached;
    const parameterBindings = implementation.parameters.map((parameter) =>
      ts.isIdentifier(parameter.name)
        ? resolveBinding(parameter.name, parameter.name.text)
        : undefined
    );
    const indexes = new Set<number>();
    const visit = (node: ts.Node): void => {
      if (node !== implementation && ts.isFunctionLike(node)) return;
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
        containsPotentialPrivilege(node.right)
      ) {
        const receivers = receiverBindings(node.left.expression);
        for (const [index, binding] of parameterBindings.entries()) {
          if (binding && receivers.has(canonicalObjectBinding(binding))) indexes.add(index);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(implementation);
    privilegedParameterWriteCache.set(implementation, indexes);
    return indexes;
  };
  const candidateSeeds = new Set<AliasBinding>();
  const directCandidateAllocations = new Set<ts.Expression>();
  const connectSets = (
    left: ReadonlySet<AliasBinding>,
    right: ReadonlySet<AliasBinding>,
  ): void => {
    for (const a of left) for (const b of right) connectObjectBindings(a, b);
  };
  for (const relation of relations) {
    const target = canonicalObjectBinding(relation.target);
    connectSets(new Set([target]), expressionObjectBindings(relation.source));
    if (containsPotentialPrivilege(relation.source)) candidateSeeds.add(target);
  }
  const collectObjectStructure = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer && !ts.isIdentifier(node.name)) {
      connectSets(boundPatternBindings(node.name), expressionObjectBindings(node.initializer));
    }
    if (ts.isCallExpression(node)) {
      for (const implementation of callImplementations(node.expression)) {
        const returnedBindings = new Set<AliasBinding>();
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          for (const binding of expressionObjectBindings(returned)) returnedBindings.add(binding);
        }
        const passthroughIndexes = ensureReturnedArgumentIndexes(implementation);
        const writtenIndexes = privilegedParameterWriteIndexes(implementation);
        for (const [index, parameter] of implementation.parameters.entries()) {
          const argument = argumentExpression(node.arguments[index]);
          if (!argument) continue;
          const parameterBindings = boundPatternBindings(parameter.name);
          if (
            !passthroughIndexes.has(index) &&
            !writtenIndexes.has(index) &&
            ![...parameterBindings].some((binding) => returnedBindings.has(binding))
          ) {
            continue;
          }
          const argumentBindings = expressionObjectBindings(argument);
          connectSets(parameterBindings, argumentBindings);
          if (writtenIndexes.has(index) && argumentBindings.size === 0) {
            directCandidateAllocations.add(argument);
          }
        }
      }
    }
    if (ts.isBinaryExpression(node) && isValuePropagatingAssignment(node.operatorToken.kind)) {
      if (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) {
        const receivers = receiverBindings(node.left.expression);
        connectSets(receivers, expressionObjectBindings(node.right));
        if (containsPotentialPrivilege(node.right)) {
          for (const receiver of receivers) candidateSeeds.add(receiver);
          if (receiverBindings(node.left.expression).size === 0) {
            directCandidateAllocations.add(node.left.expression);
          }
        }
      } else if (ts.isObjectLiteralExpression(node.left) || ts.isArrayLiteralExpression(node.left)) {
        connectSets(assignmentPatternBindings(node.left), expressionObjectBindings(node.right));
      }
    }
    ts.forEachChild(node, collectObjectStructure);
  };
  collectObjectStructure(root);
  const candidateObjectBindings = new Set<AliasBinding>(candidateSeeds);
  const pendingCandidateBindings = [...candidateSeeds];
  while (pendingCandidateBindings.length > 0) {
    const binding = pendingCandidateBindings.pop()!;
    for (const neighbor of objectFlowGraph.get(binding) ?? []) {
      if (candidateObjectBindings.has(neighbor)) continue;
      candidateObjectBindings.add(neighbor);
      pendingCandidateBindings.push(neighbor);
    }
  }
  const candidateAllocations = new Set<ts.Expression>();
  const collectValueAllocations = (
    expression: ts.Expression,
    resolvingFunctions: ReadonlySet<ts.FunctionLikeDeclaration> = new Set(),
  ): void => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      collectValueAllocations(expression.expression, resolvingFunctions);
      return;
    }
    if (ts.isNewExpression(expression)) {
      candidateAllocations.add(expression);
      return;
    }
    if (ts.isArrayLiteralExpression(expression)) {
      candidateAllocations.add(expression);
      for (const element of expression.elements) {
        if (!ts.isOmittedExpression(element)) {
          collectValueAllocations(
            ts.isSpreadElement(element) ? element.expression : element,
            resolvingFunctions,
          );
        }
      }
      return;
    }
    if (ts.isObjectLiteralExpression(expression)) {
      candidateAllocations.add(expression);
      for (const member of expression.properties) {
        if (ts.isSpreadAssignment(member)) collectValueAllocations(member.expression, resolvingFunctions);
        else if (ts.isPropertyAssignment(member)) {
          collectValueAllocations(member.initializer, resolvingFunctions);
        } else if (ts.isShorthandPropertyAssignment(member)) {
          collectValueAllocations(member.name, resolvingFunctions);
        }
      }
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      collectValueAllocations(expression.whenTrue, resolvingFunctions);
      collectValueAllocations(expression.whenFalse, resolvingFunctions);
      return;
    }
    if (ts.isBinaryExpression(expression)) {
      collectValueAllocations(expression.right, resolvingFunctions);
      if (
        expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        collectValueAllocations(expression.left, resolvingFunctions);
      }
      return;
    }
    if (ts.isCallExpression(expression)) {
      for (const implementation of callImplementations(expression.expression)) {
        if (resolvingFunctions.has(implementation)) continue;
        const nextFunctions = new Set(resolvingFunctions).add(implementation);
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          collectValueAllocations(returned, nextFunctions);
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(expression.arguments[index]);
          if (argument) collectValueAllocations(argument, nextFunctions);
        }
      }
      return;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      collectValueAllocations(expression.expression, resolvingFunctions);
    }
  };
  for (const relation of relations) {
    if (candidateObjectBindings.has(canonicalObjectBinding(relation.target))) {
      collectValueAllocations(relation.source);
    }
  }
  for (const allocation of directCandidateAllocations) collectValueAllocations(allocation);
  const candidateObjectValues = (
    expression: ts.Expression,
    resolvingFunctions: ReadonlySet<ts.FunctionLikeDeclaration> = new Set(),
  ): BrowserGlobalSet => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return candidateObjectValues(expression.expression, resolvingFunctions);
    }
    if (candidateAllocations.has(expression)) return new Set([objectValue(expression)]);
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      return binding && candidateObjectBindings.has(canonicalObjectBinding(binding))
        ? new Set([`${OBJECT_VALUE_PREFIX}binding:${canonicalObjectBinding(binding).id}`])
        : emptyGlobals;
    }
    if (ts.isConditionalExpression(expression)) {
      return unionGlobals(
        candidateObjectValues(expression.whenTrue, resolvingFunctions),
        candidateObjectValues(expression.whenFalse, resolvingFunctions),
      );
    }
    if (ts.isBinaryExpression(expression)) {
      return expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
          expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? candidateObjectValues(expression.right, resolvingFunctions)
        : unionGlobals(
            candidateObjectValues(expression.left, resolvingFunctions),
            candidateObjectValues(expression.right, resolvingFunctions),
          );
    }
    if (ts.isCallExpression(expression)) {
      const values: BrowserGlobalSet[] = [];
      for (const implementation of callImplementations(expression.expression)) {
        if (resolvingFunctions.has(implementation)) continue;
        const nextFunctions = new Set(resolvingFunctions).add(implementation);
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          values.push(candidateObjectValues(returned, nextFunctions));
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(expression.arguments[index]);
          if (argument) values.push(candidateObjectValues(argument, nextFunctions));
        }
      }
      return unionGlobals(...values);
    }
    return emptyGlobals;
  };

  type MutableAliasState = Map<AliasBinding, BrowserGlobalSet>;
  type LabeledState = { label?: string; state: MutableAliasState };
  type ReturnedState = { state: MutableAliasState; value: BrowserGlobalSet };
  type FlowResult = {
    normal?: MutableAliasState;
    breaks: LabeledState[];
    continues: LabeledState[];
    returns: ReturnedState[];
    throws: MutableAliasState[];
  };
  const valuesBefore = new Map<ts.Identifier, BrowserGlobalSet>();
  const propertyValuesBefore = new Map<
    ts.PropertyAccessExpression | ts.ElementAccessExpression,
    BrowserGlobalSet
  >();
  const callValues = new Map<ts.CallExpression | ts.NewExpression, BrowserGlobalSet>();
  const analyzedLocalCalls = new Set<ts.CallExpression | ts.NewExpression>();
  const localFunctionReturns = new Set<ts.ReturnStatement | ts.ArrowFunction>();
  const trackedBrowserObjectExpressions = new Set<ts.Expression>();
  const taintedReplayObjectValues = new Set<string>();
  const trackedPropertyBindings = new Map<string, AliasBinding>();
  const trackedPropertiesByOwner = new Map<string, Set<AliasBinding>>();
  const bindingObjectValue = (binding: AliasBinding): string =>
    `${OBJECT_VALUE_PREFIX}binding:${canonicalObjectBinding(binding).id}`;
  const trackedPropertyBindingForOwner = (
    owner: string,
    property: string | undefined,
  ): AliasBinding => {
    const normalizedProperty = property ?? "*";
    const key = `${owner}:${normalizedProperty}`;
    let binding = trackedPropertyBindings.get(key);
    if (!binding) {
      binding = {
        id: nextBindingId++,
        name: `${owner}.${normalizedProperty}`,
        scope: root,
      };
      trackedPropertyBindings.set(key, binding);
      let properties = trackedPropertiesByOwner.get(owner);
      if (!properties) {
        properties = new Set();
        trackedPropertiesByOwner.set(owner, properties);
      }
      properties.add(binding);
    }
    return binding;
  };
  const trackableOwners = (values: BrowserGlobalSet): string[] =>
    [...values].filter((value) => isObjectValue(value) || PRIVILEGED_BROWSER_GLOBALS.has(value));
  const cloneState = (state: BrowserAliasState): MutableAliasState =>
    new Map([...state].map(([binding, values]) => [binding, new Set(values)]));
  const joinStates = (...states: Array<BrowserAliasState | undefined>): MutableAliasState => {
    const result = new Map<AliasBinding, BrowserGlobalSet>();
    for (const state of states) {
      if (!state) continue;
      for (const [binding, values] of state) {
        result.set(binding, unionGlobals(result.get(binding) ?? emptyGlobals, values));
      }
    }
    return result;
  };
  const statesEqual = (left: BrowserAliasState, right: BrowserAliasState): boolean => {
    const bindings = new Set([...left.keys(), ...right.keys()]);
    for (const binding of bindings) {
      const a = left.get(binding) ?? emptyGlobals;
      const b = right.get(binding) ?? emptyGlobals;
      if (a.size !== b.size || [...a].some((value) => !b.has(value))) return false;
    }
    return true;
  };
  const updateBinding = (
    state: MutableAliasState,
    binding: AliasBinding,
    values: BrowserGlobalSet,
  ): void => {
    if (values.size > 0) state.set(binding, new Set(values));
    else state.delete(binding);
  };
  const readPropertyValues = (
    owners: BrowserGlobalSet,
    property: string | undefined,
    state: BrowserAliasState,
  ): BrowserGlobalSet => {
    const values: BrowserGlobalSet[] = [];
    for (const owner of trackableOwners(owners)) {
      const browserValue = browserObjectProperty(owner, property);
      if (browserValue) values.push(new Set([browserValue]));
      const bindings = trackedPropertiesByOwner.get(owner) ?? new Set<AliasBinding>();
      if (property === undefined) {
        values.push(...[...bindings].map((binding) => state.get(binding) ?? emptyGlobals));
      } else {
        const exact = trackedPropertyBindings.get(`${owner}:${property}`);
        const wildcard = trackedPropertyBindings.get(`${owner}:*`);
        if (exact) values.push(state.get(exact) ?? emptyGlobals);
        if (wildcard) values.push(state.get(wildcard) ?? emptyGlobals);
      }
    }
    return unionGlobals(...values);
  };
  const writePropertyValues = (
    owners: BrowserGlobalSet,
    property: string | undefined,
    values: BrowserGlobalSet,
    state: MutableAliasState,
  ): void => {
    for (const owner of trackableOwners(owners)) {
      updateBinding(state, trackedPropertyBindingForOwner(owner, property), values);
    }
  };
  const valuesContainBrowserObject = (
    values: BrowserGlobalSet,
    state: BrowserAliasState,
    seen: ReadonlySet<string> = new Set(),
  ): boolean => {
    for (const value of values) {
      if (isBrowserObjectValue(value)) return true;
      if (!value.startsWith(OBJECT_VALUE_PREFIX) || seen.has(value)) continue;
      const nextSeen = new Set([...seen, value]);
      for (const property of trackedPropertiesByOwner.get(value) ?? []) {
        if (valuesContainBrowserObject(state.get(property) ?? emptyGlobals, state, nextSeen)) {
          return true;
        }
      }
    }
    return false;
  };
  const valuesContainNestedBrowserObject = (
    values: BrowserGlobalSet,
    state: BrowserAliasState,
  ): boolean => {
    const taintedReplayValueContainsBrowser = (
      value: string,
      seen: ReadonlySet<string>,
    ): boolean => {
      if (!value.startsWith(OBJECT_VALUE_PREFIX) || seen.has(value)) return false;
      const nextSeen = new Set([...seen, value]);
      const properties = trackedPropertiesByOwner.get(value) ?? [];
      if (
        taintedReplayObjectValues.has(value) &&
        [...properties].some((property) =>
          valuesContainBrowserObject(state.get(property) ?? emptyGlobals, state)
        )
      ) {
        return true;
      }
      for (const property of properties) {
        for (const nested of state.get(property) ?? []) {
          if (taintedReplayValueContainsBrowser(nested, nextSeen)) return true;
        }
      }
      return false;
    };
    return [...values].some((value) =>
      taintedReplayValueContainsBrowser(value, new Set())
    );
  };
  const updateBoundNames = (
    name: ts.BindingName,
    values: BrowserGlobalSet,
    state: MutableAliasState,
  ): void => {
    if (ts.isIdentifier(name)) {
      const binding = resolveBinding(name, name.text);
      if (binding) updateBinding(state, binding, values);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) updateBoundNames(element.name, values, state);
    }
  };
  const bindingElementProperty = (element: ts.BindingElement): string | undefined => {
    const property = element.propertyName ?? (ts.isIdentifier(element.name) ? element.name : undefined);
    if (!property) return undefined;
    if (ts.isIdentifier(property) || ts.isStringLiteralLike(property) || ts.isNumericLiteral(property)) {
      return property.text;
    }
    return ts.isComputedPropertyName(property)
      ? scopedStaticString(property.expression)
      : undefined;
  };
  const bindDeclarationPattern = (
    name: ts.BindingName,
    fallback: BrowserGlobalSet,
    state: MutableAliasState,
  ): void => {
    if (ts.isIdentifier(name)) {
      updateBoundNames(name, fallback, state);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        let values = !element.dotDotDotToken
          ? readPropertyValues(fallback, bindingElementProperty(element), state)
          : unionGlobals(fallback, readPropertyValues(fallback, undefined, state));
        if (element.initializer) {
          const initialized = evaluateExpression(element.initializer, state);
          state.clear();
          for (const [binding, tracked] of initialized.state) state.set(binding, tracked);
          values = unionGlobals(values, initialized.value);
        }
        bindDeclarationPattern(element.name, values, state);
      }
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      let values = element.dotDotDotToken
        ? unionGlobals(fallback, readPropertyValues(fallback, undefined, state))
        : readPropertyValues(fallback, String(index), state);
      if (element.initializer) {
        const initialized = evaluateExpression(element.initializer, state);
        state.clear();
        for (const [binding, tracked] of initialized.state) state.set(binding, tracked);
        values = unionGlobals(values, initialized.value);
      }
      bindDeclarationPattern(element.name, values, state);
    }
  };
  const assignmentPatternExpression = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  const bindAssignmentPattern = (
    targetExpression: ts.Expression,
    fallback: BrowserGlobalSet,
    state: MutableAliasState,
  ): void => {
    const target = assignmentPatternExpression(targetExpression);
    if (ts.isIdentifier(target)) {
      const binding = resolveBinding(target, target.text);
      if (binding) updateBinding(state, binding, fallback);
      return;
    }
    if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const initialized = evaluateExpression(target.right, state);
      state.clear();
      for (const [binding, tracked] of initialized.state) state.set(binding, tracked);
      bindAssignmentPattern(target.left, unionGlobals(fallback, initialized.value), state);
      return;
    }
    if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
      const owner = evaluateExpression(target.expression, state);
      let nextState = owner.state;
      if (ts.isElementAccessExpression(target) && target.argumentExpression) {
        nextState = evaluateExpression(target.argumentExpression, nextState).state;
      }
      state.clear();
      for (const [binding, tracked] of nextState) state.set(binding, tracked);
      writePropertyValues(owner.value, assignedPropertyName(target), fallback, state);
      return;
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (const [index, element] of target.elements.entries()) {
        if (ts.isOmittedExpression(element)) continue;
        const values = ts.isSpreadElement(element)
          ? unionGlobals(fallback, readPropertyValues(fallback, undefined, state))
          : readPropertyValues(fallback, String(index), state);
        bindAssignmentPattern(
          ts.isSpreadElement(element) ? element.expression : element,
          values,
          state,
        );
      }
      return;
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const member of target.properties) {
        if (ts.isSpreadAssignment(member)) {
          bindAssignmentPattern(
            member.expression,
            unionGlobals(fallback, readPropertyValues(fallback, undefined, state)),
            state,
          );
        } else if (ts.isPropertyAssignment(member)) {
          const property = ts.isComputedPropertyName(member.name)
            ? scopedStaticString(member.name.expression)
            : scopedPropertyName(member.name);
          if (ts.isComputedPropertyName(member.name)) {
            const computed = evaluateExpression(member.name.expression, state);
            state.clear();
            for (const [binding, tracked] of computed.state) state.set(binding, tracked);
          }
          bindAssignmentPattern(
            member.initializer,
            readPropertyValues(fallback, property, state),
            state,
          );
        } else if (ts.isShorthandPropertyAssignment(member)) {
          bindAssignmentPattern(
            member.name,
            readPropertyValues(fallback, member.name.text, state),
            state,
          );
        }
      }
    }
  };
  const recordState = (node: ts.Node, state: BrowserAliasState): void => {
    if (!ts.isIdentifier(node)) return;
    const binding = resolveBinding(node, node.text);
    if (!binding) return;
    const current = state.get(binding) ?? emptyGlobals;
    if (current.size === 0) return;
    const previous = valuesBefore.get(node) ?? emptyGlobals;
    valuesBefore.set(node, unionGlobals(previous, current));
  };
  const bindingInside = (binding: AliasBinding, scope: ts.Node): boolean => {
    let current: ts.Node | undefined = binding.scope;
    while (current) {
      if (current === scope) return true;
      current = current.parent;
    }
    return false;
  };
  const capturedPrivilegeCache = new Map<ts.FunctionLikeDeclaration, boolean>();
  const hasCapturedPrivilegedWrite = (implementation: ts.FunctionLikeDeclaration): boolean => {
    const cached = capturedPrivilegeCache.get(implementation);
    if (cached !== undefined) return cached;
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found || (node !== implementation && ts.isFunctionLike(node))) return;
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        ts.isIdentifier(node.left) &&
        possibleValue(node.right).size > 0
      ) {
        const binding = resolveBinding(node.left, node.left.text);
        if (binding && !bindingInside(binding, implementation)) found = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(implementation);
    capturedPrivilegeCache.set(implementation, found);
    return found;
  };
  const directValue = (node: ts.Expression, state: BrowserAliasState): BrowserGlobalSet => {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return directValue(node.expression, state);
    }
    if (ts.isConditionalExpression(node)) {
      return unionGlobals(directValue(node.whenTrue, state), directValue(node.whenFalse, state));
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      return unionGlobals(directValue(node.left, state), directValue(node.right, state));
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(node.operatorToken.kind))
    ) {
      return directValue(node.right, state);
    }
    if (!ts.isIdentifier(node)) return emptyGlobals;
    const binding = resolveBinding(node, node.text);
    if (binding) {
      const values = state.get(binding) ?? emptyGlobals;
      const owner = bindingObjectValue(binding);
      return candidateObjectBindings.has(canonicalObjectBinding(binding)) ||
          trackedPropertiesByOwner.has(owner)
        ? unionGlobals(values, new Set([owner]))
        : values;
    }
    return PRIVILEGED_BROWSER_GLOBALS.has(node.text)
      ? new Set([node.text])
      : emptyGlobals;
  };
  type ExpressionResult = { state: MutableAliasState; value: BrowserGlobalSet };
  function evaluateExpression(
    node: ts.Expression,
    state: BrowserAliasState,
  ): ExpressionResult {
    const result = evaluateExpressionInner(node, state);
    if (valuesContainNestedBrowserObject(result.value, result.state)) {
      trackedBrowserObjectExpressions.add(node);
    }
    return result;
  }
  const evaluateExpressions = (
    nodes: readonly ts.Expression[],
    state: BrowserAliasState,
  ): MutableAliasState => {
    let current = cloneState(state);
    for (const node of nodes) current = evaluateExpression(node, current).state;
    return current;
  };
  function evaluateExpressionInner(
    node: ts.Expression,
    input: BrowserAliasState,
  ): ExpressionResult {
    recordState(node, input);
    if (
      ts.isIdentifier(node) ||
      ts.isLiteralExpression(node) ||
      node.kind === ts.SyntaxKind.ThisKeyword
    ) {
      return { state: cloneState(input), value: directValue(node, input) };
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return evaluateExpression(node.expression, input);
    }
    if (ts.isConditionalExpression(node)) {
      const condition = evaluateExpression(node.condition, input);
      const whenTrue = evaluateExpression(node.whenTrue, condition.state);
      const whenFalse = evaluateExpression(node.whenFalse, condition.state);
      return {
        state: joinStates(whenTrue.state, whenFalse.state),
        value: unionGlobals(whenTrue.value, whenFalse.value),
      };
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      const assignmentTarget = assignmentPatternExpression(node.left);
      if (
        operator === ts.SyntaxKind.EqualsToken &&
        (ts.isObjectLiteralExpression(assignmentTarget) ||
          ts.isArrayLiteralExpression(assignmentTarget))
      ) {
        const right = evaluateExpression(node.right, input);
        const state = cloneState(right.state);
        bindAssignmentPattern(assignmentTarget, right.value, state);
        return { state, value: right.value };
      }
      if (operator === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
        recordState(node.left, input);
        const right = evaluateExpression(node.right, input);
        const state = cloneState(right.state);
        const binding = resolveBinding(node.left, node.left.text);
        if (binding) updateBinding(state, binding, right.value);
        return { state, value: right.value };
      }
      if (
        isValuePropagatingAssignment(operator) &&
        (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
      ) {
        const owner = evaluateExpression(node.left.expression, input);
        const leftState = ts.isElementAccessExpression(node.left) && node.left.argumentExpression
          ? evaluateExpression(node.left.argumentExpression, owner.state).state
          : owner.state;
        let ownerValues = owner.value;
        const stateBeforeRight = cloneState(leftState);
        if (trackableOwners(ownerValues).length === 0) {
          const receiver = identifierBinding(node.left.expression);
          if (receiver) {
            ownerValues = new Set([bindingObjectValue(receiver)]);
            updateBinding(
              stateBeforeRight,
              receiver,
              unionGlobals(stateBeforeRight.get(receiver) ?? emptyGlobals, ownerValues),
            );
          }
        }
        const property = assignedPropertyName(node.left);
        const previous = operator === ts.SyntaxKind.EqualsToken
          ? emptyGlobals
          : readPropertyValues(ownerValues, property, stateBeforeRight);
        const right = evaluateExpression(node.right, stateBeforeRight);
        const state = cloneState(right.state);
        const value = unionGlobals(previous, right.value);
        if (
          property === "blockedOn" &&
          isInertEventTargetAssignment(node) &&
          valuesContainBrowserObject(value, state)
        ) {
          for (const ownerValue of ownerValues) {
            if (ownerValue.startsWith(OBJECT_VALUE_PREFIX)) {
              taintedReplayObjectValues.add(ownerValue);
            }
          }
        }
        writePropertyValues(ownerValues, property, value, state);
        return { state, value };
      }
      const left = evaluateExpression(node.left, input);
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        const right = evaluateExpression(node.right, left.state);
        return {
          state: joinStates(left.state, right.state),
          value: unionGlobals(left.value, right.value),
        };
      }
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        operator === ts.SyntaxKind.BarBarEqualsToken ||
        operator === ts.SyntaxKind.QuestionQuestionEqualsToken
      ) {
        const right = evaluateExpression(node.right, left.state);
        const state = joinStates(left.state, right.state);
        if (ts.isIdentifier(node.left)) {
          const binding = resolveBinding(node.left, node.left.text);
          if (binding) updateBinding(state, binding, unionGlobals(left.value, right.value));
        }
        return { state, value: unionGlobals(left.value, right.value) };
      }
      const right = evaluateExpression(node.right, left.state);
      return {
        state: right.state,
        value: operator === ts.SyntaxKind.CommaToken ? right.value : emptyGlobals,
      };
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const operand = evaluateExpression(node.operand, input);
      return { state: operand.state, value: emptyGlobals };
    }
    if (ts.isPropertyAccessExpression(node)) {
      const expression = evaluateExpression(node.expression, input);
      recordState(node.name, expression.state);
      const value = readPropertyValues(expression.value, node.name.text, expression.state);
      if (value.size > 0) propertyValuesBefore.set(node, new Set(value));
      return { state: expression.state, value };
    }
    if (ts.isElementAccessExpression(node)) {
      const expression = evaluateExpression(node.expression, input);
      const state = node.argumentExpression
        ? evaluateExpression(node.argumentExpression, expression.state).state
        : expression.state;
      const value = readPropertyValues(
        expression.value,
        node.argumentExpression ? scopedStaticString(node.argumentExpression) : undefined,
        state,
      );
      if (value.size > 0) propertyValuesBefore.set(node, new Set(value));
      return { state, value };
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = evaluateExpression(node.expression, input);
      let state = callee.state;
      const argumentValues: BrowserGlobalSet[] = [];
      for (const argument of node.arguments ?? []) {
        const expression = ts.isSpreadElement(argument) ? argument.expression : argument;
        const evaluated = evaluateExpression(
          expression,
          state,
        );
        state = evaluated.state;
        argumentValues.push(evaluated.value);
      }
      {
        const implementations = callImplementations(node.expression);
        if (implementations.size > 0) {
          analyzedLocalCalls.add(node);
          const evaluateCalls = evaluateLocalCalls &&
            (argumentValues.some((value) => valuesContainBrowserObject(value, state)) ||
              [...implementations].some(hasCapturedPrivilegedWrite) ||
              [...implementations].some((implementation) =>
                [...privilegedParameterWriteIndexes(implementation)].some((index) =>
                  [...(argumentValues[index] ?? emptyGlobals)].some((value) =>
                    isObjectValue(value) || PRIVILEGED_BROWSER_GLOBALS.has(value)
                  )
                )
              ));
          const results = [...implementations].map((implementation) =>
            evaluateCalls
              ? evaluateLocalFunctionCall(
                  implementation,
                  state,
                  argumentValues,
                )
              : {
                  state: cloneState(state),
                  value: unionGlobals(
                    possibleFunctionReturns.get(implementation) ?? emptyGlobals,
                    ...[...(returnsByFunction.get(implementation) ?? [])]
                      .map((returned) => candidateObjectValues(returned)),
                    ...[...ensureReturnedArgumentIndexes(implementation)]
                      .map((index) => argumentValues[index] ?? emptyGlobals),
                  ),
                }
          );
          const result = {
            state: joinStates(...results.map((item) => item.state)),
            value: unionGlobals(
              ...results.map((item) => item.value),
              ts.isNewExpression(node) && candidateAllocations.has(node)
                ? new Set([objectValue(node)])
                : emptyGlobals,
            ),
          };
          callValues.set(node, result.value);
          return result;
        }
      }
      const value = ts.isNewExpression(node) && candidateAllocations.has(node)
        ? new Set([objectValue(node)])
        : callee.value.size > 0 && [...callee.value].some(isBrowserObjectValue)
          ? new Set([...callee.value].filter(isBrowserObjectValue))
          : emptyGlobals;
      callValues.set(node, value);
      return { state, value };
    }
    if (ts.isArrayLiteralExpression(node)) {
      let state = cloneState(input);
      const entries: Array<{ property: string | undefined; values: BrowserGlobalSet }> = [];
      for (const [index, element] of node.elements.entries()) {
        if (!ts.isOmittedExpression(element)) {
          const evaluated = evaluateExpression(
            ts.isSpreadElement(element) ? element.expression : element,
            state,
          );
          state = evaluated.state;
          entries.push({
            property: ts.isSpreadElement(element) ? undefined : String(index),
            values: evaluated.value,
          });
        }
      }
      const container = candidateAllocations.has(node) ||
          entries.some((entry) => entry.values.size > 0)
        ? new Set([objectValue(node)])
        : emptyGlobals;
      for (const entry of entries) {
        writePropertyValues(container, entry.property, entry.values, state);
      }
      return { state, value: container };
    }
    if (ts.isObjectLiteralExpression(node)) {
      let state = cloneState(input);
      const entries: Array<{ property: string | undefined; values: BrowserGlobalSet }> = [];
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const evaluated = evaluateExpression(property.expression, state);
          state = evaluated.state;
          entries.push({
            property: undefined,
            values: unionGlobals(
              evaluated.value,
              readPropertyValues(evaluated.value, undefined, state),
            ),
          });
        } else if (ts.isPropertyAssignment(property)) {
          let propertyName: string | undefined;
          if (ts.isComputedPropertyName(property.name)) {
            state = evaluateExpression(property.name.expression, state).state;
            propertyName = scopedStaticString(property.name.expression);
          } else if (
            ts.isIdentifier(property.name) ||
            ts.isStringLiteralLike(property.name) ||
            ts.isNumericLiteral(property.name)
          ) {
            propertyName = property.name.text;
          }
          const evaluated = evaluateExpression(property.initializer, state);
          state = evaluated.state;
          entries.push({ property: propertyName, values: evaluated.value });
        } else if (ts.isShorthandPropertyAssignment(property)) {
          const evaluated = evaluateExpression(property.name, state);
          state = evaluated.state;
          entries.push({ property: property.name.text, values: evaluated.value });
        }
      }
      const container = candidateAllocations.has(node) ||
          entries.some((entry) => entry.values.size > 0)
        ? new Set([objectValue(node)])
        : emptyGlobals;
      for (const entry of entries) {
        writePropertyValues(container, entry.property, entry.values, state);
      }
      return { state, value: container };
    }
    if (ts.isTemplateExpression(node)) {
      return {
        state: evaluateExpressions(node.templateSpans.map((span) => span.expression), input),
        value: emptyGlobals,
      };
    }
    if (ts.isTaggedTemplateExpression(node)) {
      let state = evaluateExpression(node.tag, input).state;
      if (ts.isTemplateExpression(node.template)) {
        state = evaluateExpressions(node.template.templateSpans.map((span) => span.expression), state);
      }
      return { state, value: emptyGlobals };
    }
    if (ts.isClassExpression(node)) {
      return { state: evaluateClassExecutable(node, input), value: emptyGlobals };
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return { state: cloneState(input), value: emptyGlobals };
    }
    let state = cloneState(input);
    ts.forEachChild(node, (child) => {
      if (ts.isExpression(child) && !ts.isFunctionLike(child)) {
        state = evaluateExpression(child, state).state;
      }
    });
    return { state, value: emptyGlobals };
  }

  const emptyFlow = (normal?: MutableAliasState): FlowResult => ({
    normal,
    breaks: [],
    continues: [],
    returns: [],
    throws: [],
  });
  const mergeAbrupt = (target: FlowResult, source: FlowResult): void => {
    target.breaks.push(...source.breaks);
    target.continues.push(...source.continues);
    target.returns.push(...source.returns);
    target.throws.push(...source.throws);
  };
  function evaluateStatement(
    node: ts.Statement,
    state: BrowserAliasState,
    label?: string,
  ): FlowResult {
    return evaluateStatementInner(node, state, label);
  }
  const evaluateStatements = (
    nodes: readonly ts.Statement[],
    input: BrowserAliasState,
  ): FlowResult => {
    const result = emptyFlow(cloneState(input));
    for (const node of nodes) {
      if (!result.normal) break;
      const next = evaluateStatement(node, result.normal);
      result.normal = next.normal;
      mergeAbrupt(result, next);
    }
    return result;
  };
  const evaluateLoop = (
    incoming: BrowserAliasState,
    condition: ts.Expression | undefined,
    body: ts.Statement,
    incrementor?: ts.Expression,
    atLeastOnce = false,
    label?: string,
  ): FlowResult => {
    let head = cloneState(incoming);
    let bodyResult: FlowResult | undefined;
    let conditionState: MutableAliasState | undefined;
    for (;;) {
      conditionState = condition
        ? evaluateExpression(condition, head).state
        : cloneState(head);
      bodyResult = evaluateStatement(body, conditionState);
      const consumedContinues = bodyResult.continues
        .filter((completion) => completion.label === undefined || completion.label === label)
        .map((completion) => completion.state);
      let back = joinStates(bodyResult.normal, ...consumedContinues);
      if (incrementor) back = evaluateExpression(incrementor, back).state;
      const nextHead = joinStates(incoming, back);
      if (statesEqual(head, nextHead)) break;
      head = nextHead;
    }
    const finalBody = bodyResult!;
    const finalCondition = conditionState!;
    const consumedBreaks = finalBody.breaks
      .filter((completion) => completion.label === undefined || completion.label === label)
      .map((completion) => completion.state);
    const exits = atLeastOnce
      ? [finalCondition, ...consumedBreaks]
      : [incoming, finalCondition, ...consumedBreaks];
    const result = emptyFlow(joinStates(...exits));
    result.breaks.push(
      ...finalBody.breaks.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ),
    );
    result.continues.push(
      ...finalBody.continues.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ),
    );
    result.returns.push(...finalBody.returns);
    result.throws.push(...finalBody.throws);
    return result;
  };
  function evaluateStatementInner(
    node: ts.Statement,
    input: BrowserAliasState,
    label?: string,
  ): FlowResult {
    recordState(node, input);
    if (ts.isBlock(node)) return evaluateStatements(node.statements, input);
    if (ts.isVariableStatement(node)) {
      let state = cloneState(input);
      for (const declaration of node.declarationList.declarations) {
        recordState(declaration, state);
        if (!declaration.initializer) continue;
        const initializer = evaluateExpression(declaration.initializer, state);
        state = initializer.state;
        recordState(declaration.name, state);
        bindDeclarationPattern(
          declaration.name,
          initializer.value,
          state,
        );
      }
      return emptyFlow(state);
    }
    if (ts.isExpressionStatement(node)) {
      return emptyFlow(evaluateExpression(node.expression, input).state);
    }
    if (ts.isIfStatement(node)) {
      const condition = evaluateExpression(node.expression, input);
      const whenTrue = evaluateStatement(node.thenStatement, condition.state);
      const whenFalse = node.elseStatement
        ? evaluateStatement(node.elseStatement, condition.state)
        : emptyFlow(cloneState(condition.state));
      const result = emptyFlow(joinStates(whenTrue.normal, whenFalse.normal));
      mergeAbrupt(result, whenTrue);
      mergeAbrupt(result, whenFalse);
      return result;
    }
    if (ts.isWhileStatement(node)) {
      return evaluateLoop(input, node.expression, node.statement, undefined, false, label);
    }
    if (ts.isDoStatement(node)) {
      const first = evaluateStatement(node.statement, input);
      const firstContinues = first.continues
        .filter((completion) => completion.label === undefined || completion.label === label)
        .map((completion) => completion.state);
      const firstBack = joinStates(first.normal, ...firstContinues);
      const rest = evaluateLoop(firstBack, node.expression, node.statement, undefined, true, label);
      const firstBreaks = first.breaks
        .filter((completion) => completion.label === undefined || completion.label === label)
        .map((completion) => completion.state);
      rest.normal = joinStates(rest.normal, ...firstBreaks);
      rest.breaks.push(...first.breaks.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ));
      rest.continues.push(...first.continues.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ));
      rest.returns.push(...first.returns);
      rest.throws.push(...first.throws);
      return rest;
    }
    if (ts.isForStatement(node)) {
      let state = cloneState(input);
      if (node.initializer) {
        if (ts.isVariableDeclarationList(node.initializer)) {
          for (const declaration of node.initializer.declarations) {
            recordState(declaration, state);
            if (!declaration.initializer) continue;
            const initialized = evaluateExpression(declaration.initializer, state);
            state = initialized.state;
            bindDeclarationPattern(
              declaration.name,
              initialized.value,
              state,
            );
          }
        } else {
          state = evaluateExpression(node.initializer, state).state;
        }
      }
      return evaluateLoop(state, node.condition, node.statement, node.incrementor, false, label);
    }
    if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      const expression = evaluateExpression(node.expression, input);
      let head = cloneState(expression.state);
      let body: FlowResult | undefined;
      for (;;) {
        const iteration = cloneState(head);
        if (ts.isVariableDeclarationList(node.initializer)) {
          for (const declaration of node.initializer.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              const binding = resolveBinding(declaration.name, declaration.name.text);
              if (binding) updateBinding(iteration, binding, emptyGlobals);
            }
          }
        } else if (ts.isIdentifier(node.initializer)) {
          const binding = resolveBinding(node.initializer, node.initializer.text);
          if (binding) updateBinding(iteration, binding, emptyGlobals);
        }
        body = evaluateStatement(node.statement, iteration);
        const continued = body.continues
          .filter((completion) => completion.label === undefined || completion.label === label)
          .map((completion) => completion.state);
        const back = joinStates(body.normal, ...continued);
        const nextHead = joinStates(expression.state, back);
        if (statesEqual(head, nextHead)) break;
        head = nextHead;
      }
      const finalBody = body!;
      const consumedBreaks = finalBody.breaks
        .filter((completion) => completion.label === undefined || completion.label === label)
        .map((completion) => completion.state);
      const result = emptyFlow(joinStates(expression.state, head, ...consumedBreaks));
      result.breaks.push(...finalBody.breaks.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ));
      result.continues.push(...finalBody.continues.filter((completion) =>
        completion.label !== undefined && completion.label !== label
      ));
      result.returns.push(...finalBody.returns);
      result.throws.push(...finalBody.throws);
      return result;
    }
    if (ts.isReturnStatement(node)) {
      const returned = node.expression
        ? evaluateExpression(node.expression, input)
        : { state: cloneState(input), value: emptyGlobals };
      localFunctionReturns.add(node);
      const result = emptyFlow(undefined);
      result.returns.push({ state: returned.state, value: returned.value });
      return result;
    }
    if (ts.isThrowStatement(node)) {
      const thrown = node.expression
        ? evaluateExpression(node.expression, input).state
        : cloneState(input);
      const result = emptyFlow(undefined);
      result.throws.push(thrown);
      return result;
    }
    if (ts.isBreakStatement(node)) {
      const result = emptyFlow(undefined);
      result.breaks.push({ label: node.label?.text, state: cloneState(input) });
      return result;
    }
    if (ts.isContinueStatement(node)) {
      const result = emptyFlow(undefined);
      result.continues.push({ label: node.label?.text, state: cloneState(input) });
      return result;
    }
    if (ts.isSwitchStatement(node)) {
      const expression = evaluateExpression(node.expression, input);
      let fallthrough: MutableAliasState | undefined;
      const exits: MutableAliasState[] = [];
      const result = emptyFlow(undefined);
      let hasDefault = false;
      for (const clause of node.caseBlock.clauses) {
        hasDefault ||= ts.isDefaultClause(clause);
        let state = joinStates(expression.state, fallthrough);
        if (ts.isCaseClause(clause)) state = evaluateExpression(clause.expression, state).state;
        const branch = evaluateStatements(clause.statements, state);
        fallthrough = branch.normal;
        exits.push(...branch.breaks
          .filter((completion) => completion.label === undefined || completion.label === label)
          .map((completion) => completion.state));
        result.breaks.push(...branch.breaks.filter((completion) =>
          completion.label !== undefined && completion.label !== label
        ));
        result.continues.push(...branch.continues);
        result.returns.push(...branch.returns);
        result.throws.push(...branch.throws);
      }
      if (fallthrough) exits.push(fallthrough);
      if (!hasDefault) exits.push(expression.state);
      result.normal = joinStates(...exits);
      return result;
    }
    if (ts.isTryStatement(node)) {
      const attempted = evaluateStatement(node.tryBlock, input);
      const caught = node.catchClause
        ? evaluateStatement(node.catchClause.block, joinStates(input, ...attempted.throws))
        : emptyFlow(undefined);
      const result = emptyFlow(joinStates(attempted.normal, caught.normal));
      result.breaks.push(...attempted.breaks);
      result.continues.push(...attempted.continues);
      result.returns.push(...attempted.returns);
      if (!node.catchClause) result.throws.push(...attempted.throws);
      mergeAbrupt(result, caught);
      return node.finallyBlock ? evaluateFinally(result, node.finallyBlock) : result;
    }
    if (ts.isLabeledStatement(node)) {
      const body = evaluateStatement(node.statement, input, node.label.text);
      const matchingBreaks = body.breaks
        .filter((completion) => completion.label === node.label.text)
        .map((completion) => completion.state);
      body.normal = joinStates(body.normal, ...matchingBreaks);
      body.breaks = body.breaks.filter((completion) => completion.label !== node.label.text);
      return body;
    }
    if (ts.isClassDeclaration(node)) {
      return emptyFlow(evaluateClassExecutable(node, input));
    }
    if (ts.isFunctionDeclaration(node)) {
      return emptyFlow(cloneState(input));
    }
    let state = cloneState(input);
    ts.forEachChild(node, (child) => {
      if (ts.isExpression(child)) state = evaluateExpression(child, state).state;
    });
    return emptyFlow(state);
  }

  function evaluateFinally(base: FlowResult, block: ts.Block): FlowResult {
    const result = emptyFlow(undefined);
    const apply = (
      state: MutableAliasState,
      preserve: (state: MutableAliasState) => void,
    ): void => {
      const finalized = evaluateStatement(block, state);
      mergeAbrupt(result, finalized);
      if (finalized.normal) preserve(finalized.normal);
    };
    if (base.normal) {
      apply(base.normal, (state) => {
        result.normal = joinStates(result.normal, state);
      });
    }
    for (const completion of base.breaks) {
      apply(completion.state, (state) => {
        result.breaks.push({ label: completion.label, state });
      });
    }
    for (const completion of base.continues) {
      apply(completion.state, (state) => {
        result.continues.push({ label: completion.label, state });
      });
    }
    for (const completion of base.returns) {
      apply(completion.state, (state) => {
        result.returns.push({ state, value: completion.value });
      });
    }
    for (const state of base.throws) {
      apply(state, (finalized) => result.throws.push(finalized));
    }
    return result;
  }

  function evaluateClassExecutable(
    node: ts.ClassLikeDeclaration,
    input: BrowserAliasState,
  ): MutableAliasState {
    let state = cloneState(input);
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) {
        state = evaluateExpression(type.expression, state).state;
        for (const argument of type.typeArguments ?? []) {
          void argument;
        }
      }
    }
    for (const member of node.members) {
      const named = member as ts.NamedDeclaration;
      if (named.name && ts.isComputedPropertyName(named.name)) {
        state = evaluateExpression(named.name.expression, state).state;
      }
      if (ts.isPropertyDeclaration(member) && member.initializer) {
        state = evaluateExpression(member.initializer, state).state;
      } else if (ts.isClassStaticBlockDeclaration(member)) {
        const block = evaluateStatement(member.body, state);
        state = joinStates(
          block.normal,
          ...block.breaks.map((completion) => completion.state),
          ...block.continues.map((completion) => completion.state),
          ...block.returns.map((completion) => completion.state),
          ...block.throws,
        );
      }
    }
    return state;
  }

  const activeFunctions = new Set<ts.FunctionLikeDeclaration>();
  const functionCallCache = new Map<
    ts.FunctionLikeDeclaration,
    Map<string, ExpressionResult>
  >();
  let evaluateLocalCalls = true;
  function evaluateLocalFunctionCall(
    implementation: ts.FunctionLikeDeclaration,
    callerState: BrowserAliasState,
    argumentValues: readonly BrowserGlobalSet[],
  ): ExpressionResult {
    if (activeFunctions.has(implementation)) {
      return {
        state: cloneState(callerState),
        value: unionGlobals(...argumentValues),
      };
    }
    const signature = JSON.stringify({
      state: [...callerState]
        .map(([binding, values]) => [binding.id, [...values].sort()] as const)
        .sort(([left], [right]) => left - right),
      arguments: argumentValues.map((values) => [...values].sort()),
    });
    const cached = functionCallCache.get(implementation)?.get(signature);
    if (cached) return { state: cloneState(cached.state), value: new Set(cached.value) };
    activeFunctions.add(implementation);
    try {
      let state = cloneState(callerState);
      for (const [index, parameter] of implementation.parameters.entries()) {
        let value = argumentValues[index] ?? emptyGlobals;
        if (parameter.initializer) {
          const initialized = evaluateExpression(parameter.initializer, state);
          state = initialized.state;
          if (!argumentValues[index]) value = initialized.value;
        }
        bindDeclarationPattern(parameter.name, value, state);
      }
      let flow: FlowResult;
      let value: BrowserGlobalSet = emptyGlobals;
      if (implementation.body && ts.isBlock(implementation.body)) {
        flow = evaluateStatements(implementation.body.statements, state);
        value = unionGlobals(...flow.returns.map((completion) => completion.value));
      } else if (implementation.body) {
        const returned = evaluateExpression(implementation.body, state);
        localFunctionReturns.add(implementation as ts.ArrowFunction);
        flow = emptyFlow(undefined);
        flow.returns.push({ state: returned.state, value: returned.value });
        value = returned.value;
      } else {
        flow = emptyFlow(state);
      }
      const completed = joinStates(
        flow.normal,
        ...flow.returns.map((completion) => completion.state),
        ...flow.throws,
      );
      const projected = cloneState(callerState);
      for (const [binding, values] of completed) {
        if (!bindingInside(binding, implementation)) updateBinding(projected, binding, values);
      }
      const result = { state: projected, value };
      let cache = functionCallCache.get(implementation);
      if (!cache) {
        cache = new Map();
        functionCallCache.set(implementation, cache);
      }
      cache.set(signature, { state: cloneState(result.state), value: new Set(result.value) });
      return result;
    } finally {
      activeFunctions.delete(implementation);
    }
  }
  const executionScope = (node: ts.Node): ts.Node => {
    let current: ts.Node | undefined = node;
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
      current = current.parent;
    }
    return current ?? root;
  };
  const seedFor = (scope: ts.Node): MutableAliasState => {
    const seed = new Map<AliasBinding, BrowserGlobalSet>();
    for (const [binding, values] of possibleAliases) {
      if (values.size > 0 && !bindingInside(binding, scope)) seed.set(binding, values);
    }
    return seed;
  };
  if (ts.isSourceFile(root)) evaluateStatements(root.statements, new Map());
  const functionBody = (node: ts.Node): ts.ConciseBody | undefined => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isConstructorDeclaration(node)
    ) {
      return node.body;
    }
    return undefined;
  };
  function analyzeFunctions(node: ts.Node): void {
    const body = functionBody(node);
    if (body && ts.isFunctionLike(node)) {
      let state = seedFor(node);
      for (const parameter of node.parameters) {
        if (parameter.initializer) {
          const initialized = evaluateExpression(parameter.initializer, state);
          state = initialized.state;
          bindDeclarationPattern(parameter.name, initialized.value, state);
        } else {
          bindDeclarationPattern(parameter.name, emptyGlobals, state);
        }
      }
      if (ts.isBlock(body)) evaluateStatements(body.statements, state);
      else evaluateExpression(body, state);
    }
    ts.forEachChild(node, analyzeFunctions);
  }
  evaluateLocalCalls = false;
  analyzeFunctions(root);
  evaluateLocalCalls = true;
  const privilegedReturnMemo = new Map<ts.FunctionLikeDeclaration, boolean>();
  const expressionCanReturnPrivilegedBrowserObject = (
    expression: ts.Expression,
    resolvingFunctions: ReadonlySet<ts.FunctionLikeDeclaration> = new Set(),
  ): boolean => {
    if (
      ts.isIdentifier(expression) &&
      PRIVILEGED_BROWSER_GLOBALS.has(expression.text) &&
      resolveBinding(expression, expression.text) === undefined
    ) {
      return true;
    }
    if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
      for (const implementation of callImplementations(expression.expression)) {
        if (resolvingFunctions.has(implementation)) continue;
        const cached = privilegedReturnMemo.get(implementation);
        if (cached !== undefined) {
          if (cached) return true;
          continue;
        }
        const nextFunctions = new Set(resolvingFunctions).add(implementation);
        const returnsPrivileged = (returnsByFunction.get(implementation) ?? []).some((returned) =>
          expressionCanReturnPrivilegedBrowserObject(returned, nextFunctions)
        );
        privilegedReturnMemo.set(implementation, returnsPrivileged);
        if (returnsPrivileged) return true;
      }
    }
    let found = false;
    ts.forEachChild(expression, (child) => {
      if (!found && ts.isExpression(child) && !ts.isFunctionLike(child)) {
        found = expressionCanReturnPrivilegedBrowserObject(child, resolvingFunctions);
      }
    });
    return found;
  };
  const replayFunctionReturnsTaintedObject = (
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    const replayParameters = new Set(
      implementation.parameters
        .filter((parameter): parameter is ts.ParameterDeclaration & { name: ts.Identifier } =>
          ts.isIdentifier(parameter.name)
        )
        .map((parameter) => resolveBinding(parameter.name, parameter.name.text))
        .filter((binding): binding is AliasBinding =>
          binding !== undefined && replayEventParameters.has(binding)
        ),
    );
    if (replayParameters.size === 0 || !implementation.body) return false;
    const returnsReplayParameter = (returnsByFunction.get(implementation) ?? []).some((returned) =>
      ts.isIdentifier(returned) &&
      replayParameters.has(resolveBinding(returned, returned.text)!)
    );
    if (!returnsReplayParameter) return false;
    let writesPrivilegedProperty = false;
    const inspect = (node: ts.Node): void => {
      if (writesPrivilegedProperty || (node !== implementation.body && ts.isFunctionLike(node))) {
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
        ts.isIdentifier(node.left.expression) &&
        replayParameters.has(resolveBinding(node.left.expression, node.left.expression.text)!) &&
        expressionCanReturnPrivilegedBrowserObject(node.right)
      ) {
        writesPrivilegedProperty = true;
        return;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(implementation.body);
    return writesPrivilegedProperty;
  };
  const callReturnsTaintedReplayObject = (expression: ts.Expression): boolean =>
    (ts.isCallExpression(expression) || ts.isNewExpression(expression)) &&
    [...callImplementations(expression.expression)].some(replayFunctionReturnsTaintedObject);
  const deferredTrackedMemo = new Map<ts.Expression, boolean>();
  const containsDeferredTrackedBrowserObject = (
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean => {
    const cached = deferredTrackedMemo.get(expression);
    if (cached !== undefined) return cached;
    if (resolvingNodes.has(expression)) return false;
    const nextNodes = new Set(resolvingNodes).add(expression);
    const containsReturnedTrackedValue = (implementation: ts.FunctionLikeDeclaration): boolean => {
      if (!implementation.body) return false;
      if (!ts.isBlock(implementation.body)) {
        return trackedBrowserObjectExpressions.has(implementation.body) ||
          callReturnsTaintedReplayObject(implementation.body) ||
          containsDeferredTrackedBrowserObject(
            implementation.body,
            resolvingBindings,
            nextNodes,
          );
      }
      let found = false;
      const inspect = (node: ts.Node): void => {
        if (found || (node !== implementation.body && ts.isFunctionLike(node))) return;
        if (
          (ts.isReturnStatement(node) || ts.isYieldExpression(node)) &&
          node.expression &&
          (trackedBrowserObjectExpressions.has(node.expression) ||
            callReturnsTaintedReplayObject(node.expression) ||
            containsDeferredTrackedBrowserObject(
              node.expression,
              resolvingBindings,
              nextNodes,
            ))
        ) {
          found = true;
          return;
        }
        ts.forEachChild(node, inspect);
      };
      inspect(implementation.body);
      return found;
    };
    let result = false;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      result = containsDeferredTrackedBrowserObject(
        expression.expression,
        resolvingBindings,
        nextNodes,
      );
    } else if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      result = containsReturnedTrackedValue(expression);
    } else if (ts.isObjectLiteralExpression(expression)) {
      result = expression.properties.some((property) => {
        if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)) {
          return containsReturnedTrackedValue(property);
        }
        if (ts.isPropertyAssignment(property)) {
          return containsDeferredTrackedBrowserObject(
            property.initializer,
            resolvingBindings,
            nextNodes,
          );
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          return containsDeferredTrackedBrowserObject(
            property.name,
            resolvingBindings,
            nextNodes,
          );
        }
        return ts.isSpreadAssignment(property) && containsDeferredTrackedBrowserObject(
          property.expression,
          resolvingBindings,
          nextNodes,
        );
      });
    } else if (ts.isArrayLiteralExpression(expression)) {
      result = expression.elements.some((element) =>
        !ts.isOmittedExpression(element) && containsDeferredTrackedBrowserObject(
          ts.isSpreadElement(element) ? element.expression : element,
          resolvingBindings,
          nextNodes,
        )
      );
    } else if (ts.isConditionalExpression(expression)) {
      result = containsDeferredTrackedBrowserObject(
        expression.whenTrue,
        resolvingBindings,
        nextNodes,
      ) || containsDeferredTrackedBrowserObject(
        expression.whenFalse,
        resolvingBindings,
        nextNodes,
      );
    } else if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
      result = (expression.arguments ?? []).some((argument) =>
        containsDeferredTrackedBrowserObject(
          ts.isSpreadElement(argument) ? argument.expression : argument,
          resolvingBindings,
          nextNodes,
        )
      );
    } else if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (binding && !resolvingBindings.has(binding)) {
        const nextBindings = new Set(resolvingBindings).add(binding);
        result = (relationsByTarget.get(binding) ?? []).some((relation) =>
          containsDeferredTrackedBrowserObject(relation.source, nextBindings, nextNodes)
        );
      }
    }
    deferredTrackedMemo.set(expression, result);
    return result;
  };
  return {
    valuesBefore,
    propertyValuesBefore,
    callValues,
    analyzedLocalCalls,
    localFunctionReturns,
    resolveBinding,
    isDynamicFunctionConstructor,
    containsTrackedBrowserObject: (node) => trackedBrowserObjectExpressions.has(node),
    containsDeferredTrackedBrowserObject,
    isCapturedBinding: (node, binding) => !bindingInside(binding, executionScope(node)),
    isInertReplayEventConstructor,
    isInertEventTargetAssignment,
  };
}

type ScopedStaticStrings = {
  constants: ReadonlyMap<AliasBinding, ts.Expression>;
  resolveBinding(node: ts.Node, name: string): AliasBinding | undefined;
};

function collectScopedStaticStrings(
  root: ts.Node,
  bindings: BrowserAliasAnalysis,
): ScopedStaticStrings {
  const constants = new Map<AliasBinding, ts.Expression>();
  const ambiguous = new Set<AliasBinding>();
  function collect(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const binding = bindings.resolveBinding(node.name, node.name.text);
      if (binding) {
        if (constants.has(binding)) {
          constants.delete(binding);
          ambiguous.add(binding);
        } else if (!ambiguous.has(binding)) {
          constants.set(binding, node.initializer);
        }
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(root);
  return { constants, resolveBinding: bindings.resolveBinding };
}

function scopedStaticString(
  node: ts.Expression,
  analysis: ScopedStaticStrings,
  resolving: ReadonlySet<AliasBinding> = new Set(),
): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return scopedStaticString(node.expression, analysis, resolving);
  }
  if (ts.isIdentifier(node)) {
    const binding = analysis.resolveBinding(node, node.text);
    if (!binding || resolving.has(binding)) return undefined;
    const initializer = analysis.constants.get(binding);
    if (!initializer) return undefined;
    return scopedStaticString(
      initializer,
      analysis,
      new Set([...resolving, binding]),
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = scopedStaticString(node.left, analysis, resolving);
    const right = scopedStaticString(node.right, analysis, resolving);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = scopedStaticString(span.expression, analysis, resolving);
      if (expression === undefined) return undefined;
      value += expression + span.literal.text;
    }
    return value;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "join" &&
    ts.isArrayLiteralExpression(node.expression.expression) &&
    node.arguments.length <= 1
  ) {
    const separator = node.arguments.length === 0
      ? ","
      : scopedStaticString(node.arguments[0]!, analysis, resolving);
    if (separator === undefined) return undefined;
    const values = node.expression.expression.elements.map((element) =>
      ts.isSpreadElement(element)
        ? undefined
        : scopedStaticString(element as ts.Expression, analysis, resolving),
    );
    return values.some((value) => value === undefined)
      ? undefined
      : (values as string[]).join(separator);
  }
  return undefined;
}

function containsPrivilegedBrowserGlobal(
  node: ts.Expression,
  analysis: BrowserAliasAnalysis,
  directOnly = false,
): boolean {
  const browserGlobal = directOnly ? directBrowserGlobal : privilegedBrowserGlobal;
  if (browserGlobal(node, analysis) !== undefined) return true;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) =>
      ts.isSpreadElement(element)
        ? containsPrivilegedBrowserGlobal(element.expression, analysis, directOnly)
        : containsPrivilegedBrowserGlobal(element as ts.Expression, analysis, directOnly),
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return containsPrivilegedBrowserGlobal(property.expression, analysis, directOnly);
      }
      if (ts.isPropertyAssignment(property)) {
        return containsPrivilegedBrowserGlobal(property.initializer, analysis, directOnly);
      }
      return ts.isShorthandPropertyAssignment(property) &&
        browserGlobal(property.name, analysis) !== undefined;
    });
  }
  return false;
}

function browserGlobalEscapes(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
  directOnly = false,
  allowAnalyzedLocalFlows = false,
): boolean {
  const browserGlobal = directOnly ? directBrowserGlobal : privilegedBrowserGlobal;
  const contains = (expression: ts.Expression): boolean =>
    containsPrivilegedBrowserGlobal(expression, analysis, directOnly) ||
    (allowAnalyzedLocalFlows && !directOnly &&
      analysis.containsTrackedBrowserObject(expression));
  const isAliasReference = (expression: ts.Expression): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isAliasReference(expression.expression);
    }
    return ts.isIdentifier(expression);
  };
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    if ((node.arguments ?? []).some((argument) =>
      analysis.containsDeferredTrackedBrowserObject(
        ts.isSpreadElement(argument) ? argument.expression : argument,
      )
    )) {
      return true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "call" &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "hasOwnProperty" &&
      ts.isPropertyAccessExpression(node.expression.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression.expression) &&
      node.expression.expression.expression.expression.text === "Object" &&
      !analysis.resolveBinding(
        node.expression.expression.expression.expression,
        "Object",
      )
    ) {
      return false;
    }
    if (allowAnalyzedLocalFlows && analysis.analyzedLocalCalls.has(node)) {
      return (node.arguments ?? []).some((argument) =>
        containsPrivilegedBrowserGlobal(
          ts.isSpreadElement(argument) ? argument.expression : argument,
          analysis,
          true,
        )
      );
    }
    return (node.arguments ?? []).some((argument) =>
      ts.isSpreadElement(argument)
        ? contains(argument.expression)
        : contains(argument),
    );
  }
  if (ts.isReturnStatement(node) && node.expression) {
    if (allowAnalyzedLocalFlows && analysis.localFunctionReturns.has(node)) return false;
    return contains(node.expression);
  }
  if (ts.isYieldExpression(node) && node.expression) {
    return contains(node.expression);
  }
  if (
    ts.isArrowFunction(node) &&
    !ts.isBlock(node.body) &&
    contains(node.body)
  ) {
    if (allowAnalyzedLocalFlows && analysis.localFunctionReturns.has(node)) return false;
    return true;
  }
  if (ts.isParameter(node) && node.initializer) {
    return contains(node.initializer);
  }
  if (ts.isPropertyDeclaration(node) && node.initializer) {
    return contains(node.initializer);
  }
  if (ts.isTaggedTemplateExpression(node)) {
    return ts.isTemplateExpression(node.template) &&
      node.template.templateSpans.some((span) =>
        contains(span.expression)
      );
  }
  if (ts.isJsxExpression(node) && node.expression) {
    return contains(node.expression);
  }
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const direct = browserGlobal(node.initializer, analysis);
    if (
      allowAnalyzedLocalFlows &&
      ts.isIdentifier(node.name) &&
      isAliasReference(node.initializer)
    ) {
      return false;
    }
    return !ts.isIdentifier(node.name)
      ? contains(node.initializer)
      : direct === undefined && contains(node.initializer);
  }
  if (
    ts.isBinaryExpression(node) &&
    isValuePropagatingAssignment(node.operatorToken.kind)
  ) {
    const direct = browserGlobal(node.right, analysis);
    if (
      allowAnalyzedLocalFlows &&
      ts.isIdentifier(node.left) &&
      isAliasReference(node.right)
    ) {
      return false;
    }
    if (allowAnalyzedLocalFlows && analysis.isInertEventTargetAssignment(node)) {
      return false;
    }
    if (ts.isIdentifier(node.left) && direct !== undefined) {
      const binding = analysis.resolveBinding(node.left, node.left.text);
      if (binding && analysis.isCapturedBinding(node, binding)) return true;
    }
    return !ts.isIdentifier(node.left)
      ? contains(node.right)
      : direct === undefined && contains(node.right);
  }
  return false;
}

function reflectBrowserGlobalCall(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
): string | undefined {
  if (!ts.isCallExpression(node) || node.arguments.length === 0) return undefined;
  const expression = node.expression;
  const reflectIdentifier = ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ? expression.expression
    : undefined;
  if (
    !reflectIdentifier ||
    !ts.isIdentifier(reflectIdentifier) ||
    reflectIdentifier.text !== "Reflect" ||
    analysis.resolveBinding(reflectIdentifier, "Reflect")
  ) {
    return undefined;
  }
  const method = ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression)
    ? expression.name.text
    : ts.isElementAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.argumentExpression
      ? staticString(expression.argumentExpression)
      : undefined;
  if (!method) return undefined;
  return containsPrivilegedBrowserGlobal(node.arguments[0]!, analysis)
    ? `Reflect.${method}`
    : undefined;
}

function remoteUrlDetails(value: string): string[] {
  const details: string[] = [];
  for (const match of value.matchAll(/https?:\/\/[^\s"'`)<>,]+/gi)) {
    details.push(match[0]!.slice(0, 512));
  }
  if (!details.some((detail) => /^https?:/i.test(detail)) && /https?:\/\//i.test(value)) {
    details.push("constructed absolute URL");
  }
  for (const match of value.matchAll(
    /(?:^|[^:])(\/\/(?:[a-z0-9-]+\.)+[a-z0-9-]+(?::\d+)?(?:\/[^\s"'`)<>,]*)?)/gi,
  )) {
    details.push(match[1]!.slice(0, 512));
  }
  if (!details.some((detail) => detail.startsWith("//")) && /(?:^|[^:])\/\/[^/\s]/.test(value)) {
    details.push("constructed protocol-relative URL");
  }
  return details;
}

function allowedRemote(file: string, detail: string): boolean {
  if (NON_NETWORK_REFERENCES.some((reference) => detail.startsWith(reference))) {
    return true;
  }
  if (
    detail.startsWith(OFFICIAL_IMAGE_BASE) &&
    (file === "src/ui/hooks/useCardImage.ts" ||
      (file.startsWith("dist/assets/") && /\.(?:js|mjs)$/.test(file)))
  ) {
    return true;
  }
  if (
    file === "dist/_headers" &&
    ["https://www.takaratomy.co.jp", "https://www.takaratomy.co.jp;"].includes(detail)
  ) {
    return true;
  }
  return (
    file.startsWith("dist/assets/") &&
    DIST_DIAGNOSTIC_REFERENCES.some((reference) => detail.startsWith(reference))
  );
}

function inspectRemoteText(
  findings: RuntimeBoundaryFinding[],
  file: string,
  value: string,
): void {
  for (const detail of remoteUrlDetails(value)) {
    if (!allowedRemote(file, detail)) {
      addFinding(findings, file, "external-origin", detail);
    }
  }
}

function scanStyle(root: string, absolute: string, source: string): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  inspectRemoteText(findings, file, source);
  const analysis = analyzeCss(source, file, "stylesheet");
  if (analysis.invalid) {
    addFinding(findings, file, "invalid-style", "CSS parsing failed or warned");
  }
  for (const dependency of analysis.dependencies) {
    if (dependency.type === "url" || dependency.type === "import") {
      inspectRemoteText(findings, file, dependency.url);
    } else {
      addFinding(findings, file, "invalid-style", "unsupported CSS dependency");
    }
  }
  return findings;
}

function inspectInlineStyle(
  findings: RuntimeBoundaryFinding[],
  file: string,
  source: string,
  surface: CssSurface,
): void {
  inspectRemoteText(findings, file, source);
  const analysis = analyzeCss(source, file, surface);
  if (analysis.invalid) {
    addFinding(findings, file, "invalid-style", "CSS parsing failed or warned");
  }
  for (const dependency of analysis.dependencies) {
    if (dependency.type === "url" || dependency.type === "import") {
      inspectRemoteText(findings, file, dependency.url);
    } else {
      addFinding(findings, file, "invalid-style", "unsupported CSS dependency");
    }
  }
}

function inspectRuntimeCssText(
  findings: RuntimeBoundaryFinding[],
  file: string,
  source: string,
): void {
  const decoded = source.replace(
    /\\([0-9a-f]{1,6}[\t\n\f\r ]?|[^\n\r\f0-9a-f])/gi,
    (_match, escaped: string) => {
      const hex = escaped.match(/^[0-9a-f]{1,6}/i)?.[0];
      if (!hex) return escaped;
      const point = Number.parseInt(hex, 16);
      return point === 0 || point > 0x10ffff ? "\uFFFD" : String.fromCodePoint(point);
    },
  );
  if (!/(?:url|image-set|@import|https?:|\/\/)/i.test(decoded)) return;
  for (const candidate of [source, `background-image:${source}`]) {
    const analysis = analyzeCss(candidate, file, "declaration-list");
    for (const dependency of analysis.dependencies) {
      if (dependency.type === "url" || dependency.type === "import") {
        inspectRemoteText(findings, file, dependency.url);
      }
    }
  }
}

function isJavascriptUrl(value: string): boolean {
  try {
    return new URL(value, "https://private-hosted.invalid/").protocol.toLowerCase() ===
      "javascript:";
  } catch {
    let offset = 0;
    while (offset < value.length && value.charCodeAt(offset) <= 0x20) offset += 1;
    return value.slice(offset).toLowerCase().startsWith("javascript:");
  }
}

function scanHtml(root: string, absolute: string, source: string): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  inspectRemoteText(findings, file, source);
  for (const match of source.matchAll(/\s(on[a-z][a-z0-9_-]*)\s*=/gi)) {
    addFinding(findings, file, "html-execution", match[1]!.toLowerCase());
  }
  if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(source)) {
    addFinding(findings, file, "html-execution", "javascript URL");
  }
  if (/\ssrcdoc\s*=/i.test(source)) {
    addFinding(findings, file, "html-execution", "srcdoc");
  }
  type HtmlNode = {
    tagName?: string;
    nodeName?: string;
    value?: string;
    attrs?: readonly { name: string; value: string }[];
    childNodes?: readonly HtmlNode[];
    content?: HtmlNode;
  };
  const pending: HtmlNode[] = [parse(source) as unknown as HtmlNode];
  while (pending.length > 0) {
    const node = pending.pop()!;
    for (const attribute of node.attrs ?? []) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      inspectRemoteText(findings, file, value);
      if (name.startsWith("on")) {
        addFinding(findings, file, "html-execution", name);
      } else if (name === "srcdoc") {
        addFinding(findings, file, "html-execution", "srcdoc");
      } else if (name === "style") {
        inspectInlineStyle(findings, file, value, "declaration-list");
      } else if (
        ["action", "formaction", "href", "src"].includes(name) &&
        isJavascriptUrl(value)
      ) {
        addFinding(findings, file, "html-execution", "javascript URL");
      }
    }
    if (node.tagName?.toLowerCase() === "style") {
      const css = (node.childNodes ?? []).map((child) => child.value ?? "").join("");
      inspectInlineStyle(findings, file, css, "stylesheet");
    }
    if (node.content) pending.push(node.content);
    pending.push(...(node.childNodes ?? []));
  }
  return findings;
}

function scanSvg(root: string, absolute: string, source: string): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  inspectRemoteText(findings, file, source);
  if (/<style\b|\sstyle\s*=/i.test(source)) {
    addFinding(findings, file, "svg-style", "SVG CSS is forbidden");
  }
  if (/\son[a-z][a-z0-9_-]*\s*=|\bjavascript:/i.test(source)) {
    addFinding(findings, file, "svg-execution", "SVG execution is forbidden");
  }
  return findings;
}

function scanData(root: string, absolute: string, source: string): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    addFinding(findings, file, "invalid-data", "invalid JSON");
    return findings;
  }
  const pending: unknown[] = [parsed];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === "string") {
      inspectRemoteText(findings, file, value);
    } else if (Array.isArray(value)) {
      pending.push(...value);
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        inspectRemoteText(findings, file, key);
        pending.push(item);
      }
    }
  }
  return findings;
}

function scanScriptOrigins(
  root: string,
  absolute: string,
  source: string,
): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const privilegedAliases = collectPrivilegedBrowserAliases(parsed);
  const staticStrings = collectScopedStaticStrings(parsed, privilegedAliases);
  function visit(node: ts.Node): void {
    if (isDynamicCodeExecution(node, privilegedAliases, true)) {
      addFinding(
        findings,
        file,
        "forbidden-bundle-marker",
        "dynamic code execution",
      );
    }
    const reflection = reflectBrowserGlobalCall(node, privilegedAliases);
    if (reflection) {
      addFinding(
        findings,
        file,
        "forbidden-bundle-marker",
        "browser global reflection",
      );
    } else if (browserGlobalEscapes(node, privilegedAliases, false, true)) {
      addFinding(findings, file, "forbidden-bundle-marker", "browser global escape");
    }
    if (
      ts.isElementAccessExpression(node) &&
      privilegedBrowserGlobal(node.expression, privilegedAliases) !== undefined
    ) {
      const browserGlobal = privilegedBrowserGlobal(node.expression, privilegedAliases)!;
      const property = scopedStaticString(node.argumentExpression, staticStrings);
      if (property === undefined) {
        addFinding(
          findings,
          file,
          "forbidden-bundle-marker",
          "dynamic browser property",
        );
      } else if (PERSISTENT_BROWSER_PROPERTIES.has(property)) {
        const detail = browserGlobal === "document" && property === "cookie"
          ? "document cookie"
          : browserGlobal === "navigator" && property === "storage"
            ? "storage manager"
            : "persistent storage";
        addFinding(findings, file, "forbidden-bundle-marker", detail);
      } else if (NETWORK_BROWSER_PROPERTIES.has(property)) {
        addFinding(findings, file, "forbidden-bundle-marker", "network API");
      } else if (property === "serviceWorker") {
        addFinding(findings, file, "forbidden-bundle-marker", "service worker");
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      privilegedBrowserGlobal(node.expression, privilegedAliases) !== undefined
    ) {
      const browserGlobal = privilegedBrowserGlobal(node.expression, privilegedAliases)!;
      const property = node.name.text;
      if (PERSISTENT_BROWSER_PROPERTIES.has(property)) {
        const detail = browserGlobal === "document" && property === "cookie"
          ? "document cookie"
          : browserGlobal === "navigator" && property === "storage"
            ? "storage manager"
            : "persistent storage";
        addFinding(findings, file, "forbidden-bundle-marker", detail);
      } else if (NETWORK_BROWSER_PROPERTIES.has(property)) {
        addFinding(findings, file, "forbidden-bundle-marker", "network API");
      } else if (property === "serviceWorker") {
        addFinding(findings, file, "forbidden-bundle-marker", "service worker");
      }
    }
    if (
      ts.isIdentifier(node) &&
      isUnboundRuntimeIdentifier(node, privilegedAliases)
    ) {
      if (node.text === "fetch") {
        addFinding(findings, file, "forbidden-bundle-marker", "bare fetch");
      } else if (PERSISTENT_BROWSER_PROPERTIES.has(node.text)) {
        addFinding(findings, file, "forbidden-bundle-marker", "persistent storage");
      }
    }
    if (ts.isNewExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
        NETWORK_BROWSER_PROPERTIES.has(node.expression.text)
      ) {
        addFinding(findings, file, "forbidden-bundle-marker", "network constructor");
      } else if (
        (ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)) &&
        privilegedBrowserGlobal(node.expression.expression, privilegedAliases) !== undefined
      ) {
        const constructor = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : node.expression.argumentExpression
            ? scopedStaticString(node.expression.argumentExpression, staticStrings)
            : undefined;
        if (constructor && NETWORK_BROWSER_PROPERTIES.has(constructor)) {
          addFinding(
            findings,
            file,
            "forbidden-bundle-marker",
            "qualified network constructor",
          );
        }
      }
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateExpression(node) ||
      (ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const evaluated = scopedStaticString(node as ts.Expression, staticStrings);
      if (evaluated !== undefined) {
        inspectRemoteText(findings, file, evaluated);
        inspectRuntimeCssText(findings, file, evaluated);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return findings;
}

async function buildOutputFiles(root: string): Promise<{
  files: string[];
  symlinks: string[];
}> {
  const dist = resolve(root, "dist");
  const pending = [dist];
  const files: string[] = [];
  const symlinks: string[] = [];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const outputPath = relative(dist, absolute).replace(/\\/g, "/");
      if (entry.isSymbolicLink()) {
        symlinks.push(outputPath);
      } else if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        files.push(outputPath);
      }
    }
  }
  return { files: files.sort(), symlinks: symlinks.sort() };
}

function safeOutputPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return (
    normalized === value &&
    normalized.length > 0 &&
    !isAbsolute(normalized) &&
    !normalized.split("/").includes("..")
  );
}

function scanSource(
  root: string,
  absolute: string,
  sourceFile: ts.SourceFile,
): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  if (NODE_HELPERS.has(file)) {
    addFinding(findings, file, "production-node-helper", "reachable from src/main.tsx");
  }
  for (const specifier of importsFrom(sourceFile)) {
    if (/[?#]/.test(specifier)) {
      addFinding(findings, file, "unsupported-import", specifier);
    }
    if (specifier.startsWith("node:")) {
      addFinding(findings, file, "server-import", specifier);
    }
    if (/\bmeta-app\b|\bdist-meta\b/.test(specifier)) {
      addFinding(findings, file, "meta-build", specifier);
    }
  }
  const privilegedAliases = collectPrivilegedBrowserAliases(sourceFile);
  const staticStrings = collectScopedStaticStrings(sourceFile, privilegedAliases);
  const elementProperty = (node: ts.ElementAccessExpression): string | undefined =>
    scopedStaticString(node.argumentExpression, staticStrings);
  const safeDynamicStyleProperties = new Set([
    "--reveal-index",
    "bottom",
    "color",
    "cursor",
    "display",
    "flex",
    "flexGrow",
    "flexShrink",
    "fontWeight",
    "gap",
    "height",
    "left",
    "margin",
    "maxHeight",
    "maxWidth",
    "minHeight",
    "minWidth",
    "opacity",
    "padding",
    "pointerEvents",
    "position",
    "right",
    "top",
    "transform",
    "transition",
    "width",
    "zIndex",
    "zoom",
  ]);
  const styleRelations = new Map<AliasBinding, ts.Expression[]>();
  function collectStyleRelations(node: ts.Node): void {
    let target: ts.Identifier | undefined;
    let source: ts.Expression | undefined;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      target = node.name;
      source = node.initializer;
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      target = node.left;
      source = node.right;
    }
    if (target && source) {
      const binding = privilegedAliases.resolveBinding(target, target.text);
      if (binding) {
        const values = styleRelations.get(binding) ?? [];
        values.push(source);
        styleRelations.set(binding, values);
      }
    }
    ts.forEachChild(node, collectStyleRelations);
  }
  collectStyleRelations(sourceFile);
  const runtimeStyleFinding = (detail: string): void =>
    addFinding(findings, file, "runtime-style", detail);
  const inspectStyleValue = (property: string, value: ts.Expression): void => {
    const evaluated = scopedStaticString(value, staticStrings);
    if (evaluated !== undefined) {
      inspectRemoteText(findings, file, evaluated);
      inspectRuntimeCssText(findings, file, evaluated);
      return;
    }
    if (!safeDynamicStyleProperties.has(property)) runtimeStyleFinding(property);
  };
  const stylePropertyName = (name: ts.PropertyName): string | undefined => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    return ts.isComputedPropertyName(name)
      ? scopedStaticString(name.expression, staticStrings)
      : undefined;
  };
  const inspectStyleExpression = (
    expression: ts.Expression,
    resolving = new Set<number>(),
  ): void => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      inspectStyleExpression(expression.expression, resolving);
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      inspectStyleExpression(expression.whenTrue, resolving);
      inspectStyleExpression(expression.whenFalse, resolving);
      return;
    }
    if (
      ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(expression.operatorToken.kind)
    ) {
      inspectStyleExpression(expression.left, resolving);
      inspectStyleExpression(expression.right, resolving);
      return;
    }
    if (
      expression.kind === ts.SyntaxKind.NullKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      (ts.isIdentifier(expression) &&
        expression.text === "undefined" &&
        !privilegedAliases.resolveBinding(expression, expression.text))
    ) {
      return;
    }
    if (ts.isIdentifier(expression)) {
      const binding = privilegedAliases.resolveBinding(expression, expression.text);
      if (!binding || resolving.has(binding.id)) {
        runtimeStyleFinding("unresolved style expression");
        return;
      }
      const relations = styleRelations.get(binding);
      if (!relations || relations.length === 0) {
        runtimeStyleFinding("unresolved style expression");
        return;
      }
      const next = new Set(resolving).add(binding.id);
      for (const relation of relations) inspectStyleExpression(relation, next);
      return;
    }
    if (!ts.isObjectLiteralExpression(expression)) {
      runtimeStyleFinding("unresolved style expression");
      return;
    }
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        runtimeStyleFinding("style spread");
      } else if (ts.isPropertyAssignment(property)) {
        const name = stylePropertyName(property.name);
        if (name === undefined) runtimeStyleFinding("dynamic style property");
        else inspectStyleValue(name, property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        inspectStyleValue(property.name.text, property.name);
      } else {
        runtimeStyleFinding("unsupported style member");
      }
    }
  };
  const styleContainer = (node: ts.Expression): boolean =>
    (ts.isPropertyAccessExpression(node) && node.name.text === "style") ||
    (ts.isElementAccessExpression(node) && elementProperty(node) === "style");
  function visit(node: ts.Node): void {
    if (isDynamicCodeExecution(node, privilegedAliases)) {
      addFinding(findings, file, "dynamic-code-execution", "eval/Function");
    }
    const reflection = reflectBrowserGlobalCall(node, privilegedAliases);
    if (reflection) {
      addFinding(findings, file, "browser-global-reflection", reflection);
    } else if (browserGlobalEscapes(node, privilegedAliases)) {
      addFinding(
        findings,
        file,
        "browser-global-escape",
        "privileged browser global",
      );
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const browserGlobal = privilegedBrowserGlobal(node.expression, privilegedAliases);
      if (browserGlobal !== undefined) {
        const property = ts.isPropertyAccessExpression(node)
          ? node.name.text
          : elementProperty(node);
        if (property === undefined) {
          addFinding(
            findings,
            file,
            "dynamic-browser-property",
            `${browserGlobal}[dynamic]`,
          );
        } else if (PERSISTENT_BROWSER_PROPERTIES.has(property)) {
          const detail = browserGlobal === "document" && property === "cookie"
            ? "document.cookie"
            : browserGlobal === "navigator" && property === "storage"
              ? "navigator.storage"
              : property;
          addFinding(findings, file, "persistent-storage", detail);
        } else if (NETWORK_BROWSER_PROPERTIES.has(property)) {
          addFinding(findings, file, "network-api", `${browserGlobal}.${property}`);
        } else if (property === "serviceWorker") {
          addFinding(findings, file, "service-worker", `${browserGlobal}.serviceWorker`);
        }
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      privilegedBrowserGlobal(node.expression, privilegedAliases) !== undefined &&
      elementProperty(node) === undefined
    ) {
      const browserGlobal = privilegedBrowserGlobal(node.expression, privilegedAliases)!;
      addFinding(
        findings,
        file,
        "dynamic-browser-property",
        `${browserGlobal}[dynamic]`,
      );
    }
    if (
      ts.isIdentifier(node) &&
      isUnboundRuntimeIdentifier(node, privilegedAliases) &&
      [
        "fetch",
        "sendBeacon",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "WebTransport",
        "RTCPeerConnection",
      ].includes(node.text)
    ) {
      addFinding(findings, file, "network-api", node.text);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      ["globalThis", "window", "self"].includes(node.expression.text) &&
      node.name.text === "fetch"
    ) {
      addFinding(findings, file, "network-api", `${node.expression.text}.fetch`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      ["globalThis", "window", "self"].includes(node.expression.text) &&
      elementProperty(node) === "fetch"
    ) {
      addFinding(findings, file, "network-api", `${node.expression.text}[fetch]`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "navigator" &&
      node.name.text === "sendBeacon"
    ) {
      addFinding(findings, file, "network-api", "navigator.sendBeacon");
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      [
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "WebTransport",
        "RTCPeerConnection",
        "Worker",
        "SharedWorker",
      ].includes(node.expression.text)
    ) {
      addFinding(findings, file, "network-api", node.expression.text);
    }
    if (
      ts.isNewExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression)) &&
      ts.isIdentifier(node.expression.expression) &&
      isUnboundRuntimeIdentifier(node.expression.expression, privilegedAliases) &&
      ["globalThis", "window", "self"].includes(node.expression.expression.text)
    ) {
      const constructor = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : elementProperty(node.expression);
      if (
        constructor &&
        [
          "XMLHttpRequest",
          "WebSocket",
          "EventSource",
          "WebTransport",
          "RTCPeerConnection",
          "Worker",
          "SharedWorker",
        ].includes(constructor)
      ) {
        addFinding(findings, file, "network-api", constructor);
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "navigator" &&
      node.name.text === "serviceWorker"
    ) {
      addFinding(findings, file, "service-worker", "navigator.serviceWorker");
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "navigator" &&
      elementProperty(node) === "serviceWorker"
    ) {
      addFinding(findings, file, "service-worker", "navigator[serviceWorker]");
    }
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "document" &&
      (ts.isPropertyAccessExpression(node)
        ? node.name.text === "cookie"
        : elementProperty(node) === "cookie")
    ) {
      addFinding(findings, file, "persistent-storage", "document.cookie");
    }
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "navigator" &&
      (ts.isPropertyAccessExpression(node)
        ? node.name.text === "storage"
        : elementProperty(node) === "storage")
    ) {
      addFinding(findings, file, "persistent-storage", "navigator.storage");
    }
    if (
      ts.isIdentifier(node) &&
      isUnboundRuntimeIdentifier(node, privilegedAliases) &&
      [
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "caches",
        "cookieStore",
        "openDatabase",
        "showOpenFilePicker",
        "showSaveFilePicker",
        "showDirectoryPicker",
      ].includes(node.text)
    ) {
      addFinding(findings, file, "persistent-storage", node.text);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      ["globalThis", "window", "self"].includes(node.expression.text) &&
      [
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "caches",
        "cookieStore",
        "openDatabase",
        "showOpenFilePicker",
        "showSaveFilePicker",
        "showDirectoryPicker",
      ].includes(elementProperty(node) ?? "")
    ) {
      addFinding(
        findings,
        file,
        "persistent-storage",
        elementProperty(node)!,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text.startsWith("VITE_") &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "env" &&
      ts.isMetaProperty(node.expression.expression) &&
      node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.expression.expression.name.text === "meta"
    ) {
      addFinding(findings, file, "vite-variable", node.name.text);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "env" &&
      ts.isMetaProperty(node.expression.expression) &&
      node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.expression.expression.name.text === "meta" &&
      (elementProperty(node)?.startsWith("VITE_") ?? false)
    ) {
      addFinding(findings, file, "vite-variable", elementProperty(node)!);
    }
    if (
      ts.isCallExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression)) &&
      (ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text === "glob"
        : elementProperty(node.expression) === "glob") &&
      ts.isMetaProperty(node.expression.expression) &&
      node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.expression.expression.name.text === "meta"
    ) {
      addFinding(findings, file, "unsupported-import", "import.meta.glob");
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      node.expression.text === "URL"
    ) {
      addFinding(findings, file, "network-api", "URL");
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "style"
    ) {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        inspectStyleExpression(node.initializer.expression);
      } else if (node.initializer && ts.isStringLiteral(node.initializer)) {
        inspectInlineStyle(findings, file, node.initializer.text, "declaration-list");
      } else {
        runtimeStyleFinding("unresolved style expression");
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const owner = node.left.expression;
      if (styleContainer(owner)) {
        const property = ts.isPropertyAccessExpression(node.left)
          ? node.left.name.text
          : elementProperty(node.left);
        if (property === undefined) runtimeStyleFinding("dynamic style property");
        else inspectStyleValue(property, node.right);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "setProperty" &&
      styleContainer(node.expression.expression) &&
      node.arguments.length >= 2
    ) {
      const property = scopedStaticString(node.arguments[0]!, staticStrings);
      if (property === undefined) runtimeStyleFinding("dynamic style property");
      else inspectStyleValue(property, node.arguments[1]!);
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateExpression(node) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const evaluated = scopedStaticString(node as ts.Expression, staticStrings);
      if (evaluated !== undefined) {
        inspectRemoteText(findings, file, evaluated);
        inspectRuntimeCssText(findings, file, evaluated);
      }
      else if (ts.isTemplateExpression(node)) {
        const partial = `${node.head.text}${node.templateSpans.map((span) => span.literal.text).join("")}`;
        inspectRemoteText(findings, file, partial);
        inspectRuntimeCssText(findings, file, partial);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}

async function inspectBuild(
  root: string,
  output: { stdout: string; stderr: string },
): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const combined = `${output.stdout}\n${output.stderr}`;
  if (/externalized for browser compatibility/i.test(combined)) {
    addFinding(findings, "build", "browser-externalization", "browser externalization warning");
  }
  if (/\b(?:build:meta|meta-app|dist-meta)\b/i.test(combined)) {
    addFinding(findings, "build", "meta-build", "meta build output");
  }
  if (await stat(resolve(root, "dist-meta")).then(() => true).catch(() => false)) {
    addFinding(findings, "dist-meta", "dist-meta", "forbidden output directory exists");
  }

  const manifestPath = resolve(root, "dist/.vite/manifest.json");
  type ManifestEntry = {
    file?: unknown;
    dynamicImports?: unknown;
    isEntry?: unknown;
    css?: unknown;
    assets?: unknown;
  };
  let manifest: Record<string, ManifestEntry>;
  try {
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    manifest = parsed as Record<string, ManifestEntry>;
  } catch {
    addFinding(findings, "dist/.vite/manifest.json", "production-manifest", "missing or invalid");
    return findings;
  }
  const entry = manifest["index.html"];
  if (!entry || entry.isEntry !== true) {
    addFinding(
      findings,
      "dist/.vite/manifest.json",
      "production-manifest",
      "index.html entry missing or invalid",
    );
  }
  const expectedFiles = new Set([
    ".vite/manifest.json",
    "_headers",
    "favicon.svg",
    "index.html",
  ]);
  for (const [key, value] of Object.entries(manifest)) {
    if (key !== "index.html" && value.isEntry === true) {
      addFinding(findings, "dist/.vite/manifest.json", "production-entry", key);
    }
    if (
      value.dynamicImports !== undefined &&
      !Array.isArray(value.dynamicImports)
    ) {
      addFinding(findings, "dist/.vite/manifest.json", "production-manifest", `invalid dynamic imports: ${key}`);
    } else if (Array.isArray(value.dynamicImports) && value.dynamicImports.length > 0) {
      addFinding(findings, "dist/.vite/manifest.json", "dynamic-import", key);
    }
    if (/tsv-loader-fs/i.test(key)) {
      addFinding(findings, "dist/.vite/manifest.json", "production-node-helper", key);
    }
    const outputs = [value.file];
    for (const field of [value.css, value.assets]) {
      if (field !== undefined && !Array.isArray(field)) {
        addFinding(findings, "dist/.vite/manifest.json", "production-manifest", `invalid output list: ${key}`);
      } else if (Array.isArray(field)) {
        outputs.push(...field);
      }
    }
    for (const outputPath of outputs) {
      if (typeof outputPath !== "string" || !safeOutputPath(outputPath)) {
        addFinding(
          findings,
          "dist/.vite/manifest.json",
          "production-manifest",
          `unsafe or invalid output: ${key}`,
        );
      } else {
        expectedFiles.add(outputPath);
        if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(outputPath)) {
          addFinding(findings, `dist/${outputPath}`, "server-hosted-image", "bundled raster image");
        }
      }
    }
  }

  const inventory = await buildOutputFiles(root).catch(() => undefined);
  if (!inventory) {
    addFinding(findings, "dist", "production-output", "missing or unreadable");
    return findings;
  }
  for (const symlink of inventory.symlinks) {
    addFinding(findings, `dist/${symlink}`, "production-output", "symbolic link");
  }
  for (const required of expectedFiles) {
    if (!inventory.files.includes(required)) {
      addFinding(findings, `dist/${required}`, "production-manifest", "expected output missing");
    }
  }
  for (const outputPath of inventory.files) {
    const file = `dist/${outputPath}`;
    if (!expectedFiles.has(outputPath)) {
      addFinding(findings, file, "untracked-build-artifact", "not declared by the canonical build");
    }
    const extension = extname(outputPath).toLowerCase();
    const isText =
      [".css", ".html", ".js", ".json", ".mjs", ".svg"].includes(extension) ||
      outputPath === "_headers";
    if (!isText) continue;
    const absolute = resolve(root, "dist", outputPath);
    const source = await readFile(absolute, "utf8").catch(() => undefined);
    if (source === undefined) {
      addFinding(findings, file, "production-output", "text output unreadable");
      continue;
    }
    if ([".js", ".mjs"].includes(extension)) {
      findings.push(...scanScriptOrigins(root, absolute, source));
      for (const [marker, detail] of BUNDLE_MARKERS) {
        if (marker.test(source)) {
          addFinding(findings, file, "forbidden-bundle-marker", detail);
        }
      }
    } else if (extension === ".json") {
      if (outputPath !== ".vite/manifest.json") {
        findings.push(...scanData(root, absolute, source));
      }
    } else if (extension === ".html") {
      findings.push(...scanHtml(root, absolute, source));
    } else if (extension === ".svg") {
      findings.push(...scanSvg(root, absolute, source));
    } else if (extension === ".css") {
      findings.push(...scanStyle(root, absolute, source));
    } else {
      inspectRemoteText(findings, file, source);
    }
    if (extension === ".html") {
      if (outputPath !== "index.html") {
        addFinding(findings, file, "production-entry", "unexpected HTML output");
      }
      const scripts = [...source.matchAll(/<script\b[^>]*>/gi)].map(
        (match) => match[0],
      );
      const localModules = scripts.filter(
        (tag) =>
          /\btype=["']module["']/i.test(tag) &&
          /\bsrc=["']\/assets\/[a-z0-9._-]+\.js["']/i.test(tag),
      );
      if (outputPath === "index.html" && (scripts.length !== 1 || localModules.length !== 1)) {
        addFinding(findings, file, "production-entry", "invalid generated script entry");
      }
    }
  }
  return findings;
}

async function inspectViteConfig(root: string): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const config = await readFile(resolve(root, "vite.config.ts"), "utf8").catch(() => "");
  const normalized = config.replace(/\r\n?/g, "\n");
  if (normalized !== CANONICAL_VITE_CONFIG) {
    addFinding(
      findings,
      "vite.config.ts",
      "vite-config",
      "canonical configuration mismatch",
    );
  }
  const parsed = ts.createSourceFile("vite.config.ts", config, ts.ScriptTarget.Latest, true);
  function propertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    if (
      ts.isComputedPropertyName(name) &&
      ts.isStringLiteralLike(name.expression)
    ) {
      return name.expression.text;
    }
    return undefined;
  }
  function visit(node: ts.Node): void {
    if (ts.isSpreadAssignment(node)) {
      addFinding(findings, "vite.config.ts", "vite-config", "spread configuration");
    }
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (name === undefined) {
        addFinding(findings, "vite.config.ts", "vite-config", "dynamic computed property");
      } else {
        if (name === "base") addFinding(findings, "vite.config.ts", "vite-base", "base override");
        if (["root", "publicDir", "appType"].includes(name)) {
          addFinding(findings, "vite.config.ts", "vite-root", name);
        }
        if (["input", "rollupOptions", "lib"].includes(name)) {
          addFinding(findings, "vite.config.ts", "vite-input", name);
        }
        if (["outDir", "emptyOutDir", "write"].includes(name)) {
          addFinding(findings, "vite.config.ts", "vite-output", name);
        }
        if (["proxy", "historyApiFallback", "rewrites"].includes(name)) {
          addFinding(findings, "vite.config.ts", "router-rewrite", name);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return findings;
}

async function inspectEntrypoints(root: string, graph: ProductionGraph): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const html = await readFile(resolve(root, "index.html"), "utf8").catch(() => "");
  findings.push(...scanHtml(root, resolve(root, "index.html"), html));
  const scriptOpenings = [...html.matchAll(/<script\b[^>]*>/gi)].map(
    (match) => match[0],
  );
  const mainOpening = scriptOpenings.filter(
    (tag) =>
      /\btype=["']module["']/i.test(tag) &&
      /\bsrc=["']\/src\/main\.tsx["']/i.test(tag),
  );
  const entersMain = scriptOpenings.length === 1 && mainOpening.length === 1;
  if (!entersMain) {
    addFinding(
      findings,
      "index.html",
      "root-entry",
      "expected only /src/main.tsx as a module entry",
    );
  }
  const app = resolve(root, "src/App.tsx");
  if (!entersMain || !graph.scripts.has(app)) addFinding(findings, "src/main.tsx", "app-entry", "src/App.tsx is not reachable");

  return findings;
}

export async function auditRuntimeBoundary(
  repoRoot: string,
  runBuild?: () => Promise<{ stdout: string; stderr: string }>,
): Promise<RuntimeBoundaryFinding[]> {
  const root = resolve(repoRoot);
  const configFindings = await inspectViteConfig(root);
  if (configFindings.length > 0) {
    return configFindings.sort((left, right) =>
      `${left.file}\0${left.code}\0${left.detail}`.localeCompare(`${right.file}\0${right.code}\0${right.detail}`),
    );
  }
  const buildOutput = runBuild ? await runBuild() : await runCanonicalBoundaryBuild(root);
  const graph = await productionFiles(root);
  const findings = [...(await inspectEntrypoints(root, graph))];
  for (const [path, source] of graph.scripts) findings.push(...scanSource(root, path, source));
  for (const [path, source] of graph.styles) findings.push(...scanStyle(root, path, source));
  for (const [path, source] of graph.data) findings.push(...scanData(root, path, source));
  findings.push(...(await inspectBuild(root, buildOutput)));
  return findings.sort((left, right) =>
    `${left.file}\0${left.code}\0${left.detail}`.localeCompare(`${right.file}\0${right.code}\0${right.detail}`),
  );
}

export async function runRuntimeBoundaryCli(repoRoot = process.cwd()): Promise<void> {
  const findings = await auditRuntimeBoundary(repoRoot);
  const result = { schemaVersion: 1, ok: findings.length === 0, findings };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runRuntimeBoundaryCli();
}
