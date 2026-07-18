import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildGameState, dispatchAction, getGameState, setupGamePage } from './helpers';

async function humanMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } };
    };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function expectInViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'target has a layout box').not.toBeNull();
  const viewport = await locator.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expectInViewport(locator);
  const box = await locator.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

const OFFICIAL_CARD_IMAGE_BASE =
  'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/';

async function expectActualCardImage(locator: Locator, expectedImageFile: string): Promise<void> {
  const image = locator.locator('img.card-art').first();
  await expect(image).toBeVisible();
  await expect.poll(
    () => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    { message: `card artwork ${expectedImageFile} finishes loading` },
  ).toBe(true);
  await expect(image).toHaveJSProperty('currentSrc', `${OFFICIAL_CARD_IMAGE_BASE}${expectedImageFile}`);
}

async function closeCardDetails(page: Page): Promise<void> {
  const modal = page.locator('.card-expand-modal');
  await expect(modal).toBeVisible();
  await modal.locator('.card-expand-close').click();
  await expect(page.locator('.card-expand-modal')).toHaveCount(0);
}

test('BUG-231 log card ID opens the card modal and Escape preserves the log', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.log = [
      { ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D11013' },
    ];
  });

  await page.getByRole('button', { name: 'ログを開く' }).click();
  const logDialog = page.getByRole('dialog', { name: 'ゲームログ' });
  await expect(logDialog).toBeVisible();

  await page.getByRole('button', { name: '萩原千速 (D11013) を拡大表示' }).click();
  const cardDialog = page.getByRole('dialog', { name: 'カード拡大表示: 萩原千速' });
  await expect(cardDialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(cardDialog).toBeHidden();
  await expect(logDialog).toBeVisible();
  expect(errors).toEqual([]);
});

test('self evidence/remove browsing persists and remove cards can be enlarged', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.players.self.remove = ['D08003'];
    gs.players.self.evidence = [
      { cardId: 'D08007', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
  });

  await page.locator('.remove-area.side-self').click();
  const removeModal = page.locator('.card-list-modal');
  await expect(removeModal).toBeVisible();
  await page.getByTestId('card-list-item-D08003-0').click();
  await expect(page.locator('.card-expand-modal')).toBeVisible();
  await page.locator('.card-expand-modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(removeModal).toBeVisible();
  await page.locator('.card-list-modal-close').click();

  await page.locator('.evidence-area.side-self').click();
  await expect(page.locator('.card-list-modal')).toBeVisible();
  await expect(page.locator('.card-list-item.face-down')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('BUG-240 landscape HUD leaves the card-list close hit target reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'formal BUG-240 fixture is Pixel 5 landscape');

  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.players.self.remove = ['D08003'];
  });

  await page.locator('.remove-area.side-self').click();
  const modal = page.locator('.card-list-modal');
  const close = modal.locator('.card-list-modal-close');
  const hud = page.getByTestId('spectator-hud');
  await expect(modal).toBeVisible();
  await expect(close).toBeVisible();
  await expect(hud).toBeVisible();

  const closePoint = await close.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + width / 2, y: y + height / 2 };
  });
  expect(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('.card-list-modal-close') !== null;
  }, closePoint), 'the visible close button must own its center hit point').toBe(true);

  await close.click();
  await expect(modal).toHaveCount(0);

  const pause = page.getByTestId('spectator-pause-toggle');
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});

