import { createHash } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { engine } from "../../src/engine/index.js";
import { registerAll } from "../../src/cards/index.js";
import { event } from "../../src/engine/event/index.js";
import { _resetActionContexts } from "../../src/engine/flow/action/state-machine.js";
import { _resetTargetExpanders } from "../../src/engine/flow/action/target-expander.js";
import { _resetUidCounter } from "../../src/engine/mutate/scene.js";
import { createEmptyGameState } from "../../src/engine/state-factory.js";
import { produce } from "../../src/engine/produce.js";
import { createRng } from "../../src/engine/rng.js";
import type { AIPolicy } from "../../src/ai/policy.js";
import { recordMatch } from "../../src/ai/replay/recorder.js";
import { buildDeckPair } from "../../src/ui/services/deckBuilder.js";

const APP_ORIGIN = "http://127.0.0.1:5196";
const OFFICIAL_IMAGE_BASE =
  "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/";
const SECURITY_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.takaratomy.co.jp; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'";
const IMAGE_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#123"/></svg>';

type ManifestEntry = { path: string; bytes: number; sha256: string };
type PageEvidence = {
  errors: string[];
  requests: string[];
  officialRequests: { url: string; referer: string | undefined }[];
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function manifestEntries(name: string): Promise<ManifestEntry[]> {
  const parsed = JSON.parse(await readFile(requiredEnvironment(name), "utf8")) as {
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
    if (mode === "invalid") {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: "not-an-image",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: IMAGE_BODY,
    });
  });
}

function monitorPage(page: Page): PageEvidence {
  const evidence: PageEvidence = { errors: [], requests: [], officialRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error") evidence.errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => evidence.errors.push(`page: ${error.message}`));
  page.on("request", (request) => {
    const url = request.url();
    evidence.requests.push(url);
    if (url.startsWith(OFFICIAL_IMAGE_BASE)) {
      evidence.officialRequests.push({
        url,
        referer: request.headers().referer,
      });
    }
  });
  return evidence;
}

async function expectRuntimeClean(page: Page, evidence: PageEvidence): Promise<void> {
  const forbidden = evidence.requests.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin !== APP_ORIGIN && !url.startsWith(OFFICIAL_IMAGE_BASE);
    } catch {
      return true;
    }
  });
  expect(forbidden, "selfと公式画像以外のrequest").toEqual([]);
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

async function openSetup(page: Page): Promise<void> {
  await page.goto("/#setup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: /名探偵コナンTCG/ })).toBeVisible();
  await expect(page.locator('[data-testid="game-setup-self-deck"]')).toHaveValue("CT-D08");
  await expect(page.locator('[data-testid="game-setup-opp-deck"]')).toHaveValue("CT-D11");
  await expect(page.locator('[data-testid="game-setup-replay-file"]')).toBeAttached();
  await expect(page.locator(".play-area")).toBeAttached();
  await expect(page.locator(".meta-nav-item, .meta-cta-tile, .meta-fade")).toHaveCount(0);
}

async function skipMulligan(page: Page): Promise<Locator> {
  const skip = page.getByRole("button", { name: "引き直しなし" });
  await expect(skip).toBeVisible();
  await skip.scrollIntoViewIfNeeded();
  await skip.click();
  await expect(page.locator(".mulligan-modal")).not.toBeVisible();
  return skip;
}

async function startMatch(page: Page): Promise<void> {
  await page.locator('[data-testid="game-setup-self-deck"]').selectOption("CT-D08");
  await page.locator('[data-testid="game-setup-opp-deck"]').selectOption("CT-D11");
  await page.locator('[data-testid="game-setup-start"]').click();
  await skipMulligan(page);
  await expect(page.locator(".actions-panel")).toBeVisible();
}

async function clickFirstVisible(page: Page, selectors: readonly string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0 && (await locator.isVisible()) && (await locator.isEnabled())) {
      await locator.click();
      return true;
    }
  }
  return false;
}

