import { test, expect } from '@playwright/test';

test('BUG-274: public fixture exposes multiple partner abilities and Escape cancels the choice', async ({ page }) => {
  await page.goto('/#setup');
  const decks = page.locator('select');
  await decks.nth(0).selectOption('test-bug-274-public');
  await page.getByRole('button', { name: 'P1', exact: true }).click();
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
