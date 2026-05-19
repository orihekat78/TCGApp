import { test, expect } from '@playwright/test';

// BUG-029: 現場カードがアクション/推理してもスリープにならない (UI 反映)
//
// Round 4c の BUG-006 修正 (store.dispatch shallow-copy fallback) で同根原因として
// 副次解消されている想定。本 spec は実機 (Playwright headed default + MCP 立ち会い可) で
// dispatch reasoning / actionDeclareCase 後に scene character の DOM に
// `.sleep` class が付与されることを確認する回帰防止 lock。

type GameWindow = {
  __game: {
    getState: () => { gameState: unknown; activeActionId: string | null };
    setGameState: (gs: unknown) => void;
    createSampleGameState: () => unknown;
    dispatch: (action: unknown) => unknown;
  };
};

test.describe('BUG-029: 現場カードの sleep 反映 (UI reactivity)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as unknown as GameWindow).__game !== 'undefined');
  });

  test('reasoning dispatch で self-2 (scene character) が DOM 上で .sleep class を持つ', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as {
        players: { self: { scene: { uid: string; state: string; isNamed: boolean }[] } };
      };
      const actor = gs.players.self.scene.find((s) => s.uid === 'self-2')!;
      actor.state = 'active';
      actor.isNamed = false;
      w.__game.setGameState(gs);
    });

    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      w.__game.dispatch({ type: 'reasoning', uid: 'self-2' });
    });

    // engine 層 state の sleep 確認
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const w = window as unknown as GameWindow;
          const gs = w.__game.getState().gameState as {
            players: { self: { scene: { uid: string; state: string }[] } };
          };
          return gs.players.self.scene.find((s) => s.uid === 'self-2')?.state ?? null;
        }),
      )
      .toBe('sleep');

    // DOM 層 sleep class の反映確認 (UI reactivity)
    const sleepCard = page.locator('.card[data-uid="self-2"]');
    await expect(sleepCard).toHaveClass(/\bsleep\b/, { timeout: 3000 });
  });

  test('actionDeclareCase dispatch で attacker (self-2) が DOM 上で .sleep class を持つ', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as {
        players: {
          self: { scene: { uid: string; state: string; isNamed: boolean }[] };
          opp: { scene: { uid: string; state: string }[] };
        };
      };
      const actor = gs.players.self.scene.find((s) => s.uid === 'self-2')!;
      actor.state = 'active';
      actor.isNamed = false;
      for (const s of gs.players.opp.scene) s.state = 'sleep';
      w.__game.setGameState(gs);
    });

    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      w.__game.dispatch({ type: 'actionDeclareCase', byUid: 'self-2', targetPlayer: 'opp' });
    });

    const sleepCard = page.locator('.card[data-uid="self-2"]');
    await expect(sleepCard).toHaveClass(/\bsleep\b/, { timeout: 3000 });
  });
});