async function resolveVisibleDecision(page: Page): Promise<boolean> {
  if (
    await clickFirstVisible(page, [
      '[data-testid="opt-run-no"]',
      '[data-testid="repeat-opt-run-no"]',
      '[data-testid="choose-intercept-decline"]',
      '[data-testid="leave-intercept-no"]',
      '[data-testid="hirameki-skip-btn"]',
      '[data-testid="guard-picker-skip"]',
      '[data-testid="cid-pass"]',
      '[data-testid="effect-picker-skip"]',
      '[data-testid="card-list-pick-skip"]',
      '[data-testid="hand-zone-pick-skip"]',
      '[data-testid="scene-pick-skip"]',
      '[data-testid="switch-victim-cancel"]',
      '[data-testid="declare-card-name-skip"]',
      '[data-testid="misread-skip-btn"]',
      '[data-testid="set-card-replacement-decline"]',
      '[data-testid="souza-cancel-btn"]',
      '[data-testid="cp-cancel-btn"]',
      '[data-testid="hand-zone-pick-cancel"]',
      '[data-testid="set-card-cost-cancel"]',
    ])
  ) {
    return true;
  }
  if (await clickFirstVisible(page, ['button[data-testid^="cp-opt-"]'])) return true;
  if (
    await clickFirstVisible(page, [
      '[data-testid="rps-rock"]',
      'button[data-testid^="guard-cand-"]',
      'button[data-testid^="set-card-choice-"]:not([aria-pressed="true"])',
    ])
  ) {
    return true;
  }
  if (
    await clickFirstVisible(page, [
      '[data-testid^="confirm-effect-order-"]',
      '[data-testid="deck-reorder-confirm-btn"]',
      '[data-testid="deck-place-confirm-btn"]',
    ])
  ) {
    return true;
  }
  const candidate = page
    .locator('button[data-testid^="effect-pick-cand-"]:not([aria-pressed="true"])')
    .first();
  if ((await candidate.count()) > 0 && (await candidate.isVisible())) {
    await candidate.click();
    const confirm = page.locator('[data-testid="effect-picker-confirm"]');
    if (await confirm.isEnabled()) await confirm.click();
    return true;
  }
  const cardListCandidate = page
    .locator(
      'button[data-testid^="card-list-pick-"]:not([data-testid*="detail"]):not([aria-pressed="true"])',
    )
    .first();
  if ((await cardListCandidate.count()) > 0 && (await cardListCandidate.isVisible())) {
    await cardListCandidate.click();
    const confirm = page.locator('[data-testid="card-list-pick-confirm"]');
    if (await confirm.isEnabled()) await confirm.click();
    return true;
  }
  const handCandidate = page
    .locator(".hand-card--pickable:not(.hand-card--pick-selected)")
    .first();
  if ((await handCandidate.count()) > 0 && (await handCandidate.isVisible())) {
    await handCandidate.click();
    const confirm = page.locator('[data-testid="hand-zone-pick-confirm"]');
    if (
      (await confirm.count()) > 0
      && (await confirm.isVisible())
      && (await confirm.isEnabled())
    ) {
      await confirm.click();
    }
    return true;
  }
  if (await clickFirstVisible(page, [".card.effect-pickable"])) return true;
  if (
    await clickFirstVisible(page, [
      '[data-testid="souza-confirm-btn"]',
      '[data-testid="misread-confirm-btn"]',
      '[data-testid="set-card-cost-confirm"]',
    ])
  ) {
    return true;
  }
  return false;
}

