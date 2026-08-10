import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import {
  delimiter,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  transform,
  transformStyleAttribute,
  type Dependency,
} from "lightningcss";
import { parse } from "parse5";
import ts from "typescript";

export type RuntimeBoundaryFinding = {
  file: string;
  code: string;
  detail: string;
};

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".css",
];
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
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "meta-app"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  define: {
    "import.meta.env.VITE_CLOUD_DATA_SYNC_ENABLED": JSON.stringify("true"),
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\\/node_modules\\//.test(id)) return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@meta", replacement: resolve(__dirname, "meta-app/src") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
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
const TRUSTED_VENDOR_BUNDLE = /^assets\/vendor-[A-Za-z0-9_-]+\.js$/;
const TRUSTED_RUNTIME_BUNDLE = /^assets\/rolldown-runtime-[A-Za-z0-9_-]+\.js$/;
const TRUSTED_APP_BUNDLE = /^assets\/index-[A-Za-z0-9_-]+\.js$/;
const TRUSTED_BRAND_LOGO = /^assets\/detective-conan-logo-[A-Za-z0-9_-]+\.png$/;
// Updated only after npm-ci rebuild, full qualification, and adversarial review.
const TRUSTED_VENDOR_SHA256 =
  "b3e744a622acdec456b8c15bc020e904745b141843b6fe96e08c642e96f464e3";
const TRUSTED_RUNTIME_SHA256 =
  "5db5ba82eef00d1dee7e86e663098c9427d01183a88d357437daff295aec3e75";
const TRUSTED_APP_SHA256 =
  "549d08466711a5a53d390a63ec65d950f15112ad82a045c138f38772ae431957";
const TRUSTED_BRAND_LOGO_SHA256 =
  "8567c177ecaaf03c8b360dedd8aeea385b58e0bdffe359303f1784ef52e9beff";

const trustedBundle = (source: string, expectedSha256: string): boolean =>
  createHash("sha256").update(source, "utf8").digest("hex") === expectedSha256;
const PRIVILEGED_BROWSER_GLOBALS = new Set([
  "document",
  "frames",
  "globalThis",
  "navigation",
  "navigator",
  "opener",
  "parent",
  "self",
  "top",
  "window",
]);
const VALUE_PROPAGATING_ASSIGNMENT_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);
const ASSIGNMENT_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
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
const BROWSER_TIMER_TIMEOUT = "[[browser-timer:setTimeout]]";
const BROWSER_TIMER_INTERVAL = "[[browser-timer:setInterval]]";
const REFLECT_NAMESPACE_VALUE = "[[intrinsic:Reflect]]";
const REFLECT_APPLY_VALUE = "[[intrinsic:Reflect.apply]]";
const LOCAL_CALLABLE_VALUE = "[[local-callable]]";
const isProjectionTrackedValue = (value: string): boolean =>
  isObjectValue(value) ||
  [
    BROWSER_TIMER_TIMEOUT,
    BROWSER_TIMER_INTERVAL,
    REFLECT_NAMESPACE_VALUE,
    REFLECT_APPLY_VALUE,
  ].includes(value);
const STATIC_STRING_PREFIX = "[[static-string:";
const staticStringValue = (value: string): string =>
  `${STATIC_STRING_PREFIX}${value}]]`;
const valueStaticString = (value: string): string | undefined => {
  if (!value.startsWith(STATIC_STRING_PREFIX)) return undefined;
  if (!value.endsWith("]]")) return undefined;
  return value.slice(STATIC_STRING_PREFIX.length, -2);
};
const browserObjectProperty = (
  owner: string | undefined,
  property: string | undefined,
): string | undefined => {
  if (!owner) return undefined;
  if (owner === REFLECT_NAMESPACE_VALUE && property === "apply")
    return REFLECT_APPLY_VALUE;
  if (["globalThis", "self", "window"].includes(owner)) {
    if (property === "Reflect") return REFLECT_NAMESPACE_VALUE;
    if (property === "setTimeout") return BROWSER_TIMER_TIMEOUT;
    if (property === "setInterval") return BROWSER_TIMER_INTERVAL;
    if (
      [
        "globalThis",
        "self",
        "window",
        "parent",
        "top",
        "frames",
        "opener",
      ].includes(property ?? "")
    ) {
      return "window";
    }
    if (property === "document") return "document";
    if (property === "navigator") return "navigator";
    if (property !== undefined && /^(?:0|[1-9]\d*)$/.test(property))
      return "window";
    return BROWSER_DERIVED_OBJECT;
  }
  if (owner === "document") {
    if (property === "defaultView") return "window";
    if (property === "ownerDocument") return "document";
    return DOM_NODE_BROWSER_OBJECT;
  }
  if (owner === DOM_NODE_BROWSER_OBJECT) {
    if (property === "contentWindow") return "window";
    if (property === "contentDocument") return "document";
    if (property === "ownerDocument") return "document";
    if (property === "defaultView") return "window";
    return DOM_NODE_BROWSER_OBJECT;
  }
  if (owner === "navigator") return BROWSER_DERIVED_OBJECT;
  if (owner === BROWSER_DERIVED_OBJECT) {
    if (
      [
        "globalThis",
        "self",
        "window",
        "parent",
        "top",
        "frames",
        "opener",
        "defaultView",
      ].includes(property ?? "")
    ) {
      return "window";
    }
    if (["document", "ownerDocument"].includes(property ?? "")) {
      return "document";
    }
    if (property === "navigator") return "navigator";
    return BROWSER_DERIVED_OBJECT;
  }
  return undefined;
};
const PERSISTENT_BROWSER_PROPERTIES = new Set([
  "caches",
  "clipboard",
  "cookie",
  "cookieStore",
  "credentials",
  "execCommand",
  "history",
  "indexedDB",
  "localStorage",
  "name",
  "navigate",
  "navigation",
  "openDatabase",
  "sessionStorage",
  "showDirectoryPicker",
  "showOpenFilePicker",
  "showSaveFilePicker",
  "storage",
  "reload",
  "updateCurrentEntry",
]);
const NETWORK_BROWSER_PROPERTIES = new Set([
  "BroadcastChannel",
  "EventSource",
  "fetch",
  "location",
  "open",
  "postMessage",
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
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

async function existingFile(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);
}

function buildEnvironment(): NodeJS.ProcessEnv {
  const system32 =
    process.platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin";
  return {
    PATH: [dirname(process.execPath), system32].join(delimiter),
    SystemRoot: process.platform === "win32" ? "C:\\Windows" : undefined,
    SYSTEMROOT: process.platform === "win32" ? "C:\\Windows" : undefined,
    ComSpec:
      process.platform === "win32"
        ? "C:\\Windows\\System32\\cmd.exe"
        : undefined,
    COMSPEC:
      process.platform === "win32"
        ? "C:\\Windows\\System32\\cmd.exe"
        : undefined,
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
    throw new Error(
      "private hosted boundary rejected: local Vite executable is missing",
    );
  }
  return run({
    file: process.execPath,
    args: [
      vite,
      "build",
      "--manifest",
      "--config",
      "vite.config.private-hosted.ts",
    ],
    cwd: root,
    env: buildEnvironment(),
  });
}

async function resolveImport(
  root: string,
  importer: string,
  specifier: string,
): Promise<string | undefined> {
  if (
    !(
      specifier.startsWith(".") ||
      specifier.startsWith("@/") ||
      specifier.startsWith("@meta/") ||
      specifier.startsWith("/")
    )
  ) {
    return undefined;
  }
  const base = specifier.startsWith("@meta/")
    ? resolve(root, "meta-app/src", specifier.slice(6))
    : specifier.startsWith("@/")
      ? resolve(root, "src", specifier.slice(2))
      : specifier.startsWith("/")
        ? resolve(root, "meta-app", specifier.slice(1))
        : resolve(dirname(importer), specifier);
  const extension = extname(base);
  const bases =
    extension === ".js" || extension === ".jsx"
      ? [base.slice(0, -extension.length)]
      : [base];
  const candidates = [
    ...bases,
    ...bases.flatMap((candidate) =>
      SOURCE_EXTENSIONS.map((suffix) => `${candidate}${suffix}`),
    ),
    ...bases.flatMap((candidate) =>
      SOURCE_EXTENSIONS.map((suffix) => resolve(candidate, `index${suffix}`)),
    ),
  ];
  for (const candidate of candidates) {
    if (within(root, candidate) && (await existingFile(candidate)))
      return candidate;
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
  if (
    !findings.some(
      (item) =>
        item.file === file && item.code === code && item.detail === detail,
    )
  ) {
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

function analyzeCss(
  source: string,
  filename: string,
  surface: CssSurface,
): CssAnalysis {
  try {
    const options = {
      filename,
      code: new TextEncoder().encode(source),
      errorRecovery: false,
    };
    const result =
      surface === "stylesheet"
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
    .filter(
      (dependency): dependency is Extract<Dependency, { type: "import" }> =>
        dependency.type === "import",
    )
    .map((dependency) => dependency.url)
    .filter((specifier) => !/^(?:data:|https?:|\/\/)/i.test(specifier));
}

async function productionFiles(root: string): Promise<ProductionGraph> {
  const entry = resolve(root, "meta-app/src/main.tsx");
  const pending = [entry];
  const scripts = new Map<string, ts.SourceFile>();
  const styles = new Map<string, string>();
  const data = new Map<string, string>();
  while (pending.length > 0) {
    const absolute = pending.pop()!;
    if (scripts.has(absolute) || styles.has(absolute) || data.has(absolute))
      continue;
    const source = await readFile(absolute, "utf8");
    const extension = extname(absolute).toLowerCase();
    if (extension === ".css") {
      styles.set(absolute, source);
      for (const specifier of cssImports(source, absolute)) {
        const imported = await resolveImport(
          root,
          absolute,
          /^(?:\.|\/|@\/|@meta\/)/.test(specifier)
            ? specifier
            : `./${specifier}`,
        );
        if (imported && extname(imported).toLowerCase() === ".css")
          pending.push(imported);
      }
      continue;
    }
    if (extension === ".json") {
      data.set(absolute, source);
      continue;
    }
    const parsed = ts.createSourceFile(
      absolute,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
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
    return left === undefined || right === undefined
      ? undefined
      : `${left}${right}`;
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
    const separator =
      node.arguments.length === 0
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
  limitations: ReadonlySet<string>;
  valuesBefore: ReadonlyMap<ts.Identifier, BrowserGlobalSet>;
  propertyValuesBefore: ReadonlyMap<
    ts.PropertyAccessExpression | ts.ElementAccessExpression,
    BrowserGlobalSet
  >;
  callValues: ReadonlyMap<
    ts.CallExpression | ts.NewExpression,
    BrowserGlobalSet
  >;
  analyzedLocalCalls: ReadonlySet<ts.CallExpression | ts.NewExpression>;
  localFunctionReturns: ReadonlySet<ts.ReturnStatement | ts.ArrowFunction>;
  resolveBinding(node: ts.Node, name: string): AliasBinding | undefined;
  callableSources(node: ts.Identifier): readonly ts.Expression[];
  staticString(node: ts.Expression): string | undefined;
  isBrowserTimer(node: ts.Expression): boolean;
  isDynamicFunctionConstructor(node: ts.Expression): boolean;
  containsTrackedBrowserObject(node: ts.Expression): boolean;
  containsDeferredTrackedBrowserObject(node: ts.Expression): boolean;
  isCapturedBinding(node: ts.Node, binding: AliasBinding): boolean;
  isInertReplayEventConstructor(
    node: ts.CallExpression | ts.NewExpression,
  ): boolean;
  isInertEventTargetAssignment(node: ts.BinaryExpression): boolean;
};

function isRuntimeValueIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isJsxAttribute(parent) && parent.name === node) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node)
    return false;
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
  return (
    isRuntimeValueIdentifier(node) &&
    analysis.resolveBinding(node, node.text) === undefined
  );
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
    if (ts.isAwaitExpression(expression))
      return browserObject(expression.expression);
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
      return returned ? [...returned].find(isBrowserObjectValue) : undefined;
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const tracked = analysis.propertyValuesBefore.get(expression);
      const trackedGlobal = tracked
        ? [...tracked].find((value) => PRIVILEGED_BROWSER_GLOBALS.has(value))
        : undefined;
      if (trackedGlobal) return trackedGlobal;
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? analysis.staticString(expression.argumentExpression)
          : undefined;
      const owner = browserObject(expression.expression);
      if (owner === undefined && property === "contentWindow") return "window";
      if (owner === undefined && property === "contentDocument")
        return "document";
      return browserObjectProperty(owner, property);
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        browserObject(expression.whenTrue) ??
        browserObject(expression.whenFalse)
      );
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
        : (browserObject(expression.left) ?? browserObject(expression.right));
    }
    if (!ts.isIdentifier(expression)) return undefined;
    const binding = analysis.resolveBinding(expression, expression.text);
    if (binding) {
      const values = [...(analysis.valuesBefore.get(expression) ?? [])];
      return values.find(isBrowserObjectValue) ?? values.find(isObjectValue);
    }
    return PRIVILEGED_BROWSER_GLOBALS.has(expression.text)
      ? expression.text
      : undefined;
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
      return (
        browserObject(expression.whenTrue) ??
        browserObject(expression.whenFalse)
      );
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? analysis.staticString(expression.argumentExpression)
          : undefined;
      return browserObjectProperty(
        browserObject(expression.expression),
        property,
      );
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
        : (browserObject(expression.left) ?? browserObject(expression.right));
    }
    if (
      !ts.isIdentifier(expression) ||
      analysis.resolveBinding(expression, expression.text)
    ) {
      return undefined;
    }
    return PRIVILEGED_BROWSER_GLOBALS.has(expression.text)
      ? expression.text
      : undefined;
  };
  const value = browserObject(node);
  return value && PRIVILEGED_BROWSER_GLOBALS.has(value) ? value : undefined;
}

function browserTimerInvocation(
  node: ts.CallExpression,
  analysis: BrowserAliasAnalysis,
): { handlers: readonly (ts.Expression | undefined)[] } | undefined {
  type CallArgument = ts.Expression | ts.SpreadElement;
  const unknownArgument = ts.factory.createIdentifier("undefined");
  const plainArgument = (
    argument: CallArgument | undefined,
  ): ts.Expression | undefined =>
    argument && !ts.isSpreadElement(argument) ? argument : undefined;
  const arrayArguments = (
    argument: CallArgument | undefined,
  ): CallArgument[] | undefined => {
    const expression = plainArgument(argument);
    if (!expression || !ts.isArrayLiteralExpression(expression))
      return undefined;
    return expression.elements.map((element) =>
      ts.isOmittedExpression(element) ? unknownArgument : element,
    );
  };
  const member = (
    expression: ts.Expression,
  ): { owner: ts.Expression; property: string | undefined } | undefined => {
    while (ts.isParenthesizedExpression(expression))
      expression = expression.expression;
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
      return undefined;
    }
    return {
      owner: expression.expression,
      property: ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? analysis.staticString(expression.argumentExpression)
          : undefined,
    };
  };
  const reflectNamespace = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding>,
  ): boolean => {
    while (ts.isParenthesizedExpression(expression))
      expression = expression.expression;
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      if (
        analysis.propertyValuesBefore
          .get(expression)
          ?.has(REFLECT_NAMESPACE_VALUE)
      )
        return true;
      const property = member(expression);
      return (
        property?.property === "Reflect" &&
        ["globalThis", "self", "window"].includes(
          privilegedBrowserGlobal(property.owner, analysis) ?? "",
        )
      );
    }
    if (!ts.isIdentifier(expression)) return false;
    const binding = analysis.resolveBinding(expression, expression.text);
    if (!binding) return expression.text === "Reflect";
    if (analysis.valuesBefore.get(expression)?.has(REFLECT_NAMESPACE_VALUE))
      return true;
    if (resolving.has(binding)) return false;
    const next = new Set(resolving).add(binding);
    return analysis
      .callableSources(expression)
      .some((source) => reflectNamespace(source, next));
  };
  const reflectApply = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding>,
  ): boolean => {
    while (ts.isParenthesizedExpression(expression))
      expression = expression.expression;
    if (ts.isIdentifier(expression)) {
      const binding = analysis.resolveBinding(expression, expression.text);
      if (!binding || resolving.has(binding)) return false;
      if (analysis.valuesBefore.get(expression)?.has(REFLECT_APPLY_VALUE))
        return true;
      const next = new Set(resolving).add(binding);
      return analysis
        .callableSources(expression)
        .some((source) => reflectApply(source, next));
    }
    const property = member(expression);
    return (
      property?.property === "apply" &&
      reflectNamespace(property.owner, resolving)
    );
  };
  const invoke = (
    callee: ts.Expression,
    args: readonly CallArgument[],
    resolving: ReadonlySet<AliasBinding>,
  ): Array<ts.Expression | undefined> => {
    while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
    if (
      ts.isBinaryExpression(callee) &&
      callee.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return invoke(callee.right, args, resolving);
    }
    if (analysis.isBrowserTimer(callee)) return [plainArgument(args[0])];
    if (reflectApply(callee, resolving)) {
      const target = plainArgument(args[0]);
      if (!target) return [];
      const applied = arrayArguments(args[2]);
      return invoke(target, applied ?? [unknownArgument], resolving);
    }
    if (ts.isIdentifier(callee)) {
      const binding = analysis.resolveBinding(callee, callee.text);
      if (!binding || resolving.has(binding)) return [];
      const current = analysis.valuesBefore.get(callee);
      if (current?.has(LOCAL_CALLABLE_VALUE)) return [];
      const next = new Set(resolving).add(binding);
      return analysis
        .callableSources(callee)
        .flatMap((source) => invoke(source, args, next));
    }
    if (ts.isCallExpression(callee)) {
      const binding = member(callee.expression);
      if (binding?.property === "bind") {
        return invoke(
          binding.owner,
          [...callee.arguments.slice(1), ...args],
          resolving,
        );
      }
      return [];
    }
    const binding = member(callee);
    if (!binding) return [];
    if (binding.property === "call") {
      return invoke(binding.owner, args.slice(1), resolving);
    }
    if (binding.property === "apply") {
      const applied = arrayArguments(args[1]);
      return invoke(binding.owner, applied ?? [unknownArgument], resolving);
    }
    return [];
  };
  const handlers = invoke(node.expression, node.arguments, new Set());
  return handlers.length > 0 ? { handlers } : undefined;
}

function browserTimerBindHandler(
  node: ts.CallExpression,
  analysis: BrowserAliasAnalysis,
): ts.Expression | null | undefined {
  const callee = node.expression;
  if (
    !ts.isPropertyAccessExpression(callee) &&
    !ts.isElementAccessExpression(callee)
  ) {
    return undefined;
  }
  const property = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : callee.argumentExpression
      ? analysis.staticString(callee.argumentExpression)
      : undefined;
  if (property !== "bind" || !analysis.isBrowserTimer(callee.expression))
    return undefined;
  const handler = node.arguments[1];
  return handler && !ts.isSpreadElement(handler) ? handler : null;
}

