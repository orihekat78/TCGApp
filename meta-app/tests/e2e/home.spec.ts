import { test, expect, type Page } from '@playwright/test';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../src/data/sampleDeck';

const NAV_ORDER = ['ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定'];

async function assertNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    screenWidth: document.querySelector('.home-screen')?.scrollWidth ?? 0,
    screenClientWidth: document.querySelector('.home-screen')?.clientWidth ?? 0,
  }));
  expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth);
  expect(sizes.screenWidth).toBeLessThanOrEqual(sizes.screenClientWidth);
}

async function assertPremiumGameStartTreatment(page: Page) {
  const styles = await page.locator('.home-nav-start').evaluate((button) => {
    const base = getComputedStyle(button);
    const reflection = getComputedStyle(button, '::before');
    return {
      backgroundLayers: (base.backgroundImage.match(/linear-gradient/g) ?? []).length,
      overflow: base.overflow,
      reflectionContent: reflection.content,
      reflectionHeight: reflection.height,
      transitionProperty: base.transitionProperty,
    };
  });

  expect(styles.backgroundLayers).toBeGreaterThanOrEqual(2);
  expect(styles.overflow).toBe('hidden');
  expect(styles.reflectionContent).not.toBe('none');
  expect(Number.parseFloat(styles.reflectionHeight)).toBeGreaterThan(0);
  expect(styles.transitionProperty).toContain('transform');
}

test('HOME premium game-start treatment is shared by desktop and compact layouts', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 851, height: 393 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#home');
    await assertPremiumGameStartTreatment(page);
    await assertNoHorizontalOverflow(page);
  }
});

test('HOME navigation typography and icons scale down with the viewport', async ({ page }) => {
  const readSize = async () => page.locator('.home-navigation button').first().evaluate((button) => {
    const icon = button.querySelector('.home-nav-icon')!;
    return {
      fontSize: Number.parseFloat(getComputedStyle(button).fontSize),
      iconWidth: icon.getBoundingClientRect().width,
    };
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#home');
  const desktop = await readSize();

  await page.setViewportSize({ width: 851, height: 393 });
  const compact = await readSize();
  expect(compact.fontSize).toBeLessThan(desktop.fontSize);
  expect(compact.iconWidth).toBeLessThan(desktop.iconWidth);
});

test('HOME keeps cloud sync status compact and clear on iPhone SE landscape', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/#home');

  const indicator = page.locator('.cloud-sync-indicator');
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute('role', 'status');
  await expect(indicator).toHaveAttribute('aria-live', 'polite');
  await expect(indicator).toHaveAttribute('aria-label', /.+/);

  const geometry = await indicator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const primary = node.querySelector<HTMLElement>('.network-status__primary')!;
    const captions = Array.from(document.querySelectorAll('.home-identity-card figcaption'))
      .map((caption) => caption.getBoundingClientRect());
    const overlapsCaption = captions.some((caption) => (
      box.left < caption.right
      && box.right > caption.left
      && box.top < caption.bottom
      && box.bottom > caption.top
    ));
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height },
      fontSize: Number.parseFloat(getComputedStyle(primary).fontSize),
      pointerEvents: getComputedStyle(node).pointerEvents,
      overlapsCaption,
    };
  });

  expect(geometry.box.width).toBeLessThanOrEqual(112);
  expect(geometry.box.height).toBeLessThanOrEqual(22);
  expect(geometry.box.left).toBeGreaterThanOrEqual(0);
  expect(geometry.box.top).toBeGreaterThanOrEqual(0);
  expect(geometry.box.right).toBeLessThanOrEqual(667);
  expect(geometry.box.bottom).toBeLessThanOrEqual(375);
  expect(geometry.fontSize).toBeGreaterThanOrEqual(10);
  expect(geometry.pointerEvents).toBe('none');
  expect(geometry.overlapsCaption).toBe(false);
});

