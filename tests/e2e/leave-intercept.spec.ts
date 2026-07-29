import { test, expect, type Locator } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  dispatchAction,
  getActiveActionId,
  getGameState,
} from './helpers';

async function expectLoadedCardArt(card: Locator, imageFile: string): Promise<void> {
  const image = card.locator('img.card-art');
  await expect(image).toBeVisible();
  await expect(image).not.toHaveAttribute('src', /^data:image\//);
  await expect(image).toHaveAttribute('src', new RegExp(`${imageFile}$`));
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
}

for (const { accept, label } of [
  { accept: true, label: 'accept redirects the target to hand and removes the interceptor' },
  { accept: false, label: 'decline removes the target and keeps the interceptor' },
]) {
test(`B01092 legal opponent contact removal opens leave intercept details and ${label}`, async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (enabled: boolean) => void; setAiPaused: (paused: boolean) => void } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    (gs as unknown as Record<string, unknown>).pendingEffects = [];
    (gs as unknown as { turn: { number: number; player: string; phase: string } }).turn = {
      number: 3, player: 'opp', phase: 'main',
    };
    gs.players.self.scene = [
      { ...gs.players.self.scene[0]!, uid: 'interceptor', cardId: 'B01092', state: 'active', isNamed: false },
      { ...gs.players.self.scene[1]!, uid: 'target', cardId: 'D08003', state: 'sleep', isNamed: false },
    ];
    gs.players.self.hand = [];
    gs.players.opp.scene = [
      { ...gs.players.opp.scene[0]!, uid: 'opponent-attacker', cardId: 'D11003', state: 'active', isNamed: false },
    ];
  });
  const declared = await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'opponent-attacker', targetUid: 'target' });
  expect(declared).toEqual({ ok: true });
  const actionId = await getActiveActionId(page);
  if (!actionId) throw new Error('activeActionId not set after declaration');
  await expect(page.getByTestId('guard-picker-modal')).toBeVisible();
  await page.getByTestId('guard-picker-skip').click();

  // UI が guard 後を action-1 まで進める。以降のコンタクト選択と判定は公開 dispatch を通す。
  // action-1 belongs to the self-owned target. Use its public pass control;
  // the contact driver then resolves the opponent-owned action-2 and judge.
  const contactPass = page.getByTestId('hand-zone-pick-skip');
  await expect(contactPass).toBeVisible();
  await contactPass.click();

  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeVisible();
  const interceptor = page.locator('[data-testid="leave-intercept-card-interceptor"]');
  const target = page.locator('[data-testid="leave-intercept-card-target"]');
  const targetDetail = page.locator('[data-testid="leave-intercept-card-detail-target"]');
  await expectLoadedCardArt(interceptor, '1714013082039905.jpg');
  await expectLoadedCardArt(target, '1743743093434380.jpg');
  await expect(targetDetail).toBeVisible();
  await targetDetail.click();
  await expect(page.locator('.card-expand-close')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeVisible();
  await interceptor.click({ button: 'right' });
  await expect(page.locator('.card-expand-close')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await page.locator(`[data-testid="leave-intercept-${accept ? 'yes' : 'no'}"]`).click();
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeHidden();
  const state = await getGameState(page);
  if (accept) {
    expect(state.players.self.hand).toContain('D08003');
    expect(state.players.self.remove).toContain('B01092');
  } else {
    expect(state.players.self.remove).toContain('D08003');
    expect(state.players.self.hand).not.toContain('D08003');
    expect(state.players.self.scene.map((card) => card.uid)).toContain('interceptor');
  }
  expect(errors).toEqual([]);
});
}
