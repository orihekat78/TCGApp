// spec: .claude/specs/meta-ui/ (Phase 18: DeckEditor リデザイン + 同 ID 3 枚上限の UI 可視化)
// 「処理だけでなく UI 上で確認できる」ことを検証する (rules/02: 同じカード=同 ID、最大 3 枚)。

import { test, expect, type Locator, type Page } from '@playwright/test';
import { gotoReadyLandscapeRoute } from './landscape-test-helpers';

async function revealPoolCard(page: Page, cardNumber: string) {
  await page.getByRole('textbox', { name: 'カードを検索' }).fill(cardNumber);
  const visibleResults = page.locator('[data-testid^="deck-pool-card-"]');
  await expect.poll(async () => visibleResults.evaluateAll((items, expectedNumber) => (
    items.length > 0
      && items.every((item) => item.getAttribute('data-testid') === `deck-pool-card-${expectedNumber}`)
  ), cardNumber)).toBe(true);
  const card = page.getByTestId(`deck-pool-card-${cardNumber}`);
  await expect(card).toBeVisible();
  return card;
}

async function expectFullyVisibleHitTarget(
  control: Locator,
  viewport: { width: number; height: number },
) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  const geometry = await control.evaluate((element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return {
      cssWidth: element.offsetWidth,
      cssHeight: element.offsetHeight,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
    };
  });
  expect(geometry.cssWidth).toBeGreaterThanOrEqual(44);
  expect(geometry.cssHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
}

test('DECK keeps its pool window bounded while selected and focused cards remain connected', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });
  const scroller = page.locator('.deck-pool-grid');
  const poolCards = page.locator('[data-testid^="deck-pool-card-"]');
  await expect(poolCards).toHaveCount(48);
  const first = await page.locator('[data-testid^="deck-pool-card-"]:not([aria-pressed="true"])').first().elementHandle();
  expect(first).not.toBeNull();

  await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight / 2; node.dispatchEvent(new Event('scroll')); });
  await expect.poll(() => poolCards.count()).toBeLessThanOrEqual(96);
  await scroller.evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
  expect(await scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => poolCards.count()).toBeLessThanOrEqual(96);
  expect(await first!.evaluate((node) => node.isConnected)).toBe(false);
  const selected = poolCards.last();
  await selected.click();
  await expect(page.getByRole('dialog', { name: /カード詳細:/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(selected).toBeAttached();
  await expect(selected).toBeFocused();
  expect(errors).toEqual([]);
});

test('DECK retains selected and focused D09019 while a later pool scroll changes the window', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });
  const scroller = page.locator('.deck-pool-grid');
  const poolCards = page.locator('[data-testid^="deck-pool-card-"]');
  const target = page.getByTestId('deck-pool-card-D09019');
  const positions = await scroller.evaluate((node) => {
    const max = Math.max(0, node.scrollHeight - node.clientHeight);
    return Array.from({ length: 17 }, (_, index) => Math.round(max * index / 16));
  });
  let targetTop = 0;
  for (const top of positions) {
    await scroller.evaluate((node, value) => {
      node.scrollTop = value;
      node.dispatchEvent(new Event('scroll'));
    }, top);
    if (await target.count()) {
      targetTop = top;
      break;
    }
  }
  await expect(target).toBeVisible();
  await target.click();
  await expect(page.locator('.deck-detail-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(target).toBeFocused();
  const selectedNode = await target.elementHandle();
  expect(selectedNode).not.toBeNull();

  const maxTop = positions.at(-1) ?? 0;
  const laterTop = targetTop > maxTop / 2 ? 0 : maxTop;
  await scroller.evaluate((node, value) => {
    node.scrollTop = value;
    node.dispatchEvent(new Event('scroll'));
  }, laterTop);
  await expect.poll(() => poolCards.count()).toBeLessThanOrEqual(96);
  expect(await selectedNode!.evaluate((node) => (
    node.isConnected && document.activeElement === node
  ))).toBe(true);
  expect(errors).toEqual([]);
});

test('DECK刷新: プールのクリックは枚数を変えず、左詳細を開いてフォーカスを戻す', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('spectator-hud')).toHaveCount(0);

  const count = page.getByTestId('deck-count-D08023');
  await expect(count).toHaveAttribute('data-count', '2');
  const poolCard = await revealPoolCard(page, 'D08023');
  await poolCard.click();

  const detail = page.getByRole('dialog', { name: 'カード詳細: 毛利蘭' });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('D08023');
  await expect(detail).toContainText('毛利蘭');
  await expect(count).toHaveAttribute('data-count', '2');

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(poolCard).toBeFocused();

  const detailCloseKeepsNewFocus = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLElement>('[data-testid="deck-pool-card-D08023"]');
    const nextAction = document.querySelector<HTMLElement>('[data-route="home"]');
    if (!trigger || !nextAction) throw new Error('DECK detail focus probe prerequisites are missing');
    trigger.click();
    await Promise.resolve();
    const drawer = document.querySelector<HTMLElement>('.deck-detail-drawer');
    if (!drawer || drawer.getClientRects().length === 0) {
      throw new Error('DECK detail drawer did not open');
    }
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await Promise.resolve();
    nextAction.focus();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      stable: document.activeElement === nextAction,
      dialogClosed: !document.querySelector('.deck-detail-drawer'),
      activeRoute: document.activeElement?.getAttribute('data-route') ?? null,
      nextConnected: nextAction.isConnected,
    };
  });
  expect(detailCloseKeepsNewFocus).toEqual({
    stable: true, dialogClosed: true, activeRoute: 'home', nextConnected: true,
  });
  expect(errors).toEqual([]);
});

