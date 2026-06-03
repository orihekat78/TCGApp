import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  dispatchAction,
  getActiveActionId,
  waitForPhase,
  waitForActionEnd,
  expectActorRemoved,
  expectNoConsoleErrors,
} from './helpers';
import type { GameStateLike } from './helpers';

// User 要望: コンタクト中のカットイン選択を、テキストボタン modal ではなく HandZone pick mode
// (手札拡大 + カットイン可能カードを黄色枠 + パス skip) で行う。
//
// 盤面は cutin-fixed-ap.spec と同型 (self-2 AP=8000 → opp-2 sleep AP=6000)。self-2 が AP 高い
// ので action-2 (2番目) で self のカットイン判断。変装カードは MVP に無いので必ず hand-pick。
//
// 検証:
//   - pick: 黄色枠の cutin カードが手札に表示 → click で contact-cutin が log + action 完走 + opp-2 リムーブ
//   - pass: skip ボタンで cutin せず action 完走 (contact-cutin log なし、opp-2 は 8000>6000 で除去)

function buildBoard(page: Page): Promise<void> {
  return buildGameState(page, (gs: GameStateLike) => {
    const actor = gs.players.self.scene.find((s) => s.uid === 'self-2');
    if (!actor) throw new Error('test fixture missing self-2');
    actor.state = 'active';
    actor.isNamed = false;
    for (const s of gs.players.opp.scene) s.state = 'sleep'; // guard 候補ゼロ
    gs.players.self.hand.push('D08017'); // カットイン +2000 カード
  });
}

// self の cutin が log されたか (opp AI も opp-2 を cutin しうるので player で区別する)。
async function selfCutinLogged(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { gameState: { log?: { action?: string; player?: string }[] } } } };
    return (w.__game.getState().gameState.log ?? []).some((e) => e.action === 'contact-cutin' && e.player === 'self');
  });
}

test.describe('カットイン HandZone pick (黄色枠で選択 / パス)', () => {
  test('黄色枠の cutin カードを click → contact-cutin が発火し action 完走', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildBoard(page);

    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
    const actionId = await getActiveActionId(page);
    if (!actionId) throw new Error('activeActionId not set after declare');

    // action-2 (self=second) で self の cutin 判断 → HandZone pick mode (黄色枠)
    await waitForPhase(page, 'action-2');
    const card = page.locator('.hand-card--pickable[data-card-id="D08017"]');
    await expect(card, 'cutin カードが黄色枠 pickable で表示').toBeVisible({ timeout: 5000 });
    await card.click();

    await waitForActionEnd(page);
    expect(await selfCutinLogged(page), 'contact-cutin が log に記録').toBe(true);
    await expectActorRemoved(page, 'opp-2', 'opp');
    expectNoConsoleErrors(errors);
  });

  test('パス skip ボタン → cutin せず action 完走 (contact-cutin log なし)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildBoard(page);

    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
    const actionId = await getActiveActionId(page);
    if (!actionId) throw new Error('activeActionId not set after declare');

    await waitForPhase(page, 'action-2');
    const card = page.locator('.hand-card--pickable[data-card-id="D08017"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="hand-zone-pick-skip"]').click(); // パス

    await waitForActionEnd(page);
    expect(await selfCutinLogged(page), 'パスなので contact-cutin は記録されない').toBe(false);
    await expectActorRemoved(page, 'opp-2', 'opp'); // self-2 8000 > opp-2 6000 で pass でも除去
    expectNoConsoleErrors(errors);
  });
});
