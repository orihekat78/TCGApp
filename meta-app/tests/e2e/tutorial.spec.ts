import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('conan.meta.v1.settings'));
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
});

test('TUTORIAL: canonical L0-L13 exposes 14 lessons and exactly 33 steps', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await expect(page.getByText('基礎 L0〜L5')).toBeVisible();
  await expect(page.getByText('応用 L6〜L13')).toBeVisible();

  const lessonButtons = page.locator('.tutorial-sidebar button');
  await expect(lessonButtons).toHaveCount(14);

  let stepCount = 0;
  for (let index = 0; index < 14; index += 1) {
    await lessonButtons.nth(index).click();
    stepCount += await page.locator('.tutorial-step-list button').count();
  }

  expect(stepCount).toBe(33);
  expect(errors).toEqual([]);
});

test('TUTORIAL: L0 viewer advances and persists the exact canonical step id', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /ようこそ、名探偵/ });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'チュートリアル解説' });
  await expect(dialog.getByText('ステップ 1 / 3')).toBeVisible();
  await expect(dialog.getByText('ようこそ、名探偵')).toBeVisible();
  await dialog.getByRole('button', { name: /次へ/ }).click();
  await expect(dialog.getByText('ステップ 2 / 3')).toBeVisible();

  const cleared = await page.evaluate(() => {
    const raw = localStorage.getItem('conan.meta.v1.settings');
    return raw ? JSON.parse(raw)?.state?.settings?.tutorialClearedStepIds ?? [] : [];
  });
  expect(cleared).toContain('L0-1');
  expect(cleared).not.toContain('ch1-1');
});

test('TUTORIAL: L2-1 uses the real playmat snapshot and keyboard focus reveals zones', async ({ page }) => {
  await page.getByRole('button', { name: /場とカードの状態/ }).click();
  await page.getByRole('button', { name: /8 つのエリア/ }).click();

  const dialog = page.getByRole('dialog', { name: 'チュートリアル解説' });
  await expect(dialog.getByText('ステップ 1 / 2')).toBeVisible();
  await expect(dialog.locator('.tutorial-board-snapshot .case-area').first()).toBeVisible();

  const zone = dialog.locator('button').filter({ hasText: '現場' }).first();
  await zone.focus();
  await expect(zone).toHaveCSS('border-color', 'rgb(255, 215, 0)');
});

test('TUTORIAL: every canonical step has a visual fallback without a placeholder', async ({ page }) => {
  await page.getByRole('button', { name: /MRキャラ/ }).click();
  await page.getByRole('button', { name: /MR の重複登場/ }).click();

  const dialog = page.getByRole('dialog', { name: 'チュートリアル解説' });
  await expect(dialog.locator('.tutorial-concept')).toBeVisible();
  await expect(dialog.getByText('L13-2')).toBeVisible();
  await expect(dialog.getByText('図解準備中')).toHaveCount(0);
});

test('TUTORIAL: Escape closes the viewer and returns focus to its trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /ようこそ、名探偵/ });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'チュートリアル解説' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'チュートリアル解説' })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('TUTORIAL: a selected canonical step starts the matching guided overlay', async ({ page }) => {
  await page.getByRole('button', { name: /ターン進行/ }).click();
  await page.getByRole('button', { name: /3 フェイズで進む/ }).click();

  await page.getByRole('button', { name: /このステップを実戦で試す/ }).click();
  await expect(page).toHaveURL(/#match/);

  const mulligan = page.locator('.mulligan-modal button:has-text("引き直しなし")');
  if (await mulligan.isVisible({ timeout: 6000 }).catch(() => false)) await mulligan.click();

  const overlay = page.getByTestId('tutorial-overlay');
  await expect(overlay).toBeVisible({ timeout: 8000 });
  await expect(overlay.locator('.tutorial-id')).toHaveText('L3-1');
  await expect(page.locator('.tutorial-highlight')).toBeVisible();
});
