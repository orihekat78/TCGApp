import { expect, test } from "@playwright/test";

test("portrait gate defers HOME and preserves MATCH mulligan across rotation", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/#home");

  const gate = page.getByRole("dialog", { name: "横画面でゲームを開始" });
  await expect(gate).toBeVisible();
  const gateCta = page.getByTestId("landscape-gate-cta");
  await expect(gateCta).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(gateCta).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(gateCta).toBeFocused();
  await expect(page.locator(".home-screen")).toHaveCount(0);

  await page.setViewportSize({ width: 851, height: 393 });
  await expect(gate).toHaveCount(0);
  await expect(page.locator(".home-screen")).toBeVisible();
  await expect(page.getByTestId("landscape-gate-content")).toBeFocused();

  const setupButton = page.locator('button[data-route="setup"]');
  await setupButton.focus();
  await page.setViewportSize({ width: 393, height: 851 });
  await setupButton.evaluate((button: HTMLButtonElement) => { button.disabled = true; });
  await page.setViewportSize({ width: 851, height: 393 });
  await expect(page.getByTestId("landscape-gate-content")).toBeFocused();
  await setupButton.evaluate((button: HTMLButtonElement) => { button.disabled = false; });
  await setupButton.click();
  await expect(page).toHaveURL(/#setup$/);
  const start = page.locator("button.setup-start");
  await expect(start).toBeVisible({ timeout: 10_000 });
  await start.click({ timeout: 10_000 });
  await expect(page).toHaveURL(/#match$/);

  const mulligan = page.locator("button.mulligan-skip");
  await expect(mulligan).toBeVisible({ timeout: 10_000 });
  await mulligan.focus();

  await page.setViewportSize({ width: 393, height: 851 });
  await expect(gate).toBeVisible();
  await expect(mulligan).toBeHidden();

  await page.setViewportSize({ width: 851, height: 393 });
  await expect(gate).toHaveCount(0);
  await expect(mulligan).toBeVisible();
  await expect(mulligan).toBeFocused();
  await mulligan.click();
  await expect(page.locator("#scaler")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#scaler")).toHaveAttribute("data-playmat-layout", "desktop");
  await expect(page.locator("#scaler")).toHaveAttribute("data-playmat-fit", "contained-landscape");

  expect(errors).toEqual([]);
});

test("unsupported orientation APIs keep an actionable manual-rotation fallback", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/#home");
  await page.evaluate(() => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: undefined,
    });
  });

  const cta = page.getByTestId("landscape-gate-cta");
  await cta.click();
  await expect(page.getByRole("status")).toContainText(
    "自動回転を有効にして、端末を横向きにしてください",
  );
  await expect(cta).toBeVisible();
});
