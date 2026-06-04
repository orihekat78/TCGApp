// BUG-108 E2E: ChoicePickerModal の実ブラウザ render + option click → picker resolve を検証。
// (機能フロー = runDeclaredAbilityFlow + dispatch + 効果適用 は integration test
//  tests/ui/hooks/bug-108-choice-picker.test.ts でカバー。本 E2E は実 DOM render / click の確認。)
//
// rules: 15-abilities-effects.md

import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, expectNoConsoleErrors, type GameStateLike } from './helpers';

// Playmat を mount させるための最小 fixture (sample state をそのまま使う)。
function noopFixture(_gs: GameStateLike): void {
  // sample state のまま (Playmat が描画されればよい)
}

test.describe('BUG-108 — ChoicePickerModal 実 DOM render + click', () => {
  test('ask() で 2 option modal が render され、option click で {choose, index} が resolve する', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, noopFixture, {});

    // useChoicePicker.ask() を起動 (Playmat の PlaymatChoicePickerModal が current を subscribe → render)
    await page.evaluate(() => {
      const w = window as unknown as {
        __game: { choicePicker: { ask: (req: unknown) => Promise<unknown> } };
        __choiceResult?: unknown;
      };
      w.__choiceResult = undefined;
      w.__game.choicePicker
        .ask({ sourceName: '横溝重悟', options: [{ index: 0, label: 'LP＋1' }, { index: 1, label: 'AP＋2000' }] })
        .then((r) => { w.__choiceResult = r; });
    });

    // modal が実 DOM に出る
    const modal = page.getByTestId('choice-picker-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('cp-opt-0')).toHaveText('LP＋1');
    await expect(page.getByTestId('cp-opt-1')).toHaveText('AP＋2000');

    // option1 (AP＋2000) を click
    await page.getByTestId('cp-opt-1').click();

    // modal が閉じ、ask の Promise が {choose, index:1} で resolve
    await expect(modal).toBeHidden();
    const result = await page.evaluate(() => (window as unknown as { __choiceResult?: unknown }).__choiceResult);
    expect(result).toEqual({ kind: 'choose', index: 1 });

    expectNoConsoleErrors(errors);
  });

  test('cancel ボタンで {cancel} が resolve する', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, noopFixture, {});

    await page.evaluate(() => {
      const w = window as unknown as {
        __game: { choicePicker: { ask: (req: unknown) => Promise<unknown> } };
        __choiceResult?: unknown;
      };
      w.__choiceResult = undefined;
      w.__game.choicePicker
        .ask({ sourceName: '横溝重悟', options: [{ index: 0, label: 'LP＋1' }, { index: 1, label: 'AP＋2000' }] })
        .then((r) => { w.__choiceResult = r; });
    });

    await expect(page.getByTestId('choice-picker-modal')).toBeVisible();
    await page.getByTestId('cp-cancel-btn').click();

    await expect(page.getByTestId('choice-picker-modal')).toBeHidden();
    const result = await page.evaluate(() => (window as unknown as { __choiceResult?: unknown }).__choiceResult);
    expect(result).toEqual({ kind: 'cancel' });

    expectNoConsoleErrors(errors);
  });
});