async function driveMatchThroughVisibleTurn30(page: Page, testInfo: TestInfo): Promise<{
  sawCpu: boolean;
  sawEndTurn: boolean;
  transitions: number;
  won: boolean;
}> {
  const deadline = Date.now() + 150_000;
  let lastChapter = await page.locator(".chapter-tag").innerText();
  let transitions = 0;
  let sawCpu = false;
  let sawEndTurn = false;
  while (Date.now() < deadline && transitions < 30) {
    if (await page.locator('[data-testid="victory-overlay"]').isVisible().catch(() => false)) break;
    if (
      await page
        .getByTestId("match-narrator-status")
        .filter({ hasText: "相手のターン処理中" })
        .isVisible()
        .catch(() => false)
    ) {
      sawCpu = true;
    }
    const chapter = await page.locator(".chapter-tag").innerText();
    if (chapter !== lastChapter) {
      lastChapter = chapter;
      transitions += 1;
    }
    if (await resolveVisibleDecision(page)) continue;
    const endTurn = page.getByRole("button", { name: "ターン終了" });
    if (await endTurn.isEnabled().catch(() => false)) {
      sawEndTurn = true;
      await endTurn.click();
      const confirm = page.locator(".confirm-modal-footer .confirm-ok");
      await expect(confirm).toBeVisible();
      await confirm.click();
      continue;
    }
    await page.waitForTimeout(100);
  }
  const won = await page.locator('[data-testid="victory-overlay"]').isVisible().catch(() => false);
  if (!won && transitions < 30) {
    const state = await page.evaluate(() => ({
      href: location.href,
      dialogs: [...document.querySelectorAll('[role="dialog"]')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => ({
          testId: element.getAttribute("data-testid"),
          text: element.textContent?.trim().slice(0, 500) ?? "",
        })),
      visibleTestIds: [...document.querySelectorAll("[data-testid]")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
        })
        .map((element) => element.getAttribute("data-testid"))
        .filter((value): value is string => value !== null)
        .slice(0, 200),
      enabledButtons: [...document.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
        .filter((button) => button.getBoundingClientRect().width > 0)
        .map((button) => ({
          testId: button.getAttribute("data-testid"),
          text: button.textContent?.trim().slice(0, 120) ?? "",
        }))
        .slice(0, 100),
    }));
    await testInfo.attach("public-match-stall.json", {
      body: Buffer.from(JSON.stringify({ transitions, ...state }, null, 2)),
      contentType: "application/json",
    });
    await testInfo.attach("public-match-stall.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    throw new Error(
      `public match driver stalled: transitions=${transitions}; state=${JSON.stringify(state)}`,
    );
  }
  return { sawCpu, sawEndTurn, transitions, won };
}

function resetReplayRuntime(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
}

async function createReplayFile(projectName: string): Promise<string> {
  const originalRandom = Math.random;
  try {
    resetReplayRuntime();
    const rng = createRng(`private-hosted-${projectName}`);
    Math.random = () => rng.next();
    const first: "self" | "opp" = rng.next() < 0.5 ? "self" : "opp";
    let initialState = createEmptyGameState();
    initialState = produce(initialState, (draft) => {
      engine.flow.setup.init(
        draft,
        buildDeckPair({ selfDeckId: "CT-D08", oppDeckId: "CT-D11" }),
      );
      engine.flow.setup.decideFirstPlayer(draft, "manual", first);
      engine.flow.setup.dealOpeningHand(draft, "self");
      engine.flow.setup.dealOpeningHand(draft, "opp");
      engine.flow.setup.mulligan(draft, "self", []);
      engine.flow.setup.mulligan(draft, "opp", []);
      engine.flow.setup.reveal(draft);
      engine.flow.setup.startGame(draft);
      engine.flow.runAutoPhase(draft, first);
      engine.resolve.runAllUntilEmpty(draft);
    });
    const endTurnPolicy: AIPolicy = {
      name: "private-hosted-end-turn",
      choose(_state, candidates) {
        return candidates.find((move) => move.kind === "endTurn") ?? candidates[0] ?? null;
      },
    };
    const { log } = recordMatch({
      selfPolicy: endTurnPolicy,
      oppPolicy: endTurnPolicy,
      initialState,
      maxTurns: 2,
    });
    expect(log.schemaVersion).toBe(2);
    expect(log.moves.length).toBeGreaterThan(0);
    const path = resolve(
      requiredEnvironment("PRIVATE_HOSTED_RUN_DIR"),
      `recorded-replay-${projectName}.json`,
    );
    await writeFile(path, `${JSON.stringify(log)}\n`);
    return path;
  } finally {
    Math.random = originalRandom;
  }
}

