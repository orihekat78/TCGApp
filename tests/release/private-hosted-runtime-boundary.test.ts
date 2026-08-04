import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditRuntimeBoundary,
  runCanonicalBoundaryBuild,
} from "../../scripts/private-hosted/audit-runtime-boundary.js";

const roots: string[] = [];
const canonicalViteConfig = `import { defineConfig } from "vite";
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

async function fixture(appSource = "export default function App() {}") {
  const root = await mkdtemp(join(tmpdir(), "conan-runtime-boundary-"));
  roots.push(root);
  await mkdir(resolve(root, "src"), { recursive: true });
  await mkdir(resolve(root, "dist/.vite"), { recursive: true });
  await mkdir(resolve(root, "dist/assets"), { recursive: true });
  await writeFile(
    resolve(root, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
  );
  await writeFile(
    resolve(root, "src/main.tsx"),
    "import App from './App'; void App;",
  );
  await writeFile(resolve(root, "src/App.tsx"), appSource);
  await writeFile(
    resolve(root, "vite.config.ts"),
    canonicalViteConfig,
  );
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
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));

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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    const source = findings.filter(({ file }) => file === "src/App.tsx");
    const bundle = findings.filter(({ file }) => file === "dist/assets/index.js");

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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    const dynamicAlias = findings.some(({ file, code, detail }) =>
      file === "dist/assets/index.js" &&
      code === "forbidden-bundle-marker" &&
      detail === "dynamic browser property"
    );
    expect(dynamicAlias).toBe(rejected);
  });

  it("does not retain taint after React-style local binding reuse", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){e=e.target||window;void e.innerWidth;e={};return e[key]}void target;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
  });

  it.each([
    {
      name: "for-of loop-carried alias",
      source: "let x={},i=0;for(const item of [0,1]){void item;if(i++)void x[key];x=window}",
    },
    {
      name: "for-in loop-carried alias",
      source: "let x={},i=0;for(const item in {a:0,b:1}){void item;if(i++)void x[key];x=window}",
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
      source: "function f(){let x=window;try{throw new Error('x')}finally{void x[key]}}try{f()}catch{}",
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
    const root = await fixture(`const key=['fe','tch'].join('');${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `const key=['fe','tch'].join('');${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
      source: "let outer={};function set(){let w=window;outer=w}set();void outer[key]",
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
  ])("rejects privileged alias flow through $name", async ({ source, sourceCode, bundleDetail }) => {
    const root = await fixture(`const key=['fe','tch'].join('');${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `const key=['fe','tch'].join('');${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.some(({ file, code }) => file === "src/App.tsx" && code === sourceCode)).toBe(true);
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: bundleDetail,
    });
  });

  it("keeps nested function writes isolated and rejects captured privileged writes", async () => {
    const safeRoot = await fixture("let outer={};function unused(){let outer=window;void outer.innerWidth}void outer[key];export default function App(){};");
    const unsafeRoot = await fixture("let outer={};function set(){outer=window}set();void outer[key];export default function App(){};");

    const safe = await auditRuntimeBoundary(safeRoot, async () => ({ stdout: "", stderr: "" }));
    const unsafe = await auditRuntimeBoundary(unsafeRoot, async () => ({ stdout: "", stderr: "" }));
    expect(safe.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(unsafe.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
  });

  it("rejects a privileged source value passed across a function boundary", async () => {
    const root = await fixture(`
      function persist(browser: Window) { return browser; }
      persist(window);
      export default function App() {}
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
  });

  it("accepts inert React-style replay event bookkeeping in the completed bundle", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "function target(e){return e.target||window}function blocked(e){return target(e)}function replay(e){const n=blocked(e.nativeEvent);if(n!==null){e.blockedOn=n;return false}return e.targetContainers.length===0}const queued={blockedOn:null,nativeEvent:{target:null},targetContainers:[]};void replay(queued);",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
  });

  it("rejects a replay bookkeeping value reused as a network owner", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');function target(e){return e.target||window}function replay(e){e.blockedOn=target(e.nativeEvent);return e.targetContainers.length===0}const queued={blockedOn:null,nativeEvent:{target:null},targetContainers:[]};replay(queued);void queued.blockedOn[key]('/state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
      wrapper: "function wrap(value){return {value}}consume(wrap(replay(queued)))",
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
  ])("rejects a tainted replay object hidden in a $name", async ({ wrapper }) => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `function target(e){return e.target||window}function replay(e){void e.nativeEvent;void e.targetContainers;e.blockedOn=target(e);return e}const queued={blockedOn:null,nativeEvent:{},targetContainers:[],target:null};${wrapper};`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global escape",
    });
  });

  it("rejects a privileged logical assignment through a local writer", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');function poison(box){box.blockedOn||=window}const queued={blockedOn:null};poison(queued);queued.blockedOn[key]('/state');",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toEqual(expect.arrayContaining([
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
    ]));
  });

  it("accepts a React-style constructor returned by a same-name-parameter factory", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "let target=window;function Factory(seed){function Event(Event,b,c,d,e){this._reactName=Event;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}return seed(),Event}const Synthetic=Factory(()=>{});const event=new Synthetic('onSelect','select',null,{},target);event.target=target;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
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
      access: "function get(x){return x.target}const browser=get(event);void browser[key]('/state')",
    },
    {
      name: "destructured local function parameter",
      access: "function get({target}){return target}const browser=get(event);void browser[key]('/state')",
    },
    {
      name: "computed destructuring",
      access: "const prop='target';const {[prop]:browser}=event;void browser[key]('/state')",
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
      access: "function id(x){return x}const alias=id(event);void alias.target[key]('/state')",
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
      access: "const helper={id:x=>x};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object method identity function",
      access: "const helper={id(x){return x}};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object getter identity function",
      access: "const helper={get id(){return x=>x}};void helper.id(event).target[key]('/state')",
    },
    {
      name: "object container",
      access: "const box={event};void box.event.target[key]('/state')",
    },
    {
      name: "array container",
      access: "const list=[event];void list[0].target[key]('/state')",
    },
  ])("rejects a synthetic event target escape through $name", async ({ access }) => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      `const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);event.target=window;${access};`,
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "network API",
    });
  });

  it.each([
    {
      name: "identity function created before taint",
      setup: "function id(x){return x}const alias=id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "inline arrow identity created before taint",
      setup: "const alias=((x)=>x)(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member arrow identity created before taint",
      setup: "const helper={id:x=>x};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member method identity created before taint",
      setup: "const helper={id(x){return x}};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "member getter identity created before taint",
      setup: "const helper={get id(){return x=>x}};const alias=helper.id(event);event.target=window;void alias.target[key]('/state')",
    },
    {
      name: "object container created before taint",
      setup: "const box={event};event.target=window;void box.event.target[key]('/state')",
    },
    {
      name: "array container created before taint",
      setup: "const list=[event];event.target=window;void list[0].target[key]('/state')",
    },
    {
      name: "nested container linked before taint",
      setup: "const inner={};const box={inner};inner.target=window;void box.inner.target[key]('/state')",
    },
  ])("rejects $name in source and bundle", async ({ setup }) => {
    const prelude = "const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);";
    const root = await fixture(`${prelude}${setup};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${prelude}${setup};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
      setup: "const list=[event];const [alias]=list;void alias.target[key]('/state')",
    },
  ])("rejects $name in source and bundle", async ({ setup }) => {
    const prelude = "const key=['fe','tch'].join('');function SyntheticEvent(a,b,c,d,e){this._reactName=a;this._targetInst=c;this.type=b;this.nativeEvent=d;this.target=e;this.currentTarget=null}const event=new SyntheticEvent('onSelect','select',null,{},null);event.target=window;";
    const root = await fixture(`${prelude}${setup};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${prelude}${setup};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
    const source = "const key=['fe','tch'].join('');let doc;({ownerDocument:doc}=document.body);void doc.defaultView[key]('/state');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

  it("accepts Function source introspection without executing generated code", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const text=Function.toString.call(()=>0);void text;",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
  });

  it.each([
    { name: "arrow function constructor", source: "(()=>0).constructor(\"return fetch('/state')\")()" },
    { name: "object method constructor", source: "({m(){}}).m.constructor(\"return fetch('/state')\")()" },
    { name: "built-in method constructor", source: "[].filter.constructor(\"return fetch('/state')\")()" },
    {
      name: "bound constructor alias",
      source: "const Factory=(()=>0).constructor.bind(null);Factory(\"return fetch('/state')\")()",
    },
    {
      name: "introspection method alias constructor",
      source: "const inspect=Function.toString.call;inspect.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "parenthesized introspection method constructor",
      source: "(Function.toString.call).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "array element function constructor",
      source: "const list=[()=>0];list[0].constructor(\"return fetch('/state')\")()",
    },
    {
      name: "later property function constructor",
      source: "const box={};box.fn=()=>0;box.fn.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "prototype method constructor",
      source: "Array.prototype.filter.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "destructured prototype method constructor",
      source: "const {filter}=Array.prototype;filter.constructor(\"return fetch('/state')\")()",
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
      source: "document.createElement.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "prototype lookup constructor",
      source: "Object.getPrototypeOf(()=>0).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "legacy prototype constructor",
      source: "(()=>0).__proto__.constructor(\"return fetch('/state')\")()",
    },
    {
      name: "async function constructor",
      source: "Object.getPrototypeOf(async()=>0).constructor(\"return fetch('/state')\")()",
    },
    {
      name: "generator function constructor",
      source: "Object.getPrototypeOf(function*(){}).constructor(\"fetch('/state')\")().next()",
    },
    {
      name: "constructor call forwarding",
      source: "Array.prototype.filter.constructor.call(null,\"return fetch('/state')\")()",
    },
    {
      name: "constructor apply forwarding",
      source: "const C=Array.prototype.filter.constructor.apply(null,[\"return fetch('/state')\"]);C()",
    },
    {
      name: "Reflect constructor lookup",
      source: "Reflect.get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "destructured constructor",
      source: "const {constructor:C}=Array.prototype.filter;C(\"return fetch('/state')\")()",
    },
    {
      name: "destructuring assignment constructor",
      source: "let C;({constructor:C}=Array.prototype.filter);C(\"return fetch('/state')\")()",
    },
    {
      name: "computed destructuring assignment constructor",
      source: "const key=['con','structor'].join('');let C;({[key]:C}=()=>0);C(\"return fetch('/state')\")()",
    },
    {
      name: "array-stored constructor",
      source: "const list=[(()=>0).constructor];list[0](\"return fetch('/state')\")()",
    },
    {
      name: "object-stored constructor",
      source: "const box={C:(()=>0).constructor};box.C(\"return fetch('/state')\")()",
    },
    {
      name: "later-stored constructor",
      source: "const box={};box.C=(()=>0).constructor;box.C(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect apply constructor",
      source: "Reflect.apply((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "Reflect construct constructor",
      source: "Reflect.construct((()=>0).constructor,[\"return fetch('/state')\"])()",
    },
    {
      name: "runtime decoded constructor key",
      source: "const key=atob('Y29uc3RydWN0b3I=');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime String constructor key",
      source: "const key=String('constructor');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime character-code constructor key",
      source: "const key=String.fromCharCode(...[99,111,110,115,116,114,117,99,116,111,114]);(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "runtime local-return constructor key",
      source: "function key(){return 'constructor'}(()=>0)[key()](\"return fetch('/state')\")()",
    },
    {
      name: "runtime array constructor key",
      source: "const keys=['constructor'];const i=Number(location.hash);(()=>0)[keys[i]](\"return fetch('/state')\")()",
    },
    {
      name: "runtime reversed constructor key",
      source: "const key='rotcurtsnoc'.split('').reverse().join('');(()=>0)[key](\"return fetch('/state')\")()",
    },
    {
      name: "parameter destructured constructor",
      source: "function run({constructor:C}){return C(\"return fetch('/state')\")()}run(()=>0)",
    },
    {
      name: "nested destructured constructor",
      source: "const {x:{constructor:C}}={x:()=>0};C(\"return fetch('/state')\")()",
    },
    {
      name: "nested property write",
      source: "const outer={inner:{}};outer.inner.C=(()=>0).constructor;outer.inner.C(\"return fetch('/state')\")()",
    },
    {
      name: "destructure into property",
      source: "const box={};({constructor:box.C}=()=>0);box.C(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.get alias",
      source: "const get=Reflect.get;get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect namespace alias",
      source: "const R=Reflect;R.get(()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.get call forwarding",
      source: "Reflect.get.call(null,()=>0,'constructor')(\"return fetch('/state')\")()",
    },
    {
      name: "Reflect.apply alias",
      source: "const invoke=Reflect.apply;invoke((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "bound Reflect.apply",
      source: "Reflect.apply.bind(Reflect)((()=>0).constructor,null,[\"return fetch('/state')\"])()",
    },
    {
      name: "constructor descriptor value",
      source: "Object.getOwnPropertyDescriptor(Object.getPrototypeOf(()=>0),'constructor').value(\"return fetch('/state')\")()",
    },
  ])("rejects dynamic constructor recovery through $name", async ({ source }) => {
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

  it("rejects a constructor lookalike without replay-event provenance", async () => {
    const source = "function clone(e){const n=e.nativeEvent;return new n.constructor(n.type,n)}clone({nativeEvent:()=>0});";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
    const source = "function payload(){}payload.type='x';payload.toString=()=>\"return fetch('/state')\";function replay(e){void e.blockedOn;void e.targetContainers;const n=e.nativeEvent;return new n.constructor(n.type,n)}replay({blockedOn:null,targetContainers:[],nativeEvent:payload})()";
    const root = await fixture(`${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toEqual([]);
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual([]);
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    const elapsedMs = performance.now() - startedAt;

    expect(findings).toEqual([]);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 10_000);

  it("rejects a browser global hidden behind an event-like property name", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const key=['fe','tch'].join('');const box={};box.target=window;void box.target[key];",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toEqual(
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
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
    { name: "window document defaultView", owner: "window.document.defaultView" },
    { name: "document defaultView", owner: "document.defaultView" },
    {
      name: "DOM ownerDocument defaultView",
      owner: "document.body.ownerDocument.defaultView",
    },
    {
      name: "created DOM ownerDocument defaultView",
      owner: "document.createElement('div').ownerDocument.defaultView",
    },
  ])("rejects dynamic access through $name in source and bundle", async ({ owner }) => {
    const source = `const key=['fe','tch'].join('');void ${owner}[key];`;
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
      source: "void document.firstElementChild.ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "collection ownerDocument",
      source: "void document.getElementsByTagName('body')[0].ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "computed document method",
      source: "const make='createElement';void document[make]('div').ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "computed global document",
      source: "const doc='document';void globalThis[doc].defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "aliased DOM ownerDocument",
      source: "const body=document.body;const doc=body.ownerDocument;void doc.defaultView[key]('/state')",
      detail: "window.fetch",
    },
    {
      name: "destructured DOM ownerDocument",
      source: "const {ownerDocument}=document.body;void ownerDocument.defaultView[key]('/state')",
      detail: "window.fetch",
    },
  ])("rejects browser accessor flow through $name", async ({ source, detail }) => {
    const prelude = "const key=['fe','tch'].join('');const sendBeaconKey=['send','Beacon'].join('');";
    const root = await fixture(`${prelude}${source};export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), `${prelude}${source};`);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
  });

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

      const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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
    const source = "function fetch(){};const localStorage=new Map();fetch();localStorage.set('x','y');";
    const root = await fixture(`${source}export default function App(){}`);
    await writeFile(resolve(root, "dist/assets/index.js"), source);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => ["src/App.tsx", "dist/assets/index.js"].includes(file)))
      .toEqual([]);
  });

  it("rejects destructuring that stores a privileged value", async () => {
    const root = await fixture("const [browser] = [window]; export default function App() { void browser; }");
    await writeFile(resolve(root, "dist/assets/index.js"), "const[browser]=[window];void browser;");

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-escape",
      detail: "privileged browser global",
    });
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "src/App.tsx")).toContainEqual({
      file: "src/App.tsx",
      code: "browser-global-reflection",
      detail: "Reflect.get",
    });
    expect(findings.filter(({ file }) => file === "dist/assets/index.js")).toContainEqual({
      file: "dist/assets/index.js",
      code: "forbidden-bundle-marker",
      detail: "browser global reflection",
    });
  });

  it("fails closed on Vite glob and query imports", async () => {
    const root = await fixture(`
      const modules = import.meta.glob('./hidden/*.ts', { eager: true });
      import raw from './runtime.json?raw';
      export default function App() { void modules; void raw; }
    `);

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));

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
      resolve(root, "index.html"),
      '<img src="//cdn-html.example.test/x.png"><script type="module" src="/src/main.tsx"></script>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: "src/screen.css",
          code: "external-origin",
          detail: "//cdn-css.example.test/x.png",
        },
        {
          file: "index.html",
          code: "external-origin",
          detail: "//cdn-html.example.test/x.png",
        },
      ]),
    );
  });

  it("allows the official image base only in useCardImage and rejects other origins", async () => {
    const root = await fixture(
      "import './ui/hooks/useCardImage'; export default function App() {}",
    );
    await mkdir(resolve(root, "src/ui/hooks"), { recursive: true });
    await writeFile(
      resolve(root, "src/ui/hooks/useCardImage.ts"),
      "export const image = 'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/B01001.png';",
    );

    expect(await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }))).toEqual([]);

    await writeFile(
      resolve(root, "src/ui/hooks/useCardImage.ts"),
      "export const image = 'https://cdn.example.test/card.png';",
    );
    expect(await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }))).toContainEqual({
      file: "src/ui/hooks/useCardImage.ts",
      code: "external-origin",
      detail: "https://cdn.example.test/card.png",
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
      await writeFile(resolve(root, helper), "import { readFileSync } from 'node:fs'; void readFileSync;");
    }

    expect(await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }))).toEqual([]);

    await writeFile(
      resolve(root, "src/App.tsx"),
      "import './engine/cards/tsv-loader-fs'; export default function App() {}",
    );
    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

  it("rejects dynamic chunks and forbidden server markers in the production manifest", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "dist/.vite/manifest.json"),
      JSON.stringify({
        "index.html": {
          file: "assets/index.js",
          isEntry: true,
          dynamicImports: ["src/lazy.ts"],
        },
        "src/lazy.ts": { file: "assets/lazy.js" },
      }),
    );
    await writeFile(
      resolve(root, "dist/assets/index.js"),
      "const leaked = 'node:fs'; const file = readFileSync;",
    );
    await writeFile(resolve(root, "dist/assets/lazy.js"), "export default 1;");

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["dynamic-import", "forbidden-bundle-marker"]),
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
      code: "production-entry",
      detail: "src/extra.ts",
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toContainEqual({
      file: "dist/index.html",
      code: "production-entry",
      detail: "invalid generated script entry",
    });
  });

  it("rejects inline HTML execution channels in source and generated output", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "index.html"),
      '<body onload="fetch(\'/api\')"><a href="java&#x09;script:alert(1)">x</a><script type="module" src="/src/main.tsx"></script></body>',
    );
    await writeFile(
      resolve(root, "dist/index.html"),
      '<body onload="fetch(\'/api\')"><a href="java&NewLine;script:alert(1)">x</a><script type="module" src="/assets/index.js"></script></body>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toEqual(
      expect.arrayContaining([
        { file: "index.html", code: "html-execution", detail: "onload" },
        { file: "index.html", code: "html-execution", detail: "javascript URL" },
        { file: "dist/index.html", code: "html-execution", detail: "onload" },
        { file: "dist/index.html", code: "html-execution", detail: "javascript URL" },
      ]),
    );
  });

  it("rejects entity-decoded leading C0 controls in javascript URLs", async () => {
    const root = await fixture();
    await writeFile(
      resolve(root, "index.html"),
      '<a href="&#x01;javascript:alert(1)">x</a><script type="module" src="/src/main.tsx"></script>',
    );
    await writeFile(
      resolve(root, "dist/index.html"),
      '<a href="&#x1f;javascript:alert(1)">x</a><script type="module" src="/assets/index.js"></script>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings.filter(({ file }) => file === "index.html")).toContainEqual({
      file: "index.html",
      code: "html-execution",
      detail: "javascript URL",
    });
    expect(findings.filter(({ file }) => file === "dist/index.html")).toContainEqual({
      file: "dist/index.html",
      code: "html-execution",
      detail: "javascript URL",
    });
  });

  it("rejects CSS-escaped external URLs in stylesheets and HTML style surfaces", async () => {
    const root = await fixture("import './screen.css'; export default function App() {}");
    const escapedOfficial = String.raw`url(\68 ttps\3a \2f \2f www\2e takaratomy\2e co\2e jp\2f products\2f conan-cardgame\2f storage\2f card\2f secret.png)`;
    await writeFile(
      resolve(root, "src/screen.css"),
      `.source { background-image: ${escapedOfficial}; }`,
    );
    await writeFile(
      resolve(root, "index.html"),
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

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    for (const file of ["src/screen.css", "index.html", "dist/assets/index.css", "dist/index.html"]) {
      expect(findings.filter((finding) => finding.file === file)).toContainEqual({
        file,
        code: "external-origin",
        detail:
          "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/secret.png",
      });
    }
  });

  it("traverses CSS-escaped local imports before inspecting their contents", async () => {
    const root = await fixture("import './screen.css'; export default function App() {}");
    await writeFile(resolve(root, "src/screen.css"), String.raw`@import "\6e ested.css";`);
    await writeFile(
      resolve(root, "src/nested.css"),
      ".nested { background: url('https://nested-css.example.test/card.png'); }",
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
    expect(findings).toContainEqual({
      file: "src/nested.css",
      code: "external-origin",
      detail: "https://nested-css.example.test/card.png",
    });
  });

  it("fails closed on malformed CSS and any SVG CSS surface", async () => {
    const root = await fixture("import './broken.css'; export default function App() {}");
    await writeFile(resolve(root, "src/broken.css"), ".broken { background: url('x' }");
    await writeFile(
      resolve(root, "dist/favicon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:red}</style><path class="x"/></svg>',
    );

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));
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

    const escaped = await auditRuntimeBoundary(escapedRoot, async () => ({ stdout: "", stderr: "" }));
    const dynamic = await auditRuntimeBoundary(dynamicRoot, async () => ({ stdout: "", stderr: "" }));
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
      resolve(root, "vite.config.ts"),
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
      resolve(root, "vite.config.ts"),
      "const config = {}; config.root = 'alternate'; config.build = { outDir: '../outside', emptyOutDir: true }; export default config;",
    );
    let builds = 0;

    const findings = await auditRuntimeBoundary(root, async () => {
      builds += 1;
      return { stdout: "", stderr: "" };
    });

    expect(builds).toBe(0);
    expect(findings).toContainEqual({
      file: "vite.config.ts",
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
      expect.arrayContaining(["browser-externalization", "meta-build", "dist-meta"]),
    );
  });

  it("rejects external origins and extra module entries in index.html", async () => {
    const root = await fixture();
    await writeFile(resolve(root, "src/extra.ts"), "location.href = '/other';");
    await writeFile(
      resolve(root, "index.html"),
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
      file: "index.html",
      code: "external-origin",
      detail: "https://outside.example.test/leave",
    });
    expect(findings).toContainEqual({
      file: "index.html",
      code: "root-entry",
      detail: "expected only /src/main.tsx as a module entry",
    });
  });

  it("requires index.html to enter through src/main.tsx and reach src/App.tsx", async () => {
    const root = await fixture();
    await writeFile(resolve(root, "index.html"), '<script type="module" src="/src/other.ts"></script>');
    await writeFile(resolve(root, "src/other.ts"), "export {};");

    const findings = await auditRuntimeBoundary(root, async () => ({ stdout: "", stderr: "" }));

    expect(findings.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["root-entry", "app-entry"]),
    );
  });

  it("runs the repository-local Vite executable with ambient build authority removed", async () => {
    const root = await fixture();
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// fixture");
    const previousNodeOptions = process.env.NODE_OPTIONS;
    const previousVitePoison = process.env.VITE_POISON;
    process.env.NODE_OPTIONS = "--import=poison";
    process.env.VITE_POISON = "secret";
    try {
      const seen: Array<{ file: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }> = [];
      const output = await runCanonicalBoundaryBuild(root, async (command) => {
        seen.push(command);
        return { stdout: "built\n", stderr: "" };
      });

      expect(output).toEqual({ stdout: "built\n", stderr: "" });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.file).toBe(process.execPath);
      expect(seen[0]?.args).toEqual([
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--manifest",
        "--config",
        "vite.config.ts",
      ]);
      expect(seen[0]?.cwd).toBe(root);
      expect(seen[0]?.env.NODE_OPTIONS).toBeUndefined();
      expect(seen[0]?.env.VITE_POISON).toBeUndefined();
    } finally {
      if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousNodeOptions;
      if (previousVitePoison === undefined) delete process.env.VITE_POISON;
      else process.env.VITE_POISON = previousVitePoison;
    }
  });
});