test('DECK detail drawer blocks background pointer actions', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });

  const partnerSlot = page.locator('.deck-slots-row > button').first();
  await partnerSlot.click();
  await expect(page.locator('.deck-detail-drawer')).toBeVisible();

  const poolCard = page.locator('[data-testid^="deck-pool-card-"]').first();
  const poolBox = await poolCard.boundingBox();
  expect(poolBox).not.toBeNull();
  await page.mouse.click(poolBox!.x + poolBox!.width / 2, poolBox!.y + poolBox!.height / 2);
  await expect(page.locator('.deck-detail-drawer')).toHaveCount(0);
  await expect(partnerSlot).toBeFocused();

  await partnerSlot.click();
  const homeButton = page.locator('.home-navigation button').first();
  const homeBox = await homeButton.boundingBox();
  expect(homeBox).not.toBeNull();
  await page.mouse.click(homeBox!.x + homeBox!.width / 2, homeBox!.y + homeBox!.height / 2);
  await expect(page).toHaveURL(/#deck$/);
  await expect(page.locator('.deck-detail-drawer')).toHaveCount(0);
  await expect(partnerSlot).toBeFocused();
});

test('DECK刷新: プールからデッキへドラッグして追加し、同一ID上限では拒否を通知する', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  const dropzone = page.getByTestId('deck-dropzone');
  const count = page.getByTestId('deck-count-D08023');
  const status = page.getByRole('status', { name: 'デッキ編集結果' });

  await expect(count).toHaveAttribute('data-count', '2');
  const poolCard = await revealPoolCard(page, 'D08023');
  await poolCard.dragTo(dropzone);
  await expect(count).toHaveAttribute('data-count', '3');
  await expect(status).toContainText('毛利蘭を1枚追加しました');

  await poolCard.dragTo(dropzone);
  await expect(count).toHaveAttribute('data-count', '3');
  await expect(status).toContainText('同一IDは3枚までです');
  const feedback = page.getByTestId('deck-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('デッキから1枚除いて再試行してください');
  await page.waitForTimeout(900);
  await expect(feedback).toBeVisible();
  await feedback.getByRole('button', { name: '通知を閉じる' }).click();
  await expect(feedback).toBeHidden();
});

test('DECK刷新: デッキからカード一覧へドラッグすると1枚除外できる', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.deck-card-remove')).toHaveCount(0);

  const deckCard = page.getByTestId('deck-entry-D08023');
  const count = page.getByTestId('deck-count-D08023');
  const pool = page.getByTestId('deck-pool');
  await expect(count).toHaveAttribute('data-count', '2');
  await deckCard.dragTo(pool);
  await expect(count).toHaveAttribute('data-count', '1');
  await expect(page.getByRole('status', { name: 'デッキ編集結果' })).toContainText('毛利蘭を1枚除きました');
});

test('DECK刷新: パートナー・事件の右隣にコスト分布を横並びで表示する', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 851, height: 393 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/#deck');
    await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });

    const overview = page.getByTestId('deck-overview');
    const slots = overview.locator('.deck-slots-row');
    const stats = overview.locator('.deck-stats-panel');
    const [overviewBox, slotsBox, statsBox] = await Promise.all([
      overview.boundingBox(),
      slots.boundingBox(),
      stats.boundingBox(),
    ]);

    expect(overviewBox).not.toBeNull();
    expect(slotsBox).not.toBeNull();
    expect(statsBox).not.toBeNull();
    expect(Math.abs(slotsBox!.y - statsBox!.y)).toBeLessThanOrEqual(1);
    expect(slotsBox!.x + slotsBox!.width).toBeLessThanOrEqual(statsBox!.x);
    expect(statsBox!.x + statsBox!.width).toBeLessThanOrEqual(overviewBox!.x + overviewBox!.width + 1);
    await expect(stats).not.toContainText(/avg|TYPE/);
    await expect(stats).toContainText('キャラ');
    await expect(stats).toContainText('イベント');
    const costChartBox = await stats.getByTestId('deck-cost-chart').boundingBox();
    expect(costChartBox).not.toBeNull();
    expect(costChartBox!.width).toBeGreaterThan(statsBox!.width * 0.65);
    const [costHeadingBox, costBarsBox] = await Promise.all([
      stats.getByTestId('deck-cost-heading').boundingBox(),
      stats.getByTestId('deck-cost-bars').boundingBox(),
    ]);
    expect(costHeadingBox).not.toBeNull();
    expect(costBarsBox).not.toBeNull();
    expect(costBarsBox!.y - (costHeadingBox!.y + costHeadingBox!.height)).toBeGreaterThanOrEqual(viewport.width <= 851 ? 5 : 9);

    await expect(page.getByText(/^DECK\s*·\s*\d+\s*\/\s*40$/)).toHaveCount(0);
    await expect(page.getByTestId('deck-total-value')).toHaveCount(0);
    await expect(page.getByTestId('deck-total-limit')).toHaveCount(0);
  }
});

