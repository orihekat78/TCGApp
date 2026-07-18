import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildGameState, dispatchAction, expectNoConsoleErrors, getGameState, setupGamePage, waitForPhase } from './helpers';

async function expectFixedDecisionShell(page: Page, shell: Locator, body: Locator, header: Locator, action: Locator): Promise<void> {
  await page.waitForTimeout(250); // guard overlay fade-in must settle before rect comparison
  const viewport = page.viewportSize()!;
  const [shellBox, headerBefore, actionBefore] = await Promise.all([shell.boundingBox(), header.boundingBox(), action.boundingBox()]);
  expect(shellBox).not.toBeNull();
  expect(headerBefore).not.toBeNull();
  expect(actionBefore).not.toBeNull();
  expect(shellBox!.x).toBeGreaterThanOrEqual(0);
  expect(shellBox!.x + shellBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(shellBox!.y).toBeGreaterThanOrEqual(0);
  expect(shellBox!.y + shellBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(headerBefore!.y).toBeGreaterThanOrEqual(0);
  expect(headerBefore!.y + headerBefore!.height).toBeLessThanOrEqual(viewport.height);
  expect(actionBefore!.width).toBeGreaterThanOrEqual(44);
  expect(actionBefore!.height).toBeGreaterThanOrEqual(44);
  expect(actionBefore!.x).toBeGreaterThanOrEqual(0);
  expect(actionBefore!.x + actionBefore!.width).toBeLessThanOrEqual(viewport.width);
  expect(actionBefore!.y + actionBefore!.height).toBeLessThanOrEqual(viewport.height);
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const [headerAfter, actionAfter] = await Promise.all([header.boundingBox(), action.boundingBox()]);
  expect(headerAfter).toEqual(headerBefore);
  expect(actionAfter).toEqual(actionBefore);
  expect(headerAfter!.y).toBeGreaterThanOrEqual(0);
  expect(headerAfter!.y + headerAfter!.height).toBeLessThanOrEqual(viewport.height);
  expect(actionAfter!.x).toBeGreaterThanOrEqual(0);
  expect(actionAfter!.x + actionAfter!.width).toBeLessThanOrEqual(viewport.width);
  expect(actionAfter!.y + actionAfter!.height).toBeLessThanOrEqual(viewport.height);
}

async function openAndCloseDetail(modal: Locator, detail: Locator, order: () => Promise<string[]>): Promise<void> {
  const before = await order();
  await detail.click();
  const backdrop = modal.page().locator('.card-expand-modal-backdrop');
  await expect(backdrop).toBeVisible();
  await modal.page().locator('.card-expand-close').click();
  await expect(backdrop).toBeHidden();
  await expect(modal).toBeVisible();
  expect(await order()).toEqual(before);
}

async function expectFixedFooter(page: Page, modal: Locator, action: Locator): Promise<void> {
  const shell = modal.locator('.cp-modal');
  const body = shell.locator('.cp-body');
  const header = shell.locator('.cp-header');
  const viewport = page.viewportSize()!;
  const [shellBox, headerBefore, actionBefore] = await Promise.all([shell.boundingBox(), header.boundingBox(), action.boundingBox()]);
  expect(shellBox).not.toBeNull();
  expect(headerBefore).not.toBeNull();
  expect(actionBefore).not.toBeNull();
  expect(shellBox!.x).toBeGreaterThanOrEqual(0);
  expect(shellBox!.x + shellBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(shellBox!.y).toBeGreaterThanOrEqual(0);
  expect(shellBox!.y + shellBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(actionBefore!.width).toBeGreaterThanOrEqual(44);
  expect(actionBefore!.height).toBeGreaterThanOrEqual(44);
  expect(actionBefore!.x).toBeGreaterThanOrEqual(0);
  expect(actionBefore!.x + actionBefore!.width).toBeLessThanOrEqual(viewport.width);
  expect(actionBefore!.y).toBeGreaterThanOrEqual(0);
  expect(actionBefore!.y + actionBefore!.height).toBeLessThanOrEqual(viewport.height);
  if (await body.evaluate((element) => element.scrollHeight > element.clientHeight)) {
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  }
  expect(await header.boundingBox()).toEqual(headerBefore);
  expect(await action.boundingBox()).toEqual(actionBefore);
}

test('BUG-241 Pixel 5 landscape: real stacked-card effect keeps header and confirm fixed while candidates scroll', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    const base = gs.players.self.scene[0]!;
    gs.players.self.scene = [
      { ...base, uid: 'agasa', cardId: 'B06005', state: 'active', stackedCards: Array.from({ length: 4 }, (_, index) => ({ cardId: 'D08003', instanceId: `stack:agasa:${index}` })) },
      { ...base, uid: 'target', cardId: 'D08003', state: 'active', stackedCards: [] },
    ] as never;
    (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
    (gs as unknown as { turn: Record<string, unknown> }).turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });
  expect(await dispatchAction(page, { type: 'declaredAbility', uid: 'agasa', abilId: 'a2' })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'target' })).toEqual({ ok: true });
  const pending = await page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingEffectPick: { candidates: { uid: string }[]; source: { cardId: string }; atomVerb: string; nMin: number; nMax: number } | null } } }).__game.getState().pendingEffectPick);
  expect(pending).toMatchObject({ source: { cardId: 'B06005' }, atomVerb: 'stackedCardPick', nMin: 0, nMax: 2 });
  expect(pending?.candidates.map((candidate) => candidate.uid)).toEqual(['stack:agasa:0', 'stack:agasa:1', 'stack:agasa:2', 'stack:agasa:3']);
  const modal = page.getByTestId('effect-picker-modal');
  const shell = modal.locator('.effect-picker-modal');
  const list = shell.locator('.effect-picker-list');
  const confirm = modal.getByTestId('effect-picker-confirm');
  await modal.getByTestId('effect-pick-cand-stack:agasa:0').click();
  await expectFixedDecisionShell(page, shell, list, shell.locator('.effect-picker-header'), confirm);
  const details = modal.getByTestId(/effect-pick-detail-stack:agasa:/);
  const order = () => modal.getByTestId(/effect-pick-cand-stack:agasa:/).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')!));
  await openAndCloseDetail(modal, details.first(), order);
  await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await openAndCloseDetail(modal, details.last(), order);
  await confirm.click();
  await expect(modal).toBeHidden();
  const scene = (await getGameState(page)).players.self.scene;
  expect(scene.find((character) => character.uid === 'agasa')?.stackedCards).toEqual([{ cardId: 'D08003', instanceId: 'stack:agasa:1' }, { cardId: 'D08003', instanceId: 'stack:agasa:2' }, { cardId: 'D08003', instanceId: 'stack:agasa:3' }]);
  expect(scene.find((character) => character.uid === 'target')?.stackedCards).toEqual([{ cardId: 'D08003', instanceId: 'stack:agasa:0' }]);
  expectNoConsoleErrors(errors);
});

