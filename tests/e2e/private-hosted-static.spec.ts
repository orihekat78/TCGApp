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
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.takaratomy.co.jp; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'";
const IMAGE_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#123"/></svg>';

type ManifestEntry = { path: string; bytes: number; sha256: string };
type PageEvidence = {
  errors: string[];
  requests: string[];
  officialRequests: { url: string; referer: string | undefined }[];
  officialNewsRequests: {
    url: string;
    method: string;
    postData: string | null;
    referer: string | undefined;
  }[];
};

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
        !url.startsWith(OFFICIAL_IMAGE_BASE)
      );
    } catch {
      return true;
    }
  });
  expect(forbidden, "self and approved official requests only").toEqual([]);
  expect(evidence.errors, "console/page errors").toEqual([]);
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
  test("@desktop serves the exact response set and keeps official NEWS cache-only", async ({
    page,
    request,
  }) => {
    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect(
      page.getByText("公式NEWSを読み込めませんでした"),
    ).toBeVisible();
    expect(evidence.officialNewsRequests).toEqual([]);
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
      await Promise.all([
        startMatchFromHome(firstPage),
        openSetupFromHome(secondPage),
      ]);
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

  test("@all keeps the HOME-first match flow contained at desktop and 851x393", async ({
    page,
  }) => {
    await mockOfficialResources(page);
    const evidence = monitorPage(page);
    await openSetupFromHome(page);
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, page.locator("#setup-title"));
    await expectInsideViewport(page, page.locator("button.setup-start"));
    await startMatchFromHome(page);
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
