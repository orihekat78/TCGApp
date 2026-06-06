// E2E: engine-extension event→evidence batch (2026-06-06 タスクC) — text-faithfulness 実機検証
//   B04015「……なるほどな…」(青, Lv7): 「このカードを表向きのまま証拠として得る」
//   → イベント使用で自身が **表向きで証拠エリア** に入り (証拠+1)、リムーブには行かないことを実機確認。
import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

type AnyState = Record<string, unknown>;

test.describe('event→evidence 2026-06-06 (タスクC)', () => {
  test('B04015: イベント使用で自身を表向き証拠化 (証拠+1, remove行きでない)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
      const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
      w.__game.store.getState().setSpectatorMode(false);
    });
    await buildGameState(page, (gs: AnyState) => {
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [];
      self.hand = ['B04015'];
      self.deck = ['D08013', 'D08019'];
      self.evidence = [];
      self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE7 ≥ level7 (handUseCard 可)
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const evBefore = ((await getGameState(page)).players.self as { evidence: unknown[] }).evidence.length;
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04015' });

    const gs = await getGameState(page);
    const self = gs.players.self as { evidence: { cardId: string; faceUp: boolean }[]; remove: string[]; hand: string[] };
    const ev = self.evidence.find((e) => e.cardId === 'B04015');
    expect(ev, 'B04015 が証拠エリアに').toBeTruthy();
    expect(ev?.faceUp, '表向きで証拠化').toBe(true);
    expect(self.evidence.length, '証拠 +1').toBe(evBefore + 1);
    expect(self.remove, 'リムーブには行かない (remove→evidence)').not.toContain('B04015');
    expect(self.hand, '手札から消費').not.toContain('B04015');
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