function isDynamicCodeExecution(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
  allowInertReplayEventConstructor = false,
  staticStrings?: ScopedStaticStrings,
): boolean {
  const timer = ts.isCallExpression(node)
    ? browserTimerInvocation(node, analysis)
    : undefined;
  const timerBind = ts.isCallExpression(node)
    ? browserTimerBindHandler(node, analysis)
    : undefined;
  if (
    timer &&
    staticStrings &&
    timer.handlers.some(
      (handler) => !handler || !staticallyCallable(handler, staticStrings),
    )
  ) {
    return true;
  }
  if (
    timerBind &&
    staticStrings &&
    !staticallyCallable(timerBind, staticStrings)
  ) {
    return true;
  }
  if (
    (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
    analysis.isDynamicFunctionConstructor(node.expression) &&
    !(
      allowInertReplayEventConstructor &&
      analysis.isInertReplayEventConstructor(node)
    )
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
        properties
          .slice(1)
          .every((property) => ["apply", "call"].includes(property)) &&
        ts.isCallExpression(current.parent) &&
        current.parent.expression === current
      ) {
        return false;
      }
    }
    return true;
  }
  if (
    !ts.isPropertyAccessExpression(node) &&
    !ts.isElementAccessExpression(node)
  ) {
    return false;
  }
  const property = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : node.argumentExpression
      ? staticString(node.argumentExpression)
      : undefined;
  return (
    ["eval", "Function"].includes(property ?? "") &&
    privilegedBrowserGlobal(node.expression, analysis) !== undefined
  );
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
  const limitations = new Set<string>();
  const scopes = new Map<ts.Node, Map<string, AliasBinding>>();
  let nextBindingId = 1;
  const nearestScope = (node: ts.Node | undefined): ts.Node => {
    let current = node;
    while (current && !isLexicalScope(current)) current = current.parent;
    return current ?? root;
  };
  const nearestFunctionScope = (node: ts.Node | undefined): ts.Node => {
    let current = node;
    while (
      current &&
      !ts.isFunctionLike(current) &&
      !ts.isSourceFile(current)
    ) {
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
      const list = ts.isVariableDeclarationList(node.parent)
        ? node.parent
        : undefined;
      const scope =
        list && (list.flags & ts.NodeFlags.BlockScoped) === 0
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
  const resolveBinding = (
    node: ts.Node,
    name: string,
  ): AliasBinding | undefined => {
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
  const relationsByTarget = new Map<
    AliasBinding,
    Array<{ target: AliasBinding; source: ts.Expression }>
  >();
  for (const relation of relations) {
    const entries = relationsByTarget.get(relation.target) ?? [];
    entries.push(relation);
    relationsByTarget.set(relation.target, entries);
  }
  const scopedAliasStaticString = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): string | undefined => {
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return scopedAliasStaticString(expression.expression, resolving);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding || resolving.has(binding)) return undefined;
      const sources = relationsByTarget.get(binding) ?? [];
      if (sources.length !== 1) return undefined;
      return scopedAliasStaticString(
        sources[0]!.source,
        new Set([...resolving, binding]),
      );
    }
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = scopedAliasStaticString(expression.left, resolving);
      const right = scopedAliasStaticString(expression.right, resolving);
      return left === undefined || right === undefined
        ? undefined
        : `${left}${right}`;
    }
    if (ts.isTemplateExpression(expression)) {
      let value = expression.head.text;
      for (const span of expression.templateSpans) {
        const item = scopedAliasStaticString(span.expression, resolving);
        if (item === undefined) return undefined;
        value += item + span.literal.text;
      }
      return value;
    }
    return undefined;
  };

  const localFunctions = new Map<
    AliasBinding,
    Set<ts.FunctionLikeDeclaration>
  >();
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
      (ts.isFunctionExpression(node.initializer) ||
        ts.isArrowFunction(node.initializer))
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
  const returnsByFunction = new Map<
    ts.FunctionLikeDeclaration,
    ts.Expression[]
  >();
  const collectFunctionReturns = (
    implementation: ts.FunctionLikeDeclaration,
  ): void => {
    if (returnsByFunction.has(implementation)) return;
    const returns: ts.Expression[] = [];
    const collectReturns = (node: ts.Node): void => {
      if (node !== implementation && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression)
        returns.push(node.expression);
      ts.forEachChild(node, collectReturns);
    };
    if (implementation.body) {
      if (ts.isBlock(implementation.body)) collectReturns(implementation.body);
      else returns.push(implementation.body);
    }
    returnsByFunction.set(implementation, returns);
  };
  for (const implementations of localFunctions.values()) {
    for (const implementation of implementations)
      collectFunctionReturns(implementation);
  }
  const callableReturns = new Map<
    ts.FunctionLikeDeclaration,
    Set<ts.FunctionLikeDeclaration>
  >();
  const callableValue = (
    node: ts.Expression,
  ): Set<ts.FunctionLikeDeclaration> => {
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
      return new Set([
        ...callableValue(node.whenTrue),
        ...callableValue(node.whenFalse),
      ]);
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      return new Set([
        ...callableValue(node.left),
        ...callableValue(node.right),
      ]);
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
    return new Set(binding ? (localFunctions.get(binding) ?? []) : []);
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
  const unionObjectBindings = (
    left: AliasBinding,
    right: AliasBinding,
  ): void => {
    const a = canonicalObjectBinding(left);
    const b = canonicalObjectBinding(right);
    if (a === b) return;
    const [canonical, alias] = a.id < b.id ? [a, b] : [b, a];
    objectAliasParents.set(alias, canonical);
  };
  const identifierBinding = (
    expression: ts.Expression,
  ): AliasBinding | undefined => {
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
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Symbol" &&
      resolveBinding(expression.expression, expression.expression.text) ===
        undefined &&
      ["asyncIterator", "iterator"].includes(expression.name.text)
    ) {
      return `@@${expression.name.text}`;
    }
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
      (relationsByTarget.get(binding) ?? []).map((relation) =>
        scopedStaticString(relation.source, new Set([...resolving, binding])),
      ),
    );
    return values.size === 1 ? [...values][0] : undefined;
  };

  const assignedPropertyName = (
    expression: ts.Expression,
  ): string | undefined => {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (
      ts.isElementAccessExpression(expression) &&
      expression.argumentExpression
    ) {
      return scopedStaticString(expression.argumentExpression);
    }
    return undefined;
  };
  const assignedReceiver = (
    expression: ts.Expression,
  ): ts.Expression | undefined =>
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
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
    if (
      !ts.isNewExpression(expression) ||
      !ts.isIdentifier(expression.expression)
    ) {
      return false;
    }
    const binding = resolveBinding(
      expression.expression,
      expression.expression.text,
    );
    return [...(binding ? (localFunctions.get(binding) ?? []) : [])].some(
      (implementation) => syntheticEventImplementations.has(implementation),
    );
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
  const requiredReplayFields = new Set([
    "blockedOn",
    "nativeEvent",
    "targetContainers",
  ]);
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
          (ts.isPropertyAccessExpression(child) ||
            ts.isElementAccessExpression(child)) &&
          ts.isIdentifier(child.expression)
        ) {
          const binding = resolveBinding(
            child.expression,
            child.expression.text,
          );
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
    if (
      constructorProperty !== "constructor" ||
      !ts.isIdentifier(node.expression.expression)
    ) {
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
      resolveBinding(typeArgument.expression, typeArgument.expression.text) !==
        receiverBinding
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
    const staticBoolean = (expression: ts.Expression): boolean | undefined => {
      if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
      if (ts.isParenthesizedExpression(expression))
        return staticBoolean(expression.expression);
      if (
        ts.isPrefixUnaryExpression(expression) &&
        expression.operator === ts.SyntaxKind.ExclamationToken
      ) {
        const value = staticBoolean(expression.operand);
        return value === undefined ? undefined : !value;
      }
      return undefined;
    };
    const isWithinStaticallyDeadBranch = (node: ts.Node): boolean => {
      let current: ts.Node | undefined = node;
      while (current && current !== implementation!.body) {
        const parentNode: ts.Node | undefined = current.parent;
        if (!parentNode) return false;
        if (ts.isIfStatement(parentNode)) {
          const condition = staticBoolean(parentNode.expression);
          if (
            (current === parentNode.thenStatement && condition === false) ||
            (current === parentNode.elseStatement && condition === true)
          ) {
            return true;
          }
        }
        if (ts.isConditionalExpression(parentNode)) {
          const condition = staticBoolean(parentNode.condition);
          if (
            (current === parentNode.whenTrue && condition === false) ||
            (current === parentNode.whenFalse && condition === true)
          ) {
            return true;
          }
        }
        if (
          ts.isWhileStatement(parentNode) &&
          current === parentNode.statement &&
          staticBoolean(parentNode.expression) === false
        ) {
          return true;
        }
        if (
          ts.isForStatement(parentNode) &&
          current === parentNode.statement &&
          parentNode.condition &&
          staticBoolean(parentNode.condition) === false
        ) {
          return true;
        }
        current = parentNode;
      }
      return false;
    };
    const inspectReplayImplementation = (child: ts.Node): void => {
      if (
        isWithinStaticallyDeadBranch(child) ||
        (child !== implementation!.body && ts.isFunctionLike(child))
      ) {
        return;
      }
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
    if (!dispatchesClonedEvent || !shiftsTargetContainer || !writesBlockedOn)
      return false;
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
      if (
        property !== "nativeEvent" ||
        !ts.isIdentifier(relation.source.expression)
      ) {
        return false;
      }
      const eventBinding = resolveBinding(
        relation.source.expression,
        relation.source.expression.text,
      );
      return (
        eventBinding !== undefined && replayEventParameters.has(eventBinding)
      );
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
    if (!["nativeEventTarget", "relatedTarget", "target"].includes(property))
      return false;
    if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isFunctionLike(current)) current = current.parent;
      return (
        current !== undefined &&
        syntheticEventImplementations.has(current as ts.FunctionLikeDeclaration)
      );
    }
    if (!ts.isIdentifier(receiver)) return false;
    const binding = resolveBinding(receiver, receiver.text);
    return (
      binding !== undefined &&
      syntheticEventObjects.has(canonicalObjectBinding(binding))
    );
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
  const possibleFunctionReturns = new Map<
    ts.FunctionLikeDeclaration,
    BrowserGlobalSet
  >();
  const latestDefiniteAssignmentValue = (
    expression: ts.Expression,
    binding: AliasBinding,
  ): ts.Expression | undefined => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return latestDefiniteAssignmentValue(expression.expression, binding);
    }
    if (!ts.isBinaryExpression(expression)) return undefined;
    if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
      return (
        latestDefiniteAssignmentValue(expression.right, binding) ??
        latestDefiniteAssignmentValue(expression.left, binding)
      );
    }
    return expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(expression.left) &&
      resolveBinding(expression.left, expression.left.text) === binding
      ? expression.right
      : undefined;
  };
  function sequentialValueExpression(expression: ts.Expression): ts.Expression {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return sequentialValueExpression(expression.expression);
    }
    if (!ts.isBinaryExpression(expression)) return expression;
    if (expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return sequentialValueExpression(expression.right);
    }
    if (expression.operatorToken.kind !== ts.SyntaxKind.CommaToken)
      return expression;
    const result = sequentialValueExpression(expression.right);
    if (!ts.isIdentifier(result)) return result;
    const binding = resolveBinding(result, result.text);
    const assigned = binding
      ? latestDefiniteAssignmentValue(expression.left, binding)
      : undefined;
    return assigned && expressionDefinitelyBreaksPriorValue(assigned)
      ? sequentialValueExpression(assigned)
      : result;
  }
  function expressionDefinitelyBreaksPriorValue(
    expression: ts.Expression,
    resolvingFunctions: ReadonlySet<ts.FunctionLikeDeclaration> = new Set(),
  ): boolean {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return expressionDefinitelyBreaksPriorValue(
        expression.expression,
        resolvingFunctions,
      );
    }
    if (
      ts.isObjectLiteralExpression(expression) ||
      ts.isArrayLiteralExpression(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isArrowFunction(expression) ||
      ts.isClassExpression(expression) ||
      ts.isLiteralExpression(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword
    ) {
      return true;
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        expressionDefinitelyBreaksPriorValue(
          expression.whenTrue,
          resolvingFunctions,
        ) &&
        expressionDefinitelyBreaksPriorValue(
          expression.whenFalse,
          resolvingFunctions,
        )
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        return expressionDefinitelyBreaksPriorValue(
          sequentialValueExpression(expression),
          resolvingFunctions,
        );
      }
      return ![
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(expression.operatorToken.kind);
    }
    if (!ts.isCallExpression(expression)) return false;
    if (!ts.isIdentifier(expression.expression)) return false;
    const binding = resolveBinding(
      expression.expression,
      expression.expression.text,
    );
    const implementations = binding
      ? (localFunctions.get(binding) ?? new Set<ts.FunctionLikeDeclaration>())
      : new Set<ts.FunctionLikeDeclaration>();
    if (implementations.size === 0) return false;
    return [...implementations].every((implementation) => {
      if (resolvingFunctions.has(implementation)) return false;
      collectFunctionReturns(implementation);
      const returned = returnsByFunction.get(implementation) ?? [];
      const nextFunctions = new Set(resolvingFunctions).add(implementation);
      return returned.every((value) =>
        expressionDefinitelyBreaksPriorValue(
          sequentialValueExpression(value),
          nextFunctions,
        ),
      );
    });
  }
  const returnedArgumentIndexes = new Map<
    ts.FunctionLikeDeclaration,
    ReadonlySet<number>
  >();
  const returnedArgumentIndexesInProgress =
    new Set<ts.FunctionLikeDeclaration>();
  type ParameterEnvironment = Map<AliasBinding, Set<number>>;
  const unionParameterIndexes = (
    ...values: ReadonlySet<number>[]
  ): Set<number> => new Set(values.flatMap((value) => [...value]));
  const cloneParameterEnvironment = (
    environment: ParameterEnvironment,
  ): ParameterEnvironment =>
    new Map(
      [...environment].map(([binding, indexes]) => [binding, new Set(indexes)]),
    );
  const mergeParameterEnvironments = (
    ...environments: ParameterEnvironment[]
  ): ParameterEnvironment => {
    const merged: ParameterEnvironment = new Map();
    for (const environment of environments) {
      for (const [binding, indexes] of environment) {
        merged.set(
          binding,
          unionParameterIndexes(merged.get(binding) ?? new Set(), indexes),
        );
      }
    }
    return merged;
  };
  const replaceParameterEnvironment = (
    target: ParameterEnvironment,
    source: ParameterEnvironment,
  ): void => {
    target.clear();
    for (const [binding, indexes] of source)
      target.set(binding, new Set(indexes));
  };
  const localCalleeImplementations = (
    expression: ts.Expression,
  ): Set<ts.FunctionLikeDeclaration> => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return localCalleeImplementations(expression.expression);
    }
    if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
      collectFunctionReturns(expression);
      return new Set([expression]);
    }
    if (ts.isConditionalExpression(expression)) {
      return new Set([
        ...localCalleeImplementations(expression.whenTrue),
        ...localCalleeImplementations(expression.whenFalse),
      ]);
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind))
    ) {
      return localCalleeImplementations(expression.right);
    }
    if (!ts.isIdentifier(expression)) return new Set();
    const binding = resolveBinding(expression, expression.text);
    return new Set(binding ? (localFunctions.get(binding) ?? []) : []);
  };
  const parameterOrigins = (
    expression: ts.Expression,
    environment: ParameterEnvironment,
  ): Set<number> => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return parameterOrigins(expression.expression, environment);
    }
    if (ts.isConditionalExpression(expression)) {
      parameterOrigins(expression.condition, environment);
      const whenTrueEnvironment = cloneParameterEnvironment(environment);
      const whenFalseEnvironment = cloneParameterEnvironment(environment);
      const whenTrue = parameterOrigins(
        expression.whenTrue,
        whenTrueEnvironment,
      );
      const whenFalse = parameterOrigins(
        expression.whenFalse,
        whenFalseEnvironment,
      );
      replaceParameterEnvironment(
        environment,
        mergeParameterEnvironments(whenTrueEnvironment, whenFalseEnvironment),
      );
      return unionParameterIndexes(whenTrue, whenFalse);
    }
    if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind;
      if (operator === ts.SyntaxKind.CommaToken) {
        parameterOrigins(expression.left, environment);
        return parameterOrigins(expression.right, environment);
      }
      if (operator === ts.SyntaxKind.EqualsToken) {
        const value = parameterOrigins(expression.right, environment);
        if (ts.isIdentifier(expression.left)) {
          const binding = resolveBinding(expression.left, expression.left.text);
          if (binding) environment.set(binding, new Set(value));
        }
        return value;
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(operator)
      ) {
        const binding = ts.isIdentifier(expression.left)
          ? resolveBinding(expression.left, expression.left.text)
          : undefined;
        const previous = binding
          ? new Set(environment.get(binding) ?? [])
          : parameterOrigins(expression.left, environment);
        const assignedEnvironment = cloneParameterEnvironment(environment);
        const assigned = parameterOrigins(
          expression.right,
          assignedEnvironment,
        );
        replaceParameterEnvironment(
          environment,
          mergeParameterEnvironments(environment, assignedEnvironment),
        );
        const result = unionParameterIndexes(previous, assigned);
        if (binding) environment.set(binding, result);
        return result;
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(operator)
      ) {
        const left = parameterOrigins(expression.left, environment);
        const rightEnvironment = cloneParameterEnvironment(environment);
        const right = parameterOrigins(expression.right, rightEnvironment);
        replaceParameterEnvironment(
          environment,
          mergeParameterEnvironments(environment, rightEnvironment),
        );
        return unionParameterIndexes(left, right);
      }
      parameterOrigins(expression.left, environment);
      parameterOrigins(expression.right, environment);
      return new Set();
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      return new Set(binding ? (environment.get(binding) ?? []) : []);
    }
    if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
      parameterOrigins(expression.expression, environment);
      const argumentsOrigins = (expression.arguments ?? []).map((argument) =>
        parameterOrigins(
          ts.isSpreadElement(argument) ? argument.expression : argument,
          environment,
        ),
      );
      const implementations = localCalleeImplementations(expression.expression);
      if (
        implementations.size === 0 ||
        expression.arguments?.some(ts.isSpreadElement)
      ) {
        return unionParameterIndexes(...argumentsOrigins);
      }
      const result = new Set<number>();
      for (const implementation of implementations) {
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          for (const origin of argumentsOrigins[index] ?? [])
            result.add(origin);
        }
      }
      return result;
    }
    if (ts.isYieldExpression(expression) && expression.expression) {
      return parameterOrigins(expression.expression, environment);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        parameterOrigins(
          ts.isSpreadElement(element) ? element.expression : element,
          environment,
        );
      }
      return new Set();
    }
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isSpreadAssignment(property)) {
          parameterOrigins(property.expression, environment);
        } else if (ts.isPropertyAssignment(property)) {
          parameterOrigins(property.initializer, environment);
        } else if (
          ts.isShorthandPropertyAssignment(property) &&
          property.objectAssignmentInitializer
        ) {
          parameterOrigins(property.objectAssignmentInitializer, environment);
        }
      }
      return new Set();
    }
    return new Set();
  };
  const assignParameterDeclaration = (
    declaration: ts.VariableDeclaration,
    environment: ParameterEnvironment,
  ): void => {
    const value = declaration.initializer
      ? parameterOrigins(declaration.initializer, environment)
      : new Set<number>();
    if (!ts.isIdentifier(declaration.name)) return;
    const binding = resolveBinding(declaration.name, declaration.name.text);
    if (binding) environment.set(binding, value);
  };
  const analyzeParameterStatement = (
    statement: ts.Statement,
    environment: ParameterEnvironment,
    returned: Set<number>,
  ): ParameterEnvironment | undefined => {
    if (ts.isBlock(statement)) {
      let current: ParameterEnvironment | undefined = environment;
      for (const child of statement.statements) {
        if (!current) break;
        current = analyzeParameterStatement(child, current, returned);
      }
      return current;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        assignParameterDeclaration(declaration, environment);
      }
      return environment;
    }
    if (ts.isExpressionStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      return environment;
    }
    if (ts.isReturnStatement(statement)) {
      if (statement.expression) {
        for (const index of parameterOrigins(
          statement.expression,
          environment,
        )) {
          returned.add(index);
        }
      }
      return undefined;
    }
    if (ts.isThrowStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      return undefined;
    }
    if (ts.isIfStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      const whenTrue = analyzeParameterStatement(
        statement.thenStatement,
        cloneParameterEnvironment(environment),
        returned,
      );
      const whenFalse = statement.elseStatement
        ? analyzeParameterStatement(
            statement.elseStatement,
            cloneParameterEnvironment(environment),
            returned,
          )
        : cloneParameterEnvironment(environment);
      if (!whenTrue) return whenFalse;
      if (!whenFalse) return whenTrue;
      return mergeParameterEnvironments(whenTrue, whenFalse);
    }
    if (ts.isSwitchStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      const exits: ParameterEnvironment[] = [];
      let hasDefault = false;
      for (const clause of statement.caseBlock.clauses) {
        hasDefault ||= ts.isDefaultClause(clause);
        const block = ts.factory.createBlock([...clause.statements], true);
        const exit = analyzeParameterStatement(
          block,
          cloneParameterEnvironment(environment),
          returned,
        );
        if (exit) exits.push(exit);
      }
      if (!hasDefault) exits.push(cloneParameterEnvironment(environment));
      return exits.length > 0
        ? mergeParameterEnvironments(...exits)
        : undefined;
    }
    if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      const body = analyzeParameterStatement(
        statement.statement,
        cloneParameterEnvironment(environment),
        returned,
      );
      if (ts.isDoStatement(statement)) return body;
      return body
        ? mergeParameterEnvironments(environment, body)
        : cloneParameterEnvironment(environment);
    }
    if (ts.isForStatement(statement)) {
      if (statement.initializer) {
        if (ts.isVariableDeclarationList(statement.initializer)) {
          for (const declaration of statement.initializer.declarations) {
            assignParameterDeclaration(declaration, environment);
          }
        } else {
          parameterOrigins(statement.initializer, environment);
        }
      }
      if (statement.condition)
        parameterOrigins(statement.condition, environment);
      const body = analyzeParameterStatement(
        statement.statement,
        cloneParameterEnvironment(environment),
        returned,
      );
      if (body && statement.incrementor)
        parameterOrigins(statement.incrementor, body);
      return body
        ? mergeParameterEnvironments(environment, body)
        : cloneParameterEnvironment(environment);
    }
    if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
      parameterOrigins(statement.expression, environment);
      const bodyEnvironment = cloneParameterEnvironment(environment);
      if (ts.isVariableDeclarationList(statement.initializer)) {
        for (const declaration of statement.initializer.declarations) {
          assignParameterDeclaration(declaration, bodyEnvironment);
        }
      } else {
        parameterOrigins(statement.initializer, bodyEnvironment);
      }
      const body = analyzeParameterStatement(
        statement.statement,
        bodyEnvironment,
        returned,
      );
      return body
        ? mergeParameterEnvironments(environment, body)
        : cloneParameterEnvironment(environment);
    }
    if (ts.isTryStatement(statement)) {
      const exits: ParameterEnvironment[] = [];
      const tryExit = analyzeParameterStatement(
        statement.tryBlock,
        cloneParameterEnvironment(environment),
        returned,
      );
      if (tryExit) exits.push(tryExit);
      if (statement.catchClause) {
        const catchExit = analyzeParameterStatement(
          statement.catchClause.block,
          cloneParameterEnvironment(environment),
          returned,
        );
        if (catchExit) exits.push(catchExit);
      } else {
        exits.push(cloneParameterEnvironment(environment));
      }
      if (exits.length === 0) return undefined;
      const combined = mergeParameterEnvironments(...exits);
      return statement.finallyBlock
        ? analyzeParameterStatement(statement.finallyBlock, combined, returned)
        : combined;
    }
    if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
      return analyzeParameterStatement(
        statement.statement,
        environment,
        returned,
      );
    }
    return environment;
  };
  function ensureReturnedArgumentIndexes(
    implementation: ts.FunctionLikeDeclaration,
  ): ReadonlySet<number> {
    collectFunctionReturns(implementation);
    const existing = returnedArgumentIndexes.get(implementation);
    if (existing) return existing;
    if (returnedArgumentIndexesInProgress.has(implementation)) {
      return new Set(
        implementation.parameters.flatMap((parameter, index) =>
          ts.isIdentifier(parameter.name) ? [index] : [],
        ),
      );
    }
    returnedArgumentIndexesInProgress.add(implementation);
    const environment: ParameterEnvironment = new Map();
    implementation.parameters.forEach((parameter, index) => {
      if (!ts.isIdentifier(parameter.name)) return;
      const binding = resolveBinding(parameter.name, parameter.name.text);
      if (binding) environment.set(binding, new Set([index]));
    });
    const indexes = new Set<number>();
    if (implementation.body) {
      if (ts.isBlock(implementation.body)) {
        analyzeParameterStatement(implementation.body, environment, indexes);
      } else {
        for (const index of parameterOrigins(
          implementation.body,
          environment,
        )) {
          indexes.add(index);
        }
      }
    }
    returnedArgumentIndexesInProgress.delete(implementation);
    returnedArgumentIndexes.set(implementation, indexes);
    return indexes;
  }
  for (const implementation of returnsByFunction.keys()) {
    ensureReturnedArgumentIndexes(implementation);
  }
  const scopedPropertyName = (name: ts.PropertyName): string | undefined => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name)
    ) {
      return name.text;
    }
    return ts.isComputedPropertyName(name)
      ? scopedStaticString(name.expression)
      : undefined;
  };
  let callFlowStable = false;
  let unstableCallImplementationCache = new WeakMap<
    ts.Expression,
    Set<ts.FunctionLikeDeclaration>
  >();
  const stableCallImplementationCache = new WeakMap<
    ts.Expression,
    Set<ts.FunctionLikeDeclaration>
  >();
  const callImplementationsUncached = (
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
      return callImplementations(
        expression.expression,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
      ensureReturnedArgumentIndexes(expression);
      return new Set([expression]);
    }
    if (ts.isConditionalExpression(expression)) {
      return new Set([
        ...callImplementations(
          expression.whenTrue,
          resolvingBindings,
          nextNodes,
        ),
        ...callImplementations(
          expression.whenFalse,
          resolvingBindings,
          nextNodes,
        ),
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
      return callImplementations(
        expression.right,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding || resolvingBindings.has(binding)) return new Set();
      if (!callFlowStable) return new Set(localFunctions.get(binding) ?? []);
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
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
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
    for (const object of objectSources(
      expression.expression,
      resolvingBindings,
      nextNodes,
    )) {
      for (const member of object.properties) {
        if (ts.isSpreadAssignment(member)) {
          if (nextNodes.has(member)) continue;
          const spreadAccess = ts.factory.createPropertyAccessExpression(
            member.expression,
            property,
          );
          for (const implementation of callImplementations(
            spreadAccess,
            resolvingBindings,
            new Set(nextNodes).add(member),
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
  const callImplementations = (
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): Set<ts.FunctionLikeDeclaration> => {
    const cacheable =
      callFlowStable &&
      resolvingBindings.size === 0 &&
      resolvingNodes.size === 0;
    const iterationCacheable =
      !callFlowStable &&
      resolvingBindings.size === 0 &&
      resolvingNodes.size === 0;
    if (!cacheable && !iterationCacheable) {
      return callImplementationsUncached(
        expression,
        resolvingBindings,
        resolvingNodes,
      );
    }
    if (iterationCacheable) {
      const cached = unstableCallImplementationCache.get(expression);
      if (cached) return cached;
      const implementations = callImplementationsUncached(
        expression,
        resolvingBindings,
        resolvingNodes,
      );
      unstableCallImplementationCache.set(expression, implementations);
      return implementations;
    }
    const cached = stableCallImplementationCache.get(expression);
    if (cached) return cached;
    const implementations = callImplementationsUncached(
      expression,
      resolvingBindings,
      resolvingNodes,
    );
    stableCallImplementationCache.set(expression, implementations);
    return implementations;
  };
  const localCallExpressions: Array<ts.CallExpression | ts.NewExpression> = [];
  const collectLocalCallExpressions = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      localCallExpressions.push(node);
    }
    ts.forEachChild(node, collectLocalCallExpressions);
  };
  collectLocalCallExpressions(root);
  const callArgumentsByImplementation = new Map<
    ts.FunctionLikeDeclaration,
    Set<ts.CallExpression | ts.NewExpression>
  >();
  const relationSourcesByTarget = new Map<AliasBinding, Set<ts.Expression>>();
  for (const { target, source } of relations) {
    const sources =
      relationSourcesByTarget.get(target) ?? new Set<ts.Expression>();
    sources.add(source);
    relationSourcesByTarget.set(target, sources);
  }
  const addCallRelation = (
    target: AliasBinding,
    source: ts.Expression,
  ): boolean => {
    const sources =
      relationSourcesByTarget.get(target) ?? new Set<ts.Expression>();
    if (sources.has(source)) return false;
    sources.add(source);
    relationSourcesByTarget.set(target, sources);
    const relation = { target, source };
    relations.push(relation);
    const entries = relationsByTarget.get(target) ?? [];
    entries.push(relation);
    relationsByTarget.set(target, entries);
    return true;
  };
  let callFlowIteration = 0;
  let callFlowWork = 0;
  for (;;) {
    unstableCallImplementationCache = new WeakMap<
      ts.Expression,
      Set<ts.FunctionLikeDeclaration>
    >();
    callFlowIteration += 1;
    callFlowWork += localCallExpressions.length;
    if (callFlowIteration > 64 || callFlowWork > 200_000) {
      limitations.add("call-flow propagation budget exceeded");
      break;
    }
    let changed = false;
    for (const relation of relations) {
      for (const implementation of callableValue(relation.source)) {
        changed = addLocalFunction(relation.target, implementation) || changed;
      }
    }
    for (const call of localCallExpressions) {
      for (const implementation of callImplementations(call.expression)) {
        const calls =
          callArgumentsByImplementation.get(implementation) ?? new Set();
        const previousSize = calls.size;
        calls.add(call);
        callArgumentsByImplementation.set(implementation, calls);
        changed ||= calls.size !== previousSize;
        for (const [index, parameter] of implementation.parameters.entries()) {
          if (!ts.isIdentifier(parameter.name)) continue;
          const target = resolveBinding(parameter.name, parameter.name.text);
          if (!target) continue;
          if (parameter.dotDotDotToken) {
            for (
              let argumentIndex = index;
              argumentIndex < (call.arguments?.length ?? 0);
              argumentIndex += 1
            ) {
              const source = argumentExpression(
                call.arguments?.[argumentIndex],
              );
              if (source) {
                const added = addCallRelation(target, source);
                changed = added || changed;
              }
            }
            continue;
          }
          const source = argumentExpression(call.arguments?.[index]);
          if (source) {
            const added = addCallRelation(target, source);
            changed = added || changed;
          }
        }
      }
    }
    if (!changed) break;
  }
  callFlowStable = true;
  const directlyResolvedLocalCalls = new Set(
    localCallExpressions.filter((call) => {
      if (!ts.isIdentifier(call.expression)) return false;
      const binding = resolveBinding(call.expression, call.expression.text);
      return (
        binding !== undefined &&
        (localFunctions.get(binding)?.size ?? 0) > 0 &&
        (relationsByTarget.get(binding)?.length ?? 0) === 0
      );
    }),
  );
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
  const dynamicPropertyWritesByBinding = new Map<
    AliasBinding,
    ts.Expression[]
  >();
  const dynamicExpressionWrites: Array<{
    target: ts.PropertyAccessExpression | ts.ElementAccessExpression;
    source?: ts.Expression;
    selection?: DynamicConstructorSelection;
    direct: boolean;
  }> = [];
  const dynamicPropertyKey = (
    binding: AliasBinding,
    property: string | undefined,
  ): string => `${binding.id}:${property ?? "*"}`;
  const recordDynamicPropertyWrite = (
    binding: AliasBinding,
    property: string | undefined,
    source: ts.Expression,
  ): void => {
    const key = dynamicPropertyKey(binding, property);
    const sources = dynamicPropertyWrites.get(key) ?? [];
    sources.push(source);
    dynamicPropertyWrites.set(key, sources);
    const allSources = dynamicPropertyWritesByBinding.get(binding) ?? [];
    allSources.push(source);
    dynamicPropertyWritesByBinding.set(binding, allSources);
  };
  const unknownPropertyExpression = (): ts.Expression =>
    ts.factory.createIdentifier("__privateHostedUnknownProperty");
  const recordMutatorWrite = (
    target: ts.Expression,
    propertyExpression: ts.Expression | undefined,
    source: ts.Expression,
  ): void => {
    const property = propertyExpression
      ? scopedStaticString(propertyExpression)
      : undefined;
    const access = ts.factory.createElementAccessExpression(
      target,
      propertyExpression ?? unknownPropertyExpression(),
    );
    dynamicExpressionWrites.push({ target: access, source, direct: false });
    if (ts.isIdentifier(target)) {
      const binding = resolveBinding(target, target.text);
      if (binding) recordDynamicPropertyWrite(binding, property, source);
    }
  };
  const bindingIdentifiers = (name: ts.BindingName): ts.Identifier[] => {
    if (ts.isIdentifier(name)) return [name];
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : bindingIdentifiers(element.name),
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
    if (
      ts.isPropertyAccessExpression(target) ||
      ts.isElementAccessExpression(target)
    ) {
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
          if (
            ts.isObjectLiteralExpression(destination) ||
            ts.isArrayLiteralExpression(destination)
          ) {
            collectDynamicAssignmentSelections(destination, initializer);
          }
          addDynamicAssignmentSelection(
            destination,
            { container: initializer, property },
            false,
          );
        }
      }
      return;
    }
    for (const [index, element] of target.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      const destination = ts.isSpreadElement(element)
        ? element.expression
        : element;
      if (
        ts.isObjectLiteralExpression(destination) ||
        ts.isArrayLiteralExpression(destination)
      ) {
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
  type BindingProjection = {
    container: ts.Expression;
    properties: Array<string | undefined>;
  };
  const bindingProjectionsByBinding = new Map<
    AliasBinding,
    BindingProjection[]
  >();
  const collectBindingProjections = (
    name: ts.BindingName,
    container: ts.Expression,
    properties: Array<string | undefined> = [],
  ): void => {
    if (ts.isIdentifier(name)) {
      const binding = resolveBinding(name, name.text);
      if (!binding) return;
      const projections = bindingProjectionsByBinding.get(binding) ?? [];
      projections.push({ container, properties });
      bindingProjectionsByBinding.set(binding, projections);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const propertyNode =
          element.propertyName ??
          (ts.isIdentifier(element.name) ? element.name : undefined);
        const property = propertyNode
          ? ts.isComputedPropertyName(propertyNode)
            ? scopedStaticString(propertyNode.expression)
            : scopedPropertyName(propertyNode)
          : undefined;
        collectBindingProjections(element.name, container, [
          ...properties,
          property,
        ]);
        if (element.initializer) {
          collectBindingProjections(element.name, element.initializer);
        }
      }
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      collectBindingProjections(element.name, container, [
        ...properties,
        element.dotDotDotToken ? undefined : String(index),
      ]);
      if (element.initializer) {
        collectBindingProjections(element.name, element.initializer);
      }
    }
  };
  const markConstructorBindingsInPattern = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) return;
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const propertyNode =
          element.propertyName ??
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
      if (!ts.isOmittedExpression(element))
        markConstructorBindingsInPattern(element.name);
    }
  };
  function isProjectedGlobalNamespace(
    owner: ts.Expression,
    properties: Array<string | undefined>,
    name: "Object" | "Reflect",
    resolvingBindings: ReadonlySet<AliasBinding>,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean {
    if (properties.length === 0) {
      return isGlobalNamespaceAlias(
        owner,
        name,
        resolvingBindings,
        resolvingNodes,
      );
    }
    if (resolvingNodes.has(owner) || properties.length > 64) return false;
    const nextNodes = new Set(resolvingNodes).add(owner);
    if (
      ts.isParenthesizedExpression(owner) ||
      ts.isAsExpression(owner) ||
      ts.isTypeAssertionExpression(owner) ||
      ts.isNonNullExpression(owner) ||
      ts.isSatisfiesExpression(owner) ||
      ts.isAwaitExpression(owner)
    ) {
      return isProjectedGlobalNamespace(
        owner.expression,
        properties,
        name,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(owner)) {
      return (
        isProjectedGlobalNamespace(
          owner.whenTrue,
          properties,
          name,
          resolvingBindings,
          nextNodes,
        ) ||
        isProjectedGlobalNamespace(
          owner.whenFalse,
          properties,
          name,
          resolvingBindings,
          nextNodes,
        )
      );
    }
    const [selected, ...remaining] = properties;
    if (ts.isArrayLiteralExpression(owner)) {
      const index =
        selected !== undefined && /^(?:0|[1-9]\d*)$/.test(selected)
          ? Number(selected)
          : undefined;
      return owner.elements.some(
        (element, currentIndex) =>
          !ts.isOmittedExpression(element) &&
          (index === undefined || index === currentIndex) &&
          isProjectedGlobalNamespace(
            ts.isSpreadElement(element) ? element.expression : element,
            remaining,
            name,
            resolvingBindings,
            nextNodes,
          ),
      );
    }
    if (ts.isObjectLiteralExpression(owner)) {
      return owner.properties.some((member) => {
        if (ts.isSpreadAssignment(member)) {
          return isProjectedGlobalNamespace(
            member.expression,
            properties,
            name,
            resolvingBindings,
            nextNodes,
          );
        }
        if (
          selected !== undefined &&
          scopedPropertyName(member.name) !== selected
        )
          return false;
        const value = ts.isPropertyAssignment(member)
          ? member.initializer
          : ts.isShorthandPropertyAssignment(member)
            ? member.name
            : undefined;
        return (
          value !== undefined &&
          isProjectedGlobalNamespace(
            value,
            remaining,
            name,
            resolvingBindings,
            nextNodes,
          )
        );
      });
    }
    if (
      ts.isPropertyAccessExpression(owner) ||
      ts.isElementAccessExpression(owner)
    ) {
      return isProjectedGlobalNamespace(
        owner.expression,
        [assignedPropertyName(owner), ...properties],
        name,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isCallExpression(owner)) {
      return [...callImplementations(owner.expression)].some((implementation) =>
        (returnsByFunction.get(implementation) ?? []).some((returned) =>
          isProjectedGlobalNamespace(
            returned,
            properties,
            name,
            resolvingBindings,
            nextNodes,
          ),
        ),
      );
    }
    if (!ts.isIdentifier(owner)) return false;
    const binding = resolveBinding(owner, owner.text);
    if (!binding || resolvingBindings.has(binding)) return false;
    const nextBindings = new Set(resolvingBindings).add(binding);
    return (
      (relationsByTarget.get(binding) ?? []).some(({ source }) =>
        isProjectedGlobalNamespace(
          source,
          properties,
          name,
          nextBindings,
          nextNodes,
        ),
      ) ||
      (bindingProjectionsByBinding.get(binding) ?? []).some((projection) =>
        isProjectedGlobalNamespace(
          projection.container,
          [...projection.properties, ...properties],
          name,
          nextBindings,
          nextNodes,
        ),
      )
    );
  }
  function isGlobalNamespaceAlias(
    expression: ts.Expression,
    name: "Object" | "Reflect",
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean {
    if (resolvingNodes.has(expression)) return false;
    const nextNodes = new Set(resolvingNodes).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return isGlobalNamespaceAlias(
        expression.expression,
        name,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        isGlobalNamespaceAlias(
          expression.whenTrue,
          name,
          resolvingBindings,
          nextNodes,
        ) ||
        isGlobalNamespaceAlias(
          expression.whenFalse,
          name,
          resolvingBindings,
          nextNodes,
        )
      );
    }
    if (ts.isCallExpression(expression)) {
      return [...callImplementations(expression.expression)].some(
        (implementation) =>
          (returnsByFunction.get(implementation) ?? []).some((returned) =>
            isGlobalNamespaceAlias(
              returned,
              name,
              resolvingBindings,
              nextNodes,
            ),
          ),
      );
    }
    if (!ts.isIdentifier(expression)) return false;
    const binding = resolveBinding(expression, expression.text);
    if (!binding) return expression.text === name;
    if (resolvingBindings.has(binding)) return false;
    const nextBindings = new Set(resolvingBindings).add(binding);
    return (
      (relationsByTarget.get(binding) ?? []).some(({ source }) =>
        isGlobalNamespaceAlias(source, name, nextBindings, nextNodes),
      ) ||
      (bindingProjectionsByBinding.get(binding) ?? []).some((projection) =>
        isProjectedGlobalNamespace(
          projection.container,
          projection.properties,
          name,
          nextBindings,
          nextNodes,
        ),
      )
    );
  }
  const collectDynamicBindingSelections = (
    name: ts.BindingName,
    initializer: ts.Expression,
  ): void => {
    if (ts.isIdentifier(name)) return;
    collectBindingProjections(name, initializer);
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const propertyNode =
          element.propertyName ??
          (ts.isIdentifier(element.name) ? element.name : undefined);
        const property = propertyNode
          ? ts.isComputedPropertyName(propertyNode)
            ? scopedStaticString(propertyNode.expression)
            : scopedPropertyName(propertyNode)
          : undefined;
        if (!ts.isIdentifier(element.name) && property !== undefined) {
          collectDynamicBindingSelections(
            element.name,
            ts.factory.createElementAccessExpression(
              initializer,
              ts.factory.createStringLiteral(property),
            ),
          );
        } else {
          addDynamicSelection(element.name, {
            container: initializer,
            property,
          });
        }
      }
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (!ts.isOmittedExpression(element)) {
        const property = element.dotDotDotToken ? undefined : String(index);
        if (!ts.isIdentifier(element.name) && property !== undefined) {
          collectDynamicBindingSelections(
            element.name,
            ts.factory.createElementAccessExpression(
              initializer,
              ts.factory.createStringLiteral(property),
            ),
          );
        } else {
          addDynamicSelection(element.name, {
            container: initializer,
            property,
          });
        }
      }
    }
  };
  const collectDynamicConstructorFlows = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      collectDynamicBindingSelections(node.name, node.initializer);
    }
    if (ts.isParameter(node)) {
      const implementation = node.parent as ts.FunctionLikeDeclaration;
      const parameterIndex = implementation.parameters.indexOf(node);
      let projected = false;
      for (const call of callArgumentsByImplementation.get(implementation) ??
        []) {
        const argument = argumentExpression(call.arguments?.[parameterIndex]);
        if (!argument) continue;
        collectDynamicBindingSelections(node.name, argument);
        projected = true;
      }
      if (!projected) markConstructorBindingsInPattern(node.name);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const target = ts.isParenthesizedExpression(node.left)
        ? node.left.expression
        : node.left;
      if (
        ts.isObjectLiteralExpression(target) ||
        ts.isArrayLiteralExpression(target)
      ) {
        collectDynamicAssignmentSelections(target, node.right);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      isValuePropagatingAssignment(node.operatorToken.kind) &&
      (ts.isPropertyAccessExpression(node.left) ||
        ts.isElementAccessExpression(node.left))
    ) {
      dynamicExpressionWrites.push({
        target: node.left,
        source: node.right,
        direct: false,
      });
      if (ts.isIdentifier(node.left.expression)) {
        const owner = resolveBinding(
          node.left.expression,
          node.left.expression.text,
        );
        if (owner) {
          recordDynamicPropertyWrite(
            owner,
            assignedPropertyName(node.left),
            node.right,
          );
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression))
    ) {
      const method = assignedPropertyName(node.expression);
      const namespace = node.expression.expression;
      const target = argumentExpression(node.arguments[0]);
      if (
        target &&
        method === "defineProperty" &&
        (isGlobalNamespaceAlias(namespace, "Object") ||
          isGlobalNamespaceAlias(namespace, "Reflect"))
      ) {
        const property = argumentExpression(node.arguments[1]);
        const descriptor = argumentExpression(node.arguments[2]);
        if (descriptor) {
          recordMutatorWrite(
            target,
            property,
            ts.factory.createPropertyAccessExpression(descriptor, "value"),
          );
        }
      }
      if (
        target &&
        method === "defineProperties" &&
        isGlobalNamespaceAlias(namespace, "Object")
      ) {
        const descriptors = argumentExpression(node.arguments[1]);
        if (descriptors && ts.isObjectLiteralExpression(descriptors)) {
          for (const member of descriptors.properties) {
            if (
              !ts.isPropertyAssignment(member) &&
              !ts.isShorthandPropertyAssignment(member)
            ) {
              continue;
            }
            const descriptor = ts.isPropertyAssignment(member)
              ? member.initializer
              : member.name;
            const property =
              member.name && !ts.isComputedPropertyName(member.name)
                ? ts.factory.createStringLiteral(
                    scopedPropertyName(member.name) ?? "",
                  )
                : ts.isComputedPropertyName(member.name)
                  ? member.name.expression
                  : undefined;
            recordMutatorWrite(
              target,
              property,
              ts.factory.createPropertyAccessExpression(descriptor, "value"),
            );
          }
        } else if (descriptors) {
          const descriptor = ts.factory.createElementAccessExpression(
            descriptors,
            unknownPropertyExpression(),
          );
          recordMutatorWrite(
            target,
            undefined,
            ts.factory.createPropertyAccessExpression(descriptor, "value"),
          );
        }
      }
      if (
        target &&
        method === "assign" &&
        isGlobalNamespaceAlias(namespace, "Object")
      ) {
        for (const argument of node.arguments.slice(1)) {
          const sourceObject = argumentExpression(argument);
          if (!sourceObject) continue;
          if (ts.isObjectLiteralExpression(sourceObject)) {
            for (const member of sourceObject.properties) {
              if (ts.isPropertyAssignment(member)) {
                const property = ts.isComputedPropertyName(member.name)
                  ? member.name.expression
                  : ts.factory.createStringLiteral(
                      scopedPropertyName(member.name) ?? "",
                    );
                recordMutatorWrite(target, property, member.initializer);
              } else if (ts.isShorthandPropertyAssignment(member)) {
                recordMutatorWrite(
                  target,
                  ts.factory.createStringLiteral(member.name.text),
                  member.name,
                );
              }
            }
          } else {
            recordMutatorWrite(
              target,
              undefined,
              ts.factory.createElementAccessExpression(
                sourceObject,
                unknownPropertyExpression(),
              ),
            );
          }
        }
      }
    }
    ts.forEachChild(node, collectDynamicConstructorFlows);
  };
  collectDynamicConstructorFlows(root);
  type PropertyValueTransfer = {
    property: string | undefined;
    propertyExpression?: ts.Expression;
    owner?: ts.Expression;
    value?: ts.Expression | ts.FunctionLikeDeclaration;
    selection?: DynamicConstructorSelection;
    direct?: boolean;
    spread?: boolean;
    literal?: boolean;
  };
  const propertyValueTransfers: PropertyValueTransfer[] =
    dynamicExpressionWrites.map(({ target, source, selection, direct }) => ({
      property: assignedPropertyName(target),
      propertyExpression: ts.isElementAccessExpression(target)
        ? target.argumentExpression
        : undefined,
      owner: target.expression,
      value: source,
      selection,
      direct,
    }));
  const collectLiteralPropertyTransfers = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const member of node.properties) {
        if (ts.isSpreadAssignment(member)) {
          propertyValueTransfers.push({
            property: undefined,
            owner: node,
            value: member.expression,
            spread: true,
            literal: true,
          });
          continue;
        }
        const property = ts.isComputedPropertyName(member.name)
          ? scopedStaticString(member.name.expression)
          : scopedPropertyName(member.name);
        const value = ts.isPropertyAssignment(member)
          ? member.initializer
          : ts.isShorthandPropertyAssignment(member)
            ? member.name
            : ts.isMethodDeclaration(member) ||
                ts.isGetAccessorDeclaration(member) ||
                ts.isSetAccessorDeclaration(member)
              ? member
              : undefined;
        if (value !== undefined) {
          propertyValueTransfers.push({
            property,
            owner: node,
            value,
            literal: true,
          });
        }
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const [index, element] of node.elements.entries()) {
        if (ts.isOmittedExpression(element)) continue;
        propertyValueTransfers.push({
          property: ts.isSpreadElement(element) ? undefined : String(index),
          owner: node,
          value: ts.isSpreadElement(element) ? element.expression : element,
          spread: ts.isSpreadElement(element),
          literal: true,
        });
      }
    }
    ts.forEachChild(node, collectLiteralPropertyTransfers);
  };
  collectLiteralPropertyTransfers(root);
  const sameDynamicPropertyExpression = (
    left: ts.Expression,
    right: ts.Expression,
  ): boolean => {
    if (left === right) return true;
    const leftStatic = scopedStaticString(left);
    const rightStatic = scopedStaticString(right);
    if (leftStatic !== undefined || rightStatic !== undefined) {
      return leftStatic !== undefined && leftStatic === rightStatic;
    }
    if (!ts.isIdentifier(left) || !ts.isIdentifier(right)) return false;
    const leftBinding = resolveBinding(left, left.text);
    return (
      leftBinding !== undefined &&
      leftBinding === resolveBinding(right, right.text)
    );
  };
  const conditionProvesNonCallable = (
    condition: ts.Expression,
    value: ts.Expression,
  ): boolean => {
    if (ts.isParenthesizedExpression(condition)) {
      return conditionProvesNonCallable(condition.expression, value);
    }
    if (
      ts.isBinaryExpression(condition) &&
      condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return (
        conditionProvesNonCallable(condition.left, value) ||
        conditionProvesNonCallable(condition.right, value)
      );
    }
    if (
      !ts.isBinaryExpression(condition) ||
      ![
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(condition.operatorToken.kind)
    ) {
      return false;
    }
    const isGuardedTypeof = (
      left: ts.Expression,
      right: ts.Expression,
    ): boolean =>
      ts.isTypeOfExpression(left) &&
      sameDynamicPropertyExpression(left.expression, value) &&
      scopedStaticString(right) === "function";
    return (
      isGuardedTypeof(condition.left, condition.right) ||
      isGuardedTypeof(condition.right, condition.left)
    );
  };
  const isGuardedByNonCallableCheck = (value: ts.Expression): boolean => {
    let current: ts.Node = value;
    while (current.parent && !ts.isFunctionLike(current.parent)) {
      const parent = current.parent;
      if (
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        current === parent.right &&
        conditionProvesNonCallable(parent.left, value)
      ) {
        return true;
      }
      if (
        ts.isConditionalExpression(parent) &&
        current === parent.whenTrue &&
        conditionProvesNonCallable(parent.condition, value)
      ) {
        return true;
      }
      if (
        ts.isIfStatement(parent) &&
        current === parent.thenStatement &&
        conditionProvesNonCallable(parent.expression, value)
      ) {
        return true;
      }
      current = parent;
    }
    return false;
  };
  const latestDefiniteAssignmentBefore = (
    value: ts.Identifier,
    binding: AliasBinding,
  ): ts.Expression | undefined => {
    let current: ts.Node = value;
    while (current.parent && !ts.isFunctionLike(current.parent)) {
      const parent = current.parent;
      if (
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.CommaToken &&
        current === parent.right
      ) {
        const assigned = latestDefiniteAssignmentValue(parent.left, binding);
        if (assigned) return assigned;
      }
      current = parent;
    }
    return undefined;
  };
  const isDefinitelyNonCallableExpression = (
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
      return isDefinitelyNonCallableExpression(
        expression.expression,
        resolving,
      );
    }
    if (
      ts.isNumericLiteral(expression) ||
      ts.isStringLiteralLike(expression) ||
      ts.isTemplateExpression(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      ts.isTypeOfExpression(expression) ||
      ts.isPrefixUnaryExpression(expression)
    ) {
      return true;
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        isDefinitelyNonCallableExpression(expression.whenTrue, resolving) &&
        isDefinitelyNonCallableExpression(expression.whenFalse, resolving)
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind)
      ) {
        return isDefinitelyNonCallableExpression(expression.right, resolving);
      }
      if (
        expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        return isDefinitelyNonCallableExpression(expression.right, resolving);
      }
      if (
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          isDefinitelyNonCallableExpression(expression.left, resolving) &&
          isDefinitelyNonCallableExpression(expression.right, resolving)
        );
      }
      return true;
    }
    if (!ts.isIdentifier(expression)) return false;
    const binding = resolveBinding(expression, expression.text);
    if (!binding || resolving.has(binding)) return false;
    const assigned = latestDefiniteAssignmentBefore(expression, binding);
    return (
      assigned !== undefined &&
      isDefinitelyNonCallableExpression(
        assigned,
        new Set(resolving).add(binding),
      )
    );
  };
  const dynamicCandidateProperties = new Set<string>();
  const dynamicCandidatePropertyNames = new Set<string>();
  const dynamicCandidatePropertiesByBinding = new Map<
    AliasBinding,
    Set<string>
  >();
  const dynamicCandidatePropertiesByExpression = new WeakMap<
    ts.Expression,
    Set<string>
  >();
  let dynamicCandidateWildcard = false;
  const dynamicCandidateWildcardBindings = new Set<AliasBinding>();
  const dynamicCandidateWildcardExpressions = new WeakSet<ts.Expression>();
  let hasScopedDynamicCandidateProperty = false;
  const defaultCandidateAnalysisBudget = 2_000_000;
  const requestedCandidateAnalysisBudget = Number(
    process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET,
  );
  let candidateAnalysisBudget =
    Number.isSafeInteger(requestedCandidateAnalysisBudget) &&
    requestedCandidateAnalysisBudget >= 0
      ? Math.min(
          requestedCandidateAnalysisBudget,
          defaultCandidateAnalysisBudget,
        )
      : defaultCandidateAnalysisBudget;
  let candidateAnalysisBudgetExceeded = false;
  const spendCandidateAnalysisBudget = (units = 1): boolean => {
    if (candidateAnalysisBudgetExceeded) return false;
    candidateAnalysisBudget -= units;
    if (candidateAnalysisBudget >= 0) return true;
    candidateAnalysisBudgetExceeded = true;
    limitations.add("dynamic property candidate shared budget exceeded");
    return false;
  };
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
      (ts.isCallExpression(current.parent) ||
        ts.isNewExpression(current.parent)) &&
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
      return (
        ["apply", "bind", "call"].includes(property ?? "") &&
        (ts.isCallExpression(invocation) || ts.isNewExpression(invocation)) &&
        invocation.expression === current.parent
      );
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
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      (ts.isPropertyAccessExpression(node)
        ? node.name.text
        : node.argumentExpression
          ? scopedStaticString(node.argumentExpression)
          : undefined) === "constructor"
    ) {
      const parent = node.parent;
      const assignmentTarget =
        ts.isBinaryExpression(parent) &&
        parent.left === node &&
        isValuePropagatingAssignment(parent.operatorToken.kind);
      const prototypeInspection =
        (ts.isPropertyAccessExpression(parent) ||
          ts.isElementAccessExpression(parent)) &&
        parent.expression === node &&
        (ts.isPropertyAccessExpression(parent)
          ? parent.name.text
          : parent.argumentExpression
            ? scopedStaticString(parent.argumentExpression)
            : undefined) === "prototype";
      if (
        !assignmentTarget &&
        !prototypeInspection &&
        !isImmediateDynamicConstructorUse(node)
      ) {
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
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): DynamicExpressionPath[] => {
    if (resolvingNodes.has(expression)) return [];
    const nextNodes = new Set(resolvingNodes).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return dynamicExpressionPaths(
        expression.expression,
        resolving,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return [
        ...dynamicExpressionPaths(expression.whenTrue, resolving, nextNodes),
        ...dynamicExpressionPaths(expression.whenFalse, resolving, nextNodes),
      ];
    }
    if (
      ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind))
    ) {
      return dynamicExpressionPaths(expression.right, resolving, nextNodes);
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding) return [];
      return [{ root: canonicalObjectBinding(binding), properties: [] }];
    }
    if (ts.isCallExpression(expression)) {
      const paths: DynamicExpressionPath[] = [];
      for (const implementation of callImplementations(expression.expression)) {
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          paths.push(...dynamicExpressionPaths(returned, resolving, nextNodes));
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(expression.arguments[index]);
          if (argument)
            paths.push(
              ...dynamicExpressionPaths(argument, resolving, nextNodes),
            );
        }
      }
      return paths;
    }
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
      return [];
    }
    const property = assignedPropertyName(expression);
    return dynamicExpressionPaths(
      expression.expression,
      resolving,
      nextNodes,
    ).map((path) => ({
      root: path.root,
      properties: [...path.properties, property],
    }));
  };
  const pathsOverlap = (
    left: DynamicExpressionPath,
    right: DynamicExpressionPath,
  ): boolean =>
    left.root === right.root &&
    left.properties.length === right.properties.length &&
    left.properties.every(
      (property, index) =>
        property === undefined ||
        right.properties[index] === undefined ||
        property === right.properties[index],
    );
  type IndexedDynamicExpressionWrite = {
    write: (typeof dynamicExpressionWrites)[number];
    targetPaths: DynamicExpressionPath[];
  };
  let dynamicExpressionWriteIndex:
    | Map<string, IndexedDynamicExpressionWrite[]>
    | undefined;
  const dynamicExpressionPathBucket = (path: DynamicExpressionPath): string =>
    `${path.root.id}:${path.properties.length}`;
  type CandidateAliasState = ts.Expression | AliasBinding;
  type CandidateAliasClosure = {
    roots: Set<AliasBinding>;
    transitions: Array<{
      property: string | undefined;
      target: ts.Expression;
    }>;
    unknown: boolean;
  };
  type CandidateAliasScope = "hit" | "miss" | "unknown";
  const candidateAliasClosureMemo = new Map<
    CandidateAliasState,
    CandidateAliasClosure
  >();
  const isCandidateAliasExpression = (
    state: CandidateAliasState,
  ): state is ts.Expression => typeof (state as ts.Node).kind === "number";
  const candidateAliasClosure = (
    start: CandidateAliasState,
  ): CandidateAliasClosure => {
    const cached = candidateAliasClosureMemo.get(start);
    if (cached) return cached;
    const roots = new Set<AliasBinding>();
    const transitions: CandidateAliasClosure["transitions"] = [];
    const pending: CandidateAliasState[] = [start];
    const visited = new Set<CandidateAliasState>();
    let unknown = false;
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const state = pending[cursor];
      if (!state || visited.has(state)) continue;
      visited.add(state);
      if (!spendCandidateAnalysisBudget()) {
        unknown = true;
        break;
      }
      if (!isCandidateAliasExpression(state)) {
        roots.add(canonicalObjectBinding(state));
        for (const relation of relationsByTarget.get(state) ?? []) {
          pending.push(relation.source);
        }
        continue;
      }
      if (
        ts.isParenthesizedExpression(state) ||
        ts.isAsExpression(state) ||
        ts.isTypeAssertionExpression(state) ||
        ts.isNonNullExpression(state) ||
        ts.isSatisfiesExpression(state) ||
        ts.isAwaitExpression(state)
      ) {
        pending.push(state.expression);
        continue;
      }
      if (ts.isConditionalExpression(state)) {
        pending.push(state.whenTrue, state.whenFalse);
        continue;
      }
      if (ts.isBinaryExpression(state)) {
        if (
          state.operatorToken.kind === ts.SyntaxKind.CommaToken ||
          isValuePropagatingAssignment(state.operatorToken.kind)
        ) {
          pending.push(state.right);
        } else if (
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(state.operatorToken.kind)
        ) {
          pending.push(state.left, state.right);
        } else {
          unknown = true;
        }
        continue;
      }
      if (
        ts.isPropertyAccessExpression(state) ||
        ts.isElementAccessExpression(state)
      ) {
        transitions.push({
          property: assignedPropertyName(state),
          target: state.expression,
        });
        continue;
      }
      if (ts.isIdentifier(state)) {
        const binding = resolveBinding(state, state.text);
        if (binding) pending.push(binding);
        else unknown = true;
        continue;
      }
      if (ts.isCallExpression(state)) {
        const implementations = callImplementations(state.expression);
        let emitted = false;
        for (const implementation of implementations) {
          for (const returned of returnsByFunction.get(implementation) ?? []) {
            pending.push(returned);
            emitted = true;
          }
          for (const index of ensureReturnedArgumentIndexes(implementation)) {
            const argument = argumentExpression(state.arguments[index]);
            if (!argument) continue;
            pending.push(argument);
            emitted = true;
          }
        }
        if (!emitted) unknown = true;
        continue;
      }
      if (ts.isNewExpression(state)) {
        unknown = true;
        continue;
      }
      if (
        !ts.isObjectLiteralExpression(state) &&
        !ts.isArrayLiteralExpression(state) &&
        !ts.isFunctionExpression(state) &&
        !ts.isArrowFunction(state) &&
        !ts.isClassExpression(state) &&
        !ts.isNumericLiteral(state) &&
        !ts.isStringLiteralLike(state) &&
        state.kind !== ts.SyntaxKind.TrueKeyword &&
        state.kind !== ts.SyntaxKind.FalseKeyword &&
        state.kind !== ts.SyntaxKind.NullKeyword
      ) {
        unknown = true;
      }
    }
    const result = { roots, transitions, unknown };
    if (!candidateAnalysisBudgetExceeded)
      candidateAliasClosureMemo.set(start, result);
    return result;
  };
  const candidateAliasScopeMemo = new WeakMap<
    ts.Expression,
    WeakMap<ts.Expression, CandidateAliasScope>
  >();
  const candidateOwnersMayAlias = (
    left: ts.Expression,
    right: ts.Expression,
  ): CandidateAliasScope => {
    const cached = candidateAliasScopeMemo.get(left)?.get(right);
    if (cached) return cached;
    const pending: Array<[ts.Expression, ts.Expression]> = [[left, right]];
    const visited = new Map<ts.Expression, Set<ts.Expression>>();
    let unknown = false;
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const pair = pending[cursor];
      if (!pair) continue;
      const [leftState, rightState] = pair;
      const rightStates = visited.get(leftState) ?? new Set<ts.Expression>();
      if (rightStates.has(rightState)) continue;
      rightStates.add(rightState);
      visited.set(leftState, rightStates);
      if (!spendCandidateAnalysisBudget()) {
        unknown = true;
        break;
      }
      const leftClosure = candidateAliasClosure(leftState);
      const rightClosure = candidateAliasClosure(rightState);
      if ([...leftClosure.roots].some((root) => rightClosure.roots.has(root))) {
        const result: CandidateAliasScope = "hit";
        const rightMemo = candidateAliasScopeMemo.get(left) ?? new WeakMap();
        rightMemo.set(right, result);
        candidateAliasScopeMemo.set(left, rightMemo);
        return result;
      }
      unknown ||= leftClosure.unknown || rightClosure.unknown;
      for (const leftTransition of leftClosure.transitions) {
        for (const rightTransition of rightClosure.transitions) {
          if (
            leftTransition.property === undefined ||
            rightTransition.property === undefined ||
            leftTransition.property === rightTransition.property
          ) {
            pending.push([leftTransition.target, rightTransition.target]);
          }
        }
      }
    }
    const result: CandidateAliasScope = unknown ? "unknown" : "miss";
    if (!candidateAnalysisBudgetExceeded) {
      const rightMemo = candidateAliasScopeMemo.get(left) ?? new WeakMap();
      rightMemo.set(right, result);
      candidateAliasScopeMemo.set(left, rightMemo);
    }
    return result;
  };
  const candidateTaintOwnersByProperty = new Map<string, Set<ts.Expression>>();
  const candidateWildcardTaintOwners = new Set<ts.Expression>();
  const unscopedCandidateProperties = new Set<string>();
  let hasUnscopedCandidateWildcard = false;
  const registerCandidateOwnerTaint = (
    owner: ts.Expression | undefined,
    property: string | undefined,
  ): boolean => {
    if (!owner) {
      if (property === undefined) {
        const changed = !hasUnscopedCandidateWildcard;
        hasUnscopedCandidateWildcard = true;
        return changed;
      }
      const previousSize = unscopedCandidateProperties.size;
      unscopedCandidateProperties.add(property);
      return unscopedCandidateProperties.size !== previousSize;
    }
    const closure = candidateAliasClosure(owner);
    if (candidateAnalysisBudgetExceeded) return false;
    if (closure.roots.size === 0 && closure.transitions.length === 0) {
      if (property === undefined) {
        const changed = !hasUnscopedCandidateWildcard;
        hasUnscopedCandidateWildcard = true;
        return changed;
      }
      const previousSize = unscopedCandidateProperties.size;
      unscopedCandidateProperties.add(property);
      return unscopedCandidateProperties.size !== previousSize;
    }
    const owners =
      property === undefined
        ? candidateWildcardTaintOwners
        : (candidateTaintOwnersByProperty.get(property) ??
          new Set<ts.Expression>());
    const previousSize = owners.size;
    owners.add(owner);
    if (property !== undefined)
      candidateTaintOwnersByProperty.set(property, owners);
    return owners.size !== previousSize;
  };
  type CandidateOwnerScope = "hit" | "miss" | "unknown";
  const candidateOwnerMayHaveProperty = (
    owner: ts.Expression,
    property: string,
  ): CandidateOwnerScope => {
    if (
      dynamicCandidateWildcard ||
      hasUnscopedCandidateWildcard ||
      unscopedCandidateProperties.has(property)
    ) {
      return "hit";
    }
    const candidates = [
      ...(candidateTaintOwnersByProperty.get(property) ?? []),
      ...candidateWildcardTaintOwners,
    ];
    if (candidates.length === 0) return "unknown";
    let unknown = false;
    for (const candidate of candidates) {
      const scope = candidateOwnersMayAlias(candidate, owner);
      if (scope === "hit") return "hit";
      unknown ||= scope === "unknown";
    }
    return unknown ? "unknown" : "miss";
  };
  const ensureDynamicExpressionWriteIndex = (): Map<
    string,
    IndexedDynamicExpressionWrite[]
  > => {
    if (dynamicExpressionWriteIndex) return dynamicExpressionWriteIndex;
    dynamicExpressionWriteIndex = new Map();
    for (const write of dynamicExpressionWrites) {
      const targetPaths = dynamicExpressionPaths(write.target);
      const entry = { write, targetPaths };
      for (const bucket of new Set(
        targetPaths.map(dynamicExpressionPathBucket),
      )) {
        const entries = dynamicExpressionWriteIndex.get(bucket) ?? [];
        entries.push(entry);
        dynamicExpressionWriteIndex.set(bucket, entries);
      }
    }
    return dynamicExpressionWriteIndex;
  };
  const expressionWriteSources = (
    expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ): ts.Expression[] => {
    const sources = new Set<ts.Expression>();
    const usePaths = dynamicExpressionPaths(expression);
    const index = ensureDynamicExpressionWriteIndex();
    const examinedWrites = new Set<(typeof dynamicExpressionWrites)[number]>();
    for (const usePath of usePaths) {
      for (const { write, targetPaths } of index.get(
        dynamicExpressionPathBucket(usePath),
      ) ?? []) {
        if (examinedWrites.has(write)) continue;
        examinedWrites.add(write);
        if (!targetPaths.some((target) => pathsOverlap(usePath, target)))
          continue;
        if (write.source) sources.add(write.source);
      }
    }
    return [...sources];
  };
  type ProjectedValueSources = {
    expressions: Set<ts.Expression>;
    functions: Set<ts.FunctionLikeDeclaration>;
    uncertain: boolean;
  };
  const projectedValueMemo = new WeakMap<
    ts.Expression,
    Map<string, ProjectedValueSources>
  >();
  const projectedValueSources = (
    owner: ts.Expression,
    property: string | undefined,
    chargeCandidateBudget = false,
  ): ProjectedValueSources => {
    const rootKey = JSON.stringify([property ?? null]);
    const cached = projectedValueMemo.get(owner)?.get(rootKey);
    if (cached) {
      return cached;
    }
    const expressions = new Set<ts.Expression>();
    const functions = new Set<ts.FunctionLikeDeclaration>();
    let uncertain = false;
    let candidateBudgetAborted = false;
    type ProjectionWork = {
      expression: ts.Expression;
      properties: Array<string | undefined>;
    };
    const pending: ProjectionWork[] = [];
    type ProjectionSummary = {
      properties: Array<string | undefined>;
      updates: number;
    };
    const visitedExpressions = new Map<
      ts.Expression,
      Map<number, ProjectionSummary>
    >();
    const visitedBindings = new Map<
      AliasBinding,
      Map<number, ProjectionSummary>
    >();
    const maxProjectionDepth = 64;
    const maxProjectionStates = 20_000;
    const updateProjectionSummary = <T>(
      visited: Map<T, Map<number, ProjectionSummary>>,
      value: T,
      properties: Array<string | undefined>,
    ): Array<string | undefined> | undefined => {
      const byLength =
        visited.get(value) ?? new Map<number, ProjectionSummary>();
      const existing = byLength.get(properties.length);
      if (!existing) {
        byLength.set(properties.length, { properties, updates: 0 });
        visited.set(value, byLength);
        return properties;
      }
      const merged = existing.properties.map((part, index) =>
        part === properties[index] ? part : undefined,
      );
      if (merged.every((part, index) => part === existing.properties[index])) {
        return undefined;
      }
      const updates = existing.updates + 1;
      const widened = updates >= 2 ? merged.map(() => undefined) : merged;
      byLength.set(properties.length, { properties: widened, updates });
      visited.set(value, byLength);
      return widened;
    };
    const enqueue = (
      expression: ts.Expression,
      properties: Array<string | undefined>,
    ): void => {
      const summarized = updateProjectionSummary(
        visitedExpressions,
        expression,
        properties,
      );
      if (!summarized) return;
      if (
        (chargeCandidateBudget && !spendCandidateAnalysisBudget()) ||
        summarized.length > maxProjectionDepth ||
        pending.length >= maxProjectionStates
      ) {
        candidateBudgetAborted ||=
          chargeCandidateBudget && candidateAnalysisBudgetExceeded;
        uncertain = true;
        return;
      }
      pending.push({ expression, properties: summarized });
    };
    enqueue(owner, [property]);

    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const current = pending[cursor];
      if (!current) continue;
      const { expression, properties } = current;
      if (properties.length === 0) {
        expressions.add(expression);
        continue;
      }
      const project = (source: ts.Expression): void => {
        enqueue(source, properties);
      };
      const emit = (
        source: ts.Expression,
        remaining: Array<string | undefined>,
      ): void => {
        if (remaining.length === 0) expressions.add(source);
        else enqueue(source, remaining);
      };

      if (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isNonNullExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isAwaitExpression(expression)
      ) {
        project(expression.expression);
        continue;
      }
      if (ts.isConditionalExpression(expression)) {
        project(expression.whenTrue);
        project(expression.whenFalse);
        continue;
      }
      if (ts.isBinaryExpression(expression)) {
        if (
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(expression.operatorToken.kind)
        ) {
          project(expression.left);
          project(expression.right);
        } else if (
          expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
          isValuePropagatingAssignment(expression.operatorToken.kind)
        ) {
          project(expression.right);
        }
        continue;
      }

      const [selectedProperty, ...remaining] = properties;
      if (ts.isObjectLiteralExpression(expression)) {
        for (const member of expression.properties) {
          if (ts.isSpreadAssignment(member)) {
            project(member.expression);
            continue;
          }
          const memberProperty = scopedPropertyName(member.name);
          if (
            selectedProperty !== undefined &&
            memberProperty !== selectedProperty
          )
            continue;
          if (ts.isPropertyAssignment(member))
            emit(member.initializer, remaining);
          else if (ts.isShorthandPropertyAssignment(member))
            emit(member.name, remaining);
          else if (ts.isMethodDeclaration(member) && remaining.length === 0)
            functions.add(member);
          else if (ts.isGetAccessorDeclaration(member)) {
            collectFunctionReturns(member);
            for (const returned of returnsByFunction.get(member) ?? []) {
              emit(returned, remaining);
            }
          }
        }
        continue;
      }
      if (ts.isArrayLiteralExpression(expression)) {
        const index =
          selectedProperty !== undefined &&
          /^(?:0|[1-9]\d*)$/.test(selectedProperty)
            ? Number(selectedProperty)
            : undefined;
        for (const [currentIndex, element] of expression.elements.entries()) {
          if (
            ts.isOmittedExpression(element) ||
            (index !== undefined && currentIndex !== index)
          ) {
            continue;
          }
          emit(
            ts.isSpreadElement(element) ? element.expression : element,
            remaining,
          );
        }
        continue;
      }
      if (
        ts.isPropertyAccessExpression(expression) ||
        ts.isElementAccessExpression(expression)
      ) {
        enqueue(expression.expression, [
          assignedPropertyName(expression),
          ...properties,
        ]);
        continue;
      }
      if (ts.isCallExpression(expression)) {
        if (
          (ts.isPropertyAccessExpression(expression.expression) ||
            ts.isElementAccessExpression(expression.expression)) &&
          isGlobalNamespaceAlias(expression.expression.expression, "Object")
        ) {
          const method = assignedPropertyName(expression.expression);
          const target = argumentExpression(expression.arguments[0]);
          if (
            method === "getOwnPropertyDescriptor" &&
            selectedProperty === "value" &&
            target
          ) {
            const descriptorProperty = argumentExpression(
              expression.arguments[1],
            );
            emit(
              ts.factory.createElementAccessExpression(
                target,
                descriptorProperty ?? unknownPropertyExpression(),
              ),
              remaining,
            );
          }
          if (
            method === "getOwnPropertyDescriptors" &&
            remaining[0] === "value" &&
            target
          ) {
            emit(
              ts.factory.createElementAccessExpression(
                target,
                selectedProperty === undefined
                  ? unknownPropertyExpression()
                  : ts.factory.createStringLiteral(selectedProperty),
              ),
              remaining.slice(1),
            );
          }
        }
        for (const implementation of callImplementations(
          expression.expression,
        )) {
          for (const returned of returnsByFunction.get(implementation) ?? [])
            project(returned);
          for (const index of ensureReturnedArgumentIndexes(implementation)) {
            const argument = argumentExpression(expression.arguments[index]);
            if (argument) project(argument);
          }
        }
        continue;
      }
      if (!ts.isIdentifier(expression)) continue;
      const binding = resolveBinding(expression, expression.text);
      if (!binding) {
        continue;
      }
      const bindingProperties = updateProjectionSummary(
        visitedBindings,
        binding,
        properties,
      );
      if (!bindingProperties) continue;
      const [bindingProperty, ...bindingRemaining] = bindingProperties;
      const writeSources = new Set([
        ...(dynamicPropertyWrites.get(
          dynamicPropertyKey(binding, bindingProperty),
        ) ?? []),
        ...(dynamicPropertyWrites.get(dynamicPropertyKey(binding, undefined)) ??
          []),
        ...(bindingProperty === undefined
          ? (dynamicPropertyWritesByBinding.get(binding) ?? [])
          : []),
      ]);
      for (const source of writeSources) {
        if (bindingRemaining.length === 0) expressions.add(source);
        else enqueue(source, bindingRemaining);
      }
      for (const relation of relationsByTarget.get(binding) ?? []) {
        enqueue(relation.source, bindingProperties);
      }
    }
    const result = { expressions, functions, uncertain };
    if (!candidateBudgetAborted) {
      const ownerMemo =
        projectedValueMemo.get(owner) ??
        new Map<string, ProjectedValueSources>();
      ownerMemo.set(rootKey, result);
      projectedValueMemo.set(owner, ownerMemo);
    }
    return result;
  };
  const projectionMethod = (
    projection: BindingProjection,
    resolving: ReadonlySet<AliasBinding>,
  ): "apply" | "construct" | "get" | undefined => {
    if (projection.properties.length === 0) {
      return reflectedMethod(projection.container, resolving);
    }
    const method = projection.properties[projection.properties.length - 1];
    if (
      !(["apply", "construct", "get"] as Array<string | undefined>).includes(
        method,
      )
    ) {
      return method === undefined ? "get" : undefined;
    }
    let candidates = new Set<ts.Expression>([projection.container]);
    for (const property of projection.properties.slice(0, -1)) {
      const next = new Set<ts.Expression>();
      for (const candidate of candidates) {
        const projected = projectedValueSources(candidate, property);
        if (projected.uncertain) return method as "apply" | "construct" | "get";
        for (const source of projected.expressions) {
          next.add(source);
        }
      }
      candidates = next;
    }
    return [...candidates].some((candidate) =>
      isGlobalNamespaceAlias(candidate, "Reflect", resolving),
    )
      ? (method as "apply" | "construct" | "get")
      : undefined;
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
        [
          ...(relationsByTarget.get(binding) ?? []).map((relation) =>
            reflectedMethod(relation.source, next),
          ),
          ...(bindingProjectionsByBinding.get(binding) ?? []).map(
            (projection) => projectionMethod(projection, next),
          ),
        ].filter(
          (method): method is "apply" | "construct" | "get" =>
            method !== undefined,
        ),
      );
      return methods.size === 1 ? [...methods][0] : undefined;
    }
    if (ts.isCallExpression(expression)) {
      const callee = expression.expression;
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        assignedPropertyName(callee) === "bind"
      ) {
        return reflectedMethod(callee.expression, resolving);
      }
      return undefined;
    }
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
      return undefined;
    }
    const method = assignedPropertyName(expression);
    return ["apply", "construct", "get"].includes(method ?? "") &&
      isGlobalNamespaceAlias(expression.expression, "Reflect")
      ? (method as "apply" | "construct" | "get")
      : undefined;
  };
  const reflectedApplyArgumentLists = (
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): ts.Expression[][] => {
    if (resolvingNodes.has(expression)) return [];
    const nextNodes = new Set(resolvingNodes).add(expression);
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return reflectedApplyArgumentLists(
        expression.expression,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return [
        ...reflectedApplyArgumentLists(
          expression.whenTrue,
          resolvingBindings,
          nextNodes,
        ),
        ...reflectedApplyArgumentLists(
          expression.whenFalse,
          resolvingBindings,
          nextNodes,
        ),
      ];
    }
    if (ts.isArrayLiteralExpression(expression)) {
      let lists: ts.Expression[][] = [[]];
      for (const element of expression.elements) {
        if (ts.isOmittedExpression(element)) continue;
        if (!ts.isSpreadElement(element)) {
          lists = lists.map((list) => [...list, element]);
          continue;
        }
        const spreads = reflectedApplyArgumentLists(
          element.expression,
          resolvingBindings,
          nextNodes,
        );
        if (spreads.length === 0) return [];
        lists = lists
          .flatMap((list) =>
            spreads.slice(0, 32).map((spread) => [...list, ...spread]),
          )
          .slice(0, 32);
      }
      return lists;
    }
    if (!ts.isIdentifier(expression)) return [];
    const binding = resolveBinding(expression, expression.text);
    if (!binding || resolvingBindings.has(binding)) return [];
    const nextBindings = new Set(resolvingBindings).add(binding);
    return (relationsByTarget.get(binding) ?? [])
      .flatMap((relation) =>
        reflectedApplyArgumentLists(relation.source, nextBindings, nextNodes),
      )
      .slice(0, 32);
  };
  const reflectInvocation = (
    expression: ts.CallExpression,
  ):
    | {
        method: "apply" | "construct" | "get";
        arguments: ts.Expression[] | undefined;
      }
    | undefined => {
    const direct = reflectedMethod(expression.expression);
    if (direct) {
      let prefix: ts.Expression[] = [];
      if (
        ts.isCallExpression(expression.expression) &&
        (ts.isPropertyAccessExpression(expression.expression.expression) ||
          ts.isElementAccessExpression(expression.expression.expression)) &&
        assignedPropertyName(expression.expression.expression) === "bind"
      ) {
        const bound = [...expression.expression.arguments].slice(1);
        if (bound.some(ts.isSpreadElement)) {
          return { method: direct, arguments: undefined };
        }
        prefix = bound as ts.Expression[];
      }
      const callArguments = [...expression.arguments];
      if (callArguments.some(ts.isSpreadElement)) {
        return { method: direct, arguments: undefined };
      }
      return {
        method: direct,
        arguments: [...prefix, ...(callArguments as ts.Expression[])],
      };
    }
    if (
      ts.isPropertyAccessExpression(expression.expression) ||
      ts.isElementAccessExpression(expression.expression)
    ) {
      const forwarding = assignedPropertyName(expression.expression);
      const forwarded = reflectedMethod(expression.expression.expression);
      if (forwarded && forwarding === "call") {
        const forwardedArguments = [...expression.arguments].slice(1);
        return {
          method: forwarded,
          arguments: forwardedArguments.some(ts.isSpreadElement)
            ? undefined
            : (forwardedArguments as ts.Expression[]),
        };
      }
      if (forwarded && forwarding === "apply") {
        const list = argumentExpression(expression.arguments[1]);
        const alternatives = list ? reflectedApplyArgumentLists(list) : [];
        return {
          method: forwarded,
          arguments: alternatives.length === 1 ? alternatives[0] : undefined,
        };
      }
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
      return (
        isKnownCallableValue(expression.whenTrue, resolving) ||
        isKnownCallableValue(expression.whenFalse, resolving)
      );
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding) return expression.text === "Function";
      if (resolving.has(binding)) return false;
      if (localFunctions.has(binding) || localClassBindings.has(binding))
        return true;
      const next = new Set(resolving).add(binding);
      return (relationsByTarget.get(binding) ?? []).some((relation) =>
        isKnownCallableValue(relation.source, next),
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
        return (
          argument !== undefined && isKnownCallableValue(argument, resolving)
        );
      }
    }
    return false;
  };
  const isDefinitelyNonExecutableConstructorOwner = (
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
      return isDefinitelyNonExecutableConstructorOwner(
        expression.expression,
        resolving,
      );
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
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding || resolving.has(binding)) return false;
      const sources = relationsByTarget.get(binding) ?? [];
      const next = new Set(resolving).add(binding);
      return (
        sources.length > 0 &&
        sources.every(({ source }) =>
          isDefinitelyNonExecutableConstructorOwner(source, next),
        )
      );
    }
    return (
      (ts.isPropertyAccessExpression(expression) ||
        ts.isElementAccessExpression(expression)) &&
      isGlobalNamespaceAlias(expression.expression, "Object") === false &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Math" &&
      resolveBinding(expression.expression, "Math") === undefined
    );
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
      const indexedWrites =
        index.get(dynamicExpressionPathBucket(usePath)) ?? [];
      for (const { write, targetPaths } of indexedWrites) {
        if (examinedWrites.has(write)) continue;
        examinedWrites.add(write);
        if (!targetPaths.some((target) => pathsOverlap(usePath, target)))
          continue;
        if (write.direct) return true;
        if (
          write.source &&
          isDynamicFunctionConstructor(
            write.source,
            resolvingBindings,
            resolvingNodes,
          )
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
  type DynamicQueryState = { cycleVersion: number };
  let activeDynamicQuery: DynamicQueryState | undefined;
  const dynamicExpressionTrue = new Set<ts.Expression>();
  let dynamicExpressionFalse = new WeakSet<ts.Expression>();
  const dynamicExpressionInProgress = new Set<ts.Expression>();
  const dynamicBindingTrue = new Set<AliasBinding>();
  let dynamicBindingFalse = new Set<AliasBinding>();
  const dynamicBindingInProgress = new Set<AliasBinding>();
  const dynamicPropertyTrue = new WeakMap<ts.Expression, Set<string>>();
  let dynamicPropertyFalse = new WeakMap<ts.Expression, Set<string>>();
  const dynamicPropertyInProgress = new WeakMap<ts.Expression, Set<string>>();
  const dynamicBindingPropertyTrue = new Map<AliasBinding, Set<string>>();
  let dynamicBindingPropertyFalse = new Map<AliasBinding, Set<string>>();
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
      memoSetHas(dynamicPropertyFalse, owner, key) ||
      bindingMemoSetHas(dynamicBindingPropertyFalse, ownerBinding, key)
    ) {
      return false;
    }
    const ownsQuery = activeDynamicQuery === undefined;
    const query = activeDynamicQuery ?? { cycleVersion: 0 };
    activeDynamicQuery = query;
    if (
      resolvingNodes.has(owner) ||
      (ownerBinding !== undefined && resolvingBindings.has(ownerBinding)) ||
      memoSetHas(dynamicPropertyInProgress, owner, key) ||
      bindingMemoSetHas(dynamicBindingPropertyInProgress, ownerBinding, key)
    ) {
      query.cycleVersion += 1;
      if (ownsQuery) activeDynamicQuery = undefined;
      return false;
    }
    memoSetAdd(dynamicPropertyInProgress, owner, key);
    bindingMemoSetAdd(dynamicBindingPropertyInProgress, ownerBinding, key);
    const cycleVersion = query.cycleVersion;
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
      } else if (query.cycleVersion === cycleVersion) {
        memoSetAdd(dynamicPropertyFalse, owner, key);
        bindingMemoSetAdd(dynamicBindingPropertyFalse, ownerBinding, key);
      }
      return result;
    } finally {
      memoSetDelete(dynamicPropertyInProgress, owner, key);
      bindingMemoSetDelete(dynamicBindingPropertyInProgress, ownerBinding, key);
      if (ownsQuery) activeDynamicQuery = undefined;
    }
  }
  function computeDynamicConstructorProperty(
    owner: ts.Expression,
    property: string | undefined,
    resolvingBindings: ReadonlySet<AliasBinding>,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean {
    const nextNodes = new Set(resolvingNodes).add(owner);
    let nestedPropertyDepth = 0;
    let propertyRoot = owner;
    while (
      ts.isPropertyAccessExpression(propertyRoot) ||
      ts.isElementAccessExpression(propertyRoot)
    ) {
      nestedPropertyDepth += 1;
      propertyRoot = propertyRoot.expression;
    }
    if (nestedPropertyDepth >= 64) return true;
    if (candidateOwnerHasWildcard(owner)) return true;
    if (property === undefined && isKnownCallableValue(owner)) return true;
    if (
      property === "constructor" &&
      !isDefinitelyNonExecutableConstructorOwner(owner)
    ) {
      return true;
    }
    if (
      !candidateAnalysisBudgetExceeded &&
      property === undefined &&
      candidateContainerHasDynamicProperty(owner)
    )
      return true;
    if (property !== undefined && property !== "value") {
      if (
        !candidateAnalysisBudgetExceeded &&
        candidateOwnerHasProperty(owner, property)
      ) {
        return true;
      }
      if (
        !dynamicCandidateWildcard &&
        (candidateAnalysisBudgetExceeded || !candidateOwnerHasWildcard(owner))
      )
        return false;
    }
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
      return (
        isDynamicConstructorProperty(
          owner.whenTrue,
          property,
          resolvingBindings,
          nextNodes,
        ) ||
        isDynamicConstructorProperty(
          owner.whenFalse,
          property,
          resolvingBindings,
          nextNodes,
        )
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
      const index =
        property !== undefined && /^(?:0|[1-9]\d*)$/.test(property)
          ? Number(property)
          : undefined;
      return owner.elements.some((element, currentIndex) => {
        if (
          ts.isOmittedExpression(element) ||
          (index !== undefined && currentIndex !== index)
        ) {
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
      if (
        (ts.isPropertyAccessExpression(owner.expression) ||
          ts.isElementAccessExpression(owner.expression)) &&
        ["getOwnPropertyDescriptor", "getOwnPropertyDescriptors"].includes(
          assignedPropertyName(owner.expression) ?? "",
        ) &&
        isGlobalNamespaceAlias(owner.expression.expression, "Object")
      ) {
        const projected = projectedValueSources(owner, property);
        if (projected.uncertain) return true;
        for (const source of projected.expressions) {
          if (
            isDynamicFunctionConstructor(source, resolvingBindings, nextNodes)
          ) {
            return true;
          }
        }
      }
      for (const implementation of callImplementations(owner.expression)) {
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          if (
            isDynamicConstructorProperty(
              returned,
              property,
              resolvingBindings,
              nextNodes,
            )
          ) {
            return true;
          }
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(owner.arguments[index]);
          if (
            argument &&
            isDynamicConstructorProperty(
              argument,
              property,
              resolvingBindings,
              nextNodes,
            )
          ) {
            return true;
          }
        }
      }
      return false;
    }
    if (!ts.isIdentifier(owner)) {
      if (
        !ts.isPropertyAccessExpression(owner) &&
        !ts.isElementAccessExpression(owner)
      ) {
        return false;
      }
      const projected = projectedValueSources(owner, property);
      if (projected.uncertain) return true;
      for (const source of projected.expressions) {
        if (
          isDynamicFunctionConstructor(source, resolvingBindings, nextNodes)
        ) {
          return true;
        }
      }
      return false;
    }
    const binding = resolveBinding(owner, owner.text);
    if (!binding || resolvingBindings.has(binding)) return false;
    const nextBindings = new Set(resolvingBindings).add(binding);
    const writeSources = [
      ...(dynamicPropertyWrites.get(dynamicPropertyKey(binding, property)) ??
        []),
      ...(dynamicPropertyWrites.get(dynamicPropertyKey(binding, undefined)) ??
        []),
      ...(property === undefined
        ? (dynamicPropertyWritesByBinding.get(binding) ?? [])
        : []),
    ];
    if (
      writeSources.some((source) =>
        isDynamicFunctionConstructor(source, nextBindings, nextNodes),
      )
    ) {
      return true;
    }
    return (relationsByTarget.get(binding) ?? []).some((relation) =>
      isDynamicConstructorProperty(
        relation.source,
        property,
        nextBindings,
        nextNodes,
      ),
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
      (expressionBinding !== undefined &&
        dynamicBindingTrue.has(expressionBinding))
    ) {
      return true;
    }
    if (
      dynamicExpressionFalse.has(expression) ||
      (expressionBinding !== undefined &&
        dynamicBindingFalse.has(expressionBinding))
    ) {
      return false;
    }
    const ownsQuery = activeDynamicQuery === undefined;
    const query = activeDynamicQuery ?? { cycleVersion: 0 };
    activeDynamicQuery = query;
    if (
      resolvingNodes.has(expression) ||
      (expressionBinding !== undefined &&
        resolvingBindings.has(expressionBinding)) ||
      dynamicExpressionInProgress.has(expression) ||
      (expressionBinding !== undefined &&
        dynamicBindingInProgress.has(expressionBinding))
    ) {
      query.cycleVersion += 1;
      if (ownsQuery) activeDynamicQuery = undefined;
      return false;
    }
    dynamicExpressionInProgress.add(expression);
    if (expressionBinding) dynamicBindingInProgress.add(expressionBinding);
    const cycleVersion = query.cycleVersion;
    try {
      const result = computeDynamicFunctionConstructor(
        expression,
        resolvingBindings,
        resolvingNodes,
      );
      if (result) {
        dynamicExpressionTrue.add(expression);
        if (expressionBinding) dynamicBindingTrue.add(expressionBinding);
      } else if (query.cycleVersion === cycleVersion) {
        dynamicExpressionFalse.add(expression);
        if (expressionBinding) dynamicBindingFalse.add(expressionBinding);
      }
      return result;
    } finally {
      dynamicExpressionInProgress.delete(expression);
      if (expressionBinding) dynamicBindingInProgress.delete(expressionBinding);
      if (ownsQuery) activeDynamicQuery = undefined;
    }
  }
  const implementationDynamicReturnTrue =
    new WeakSet<ts.FunctionLikeDeclaration>();
  const implementationDynamicReturnFalse =
    new WeakSet<ts.FunctionLikeDeclaration>();
  const implementationDynamicReturnInProgress =
    new WeakSet<ts.FunctionLikeDeclaration>();
  const bindingDeclaredInImplementation = (
    binding: AliasBinding,
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    let current: ts.Node | undefined = binding.scope;
    while (current) {
      if (ts.isFunctionLike(current)) return current === implementation;
      if (ts.isSourceFile(current)) return false;
      current = current.parent;
    }
    return false;
  };
  const implementationReturnValueIsDynamic = (
    implementation: ts.FunctionLikeDeclaration,
    expression: ts.Expression,
    parameterBindings: ReadonlySet<AliasBinding>,
  ): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return implementationReturnValueIsDynamic(
        implementation,
        expression.expression,
        parameterBindings,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        implementationReturnValueIsDynamic(
          implementation,
          expression.whenTrue,
          parameterBindings,
        ) ||
        implementationReturnValueIsDynamic(
          implementation,
          expression.whenFalse,
          parameterBindings,
        )
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return implementationReturnValueIsDynamic(
          implementation,
          sequentialValueExpression(expression),
          parameterBindings,
        );
      }
      if (isValuePropagatingAssignment(expression.operatorToken.kind)) {
        return implementationReturnValueIsDynamic(
          implementation,
          expression.right,
          parameterBindings,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          implementationReturnValueIsDynamic(
            implementation,
            expression.left,
            parameterBindings,
          ) ||
          implementationReturnValueIsDynamic(
            implementation,
            expression.right,
            parameterBindings,
          )
        );
      }
    }
    if (!ts.isIdentifier(expression)) {
      return isDynamicFunctionConstructor(expression, parameterBindings);
    }
    const binding = resolveBinding(expression, expression.text);
    if (!binding) return expression.text === "Function";
    if (!bindingDeclaredInImplementation(binding, implementation)) {
      return isDynamicFunctionConstructor(expression, parameterBindings);
    }
    const resolving = new Set(parameterBindings).add(binding);
    return (relationsByTarget.get(binding) ?? []).some(
      ({ source }) =>
        nearestFunctionScope(source) === implementation &&
        isDynamicFunctionConstructor(source, resolving),
    );
  };
  function implementationReturnsDynamicConstructor(
    implementation: ts.FunctionLikeDeclaration,
  ): boolean {
    if (implementationDynamicReturnTrue.has(implementation)) return true;
    if (implementationDynamicReturnFalse.has(implementation)) return false;
    if (implementationDynamicReturnInProgress.has(implementation)) return false;
    implementationDynamicReturnInProgress.add(implementation);
    try {
      const parameterBindings = new Set<AliasBinding>();
      for (const parameter of implementation.parameters) {
        if (!ts.isIdentifier(parameter.name)) continue;
        const binding = resolveBinding(parameter.name, parameter.name.text);
        if (binding) parameterBindings.add(binding);
      }
      const result = (returnsByFunction.get(implementation) ?? []).some(
        (returned) =>
          implementationReturnValueIsDynamic(
            implementation,
            returned,
            parameterBindings,
          ),
      );
      if (result) implementationDynamicReturnTrue.add(implementation);
      else implementationDynamicReturnFalse.add(implementation);
      return result;
    } finally {
      implementationDynamicReturnInProgress.delete(implementation);
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
      return isDynamicFunctionConstructor(
        expression.expression,
        resolvingBindings,
        nextNodes,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        isDynamicFunctionConstructor(
          expression.whenTrue,
          resolvingBindings,
          nextNodes,
        ) ||
        isDynamicFunctionConstructor(
          expression.whenFalse,
          resolvingBindings,
          nextNodes,
        )
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return isDynamicFunctionConstructor(
          sequentialValueExpression(expression),
          resolvingBindings,
          nextNodes,
        );
      }
      if (isValuePropagatingAssignment(expression.operatorToken.kind)) {
        return isDynamicFunctionConstructor(
          expression.right,
          resolvingBindings,
          nextNodes,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          isDynamicFunctionConstructor(
            expression.left,
            resolvingBindings,
            nextNodes,
          ) ||
          isDynamicFunctionConstructor(
            expression.right,
            resolvingBindings,
            nextNodes,
          )
        );
      }
      return false;
    }
    if (ts.isCallExpression(expression)) {
      const memberCallee =
        ts.isPropertyAccessExpression(expression.expression) ||
        ts.isElementAccessExpression(expression.expression)
          ? expression.expression
          : undefined;
      const property = memberCallee
        ? assignedPropertyName(memberCallee)
        : undefined;
      const reflection = reflectInvocation(expression);
      if (reflection && reflection.arguments === undefined) return true;
      const reflectionArguments = reflection?.arguments;
      if (reflection?.method === "get") {
        const target = reflectionArguments?.[0];
        const key = reflectionArguments?.[1];
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
        const target = reflectionArguments?.[0];
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
        if (implementationReturnsDynamicConstructor(implementation)) {
          return true;
        }
        if (
          [...ensureReturnedArgumentIndexes(implementation)].some((index) => {
            const argument = argumentExpression(expression.arguments[index]);
            return (
              argument !== undefined &&
              isDynamicFunctionConstructor(
                argument,
                resolvingBindings,
                nextNodes,
              )
            );
          })
        ) {
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
      return (
        (relationsByTarget.get(binding) ?? []).some((relation) =>
          isDynamicFunctionConstructor(
            relation.source,
            nextBindings,
            nextNodes,
          ),
        ) ||
        (dynamicSelectionsByBinding.get(binding) ?? []).some((selection) =>
          isDynamicConstructorProperty(
            selection.container,
            selection.property,
            nextBindings,
            nextNodes,
          ),
        )
      );
    }
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
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
      assignedPropertyName(expression.expression.expression) ===
        "getOwnPropertyDescriptor" &&
      isGlobalNamespaceAlias(
        expression.expression.expression.expression,
        "Object",
      )
    ) {
      const descriptorTarget = argumentExpression(
        expression.expression.arguments[0],
      );
      const descriptorKey = argumentExpression(
        expression.expression.arguments[1],
      );
      const descriptorProperty = descriptorKey
        ? scopedStaticString(descriptorKey)
        : undefined;
      if (
        descriptorTarget &&
        (descriptorProperty === "constructor" ||
          descriptorProperty === undefined) &&
        (isKnownCallableValue(descriptorTarget) ||
          (ts.isCallExpression(descriptorTarget) &&
            (ts.isPropertyAccessExpression(descriptorTarget.expression) ||
              ts.isElementAccessExpression(descriptorTarget.expression)) &&
            assignedPropertyName(descriptorTarget.expression) ===
              "getPrototypeOf" &&
            isGlobalNamespaceAlias(
              descriptorTarget.expression.expression,
              "Object",
            ) &&
            argumentExpression(descriptorTarget.arguments[0]) !== undefined &&
            isKnownCallableValue(
              argumentExpression(descriptorTarget.arguments[0])!,
            )))
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
    if (property === undefined && isKnownCallableValue(expression.expression))
      return true;
    if (
      ["apply", "bind", "call"].includes(property ?? "") &&
      isDynamicFunctionConstructor(
        expression.expression,
        resolvingBindings,
        nextNodes,
      )
    ) {
      return true;
    }
    if (isDynamicExpressionWrite(expression, resolvingBindings, nextNodes))
      return true;
    if (!needsDynamicConstructorFlowAnalysis) return false;
    return isDynamicConstructorProperty(
      expression.expression,
      property,
      resolvingBindings,
      nextNodes,
    );
  }
  const candidateDynamicBindings = new Set(directDynamicConstructorBindings);
  function candidateOwnerHasWildcard(
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): boolean {
    if (candidateAnalysisBudgetExceeded) return false;
    if (dynamicCandidateWildcardExpressions.has(expression)) return true;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return candidateOwnerHasWildcard(expression.expression, resolving);
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        candidateOwnerHasWildcard(expression.whenTrue, resolving) ||
        candidateOwnerHasWildcard(expression.whenFalse, resolving)
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind)
      ) {
        return candidateOwnerHasWildcard(expression.right, resolving);
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          candidateOwnerHasWildcard(expression.left, resolving) ||
          candidateOwnerHasWildcard(expression.right, resolving)
        );
      }
      return false;
    }
    if (!ts.isIdentifier(expression)) return false;
    const binding = resolveBinding(expression, expression.text);
    return (
      binding !== undefined &&
      !resolving.has(binding) &&
      dynamicCandidateWildcardBindings.has(binding)
    );
  }
  const invalidateDynamicCandidateNegativeMemos = (): void => {
    dynamicExpressionFalse = new WeakSet<ts.Expression>();
    dynamicBindingFalse = new Set<AliasBinding>();
    dynamicPropertyFalse = new WeakMap<ts.Expression, Set<string>>();
    dynamicBindingPropertyFalse = new Map<AliasBinding, Set<string>>();
  };
  let candidateContainerExpressionMemo = new WeakMap<ts.Expression, boolean>();
  let candidateContainerBindingMemo = new Map<AliasBinding, boolean>();
  let candidateOwnerPropertyExpressionMemo = new WeakMap<
    ts.Expression,
    Map<string, boolean>
  >();
  let candidateOwnerPropertyBindingMemo = new Map<
    AliasBinding,
    Map<string, boolean>
  >();
  function candidateContainerHasDynamicProperty(
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean {
    if (candidateAnalysisBudgetExceeded) return false;
    if (
      dynamicCandidateWildcard ||
      hasUnscopedCandidateWildcard ||
      unscopedCandidateProperties.size > 0 ||
      dynamicCandidateProperties.size > 0
    ) {
      return true;
    }
    if (
      dynamicCandidateWildcardExpressions.has(expression) ||
      (dynamicCandidatePropertiesByExpression.get(expression)?.size ?? 0) > 0
    ) {
      return true;
    }
    if (!dynamicCandidateWildcard && !hasScopedDynamicCandidateProperty) {
      if (!ts.isIdentifier(expression)) return false;
      const binding = resolveBinding(expression, expression.text);
      return binding !== undefined && candidateDynamicBindings.has(binding);
    }
    const expressionMemo = candidateContainerExpressionMemo.get(expression);
    if (expressionMemo !== undefined) return expressionMemo;
    if (resolvingNodes.has(expression)) return false;
    const nextNodes = new Set(resolvingNodes).add(expression);
    let result = false;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      result = candidateContainerHasDynamicProperty(
        expression.expression,
        resolvingBindings,
        nextNodes,
      );
    } else if (ts.isConditionalExpression(expression)) {
      result =
        candidateContainerHasDynamicProperty(
          expression.whenTrue,
          resolvingBindings,
          nextNodes,
        ) ||
        candidateContainerHasDynamicProperty(
          expression.whenFalse,
          resolvingBindings,
          nextNodes,
        );
    } else if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind)
      ) {
        result = candidateContainerHasDynamicProperty(
          expression.right,
          resolvingBindings,
          nextNodes,
        );
      } else if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        result =
          candidateContainerHasDynamicProperty(
            expression.left,
            resolvingBindings,
            nextNodes,
          ) ||
          candidateContainerHasDynamicProperty(
            expression.right,
            resolvingBindings,
            nextNodes,
          );
      }
    } else if (ts.isObjectLiteralExpression(expression)) {
      result = expression.properties.some((member) => {
        if (ts.isSpreadAssignment(member)) {
          return candidateContainerHasDynamicProperty(
            member.expression,
            resolvingBindings,
            nextNodes,
          );
        }
        const value = ts.isPropertyAssignment(member)
          ? member.initializer
          : ts.isShorthandPropertyAssignment(member)
            ? member.name
            : member;
        return candidateExpressionIsDynamic(value, nextNodes);
      });
    } else if (ts.isArrayLiteralExpression(expression)) {
      result = expression.elements.some(
        (element) =>
          !ts.isOmittedExpression(element) &&
          candidateExpressionIsDynamic(
            ts.isSpreadElement(element) ? element.expression : element,
            nextNodes,
          ),
      );
    } else if (
      ts.isCallExpression(expression) ||
      ts.isNewExpression(expression)
    ) {
      result = [...callImplementations(expression.expression)].some(
        (implementation) =>
          (returnsByFunction.get(implementation) ?? []).some((returned) =>
            candidateContainerHasDynamicProperty(
              returned,
              resolvingBindings,
              nextNodes,
            ),
          ) ||
          [...ensureReturnedArgumentIndexes(implementation)].some((index) => {
            const argument = argumentExpression(expression.arguments?.[index]);
            return (
              argument !== undefined &&
              candidateContainerHasDynamicProperty(
                argument,
                resolvingBindings,
                nextNodes,
              )
            );
          }),
      );
    } else if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const projected = projectedValueSources(expression, undefined, true);
      result =
        projected.uncertain ||
        [...projected.expressions].some((source) =>
          candidateExpressionIsDynamic(source, nextNodes),
        );
    } else if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (binding) {
        const bindingMemo = candidateContainerBindingMemo.get(binding);
        if (bindingMemo !== undefined) {
          result = bindingMemo;
        } else if (!resolvingBindings.has(binding)) {
          const nextBindings = new Set(resolvingBindings).add(binding);
          result =
            candidateDynamicBindings.has(binding) ||
            dynamicCandidateWildcardBindings.has(binding) ||
            (dynamicCandidatePropertiesByBinding.get(binding)?.size ?? 0) > 0 ||
            (dynamicPropertyWritesByBinding.get(binding) ?? []).some((source) =>
              candidateExpressionIsDynamic(source, nextNodes),
            ) ||
            (relationsByTarget.get(binding) ?? []).some(({ source }) =>
              candidateContainerHasDynamicProperty(
                source,
                nextBindings,
                nextNodes,
              ),
            );
          candidateContainerBindingMemo.set(binding, result);
        }
      }
    }
    candidateContainerExpressionMemo.set(expression, result);
    return result;
  }
  function candidateOwnerHasProperty(
    expression: ts.Expression,
    property: string,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean {
    if (candidateAnalysisBudgetExceeded) return false;
    if (
      dynamicCandidateWildcard ||
      hasUnscopedCandidateWildcard ||
      unscopedCandidateProperties.has(property) ||
      dynamicCandidateProperties.has(property) ||
      candidateOwnerHasWildcard(expression) ||
      dynamicCandidatePropertiesByExpression.get(expression)?.has(property)
    ) {
      return true;
    }
    if (!dynamicCandidatePropertyNames.has(property)) return false;
    const candidateScope = candidateOwnerMayHaveProperty(expression, property);
    if (candidateScope === "hit") return true;
    if (candidateScope === "miss") return false;
    const expressionMemo = candidateOwnerPropertyExpressionMemo
      .get(expression)
      ?.get(property);
    if (expressionMemo !== undefined) return expressionMemo;
    if (resolvingNodes.has(expression)) return false;
    const nextNodes = new Set(resolvingNodes).add(expression);
    let result = false;
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      result = candidateOwnerHasProperty(
        expression.expression,
        property,
        resolvingBindings,
        nextNodes,
      );
    } else if (ts.isConditionalExpression(expression)) {
      result =
        candidateOwnerHasProperty(
          expression.whenTrue,
          property,
          resolvingBindings,
          nextNodes,
        ) ||
        candidateOwnerHasProperty(
          expression.whenFalse,
          property,
          resolvingBindings,
          nextNodes,
        );
    } else if (ts.isBinaryExpression(expression)) {
      if (
        expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(expression.operatorToken.kind)
      ) {
        result = candidateOwnerHasProperty(
          expression.right,
          property,
          resolvingBindings,
          nextNodes,
        );
      } else if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        result =
          candidateOwnerHasProperty(
            expression.left,
            property,
            resolvingBindings,
            nextNodes,
          ) ||
          candidateOwnerHasProperty(
            expression.right,
            property,
            resolvingBindings,
            nextNodes,
          );
      }
    } else if (ts.isObjectLiteralExpression(expression)) {
      result = expression.properties.some((member) => {
        if (ts.isSpreadAssignment(member)) {
          return candidateOwnerHasProperty(
            member.expression,
            property,
            resolvingBindings,
            nextNodes,
          );
        }
        if (scopedPropertyName(member.name) !== property) return false;
        const value = ts.isPropertyAssignment(member)
          ? member.initializer
          : ts.isShorthandPropertyAssignment(member)
            ? member.name
            : member;
        return candidateExpressionIsDynamic(value, nextNodes);
      });
    } else if (ts.isArrayLiteralExpression(expression)) {
      const index = /^(?:0|[1-9]\d*)$/.test(property)
        ? Number(property)
        : undefined;
      result =
        index !== undefined &&
        index < expression.elements.length &&
        !ts.isOmittedExpression(expression.elements[index]!) &&
        candidateExpressionIsDynamic(
          ts.isSpreadElement(expression.elements[index]!)
            ? expression.elements[index]!.expression
            : (expression.elements[index]! as ts.Expression),
          nextNodes,
        );
    } else if (
      ts.isCallExpression(expression) ||
      ts.isNewExpression(expression)
    ) {
      result = [...callImplementations(expression.expression)].some(
        (implementation) =>
          (returnsByFunction.get(implementation) ?? []).some((returned) =>
            candidateOwnerHasProperty(
              returned,
              property,
              resolvingBindings,
              nextNodes,
            ),
          ) ||
          [...ensureReturnedArgumentIndexes(implementation)].some((index) => {
            const argument = argumentExpression(expression.arguments?.[index]);
            return (
              argument !== undefined &&
              candidateOwnerHasProperty(
                argument,
                property,
                resolvingBindings,
                nextNodes,
              )
            );
          }),
      );
    } else if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const projected = projectedValueSources(expression, property, true);
      result =
        projected.uncertain ||
        [...projected.expressions].some((source) =>
          candidateExpressionIsDynamic(source, nextNodes),
        );
    } else if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (binding) {
        const bindingMemo = candidateOwnerPropertyBindingMemo
          .get(binding)
          ?.get(property);
        if (bindingMemo !== undefined) {
          result = bindingMemo;
        } else if (!resolvingBindings.has(binding)) {
          const nextBindings = new Set(resolvingBindings).add(binding);
          result =
            dynamicCandidatePropertiesByBinding.get(binding)?.has(property) ===
              true ||
            (relationsByTarget.get(binding) ?? []).some(({ source }) =>
              candidateOwnerHasProperty(
                source,
                property,
                nextBindings,
                nextNodes,
              ),
            );
          const values =
            candidateOwnerPropertyBindingMemo.get(binding) ?? new Map();
          values.set(property, result);
          candidateOwnerPropertyBindingMemo.set(binding, values);
        }
      }
    }
    const values =
      candidateOwnerPropertyExpressionMemo.get(expression) ?? new Map();
    values.set(property, result);
    candidateOwnerPropertyExpressionMemo.set(expression, values);
    return result;
  }
  const candidateSelectionIsDynamic = (
    selection: DynamicConstructorSelection,
  ): boolean =>
    selection.property === "constructor" ||
    (selection.property === undefined &&
      candidateContainerHasDynamicProperty(selection.container)) ||
    (selection.property !== undefined &&
      candidateOwnerHasProperty(selection.container, selection.property));
  type CandidateDynamicQuery = { cycleVersion: number };
  let activeCandidateDynamicQuery: CandidateDynamicQuery | undefined;
  const candidateExpressionTrue = new WeakSet<ts.Node>();
  let candidateExpressionFalse = new WeakSet<ts.Node>();
  const candidateExpressionInProgress = new WeakSet<ts.Node>();
  const computeCandidateExpressionIsDynamic = (
    node: ts.Expression | ts.FunctionLikeDeclaration,
    resolvingNodes: ReadonlySet<ts.Node>,
  ): boolean => {
    const nextNodes = new Set(resolvingNodes).add(node);
    if (ts.isFunctionLike(node)) return false;
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return candidateExpressionIsDynamic(node.expression, nextNodes);
    }
    if (ts.isConditionalExpression(node)) {
      return (
        candidateExpressionIsDynamic(node.whenTrue, nextNodes) ||
        candidateExpressionIsDynamic(node.whenFalse, nextNodes)
      );
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return candidateExpressionIsDynamic(
          sequentialValueExpression(node),
          nextNodes,
        );
      }
      if (isValuePropagatingAssignment(node.operatorToken.kind)) {
        return candidateExpressionIsDynamic(node.right, nextNodes);
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      ) {
        return (
          candidateExpressionIsDynamic(node.left, nextNodes) ||
          candidateExpressionIsDynamic(node.right, nextNodes)
        );
      }
      return false;
    }
    if (ts.isIdentifier(node)) {
      const binding = resolveBinding(node, node.text);
      return binding
        ? candidateDynamicBindings.has(binding)
        : node.text === "Function";
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (candidateExpressionIsDynamic(node.expression, nextNodes)) return true;
      if (ts.isCallExpression(node)) {
        const reflection = reflectInvocation(node);
        const reflectionArguments = reflection?.arguments;
        if (reflection?.method === "get") {
          const target = reflectionArguments?.[0];
          const key = reflectionArguments?.[1];
          if (
            target &&
            (key === undefined || scopedStaticString(key) === "constructor") &&
            isKnownCallableValue(target)
          ) {
            return true;
          }
        }
        if (
          reflection &&
          ["apply", "construct"].includes(reflection.method) &&
          reflectionArguments?.[0] &&
          candidateExpressionIsDynamic(reflectionArguments[0], nextNodes)
        ) {
          return true;
        }
      }
      for (const implementation of callImplementations(node.expression)) {
        if (candidateImplementationReturnsDynamic(implementation)) {
          return true;
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(node.arguments?.[index]);
          if (argument && candidateExpressionIsDynamic(argument, nextNodes))
            return true;
        }
      }
      return false;
    }
    if (
      !ts.isPropertyAccessExpression(node) &&
      !ts.isElementAccessExpression(node)
    ) {
      return false;
    }
    const property = assignedPropertyName(node);
    if (
      property === "value" &&
      ts.isCallExpression(node.expression) &&
      (ts.isPropertyAccessExpression(node.expression.expression) ||
        ts.isElementAccessExpression(node.expression.expression)) &&
      assignedPropertyName(node.expression.expression) ===
        "getOwnPropertyDescriptor" &&
      isGlobalNamespaceAlias(node.expression.expression.expression, "Object")
    ) {
      const descriptorTarget = argumentExpression(node.expression.arguments[0]);
      const descriptorKey = argumentExpression(node.expression.arguments[1]);
      const descriptorProperty = descriptorKey
        ? scopedStaticString(descriptorKey)
        : undefined;
      if (
        descriptorTarget &&
        (descriptorProperty === "constructor" ||
          descriptorProperty === undefined) &&
        (isKnownCallableValue(descriptorTarget) ||
          (ts.isCallExpression(descriptorTarget) &&
            (ts.isPropertyAccessExpression(descriptorTarget.expression) ||
              ts.isElementAccessExpression(descriptorTarget.expression)) &&
            assignedPropertyName(descriptorTarget.expression) ===
              "getPrototypeOf" &&
            isGlobalNamespaceAlias(
              descriptorTarget.expression.expression,
              "Object",
            ) &&
            argumentExpression(descriptorTarget.arguments[0]) !== undefined &&
            isKnownCallableValue(
              argumentExpression(descriptorTarget.arguments[0])!,
            )))
      ) {
        return true;
      }
    }
    if (
      property === "constructor" &&
      !isDefinitelyNonExecutableConstructorOwner(node.expression)
    ) {
      return true;
    }
    if (property === undefined && isKnownCallableValue(node.expression))
      return true;
    if (
      ["apply", "bind", "call"].includes(property ?? "") &&
      candidateExpressionIsDynamic(node.expression, nextNodes)
    ) {
      return true;
    }
    if (candidateOwnerHasWildcard(node.expression)) return true;
    if (property === undefined) {
      return candidateContainerHasDynamicProperty(
        node.expression,
        new Set(),
        nextNodes,
      );
    }
    return candidateOwnerHasProperty(
      node.expression,
      property,
      new Set(),
      nextNodes,
    );
  };
  const candidateExpressionIsDynamic = (
    node: ts.Expression | ts.FunctionLikeDeclaration,
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean => {
    if (candidateAnalysisBudgetExceeded) return false;
    if (candidateExpressionTrue.has(node)) {
      return true;
    }
    if (candidateExpressionFalse.has(node)) {
      return false;
    }
    const ownsQuery = activeCandidateDynamicQuery === undefined;
    const query = activeCandidateDynamicQuery ?? { cycleVersion: 0 };
    activeCandidateDynamicQuery = query;
    if (resolvingNodes.has(node) || candidateExpressionInProgress.has(node)) {
      query.cycleVersion += 1;
      if (ownsQuery) activeCandidateDynamicQuery = undefined;
      return false;
    }
    candidateExpressionInProgress.add(node);
    const cycleVersion = query.cycleVersion;
    try {
      const result = computeCandidateExpressionIsDynamic(node, resolvingNodes);
      if (candidateAnalysisBudgetExceeded) {
        return false;
      }
      if (result) {
        candidateExpressionTrue.add(node);
      } else if (query.cycleVersion === cycleVersion) {
        candidateExpressionFalse.add(node);
      }
      return result;
    } finally {
      candidateExpressionInProgress.delete(node);
      if (ownsQuery) activeCandidateDynamicQuery = undefined;
    }
  };
  type CandidateEnvironment = Map<AliasBinding, boolean>;
  const candidateImplementationTrue = new WeakSet<ts.FunctionLikeDeclaration>();
  let candidateImplementationFalse = new WeakSet<ts.FunctionLikeDeclaration>();
  const candidateImplementationInProgress =
    new WeakSet<ts.FunctionLikeDeclaration>();
  const cloneCandidateEnvironment = (
    environment: CandidateEnvironment,
  ): CandidateEnvironment => new Map(environment);
  const mergeCandidateEnvironments = (
    ...environments: CandidateEnvironment[]
  ): CandidateEnvironment => {
    const merged: CandidateEnvironment = new Map();
    for (const environment of environments) {
      for (const [binding, dynamic] of environment) {
        merged.set(binding, (merged.get(binding) ?? false) || dynamic);
      }
    }
    return merged;
  };
  const replaceCandidateEnvironment = (
    target: CandidateEnvironment,
    source: CandidateEnvironment,
  ): void => {
    target.clear();
    for (const [binding, dynamic] of source) target.set(binding, dynamic);
  };
  const candidateValueIsDynamic = (
    expression: ts.Expression,
    environment: CandidateEnvironment,
  ): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isAwaitExpression(expression)
    ) {
      return candidateValueIsDynamic(expression.expression, environment);
    }
    if (ts.isConditionalExpression(expression)) {
      candidateValueIsDynamic(expression.condition, environment);
      const whenTrueEnvironment = cloneCandidateEnvironment(environment);
      const whenFalseEnvironment = cloneCandidateEnvironment(environment);
      const whenTrue = candidateValueIsDynamic(
        expression.whenTrue,
        whenTrueEnvironment,
      );
      const whenFalse = candidateValueIsDynamic(
        expression.whenFalse,
        whenFalseEnvironment,
      );
      replaceCandidateEnvironment(
        environment,
        mergeCandidateEnvironments(whenTrueEnvironment, whenFalseEnvironment),
      );
      return whenTrue || whenFalse;
    }
    if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind;
      if (operator === ts.SyntaxKind.CommaToken) {
        candidateValueIsDynamic(expression.left, environment);
        return candidateValueIsDynamic(expression.right, environment);
      }
      if (operator === ts.SyntaxKind.EqualsToken) {
        const dynamic = candidateValueIsDynamic(expression.right, environment);
        if (ts.isIdentifier(expression.left)) {
          const binding = resolveBinding(expression.left, expression.left.text);
          if (binding) environment.set(binding, dynamic);
        }
        return dynamic;
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.BarBarEqualsToken,
          ts.SyntaxKind.QuestionQuestionEqualsToken,
        ].includes(operator)
      ) {
        const binding = ts.isIdentifier(expression.left)
          ? resolveBinding(expression.left, expression.left.text)
          : undefined;
        const previous = binding
          ? (environment.get(binding) ?? false)
          : candidateValueIsDynamic(expression.left, environment);
        const assignedEnvironment = cloneCandidateEnvironment(environment);
        const assigned = candidateValueIsDynamic(
          expression.right,
          assignedEnvironment,
        );
        replaceCandidateEnvironment(
          environment,
          mergeCandidateEnvironments(environment, assignedEnvironment),
        );
        const dynamic = previous || assigned;
        if (binding) environment.set(binding, dynamic);
        return dynamic;
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(operator)
      ) {
        const left = candidateValueIsDynamic(expression.left, environment);
        const rightEnvironment = cloneCandidateEnvironment(environment);
        const right = candidateValueIsDynamic(
          expression.right,
          rightEnvironment,
        );
        replaceCandidateEnvironment(
          environment,
          mergeCandidateEnvironments(environment, rightEnvironment),
        );
        return left || right;
      }
      candidateValueIsDynamic(expression.left, environment);
      candidateValueIsDynamic(expression.right, environment);
      return false;
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (binding && environment.has(binding))
        return environment.get(binding) ?? false;
      return candidateExpressionIsDynamic(expression);
    }
    if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
      if (candidateValueIsDynamic(expression.expression, environment))
        return true;
      const argumentValues = (expression.arguments ?? []).map((argument) =>
        candidateValueIsDynamic(
          ts.isSpreadElement(argument) ? argument.expression : argument,
          environment,
        ),
      );
      const implementations = callImplementations(expression.expression);
      if (
        implementations.size === 0 ||
        expression.arguments?.some(ts.isSpreadElement)
      ) {
        return argumentValues.some(Boolean);
      }
      return [...implementations].some(
        (implementation) =>
          candidateImplementationReturnsDynamic(implementation) ||
          [...ensureReturnedArgumentIndexes(implementation)].some(
            (index) => argumentValues[index] === true,
          ),
      );
    }
    if (
      ts.isObjectLiteralExpression(expression) ||
      ts.isArrayLiteralExpression(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isArrowFunction(expression) ||
      ts.isClassExpression(expression)
    ) {
      return false;
    }
    return candidateExpressionIsDynamic(expression);
  };
  const analyzeCandidateStatement = (
    statement: ts.Statement,
    environment: CandidateEnvironment,
    returned: { dynamic: boolean },
  ): CandidateEnvironment | undefined => {
    if (ts.isBlock(statement)) {
      let current: CandidateEnvironment | undefined = environment;
      for (const child of statement.statements) {
        if (!current) break;
        current = analyzeCandidateStatement(child, current, returned);
      }
      return current;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const dynamic = declaration.initializer
          ? candidateValueIsDynamic(declaration.initializer, environment)
          : false;
        if (!ts.isIdentifier(declaration.name)) continue;
        const binding = resolveBinding(declaration.name, declaration.name.text);
        if (binding) environment.set(binding, dynamic);
      }
      return environment;
    }
    if (ts.isExpressionStatement(statement)) {
      candidateValueIsDynamic(statement.expression, environment);
      return environment;
    }
    if (ts.isReturnStatement(statement)) {
      returned.dynamic ||=
        statement.expression !== undefined &&
        candidateValueIsDynamic(statement.expression, environment);
      return undefined;
    }
    if (ts.isThrowStatement(statement)) {
      candidateValueIsDynamic(statement.expression, environment);
      return undefined;
    }
    if (ts.isIfStatement(statement)) {
      candidateValueIsDynamic(statement.expression, environment);
      const whenTrue = analyzeCandidateStatement(
        statement.thenStatement,
        cloneCandidateEnvironment(environment),
        returned,
      );
      const whenFalse = statement.elseStatement
        ? analyzeCandidateStatement(
            statement.elseStatement,
            cloneCandidateEnvironment(environment),
            returned,
          )
        : cloneCandidateEnvironment(environment);
      if (!whenTrue) return whenFalse;
      if (!whenFalse) return whenTrue;
      return mergeCandidateEnvironments(whenTrue, whenFalse);
    }
    if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
      candidateValueIsDynamic(statement.expression, environment);
      const body = analyzeCandidateStatement(
        statement.statement,
        cloneCandidateEnvironment(environment),
        returned,
      );
      if (ts.isDoStatement(statement)) return body;
      return body
        ? mergeCandidateEnvironments(environment, body)
        : cloneCandidateEnvironment(environment);
    }
    if (ts.isForStatement(statement)) {
      if (
        statement.initializer &&
        !ts.isVariableDeclarationList(statement.initializer)
      ) {
        candidateValueIsDynamic(statement.initializer, environment);
      }
      if (statement.condition)
        candidateValueIsDynamic(statement.condition, environment);
      const body = analyzeCandidateStatement(
        statement.statement,
        cloneCandidateEnvironment(environment),
        returned,
      );
      if (body && statement.incrementor)
        candidateValueIsDynamic(statement.incrementor, body);
      return body
        ? mergeCandidateEnvironments(environment, body)
        : cloneCandidateEnvironment(environment);
    }
    if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
      return analyzeCandidateStatement(
        statement.statement,
        environment,
        returned,
      );
    }
    return environment;
  };
  function candidateImplementationReturnsDynamic(
    implementation: ts.FunctionLikeDeclaration,
  ): boolean {
    if (candidateAnalysisBudgetExceeded) return false;
    if (candidateImplementationTrue.has(implementation)) return true;
    if (candidateImplementationFalse.has(implementation)) return false;
    if (candidateImplementationInProgress.has(implementation)) return false;
    candidateImplementationInProgress.add(implementation);
    try {
      const environment: CandidateEnvironment = new Map();
      for (const parameter of implementation.parameters) {
        if (!ts.isIdentifier(parameter.name)) continue;
        const binding = resolveBinding(parameter.name, parameter.name.text);
        if (binding) environment.set(binding, false);
      }
      const returned = { dynamic: false };
      if (implementation.body) {
        if (ts.isBlock(implementation.body)) {
          analyzeCandidateStatement(implementation.body, environment, returned);
        } else {
          returned.dynamic = candidateValueIsDynamic(
            implementation.body,
            environment,
          );
        }
      }
      if (candidateAnalysisBudgetExceeded) return false;
      if (returned.dynamic) candidateImplementationTrue.add(implementation);
      else candidateImplementationFalse.add(implementation);
      return returned.dynamic;
    } finally {
      candidateImplementationInProgress.delete(implementation);
    }
  }
  let dynamicCandidateIteration = 0;
  let dynamicCandidateWork = 0;
  const recordDirectCandidateOwnerProperty = (
    owner: ts.Expression | undefined,
    property: string,
  ): boolean => {
    const previousNameCount = dynamicCandidatePropertyNames.size;
    dynamicCandidatePropertyNames.add(property);
    hasScopedDynamicCandidateProperty = true;
    if (!owner) {
      const previousCount = dynamicCandidateProperties.size;
      dynamicCandidateProperties.add(property);
      return (
        dynamicCandidateProperties.size !== previousCount ||
        dynamicCandidatePropertyNames.size !== previousNameCount
      );
    }
    const binding = ts.isIdentifier(owner)
      ? resolveBinding(owner, owner.text)
      : undefined;
    if (binding) {
      const properties =
        dynamicCandidatePropertiesByBinding.get(binding) ?? new Set<string>();
      const previousCount = properties.size;
      properties.add(property);
      dynamicCandidatePropertiesByBinding.set(binding, properties);
      return (
        properties.size !== previousCount ||
        dynamicCandidatePropertyNames.size !== previousNameCount
      );
    }
    const properties =
      dynamicCandidatePropertiesByExpression.get(owner) ?? new Set<string>();
    const previousCount = properties.size;
    properties.add(property);
    dynamicCandidatePropertiesByExpression.set(owner, properties);
    return (
      properties.size !== previousCount ||
      dynamicCandidatePropertyNames.size !== previousNameCount
    );
  };
  for (;;) {
    if (candidateAnalysisBudgetExceeded) break;
    dynamicCandidateIteration += 1;
    dynamicCandidateWork += relations.length + propertyValueTransfers.length;
    if (dynamicCandidateIteration > 64 || dynamicCandidateWork > 2_000_000) {
      limitations.add("dynamic property candidate budget exceeded");
      break;
    }
    let changed = false;
    for (const { target, source } of relations) {
      if (
        !candidateDynamicBindings.has(target) &&
        candidateExpressionIsDynamic(source)
      ) {
        candidateDynamicBindings.add(target);
        changed = true;
      }
      if (
        !dynamicCandidateWildcardBindings.has(target) &&
        candidateOwnerHasWildcard(source)
      ) {
        dynamicCandidateWildcardBindings.add(target);
        changed = true;
      }
    }
    if (candidateAnalysisBudgetExceeded) break;
    for (const transfer of propertyValueTransfers) {
      if (
        transfer.literal &&
        (transfer.value === undefined ||
          ts.isFunctionLike(transfer.value) ||
          ts.isObjectLiteralExpression(transfer.value) ||
          ts.isArrayLiteralExpression(transfer.value))
      ) {
        continue;
      }
      if (
        transfer.value &&
        !ts.isFunctionLike(transfer.value) &&
        (isGuardedByNonCallableCheck(transfer.value) ||
          isDefinitelyNonCallableExpression(transfer.value))
      ) {
        continue;
      }
      const copiedAccess =
        transfer.value &&
        (ts.isPropertyAccessExpression(transfer.value) ||
          ts.isElementAccessExpression(transfer.value))
          ? transfer.value
          : undefined;
      const copiedPropertyExpression =
        copiedAccess && ts.isElementAccessExpression(copiedAccess)
          ? copiedAccess.argumentExpression
          : undefined;
      if (
        transfer.property === undefined &&
        transfer.propertyExpression &&
        copiedAccess &&
        copiedPropertyExpression &&
        sameDynamicPropertyExpression(
          transfer.propertyExpression,
          copiedPropertyExpression,
        ) &&
        !candidateOwnerHasWildcard(copiedAccess.expression)
      ) {
        const correlatedProperties = new Set<string>();
        if (isKnownCallableValue(copiedAccess.expression)) {
          correlatedProperties.add("constructor");
        }
        for (const property of dynamicCandidatePropertyNames) {
          if (property === "constructor") continue;
          if (candidateOwnerHasProperty(copiedAccess.expression, property)) {
            correlatedProperties.add(property);
          }
        }
        for (const property of correlatedProperties) {
          changed =
            recordDirectCandidateOwnerProperty(transfer.owner, property) ||
            changed;
        }
        continue;
      }
      const dynamic =
        transfer.direct ||
        (transfer.selection !== undefined &&
          candidateSelectionIsDynamic(transfer.selection)) ||
        (transfer.value !== undefined &&
          candidateExpressionIsDynamic(transfer.value));
      if (!dynamic) continue;
      if (transfer.property === undefined) {
        if (transfer.spread) continue;
        changed =
          registerCandidateOwnerTaint(transfer.owner, undefined) || changed;
        const ownerBinding =
          transfer.owner && ts.isIdentifier(transfer.owner)
            ? resolveBinding(transfer.owner, transfer.owner.text)
            : undefined;
        if (
          ownerBinding &&
          !dynamicCandidateWildcardBindings.has(ownerBinding)
        ) {
          dynamicCandidateWildcardBindings.add(ownerBinding);
          hasScopedDynamicCandidateProperty = true;
          changed = true;
        } else if (
          transfer.owner &&
          !ownerBinding &&
          !dynamicCandidateWildcardExpressions.has(transfer.owner)
        ) {
          dynamicCandidateWildcardExpressions.add(transfer.owner);
          hasScopedDynamicCandidateProperty = true;
          changed = true;
        } else if (!transfer.owner && !dynamicCandidateWildcard) {
          dynamicCandidateWildcard = true;
          hasScopedDynamicCandidateProperty = true;
          changed = true;
        }
      } else {
        dynamicCandidatePropertyNames.add(transfer.property);
        changed =
          registerCandidateOwnerTaint(transfer.owner, transfer.property) ||
          changed;
        hasScopedDynamicCandidateProperty = true;
        const ownerBinding =
          transfer.owner && ts.isIdentifier(transfer.owner)
            ? resolveBinding(transfer.owner, transfer.owner.text)
            : undefined;
        if (ownerBinding) {
          const properties =
            dynamicCandidatePropertiesByBinding.get(ownerBinding) ?? new Set();
          if (!properties.has(transfer.property)) {
            properties.add(transfer.property);
            dynamicCandidatePropertiesByBinding.set(ownerBinding, properties);
            changed = true;
          }
        } else if (transfer.owner) {
          const properties =
            dynamicCandidatePropertiesByExpression.get(transfer.owner) ??
            new Set();
          if (!properties.has(transfer.property)) {
            properties.add(transfer.property);
            dynamicCandidatePropertiesByExpression.set(
              transfer.owner,
              properties,
            );
            changed = true;
          }
        } else if (!dynamicCandidateProperties.has(transfer.property)) {
          dynamicCandidateProperties.add(transfer.property);
          changed = true;
        }
      }
    }
    if (candidateAnalysisBudgetExceeded) break;
    if (changed) {
      invalidateDynamicCandidateNegativeMemos();
      candidateExpressionFalse = new WeakSet<ts.Node>();
      candidateImplementationFalse = new WeakSet<ts.FunctionLikeDeclaration>();
      candidateContainerExpressionMemo = new WeakMap<ts.Expression, boolean>();
      candidateContainerBindingMemo = new Map<AliasBinding, boolean>();
      candidateOwnerPropertyExpressionMemo = new WeakMap<
        ts.Expression,
        Map<string, boolean>
      >();
      candidateOwnerPropertyBindingMemo = new Map<
        AliasBinding,
        Map<string, boolean>
      >();
    }
    if (!changed) break;
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
      return unionGlobals(
        possibleValue(node.whenTrue),
        possibleValue(node.whenFalse),
      );
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
              .filter(
                (argument): argument is ts.Expression =>
                  argument !== undefined && !ts.isSpreadElement(argument),
              )
              .map((argument) => possibleValue(argument)),
          ),
        ),
      );
    }
    if (ts.isStringLiteralLike(node))
      return new Set([staticStringValue(node.text)]);
    if (!ts.isIdentifier(node)) return emptyGlobals;
    const binding = resolveBinding(node, node.text);
    if (binding) return possibleAliases.get(binding) ?? emptyGlobals;
    if (PRIVILEGED_BROWSER_GLOBALS.has(node.text)) return new Set([node.text]);
    if (node.text === "setTimeout") return new Set([BROWSER_TIMER_TIMEOUT]);
    if (node.text === "setInterval") return new Set([BROWSER_TIMER_INTERVAL]);
    if (node.text === "Reflect") return new Set([REFLECT_NAMESPACE_VALUE]);
    return emptyGlobals;
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
      const previous =
        possibleFunctionReturns.get(implementation) ?? emptyGlobals;
      const next = unionGlobals(
        previous,
        ...returns.map((returned) => possibleValue(returned)),
      );
      if (next.size !== previous.size) {
        possibleFunctionReturns.set(implementation, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const objectFlowGraph = new Map<AliasBinding, Set<AliasBinding>>();
  const connectObjectBindings = (
    left: AliasBinding,
    right: AliasBinding,
  ): void => {
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
  function argumentExpression(
    argument: ts.Expression | ts.SpreadElement | undefined,
  ): ts.Expression | undefined {
    return argument
      ? ts.isSpreadElement(argument)
        ? argument.expression
        : argument
      : undefined;
  }
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
      return expressionObjectBindings(
        expression.expression,
        resolvingFunctions,
      );
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
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      return expressionObjectBindings(
        expression.expression,
        resolvingFunctions,
      );
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return new Set(
        expression.elements.flatMap((element) =>
          ts.isOmittedExpression(element)
            ? []
            : [
                ...expressionObjectBindings(
                  ts.isSpreadElement(element) ? element.expression : element,
                  resolvingFunctions,
                ),
              ],
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
        for (const binding of expressionObjectBindings(
          value,
          resolvingFunctions,
        )) {
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
          for (const binding of expressionObjectBindings(
            argument,
            nextFunctions,
          )) {
            bindings.add(binding);
          }
        }
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          for (const binding of expressionObjectBindings(
            returned,
            nextFunctions,
          )) {
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
        ts.isOmittedExpression(element)
          ? []
          : [...boundPatternBindings(element.name)],
      ),
    );
  };
  const assignmentPatternBindings = (
    expression: ts.Expression,
  ): Set<AliasBinding> => {
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
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      return assignmentPatternBindings(expression.left);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return new Set(
        expression.elements.flatMap((element) =>
          ts.isOmittedExpression(element)
            ? []
            : [
                ...assignmentPatternBindings(
                  ts.isSpreadElement(element) ? element.expression : element,
                ),
              ],
        ),
      );
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return new Set(
        expression.properties.flatMap((member) => {
          if (ts.isSpreadAssignment(member))
            return [...assignmentPatternBindings(member.expression)];
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
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      return receiverBindings(expression.expression);
    }
    return expressionObjectBindings(expression);
  };
  const containsPotentialPrivilege = (expression: ts.Expression): boolean => {
    if ([...possibleValue(expression)].some(isBrowserObjectValue)) return true;
    let found = false;
    const visit = (node: ts.Node): void => {
      if (
        found ||
        (node !== expression &&
          (ts.isFunctionLike(node) || ts.isClassLike(node)))
      ) {
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
        : undefined,
    );
    const indexes = new Set<number>();
    const visit = (node: ts.Node): void => {
      if (node !== implementation && ts.isFunctionLike(node)) return;
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left)) &&
        containsPotentialPrivilege(node.right)
      ) {
        const receivers = receiverBindings(node.left.expression);
        for (const [index, binding] of parameterBindings.entries()) {
          if (binding && receivers.has(canonicalObjectBinding(binding)))
            indexes.add(index);
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
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      !ts.isIdentifier(node.name)
    ) {
      connectSets(
        boundPatternBindings(node.name),
        expressionObjectBindings(node.initializer),
      );
    }
    if (ts.isCallExpression(node)) {
      for (const implementation of callImplementations(node.expression)) {
        const returnedBindings = new Set<AliasBinding>();
        for (const returned of returnsByFunction.get(implementation) ?? []) {
          for (const binding of expressionObjectBindings(returned))
            returnedBindings.add(binding);
        }
        const passthroughIndexes =
          ensureReturnedArgumentIndexes(implementation);
        const writtenIndexes = privilegedParameterWriteIndexes(implementation);
        for (const [index, parameter] of implementation.parameters.entries()) {
          const argument = argumentExpression(node.arguments[index]);
          if (!argument) continue;
          const parameterBindings = boundPatternBindings(parameter.name);
          if (
            !passthroughIndexes.has(index) &&
            !writtenIndexes.has(index) &&
            ![...parameterBindings].some((binding) =>
              returnedBindings.has(binding),
            )
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
    if (
      ts.isBinaryExpression(node) &&
      isValuePropagatingAssignment(node.operatorToken.kind)
    ) {
      if (
        ts.isPropertyAccessExpression(node.left) ||
        ts.isElementAccessExpression(node.left)
      ) {
        const receivers = receiverBindings(node.left.expression);
        connectSets(receivers, expressionObjectBindings(node.right));
        if (containsPotentialPrivilege(node.right)) {
          for (const receiver of receivers) candidateSeeds.add(receiver);
          if (receiverBindings(node.left.expression).size === 0) {
            directCandidateAllocations.add(node.left.expression);
          }
        }
      } else if (
        ts.isObjectLiteralExpression(node.left) ||
        ts.isArrayLiteralExpression(node.left)
      ) {
        connectSets(
          assignmentPatternBindings(node.left),
          expressionObjectBindings(node.right),
        );
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
        if (ts.isSpreadAssignment(member))
          collectValueAllocations(member.expression, resolvingFunctions);
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
        expression.operatorToken.kind ===
          ts.SyntaxKind.AmpersandAmpersandToken ||
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
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      collectValueAllocations(expression.expression, resolvingFunctions);
    }
  };
  for (const relation of relations) {
    if (candidateObjectBindings.has(canonicalObjectBinding(relation.target))) {
      collectValueAllocations(relation.source);
    }
  }
  for (const allocation of directCandidateAllocations)
    collectValueAllocations(allocation);
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
    if (candidateAllocations.has(expression))
      return new Set([objectValue(expression)]);
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      return binding &&
        candidateObjectBindings.has(canonicalObjectBinding(binding))
        ? new Set([
            `${OBJECT_VALUE_PREFIX}binding:${canonicalObjectBinding(binding).id}`,
          ])
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
          if (argument)
            values.push(candidateObjectValues(argument, nextFunctions));
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
  const callValues = new Map<
    ts.CallExpression | ts.NewExpression,
    BrowserGlobalSet
  >();
  const analyzedLocalCalls = new Set<ts.CallExpression | ts.NewExpression>(
    directlyResolvedLocalCalls,
  );
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
    [...values].filter(
      (value) => isObjectValue(value) || PRIVILEGED_BROWSER_GLOBALS.has(value),
    );
  const cloneState = (state: BrowserAliasState): MutableAliasState =>
    new Map([...state].map(([binding, values]) => [binding, new Set(values)]));
  const joinStates = (
    ...states: Array<BrowserAliasState | undefined>
  ): MutableAliasState => {
    const result = new Map<AliasBinding, BrowserGlobalSet>();
    for (const state of states) {
      if (!state) continue;
      for (const [binding, values] of state) {
        result.set(
          binding,
          unionGlobals(result.get(binding) ?? emptyGlobals, values),
        );
      }
    }
    return result;
  };
  const statesEqual = (
    left: BrowserAliasState,
    right: BrowserAliasState,
  ): boolean => {
    const bindings = new Set([...left.keys(), ...right.keys()]);
    for (const binding of bindings) {
      const a = left.get(binding) ?? emptyGlobals;
      const b = right.get(binding) ?? emptyGlobals;
      if (a.size !== b.size || [...a].some((value) => !b.has(value)))
        return false;
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
    for (const owner of owners) {
      const browserValue = browserObjectProperty(owner, property);
      if (browserValue) values.push(new Set([browserValue]));
      if (!isObjectValue(owner) && !PRIVILEGED_BROWSER_GLOBALS.has(owner))
        continue;
      const bindings =
        trackedPropertiesByOwner.get(owner) ?? new Set<AliasBinding>();
      if (property === undefined) {
        values.push(
          ...[...bindings].map((binding) => state.get(binding) ?? emptyGlobals),
        );
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
      updateBinding(
        state,
        trackedPropertyBindingForOwner(owner, property),
        values,
      );
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
        if (
          valuesContainBrowserObject(
            state.get(property) ?? emptyGlobals,
            state,
            nextSeen,
          )
        ) {
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
    const visited = new Set<string>();
    const taintedReplayValueContainsBrowser = (value: string): boolean => {
      if (!value.startsWith(OBJECT_VALUE_PREFIX) || visited.has(value))
        return false;
      visited.add(value);
      const properties = trackedPropertiesByOwner.get(value) ?? [];
      if (
        taintedReplayObjectValues.has(value) &&
        [...properties].some((property) =>
          valuesContainBrowserObject(
            state.get(property) ?? emptyGlobals,
            state,
          ),
        )
      ) {
        return true;
      }
      for (const property of properties) {
        for (const nested of state.get(property) ?? []) {
          if (taintedReplayValueContainsBrowser(nested)) return true;
        }
      }
      return false;
    };
    return [...values].some(taintedReplayValueContainsBrowser);
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
      if (!ts.isOmittedExpression(element))
        updateBoundNames(element.name, values, state);
    }
  };
  const bindingElementProperty = (
    element: ts.BindingElement,
  ): string | undefined => {
    const property =
      element.propertyName ??
      (ts.isIdentifier(element.name) ? element.name : undefined);
    if (!property) return undefined;
    if (
      ts.isIdentifier(property) ||
      ts.isStringLiteralLike(property) ||
      ts.isNumericLiteral(property)
    ) {
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
          : unionGlobals(
              fallback,
              readPropertyValues(fallback, undefined, state),
            );
        if (element.initializer) {
          const initialized = evaluateExpression(element.initializer, state);
          state.clear();
          for (const [binding, tracked] of initialized.state)
            state.set(binding, tracked);
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
        for (const [binding, tracked] of initialized.state)
          state.set(binding, tracked);
        values = unionGlobals(values, initialized.value);
      }
      bindDeclarationPattern(element.name, values, state);
    }
  };
  const assignmentPatternExpression = (
    expression: ts.Expression,
  ): ts.Expression => {
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
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const initialized = evaluateExpression(target.right, state);
      state.clear();
      for (const [binding, tracked] of initialized.state)
        state.set(binding, tracked);
      bindAssignmentPattern(
        target.left,
        unionGlobals(fallback, initialized.value),
        state,
      );
      return;
    }
    if (
      ts.isPropertyAccessExpression(target) ||
      ts.isElementAccessExpression(target)
    ) {
      const owner = evaluateExpression(target.expression, state);
      let nextState = owner.state;
      if (ts.isElementAccessExpression(target) && target.argumentExpression) {
        nextState = evaluateExpression(
          target.argumentExpression,
          nextState,
        ).state;
      }
      state.clear();
      for (const [binding, tracked] of nextState) state.set(binding, tracked);
      writePropertyValues(
        owner.value,
        assignedPropertyName(target),
        fallback,
        state,
      );
      return;
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (const [index, element] of target.elements.entries()) {
        if (ts.isOmittedExpression(element)) continue;
        const values = ts.isSpreadElement(element)
          ? unionGlobals(
              fallback,
              readPropertyValues(fallback, undefined, state),
            )
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
            unionGlobals(
              fallback,
              readPropertyValues(fallback, undefined, state),
            ),
            state,
          );
        } else if (ts.isPropertyAssignment(member)) {
          const property = ts.isComputedPropertyName(member.name)
            ? scopedStaticString(member.name.expression)
            : scopedPropertyName(member.name);
          if (ts.isComputedPropertyName(member.name)) {
            const computed = evaluateExpression(member.name.expression, state);
            state.clear();
            for (const [binding, tracked] of computed.state)
              state.set(binding, tracked);
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
    const previous = valuesBefore.get(node);
    valuesBefore.set(
      node,
      previous ? unionGlobals(previous, current) : new Set(current),
    );
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
  const hasCapturedPrivilegedWrite = (
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    const cached = capturedPrivilegeCache.get(implementation);
    if (cached !== undefined) return cached;
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found || (node !== implementation && ts.isFunctionLike(node))) return;
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        ts.isIdentifier(node.left) &&
        [...possibleValue(node.right)].some(isBrowserObjectValue)
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
  const directValue = (
    node: ts.Expression,
    state: BrowserAliasState,
  ): BrowserGlobalSet => {
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
      return unionGlobals(
        directValue(node.whenTrue, state),
        directValue(node.whenFalse, state),
      );
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      return unionGlobals(
        directValue(node.left, state),
        directValue(node.right, state),
      );
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(node.operatorToken.kind))
    ) {
      return directValue(node.right, state);
    }
    if (ts.isStringLiteralLike(node))
      return new Set([staticStringValue(node.text)]);
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
    if (PRIVILEGED_BROWSER_GLOBALS.has(node.text)) return new Set([node.text]);
    if (node.text === "setTimeout") return new Set([BROWSER_TIMER_TIMEOUT]);
    if (node.text === "setInterval") return new Set([BROWSER_TIMER_INTERVAL]);
    if (node.text === "Reflect") return new Set([REFLECT_NAMESPACE_VALUE]);
    return emptyGlobals;
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
      if (
        operator === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        recordState(node.left, input);
        const right = evaluateExpression(node.right, input);
        const state = cloneState(right.state);
        const binding = resolveBinding(node.left, node.left.text);
        if (binding) updateBinding(state, binding, right.value);
        return { state, value: right.value };
      }
      if (
        isValuePropagatingAssignment(operator) &&
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left))
      ) {
        const owner = evaluateExpression(node.left.expression, input);
        const leftState =
          ts.isElementAccessExpression(node.left) &&
          node.left.argumentExpression
            ? evaluateExpression(node.left.argumentExpression, owner.state)
                .state
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
              unionGlobals(
                stateBeforeRight.get(receiver) ?? emptyGlobals,
                ownerValues,
              ),
            );
          }
        }
        const property = assignedPropertyName(node.left);
        const previous =
          operator === ts.SyntaxKind.EqualsToken
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
          if (binding)
            updateBinding(
              state,
              binding,
              unionGlobals(left.value, right.value),
            );
        }
        return { state, value: unionGlobals(left.value, right.value) };
      }
      const right = evaluateExpression(node.right, left.state);
      return {
        state: right.state,
        value:
          operator === ts.SyntaxKind.CommaToken ? right.value : emptyGlobals,
      };
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const operand = evaluateExpression(node.operand, input);
      return { state: operand.state, value: emptyGlobals };
    }
    if (ts.isPropertyAccessExpression(node)) {
      const expression = evaluateExpression(node.expression, input);
      recordState(node.name, expression.state);
      const value = readPropertyValues(
        expression.value,
        node.name.text,
        expression.state,
      );
      propertyValuesBefore.set(node, new Set(value));
      return { state: expression.state, value };
    }
    if (ts.isElementAccessExpression(node)) {
      const expression = evaluateExpression(node.expression, input);
      const argument = node.argumentExpression
        ? evaluateExpression(node.argumentExpression, expression.state)
        : undefined;
      const state = argument?.state ?? expression.state;
      const trackedPropertyNames = new Set(
        [...(argument?.value ?? [])]
          .map(valueStaticString)
          .filter((value): value is string => value !== undefined),
      );
      const property =
        trackedPropertyNames.size === 1
          ? [...trackedPropertyNames][0]
          : node.argumentExpression
            ? scopedStaticString(node.argumentExpression)
            : undefined;
      const value = readPropertyValues(expression.value, property, state);
      propertyValuesBefore.set(node, new Set(value));
      return { state, value };
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = evaluateExpression(node.expression, input);
      let state = callee.state;
      const argumentValues: BrowserGlobalSet[] = [];
      for (const argument of node.arguments ?? []) {
        const expression = ts.isSpreadElement(argument)
          ? argument.expression
          : argument;
        const evaluated = evaluateExpression(expression, state);
        state = evaluated.state;
        argumentValues.push(evaluated.value);
      }
      {
        const implementations = callImplementations(node.expression);
        if (implementations.size > 0) {
          analyzedLocalCalls.add(node);
          const evaluateCalls =
            evaluateLocalCalls &&
            (argumentValues.some((value) =>
              valuesContainBrowserObject(value, state),
            ) ||
              [...implementations].some(hasCapturedPrivilegedWrite) ||
              [...implementations].some((implementation) =>
                [...privilegedParameterWriteIndexes(implementation)].some(
                  (index) =>
                    [...(argumentValues[index] ?? emptyGlobals)].some(
                      (value) =>
                        isObjectValue(value) ||
                        PRIVILEGED_BROWSER_GLOBALS.has(value),
                    ),
                ),
              ));
          const results = [...implementations].map((implementation) =>
            evaluateCalls
              ? evaluateLocalFunctionCall(implementation, state, argumentValues)
              : {
                  state: cloneState(state),
                  value: unionGlobals(
                    possibleFunctionReturns.get(implementation) ?? emptyGlobals,
                    ...[...(returnsByFunction.get(implementation) ?? [])].map(
                      (returned) => candidateObjectValues(returned),
                    ),
                    ...[...ensureReturnedArgumentIndexes(implementation)].map(
                      (index) => argumentValues[index] ?? emptyGlobals,
                    ),
                  ),
                },
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
      const value =
        ts.isNewExpression(node) && candidateAllocations.has(node)
          ? new Set([objectValue(node)])
          : callee.value.size > 0 &&
              [...callee.value].some(isBrowserObjectValue)
            ? new Set([...callee.value].filter(isBrowserObjectValue))
            : emptyGlobals;
      callValues.set(node, value);
      return { state, value };
    }
    if (ts.isArrayLiteralExpression(node)) {
      let state = cloneState(input);
      const entries: Array<{
        property: string | undefined;
        values: BrowserGlobalSet;
      }> = [];
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
      const container =
        candidateAllocations.has(node) ||
        entries.some((entry) =>
          [...entry.values].some(isProjectionTrackedValue),
        )
          ? new Set([objectValue(node)])
          : emptyGlobals;
      for (const entry of entries) {
        writePropertyValues(container, entry.property, entry.values, state);
      }
      return { state, value: container };
    }
    if (ts.isObjectLiteralExpression(node)) {
      let state = cloneState(input);
      const entries: Array<{
        property: string | undefined;
        values: BrowserGlobalSet;
      }> = [];
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
          entries.push({
            property: property.name.text,
            values: evaluated.value,
          });
        }
      }
      const locallyDeclaredBrowserNamedField = entries.some(
        ({ property }) =>
          property === "contentWindow" || property === "contentDocument",
      );
      const container =
        candidateAllocations.has(node) ||
        locallyDeclaredBrowserNamedField ||
        entries.some((entry) =>
          [...entry.values].some(isProjectionTrackedValue),
        )
          ? new Set([objectValue(node)])
          : emptyGlobals;
      for (const entry of entries) {
        writePropertyValues(container, entry.property, entry.values, state);
      }
      return { state, value: container };
    }
    if (ts.isTemplateExpression(node)) {
      return {
        state: evaluateExpressions(
          node.templateSpans.map((span) => span.expression),
          input,
        ),
        value: emptyGlobals,
      };
    }
    if (ts.isTaggedTemplateExpression(node)) {
      let state = evaluateExpression(node.tag, input).state;
      if (ts.isTemplateExpression(node.template)) {
        state = evaluateExpressions(
          node.template.templateSpans.map((span) => span.expression),
          state,
        );
      }
      return { state, value: emptyGlobals };
    }
    if (ts.isClassExpression(node)) {
      return {
        state: evaluateClassExecutable(node, input),
        value: emptyGlobals,
      };
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return {
        state: cloneState(input),
        value: new Set([LOCAL_CALLABLE_VALUE]),
      };
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
  const widenLoopState = (state: BrowserAliasState): MutableAliasState => {
    const widened = cloneState(state);
    for (const [binding, values] of state) {
      const possible = possibleAliases.get(binding);
      if (possible && [...possible].some((value) => !values.has(value))) {
        updateBinding(widened, binding, unionGlobals(values, possible));
      }
    }
    return widened;
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
    const entry = cloneState(input);
    for (const node of nodes) {
      if (!ts.isFunctionDeclaration(node) || !node.name) continue;
      const binding = resolveBinding(node.name, node.name.text);
      if (binding)
        updateBinding(entry, binding, new Set([LOCAL_CALLABLE_VALUE]));
    }
    const result = emptyFlow(entry);
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
        .filter(
          (completion) =>
            completion.label === undefined || completion.label === label,
        )
        .map((completion) => completion.state);
      let back = joinStates(bodyResult.normal, ...consumedContinues);
      if (incrementor) back = evaluateExpression(incrementor, back).state;
      const nextHead = joinStates(incoming, back);
      if (statesEqual(head, nextHead)) break;
      const widened = widenLoopState(nextHead);
      if (statesEqual(head, widened)) break;
      head = widened;
    }
    const finalBody = bodyResult!;
    const finalCondition = conditionState!;
    const consumedBreaks = finalBody.breaks
      .filter(
        (completion) =>
          completion.label === undefined || completion.label === label,
      )
      .map((completion) => completion.state);
    const exits = atLeastOnce
      ? [finalCondition, ...consumedBreaks]
      : [incoming, finalCondition, ...consumedBreaks];
    const result = emptyFlow(joinStates(...exits));
    result.breaks.push(
      ...finalBody.breaks.filter(
        (completion) =>
          completion.label !== undefined && completion.label !== label,
      ),
    );
    result.continues.push(
      ...finalBody.continues.filter(
        (completion) =>
          completion.label !== undefined && completion.label !== label,
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
        bindDeclarationPattern(declaration.name, initializer.value, state);
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
      return evaluateLoop(
        input,
        node.expression,
        node.statement,
        undefined,
        false,
        label,
      );
    }
    if (ts.isDoStatement(node)) {
      const first = evaluateStatement(node.statement, input);
      const firstContinues = first.continues
        .filter(
          (completion) =>
            completion.label === undefined || completion.label === label,
        )
        .map((completion) => completion.state);
      const firstBack = joinStates(first.normal, ...firstContinues);
      const rest = evaluateLoop(
        firstBack,
        node.expression,
        node.statement,
        undefined,
        true,
        label,
      );
      const firstBreaks = first.breaks
        .filter(
          (completion) =>
            completion.label === undefined || completion.label === label,
        )
        .map((completion) => completion.state);
      rest.normal = joinStates(rest.normal, ...firstBreaks);
      rest.breaks.push(
        ...first.breaks.filter(
          (completion) =>
            completion.label !== undefined && completion.label !== label,
        ),
      );
      rest.continues.push(
        ...first.continues.filter(
          (completion) =>
            completion.label !== undefined && completion.label !== label,
        ),
      );
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
            const initialized = evaluateExpression(
              declaration.initializer,
              state,
            );
            state = initialized.state;
            bindDeclarationPattern(declaration.name, initialized.value, state);
          }
        } else {
          state = evaluateExpression(node.initializer, state).state;
        }
      }
      return evaluateLoop(
        state,
        node.condition,
        node.statement,
        node.incrementor,
        false,
        label,
      );
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
              const binding = resolveBinding(
                declaration.name,
                declaration.name.text,
              );
              if (binding) updateBinding(iteration, binding, emptyGlobals);
            }
          }
        } else if (ts.isIdentifier(node.initializer)) {
          const binding = resolveBinding(
            node.initializer,
            node.initializer.text,
          );
          if (binding) updateBinding(iteration, binding, emptyGlobals);
        }
        body = evaluateStatement(node.statement, iteration);
        const continued = body.continues
          .filter(
            (completion) =>
              completion.label === undefined || completion.label === label,
          )
          .map((completion) => completion.state);
        const back = joinStates(body.normal, ...continued);
        const nextHead = joinStates(expression.state, back);
        if (statesEqual(head, nextHead)) break;
        const widened = widenLoopState(nextHead);
        if (statesEqual(head, widened)) break;
        head = widened;
      }
      const finalBody = body!;
      const consumedBreaks = finalBody.breaks
        .filter(
          (completion) =>
            completion.label === undefined || completion.label === label,
        )
        .map((completion) => completion.state);
      const result = emptyFlow(
        joinStates(expression.state, head, ...consumedBreaks),
      );
      result.breaks.push(
        ...finalBody.breaks.filter(
          (completion) =>
            completion.label !== undefined && completion.label !== label,
        ),
      );
      result.continues.push(
        ...finalBody.continues.filter(
          (completion) =>
            completion.label !== undefined && completion.label !== label,
        ),
      );
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
      result.continues.push({
        label: node.label?.text,
        state: cloneState(input),
      });
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
        if (ts.isCaseClause(clause))
          state = evaluateExpression(clause.expression, state).state;
        const branch = evaluateStatements(clause.statements, state);
        fallthrough = branch.normal;
        exits.push(
          ...branch.breaks
            .filter(
              (completion) =>
                completion.label === undefined || completion.label === label,
            )
            .map((completion) => completion.state),
        );
        result.breaks.push(
          ...branch.breaks.filter(
            (completion) =>
              completion.label !== undefined && completion.label !== label,
          ),
        );
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
        ? evaluateStatement(
            node.catchClause.block,
            joinStates(input, ...attempted.throws),
          )
        : emptyFlow(undefined);
      const result = emptyFlow(joinStates(attempted.normal, caught.normal));
      result.breaks.push(...attempted.breaks);
      result.continues.push(...attempted.continues);
      result.returns.push(...attempted.returns);
      if (!node.catchClause) result.throws.push(...attempted.throws);
      mergeAbrupt(result, caught);
      return node.finallyBlock
        ? evaluateFinally(result, node.finallyBlock)
        : result;
    }
    if (ts.isLabeledStatement(node)) {
      const body = evaluateStatement(node.statement, input, node.label.text);
      const matchingBreaks = body.breaks
        .filter((completion) => completion.label === node.label.text)
        .map((completion) => completion.state);
      body.normal = joinStates(body.normal, ...matchingBreaks);
      body.breaks = body.breaks.filter(
        (completion) => completion.label !== node.label.text,
      );
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
      if (ts.isExpression(child))
        state = evaluateExpression(child, state).state;
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
  const declaredBrowserValues = (
    type: ts.TypeNode | undefined,
  ): BrowserGlobalSet => {
    if (!type) return emptyGlobals;
    const values = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        if (node.text === "HTMLIFrameElement")
          values.add(DOM_NODE_BROWSER_OBJECT);
        else if (["Window", "WindowProxy"].includes(node.text))
          values.add("window");
        else if (node.text === "Document") values.add("document");
        else if (node.text === "Navigator") values.add("navigator");
      }
      ts.forEachChild(node, visit);
    };
    visit(type);
    return values;
  };
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
    if (cached)
      return { state: cloneState(cached.state), value: new Set(cached.value) };
    activeFunctions.add(implementation);
    try {
      let state = cloneState(callerState);
      for (const [index, parameter] of implementation.parameters.entries()) {
        let value = unionGlobals(
          argumentValues[index] ?? emptyGlobals,
          declaredBrowserValues(parameter.type),
        );
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
        value = unionGlobals(
          ...flow.returns.map((completion) => completion.value),
        );
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
        if (!bindingInside(binding, implementation))
          updateBinding(projected, binding, values);
      }
      const result = { state: projected, value };
      let cache = functionCallCache.get(implementation);
      if (!cache) {
        cache = new Map();
        functionCallCache.set(implementation, cache);
      }
      cache.set(signature, {
        state: cloneState(result.state),
        value: new Set(result.value),
      });
      return result;
    } finally {
      activeFunctions.delete(implementation);
    }
  }
  const executionScope = (node: ts.Node): ts.Node => {
    let current: ts.Node | undefined = node;
    while (
      current &&
      !ts.isFunctionLike(current) &&
      !ts.isSourceFile(current)
    ) {
      current = current.parent;
    }
    return current ?? root;
  };
  const capturedSeedBindings = new WeakMap<ts.Node, Set<AliasBinding>>();
  const seedFor = (scope: ts.Node): MutableAliasState => {
    let captured = capturedSeedBindings.get(scope);
    if (!captured) {
      captured = new Set<AliasBinding>();
      const collectCaptured = (node: ts.Node): void => {
        if (node !== scope && ts.isFunctionLike(node)) return;
        if (ts.isIdentifier(node)) {
          const binding = resolveBinding(node, node.text);
          if (
            binding &&
            !bindingInside(binding, scope) &&
            (possibleAliases.get(binding)?.size ?? 0) > 0
          ) {
            captured!.add(binding);
          }
        }
        ts.forEachChild(node, collectCaptured);
      };
      collectCaptured(scope);
      capturedSeedBindings.set(scope, captured);
    }
    const seed = new Map<AliasBinding, BrowserGlobalSet>();
    for (const binding of captured) {
      seed.set(binding, possibleAliases.get(binding)!);
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
          bindDeclarationPattern(
            parameter.name,
            unionGlobals(
              initialized.value,
              declaredBrowserValues(parameter.type),
            ),
            state,
          );
        } else {
          bindDeclarationPattern(
            parameter.name,
            declaredBrowserValues(parameter.type),
            state,
          );
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
        const returnsPrivileged = (
          returnsByFunction.get(implementation) ?? []
        ).some((returned) =>
          expressionCanReturnPrivilegedBrowserObject(returned, nextFunctions),
        );
        privilegedReturnMemo.set(implementation, returnsPrivileged);
        if (returnsPrivileged) return true;
      }
    }
    let found = false;
    ts.forEachChild(expression, (child) => {
      if (!found && ts.isExpression(child) && !ts.isFunctionLike(child)) {
        found = expressionCanReturnPrivilegedBrowserObject(
          child,
          resolvingFunctions,
        );
      }
    });
    return found;
  };
  const replayTaintedReturnMemo = new Map<
    ts.FunctionLikeDeclaration,
    boolean
  >();
  const computeReplayFunctionReturnsTaintedObject = (
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    const replayParameters = new Set(
      implementation.parameters
        .filter(
          (
            parameter,
          ): parameter is ts.ParameterDeclaration & { name: ts.Identifier } =>
            ts.isIdentifier(parameter.name),
        )
        .map((parameter) => resolveBinding(parameter.name, parameter.name.text))
        .filter(
          (binding): binding is AliasBinding =>
            binding !== undefined && replayEventParameters.has(binding),
        ),
    );
    if (replayParameters.size === 0 || !implementation.body) return false;
    const returnsReplayParameter = (
      returnsByFunction.get(implementation) ?? []
    ).some(
      (returned) =>
        ts.isIdentifier(returned) &&
        replayParameters.has(resolveBinding(returned, returned.text)!),
    );
    if (!returnsReplayParameter) return false;
    let writesPrivilegedProperty = false;
    const inspect = (node: ts.Node): void => {
      if (
        writesPrivilegedProperty ||
        (node !== implementation.body && ts.isFunctionLike(node))
      ) {
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        isValuePropagatingAssignment(node.operatorToken.kind) &&
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left)) &&
        ts.isIdentifier(node.left.expression) &&
        replayParameters.has(
          resolveBinding(node.left.expression, node.left.expression.text)!,
        ) &&
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
  const replayFunctionReturnsTaintedObject = (
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    const cached = replayTaintedReturnMemo.get(implementation);
    if (cached !== undefined) return cached;
    const result = computeReplayFunctionReturnsTaintedObject(implementation);
    replayTaintedReturnMemo.set(implementation, result);
    return result;
  };
  const taintedReplayCallMemo = new WeakMap<ts.Expression, boolean>();
  const callReturnsTaintedReplayObject = (
    expression: ts.Expression,
  ): boolean => {
    if (trackedBrowserObjectExpressions.size === 0) return false;
    if (!ts.isCallExpression(expression) && !ts.isNewExpression(expression))
      return false;
    const cached = taintedReplayCallMemo.get(expression);
    if (cached !== undefined) return cached;
    const result = [...callImplementations(expression.expression)].some(
      replayFunctionReturnsTaintedObject,
    );
    taintedReplayCallMemo.set(expression, result);
    return result;
  };
  const deferredSeedFunctions = new Set<ts.FunctionLikeDeclaration>();
  for (const expression of trackedBrowserObjectExpressions) {
    let current: ts.Node | undefined = expression;
    while (current) {
      if (ts.isFunctionLike(current)) {
        deferredSeedFunctions.add(current as ts.FunctionLikeDeclaration);
      }
      current = current.parent;
    }
  }
  const deferredFunctionSeedMemo = new Map<
    ts.FunctionLikeDeclaration,
    boolean
  >();
  const functionContainsDeferredSeed = (
    implementation: ts.FunctionLikeDeclaration,
  ): boolean => {
    if (deferredSeedFunctions.has(implementation)) return true;
    const cached = deferredFunctionSeedMemo.get(implementation);
    if (cached !== undefined) return cached;
    deferredFunctionSeedMemo.set(implementation, false);
    let found = false;
    const inspect = (node: ts.Node): void => {
      if (found) return;
      if (
        ts.isExpression(node) &&
        (trackedBrowserObjectExpressions.has(node) ||
          callReturnsTaintedReplayObject(node))
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, inspect);
    };
    if (implementation.body) inspect(implementation.body);
    deferredFunctionSeedMemo.set(implementation, found);
    if (found) deferredSeedFunctions.add(implementation);
    return found;
  };
  const deferredCandidateBindings = new Set<AliasBinding>();
  const deferredCandidateProperties = new Set<string>();
  let deferredCandidateWildcard = false;
  const candidateExpressionContainsDeferred = (
    node: ts.Expression | ts.FunctionLikeDeclaration,
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean => {
    if (resolvingNodes.has(node)) return false;
    if (ts.isExpression(node) && trackedBrowserObjectExpressions.has(node))
      return true;
    if (ts.isFunctionLike(node)) {
      return functionContainsDeferredSeed(node as ts.FunctionLikeDeclaration);
    }
    const nextNodes = new Set(resolvingNodes).add(node);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isAwaitExpression(node)
    ) {
      return candidateExpressionContainsDeferred(node.expression, nextNodes);
    }
    if (ts.isConditionalExpression(node)) {
      return (
        candidateExpressionContainsDeferred(node.whenTrue, nextNodes) ||
        candidateExpressionContainsDeferred(node.whenFalse, nextNodes)
      );
    }
    if (ts.isBinaryExpression(node)) {
      if (
        node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
        isValuePropagatingAssignment(node.operatorToken.kind)
      ) {
        return candidateExpressionContainsDeferred(node.right, nextNodes);
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      ) {
        return (
          candidateExpressionContainsDeferred(node.left, nextNodes) ||
          candidateExpressionContainsDeferred(node.right, nextNodes)
        );
      }
      return false;
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.some((member) => {
        if (ts.isSpreadAssignment(member)) {
          return candidateExpressionContainsDeferred(
            member.expression,
            nextNodes,
          );
        }
        if (ts.isPropertyAssignment(member)) {
          return candidateExpressionContainsDeferred(
            member.initializer,
            nextNodes,
          );
        }
        if (ts.isShorthandPropertyAssignment(member)) {
          return candidateExpressionContainsDeferred(member.name, nextNodes);
        }
        return (
          (ts.isMethodDeclaration(member) ||
            ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)) &&
          functionContainsDeferredSeed(member)
        );
      });
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.some(
        (element) =>
          !ts.isOmittedExpression(element) &&
          candidateExpressionContainsDeferred(
            ts.isSpreadElement(element) ? element.expression : element,
            nextNodes,
          ),
      );
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (callReturnsTaintedReplayObject(node)) return true;
      for (const implementation of callImplementations(node.expression)) {
        if (
          (returnsByFunction.get(implementation) ?? []).some((returned) =>
            candidateExpressionContainsDeferred(returned, nextNodes),
          )
        ) {
          return true;
        }
        for (const index of ensureReturnedArgumentIndexes(implementation)) {
          const argument = argumentExpression(node.arguments?.[index]);
          if (
            argument &&
            candidateExpressionContainsDeferred(argument, nextNodes)
          )
            return true;
        }
      }
      return false;
    }
    if (ts.isIdentifier(node)) {
      const binding = resolveBinding(node, node.text);
      return binding !== undefined && deferredCandidateBindings.has(binding);
    }
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const property = assignedPropertyName(node);
      return (
        deferredCandidateWildcard ||
        property === undefined ||
        deferredCandidateProperties.has(property)
      );
    }
    return false;
  };
  let deferredCandidateIteration = 0;
  let deferredCandidateWork = 0;
  while (trackedBrowserObjectExpressions.size > 0) {
    deferredCandidateIteration += 1;
    deferredCandidateWork += relations.length + propertyValueTransfers.length;
    if (deferredCandidateIteration > 64 || deferredCandidateWork > 500_000) {
      limitations.add("deferred property candidate budget exceeded");
      break;
    }
    let changed = false;
    for (const { target, source } of relations) {
      if (
        !deferredCandidateBindings.has(target) &&
        candidateExpressionContainsDeferred(source)
      ) {
        deferredCandidateBindings.add(target);
        changed = true;
      }
    }
    for (const transfer of propertyValueTransfers) {
      if (
        transfer.value === undefined ||
        !candidateExpressionContainsDeferred(transfer.value)
      ) {
        continue;
      }
      if (transfer.property === undefined) {
        if (!deferredCandidateWildcard) {
          deferredCandidateWildcard = true;
          changed = true;
        }
      } else if (!deferredCandidateProperties.has(transfer.property)) {
        deferredCandidateProperties.add(transfer.property);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const deferredTrackedTrue = new WeakSet<ts.Expression>();
  const deferredTrackedFalse = new WeakSet<ts.Expression>();
  const deferredTrackedInProgress = new WeakSet<ts.Expression>();
  const defaultDeferredAnalysisBudget = 20_000;
  const requestedDeferredAnalysisBudget = Number(
    process.env.PRIVATE_HOSTED_DEFERRED_BUDGET,
  );
  const deferredAnalysisBudget =
    Number.isSafeInteger(requestedDeferredAnalysisBudget) &&
    requestedDeferredAnalysisBudget >= 0
      ? Math.min(requestedDeferredAnalysisBudget, defaultDeferredAnalysisBudget)
      : defaultDeferredAnalysisBudget;
  type DeferredTraversalBudget = {
    remaining: number;
    depth: number;
    visited: number;
    cycleVersion: number;
    exhausted: boolean;
  };
  let activeDeferredTraversalBudget: DeferredTraversalBudget | undefined;
  const containsDeferredTrackedBrowserObject = (
    expression: ts.Expression,
    resolvingBindings: ReadonlySet<AliasBinding> = new Set(),
    resolvingNodes: ReadonlySet<ts.Node> = new Set(),
  ): boolean => {
    if (trackedBrowserObjectExpressions.size === 0) return false;
    const expressionBinding = ts.isIdentifier(expression)
      ? resolveBinding(expression, expression.text)
      : undefined;
    if (deferredTrackedTrue.has(expression)) return true;
    if (deferredTrackedFalse.has(expression)) return false;
    const ownsBudget = activeDeferredTraversalBudget === undefined;
    const budget = activeDeferredTraversalBudget ?? {
      remaining: deferredAnalysisBudget,
      depth: 0,
      visited: 0,
      cycleVersion: 0,
      exhausted: false,
    };
    activeDeferredTraversalBudget = budget;
    if (
      resolvingNodes.has(expression) ||
      (expressionBinding !== undefined &&
        resolvingBindings.has(expressionBinding)) ||
      deferredTrackedInProgress.has(expression)
    ) {
      budget.cycleVersion += 1;
      if (ownsBudget) activeDeferredTraversalBudget = undefined;
      return false;
    }
    deferredTrackedInProgress.add(expression);
    const cycleVersion = budget.cycleVersion;
    if (budget.remaining <= 0 || budget.depth >= 64) {
      budget.exhausted = true;
      limitations.add("deferred analysis work budget exceeded");
      deferredTrackedInProgress.delete(expression);
      if (ownsBudget) activeDeferredTraversalBudget = undefined;
      return true;
    }
    budget.remaining -= 1;
    budget.visited += 1;
    budget.depth += 1;
    try {
      const nextNodes = new Set(resolvingNodes).add(expression);
      const containsReturnedTrackedValue = (
        implementation: ts.FunctionLikeDeclaration,
      ): boolean => {
        if (!implementation.body) return false;
        if (!ts.isBlock(implementation.body)) {
          return (
            trackedBrowserObjectExpressions.has(implementation.body) ||
            callReturnsTaintedReplayObject(implementation.body) ||
            containsDeferredTrackedBrowserObject(
              implementation.body,
              resolvingBindings,
              nextNodes,
            )
          );
        }
        let found = false;
        const inspect = (node: ts.Node): void => {
          if (
            found ||
            (node !== implementation.body && ts.isFunctionLike(node))
          )
            return;
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
      let result =
        trackedBrowserObjectExpressions.has(expression) ||
        callReturnsTaintedReplayObject(expression);
      if (!result) {
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
        } else if (
          ts.isArrowFunction(expression) ||
          ts.isFunctionExpression(expression)
        ) {
          result = containsReturnedTrackedValue(expression);
        } else if (ts.isObjectLiteralExpression(expression)) {
          result = expression.properties.some((property) => {
            if (
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property)
            ) {
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
            return (
              ts.isSpreadAssignment(property) &&
              containsDeferredTrackedBrowserObject(
                property.expression,
                resolvingBindings,
                nextNodes,
              )
            );
          });
        } else if (ts.isArrayLiteralExpression(expression)) {
          result = expression.elements.some(
            (element) =>
              !ts.isOmittedExpression(element) &&
              containsDeferredTrackedBrowserObject(
                ts.isSpreadElement(element) ? element.expression : element,
                resolvingBindings,
                nextNodes,
              ),
          );
        } else if (ts.isConditionalExpression(expression)) {
          result =
            containsDeferredTrackedBrowserObject(
              expression.whenTrue,
              resolvingBindings,
              nextNodes,
            ) ||
            containsDeferredTrackedBrowserObject(
              expression.whenFalse,
              resolvingBindings,
              nextNodes,
            );
        } else if (
          ts.isBinaryExpression(expression) &&
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(expression.operatorToken.kind)
        ) {
          result =
            containsDeferredTrackedBrowserObject(
              expression.left,
              resolvingBindings,
              nextNodes,
            ) ||
            containsDeferredTrackedBrowserObject(
              expression.right,
              resolvingBindings,
              nextNodes,
            );
        } else if (
          ts.isBinaryExpression(expression) &&
          (expression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
            isValuePropagatingAssignment(expression.operatorToken.kind))
        ) {
          result = containsDeferredTrackedBrowserObject(
            expression.right,
            resolvingBindings,
            nextNodes,
          );
        } else if (
          ts.isPropertyAccessExpression(expression) ||
          ts.isElementAccessExpression(expression)
        ) {
          const property = assignedPropertyName(expression);
          result = expressionWriteSources(expression).some((source) =>
            containsDeferredTrackedBrowserObject(
              source,
              resolvingBindings,
              nextNodes,
            ),
          );
          if (
            !result &&
            (property === undefined ||
              deferredCandidateWildcard ||
              deferredCandidateProperties.has(property))
          ) {
            const projected = projectedValueSources(
              expression.expression,
              property,
            );
            result =
              projected.uncertain ||
              [...projected.expressions].some((source) =>
                containsDeferredTrackedBrowserObject(
                  source,
                  resolvingBindings,
                  nextNodes,
                ),
              ) ||
              [...projected.functions].some(containsReturnedTrackedValue);
          }
        } else if (
          ts.isCallExpression(expression) ||
          ts.isNewExpression(expression)
        ) {
          result = (expression.arguments ?? []).some((argument) =>
            containsDeferredTrackedBrowserObject(
              ts.isSpreadElement(argument) ? argument.expression : argument,
              resolvingBindings,
              nextNodes,
            ),
          );
          if (!result) {
            for (const implementation of callImplementations(
              expression.expression,
            )) {
              if (containsReturnedTrackedValue(implementation)) {
                result = true;
                break;
              }
              for (const index of ensureReturnedArgumentIndexes(
                implementation,
              )) {
                const argument = argumentExpression(
                  expression.arguments?.[index],
                );
                if (
                  argument &&
                  containsDeferredTrackedBrowserObject(
                    argument,
                    resolvingBindings,
                    nextNodes,
                  )
                ) {
                  result = true;
                  break;
                }
              }
              if (result) break;
            }
          }
        } else if (ts.isIdentifier(expression)) {
          const binding = resolveBinding(expression, expression.text);
          if (binding && !resolvingBindings.has(binding)) {
            const nextBindings = new Set(resolvingBindings).add(binding);
            result = (relationsByTarget.get(binding) ?? []).some((relation) =>
              containsDeferredTrackedBrowserObject(
                relation.source,
                nextBindings,
                nextNodes,
              ),
            );
          }
        }
      }
      if (result) {
        deferredTrackedTrue.add(expression);
      } else if (budget.cycleVersion === cycleVersion && !budget.exhausted) {
        deferredTrackedFalse.add(expression);
      }
      return result;
    } finally {
      budget.depth -= 1;
      deferredTrackedInProgress.delete(expression);
      if (ownsBudget) activeDeferredTraversalBudget = undefined;
    }
  };
  const isBrowserTimer = (
    expression: ts.Expression,
    resolving: ReadonlySet<AliasBinding> = new Set(),
  ): boolean => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return isBrowserTimer(expression.expression, resolving);
    }
    if (ts.isCallExpression(expression)) {
      const callee = expression.expression;
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        (ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : callee.argumentExpression
            ? staticString(callee.argumentExpression)
            : undefined) === "bind"
      ) {
        return isBrowserTimer(callee.expression, resolving);
      }
      return false;
    }
    if (ts.isIdentifier(expression)) {
      const binding = resolveBinding(expression, expression.text);
      if (!binding)
        return ["setInterval", "setTimeout"].includes(expression.text);
      const flowValues = valuesBefore.get(expression);
      if (flowValues) {
        return (
          flowValues.has(BROWSER_TIMER_TIMEOUT) ||
          flowValues.has(BROWSER_TIMER_INTERVAL)
        );
      }
      if (resolving.has(binding)) return false;
      const next = new Set(resolving).add(binding);
      return (relationsByTarget.get(binding) ?? []).some(({ source }) =>
        isBrowserTimer(source, next),
      );
    }
    if (
      !ts.isPropertyAccessExpression(expression) &&
      !ts.isElementAccessExpression(expression)
    ) {
      return false;
    }
    const property = ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : expression.argumentExpression
        ? scopedAliasStaticString(expression.argumentExpression)
        : undefined;
    const flowValues = propertyValuesBefore.get(expression);
    if (flowValues) {
      return (
        flowValues.has(BROWSER_TIMER_TIMEOUT) ||
        flowValues.has(BROWSER_TIMER_INTERVAL)
      );
    }
    return (
      ["setInterval", "setTimeout"].includes(property ?? "") &&
      privilegedBrowserGlobal(expression.expression, result) !== undefined
    );
  };
  const flowStaticString = (expression: ts.Expression): string | undefined => {
    const direct = staticString(expression);
    if (direct !== undefined) return direct;
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
    if (ts.isIdentifier(current)) {
      const values = new Set(
        [...(valuesBefore.get(current) ?? [])]
          .map(valueStaticString)
          .filter((value): value is string => value !== undefined),
      );
      if (values.size === 1) return [...values][0];
    }
    return scopedAliasStaticString(expression);
  };
  const result: BrowserAliasAnalysis = {
    limitations,
    valuesBefore,
    propertyValuesBefore,
    callValues,
    analyzedLocalCalls,
    localFunctionReturns,
    resolveBinding,
    callableSources: (node) => {
      const binding = resolveBinding(node, node.text);
      return binding
        ? (relationsByTarget.get(binding) ?? []).map(({ source }) => source)
        : [];
    },
    staticString: flowStaticString,
    isBrowserTimer,
    isDynamicFunctionConstructor,
    containsTrackedBrowserObject: (node) =>
      trackedBrowserObjectExpressions.has(node),
    containsDeferredTrackedBrowserObject,
    isCapturedBinding: (node, binding) =>
      !bindingInside(binding, executionScope(node)),
    isInertReplayEventConstructor,
    isInertEventTargetAssignment,
  };
  return result;
}

