import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 851, height: 393 },
  { width: 667, height: 375 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`public surrender flow is modal-safe at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      (globalThis as typeof globalThis & { __surrenderResultRoutes?: number }).__surrenderResultRoutes = 0;
      window.addEventListener('hashchange', () => {
        if (window.location.hash === '#result') {
          const tracked = globalThis as typeof globalThis & { __surrenderResultRoutes?: number };
          tracked.__surrenderResultRoutes = (tracked.__surrenderResultRoutes ?? 0) + 1;
        }
      });
    });

    await page.goto('/#home');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#setup$/);

    const playerDeckTrigger = page.getByRole('button', { name: '使用デッキを変更（PLAYER）' });
    await expect(playerDeckTrigger).toBeVisible({ timeout: 10_000 });
    await playerDeckTrigger.click({ noWaitAfter: true });
    const deckDialog = page.locator('.home-deck-dialog');
    await expect(deckDialog).toBeVisible();
    await deckDialog.locator('.home-deck-choice').filter({ hasText: 'BUG-274' }).click();
    await deckDialog.locator('.home-deck-dialog-confirm').click();
    await page.locator('.meta-btn-ready').click();
    await expect(page).toHaveURL(/#match$/);

    const mulliganSkip = page.locator('button.mulligan-skip');
    await expect(mulliganSkip).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('match-menu-trigger')).toHaveCount(0);
    await mulliganSkip.click();
    await expect(mulliganSkip).not.toBeVisible({ timeout: 10_000 });

    await page.locator('[data-action-id="partner-ability"]').click();
    const decision = page.getByTestId('choice-picker-modal');
    await expect(decision).toBeVisible();
    const decisionOption = decision.getByTestId('cp-opt-0');
    await expect(decisionOption).toBeEnabled();

    const trigger = page.getByTestId('match-menu-trigger');
    await expect(trigger).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();

    const menu = page.getByTestId('match-menu-dialog');
    await expect(menu).toBeVisible();
    await expect(decision).toHaveAttribute('data-match-modal-registered', 'true');
    await expect(decision).toHaveAttribute('aria-hidden', 'true');
    await expect(decision).toHaveAttribute('aria-modal', 'false');
    await expect(decision).toHaveAttribute('inert', '');
    await expect(decisionOption).not.toBeFocused();
    await expect(decisionOption.click({ timeout: 300 })).rejects.toThrow();
    await expect(decision).toBeVisible();
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);

    if (viewport.width === 851) {
      await page.setViewportSize({ width: 393, height: 851 });
      const gateCta = page.getByTestId('landscape-gate-cta');
      await expect(page.getByTestId('match-menu-dialog')).toHaveCount(0);
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);
      await expect(gateCta).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(gateCta).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(gateCta).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(gateCta).toBeFocused();
      await expect(decision).toBeHidden();
      await page.setViewportSize(viewport);
      await expect(page.getByTestId('match-menu-trigger')).toBeVisible();
      await expect(decision).toBeVisible();
      await expect(decisionOption).toBeEnabled();
      await expect(page.locator('.result-screen')).toHaveCount(0);
      await page.getByTestId('match-menu-trigger').click();
      await expect(page.getByTestId('match-menu-dialog')).toBeVisible();
    }
    await testInfo.attach('match-menu', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    if (process.env.MATCH_SURRENDER_EVIDENCE_DIR) {
      await page.screenshot({
        path: `${process.env.MATCH_SURRENDER_EVIDENCE_DIR}/${viewport.width}x${viewport.height}-menu.png`,
      });
    }

    await page.getByTestId('match-menu-surrender').click();
    const confirm = page.getByTestId('match-menu-confirm-submit');
    await expect(page.getByTestId('match-menu-confirm-cancel')).toBeFocused();
    await confirm.dblclick();

    await expect(page).toHaveURL(/#result$/, { timeout: 10_000 });
    await expect(page.locator('.result-screen.is-loss')).toBeVisible();
    await expect(page.locator('.result-verdict h1')).toHaveText('敗北');
    await expect(page.locator('.result-end-reason strong')).toHaveText('投了');
    await expect(decision).toHaveCount(0);
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => (
      globalThis as typeof globalThis & { __surrenderResultRoutes?: number }
    ).__surrenderResultRoutes)).toBe(1);
    await testInfo.attach('result', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    if (process.env.MATCH_SURRENDER_EVIDENCE_DIR) {
      await page.screenshot({
        path: `${process.env.MATCH_SURRENDER_EVIDENCE_DIR}/${viewport.width}x${viewport.height}-result.png`,
      });
    }
    expect(errors).toEqual([]);
  });
}