test('BUG-241 Pixel 5 landscape: real guard window keeps skip fixed while candidates scroll', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    const selfBase = gs.players.self.scene[0]!;
    const oppBase = gs.players.opp.scene[0]!;
    const sceneChar = (cardId: string, uid: string) => ({ uid, cardId, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
    gs.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' } as never;
    gs.players.self.scene = [
      { ...selfBase, ...sceneChar('D08003', 'target'), state: 'sleep' },
      { ...selfBase, ...sceneChar('D08003', 'guard-1') },
      { ...selfBase, ...sceneChar('D08003', 'guard-2') },
      { ...selfBase, ...sceneChar('D08003', 'guard-3') },
    ] as never;
    gs.players.opp.scene = [{ ...oppBase, ...sceneChar('D11003', 'attacker') }] as never;
    (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
    (gs as unknown as { turn: Record<string, unknown> }).turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });
  expect(await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'target' })).toEqual({ ok: true });
  const modal = page.getByTestId('guard-picker-modal');
  const shell = modal.locator('.guard-picker-modal');
  const body = shell.locator('.guard-picker-body');
  const skip = modal.getByTestId('guard-picker-skip');
  await expectFixedDecisionShell(page, shell, body, shell.locator('.guard-picker-header'), skip);
  const details = modal.getByTestId('selectable-card-tile-detail');
  const order = () => modal.getByTestId(/guard-cand-/).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')!));
  await openAndCloseDetail(modal, details.first(), order);
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await openAndCloseDetail(modal, details.last(), order);
  await skip.click();
  await waitForPhase(page, 'action-1');
  expectNoConsoleErrors(errors);
});