test('DECK刷新: 編集対象はホームと同じカード型ダイアログで変更し、不要な補助文言と横スクロールを出さない', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  await expect(page.getByText('DECK EDIT', { exact: true })).toHaveCount(0);
  await expect(page.locator('.deck-slots-row').getByText(/種類/)).toHaveCount(0);
  await expect(page.getByText(/^POOL ·/)).toHaveCount(0);
  await expect(page.getByLabel('編集するデッキ')).toHaveCount(0);

  const gridOverflow = await page.getByTestId('deck-card-grid').evaluate((grid) => ({
    overflowX: getComputedStyle(grid).overflowX,
    delta: grid.scrollWidth - grid.clientWidth,
  }));
  expect(gridOverflow.overflowX).toBe('hidden');
  expect(gridOverflow.delta).toBe(0);

  const trigger = page.getByRole('button', { name: 'デッキを変更' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '編集するデッキを選択' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.home-deck-choice')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  const selectorCloseKeepsNewFocus = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLElement>('.deck-change-button');
    const nextAction = document.querySelector<HTMLElement>('[data-route="home"]');
    if (!trigger || !nextAction) throw new Error('DECK selector focus probe prerequisites are missing');
    trigger.click();
    await Promise.resolve();
    const dialog = document.querySelector<HTMLDialogElement>('.home-deck-dialog');
    if (!dialog?.open || dialog.getClientRects().length === 0) {
      throw new Error('DECK selector dialog did not open');
    }
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await Promise.resolve();
    nextAction.focus();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return document.activeElement === nextAction && !document.querySelector('.home-deck-dialog');
  });
  expect(selectorCloseKeepsNewFocus).toBe(true);

  await trigger.click();
  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await dialog.getByRole('button', { name: 'このデッキを編集' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('デッキ名')).toHaveValue('警察・標準');
  await expect(trigger).toBeFocused();
});

test('DECK刷新: フィルタと共通モーダルはフォーカスを閉じ込め、閉じると起点へ戻る', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  const filterTrigger = page.getByRole('button', { name: 'フィルタを開く' });
  await filterTrigger.click();
  const filterDialog = page.getByRole('dialog', { name: 'フィルタ' });
  const filterClose = filterDialog.getByRole('button', { name: 'フィルタを閉じる' });
  await expect(filterDialog).toBeVisible();
  await expect(filterClose).toBeFocused();
  await expect(filterDialog.locator('.meta-chip:disabled')).toHaveCount(0);
  await expect(filterDialog.locator('.filter-rail-scroll')).toHaveCSS('scrollbar-width', 'thin');
  const filterCloseBox = await filterClose.boundingBox();
  expect(filterCloseBox?.width).toBeGreaterThanOrEqual(44);
  expect(filterCloseBox?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(filterDialog).toBeHidden();
  await expect(filterTrigger).toBeFocused();

  const filterCloseKeepsNewFocus = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLElement>('.deck-pool-filter');
    const nextAction = document.querySelector<HTMLElement>('[data-route="home"]');
    if (!trigger || !nextAction) throw new Error('DECK filter focus probe prerequisites are missing');
    trigger.click();
    await Promise.resolve();
    const dialog = document.querySelector<HTMLElement>('.deck-filter-dialog');
    if (!dialog || dialog.getClientRects().length === 0) {
      throw new Error('DECK filter dialog did not open');
    }
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await Promise.resolve();
    nextAction.focus();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      stable: document.activeElement === nextAction,
      dialogClosed: !document.querySelector('.deck-filter-dialog'),
      activeRoute: document.activeElement?.getAttribute('data-route') ?? null,
      nextConnected: nextAction.isConnected,
    };
  });
  expect(filterCloseKeepsNewFocus).toEqual({
    stable: true, dialogClosed: true, activeRoute: 'home', nextConnected: true,
  });

  const codeTrigger = page.getByRole('button', { name: 'コード' });
  await codeTrigger.click();
  const codeDialog = page.getByRole('dialog', { name: 'デッキコード · 入出力' });
  const codeClose = codeDialog.getByRole('button', { name: '閉じる' });
  await expect(codeClose).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(codeDialog.locator('textarea').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(codeDialog).toBeHidden();
  await expect(codeTrigger).toBeFocused();

  const poolCard = await revealPoolCard(page, 'D08023');
  await poolCard.click({ button: 'right' });
  const expandDialog = page.getByRole('dialog', { name: 'カード拡大表示: 毛利蘭' });
  const expandClose = expandDialog.getByRole('button', { name: '閉じる' });
  await expect(expandClose).toBeFocused();
  const expandCloseBox = await expandClose.boundingBox();
  expect(expandCloseBox?.width).toBeGreaterThanOrEqual(44);
  expect(expandCloseBox?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(expandDialog).toBeHidden();
  await expect(poolCard).toBeFocused();
});