test('HOME identity cards stay contained after the game card stylesheet loads', async ({ page }) => {
  test.setTimeout(60_000);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 851, height: 393 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/#setup');
    await expect(page.locator('#setup-title')).toBeVisible({ timeout: 10_000 });
    await page.locator('button[data-route="home"]').click();
    await expect(page.locator('.home-screen')).toBeVisible();

    const cards = page.locator('.home-identity-art > img.home-card-art');
    await expect(cards).toHaveCount(2);
    await expect.poll(() => cards.evaluateAll((images: HTMLImageElement[]) => (
      images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
    ))).toBe(true);

    const geometry = await cards.evaluateAll((images: HTMLImageElement[]) => images.map((image) => {
      const rendered = image.getBoundingClientRect();
      const frame = image.closest('.home-identity-art')!.getBoundingClientRect();
      return {
        objectFit: getComputedStyle(image).objectFit,
        naturalRatio: image.naturalWidth / image.naturalHeight,
        renderedRatio: rendered.width / rendered.height,
        fitsFrame: rendered.left >= frame.left - 0.5
          && rendered.top >= frame.top - 0.5
          && rendered.right <= frame.right + 0.5
          && rendered.bottom <= frame.bottom + 0.5,
      };
    }));
    for (const card of geometry) {
      expect(card.objectFit).toBe('contain');
      expect(Math.abs(card.naturalRatio - card.renderedRatio)).toBeLessThan(0.02);
      expect(card.fitsFrame).toBe(true);
    }
    await assertNoHorizontalOverflow(page);
  }
});

test('HOME desktop preserves the 20/80 hierarchy and sole game-start entry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#home');

  const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
  await expect(nav.getByRole('button')).toHaveText(NAV_ORDER);
  await expect(page.getByAltText('DETECTIVE CONAN')).toBeVisible();
  const brandBox = (await page.getByRole('button', { name: 'ホームへ移動' }).boundingBox())!;
  const firstNavBox = (await nav.getByRole('button', { name: 'ホーム', exact: true }).boundingBox())!;
  expect(firstNavBox.x - (brandBox.x + brandBox.width)).toBeGreaterThanOrEqual(0);
  expect(firstNavBox.x - (brandBox.x + brandBox.width)).toBeLessThanOrEqual(40);
  await expect(page.getByText('SYNC FAILED', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ゲーム開始', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: '少年探偵団・標準' })).toBeVisible();
  await expect(page.getByLabel('江戸川コナン')).toBeVisible();
  await expect(page.getByLabel('青の古城探索事件')).toBeVisible();
  const landscape = page.getByRole('figure', { name: '青の古城探索事件' }).locator('img');
  await expect.poll(() => landscape.evaluate((image: HTMLImageElement) => image.naturalWidth > image.naturalHeight)).toBe(true);
  const landscapeGeometry = await landscape.evaluate((image: HTMLImageElement) => {
    const rendered = image.getBoundingClientRect();
    const frame = image.closest('.home-identity-art')!.getBoundingClientRect();
    return {
      naturalRatio: image.naturalWidth / image.naturalHeight,
      renderedRatio: rendered.width / rendered.height,
      fitsFrame: rendered.width <= frame.width + 0.5 && rendered.height <= frame.height + 0.5,
    };
  });
  expect(Math.abs(landscapeGeometry.naturalRatio - landscapeGeometry.renderedRatio)).toBeLessThan(0.02);
  expect(landscapeGeometry.fitsFrame).toBe(true);

  const columns = await page.locator('.home-main').evaluate((node) => {
    const main = node.getBoundingClientRect();
    const rail = node.querySelector('.home-rail')!.getBoundingClientRect();
    const stage = node.querySelector('.home-deck-stage')!.getBoundingClientRect();
    return { rail: rail.width, stage: stage.width, main: main.width };
  });
  expect(columns.stage / columns.rail).toBeGreaterThan(3.5);
  expect(columns.stage / columns.rail).toBeLessThan(4.5);
  await assertNoHorizontalOverflow(page);
});

