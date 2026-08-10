import { expect, test, type Page } from '@playwright/test';

const SETTINGS_KEY = 'conan.meta.v1.settings';

const savedSettings = {
  density: 'compact',
  presentationSpeed: 'fast',
  spectatorAi: 'slow',
  favorites: ['CT-D08-001'],
  cardBack: 'jade',
  bgmVolume: 25,
  seEnabled: false,
  tutorialClearedStepIds: ['L0-1'],
};

async function setSavedSettings(page: Page) {
  await page.addInitScript((settings) => {
    if (sessionStorage.getItem('settings-refresh-seeded') === 'true') return;
    localStorage.setItem('conan.meta.v1.settings', JSON.stringify({ state: { settings }, version: 2 }));
    sessionStorage.setItem('settings-refresh-seeded', 'true');
  }, savedSettings);
}

async function persistedSettings(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}')?.state?.settings, SETTINGS_KEY);
}

test('SETTINGS: drafts changes until save, then restores them after reload at desktop', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await setSavedSettings(page);
  await page.goto('/#settings');

  const groups = page.locator('.settings-segmented');
  await groups.nth(0).getByRole('button').nth(1).click();
  await groups.nth(1).getByRole('button').nth(1).click();
  await groups.nth(2).getByRole('button').nth(1).click();

  await expect(page.getByRole('status')).toHaveText('未保存の変更があります。');
  await expect(page.getByRole('status')).toBeVisible();
  expect(await persistedSettings(page)).toMatchObject(savedSettings);
  await expect(groups.nth(0).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(groups.nth(1).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(groups.nth(2).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '設定を保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存');
  expect(await persistedSettings(page)).toMatchObject({
    ...savedSettings,
    density: 'comfortable', presentationSpeed: 'standard', spectatorAi: 'standard',
  });

  await page.reload();
  await expect(groups.nth(0).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(groups.nth(1).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(groups.nth(2).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('SETTINGS: reset changes only the draft and keeps both actions usable in compact landscape', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 851, height: 393 });
  await setSavedSettings(page);
  await page.goto('/#settings');

  const actions = page.locator('.settings-actions');
  await expect(actions).toBeInViewport({ ratio: 1 });

  const settingsBody = page.locator('.settings-sheet-body');
  await expect(settingsBody).toHaveCount(1);
  const bodyGeometry = await settingsBody.evaluate((body) => ({
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
  }));
  expect(bodyGeometry.scrollHeight).toBeGreaterThan(bodyGeometry.clientHeight);
  await settingsBody.evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(actions).toBeInViewport({ ratio: 1 });

  await page.locator('.settings-segmented').nth(0).getByRole('button').nth(1).click();
  await expect(page.getByRole('status')).toHaveText('未保存の変更があります。');
  await expect(actions).toBeInViewport({ ratio: 1 });

  await page.getByRole('button', { name: '初期状態に戻す', exact: true }).click();
  expect(await persistedSettings(page)).toMatchObject(savedSettings);
  await expect(page.locator('.settings-segmented').nth(0).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.settings-segmented').nth(1).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.settings-segmented').nth(2).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');

  const actionHeights = await page.locator('.settings-actions button').evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(actionHeights).toHaveLength(2);
  expect(Math.min(...actionHeights)).toBeGreaterThanOrEqual(43.9);

  await page.getByRole('button', { name: '設定を保存', exact: true }).click();
  await page.reload();
  expect(await persistedSettings(page)).toMatchObject({
    ...savedSettings,
    density: 'comfortable', presentationSpeed: 'standard', spectatorAi: 'standard',
  });
  expect(errors).toEqual([]);
});

test('SETTINGS: header navigation confirms before discarding an unsaved draft', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await setSavedSettings(page);
  await page.goto('/#settings');

  await page.locator('.settings-segmented').nth(0).getByRole('button').nth(1).click();

  let promptCount = 0;
  page.once('dialog', async (dialog) => {
    promptCount += 1;
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.locator('[data-route="home"]').click();
  await expect(page).toHaveURL(/#settings$/);
  expect(promptCount).toBe(1);
  await expect(page.locator('.settings-segmented').nth(0).getByRole('button').nth(1))
    .toHaveAttribute('aria-pressed', 'true');

  page.once('dialog', async (dialog) => {
    promptCount += 1;
    await dialog.accept();
  });
  await page.locator('[data-route="home"]').click();
  await expect(page).toHaveURL(/#home$/);
  expect(promptCount).toBe(2);
});

test('SETTINGS: hotkeys and reload use the shared unsaved-draft guard', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 393 });
  await setSavedSettings(page);
  await page.goto('/#settings');

  expect(await page.evaluate(() => window.dispatchEvent(
    new Event('beforeunload', { cancelable: true }),
  ))).toBe(true);
  const changed = page.locator('.settings-segmented').nth(0).getByRole('button').nth(1);
  await changed.click();
  expect(await page.evaluate(() => window.dispatchEvent(
    new Event('beforeunload', { cancelable: true }),
  ))).toBe(false);

  const dismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await dismissed;
  await expect(page).toHaveURL(/#settings$/);
  await expect(changed).toHaveAttribute('aria-pressed', 'true');

  const accepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.keyboard.press('h');
  await accepted;
  await expect(page).toHaveURL(/#home$/);
});

test('SETTINGS: browser Back is blocked until discarding the draft is accepted', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await setSavedSettings(page);
  await page.goto('/#home');
  await page.locator('[data-route="settings"]').click();
  await expect(page).toHaveURL(/#settings$/);

  const changed = page.locator('.settings-segmented').nth(0).getByRole('button').nth(1);
  await changed.click();

  const dismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => window.history.back());
  await dismissed;
  await expect(page).toHaveURL(/#settings$/);
  await expect(changed).toHaveAttribute('aria-pressed', 'true');

  const accepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.evaluate(() => window.history.back());
  await accepted;
  await expect(page).toHaveURL(/#home$/);
});

test('SETTINGS: direct hash and browser Forward use the shared unsaved-draft guard', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await setSavedSettings(page);
  await page.goto('/#settings');

  const changed = page.locator('.settings-segmented').nth(0).getByRole('button').nth(1);
  await changed.click();

  const directHashDismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => { window.location.hash = '#cards'; });
  await directHashDismissed;
  await expect(page).toHaveURL(/#settings$/);
  await expect(changed).toHaveAttribute('aria-pressed', 'true');

  const forwardDismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
  await page.evaluate(() => window.history.forward());
  await forwardDismissed;
  await expect(page).toHaveURL(/#settings$/);
  await expect(changed).toHaveAttribute('aria-pressed', 'true');

  const forwardAccepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
  await page.evaluate(() => window.history.forward());
  await forwardAccepted;
  await expect(page).toHaveURL(/#cards$/);
});
