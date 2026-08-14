import { expect, test, type Page } from '@playwright/test';

const PLAYMAT_WIDTH = 1920;
const PLAYMAT_HEIGHT = 1080;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 888 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 851, height: 393 },
  { width: 720, height: 393 },
  { width: 667, height: 375 },
] as const;

type Viewport = (typeof viewports)[number];

async function enterMatchThroughPublicUi(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const url = message.location()?.url ?? '';
    if (text.includes('Failed to load resource') && /404/.test(text)) return;
    if (/favicon\.ico|robots\.txt/.test(url)) return;
    errors.push(`console.error: ${text}`);
  });

  await page.goto('/#setup');
  await expect(page).toHaveURL(/#setup$/);
  // 現行の公開入口は段階移行中。どちらも利用者が押す「対戦を開始」操作であり、
  // ここではテスト専用の状態注入に替えない。
  const start = page.locator('.setup-start, [data-testid="game-setup-start"]').first();
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();
  await start.click();

  const skipMulligan = page.locator('button.mulligan-skip');
  await expect(skipMulligan).toBeVisible();
  await skipMulligan.click();
  await expect(skipMulligan).toBeHidden();
  await expect(page.locator('#scaler')).toBeVisible();
  return errors;
}

async function expectMatchVisualGate(page: Page, viewport: Viewport): Promise<void> {
  const observed = await page.evaluate(() => {
    const mustFind = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      return element;
    };
    const rect = (selector: string) => {
      const value = mustFind<HTMLElement>(selector).getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
    };
    const scaler = mustFind<HTMLElement>('#scaler');
    return {
      scale: Number(scaler.dataset.stageScale),
      layout: scaler.dataset.playmatLayout,
      logicalWidth: Number(scaler.dataset.playmatLogicalWidth),
      logicalHeight: Number(scaler.dataset.playmatLogicalHeight),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      core: [
        rect('.board-content'),
        rect('.actions-panel'),
        rect('button.end-turn-btn'),
        rect('button.panel-log-btn'),
      ],
    };
  });

  expect(observed.viewport).toEqual(viewport);
  expect(observed.layout).toBe('desktop');
  expect(observed.logicalWidth).toBe(PLAYMAT_WIDTH);
  expect(observed.logicalHeight).toBe(PLAYMAT_HEIGHT);
  expect(observed.scale).toBeCloseTo(
    Math.min(viewport.width / PLAYMAT_WIDTH, viewport.height / PLAYMAT_HEIGHT),
    4,
  );
  expect(observed.overflow).toBeLessThanOrEqual(0);
  for (const bounds of observed.core) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
  }

  const logControl = page.locator('button.panel-log-btn');
  await logControl.focus();
  await expect(logControl).toBeFocused();
  await expect(logControl).toHaveAttribute('aria-pressed', 'false');
  await logControl.click();
  await expect(page.locator('.log-panel')).toBeVisible();
  await expect(logControl).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.log-panel')).toBeHidden();
}