test('DECK刷新: 未保存変更をインポートで置換する前に確認し、拒否時は入力を保持する', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await page.getByLabel('デッキ名').fill('未保存の編集');
  await page.getByRole('button', { name: 'コード' }).click();

  const dialog = page.getByRole('dialog', { name: 'デッキコード · 入出力' });
  const textareas = dialog.locator('textarea');
  const code = await textareas.first().inputValue();
  await textareas.nth(1).fill(code);

  page.once('dialog', async (confirmation) => {
    expect(confirmation.message()).toContain('未保存の変更');
    await confirmation.dismiss();
  });
  await dialog.getByRole('button', { name: '読み込む' }).click();
  await expect(dialog).toBeVisible();
  await expect(textareas.nth(1)).toHaveValue(code);
  await expect(page.getByLabel('デッキ名')).toHaveValue('未保存の編集');

  page.once('dialog', async (confirmation) => confirmation.accept());
  await dialog.getByRole('button', { name: '読み込む' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status', { name: 'デッキ編集結果' })).toContainText('デッキコードを読み込みました');
});

test('DECK: shared header navigation confirms before discarding an unsaved draft', async ({ page }) => {
  for (const scenario of [
    { viewport: { width: 851, height: 393 }, activation: 'pointer' },
    { viewport: { width: 720, height: 393 }, activation: 'keyboard' },
  ] as const) {
    await page.setViewportSize(scenario.viewport);
    await page.goto('/#deck');
    await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });

    const name = page.getByLabel('デッキ名');
    const original = await name.inputValue();
    const draft = `${original} 未保存 ${scenario.viewport.width}`;
    await name.fill(draft);
    const home = page.locator('[data-route="home"]');

    let promptCount = 0;
    page.once('dialog', async (dialog) => {
      promptCount += 1;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('未保存の変更');
      await dialog.dismiss();
    });
    if (scenario.activation === 'pointer') await home.click();
    else {
      await home.focus();
      await page.keyboard.press('Enter');
    }

    await expect(page).toHaveURL(/#deck$/);
    await expect(name).toHaveValue(draft);
    expect(promptCount).toBe(1);

    page.once('dialog', async (dialog) => {
      promptCount += 1;
      await dialog.accept();
    });
    if (scenario.activation === 'pointer') await home.click();
    else {
      await home.focus();
      await page.keyboard.press('Enter');
    }

    await expect(page).toHaveURL(/#home$/);
    expect(promptCount).toBe(2);
    await page.goto('/#deck');
    await expect(page.getByLabel('デッキ名')).toHaveValue(original);
  }
});

test('DECK: hotkeys and reload warn before discarding an unsaved draft', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 393 });
  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });

  const name = page.getByLabel('デッキ名');
  const original = await name.inputValue();
  expect(await page.evaluate(() => window.dispatchEvent(
    new Event('beforeunload', { cancelable: true }),
  ))).toBe(true);

  const draft = `${original} 未保存 hotkey`;
  await name.fill(draft);
  await name.evaluate((element) => (element as HTMLElement).blur());
  expect(await page.evaluate(() => window.dispatchEvent(
    new Event('beforeunload', { cancelable: true }),
  ))).toBe(false);

  const dismissed = page.waitForEvent('dialog').then(async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.keyboard.press('Escape');
  await dismissed;
  await expect(page).toHaveURL(/#deck$/);
  await expect(name).toHaveValue(draft);

  const accepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await accepted;
  await expect(page).toHaveURL(/#home$/);
});

test('DECK: browser Back is blocked until discarding an unsaved draft is accepted', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#home');
  await page.locator('[data-route="deck"]').click();
  await expect(page).toHaveURL(/#deck$/);

  const name = page.getByLabel('デッキ名');
  const draft = `${await name.inputValue()} 未保存 back`;
  await name.fill(draft);
  await name.evaluate((element) => (element as HTMLElement).blur());

  const dismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => window.history.back());
  await dismissed;
  await expect(page).toHaveURL(/#deck$/);
  await expect(name).toHaveValue(draft);

  const accepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.evaluate(() => window.history.back());
  await accepted;
  await expect(page).toHaveURL(/#home$/);
});

test('DECK: direct hash and browser Forward use the same discard guard', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible({ timeout: 6000 });

  const name = page.getByLabel('デッキ名');
  const draft = `${await name.inputValue()} 未保存 hash`;
  await name.fill(draft);
  await name.evaluate((element) => (element as HTMLElement).blur());

  const directHashDismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => { window.location.hash = '#cards'; });
  await directHashDismissed;
  await expect(page).toHaveURL(/#deck$/);
  await expect(name).toHaveValue(draft);

  const forwardDismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => window.history.forward());
  await forwardDismissed;
  await expect(page).toHaveURL(/#deck$/);
  await expect(name).toHaveValue(draft);

  const forwardAccepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.evaluate(() => window.history.forward());
  await forwardAccepted;
  await expect(page).toHaveURL(/#cards$/);
});

test('DECK刷新: 保存不可の理由を保存導線の隣に示し、検証箇所へ移動できる', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await page.getByTestId('deck-entry-D08003')
    .getByRole('button', { name: /江戸川コナン 3\/3。詳細を開く/ })
    .click();
  await page.getByRole('button', { name: '江戸川コナンをデッキから1枚除く' }).click();
  await page.locator('.deck-detail-header button').click();

  const reason = page.getByRole('button', { name: /保存不可/ });
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('1 枚不足');
  const reasonBox = await reason.boundingBox();
  const filterBox = await page.getByRole('button', { name: 'フィルタを開く' }).boundingBox();
  const toolbarBox = await page.getByRole('region', { name: 'デッキ編集操作' }).boundingBox();
  expect(reasonBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  const overlapsFilter = reasonBox!.x < filterBox!.x + filterBox!.width
    && reasonBox!.x + reasonBox!.width > filterBox!.x
    && reasonBox!.y < filterBox!.y + filterBox!.height
    && reasonBox!.y + reasonBox!.height > filterBox!.y;
  expect(overlapsFilter).toBe(false);
  expect(reasonBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y);
  expect(reasonBox!.y + reasonBox!.height).toBeLessThanOrEqual(toolbarBox!.y + toolbarBox!.height);
  await reason.click();
  const validation = page.getByTestId('deck-validation');
  await expect(validation).toBeFocused();
  await expect(validation).toContainText('枚数違反: 39/40');
});

test('DECK刷新: パートナーと事件の候補を名前・色で絞り込める', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  const partnerSlot = page.getByRole('button', { name: /パートナー/ }).first();
  await partnerSlot.click();
  const partnerDetail = page.getByRole('dialog', { name: 'カード詳細: 江戸川コナン' });
  await expect(partnerDetail).toBeVisible();
  await expect(partnerDetail.getByText('採用数')).toHaveCount(0);
  const partnerChange = partnerDetail.getByRole('button', { name: 'カードを変更' });
  const partnerChangeBox = await partnerChange.boundingBox();
  expect(partnerChangeBox?.width).toBeGreaterThanOrEqual(44);
  expect(partnerChangeBox?.height).toBeGreaterThanOrEqual(44);
  await partnerChange.click();
  const partnerDialog = page.getByRole('dialog', { name: 'パートナーを選択' });
  await expect(partnerDialog.locator('.deck-modal-scroll')).toHaveCSS('scrollbar-width', 'thin');
  const partnerSearch = partnerDialog.getByRole('textbox', { name: 'パートナー候補を名前で検索' });
  await partnerSearch.fill('江戸川コナン');
  await expect(partnerDialog.locator('[data-slot-picker-card]').first()).toBeVisible();
  const partnerNames = await partnerDialog.locator('[data-slot-picker-card]').allTextContents();
  expect(partnerNames.every((name) => name.includes('江戸川コナン'))).toBe(true);
  await partnerDialog.getByRole('button', { name: '青', exact: true }).click();
  const partnerColors = await partnerDialog.locator('[data-slot-picker-card]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-card-colors') ?? ''),
  );
  expect(partnerColors.length).toBeGreaterThan(0);
  expect(partnerColors.every((colors) => colors.split(',').includes('blue'))).toBe(true);
  await partnerDialog.getByRole('button', { name: '閉じる' }).click();
  await expect(partnerSlot).toBeFocused();

  const caseSlot = page.getByRole('button', { name: /事件/ }).first();
  await caseSlot.click();
  const caseDetail = page.getByRole('dialog', { name: 'カード詳細: 青の古城探索事件' });
  await expect(caseDetail).toBeVisible();
  await expect(caseDetail.getByText('採用数')).toHaveCount(0);
  await caseDetail.getByRole('button', { name: 'カードを変更' }).click();
  const caseDialog = page.getByRole('dialog', { name: '事件を選択' });
  await expect(caseDialog.locator('.deck-modal-scroll')).toHaveCSS('scrollbar-width', 'thin');
  const caseSearch = caseDialog.getByRole('textbox', { name: '事件候補を名前で検索' });
  await caseSearch.fill('青の古城探索事件');
  await expect(caseDialog.locator('[data-slot-picker-card]').first()).toBeVisible();
  const caseNames = await caseDialog.locator('[data-slot-picker-card]').allTextContents();
  expect(caseNames.every((name) => name.includes('青の古城探索事件'))).toBe(true);
  await caseDialog.getByRole('button', { name: '青', exact: true }).click();
  const caseColors = await caseDialog.locator('[data-slot-picker-card]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-card-colors') ?? ''),
  );
  expect(caseColors.every((colors) => colors.split(',').includes('blue'))).toBe(true);
});

