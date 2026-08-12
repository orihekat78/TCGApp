import { expect, type Page } from '@playwright/test';

export async function gotoReadyLandscapeRoute(
  page: Page,
  route: string,
  readySelector: string,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(`/#${route}`);
  const content = page.getByTestId('landscape-gate-content');
  await expect.poll(() => content.evaluate((element: HTMLElement) => ({
    hidden: element.hidden,
    ariaHidden: element.getAttribute('aria-hidden'),
    inert: element.inert,
  })), { timeout: 15_000 }).toEqual({ hidden: false, ariaHidden: null, inert: false });
  await expect(page.locator(readySelector)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.landscape-gate')).toHaveCount(0);
}
