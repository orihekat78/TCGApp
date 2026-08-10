import { test, expect, type Locator, type Page } from '@playwright/test';

async function openPublicSetup(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const url = message.location()?.url ?? '';
    if (text.includes('Failed to load resource') && /404/.test(text)) return;
    if (/favicon\.ico|robots\.txt/.test(url)) return;
    errors.push(`console.error: ${text}`);
  });

  await page.goto('/#setup');
  await expect(page.getByTestId('game-setup-start')).toBeVisible();
  return errors;
}

async function clickFirstVisible(locator: Locator): Promise<boolean> {
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.click();
  return true;
}

async function readPublicGlobalTurn(page: Page): Promise<number> {
  const label = await page.locator('.chapter-tag').getAttribute('aria-label');
  const match = label?.match(/(先攻|後攻)\s*(\d+)ターン目/);
  if (!match) throw new Error(`公開ターン表示を解釈できません: ${label ?? 'missing'}`);
  const playerTurn = Number.parseInt(match[2]!, 10);
  return match[1] === '先攻' ? (playerTurn * 2) - 1 : playerTurn * 2;
}

/**
 * Choose only from rendered, public decision surfaces. The policy is deliberately
 * simple: decline optional effects, otherwise take the first legal public choice.
 * This exercises the same UI dispatch path as a human player without inspecting
 * store state, pending runtime, or unrevealed information.
 */
async function resolvePublicDecision(page: Page): Promise<boolean> {
  if (await page.getByTestId('effect-picker-modal').isVisible().catch(() => false)) {
    if (await clickFirstVisible(page.getByTestId('effect-picker-confirm'))) return true;
    if (await clickFirstVisible(page.locator('[data-testid^="effect-pick-cand-"]:not([disabled])'))) return true;
    return clickFirstVisible(page.getByTestId('effect-picker-skip'));
  }

  if (await page.locator('.card-list-modal').isVisible().catch(() => false)) {
    if (await clickFirstVisible(page.getByTestId('card-list-pick-confirm'))) return true;
    if (await clickFirstVisible(page.locator('[data-testid^="card-list-pick-"]:not([disabled])'))) return true;
    return clickFirstVisible(page.getByTestId('card-list-pick-skip'));
  }

  if (await clickFirstVisible(page.getByTestId('opt-run-no'))) return true;
  if (await clickFirstVisible(page.getByTestId('repeat-opt-run-no'))) return true;
  if (await clickFirstVisible(page.getByTestId('cp-opt-0'))) return true;
  if (await clickFirstVisible(page.getByTestId('choose-intercept-decline'))) return true;
  if (await clickFirstVisible(page.getByTestId('leave-intercept-no'))) return true;
  if (await clickFirstVisible(page.getByTestId('guard-picker-skip'))) return true;
  if (await clickFirstVisible(page.getByTestId('misread-skip-btn'))) return true;
  if (await clickFirstVisible(page.getByTestId('hirameki-skip-btn'))) return true;
  if (await clickFirstVisible(page.getByTestId('scene-pick-skip'))) return true;
  if (await clickFirstVisible(page.getByTestId('set-card-replacement-decline'))) return true;
  if (await clickFirstVisible(page.getByTestId('rps-rock'))) return true;
  if (await clickFirstVisible(page.locator('[data-testid^="confirm-effect-order-"]'))) return true;

  if (await page.getByTestId('set-card-choice-modal').isVisible().catch(() => false)) {
    if (await clickFirstVisible(page.locator('[data-testid^="set-card-choice-"]:not([disabled])'))) return true;
    return clickFirstVisible(page.getByTestId('set-card-cost-confirm'));
  }

  if (await clickFirstVisible(page.getByTestId('deck-place-confirm-btn'))) return true;
  if (await clickFirstVisible(page.getByTestId('deck-reorder-confirm-btn'))) return true;

  // Area-based selection uses direct manipulation rather than a modal.
  if (await clickFirstVisible(page.getByTestId('hand-zone-pick-confirm'))) return true;
  if (await clickFirstVisible(page.locator('.hand-card--pickable:not(.disabled)'))) return true;
  if (await clickFirstVisible(page.locator('.effect-pickable'))) return true;

  // Long causal sequences are intentionally paced for players. Use the same
  // public Skip control a player can use so this smoke stays runtime-bounded
  // without dispatching engine actions or reading private state.
  if (await clickFirstVisible(page.getByTestId('presentation-skip'))) return true;

  return false;
}

async function waitForHumanTurnOrWinner(page: Page): Promise<'human-turn' | 'winner'> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('victory-overlay').isVisible().catch(() => false)) return 'winner';
    if (await resolvePublicDecision(page)) {
      await page.waitForTimeout(100);
      continue;
    }
    if (await page.locator('button.end-turn-btn').isEnabled().catch(() => false)) return 'human-turn';
    await page.waitForTimeout(200);
  }
  throw new Error('CPU turn did not return control through the public UI within 20 seconds');
}

test.describe('full-match smoke (human vs CPU)', () => {
  test('runs from public setup and mulligan to winner or the 30-turn cap with zero console errors', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await openPublicSetup(page);

    await page.getByTestId('game-setup-start').click();
    await expect(page.locator('.mulligan-modal')).toBeVisible();
    await page.locator('.mulligan-skip').click();

    const maxTurns = 30;
    const maxHumanTurnsBeforeCap = Math.ceil(maxTurns / 2);
    let completedHumanTurns = 0;
    let outcome: 'winner' | 'turn-cap' | null = null;

    while (completedHumanTurns <= maxHumanTurnsBeforeCap) {
      const ready = await waitForHumanTurnOrWinner(page);
      if (ready === 'winner') {
        outcome = 'winner';
        break;
      }

      // The public chapter tag includes first/second-player position and that
      // player's turn count. Derive the global turn from it so randomized first
      // player selection cannot create a false 30-turn-cap pass.
      if (await readPublicGlobalTurn(page) >= maxTurns) {
        outcome = 'turn-cap';
        break;
      }

      const endTurn = page.locator('button.end-turn-btn');
      await expect(endTurn).toBeEnabled();
      await endTurn.click();
      await expect(page.locator('.confirm-modal-footer .confirm-ok')).toBeVisible();
      await page.locator('.confirm-modal-footer .confirm-ok').click();
      completedHumanTurns += 1;
    }

    if (outcome === null) {
      throw new Error(`勝敗にも公開ターン${maxTurns}到達にも至りませんでした (${completedHumanTurns} human turns)`);
    }

    if (outcome === 'winner') {
      await expect(page.getByTestId('victory-overlay')).toBeVisible();
      await expect(page.getByTestId('victory-overlay')).toContainText(/YOU (WIN|LOSE)/);
    }
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
