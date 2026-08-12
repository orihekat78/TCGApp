// spec: .claude/specs/meta-ui/11-cards-rebuild.md

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("conan.meta.v1.settings");
    localStorage.removeItem("conan.meta.v1.filters");
  });
});

test("CARDS: 共通ヘッダーと簡潔な一覧を表示し、絞り込みは必要時だけ開く", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/#cards");

  const navigation = page.getByRole("navigation", {
    name: "メインナビゲーション",
  });
  await expect(navigation.getByRole("button")).toHaveText([
    "ホーム",
    "デッキ",
    "カード",
    "ゲーム開始",
    "チュートリアル",
    "履歴",
    "設定",
  ]);
  await expect(navigation.locator('[data-route="cards"]')).toHaveAttribute(
    "aria-current",
    "page",
  );

  await expect(
    page.getByRole("textbox", { name: "カードを検索" }),
  ).toBeVisible();
  await expect(page.getByText("使用デッキ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("採用デッキ", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "すべて", exact: true }),
  ).toHaveCount(0);

  const filterTrigger = page.locator(".cards-filter-trigger");
  await expect(filterTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("dialog", { name: "カードを絞り込む" }),
  ).toHaveCount(0);

  await filterTrigger.click();
  const dialog = page.getByRole("dialog", { name: "カードを絞り込む" });
  await expect(dialog).toBeVisible();
  await expect(filterTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    dialog.getByRole("button", { name: "紫", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "OR", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "AND", exact: true }),
  ).toHaveCount(0);

  const partnerFilter = dialog
    .getByRole("button")
    .filter({ hasText: /^パートナー/ })
    .first();
  await expect(partnerFilter).toHaveText("パートナー");
  await partnerFilter.click();
  await expect(dialog.locator("header strong")).toHaveText("1");

  await dialog.getByRole("button", { name: "一覧を見る" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(filterTrigger).toBeFocused();
  await expect(page.locator('.cards-grid-panel').getByRole("status")).toContainText("件のカード");

  await filterTrigger.click();
  await expect(
    dialog.getByRole("button", { name: "絞り込みを閉じる" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "一覧を見る" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "絞り込みを閉じる" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(filterTrigger).toBeFocused();

  await filterTrigger.click({ force: true });
  await dialog.locator('header button').click();
  await expect(dialog).toHaveCount(0);
  await expect(filterTrigger).toBeFocused();

  await filterTrigger.click();
  await page
    .locator(".cards-filter-backdrop")
    .click({ position: { x: 800, y: 200 } });
  await expect(dialog).toHaveCount(0);
  await expect(filterTrigger).toBeFocused();

  expect(errors).toEqual([]);
});

test("CARDS: 収録弾で絞り込むと、その商品の印刷カードだけを表示する", async ({ page }) => {
  await page.goto("/#cards");
  await page.locator(".cards-filter-trigger").click();
  const dialog = page.getByRole("dialog", { name: "カードを絞り込む" });
  await dialog.getByRole("button").filter({ hasText: /^CT-P10/ }).click();
  await dialog.getByRole("button", { name: "一覧を見る" }).click();

  const nums = await page.locator(".cards-grid-item").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-card-num") ?? ""),
  );
  expect(nums.length).toBeGreaterThan(0);
  expect(nums.every((num) => num.startsWith("B10"))).toBe(true);
});

test("CARDS: 折り畳み代表と別収録の表示カードも収録弾で絞り込める", async ({ page }) => {
  await page.goto("/#cards");
  await page.getByPlaceholder("カード名・番号・効果で検索").fill("D01001");
  await expect(page.locator('.cards-grid-item[data-card-num="D01001"]')).toBeVisible();

  await page.locator(".cards-filter-trigger").click();
  const dialog = page.getByRole("dialog", { name: "カードを絞り込む" });
  const setFilter = dialog.getByRole("button").filter({ hasText: /^CT-D01/ });
  await expect(setFilter).toBeEnabled();
});

test("CARDS: 検索はカード番号と名前を絞り込み、視覚的な枚数見出しを追加しない", async ({
  page,
}) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");

  await search.fill("D09014");
  await expect(page.locator('.cards-grid-panel').getByRole("status")).toHaveText("1件のカード");
  await expect(
    page
      .locator(".cards-grid-panel")
      .getByRole("button", { name: "大和敢助", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cards-selected-detail")).toContainText(
    "大和敢助",
  );
  await expect(page.locator(".cards-toolbar")).not.toContainText(
    /\d+\s*(枚|件|種類)/,
  );
});

test("CARDS: 同じカードの別イラストを選択でき、デッキ分析は表示しない", async ({
  page,
}) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("B09001");
  await page.getByRole("button", { name: "江戸川コナン", exact: true }).click();

  const printChoices = page.locator(".cards-print-variants button");
  for (const printNumber of [
    "B06001Sec2",
    "B09001",
    "B09001P",
    "PR001",
    "PR002",
    "PR007",
  ]) {
    await expect(
      printChoices.filter({ hasText: new RegExp(`^${printNumber}$`) }),
    ).toHaveCount(1);
  }
  await page.getByRole("radio", { name: "印刷番号 PR001", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "印刷番号 PR001", exact: true }),
  ).toHaveAttribute("aria-checked", "true");

  await expect(page.getByText("使用デッキ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("採用デッキ", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /デッキへ追加/ })).toHaveCount(
    0,
  );
});

test("CARDS: お気に入りをlocalStorageへ保存する", async ({ page }) => {
  await page.goto("/#cards");
  const favorite = page.getByRole("button", {
    name: "★ お気に入り",
    exact: true,
  });
  await expect(favorite).toBeVisible();
  await favorite.click();

  const favoriteCount = await page.evaluate(() => {
    const raw = localStorage.getItem("conan.meta.v1.settings");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.state?.settings?.favorites?.length ?? 0;
  });
  expect(favoriteCount).toBeGreaterThanOrEqual(1);
});

test("CARDS: D09014は正しい公式画像を表示する", async ({ page }) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("D09014");

  const image = page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "大和敢助", exact: true })
    .locator("img");
  await expect(image).toHaveAttribute("src", /1743742875201036\.jpg$/);
  await expect
    .poll(
      () => image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
});

test("CARDS: B07011は正しい公式画像を表示する", async ({ page }) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("B07011");

  const image = page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "福井柚嬉", exact: true })
    .locator("img");
  await expect(image).toHaveAttribute("src", /1762413976102325\.jpg$/);
  await expect
    .poll(
      () => image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
});