test('BUG-241 Pixel 5 landscape: declared ChoicePicker keeps cancel fixed while eight options scroll', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await buildGameState(page, () => {});
  await page.evaluate(() => {
    const windowWithChoice = window as unknown as { __game: { choicePicker: { ask: (request: unknown) => Promise<unknown> } }; __bug241Choice?: unknown };
    windowWithChoice.__game.choicePicker.ask({ sourceName: 'BUG-241', options: Array.from({ length: 8 }, (_, index) => ({ index, label: `option-${index}` })) }).then((result) => { windowWithChoice.__bug241Choice = result; });
  });
  const modal = page.getByTestId('choice-picker-modal');
  const shell = modal.locator('.cp-modal');
  const cancel = modal.getByTestId('cp-cancel-btn');
  await expectFixedDecisionShell(page, shell, shell.locator('.cp-body'), shell.locator('.cp-header'), cancel);
  await expect(modal.getByTestId('cp-opt-0')).toBeVisible();
  await shell.locator('.cp-body').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(modal.getByTestId('cp-opt-7')).toBeVisible();
  await cancel.click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __bug241Choice?: unknown }).__bug241Choice)).toEqual({ kind: 'cancel' });
  expectNoConsoleErrors(errors);
});

test('BUG-241 Pixel 5 landscape: shared Choice hosts keep footer controls fixed', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => {
    gs.players.self.hand = Array.from({ length: 8 }, () => 'B01001') as never;
  });
  const setPending = async (field: string, value: unknown): Promise<void> => {
    await page.evaluate(({ field, value }) => {
      const store = (window as unknown as { __game: { store: { setState: (state: Record<string, unknown>) => void } } }).__game.store;
      store.setState({ [field]: value });
    }, { field, value });
  };
  const clearPending = async (field: string): Promise<void> => setPending(field, null);

  await setPending('pendingChooseIntercept', { player: 'self', protector: { uid: 'protector', cardId: 'B01001', abilityId: 'a1' }, targetUid: 'target' });
  const chooseIntercept = page.getByTestId('choose-intercept-modal');
  await expectFixedFooter(page, chooseIntercept, page.getByTestId('choose-intercept-decline'));
  await page.getByTestId('choose-intercept-decline').click();
  await expect(chooseIntercept).toBeHidden();

  await setPending('pendingSetCardReplacement', { player: 'self', fromUid: 'from', setCardInstanceId: 'set-1', candidates: Array.from({ length: 8 }, (_, index) => ({ uid: `replacement-${index}`, cardId: 'B01001' })), source: { uid: 'from' } });
  const setReplacement = page.getByTestId('set-card-replacement-modal');
  await expectFixedFooter(page, setReplacement, page.getByTestId('set-card-replacement-decline'));
  await page.getByTestId('set-card-replacement-decline').click();
  await expect(setReplacement).toBeHidden();

  await setPending('pendingLeaveIntercept', { player: 'self', interceptorUid: 'interceptor', targetUid: 'target', source: { cardId: 'B01092', abilityId: 'a1' } });
  const leaveIntercept = page.getByTestId('leave-intercept-modal');
  await expectFixedFooter(page, leaveIntercept, page.getByTestId('leave-intercept-no'));
  await page.getByTestId('leave-intercept-no').click();
  await expect(leaveIntercept).toBeHidden();

  await setPending('pendingEffectOptional', { player: 'self', source: { cardId: 'D08025', abilityId: 'a1' } });
  const optional = page.getByTestId('optional-picker-modal');
  await expectFixedFooter(page, optional, page.getByTestId('opt-run-no'));
  await page.getByTestId('opt-run-no').click();
  await expect(optional).toBeHidden();

  await setPending('pendingEffectRepeatOptional', { player: 'self', remaining: 2, source: { cardId: 'D08025', abilityId: 'a1' } });
  const repeatOptional = page.getByTestId('repeat-optional-picker-modal');
  await expectFixedFooter(page, repeatOptional, page.getByTestId('repeat-opt-run-no'));
  await page.getByTestId('repeat-opt-run-no').click();
  await expect(repeatOptional).toBeHidden();

  await setPending('pendingRps', { player: 'self', ownerPlayer: 'opp', aiHand: 'paper' });
  const rps = page.getByTestId('rps-modal');
  await expectFixedFooter(page, rps, page.getByTestId('rps-rock'));
  await page.getByTestId('rps-rock').click();
  await expect(rps).toBeHidden();

  // Layout carrier only. Exact opaque-instance resolution remains in the real B02039 E2E.
  await setPending('pendingSetCardChoice', { player: 'self', hostUid: 'host', entries: Array.from({ length: 8 }, (_, index) => ({ instanceId: `set-${index}`, ordinal: index + 1 })), source: { uid: 'host', cardId: 'B02039', abilityId: 'a1' } });
  const setCardModal = page.getByTestId('set-card-choice-modal');
  const setCardBody = setCardModal.locator('.cp-body');
  expect(await setCardBody.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await setCardBody.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await setCardBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(setCardModal.getByTestId('set-card-choice-8')).toBeVisible();
  await setCardModal.getByTestId('set-card-choice-8').click();
  await expect(setCardModal).toBeHidden();
  expectNoConsoleErrors(errors);
});