test('HOME confirms a provisional deck and carries it into match setup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#home');

  const trigger = page.getByRole('button', { name: '使用デッキを変更' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('萩原千速');
  await expect(dialog).toContainText('千速と重悟の婚活パーティー');

  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '少年探偵団・標準' })).toBeVisible();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '警察・標準' })).toBeVisible();

  await page.getByRole('button', { name: 'ゲーム開始', exact: true }).click();
  await expect(page).toHaveURL(/#setup$/);
  await expect(page.locator('.setup-player-panel--self')).toHaveAttribute('data-deck-id', 'sample-d11');
});

test('HOME deck selector stays two-column and internally scrollable in compact landscape', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  const trigger = page.getByRole('button', { name: '使用デッキを変更' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const grid = node.querySelector('.home-deck-dialog-grid')!;
    const header = node.querySelector('.home-deck-dialog-header')!.getBoundingClientRect();
    const footer = node.querySelector('.home-deck-dialog-footer')!.getBoundingClientRect();
    const choices = Array.from(node.querySelectorAll('.home-deck-choice')).map((choice) => {
      const choiceBox = choice.getBoundingClientRect();
      return { left: choiceBox.left, right: choiceBox.right, top: choiceBox.top };
    });
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      gridClientHeight: grid.clientHeight,
      gridScrollHeight: grid.scrollHeight,
      headerBottom: header.bottom,
      footerTop: footer.top,
      choices,
    };
  });
  expect(geometry.box.left).toBeGreaterThanOrEqual(0);
  expect(geometry.box.top).toBeGreaterThanOrEqual(0);
  expect(geometry.box.right).toBeLessThanOrEqual(851);
  expect(geometry.box.bottom).toBeLessThanOrEqual(393);
  expect(geometry.choices).toHaveLength(2);
  expect(new Set(geometry.choices.map((choice) => Math.round(choice.left))).size).toBe(2);
  expect(geometry.choices[0]!.right).toBeLessThanOrEqual(geometry.choices[1]!.left);
  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.choices[0]!.top);
  expect(geometry.footerTop).toBeGreaterThan(geometry.choices[0]!.top);
  expect(geometry.gridScrollHeight).toBeGreaterThanOrEqual(geometry.gridClientHeight);

  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: '少年探偵団・標準' })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('HOME compact landscape keeps the complete desktop navigation and deck cards visible', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  const nav = page.locator('.home-navigation');
  const navButtons = nav.locator('button');
  await expect(navButtons).toHaveText(NAV_ORDER);
  await expect(page.locator('.home-menu-toggle')).toHaveCount(0);
  for (const button of await navButtons.all()) {
    await expect(button).toBeVisible();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(35.5);
  }

  const navPositions = await navButtons.evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top };
  }));
  expect(Math.max(...navPositions.map((box) => box.top)) - Math.min(...navPositions.map((box) => box.top))).toBeLessThan(2);
  for (let index = 1; index < navPositions.length; index += 1) {
    expect(navPositions[index - 1]!.right).toBeLessThanOrEqual(navPositions[index]!.left + 0.5);
  }

  await page.locator('.home-brand').focus();
  await page.keyboard.press('Tab');
  await expect(navButtons.first()).toBeFocused();

  const media = page.locator('.home-deck-media');
  const positions = await media.locator('figure').evaluateAll((figures) => figures.map((figure) => {
    const box = figure.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  expect(positions).toHaveLength(2);
  expect(positions[0]!.right).toBeLessThanOrEqual(positions[1]!.left);
  expect(Math.abs(positions[0]!.top - positions[1]!.top)).toBeLessThan(8);

  await assertNoHorizontalOverflow(page);
});

test('HOME approved 20/80 landscape composition matches the compact reference', async ({ page }) => {
  await page.addInitScript(() => {
    const base = 'https://www.takaratomy.co.jp/products/conan-cardgame/';
    localStorage.setItem('conan.meta.v1.official-news', JSON.stringify({
      version: 2,
      fetchedAt: Date.now(),
      items: [
        { id: `${base}news/1/`, category: 'イベント', title: '探偵サミット2026', date: '2026-07-31', url: `${base}news/1/` },
        { id: `${base}news/2/`, category: 'イベント', title: '物販コーナー', date: '2026-07-27', url: `${base}news/2/` },
        { id: `${base}news/3/`, category: 'その他', title: '追憶の盟友 アンケート', date: '2026-07-25', url: `${base}news/3/` },
      ],
    }));
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      version: 1,
      state: {
        history: [
          { id: 'compact-1', won: true, oppDeckName: '赤井秀一デッキ（CPU）', recorded: Date.UTC(2026, 7, 3) },
          { id: 'compact-2', won: false, oppDeckName: '警察デッキ（CPU）', recorded: Date.UTC(2026, 7, 2) },
          { id: 'compact-3', won: true, oppDeckName: '怪盗キッド（CPU）', recorded: Date.UTC(2026, 7, 1) },
        ],
        _hasHydrated: true,
      },
    }));
  });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  const geometry = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const rail = box('.home-rail');
    const stage = box('.home-deck-stage');
    const figures = Array.from(document.querySelectorAll('.home-identity-card')).map((node) => node.getBoundingClientRect());
    return {
      headerHeight: box('.home-header').height,
      railWidth: rail.width,
      stageWidth: stage.width,
      newsRowHeight: box('.home-news-list li').height,
      matchRowHeight: box('.home-match-list li').height,
      identityArtHeight: box('.home-identity-art').height,
      deckHeadingSize: Number.parseFloat(getComputedStyle(document.querySelector('.home-deck-heading h1')!).fontSize),
      railBottom: rail.bottom,
      figures: figures.map((figure) => ({ left: figure.left, right: figure.right, bottom: figure.bottom })),
    };
  });

  expect(geometry.stageWidth / geometry.railWidth).toBeGreaterThanOrEqual(3.8);
  expect(geometry.stageWidth / geometry.railWidth).toBeLessThanOrEqual(4.2);
  // Shared landscape header keeps the approved 54px frame across HOME,
  // SETUP, CARDS, and DECK while its labels/icons scale for the viewport.
  expect(geometry.headerHeight).toBeGreaterThanOrEqual(53);
  expect(geometry.headerHeight).toBeLessThanOrEqual(55);
  expect(geometry.newsRowHeight).toBeGreaterThanOrEqual(42);
  expect(geometry.newsRowHeight).toBeLessThanOrEqual(44.1);
  expect(geometry.matchRowHeight).toBeGreaterThanOrEqual(31);
  expect(geometry.matchRowHeight).toBeLessThanOrEqual(33);
  expect(geometry.identityArtHeight).toBeGreaterThanOrEqual(225);
  expect(geometry.identityArtHeight).toBeLessThanOrEqual(235);
  expect(geometry.deckHeadingSize).toBeGreaterThanOrEqual(17);
  expect(geometry.deckHeadingSize).toBeLessThanOrEqual(19);
  expect(geometry.railBottom).toBeLessThanOrEqual(393);
  expect(geometry.figures).toHaveLength(2);
  expect(geometry.figures[0]!.right).toBeLessThanOrEqual(geometry.figures[1]!.left);
  expect(Math.max(...geometry.figures.map((figure) => figure.bottom))).toBeLessThanOrEqual(393);
  await expect(page.locator('.home-rail-section')).toHaveCount(2);
  await expect(page.locator('.home-rail-section').nth(1)).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('HOME compact landscape scrolls only the NEWS and recent-match lists', async ({ page }) => {
  await page.addInitScript(() => {
    const base = 'https://www.takaratomy.co.jp/products/conan-cardgame/';
    localStorage.setItem('conan.meta.v1.official-news', JSON.stringify({
      version: 2,
      fetchedAt: Date.now(),
      items: Array.from({ length: 12 }, (_, index) => ({
        id: `${base}news/scroll-${index + 1}/`,
        category: 'イベント',
        title: `スクロール確認用NEWS ${index + 1}`,
        date: `2026-07-${String(31 - index).padStart(2, '0')}`,
        url: `${base}news/scroll-${index + 1}/`,
      })),
    }));
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      version: 1,
      state: {
        history: Array.from({ length: 12 }, (_, index) => ({
          id: `scroll-match-${index + 1}`,
          won: index % 2 === 0,
          oppDeckName: `CPUデッキ ${index + 1}`,
          recorded: Date.UTC(2026, 7, 3 - index),
        })),
        _hasHydrated: true,
      },
    }));
  });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  const newsList = page.locator('.home-news-list');
  const matchList = page.locator('.home-match-list');
  const before = await page.evaluate(() => {
    const newsNode = document.querySelector('.home-news-list')!;
    const matchNode = document.querySelector('.home-match-list')!;
    return {
      newsClientHeight: newsNode.clientHeight,
      newsScrollHeight: newsNode.scrollHeight,
      matchClientHeight: matchNode.clientHeight,
      matchScrollHeight: matchNode.scrollHeight,
      pageScrollTop: document.querySelector('.home-screen')!.scrollTop,
    };
  });
  expect(before.newsScrollHeight).toBeGreaterThan(before.newsClientHeight);
  expect(before.matchScrollHeight).toBeGreaterThan(before.matchClientHeight);

  await newsList.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => newsList.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await matchList.evaluate((node) => node.scrollTop)).toBe(0);

  await matchList.focus();
  await expect(matchList).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect.poll(() => matchList.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  const after = await page.evaluate(() => ({
    newsScrollTop: document.querySelector('.home-news-list')!.scrollTop,
    matchScrollTop: document.querySelector('.home-match-list')!.scrollTop,
    pageScrollTop: document.querySelector('.home-screen')!.scrollTop,
    documentScrollTop: document.documentElement.scrollTop,
  }));
  expect(after.newsScrollTop).toBeGreaterThan(0);
  expect(after.matchScrollTop).toBeGreaterThan(0);
  expect(after.pageScrollTop).toBe(0);
  expect(after.documentScrollTop).toBe(0);
  await assertNoHorizontalOverflow(page);
});

