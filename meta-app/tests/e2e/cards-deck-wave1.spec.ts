import { expect, test } from '@playwright/test';
import { gotoReadyLandscapeRoute, installPlayableDeckStore } from './landscape-test-helpers';

test.beforeEach(async ({ page }) => {
  await installPlayableDeckStore(page);
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('conan.meta.v1.filters'));
});

test('CARDS keeps its catalog window bounded while scrolling without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#cards');
  const scroller = page.locator('.cards-grid-scroll');
  const cards = page.locator('.cards-grid-item');
  await expect(cards).toHaveCount(48);
  const first = await cards.first().elementHandle();
  expect(first).not.toBeNull();

  await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight / 2; });
  await expect.poll(() => cards.count()).toBeLessThanOrEqual(96);
  await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => cards.count()).toBeLessThanOrEqual(96);
  expect(await first!.evaluate((node) => node.isConnected)).toBe(false);
  expect(errors).toEqual([]);
});

test('CARDS and DECK keep every virtualized grid row on the portrait card track', async ({ page }) => {
  await page.goto('/#cards');
  const cardsItem = page.locator('.cards-grid-item').first();
  await expect(cardsItem).toBeVisible();
  expect(await cardsItem.evaluate((node) => (
    getComputedStyle(node).aspectRatio
  ))).toBe('5 / 7');

  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible();
  const deckItem = page.locator('.deck-pool-window-grid > div').first();
  await expect(deckItem).toBeVisible();
  expect(await deckItem.evaluate((node) => (
    getComputedStyle(node).aspectRatio
  ))).toBe('5 / 7');
});

test('CARDS keeps D09014 connected through a real pointer selection and preserves 7-column content coordinates', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#cards');
  const scroller = page.locator('.cards-grid-scroll');
  const cards = page.locator('.cards-grid-item');
  const target = page.locator('[data-card-num="D09014"] [role="button"]');
  await expect(target).toHaveCount(0);
  const gridColumnCount = await page.locator('.cards-window-grid').evaluate((grid) => (
    getComputedStyle(grid).gridTemplateColumns.split(' ').length
  ));
  expect(gridColumnCount).toBe(7);

  const scrollTo = async (top: number) => {
    await scroller.evaluate((node, value) => {
      node.scrollTop = value;
      node.dispatchEvent(new Event('scroll'));
    }, top);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(target).toBeVisible();
    await expect.poll(() => cards.count()).toBeLessThanOrEqual(96);
  };
  const contentPosition = () => target.evaluateAll(([node]) => {
    if (!node) return null;
    const scroller = document.querySelector<HTMLElement>('.cards-grid-scroll');
    if (!scroller) throw new Error('cards scroller is missing');
    const box = node.getBoundingClientRect();
    const scrollBox = scroller.getBoundingClientRect();
    return {
      x: box.left - scrollBox.left + scroller.scrollLeft,
      y: box.top - scrollBox.top + scroller.scrollTop,
      beforePx: Number.parseFloat(
        scroller.querySelector<HTMLElement>('.cards-window-spacer')?.style.height ?? '0',
      ),
    };
  });

  const positions = await scroller.evaluate((node) => {
    const max = Math.max(0, node.scrollHeight - node.clientHeight);
    return Array.from({ length: 33 }, (_, index) => Math.round(max * index / 32));
  });
  const targetWindows: Array<{ top: number; beforePx: number }> = [];
  for (const top of positions) {
    await scroller.evaluate((node, value) => {
      node.scrollTop = value;
      node.dispatchEvent(new Event('scroll'));
    }, top);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const position = await contentPosition();
    if (position) targetWindows.push({ top, beforePx: position.beforePx });
  }
  expect(targetWindows.length).toBeGreaterThanOrEqual(2);
  const firstWindow = targetWindows[0]!;
  const adjacentWindow = targetWindows.find((window) => window.beforePx !== firstWindow.beforePx);
  expect(adjacentWindow).toBeDefined();

  await scrollTo(firstWindow.top);
  const firstPosition = await contentPosition();
  await scrollTo(adjacentWindow!.top);
  const adjacentPosition = await contentPosition();
  expect(firstPosition).not.toBeNull();
  expect(adjacentPosition).not.toBeNull();
  expect(adjacentPosition!.x).toBeCloseTo(firstPosition!.x, 1);
  // Fractional track rounding can accumulate a few pixels over distant rows.
  // A broken non-row boundary moves the card by a full row/column, not <=3px.
  expect(Math.abs(adjacentPosition!.y - firstPosition!.y), JSON.stringify({
    firstWindow,
    adjacentWindow,
    firstPosition,
    adjacentPosition,
  })).toBeLessThanOrEqual(3);

  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const initialNode = await target.elementHandle();
  expect(initialNode).not.toBeNull();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(await initialNode!.evaluate((node) => (
    node.isConnected
    && document.activeElement === node
    && document.querySelector('[data-card-num="D09014"] [role="button"]') === node
  ))).toBe(true);
  await page.mouse.up();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('CARDS retains the selected and focused PR138 pin after a later scroll window', async ({ page }) => {
  await page.goto('/#cards');
  const scroller = page.locator('.cards-grid-scroll');
  const cards = page.locator('.cards-grid-item');
  const target = page.locator('[data-card-num="PR138"] [role="button"]');
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const initialNode = await target.elementHandle();
  expect(initialNode).not.toBeNull();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(await initialNode!.evaluate((node) => (
    node.isConnected
    && document.activeElement === node
    && document.querySelector('[data-card-num="PR138"] [role="button"]') === node
  ))).toBe(true);
  await page.mouse.up();
  await expect(page.locator('.cards-detail-panel')).toContainText('PR138');
  const selectedNode = await target.elementHandle();
  expect(selectedNode).not.toBeNull();

  await scroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => cards.count()).toBeLessThanOrEqual(96);
  expect(await selectedNode!.evaluate((node) => (
    node.isConnected && document.activeElement === node
  ))).toBe(true);
});

