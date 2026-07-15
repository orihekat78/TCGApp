// E2E: engine-extension disguise-hook batch (2026-06-06 タスクC) — text-faithfulness 実機検証
//   1. 変装ゲート条件 (canDisguise の condition 評価) が画面文言と一致:
//      B03129 ベルモット 【変装】【FILE6】 → FILE6 で変装可 / FILE5 で不可
//   2. 【変装時】(disguise:into hook) が実機で発火:
//      自陣 attacker が B03129 に変装 → CID モーダルに「変装」候補表示 → 選択 → 1ドロー (変装時) 発火
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction, waitForActionEnd } from './helpers';

type AnyState = Record<string, unknown>;

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

function mk(cardId: string, uid: string, state: string): AnyState {
  return { cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} };
}

// canDisguise を seam 経由で評価 (ax は最小構築: byPlayer=self の攻撃キャラ)
async function canDisguise(page: Page, byUid: string, targetUid: string, cardId: string): Promise<boolean> {
  return page.evaluate(({ b, t, c }) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; flow: { contact: { canDisguise: (s: unknown, ax: unknown, p: string, cardId: string) => boolean } } } };
    const gs = w.__game.getState().gameState;
    const ax = { byUid: b, byPlayer: 'self', target: { kind: 'char', uid: t }, cutInUsed: {} };
    return w.__game.flow.contact.canDisguise(gs, ax, 'self', c);
  }, { b: byUid, t: targetUid, c: cardId });
}

function buildBoard(fileCount: number) {
  return (gs: AnyState, n: number) => {
    const mkC = (cardId: string, uid: string, st: string) => ({ cardId, uid, state: st, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
    const self = (gs.players as AnyState).self as AnyState;
    const opp = (gs.players as AnyState).opp as AnyState;
    self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
    self.scene = [mkC('D08005', 's1', 'active')]; // attacker (active, 名乗りなし)
    opp.scene = [mkC('D08006', 'o1', 'sleep')]; // action[char] 対象 (sleep) — ガード候補なし
    self.hand = ['B03129', 'D08017', 'D08003'];
    self.deck = ['D08013']; // 変装時 1ドロー対象
    self.evidence = []; self.remove = [];
    const fb = { type: 'card-back', cardId: 'D08017' };
    self.file = Array.from({ length: n }, () => fb);
    gs.pendingEffects = [];
    gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  };
}

test.describe('disguise-hook 2026-06-06 (タスクC)', () => {
  test('B03129: 変装ゲート 【FILE6】 — FILE6で変装可 / FILE5で不可 (canDisguise)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, buildBoard(6), 6);
    expect(await canDisguise(page, 's1', 'o1', 'B03129'), 'FILE6 → 変装可').toBe(true);
    await buildGameState(page, buildBoard(5), 5);
    expect(await canDisguise(page, 's1', 'o1', 'B03129'), 'FILE5 → 変装不可').toBe(false);
    expect(errors).toEqual([]);
  });

  test('B03129: 【変装時】(disguise:into) — 変装で 1ドロー発火 (FILE6 / 実機 contact)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, buildBoard(6), 6);

    // 自陣 attacker (s1) が 相手 sleep キャラ (o1) に action[char] 宣言 → contact
    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 's1', targetUid: 'o1' });

    // self の contact window で CID モーダルに「変装」候補 B03129 が出る (canDisguise=true)
    await expect(page.locator('[data-testid="cid-disg-B03129#0"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="cid-hand-card-"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="cid-hand-card-B03129#0"]')).toHaveClass(/is-eligible/);
    await expect(page.locator('[data-testid="cid-hand-card-D08017#1"]')).toHaveClass(/is-eligible/);
    await expect(page.locator('[data-testid="cid-hand-card-D08003#2"]')).not.toHaveClass(/is-eligible/);
    await expect(page.locator('[data-testid="cid-cutin-D08017#1"]')).toBeVisible();
    await page.locator('[data-testid="cid-hand-expand-D08003#2"]').click();
    await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await page.locator('[data-testid="cid-disg-B03129#0"]').click();

    await waitForActionEnd(page);
    const gs = await getGameState(page);
    const self = gs.players.self as { deck: string[]; scene: { uid: string; cardId: string }[]; hand: string[] };
    // 変装で attacker の cardId が B03129 に差替え (uid 維持, rules/09)
    expect(self.scene.find((c) => c.uid === 's1')?.cardId, '変装で cardId=B03129').toBe('B03129');
    // 【変装時】1ドロー発火 → 引いた D08013 が手札に (deck から hand へ移動)
    expect(self.hand, '変装時 1ドローで D08013 が手札に').toContain('D08013');
    expect(self.deck, '引いた D08013 はデッキから抜けた').not.toContain('D08013');
    // rules/09: 変装した元キャラ (D08005) はデッキの下へ
    expect(self.deck, '変装した元キャラ D08005 がデッキ下へ').toContain('D08005');
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('mixed hand keeps the cut-in action selectable', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, buildBoard(6), 6);

    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 's1', targetUid: 'o1' });
    await expect(page.locator('[data-testid="cid-cutin-D08017#1"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="cid-cutin-D08017#1"]').click();

    await waitForActionEnd(page);
    const gs = await getGameState(page);
    const log = gs.log as { action?: string; player?: string }[];
    expect(log.some((entry) => entry.action === 'contact-cutin' && entry.player === 'self')).toBe(true);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
