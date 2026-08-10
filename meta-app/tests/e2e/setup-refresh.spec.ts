import { expect, test, type Page } from '@playwright/test';

const NAV_ORDER = ['ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定'];

async function assertSetupFits(page: Page, width: number, height: number) {
  const geometry = await page.evaluate(() => {
    const screen = document.querySelector('.setup-screen')!;
    const stage = document.querySelector('.setup-stage')!;
    const start = document.querySelector('.setup-controls > .setup-start')!;
    const panels = Array.from(document.querySelectorAll('.setup-player-panel'));
    const controls = Array.from(document.querySelectorAll('.setup-select-control'));
    const icons = Array.from(document.querySelectorAll<SVGElement>('.setup-control-icon'));
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      documentWidth: document.documentElement.scrollWidth,
      screenWidth: screen.scrollWidth,
      screenClientWidth: screen.clientWidth,
      stage: rect(stage),
      start: rect(start),
      lastControl: rect(controls.at(-1)!),
      iconData: icons.map((icon) => icon.dataset.icon),
      iconSizes: icons.map((icon) => {
        const box = icon.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
      panels: panels.map(rect),
      copyBelowArt: panels.map((panel) => {
        const art = panel.querySelector('.setup-partner-art')!.getBoundingClientRect();
        const copy = panel.querySelector('.setup-player-copy')!.getBoundingClientRect();
        return art.bottom <= copy.top + 1;
      }),
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(width);
  expect(geometry.screenWidth).toBeLessThanOrEqual(geometry.screenClientWidth);
  expect(geometry.stage.left).toBeGreaterThanOrEqual(0);
  expect(geometry.stage.right).toBeLessThanOrEqual(width);
  expect(geometry.start.bottom).toBeLessThanOrEqual(height);
  expect(geometry.start.top).toBeGreaterThanOrEqual(geometry.lastControl.bottom);
  expect(geometry.iconData).toEqual(['mode', 'first', 'cpu']);
  for (const icon of geometry.iconSizes) {
    expect(icon.width).toBeGreaterThanOrEqual(18);
    expect(icon.width).toBeLessThanOrEqual(26);
    expect(Math.abs(icon.height - icon.width)).toBeLessThan(0.1);
  }
  expect(geometry.panels).toHaveLength(2);
  expect(geometry.copyBelowArt).toEqual([true, true]);
  for (const panel of geometry.panels) {
    expect(panel.left).toBeGreaterThanOrEqual(0);
    expect(panel.right).toBeLessThanOrEqual(width);
    expect(panel.bottom).toBeLessThanOrEqual(height);
  }
}

test('SETUP shares HOME navigation and keeps the full versus stage usable at both target sizes', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 851, height: 393 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#setup');
    const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
    await expect(nav.getByRole('button')).toHaveText(NAV_ORDER);
    await expect(nav.getByRole('button', { name: 'ゲーム開始' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.setup-player-panel')).toHaveCount(2);
    await expect(page.locator('.setup-incident-art')).toHaveCount(0);
    await expect(page.locator('.setup-player-card-name', { hasText: 'PARTNER' })).toHaveCount(2);
    await expect(page.locator('.setup-player-card-name', { hasText: 'CASE' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: '使用デッキを変更（PLAYER）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '使用デッキを変更（CPU）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '対戦を開始' })).toBeVisible();
    await expect(page.getByRole('button', { name: '戻る' })).toHaveCount(0);
    await expect(page.locator('.setup-controls > .setup-start')).toHaveCount(1);
    const iconAttributes = await page.locator('.setup-control-icon').evaluateAll((icons) => icons.map((icon) => ({
      hidden: icon.getAttribute('aria-hidden'),
      name: (icon as SVGElement).dataset.icon,
    })));
    expect(iconAttributes).toEqual([
      { hidden: 'true', name: 'mode' },
      { hidden: 'true', name: 'first' },
      { hidden: 'true', name: 'cpu' },
    ]);
    await assertSetupFits(page, viewport.width, viewport.height);
    if (viewport.width === 851) {
      const compact = await page.evaluate(() => ({
        controls: Array.from(document.querySelectorAll<HTMLElement>(
          '.setup-change-deck, .setup-select-control select, .setup-start',
        )).map((control) => control.getBoundingClientRect().height),
        cardNameSizes: Array.from(document.querySelectorAll<HTMLElement>('.setup-player-card-name'))
          .map((name) => Number.parseFloat(getComputedStyle(name).fontSize)),
        cardRoleSizes: Array.from(document.querySelectorAll<HTMLElement>('.setup-player-card-name small'))
          .map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      }));
      expect(Math.min(...compact.controls)).toBeGreaterThanOrEqual(43.5);
      expect(Math.min(...compact.cardNameSizes)).toBeGreaterThanOrEqual(9);
      expect(Math.min(...compact.cardRoleSizes)).toBeGreaterThanOrEqual(8);
    }
  }
});

test('SETUP deck picker updates only the requested side and restores focus after Escape', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#setup');
  const self = page.locator('.setup-player-panel--self');
  const opp = page.locator('.setup-player-panel--opp');
  const selfTrigger = page.getByRole('button', { name: '使用デッキを変更（PLAYER）' });
  await selfTrigger.click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await page.keyboard.press('Escape');
  await expect(selfTrigger).toBeFocused();
  await expect(self).toHaveAttribute('data-deck-id', 'sample-d08');

  await selfTrigger.click();
  await dialog.locator('.home-deck-choice').filter({ hasText: 'BUG-274' }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await expect(self).toHaveAttribute('data-deck-id', 'test-bug-274-public');
  await expect(opp).toHaveAttribute('data-deck-id', 'sample-d11');
});

test('SETUP uses three compact selects and omits the removed auxiliary controls', async ({ page }) => {
  await page.goto('/#setup');
  await expect(page.locator('.setup-player-panel--self h2')).toHaveText('PLAYER');
  await page.getByLabel('プレイモード').selectOption('observe');
  await expect(page.getByLabel('プレイモード')).toHaveValue('observe');
  await expect(page.locator('.setup-player-panel--self h2')).toHaveText('CPU 1');
  await expect(page.locator('.setup-player-panel--opp h2')).toHaveText('CPU 2');
  await expect(page.getByRole('button', { name: '使用デッキを変更（CPU 1）' })).toBeVisible();
  await expect(page.getByRole('button', { name: '使用デッキを変更（CPU 2）' })).toBeVisible();
  await expect(page.getByLabel('先攻').locator('option')).toHaveText(['ランダム', 'CPU 1', 'CPU 2']);
  await page.getByLabel('先攻').selectOption('p1');
  await expect(page.getByLabel('先攻')).toHaveValue('p1');
  await expect(page.getByLabel('CPU難易度')).toBeDisabled();
  await expect(page.getByText('ゲームセッティング')).toHaveCount(0);
  await expect(page.getByText('VS', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'デッキを入れ替え' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ランダムに選択' })).toHaveCount(0);
});

test('SETUP keyboard order finishes after both deck choices and enabled settings', async ({ page }) => {
  await page.goto('/#setup');
  const selfDeck = page.getByRole('button', { name: '使用デッキを変更（PLAYER）' });
  const oppDeck = page.getByRole('button', { name: '使用デッキを変更（CPU）' });
  await selfDeck.focus();
  await page.keyboard.press('Tab');
  await expect(oppDeck).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('プレイモード')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('先攻')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '対戦を開始' })).toBeFocused();
});