test("CARDS: 色は実カードの単色・混色をすべて表示する", async ({ page }) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");

  await search.fill("B04059");
  await page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "水無怜奈", exact: true })
    .click();
  await expect(page.locator('[data-card-colors="red"]')).toBeVisible();
  await expect(page.locator('[data-card-colors="red"]')).toHaveText("RED");

  await search.fill("B10097");
  await page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "毛利蘭＆ベルモット", exact: true })
    .click();
  await expect(page.locator('[data-card-colors="blue,black"]')).toBeVisible();
  await expect(page.locator('[data-card-colors="blue,black"]')).toHaveText(
    "BLUEBLACK",
  );
});

test("CARDS: 縦横比を維持し、左から右へ並べて次の行へ進む", async ({
  page,
}) => {
  await page.goto("/#cards");
  const landscapeCard = page.getByRole("button", {
    name: "青の古城探索事件",
    exact: true,
  });
  await expect
    .poll(async () => {
      const box = await landscapeCard.boundingBox();
      return (box?.height ?? 0) / (box?.width ?? 1);
    })
    .toBeCloseTo(0.72, 1);

  const rowMajor = await page
    .locator(".cards-grid-item")
    .evaluateAll((items) => {
      const rects = items
        .slice(0, 20)
        .map((item) => item.getBoundingClientRect());
      const startsAcrossTheFirstRow =
        rects.length > 1 &&
        Math.abs(rects[1]!.top - rects[0]!.top) <= 1 &&
        rects[1]!.left > rects[0]!.left;
      return (
        startsAcrossTheFirstRow &&
        rects.slice(1).every((current, index) => {
          const previous = rects[index]!;
          const sameRow = Math.abs(current.top - previous.top) <= 1;
          return sameRow
            ? current.left > previous.left
            : current.top > previous.top;
        })
      );
    });
  expect(rowMajor).toBe(true);
});

