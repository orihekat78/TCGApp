import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const captureDirectory = resolve(process.cwd(), '.claude/research/ui/runtime-captures/2026-08-04-wave2');
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '851x393', width: 851, height: 393 },
  { name: '720x393', width: 720, height: 393 },
] as const;

const routes = [
  { name: 'history', hash: '#history', root: '.history-screen' },
  { name: 'settings', hash: '#settings', root: '.settings-screen' },
  { name: 'result', hash: '#result', root: '.result-screen' },
] as const;

test.beforeAll(async () => {
  await mkdir(captureDirectory, { recursive: true });
});

for (const viewport of viewports) {
  test(`WAVE 2: History, Settings, and Result stay usable at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await installHistoryFixture(page);
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await openRoute(page, route.name, route.hash);
      const screen = page.locator(route.root);
      await expect(screen).toBeVisible();
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await expect(page.locator('html')).toHaveJSProperty('clientWidth', viewport.width);
      await assertNoDocumentOverflow(page);
      await assertKeyControlSize(page, route.name);
      if (route.name === 'history') await assertHistoryReplayUnavailable(page);
      if (route.name === 'settings' && viewport.width <= 900) await assertSettingsBelowHeader(page);
      if (route.name === 'result' && viewport.height <= 520) await assertResultLandscapeTypography(page);
      await screen.screenshot({
        path: resolve(captureDirectory, `${route.name}-${viewport.name}.png`),
      });
    }

    expect(errors).toEqual([]);
  });
}

test('WAVE 2: Result focuses its announced verdict and honors reduced motion at 200% page scale', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 720, height: 393 });
  await openRoute(page, 'result', '#result');

  const title = page.locator('#result-title');
  await expect(title).toBeFocused();
  await expect(page.getByRole('status')).toContainText(/./);
  const motion = await page.locator('.result-screen').evaluate((element) => {
    const style = getComputedStyle(element);
    return { animation: style.animationName, transition: style.transitionDuration };
  });
  expect(motion.animation).toBe('none');
  expect(motion.transition).toBe('0s');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  const zoom = await page.evaluate(() => ({
    scale: window.visualViewport?.scale ?? 1,
    title: document.querySelector<HTMLElement>('#result-title')?.getBoundingClientRect().toJSON(),
  }));
  expect(zoom.scale).toBeGreaterThanOrEqual(1.99);
  expect(zoom.title).toBeDefined();
  expect(zoom.title!.width).toBeGreaterThan(0);
  await assertNoDocumentOverflow(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  expect(errors).toEqual([]);
});

async function openRoute(page: Page, route: (typeof routes)[number]['name'], hash: string): Promise<void> {
  if (route === 'result') {
    await page.goto('/');
    await installResultFixture(page);
    await page.goto(`/${hash}`);
    return;
  }

  await page.goto(`/${hash}`);
}

async function installHistoryFixture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      version: 1,
      state: {
        history: [
        {
          id: 'wave2-responsive-result', sessionId: 'wave2-responsive-result', recorded: 1_722_477_600_000, won: true, mode: 'solo',
          deckName: '少年探偵団・標準', oppDeckName: '警察・標準', turns: 8, duration: 480,
          evidGot: 7, evidLost: 4, contacts: 2, hirameki: 1, misread: 0, p1Target: 7, p2Target: 6,
        },
        {
          id: 'wave2-history-observe', recorded: 1_722_391_200_000, won: false, mode: 'observe',
          deckName: 'CPU 1 deck', oppDeckName: 'CPU 2 deck', turns: 11, duration: 660,
          evidGot: 5, evidLost: 7, contacts: 1, hirameki: 0, misread: 2, p1Target: 7, p2Target: 6,
        },
        ],
      },
    }));
  });
  await page.reload();
}

async function installResultFixture(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const viteModule = (sourcePath: string) => {
      const resource = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => name.includes(sourcePath));
      if (!resource) throw new Error(`Wave 2 fixture could not resolve ${sourcePath}`);
      return resource;
    };
    const gameStoreModule = viteModule('/src/ui/state/store.ts');
    const sampleGameModule = gameStoreModule.replace(
      '/src/ui/state/store.ts',
      '/src/ui/fixtures/sampleGameState.ts',
    );
    const [{ createSampleGameState }, { useGameStateStore }, { useMetaStore }] = await Promise.all([
      import(/* @vite-ignore */ sampleGameModule),
      import(/* @vite-ignore */ gameStoreModule),
      import(/* @vite-ignore */ viteModule('/src/state/metaStore.ts')),
    ]);
    const state = createSampleGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    state.turn.number = 8;
    useGameStateStore.getState().setGameState(state);
    useMetaStore.getState().setMatchMeta({
      sessionId: 'wave2-responsive-result',
      mode: 'solo',
      selfDeckName: 'Wave 2 PLAYER',
      oppDeckName: 'Wave 2 CPU',
    });
  });
}

async function assertNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

async function assertKeyControlSize(page: Page, route: (typeof routes)[number]['name']): Promise<void> {
  const controls = route === 'history'
    ? page.locator('.history-result-filters button, .history-toolbar select')
    : route === 'settings'
      ? page.locator('.settings-segmented button, .settings-reset')
      : page.locator('.result-actions button');
  const dimensions = await controls.evaluateAll((elements) => elements
    .filter((element) => {
      const box = (element as HTMLElement).getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    })
    .map((element) => {
      const box = (element as HTMLElement).getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
  expect(dimensions).not.toEqual([]);
  for (const control of dimensions) {
    expect(control.width).toBeGreaterThanOrEqual(43.9);
    expect(control.height).toBeGreaterThanOrEqual(43.9);
  }
}

async function assertHistoryReplayUnavailable(page: Page): Promise<void> {
  const reason = page.locator('#history-replay-unavailable');
  const replay = page.locator('.history-replay-button').first();
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('完全なイベント記録が保存されていないため、この対戦はリプレイできません');
  await expect(replay).toHaveAttribute('disabled', '');
  await expect(replay).toHaveAttribute('aria-describedby', 'history-replay-unavailable');
}

async function assertSettingsBelowHeader(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.home-header')?.getBoundingClientRect();
    const frame = document.querySelector<HTMLElement>('.settings-frame')?.getBoundingClientRect();
    return header && frame ? { headerBottom: header.bottom, frameTop: frame.top } : null;
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.frameTop).toBeGreaterThanOrEqual(geometry!.headerBottom - 0.5);
}

async function assertResultLandscapeTypography(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const selectors = [
      '.result-verdict > p',
      '.result-presentation-notice',
      '.result-side > span',
      '.result-side small',
      '.result-side b',
      '.result-stats dt',
      '.result-stats dd',
      '.result-contributor span',
      '.result-contributor small',
      '.result-replay-note',
    ];
    const fontSizes = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => element.getBoundingClientRect().width > 0)
        .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    );
    const panel = document.querySelector<HTMLElement>('.result-panel')?.getBoundingClientRect();
    return {
      fontSizes,
      panel: panel ? { top: panel.top, bottom: panel.bottom } : null,
      viewportHeight: window.innerHeight,
    };
  });

  expect(result.fontSizes.length).toBeGreaterThan(0);
  expect(Math.min(...result.fontSizes)).toBeGreaterThanOrEqual(10);
  expect(result.panel).not.toBeNull();
  expect(result.panel!.top).toBeGreaterThanOrEqual(0);
  expect(result.panel!.bottom).toBeLessThanOrEqual(result.viewportHeight + 0.5);
}
