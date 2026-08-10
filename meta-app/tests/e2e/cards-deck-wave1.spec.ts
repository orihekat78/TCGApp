import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('conan.meta.v1.filters'));
});

test('CARDS keeps the 54px shared header, grid columns, and compact print visuals with 44px hits', async ({ page }) => {
  await page.goto('/#cards');

  const header = page.locator('.home-header');
  await expect(header).toHaveCSS('height', '54px');
  const brandBox = await page.locator('.home-brand').boundingBox();
  expect(brandBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(brandBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const navBoxes = await page.locator('.home-navigation button').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(navBoxes).toHaveLength(7);
  expect(navBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);

  const cardLayout = await page.locator('.cards-main').evaluate((main) => ({
    top: main.getBoundingClientRect().top,
    headerBottom: document.querySelector('.home-header')!.getBoundingClientRect().bottom,
    columns: getComputedStyle(document.querySelector('.cards-card-grid')!).gridTemplateColumns.split(' ').length,
    pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(cardLayout.top).toBeGreaterThanOrEqual(cardLayout.headerBottom);
  expect(cardLayout.columns).toBe(7);
  expect(cardLayout.pageOverflow).toBe(false);

  await page.locator('.cards-search input').fill('B09001');
  await page.locator('.cards-grid-item [role="button"]').first().click();
  const printBoxes = await page.locator('.cards-print-chip').evaluateAll((chips) => chips.map((chip) => {
    const hit = chip.getBoundingClientRect();
    const inner = chip.querySelector<HTMLElement>('.cards-print-chip-inner')!;
    const visual = inner.getBoundingClientRect();
    return {
      hit: { width: hit.width, height: hit.height },
      visual: { height: visual.height },
      fontSize: Number.parseFloat(getComputedStyle(inner).fontSize),
    };
  }));
  expect(printBoxes.length).toBeGreaterThan(1);
  expect(printBoxes.every(({ hit }) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  expect(printBoxes.every(({ visual }) => visual.height >= 24 && visual.height <= 26)).toBe(true);
  expect(printBoxes.every(({ fontSize }) => fontSize >= 10)).toBe(true);

  for (const width of [720, 667]) {
    await page.setViewportSize({ width, height: 393 });
    const hits = await page.locator('.home-brand, .home-navigation button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    expect(hits).toHaveLength(8);
    expect(hits.every((hit) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  }
  await expect.poll(() => page.locator('.cards-card-grid').evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  )).toBe(5);
});

test('720/667 landscape keeps actionable CARDS and DECK text at 10px or larger', async ({ page }) => {
  const fontSizes = (selector: string) => page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  );

  for (const width of [720, 667]) {
    await page.setViewportSize({ width, height: 393 });
    await page.goto('/#cards');
    await page.locator('.cards-filter-trigger').click();
    const cardsSizes = await fontSizes('.home-navigation button, .cards-sort-control select, .cards-filter-options button');
    expect(cardsSizes.length).toBeGreaterThan(9);
    expect(cardsSizes.every((size) => size >= 10)).toBe(true);

    await page.goto('/#deck');
    const deckSizes = await fontSizes([
      '.home-navigation button',
      '.deck-tool-button',
      '.deck-save-button',
      '.deck-save-button.is-invalid span',
      '.deck-save-button.is-invalid strong',
    ].join(', '));
    expect(deckSizes.length).toBeGreaterThan(10);
    expect(deckSizes.every((size) => size >= 10)).toBe(true);
  }
});

test('CARDS and DECK tolerate malformed saved filters', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.filters', JSON.stringify({
      version: 2,
      state: {
        cards: { q: {}, colors: 'purple', sets: 4, features: {}, keywords: null, featureMode: 'all', keywordMode: 3 },
        deck: { q: [], colors: {}, sets: false, features: 0, keywords: 'bad', featureMode: 'none', keywordMode: {} },
      },
    }));
  });

  await page.goto('/#cards');
  await expect(page.locator('.cards-screen')).toBeVisible();
  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });
  expect(errors).toEqual([]);
});

const invalidSavedFilterStates = [
  ['null', JSON.stringify({ version: 2, state: null })],
  ['array', JSON.stringify({ version: 2, state: [] })],
  ['primitive', JSON.stringify({ version: 2, state: 'invalid' })],
  ['invalid JSON', '{invalid json'],
] as const;

for (const [label, saved] of invalidSavedFilterStates) {
  test(`CARDS safely hydrates ${label} saved filter state`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((value) => {
      localStorage.setItem('conan.meta.v1.filters', value);
    }, saved);

    await page.goto('/#cards');
    await expect(page.locator('.cards-screen')).toBeVisible();
    await page.goto('/#deck');
    await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });
    expect(errors).toEqual([]);
  });
}

