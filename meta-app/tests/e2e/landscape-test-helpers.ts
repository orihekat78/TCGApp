import { expect, type Page } from '@playwright/test';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../src/data/sampleDeck';

const ROUTE_READY_TIMEOUT_MS = 25_000;

/** Seed persisted state with catalog-legal decks before the app hydrates. */
export async function installPlayableDeckStore(page: Page) {
  await page.addInitScript((decks) => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 4,
      state: {
        decks,
        activeDeckId: decks[0].id,
      },
    }));
  }, [SAMPLE_DECK, SAMPLE_DECK_OPP]);
}

export async function expectReadyMetaRoute(page: Page, readySelector: string) {
  const content = page.getByTestId('landscape-gate-content');
  await expect(content).toBeAttached({ timeout: ROUTE_READY_TIMEOUT_MS });
  await expect.poll(() => content.evaluate((element: HTMLElement) => ({
    hidden: element.hidden,
    ariaHidden: element.getAttribute('aria-hidden'),
    inert: element.inert,
  })), { timeout: ROUTE_READY_TIMEOUT_MS }).toEqual({ hidden: false, ariaHidden: null, inert: false });
  await expect(page.locator(readySelector)).toBeVisible({ timeout: ROUTE_READY_TIMEOUT_MS });
  await expect(page.locator('.landscape-gate')).toHaveCount(0);
}

export async function gotoReadyMetaRoute(
  page: Page,
  route: string,
  readySelector: string,
  viewport?: { width: number; height: number },
) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(`/#${route}`);
  await expectReadyMetaRoute(page, readySelector);
}

export async function gotoReadyLandscapeRoute(
  page: Page,
  route: string,
  readySelector: string,
  viewport: { width: number; height: number },
) {
  await gotoReadyMetaRoute(page, route, readySelector, viewport);
}