test('HOME 720x393 keeps the 20/80 rail reachable inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 393 });
  await page.goto('/#home');

  const geometry = await page.locator('.home-main').evaluate((main) => {
    const screen = document.querySelector('.home-screen')!;
    const rail = main.querySelector('.home-rail')!;
    const stage = main.querySelector('.home-deck-stage')!;
    const firstSection = main.querySelector('.home-rail-section')!;
    const railBox = rail.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return {
      layout: getComputedStyle(main).display,
      railWidth: railBox.width,
      railHeight: railBox.height,
      railBottom: railBox.bottom,
      stageWidth: stageBox.width,
      sectionHeight: firstSection.getBoundingClientRect().height,
      screenOverflowY: getComputedStyle(screen).overflowY,
    };
  });

  expect(geometry.layout).toBe('grid');
  expect(geometry.stageWidth / geometry.railWidth).toBeGreaterThanOrEqual(3.8);
  expect(geometry.stageWidth / geometry.railWidth).toBeLessThanOrEqual(4.2);
  expect(geometry.railHeight).toBeGreaterThan(0);
  expect(geometry.sectionHeight).toBeGreaterThan(0);
  expect(geometry.railBottom).toBeLessThanOrEqual(393);
  expect(geometry.screenOverflowY).toBe('hidden');
  await assertNoHorizontalOverflow(page);
});

