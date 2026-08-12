import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditRuntimeBoundary,
  isReviewedBundleFindingAllowed,
  runCanonicalBoundaryBuild,
  scanScriptOriginsWithTrustedImportsForTest,
  type TrustedBundlePolicy,
} from "../../scripts/private-hosted/audit-runtime-boundary.js";

const roots: string[] = [];
const RELEASE_ENTRY = "meta-app/index.html";
const RELEASE_CONFIG = "vite.config.private-hosted.ts";
const canonicalViteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "meta-app"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  define: {
    "import.meta.env.VITE_CLOUD_DATA_SYNC_ENABLED": JSON.stringify("true"),
    "import.meta.env.VITE_PRIVATE_HOSTED_RELEASE": JSON.stringify("true"),
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

async function fixture(appSource = "export default function App() {}") {
  const root = await mkdtemp(join(tmpdir(), "conan-runtime-boundary-"));
  roots.push(root);
  await mkdir(resolve(root, "src"), { recursive: true });
  await mkdir(resolve(root, "meta-app/src"), { recursive: true });
  await mkdir(resolve(root, "dist/.vite"), { recursive: true });
  await mkdir(resolve(root, "dist/assets"), { recursive: true });
  await writeFile(
    resolve(root, RELEASE_ENTRY),
    '<div id="meta-root"></div><script type="module" src="/src/main.tsx"></script>',
  );
  await writeFile(
    resolve(root, "meta-app/src/main.tsx"),
    "import App from './App'; void App;",
  );
  await writeFile(
    resolve(root, "meta-app/src/App.tsx"),
    "import App from '../../src/App'; export default App;",
  );
  await writeFile(resolve(root, "src/App.tsx"), appSource);
  await writeFile(resolve(root, RELEASE_CONFIG), canonicalViteConfig);
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ scripts: { build: "vite build" } }),
  );
  await writeFile(resolve(root, "dist/assets/index.js"), "console.log('ok');");
  await writeFile(
    resolve(root, "dist/index.html"),
    '<div id="root"></div><script type="module" src="/assets/index.js"></script>',
  );
  await writeFile(
    resolve(root, "dist/_headers"),
    "/*\n  Cache-Control: no-store\n  Content-Security-Policy: img-src https://www.takaratomy.co.jp;\n",
  );
  await writeFile(
    resolve(root, "dist/_routes.json"),
    JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
  );
  await writeFile(
    resolve(root, "dist/favicon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>',
  );
  await writeFile(
    resolve(root, "dist/.vite/manifest.json"),
    JSON.stringify({
      "index.html": {
        file: "assets/index.js",
        isEntry: true,
        imports: [],
        dynamicImports: [],
      },
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("private hosted runtime boundary", () => {
  it("accepts a static production graph and inspects the completed build", async () => {
    const root = await fixture();
    let builds = 0;

    const findings = await auditRuntimeBoundary(root, async () => {
      builds += 1;
      return { stdout: "vite build complete\n", stderr: "" };
    });

    expect(builds).toBe(1);
    expect(findings).toEqual([]);
  });

  it("resolves the official NEWS implementation from the Meta source root", async () => {
    const root = await fixture();
    await mkdir(resolve(root, "meta-app/src/services"), { recursive: true });
    await writeFile(
      resolve(root, "meta-app/src/App.tsx"),
      "import { loadOfficialNews } from '@meta/services/officialNews'; void loadOfficialNews; export default function App() {}",
    );
    await writeFile(
      resolve(root, "meta-app/src/services/officialNews.ts"),
      "export async function loadOfficialNews() { return fetch('https://outside.example.test/news'); }",
    );
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "meta-app/src/services/officialNews.ts",
      code: "external-origin",
      detail: "https://outside.example.test/news",
    });
  });

  it("resolves Vite-root absolute imports from meta-app", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "meta-app/src/App.tsx"),
      "import '/src/Absolute'; export default function App() {}",
    );
    await writeFile(
      resolve(root, "src/Absolute.ts"),
      "export const safe = true;",
    );
    await writeFile(
      resolve(root, "meta-app/src/Absolute.ts"),
      "void fetch('https://absolute-import.example.test/news');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "meta-app/src/Absolute.ts",
      code: "external-origin",
      detail: "https://absolute-import.example.test/news",
    });
  });

  it("permits reviewed Meta capabilities only at their owned source boundaries", async () => {
    const reviewedRoot = await fixture();
    await mkdir(resolve(reviewedRoot, "meta-app/src/router"), {
      recursive: true,
    });
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/App.tsx"),
      "import './router/useHashRoute'; export default function App() {}",
    );
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/router/useHashRoute.ts"),
      await readFile(
        resolve(process.cwd(), "meta-app/src/router/useHashRoute.ts"),
        "utf8",
      ),
    );

    const reviewed = await auditRuntimeBoundary(reviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(reviewed).toEqual([]);

    const unreviewedRoot = await fixture();
    await mkdir(resolve(unreviewedRoot, "meta-app/src/router"), {
      recursive: true,
    });
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/App.tsx"),
      "import './router/unreviewed'; export default function App() {}",
    );
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/router/unreviewed.ts"),
      "export const current = window.location.hash;",
    );

    const unreviewed = await auditRuntimeBoundary(unreviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(unreviewed).toContainEqual({
      file: "meta-app/src/router/unreviewed.ts",
      code: "network-api",
      detail: "window.location",
    });

    const tamperedRoot = await fixture();
    await mkdir(resolve(tamperedRoot, "meta-app/src/router"), {
      recursive: true,
    });
    await writeFile(
      resolve(tamperedRoot, "meta-app/src/App.tsx"),
      "import './router/useHashRoute'; export default function App() {}",
    );
    const reviewedSource = await readFile(
      resolve(process.cwd(), "meta-app/src/router/useHashRoute.ts"),
      "utf8",
    );
    await writeFile(
      resolve(tamperedRoot, "meta-app/src/router/useHashRoute.ts"),
      `${reviewedSource}\n// tampered`,
    );
    const tampered = await auditRuntimeBoundary(tamperedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(tampered).toContainEqual({
      file: "meta-app/src/router/useHashRoute.ts",
      code: "network-api",
      detail: "window.location",
    });
  });

  it("permits only the reviewed cloud client capabilities at their exact source hashes", async () => {
    const cases = [
      ["cloud/apiClient.ts", "./cloud/apiClient"],
      ["cloud/runtime.ts", "./cloud/runtime"],
      ["cloud/storage.ts", "./cloud/storage"],
    ] as const;

    for (const [file, specifier] of cases) {
      const root = await fixture();
      await mkdir(resolve(root, "meta-app/src", file, ".."), {
        recursive: true,
      });
      await writeFile(
        resolve(root, "meta-app/src/App.tsx"),
        `import '${specifier}'; export default function App() {}`,
      );
      await writeFile(
        resolve(root, "meta-app/src", file),
        await readFile(resolve(process.cwd(), "meta-app/src", file), "utf8"),
      );

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings, file).toEqual([]);
    }

    const tamperedRoot = await fixture();
    await mkdir(resolve(tamperedRoot, "meta-app/src/cloud"), {
      recursive: true,
    });
    await writeFile(
      resolve(tamperedRoot, "meta-app/src/App.tsx"),
      "import './cloud/apiClient'; export default function App() {}",
    );
    const source = await readFile(
      resolve(process.cwd(), "meta-app/src/cloud/apiClient.ts"),
      "utf8",
    );
    await writeFile(
      resolve(tamperedRoot, "meta-app/src/cloud/apiClient.ts"),
      `${source}\n// tampered`,
    );
    const tampered = await auditRuntimeBoundary(tamperedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(tampered).toContainEqual({
      file: "meta-app/src/cloud/apiClient.ts",
      code: "network-api",
      detail: "fetch",
    });
  });

  it("permits reviewed Meta runtime styles without opening unreviewed modules", async () => {
    const reviewedRoot = await fixture();
    await mkdir(resolve(reviewedRoot, "meta-app/src/screens"), {
      recursive: true,
    });
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/App.tsx"),
      "import './screens/CardsScreen'; export default function App() {}",
    );
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/screens/CardsScreen.tsx"),
      await readFile(
        resolve(process.cwd(), "meta-app/src/screens/CardsScreen.tsx"),
        "utf8",
      ),
    );
    const reviewed = await auditRuntimeBoundary(reviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(reviewed).toEqual([]);

    const unreviewedRoot = await fixture();
    await mkdir(resolve(unreviewedRoot, "meta-app/src/screens"), {
      recursive: true,
    });
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/App.tsx"),
      "import Screen from './screens/Unreviewed'; export default Screen;",
    );
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/screens/Unreviewed.tsx"),
      "export default function Screen({ color }: { color: string }) { return <div style={{ background: color }} />; }",
    );
    const unreviewed = await auditRuntimeBoundary(unreviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(unreviewed).toContainEqual({
      file: "meta-app/src/screens/Unreviewed.tsx",
      code: "runtime-style",
      detail: "background",
    });
  });

  it("pins the current reviewed runtime styles changed by the Meta refresh", async () => {
    const cases = [
      ["MetaShell.tsx", "./MetaShell"],
      ["screens/CardsScreen.tsx", "./screens/CardsScreen"],
      ["screens/DeckEditor.tsx", "./screens/DeckEditor"],
      ["shared/MetaCard.tsx", "./shared/MetaCard"],
      ["shared/NetworkStatus.tsx", "./shared/NetworkStatus"],
    ] as const;

    for (const [file, specifier] of cases) {
      const root = await fixture();
      await mkdir(resolve(root, "meta-app/src", file, ".."), {
        recursive: true,
      });
      await writeFile(
        resolve(root, "meta-app/src/App.tsx"),
        `import '${specifier}'; export default function App() {}`,
      );
      await writeFile(
        resolve(root, "meta-app/src", file),
        await readFile(resolve(process.cwd(), "meta-app/src", file), "utf8"),
      );
      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings, file).toEqual([]);
    }
  });

  it("accepts only the canonical Pages Functions route artifact", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/_routes.json"),
      JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/_routes.json"),
    ).toEqual([]);
  });

  it("permits only the four reviewed Zustand persist stores with literal namespaces and partialize", async () => {
    const reviewedRoot = await fixture();
    await mkdir(resolve(reviewedRoot, "meta-app/src/state"), {
      recursive: true,
    });
    const stores = [
      "metaStore.ts",
      "decksStore.ts",
      "filtersStore.ts",
      "historyStore.ts",
    ];
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/App.tsx"),
      stores
        .map((name) => `import './state/${name.replace(/\.ts$/, "")}';`)
        .join("\n") + "\nexport default function App() {}",
    );
    for (const name of stores) {
      await writeFile(
        resolve(reviewedRoot, "meta-app/src/state", name),
        await readFile(
          resolve(process.cwd(), "meta-app/src/state", name),
          "utf8",
        ),
      );
    }

    const reviewed = await auditRuntimeBoundary(reviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(reviewed.filter(({ code }) => code === "persistent-store")).toEqual(
      [],
    );

    const unreviewedRoot = await fixture();
    await mkdir(resolve(unreviewedRoot, "meta-app/src/state"), {
      recursive: true,
    });
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/App.tsx"),
      "import './state/extraStore'; export default function App() {}",
    );
    await writeFile(
      resolve(unreviewedRoot, "meta-app/src/state/extraStore.ts"),
      "import { persist } from 'zustand/middleware'; persist(() => ({}), { name: 'extra', partialize: (state) => state });",
    );
    const unreviewed = await auditRuntimeBoundary(unreviewedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(unreviewed).toContainEqual({
      file: "meta-app/src/state/extraStore.ts",
      code: "persistent-store",
      detail: "unreviewed Zustand persist consumer",
    });

    const malformedRoot = await fixture();
    await mkdir(resolve(malformedRoot, "meta-app/src/state"), {
      recursive: true,
    });
    await writeFile(
      resolve(malformedRoot, "meta-app/src/App.tsx"),
      "import './state/decksStore'; export default function App() {}",
    );
    const decksSource = await readFile(
      resolve(process.cwd(), "meta-app/src/state/decksStore.ts"),
      "utf8",
    );
    await writeFile(
      resolve(malformedRoot, "meta-app/src/state/decksStore.ts"),
      decksSource.replace(/\n\s*partialize:\s*\(state\)[\s\S]*?\n\s*\}\),/, ""),
    );
    const malformed = await auditRuntimeBoundary(malformedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(malformed).toEqual(
      expect.arrayContaining([
        {
          file: "meta-app/src/state/decksStore.ts",
          code: "persistent-store",
          detail: "partialize is required",
        },
        {
          file: "meta-app/src/state/decksStore.ts",
          code: "persistent-store",
          detail: "reviewed store SHA-256 mismatch",
        },
      ]),
    );
  });

  it("rejects Zustand persist re-exported through a local module", async () => {
    const root = await fixture();
    await mkdir(resolve(root, "meta-app/src/state"), { recursive: true });
    await writeFile(
      resolve(root, "meta-app/src/App.tsx"),
      "import './state/extraStore'; export default function App() {}",
    );
    await writeFile(
      resolve(root, "meta-app/src/state/persistBridge.ts"),
      "export { persist } from 'zustand/middleware';",
    );
    await writeFile(
      resolve(root, "meta-app/src/state/extraStore.ts"),
      "import { persist } from './persistBridge'; persist(() => ({}), { name: 'extra', partialize: (state) => state });",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "meta-app/src/state/persistBridge.ts",
      code: "persistent-store",
      detail: "Zustand persist re-export is forbidden",
    });
  });

  it("rejects Zustand persist loaded through a dynamic import", async () => {
    const root = await fixture(`
      void import('zustand/middleware').then(({ persist }) =>
        persist(() => ({}), {
          name: 'extra',
          partialize: (state) => state,
        }),
      );
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "persistent-store",
      detail: "dynamic Zustand persist import is forbidden",
    });
  });

  it("rejects network APIs reachable from the production entry", async () => {
    const root = await fixture(
      "export default function App() { void fetch('/state'); }",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "fetch",
    });
  });

  it("rejects browser navigation sinks with runtime destinations", async () => {
    const root = await fixture(`
      const destination = '/outside';
      window.open(destination);
      location.assign(destination);
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "window.open",
        },
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "location",
        },
      ]),
    );
  });

  it("rejects dynamic anchor and form navigation in source and bundle", async () => {
    const source = `
      const destination = '/outside';
      const anchor = document.createElement('a');
      anchor.href = destination;
      anchor.setAttribute('href', destination);
      const form = document.createElement('form');
      form.action = destination;
      form.requestSubmit();
      export default function App() { return <a href={destination}>leave</a>; }
    `;
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual(
      expect.arrayContaining([
        { file: "src/App.tsx", code: "network-api", detail: "navigation href" },
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "navigation action",
        },
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "navigation requestSubmit",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "navigation href",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "navigation action",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "navigation requestSubmit",
        },
      ]),
    );
  });

  it("rejects spread, factory, reflected, and namespaced navigation bypasses", async () => {
    const source = `
      const destination = '/outside';
      const props = { href: destination };
      const anchor = document.createElement('a');
      Object.assign(anchor, props);
      Object.defineProperty(anchor, 'href', { value: destination });
      Reflect.set(anchor, 'href', destination);
      anchor.setAttributeNS(null, 'href', destination);
      anchor.click();
      React.createElement('a', props);
      export default function App() { return <a {...props}>leave</a>; }
    `;
    const bundle = `
      const destination='/outside',props={href:destination},anchor=document.createElement('a');
      Object.assign(anchor,props);Object.defineProperty(anchor,'href',{value:destination});
      Reflect.set(anchor,'href',destination);anchor.setAttributeNS(null,'href',destination);
      anchor.click();j('a',props);
    `;
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    for (const file of ["src/App.tsx", "dist/assets/index.js"]) {
      const code = file.startsWith("src/")
        ? "network-api"
        : "forbidden-bundle-marker";
      expect(findings).toContainEqual({
        file,
        code,
        detail: "navigation href",
      });
      expect(findings).toContainEqual({
        file,
        code,
        detail: "navigation click",
      });
      expect(findings).toContainEqual({
        file,
        code,
        detail: "navigation a element props",
      });
    }
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "navigation a spread",
    });
  });

  it.each([
    {
      name: "Object.assign props",
      operation: "Object.assign(anchor, externalProps)",
      detail: "navigation dynamic properties",
    },
    {
      name: "Object.defineProperties descriptors",
      operation: "Object.defineProperties(anchor, externalDescriptors)",
      detail: "navigation dynamic properties",
    },
    {
      name: "dynamic setAttribute",
      operation: "anchor.setAttribute(dynamicKey, destination)",
      detail: "navigation dynamic attribute",
    },
    {
      name: "dynamic Reflect.set",
      operation: "Reflect.set(anchor, dynamicKey, destination)",
      detail: "navigation dynamic property",
    },
    {
      name: "dynamic Object.defineProperty",
      operation:
        "Object.defineProperty(anchor, dynamicKey, { value: destination })",
      detail: "navigation dynamic property",
    },
  ])(
    "rejects $name on a known navigation element",
    async ({ operation, detail }) => {
      const source = `
      declare const externalProps: object;
      declare const externalDescriptors: PropertyDescriptorMap;
      declare const dynamicKey: string;
      const destination = '/outside';
      const anchor = document.createElement('a');
      ${operation};
      export default function App() {}
    `;
      const bundle = `
      const destination='/outside',anchor=document.createElement('a');
      ${operation};
    `;
      const root = await fixture(source);
      await writeFile(resolve(root, "dist/assets/index.js"), bundle);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "network-api",
        detail,
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail,
      });
    },
  );

  it("accepts non-navigation action data and JSX boolean attributes", async () => {
    const source = `
      const log = { action: 'game action' };
      export default function App() { return <dialog open>{log.action}</dialog>; }
    `;
    const root = await fixture(source);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const log={action:'game action'};void log;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("rejects every remote runtime channel, persistent storage, and VITE variables", async () => {
    const root = await fixture(`
      const xhr = new XMLHttpRequest();
      const socket = new WebSocket('wss://example.test');
      const events = new EventSource('/events');
      const transport = new WebTransport('https://example.test');
      const peer = new RTCPeerConnection();
      const request = globalThis.fetch;
      navigator.sendBeacon('/events', 'x');
      const worker = new Worker('/worker.js');
      navigator.serviceWorker.register('/sw.js');
      localStorage.setItem('state', 'x');
      sessionStorage.setItem('state', 'x');
      indexedDB.open('state');
      caches.open('state');
      window['localStorage'].setItem('other', 'x');
      globalThis["indexedDB"].open('other');
      self['caches'].open('other');
      void import.meta.env.VITE_SERVER_URL;
      export default function App() { void xhr; void socket; void events; void transport; void peer; void request; void worker; }
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings.map(({ code, detail }) => `${code}:${detail}`)).toEqual(
      expect.arrayContaining([
        "network-api:XMLHttpRequest",
        "network-api:WebSocket",
        "network-api:EventSource",
        "network-api:WebTransport",
        "network-api:RTCPeerConnection",
        "network-api:globalThis.fetch",
        "network-api:navigator.sendBeacon",
        "network-api:Worker",
        "service-worker:navigator.serviceWorker",
        "persistent-storage:localStorage",
        "persistent-storage:sessionStorage",
        "persistent-storage:indexedDB",
        "persistent-storage:caches",
        "vite-variable:VITE_SERVER_URL",
      ]),
    );
  });

  it.each([
    {
      name: "bare history",
      operation: "history.replaceState(state,'')",
      detail: "history",
    },
    {
      name: "window history",
      operation: "window.history.pushState(state,'','/')",
      detail: "history",
    },
    {
      name: "window name",
      operation: "window.name=JSON.stringify(state)",
      detail: "name",
    },
    {
      name: "credential storage",
      operation: "navigator.credentials.store(credential)",
      detail: "credentials",
    },
    {
      name: "clipboard export",
      operation: "navigator.clipboard.writeText(state)",
      detail: "clipboard",
    },
  ])(
    "rejects $name as a state persistence or export channel",
    async ({ operation, detail }) => {
      const source = `declare const state: any;declare const credential: any;${operation};`;
      const root = await fixture(`${source}export default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), operation);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "persistent-storage",
        detail,
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "persistent storage",
      });
    },
  );

  it.each([
    {
      name: "opener messaging",
      operation: "window.opener?.postMessage(state,'*')",
      detail: "window.postMessage",
      bundleDetail: "network API",
    },
    {
      name: "broadcast messaging",
      operation: "new BroadcastChannel('state')",
      detail: "BroadcastChannel",
      bundleDetail: "network constructor",
    },
  ])(
    "rejects $name as a cross-context export channel",
    async ({ operation, detail, bundleDetail }) => {
      const source = `declare const state: any;${operation};`;
      const root = await fixture(`${source}export default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), operation);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "network-api",
        detail,
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: bundleDetail,
      });
    },
  );

  it("rejects persistence and messaging through an iframe browsing context", async () => {
    const source = `
      declare const state: any;
      const frame = document.createElement('iframe');
      const child = frame.contentWindow;
      child?.localStorage.setItem('state', state);
      frame.contentWindow?.postMessage(state, '*');
      export default function App() {}
    `;
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/App.tsx",
          code: "persistent-storage",
          detail: "localStorage",
        },
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "window.postMessage",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "persistent storage",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "network API",
        },
      ]),
    );
  });

  it("rejects a browsing context reached through an unresolved typed iframe", async () => {
    const source = `
      function leak(frame: HTMLIFrameElement, state: unknown) {
        frame.contentWindow?.localStorage.setItem('state', String(state));
        frame.contentDocument?.defaultView?.postMessage(state, '*');
      }
      export default function App() { return null; }
    `;
    const bundle =
      "function leak(frame,state){frame.contentWindow?.localStorage.setItem('state',String(state));frame.contentDocument?.defaultView?.postMessage(state,'*')}";
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/App.tsx",
          code: "persistent-storage",
          detail: "localStorage",
        },
        {
          file: "src/App.tsx",
          code: "network-api",
          detail: "window.postMessage",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "persistent storage",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "network API",
        },
      ]),
    );
  });

  it("rejects a computed browsing context reached through an unresolved typed iframe", async () => {
    const source = `
      function leak(frame: HTMLIFrameElement) {
        const key = 'contentWindow';
        frame[key]?.localStorage.setItem('state', 'leak');
      }
      export default function App() { return null; }
    `;
    const bundle =
      "function leak(frame){const key='contentWindow';frame[key]?.localStorage.setItem('state','leak')}";
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "persistent-storage",
      detail: "localStorage",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "persistent storage",
    });
  });

  it("uses the computed iframe key value at the access point", async () => {
    const source = `
      function leak(frame: HTMLIFrameElement) {
        let key = 'contentWindow';
        frame[key]?.localStorage.setItem('state', 'leak');
        key = 'safe';
      }
      export default function App() { return null; }
    `;
    const bundle =
      "function leak(frame){let key='contentWindow';frame[key]?.localStorage.setItem('state','leak');key='safe'}";
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "persistent-storage",
      detail: "localStorage",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "persistent storage",
    });
  });

  it("accepts contentWindow fields on a locally constructed plain model", async () => {
    const source =
      "const model={contentWindow:{localStorage:{setItem(){}}}};model.contentWindow.localStorage.setItem();export default function App(){}";
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it.each([
    {
      name: "bare parent",
      operation: "parent.postMessage(state, '*')",
      code: "network-api",
      detail: "parent.postMessage",
      bundleDetail: "network API",
    },
    {
      name: "bare top",
      operation: "top?.postMessage(state, '*')",
      code: "network-api",
      detail: "top.postMessage",
      bundleDetail: "network API",
    },
    {
      name: "bare opener",
      operation: "opener?.postMessage(state, '*')",
      code: "network-api",
      detail: "opener.postMessage",
      bundleDetail: "network API",
    },
    {
      name: "bare frames",
      operation: "frames[0].localStorage.setItem('state', state)",
      code: "dynamic-browser-property",
      detail: "frames[dynamic]",
      bundleDetail: "dynamic browser property",
    },
  ])(
    "rejects export through $name browsing-context globals",
    async ({ operation, code, detail, bundleDetail }) => {
      const source = `declare const state:any;${operation};export default function App(){}`;
      const root = await fixture(source);
      await writeFile(resolve(root, "dist/assets/index.js"), operation);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({ file: "src/App.tsx", code, detail });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: bundleDetail,
      });
    },
  );

  it.each([
    {
      name: "Navigation API state",
      operation: "navigation.updateCurrentEntry({state})",
      detail: "navigation",
    },
    {
      name: "legacy clipboard copy",
      operation: "document.execCommand('copy')",
      detail: "execCommand",
    },
    {
      name: "dynamic legacy clipboard command",
      operation: "document.execCommand(command)",
      detail: "execCommand",
    },
  ])("rejects $name", async ({ operation, detail }) => {
    const source = `declare const state:any;declare const command:string;${operation};`;
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), operation);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "persistent-storage",
      detail,
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "persistent storage",
    });
  });

  it("traverses imported JSON and rejects embedded external origins", async () => {
    const root = await fixture(
      "import data from './runtime.json'; export default function App() { void data; }",
    );
    await writeFile(
      resolve(root, "src/runtime.json"),
      String.raw`{"endpoint":"https:\/\/api.example.test\/state","unicode":"\u0068ttps\u003a\u002f\u002funicode.example.test\/state"}`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/runtime.json",
      code: "external-origin",
      detail: "https://api.example.test/state",
    });
    expect(findings).toContainEqual({
      file: "src/runtime.json",
      code: "external-origin",
      detail: "https://unicode.example.test/state",
    });
  });

  it("rejects bracket-only access to persistent storage", async () => {
    const root = await fixture(`
      window['localStorage'].setItem('state', 'x');
      globalThis["indexedDB"].open('state');
      self['caches'].open('state');
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings.map(({ code, detail }) => `${code}:${detail}`)).toEqual(
      expect.arrayContaining([
        "persistent-storage:localStorage",
        "persistent-storage:indexedDB",
        "persistent-storage:caches",
      ]),
    );
  });

  it("rejects alternate browser API syntax in both source and completed bundles", async () => {
    const root = await fixture(`
      navigator['serviceWorker'].register('/sw.js');
      new SharedWorker('/worker.js');
      document.cookie = 'state=x';
      void navigator['storage'];
      void import.meta.env['VITE_SERVER_URL'];
      const socket = new globalThis['WebSocket']('/socket');
      export default function App() { void socket; }
    `);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `
        navigator['serviceWorker'].register('/sw.js');
        new SharedWorker('/worker.js');
        document.cookie = 'state=x';
        void navigator['storage'];
        new globalThis['WebSocket']('/socket');
      `,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    const source = findings.filter(({ file }) => file === "src/App.tsx");
    const bundle = findings.filter(
      ({ file }) => file === "dist/assets/index.js",
    );

    expect(source.map(({ code, detail }) => `${code}:${detail}`)).toEqual(
      expect.arrayContaining([
        "service-worker:navigator[serviceWorker]",
        "network-api:SharedWorker",
        "network-api:WebSocket",
        "persistent-storage:document.cookie",
        "persistent-storage:navigator.storage",
        "vite-variable:VITE_SERVER_URL",
      ]),
    );
    expect(bundle.map(({ code, detail }) => `${code}:${detail}`)).toEqual(
      expect.arrayContaining([
        "forbidden-bundle-marker:service worker",
        "forbidden-bundle-marker:network constructor",
        "forbidden-bundle-marker:qualified network constructor",
        "forbidden-bundle-marker:document cookie",
        "forbidden-bundle-marker:storage manager",
      ]),
    );
  });

  it("rejects a transitive privileged alias in source", async () => {
    const root = await fixture(`
      const key = ['local', 'Storage'].join('');
      const browser = window;
      const browserAgain = browser;
      browserAgain[key].setItem('state', 'x');
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "src/App.tsx"),
    ).toContainEqual({
      file: "src/App.tsx",
      code: "persistent-storage",
      detail: "localStorage",
    });
  });

  it("rejects a mutable privileged alias in a minified bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `const key=['local','Storage'].join('');let browser={};browser=window;browser[key].setItem('state','x');`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "persistent storage",
    });
  });

  it.each([
    {
      name: "straight-line clean overwrite",
      source: "let x=window;void x.innerWidth;x={};void x[key];",
      rejected: false,
    },
    {
      name: "straight-line re-taint",
      source: "let x={};x=window;void x[key];",
      rejected: true,
    },
    {
      name: "one tainted branch",
      source: "let x={};if(flag)x=window;void x[key];",
      rejected: true,
    },
    {
      name: "both branches clean",
      source: "let x=window;if(flag)x={};else x={};void x[key];",
      rejected: false,
    },
    {
      name: "conditional value",
      source: "let x={};x=flag?window:{};void x[key];",
      rejected: true,
    },
    {
      name: "short-circuit assignment",
      source: "let x={};flag&&(x=window);void x[key];",
      rejected: true,
    },
    {
      name: "zero-iteration clean loop",
      source: "let x=window;while(flag)x={};void x[key];",
      rejected: true,
    },
    {
      name: "zero-iteration tainted loop",
      source: "let x={};while(flag)x=window;void x[key];",
      rejected: true,
    },
    {
      name: "mandatory clean do loop",
      source: "let x=window;do{x={}}while(false);void x[key];",
      rejected: false,
    },
  ])("tracks $name in a minified bundle", async ({ source, rejected }) => {
    const root = await fixture();
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    const dynamicAlias = findings.some(
      ({ file, code, detail }) =>
        file === "dist/assets/index.js" &&
        code === "forbidden-bundle-marker" &&
        detail === "dynamic browser property",
    );
    expect(dynamicAlias).toBe(rejected);
  });

  it("does not retain taint after React-style local binding reuse", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){e=e.target||window;void e.innerWidth;e={};return e[key]}void target;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("converges on React-style loop-carried object properties", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      [
        "function reconcile(track){",
        "return function h(parent,current,items,lane){",
        "for(var first=null,last=null,node=current,index=current=0,next=null;node!==null&&index<items.length;index++){",
        "node.index>index?(next=node,node=null):next=node.sibling;",
        "var child=update(parent,node,items[index],lane);",
        "if(child===null){node===null&&(node=next);break}",
        "track&&node&&child.alternate===null&&remove(parent,node);",
        "current=place(child,current,index);",
        "last===null?first=child:last.sibling=child;last=child;node=next",
        "}",
        "return first",
        "}",
        "}",
        "reconcile(window);",
      ].join(""),
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  }, 5_000);

  it("finishes taint reachability through a dense cyclic object graph", async () => {
    const declarations = Array.from(
      { length: 9 },
      (_, index) => `const node${index}={};`,
    );
    const edges = Array.from({ length: 9 }, (_, owner) =>
      Array.from(
        { length: 9 },
        (_, target) => `node${owner}.p${target}=node${target};`,
      ).join(""),
    );
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      [
        "function target(e){return e.target||window}",
        "function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}",
        "const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};",
        ...declarations,
        ...edges,
        "node0.value=replay(queued);consume(node8);",
      ].join(""),
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  }, 5_000);

  it.each([
    {
      name: "for-of loop-carried alias",
      source:
        "let x={},i=0;for(const item of [0,1]){void item;if(i++)void x[key];x=window}",
    },
    {
      name: "for-in loop-carried alias",
      source:
        "let x={},i=0;for(const item in {a:0,b:1}){void item;if(i++)void x[key];x=window}",
    },
    {
      name: "labeled block exit",
      source: "let x={};done:{x=window;break done}void x[key]",
    },
    {
      name: "return through finally",
      source: "function f(){let x=window;try{return}finally{void x[key]}}f()",
    },
    {
      name: "throw through finally",
      source:
        "function f(){let x=window;try{throw new Error('x')}finally{void x[key]}}try{f()}catch{}",
    },
    {
      name: "class field initializer",
      source: "let x=window;class C{field=x[key]('/')}new C()",
    },
    {
      name: "class heritage expression",
      source: "let x=window;class C extends x[key]{}void C",
    },
    {
      name: "computed class member",
      source: "let x=window;class C{[x[key]](){}}void C",
    },
    {
      name: "class static block",
      source: "let x=window;class C{static{void x[key]}}void C",
    },
  ])("rejects $name in source and completed bundle", async ({ source }) => {
    const root = await fixture(
      `const key=['fe','tch'].join('');${source};export default function App(){}`,
    );
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `const key=['fe','tch'].join('');${source};`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "window.fetch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it.each([
    {
      name: "argument to a local function",
      source: "let w=window;function use(x){void x[key]}use(w)",
      sourceCode: "browser-global-escape",
      bundleDetail: "network API",
    },
    {
      name: "local function return",
      source: "function get(){let w=window;return w}void get()[key]",
      sourceCode: "browser-global-escape",
      bundleDetail: "network API",
    },
    {
      name: "called captured write",
      source:
        "let outer={};function set(){let w=window;outer=w}set();void outer[key]",
      sourceCode: "browser-global-escape",
      bundleDetail: "network API",
    },
    {
      name: "array container",
      source: "let w=window;const box=[w];void box",
      sourceCode: "browser-global-escape",
      bundleDetail: "browser global escape",
    },
    {
      name: "object container",
      source: "let w=window;const box={w};void box",
      sourceCode: "browser-global-escape",
      bundleDetail: "browser global escape",
    },
  ])(
    "rejects privileged alias flow through $name",
    async ({ source, sourceCode, bundleDetail }) => {
      const root = await fixture(
        `const key=['fe','tch'].join('');${source};export default function App(){}`,
      );
      await writeFile(
        resolve(root, "dist/assets/index.js"),
        `const key=['fe','tch'].join('');${source};`,
      );

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(
        findings.some(
          ({ file, code }) => file === "src/App.tsx" && code === sourceCode,
        ),
      ).toBe(true);
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: bundleDetail,
      });
    },
  );

  it("keeps nested function writes isolated and rejects captured privileged writes", async () => {
    const safeRoot = await fixture(
      "let outer={};function unused(){let outer=window;void outer.innerWidth}void outer[key];export default function App(){};",
    );
    const unsafeRoot = await fixture(
      "let outer={};function set(){outer=window}set();void outer[key];export default function App(){};",
    );

    const safe = await auditRuntimeBoundary(safeRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    const unsafe = await auditRuntimeBoundary(unsafeRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(safe.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(unsafe.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
    });
  });

  it("accepts ordinary values read from a statically named internal runtime slot", async () => {
    const source = `
      globalThis.__pendingLocalState = { items: [1, 2] };
      function render(value) { return value.items.map(String).join(','); }
      void Array.isArray(globalThis.__pendingLocalState);
      void Object.keys(globalThis.__pendingLocalState);
      void render(globalThis.__pendingLocalState);
    `;
    const root = await fixture(`${source}export default function App() {}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("rejects a privileged value recovered from a statically named internal runtime slot", async () => {
    const source =
      "globalThis.__pendingLocalState=window;consume(globalThis.__pendingLocalState);";
    const root = await fixture(`${source}export default function App() {}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("does not taint same-name bindings in another lexical scope", async () => {
    const root = await fixture(`
      const key = 'localStorage';
      function local(window: { title: string }) {
        const key = 'title';
        return window[key];
      }
      export default function App() { return local({ title: 'safe' }); }
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
  });

  it("rejects a privileged source value passed across a function boundary", async () => {
    const root = await fixture(`
      function persist(browser: Window) { return browser; }
      persist(window);
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "src/App.tsx"),
    ).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
    });
  });

  it("rejects a privileged bundle value passed across a function boundary", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function persist(browser){return browser}persist(window);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("rejects a privileged bundle value passed through a local function alias", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');let browser=window;function use(value){void value[key]}const relay=use;relay(browser);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("accepts inert React-style event target plumbing in the completed bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "let target=window;function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}let Event=SyntheticEvent;const event=new Event('onSelect','select',null,{},target);event.target=target;event.relatedTarget=target;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("accepts inert React-style replay event bookkeeping in the completed bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function blocked(e){return target(e)}function replay(e){const n=blocked(e.nativeEvent);if(n!==null){e.blockedOn=n;return false}return e.targetContainers.length===0}const queued={blockedOn:null,nativeEvent:{target:null},targetContainers:[]};void replay(queued);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("rejects a replay bookkeeping value reused as a network owner", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');function target(e){return e.target||window}function replay(e){e.blockedOn=target(e.nativeEvent);return e.targetContainers.length===0}const queued={blockedOn:null,nativeEvent:{target:null},targetContainers:[]};replay(queued);void queued.blockedOn[key]('/state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects a replay bookkeeping value returned as a network owner", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');function replay(e){e.blockedOn=window;void e.nativeEvent;void e.targetContainers;return e.blockedOn}replay({blockedOn:null,nativeEvent:{},targetContainers:[]})[key]('/state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects a tainted replay object returned to an unknown consumer", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}consume(replay({blockedOn:null,nativeEvent:{},targetContainers:[],target:null}));",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it.each([
    {
      name: "object property",
      wrapper: "consume({value:replay(queued)})",
    },
    {
      name: "array element",
      wrapper: "consume([replay(queued)])",
    },
    {
      name: "object spread",
      wrapper: "consume({...replay(queued)})",
    },
    {
      name: "local return wrapper",
      wrapper:
        "function wrap(value){return {value}}consume(wrap(replay(queued)))",
    },
    {
      name: "arrow callback",
      wrapper: "consume(()=>replay(queued))",
    },
    {
      name: "getter callback",
      wrapper: "consume({get value(){return replay(queued)}})",
    },
    {
      name: "method callback",
      wrapper: "consume({value(){return replay(queued)}})",
    },
    {
      name: "async callback",
      wrapper: "consume(async()=>replay(queued))",
    },
    {
      name: "generator callback",
      wrapper: "consume(function*(){yield replay(queued)})",
    },
    {
      name: "Proxy getter",
      wrapper: "consume(new Proxy({}, {get(){return replay(queued)}}))",
    },
    {
      name: "microtask callback",
      wrapper: "queueMicrotask(()=>replay(queued))",
    },
    {
      name: "stored property callback",
      wrapper: "const box={cb:()=>replay(queued)};consume(box.cb)",
    },
    {
      name: "stored array callback",
      wrapper: "const list=[()=>replay(queued)];consume(list[0])",
    },
    {
      name: "later property callback",
      wrapper: "const box={};box.cb=()=>replay(queued);consume(box.cb)",
    },
    {
      name: "computed property callback",
      wrapper:
        "const box={};const key=()=>Math.random()?'cb':'cb';box[key()]=()=>replay(queued);consume(box[key()])",
    },
    {
      name: "local callback return",
      wrapper: "function make(){return ()=>replay(queued)}consume(make())",
    },
    {
      name: "local object callback return",
      wrapper:
        "function make(){return {cb:()=>replay(queued)}}consume(make().cb)",
    },
    {
      name: "stored getter callback",
      wrapper:
        "const box={get cb(){return ()=>replay(queued)}};consume(box.cb)",
    },
    {
      name: "conditional stored callback",
      wrapper:
        "const box={cb:()=>replay(queued)};consume(Math.random()?box.cb:()=>0)",
    },
    {
      name: "unknown computed nested callback",
      wrapper:
        "const box={};box.slot={cb:()=>replay(queued)};const key=()=>Math.random()?'slot':'slot';consume(box[key()].cb)",
    },
  ])(
    "rejects a tainted replay object hidden in a $name",
    async ({ wrapper }) => {
      const root = await fixture();
      await writeFile(
        resolve(root, "dist/assets/index.js"),
        `function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};${wrapper};`,
      );

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "browser global escape",
      });
    },
  );

  it("accepts a deferred callback consumed entirely by an analyzed local function", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};function ignore(_callback){return 0}ignore(()=>replay(queued));",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("terminates local-call discovery across a recursive object spread", async () => {
    const source = "let api;api={...api,run(){return 0}};api.run()";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("accepts recursive ordinary-value flow without browser-global seeds", async () => {
    const source = `
      function visit(value) {
        if (Array.isArray(value)) return value.map(visit);
        if (value && typeof value === 'object') {
          return Object.keys(value).flatMap((key) => visit(value[key]));
        }
        return [String(value)];
      }
      function run(state, callback) { return callback(state); }
      void run({ items: [1, { nested: 2 }] }, visit);
    `;
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("rejects when deferred traversal reaches its depth limit", async () => {
    const nested = Array.from({ length: 80 }).reduce<string>(
      (value, _, index) => `{p${index}:${value}}`,
      "0",
    );
    const source = [
      `consume(${nested});`,
      "function target(e){return e.target||window}",
      "function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}",
      "const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};",
      "const callback=()=>replay(queued);",
      "consume(callback);",
    ].join("\n");
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "analysis-limit",
      detail: "deferred analysis work budget exceeded",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "deferred analysis work budget exceeded",
    });
  });

  it("rejects when deferred traversal exhausts its total work budget", async () => {
    const previousBudget = process.env.PRIVATE_HOSTED_DEFERRED_BUDGET;
    process.env.PRIVATE_HOSTED_DEFERRED_BUDGET = "1";
    try {
      const source = [
        "consume([0,0]);",
        "function target(e){return e.target||window}",
        "function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}",
        "const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};",
        "const callback=()=>replay(queued);",
        "consume(callback);",
      ].join("\n");
      const root = await fixture(source);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "analysis-limit",
        detail: "deferred analysis work budget exceeded",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "browser global escape",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "deferred analysis work budget exceeded",
      });
    } finally {
      if (previousBudget === undefined) {
        delete process.env.PRIVATE_HOSTED_DEFERRED_BUDGET;
      } else {
        process.env.PRIVATE_HOSTED_DEFERRED_BUDGET = previousBudget;
      }
    }
  });

  it("finds a deferred replay callback through a cyclic alias graph", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};let first;let second=first;first=second;const choose=Math.random()<0;first=choose?second:()=>replay(queued);consume(second);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("rechecks a deferred callback shared by multiple consumers", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};const box={};consume(box.cb);box.cb=()=>replay(queued);consume(box.cb);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("finishes a benign deferred alias graph within a bounded time", async () => {
    const declarations = [
      "function target(e){return e.target||window}",
      "function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}",
      "const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};",
      "const choose = Math.random() < 0;",
      "const alias0 = {};",
    ];
    for (let index = 1; index <= 28; index += 1) {
      declarations.push(
        `const alias${index} = choose ? alias${index - 1} : alias${index - 1};`,
      );
    }
    declarations.push("consume(alias28);");
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      declarations.join("\n"),
    );

    const startedAt = performance.now();
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    const elapsedMs = performance.now() - startedAt;

    expect(findings).toEqual([]);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 10_000);

  it("rejects a privileged logical assignment through a local writer", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');function poison(box){box.blockedOn||=window}const queued={blockedOn:null};poison(queued);queued.blockedOn[key]('/state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "browser global escape",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "network API",
        },
      ]),
    );
  });

  it("accepts a React-style constructor returned by a same-name-parameter factory", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "let target=window;function Factory(seed){function Event(Event,b,c,d,e){this._reactName=Event;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}return seed(),Event}const Synthetic=Factory(()=>{});const event=new Synthetic('onSelect','select',null,{},target);event.target=target;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it.each([
    {
      name: "object alias",
      access: "const alias=event;void alias.target[key]('/state')",
    },
    {
      name: "computed object alias",
      access: "const alias=event;void alias['target'][key]('/state')",
    },
    {
      name: "object destructuring",
      access: "const {target:browser}=event;void browser[key]('/state')",
    },
    {
      name: "local property getter",
      access:
        "function get(x){return x.target}const browser=get(event);void browser[key]('/state')",
    },
    {
      name: "destructured local function parameter",
      access:
        "function get({target}){return target}const browser=get(event);void browser[key]('/state')",
    },
    {
      name: "computed destructuring",
      access:
        "const prop='target';const {[prop]:browser}=event;void browser[key]('/state')",
    },
    {
      name: "conditional alias",
      access: "const alias=true?event:event;void alias.target[key]('/state')",
    },
    {
      name: "logical alias",
      access: "const alias=event||event;void alias.target[key]('/state')",
    },
    {
      name: "comma alias",
      access: "const alias=(0,event);void alias.target[key]('/state')",
    },
    {
      name: "identity function alias",
      access:
        "function id(x){return x}const alias=id(event);void alias.target[key]('/state')",
    },
    {
      name: "inline identity function",
      access: "function id(x){return x}void id(event).target[key]('/state')",
    },
    {
      name: "inline arrow identity function",
      access: "void ((x)=>x)(event).target[key]('/state')",
    },
    {
      name: "object member identity function",
      access:
        "const helper={id:x=>x};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object method identity function",
      access:
        "const helper={id(x){return x}};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object getter identity function",
      access:
        "const helper={get id(){return x=>x}};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object container",
      access: "const box={event};void box.event.target[key]('/state')",
    },
    {
      name: "array container",
      access: "const list=[event];void list[0].target[key]('/state')",
    },
  ])(
    "rejects a synthetic event target escape through $name",
    async ({ access }) => {
      const root = await fixture();
      await writeFile(
        resolve(root, "dist/assets/index.js"),
        `const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);event.target=window;${access};`,
      );

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(
        findings.filter(({ file }) => file === "dist/assets/index.js"),
      ).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "network API",
      });
    },
  );

  it.each([
    {
      name: "identity function created before taint",
      setup:
        "function id(x){return x}const alias=id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "inline arrow identity created before taint",
      setup:
        "const alias=((x)=>x)(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member arrow identity created before taint",
      setup:
        "const helper={id:x=>x};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member method identity created before taint",
      setup:
        "const helper={id(x){return x}};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member getter identity created before taint",
      setup:
        "const helper={get id(){return x=>x}};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "object container created before taint",
      setup:
        "const box={event};event.target=window;void box.event.target[key]('/state')",
    },
    {
      name: "array container created before taint",
      setup:
        "const list=[event];event.target=window;void list[0].target[key]('/state')",
    },
    {
      name: "nested container linked before taint",
      setup:
        "const inner={};const box={inner};inner.target=window;void box.inner.target[key]('/state')",
    },
  ])("rejects $name in source and bundle", async ({ setup }) => {
    const prelude =
      "const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);";
    const root = await fixture(
      `${prelude}${setup};export default function App(){}`,
    );
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `${prelude}${setup};`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "window.fetch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it.each([
    {
      name: "object destructuring assignment",
      setup: "let browser;({target:browser}=event);void browser[key]('/state')",
    },
    {
      name: "array destructuring through a container",
      setup:
        "const list=[event];const [alias]=list;void alias.target[key]('/state')",
    },
  ])("rejects $name in source and bundle", async ({ setup }) => {
    const prelude =
      "const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);event.target=window;";
    const root = await fixture(
      `${prelude}${setup};export default function App(){}`,
    );
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `${prelude}${setup};`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "window.fetch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects a DOM browser object recovered by destructuring assignment", async () => {
    const source =
      "const key=['fe','tch'].join('');let doc;({ownerDocument:doc}=document.body);void doc.defaultView[key]('/state');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "network-api",
      detail: "window.fetch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it.each([
    { name: "Function constructor", source: "Function('return window')()" },
    { name: "indirect eval", source: "(0,eval)(\"fetch('/state')\")" },
    { name: "window eval", source: "window.eval(\"fetch('/state')\")" },
  ])("rejects dynamic execution through $name", async ({ source }) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it.each([
    { name: "bare timer", source: "setTimeout(\"localStorage.x='1'\",0)" },
    {
      name: "aliased timer",
      source: "const timer=setInterval;timer(\"fetch('/state')\",0)",
    },
    {
      name: "window timer",
      source: "window.setTimeout(\"fetch('/state')\",0)",
    },
  ])("rejects string execution through a $name", async ({ source }) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it.each([
    {
      name: "Function.call",
      source: "window.setTimeout.call(window,\"fetch('/state')\",0)",
    },
    {
      name: "Function.apply",
      source: "setInterval.apply(window,[\"fetch('/state')\",0])",
    },
    {
      name: "Function.bind alias",
      source:
        "const timer=setTimeout.bind(window);timer(\"fetch('/state')\",0)",
    },
    {
      name: "Reflect.apply",
      source: "Reflect.apply(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "Reflect namespace alias",
      source:
        "const R=Reflect;R.apply(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "globalThis.Reflect.apply",
      source:
        "globalThis.Reflect.apply(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "window computed Reflect.apply",
      source:
        "window['Reflect']['apply'](setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "comma Reflect.apply",
      source: "(0,Reflect.apply)(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "comma qualified Reflect.apply",
      source:
        "(0,globalThis.Reflect.apply)(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "Reflect.apply alias",
      source:
        "const invoke=Reflect.apply;invoke(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "destructured Reflect.apply alias",
      source:
        "const {apply:invoke}=Reflect;invoke(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "projected Reflect.apply alias",
      source:
        "const [invoke]=[Reflect.apply];invoke(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "Reflect.apply.call",
      source:
        "Reflect.apply.call(Reflect,setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "Reflect.apply.bind",
      source:
        "Reflect.apply.bind(Reflect)(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
    {
      name: "computed Function.call",
      source:
        "const method='call';setTimeout[method](undefined,\"fetch('/state')\",0)",
    },
    {
      name: "Function.call alias",
      source:
        "const invoke=setTimeout.call;invoke(setTimeout,undefined,\"fetch('/state')\",0)",
    },
    {
      name: "Function.call.call",
      source:
        "setTimeout.call.call(setTimeout,undefined,\"fetch('/state')\",0)",
    },
    {
      name: "Function.apply.call",
      source:
        "setTimeout.apply.call(setTimeout,undefined,[\"fetch('/state')\",0])",
    },
  ])("rejects string execution through timer $name", async ({ source }) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("accepts a shadowed local timer receiving a string", async () => {
    const source =
      "function setTimeout(value:string){void value}setTimeout('safe');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function setTimeout(value){void value}setTimeout('safe');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("accepts a timer alias overwritten by a local callable before invocation", async () => {
    const source =
      "let timer=setTimeout;timer=(value:string)=>void value;timer('safe');";
    const bundle =
      "let timer=setTimeout;timer=value=>void value;timer('safe');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("accepts a timer alias overwritten by a hoisted function declaration", async () => {
    const source =
      "let timer=setTimeout;timer=safe;timer('safe');function safe(value:string){void value}";
    const bundle =
      "let timer=setTimeout;timer=safe;timer('safe');function safe(value){void value}";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("accepts Reflect.apply for a non-timer callable with an opaque argument array", async () => {
    const source =
      "function invoke(value:(...args:unknown[])=>unknown,args:unknown[]){return Reflect.apply(value,null,args)}";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function invoke(value,args){return Reflect.apply(value,null,args)}",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it.each([
    {
      name: "typed string parameter",
      source:
        "function schedule(code:string){setTimeout(code,0)}schedule('void 0')",
      bundle: "function schedule(code){setTimeout(code,0)}schedule('void 0')",
    },
    {
      name: "string-or-callback parameter",
      source: "function schedule(code:string|(()=>void)){setInterval(code,0)}",
      bundle: "function schedule(code){setInterval(code,0)}",
    },
    {
      name: "any parameter",
      source: "function schedule(code:any){setTimeout(code,0)}",
      bundle: "function schedule(code){setTimeout(code,0)}",
    },
    {
      name: "imported unknown callback",
      source: "import { callback } from './callback';setTimeout(callback,0)",
      bundle: "setTimeout(importedCallback,0)",
    },
  ])(
    "rejects an unresolved $name passed to a browser timer",
    async ({ source, bundle }) => {
      const root = await fixture(`${source};export default function App(){}`);
      if (source.includes("./callback")) {
        await writeFile(
          resolve(root, "src/callback.ts"),
          "export const callback:any=()=>{};",
        );
      }
      await writeFile(resolve(root, "dist/assets/index.js"), bundle);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "dynamic-code-execution",
        detail: "eval/Function",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    },
  );

  it("accepts statically proven browser timer callbacks", async () => {
    const source = `
      import { useCallback } from 'react';
      function declared() {}
      const inline = () => {};
      const memoized = useCallback(() => {}, []);
      setTimeout(declared, 0);
      setTimeout(inline, 0);
      setTimeout(memoized, 0);
      setInterval(() => {}, 0);
      export default function App() {}
    `;
    const root = await fixture(source);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function declared(){}const inline=()=>{};setTimeout(declared,0);setTimeout(inline,0);setInterval(()=>{},0);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("rejects a reassigned function declaration used as a timer handler", async () => {
    const source =
      "function handler(){};handler='void 0' as unknown as typeof handler;setTimeout(handler,0)";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function handler(){};handler='void 0';setTimeout(handler,0);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it.each([
    {
      name: "compound assignment",
      source:
        "function handler(){};handler&&=('void 0' as unknown as typeof handler);setTimeout(handler,0)",
      bundle: "function handler(){};handler&&='void 0';setTimeout(handler,0)",
    },
    {
      name: "destructuring assignment",
      source:
        "let handler=()=>{};[handler]=(['void 0'] as unknown as [typeof handler]);setTimeout(handler,0)",
      bundle: "let handler=()=>{};[handler]=['void 0'];setTimeout(handler,0)",
    },
    {
      name: "for-of assignment",
      source:
        "let handler:any=()=>{};for(handler of ['void 0']){}setTimeout(handler,0)",
      bundle:
        "let handler=()=>{};for(handler of ['void 0']){}setTimeout(handler,0)",
    },
  ])("rejects a callable changed through $name", async ({ source, bundle }) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects a spoofed bundle useCallback result used as a timer handler", async () => {
    const source =
      "const Fake={useCallback(){return 'void 0'}};const cb=Fake.useCallback(()=>{});setTimeout(cb,0)";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects vendor-shaped but untrusted bundle hook provenance", async () => {
    const source = "const cb='void 0';setTimeout(cb,0)";
    const bundle =
      "import{a as factory}from'./vendor-FAKE.js';const interop=()=>({useCallback(){return 'void 0'}}),Fake=interop(factory());const cb=Fake.useCallback(()=>{});setTimeout(cb,0)";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects mutation of a trusted React hook namespace", async () => {
    const source = `
      import React from 'react';
      (React as any).useCallback = () => 'void 0';
      const cb = React.useCallback(() => {}, []);
      setTimeout(cb, 0);
      export default function App() {}
    `;
    const bundle =
      "import{a as factory}from'./vendor-AAAA.js';import{interop}from'./rolldown-runtime-BBBB.js';const React=interop(factory(),1);React.useCallback=()=>\"void 0\";const cb=React.useCallback(()=>{},[]);setTimeout(cb,0)";
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), bundle);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it.each([
    {
      name: "namespace alias reassignment",
      mutation:
        'let Hooks:any=React;Hooks={useCallback:()=>"void 0"};const cb=Hooks.useCallback(()=>{},[])',
    },
    {
      name: "Object.assign",
      mutation:
        'Object.assign(React as any,{useCallback:()=>"void 0"});const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "Object.defineProperty",
      mutation:
        "Object.defineProperty(React as any,'useCallback',{value:()=>\"void 0\"});const cb=React.useCallback(()=>{},[])",
    },
    {
      name: "Reflect.defineProperty",
      mutation:
        "Reflect.defineProperty(React as any,'useCallback',{value:()=>\"void 0\"});const cb=React.useCallback(()=>{},[])",
    },
    {
      name: "aliased Object.defineProperty",
      mutation:
        "const mutate=Object.defineProperty;mutate(React as any,'useCallback',{value:()=>\"void 0\"});const cb=React.useCallback(()=>{},[])",
    },
    {
      name: "destructured Reflect.defineProperty",
      mutation:
        "const {defineProperty:mutate}=Reflect;mutate(React as any,'useCallback',{value:()=>\"void 0\"});const cb=React.useCallback(()=>{},[])",
    },
    {
      name: "projected Object.assign",
      mutation:
        'const [mutate]=[Object.assign];mutate(React as any,{useCallback:()=>"void 0"});const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "Reflect.set",
      mutation:
        "Reflect.set(React as any,'useCallback',()=>\"void 0\");const cb=React.useCallback(()=>{},[])",
    },
    {
      name: "prototype replacement",
      mutation:
        'Object.setPrototypeOf(React as any,{useCallback:()=>"void 0"});const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "opaque computed write",
      mutation:
        'declare const key:string;(React as any)[key]=()=>"void 0";const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "Object.assign nonliteral payload",
      mutation:
        'const patch:any={useCallback:()=>"void 0"};Object.assign(React as any,patch);const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "Object.assign spread payload",
      mutation:
        'const patch:any={useCallback:()=>"void 0"};Object.assign(React as any,{...patch});const cb=React.useCallback(()=>{},[])',
    },
    {
      name: "Object.defineProperties nonliteral payload",
      mutation:
        'const patch:any={useCallback:{value:()=>"void 0"}};Object.defineProperties(React as any,patch);const cb=React.useCallback(()=>{},[])',
    },
  ])("rejects React hook trust after $name", async ({ mutation }) => {
    const source = `import React from 'react';${mutation};setTimeout(cb,0);export default function App(){}`;
    const root = await fixture(source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
  });

  it("requires the exact qualified bundle React interop argument shape", () => {
    const trusted = {
      vendor: new Set(["./vendor-qualified.js"]),
      runtime: new Set(["./rolldown-runtime-qualified.js"]),
    };
    const valid =
      "import{r as interop}from'./rolldown-runtime-qualified.js';import{l as factory}from'./vendor-qualified.js';const React=interop(factory(),1);const cb=React.useCallback(()=>{});setTimeout(cb,0)";
    const validNamespace =
      "import{r as interop}from'./rolldown-runtime-qualified.js';import*as Vendor from'./vendor-qualified.js';const React=interop(Vendor.l(),1);const cb=React.useCallback(()=>{});setTimeout(cb,0)";
    const spoofed =
      "import{r as interop}from'./rolldown-runtime-qualified.js';import{l as factory}from'./vendor-qualified.js';const fake={useCallback(){return'void 0'}};const React=interop(fake,factory());const cb=React.useCallback(()=>{});setTimeout(cb,0)";

    expect(scanScriptOriginsWithTrustedImportsForTest(valid, trusted)).toEqual(
      [],
    );
    expect(
      scanScriptOriginsWithTrustedImportsForTest(validNamespace, trusted),
    ).toEqual([]);
    expect(
      scanScriptOriginsWithTrustedImportsForTest(spoofed, trusted),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it.each([
    {
      name: "cached vendor result mutation",
      body: 'const core=factory();core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "indirect vendor factory exposure",
      body: "const invoke=factory;const React=interop(factory(),1);const cb=React.useCallback(()=>{})",
    },
    {
      name: "mutation through a sibling interop namespace",
      body: 'const First=interop(factory(),1);First.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "mutation through a sibling default projection",
      body: 'const First=interop(factory(),1);First.default.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "mutation through a sibling default alias",
      body: 'const First=interop(factory(),1);const Core=First.default;Core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "mutation through a destructured sibling default",
      body: 'const First=interop(factory(),1);const {default:Core}=First;Core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "opaque mutation through a sibling default alias",
      body: 'const First=interop(factory(),1);const Core=First.default;const mutate=value=>{value.useCallback=()=>"void 0"};mutate(Core);const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "mutation through an assigned destructured sibling default",
      body: 'const First=interop(factory(),1);let Core;({default:Core}=First);Core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "mutation through an assigned projected sibling default",
      body: 'const First=interop(factory(),1);let Core;[Core]=[First.default];Core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "duplicate named import exposure",
      imports:
        "import{r as interop}from'./rolldown-runtime-qualified.js';import{l as factory}from'./vendor-qualified.js';import{l as expose}from'./vendor-qualified.js';",
      body: 'const core=expose();core.useCallback=()=>"void 0";const React=interop(factory(),1);const cb=React.useCallback(()=>{})',
    },
    {
      name: "namespace import exposure",
      imports:
        "import{r as interop}from'./rolldown-runtime-qualified.js';import*as Vendor from'./vendor-qualified.js';",
      body: 'const core=Vendor.l();core.useCallback=()=>"void 0";const React=interop(Vendor.l(),1);const cb=React.useCallback(()=>{})',
    },
  ])(
    "rejects trusted React hook provenance after $name",
    ({ body, imports }) => {
      const trusted = {
        vendor: new Set(["./vendor-qualified.js"]),
        runtime: new Set(["./rolldown-runtime-qualified.js"]),
      };
      const defaultImports =
        "import{r as interop}from'./rolldown-runtime-qualified.js';import{l as factory}from'./vendor-qualified.js';";
      const bundle = `${imports ?? defaultImports}${body};setTimeout(cb,0)`;

      expect(
        scanScriptOriginsWithTrustedImportsForTest(bundle, trusted),
      ).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    },
  );

  it("accepts Function source introspection without executing generated code", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const text=Function.toString.call(()=>0);void text;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it.each([
    {
      name: "arrow function constructor",
      source: "(()=>0).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "object method constructor",
      source: "({m(){}}).m.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "built-in method constructor",
      source: "[].filter.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "bound constructor alias",
      source:
        "const Factory=(()=>0).constructor.bind(null);Factory(\"return fetch('/state')\")()",
    },
    {
      name: "introspection method alias constructor",
      source:
        "const inspect=Function.toString.call;inspect.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "parenthesized introspection method constructor",
      source:
        "(Function.toString.call).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "array element function constructor",
      source:
        "const list=[()=>0];list[0].constructor(\"return fetch('/state')\")()",
    },
    {
      name: "later property function constructor",
      source:
        "const box={};box.fn=()=>0;box.fn.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "prototype method constructor",
      source:
        "Array.prototype.filter.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "destructured prototype method constructor",
      source:
        "const {filter}=Array.prototype;filter.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "Promise method constructor",
      source: "Promise.resolve.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "timer constructor",
      source: "setTimeout.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "DOM method constructor",
      source:
        "document.createElement.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "prototype lookup constructor",
      source:
        "Object.getPrototypeOf(()=>0).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "legacy prototype constructor",
      source: "(()=>0).__proto__.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "async function constructor",
      source:
        "Object.getPrototypeOf(async()=>0).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "generator function constructor",
      source:
        "Object.getPrototypeOf(function*(){}).constructor(\"fetch('/state')\")().next()",
    },
    {
      name: "constructor call forwarding",
      source:
        "Array.prototype.filter.constructor.call(null,\"return fetch('/state')\")()",
    },
    {
      name: "constructor apply forwarding",
      source:
        "const C=Array.prototype.filter.constructor.apply(null,[\"return fetch('/state')\"]);C()",
    },
    {
      name: "Reflect constructor lookup",
      source: "Reflect.get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "destructured constructor",
      source:
        "const {constructor:C}=Array.prototype.filter;C(\"return fetch('/state')\")()",
    },
    {
      name: "destructuring assignment constructor",
      source:
        "let C;({constructor:C}=Array.prototype.filter);C(\"return fetch('/state')\")()",
    },
    {
      name: "computed destructuring assignment constructor",
      source:
        "const key=['con','structor'].join('');let C;({[key]:C}=()=>0);C(\"return fetch('/state')\")()",
    },
    {
      name: "array-stored constructor",
      source:
        "const list=[(()=>0).constructor];list[0](\"return fetch('/state')\")()",
    },
    {
      name: "object-stored constructor",
      source:
        "const box={C:(()=>0).constructor};box.C(\"return fetch('/state')\")()",
    },
    {
      name: "later-stored constructor",
      source:
        "const box={};box.C=(()=>0).constructor;box.C(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect apply constructor",
      source:
        "Reflect.apply((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "Reflect construct constructor",
      source:
        "Reflect.construct((()=>0).constructor,[\"return fetch('/state')\"])()",
    },
    {
      name: "runtime decoded constructor key",
      source:
        "const key=atob('Y29uc3RydWN0b3I=');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime String constructor key",
      source:
        "const key=String('constructor');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime character-code constructor key",
      source:
        "const key=String.fromCharCode(...[99,111,110,115,116,114,117,99,116,111,114]);(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime local-return constructor key",
      source:
        "function key(){return 'constructor'}(()=>0)[key()](\"return fetch('/state')\")()",
    },
    {
      name: "runtime array constructor key",
      source:
        "const keys=['constructor'];const i=Number(location.hash);(()=>0)[keys[i]](\"return fetch('/state')\")()",
    },
    {
      name: "runtime reversed constructor key",
      source:
        "const key='rotcurtsnoc'.split('').reverse().join('');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "parameter destructured constructor",
      source:
        "function run({constructor:C}){return C(\"return fetch('/state')\")()}run(()=>0)",
    },
    {
      name: "nested destructured constructor",
      source:
        "const {x:{constructor:C}}={x:()=>0};C(\"return fetch('/state')\")()",
    },
    {
      name: "nested property write",
      source:
        "const outer={inner:{}};outer.inner.C=(()=>0).constructor;outer.inner.C(\"return fetch('/state')\")()",
    },
    {
      name: "destructure into property",
      source:
        "const box={};({constructor:box.C}=()=>0);box.C(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.get alias",
      source:
        "const get=Reflect.get;get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect namespace alias",
      source:
        "const R=Reflect;R.get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.get call forwarding",
      source:
        "Reflect.get.call(null,()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.apply alias",
      source:
        "const invoke=Reflect.apply;invoke((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "bound Reflect.apply",
      source:
        "Reflect.apply.bind(Reflect)((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "constructor descriptor value",
      source:
        "Object.getOwnPropertyDescriptor(Object.getPrototypeOf(()=>0),'constructor').value(\"return fetch('/state')\")()",
    },
    {
      name: "constructor on a returned object",
      source:
        "function make(){return {C:(()=>0).constructor}}make().C(\"return fetch('/state')\")()",
    },
    {
      name: "constructor on a nested returned object",
      source:
        "function make(){return {inner:{C:(()=>0).constructor}}}make().inner.C(\"return fetch('/state')\")()",
    },
    {
      name: "constructor write through a returned object",
      source:
        "const box={};function get(){return box}get().C=(()=>0).constructor;get().C(\"return fetch('/state')\")()",
    },
    {
      name: "computed constructor write through a returned object",
      source:
        "const box={};function get(){return box}const key=()=>Math.random()?'C':'C';get()[key()]=(()=>0).constructor;get()[key()](\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.get apply forwarding",
      source:
        "Reflect.get.apply(null,[()=>0,'constructor'])(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.apply apply forwarding",
      source:
        "Reflect.apply.apply(null,[(()=>0).constructor,null,[\"return fetch('/state')\"]])()",
    },
    {
      name: "destructured Reflect.get",
      source:
        "const {get}=Reflect;get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "renamed destructured Reflect.apply",
      source:
        "const {apply:invoke}=Reflect;invoke((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "defaulted destructured Reflect.get forwarding",
      source:
        "const {get:read=Reflect.get}=Reflect;read.call(null,()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "nested destructured Reflect.get apply forwarding",
      source:
        "const {api:{get:read}}={api:Reflect};read.apply(null,[()=>0,'constructor'])(\"return fetch('/state')\")()",
    },
    {
      name: "destructured bound Reflect.apply",
      source:
        "const {apply:invoke}=Reflect;invoke.bind(Reflect)((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "ordinary parameter constructor flow",
      source:
        "function run(C){return C(\"return fetch('/state')\")()}run((()=>0).constructor)",
    },
    {
      name: "Object.defineProperty constructor write",
      source:
        "const box={};Object.defineProperty(box,'C',{value:(()=>0).constructor});box.C(\"return fetch('/state')\")()",
    },
    {
      name: "aliased Object.defineProperty descriptor write",
      source:
        "const box={};const descriptor={value:(()=>0).constructor};const O=Object;O.defineProperty(box,'C',descriptor);box.C(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.defineProperty constructor write",
      source:
        "const box={};Reflect.defineProperty(box,'C',{value:(()=>0).constructor});box.C(\"return fetch('/state')\")()",
    },
    {
      name: "aliased constructor descriptor read",
      source:
        "const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(()=>0),'constructor');descriptor.value(\"return fetch('/state')\")()",
    },
    {
      name: "array projected Reflect namespace",
      source:
        "const [R]=[Reflect];R.apply((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "object projected Reflect namespace",
      source:
        "const {api:R}={api:Reflect};R.get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "returned Reflect namespace",
      source:
        "function getR(){return Reflect}getR().apply((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
  ])(
    "rejects dynamic constructor recovery through $name",
    async ({ source }) => {
      const root = await fixture(`${source};export default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "dynamic-code-execution",
        detail: "eval/Function",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    },
  );

  it("rejects a constructor lookalike without replay-event provenance", async () => {
    const source =
      "function clone(e){const n=e.nativeEvent;return new n.constructor(n.type,n)}clone({nativeEvent:()=>0});";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects a spoofed React replay constructor in source and bundle", async () => {
    const source =
      "function payload(){}payload.type='x';payload.toString=()=>\"return fetch('/state')\";function replay(e){void e.blockedOn;void e.targetContainers;const n=e.nativeEvent;return new n.constructor(n.type,n)}replay({blockedOn:null,targetContainers:[],nativeEvent:payload})()";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects replay-like constructor bookkeeping hidden in unreachable code", async () => {
    const source =
      "function replay(e){const n=e.nativeEvent;if(false){e.blockedOn=null;e.targetContainers.shift();window.dispatchEvent(n)}return new n.constructor(n.type,n)}replay({blockedOn:null,targetContainers:[],nativeEvent:()=>0})()";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("accepts a primitive constructor call that cannot create executable code", async () => {
    const source = "void Math.PI.constructor('123')";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it.each([
    "const value=Math.PI;void value.constructor('123')",
    "const {constructor:C}=Math.PI;void C('123')",
  ])("accepts a non-executable primitive constructor alias", async (source) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("rejects when dynamic projection reaches its depth limit", async () => {
    const properties = Array.from({ length: 70 }, (_, index) => `p${index}`);
    const nested = properties.reduceRight(
      (value, property) => `{${property}:${value}}`,
      "{}",
    );
    const source = `const box=${nested};void box.${properties.join(".")}.C()`;
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("finds a dynamic constructor reached through a cyclic alias graph", async () => {
    const source = `
      let first;
      let second = first;
      first = second;
      const choose = Math.random() < 0;
      first = choose ? second : (() => 0).constructor;
      second("return fetch('/state')")();
    `;
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("finishes a benign branching alias graph within a bounded time", async () => {
    const declarations = [
      "const choose = Math.random() < 0;",
      "const alias0 = {};",
    ];
    for (let index = 1; index <= 28; index += 1) {
      declarations.push(
        `const alias${index} = choose ? alias${index - 1} : alias${index - 1};`,
      );
    }
    declarations.push("void alias28.run();");
    const source = declarations.join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const startedAt = performance.now();
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    const elapsedMs = performance.now() - startedAt;

    expect(findings).toEqual([]);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 10_000);

  it("accepts benign value, type, and displayName propagation", async () => {
    const source = [
      "const component={};",
      "const wrapper={value:component};",
      "const metadata={type:wrapper.value};",
      "const registry={displayName:metadata.type};",
      "registry.displayName();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const startedAt = performance.now();
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  }, 10_000);

  it("keeps an unknown property copy scoped to its owner", async () => {
    const source = [
      "function copy(target, source){for(const key in source)target[key]=source[key];return target}",
      "const component={};",
      "const props={value:component,type:component,displayName:'Card'};",
      "const result=copy({},props);",
      "void result.value;void result.type;void result.displayName;",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const startedAt = performance.now();
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  }, 10_000);

  it("does not turn a generic props copy into dynamic code when another call is callable", async () => {
    const previousBudget = process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
    process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = "0";
    const source = [
      "function select(value,copy){",
      "  if(!copy)return value;",
      "  const result={};",
      "  for(const key in value)result[key]=value[key];",
      "  return result;",
      "}",
      "void select(()=>1,false);",
      "const props={render(){return 1},label:'Card'};",
      "const copied=select(props,true);",
      "void copied.render();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);
    try {
      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings).toEqual([]);
    } finally {
      if (previousBudget === undefined) {
        delete process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
      } else {
        process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = previousBudget;
      }
    }
  });

  it("uses the latest definite value when a minified local is reused before a props copy", async () => {
    const source = [
      "function copy(type,props){",
      "  const result={};",
      "  for(const key in props)result[key]=props[key];",
      "  return result;",
      "}",
      "function render(type,pendingProps){",
      "  let props=type;",
      "  props=pendingProps;",
      "  return copy(type,props);",
      "}",
      "const component=()=>1;",
      "const copied=render(component,{render(){return 1},label:'Card'});",
      "void copied.render();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual([]);
  });

  it("does not confuse an aliased Symbol.iterator lookup with constructor recovery", async () => {
    const source = [
      "const iteratorKey=Symbol.iterator;",
      "function iteratorOf(value){return value[iteratorKey]||value['@@iterator']}",
      "const callable=()=>1;",
      "const iterator=iteratorOf(callable);",
      "if(iterator)iterator.call(callable);",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual([]);
  });

  it("keeps a dynamic constructor property scoped away from an unrelated owner", async () => {
    const declarations = [
      "const dangerousOwner={};",
      "dangerousOwner.ref=(()=>0).constructor;",
      "const safe0={ref(){return 1}};",
    ];
    for (let index = 1; index <= 160; index += 1) {
      declarations.push(`const safe${index}=safe${index - 1};`);
    }
    declarations.push("void safe160.ref();");
    const source = declarations.join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const startedAt = performance.now();
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  }, 10_000);

  it("rejects a dynamic constructor property reached through a nested owner alias", async () => {
    const source = [
      "const owner={child:{}};",
      "const alias=owner.child;",
      "alias.ref=(()=>0).constructor;",
      "owner.child.ref(\"return fetch('/state')\")();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("abstracts converging cyclic owner paths within the shared candidate budget", async () => {
    const source = [
      "let choose=false;",
      "let owner={left:{},right:{}};",
      "owner=choose?owner.left:owner.right;",
      "owner.ref=(()=>0).constructor;",
      "owner.ref(\"return fetch('/state')\")();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);
    const previousBudget = process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
    process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = "50000";

    try {
      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings).not.toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic property candidate shared budget exceeded",
      });
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "dynamic-code-execution",
        detail: "eval/Function",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    } finally {
      if (previousBudget === undefined) {
        delete process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
      } else {
        process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = previousBudget;
      }
    }
  });

  it("rejects a dynamic constructor property written through a pass-through call", async () => {
    const source = [
      "function identity(value){return value}",
      "const owner={};",
      "identity(owner).ref=(()=>0).constructor;",
      "owner.ref(\"return fetch('/state')\")();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("does not treat a reassigned parameter as a returned argument", async () => {
    const source = [
      "function allocate(value,lane){return value={},value.lanes=lane,value}",
      "allocate((()=>0).constructor,1)(\"return fetch('/state')\")();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual([]);
  });

  it("keeps pass-through taint when reassignment may preserve the original", async () => {
    const variants = [
      ["let opaque;", "function wrap(value){return value=opaque(value),value}"],
      [
        "function identity(value){return value}",
        "function wrap(value){return value=identity(value),value}",
      ],
      [
        "function wrap(value){const original=value;return value={},value=original,value}",
      ],
    ];
    for (const declarations of variants) {
      const source = [
        ...declarations,
        "wrap((()=>0).constructor)(\"return fetch('/state')\")();",
      ].join("\n");
      const root = await fixture(`${source}\nexport default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "dynamic-code-execution",
        detail: "eval/Function",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    }
  });

  it("accepts only definite fresh parameter overwrites", async () => {
    const variants = [
      "function wrap(value){value={};return value}",
      "function wrap(value,choose){if(choose)value={};else value=[];return value}",
      "function fresh(){return {}}function wrap(value){value=fresh();return value}",
    ];
    for (const declaration of variants) {
      const source = [
        declaration,
        "wrap((()=>0).constructor,true)(\"return fetch('/state')\")();",
      ].join("\n");
      const root = await fixture(`${source}\nexport default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings, declaration).toEqual([]);
    }
  });

  it("preserves parameter taint on conditional, logical, constructor, and early returns", async () => {
    const variants = [
      "function wrap(value,choose){if(choose)value={};return value}",
      "function wrap(value){value||={};return value}",
      "function Box(value){return value}function wrap(value){return new Box(value)}",
      "function wrap(value,choose){if(choose)return value;value={};return value}",
      "function wrap(value){value.flag=true;return value}",
    ];
    for (const declaration of variants) {
      const source = [
        declaration,
        "wrap((()=>0).constructor,false)(\"return fetch('/state')\")();",
      ].join("\n");
      const root = await fixture(`${source}\nexport default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "dynamic-code-execution",
        detail: "eval/Function",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic code execution",
      });
    }
  });

  it("fails closed when a dynamic constructor owner comes from an opaque call", async () => {
    const source = [
      "let factory;",
      "factory().ref=(()=>0).constructor;",
      "const safe={ref(){return 1}};",
      "safe.ref();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("fails closed when the shared dynamic candidate budget is exhausted", async () => {
    const previousBudget = process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
    process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = "1";
    try {
      const source =
        "const owner={};owner.ref=(()=>0).constructor;void owner.ref;";
      const root = await fixture(`${source}\nexport default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));

      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "analysis-limit",
        detail: "dynamic property candidate shared budget exceeded",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "dynamic property candidate shared budget exceeded",
      });
      expect(
        findings.some(({ detail }) => detail.includes("deferred analysis")),
      ).toBe(false);
      expect(
        findings.some(({ detail }) => detail === "browser global escape"),
      ).toBe(false);
      expect(
        findings.some(({ detail }) => detail === "dynamic browser property"),
      ).toBe(false);
      expect(
        findings.some(({ detail }) => detail === "dynamic code execution"),
      ).toBe(false);
      expect(findings.some(({ detail }) => detail === "eval/Function")).toBe(
        false,
      );
    } finally {
      if (previousBudget === undefined) {
        delete process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET;
      } else {
        process.env.PRIVATE_HOSTED_CANDIDATE_BUDGET = previousBudget;
      }
    }
  });

  it("rejects a dynamic constructor seed reached after a cyclic candidate branch", async () => {
    const source = [
      "let first;",
      "let second=first;",
      "first=second;",
      "const choose=Math.random()<0;",
      "first=choose?second:(()=>0).constructor;",
      "first(\"return fetch('/state')\")();",
    ].join("\n");
    const root = await fixture(`${source}\nexport default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/App.tsx",
      code: "dynamic-code-execution",
      detail: "eval/Function",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "dynamic code execution",
    });
  });

  it("rejects a browser global hidden behind an event-like property name", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');const box={};box.target=window;void box.target[key];",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toEqual(
      expect.arrayContaining([
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "browser global escape",
        },
        {
          file: "dist/assets/index.js",
          code: "forbidden-bundle-marker",
          detail: "network API",
        },
      ]),
    );
  });

  it.each([
    {
      name: "member call",
      source: "const box=[];const browser=window;box.push(browser)",
    },
    {
      name: "unresolved library call",
      source: "const box={};const browser=window;Object.assign(box,{browser})",
    },
  ])("rejects a privileged value passed to a $name", async ({ source }) => {
    const root = await fixture();
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it.each([
    { name: "window self reference", owner: "window.window" },
    { name: "window parent", owner: "window.parent" },
    { name: "window top", owner: "window.top" },
    { name: "window frames", owner: "window.frames" },
    {
      name: "window document defaultView",
      owner: "window.document.defaultView",
    },
    { name: "document defaultView", owner: "document.defaultView" },
    {
      name: "DOM ownerDocument defaultView",
      owner: "document.body.ownerDocument.defaultView",
    },
    {
      name: "created DOM ownerDocument defaultView",
      owner: "document.createElement('div').ownerDocument.defaultView",
    },
  ])(
    "rejects dynamic access through $name in source and bundle",
    async ({ owner }) => {
      const source = `const key=['fe','tch'].join('');void ${owner}[key];`;
      const root = await fixture(`${source}export default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "network-api",
        detail: "window.fetch",
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "network API",
      });
    },
  );

  it.each([
    {
      name: "aliased window parent",
      source: "const p=window.parent;void p[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "aliased navigator",
      source: "const n=window.navigator;void n[sendBeaconKey]('/state')",
      detail: "navigator.sendBeacon",
    },
    {
      name: "aliased window document",
      source: "const d=window.document;void d.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "aliased document defaultView",
      source: "const w=document.defaultView;void w[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "window opener",
      source: "void window.opener[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "firstElementChild ownerDocument",
      source:
        "void document.firstElementChild.ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "collection ownerDocument",
      source:
        "void document.getElementsByTagName('body')[0].ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "computed document method",
      source:
        "const make='createElement';void document[make]('div').ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "computed global document",
      source:
        "const doc='document';void globalThis[doc].defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "aliased DOM ownerDocument",
      source:
        "const body=document.body;const doc=body.ownerDocument;void doc.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "destructured DOM ownerDocument",
      source:
        "const {ownerDocument}=document.body;void ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
  ])(
    "rejects browser accessor flow through $name",
    async ({ source, detail }) => {
      const prelude =
        "const key=['fe','tch'].join('');const sendBeaconKey=['send','Beacon'].join('');";
      const root = await fixture(
        `${prelude}${source};export default function App(){}`,
      );
      await writeFile(
        resolve(root, "dist/assets/index.js"),
        `${prelude}${source};`,
      );

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: "network-api",
        detail,
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: "network API",
      });
    },
  );

  it.each([
    {
      name: "window navigator serviceWorker",
      key: "['service','Worker'].join('')",
      operation: "window.navigator[key].register('/sw.js')",
      sourceCode: "service-worker",
      sourceDetail: "navigator.serviceWorker",
      bundleDetail: "service worker",
    },
    {
      name: "window document cookie",
      key: "['coo','kie'].join('')",
      operation: "window.document[key]='x=1'",
      sourceCode: "persistent-storage",
      sourceDetail: "document.cookie",
      bundleDetail: "document cookie",
    },
    {
      name: "globalThis navigator sendBeacon",
      key: "['send','Beacon'].join('')",
      operation: "globalThis.navigator[key]('/state','x')",
      sourceCode: "network-api",
      sourceDetail: "navigator.sendBeacon",
      bundleDetail: "network API",
    },
  ])(
    "rejects $name recovered through a browser global accessor",
    async ({ key, operation, sourceCode, sourceDetail, bundleDetail }) => {
      const source = `const key=${key};${operation};`;
      const root = await fixture(`${source}export default function App(){}`);
      await writeFile(resolve(root, "dist/assets/index.js"), source);

      const findings = await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      }));
      expect(findings).toContainEqual({
        file: "src/App.tsx",
        code: sourceCode,
        detail: sourceDetail,
      });
      expect(findings).toContainEqual({
        file: "dist/assets/index.js",
        code: "forbidden-bundle-marker",
        detail: bundleDetail,
      });
    },
  );

  it("accepts shadowed browser API names in source and the completed bundle", async () => {
    const source =
      "function fetch(){};const localStorage=new Map();fetch();localStorage.set('x','y');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("rejects destructuring that stores a privileged value", async () => {
    const root = await fixture(
      "const [browser] = [window]; export default function App() { void browser; }",
    );
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const[browser]=[window];void browser;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "src/App.tsx"),
    ).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
    });
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("rejects reflection over privileged browser globals", async () => {
    const root = await fixture(`
      const key = ['fe', 'tch'].join('');
      Reflect.get(globalThis, key);
      export default function App() {}
    `);
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "Reflect.get(globalThis,['fe','tch'].join(''));",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === "src/App.tsx"),
    ).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-reflection",
      detail: "Reflect.get",
    });
    expect(
      findings.filter(({ file }) => file === "dist/assets/index.js"),
    ).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global reflection",
    });
  });

  it("accepts own descriptors for the fixed internal runtime globals", async () => {
    const source = `
      const previous = Object.getOwnPropertyDescriptor(globalThis, '__humanPlayerSide');
      Object.defineProperty(globalThis, '__humanPlayerSide', {
        configurable: true, enumerable: true, value: null, writable: true,
      });
      if (previous) Object.defineProperty(globalThis, '__humanPlayerSide', previous);
      export default function App() {}
    `;
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) =>
        ["src/App.tsx", "dist/assets/index.js"].includes(file),
      ),
    ).toEqual([]);
  });

  it("rejects descriptor access to a non-fixed browser-global key", async () => {
    const source = `
      const key = 'runtimeKey';
      Object.defineProperty(globalThis, key, { configurable: true, value: null });
      export default function App() {}
    `;
    const root = await fixture(source);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings.some(({ file }) => file === "src/App.tsx")).toBe(true);
    expect(findings.some(({ file }) => file === "dist/assets/index.js")).toBe(
      true,
    );
  });

  it("fails closed on Vite glob and query imports", async () => {
    const root = await fixture(`
      const modules = import.meta.glob('./hidden/*.ts', { eager: true });
      import raw from './runtime.json?raw';
      export default function App() { void modules; void raw; }
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/App.tsx",
          code: "unsupported-import",
          detail: "import.meta.glob",
        },
        {
          file: "src/App.tsx",
          code: "unsupported-import",
          detail: "./runtime.json?raw",
        },
      ]),
    );
  });

  it("traverses ordinary, dynamic, and CSS imports and detects constructed origins", async () => {
    const root = await fixture(`
      import './Other';
      import './screen.css';
      void import('./Lazy');
      export default function App() {}
    `);
    await writeFile(
      resolve(root, "src/Other.ts"),
      `
        const protocol = 'https:';
        const host = '//cdn.example.test/state';
        export const endpoint = protocol + host;
        export const local = new URL('/state', location.href);
      `,
    );
    await writeFile(
      resolve(root, "src/Lazy.ts"),
      "const request = self['fetch']; export const lazy = () => request('/state');",
    );
    await writeFile(
      resolve(root, "src/screen.css"),
      "@import url(./nested.css); .x { background: url('https://cdn-css.example.test/x.png'); }",
    );
    await writeFile(
      resolve(root, "src/nested.css"),
      "@import 'https://cdn-style.example.test/theme.css';",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/Other.ts",
          code: "external-origin",
          detail: "https://cdn.example.test/state",
        },
        { file: "src/Other.ts", code: "network-api", detail: "URL" },
        { file: "src/Lazy.ts", code: "network-api", detail: "self[fetch]" },
        {
          file: "src/screen.css",
          code: "external-origin",
          detail: "https://cdn-css.example.test/x.png",
        },
        {
          file: "src/nested.css",
          code: "external-origin",
          detail: "https://cdn-style.example.test/theme.css",
        },
      ]),
    );
  });

  it("rejects protocol-relative origins in source CSS and HTML", async () => {
    const root = await fixture(
      "import './screen.css'; export default function App() {}",
    );
    await writeFile(
      resolve(root, "src/screen.css"),
      ".x { background: url('//cdn-css.example.test/x.png'); }",
    );
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      '<img src="//cdn-html.example.test/x.png"><script type="module" src="/src/main.tsx"></script>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/screen.css",
          code: "external-origin",
          detail: "//cdn-css.example.test/x.png",
        },
        {
          file: RELEASE_ENTRY,
          code: "external-origin",
          detail: "//cdn-html.example.test/x.png",
        },
      ]),
    );
  });

  it("allows the official image base in the reviewed legacy image hook only", async () => {
    const root = await fixture(
      "import './ui/hooks/useCardImage'; export default function App() {}",
    );
    await mkdir(resolve(root, "src/ui/hooks"), { recursive: true });
    await writeFile(
      resolve(root, "src/ui/hooks/useCardImage.ts"),
      "export const image = 'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/B01001.png';",
    );

    expect(
      await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toEqual([]);

    await writeFile(
      resolve(root, "src/ui/hooks/useCardImage.ts"),
      "export const image = 'https://cdn.example.test/card.png';",
    );
    expect(
      await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toContainEqual({
      file: "src/ui/hooks/useCardImage.ts",
      code: "external-origin",
      detail: "https://cdn.example.test/card.png",
    });
  });

  it("pins the Meta catalog image origin to its exact reviewed hook", async () => {
    const reviewedRoot = await fixture();
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/App.tsx"),
      "import './hooks/useCatalogCardImage'; export default function App() {}",
    );
    await mkdir(resolve(reviewedRoot, "meta-app/src/hooks"), {
      recursive: true,
    });
    const reviewedSource = await readFile(
      resolve(process.cwd(), "meta-app/src/hooks/useCatalogCardImage.ts"),
      "utf8",
    );
    await writeFile(
      resolve(reviewedRoot, "meta-app/src/hooks/useCatalogCardImage.ts"),
      reviewedSource,
    );

    expect(
      await auditRuntimeBoundary(reviewedRoot, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toEqual([]);

    await writeFile(
      resolve(reviewedRoot, "meta-app/src/hooks/useCatalogCardImage.ts"),
      `${reviewedSource}\n// tampered`,
    );
    expect(
      await auditRuntimeBoundary(reviewedRoot, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toContainEqual({
      file: "meta-app/src/hooks/useCatalogCardImage.ts",
      code: "external-origin",
      detail:
        "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/",
    });
  });

  it("permits the two Node helpers only while they are unreachable from production", async () => {
    const root = await fixture();
    const helpers = [
      "src/engine/effect/validate-spec-files.ts",
      "src/engine/cards/tsv-loader-fs.ts",
    ];
    for (const helper of helpers) {
      await mkdir(resolve(root, helper, ".."), { recursive: true });
      await writeFile(
        resolve(root, helper),
        "import { readFileSync } from 'node:fs'; void readFileSync;",
      );
    }

    expect(
      await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toEqual([]);

    await writeFile(
      resolve(root, "src/App.tsx"),
      "import './engine/cards/tsv-loader-fs'; export default function App() {}",
    );
    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/engine/cards/tsv-loader-fs.ts",
      code: "production-node-helper",
      detail: "reachable from src/main.tsx",
    });
    expect(findings).toContainEqual({
      file: "src/engine/cards/tsv-loader-fs.ts",
      code: "server-import",
      detail: "node:fs",
    });
  });

  it("accepts an approved reachable dynamic route", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          imports: [],
          dynamicImports: ["src/screens/SettingsScreen.tsx"],
        },
        "src/screens/SettingsScreen.tsx": {
          file: "assets/SettingsScreen.js",
          isDynamicEntry: true,
          imports: [],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/SettingsScreen.js"),
      "export default 1;",
    );

    expect(
      await auditRuntimeBoundary(root, async () => ({
        stdout: "",
        stderr: "",
      })),
    ).toEqual([]);
  });

  it("suppresses a reviewed bundle finding only for exact output, owner, hash, and detail", () => {
    const policy: TrustedBundlePolicy = {
      output: /^assets\/Reviewed-[A-Za-z0-9_-]+\.js$/,
      owns: (key) => key === "src/screens/Reviewed.tsx",
      sha256: "qualified-sha",
      integrityCode: "bundle-capability-integrity",
      integrityDetail: "reviewed bundle SHA-256 mismatch",
      approvedFindings: [{ code: "forbidden-bundle-marker", detail: "network API" }],
    };
    const finding = { code: "forbidden-bundle-marker", detail: "network API" };

    expect(isReviewedBundleFindingAllowed(
      policy,
      "assets/Reviewed-output.js",
      "src/screens/Reviewed.tsx",
      "qualified-sha",
      finding,
    )).toBe(true);
    expect(isReviewedBundleFindingAllowed(
      policy,
      "assets/Reviewed-output.js",
      "src/screens/Wrong.tsx",
      "qualified-sha",
      finding,
    )).toBe(false);
    expect(isReviewedBundleFindingAllowed(
      policy,
      "assets/Reviewed-output.js",
      "src/screens/Reviewed.tsx",
      "qualified-sha-drift",
      finding,
    )).toBe(false);
    expect(isReviewedBundleFindingAllowed(
      policy,
      "assets/Reviewed-output.js",
      "src/screens/Reviewed.tsx",
      "qualified-sha",
      { ...finding, detail: "persistent storage" },
    )).toBe(false);
    expect(isReviewedBundleFindingAllowed(
      policy,
      "assets/Other-output.js",
      "src/screens/Reviewed.tsx",
      "qualified-sha",
      finding,
    )).toBe(false);
  });

  it("scans every reachable dynamic chunk for network, storage, and code execution", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          imports: [],
          dynamicImports: ["src/screens/SettingsScreen.tsx"],
        },
        "src/screens/SettingsScreen.tsx": {
          file: "assets/SettingsScreen.js",
          isDynamicEntry: true,
          imports: [],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/SettingsScreen.js"),
      "fetch('/lazy'); localStorage.setItem('lazy', '1'); Function('return 1')();",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "dist/assets/SettingsScreen.js",
          code: "forbidden-bundle-marker",
          detail: "bare fetch",
        },
        {
          file: "dist/assets/SettingsScreen.js",
          code: "forbidden-bundle-marker",
          detail: "persistent storage",
        },
        {
          file: "dist/assets/SettingsScreen.js",
          code: "forbidden-bundle-marker",
          detail: "dynamic code execution",
        },
      ]),
    );
  });

  it("rejects unknown dynamic keys and orphan output through the shared closure", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          imports: [],
          dynamicImports: ["src/lazy.ts"],
        },
        "src/lazy.ts": {
          file: "assets/lazy.js",
          isDynamicEntry: true,
          imports: [],
        },
      }),
    );
    await writeFile(resolve(root, "dist/assets/lazy.js"), "export default 1;");
    await writeFile(
      resolve(root, "dist/assets/orphan.js"),
      "export default 1;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "dist/.vite/manifest.json",
          code: "production-manifest",
          detail: "unknown dynamic manifest entry: src/lazy.ts",
        },
        {
          file: "dist/assets/orphan.js",
          code: "untracked-build-artifact",
          detail: "not declared by the canonical build",
        },
      ]),
    );
  });

  it("rejects an additional build entry declared outside index.html", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          dynamicImports: [],
        },
        "src/extra.ts": {
          file: "assets/extra.js",
          isEntry: true,
          dynamicImports: [],
        },
      }),
    );
    await writeFile(resolve(root, "dist/assets/extra.js"), "export default 1;");

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/.vite/manifest.json",
      code: "production-manifest",
      detail: "unreachable manifest entry: src/extra.ts",
    });
  });

  it("rejects a bare fetch injected into the completed production bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const preload = (url, options) => fetch(url, options); void preload;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "bare fetch",
    });
  });

  it("rejects persistent storage injected into the completed production bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "window['localStorage'].setItem('state', 'x'); globalThis.indexedDB.open('state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "persistent storage",
    });
  });

  it("rejects a vendor chunk that does not match the qualified SHA-256", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "_vendor-tampered.js": {
          file: "assets/vendor-tampered.js",
          isEntry: false,
        },
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          imports: ["_vendor-tampered.js"],
          dynamicImports: [],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/vendor-tampered.js"),
      "globalThis.fetch('/tampered-vendor');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/assets/vendor-tampered.js",
      code: "vendor-integrity",
      detail: "trusted vendor bundle SHA-256 mismatch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/vendor-tampered.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects a runtime chunk that does not match the qualified SHA-256", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "_runtime-tampered.js": {
          file: "assets/rolldown-runtime-tampered.js",
          isEntry: false,
        },
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          imports: ["_runtime-tampered.js"],
          dynamicImports: [],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/rolldown-runtime-tampered.js"),
      "globalThis.fetch('/tampered-runtime');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/assets/rolldown-runtime-tampered.js",
      code: "runtime-integrity",
      detail: "trusted runtime bundle SHA-256 mismatch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/rolldown-runtime-tampered.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects an application chunk that does not match the qualified SHA-256", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index-tampered.js",
          isEntry: true,
          dynamicImports: [],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/index-tampered.js"),
      "globalThis.fetch('/tampered-application');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: "dist/assets/index-tampered.js",
      code: "app-integrity",
      detail: "trusted application bundle SHA-256 mismatch",
    });
    expect(findings).toContainEqual({
      file: "dist/assets/index-tampered.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it("rejects a modified or additional bundled raster instead of trusting its filename", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          dynamicImports: [],
          assets: ["assets/detective-conan-logo-tampered.png"],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/detective-conan-logo-tampered.png"),
      "tampered-logo",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/assets/detective-conan-logo-tampered.png",
      code: "server-hosted-image",
      detail: "bundled raster image",
    });
  });

  it("inspects manifest sidecars and rejects untracked copied output", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          dynamicImports: [],
          css: ["assets/index.css"],
        },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/index.css"),
      ".x { background: url('https://evil-css.example.test/x.png'); }",
    );
    await writeFile(
      resolve(root, "dist/public-runtime.js"),
      "fetch('/copied-output');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "dist/assets/index.css",
          code: "external-origin",
          detail: "https://evil-css.example.test/x.png",
        },
        {
          file: "dist/public-runtime.js",
          code: "untracked-build-artifact",
          detail: "not declared by the canonical build",
        },
        {
          file: "dist/public-runtime.js",
          code: "forbidden-bundle-marker",
          detail: "bare fetch",
        },
      ]),
    );
  });

  it("rejects classic or additional scripts in generated index.html", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/index.html"),
      [
        '<script type="module" src="/assets/index.js"></script>',
        '<script src="/copied-runtime.js"></script>',
      ].join("\n"),
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "dist/index.html",
      code: "production-entry",
      detail: "invalid generated script entry",
    });
  });

  it("rejects inline HTML execution channels in source and generated output", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      '<body onload="fetch(\'/api\')"><a href="java&#x09;script:alert(1)">x</a><script type="module" src="/src/main.tsx"></script></body>',
    );
    await writeFile(
      resolve(root, "dist/index.html"),
      '<body onload="fetch(\'/api\')"><a href="java&NewLine;script:alert(1)">x</a><script type="module" src="/assets/index.js"></script></body>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toEqual(
      expect.arrayContaining([
        { file: RELEASE_ENTRY, code: "html-execution", detail: "onload" },
        {
          file: RELEASE_ENTRY,
          code: "html-execution",
          detail: "javascript URL",
        },
        { file: "dist/index.html", code: "html-execution", detail: "onload" },
        {
          file: "dist/index.html",
          code: "html-execution",
          detail: "javascript URL",
        },
      ]),
    );
  });

  it("rejects entity-decoded leading C0 controls in javascript URLs", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      '<a href="&#x01;javascript:alert(1)">x</a><script type="module" src="/src/main.tsx"></script>',
    );
    await writeFile(
      resolve(root, "dist/index.html"),
      '<a href="&#x1f;javascript:alert(1)">x</a><script type="module" src="/assets/index.js"></script>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(
      findings.filter(({ file }) => file === RELEASE_ENTRY),
    ).toContainEqual({
      file: RELEASE_ENTRY,
      code: "html-execution",
      detail: "javascript URL",
    });
    expect(
      findings.filter(({ file }) => file === "dist/index.html"),
    ).toContainEqual({
      file: "dist/index.html",
      code: "html-execution",
      detail: "javascript URL",
    });
  });

  it("rejects CSS-escaped external URLs in stylesheets and HTML style surfaces", async () => {
    const root = await fixture(
      "import './screen.css'; export default function App() {}",
    );
    const escapedOfficial = String.raw`url(\68 ttps\3a \2f \2f www\2e takaratomy\2e co\2e jp\2f products\2f conan-cardgame\2f storage\2f card\2f secret.png)`;
    await writeFile(
      resolve(root, "src/screen.css"),
      `.source { background-image: ${escapedOfficial}; }`,
    );
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      `<style>.element { background-image: ${escapedOfficial}; }</style><div style="background-image:${escapedOfficial}"></div><script type="module" src="/src/main.tsx"></script>`,
    );
    await writeFile(
      resolve(root, "dist/assets/index.css"),
      `.bundle { --image: ${escapedOfficial}; background-image: var(--image); }`,
    );
    await writeFile(
      resolve(root, "dist/index.html"),
      `<div style="background-image:${escapedOfficial}"></div><script type="module" src="/assets/index.js"></script>`,
    );
    const manifestPath = resolve(root, "dist/.vite/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest["index.html"].css = ["assets/index.css"];
    await writeFile(manifestPath, JSON.stringify(manifest));

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    for (const file of [
      "src/screen.css",
      RELEASE_ENTRY,
      "dist/assets/index.css",
      "dist/index.html",
    ]) {
      expect(
        findings.filter((finding) => finding.file === file),
      ).toContainEqual({
        file,
        code: "external-origin",
        detail:
          "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/secret.png",
      });
    }
  });

  it("traverses CSS-escaped local imports before inspecting their contents", async () => {
    const root = await fixture(
      "import './screen.css'; export default function App() {}",
    );
    await writeFile(
      resolve(root, "src/screen.css"),
      String.raw`@import "\6e ested.css";`,
    );
    await writeFile(
      resolve(root, "src/nested.css"),
      ".nested { background: url('https://nested-css.example.test/card.png'); }",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/nested.css",
      code: "external-origin",
      detail: "https://nested-css.example.test/card.png",
    });
  });

  it("fails closed on malformed CSS and any SVG CSS surface", async () => {
    const root = await fixture(
      "import './broken.css'; export default function App() {}",
    );
    await writeFile(
      resolve(root, "src/broken.css"),
      ".broken { background: url('x' }",
    );
    await writeFile(
      resolve(root, "dist/favicon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:red}</style><path class="x"/></svg>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(findings).toContainEqual({
      file: "src/broken.css",
      code: "invalid-style",
      detail: "CSS parsing failed or warned",
    });
    expect(findings).toContainEqual({
      file: "dist/favicon.svg",
      code: "svg-style",
      detail: "SVG CSS is forbidden",
    });
  });

  it("decodes static runtime CSS and rejects unresolved URL-capable style values", async () => {
    const escapedRoot = await fixture(String.raw`
      const backgroundImage = ['url(', '\\68 ttps\\3a \\2f \\2f runtime-css.example.test\\2f card.png', ')'].join('');
      export default function App() { return <div style={{ backgroundImage }} />; }
    `);
    const dynamicRoot = await fixture(`
      export default function App({ image }: { image: string }) {
        return <div style={{ backgroundImage: image }} />;
      }
    `);

    const escaped = await auditRuntimeBoundary(escapedRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    const dynamic = await auditRuntimeBoundary(dynamicRoot, async () => ({
      stdout: "",
      stderr: "",
    }));
    expect(escaped).toContainEqual({
      file: "src/App.tsx",
      code: "external-origin",
      detail: "https://runtime-css.example.test/card.png",
    });
    expect(dynamic).toContainEqual({
      file: "src/App.tsx",
      code: "runtime-style",
      detail: "backgroundImage",
    });
  });

  it("rejects unsafe Vite configuration before invoking the build", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, RELEASE_CONFIG),
      "export default { ['base']: '/game/', root: 'alternate', publicDir: 'public-copy', build: { rollupOptions: { input: 'alternate/index.html' }, outDir: '../outside', emptyOutDir: true, write: false }, server: { proxy: { '/api': 'http://localhost:9' } } };",
    );
    let builds = 0;

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: `${++builds}`,
      stderr: "",
    }));
    expect(builds).toBe(0);
    expect(findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "vite-config",
        "vite-base",
        "vite-root",
        "vite-input",
        "vite-output",
        "router-rewrite",
      ]),
    );
  });

  it("rejects indirect Vite config mutation before invoking the build", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, RELEASE_CONFIG),
      "const config = {}; config.root = 'alternate'; config.build = { outDir: '../outside', emptyOutDir: true }; export default config;",
    );
    let builds = 0;

    const findings = await auditRuntimeBoundary(root, async () => {
      builds += 1;
      return { stdout: "", stderr: "" };
    });

    expect(builds).toBe(0);
    expect(findings).toContainEqual({
      file: RELEASE_CONFIG,
      code: "vite-config",
      detail: "canonical configuration mismatch",
    });
  });

  it("rejects browser externalization and meta build output", async () => {
    const root = await fixture();
    await mkdir(resolve(root, "dist-meta"));

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "building dist-meta with build:meta",
      stderr: "Module externalized for browser compatibility",
    }));
    expect(findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "browser-externalization",
        "meta-build",
        "dist-meta",
      ]),
    );
  });

  it("rejects external origins and extra module entries in index.html", async () => {
    const root = await fixture();
    await writeFile(resolve(root, "src/extra.ts"), "location.href = '/other';");
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      [
        '<a href="https://outside.example.test/leave">leave</a>',
        '<script type="module" src="/src/main.tsx"></script>',
        '<script type="module" src="/src/extra.ts"></script>',
      ].join("\n"),
    );

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings).toContainEqual({
      file: RELEASE_ENTRY,
      code: "external-origin",
      detail: "https://outside.example.test/leave",
    });
    expect(findings).toContainEqual({
      file: RELEASE_ENTRY,
      code: "root-entry",
      detail: "expected only /src/main.tsx as a module entry",
    });
  });

  it("requires index.html to enter through src/main.tsx and reach src/App.tsx", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, RELEASE_ENTRY),
      '<script type="module" src="/src/other.ts"></script>',
    );
    await writeFile(resolve(root, "meta-app/src/other.ts"), "export {};");

    const findings = await auditRuntimeBoundary(root, async () => ({
      stdout: "",
      stderr: "",
    }));

    expect(findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["root-entry", "app-entry"]),
    );
  });

  it("runs the repository-local Vite executable with ambient build authority removed", async () => {
    const root = await fixture();
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await mkdir(resolve(root, "node_modules/wrangler/bin"), {
      recursive: true,
    });
    await mkdir(resolve(root, "functions/api/v1"), { recursive: true });
    await writeFile(
      resolve(root, "node_modules/vite/bin/vite.js"),
      "// fixture",
    );
    await writeFile(
      resolve(root, "node_modules/wrangler/bin/wrangler.js"),
      "// fixture",
    );
    await writeFile(
      resolve(root, "functions/api/v1/[[path]].ts"),
      "export {};",
    );
    await writeFile(
      resolve(root, "wrangler.json"),
      await readFile(resolve(process.cwd(), "wrangler.json")),
    );
    const previousNodeOptions = process.env.NODE_OPTIONS;
    const previousVitePoison = process.env.VITE_POISON;
    process.env.NODE_OPTIONS = "--import=poison";
    process.env.VITE_POISON = "secret";
    try {
      const seen: Array<{
        file: string;
        args: string[];
        cwd: string;
        env: NodeJS.ProcessEnv;
      }> = [];
      const output = await runCanonicalBoundaryBuild(root, async (command) => {
        seen.push(command);
        if (command.args.includes("pages")) {
          const value = (flag: string): string => {
            const index = command.args.indexOf(flag);
            if (index < 0 || !command.args[index + 1]) throw new Error(flag);
            return command.args[index + 1]!;
          };
          const outdir = value("--outdir");
          await writeFile(resolve(outdir, "index.js"), "export default {};\n");
          const generated =
            "../.wrangler/tmp/pages-test/functionsRoutes-test.mjs";
          const inputPaths = [
            "../src/cloud-data/access-auth.ts",
            "../src/cloud-data/api.ts",
            "../src/cloud-data/contracts.ts",
            "../src/cloud-data/idempotency.ts",
            "../src/cloud-data/identity.ts",
            "../src/cloud-data/rate-limit.ts",
            "../src/cloud-data/repository.ts",
            "../src/cloud-data/request-context.ts",
            "../src/cloud-data/retention.ts",
            "api/v1/[[path]].ts",
            "../node_modules/jose/dist/webapi/index.js",
            "../node_modules/jose/dist/webapi/jwe/compact/decrypt.js",
            "../node_modules/jose/dist/webapi/jwe/compact/encrypt.js",
            "../node_modules/jose/dist/webapi/jwe/flattened/decrypt.js",
            "../node_modules/jose/dist/webapi/jwe/flattened/encrypt.js",
            "../node_modules/jose/dist/webapi/jwe/general/decrypt.js",
            "../node_modules/jose/dist/webapi/jwe/general/encrypt.js",
            "../node_modules/jose/dist/webapi/jwk/embedded.js",
            "../node_modules/jose/dist/webapi/jwk/thumbprint.js",
            "../node_modules/jose/dist/webapi/jwks/local.js",
            "../node_modules/jose/dist/webapi/jwks/remote.js",
            "../node_modules/jose/dist/webapi/jws/compact/sign.js",
            "../node_modules/jose/dist/webapi/jws/compact/verify.js",
            "../node_modules/jose/dist/webapi/jws/flattened/sign.js",
            "../node_modules/jose/dist/webapi/jws/flattened/verify.js",
            "../node_modules/jose/dist/webapi/jws/general/sign.js",
            "../node_modules/jose/dist/webapi/jws/general/verify.js",
            "../node_modules/jose/dist/webapi/jwt/decrypt.js",
            "../node_modules/jose/dist/webapi/jwt/encrypt.js",
            "../node_modules/jose/dist/webapi/jwt/sign.js",
            "../node_modules/jose/dist/webapi/jwt/unsecured.js",
            "../node_modules/jose/dist/webapi/jwt/verify.js",
            "../node_modules/jose/dist/webapi/key/export.js",
            "../node_modules/jose/dist/webapi/key/generate_key_pair.js",
            "../node_modules/jose/dist/webapi/key/generate_secret.js",
            "../node_modules/jose/dist/webapi/key/import.js",
            "../node_modules/jose/dist/webapi/lib/asn1.js",
            "../node_modules/jose/dist/webapi/lib/base64.js",
            "../node_modules/jose/dist/webapi/lib/buffer_utils.js",
            "../node_modules/jose/dist/webapi/lib/content_encryption.js",
            "../node_modules/jose/dist/webapi/lib/crypto_key.js",
            "../node_modules/jose/dist/webapi/lib/deflate.js",
            "../node_modules/jose/dist/webapi/lib/helpers.js",
            "../node_modules/jose/dist/webapi/lib/invalid_key_input.js",
            "../node_modules/jose/dist/webapi/lib/is_key_like.js",
            "../node_modules/jose/dist/webapi/lib/jwe_algorithms.js",
            "../node_modules/jose/dist/webapi/lib/jwe_decrypt.js",
            "../node_modules/jose/dist/webapi/lib/jwe_encrypt.js",
            "../node_modules/jose/dist/webapi/lib/jwk_to_key.js",
            "../node_modules/jose/dist/webapi/lib/jws_algorithms.js",
            "../node_modules/jose/dist/webapi/lib/jws_sign.js",
            "../node_modules/jose/dist/webapi/lib/jws_verify.js",
            "../node_modules/jose/dist/webapi/lib/jwt_claims_set.js",
            "../node_modules/jose/dist/webapi/lib/key.js",
            "../node_modules/jose/dist/webapi/lib/key_algorithm.js",
            "../node_modules/jose/dist/webapi/lib/key_descriptor.js",
            "../node_modules/jose/dist/webapi/lib/key_management.js",
            "../node_modules/jose/dist/webapi/lib/options.js",
            "../node_modules/jose/dist/webapi/lib/signing.js",
            "../node_modules/jose/dist/webapi/lib/type_checks.js",
            "../node_modules/jose/dist/webapi/util/base64url.js",
            "../node_modules/jose/dist/webapi/util/decode_jwt.js",
            "../node_modules/jose/dist/webapi/util/decode_protected_header.js",
            "../node_modules/jose/dist/webapi/util/errors.js",
            "../node_modules/path-to-regexp/dist.es2015/index.js",
            "../node_modules/wrangler/templates/pages-template-worker.ts",
            generated,
          ];
          const inputs = Object.fromEntries(
            inputPaths.map((path) => [
              path,
              { bytes: 1, imports: [], format: "esm" },
            ]),
          );
          await writeFile(
            value("--metafile"),
            JSON.stringify({
              inputs,
              outputs: {
                [resolve(outdir, "index.js")]: {
                  imports: [],
                  exports: ["default"],
                  entryPoint:
                    "../node_modules/wrangler/templates/pages-template-worker.ts",
                  inputs: Object.fromEntries(
                    inputPaths.map((path) => [
                      path,
                      { bytesInOutput: 1 },
                    ]),
                  ),
                },
              },
            }),
          );
          await writeFile(
            value("--build-metadata-path"),
            JSON.stringify({
              wrangler_config_hash: createHash("sha256")
                .update(await readFile(value("--config")))
                .digest("hex"),
              build_output_directory: "dist",
            }),
          );
          await writeFile(
            value("--output-config-path"),
            JSON.stringify({
              routes: [
                {
                  routePath: "/api/v1/:path*",
                  mountPath: "/api/v1",
                  method: "",
                  module: ["api/v1/[[path]].ts:onRequest"],
                },
              ],
              baseURL: "/",
            }),
          );
          await writeFile(
            value("--output-routes-path"),
            JSON.stringify({
              version: 1,
              description: "Generated by wrangler@4.118.0",
              include: ["/api/v1/*"],
              exclude: [],
            }),
          );
          return { stdout: "worker\n", stderr: "" };
        }
        return { stdout: "built\n", stderr: "" };
      });

      expect(output).toEqual({ stdout: "built\nworker\n", stderr: "" });
      expect(seen).toHaveLength(2);
      expect(seen[0]?.file).toBe(process.execPath);
      expect(seen[0]?.args).toEqual([
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--manifest",
        "--config",
        RELEASE_CONFIG,
      ]);
      expect(seen[0]?.cwd).toBe(root);
      expect(seen[0]?.env.NODE_OPTIONS).toBeUndefined();
      expect(seen[0]?.env.VITE_POISON).toBeUndefined();
      expect(seen[1]?.file).toBe(process.execPath);
      expect(seen[1]?.args).toContain("--outdir");
      expect(seen[1]?.env.NODE_OPTIONS).toBeUndefined();
      expect(seen[1]?.env.VITE_POISON).toBeUndefined();
    } finally {
      if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousNodeOptions;
      if (previousVitePoison === undefined) delete process.env.VITE_POISON;
      else process.env.VITE_POISON = previousVitePoison;
    }
  });
});