test('BUG-241 desktop: ChoicePicker retains its normal dialog flow', async ({ page }) => {
  if (test.info().project.name !== 'chromium') test.skip();
  const { errors } = await setupGamePage(page);
  await buildGameState(page, () => {});
  await page.evaluate(() => {
    const game = window as unknown as { __game: { choicePicker: { ask: (request: unknown) => Promise<unknown> } }; __bug241Desktop?: unknown };
    game.__game.choicePicker.ask({ sourceName: 'desktop', options: [{ index: 0, label: 'first' }, { index: 1, label: 'second' }] }).then((result) => { game.__bug241Desktop = result; });
  });
  const modal = page.getByTestId('choice-picker-modal');
  await expect(modal).toBeVisible();
  await modal.getByTestId('cp-opt-1').click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __bug241Desktop?: unknown }).__bug241Desktop)).toEqual({ kind: 'choose', index: 1 });
  expectNoConsoleErrors(errors);
});

test('BUG-241 portrait: ChoicePicker remains contained and cancellable', async ({ page }) => {
  if (test.info().project.name !== 'mobile-chromium') test.skip();
  await page.setViewportSize({ width: 393, height: 851 });
  const { errors } = await setupGamePage(page);
  await buildGameState(page, () => {});
  await page.evaluate(() => {
    const game = window as unknown as { __game: { choicePicker: { ask: (request: unknown) => Promise<unknown> } }; __bug241Portrait?: unknown };
    game.__game.choicePicker.ask({ sourceName: 'portrait', options: Array.from({ length: 8 }, (_, index) => ({ index, label: `option-${index}` })) }).then((result) => { game.__bug241Portrait = result; });
  });
  const modal = page.getByTestId('choice-picker-modal');
  const shell = modal.locator('.cp-modal');
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(393);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(851);
  await modal.getByTestId('cp-cancel-btn').click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __bug241Portrait?: unknown }).__bug241Portrait)).toEqual({ kind: 'cancel' });
  expectNoConsoleErrors(errors);
});