async function expectPlayerMatZonesNotToOverlap(page: Page): Promise<void> {
  const collisions = await page.evaluate(() => {
    type Bounds = { left: number; top: number; right: number; bottom: number };
    const CONTAINMENT_TOLERANCE = 0.75;
    const toBounds = (element: Element): Bounds => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    const intersects = (first: Bounds, second: Bounds): boolean =>
      first.left < second.right && first.right > second.left &&
      first.top < second.bottom && first.bottom > second.top;
    const contains = (outer: Bounds, inner: Bounds): boolean =>
      inner.left >= outer.left - CONTAINMENT_TOLERANCE &&
      inner.right <= outer.right + CONTAINMENT_TOLERANCE &&
      inner.top >= outer.top - CONTAINMENT_TOLERANCE &&
      inner.bottom <= outer.bottom + CONTAINMENT_TOLERANCE;

    return [...document.querySelectorAll<HTMLElement>('.mat')].flatMap((mat) => {
      const side = mat.dataset.side ?? 'unknown';
      const caseArea = mat.querySelector('.case-area .case-zone');
      const caseHeader = mat.querySelector('.case-area .zone-label');
      const caseEdition = mat.querySelector('.case-area .zone-label .case-edition-tag');
      const evidenceArea = mat.querySelector('.evidence-area');
      const evidenceHeader = mat.querySelector('.evidence-area .zone-label');
      const sceneArea = mat.querySelector('.scene-area');
      const sceneHeader = mat.querySelector('.scene-area > .zone-label');
      const fileArea = mat.querySelector('.file-area');
      const fileHeader = mat.querySelector('.file-area .file-strip-header');
      if (!caseArea || !caseHeader || !caseEdition || !evidenceArea || !evidenceHeader ||
          !sceneArea || !sceneHeader || !fileArea || !fileHeader) {
        throw new Error(`missing player mat zones for ${side}`);
      }

      const zones = {
        caseArea: toBounds(caseArea),
        caseHeader: toBounds(caseHeader),
        caseEdition: toBounds(caseEdition),
        evidenceArea: toBounds(evidenceArea),
        evidenceHeader: toBounds(evidenceHeader),
        sceneArea: toBounds(sceneArea),
        sceneHeader: toBounds(sceneHeader),
        fileArea: toBounds(fileArea),
        fileHeader: toBounds(fileHeader),
      };
      const primaryZones = [
        ['caseArea', 'case-area'],
        ['evidenceArea', 'evidence-area'],
        ['sceneArea', 'scene-area'],
        ['fileArea', 'FILE area'],
      ] as const;
      const viewportBounds: Bounds = {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };
      const overlaps = primaryZones.flatMap(([firstKey, firstLabel], firstIndex) =>
        primaryZones.slice(firstIndex + 1).flatMap(([secondKey, secondLabel]) =>
          intersects(zones[firstKey], zones[secondKey])
            ? [`${side}: ${firstLabel} ${JSON.stringify(zones[firstKey])} overlaps ${secondLabel} ${JSON.stringify(zones[secondKey])}`]
            : [],
        ),
      );
      const viewportEscapes = primaryZones.flatMap(([zoneKey, label]) =>
        contains(viewportBounds, zones[zoneKey])
          ? []
          : [`${side}: ${label} ${JSON.stringify(zones[zoneKey])} escapes viewport ${JSON.stringify(viewportBounds)}`],
      );
      const containmentChecks = [
        ['caseArea', 'caseHeader', 'case header'],
        ['caseHeader', 'caseEdition', 'case edition status'],
        ['evidenceArea', 'evidenceHeader', 'evidence header'],
        ['sceneArea', 'sceneHeader', 'scene header'],
        ['fileArea', 'fileHeader', 'FILE header'],
      ] as const;
      const visibleChildren = [
        [caseArea, caseArea.querySelectorAll('.case-card, .case-card-detail'), 'case child'],
        [evidenceArea, evidenceArea.querySelectorAll('.stack-display, .count-overlay'), 'evidence child'],
        [sceneArea, sceneArea.querySelectorAll('.scene-slots, .card'), 'scene child'],
        [fileArea, fileArea.querySelectorAll('.stack-display, .count-overlay, [role="progressbar"]'), 'FILE child'],
      ] as const;
      return overlaps.concat(viewportEscapes).concat(
        containmentChecks.flatMap(([outerKey, innerKey, label]) =>
          contains(zones[outerKey], zones[innerKey])
            ? []
            : [`${side}: ${label} escapes its owning zone`],
        ),
      ).concat(
        [caseHeader, evidenceHeader, sceneHeader, fileHeader].flatMap((header) =>
          header.scrollWidth <= header.clientWidth + 1 && header.scrollHeight <= header.clientHeight + 1
            ? []
            : [`${side}: zone header content overflows`],
        ),
      ).concat(
        visibleChildren.flatMap(([owner, children, label]) => {
          const ownerBounds = toBounds(owner);
          return [...children].flatMap((child) => {
            const childBounds = toBounds(child);
            if (childBounds.right <= childBounds.left || childBounds.bottom <= childBounds.top) return [];
            return contains(ownerBounds, childBounds)
              ? []
              : [`${side}: ${label} ${JSON.stringify(childBounds)} escapes ${JSON.stringify(ownerBounds)}`];
          });
        }),
      );
    });
  });

  expect(collisions).toEqual([]);
}