test('HOME navigation content stays inside its buttons around the compact breakpoint', async ({ page }) => {
  for (const width of [621, 640, 700]) {
    await page.setViewportSize({ width, height: 375 });
    await page.goto('/#home');

    const navButtons = page.locator('.home-navigation button');
    await expect(navButtons).toHaveText(NAV_ORDER);
    const contained = await navButtons.evaluateAll((buttons) => buttons.map((button) => {
      const parent = button.getBoundingClientRect();
      const contentRects = Array.from(button.childNodes).flatMap((node) => {
        if (node instanceof Element) return [node.getBoundingClientRect()];
        if (!node.textContent?.trim()) return [];
        const range = document.createRange();
        range.selectNodeContents(node);
        return Array.from(range.getClientRects());
      });
      return contentRects.every((rect) => rect.left >= parent.left - 0.5 && rect.right <= parent.right + 0.5);
    }));
    expect(contained, `navigation content at ${width}px`).not.toContain(false);
    await assertNoHorizontalOverflow(page);
  }
});

test('HOME contains a portrait incident without cropping or distortion', async ({ page }) => {
  await page.addInitScript((deck) => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 4,
      state: {
        decks: [deck],
        activeDeckId: deck.id,
        _hasHydrated: true,
      },
    }));
  }, SAMPLE_DECK_OPP);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#home');

  await expect(page.getByRole('heading', { level: 1, name: '警察・標準' })).toBeVisible();
  const incident = page.getByRole('figure', { name: '千速と重悟の婚活パーティー' }).locator('img');
  await expect(incident).toBeVisible();
  await expect.poll(() => incident.evaluate((image: HTMLImageElement) => image.naturalHeight > image.naturalWidth)).toBe(true);

  const geometry = await incident.evaluate((image: HTMLImageElement) => {
    const rendered = image.getBoundingClientRect();
    const frame = image.closest('.home-identity-art')!.getBoundingClientRect();
    return {
      naturalRatio: image.naturalWidth / image.naturalHeight,
      renderedRatio: rendered.width / rendered.height,
      fitsFrame: rendered.width <= frame.width + 0.5 && rendered.height <= frame.height + 0.5,
    };
  });
  expect(Math.abs(geometry.naturalRatio - geometry.renderedRatio)).toBeLessThan(0.02);
  expect(geometry.fitsFrame).toBe(true);
});