type ScopedStaticStrings = {
  constants: ReadonlyMap<AliasBinding, ts.Expression>;
  callableSources: ReadonlyMap<AliasBinding, readonly ts.Expression[]>;
  functionBindings: ReadonlySet<AliasBinding>;
  uncertainCallableBindings: ReadonlySet<AliasBinding>;
  reactCallbackBindings: ReadonlySet<AliasBinding>;
  reactNamespaceBindings: ReadonlySet<AliasBinding>;
  mutatedReactNamespaceBindings: ReadonlySet<AliasBinding>;
  resolveBinding(node: ts.Node, name: string): AliasBinding | undefined;
};

function collectScopedStaticStrings(
  root: ts.Node,
  bindings: BrowserAliasAnalysis,
  trustedBundleImports?: {
    vendor: ReadonlySet<string>;
    runtime: ReadonlySet<string>;
  },
): ScopedStaticStrings {
  const constants = new Map<AliasBinding, ts.Expression>();
  const ambiguous = new Set<AliasBinding>();
  const callableSources = new Map<AliasBinding, ts.Expression[]>();
  const functionBindings = new Set<AliasBinding>();
  const uncertainCallableBindings = new Set<AliasBinding>();
  const reactCallbackBindings = new Set<AliasBinding>();
  const reactNamespaceBindings = new Set<AliasBinding>();
  const mutatedReactNamespaceBindings = new Set<AliasBinding>();
  const opaqueReactNamespaceCallArguments = new Set<AliasBinding>();
  const reactNamespaceFactoryBindings = new Map<AliasBinding, string>();
  const bundledVendorIdentities = new Map<AliasBinding, string>();
  const bundledVendorNamespaceIdentities = new Map<AliasBinding, string>();
  const bundledRuntimeBindings = new Set<AliasBinding>();
  if (trustedBundleImports) {
    const collectBundleImports = (node: ts.Node): void => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.importClause
      ) {
        const named = node.importClause.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            const exported = (element.propertyName ?? element.name).text;
            const binding = bindings.resolveBinding(
              element.name,
              element.name.text,
            );
            if (!binding) continue;
            if (
              trustedBundleImports.vendor.has(node.moduleSpecifier.text) &&
              exported === "l"
            ) {
              bundledVendorIdentities.set(
                binding,
                `${node.moduleSpecifier.text}\0${exported}`,
              );
            }
            if (
              trustedBundleImports.runtime.has(node.moduleSpecifier.text) &&
              exported === "r"
            ) {
              bundledRuntimeBindings.add(binding);
            }
          }
        } else if (
          named &&
          ts.isNamespaceImport(named) &&
          trustedBundleImports.vendor.has(node.moduleSpecifier.text)
        ) {
          const binding = bindings.resolveBinding(named.name, named.name.text);
          if (binding) {
            bundledVendorNamespaceIdentities.set(
              binding,
              node.moduleSpecifier.text,
            );
          }
        }
      }
      ts.forEachChild(node, collectBundleImports);
    };
    collectBundleImports(root);
  }
  const vendorFactoryIdentity = (
    expression: ts.Expression,
  ): string | undefined => {
    while (ts.isParenthesizedExpression(expression))
      expression = expression.expression;
    if (ts.isIdentifier(expression)) {
      const binding = bindings.resolveBinding(expression, expression.text);
      return binding ? bundledVendorIdentities.get(binding) : undefined;
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const owner = expression.expression;
      if (!ts.isIdentifier(owner)) return undefined;
      const binding = bindings.resolveBinding(owner, owner.text);
      const moduleSpecifier = binding
        ? bundledVendorNamespaceIdentities.get(binding)
        : undefined;
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : expression.argumentExpression
          ? bindings.staticString(expression.argumentExpression)
          : undefined;
      return moduleSpecifier && property === "l"
        ? `${moduleSpecifier}\0${property}`
        : undefined;
    }
    return undefined;
  };
  const exactBundledReactFactory = (
    initializer: ts.Node,
  ): string | undefined => {
    if (!trustedBundleImports || !ts.isCallExpression(initializer))
      return undefined;
    let callee: ts.Expression = initializer.expression;
    while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
    if (!ts.isIdentifier(callee)) return undefined;
    const runtimeBinding = bindings.resolveBinding(callee, callee.text);
    if (!runtimeBinding || !bundledRuntimeBindings.has(runtimeBinding))
      return undefined;
    if (initializer.arguments.length !== 2) return undefined;
    const [factoryCall, interopMode] = initializer.arguments;
    if (
      !factoryCall ||
      ts.isSpreadElement(factoryCall) ||
      !ts.isCallExpression(factoryCall) ||
      factoryCall.arguments.length !== 0 ||
      !interopMode ||
      ts.isSpreadElement(interopMode) ||
      !ts.isNumericLiteral(interopMode) ||
      interopMode.text !== "1"
    ) {
      return undefined;
    }
    return vendorFactoryIdentity(factoryCall.expression);
  };
  const exposedBundledVendorIdentities = new Set<string>();
  if (trustedBundleImports) {
    const collectExposedVendorReferences = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const vendorBinding = bindings.resolveBinding(node, node.text);
        const directIdentity = vendorBinding
          ? bundledVendorIdentities.get(vendorBinding)
          : undefined;
        const namespaceIdentity = vendorBinding
          ? bundledVendorNamespaceIdentities.get(vendorBinding)
          : undefined;
        if (directIdentity) {
          const declaration =
            ts.isImportSpecifier(node.parent) ||
            ts.isImportClause(node.parent) ||
            ts.isNamespaceImport(node.parent);
          const factoryCall =
            ts.isCallExpression(node.parent) &&
            node.parent.expression === node &&
            exactBundledReactFactory(node.parent.parent) === directIdentity;
          if (!declaration && !factoryCall)
            exposedBundledVendorIdentities.add(directIdentity);
        } else if (namespaceIdentity) {
          const declaration = ts.isNamespaceImport(node.parent);
          const member =
            (ts.isPropertyAccessExpression(node.parent) ||
              ts.isElementAccessExpression(node.parent)) &&
            node.parent.expression === node
              ? node.parent
              : undefined;
          const identity = member ? vendorFactoryIdentity(member) : undefined;
          const factoryCall =
            identity &&
            ts.isCallExpression(member!.parent) &&
            member!.parent.expression === member &&
            exactBundledReactFactory(member!.parent.parent) === identity;
          if (!declaration && !factoryCall) {
            exposedBundledVendorIdentities.add(`${namespaceIdentity}\0l`);
          }
        }
      }
      ts.forEachChild(node, collectExposedVendorReferences);
    };
    collectExposedVendorReferences(root);
  }
  const bundledReactFactory = (
    initializer: ts.Expression,
  ): string | undefined => {
    const factoryIdentity = exactBundledReactFactory(initializer);
    return factoryIdentity &&
      !exposedBundledVendorIdentities.has(factoryIdentity)
      ? factoryIdentity
      : undefined;
  };
  const addCallableSource = (
    node: ts.Identifier,
    source: ts.Expression,
  ): void => {
    const binding = bindings.resolveBinding(node, node.text);
    if (!binding) return;
    const sources = callableSources.get(binding) ?? [];
    sources.push(source);
    callableSources.set(binding, sources);
  };
  const addProjectedCallableSources = (
    target: ts.BindingName,
    source: ts.Expression,
  ): void => {
    if (ts.isIdentifier(target)) {
      addCallableSource(target, source);
      return;
    }
    if (ts.isObjectBindingPattern(target)) {
      for (const element of target.elements) {
        if (element.dotDotDotToken) continue;
        const name = element.propertyName;
        const property =
          !name && ts.isIdentifier(element.name)
            ? element.name.text
            : name && ts.isComputedPropertyName(name)
              ? bindings.staticString(name.expression)
              : name &&
                  (ts.isIdentifier(name) ||
                    ts.isStringLiteralLike(name) ||
                    ts.isNumericLiteral(name))
                ? name.text
                : undefined;
        if (property !== "default") continue;
        addProjectedCallableSources(
          element.name,
          ts.factory.createElementAccessExpression(
            source,
            ts.factory.createStringLiteral("default"),
          ),
        );
      }
      return;
    }
    if (!ts.isArrayLiteralExpression(source)) return;
    for (const [index, element] of target.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      const projected = source.elements[index];
      if (!projected || ts.isOmittedExpression(projected)) continue;
      addProjectedCallableSources(
        element.name,
        ts.isSpreadElement(projected) ? projected.expression : projected,
      );
    }
  };
  const addAssignedCallableSources = (
    target: ts.Expression,
    source: ts.Expression,
  ): void => {
    while (
      ts.isParenthesizedExpression(target) ||
      ts.isAsExpression(target) ||
      ts.isTypeAssertionExpression(target) ||
      ts.isNonNullExpression(target) ||
      ts.isSatisfiesExpression(target)
    ) {
      target = target.expression;
    }
    if (ts.isIdentifier(target)) {
      addCallableSource(target, source);
      return;
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property)
        ) {
          continue;
        }
        const name = property.name;
        const propertyName = ts.isComputedPropertyName(name)
          ? bindings.staticString(name.expression)
          : ts.isIdentifier(name) ||
              ts.isStringLiteralLike(name) ||
              ts.isNumericLiteral(name)
            ? name.text
            : undefined;
        if (propertyName !== "default") continue;
        addAssignedCallableSources(
          ts.isPropertyAssignment(property)
            ? property.initializer
            : property.name,
          ts.factory.createElementAccessExpression(
            source,
            ts.factory.createStringLiteral("default"),
          ),
        );
      }
      return;
    }
    if (
      !ts.isArrayLiteralExpression(target) ||
      !ts.isArrayLiteralExpression(source)
    )
      return;
    for (const [index, element] of target.elements.entries()) {
      if (ts.isOmittedExpression(element)) continue;
      const projected = source.elements[index];
      if (!projected || ts.isOmittedExpression(projected)) continue;
      addAssignedCallableSources(
        ts.isSpreadElement(element) ? element.expression : element,
        ts.isSpreadElement(projected) ? projected.expression : projected,
      );
    }
  };
  const markUncertainTarget = (node: ts.Node): void => {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      markUncertainTarget(node.expression);
      return;
    }
    if (ts.isIdentifier(node)) {
      const binding = bindings.resolveBinding(node, node.text);
      if (binding) uncertainCallableBindings.add(binding);
      return;
    }
    if (ts.isArrayLiteralExpression(node) || ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        if (ts.isOmittedExpression(element)) continue;
        if (ts.isBindingElement(element)) markUncertainTarget(element.name);
        else
          markUncertainTarget(
            ts.isSpreadElement(element) ? element.expression : element,
          );
      }
      return;
    }
    if (ts.isObjectLiteralExpression(node) || ts.isObjectBindingPattern(node)) {
      const elements = ts.isObjectLiteralExpression(node)
        ? node.properties
        : node.elements;
      for (const element of elements) {
        if (ts.isBindingElement(element)) markUncertainTarget(element.name);
        else if (ts.isShorthandPropertyAssignment(element))
          markUncertainTarget(element.name);
        else if (ts.isPropertyAssignment(element))
          markUncertainTarget(element.initializer);
        else if (ts.isSpreadAssignment(element))
          markUncertainTarget(element.expression);
      }
    }
  };
  const namespaceOwnerBinding = (
    node: ts.Expression,
  ): AliasBinding | undefined => {
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      node = node.expression;
    }
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const property = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : node.argumentExpression
          ? bindings.staticString(node.argumentExpression)
          : undefined;
      return property === "default"
        ? namespaceOwnerBinding(node.expression)
        : undefined;
    }
    return ts.isIdentifier(node)
      ? bindings.resolveBinding(node, node.text)
      : undefined;
  };
  const markReactNamespaceMutation = (node: ts.Expression): void => {
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      node = node.expression;
    }
    if (
      !ts.isPropertyAccessExpression(node) &&
      !ts.isElementAccessExpression(node)
    )
      return;
    const property = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : node.argumentExpression
        ? bindings.staticString(node.argumentExpression)
        : undefined;
    if (property !== undefined && property !== "useCallback") return;
    const owner = namespaceOwnerBinding(node.expression);
    if (owner) mutatedReactNamespaceBindings.add(owner);
  };
  function collect(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const binding = bindings.resolveBinding(node.name, node.name.text);
      if (binding) functionBindings.add(binding);
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "react" &&
      node.importClause
    ) {
      if (node.importClause.name) {
        const binding = bindings.resolveBinding(
          node.importClause.name,
          node.importClause.name.text,
        );
        if (binding) reactNamespaceBindings.add(binding);
      }
      const named = node.importClause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        const binding = bindings.resolveBinding(named.name, named.name.text);
        if (binding) reactNamespaceBindings.add(binding);
      } else if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if ((element.propertyName ?? element.name).text !== "useCallback")
            continue;
          const binding = bindings.resolveBinding(
            element.name,
            element.name.text,
          );
          if (binding) reactCallbackBindings.add(binding);
        }
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      addProjectedCallableSources(node.name, node.initializer);
      const factoryBinding = bundledReactFactory(node.initializer);
      if (factoryBinding && ts.isIdentifier(node.name)) {
        const binding = bindings.resolveBinding(node.name, node.name.text);
        if (binding) {
          reactNamespaceBindings.add(binding);
          reactNamespaceFactoryBindings.set(binding, factoryBinding);
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)
    ) {
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        addAssignedCallableSources(node.left, node.right);
        if (ts.isIdentifier(node.left)) {
          const binding = bindings.resolveBinding(node.left, node.left.text);
          if (binding) mutatedReactNamespaceBindings.add(binding);
        } else {
          markUncertainTarget(node.left);
        }
      } else {
        markUncertainTarget(node.left);
      }
      markReactNamespaceMutation(node.left);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) && callee.argumentExpression
          ? bindings.staticString(callee.argumentExpression)
          : undefined;
      const calleeOwner =
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)
          ? callee.expression
          : undefined;
      const unboundOwner =
        calleeOwner &&
        ts.isIdentifier(calleeOwner) &&
        !bindings.resolveBinding(calleeOwner, calleeOwner.text)
          ? calleeOwner.text
          : undefined;
      const target = node.arguments[0];
      const targetBinding =
        target && !ts.isSpreadElement(target)
          ? namespaceOwnerBinding(target)
          : undefined;
      const knownMutation =
        (method === "defineProperty" &&
          ["Object", "Reflect"].includes(unboundOwner ?? "")) ||
        (unboundOwner === "Reflect" && method === "set") ||
        (unboundOwner === "Object" &&
          ["assign", "defineProperties"].includes(method ?? "")) ||
        (method === "setPrototypeOf" &&
          ["Object", "Reflect"].includes(unboundOwner ?? ""));
      let mutatesHook = false;
      if (
        targetBinding &&
        ((["Object", "Reflect"].includes(unboundOwner ?? "") &&
          method === "defineProperty") ||
          (unboundOwner === "Reflect" && method === "set"))
      ) {
        const property = node.arguments[1];
        mutatesHook =
          !property ||
          ts.isSpreadElement(property) ||
          [undefined, "useCallback"].includes(bindings.staticString(property));
      } else if (
        targetBinding &&
        unboundOwner === "Object" &&
        ["assign", "defineProperties"].includes(method ?? "")
      ) {
        mutatesHook = node.arguments.slice(1).some((argument) => {
          if (
            ts.isSpreadElement(argument) ||
            !ts.isObjectLiteralExpression(argument)
          ) {
            return true;
          }
          return argument.properties.some((property) => {
            if (ts.isSpreadAssignment(property)) return true;
            const name = property.name;
            if (!name) return true;
            const propertyName = ts.isComputedPropertyName(name)
              ? bindings.staticString(name.expression)
              : ts.isIdentifier(name) ||
                  ts.isStringLiteralLike(name) ||
                  ts.isNumericLiteral(name)
                ? name.text
                : undefined;
            return propertyName === undefined || propertyName === "useCallback";
          });
        });
      } else if (
        targetBinding &&
        method === "setPrototypeOf" &&
        ["Object", "Reflect"].includes(unboundOwner ?? "")
      ) {
        mutatesHook = true;
      }
      if (targetBinding && mutatesHook) {
        mutatedReactNamespaceBindings.add(targetBinding);
      }
      if (!knownMutation) {
        for (const argument of node.arguments) {
          if (ts.isSpreadElement(argument)) continue;
          const argumentBinding = namespaceOwnerBinding(argument);
          if (argumentBinding)
            opaqueReactNamespaceCallArguments.add(argumentBinding);
        }
      }
    }
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      if (ts.isVariableDeclarationList(node.initializer)) {
        for (const declaration of node.initializer.declarations) {
          markUncertainTarget(declaration.name);
        }
      } else {
        markUncertainTarget(node.initializer);
      }
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
        node.operator,
      )
    ) {
      markUncertainTarget(node.operand);
    }
    if (
      ts.isDeleteExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression))
    ) {
      markReactNamespaceMutation(node.expression);
    }
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
  const identifierBinding = (
    source: ts.Expression,
  ): AliasBinding | undefined => {
    while (
      ts.isParenthesizedExpression(source) ||
      ts.isAsExpression(source) ||
      ts.isTypeAssertionExpression(source) ||
      ts.isNonNullExpression(source) ||
      ts.isSatisfiesExpression(source)
    ) {
      source = source.expression;
    }
    if (
      ts.isPropertyAccessExpression(source) ||
      ts.isElementAccessExpression(source)
    ) {
      const property = ts.isPropertyAccessExpression(source)
        ? source.name.text
        : source.argumentExpression
          ? bindings.staticString(source.argumentExpression)
          : undefined;
      return property === "default"
        ? identifierBinding(source.expression)
        : undefined;
    }
    return ts.isIdentifier(source)
      ? bindings.resolveBinding(source, source.text)
      : undefined;
  };
  const namespaceAliases = new Map<AliasBinding, Set<AliasBinding>>();
  for (const [target, sources] of callableSources) {
    for (const source of sources) {
      const sourceBinding = identifierBinding(source);
      if (!sourceBinding) continue;
      const targetAliases =
        namespaceAliases.get(target) ?? new Set<AliasBinding>();
      targetAliases.add(sourceBinding);
      namespaceAliases.set(target, targetAliases);
      const sourceAliases =
        namespaceAliases.get(sourceBinding) ?? new Set<AliasBinding>();
      sourceAliases.add(target);
      namespaceAliases.set(sourceBinding, sourceAliases);
    }
  }
  const pendingNamespaces = [...reactNamespaceBindings];
  while (pendingNamespaces.length > 0) {
    const binding = pendingNamespaces.pop()!;
    for (const alias of namespaceAliases.get(binding) ?? []) {
      if (reactNamespaceBindings.has(alias)) continue;
      reactNamespaceBindings.add(alias);
      pendingNamespaces.push(alias);
    }
  }
  for (const binding of opaqueReactNamespaceCallArguments) {
    if (reactNamespaceBindings.has(binding))
      mutatedReactNamespaceBindings.add(binding);
  }
  const propagateInvalidNamespaces = (): void => {
    const invalidNamespaces = [...mutatedReactNamespaceBindings].filter(
      (binding) => reactNamespaceBindings.has(binding),
    );
    while (invalidNamespaces.length > 0) {
      const binding = invalidNamespaces.pop()!;
      for (const alias of namespaceAliases.get(binding) ?? []) {
        if (
          !reactNamespaceBindings.has(alias) ||
          mutatedReactNamespaceBindings.has(alias)
        ) {
          continue;
        }
        mutatedReactNamespaceBindings.add(alias);
        invalidNamespaces.push(alias);
      }
    }
  };
  propagateInvalidNamespaces();
  const taintedFactories = new Set(
    [...reactNamespaceFactoryBindings]
      .filter(([namespace]) => mutatedReactNamespaceBindings.has(namespace))
      .map(([, factory]) => factory),
  );
  for (const [namespace, factory] of reactNamespaceFactoryBindings) {
    if (taintedFactories.has(factory))
      mutatedReactNamespaceBindings.add(namespace);
  }
  propagateInvalidNamespaces();
  return {
    constants,
    callableSources,
    functionBindings,
    uncertainCallableBindings,
    reactCallbackBindings,
    reactNamespaceBindings,
    mutatedReactNamespaceBindings,
    resolveBinding: bindings.resolveBinding,
  };
}

