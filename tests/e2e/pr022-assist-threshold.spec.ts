import { expect, test } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

async function setPr022AssistState(page: Parameters<typeof setupGamePage>[0], fileCount: number): Promise<void> {
  await buildGameState(page, (raw, count) => {
    const state = raw as any;
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    delete state.gameResult;
    state.turnState.self.assistedThisTurn = false;
    state.players.self.partner = { cardId: 'PR022', state: 'active', location: 'partner-area' };
    state.players.self.file = Array.from({ length: count }, (_entry, index) => ({
      type: 'card-back',
      cardId: `FILE-${index}`,
    }));
    state.players.self.case.status = '事件編';
  }, fileCount);
}

async function acceptAssist(page: Parameters<typeof setupGamePage>[0]): Promise<void> {
  await page.locator('[data-action-id="assist"]').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal-footer .confirm-ok').click();
  await expect(page.locator('.confirm-modal')).toBeHidden();
}

test('PR022 public assist uses FILE 8 while the ordinary FILE meter stays fixed at 7', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  const meter = page.locator('.file-area.side-self [role="progressbar"]');

  await setPr022AssistState(page, 6);
  await expect(meter).toHaveAttribute('aria-valuemax', '7');
  await expect(meter).toHaveAttribute('aria-valuenow', '6');
  await acceptAssist(page);

  let state = await getGameState(page) as any;
  expect(state.players.self.file).toHaveLength(7);
  expect(state.players.self.case.status).toBe('事件編');
  await expect(meter).toHaveAttribute('aria-valuemax', '7');
  await expect(meter).toHaveAttribute('aria-valuenow', '7');

  await setPr022AssistState(page, 7);
  await page.locator('[data-action-id="assist"]').click();
  await expect(page.locator('.confirm-modal')).toContainText('現在 FILE 7 枚 → 8 枚');
  await expect(page.locator('.confirm-modal')).toContainText('FILE 8 枚以上');
  await page.locator('.confirm-modal-footer .confirm-ok').click();
  await expect(page.locator('.confirm-modal')).toBeHidden();

  state = await getGameState(page) as any;
  expect(state.players.self.file).toHaveLength(8);
  expect(state.players.self.case.status).toBe('解決編');
  await expect(meter).toHaveAttribute('aria-valuemax', '7');
  await expect(meter).toHaveAttribute('aria-valuenow', '7');
  expectNoConsoleErrors(errors);
});
