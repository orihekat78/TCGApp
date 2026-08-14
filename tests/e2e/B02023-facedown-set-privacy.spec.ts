// qa: card:B02023:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b

import { expect, test, type Page } from '@playwright/test';
import { B02023 } from '../../src/cards/ct-p02/B02023';
import { D08006 } from '../../src/cards/ct-d08/D08006';
import { D08007 } from '../../src/cards/ct-d08/D08007';
import { D08013 } from '../../src/cards/ct-d08/D08013';
import { D08019 } from '../../src/cards/ct-d08/D08019';
import {
  buildGameState,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
  type GameStateLike,
} from './helpers';

type AnyState = Record<string, unknown>;

async function useB02023ThroughRenderedControls(page: Page): Promise<void> {
  const handCard = page.locator(`.hand-mini-card[data-card-id="${B02023.id}"]`);
  await expect(handCard).toBeVisible();
  await handCard.click();
  const expandedHandCard = page.locator(
    `.hand-zone--expanded .hand-card[data-card-id="${B02023.id}"]`,
  );
  await expect(expandedHandCard).toBeVisible();
  await expandedHandCard.click();
  await expect(page.locator('.confirm-ok')).toBeVisible();
  await page.locator('.confirm-ok').click();

  const target = page.locator('.scene-area.side-self .card.effect-pickable[data-uid="target"]');
  await expect(target).toBeVisible({ timeout: 6000 });
  await target.click();
  await expect.poll(async () => {
    const state = await getGameState(page);
    return state.players.self.scene.find(char => char.uid === 'target')?.setCards.length ?? 0;
  }).toBe(1);
}