async function expectInsideViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectTouchHeight(locator: Locator): Promise<void> {
  await expect
    .poll(async () => (await locator.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
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

test.describe("private hosted production static app", () => {
  test("@desktop serves the exact response set with release headers and no dev bridge", async ({
    page,
    request,
  }) => {
    await mockOfficialImages(page);
    const evidence = monitorPage(page);
    await openSetup(page);
    const staging = requiredEnvironment("PRIVATE_HOSTED_STAGING_DIR");
    const responseEntries = await manifestEntries("PRIVATE_HOSTED_RESPONSE_MANIFEST");
    const uploadEntries = await manifestEntries("PRIVATE_HOSTED_UPLOAD_MANIFEST");
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
      const contentType = headers["content-type"] ?? "";
      if (
        /\.(?:m?js|cjs)$/i.test(entry.path) ||
        /(?:java|ecma)script/i.test(contentType)
      ) {
        expect(body.toString("utf8"), `${entry.path} dev bridge`).not.toContain("__game");
      }
    }
    const headerEntry = uploadEntries.find((entry) => entry.path === "/_headers");
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

  test("@desktop runs match from setup through winner or visible turn 30 using public controls", async ({
    page,
  }, testInfo) => {
    await mockOfficialImages(page);
    const evidence = monitorPage(page);
    await openSetup(page);
    await startMatch(page);
    const result = await driveMatchThroughVisibleTurn30(page, testInfo);
    expect(result.sawEndTurn).toBe(true);
    expect(result.sawCpu).toBe(true);
    expect(result.won || result.transitions >= 30).toBe(true);
    if (result.won) {
      await expect(page.locator('[data-testid="victory-overlay"]')).toContainText(/YOU (WIN|LOSE)/);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="game-setup-start"]')).toBeVisible();
    await expectRuntimeClean(page, evidence);
  });

  test("@desktop completes tutorial and reload clears its in-memory position", async ({ page }) => {
    await mockOfficialImages(page);
    const evidence = monitorPage(page);
    await openSetup(page);
    await page.locator('[data-testid="game-setup-tutorial"]').click();
    await skipMulligan(page);
    const overlay = page.locator('[data-testid="tutorial-overlay"]');
    await expect(overlay).toBeVisible();
    await page.locator('[data-testid="tutorial-next"]').click();
    await expect(overlay.locator(".tutorial-progress")).toHaveText(/2 \/ /);
    await page.locator('[data-testid="tutorial-prev"]').click();
    await expect(overlay.locator(".tutorial-progress")).toHaveText(/1 \/ /);
    for (let index = 0; index < 100 && (await overlay.isVisible()); index += 1) {
      await page.locator('[data-testid="tutorial-next"]').click();
    }
    await expect(overlay).not.toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="game-setup-start"]')).toBeVisible();
    await expect(overlay).not.toBeVisible();
    await expectRuntimeClean(page, evidence);
  });

  test("@desktop loads an actual recorder log and exercises every replay control", async ({
    page,
  }, testInfo) => {
    await mockOfficialImages(page);
    const evidence = monitorPage(page);
    const replayPath = await createReplayFile(testInfo.project.name);
    await openSetup(page);
    await page.locator('[data-testid="game-setup-replay-file"]').setInputFiles(replayPath);
    const panel = page.locator('[data-testid="replay-panel"]');
    await expect(panel).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(panel).not.toBeVisible();
    await expect(page.locator('[data-testid="game-setup-start"]')).toBeVisible();
    await page.locator('[data-testid="game-setup-replay-file"]').setInputFiles(replayPath);
    await expect(panel).toBeVisible();
    const playPause = page.locator('[data-testid="replay-play-pause"]');
    await playPause.click();
    await expect(playPause).toHaveAttribute("aria-pressed", "true");
    await playPause.click();
    await expect(playPause).toHaveAttribute("aria-pressed", "false");
    const before = await page.locator('[data-testid="replay-progress"]').innerText();
    await page.locator('[data-testid="replay-step"]').click();
    await expect(page.locator('[data-testid="replay-progress"]')).not.toHaveText(before);
    await page.locator('[data-testid="replay-speed-1500"]').click();
    await expect(page.locator('[data-testid="replay-speed-current"]')).toHaveText("1500ms");
    const seek = page.locator('[data-testid="replay-seek"]');
    const maximum = await seek.getAttribute("max");
    expect(maximum).not.toBeNull();
    await seek.fill(maximum!);
    await expect(page.locator('[data-testid="replay-progress"]')).toContainText(maximum!);
    await page.locator('[data-testid="replay-close"]').click();
    await expect(panel).not.toBeVisible();
    await expectRuntimeClean(page, evidence);
  });

  test("@desktop uses only official image URLs without Referer and falls back on failure", async ({
    page,
  }) => {
    const successEvidence = monitorPage(page);
    await mockOfficialImages(page);
    await openSetup(page);
    await page.locator('[data-testid="game-setup-start"]').click();
    await expect(page.locator(".mulligan-modal img.card-art").first()).toBeVisible();
    await expect
      .poll(() => successEvidence.officialRequests.length)
      .toBeGreaterThan(0);
    expect(successEvidence.officialRequests.every(({ url }) => url.startsWith(OFFICIAL_IMAGE_BASE))).toBe(true);
    expect(successEvidence.officialRequests.every(({ referer }) => referer === undefined)).toBe(true);
    await expectRuntimeClean(page, successEvidence);

    const failedPage = await page.context().newPage();
    const failedEvidence = monitorPage(failedPage);
    await mockOfficialImages(failedPage, "invalid");
    await openSetup(failedPage);
    await failedPage.locator('[data-testid="game-setup-start"]').click();
    const failedImage = failedPage.locator(".mulligan-modal img.card-art").first();
    await expect(failedImage).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expectRuntimeClean(failedPage, failedEvidence);
    await failedPage.close();
  });

  test("@desktop keeps two fresh browser contexts independent", async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      await mockOfficialImages(first);
      await mockOfficialImages(second);
      const firstPage = await first.newPage();
      const secondPage = await second.newPage();
      const firstEvidence = monitorPage(firstPage);
      const secondEvidence = monitorPage(secondPage);
      await Promise.all([openSetup(firstPage), openSetup(secondPage)]);
      await firstPage.locator('[data-testid="game-setup-start"]').click();
      await skipMulligan(firstPage);
      await expect(firstPage.locator(".actions-panel")).toBeVisible();
      await expect(secondPage.locator('[data-testid="game-setup-start"]')).toBeVisible();
      await expect(secondPage.locator(".mulligan-modal")).not.toBeVisible();
      await expectRuntimeClean(firstPage, firstEvidence);
      await expectRuntimeClean(secondPage, secondEvidence);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("@all keeps major public controls usable inside each supported landscape viewport", async ({
    page,
  }, testInfo) => {
    await mockOfficialImages(page);
    const evidence = monitorPage(page);
    const replayPath = await createReplayFile(testInfo.project.name);
    await openSetup(page);
    await expectNoHorizontalOverflow(page);
    for (const selector of [
      '[data-testid="game-setup-self-deck"]',
      '[data-testid="game-setup-opp-deck"]',
      '[data-testid="game-setup-start"]',
      '[data-testid="game-setup-tutorial"]',
      '[data-testid="game-setup-replay-file"]',
    ]) {
      await expectInsideViewport(page, page.locator(selector));
    }

    await page.locator('[data-testid="game-setup-tutorial"]').click();
    const mulliganSkip = page.getByRole("button", { name: "引き直しなし" });
    await expect(mulliganSkip).toBeVisible();
    await mulliganSkip.scrollIntoViewIfNeeded();
    await expectInsideViewport(page, mulliganSkip);
    await expectTouchHeight(mulliganSkip);
    await mulliganSkip.click();
    const next = page.locator('[data-testid="tutorial-next"]');
    const previous = page.locator('[data-testid="tutorial-prev"]');
    const exit = page.locator('[data-testid="tutorial-exit"]');
    for (const control of [next, previous, exit]) {
      await expectInsideViewport(page, control);
      await expectTouchHeight(control);
    }
    await next.click();
    await previous.click();
    await exit.click();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="game-setup-replay-file"]').setInputFiles(replayPath);
    const replayClose = page.locator('[data-testid="replay-close"]');
    await expect(replayClose).toBeVisible();
    await expectInsideViewport(page, replayClose);
    await replayClose.click();

    await page.reload({ waitUntil: "domcontentloaded" });
    await startMatch(page);
    const endTurn = page.getByRole("button", { name: "ターン終了" });
    await expect(endTurn).toBeVisible();
    await expectInsideViewport(page, endTurn);
    if (await endTurn.isEnabled()) {
      await endTurn.click();
      const confirm = page.locator(".confirm-modal-footer .confirm-ok");
      await expect(confirm).toBeVisible();
      await expectInsideViewport(page, confirm);
      await expectTouchHeight(confirm);
      await confirm.click();
    }
    await expectNoHorizontalOverflow(page);
    await expectRuntimeClean(page, evidence);
  });
});