function staticallyCallable(
  node: ts.Expression,
  analysis: ScopedStaticStrings,
  resolving: ReadonlySet<AliasBinding> = new Set(),
): boolean {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return staticallyCallable(node.expression, analysis, resolving);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
  if (ts.isConditionalExpression(node)) {
    return (
      staticallyCallable(node.whenTrue, analysis, resolving) &&
      staticallyCallable(node.whenFalse, analysis, resolving)
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.CommaToken ||
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
  ) {
    return staticallyCallable(node.right, analysis, resolving);
  }
  if (ts.isIdentifier(node)) {
    const binding = analysis.resolveBinding(node, node.text);
    if (!binding || resolving.has(binding)) return false;
    if (analysis.uncertainCallableBindings.has(binding)) return false;
    const sources = analysis.callableSources.get(binding);
    if (
      analysis.functionBindings.has(binding) &&
      (!sources || sources.length === 0)
    ) {
      return true;
    }
    if (!sources || sources.length === 0) return false;
    const next = new Set(resolving).add(binding);
    return sources.every((source) =>
      staticallyCallable(source, analysis, next),
    );
  }
  if (!ts.isCallExpression(node)) return false;
  let callee: ts.Expression = node.expression;
  while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
  if (
    ts.isBinaryExpression(callee) &&
    callee.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    callee = callee.right;
  }
  if (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    (ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : callee.argumentExpression
        ? staticString(callee.argumentExpression)
        : undefined) === "bind"
  ) {
    return staticallyCallable(callee.expression, analysis, resolving);
  }
  const first = node.arguments[0];
  if (!first) return false;
  if (ts.isIdentifier(callee)) {
    const binding = analysis.resolveBinding(callee, callee.text);
    return Boolean(
      binding &&
      analysis.reactCallbackBindings.has(binding) &&
      !analysis.uncertainCallableBindings.has(binding) &&
      staticallyCallable(first, analysis, resolving),
    );
  }
  if (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "useCallback"
  ) {
    const owner = ts.isIdentifier(callee.expression)
      ? analysis.resolveBinding(callee.expression, callee.expression.text)
      : undefined;
    return Boolean(
      owner &&
      analysis.reactNamespaceBindings.has(owner) &&
      !analysis.mutatedReactNamespaceBindings.has(owner) &&
      staticallyCallable(first, analysis, resolving),
    );
  }
  return false;
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
    return left === undefined || right === undefined
      ? undefined
      : `${left}${right}`;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = scopedStaticString(
        span.expression,
        analysis,
        resolving,
      );
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
    const separator =
      node.arguments.length === 0
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

const NAVIGATION_PROPERTIES = new Set(["action", "formAction", "href"]);

type NavigationElementAnalysis = {
  isNavigationElement(node: ts.Expression): boolean;
};

function collectNavigationElements(
  root: ts.Node,
  aliases: BrowserAliasAnalysis,
  staticStrings: ScopedStaticStrings,
): NavigationElementAnalysis {
  const elements = new Set<AliasBinding>();
  const relations: Array<[AliasBinding, AliasBinding]> = [];
  const createdNavigationElement = (expression: ts.Expression): boolean => {
    while (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      expression = expression.expression;
    }
    if (
      !ts.isCallExpression(expression) ||
      (!ts.isPropertyAccessExpression(expression.expression) &&
        !ts.isElementAccessExpression(expression.expression))
    ) {
      return false;
    }
    const callee = expression.expression;
    const method = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : callee.argumentExpression
        ? scopedStaticString(callee.argumentExpression, staticStrings)
        : undefined;
    const owner = privilegedBrowserGlobal(callee.expression, aliases);
    const tagIndex =
      method === "createElement" ? 0 : method === "createElementNS" ? 1 : -1;
    const tag =
      tagIndex >= 0 && expression.arguments[tagIndex]
        ? scopedStaticString(
            expression.arguments[tagIndex],
            staticStrings,
          )?.toLowerCase()
        : undefined;
    return owner === "document" && ["a", "form"].includes(tag ?? "");
  };
  const inspect = (node: ts.Node): void => {
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
      const targetBinding = aliases.resolveBinding(target, target.text);
      if (targetBinding) {
        if (createdNavigationElement(source)) elements.add(targetBinding);
        if (ts.isIdentifier(source)) {
          const sourceBinding = aliases.resolveBinding(source, source.text);
          if (sourceBinding) relations.push([targetBinding, sourceBinding]);
        }
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(root);
  const targetsBySource = new Map<AliasBinding, AliasBinding[]>();
  for (const [target, source] of relations) {
    const targets = targetsBySource.get(source) ?? [];
    targets.push(target);
    targetsBySource.set(source, targets);
  }
  const pending = [...elements];
  while (pending.length > 0) {
    const source = pending.pop()!;
    for (const target of targetsBySource.get(source) ?? []) {
      if (elements.has(target)) continue;
      elements.add(target);
      pending.push(target);
    }
  }
  return {
    isNavigationElement(node) {
      if (createdNavigationElement(node)) return true;
      if (!ts.isIdentifier(node)) return false;
      const binding = aliases.resolveBinding(node, node.text);
      return binding !== undefined && elements.has(binding);
    },
  };
}

function runtimeNavigationSink(
  node: ts.Node,
  staticStrings: ScopedStaticStrings,
  navigationElements: NavigationElementAnalysis,
): string | undefined {
  const propertyName = (name: ts.PropertyName): string | undefined => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    return ts.isComputedPropertyName(name)
      ? scopedStaticString(name.expression, staticStrings)
      : undefined;
  };
  if (ts.isPropertyAssignment(node)) {
    const property = propertyName(node.name);
    if (["formAction", "href"].includes(property ?? ""))
      return `navigation ${property}`;
  }
  if (
    ts.isShorthandPropertyAssignment(node) &&
    ["formAction", "href"].includes(node.name.text)
  ) {
    return `navigation ${node.name.text}`;
  }
  if (
    ts.isBinaryExpression(node) &&
    isValuePropagatingAssignment(node.operatorToken.kind) &&
    (ts.isPropertyAccessExpression(node.left) ||
      ts.isElementAccessExpression(node.left))
  ) {
    const property = ts.isPropertyAccessExpression(node.left)
      ? node.left.name.text
      : node.left.argumentExpression
        ? scopedStaticString(node.left.argumentExpression, staticStrings)
        : undefined;
    if (NAVIGATION_PROPERTIES.has(property ?? ""))
      return `navigation ${property}`;
  }
  if (
    ts.isCallExpression(node) &&
    (ts.isPropertyAccessExpression(node.expression) ||
      ts.isElementAccessExpression(node.expression))
  ) {
    const method = ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : node.expression.argumentExpression
        ? scopedStaticString(node.expression.argumentExpression, staticStrings)
        : undefined;
    const target = node.expression.expression;
    const knownNavigationTarget =
      navigationElements.isNavigationElement(target);
    if (["click", "requestSubmit", "submit"].includes(method ?? "")) {
      return `navigation ${method}`;
    }
    if (method === "setAttribute" && node.arguments[0]) {
      const property = scopedStaticString(node.arguments[0], staticStrings);
      if (NAVIGATION_PROPERTIES.has(property ?? ""))
        return `navigation ${property}`;
      if (knownNavigationTarget && property === undefined)
        return "navigation dynamic attribute";
    }
    if (method === "setAttributeNS" && node.arguments[1]) {
      const property = scopedStaticString(node.arguments[1], staticStrings);
      if (NAVIGATION_PROPERTIES.has(property ?? ""))
        return `navigation ${property}`;
      if (knownNavigationTarget && property === undefined)
        return "navigation dynamic attribute";
    }
  }
  if (ts.isCallExpression(node)) {
    const first = node.arguments[0]
      ? scopedStaticString(node.arguments[0], staticStrings)
      : undefined;
    if (["a", "form"].includes(first ?? "") && node.arguments[1]) {
      return `navigation ${first} element props`;
    }
    const callee = ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : ts.isElementAccessExpression(node.expression) &&
          node.expression.argumentExpression
        ? scopedStaticString(node.expression.argumentExpression, staticStrings)
        : undefined;
    const target = node.arguments[0];
    if (
      target &&
      navigationElements.isNavigationElement(target) &&
      ["assign", "defineProperties"].includes(callee ?? "")
    ) {
      return "navigation dynamic properties";
    }
    const keyIndex = callee === "defineProperty" || callee === "set" ? 1 : -1;
    if (keyIndex >= 0 && node.arguments[keyIndex]) {
      const property = scopedStaticString(
        node.arguments[keyIndex],
        staticStrings,
      );
      if (NAVIGATION_PROPERTIES.has(property ?? ""))
        return `navigation ${property}`;
      if (
        target &&
        navigationElements.isNavigationElement(target) &&
        property === undefined
      ) {
        return "navigation dynamic property";
      }
    }
  }
  if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
    const property = node.name.text;
    if (NAVIGATION_PROPERTIES.has(property)) return `navigation ${property}`;
  }
  if (ts.isJsxSpreadAttribute(node)) {
    const owner = node.parent.parent;
    if (
      (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) &&
      ts.isIdentifier(owner.tagName) &&
      ["a", "form"].includes(owner.tagName.text)
    ) {
      return `navigation ${owner.tagName.text} spread`;
    }
  }
  return undefined;
}

function containsPrivilegedBrowserGlobal(
  node: ts.Expression,
  analysis: BrowserAliasAnalysis,
  directOnly = false,
): boolean {
  const browserGlobal = directOnly
    ? directBrowserGlobal
    : privilegedBrowserGlobal;
  if (browserGlobal(node, analysis) !== undefined) return true;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) =>
      ts.isSpreadElement(element)
        ? containsPrivilegedBrowserGlobal(
            element.expression,
            analysis,
            directOnly,
          )
        : containsPrivilegedBrowserGlobal(
            element as ts.Expression,
            analysis,
            directOnly,
          ),
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return containsPrivilegedBrowserGlobal(
          property.expression,
          analysis,
          directOnly,
        );
      }
      if (ts.isPropertyAssignment(property)) {
        return containsPrivilegedBrowserGlobal(
          property.initializer,
          analysis,
          directOnly,
        );
      }
      return (
        ts.isShorthandPropertyAssignment(property) &&
        browserGlobal(property.name, analysis) !== undefined
      );
    });
  }
  return false;
}