test('B02023 owner UI keeps its newly set deck-top card private', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const game = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    }).__game;
    game.store.getState().setSpectatorMode(false);
    game.store.getState().setAiPaused(true);
  });
  await buildGameState(page, (state: GameStateLike, fixture) => {
    const game = state as unknown as AnyState;
    const self = (game.players as { self: AnyState }).self;
    const sceneCharacter = (cardId: string, uid: string, enterOrder: number) => ({
      cardId,
      uid,
      state: 'active',
      isNamed: false,
      enterOrder,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    self.case = {
      cardId: fixture.caseCardId,
      status: '事件編',
      requiredEvidence: 7,
      colors: fixture.colors,
      declaredUseCount: {},
    };
    self.file = Array.from(
      { length: fixture.level },
      () => ({ type: 'card-back', cardId: fixture.tailCardId }),
    );
    self.hand = [fixture.sourceCardId];
    self.deck = [fixture.canaryCardId, fixture.tailCardId];
    self.scene = [
      sceneCharacter(fixture.targetCardId, 'target', 1),
      sceneCharacter(fixture.decoyCardId, 'decoy', 2),
    ];
    self.evidence = [];
    self.remove = [];
    game.pendingEffects = [];
    game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  }, {
    sourceCardId: B02023.id,
    targetCardId: D08006.id,
    decoyCardId: D08007.id,
    canaryCardId: D08013.id,
    tailCardId: D08019.id,
    caseCardId: 'D08026',
    colors: [...B02023.colors],
    level: B02023.level ?? 0,
  });

  await useB02023ThroughRenderedControls(page);

  const state = await getGameState(page);
  const target = state.players.self.scene.find(char => char.uid === 'target')!;
  expect(target.setCards).toEqual([
    expect.objectContaining({ cardId: D08013.id, faceUp: false }),
  ]);
  expect(state.players.self.deck).toEqual([D08019.id]);
  expect(state.players.self.scene.find(char => char.uid === 'decoy')!.setCards).toEqual([]);

  const inspect = page.getByTestId('scene-set-inspect-target');
  await expect(inspect).toBeVisible();
  const inspectGeometry = await inspect.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const points = [
      ['center', rect.left + rect.width / 2, rect.top + rect.height / 2],
      ['left', rect.left + 2, rect.top + rect.height / 2],
      ['right', rect.right - 2, rect.top + rect.height / 2],
      ['top', rect.left + rect.width / 2, rect.top + 2],
      ['bottom', rect.left + rect.width / 2, rect.bottom - 2],
    ] as const;
    const hits = points.map(([point, x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return {
        point,
        owned: hit !== null && element.contains(hit),
        target: hit instanceof HTMLElement
          ? hit.dataset.testid ?? hit.className
          : hit?.nodeName ?? null,
      };
    });
    return {
      width: rect.width,
      height: rect.height,
      insideViewport:
        rect.left >= 0 && rect.top >= 0 &&
        rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      hits,
      ownsCenterAndEdges: hits.every(hit => hit.owned),
    };
  });
  expect(inspectGeometry.width).toBeGreaterThanOrEqual(44);
  expect(inspectGeometry.height).toBeGreaterThanOrEqual(44);
  expect(inspectGeometry.insideViewport).toBe(true);
  expect(inspectGeometry.ownsCenterAndEdges, JSON.stringify(inspectGeometry.hits)).toBe(true);

  const decoyCard = page.locator('.scene-area.side-self [data-uid="decoy"]');
  const decoyArt = decoyCard.locator('.art');
  const adjacentGeometry = await Promise.all([
    inspect.boundingBox(),
    decoyCard.boundingBox(),
    decoyArt.boundingBox(),
  ]).then(([inspectBox, decoyBox, artBox]) => {
    if (!inspectBox || !decoyBox || !artBox) {
      throw new Error('adjacent scene-card geometry missing');
    }
    const overlapWidth = Math.max(
      0,
      Math.min(inspectBox.x + inspectBox.width, decoyBox.x + decoyBox.width) -
        Math.max(inspectBox.x, decoyBox.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(inspectBox.y + inspectBox.height, decoyBox.y + decoyBox.height) -
        Math.max(inspectBox.y, decoyBox.y),
    );
    return { artBox, overlapWidth, overlapHeight };
  });
  expect(adjacentGeometry.overlapWidth * adjacentGeometry.overlapHeight).toBe(0);

  await decoyArt.click({
    position: { x: 2, y: adjacentGeometry.artBox.height - 2 },
  });
  await expect(page.locator('.card-list-modal')).toHaveCount(0);
  await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);

  await page.getByTestId('scene-card-detail-decoy').click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);

  await inspect.focus();
  await page.keyboard.press('Enter');
  const modal = page.locator('.card-list-modal');
  await expect(modal).toBeVisible();
  const close = modal.locator('.card-list-modal-close');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(inspect).toBeFocused();

  await inspect.click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/1\s*枚/);
  await expect(modal).toContainText('非公開');

  const hidden = modal.getByTestId('card-list-facedown-set-0');
  await expect(hidden).toBeVisible();
  const hiddenBack = hidden.locator('.card-list-item-back');
  await expect(hiddenBack).toBeVisible();
  await expect(hiddenBack).toHaveAccessibleName('裏向きカード（非公開）');
  await expect(hidden.locator('img')).toHaveCount(0);
  await expect(hidden.locator('button')).toHaveCount(0);
  await expect(hidden).not.toHaveAttribute('data-card-id');
  await expect(hidden).not.toHaveAttribute('title');
  expect(await hidden.evaluate(element => element.tagName)).toBe('DIV');

  const forbidden = [D08013.id, D08013.names[0], D08013.no, D08013.imageUrl]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const modalHtml = await modal.evaluate(element => element.outerHTML);
  for (const value of forbidden) expect(modalHtml).not.toContain(value);
  await expect(modal.locator('[data-card-id]')).toHaveCount(0);
  await expect(modal.locator('[data-testid^="card-list-detail-"]')).toHaveCount(0);
  await expect(modal.locator('img')).toHaveCount(0);
  await hidden.click();
  await expect(page.locator('.card-expand-modal-backdrop')).toHaveCount(0);

  const geometry = await modal.evaluate(element => {
    const modalRect = element.getBoundingClientRect();
    const closeControl = element.querySelector<HTMLButtonElement>('.card-list-modal-close');
    if (!closeControl) throw new Error('set-card modal close control missing');
    const closeRect = closeControl.getBoundingClientRect();
    const owns = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && closeControl.contains(hit);
    };
    return {
      modalInsideViewport:
        modalRect.left >= 0 && modalRect.top >= 0 &&
        modalRect.right <= window.innerWidth && modalRect.bottom <= window.innerHeight,
      closeWidth: closeRect.width,
      closeHeight: closeRect.height,
      closeInsideViewport:
        closeRect.left >= 0 && closeRect.top >= 0 &&
        closeRect.right <= window.innerWidth && closeRect.bottom <= window.innerHeight,
      closeReceivesCenterAndEdgeHits: [
        [closeRect.left + closeRect.width / 2, closeRect.top + closeRect.height / 2],
        [closeRect.left + 2, closeRect.top + closeRect.height / 2],
        [closeRect.right - 2, closeRect.top + closeRect.height / 2],
        [closeRect.left + closeRect.width / 2, closeRect.top + 2],
        [closeRect.left + closeRect.width / 2, closeRect.bottom - 2],
      ].every(([x, y]) => owns(x!, y!)),
    };
  });
  expect(geometry.modalInsideViewport).toBe(true);
  expect(geometry.closeWidth).toBeGreaterThanOrEqual(44);
  expect(geometry.closeHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.closeInsideViewport).toBe(true);
  expect(geometry.closeReceivesCenterAndEdgeHits).toBe(true);
  expectNoConsoleErrors(errors);
});
