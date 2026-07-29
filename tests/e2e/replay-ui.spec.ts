import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

// Phase 9-G.2 (Cleanup 7-D): リプレイ UI E2E
//
// 検証:
//   1. リプレイ読込ボタンが GameSetupModal にある
//   2. minimal ReplayLog を JS で構築して loadLog 呼出 → ReplayPanel 表示
//   3. play/pause/step/seek/speed の操作が DOM 上反映される

type GameWindow = {
  __game: {
    createSampleGameState: () => unknown;
    setGameState: (gs: unknown) => void;
  };
};

test.describe('Phase 9-G.2: リプレイ UI', () => {
  test('GameSetupModal に「リプレイ JSON 読込」label が表示される', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await expect(page.locator('[data-testid="game-setup-replay-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-setup-replay-file"]')).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('replay log を JS から loadLog すると ReplayPanel が表示される', async ({ page }) => {
    const { errors } = await setupGamePage(page);

    // minimal ReplayLog を JS で構築 + loadLog 経由で driver に流す
    // (file input は test では使いにくいため、direct API path で検証)
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const initialState = w.__game.createSampleGameState() as {
        pendingEffects: unknown[];
        players: { opp: { deck: string[] } };
      };
      initialState.pendingEffects = [];
      initialState.players.opp.deck = Array.from(
        { length: 40 },
        (_, index) => `replay-opp-deck-${index}`,
      );
      const log = {
        schemaVersion: 1,
        initialState,
        moves: [
          { turn: 4, player: 'self', move: { kind: 'endTurn' } },
        ],
        result: { winner: 'draw', reason: 'turn-cap', turns: 5 },
      };
      // React state は外から書けないので、file input event を simulate
      const fileInput = document.querySelector('[data-testid="game-setup-replay-file"]') as HTMLInputElement | null;
      if (!fileInput) throw new Error('replay file input not found');
      const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
      const file = new File([blob], 'test-replay.json', { type: 'application/json' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // FileReader が async 動作 → ReplayPanel 表示を polling
    await expect(page.locator('[data-testid="replay-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="replay-progress"]')).toHaveText(/0 ?\/ ?1/);

    expect(errors).toEqual([]);
  });

  test('replay panel の step / speed preset / close が機能する', async ({ page }) => {
    const { errors } = await setupGamePage(page);

    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const initialState = w.__game.createSampleGameState() as {
        pendingEffects: unknown[];
        players: { opp: { deck: string[] } };
      };
      initialState.pendingEffects = [];
      initialState.players.opp.deck = Array.from(
        { length: 40 },
        (_, index) => `replay-opp-deck-${index}`,
      );
      const log = {
        schemaVersion: 1,
        initialState,
        moves: [
          { turn: 4, player: 'self', move: { kind: 'endTurn' } },
        ],
        result: { winner: 'draw', reason: 'turn-cap', turns: 5 },
      };
      const fileInput = document.querySelector('[data-testid="game-setup-replay-file"]') as HTMLInputElement | null;
      if (!fileInput) throw new Error('replay file input not found');
      const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
      const file = new File([blob], 'test-replay.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.locator('[data-testid="replay-panel"]')).toBeVisible({ timeout: 5000 });

    // step 1 回 → progress 1/1
    await page.locator('[data-testid="replay-step"]').click();
    await expect(page.locator('[data-testid="replay-progress"]')).toHaveText(/1 ?\/ ?1/);

    // speed preset 1500 を選択
    await page.locator('[data-testid="replay-speed-1500"]').click();
    await expect(page.locator('[data-testid="replay-speed-current"]')).toHaveText('1500ms');
    await expect(page.locator('[data-testid="replay-speed-1500"]')).toHaveAttribute('aria-pressed', 'true');

    // close で panel 非表示
    await page.locator('[data-testid="replay-close"]').click();
    await expect(page.locator('[data-testid="replay-panel"]')).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
