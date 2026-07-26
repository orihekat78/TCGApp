import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

type SourceArea = 'scene' | 'evidence' | 'file';

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function fixtureB10094(page: Page, source: SourceArea, mixed = false): Promise<void> {
  await buildGameState(page, (state, args: { source: SourceArea; mixed: boolean }) => {
    const base = state.players.self.scene[0]!;
    state.players.self.scene = args.source === 'scene' || args.mixed
      ? [{ ...base, uid: 'b10094-scene', cardId: 'B10094', state: 'active', declaredUseCount: {} }]
      : [] as never;
    state.players.self.evidence = args.source === 'evidence' || args.mixed
      ? [{ cardId: 'B10094', faceUp: true, origin: 'action' }, { cardId: 'B10094', faceUp: false, origin: 'action' }]
      : [] as never;
    state.players.self.file = args.source === 'file' || args.mixed
      ? [{ type: 'card-back', cardId: 'B10094', faceUp: true }, { type: 'card-back', cardId: 'B10094', faceUp: false }]
      : [] as never;
    // Two public equal PA cards prove that the UI retains occurrence identity.
    state.players.opp.partnerAreaCards = ['B10095', 'B10095'] as never;
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
  }, { source, mixed });
}

async function resolveB10094(page: Page, sourceUid: string): Promise<void> {
  await page.locator('[data-action-id="declared-ability"]').click();
  const sourceModal = page.locator('.card-list-modal');
  if (sourceUid === 'b10094-scene') {
    await page.locator('[data-uid="b10094-scene"]').click();
  } else {
    await expect(sourceModal).toBeVisible();
    await sourceModal.getByTestId(`card-list-pick-${sourceUid}`).click();
  }

  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-ok').click();

  const targetPicker = page.getByTestId('effect-picker-modal');
  await expect(targetPicker).toBeVisible();
  await expect(targetPicker.getByTestId('effect-pick-cand-card:opp:partner-area:B10095#0')).toBeVisible();
  await expect(targetPicker.getByTestId('effect-pick-cand-card:opp:partner-area:B10095#1')).toBeVisible();
  await targetPicker.getByTestId('effect-pick-cand-card:opp:partner-area:B10095#1').click();
}

test('B10094 scene source uses the direct yellow candidate click and resolves its declared cost and PA target', async ({ page }) => {
  if (test.info().project.name !== 'chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await primeHuman(page);
  await fixtureB10094(page, 'scene');

  await resolveB10094(page, 'b10094-scene');

  const state = await getGameState(page) as unknown as {
    players: { self: { scene: unknown[]; remove: string[] }; opp: { partnerAreaCards: string[]; remove: string[] } };
  };
  expect(state.players.self.scene).toEqual([]);
  expect(state.players.self.remove).toContain('B10094');
  expect(state.players.opp.partnerAreaCards).toEqual(['B10095']);
  expect(state.players.opp.remove).toContain('B10095');
  expectNoConsoleErrors(errors);
});

test('B10094 source modal exposes exactly scene, face-up evidence, and face-up FILE; hidden cards stay private and cancel does not loop', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await primeHuman(page);
  await fixtureB10094(page, 'evidence', true);

  await page.locator('[data-action-id="declared-ability"]').click();
  const modal = page.locator('.card-list-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.card-list-pick-shell')).toHaveCount(3);
  for (const uid of ['b10094-scene', 'evidence:self:0', 'file:self:0']) {
    await expect(modal.getByTestId(`card-list-pick-${uid}`)).toBeVisible();
  }
  await expect(modal.getByTestId('card-list-pick-evidence:self:1')).toHaveCount(0);
  await expect(modal.getByTestId('card-list-pick-file:self:1')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await page.locator('[data-action-id="declared-ability"]').click();
  await expect(modal).toBeVisible();
  await modal.getByTestId('card-list-pick-file:self:0').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-cancel').click();
  await expect(page.locator('.confirm-modal')).toBeHidden();
  await expect(modal).toBeHidden();
  await expect(page.locator('.confirm-modal')).toHaveCount(0);
  expectNoConsoleErrors(errors);
});

test('B10094 face-up evidence and FILE sources pay their own occurrence then resolve the selected PA occurrence', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await primeHuman(page);

  for (const [area, uid] of [['evidence', 'evidence:self:0'], ['file', 'file:self:0']] as const) {
    await fixtureB10094(page, area);
    await resolveB10094(page, uid);
    const state = await getGameState(page) as unknown as {
      players: { self: { evidence: unknown[]; file: unknown[]; remove: string[] }; opp: { partnerAreaCards: string[]; remove: string[] } };
    };
    expect(state.players.self.remove, `${area} source pays selfToRemove`).toContain('B10094');
    expect(state.players.opp.partnerAreaCards, `${area} source resolves selected duplicate occurrence`).toEqual(['B10095']);
    expect(state.players.opp.remove).toContain('B10095');
  }
  expectNoConsoleErrors(errors);
});

test('B05066 accepts physical and legacy PA-MR source UIDs; B10094 is never used from PA', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await primeHuman(page);

  for (const uid of ['physical-pa-mr', 'partnerMR:self']) {
    await buildGameState(page, (state, sourceUid: string) => {
      const base = state.players.self.scene[0]!;
      state.players.self.scene = [] as never;
      state.players.self.partnerAreaMR = { ...base, uid: sourceUid, cardId: 'B05066', state: 'active', declaredUseCount: {} } as never;
      state.players.opp.scene = [{ ...base, uid: 'pa-target', cardId: 'D08013', state: 'active', declaredUseCount: {} }] as never;
      state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
    }, uid);

    await page.locator('[data-action-id="declared-ability"]').click();
    const tile = page.getByTestId('pa-mr-self');
    await expect(tile).toHaveAttribute('data-card-id', 'B05066');
    await expect(tile).toHaveClass(/candidate/);
    await tile.click();
    await expect(page.locator('.confirm-modal')).toBeVisible();
    await page.locator('.confirm-ok').click();
    await page.locator('[data-uid="pa-target"]').click();
    const state = await getGameState(page) as unknown as { players: { opp: { scene: { uid: string; turnEffects: Record<string, unknown> }[] } } };
    expect(state.players.opp.scene.find((char) => char.uid === 'pa-target')?.turnEffects['lvlMod_turn']).toBe(-1);
  }
  expectNoConsoleErrors(errors);
});
