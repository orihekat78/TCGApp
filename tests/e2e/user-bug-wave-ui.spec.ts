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
  await expectInViewport(locator);
  const box = await locator.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
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
  await expect(publicEvidencePrimary.locator('img')).toHaveCount(1);

  const hiddenEvidencePrimary = page.getByTestId('card-list-pick-evidence:self:1');
  await expect(hiddenEvidencePrimary).toBeVisible();
  await expect(hiddenEvidencePrimary.locator('img')).toHaveCount(0);
  await expect(page.getByTestId('card-list-pick-detail-evidence:self:1')).toHaveCount(0);

  const publicDetail = page.getByTestId('card-list-pick-detail-evidence:self:0');
  await expectTouchTarget(publicDetail);
  await publicDetail.click();
  await expect(page.locator('.card-expand-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-expand-modal')).toHaveCount(0);
  await expect(publicEvidencePrimary).toBeVisible();

  await publicEvidencePrimary.focus();
  await page.keyboard.press('Enter');

  const gs = await getGameState(page);
  expect(gs.players.self.hand).toContain('D08003');
  expect(gs.players.self.hand).toContain('D08011');
  expect(gs.players.self.evidence.map((e) => `${e.cardId}:${e.faceUp}`)).toEqual(['D08007:false']);
  expect(gs.players.self.scene.map((card) => card.cardId)).toContain('B06029');
  expect(errors).toEqual([]);
});

test('B04026 keeps duplicate revealed cards visually identifiable and preserves reordered occurrences after detail inspection', async ({ page }) => {
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
    gs.players.self.deck = ['D08003', 'B04021', 'B04021', 'D08007'];
    gs.pendingEffects = [];
  });

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04026' });
  const reveal = page.locator('.card-list-modal');
  await expect(reveal).toBeVisible({ timeout: 6000 });
  await expect(reveal.locator('.card-list-item img')).toHaveCount(3);
  const duplicatePrimaries = reveal.getByTestId(/card-list-pick-B04021#[12]/);
  await expect(duplicatePrimaries).toHaveCount(2);

  const revealDetail = page.getByTestId('card-list-pick-detail-B04021#1');
  await expectTouchTarget(revealDetail);
  await revealDetail.click();
  await expect(page.locator('.card-expand-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reveal).toBeVisible();
  await expect(duplicatePrimaries).toHaveCount(2);

  const skip = page.getByTestId('card-list-pick-skip');
  await expectInViewport(skip);
  await skip.focus();
  await page.keyboard.press('Enter');

  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  const rows = reorder.getByTestId(/deck-reorder-row-/);
  await expect(rows).toHaveCount(3);
  await expect(rows.locator('img')).toHaveCount(3);

  await page.getByTestId('deck-reorder-up-2').click();
  const confirm = page.getByTestId('deck-reorder-confirm-btn');
  await expectInViewport(confirm);
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(reorder).toHaveCount(0);

  const gs = await getGameState(page);
  expect(gs.players.self.deck.slice(-3)).toEqual(['D08003', 'B04021', 'B04021']);
  expect(gs.players.self.remove).toContain('B04026');
  expect(errors).toEqual([]);
});