test('HOME contains long persisted deck names without horizontal overflow', async ({ page }) => {
  await page.addInitScript((baseDeck) => {
    const longName = '長いデッキ名'.repeat(100);
    const deck = { ...baseDeck, id: 'long-name-deck', name: longName };
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 4,
      state: {
        decks: [deck],
        activeDeckId: deck.id,
        _hasHydrated: true,
      },
    }));
    localStorage.setItem('conan.meta.v1.history', JSON.stringify({
      version: 1,
      state: {
        history: [{
          id: 'long-name-history',
          recorded: Date.now(),
          won: true,
          deckName: longName,
          oppDeckName: longName,
          turns: 1,
          duration: 1,
          evidGot: 0,
          evidLost: 0,
          contacts: 0,
          hirameki: 0,
          misread: 0,
          p1Target: 7,
          p2Target: 7,
        }],
        _hasHydrated: true,
      },
    }));
  }, SAMPLE_DECK);
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  await expect(page.locator('.home-deck-heading h1')).toHaveAttribute('title', /長いデッキ名/);
  await expect(page.locator('.home-match-list li > span').nth(1)).toHaveAttribute('title', /長いデッキ名/);
  await assertNoHorizontalOverflow(page);
});

test('HOME contains accepted maximum NEWS metadata inside the compact rail', async ({ page }) => {
  await page.addInitScript(() => {
    const url = 'https://www.takaratomy.co.jp/products/conan-cardgame/news/boundary.html';
    localStorage.setItem('conan.meta.v1.official-news', JSON.stringify({
      version: 2,
      fetchedAt: Date.now(),
      items: [{
        id: url,
        category: 'C'.repeat(30),
        title: 'T'.repeat(120),
        date: '2026-08-02',
        url,
      }],
    }));
  });
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');

  const newsLink = page.locator('.home-news-list a');
  await expect(newsLink).toBeVisible();
  const geometry = await newsLink.evaluate((link) => {
    const railBox = link.closest('.home-rail')!.getBoundingClientRect();
    const categoryBox = link.querySelector('.home-news-category')!.getBoundingClientRect();
    const titleBox = link.querySelector('strong')!.getBoundingClientRect();
    return { categoryRight: categoryBox.right, titleRight: titleBox.right, railRight: railBox.right };
  });
  expect(geometry.categoryRight).toBeLessThanOrEqual(geometry.railRight);
  expect(geometry.titleRight).toBeLessThanOrEqual(geometry.railRight);
  await assertNoHorizontalOverflow(page);
});
