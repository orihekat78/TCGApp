import { expect, test } from '@playwright/test';

const APPROVED_VIEWPORTS = [
  { width: 1440, height: 900, name: 'desktop-wide' },
  { width: 1280, height: 800, name: 'desktop-default' },
  { width: 1024, height: 768, name: 'desktop-compact' },
  { width: 851, height: 393, name: 'landscape-tablet' },
  { width: 667, height: 375, name: 'landscape-phone' },
] as const;

test('TUTORIAL: approved desktop and landscape sizes keep the screen and lesson viewer inside the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const viewport of APPROVED_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto('/#tutorial');

    await expect(page.locator('.tutorial-toolbar'), `${viewport.name}: toolbar`).toBeVisible();
    await expect(page.locator('.tutorial-workspace'), `${viewport.name}: workspace`).toBeVisible();

    const screen = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      toolbar: document.querySelector<HTMLElement>('.tutorial-toolbar')?.getBoundingClientRect(),
      workspace: document.querySelector<HTMLElement>('.tutorial-workspace')?.getBoundingClientRect(),
    }));
    expect(screen.scrollWidth, `${viewport.name}: no page horizontal overflow`).toBe(screen.clientWidth);
    expect(screen.toolbar?.right, `${viewport.name}: toolbar right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(screen.workspace?.right, `${viewport.name}: workspace right edge`).toBeLessThanOrEqual(viewport.width + 0.5);

    const trigger = page.locator('.tutorial-step-list button').first();
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, `${viewport.name}: lesson viewer`).toBeVisible();
    const viewer = await dialog.boundingBox();
    expect(viewer?.x, `${viewport.name}: viewer left edge`).toBeGreaterThanOrEqual(-0.5);
    expect((viewer?.x ?? 0) + (viewer?.width ?? 0), `${viewport.name}: viewer right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
    await page.keyboard.press('Escape');
  }

  expect(errors).toEqual([]);
});

test('TUTORIAL: landscape keeps the shared header and tutorial controls inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#tutorial');

  const header = page.locator('.home-header');
  await expect(header).toBeVisible();
  await expect(header.locator('[data-route="tutorial"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.tutorial-toolbar')).toBeVisible();
  await expect(page.locator('.tutorial-workspace')).toBeVisible();

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    workspace: document.querySelector<HTMLElement>('.tutorial-workspace')?.getBoundingClientRect(),
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  expect(geometry.workspace).toBeDefined();
  expect(geometry.workspace!.right).toBeLessThanOrEqual(851.5);
});

test('TUTORIAL: viewer traps keyboard focus, keeps 44px controls, and honors reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#tutorial');

  const trigger = page.locator('.tutorial-step-list button').first();
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: '閉じる' });
  await expect(close).toBeFocused();
  const controls = dialog.locator('button');
  const sizes = await controls.evaluateAll((buttons) => buttons
    .filter((button) => !button.closest('[inert]'))
    .map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
  expect(sizes).toEqual(expect.arrayContaining([expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })]));
  for (const size of sizes) expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(44);

  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  const motion = await dialog.locator('.meta-fade').evaluate((element) => {
    const style = getComputedStyle(element);
    return { animation: style.animationName, transition: style.transitionDuration };
  });
  expect(motion.animation).toBe('none');
  expect(motion.transition).toBe('0s');

  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
