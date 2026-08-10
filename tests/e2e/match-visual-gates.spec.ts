import { expect, test, type Page } from '@playwright/test';

const PLAYMAT_WIDTH = 1920;
const PLAYMAT_HEIGHT = 1080;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 851, height: 393 },
  { width: 720, height: 393 },
] as const;

type Viewport = (typeof viewports)[number];

async function enterMatchThroughPublicUi(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const url = message.location()?.url ?? '';
    if (text.includes('Failed to load resource') && /404/.test(text)) return;
    if (/favicon\.ico|robots\.txt/.test(url)) return;
    errors.push(`console.error: ${text}`);
  });

  await page.goto('/#setup');
  await expect(page).toHaveURL(/#setup$/);
  // 現行の公開入口は段階移行中。どちらも利用者が押す「対戦を開始」操作であり、
  // ここではテスト専用の状態注入に替えない。
  const start = page.locator('.setup-start, [data-testid="game-setup-start"]').first();
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();
  await start.click();

  const skipMulligan = page.locator('button.mulligan-skip');
  await expect(skipMulligan).toBeVisible();
  await skipMulligan.click();
  await expect(skipMulligan).toBeHidden();
  await expect(page.locator('#scaler')).toBeVisible();
  return errors;
}

async function expectMatchVisualGate(page: Page, viewport: Viewport): Promise<void> {
  const observed = await page.evaluate(() => {
    const mustFind = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      return element;
    };
    const rect = (selector: string) => {
      const value = mustFind<HTMLElement>(selector).getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
    };
    const scaler = mustFind<HTMLElement>('#scaler');
    return {
      scale: Number(scaler.dataset.stageScale),
      layout: scaler.dataset.playmatLayout,
      logicalWidth: Number(scaler.dataset.playmatLogicalWidth),
      logicalHeight: Number(scaler.dataset.playmatLogicalHeight),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      core: [
        rect('.board-content'),
        rect('.actions-panel'),
        rect('button.end-turn-btn'),
        rect('button.panel-log-btn'),
      ],
    };
  });

  expect(observed.viewport).toEqual(viewport);
  expect(observed.layout).toBe('desktop');
  expect(observed.logicalWidth).toBe(PLAYMAT_WIDTH);
  expect(observed.logicalHeight).toBe(PLAYMAT_HEIGHT);
  expect(observed.scale).toBeCloseTo(
    Math.min(viewport.width / PLAYMAT_WIDTH, viewport.height / PLAYMAT_HEIGHT),
    4,
  );
  expect(observed.overflow).toBeLessThanOrEqual(0);
  for (const bounds of observed.core) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
  }

  const logControl = page.locator('button.panel-log-btn');
  await logControl.focus();
  await expect(logControl).toBeFocused();
  await expect(logControl).toHaveAttribute('aria-pressed', 'false');
  await logControl.click();
  await expect(page.locator('.log-panel')).toBeVisible();
  await expect(logControl).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.log-panel')).toBeHidden();
}

test.describe('MATCH visual scale gates', () => {
  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height}: public MATCH fits and remains operable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const errors = await enterMatchThroughPublicUi(page);
      await expectMatchVisualGate(page, viewport);
      expect(errors).toEqual([]);
    });
  }

  test('resize updates the public MATCH scale and preserves controls', async ({ page }) => {
    const initial = viewports[0];
    const resized = viewports[4];
    await page.setViewportSize(initial);
    const errors = await enterMatchThroughPublicUi(page);
    await expectMatchVisualGate(page, initial);

    await page.setViewportSize(resized);
    await expect
      .poll(async () => Number(await page.locator('#scaler').getAttribute('data-stage-scale')))
      .toBeCloseTo(Math.min(resized.width / PLAYMAT_WIDTH, resized.height / PLAYMAT_HEIGHT), 4);
    await expectMatchVisualGate(page, resized);
    expect(errors).toEqual([]);
  });
});
