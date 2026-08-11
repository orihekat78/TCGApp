import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:5196";
const OFFICIAL_IMAGE_BASE =
  "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/";
const OFFICIAL_NEWS_URL =
  "https://www.takaratomy.co.jp/products/conan-cardgame/";
const SECURITY_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.takaratomy.co.jp; font-src 'self'; connect-src 'self' https://www.takaratomy.co.jp; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'";
const IMAGE_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#123"/></svg>';

type ManifestEntry = { path: string; bytes: number; sha256: string };
type ViteManifestEntry = {
  file?: unknown;
  imports?: unknown;
  isDynamicEntry?: unknown;
};
type ViteManifest = Record<string, ViteManifestEntry>;
type ApprovedRouteChunks = {
  routes: Record<(typeof APPROVED_LAZY_ROUTE_KEYS)[number], string>;
  homeDeferredJavaScript: string[];
};
type PageEvidence = {
  errors: string[];
  requests: string[];
  unauthorizedResponses: string[];
  officialRequests: { url: string; referer: string | undefined }[];
  officialNewsRequests: {
    url: string;
    method: string;
    postData: string | null;
    referer: string | undefined;
  }[];
};

const APPROVED_LAZY_ROUTE_KEYS = [
  "src/services/gameRuntimeBundle.ts",
  "src/screens/CardsScreen.tsx",
  "src/screens/DeckEditor.tsx",
  "src/screens/HistoryScreen.tsx",
  "src/screens/RealMatchView.tsx",
  "src/screens/ReplayScreen.tsx",
  "src/screens/ResultScreen.tsx",
  "src/screens/SettingsScreen.tsx",
  "src/screens/SetupScreen.tsx",
  "src/screens/TutorialScreen.tsx",
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function manifestEntries(name: string): Promise<ManifestEntry[]> {
  const parsed = JSON.parse(
    await readFile(requiredEnvironment(name), "utf8"),
  ) as {
    schemaVersion: unknown;
    files: ManifestEntry[];
  };
  expect(parsed.schemaVersion).toBe(1);
  expect(Array.isArray(parsed.files)).toBe(true);
  return parsed.files;
}

async function approvedLazyRouteChunks(): Promise<ApprovedRouteChunks> {
  const staging = requiredEnvironment("PRIVATE_HOSTED_STAGING_DIR");
  const manifestCandidates = [
    resolve(staging, "..", "dist", ".vite", "manifest.json"),
    resolve("dist", ".vite", "manifest.json"),
  ];
  let manifestSource: string | undefined;
  for (const candidate of manifestCandidates) {
    try {
      manifestSource = await readFile(candidate, "utf8");
      break;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  if (!manifestSource) {
    throw new Error("Vite build manifest is unavailable for the staged artifact");
  }
  const manifest = JSON.parse(manifestSource) as ViteManifest;
  const routes = Object.fromEntries(
    APPROVED_LAZY_ROUTE_KEYS.map((key) => {
      const entry = manifest[key];
      expect(entry, `Vite entry ${key}`).toBeDefined();
      expect(entry?.isDynamicEntry, `Vite entry ${key} is dynamic`).toBe(true);
      expect(typeof entry?.file, `Vite entry ${key} output`).toBe("string");
      return [key, `/${entry!.file as string}`];
    }),
  ) as ApprovedRouteChunks["routes"];
  const javaScriptClosure = (rootKeys: readonly string[]): Set<string> => {
    const keys = [...rootKeys];
    const visited = new Set<string>();
    const paths = new Set<string>();
    while (keys.length > 0) {
      const key = keys.pop();
      if (!key || visited.has(key)) continue;
      visited.add(key);
      const entry = manifest[key];
      expect(entry, `Vite closure entry ${key}`).toBeDefined();
      expect(typeof entry?.file, `Vite closure entry ${key} output`).toBe("string");
      const file = entry?.file as string;
      if (/\.(?:m?js)$/i.test(file)) paths.add(`/${file}`);
      if (entry?.imports !== undefined) {
        expect(Array.isArray(entry.imports), `Vite closure entry ${key} imports`).toBe(true);
        keys.push(...(entry.imports as string[]));
      }
    }
    return paths;
  };
  const initialJavaScript = javaScriptClosure(["index.html"]);
  const homeDeferredJavaScript = [...javaScriptClosure(APPROVED_LAZY_ROUTE_KEYS)].filter(
    (path) => !initialJavaScript.has(path),
  );
  const responseEntries = await manifestEntries("PRIVATE_HOSTED_RESPONSE_MANIFEST");
  for (const path of [...Object.values(routes), ...homeDeferredJavaScript]) {
    expect(
      responseEntries.some((entry) => entry.path === path),
      `approved Vite output ${path} is staged for the browser`,
    ).toBe(true);
  }
  return { routes, homeDeferredJavaScript };
}

function requestedPaths(evidence: PageEvidence): string[] {
  return evidence.requests.map((url) => new URL(url).pathname);
}

async function mockOfficialImages(
  target: Page | BrowserContext,
  mode: "fulfill" | "invalid" = "fulfill",
): Promise<void> {
  await target.route(`${OFFICIAL_IMAGE_BASE}**`, async (route) => {
    await route.fulfill(
      mode === "invalid"
        ? { status: 200, contentType: "image/png", body: "not-an-image" }
        : { status: 200, contentType: "image/svg+xml", body: IMAGE_BODY },
    );
  });
}

async function mockOfficialNews(target: Page | BrowserContext): Promise<void> {
  await target.route(OFFICIAL_NEWS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<section id="news"><ul class="newsList all"><li><a href="/products/conan-cardgame/news/private-release/"><span class="category">NEWS</span><span class="title">Private release check</span><time datetime="2026-08-10">2026-08-10</time></a></li></ul></section>`,
    });
  });
}

async function mockOfficialResources(
  target: Page | BrowserContext,
  imageMode: "fulfill" | "invalid" = "fulfill",
): Promise<void> {
  await mockOfficialImages(target, imageMode);
  await mockOfficialNews(target);
}

function monitorPage(page: Page): PageEvidence {
  const evidence: PageEvidence = {
    errors: [],
    requests: [],
    unauthorizedResponses: [],
    officialRequests: [],
    officialNewsRequests: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error")
      evidence.errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    evidence.errors.push(`page: ${error.message}`),
  );
  page.on("request", (request) => {
    const url = request.url();
    evidence.requests.push(url);
    if (url.startsWith(OFFICIAL_IMAGE_BASE)) {
      evidence.officialRequests.push({
        url,
        referer: request.headers().referer,
      });
    }
    if (url === OFFICIAL_NEWS_URL) {
      evidence.officialNewsRequests.push({
        url,
        method: request.method(),
        postData: request.postData(),
        referer: request.headers().referer,
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() === 401) {
      evidence.unauthorizedResponses.push(response.url());
    }
  });
  return evidence;
}

async function expectRuntimeClean(
  page: Page,
  evidence: PageEvidence,
): Promise<void> {
  const forbidden = evidence.requests.filter((url) => {
    try {
      return (
        new URL(url).origin !== APP_ORIGIN &&
        !url.startsWith(OFFICIAL_IMAGE_BASE) &&
        url !== OFFICIAL_NEWS_URL
      );
    } catch {
      return true;
    }
  });
  expect(forbidden, "self and approved official requests only").toEqual([]);
  const expectedUnauthorizedConsole =
    "console: Failed to load resource: the server responded with a status of 401 (Unauthorized)";
  const unexpectedUnauthorizedResponses = evidence.unauthorizedResponses.filter(
    (url) => new URL(url).pathname !== "/api/v1/bootstrap",
  );
  expect(
    unexpectedUnauthorizedResponses,
    "only the local Access bootstrap probe may be unauthorized",
  ).toEqual([]);
  const unauthorizedConsoleCount = evidence.errors.filter(
    (error) => error === expectedUnauthorizedConsole,
  ).length;
  expect(unauthorizedConsoleCount).toBeLessThanOrEqual(
    evidence.unauthorizedResponses.length,
  );
  expect(
    evidence.errors.filter((error) => error !== expectedUnauthorizedConsole),
    "console/page errors",
  ).toEqual([]);
  expect(await page.evaluate(() => "__game" in window)).toBe(false);
  expect(
    await page.evaluate(async () =>
      "serviceWorker" in navigator
        ? (await navigator.serviceWorker.getRegistrations()).length
        : 0,
    ),
  ).toBe(0);
  expect(page.context().serviceWorkers()).toHaveLength(0);
}

async function openSetupFromHome(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-screen")).toBeVisible();
  const legalNotice = page.locator('[data-testid="home-legal-notice"]');
  await expect(legalNotice).toBeVisible();
  await expect(legalNotice).toContainText(
    "This is an unofficial fan project for personal use only.",
  );
  await expect(legalNotice).toContainText("© 青山剛昌／小学館 © TOMY");
  await expect(legalNotice).toContainText("公式商品ではありません。");
  await page.locator("button[data-route='setup']").click();
  await expect(page).toHaveURL(/#setup$/);
  await expect(page.locator("#setup-title")).toBeVisible();
}

async function startMatchFromHome(page: Page): Promise<void> {
  await openSetupFromHome(page);
  await startMatchFromCurrentSetup(page);
}

async function startMatchFromCurrentSetup(page: Page): Promise<void> {
  await page.locator("button.setup-start").click();
  await expect(page).toHaveURL(/#match$/);
  const skip = page.locator("button.mulligan-skip");
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).not.toBeVisible();
  await expect(page.locator("#scaler")).toBeVisible();
}

async function expectInsideViewport(
  page: Page,
  locator: Locator,
): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
}

test.describe("private hosted production static Meta app", () => {
  test("@desktop serves the exact response set and loads official NEWS once", async ({
    page,
    request,
  }) => {
    const bootstrap = await request.get("/api/v1/bootstrap");
    expect(bootstrap.status()).toBe(401);
    expect(bootstrap.headers()["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(await bootstrap.json()).toEqual({
      error: { code: "UNAUTHORIZED" },
    });

    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect.poll(() => evidence.officialNewsRequests.length).toBe(1);
    await expect(page.getByText("Private release check")).toBeVisible();
    await openSetupFromHome(page);
    const staging = requiredEnvironment("PRIVATE_HOSTED_STAGING_DIR");
    const responseEntries = await manifestEntries(
      "PRIVATE_HOSTED_RESPONSE_MANIFEST",
    );
    const uploadEntries = await manifestEntries(
      "PRIVATE_HOSTED_UPLOAD_MANIFEST",
    );
    expect(responseEntries.length).toBeGreaterThan(0);
    for (const entry of responseEntries) {
      const response = await request.get(entry.path);
      expect(response.status(), entry.path).toBe(200);
      const headers = response.headers();
      expect(headers["content-security-policy"], entry.path).toBe(CSP);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[name], `${entry.path} ${name}`).toBe(value);
      }
      const body = await response.body();
      expect(body.byteLength, entry.path).toBe(entry.bytes);
      expect(createHash("sha256").update(body).digest("hex"), entry.path).toBe(
        entry.sha256,
      );
      if (
        /\.(?:m?js|cjs)$/i.test(entry.path) ||
        /(?:java|ecma)script/i.test(headers["content-type"] ?? "")
      ) {
        expect(body.toString("utf8"), `${entry.path} dev bridge`).not.toContain(
          "__game",
        );
      }
    }
    const headerEntry = uploadEntries.find(
      (entry) => entry.path === "/_headers",
    );
    expect(headerEntry).toBeDefined();
    const rawHeaders = await readFile(resolve(staging, "_headers"), "utf8");
    const headerResponse = await request.get("/_headers");
    const rootResponse = await request.get("/");
    expect(headerResponse.status()).toBe(200);
    expect(headerResponse.headers()["content-type"]).toContain("text/html");
    expect(await headerResponse.body()).toEqual(await rootResponse.body());
    expect(await headerResponse.text()).not.toBe(rawHeaders);
    await expectRuntimeClean(page, evidence);
  });

  test("@desktop enters a match through HOME, SETUP, and mulligan using public controls", async ({
    page,
  }) => {
    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    await startMatchFromHome(page);
    await expectInsideViewport(page, page.locator("#scaler"));
    await expectRuntimeClean(page, evidence);
  });

  test("@desktop loads official images without a Referer and falls back when the image is invalid", async ({
    page,
  }) => {
    const successEvidence = monitorPage(page);
    await mockOfficialResources(page);
    await startMatchFromHome(page);
    await expect
      .poll(() => successEvidence.officialRequests.length)
      .toBeGreaterThan(0);
    expect(
      successEvidence.officialRequests.every(({ url }) =>
        url.startsWith(OFFICIAL_IMAGE_BASE),
      ),
    ).toBe(true);
    expect(
      successEvidence.officialRequests.every(
        ({ referer }) => referer === undefined,
      ),
    ).toBe(true);
    await expectRuntimeClean(page, successEvidence);

    const failedPage = await page.context().newPage();
    const failedEvidence = monitorPage(failedPage);
    await mockOfficialResources(failedPage, "invalid");
    await startMatchFromHome(failedPage);
    await expect(
      failedPage.locator('img[src^="data:image/svg+xml"]').first(),
    ).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expectRuntimeClean(failedPage, failedEvidence);
    await failedPage.close();
  });

  test("@desktop keeps fresh browser contexts independent through the public HOME flow", async ({
    browser,
  }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      await mockOfficialResources(first);
      await mockOfficialResources(second);
      const firstPage = await first.newPage();
      const secondPage = await second.newPage();
      const firstEvidence = monitorPage(firstPage);
      const secondEvidence = monitorPage(secondPage);
      await startMatchFromHome(firstPage);
      await openSetupFromHome(secondPage);
      await expect(firstPage.locator("#scaler")).toBeVisible();
      await expect(secondPage.locator("#setup-title")).toBeVisible();
      await expect(
        secondPage.locator("button.mulligan-skip"),
      ).not.toBeVisible();
      await expectRuntimeClean(firstPage, firstEvidence);
      await expectRuntimeClean(secondPage, secondEvidence);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("@all defers approved runtime and DECK chunks until rendered HOME navigation", async ({
    page,
  }) => {
    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    const chunks = await approvedLazyRouteChunks();
    const approvedLazyChunks = new Set(chunks.homeDeferredJavaScript);
    const approvedRouteChunks = new Set(Object.values(chunks.routes));

    await page.goto("/#home", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect.poll(() => evidence.officialNewsRequests.length).toBe(1);
    expect(
      requestedPaths(evidence).filter((path) => approvedLazyChunks.has(path)),
      "HOME must not load a lazy card, runtime, or route chunk",
    ).toEqual([]);

    await page.locator("button[data-route='deck']").click();
    await expect(page).toHaveURL(/#deck$/);
    await expect(page.locator(".deck-pool-grid")).toBeVisible();

    const requested = requestedPaths(evidence);
    const loadedLazyChunks = [...approvedRouteChunks]
      .filter((path) => requested.includes(path))
      .sort();
    const expectedDeckChunks = [chunks.routes["src/screens/DeckEditor.tsx"]];
    expect(
      loadedLazyChunks,
      "DECK navigation must load only the approved DECK route chunk",
    ).toEqual(expectedDeckChunks);
    for (const path of expectedDeckChunks) {
      expect(
        requested.filter((requestPath) => requestPath === path),
        `${path} loads once`,
      ).toHaveLength(1);
    }
    expect(
      requested.filter(
        (path) => path === chunks.routes["src/services/gameRuntimeBundle.ts"],
      ),
      "DECK does not initialize the match runtime",
    ).toEqual([]);

    const poolTiles = page.locator(".deck-pool-card");
    await expect(poolTiles.first()).toBeVisible();
    const initiallyVisibleTestIds = await poolTiles.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-testid")),
    );
    const initialTileCount = await poolTiles.count();
    expect(initialTileCount, "initial catalog tile count").toBeGreaterThan(0);
    expect(initialTileCount, "initial catalog tile count").toBeLessThanOrEqual(48);

    let peakTileCount = initialTileCount;
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      await page.locator(".deck-pool-grid").evaluate((element, nextFraction) => {
        element.scrollTop = Math.round(
          (element.scrollHeight - element.clientHeight) * nextFraction,
        );
        element.dispatchEvent(new Event("scroll"));
      }, fraction);
      await expect.poll(() => poolTiles.count()).toBeGreaterThan(0);
      peakTileCount = Math.max(peakTileCount, await poolTiles.count());
    }
    expect(peakTileCount, "catalog tiles mounted while scrolling").toBeLessThanOrEqual(96);

    const distantTileTestId = await poolTiles.evaluateAll(
      (elements, initialIds) =>
        elements
          .map((element) => element.getAttribute("data-testid"))
          .find(
            (testId): testId is string =>
              testId !== null && !initialIds.includes(testId),
          ),
      initiallyVisibleTestIds,
    );
    if (!distantTileTestId) {
      throw new Error("scrolling must expose a DECK pool tile outside the initial window");
    }
    const distantTile = page.locator(`[data-testid="${distantTileTestId}"]`);
    await expect(distantTile).toBeVisible();
    const distantTileIdentity = await distantTile.evaluate((element) => {
      const identity = `private-hosted-deck-tile-${Date.now()}`;
      (element as HTMLElement & { __e2eIdentity?: string }).__e2eIdentity =
        identity;
      return identity;
    });
    await distantTile.dispatchEvent("pointerdown", {
      button: 0,
      isPrimary: true,
      pointerType: "touch",
    });
    expect(
      await distantTile.evaluate(
        (element, identity) =>
          element.isConnected &&
          (element as HTMLElement & { __e2eIdentity?: string })
            .__e2eIdentity === identity,
        distantTileIdentity,
      ),
      "pointerdown keeps the newly visible DECK tile mounted",
    ).toBe(true);
    await distantTile.focus();
    await expect(distantTile).toBeFocused();
    expect(
      await distantTile.evaluate(
        (element, identity) =>
          element.isConnected &&
          document.activeElement === element &&
          (element as HTMLElement & { __e2eIdentity?: string })
            .__e2eIdentity === identity,
        distantTileIdentity,
      ),
      "the pointer target remains the focused DECK tile",
    ).toBe(true);
    await distantTile.click();

    const detailDialog = page.locator(".deck-detail-drawer[role='dialog']");
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText(
      distantTileTestId.replace("deck-pool-card-", ""),
    );
    await expect(detailDialog.locator("[data-testid='deck-detail-actions']")).toBeVisible();
    const closeDetail = detailDialog.getByRole("button", {
      name: "カード詳細を閉じる",
    });
    const addToDeck = detailDialog.locator(".deck-detail-add");
    await expect(closeDetail).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(addToDeck).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeDetail).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(detailDialog).toBeHidden();
    await expect(distantTile).toBeFocused();
    expect(
      await distantTile.evaluate(
        (element, identity) =>
          element.isConnected &&
          document.activeElement === element &&
          (element as HTMLElement & { __e2eIdentity?: string })
            .__e2eIdentity === identity,
        distantTileIdentity,
      ),
      "closing detail returns focus to the same mounted DECK tile",
    ).toBe(true);

    expect(evidence.officialNewsRequests).toEqual([
      {
        url: OFFICIAL_NEWS_URL,
        method: "GET",
        postData: null,
        referer: undefined,
      },
    ]);
    await expectRuntimeClean(page, evidence);
  });

  test("@all keeps the HOME-first match flow contained and loads runtime once", async ({
    page,
  }) => {
    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    const chunks = await approvedLazyRouteChunks();
    const runtimeChunk = chunks.routes["src/services/gameRuntimeBundle.ts"];
    await openSetupFromHome(page);
    expect(
      requestedPaths(evidence).filter((path) => path === runtimeChunk),
      "SETUP navigation loads the game runtime once",
    ).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, page.locator("#setup-title"));
    await expectInsideViewport(page, page.locator("button.setup-start"));
    await startMatchFromCurrentSetup(page);
    expect(
      requestedPaths(evidence).filter((path) => path === runtimeChunk),
      "MATCH flow must reuse the SETUP-loaded game runtime",
    ).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, page.locator("#scaler"));
    if (
      (page.viewportSize()?.width ?? 0) === 851 &&
      (page.viewportSize()?.height ?? 0) === 393
    ) {
      await expect(page.locator("#scaler")).toHaveAttribute(
        "data-playmat-layout",
        "desktop",
      );
      await expect(page.locator("#scaler")).toHaveAttribute(
        "data-playmat-fit",
        "contained-landscape",
      );
    }
    await expectRuntimeClean(page, evidence);
  });
});