test('CARDS and DECK scrolling surfaces share a thin cyan rail in both axes', async ({ page }) => {
  const expectedRail = {
    color: 'rgba(121, 212, 236, 0.55) rgba(0, 0, 0, 0)',
    width: '5px',
    height: '5px',
  };
  await page.goto('/#cards');
  const railStyle = (selector: string) => page.locator(selector).evaluate((element) => ({
    color: getComputedStyle(element).scrollbarColor,
    width: getComputedStyle(element, '::-webkit-scrollbar').width,
    height: getComputedStyle(element, '::-webkit-scrollbar').height,
  }));

  const targets: { label: string; selector: string; open: () => Promise<void> }[] = [
    { label: 'CARDS grid', selector: '.cards-grid-scroll', open: async () => {} },
    { label: 'CARDS selected', selector: '.cards-selected-scroll', open: async () => {} },
    {
      label: 'CARDS list', selector: '.cards-list-scroll', open: async () => {
        await page.getByRole('button', { name: 'リスト' }).click();
      },
    },
    {
      label: 'CARDS drawer', selector: '.cards-filter-scroll', open: async () => {
        await page.locator('.cards-filter-trigger').click();
      },
    },
    { label: 'CARDS filter rail', selector: '.filter-rail-scroll', open: async () => {} },
  ];

  for (const target of targets) {
    await target.open();
    await expect(page.locator(target.selector)).toBeVisible();
    expect(await railStyle(target.selector), target.label).toEqual(expectedRail);
  }

  await page.goto('/#deck');
  const deckTargets: { label: string; selector: string; open: () => Promise<void> }[] = [
    { label: 'DECK main', selector: '.deck-main-pane', open: async () => {} },
    { label: 'DECK pool grid', selector: '.deck-pool-grid', open: async () => {} },
    { label: 'DECK card grid', selector: '.deck-card-grid', open: async () => {} },
    {
      label: 'DECK detail', selector: '.deck-detail-scroll', open: async () => {
        await page.getByTestId('deck-pool-card-D08023').click();
      },
    },
    {
      label: 'DECK filter rail', selector: '.filter-rail-scroll', open: async () => {
        await page.keyboard.press('Escape');
        await page.locator('.deck-pool-filter').click();
      },
    },
    {
      label: 'DECK modal', selector: '.deck-modal-scroll', open: async () => {
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'コード' }).click();
      },
    },
  ];

  for (const target of deckTargets) {
    await target.open();
    await expect(page.locator(target.selector)).toBeVisible();
    expect(await railStyle(target.selector), target.label).toEqual(expectedRail);
  }
});

test('DECK filter actions retain 44px hits and modal focus cycles back to its trigger', async ({ page }) => {
  await page.goto('/#deck');
  const trigger = page.locator('.deck-pool-filter');
  await trigger.click();
  const dialog = page.locator('.deck-filter-dialog');
  await expect(dialog).toBeVisible();

  const controls = dialog.locator('button:not(:disabled)');
  const boxes = await controls.evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(boxes.length).toBeGreaterThan(2);
  expect(boxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);

  await expect(controls.first()).toBeFocused();
  await controls.first().press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await controls.last().press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 800 });
  await trigger.click();
  const desktopBoxes = await dialog.locator('button:not(:disabled)').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(desktopBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);
});

test('CARDS focus differentiates cyan unselected and gold selected rings, while DECK detail stays inside the workspace', async ({ page }) => {
  for (const viewport of [{ width: 851, height: 393 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#cards');
    const selected = page.locator('.cards-grid-item [role="button"]').first();
    const unselected = page.locator('.cards-grid-item [role="button"]').nth(1);
    await selected.click();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(unselected).toHaveAttribute('aria-pressed', 'false');
    await unselected.focus();
    const cyanRing = await unselected.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(cyanRing).toContain('inset');
    expect(cyanRing).toContain('141, 232, 255');
    await selected.focus();
    const goldRing = await selected.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(goldRing).toContain('inset');
    expect(goldRing).toContain('255, 216, 92');
    expect(goldRing).not.toBe(cyanRing);
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/#deck');
  const firstPoolCard = page.getByTestId('deck-pool-card-D08023');
  await firstPoolCard.click();
  const drawer = page.locator('.deck-detail-drawer');
  const [drawerBox, mainBox, poolBox] = await Promise.all([
    drawer.boundingBox(),
    page.locator('.deck-main-pane').boundingBox(),
    page.getByTestId('deck-pool').boundingBox(),
  ]);
  expect(drawerBox?.x).toBeCloseTo(mainBox?.x ?? 0, 0);
  expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0)).toBeLessThanOrEqual((poolBox?.x ?? 0) + 0.5);

  await page.keyboard.press('Escape');
  const secondPoolCard = page.locator('.deck-pool-card').nth(1);
  await secondPoolCard.click();
  await expect(secondPoolCard).toHaveAttribute('aria-pressed', 'true');
  await secondPoolCard.focus();
  expect(await secondPoolCard.evaluate((element) => getComputedStyle(element).boxShadow)).toContain('inset');
  const deckCard = page.locator('.deck-card-open').first();
  await deckCard.focus();
  expect(await deckCard.evaluate((element) => getComputedStyle(element).boxShadow)).toContain('inset');
});
