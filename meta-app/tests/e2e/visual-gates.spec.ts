// Cross-route visual safety gate. This deliberately uses only the public hash
// routes and header controls; it never initializes or injects engine state.

import { expect, test, type Locator, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900, name: 'desktop-wide' },
  { width: 1280, height: 800, name: 'desktop-default' },
  { width: 1024, height: 768, name: 'desktop-compact' },
  { width: 851, height: 393, name: 'landscape-tablet' },
  { width: 720, height: 393, name: 'landscape-phone' },
] as const;

const ROUTES = [
  { hash: 'home', core: '.home-deck-stage' },
  { hash: 'setup', core: '.setup-main' },
  // A direct public MATCH URL must show recovery, never fabricate a game.
  { hash: 'match', core: '[data-testid="match-recovery-setup"]' },
  { hash: 'result', core: '.result-empty button' },
  { hash: 'deck', core: '[data-testid="deck-workspace"]' },
  { hash: 'cards', core: '.cards-filter-trigger' },
  { hash: 'history', core: '.history-toolbar' },
  { hash: 'replay', core: '.replay-unavailable' },
  { hash: 'tutorial', core: '.tutorial-toolbar' },
  { hash: 'settings', core: '.settings-save' },
] as const;

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function expectVisibleInViewport(locator: Locator, viewport: { width: number; height: number }) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'core control must have a layout box').not.toBeNull();
  expect(box!.x + box!.width, 'core control must not be right of the viewport').toBeGreaterThan(0);
  expect(box!.y + box!.height, 'core control must not be below the viewport').toBeGreaterThan(0);
  expect(box!.x, 'core control must not be left of the viewport').toBeLessThan(viewport.width);
  expect(box!.y, 'core control must not be above the viewport').toBeLessThan(viewport.height);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    shellWidth: document.querySelector<HTMLElement>('.meta-shell')?.scrollWidth,
    shellClientWidth: document.querySelector<HTMLElement>('.meta-shell')?.clientWidth,
  }));

  expect(dimensions.documentWidth, 'document horizontal overflow').toBe(dimensions.viewportWidth);
  expect(dimensions.shellWidth, 'fixed Meta shell horizontal overflow').toBe(dimensions.shellClientWidth);
}

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`visual gate: #${route.hash} at ${viewport.name}`, async ({ page }) => {
      const errors = captureConsoleErrors(page);
      await page.setViewportSize(viewport);
      await page.goto(`/#${route.hash}`);

      await expect(page.locator('#meta-root')).toBeVisible();
      await expectVisibleInViewport(page.locator(route.core).first(), viewport);
      await expectNoHorizontalOverflow(page);
      expect(errors, `console or page errors on #${route.hash} at ${viewport.name}`).toEqual([]);
    });
  }
}

test('visual gate: header navigation uses real public route interactions and keyboard focus', async ({ page }) => {
  const errors = captureConsoleErrors(page);

  for (const viewport of [VIEWPORTS[1], VIEWPORTS[3]]) {
    await page.setViewportSize(viewport);
    await page.goto('/#home');

    const brand = page.locator('.home-brand');
    const home = page.locator('[data-route="home"]');
    const deck = page.locator('[data-route="deck"]');
    await brand.focus();
    await expect(brand).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(home).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(deck).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#deck$/);
    await expectVisibleInViewport(page.locator('[data-testid="deck-workspace"]'), viewport);

    for (const route of ['cards', 'setup', 'tutorial', 'history', 'settings', 'home'] as const) {
      await page.locator(`[data-route="${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${route}$`));
      await expect(page.locator('#meta-root')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }

  expect(errors, 'console or page errors during public header navigation').toEqual([]);
});

test('visual gate: public filter and lesson dialogs trap focus and restore their trigger', async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.setViewportSize(VIEWPORTS[3]);

  await page.goto('/#cards');
  const filterTrigger = page.locator('.cards-filter-trigger');
  await filterTrigger.focus();
  await filterTrigger.click();
  const filterDialog = page.locator('.cards-filter-drawer[role="dialog"]');
  const filterButtons = filterDialog.locator('button');
  await expect(filterDialog).toBeVisible();
  await expect(filterButtons.first()).toBeFocused();
  await filterButtons.last().focus();
  await page.keyboard.press('Tab');
  await expect(filterButtons.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(filterDialog).toBeHidden();
  await expect(filterTrigger).toBeFocused();

  await page.goto('/#tutorial');
  const lessonTrigger = page.locator('.tutorial-step-list button').first();
  await lessonTrigger.focus();
  await lessonTrigger.click();
  const lessonDialog = page.getByRole('dialog');
  const lessonButtons = lessonDialog.locator('button');
  await expect(lessonDialog).toBeVisible();
  await expect(lessonButtons.first()).toBeFocused();
  await lessonButtons.last().focus();
  await page.keyboard.press('Tab');
  await expect(lessonButtons.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(lessonDialog).toBeHidden();
  await expect(lessonTrigger).toBeFocused();

  expect(errors, 'console or page errors during public dialog focus flow').toEqual([]);
});