function browserGlobalEscapes(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
  directOnly = false,
  allowAnalyzedLocalFlows = false,
  staticStrings?: ScopedStaticStrings,
): boolean {
  const browserGlobal = directOnly
    ? directBrowserGlobal
    : privilegedBrowserGlobal;
  const contains = (expression: ts.Expression): boolean =>
    containsPrivilegedBrowserGlobal(expression, analysis, directOnly) ||
    (allowAnalyzedLocalFlows &&
      !directOnly &&
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
    if (
      ts.isCallExpression(node) &&
      staticStrings &&
      isSafeInternalGlobalDescriptorCall(node, analysis, staticStrings)
    ) {
      return false;
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
        ),
      );
    }
    if (
      (node.arguments ?? []).some((argument) =>
        analysis.containsDeferredTrackedBrowserObject(
          ts.isSpreadElement(argument) ? argument.expression : argument,
        ),
      )
    ) {
      return true;
    }
    return (node.arguments ?? []).some((argument) =>
      ts.isSpreadElement(argument)
        ? contains(argument.expression)
        : contains(argument),
    );
  }
  if (ts.isReturnStatement(node) && node.expression) {
    if (allowAnalyzedLocalFlows && analysis.localFunctionReturns.has(node))
      return false;
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
    if (allowAnalyzedLocalFlows && analysis.localFunctionReturns.has(node))
      return false;
    return true;
  }
  if (ts.isParameter(node) && node.initializer) {
    return contains(node.initializer);
  }
  if (ts.isPropertyDeclaration(node) && node.initializer) {
    return contains(node.initializer);
  }
  if (ts.isTaggedTemplateExpression(node)) {
    return (
      ts.isTemplateExpression(node.template) &&
      node.template.templateSpans.some((span) => contains(span.expression))
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
    if (
      allowAnalyzedLocalFlows &&
      analysis.isInertEventTargetAssignment(node)
    ) {
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

const INTERNAL_RUNTIME_GLOBAL_KEYS = new Set<string>([
  "__humanPlayerSide",
  "__pendingActionExpansion",
  "__pendingChainContinuation",
  "__pendingChooseInterceptResume",
  "__pendingChooseInterceptSide",
  "__pendingContactStartAxId",
  "__pendingDeckPlaceSide",
  "__pendingDeckReorderSide",
  "__pendingDeckRevealSide",
  "__pendingEffectChoiceResume",
  "__pendingEffectChoiceSide",
  "__pendingEffectOptionalBindings",
  "__pendingEffectOptionalContinuation",
  "__pendingEffectOptionalCostPaid",
  "__pendingEffectOptionalResume",
  "__pendingEffectOptionalSide",
  "__pendingEffectPickQueue",
  "__pendingEffectPickSide",
  "__pendingEffectRepeatOptionalResume",
  "__pendingEffectRepeatOptionalSide",
  "__pendingHirameki",
  "__pendingMisread",
  "__pendingPublicHandRevealSide",
  "__pendingRpsBindings",
  "__pendingRpsContinuation",
  "__pendingRpsResume",
  "__pendingRpsSide",
  "__pendingRuntimeStateMarker",
  "__pendingSetCardChoiceBindings",
  "__pendingSetCardChoiceContinuation",
  "__pendingSetCardChoiceGuard",
  "__pendingSetCardChoiceResume",
  "__pendingSetCardChoiceSide",
  "__pendingSetCardReplacementGuard",
  "__pendingSetCardReplacementSide",
]);

function isSafeInternalGlobalDescriptorCall(
  node: ts.CallExpression,
  analysis: BrowserAliasAnalysis,
  staticStrings: ScopedStaticStrings,
): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const owner = node.expression.expression;
  if (
    !ts.isIdentifier(owner) ||
    owner.text !== "Object" ||
    analysis.resolveBinding(owner, owner.text)
  ) {
    return false;
  }
  const method = node.expression.name.text;
  if (!["defineProperty", "getOwnPropertyDescriptor"].includes(method))
    return false;
  const target = node.arguments[0];
  const property = node.arguments[1];
  if (
    !target ||
    !property ||
    privilegedBrowserGlobal(target, analysis) === undefined ||
    !INTERNAL_RUNTIME_GLOBAL_KEYS.has(
      scopedStaticString(property, staticStrings) ?? "",
    )
  ) {
    return false;
  }
  if (method === "getOwnPropertyDescriptor") return node.arguments.length === 2;
  const descriptor = node.arguments[2];
  return (
    node.arguments.length === 3 &&
    descriptor !== undefined &&
    !containsPrivilegedBrowserGlobal(descriptor, analysis)
  );
}

function reflectBrowserGlobalCall(
  node: ts.Node,
  analysis: BrowserAliasAnalysis,
): string | undefined {
  if (!ts.isCallExpression(node) || node.arguments.length === 0)
    return undefined;
  const expression = node.expression;
  const reflectIdentifier =
    ts.isPropertyAccessExpression(expression) ||
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
  const method =
    ts.isPropertyAccessExpression(expression) &&
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
  if (
    !details.some((detail) => /^https?:/i.test(detail)) &&
    /https?:\/\//i.test(value)
  ) {
    details.push("constructed absolute URL");
  }
  for (const match of value.matchAll(
    /(?:^|[^:])(\/\/(?:[a-z0-9-]+\.)+[a-z0-9-]+(?::\d+)?(?:\/[^\s"'`)<>,]*)?)/gi,
  )) {
    details.push(match[1]!.slice(0, 512));
  }
  if (
    !details.some((detail) => detail.startsWith("//")) &&
    /(?:^|[^:])\/\/[^/\s]/.test(value)
  ) {
    details.push("constructed protocol-relative URL");
  }
  return details;
}

function allowedRemote(file: string, detail: string): boolean {
  if (
    NON_NETWORK_REFERENCES.some((reference) => detail.startsWith(reference))
  ) {
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
    ["https://www.takaratomy.co.jp", "https://www.takaratomy.co.jp;"].includes(
      detail,
    )
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

function scanStyle(
  root: string,
  absolute: string,
  source: string,
): RuntimeBoundaryFinding[] {
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
      return point === 0 || point > 0x10ffff
        ? "\uFFFD"
        : String.fromCodePoint(point);
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
    return (
      new URL(
        value,
        "https://private-hosted.invalid/",
      ).protocol.toLowerCase() === "javascript:"
    );
  } catch {
    let offset = 0;
    while (offset < value.length && value.charCodeAt(offset) <= 0x20)
      offset += 1;
    return value.slice(offset).toLowerCase().startsWith("javascript:");
  }
}

function scanHtml(
  root: string,
  absolute: string,
  source: string,
): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  inspectRemoteText(findings, file, source);
  for (const match of source.matchAll(/\s(on[a-z][a-z0-9_-]*)\s*=/gi)) {
    addFinding(findings, file, "html-execution", match[1]!.toLowerCase());
  }
  if (
    /\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(source)
  ) {
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
      const css = (node.childNodes ?? [])
        .map((child) => child.value ?? "")
        .join("");
      inspectInlineStyle(findings, file, css, "stylesheet");
    }
    if (node.content) pending.push(node.content);
    pending.push(...(node.childNodes ?? []));
  }
  return findings;
}

function scanSvg(
  root: string,
  absolute: string,
  source: string,
): RuntimeBoundaryFinding[] {
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

function scanData(
  root: string,
  absolute: string,
  source: string,
): RuntimeBoundaryFinding[] {
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
  trustedBundleImports?: {
    vendor: ReadonlySet<string>;
    runtime: ReadonlySet<string>;
  },
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
  for (const limitation of privilegedAliases.limitations) {
    addFinding(findings, file, "forbidden-bundle-marker", limitation);
  }
  if (
    privilegedAliases.limitations.has(
      "dynamic property candidate shared budget exceeded",
    )
  ) {
    return findings;
  }
  const staticStrings = collectScopedStaticStrings(
    parsed,
    privilegedAliases,
    trustedBundleImports,
  );
  const navigationElements = collectNavigationElements(
    parsed,
    privilegedAliases,
    staticStrings,
  );
  function visit(node: ts.Node): void {
    const dynamicCode = isDynamicCodeExecution(
      node,
      privilegedAliases,
      true,
      staticStrings,
    );
    if (dynamicCode) {
      addFinding(
        findings,
        file,
        "forbidden-bundle-marker",
        "dynamic code execution",
      );
    }
    const navigation = runtimeNavigationSink(
      node,
      staticStrings,
      navigationElements,
    );
    if (navigation) {
      addFinding(findings, file, "forbidden-bundle-marker", navigation);
    }
    const reflection = reflectBrowserGlobalCall(node, privilegedAliases);
    if (reflection) {
      addFinding(
        findings,
        file,
        "forbidden-bundle-marker",
        "browser global reflection",
      );
    } else {
      const escapes = browserGlobalEscapes(
        node,
        privilegedAliases,
        false,
        true,
        staticStrings,
      );
      if (escapes) {
        addFinding(
          findings,
          file,
          "forbidden-bundle-marker",
          "browser global escape",
        );
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      privilegedBrowserGlobal(node.expression, privilegedAliases) !== undefined
    ) {
      const browserGlobal = privilegedBrowserGlobal(
        node.expression,
        privilegedAliases,
      )!;
      const property = scopedStaticString(
        node.argumentExpression,
        staticStrings,
      );
      if (property === undefined) {
        addFinding(
          findings,
          file,
          "forbidden-bundle-marker",
          "dynamic browser property",
        );
      } else if (PERSISTENT_BROWSER_PROPERTIES.has(property)) {
        const detail =
          browserGlobal === "document" && property === "cookie"
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
      const browserGlobal = privilegedBrowserGlobal(
        node.expression,
        privilegedAliases,
      )!;
      const property = node.name.text;
      if (PERSISTENT_BROWSER_PROPERTIES.has(property)) {
        const detail =
          browserGlobal === "document" && property === "cookie"
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
        addFinding(
          findings,
          file,
          "forbidden-bundle-marker",
          "persistent storage",
        );
      }
    }
    if (ts.isNewExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
        NETWORK_BROWSER_PROPERTIES.has(node.expression.text)
      ) {
        addFinding(
          findings,
          file,
          "forbidden-bundle-marker",
          "network constructor",
        );
      } else if (
        (ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)) &&
        privilegedBrowserGlobal(
          node.expression.expression,
          privilegedAliases,
        ) !== undefined
      ) {
        const constructor = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : node.expression.argumentExpression
            ? scopedStaticString(
                node.expression.argumentExpression,
                staticStrings,
              )
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
      const evaluated = scopedStaticString(
        node as ts.Expression,
        staticStrings,
      );
      if (evaluated !== undefined) {
        inspectRemoteText(findings, file, evaluated);
        inspectRuntimeCssText(findings, file, evaluated);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  for (const limitation of privilegedAliases.limitations) {
    addFinding(findings, file, "forbidden-bundle-marker", limitation);
  }
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

const REVIEWED_META_RUNTIME_STYLE_SHA256 = new Map<string, string>([
  [
    "meta-app/src/MetaShell.tsx",
    "ba32d81351d6df7808bbf4094c2876083bc3163ea48176e03e6018d7580c5d2c",
  ],
  [
    "meta-app/src/screens/CardsScreen.tsx",
    "02b7d5c533d0db02984307f003650e389f0d98b46647ca38a27a64ad721e94f8",
  ],
  [
    "meta-app/src/screens/DeckEditor.tsx",
    "07f749c44178122de0a64810cbe5c36ca6557c0eb59b2d279ba812571a4749da",
  ],
  [
    "meta-app/src/screens/HistoryScreen.tsx",
    "ac07d07e217cf1d609cddc830b7cc311730b9d7146d8087f9b671c545e5be1da",
  ],
  [
    "meta-app/src/screens/SettingsScreen.tsx",
    "f87bb34760329f6d1a968f9aaf4dfe183b95f9c401b220dace8520bc4dfaff67",
  ],
  [
    "meta-app/src/screens/tutorial/AnnotatedCard.tsx",
    "948bbbfabef3a60ef08d01c9c0904a3d482b667d132231e5917c84e481db122a",
  ],
  [
    "meta-app/src/screens/tutorial/illustrations.tsx",
    "f7ffbf2c728089ea92f96a4dfca22d34bb8f2fcff09099e14665f9853c0df52f",
  ],
  [
    "meta-app/src/screens/tutorial/TutorialBoardSnapshot.tsx",
    "4adfb9e41a00b41ab6953df6f84f999baa4ef502ce90ec1e867b67f5389729de",
  ],
  [
    "meta-app/src/screens/tutorial/TutorialLessonViewer.tsx",
    "52507554f4cb72df3d2a0aed371e9038a33835a7340ecef1a844b7d37db3227b",
  ],
  [
    "meta-app/src/screens/TutorialScreen.tsx",
    "addaa81b623a9ff706785cf53599a2d6b304d81381fa70be71d7ca9d9bed7876",
  ],
  [
    "meta-app/src/shared/Button.tsx",
    "5cc96bc2e98fe67c48fb6cb732e6dbd767570636a7466361a87e1cedbbcc8ffe",
  ],
  [
    "meta-app/src/shared/EmptyState.tsx",
    "62be31a05fdcd7bbabb9558408926ff8763965f67549c645cb8da8aafa461922",
  ],
  [
    "meta-app/src/shared/FilterGroup.tsx",
    "11b0ef95d143ec5894d2ac92586a3cf3a8452c4e8b077c77c7bbb32056aaf2d9",
  ],
  [
    "meta-app/src/shared/FilterRail.tsx",
    "63fcbedcea4b8b783c48979d29f711fe8e785618af0b9e1f64c334171c6cbdf5",
  ],
  [
    "meta-app/src/shared/HelpOverlay.tsx",
    "7ef2cf5119519b5972a8e64761361c8f216d311c3335ae5cb86b757c4ce24a48",
  ],
  [
    "meta-app/src/shared/MetaBg.tsx",
    "4b2cd348723070c6c4890aaa7f3f30529f3d60f3c029d0735a9d42b4919caaac",
  ],
  [
    "meta-app/src/shared/MetaCard.tsx",
    "0f83823383576e86b6f19c3d77add833f1450ddc5823076a49812c6dc2f93066",
  ],
  [
    "meta-app/src/shared/WarningBanner.tsx",
    "eeef3220d56fcc522bb338272a26d031f044cab821fccfc97ecf62b1f2487a57",
  ],
]);

const REVIEWED_META_CAPABILITIES = new Map<
  string,
  {
    sha256: string;
    allowed: ReadonlySet<string>;
  }
>([
  [
    "meta-app/src/router/useHashRoute.ts",
    {
      sha256:
        "874d0ea80b87b819a24d3aedfaae06f57db79ac730c731250efac7892ae14f11",
      allowed: new Set([
        "network-api:window.location",
        "persistent-storage:history",
      ]),
    },
  ],
  [
    "meta-app/src/screens/DeckEditor.tsx",
    {
      sha256:
        "07f749c44178122de0a64810cbe5c36ca6557c0eb59b2d279ba812571a4749da",
      allowed: new Set(["persistent-storage:clipboard"]),
    },
  ],
  [
    "meta-app/src/screens/HistoryDeckDialog.tsx",
    {
      sha256:
        "e8fc82438471de4efd0d71d3af32312ff05e3283a8826b314683180159762d18",
      allowed: new Set(["persistent-storage:clipboard"]),
    },
  ],
  [
    "meta-app/src/screens/HistoryScreen.tsx",
    {
      sha256:
        "ac07d07e217cf1d609cddc830b7cc311730b9d7146d8087f9b671c545e5be1da",
      allowed: new Set(["network-api:window.location"]),
    },
  ],
  [
    "meta-app/src/screens/HomeScreen.tsx",
    {
      sha256:
        "9b12d8d352f7e45e75870a10f7f0b3eff629c60ec8cf2575fed4fddf497a26e2",
      allowed: new Set([
        "external-origin:https://www.takaratomy.co.jp/products/conan-cardgame/",
        "network-api:navigation href",
      ]),
    },
  ],
  [
    "meta-app/src/screens/ReplayScreen.tsx",
    {
      sha256:
        "17dc6c41a3ed0f2ad0e66cba1c131566c219851e53a8d891bb3686964a8f2597",
      allowed: new Set(["network-api:window.location"]),
    },
  ],
  [
    "meta-app/src/screens/ResultScreen.tsx",
    {
      sha256:
        "f134ad6095315b5f651a807f7bca2dfd8657a8c9e68f25c4b4d71d80c6314760",
      allowed: new Set(["network-api:window.location"]),
    },
  ],
  [
    "meta-app/src/services/historyReplayRepository.ts",
    {
      sha256:
        "f2cb308b3f512500a75ea04d6811db45cc59ebd51d09dcbe72015618cfd7dd73",
      allowed: new Set(["persistent-storage:indexedDB"]),
    },
  ],
  [
    "meta-app/src/services/replayReturnFocus.ts",
    {
      sha256:
        "ce13711286f86053a4b87302dba4d80e5b103c5904138fdba1f2aa155c726927",
      allowed: new Set(["persistent-storage:sessionStorage"]),
    },
  ],
  [
    "meta-app/src/services/officialNews.ts",
    {
      sha256:
        "6f58451acf1760cce78f3a42c51d26b7ea3008ffae7a308af3c5eac74241bf7b",
      allowed: new Set([
        "external-origin:https://www.takaratomy.co.jp/products/conan-cardgame/",
        "network-api:fetch",
        "network-api:URL",
        "persistent-storage:localStorage",
      ]),
    },
  ],
]);

const REVIEWED_PERSIST_STORES = new Map<
  string,
  { name: string; sha256: string }
>([
  [
    "meta-app/src/state/metaStore.ts",
    {
      name: "conan.meta.v1.settings",
      sha256:
        "6718fcd8097a57fe5de39989972ef745e68733606c1ff783f4979970e53ee25c",
    },
  ],
  [
    "meta-app/src/state/decksStore.ts",
    {
      name: "conan.meta.v1.decks",
      sha256:
        "6f31d779c943eaea02baa2f58ed0dac6591a67c0e5d66e9bbc0d752ef2a251ca",
    },
  ],
  [
    "meta-app/src/state/filtersStore.ts",
    {
      name: "conan.meta.v1.filters",
      sha256:
        "77ad828b075d9cd3ecdd05ab4b7aff855cdddc7be4d63a67b3a74e239a8525a2",
    },
  ],
  [
    "meta-app/src/state/historyStore.ts",
    {
      name: "conan.meta.v1.history",
      sha256:
        "8c96f82f59c60c601651f63a2925166a1c50b99a503a04e269c21416b72d8228",
    },
  ],
]);

function sha256Text(sourceText: string): string {
  return createHash("sha256")
    .update(sourceText.replace(/\r\n?/g, "\n"), "utf8")
    .digest("hex");
}

function reviewedMetaSourceCapability(
  file: string,
  code: string,
  detail: string,
  sourceText: string,
): boolean {
  const sourceHash = sha256Text(sourceText);
  if (
    code === "runtime-style" &&
    REVIEWED_META_RUNTIME_STYLE_SHA256.get(file) === sourceHash
  ) {
    return true;
  }
  const review = REVIEWED_META_CAPABILITIES.get(file);
  return (
    review?.sha256 === sourceHash && review.allowed.has(`${code}:${detail}`)
  );
}

function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  if (
    ts.isComputedPropertyName(name) &&
    ts.isStringLiteralLike(name.expression)
  ) {
    return name.expression.text;
  }
  return undefined;
}

function inspectPersistContract(
  findings: RuntimeBoundaryFinding[],
  file: string,
  sourceFile: ts.SourceFile,
): void {
  const persistNames = new Set<string>();
  let unsupportedImport = false;
  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "zustand/middleware"
    ) {
      addFinding(
        findings,
        file,
        "persistent-store",
        "Zustand persist re-export is forbidden",
      );
      return;
    }
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "zustand/middleware"
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      unsupportedImport = true;
      continue;
    }
    for (const element of bindings.elements) {
      if ((element.propertyName?.text ?? element.name.text) === "persist") {
        persistNames.add(element.name.text);
      }
    }
  }
  let hasDynamicPersistImport = false;
  function inspectDynamicImport(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!) &&
      node.arguments[0]!.text === "zustand/middleware"
    ) {
      hasDynamicPersistImport = true;
      return;
    }
    ts.forEachChild(node, inspectDynamicImport);
  }
  inspectDynamicImport(sourceFile);
  if (hasDynamicPersistImport) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "dynamic Zustand persist import is forbidden",
    );
    return;
  }
  if (persistNames.size === 0 && !unsupportedImport) return;

  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      persistNames.has(node.expression.text)
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const review = REVIEWED_PERSIST_STORES.get(file);
  if (!review) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "unreviewed Zustand persist consumer",
    );
    return;
  }
  if (unsupportedImport || calls.length !== 1) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "persist import or call shape mismatch",
    );
    return;
  }
  const options = calls[0]!.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "literal persist options required",
    );
    return;
  }
  const properties = new Map<string, ts.ObjectLiteralElementLike>();
  for (const property of options.properties) {
    if (ts.isSpreadAssignment(property)) {
      addFinding(
        findings,
        file,
        "persistent-store",
        "spread persist options are forbidden",
      );
      return;
    }
    const name = staticPropertyName(property.name);
    if (name) properties.set(name, property);
  }
  const nameProperty = properties.get("name");
  const partialize = properties.get("partialize");
  const configuredName =
    nameProperty &&
    ts.isPropertyAssignment(nameProperty) &&
    ts.isStringLiteralLike(nameProperty.initializer)
      ? nameProperty.initializer.text
      : undefined;
  if (configuredName !== review.name) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "persist namespace mismatch",
    );
  }
  if (!partialize || !ts.isPropertyAssignment(partialize)) {
    addFinding(findings, file, "persistent-store", "partialize is required");
  }
  if (sha256Text(sourceFile.text) !== review.sha256) {
    addFinding(
      findings,
      file,
      "persistent-store",
      "reviewed store SHA-256 mismatch",
    );
  }
}

