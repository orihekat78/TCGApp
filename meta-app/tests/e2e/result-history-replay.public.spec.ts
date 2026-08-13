import { expect, test, type Page } from '@playwright/test';
import { expectReadyMetaRoute, gotoReadyMetaRoute } from './landscape-test-helpers';

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error'
      || (message.type() === 'warning' && /replay.*finaliz/i.test(message.text()))
    ) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function waitForNaturalResultWhileSkippingPresentation(page: Page): Promise<void> {
  const deadline = Date.now() + 80_000;
  const skipButton = page.locator('.presentation-causal-controls').getByRole('button', { name: 'スキップ' });

  while (!page.url().endsWith('#result') && Date.now() < deadline) {
    if (await skipButton.isVisible().catch(() => false)) {
      // The terminal route may unmount the button during Playwright's actionability
      // check. Continue the loop and let the URL assertion decide completion.
      await skipButton.click({ timeout: 1_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(100);
  }

  await expect(page).toHaveURL(/#result$/, { timeout: 5_000 });
  await expectReadyMetaRoute(page, '.result-panel');
}

test('public UI: HOME to spectator result, saved history decks, and replay', async ({ page }) => {
  test.setTimeout(100_000);
  const errors = collectConsoleErrors(page);

  await gotoReadyMetaRoute(page, 'home', '[data-route="home"]');
  await page.locator('[data-route="setup"]').click();
  await expect(page).toHaveURL(/#setup$/);
  await expectReadyMetaRoute(page, '.setup-main');

  await page.locator('[data-route="settings"]').click();
  await expect(page).toHaveURL(/#settings$/);
  await expectReadyMetaRoute(page, '.settings-save');
  const presentationSpeed = page.getByRole('group', { name: '演出速度' });
  await presentationSpeed.getByRole('button', { name: '速い' }).click();
  const spectatorSpeed = page.getByRole('group', { name: '観戦時のCPU速度' });
  await spectatorSpeed.getByRole('button', { name: '速い' }).click();
  await page.getByRole('button', { name: '設定を保存', exact: true }).click();

  await page.locator('[data-route="setup"]').click();
  await expect(page).toHaveURL(/#setup$/);
  await expectReadyMetaRoute(page, '.setup-main');
  await page.getByLabel('プレイモード').selectOption('observe');
  await page.getByRole('button', { name: '対戦を開始' }).click();
  await expect(page).toHaveURL(/#match$/);

  await waitForNaturalResultWhileSkippingPresentation(page);
  await expect(page.locator('.result-panel')).toBeVisible();
  await expect(page.locator('.result-replay')).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('#result-replay-note'))
    .toHaveText('この対戦の完全なリプレイを再生できます。');

  await page.locator('[data-route="history"]').click();
  await expect(page).toHaveURL(/#history$/);
  await expectReadyMetaRoute(page, '.history-toolbar');
  const deckButton = page.locator('.history-deck-open-button').first();
  await expect(deckButton).toBeVisible({ timeout: 10_000 });
  await deckButton.click();
  const deckDialog = page.getByRole('dialog', { name: '対戦デッキ' });
  await expect(deckDialog).toBeVisible();
  await expect(deckDialog.getByRole('tab', { name: 'CPU 1のデッキ' })).toHaveAttribute('aria-selected', 'true');
  const selfPanel = deckDialog.locator('#history-self-deck-panel');
  await expect(selfPanel).toBeVisible();
  await expect(selfPanel.getByTestId('history-deck-slots')).toBeVisible();
  expect(await selfPanel.getByTestId('history-deck-card-grid').locator('.history-deck-card').count()).toBeGreaterThan(0);
  const selfSnapshot = await selfPanel
    .locator('.history-deck-panel-header h3, .history-deck-slot, .history-deck-card-id')
    .allTextContents();
  await deckDialog.getByRole('tab', { name: 'CPU 2のデッキ' }).click();
  await expect(deckDialog.getByRole('tab', { name: 'CPU 2のデッキ' })).toHaveAttribute('aria-selected', 'true');
  const oppPanel = deckDialog.locator('#history-opp-deck-panel');
  await expect(oppPanel).toBeVisible();
  await expect(oppPanel.getByTestId('history-deck-slots')).toBeVisible();
  expect(await oppPanel.getByTestId('history-deck-card-grid').locator('.history-deck-card').count()).toBeGreaterThan(0);
  const oppSnapshot = await oppPanel
    .locator('.history-deck-panel-header h3, .history-deck-slot, .history-deck-card-id')
    .allTextContents();
  expect(oppSnapshot).not.toEqual(selfSnapshot);
  await deckDialog.getByRole('button', { name: '対戦デッキを閉じる' }).click();

  const replayButton = page.locator('.history-replay-button').first();
  await expect(replayButton).toBeEnabled({ timeout: 10_000 });
  await replayButton.click();
  await expect(page).toHaveURL(/#replay\//);
  await expect(page.locator('#replay-title')).toBeVisible();
  await expect(page.locator('.replay-control-rail')).toBeVisible({ timeout: 15_000 });
  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});