test('BUG-240 landscape HUD button gaps pass through to the covered close control', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'formal BUG-240 fixture is Pixel 5 landscape');

  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.players.self.remove = ['D08003'];
  });

  await page.locator('.remove-area.side-self').click();
  const modal = page.locator('.card-list-modal');
  const close = modal.locator('.card-list-modal-close');
  await expect(modal).toBeVisible();
  await expect(close).toBeVisible();

  const gapPoint = await page.evaluate(() => {
    const buttonRail = document.querySelector<HTMLElement>('.spectator-hud-buttons');
    if (!buttonRail) return null;

    const railRect = buttonRail.getBoundingClientRect();
    const buttonRects = [...buttonRail.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
    for (let index = 1; index < buttonRects.length; index += 1) {
      const previous = buttonRects[index - 1]!;
      const next = buttonRects[index]!;
      const gapLeft = previous.right;
      const gapRight = next.left;
      const overlapTop = Math.max(previous.top, next.top);
      const overlapBottom = Math.min(previous.bottom, next.bottom);
      if (gapRight > gapLeft && overlapBottom > overlapTop) {
        const x = (gapLeft + gapRight) / 2;
        const y = (overlapTop + overlapBottom) / 2;
        if (x > railRect.left && x < railRect.right && y > railRect.top && y < railRect.bottom) {
          return { x, y };
        }
      }
    }
    return null;
  });
  expect(gapPoint, 'the HUD speed rail exposes a non-button flex-gap coordinate').not.toBeNull();

  await close.evaluate((element, point) => {
    const { width, height } = element.getBoundingClientRect();
    Object.assign(element.style, {
      position: 'fixed',
      left: `${point.x - width / 2}px`,
      top: `${point.y - height / 2}px`,
    });
  }, gapPoint!);

  expect(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit?.closest('.card-list-modal-close') !== null;
  }, gapPoint!), 'the HUD button gap must not own the modal close hit point').toBe(true);

  await page.mouse.click(gapPoint!.x, gapPoint!.y);
  await expect(modal).toHaveCount(0);
  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});

test('B04026 completes reveal, reorder, and optional hand sceneEnter in decision order', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-GREEN', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = [];
    gs.players.self.deck = ['D08003', 'B04021', 'B04028', 'D08007'];
    gs.players.self.remove = ['D08013'];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });

  const list = page.locator('.card-list-modal');
  await expect(list).toBeVisible({ timeout: 6000 });
  await expect(list.locator('.card-list-item')).toHaveCount(3);
  await expect(page.getByTestId('card-list-item-D08003-0')).toBeVisible();
  await expect(page.getByTestId('card-list-pick-B04021#1')).toBeVisible();
  await expect(page.getByTestId('card-list-item-B04028-2')).toBeVisible();
  await expect(page.getByTestId('effect-picker-modal')).toHaveCount(0);

  await page.getByTestId('card-list-pick-B04021#1').click();

  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByTestId('deck-reorder-up-1').click();
  await page.getByTestId('deck-reorder-confirm-btn').click();
  await expect(reorder).toHaveCount(0);

  const handPick = page.locator('.hand-card.hand-card--pickable[data-card-id="B04021"]');
  await expect(handPick).toBeVisible();
  await expect(page.getByTestId('hand-zone-pick-skip')).toBeVisible();
  await handPick.click();

  await expect.poll(async () => {
    const gs = await getGameState(page);
    return gs.players.self.scene.map((c) => c.cardId);
  }).toContain('B04021');

  const gs = await getGameState(page);
  expect(gs.players.self.deck.slice(-2)).toEqual(['B04028', 'D08003']);
  expect(gs.players.self.remove).toContain('B04026');
  expect(errors).toEqual([]);
});

test('B04026 match0 keeps all three public cards and skip continues to reorder', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-GREEN', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = [];
    gs.players.self.deck = ['D08003', 'D08005', 'D08009', 'D08007'];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });

  const list = page.locator('.card-list-modal');
  await expect(list).toBeVisible({ timeout: 6000 });
  await expect(list.locator('.card-list-item')).toHaveCount(3);
  await expect(list.locator('.card-list-item--pickable')).toHaveCount(0);
  await expect(list.locator('.card-list-modal-pick-banner')).toContainText('対象カードはありません');
  await page.getByTestId('card-list-pick-skip').click();

  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByTestId('deck-reorder-confirm-btn').click();

  await expect(page.getByTestId('hand-zone-pick-skip')).toBeVisible();
  await expect(page.locator('.hand-zone-pick-banner')).toContainText('登場できる対象はありません');
  await page.getByTestId('hand-zone-pick-skip').click();
  await expect(page.getByTestId('hand-zone-pick-skip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('B04026 eligible reveal can explicitly decline acquisition and continue', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-GREEN', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = [];
    gs.players.self.deck = ['D08003', 'B04021', 'B04028', 'D08007'];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });
  await expect(page.getByTestId('card-list-pick-B04021#1')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('card-list-pick-skip')).toBeVisible();
  await page.getByTestId('card-list-pick-skip').click();

  await expect(page.getByTestId('deck-reorder-modal')).toBeVisible();
  await page.getByTestId('deck-reorder-confirm-btn').click();
  await expect(page.getByTestId('hand-zone-pick-skip')).toBeVisible();
  await page.getByTestId('hand-zone-pick-skip').click();

  const gs = await getGameState(page);
  expect(gs.players.self.hand).not.toContain('B04021');
  expect(gs.players.self.scene.map((c) => c.cardId)).not.toContain('B04021');
  expect(errors).toEqual([]);
});