test("CARDS: 851×393の小型タイル表示は7列で、選択した横長カードを読める大きさで保つ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/#cards");

  const firstEightGridItems = await page
    .locator(".cards-grid-item")
    .evaluateAll((items) =>
      items.slice(0, 8).map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );

  expect(firstEightGridItems).toHaveLength(8);
  expect(
    firstEightGridItems
      .slice(0, 7)
      .every((item) => item.top === firstEightGridItems[0]!.top),
  ).toBe(true);
  expect(firstEightGridItems[6]!.left).toBeGreaterThan(
    firstEightGridItems[5]!.left,
  );
  expect(firstEightGridItems[7]!.top).toBeGreaterThan(
    firstEightGridItems[0]!.top,
  );

  await page.setViewportSize({ width: 667, height: 375 });
  const narrowLandscape = await page
    .locator(".cards-card-grid")
    .evaluate((grid) => {
      const items = Array.from(grid.children)
        .slice(0, 6)
        .map((item) => {
          const box = item.getBoundingClientRect();
          return { top: box.top, left: box.left };
        });
      const screen = document.querySelector<HTMLElement>(".cards-screen")!;
      return {
        items,
        overflowX: screen.scrollWidth - screen.clientWidth,
        overflowY: screen.scrollHeight - screen.clientHeight,
      };
    });
  expect(
    narrowLandscape.items
      .slice(0, 5)
      .every((item) => item.top === narrowLandscape.items[0]!.top),
  ).toBe(true);
  expect(narrowLandscape.items[5]!.top).toBeGreaterThan(
    narrowLandscape.items[0]!.top,
  );
  expect(narrowLandscape.overflowX).toBe(0);
  expect(narrowLandscape.overflowY).toBe(0);

  await page.setViewportSize({ width: 851, height: 393 });

  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("D08026");
  await page
    .getByRole("button", { name: "青の古城探索事件", exact: true })
    .click();
  const selectedLandscapeCard = page.locator(".cards-selected-art > div");
  await expect(selectedLandscapeCard).toHaveAttribute(
    "data-card-orientation",
    "landscape",
  );
  const selectedLandscapeArt = await selectedLandscapeCard.boundingBox();
  expect(selectedLandscapeArt?.width ?? 0).toBeGreaterThanOrEqual(110);

  const dimensions = await page.locator(".cards-screen").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
});

