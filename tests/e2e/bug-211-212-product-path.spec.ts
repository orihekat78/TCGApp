import { expect, test, type Page } from '@playwright/test';
import { buildGameState, getGameState, setupGamePage } from './helpers';

type AnyState = Record<string, any>;

async function primeHumanVsCpu(page: Page, paused: boolean): Promise<void> {
  await page.evaluate((isPaused) => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as any).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiSpeedMs(0);
    store.setAiPaused(isPaused);
  }, paused);
}

async function readTargetPickerPhase(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/src/ui/hooks/useTargetPicker.ts'));
    if (!moduleUrl) return null;
    const { useTargetPickerStore } = await import(/* @vite-ignore */ moduleUrl);
    return useTargetPickerStore.getState().phase.phase;
  });
}

function applyZeroTargetFixture(gs: AnyState): void {
  const character = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun', isNamed = false) => ({
    cardId, uid, state, isNamed, enterOrder: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const self = gs.players.self;
  const opp = gs.players.opp;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area', turnEffects: {} };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 99, colors: ['青'], declaredUseCount: {} };
  self.scene = [character('D08009', 'charge-source', 'active', false)];
  self.hand = [];
  self.deck = Array.from({ length: 30 }, () => 'D08005');
  self.file = [];
  self.evidence = [];
  self.remove = [];

  opp.partner = { cardId: 'D11001', state: 'active', location: 'partner-area', turnEffects: {} };
  opp.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 99, colors: ['黄'], declaredUseCount: {} };
  // Active characters are not ordinary action targets. Evidence 0 also makes
  // the case illegal, so selecting charge-source must produce zero targets.
  opp.scene = [character('D11003', 'active-decoy', 'active', true)];
  opp.hand = [];
  opp.deck = Array.from({ length: 30 }, () => 'D11020');
  opp.file = [];
  opp.evidence = [];
  opp.remove = [];
  gs.pendingEffects = [];
  gs.log = [];
  gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function applyContactFixture(gs: AnyState): void {
  const character = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun', isNamed = false) => ({
    cardId, uid, state, isNamed, enterOrder: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const self = gs.players.self;
  const opp = gs.players.opp;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area', turnEffects: {} };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 99, colors: ['青'], declaredUseCount: {} };
  self.scene = [character('D02007', 'okita-attacker', 'active', false)];
  self.hand = ['D08005', 'D08006', 'D08007'];
  self.deck = ['D08008', 'D08009'];
  self.file = [];
  self.evidence = [];
  self.remove = [];

  opp.partner = { cardId: 'D11001', state: 'active', location: 'partner-area', turnEffects: {} };
  opp.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 99, colors: ['黄'], declaredUseCount: {} };
  opp.scene = [character('D08017', 'mitsuhiko-defender', 'sleep', true)];
  opp.hand = ['D11003', 'D11004'];
  opp.deck = ['D11005', 'D11006'];
  opp.file = [];
  opp.evidence = [];
  opp.remove = [];
  gs.pendingEffects = [];
  gs.log = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('BUG-211/212 actual UI product paths', () => {
  test('BUG-211: zero-target source aborts before target picker and leaves no state across a CPU cycle', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHumanVsCpu(page, false);
    await buildGameState(page, applyZeroTargetFixture);

    await page.locator('[data-action-id="action"]').click();
    await expect(page.locator('.scene-area.side-self .card[data-uid="charge-source"]')).toHaveClass(/candidate/);
    await page.locator('.scene-area.side-self .card[data-uid="charge-source"]').click();

    // The zero-target gate must run before target-picker creation.
    await expect.poll(() => readTargetPickerPhase(page)).toBe('idle');
    await expect(page.locator('[data-action-id="action"]')).not.toHaveClass(/active/);
    await expect(page.getByText('アクション対象 の対象を選択してください。')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__game.getState().activeActionId)).toBeNull();

    await page.getByRole('button', { name: 'ターン終了' }).click();
    await page.locator('.confirm-modal-footer .confirm-ok').click();

    // Let the real CPU driver complete its turn, then inspect the next self turn.
    await expect.poll(async () => {
      const state = await getGameState(page);
      return `${state.turn.player}:${state.turn.number}`;
    }, { timeout: 15_000 }).toMatch(/^self:(?:[4-9]|[1-9]\d+)$/);

    const clean = await page.evaluate(async () => {
      const w = window as any;
      const ui = w.__game.getState();
      const moduleUrl = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => name.includes('/src/ui/hooks/useTargetPicker.ts'));
      const picker = moduleUrl
        ? (await import(/* @vite-ignore */ moduleUrl)).useTargetPickerStore.getState().phase.phase
        : null;
      return {
        picker,
        activeActionId: ui.activeActionId,
        pendingEffectPick: ui.pendingEffectPick,
        pendingChoice: ui.pendingEffectChoice,
      };
    });
    expect(clean).toEqual({ picker: 'idle', activeActionId: null, pendingEffectPick: null, pendingChoice: null });

    // A different legal action must still work on the new human turn.
    const evidenceBefore = (await getGameState(page)).players.self.evidence.length;
    await page.locator('[data-action-id="reasoning"]').click();
    await page.locator('.partner-area.side-self .card.candidate').click();
    await page.locator('.confirm-modal-footer .confirm-ok').click();
    await expect.poll(async () => (await getGameState(page)).players.self.evidence.length).toBeGreaterThan(evidenceBefore);
    expect(errors).toEqual([]);
  });

  test('BUG-212: D02007 contact removes D08017 without creating a rootless hand-remove pending', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHumanVsCpu(page, true);
    await buildGameState(page, applyContactFixture);

    await page.locator('[data-action-id="action"]').click();
    await page.locator('.scene-area.side-self .card[data-uid="okita-attacker"]').click();
    await page.locator('.scene-area.side-opp .card[data-uid="mitsuhiko-defender"]').click();
    await page.locator('.confirm-modal-footer .confirm-ok').click();

    // The production contact window opens even when the player declines its
    // legal cut-in. Resolve it through the visible UI before observing cleanup.
    const pass = page.getByRole('button', { name: 'パス', exact: true });
    await expect(pass).toBeVisible({ timeout: 10_000 });
    await pass.click();

    await expect.poll(async () => page.evaluate(() => (window as any).__game.getState().activeActionId), { timeout: 10_000 }).toBeNull();

    // Sample multiple delayed React/driver ticks. A provenance-less discard
    // used to appear only after contact had visibly completed.
    const observedPending: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(250);
      const pending = await page.evaluate(() => (window as any).__game.getState().pendingEffectPick);
      if (pending !== null) observedPending.push(pending);
    }

    const after = await getGameState(page);
    expect(after.players.self.hand).toEqual(['D08005', 'D08006', 'D08007']);
    expect(after.players.opp.hand).toEqual(['D11003', 'D11004']);
    expect(after.players.opp.scene).toHaveLength(0);
    expect(after.players.opp.remove).toContain('D08017');
    expect(observedPending, 'unexpected pending includes its production source/owner/chooser payload').toEqual([]);
    expect(errors).toEqual([]);
  });
});
