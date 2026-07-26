import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage, type GameStateLike } from './helpers';

type AnyState = Record<string, unknown>;

async function prepareBrowseFixture(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    };
    const store = w.__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (state: GameStateLike) => {
    const game = state as unknown as AnyState;
    const players = game.players as { self: AnyState; opp: AnyState };
    const sceneCharacter = (cardId: string, uid: string, setCards: Array<{ cardId: string; faceUp: boolean; instanceId: string }>) => ({
      cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    });
    players.self.scene = [sceneCharacter('D08013', 'self-set-host', [
      { cardId: 'D08003', faceUp: true, instanceId: 'self-up' },
      { cardId: 'D08007', faceUp: false, instanceId: 'self-down' },
    ])];
    players.opp.scene = [sceneCharacter('D08013', 'opp-set-host', [
      { cardId: 'D08003', faceUp: true, instanceId: 'opp-up' },
      { cardId: 'D08007', faceUp: false, instanceId: 'opp-down' },
    ])];
    players.self.hand = [];
    players.opp.hand = [];
    game.pendingEffects = [];
    game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });
}

async function assertTouchTarget(button: ReturnType<Page['getByTestId']>): Promise<void> {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectBrowseIconInArt(card: ReturnType<Page['locator']>): Promise<void> {
  const art = card.locator('.art');
  const icon = card.locator('.scene-card-detail-icon');
  const [artBox, iconBox] = await Promise.all([art.boundingBox(), icon.boundingBox()]);
  expect(artBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(iconBox!.x).toBeGreaterThanOrEqual(artBox!.x);
  expect(iconBox!.y).toBeGreaterThanOrEqual(artBox!.y);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(artBox!.x + artBox!.width);
  expect(iconBox!.y + iconBox!.height).toBeLessThanOrEqual(artBox!.y + artBox!.height);
}

test.describe('set cards beneath a scene character', () => {
  test('browse is magnifier-only, preserves own face states, and keeps opponent hidden cards private', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prepareBrowseFixture(page);
    const setup = await getGameState(page) as unknown as { players: { self: { scene: Array<{ setCards: unknown[] }> } } };
    expect(setup.players.self.scene[0]?.setCards).toHaveLength(2);

    const selfHost = page.locator('[data-uid="self-set-host"]');
    const selfBrowse = page.getByTestId('scene-set-inspect-self-set-host');
    await expect(selfBrowse).toHaveAccessibleName(/2枚.*確認/);
    await expectBrowseIconInArt(selfHost);
    await expect(selfHost.locator('.scene-card-detail-icon')).toHaveCount(1);
    const selfDetail = page.getByTestId('scene-card-detail-self-set-host');
    const [artBox, detailBox] = await Promise.all([
      selfHost.locator('.art').boundingBox(),
      selfDetail.boundingBox(),
    ]);
    expect(artBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    expect(detailBox!.width).toBeLessThan(artBox!.width);
    expect(detailBox!.height).toBeLessThan(artBox!.height);

    // The name/text body is not another detail affordance. Browse begins only at 🔍.
    await selfHost.locator('.name').click();
    await expect(page.locator('.card-list-modal')).toHaveCount(0);
    await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);

    // Non-icon image pixels remain a game-operation surface.
    await selfHost.locator('.art').click({ position: { x: 2, y: artBox!.height - 2 } });
    await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);

    await selfDetail.click();
    await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
    await page.locator('.card-expand-close').click();

    await selfBrowse.click();
    const ownModal = page.locator('.card-list-modal');
    await expect(ownModal).toBeVisible();
    await expect(ownModal).toHaveText(/2\s*枚/);
    await expect(page.getByTestId('card-list-evidence-faceup-0')).toBeVisible();
    await expect(page.getByTestId('card-list-evidence-faceup-1')).toBeVisible();
    await expect(page.getByTestId('card-list-set-state-0')).toHaveText(/表向き/);
    await expect(page.getByTestId('card-list-set-state-1')).toHaveText(/裏向き/);

    const ownFaceDownDetail = page.getByTestId('card-list-detail-D08007-1');
    await assertTouchTarget(ownFaceDownDetail);
    await ownFaceDownDetail.click();
    await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
    await expect(page.locator('.card-expand-modal-backdrop img')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await ownModal.locator('.card-list-modal-close').click();

    const oppBrowse = page.getByTestId('scene-set-inspect-opp-set-host');
    await expect(oppBrowse).toHaveAccessibleName(/2枚.*確認/);
    await oppBrowse.click();
    const opponentModal = page.locator('.card-list-modal');
    await expect(opponentModal).toBeVisible();
    await expect(opponentModal).toHaveText(/2\s*枚/);
    await expect(opponentModal.locator('[data-testid="card-list-evidence-faceup-0"]')).toBeVisible();
    await expect(opponentModal.getByTestId('card-list-facedown-set-1')).toBeVisible();
    await expect(opponentModal).not.toContainText('D08007');
    await expect(opponentModal.locator('[data-testid="card-list-detail-D08007-1"]')).toHaveCount(0);
    await expect(opponentModal.locator('img')).toHaveCount(1);
    const hiddenBack = opponentModal.getByTestId('card-list-facedown-set-1');
    await expect(hiddenBack.locator('img')).toHaveCount(0);
    await expect(hiddenBack).not.toHaveAttribute('data-card-id');

    expectNoConsoleErrors(errors);
  });
});
