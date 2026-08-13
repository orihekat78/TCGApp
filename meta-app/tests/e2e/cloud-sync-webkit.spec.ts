import { expect, test } from '@playwright/test';
import { SAMPLE_DECK } from '../../src/data/sampleDeck';
import { gotoReadyLandscapeRoute } from './landscape-test-helpers';

type RequestLog = {
  method: string;
  pathname: string;
  body: Record<string, unknown> | null;
};

const CLOUD_FIXTURE_DECK = {
  deckId: 'sample-d08',
  name: SAMPLE_DECK.name,
  partnerCardNum: SAMPLE_DECK.partner,
  caseCardNum: SAMPLE_DECK.case,
  cards: SAMPLE_DECK.cards.map(({ num: cardNum, count }) => ({ cardNum, count })),
  clientModifiedAt: 1_999_999,
  revision: 1,
  serverUpdatedAt: 2_000_000,
};
function cloudBootstrapFixture() {
  return {
    identity: { email: 'family@example.com' },
    decks: [CLOUD_FIXTURE_DECK],
    deletedDecks: [],
    activeDeck: {
      activeDeckId: CLOUD_FIXTURE_DECK.deckId,
      revision: 1,
      serverUpdatedAt: 2_000_000,
    },
    stats: { matches: 0, wins: 0, losses: 0, winRate: null },
  };
}

test('WebKit keeps compact typography proportional at both landscape widths', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/bootstrap') {
      await route.fulfill({ json: { data: {
        identity: { email: 'family@example.com' },
        ...cloudBootstrapFixture(),
      } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
  });

  const readTypography = async () => page.evaluate(() => ({
    navigation: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>('.home-navigation button')!).fontSize),
    deckHeading: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>('.home-deck-heading h1')!).fontSize),
    changeDeck: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>('.home-change-deck')!).fontSize),
  }));

  await gotoReadyLandscapeRoute(page, 'home', '.home-screen', { width: 851, height: 393 });
  await expect(page.locator('.home-deck-heading h1')).toBeVisible();
  const wide = await readTypography();

  await page.setViewportSize({ width: 667, height: 375 });
  const se = await readTypography();

  expect(se.navigation).toBeLessThan(wide.navigation);
  expect(se.deckHeading).toBeLessThan(wide.deckHeading);
  expect(se.changeDeck).toBeLessThan(wide.changeDeck);
  // Runtime glyph sizes prove that WebKit applied the compact declarations
  // without Safari-style automatic text inflation.
  expect(se.navigation).toBe(10);
  expect(se.deckHeading).toBe(16);
  expect(se.changeDeck).toBe(10);
});

test('WebKit keeps HOME-to-DECK runtime online while a new deck syncs', async ({ page }) => {
  const requests: RequestLog[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = request.postDataJSON() as Record<string, unknown> | null;
    requests.push({ method: request.method(), pathname, body });

    if (pathname === '/api/v1/bootstrap') {
      await route.fulfill({ json: { data: {
        identity: { email: 'family@example.com' },
        ...cloudBootstrapFixture(),
      } } });
      return;
    }
    if (pathname.startsWith('/api/v1/decks/')) {
      await route.fulfill({ json: { data: {
        deck: {
          deckId: body?.deckId,
          name: body?.name,
          partnerCardNum: body?.partnerCardNum,
          caseCardNum: body?.caseCardNum,
          cards: body?.cards,
          clientModifiedAt: body?.clientModifiedAt,
          revision: 1,
          serverUpdatedAt: 2_000_000,
        },
        replayed: false,
      } } });
      return;
    }
    if (pathname === '/api/v1/active-deck') {
      await route.fulfill({ json: { data: {
        activeDeck: {
          activeDeckId: body?.activeDeckId ?? null,
          revision: 1,
          serverUpdatedAt: 2_000_000,
        },
        replayed: false,
      } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
  });

  await gotoReadyLandscapeRoute(page, 'home', '.home-screen', { width: 851, height: 393 });
  const indicator = page.locator('.cloud-sync-indicator');
  await expect(indicator).toHaveAttribute('data-cloud-sync-phase', 'online', { timeout: 15_000 });
  requests.length = 0;

  await page.locator('[data-route="deck"]').click();
  await expect(page.getByTestId('deck-editor')).toBeVisible();
  await page.evaluate(() => {
    const phases: string[] = [];
    const indicatorElement = document.querySelector('.cloud-sync-indicator');
    if (indicatorElement) {
      phases.push(indicatorElement.getAttribute('data-cloud-sync-phase') ?? 'missing');
      new MutationObserver(() => {
        phases.push(indicatorElement.getAttribute('data-cloud-sync-phase') ?? 'missing');
      }).observe(indicatorElement, { attributes: true, attributeFilter: ['data-cloud-sync-phase'] });
    }
    (globalThis as typeof globalThis & { __cloudSyncPhases?: string[] }).__cloudSyncPhases = phases;
  });

  await page.getByRole('button', { name: '複製', exact: true }).click();
  const save = page.locator('.deck-save-button');
  await expect(save).toHaveAttribute('aria-label', '保存（未保存の変更あり）');
  await save.click();

  await expect.poll(() => requests.filter(({ pathname }) => pathname.startsWith('/api/v1/decks/')).length)
    .toBe(1);
  await expect(indicator).toHaveAttribute('data-cloud-sync-phase', 'online', { timeout: 15_000 });

  const result = await page.evaluate(async () => {
    const storageModulePath = '/src/cloud/storage.ts';
    const { readCloudSyncState } = await import(storageModulePath);
    const state = await readCloudSyncState();
    return {
      phases: (globalThis as typeof globalThis & { __cloudSyncPhases?: string[] }).__cloudSyncPhases ?? [],
      pending: state.outbox.length,
    };
  });
  expect(result.phases).toContain('syncing');
  expect(result.phases).not.toContain('error');
  expect(result.pending).toBe(0);
  expect(requests.map(({ method, pathname }) => `${method} ${pathname}`)).toEqual([
    expect.stringMatching(/^PUT \/api\/v1\/decks\//),
  ]);
});