test('CARDS keeps the 54px shared header, grid columns, and compact print visuals with 44px hits', async ({ page }) => {
  await page.goto('/#cards');

  const header = page.locator('.home-header');
  await expect(header).toHaveCSS('height', '54px');
  const brandBox = await page.locator('.home-brand').boundingBox();
  expect(brandBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  // CSS min-height is exactly 44px; Chromium can report 43.999998px at this DPR.
  expect(brandBox?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  const navBoxes = await page.locator('.home-navigation button').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(navBoxes).toHaveLength(7);
  expect(navBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);

  const cardLayout = await page.locator('.cards-main').evaluate((main) => ({
    top: main.getBoundingClientRect().top,
    headerBottom: document.querySelector('.home-header')!.getBoundingClientRect().bottom,
    columns: getComputedStyle(document.querySelector('.cards-window-grid')!).gridTemplateColumns.split(' ').length,
    pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(cardLayout.top).toBeGreaterThanOrEqual(cardLayout.headerBottom);
  expect(cardLayout.columns).toBe(7);
  expect(cardLayout.pageOverflow).toBe(false);

  await page.locator('.cards-search input').fill('B09001');
  await page.locator('.cards-grid-item [role="button"]').first().click();
  const printBoxes = await page.locator('.cards-print-chip:has(.cards-print-chip-inner)').evaluateAll((chips) => chips.map((chip) => {
    const hit = chip.getBoundingClientRect();
    const inner = chip.querySelector<HTMLElement>('.cards-print-chip-inner');
    const visual = inner?.getBoundingClientRect();
    return {
      hit: { width: hit.width, height: hit.height },
      visual: { height: visual?.height ?? 0 },
      fontSize: inner ? Number.parseFloat(getComputedStyle(inner).fontSize) : 0,
    };
  }));
  expect(printBoxes.length).toBeGreaterThan(1);
  expect(printBoxes.every(({ hit }) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  expect(printBoxes.every(({ visual }) => visual.height >= 24 && visual.height <= 26)).toBe(true);
  expect(printBoxes.every(({ fontSize }) => fontSize >= 10)).toBe(true);

  for (const viewport of [{ width: 720, height: 393 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    const hits = await page.locator('.home-brand, .home-navigation button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    expect(hits).toHaveLength(8);
    expect(hits.every((hit) => hit.width >= 44 && hit.height >= 44)).toBe(true);
  }
  await expect.poll(() => page.locator('.cards-window-grid').evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  )).toBe(5);
});

test('720x393 and exact SE3 landscape keep actionable CARDS and DECK text at 10px or larger', async ({ page }) => {
  const fontSizes = (selector: string) => page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  );

  for (const viewport of [{ width: 720, height: 393 }, { width: 667, height: 375 }]) {
    await gotoReadyLandscapeRoute(page, 'cards', '.cards-main', viewport);
    await page.locator('.cards-filter-trigger').click();
    const cardsSizes = await fontSizes('.home-navigation button, .cards-sort-control select, .cards-filter-options button');
    expect(cardsSizes.length).toBeGreaterThan(9);
    expect(cardsSizes.every((size) => size >= 10)).toBe(true);

    await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', viewport);
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

test('CARDS bounds empty, filtered, repeatedly scrolled, and detail-return catalog windows at both compact widths', async ({ page }) => {
  for (const viewport of [{ width: 851, height: 393 }, { width: 667, height: 375 }]) {
    await gotoReadyLandscapeRoute(page, 'cards', '.cards-main', viewport);
    const search = page.locator('.cards-search input');
    const cards = page.locator('.cards-grid-item');
    const scroller = page.locator('.cards-grid-scroll');
    const assertMountedAtMost = async (total: number) => {
      expect(await cards.count()).toBeLessThanOrEqual(Math.min(total, 96));
    };

    await search.fill('no-catalog-result-zz');
    await expect(page.locator('.cards-empty')).toBeVisible();
    await assertMountedAtMost(0);

    await search.fill('D01001');
    await expect(cards).toHaveCount(1);
    await assertMountedAtMost(1);

    await search.fill('');
    await expect(cards).toHaveCount(48);
    for (const top of [0.5, 1, 0.25]) {
      await scroller.evaluate((element, fraction) => {
        element.scrollTop = element.scrollHeight * fraction;
        element.dispatchEvent(new Event('scroll'));
      }, top);
      await expect.poll(() => cards.count()).toBeLessThanOrEqual(96);
    }

    await search.fill('D01001');
    const selected = cards.locator('[role="button"]');
    await selected.click();
    const art = page.locator('.cards-selected-art');
    await art.click();
    await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);
    await expect(art).toBeFocused();
    await assertMountedAtMost(1);
  }
});

test('DECK compact metadata stays legible and the compact sync marker is exactly 4px', async ({ page }) => {
  await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', { width: 667, height: 375 });

  const metadataSizes = await page.locator([
    '.deck-pool-surface > div:first-child span:last-child',
    '.deck-detail-stats > div > div:first-child',
  ].join(', ')).evaluateAll((elements) => elements.map((element) => (
    Number.parseFloat(getComputedStyle(element).fontSize)
  )));
  expect(metadataSizes.length).toBeGreaterThan(0);
  expect(metadataSizes.every((size) => size >= 8)).toBe(true);

  const syncDot = await page.locator('.network-status--compact .network-status__dot').evaluate((dot) => {
    const styles = getComputedStyle(dot);
    return { width: styles.width, height: styles.height };
  });
  expect(syncDot).toEqual({ width: '4px', height: '4px' });
});

test('CARDS and DECK actionable typography scales from 851px to exact SE3 while retaining 10px minimums', async ({ page }) => {
  const readSizes = (selector: string) => page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  );

  await gotoReadyLandscapeRoute(page, 'cards', '.cards-main', { width: 851, height: 393 });
  const cardsWide = await readSizes('.cards-search input, .cards-filter-trigger, .cards-sort-control select');
  await gotoReadyLandscapeRoute(page, 'cards', '.cards-main', { width: 667, height: 375 });
  const cardsSe = await readSizes('.cards-search input, .cards-filter-trigger, .cards-sort-control select');

  expect(cardsSe).toHaveLength(cardsWide.length);
  expect(cardsSe.every((size, index) => size < cardsWide[index]!)).toBe(true);
  expect(cardsSe.every((size) => size >= 10)).toBe(true);

  await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', { width: 851, height: 393 });
  const deckWide = await readSizes('.deck-name-input, .deck-tool-button, .deck-save-button, .deck-search-box input');
  await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', { width: 667, height: 375 });
  const deckSe = await readSizes('.deck-name-input, .deck-tool-button, .deck-save-button, .deck-search-box input');

  expect(deckSe).toHaveLength(deckWide.length);
  expect(deckSe.every((size, index) => size < deckWide[index]!)).toBe(true);
  expect(deckSe.every((size) => size >= 10)).toBe(true);
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
        await page.getByLabel('カードを検索').fill('D080');
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
  await page.getByLabel('カードを検索').fill('D080');
  const firstPoolCard = page.getByTestId('deck-pool-card-D08023');
  await firstPoolCard.click();
  const drawer = page.locator('.deck-detail-drawer');
  const [drawerBox, workspaceBox, poolBox] = await Promise.all([
    drawer.boundingBox(),
    page.locator('.deck-workspace').boundingBox(),
    page.getByTestId('deck-pool').boundingBox(),
  ]);
  expect(drawerBox?.x ?? 0).toBeGreaterThanOrEqual(workspaceBox?.x ?? 0);
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
