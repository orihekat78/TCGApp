import { test, expect } from '@playwright/test';

// BUG-037: 現場カードの sleep / stun が computed transform で実際に rotate されるかを検証。
//
// BUG-029 spec は `data-state` と class 付与までしか見ていなかったため、
// 本 spec で `getComputedStyle(...).transform` まで実機検証する回帰防止 lock。
//
// 原因 (修正前):
//   `src/ui/components/SceneArea.css` で `animation: scene-card-enter 280ms ease-out both`
//   `both` (forwards 含む) のため 100% keyframe の transform:translateY(0) scale(1) が
//   animation 終了後も保持され、`.sleep` の rotate(-90deg) を上書きしていた。
//
// 修正: `both` → `backwards` (delay 中のみ適用、終了後の base style override しない)。

type GameWindow = {
  __game: {
    createSampleGameState: () => unknown;
    setGameState: (gs: unknown) => void;
    dispatch: (a: unknown) => unknown;
    getState: () => { gameState: unknown };
  };
};

test.describe('BUG-037: 現場カードの sleep / stun が computed transform で回転表示される', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as GameWindow).__game !== undefined);
  });

  test('sample state の opp-2 (sleep) が computed transform で rotate(-90deg) になっている', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState();
      w.__game.setGameState(gs);
    });

    // animation 完了 (280ms keyframe + React mount lag を考慮し 1000ms 待つ)
    await page.waitForTimeout(1000);

    const transforms = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-uid]');
      return Array.from(cards).map((c) => {
        const cs = window.getComputedStyle(c as Element);
        return {
          uid: c.getAttribute('data-uid'),
          state: c.getAttribute('data-state'),
          transform: cs.transform,
        };
      });
    });

    // opp-2 は sample state で sleep
    const opp2 = transforms.find((t) => t.uid === 'opp-2');
    expect(opp2, 'opp-2 exists').toBeDefined();
    expect(opp2?.state, 'opp-2 data-state === sleep').toBe('sleep');
    // rotate(-90deg) = matrix(0, -1, 1, 0, 0, 0)
    expect(opp2?.transform, 'opp-2 transform は rotate(-90deg)').toBe('matrix(0, -1, 1, 0, 0, 0)');

    // opp-3 は sample state で stun
    const opp3 = transforms.find((t) => t.uid === 'opp-3');
    expect(opp3?.state, 'opp-3 data-state === stun').toBe('stun');
    // rotate(180deg) = matrix(-1, 0, 0, -1, 0, 0)
    expect(opp3?.transform, 'opp-3 transform は rotate(180deg)').toBe('matrix(-1, 0, 0, -1, 0, 0)');

    // active なキャラは transform なし
    const opp1 = transforms.find((t) => t.uid === 'opp-1');
    expect(opp1?.state, 'opp-1 data-state === active').toBe('active');
    expect(opp1?.transform, 'opp-1 transform は none').toBe('none');
  });

  test('reasoning dispatch で self-2 が computed transform で rotate(-90deg) になる', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as {
        players: {
          self: { scene: { uid: string; state: string; isNamed: boolean }[] };
        };
      };
      const actor = gs.players.self.scene.find((s) => s.uid === 'self-2')!;
      actor.state = 'active';
      actor.isNamed = false;
      w.__game.setGameState(gs);
    });

    await page.waitForTimeout(500);

    // reasoning dispatch
    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      w.__game.dispatch({ type: 'reasoning', uid: 'self-2' });
    });

    await page.waitForTimeout(400);

    const result = await page.evaluate(() => {
      const c = document.querySelector('[data-uid="self-2"]');
      if (!c) return null;
      const cs = window.getComputedStyle(c);
      return {
        state: c.getAttribute('data-state'),
        cls: c.className,
        transform: cs.transform,
      };
    });

    expect(result?.state, 'self-2 data-state === sleep').toBe('sleep');
    expect(result?.cls, 'self-2 class に sleep 含む').toContain('sleep');
    // **本 BUG の核心**: class が sleep でも transform が identity になっていたケースの回帰防止
    expect(result?.transform, 'self-2 transform は rotate(-90deg) = matrix(0,-1,1,0,0,0)').toBe(
      'matrix(0, -1, 1, 0, 0, 0)',
    );
  });
});
