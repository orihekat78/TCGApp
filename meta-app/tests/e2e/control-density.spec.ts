import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("conan.meta.v1.settings");
    localStorage.removeItem("conan.meta.v1.filters");
  });
});

test("CARDS: 操作列を連結し、印刷番号を内容幅で詰めて表示する", async ({ page }) => {
  await page.goto("/#cards");

  const toolbarLayout = await page.locator(".cards-toolbar").evaluate((toolbar) => {
    const boxes = [...toolbar.children].map((child) => child.getBoundingClientRect());
    return {
      gap: getComputedStyle(toolbar).columnGap,
      siblingGaps: boxes.slice(1).map((box, index) => box.left - boxes[index]!.right),
    };
  });
  expect(toolbarLayout.gap).toBe("0px");
  expect(toolbarLayout.siblingGaps.every((gap) => gap <= 0.5)).toBe(true);

  await page.getByRole("textbox", { name: "カードを検索" }).fill("B09001");
  await page.getByRole("button", { name: "江戸川コナン", exact: true }).click();

  const printLayout = await page.locator(".cards-print-strip").evaluate((strip) => {
    const boxes = [...strip.querySelectorAll<HTMLElement>(".cards-print-chip")]
      .map((chip) => chip.getBoundingClientRect());
    const visualBoxes = [...strip.querySelectorAll<HTMLElement>(".cards-print-chip-inner")]
      .map((chip) => chip.getBoundingClientRect());
    const rows = new Map<number, DOMRect[]>();
    for (const box of boxes) {
      const key = Math.round(box.top);
      rows.set(key, [...(rows.get(key) ?? []), box]);
    }
    const rowTops = [...rows.keys()].sort((a, b) => a - b);
    const rowGaps = rowTops.slice(1).map((top, index) => {
      const previous = rows.get(rowTops[index]!)!;
      return top - Math.max(...previous.map((box) => box.bottom));
    });
    return {
      columnGap: getComputedStyle(strip).columnGap,
      minHitHeight: Math.min(...boxes.map((box) => box.height)),
      minHitWidth: Math.min(...boxes.map((box) => box.width)),
      minVisualHeight: Math.min(...visualBoxes.map((box) => box.height)),
      maxVisualHeight: Math.max(...visualBoxes.map((box) => box.height)),
      maxRowGap: Math.max(0, ...rowGaps),
      rowCount: rows.size,
      horizontalOverflow: strip.scrollWidth > strip.clientWidth,
    };
  });
  expect(printLayout.columnGap).toBe("2px");
  expect(printLayout.minHitHeight).toBeGreaterThanOrEqual(44);
  expect(printLayout.minHitWidth).toBeGreaterThanOrEqual(44);
  expect(printLayout.minVisualHeight).toBeGreaterThanOrEqual(24);
  expect(printLayout.maxVisualHeight).toBeLessThanOrEqual(26);
  expect(printLayout.maxRowGap).toBeLessThanOrEqual(2.5);
  expect(printLayout.rowCount).toBeGreaterThan(1);
  expect(printLayout.horizontalOverflow).toBe(false);
});

test("DECK: 検索・絞り込み・並び替えを隙間のない操作群にする", async ({ page }) => {
  await page.goto("/#deck");
  await expect(page.getByTestId("deck-editor")).toBeVisible({ timeout: 6000 });

  const layout = await page.locator(".deck-pool-controls-stack").evaluate((stack) => {
    const searchRow = stack.querySelector<HTMLElement>(".deck-pool-search-row")!;
    const sortRow = stack.querySelector<HTMLElement>(".deck-pool-sort-row")!;
    const stackBoxes = [...stack.children].map((child) => child.getBoundingClientRect());
    const searchBoxes = [...searchRow.children].map((child) => child.getBoundingClientRect());
    return {
      stackGap: getComputedStyle(stack).rowGap,
      searchGap: getComputedStyle(searchRow).columnGap,
      sortGap: getComputedStyle(sortRow.querySelector(".deck-pool-sort-controls")!).columnGap,
      verticalGap: stackBoxes[1]!.top - stackBoxes[0]!.bottom,
      searchSiblingGap: searchBoxes[1]!.left - searchBoxes[0]!.right,
    };
  });

  expect(layout.stackGap).toBe("0px");
  expect(layout.searchGap).toBe("0px");
  expect(layout.sortGap).toBe("0px");
  expect(layout.verticalGap).toBeLessThanOrEqual(0.5);
  expect(layout.searchSiblingGap).toBeLessThanOrEqual(0.5);
});