test('DECK刷新: カード一覧を収録弾で絞り込める', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'フィルタを開く' }).click();
  const dialog = page.getByRole('dialog', { name: 'フィルタ' });
  await dialog.getByRole('button').filter({ hasText: /^CT-P10/ }).click();
  await dialog.getByRole('button', { name: 'フィルタを閉じる' }).click();

  const nums = await page.locator('[data-testid^="deck-pool-card-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid')?.replace('deck-pool-card-', '') ?? ''),
  );
  expect(nums.length).toBeGreaterThan(0);
  expect(nums.every((num) => num.startsWith('B10'))).toBe(true);
});

test('DECK刷新: 851x393でもデッキとプールを横並びに保ち、詳細操作は44px以上', async ({ page }) => {
  const viewport = { width: 851, height: 393 };
  await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', viewport);
  await expect(page.locator('.deck-main-pane')).toHaveCSS('scrollbar-width', 'thin');

  const geometry = await page.evaluate(() => {
    const rect = (id: string) => {
      const box = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      root: rect('deck-editor'),
      workspace: rect('deck-workspace'),
      deck: rect('deck-dropzone'),
      pool: rect('deck-pool'),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(geometry.overflowX).toBe(0);
  expect(geometry.deck.right).toBeLessThanOrEqual(geometry.pool.left);
  expect(geometry.deck.width).toBeGreaterThan(500);
  expect(geometry.pool.width).toBeGreaterThanOrEqual(225);
  expect(geometry.pool.width).toBeLessThanOrEqual(255);
  expect(geometry.workspace.bottom).toBeLessThanOrEqual(393);

  const compactControls = [
    page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('button', { name: 'デッキ' }),
    page.getByLabel('カードを検索'),
    page.getByRole('button', { name: 'フィルタを開く' }),
    ...await page.locator('.deck-pool-sort-button').all(),
  ];
  for (const control of compactControls) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(24);
  }

  const compactFontSizes = await page.evaluate(() => ({
    search: Number.parseFloat(getComputedStyle(document.querySelector<HTMLInputElement>('.deck-search-box input')!).fontSize),
    sorts: [...document.querySelectorAll<HTMLElement>('.deck-pool-sort-button')]
      .map((button) => Number.parseFloat(getComputedStyle(button).fontSize)),
  }));
  expect(compactFontSizes.search).toBeGreaterThanOrEqual(10);
  expect(compactFontSizes.sorts.every((size) => size >= 10)).toBe(true);

  await page.getByLabel('デッキ名').fill('少年探偵団・標準 改');
  await expect(page.getByRole('button', { name: '保存（未保存の変更あり）' })).toBeVisible();

  const poolCard = await revealPoolCard(page, 'D08023');
  await poolCard.click();
  const detail = page.getByRole('dialog', { name: 'カード詳細: 毛利蘭', exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('deck-detail-effect')).toBeInViewport();
  const scrollBox = await detail.locator('.deck-detail-scroll').boundingBox();
  const actionBox = await detail.getByTestId('deck-detail-actions').boundingBox();
  expect((scrollBox?.y ?? 0) + (scrollBox?.height ?? 0)).toBeLessThanOrEqual(actionBox?.y ?? 0);
  for (const control of [
    detail.getByRole('button', { name: 'カード詳細を閉じる', exact: true }),
    detail.getByRole('button', { name: '1枚追加: 毛利蘭をデッキに追加', exact: true }),
    detail.getByRole('button', { name: '毛利蘭をデッキから1枚除く', exact: true }),
  ]) {
    await expectFullyVisibleHitTarget(control, viewport);
  }
});

test('DECK exact SE3 landscape keeps D08023 detail scrollable with pinned named actions', async ({ page }) => {
  const viewport = { width: 667, height: 375 };
  await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', viewport);

  const count = page.getByTestId('deck-count-D08023');
  await expect(count).toHaveAttribute('data-count', '2');
  const poolCard = await revealPoolCard(page, 'D08023');
  await poolCard.click();

  const detail = page.getByRole('dialog', { name: 'カード詳細: 毛利蘭', exact: true });
  const scroll = detail.locator('.deck-detail-scroll');
  const footer = detail.getByTestId('deck-detail-actions');
  const close = detail.getByRole('button', { name: 'カード詳細を閉じる', exact: true });
  const add = detail.getByRole('button', { name: '1枚追加: 毛利蘭をデッキに追加', exact: true });
  const remove = detail.getByRole('button', { name: '毛利蘭をデッキから1枚除く', exact: true });

  await expect(detail).toBeVisible();
  await expect(scroll).toHaveCSS('overflow-y', 'auto');
  const before = await page.evaluate(() => {
    const drawer = document.querySelector<HTMLElement>('.deck-detail-drawer')!.getBoundingClientRect();
    const content = document.querySelector<HTMLElement>('.deck-detail-scroll')!;
    const contentBox = content.getBoundingClientRect();
    const actions = document.querySelector<HTMLElement>('[data-testid="deck-detail-actions"]')!.getBoundingClientRect();
    return {
      drawerBottom: drawer.bottom,
      contentBottom: contentBox.bottom,
      contentClientHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      footerTop: actions.top,
      footerBottom: actions.bottom,
    };
  });
  expect(before.contentScrollHeight).toBeGreaterThan(before.contentClientHeight);
  expect(before.contentBottom).toBeLessThanOrEqual(before.footerTop + 0.5);
  expect(before.footerBottom).toBeLessThanOrEqual(before.drawerBottom + 0.5);
  expect(before.footerBottom).toBeLessThanOrEqual(viewport.height);

  for (const control of [close, add, remove]) {
    await expectFullyVisibleHitTarget(control, viewport);
  }

  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const pinnedFooterTop = await footer.evaluate((element) => element.getBoundingClientRect().top);
  expect(pinnedFooterTop).toBeCloseTo(before.footerTop, 2);

  await remove.click();
  await expect(count).toHaveAttribute('data-count', '1');
  await add.click();
  await expect(count).toHaveAttribute('data-count', '2');
  await close.click();
  await expect(detail).toHaveCount(0);
});

test('DECK iPhone landscapes keep catalog controls reachable without page overflow', async ({ page }) => {
  for (const viewport of [{ width: 667, height: 375 }, { width: 851, height: 393 }]) {
    await gotoReadyLandscapeRoute(page, 'deck', '[data-testid="deck-editor"]', viewport);

    const geometry = await page.evaluate(() => ({
    header: document.querySelector<HTMLElement>('.home-header')!.getBoundingClientRect().height,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    workspaceBottom: document.querySelector<HTMLElement>('[data-testid="deck-workspace"]')!.getBoundingClientRect().bottom,
    controls: [...document.querySelectorAll<HTMLElement>('.home-brand, .home-navigation button, .deck-search-box, .deck-pool-sort-button')]
      .map((control) => {
        const box = control.getBoundingClientRect();
        return { width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      }),
    }));
    expect(geometry.header).toBe(54);
    expect(geometry.overflowX).toBe(0);
    expect(geometry.workspaceBottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.controls.length).toBeGreaterThan(10);
    expect(geometry.controls.every((control) => control.width >= 44 && control.height >= 44 && control.right <= viewport.width && control.bottom <= viewport.height)).toBe(true);
  }
});

test('DECK: 検証 OK + 同 ID 上限到達カードが MAX 表示 (console error 0)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#deck');

  // サンプルデッキ (40 枚・パートナー1・事件1) は検証 OK
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  // 一覧見出しに冗長な 40 / 40 カウントを出さない
  await expect(page.getByText(/^DECK\s*·\s*\d+\s*\/\s*40$/)).toHaveCount(0);
  // 同 ID が 3 枚に達したカードは MAX 表示 (パラレルを合算してグレーアウト)
  await expect(page.getByText('MAX 3').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('DECK: プールカード選択 → 詳細で「同 ID 上限」が確認できる (クリック→状態反映)', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 灰原哀 (D08005, id 0490) はサンプルデッキで 3 枚 → プールタイルは "灰原哀 3/3"
  await page.getByLabel('灰原哀 3/3').first().click();
  // 詳細パネルに同 ID 上限の注記が出る (＋ ボタンは無効)
  await expect(page.getByText('同 ID 上限')).toBeVisible();
});

test('DECK: パラレル合算の同ID上限が UI で機能する (追加→兄弟絵柄もMAX→4枚目ブロック)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 毛利蘭 D08023×2 の採用は cardId 0096 全体で 2/3。
  // 仮想化されたプールでは、対象と兄弟印刷を番号検索で個別に表示して確認する。
  const d08023 = await revealPoolCard(page, 'D08023');
  await expect(d08023).toHaveAttribute('aria-label', /^毛利蘭 2\/3。/);
  await page.screenshot({ path: '.tmp/verify-id-before.png', fullPage: false });

  // D08023 を選択 → 詳細パネルに "2 / 3" + ＋ 有効
  await d08023.click();
  await expect(page.getByText('2 / 3')).toBeVisible();
  // 詳細の ＋ で +1 → D08023 自身が 3/3 + MAX 表示
  await page.getByRole('button', { name: '1枚追加' }).press('Enter');
  await expect(d08023).toHaveAttribute('aria-label', /^毛利蘭 3\/3。/);
  await expect(page.getByText('MAX 3').first()).toBeVisible();
  await page.locator('.deck-detail-header button').click();
  const feedback = page.getByTestId('deck-feedback');
  if (await feedback.isVisible()) await feedback.locator('button').click();

  // 兄弟絵柄 D01007 (別 cardNum・同 cardId) も 3/3。
  // 詳細では「同 ID 上限」+ ＋ 無効で追加がブロックされる。
  const d01007 = await revealPoolCard(page, 'D01007');
  await expect(d01007).toHaveAttribute('aria-label', /^毛利蘭 3\/3。/);
  await d01007.click();
  await expect(page.getByText('同 ID 上限')).toBeVisible();
  await expect(page.getByRole('button', { name: '1枚追加' })).toBeDisabled();
  await page.screenshot({ path: '.tmp/verify-id-after.png', fullPage: false });

  // 4/3 にはならない (兄弟絵柄・別印刷でも共通上限)。
  await expect(d01007).not.toHaveAttribute('aria-label', /^毛利蘭 4\/3。/);

  expect(errors).toEqual([]);
});

test('DECK migration: v1 サンプルデッキの事件混入が v2 で自動修復される (BUG-126 / review HIGH)', async ({ page }) => {
  await page.goto('/');
  // v1 (version:1) 形式の永続データを仕込む: sample-d11 に違法な事件カード D11021 が混入
  await page.evaluate(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 1,
      state: {
        decks: [
          { id: 'sample-d08', name: '少年探偵団・標準', partner: 'D08001', modified: 0, cards: [{ num: 'D08005', count: 3 }] },
          { id: 'sample-d11', name: '警察・標準', partner: 'D11001', modified: 0, cards: [{ num: 'D11021', count: 3 }] },
        ],
      },
    }));
  });
  await page.goto('/#deck');
  await expect(page.getByText(/検証 OK|検証エラー/).first()).toBeVisible({ timeout: 6000 });
  // 警察・標準 (sample-d11) に切替 → migrate で正データに修復され、事件混入エラーが出ない
  await page.getByRole('button', { name: 'デッキを変更' }).click();
  const deckDialog = page.getByRole('dialog', { name: '編集するデッキを選択' });
  await deckDialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await deckDialog.getByRole('button', { name: 'このデッキを編集' }).click();
  await expect(page.getByText('検証 OK')).toBeVisible();
  await expect(page.getByText('デッキに事件は入れられません')).toHaveCount(0);
});

