import { expect, test } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

type GameSnapshot = {
  turnNumber: number;
  turnPlayer: 'self' | 'opp';
  gameResult: { winner: 'self' | 'opp'; reason: string } | null;
};

type GameWindow = {
  __game: {
    getState: () => {
      gameState: {
        gameResult?: { winner: 'self' | 'opp'; reason: string } | null;
        turn: { number: number; player: 'self' | 'opp' };
      } | null;
    };
  };
};

test.describe('BUG-045: full-match spectator smoke', () => {
  test('spectator match advances without console errors until result or turn cap', async ({ page }) => {
    test.setTimeout(90_000);
    const { errors } = await setupGamePage(page);

    await expect(page.getByTestId('game-setup-self-deck')).toBeVisible();
    await expect(page.getByTestId('game-setup-opp-deck')).toBeVisible();
    await expect(page.getByTestId('game-setup-spectate')).toBeVisible();
    await page.getByTestId('game-setup-spectate').click();

    await expect(page.locator('.mulligan-modal')).toBeVisible({ timeout: 5_000 });
    await page.locator('.mulligan-skip').click();

    const maxWaitMs = 60_000;
    const start = Date.now();
    let finalState: GameSnapshot | null = null;
    let turnPeak = 0;
    while (Date.now() - start < maxWaitMs) {
      const skip = page.getByTestId('presentation-skip');
      if (await skip.isVisible()) await skip.click();

      const snapshot = await page.evaluate(() => {
        const state = (window as unknown as GameWindow).__game.getState().gameState;
        if (!state) return null;
        return {
          turnNumber: state.turn.number,
          turnPlayer: state.turn.player,
          gameResult: state.gameResult ?? null,
        };
      });
      if (snapshot === null) {
        await page.waitForTimeout(300);
        continue;
      }
      finalState = snapshot;
      turnPeak = Math.max(turnPeak, snapshot.turnNumber);
      if (snapshot.gameResult || snapshot.turnNumber >= 50) break;
      await page.waitForTimeout(500);
    }

    expect(finalState, 'gameState was not available').not.toBeNull();
    expect(turnPeak, 'the match did not advance a turn').toBeGreaterThan(0);
    if (finalState?.gameResult) {
      expect(['self', 'opp']).toContain(finalState.gameResult.winner);
    }
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('GameSetupModal keeps both shipped baseline decks in both selectors (BUG-042)', async ({ page }) => {
    await setupGamePage(page);

    const selfDeckOptions = await page.getByTestId('game-setup-self-deck').locator('option').evaluateAll(
      (options) => options.map((option) => (option as HTMLOptionElement).value),
    );
    const oppDeckOptions = await page.getByTestId('game-setup-opp-deck').locator('option').evaluateAll(
      (options) => options.map((option) => (option as HTMLOptionElement).value),
    );

    expect(selfDeckOptions.length).toBeGreaterThanOrEqual(2);
    expect(oppDeckOptions.length).toBeGreaterThanOrEqual(2);
    expect(selfDeckOptions).toEqual(expect.arrayContaining(['CT-D08', 'CT-D11']));
    expect(oppDeckOptions).toEqual(expect.arrayContaining(['CT-D08', 'CT-D11']));
  });
});
