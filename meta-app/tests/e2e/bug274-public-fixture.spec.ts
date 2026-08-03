import { test, expect } from '@playwright/test';

test('BUG-274: public fixture exposes multiple partner abilities and Escape cancels the choice', async ({ page }) => {
  await page.goto('/#setup');
  await page.getByRole('button', { name: '使用デッキを変更（あなた）' }).click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await dialog.locator('.home-deck-choice').filter({ hasText: 'BUG-274' }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await page.getByRole('button', { name: 'あなた', exact: true }).click();
  await page.locator('.meta-btn-ready').click();
  await page.waitForURL(/#match/);
  await page.locator('button.mulligan-skip').click();
  await expect(page.locator('button.mulligan-skip')).not.toBeVisible();

  await page.locator('[data-action-id="partner-ability"]').click();
  await expect(page.getByText('検証専用能力 A（実行しない）')).toBeVisible();
  await expect(page.getByText('検証専用能力 B（実行しない）')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('検証専用能力 A（実行しない）')).not.toBeVisible();
});