test("CARDS: 851×393でも比率を維持し、画面外にはみ出さない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto("/#cards");

  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("B09001");
  await page.getByRole("button", { name: "江戸川コナン", exact: true }).click();
  const detailScroll = page.locator(".cards-selected-scroll");
  const printStrip = detailScroll.locator(".cards-print-strip");
  const compactStrip = await printStrip.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(compactStrip.scrollWidth).toBeLessThanOrEqual(
    compactStrip.clientWidth,
  );

  for (const chip of await printStrip.locator(".cards-print-chip").all()) {
    await chip.focus();
    const visibleInsideDetail = await chip.evaluate((element) => {
      const item = element.getBoundingClientRect();
      const viewport = element
        .closest<HTMLElement>(".cards-selected-scroll")!
        .getBoundingClientRect();
      return item.top >= viewport.top && item.bottom <= viewport.bottom;
    });
    expect(visibleInsideDetail).toBe(true);
  }

  const dimensions = await page
    .locator(".cards-screen")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);

  await search.fill("D09014");
  const portraitCard = page.getByRole("button", {
    name: "大和敢助",
    exact: true,
  });
  const portraitBox = await portraitCard.boundingBox();
  expect(portraitBox).not.toBeNull();
  expect((portraitBox?.height ?? 0) / (portraitBox?.width ?? 1)).toBeCloseTo(
    1.4,
    1,
  );

  await search.fill("D08026");
  const landscapeCard = page.getByRole("button", {
    name: "青の古城探索事件",
    exact: true,
  });
  const landscapeBox = await landscapeCard.boundingBox();
  expect(landscapeBox).not.toBeNull();
  expect((landscapeBox?.height ?? 0) / (landscapeBox?.width ?? 1)).toBeCloseTo(
    0.72,
    1,
  );

  const filterTrigger = page.locator(".cards-filter-trigger");
  await filterTrigger.click();
  const dialog = page.getByRole("dialog", { name: "カードを絞り込む" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    851,
  );
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(
    393,
  );
  await expect(dialog.locator(".cards-filter-scroll")).toHaveCSS(
    "overflow-y",
    "auto",
  );

  await expect(
    dialog.getByRole("group", { name: "特徴の一致方法" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("group", { name: "キーワードの一致方法" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "紫", exact: true }),
  ).toHaveCount(0);

  const undersizedDrawerTargets = await dialog
    .locator("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => !(button as HTMLButtonElement).disabled)
        .map((button) => {
          const box = button.getBoundingClientRect();
          return {
            text: button.textContent?.trim(),
            width: box.width,
            height: box.height,
          };
        })
        .filter((box) => box.width < 44 || box.height < 44),
    );
  expect(undersizedDrawerTargets).toEqual([]);

  await dialog.getByRole("button", { name: "一覧を見る" }).click();
  await expect(
    page.getByRole("button", { name: /^★ お気に入り/ }),
  ).toBeVisible();
  const undersizedMainTargets = await page
    .locator(".cards-main button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => !button.classList.contains("cards-print-chip"))
        .map((button) => {
          const box = button.getBoundingClientRect();
          return {
            label:
              button.getAttribute("aria-label") ?? button.textContent?.trim(),
            width: box.width,
            height: box.height,
          };
        })
        .filter((box) => box.width < 44 || box.height < 44),
    );
  expect(undersizedMainTargets).toEqual([]);
});

test("CARDS: 667×375でもヘッダーに隠れず、検索と一覧を操作できる", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 667, height: 375 });
  for (const [route, mainSelector] of [
    ["home", ".home-main"],
    ["cards", ".cards-main"],
    ["setup", ".setup-main"],
  ] as const) {
    await page.goto(`/#${route}`);
    const header = await page.locator(".home-header").boundingBox();
    const main = await page.locator(mainSelector).boundingBox();
    expect(header).not.toBeNull();
    expect(main).not.toBeNull();
    expect((header?.y ?? 0) + (header?.height ?? 0)).toBeLessThanOrEqual(
      (main?.y ?? 0) + 0.5,
    );

    const navBottoms = await page.locator(".home-navigation button").evaluateAll(
      (buttons) => buttons.map((button) => button.getBoundingClientRect().bottom),
    );
    expect(navBottoms.every((bottom) => bottom <= (main?.y ?? 0) + 0.5)).toBe(true);
  }

  await page.goto("/#cards");

  const search = page.getByRole("textbox", { name: "カードを検索" });
  const searchBox = await search.boundingBox();
  expect(searchBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(searchBox?.height ?? 0).toBeGreaterThanOrEqual(43.9);

  const firstCard = page.locator(".cards-grid-item [role='button']").first();
  const firstCardName = await firstCard.getAttribute("aria-label");
  const firstCardBox = await firstCard.boundingBox();
  expect(firstCardBox).not.toBeNull();
  await firstCard.click({
    position: {
      x: (firstCardBox?.width ?? 0) / 2,
      y: (firstCardBox?.height ?? 0) / 2,
    },
  });
  await expect(page.locator(".cards-selected-identity")).toContainText(
    firstCardName ?? "",
  );
  expect(errors).toEqual([]);
});