test('B04026 acquire and hand sceneEnter switches a character when scene is full', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    const mk = (uid: string) => ({
      cardId: 'D08003', uid, state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-GREEN', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = ['full-0', 'full-1', 'full-2', 'full-3', 'full-4'].map(mk);
    gs.players.self.deck = ['D08003', 'B04021', 'B04028', 'D08007'];
    gs.players.self.remove = [];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });
  await page.getByTestId('card-list-pick-B04021#1').click();

  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  await page.getByTestId('deck-reorder-up-1').click();
  await page.getByTestId('deck-reorder-confirm-btn').click();

  const handPick = page.locator('.hand-card.hand-card--pickable[data-card-id="B04021"]');
  await expect(handPick).toBeVisible();
  await handPick.click();

  const victims = page.locator('.scene-area.side-self .card.effect-pickable');
  await expect(victims).toHaveCount(5);
  await page.locator('.scene-area.side-self .card.effect-pickable[data-uid="full-2"]').click();

  await expect.poll(async () => {
    const gs = await getGameState(page);
    return gs.players.self.scene.map((c) => ({ uid: c.uid, cardId: c.cardId }));
  }).toEqual(expect.arrayContaining([expect.objectContaining({ cardId: 'B04021' })]));

  const gs = await getGameState(page);
  expect(gs.players.self.scene).toHaveLength(5);
  expect(gs.players.self.scene.map((c) => c.uid)).not.toContain('full-2');
  expect(gs.players.self.remove).toContain('D08003');
  expect(gs.players.self.deck.slice(-2)).toEqual(['B04028', 'D08003']);
  expect(errors).toEqual([]);
});

test('B06029 enter picker keeps public evidence inspectable and hidden evidence undisclosed through the hand-to-evidence swap', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-ALL-COLORS', status: '解決編', requiredEvidence: 7,
      colors: ['赤', '青', '緑', '黄', '白', '黒'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B06029', 'D08011'];
    gs.players.self.scene = [];
    gs.players.self.evidence = [
      { cardId: 'D08003', faceUp: true, origin: { turn: 1, via: 'reasoning' } },
      { cardId: 'D08007', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    gs.pendingEffects = [];
  });

  const enter = await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B06029' });
  expect(enter, 'B06029 must enter through the real hand-use dispatch path').toMatchObject({ ok: true });

  const publicEvidencePrimary = page.getByTestId('card-list-pick-evidence:self:0');
  await expect(publicEvidencePrimary).toBeVisible({ timeout: 6000 });
  expect(await publicEvidencePrimary.evaluate((element) => element.tagName)).toBe('BUTTON');
  await expectActualCardImage(publicEvidencePrimary, '1743743093434380.jpg');

  const hiddenEvidencePrimary = page.getByTestId('card-list-pick-evidence:self:1');
  await expect(hiddenEvidencePrimary).toBeVisible();
  await expect(hiddenEvidencePrimary.locator('.card-list-item-back')).toBeVisible();
  await expect(hiddenEvidencePrimary.locator('.card-list-item-art')).toHaveCount(0);
  await expect(hiddenEvidencePrimary.locator('.card-list-item-id')).toHaveCount(0);
  await expect(hiddenEvidencePrimary).not.toContainText('D08007');
  await expect(hiddenEvidencePrimary).not.toHaveAttribute('data-card-id', /.+/);
  await expect(page.getByTestId('card-list-pick-detail-evidence:self:1')).toHaveCount(0);

  const publicDetail = page.getByTestId('card-list-pick-detail-evidence:self:0');
  await expectTouchTarget(publicDetail);
  await publicDetail.click();
  await closeCardDetails(page);
  await expect(publicEvidencePrimary).toBeVisible();

  await publicEvidencePrimary.click({ button: 'right' });
  await closeCardDetails(page);
  await expect(publicEvidencePrimary).toBeVisible();

  await publicEvidencePrimary.focus();
  await page.keyboard.press('Enter');

  const handPrimary = page.getByTestId('effect-pick-cand-D08011#0');
  await expect(handPrimary).toBeVisible();
  await expectActualCardImage(handPrimary, '1743743093474254.jpg');
  const handDetail = page.getByTestId('effect-pick-detail-D08011#0');
  await expectTouchTarget(handDetail);
  await handDetail.click();
  await closeCardDetails(page);
  await expect(handPrimary).toBeVisible();
  await handPrimary.click();

  await expect.poll(async () => {
    const state = await getGameState(page);
    return state.players.self.evidence.map((e) => `${e.cardId}:${e.faceUp}`);
  }).toEqual(['D08007:false', 'D08011:false']);

  const gs = await getGameState(page);
  expect(gs.players.self.hand).toContain('D08003');
  expect(gs.players.self.hand).not.toContain('D08011');
  expect(gs.players.self.scene.map((card) => card.cardId)).toContain('B06029');
  expect(errors).toEqual([]);
});

