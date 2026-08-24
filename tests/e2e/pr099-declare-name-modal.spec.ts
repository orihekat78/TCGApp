import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, setupGamePage } from './helpers';

const SOURCE_UID = 'pr099-host';
const EXACT_REGISTERED_NAME = '松田陣平＆萩原研二';
const TYPO_REGISTERED_NAME = '松田陣平＆萩原研三';
const AMBIGUOUS_NAME = '毛利';

type Pr099Projection = {
  ap: number;
  names: string[];
  nameOverride: string | null;
  useCount: number;
};

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function setupPr099(page: Page): Promise<void> {
  await primeHuman(page);
  await buildGameState(page, (state) => {
    const base = state.players.self.scene[0]!;
    state.players.self.scene = [{
      ...base,
      uid: 'pr099-host',
      cardId: 'PR099',
      state: 'active',
      declaredUseCount: {},
    }];
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
  });
}

async function setupB04048(page: Page): Promise<void> {
  await primeHuman(page);
  await buildGameState(page, (state) => {
    const base = state.players.self.scene[0]!;
    state.players.self.scene = [{
      ...base,
      uid: 'pr099-host',
      cardId: 'B04048',
      state: 'active',
      declaredUseCount: {},
    }];
    state.players.self.deck = ['B10065', 'B01001'];
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
  });
}

async function openDeclaration(page: Page): Promise<void> {
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator(`[data-uid="${SOURCE_UID}"]`).click();
  await page.locator('.confirm-ok').click();
  await expect(page.getByTestId('declare-card-name-modal')).toBeVisible();
}

async function readProjection(page: Page): Promise<Pr099Projection> {
  return page.evaluate(({ uid }) => {
    const game = (window as unknown as {
      __game: {
        getState: () => { gameState: { players: { self: { scene: Array<{ uid: string; turnEffects: { nameOverride?: string }; declaredUseCount: Record<string, number> }> } } } };
        read: { char: {
          ap: (state: unknown, uid: string) => number;
          names: (state: unknown, uid: string) => string[];
          declaredUseCount: (state: unknown, uid: string, abilityId: string) => number;
        } };
      };
    }).__game;
    const state = game.getState().gameState;
    const source = state.players.self.scene.find((card) => card.uid === uid);
    if (!source) throw new Error(`PR099 source ${uid} is absent`);
    return {
      ap: game.read.char.ap(state, uid),
      names: game.read.char.names(state, uid),
      nameOverride: source.turnEffects.nameOverride ?? null,
      useCount: game.read.char.declaredUseCount(state, uid, 'a2'),
    };
  }, { uid: SOURCE_UID });
}

async function expectProjection(page: Page, expected: Pr099Projection): Promise<void> {
  await expect.poll(() => readProjection(page)).toEqual(expected);
}

async function expectTouchTarget(control: ReturnType<Page['locator']>): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
}

