import { expect, test } from '@playwright/test';
import { buildGameState, dispatchAction, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

test.describe('BUG-243 public duplicate card accessibility', () => {
  test('distinguishes and resolves the second duplicate remove pick on desktop and 851x393 mobile', async ({ page }, testInfo) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
      const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void } } } };
      w.__game.store.getState().setSpectatorMode(false);
    });
    await buildGameState(page, (gs) => {
      const g = gs as unknown as Record<string, unknown>;
      const players = g.players as { self: Record<string, unknown> };
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.scene = [{ cardId: 'B04009', uid: 'bug-243-source', state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} }];
      players.self.remove = ['D08024', 'D08024'];
      players.self.hand = [];
      players.self.evidence = [];
      players.self.deck = ['D08005', 'D08013'];
      g.pendingEffects = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'declaredAbility', uid: 'bug-243-source', abilId: 'a1' });
    await expect(page.locator('.card-list-modal')).toBeVisible();
    const pending = await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { pendingEffectPick: { candidates: { uid: string; cardId: string }[] } | null } } };
      return w.__game.getState().pendingEffectPick;
    });
    const candidates = pending?.candidates ?? [];
    expect(candidates.map((candidate) => candidate.cardId)).toEqual(['D08024', 'D08024']);
    expect(new Set(candidates.map((candidate) => candidate.uid)).size).toBe(2);
    const firstUid = candidates[0]!.uid;
    const secondUid = candidates[1]!.uid;

    const firstPrimary = page.getByTestId(`card-list-pick-${firstUid}`);
    const firstDetail = page.getByTestId(`card-list-pick-detail-${firstUid}`);
    const primary = page.getByTestId(`card-list-pick-${secondUid}`);
    const detail = page.getByTestId(`card-list-pick-detail-${secondUid}`);
    const publicName = await firstPrimary.locator('.card-list-item-name').textContent();
    expect(publicName).not.toBeNull();
    await expect(firstPrimary).toHaveAccessibleName(`${publicName} 1枚目 を選択`);
    await expect(primary).toHaveAccessibleName(`${publicName} 2枚目 を選択`);
    await expect(firstDetail).toHaveAccessibleName(`${publicName} 1枚目 の詳細を表示`);
    await expect(detail).toHaveAccessibleName(`${publicName} 2枚目 の詳細を表示`);
    const labels = await page.locator('[data-testid^="card-list-pick-"]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')).join(' '));
    expect(labels).not.toContain(firstUid);
    expect(labels).not.toContain(secondUid);
    expect(labels).not.toContain('bug-243-source');

    await detail.click();
    await expect(page.locator('.card-expand-modal-backdrop')).toHaveAccessibleName(/カード拡大表示/);
    await page.locator('.card-expand-close').click();

    if (testInfo.project.name === 'mobile-chromium') {
      await primary.tap();
    } else {
      await primary.focus();
      await page.keyboard.press('Enter');
    }
    await expect.poll(async () => {
      const state = await getGameState(page);
      return {
        hand: state.players.self.hand,
        duplicateRemoveCount: state.players.self.remove.filter((cardId) => cardId === 'D08024').length,
        sourcePaidToRemove: state.players.self.remove.includes('B04009'),
      };
    }).toEqual({ hand: ['D08024'], duplicateRemoveCount: 1, sourcePaidToRemove: true });
    expectNoConsoleErrors(errors);
  });
});