test('B04026 preserves public detail access and the chosen reordered card order', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-GREEN', status: '解決編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = [];
    gs.players.self.deck = ['D08003', 'B04021', 'B04028', 'D08007'];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });
  const reveal = page.locator('.card-list-modal');
  await expect(reveal).toBeVisible({ timeout: 6000 });
  await expect(reveal.locator('.card-list-item img')).toHaveCount(3);
  const nonEligibleFirst = page.getByTestId('card-list-item-D08003-0');
  const eligible = page.getByTestId('card-list-pick-B04021#1');
  const nonEligibleLast = page.getByTestId('card-list-item-B04028-2');
  await expectActualCardImage(nonEligibleFirst, '1743743093434380.jpg');
  await expectActualCardImage(eligible, '1735287737396188.jpg');
  await expectActualCardImage(nonEligibleLast, '1735287737436527.jpg');
  await expect(eligible).toHaveClass(/card-list-item--pickable/);
  await expect(nonEligibleFirst).not.toHaveClass(/card-list-item--pickable/);
  await expect(nonEligibleLast).not.toHaveClass(/card-list-item--pickable/);

  const revealDetail = page.getByTestId('card-list-pick-detail-B04021#1');
  await expectTouchTarget(revealDetail);
  await revealDetail.click();
  await closeCardDetails(page);
  await expect(reveal).toBeVisible();
  await eligible.click({ button: 'right' });
  await closeCardDetails(page);
  await expect(reveal).toBeVisible();
  await expect(eligible).toBeVisible();

  const skip = page.getByTestId('card-list-pick-skip');
  await expectInViewport(skip);
  await skip.focus();
  await page.keyboard.press('Enter');

  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  const rows = reorder.getByTestId(/deck-reorder-row-/);
  await expect(rows).toHaveCount(3);
  await expect(rows.locator('img')).toHaveCount(3);
  await expectActualCardImage(rows.nth(0), '1743743093434380.jpg');
  await expectActualCardImage(rows.nth(1), '1735287737396188.jpg');
  await expectActualCardImage(rows.nth(2), '1735287737436527.jpg');
  await expect(rows.nth(0).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'D08003');
  await expect(rows.nth(1).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'B04021');
  await expect(rows.nth(2).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'B04028');

  const reorderDetail = rows.nth(1).getByTestId('selectable-card-tile-detail');
  await expectTouchTarget(reorderDetail);
  await reorderDetail.click();
  await closeCardDetails(page);
  await rows.nth(1).locator('.selectable-card-tile__select').click({ button: 'right' });
  await closeCardDetails(page);
  await expect(rows).toHaveCount(3);

  await page.getByTestId('deck-reorder-up-2').click();
  await expect(rows.nth(0).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'D08003');
  await expect(rows.nth(1).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'B04028');
  await expect(rows.nth(2).locator('.selectable-card-tile__select')).toHaveAttribute('data-card-id', 'B04021');
  const confirm = page.getByTestId('deck-reorder-confirm-btn');
  await expectInViewport(confirm);
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(reorder).toHaveCount(0);

  const handSkip = page.getByTestId('hand-zone-pick-skip');
  await expect(handSkip).toBeVisible();
  await handSkip.click();
  await expect(handSkip).toHaveCount(0);

  const gs = await getGameState(page);
  expect(gs.players.self.deck.slice(-3)).toEqual(['D08003', 'B04028', 'B04021']);
  expect(gs.players.self.remove).toContain('B04026');
  expect(gs.pendingEffects.filter((effect) => effect.state === 'pending' || effect.state === 'resolving')).toEqual([]);
  expect(errors).toEqual([]);
});

