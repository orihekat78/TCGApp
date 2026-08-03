import { expect, test, type Page } from '@playwright/test';

const NAV_ORDER = ['ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定'];

async function assertSetupFits(page: Page, width: number, height: number) {
  const geometry = await page.evaluate(() => {
    const screen = document.querySelector('.setup-screen')!;
    const stage = document.querySelector('.setup-stage')!;
    const actions = document.querySelector('.setup-actions')!;
    const panels = Array.from(document.querySelectorAll('.setup-player-panel'));
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      documentWidth: document.documentElement.scrollWidth,
      screenWidth: screen.scrollWidth,
      screenClientWidth: screen.clientWidth,
      stage: rect(stage),
      actions: rect(actions),
      panels: panels.map(rect),
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(width);
  expect(geometry.screenWidth).toBeLessThanOrEqual(geometry.screenClientWidth);
  expect(geometry.stage.left).toBeGreaterThanOrEqual(0);
  expect(geometry.stage.right).toBeLessThanOrEqual(width);
  expect(geometry.actions.bottom).toBeLessThanOrEqual(height);
  expect(geometry.panels).toHaveLength(2);
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
    await expect(page.getByRole('button', { name: '使用デッキを変更（あなた）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '使用デッキを変更（CPU）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '対戦を開始' })).toBeVisible();
    await assertSetupFits(page, viewport.width, viewport.height);
    if (viewport.width === 851) {
      const compact = await page.evaluate(() => ({
        controls: Array.from(document.querySelectorAll<HTMLElement>(
          '.setup-change-deck, .setup-control-group button, .setup-deck-tools button, .setup-actions button',
        )).map((control) => control.getBoundingClientRect().height),
        portraitIncident: (() => {
          const image = document.querySelector<HTMLImageElement>('.setup-player-panel--opp .setup-incident-art img')!;
          const box = image.getBoundingClientRect();
          return { width: box.width, height: box.height };
        })(),
      }));
      expect(Math.min(...compact.controls)).toBeGreaterThanOrEqual(43.5);
      expect(compact.portraitIncident.width).toBeGreaterThanOrEqual(40);
      expect(compact.portraitIncident.height).toBeGreaterThanOrEqual(80);
    }
  }
});

test('SETUP deck picker updates only the requested side and restores focus after Escape', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/#setup');
  const self = page.locator('.setup-player-panel--self');
  const opp = page.locator('.setup-player-panel--opp');
  const selfTrigger = page.getByRole('button', { name: '使用デッキを変更（あなた）' });
  await selfTrigger.click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await page.keyboard.press('Escape');
  await expect(selfTrigger).toBeFocused();
  await expect(self).toHaveAttribute('data-deck-id', 'sample-d08');

  await selfTrigger.click();
  await dialog.locator('.home-deck-choice').filter({ hasText: '警察・標準' }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await expect(self).toHaveAttribute('data-deck-id', 'sample-d11');
  await expect(opp).toHaveAttribute('data-deck-id', 'sample-d11');
});

test('SETUP functional controls expose their selected state without fake difficulty interaction', async ({ page }) => {
  await page.goto('/#setup');
  const observe = page.getByRole('button', { name: '観戦', exact: true });
  await observe.click();
  await expect(observe).toHaveAttribute('aria-pressed', 'true');
  const selfFirst = page.getByRole('button', { name: 'あなた', exact: true });
  await selfFirst.click();
  await expect(selfFirst).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('CPU難易度 ノーマル 固定')).toBeVisible();
  await expect(page.getByRole('button', { name: /ノーマル/ })).toHaveCount(0);
});