test('DECK: デッキコードのエクスポートが表示される', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'コード' }).click();
  await expect(page.getByText('デッキコード · 入出力')).toBeVisible();
  // エクスポート用 textarea に CONAN1: コードが入っている
  const ta = page.locator('textarea').first();
  await expect(ta).toHaveValue(/^CONAN1:/);
});

test('DECK: 右クリックでデッキとプールのカードを拡大表示できる', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 先頭はデッキ内、末尾はプール内の同一カード。
  const conan = page.getByLabel('江戸川コナン 2/3');
  await conan.first().click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  await conan.last().click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('DECK: 混色カードの詳細に全色を表示する', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 3,
      state: {
        decks: [{
          id: 'color-test', name: '色表示テスト', partner: 'D08001', case: 'D08026', modified: 0,
          cards: [{ num: 'B10097', count: 1 }],
        }],
      },
    }));
  });
  await page.goto('/#deck');
  await page.getByRole('button', { name: '毛利蘭＆ベルモット 1/3' }).first().click();
  await expect(page.locator('[data-card-colors="blue,black"]')).toBeVisible();
  await expect(page.locator('[data-card-colors="blue,black"]')).toHaveText('BLUEBLACK');
});

test('DECK: パートナー・事件は左クリックで詳細、右クリックで拡大表示できる', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  const partnerSlot = page.getByRole('button', { name: /パートナー/ }).first();
  await partnerSlot.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  const caseSlot = page.getByRole('button', { name: /事件/ }).first();
  await caseSlot.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 青の古城探索事件' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  await partnerSlot.click();
  const partnerDetail = page.getByRole('dialog', { name: 'カード詳細: 江戸川コナン' });
  await expect(partnerDetail).toBeVisible();
  await partnerDetail.getByRole('button', { name: 'カードを変更' }).click();
  await expect(page.getByRole('dialog', { name: 'パートナーを選択' })).toBeVisible();
  const partnerCandidate = page.locator('[role="button"][aria-label="江戸川コナン"]').last();
  await partnerCandidate.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
});