function contrastRatio(left: string, right: string): number {
  const luminance = (value: string): number => {
    const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error(`unsupported color: ${value}`);
    const linear = channels.map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

async function computedColors(control: ReturnType<Page['locator']>): Promise<{
  background: string;
  border: string;
  color: string;
  opacity: string;
  outline: string;
  outlineStyle: string;
  outlineWidth: string;
}> {
  return control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopColor,
      color: style.color,
      opacity: style.opacity,
      outline: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

test('PR099 rejects ambiguity, then applies an exact keyboard-selected registered name', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setupPr099(page);
  const initial = await readProjection(page);
  expect(initial).toMatchObject({ ap: 5000, nameOverride: null, useCount: 0 });

  await openDeclaration(page);
  const modal = page.getByTestId('declare-card-name-modal');
  const input = page.getByTestId('declare-card-name-input');
  const listbox = modal.getByRole('listbox');
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute(
    'aria-describedby',
    /declare-card-name-prompt.*declare-card-name-domain-guidance/,
  );
  await expect(modal.getByTestId('declare-card-name-domain-guidance')).toBeVisible();
  await expect(modal.getByTestId('declare-card-name-count')).toContainText(/\d+件/);
  await expect(listbox).toBeVisible();

  const panel = modal.locator('.declare-card-name-modal');
  const confirm = modal.getByTestId('declare-card-name-confirm');
  const [panelColors, inputColors, disabledColors] = await Promise.all([
    computedColors(panel),
    computedColors(input),
    computedColors(confirm),
  ]);
  expect(contrastRatio(panelColors.border, panelColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(inputColors.border, inputColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(inputColors.border, panelColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(disabledColors.border, panelColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(disabledColors.border, disabledColors.background)).toBeGreaterThanOrEqual(3);
  expect(disabledColors.opacity).toBe('1');
  await input.focus();
  const inputFocusColors = await computedColors(input);
  expect(inputFocusColors.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(inputFocusColors.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(inputFocusColors.outline, inputFocusColors.background)).toBeGreaterThanOrEqual(3);

  await input.fill(AMBIGUOUS_NAME);
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expectProjection(page, initial);

  await input.press('ArrowDown');
  const activeOption = listbox.locator('[role="option"][aria-selected="true"]');
  await expect(activeOption).toBeVisible();
  const activeColors = await computedColors(activeOption);
  expect(contrastRatio(activeColors.background, panelColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(activeColors.color, activeColors.background)).toBeGreaterThanOrEqual(4.5);

  await input.fill(TYPO_REGISTERED_NAME);
  const resolution = modal.getByTestId('declare-card-name-resolution');
  await expect(resolution).toContainText(EXACT_REGISTERED_NAME);
  await expect(input).toHaveAttribute('aria-describedby', /declare-card-name-resolution/);
  await expect(listbox.getByRole('option', { name: EXACT_REGISTERED_NAME, exact: true })).toBeVisible();
  await expectProjection(page, initial);

  await input.fill(EXACT_REGISTERED_NAME);
  await expect(modal.getByTestId('declare-card-name-count')).toContainText('1件');
  await expect(listbox.getByRole('option', { name: EXACT_REGISTERED_NAME, exact: true })).toBeVisible();
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /declare-card-name-option-0/);
  await expect(listbox.getByRole('option', { name: EXACT_REGISTERED_NAME, exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expectTouchTarget(confirm);
  const enabledColors = await computedColors(confirm);
  expect(contrastRatio(enabledColors.background, panelColors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(enabledColors.color, enabledColors.background)).toBeGreaterThanOrEqual(4.5);
  await confirm.focus();
  const confirmFocusColors = await computedColors(confirm);
  expect(confirmFocusColors.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(confirmFocusColors.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(confirmFocusColors.outline, confirmFocusColors.background)).toBeGreaterThanOrEqual(3);
  await input.focus();
  await input.press('Enter');

  await expect(modal).toBeHidden();
  await expectProjection(page, {
    ap: 6000,
    names: [EXACT_REGISTERED_NAME],
    nameOverride: EXACT_REGISTERED_NAME,
    useCount: 1,
  });
  await expect(page.locator(`[data-uid="${SOURCE_UID}"] .ap`)).toHaveText('6000');
  expectNoConsoleErrors(errors);
});

test('PR099 keeps cancel non-mutating and optional skip reachable without a name mutation', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setupPr099(page);
  const initial = await readProjection(page);

  await openDeclaration(page);
  const modal = page.getByTestId('declare-card-name-modal');
  const input = page.getByTestId('declare-card-name-input');
  const skip = modal.getByTestId('declare-card-name-skip');
  const cancel = modal.getByTestId('declare-card-name-cancel');
  await expect(skip).toBeVisible();
  await expect(cancel).toBeVisible();
  for (const control of [input, skip, cancel]) await expectTouchTarget(control);

  const panelBox = await modal.locator('.declare-card-name-modal').boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(panelBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(panelBox!.y).toBeGreaterThanOrEqual(0);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(viewport!.height + 1);

  await cancel.click();
  await expect(modal).toBeHidden();
  await expectProjection(page, initial);

  await openDeclaration(page);
  await modal.getByTestId('declare-card-name-skip').click();
  await expect(modal).toBeHidden();
  await expectProjection(page, {
    ...initial,
    ap: 6000,
    nameOverride: null,
    useCount: 1,
  });
  await expect(page.locator(`[data-uid="${SOURCE_UID}"] .ap`)).toHaveText('6000');
  expectNoConsoleErrors(errors);
});

test('B04048 resolves an identifiable all-card name through the visible declaration and deck pick', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setupB04048(page);
  await openDeclaration(page);

  const modal = page.getByTestId('declare-card-name-modal');
  const input = page.getByTestId('declare-card-name-input');
  const confirm = page.getByTestId('declare-card-name-confirm');
  const guidance = page.getByTestId('declare-card-name-domain-guidance');
  await expect(guidance).toContainText('登録済みのカード名');
  await expect(guidance).not.toContainText('キャラクターカード名');

  await input.fill(AMBIGUOUS_NAME);
  await expect(modal.getByRole('alert')).toContainText('登録済みのカード名');
  await expect(confirm).toBeDisabled();

  await input.fill(TYPO_REGISTERED_NAME);
  await expect(page.getByTestId('declare-card-name-resolution')).toContainText(EXACT_REGISTERED_NAME);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(modal).toBeHidden();

  const picker = page.getByRole('dialog', { name: /自分の公開されたカード/ });
  await expect(picker).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const store = (window as unknown as {
      __game: { getState: () => { pendingEffectPick: { candidates: Array<{ cardId: string }> } | null } };
    }).__game.getState();
    return store.pendingEffectPick?.candidates.map(candidate => candidate.cardId) ?? [];
  })).toEqual(['B10065']);
  await picker.getByRole('button', { name: `${EXACT_REGISTERED_NAME} を選択` }).click();
  await expect(picker).toBeHidden();

  await expect.poll(() => page.evaluate(({ uid }) => {
    const game = (window as unknown as {
      __game: {
        getState: () => {
          gameState: { players: { self: { hand: string[] } } };
          pendingEffectPick: unknown;
        };
        read: { char: { declaredUseCount: (state: unknown, uid: string, abilityId: string) => number } };
      };
    }).__game;
    const store = game.getState();
    return {
      handHasMatch: store.gameState.players.self.hand.includes('B10065'),
      pending: store.pendingEffectPick,
      useCount: game.read.char.declaredUseCount(store.gameState, uid, 'a2'),
    };
  }, { uid: SOURCE_UID })).toEqual({ handHasMatch: true, pending: null, useCount: 1 });
  expectNoConsoleErrors(errors);
});