test('B04026 keeps duplicate reveal and reorder occurrences independently addressable', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await humanMode(page);
  await buildGameState(page, (gs) => {
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    gs.players.self.case = {
      cardId: 'CASE-ALL-COLORS', status: '解決編', requiredEvidence: 7,
      colors: ['赤', '青', '緑', '黄', '白', '黒'], declaredUseCount: {},
    };
    gs.players.self.file = [
      { type: 'card-back', cardId: 'D08003' },
      { type: 'card-back', cardId: 'D08003' },
    ];
    gs.players.self.hand = ['B04026'];
    gs.players.self.scene = [];
    gs.players.self.deck = ['D08003', 'B04021', 'B04021', 'D08007'];
    gs.pendingEffects = [];
  });

  const use = await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });
  expect(use).toMatchObject({ ok: true });

  const reveal = page.locator('.card-list-modal');
  await expect(reveal).toBeVisible({ timeout: 6000 });
  await expect(reveal.locator('.card-list-item img')).toHaveCount(3);
  const nonEligible = page.getByTestId('card-list-item-D08003-0');
  const firstDuplicate = page.getByTestId('card-list-pick-B04021#1');
  const secondDuplicate = page.getByTestId('card-list-pick-B04021#2');
  await expectActualCardImage(nonEligible, '1743743093434380.jpg');
  await expect(firstDuplicate).toBeVisible();
  await expect(secondDuplicate).toBeVisible();
  await expect(firstDuplicate).toHaveClass(/card-list-item--pickable/);
  await expect(secondDuplicate).toHaveClass(/card-list-item--pickable/);
  await expectActualCardImage(firstDuplicate, '1735287737396188.jpg');
  await expectActualCardImage(secondDuplicate, '1735287737396188.jpg');

  const firstDetail = page.getByTestId('card-list-pick-detail-B04021#1');
  const secondDetail = page.getByTestId('card-list-pick-detail-B04021#2');
  await expectTouchTarget(firstDetail);
  await expectTouchTarget(secondDetail);
  await firstDetail.click();
  await closeCardDetails(page);
  await secondDuplicate.click({ button: 'right' });
  await closeCardDetails(page);
  await expect(firstDuplicate).toBeVisible();
  await expect(secondDuplicate).toBeVisible();

  await page.getByTestId('card-list-pick-skip').click();
  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  const rows = reorder.getByTestId(/deck-reorder-row-/);
  await expect(rows).toHaveCount(3);
  await expectActualCardImage(rows.nth(0), '1743743093434380.jpg');
  await expectActualCardImage(rows.nth(1), '1735287737396188.jpg');
  await expectActualCardImage(rows.nth(2), '1735287737396188.jpg');

  const instanceOrder = async (): Promise<string[]> => rows.locator('.selectable-card-tile__select').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('data-instance-id') ?? ''),
  );
  expect(await instanceOrder()).toEqual(['D08003#0', 'B04021#1', 'B04021#2']);

  const duplicateRowDetails = reorder.getByTestId('selectable-card-tile-detail');
  await expect(duplicateRowDetails).toHaveCount(3);
  await expectTouchTarget(rows.nth(2).getByTestId('selectable-card-tile-detail'));
  await rows.nth(2).getByTestId('selectable-card-tile-detail').click();
  await closeCardDetails(page);
  await page.getByTestId('deck-reorder-up-2').click();
  expect(await instanceOrder()).toEqual(['D08003#0', 'B04021#2', 'B04021#1']);

  const confirm = page.getByTestId('deck-reorder-confirm-btn');
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(reorder).toHaveCount(0);
  const handSkip = page.getByTestId('hand-zone-pick-skip');
  await expect(handSkip).toBeVisible();
  await handSkip.click();

  const gs = await getGameState(page);
  expect(gs.players.self.deck.slice(-3)).toEqual(['D08003', 'B04021', 'B04021']);
  expect(gs.players.self.deck.filter((cardId) => cardId === 'B04021')).toHaveLength(2);
  expect(gs.players.self.hand).not.toContain('B04021');
  expect(gs.players.self.scene.map((card) => card.cardId)).not.toContain('B04021');
  expect(gs.players.self.remove).toContain('B04026');
  expect(errors).toEqual([]);
});