test('DECK: 枚数上限なしのカードは 4 枚以上でも追加でき、∞ 表示になる', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 2,
      state: {
        decks: [{
          id: 'unlimited-test', name: '上限なしテスト', partner: 'D08001', case: 'D08026',
          cards: [{ num: 'PR158', count: 4 }], modified: 0,
        }],
      },
    }));
  });

  await page.goto('/#deck');
  const unlimited = page.getByLabel('犯人 4/∞');
  await expect(unlimited.first()).toBeVisible({ timeout: 6000 });
  await unlimited.first().click();
  await expect(page.getByText('4 / ∞')).toBeVisible();
  await expect(page.getByRole('button', { name: '1枚追加' })).toBeEnabled();
  await page.getByRole('button', { name: '1枚追加' }).press('Enter');
  await expect(page.getByLabel('犯人 5/∞').first()).toBeVisible();
});

test('DECK migration: v2 の標準2デッキだけを最新構成へ更新し、ユーザーデッキを保持する', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 2,
      state: {
        decks: [
          {
            id: 'sample-d08', name: '少年探偵団・標準', partner: 'D08001', case: 'D08026', modified: 1,
            cards: [{ num: 'D11019', count: 3 }],
          },
          {
            id: 'sample-d11', name: '警察・標準', partner: 'D11001', case: 'D11021', modified: 1,
            cards: [{ num: 'D08007', count: 3 }],
          },
          {
            id: 'user-deck', name: 'ユーザーデッキ', partner: 'PR220', case: 'B06043', modified: 1,
            cards: [{ num: 'B04026', count: 3 }],
          },
        ],
      },
    }));
  });

  await page.goto('/#deck');
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('conan.meta.v1.decks');
    return raw ? JSON.parse(raw) : null;
  });

  expect(persisted.version).toBe(4);
  const decks = persisted.state.decks as Array<{
    id: string;
    name: string;
    partner: string;
    case: string;
    modified: number;
    cards: Array<{ num: string; count: number }>;
  }>;
  const d08 = decks.find((deck) => deck.id === 'sample-d08');
  const d11 = decks.find((deck) => deck.id === 'sample-d11');
  const user = decks.find((deck) => deck.id === 'user-deck');
  expect(d08?.cards.reduce((sum, card) => sum + card.count, 0)).toBe(40);
  expect(d08?.cards.every((card) => card.num.startsWith('D08'))).toBe(true);
  expect(d11?.cards.reduce((sum, card) => sum + card.count, 0)).toBe(40);
  expect(d11?.cards.every((card) => card.num.startsWith('D11'))).toBe(true);
  expect(user).toEqual({
    id: 'user-deck', name: 'ユーザーデッキ', partner: 'PR220', case: 'B06043', modified: 1,
    cards: [{ num: 'B04026', count: 3 }],
  });
});
