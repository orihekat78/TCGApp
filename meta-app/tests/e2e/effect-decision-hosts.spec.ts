import { expect, test } from '@playwright/test';
import { gotoReadyMetaRoute } from './landscape-test-helpers';

test('MATCH画面で任意効果の決定モーダルを表示する', async ({ page }) => {
  test.setTimeout(60_000);
  await gotoReadyMetaRoute(page, 'setup', '.setup-main');
  await page.getByLabel('先攻').selectOption('p1');
  await page.locator('.meta-btn-ready').click();
  await page.waitForURL(/#match/);
  const mulliganSkip = page.locator('button.mulligan-skip');
  await expect(mulliganSkip).toBeVisible({ timeout: 8000 });
  await mulliganSkip.click();
  await expect(mulliganSkip).not.toBeVisible({ timeout: 8000 });
  await page.waitForFunction(() => typeof (globalThis as { __metaGame?: unknown }).__metaGame !== 'undefined');

  await page.evaluate(() => {
    const bridge = (globalThis as unknown as {
      __metaGame: { getState: () => {
        setPendingEffectOptional: (pending: unknown) => void;
      } };
    }).__metaGame;
    const store = bridge.getState();
    store.setPendingEffectOptional({
      player: 'self',
      source: { cardId: 'B09056P', abilityId: 'a1', uid: 'b09056p-self-1' },
    });
  });

  await expect(page.getByTestId('optional-picker-modal')).toBeVisible();
  await expect(page.getByTestId('opt-run-yes')).toBeVisible();
  await expect(page.getByTestId('opt-run-no')).toBeVisible();
});