test("CARDS: 標準カード寸法とコンパクト選択詳細を保つ", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#cards");
  const desktopGrid = page.locator(".cards-card-grid");
  const desktopItems = await desktopGrid.locator(":scope > .cards-grid-item").evaluateAll(
    (items) => items.slice(0, 9).map((item) => {
      const box = item.getBoundingClientRect();
      const card = item.querySelector<HTMLElement>("[data-card-orientation]")!;
      const cardBox = card.getBoundingClientRect();
      return { left: box.left, top: box.top, width: cardBox.width };
    }),
  );
  expect(desktopItems).toHaveLength(9);
  expect(desktopItems.slice(0, 8).every((item) => item.top === desktopItems[0]!.top)).toBe(true);
  expect(desktopItems[8]!.top).toBeGreaterThan(desktopItems[0]!.top);
  expect(desktopItems[0]!.width).toBeCloseTo(104, 0);

  for (const viewport of [
    { width: 851, height: 393 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/#cards");
    const search = page.getByRole("textbox", { name: "カードを検索" });
    const searchBox = await search.boundingBox();
    expect(searchBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(searchBox?.height ?? 0).toBeGreaterThanOrEqual(43.9);

    await search.fill("B09001");
    const selectedGridCard = page.locator(".cards-grid-item [role='button']").first();
    const selectedName = await selectedGridCard.getAttribute("aria-label");
    await selectedGridCard.click();
    const selectedScroll = page.locator(".cards-selected-scroll");
    const summary = page.locator(".cards-print-summary");
    const currentPrint = page.locator('.cards-print-chip[aria-checked="true"]');
    await expect(summary).toContainText(
      `${selectedName} · ${(await currentPrint.textContent())?.trim()}`,
    );
    await expect(summary.getByText("別イラスト (27)", { exact: true })).toBeVisible();
    const [scrollBox, summaryBox, scrollTop] = await Promise.all([
      selectedScroll.boundingBox(),
      summary.boundingBox(),
      selectedScroll.evaluate((element) => element.scrollTop),
    ]);
    expect(scrollTop).toBe(0);
    expect(summaryBox?.top ?? 0).toBeGreaterThanOrEqual(scrollBox?.top ?? 0);
    expect(summaryBox?.bottom ?? 0).toBeLessThanOrEqual(scrollBox?.bottom ?? 0);

    const selectedImage = page.locator(".cards-selected-art img");
    await expect.poll(() => selectedImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(selectedImage).toHaveCSS("object-fit", "contain");
    for (const chip of await page.locator(".cards-print-chip").all()) {
      const chipBox = await chip.boundingBox();
      const visualBox = await chip.locator(".cards-print-chip-inner").boundingBox();
      expect(chipBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(chipBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(visualBox?.height ?? 0).toBeGreaterThanOrEqual(24);
      expect(visualBox?.height ?? 0).toBeLessThanOrEqual(26);
    }
  }

  for (const cardNumber of ["D08003", "B06012", "D08026"]) {
    await page.getByRole("textbox", { name: "カードを検索" }).fill(cardNumber);
    await page.locator(".cards-grid-item [role='button']").first().click();
    const image = page.locator(".cards-selected-art img");
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveCSS("object-fit", "contain");
  }
  expect(errors).toEqual([]);
});

test("CARDS: 全印刷番号を折り返して表示し、別イラストを直接選択できる", async ({
  page,
}) => {
  await page.goto("/#home");
  const homeScrollbar = await page
    .locator(".home-news-list")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rail = getComputedStyle(element, "::-webkit-scrollbar");
      const thumb = getComputedStyle(element, "::-webkit-scrollbar-thumb");
      return {
        color: style.scrollbarColor,
        width: style.scrollbarWidth,
        webkitWidth: rail.width,
        webkitHeight: rail.height,
        webkitThumbColor: thumb.backgroundColor,
      };
    });
  await page.goto("/#cards");
  const search = page.getByPlaceholder("カード名・番号・効果で検索");
  await search.fill("B09001");
  await page.getByRole("button", { name: "江戸川コナン", exact: true }).click();

  const printSelector = page.locator(".cards-print-selector");
  await expect(printSelector).toBeVisible();
  const selectedScroll = page.locator(".cards-selected-scroll");
  await expect(
    selectedScroll.locator(
      ":scope > .cards-selected-art + .cards-print-selector + .cards-selected-identity",
    ),
  ).toHaveCount(1);
  await expect(printSelector).toHaveAttribute("role", "radiogroup");
  await expect(printSelector).toHaveAttribute("aria-label", "別イラスト");
  await expect(
    printSelector.getByText("別イラスト (27)", { exact: true }),
  ).toBeVisible();

  const chips = printSelector.locator(".cards-print-chip");
  const printNumbers = (await chips.allTextContents()).map((printNumber) =>
    printNumber.trim(),
  );
  expect(printNumbers).toHaveLength(27);
  expect(printNumbers).toEqual(
    expect.arrayContaining([
      "B06001Sec2",
      "B09001",
      "B09001P",
      "PR001",
      "PR002",
      "PR007",
    ]),
  );
  expect(new Set(printNumbers).size).toBe(printNumbers.length);
  const activePrint = printSelector.locator(
    '.cards-print-chip[aria-checked="true"]',
  );
  const selectedCard = page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "江戸川コナン", exact: true });
  await selectedCard.focus();
  await page.keyboard.press("Enter");
  await expect(activePrint).toBeFocused();
  await expect(printSelector.locator('.cards-print-chip[tabindex="0"]')).toHaveCount(1);
  await expect(printSelector.locator('.cards-print-chip[tabindex="-1"]')).toHaveCount(
    printNumbers.length - 1,
  );
  const initialPrintNumber = (await activePrint.textContent())!.trim();
  const initialIndex = printNumbers.indexOf(initialPrintNumber);
  await activePrint.focus();
  await page.keyboard.press("ArrowRight");
  const nextIndex = (initialIndex + 1) % printNumbers.length;
  await expect(activePrint).toHaveText(printNumbers[nextIndex]!);
  await expect(chips.nth(nextIndex)).toBeFocused();
  const selectedFocusRing = await chips
    .nth(nextIndex)
    .locator(".cards-print-chip-inner")
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(selectedFocusRing).toContain("rgb(3, 19, 30)");
  for (const [index, printNumber] of printNumbers.entries()) {
    const chip = chips.nth(index);
    await expect(chip).toHaveRole("radio");
    await expect(chip).toHaveAttribute("aria-label", `印刷番号 ${printNumber}`);
    const chipBox = await chip.boundingBox();
    const visualBox = await chip.locator(".cards-print-chip-inner").boundingBox();
    expect(chipBox?.width).toBeGreaterThanOrEqual(44);
    expect(chipBox?.height).toBeGreaterThanOrEqual(44);
    expect(visualBox?.height).toBeGreaterThanOrEqual(24);
    expect(visualBox?.height).toBeLessThanOrEqual(26);
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(activePrint).toHaveText(printNumber);
  }
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(chips.nth(1)).toHaveCSS("outline-style", "none");
  await expect(chips.nth(1)).not.toBeFocused();
  await expect(
    printSelector.getByRole("button", { name: "次の別イラスト", exact: true }),
  ).toHaveCount(0);

  const printStrip = printSelector.locator(".cards-print-strip");
  const stripLayout = await printStrip.evaluate((element) => {
    const strip = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const chips = [
      ...element.querySelectorAll<HTMLElement>(".cards-print-chip"),
    ];
    const boxes = chips.map((chip) => chip.getBoundingClientRect());
    const sameRowGaps = boxes.slice(1).flatMap((box, index) => {
      const previous = boxes[index]!;
      return Math.abs(previous.top - box.top) < 1
        ? [box.left - previous.right]
        : [];
    });
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      justifyContent: style.justifyContent,
      minChipWidth: Math.min(...boxes.map((box) => box.width)),
      maxChipWidth: Math.max(...boxes.map((box) => box.width)),
      maxSameRowGap: Math.max(...sameRowGaps),
      clipped: chips.some((chip) => {
        const box = chip.getBoundingClientRect();
        return (
          box.left < strip.left ||
          box.right > strip.right ||
          box.top < strip.top ||
          box.bottom > strip.bottom
        );
      }),
    };
  });
  expect(stripLayout.scrollWidth).toBeLessThanOrEqual(stripLayout.clientWidth);
  expect(stripLayout.justifyContent).toBe("normal");
  expect(stripLayout.minChipWidth).toBeGreaterThanOrEqual(44);
  expect(stripLayout.maxChipWidth).toBeGreaterThan(stripLayout.minChipWidth);
  expect(stripLayout.maxChipWidth).toBeLessThanOrEqual(stripLayout.clientWidth);
  expect(stripLayout.maxSameRowGap).toBeLessThanOrEqual(4.1);
  expect(stripLayout.clipped).toBe(false);

  await search.fill("D08002");
  const singlePrintCard = page
    .locator(".cards-grid-panel")
    .getByRole("button", { name: "哀 歩美 光彦 元太", exact: true });
  await singlePrintCard.focus();
  await page.keyboard.press("Enter");
  await expect(printSelector).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "哀 歩美 光彦 元太 を拡大表示",
      exact: true,
    }),
  ).toBeFocused();

  await page.locator(".cards-filter-trigger").click();
  expect(homeScrollbar).toEqual({
    color: "rgba(121, 212, 236, 0.55) rgba(0, 0, 0, 0)",
    width: "thin",
    webkitWidth: "5px",
    webkitHeight: "5px",
    webkitThumbColor: "rgba(121, 212, 236, 0.55)",
  });
  for (const selector of [
    ".cards-grid-scroll",
    ".cards-selected-scroll",
    ".cards-filter-scroll",
  ]) {
    await expect(page.locator(selector)).toHaveCount(1);
    const scrollbar = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      const rail = getComputedStyle(element, "::-webkit-scrollbar");
      const thumb = getComputedStyle(element, "::-webkit-scrollbar-thumb");
      return {
        color: style.scrollbarColor,
        width: style.scrollbarWidth,
        webkitWidth: rail.width,
        webkitHeight: rail.height,
        webkitThumbColor: thumb.backgroundColor,
      };
    });
    expect(scrollbar).toEqual(homeScrollbar);
  }
});