function scanSource(
  root: string,
  absolute: string,
  sourceFile: ts.SourceFile,
): RuntimeBoundaryFinding[] {
  const findings: RuntimeBoundaryFinding[] = [];
  const file = relative(root, absolute).replace(/\\/g, "/");
  inspectPersistContract(findings, file, sourceFile);
  if (NODE_HELPERS.has(file)) {
    addFinding(
      findings,
      file,
      "production-node-helper",
      "reachable from src/main.tsx",
    );
  }
  for (const specifier of importsFrom(sourceFile)) {
    if (/[?#]/.test(specifier)) {
      addFinding(findings, file, "unsupported-import", specifier);
    }
    if (specifier.startsWith("node:")) {
      addFinding(findings, file, "server-import", specifier);
    }
    if (/\bdist-meta\b/.test(specifier)) {
      addFinding(findings, file, "meta-build", specifier);
    }
  }
  const privilegedAliases = collectPrivilegedBrowserAliases(sourceFile);
  for (const limitation of privilegedAliases.limitations) {
    addFinding(findings, file, "analysis-limit", limitation);
  }
  if (
    privilegedAliases.limitations.has(
      "dynamic property candidate shared budget exceeded",
    )
  ) {
    return findings;
  }
  const staticStrings = collectScopedStaticStrings(
    sourceFile,
    privilegedAliases,
  );
  const navigationElements = collectNavigationElements(
    sourceFile,
    privilegedAliases,
    staticStrings,
  );
  const elementProperty = (
    node: ts.ElementAccessExpression,
  ): string | undefined =>
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
    if (!safeDynamicStyleProperties.has(property))
      runtimeStyleFinding(property);
  };
  const stylePropertyName = (name: ts.PropertyName): string | undefined => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name)
    ) {
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
      const binding = privilegedAliases.resolveBinding(
        expression,
        expression.text,
      );
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
    if (isDynamicCodeExecution(node, privilegedAliases, false, staticStrings)) {
      addFinding(findings, file, "dynamic-code-execution", "eval/Function");
    }
    const navigation = runtimeNavigationSink(
      node,
      staticStrings,
      navigationElements,
    );
    if (navigation) addFinding(findings, file, "network-api", navigation);
    const reflection = reflectBrowserGlobalCall(node, privilegedAliases);
    if (reflection) {
      addFinding(findings, file, "browser-global-reflection", reflection);
    } else if (
      browserGlobalEscapes(node, privilegedAliases, false, false, staticStrings)
    ) {
      addFinding(
        findings,
        file,
        "browser-global-escape",
        "privileged browser global",
      );
    }
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const browserGlobal = privilegedBrowserGlobal(
        node.expression,
        privilegedAliases,
      );
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
          const detail =
            browserGlobal === "document" && property === "cookie"
              ? "document.cookie"
              : browserGlobal === "navigator" && property === "storage"
                ? "navigator.storage"
                : property;
          addFinding(findings, file, "persistent-storage", detail);
        } else if (NETWORK_BROWSER_PROPERTIES.has(property)) {
          addFinding(
            findings,
            file,
            "network-api",
            `${browserGlobal}.${property}`,
          );
        } else if (property === "serviceWorker") {
          addFinding(
            findings,
            file,
            "service-worker",
            `${browserGlobal}.serviceWorker`,
          );
        }
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      privilegedBrowserGlobal(node.expression, privilegedAliases) !==
        undefined &&
      elementProperty(node) === undefined
    ) {
      const browserGlobal = privilegedBrowserGlobal(
        node.expression,
        privilegedAliases,
      )!;
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
        "location",
        "open",
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
      addFinding(
        findings,
        file,
        "network-api",
        `${node.expression.text}.fetch`,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      isUnboundRuntimeIdentifier(node.expression, privilegedAliases) &&
      ["globalThis", "window", "self"].includes(node.expression.text) &&
      elementProperty(node) === "fetch"
    ) {
      addFinding(
        findings,
        file,
        "network-api",
        `${node.expression.text}[fetch]`,
      );
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
        "BroadcastChannel",
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
      isUnboundRuntimeIdentifier(
        node.expression.expression,
        privilegedAliases,
      ) &&
      ["globalThis", "window", "self"].includes(node.expression.expression.text)
    ) {
      const constructor = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : elementProperty(node.expression);
      if (
        constructor &&
        [
          "BroadcastChannel",
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
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
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
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
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
        "history",
        "navigation",
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
        "history",
        "cookieStore",
        "openDatabase",
        "showOpenFilePicker",
        "showSaveFilePicker",
        "showDirectoryPicker",
      ].includes(elementProperty(node) ?? "")
    ) {
      addFinding(findings, file, "persistent-storage", elementProperty(node)!);
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
      if (
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        inspectStyleExpression(node.initializer.expression);
      } else if (node.initializer && ts.isStringLiteral(node.initializer)) {
        inspectInlineStyle(
          findings,
          file,
          node.initializer.text,
          "declaration-list",
        );
      } else {
        runtimeStyleFinding("unresolved style expression");
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) ||
        ts.isElementAccessExpression(node.left))
    ) {
      const owner = node.left.expression;
      if (styleContainer(owner)) {
        const property = ts.isPropertyAccessExpression(node.left)
          ? node.left.name.text
          : elementProperty(node.left);
        if (property === undefined)
          runtimeStyleFinding("dynamic style property");
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
      (ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const evaluated = scopedStaticString(
        node as ts.Expression,
        staticStrings,
      );
      if (evaluated !== undefined) {
        inspectRemoteText(findings, file, evaluated);
        inspectRuntimeCssText(findings, file, evaluated);
      } else if (ts.isTemplateExpression(node)) {
        const partial = `${node.head.text}${node.templateSpans.map((span) => span.literal.text).join("")}`;
        inspectRemoteText(findings, file, partial);
        inspectRuntimeCssText(findings, file, partial);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  for (const limitation of privilegedAliases.limitations) {
    addFinding(findings, file, "analysis-limit", limitation);
  }
  return findings.filter(
    ({ file: findingFile, code, detail }) =>
      !reviewedMetaSourceCapability(findingFile, code, detail, sourceFile.text),
  );
}

async function inspectBuild(
  root: string,
  output: { stdout: string; stderr: string },
): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const combined = `${output.stdout}\n${output.stderr}`;
  if (/externalized for browser compatibility/i.test(combined)) {
    addFinding(
      findings,
      "build",
      "browser-externalization",
      "browser externalization warning",
    );
  }
  if (/\bdist-meta\b/i.test(combined)) {
    addFinding(findings, "build", "meta-build", "alternate meta build output");
  }
  if (
    await stat(resolve(root, "dist-meta"))
      .then(() => true)
      .catch(() => false)
  ) {
    addFinding(
      findings,
      "dist-meta",
      "dist-meta",
      "forbidden output directory exists",
    );
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
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid");
    manifest = parsed as Record<string, ManifestEntry>;
  } catch {
    addFinding(
      findings,
      "dist/.vite/manifest.json",
      "production-manifest",
      "missing or invalid",
    );
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
      addFinding(
        findings,
        "dist/.vite/manifest.json",
        "production-manifest",
        `invalid dynamic imports: ${key}`,
      );
    } else if (
      Array.isArray(value.dynamicImports) &&
      value.dynamicImports.length > 0
    ) {
      addFinding(findings, "dist/.vite/manifest.json", "dynamic-import", key);
    }
    if (/tsv-loader-fs/i.test(key)) {
      addFinding(
        findings,
        "dist/.vite/manifest.json",
        "production-node-helper",
        key,
      );
    }
    const outputs = [value.file];
    for (const field of [value.css, value.assets]) {
      if (field !== undefined && !Array.isArray(field)) {
        addFinding(
          findings,
          "dist/.vite/manifest.json",
          "production-manifest",
          `invalid output list: ${key}`,
        );
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
        const trustedBrandLogo =
          TRUSTED_BRAND_LOGO.test(outputPath) &&
          (await readFile(resolve(root, "dist", outputPath))
            .then(
              (source) =>
                createHash("sha256").update(source).digest("hex") ===
                TRUSTED_BRAND_LOGO_SHA256,
            )
            .catch(() => false));
        if (
          /\.(?:avif|gif|jpe?g|png|webp)$/i.test(outputPath) &&
          !trustedBrandLogo
        ) {
          addFinding(
            findings,
            `dist/${outputPath}`,
            "server-hosted-image",
            "bundled raster image",
          );
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
    addFinding(
      findings,
      `dist/${symlink}`,
      "production-output",
      "symbolic link",
    );
  }
  for (const required of expectedFiles) {
    if (!inventory.files.includes(required)) {
      addFinding(
        findings,
        `dist/${required}`,
        "production-manifest",
        "expected output missing",
      );
    }
  }
  const trustedVendorOutputs = new Set<string>();
  const trustedRuntimeOutputs = new Set<string>();
  const trustedAppOutputs = new Set<string>();
  for (const outputPath of inventory.files) {
    const expectedHash = TRUSTED_VENDOR_BUNDLE.test(outputPath)
      ? TRUSTED_VENDOR_SHA256
      : TRUSTED_RUNTIME_BUNDLE.test(outputPath)
        ? TRUSTED_RUNTIME_SHA256
        : TRUSTED_APP_BUNDLE.test(outputPath)
          ? TRUSTED_APP_SHA256
          : undefined;
    if (!expectedHash) continue;
    const source = await readFile(
      resolve(root, "dist", outputPath),
      "utf8",
    ).catch(() => undefined);
    if (!source || !trustedBundle(source, expectedHash)) continue;
    if (TRUSTED_VENDOR_BUNDLE.test(outputPath))
      trustedVendorOutputs.add(outputPath);
    else if (TRUSTED_RUNTIME_BUNDLE.test(outputPath))
      trustedRuntimeOutputs.add(outputPath);
    else trustedAppOutputs.add(outputPath);
  }
  const trustedImportsFor = (
    importer: string,
    outputs: ReadonlySet<string>,
  ): ReadonlySet<string> => {
    const imports = new Set<string>();
    for (const outputPath of outputs) {
      let specifier = relative(
        dirname(importer),
        resolve(root, "dist", outputPath),
      ).replace(/\\/g, "/");
      if (!specifier.startsWith(".")) specifier = `./${specifier}`;
      imports.add(specifier);
    }
    return imports;
  };
  for (const outputPath of inventory.files) {
    const file = `dist/${outputPath}`;
    if (!expectedFiles.has(outputPath)) {
      addFinding(
        findings,
        file,
        "untracked-build-artifact",
        "not declared by the canonical build",
      );
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
      const vendorOutput = TRUSTED_VENDOR_BUNDLE.test(outputPath);
      const runtimeOutput = TRUSTED_RUNTIME_BUNDLE.test(outputPath);
      const appOutput = TRUSTED_APP_BUNDLE.test(outputPath);
      const trustedVendor =
        vendorOutput && trustedVendorOutputs.has(outputPath);
      const trustedRuntime =
        runtimeOutput && trustedRuntimeOutputs.has(outputPath);
      const trustedApp = appOutput && trustedAppOutputs.has(outputPath);
      if (vendorOutput && !trustedVendor) {
        addFinding(
          findings,
          file,
          "vendor-integrity",
          "trusted vendor bundle SHA-256 mismatch",
        );
      }
      if (runtimeOutput && !trustedRuntime) {
        addFinding(
          findings,
          file,
          "runtime-integrity",
          "trusted runtime bundle SHA-256 mismatch",
        );
      }
      if (appOutput && !trustedApp) {
        addFinding(
          findings,
          file,
          "app-integrity",
          "trusted application bundle SHA-256 mismatch",
        );
      }
      if (!trustedVendor && !trustedRuntime && !trustedApp) {
        findings.push(
          ...scanScriptOrigins(root, absolute, source, {
            vendor: trustedImportsFor(absolute, trustedVendorOutputs),
            runtime: trustedImportsFor(absolute, trustedRuntimeOutputs),
          }),
        );
        for (const [marker, detail] of BUNDLE_MARKERS) {
          if (marker.test(source)) {
            addFinding(findings, file, "forbidden-bundle-marker", detail);
          }
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
        addFinding(
          findings,
          file,
          "production-entry",
          "unexpected HTML output",
        );
      }
      const scripts = [...source.matchAll(/<script\b[^>]*>/gi)].map(
        (match) => match[0],
      );
      const localModules = scripts.filter(
        (tag) =>
          /\btype=["']module["']/i.test(tag) &&
          /\bsrc=["']\/assets\/[a-z0-9._-]+\.js["']/i.test(tag),
      );
      if (
        outputPath === "index.html" &&
        (scripts.length !== 1 || localModules.length !== 1)
      ) {
        addFinding(
          findings,
          file,
          "production-entry",
          "invalid generated script entry",
        );
      }
    }
  }
  return findings;
}

export function scanScriptOriginsWithTrustedImportsForTest(
  source: string,
  trustedBundleImports: {
    vendor: ReadonlySet<string>;
    runtime: ReadonlySet<string>;
  },
): RuntimeBoundaryFinding[] {
  const root = resolve("runtime-boundary-test-root");
  return scanScriptOrigins(
    root,
    resolve(root, "dist/assets/index.js"),
    source,
    trustedBundleImports,
  );
}

async function inspectViteConfig(
  root: string,
): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const configPath = "vite.config.private-hosted.ts";
  const config = await readFile(resolve(root, configPath), "utf8").catch(
    () => "",
  );
  const normalized = config.replace(/\r\n?/g, "\n");
  if (normalized === CANONICAL_VITE_CONFIG) return findings;
  if (normalized !== CANONICAL_VITE_CONFIG) {
    addFinding(
      findings,
      configPath,
      "vite-config",
      "canonical configuration mismatch",
    );
  }
  const parsed = ts.createSourceFile(
    configPath,
    config,
    ts.ScriptTarget.Latest,
    true,
  );
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
      addFinding(findings, configPath, "vite-config", "spread configuration");
    }
    if (
      ts.isPropertyAssignment(node) ||
      ts.isShorthandPropertyAssignment(node)
    ) {
      const name = propertyName(node.name);
      if (name === undefined) {
        addFinding(
          findings,
          configPath,
          "vite-config",
          "dynamic computed property",
        );
      } else {
        if (name === "base")
          addFinding(findings, configPath, "vite-base", "base override");
        if (["root", "publicDir", "appType"].includes(name)) {
          addFinding(findings, configPath, "vite-root", name);
        }
        if (["input", "lib"].includes(name)) {
          addFinding(findings, configPath, "vite-input", name);
        }
        if (["outDir", "emptyOutDir", "write"].includes(name)) {
          addFinding(findings, configPath, "vite-output", name);
        }
        if (["proxy", "historyApiFallback", "rewrites"].includes(name)) {
          addFinding(findings, configPath, "router-rewrite", name);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return findings;
}

async function inspectEntrypoints(
  root: string,
  graph: ProductionGraph,
): Promise<RuntimeBoundaryFinding[]> {
  const findings: RuntimeBoundaryFinding[] = [];
  const entryPath = "meta-app/index.html";
  const html = await readFile(resolve(root, entryPath), "utf8").catch(() => "");
  findings.push(...scanHtml(root, resolve(root, entryPath), html));
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
      entryPath,
      "root-entry",
      "expected only /src/main.tsx as a module entry",
    );
  }
  const app = resolve(root, "meta-app/src/App.tsx");
  if (!entersMain || !graph.scripts.has(app)) {
    addFinding(
      findings,
      "meta-app/src/main.tsx",
      "app-entry",
      "meta-app/src/App.tsx is not reachable",
    );
  }

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
      `${left.file}\0${left.code}\0${left.detail}`.localeCompare(
        `${right.file}\0${right.code}\0${right.detail}`,
      ),
    );
  }
  const buildOutput = runBuild
    ? await runBuild()
    : await runCanonicalBoundaryBuild(root);
  const graph = await productionFiles(root);
  const findings = [...(await inspectEntrypoints(root, graph))];
  for (const [path, source] of graph.scripts) {
    findings.push(...scanSource(root, path, source));
  }
  for (const [path, source] of graph.styles)
    findings.push(...scanStyle(root, path, source));
  for (const [path, source] of graph.data)
    findings.push(...scanData(root, path, source));
  findings.push(...(await inspectBuild(root, buildOutput)));
  return findings.sort((left, right) =>
    `${left.file}\0${left.code}\0${left.detail}`.localeCompare(
      `${right.file}\0${right.code}\0${right.detail}`,
    ),
  );
}

export async function runRuntimeBoundaryCli(
  repoRoot = process.cwd(),
): Promise<void> {
  const findings = await auditRuntimeBoundary(repoRoot);
  const result = { schemaVersion: 1, ok: findings.length === 0, findings };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runRuntimeBoundaryCli();
}