async function expectCaseMetadataUsableAtRenderedScale(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const scaler = document.querySelector<HTMLElement>('#scaler');
    if (!scaler) throw new Error('missing scaler');
    const stageScale = Number(scaler.dataset.stageScale);
    return [...document.querySelectorAll<HTMLElement>('.mat')].map((mat) => {
      const status = mat.querySelector<HTMLElement>('.case-edition-tag');
      const detail = mat.querySelector<HTMLElement>('.case-card-detail');
      const detailSurface = detail?.querySelector<HTMLElement>('span');
      if (!status || !detail || !detailSurface) {
        throw new Error(`missing case metadata control for ${mat.dataset.side}`);
      }
      const statusStyle = getComputedStyle(status);
      const transform = statusStyle.transform === 'none'
        ? new DOMMatrix()
        : new DOMMatrix(statusStyle.transform);
      const localScale = Math.hypot(transform.a, transform.b);
      const detailBounds = detail.getBoundingClientRect();
      const detailSurfaceBounds = detailSurface.getBoundingClientRect();
      const detailStyle = getComputedStyle(detail);
      return {
        side: mat.dataset.side,
        statusTransform: statusStyle.transform,
        renderedFontPx: parseFloat(statusStyle.fontSize) * stageScale * localScale,
        detailWidth: detailBounds.width,
        detailHeight: detailBounds.height,
        detailSurfaceWidth: detailSurfaceBounds.width,
        detailSurfaceHeight: detailSurfaceBounds.height,
        detailBackground: detailStyle.backgroundColor,
        detailBorderWidth: detailStyle.borderTopWidth,
      };
    });
  });

  for (const metric of metrics) {
    if (metric.side === 'opp') {
      expect(metric.statusTransform, 'opp case status counter-rotation').toBe('matrix(-1, 0, 0, -1, 0, 0)');
    } else {
      expect(metric.statusTransform, 'self case status orientation').toBe('none');
    }
    expect(metric.renderedFontPx, `${metric.side} case status font`).toBeGreaterThanOrEqual(9.95);
    expect(metric.detailWidth, `${metric.side} case detail width`).toBeGreaterThanOrEqual(43.5);
    expect(metric.detailHeight, `${metric.side} case detail height`).toBeGreaterThanOrEqual(43.5);
    expect(metric.detailSurfaceWidth, `${metric.side} case detail visible surface width`).toBeGreaterThanOrEqual(24);
    expect(metric.detailSurfaceWidth, `${metric.side} case detail visible surface width`).toBeLessThanOrEqual(28);
    expect(metric.detailSurfaceHeight, `${metric.side} case detail visible surface height`).toBeGreaterThanOrEqual(24);
    expect(metric.detailSurfaceHeight, `${metric.side} case detail visible surface height`).toBeLessThanOrEqual(28);
    expect(metric.detailBackground).toBe('rgba(0, 0, 0, 0)');
    expect(metric.detailBorderWidth).toBe('0px');
  }
}

test.describe('MATCH visual scale gates', () => {
  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height}: public MATCH fits and remains operable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const errors = await enterMatchThroughPublicUi(page);
      await expectMatchVisualGate(page, viewport);
      await expectPlayerMatZonesNotToOverlap(page);
      await expectCaseMetadataUsableAtRenderedScale(page);
      expect(errors).toEqual([]);
    });
  }

  test('resize updates the public MATCH scale and preserves controls', async ({ page }) => {
    const initial = viewports[0];
    const resized = viewports[4];
    await page.setViewportSize(initial);
    const errors = await enterMatchThroughPublicUi(page);
    await expectMatchVisualGate(page, initial);
    await expectPlayerMatZonesNotToOverlap(page);
    await expectCaseMetadataUsableAtRenderedScale(page);

    await page.setViewportSize(resized);
    await expect
      .poll(async () => Number(await page.locator('#scaler').getAttribute('data-stage-scale')))
      .toBeCloseTo(Math.min(resized.width / PLAYMAT_WIDTH, resized.height / PLAYMAT_HEIGHT), 4);
    await expectMatchVisualGate(page, resized);
    await expectPlayerMatZonesNotToOverlap(page);
    await expectCaseMetadataUsableAtRenderedScale(page);
    expect(errors).toEqual([]);
  });

  test('851x393: FILE opens from Enter and Space and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const errors = await enterMatchThroughPublicUi(page);
    const fileArea = page.locator('.file-area.side-self');

    for (const key of ['Enter', 'Space']) {
      await fileArea.focus();
      await expect(fileArea).toBeFocused();
      await page.keyboard.press(key);
      await expect(page.locator('.card-list-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.card-list-modal')).toBeHidden();
      await expect(fileArea).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
});