test("CARDS: selected detail exposes only the card-kind-relevant stats", async ({
  page,
}) => {
  await page.goto("/#cards");
  const search = page.getByPlaceholder(
    "\u30ab\u30fc\u30c9\u540d\u30fb\u756a\u53f7\u30fb\u52b9\u679c\u3067\u691c\u7d22",
  );
  const stats = page.getByRole("group", {
    name: "\u30ab\u30fc\u30c9\u306e\u80fd\u529b\u5024",
  });

  const selectCard = async (num: string, name: string) => {
    await search.fill(num);
    await page
      .locator(".cards-grid-panel")
      .getByRole("button", { name, exact: true })
      .click();
  };

  await selectCard("D08001", "\u6c5f\u6238\u5ddd\u30b3\u30ca\u30f3");
  await expect(stats.getByRole("group")).toHaveCount(1);
  await expect(stats.getByRole("group", { name: "LP 1" })).toBeVisible();
  await expect(stats).toHaveText(/^\s*LP\s*1\s*$/);

  await selectCard(
    "D08026",
    "\u9752\u306e\u53e4\u57ce\u63a2\u7d22\u4e8b\u4ef6",
  );
  await expect(stats.getByRole("group")).toHaveCount(2);
  await expect(
    stats.getByRole("group", { name: "\u5148\u653b 7\u679a" }),
  ).toBeVisible();
  await expect(
    stats.getByRole("group", { name: "\u5f8c\u653b 6\u679a" }),
  ).toBeVisible();
  await expect(stats).toHaveText(
    /^\s*\u5148\u653b\s*7\u679a\s*\u5f8c\u653b\s*6\u679a\s*$/,
  );

  await selectCard("B09107", "\u72af\u4eba\u305f\u3061\u306e\u72af\u884c");
  await page
    .getByRole("radio", { name: "印刷番号 B09107P", exact: true })
    .click();
  await expect(stats.getByRole("group")).toHaveCount(2);
  await expect(
    stats.getByRole("group", { name: "\u5148\u653b 0\u679a" }),
  ).toBeVisible();
  await expect(
    stats.getByRole("group", { name: "\u5f8c\u653b 0\u679a" }),
  ).toBeVisible();
  await expect(stats).toHaveText(
    /^\s*\u5148\u653b\s*0\u679a\s*\u5f8c\u653b\s*0\u679a\s*$/,
  );

  await selectCard(
    "D08024",
    "\u300c\u3042\u3089\u2026\u983c\u3082\u3057\u3044\u3058\u3083\u306a\u3044\u2026\u300d",
  );
  await expect(stats.getByRole("group")).toHaveCount(1);
  await expect(stats.getByRole("group", { name: "C 6" })).toBeVisible();
  await expect(stats).toHaveText(/^\s*C\s*6\s*$/);

  await selectCard("D08003", "\u6c5f\u6238\u5ddd\u30b3\u30ca\u30f3");
  await expect(stats.getByRole("group")).toHaveCount(3);
  await expect(stats.getByRole("group", { name: "C 8" })).toBeVisible();
  await expect(stats.getByRole("group", { name: "AP 7,000" })).toBeVisible();
  await expect(stats.getByRole("group", { name: "LP 2" })).toBeVisible();
  await expect(stats).toHaveText(/^\s*C\s*8\s*AP\s*7,000\s*LP\s*2\s*$/);
});
