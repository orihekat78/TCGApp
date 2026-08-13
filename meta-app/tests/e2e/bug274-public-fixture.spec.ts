import { test, expect } from '@playwright/test';
import { BUG_274_PUBLIC_DECK } from '../../src/data/bug274ValidationDeck';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../src/data/sampleDeck';
import { gotoReadyLandscapeRoute } from './landscape-test-helpers';

test('BUG-274: public fixture exposes multiple partner abilities and Escape cancels the choice', async ({ page }) => {
  await gotoReadyLandscapeRoute(page, 'setup', '.setup-main', { width: 1280, height: 800 });
  await page.getByRole('button', { name: '使用デッキを変更（PLAYER）' }).click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await dialog.locator('.home-deck-choice').filter({ hasText: 'BUG-274' }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await page.locator('.meta-btn-ready').click();
  await page.waitForURL(/#match/);
  const mulligan = page.locator('button.mulligan-skip');
  await expect(mulligan).toBeVisible({ timeout: 10_000 });
  await mulligan.click();
  await expect(mulligan).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('[data-action-id="partner-ability"]')).toBeVisible();

  await page.locator('[data-action-id="partner-ability"]').click();
  await expect(page.getByText('検証専用能力 A（実行しない）')).toBeVisible();
  await expect(page.getByText('検証専用能力 B（実行しない）')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('検証専用能力 A（実行しない）')).not.toBeVisible();
});

test('BUG-274: a persisted fixture-ID collision is quarantined and cannot shadow route authority', async ({ page }) => {
  const forged = { ...BUG_274_PUBLIC_DECK, name: 'forged persisted BUG-274 deck' };
  await page.addInitScript((decks) => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 4,
      state: { decks, activeDeckId: 'test-bug-274-public' },
    }));
  }, [SAMPLE_DECK, SAMPLE_DECK_OPP, forged]);
  await gotoReadyLandscapeRoute(page, 'setup', '.setup-main', { width: 1280, height: 800 });

  await page.getByRole('button', { name: '使用デッキを変更（PLAYER）' }).click();
  const dialog = page.getByRole('dialog', { name: '使用デッキを選択' });
  await expect(dialog.getByText('forged persisted BUG-274 deck')).toHaveCount(0);
  await dialog.locator('.home-deck-choice').filter({ hasText: 'BUG-274' }).click();
  await dialog.getByRole('button', { name: 'このデッキを使用' }).click();
  await page.locator('.meta-btn-ready').click();
  await expect(page).toHaveURL(/#match/);
});
