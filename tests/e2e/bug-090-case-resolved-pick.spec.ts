// E2E regression: BUG-090 — human の auto-phase で 事件編→解決編 になり case card a1
// (case:to-resolved → discard) が発火したとき、discard pick が UI に surface して
// 手札から1枚選んでリムーブできること (旧バグ: driveOppTurn が side-channel を store へ
// 転送せず「何も起きない」だった)。
//
// シナリオ:
//   1. self = D08026 (青) 事件編 / FILE 6 / 手札2枚 / deck 十分、turn.player='opp'
//   2. opp は endTurn しかできない最小状態 → useOppTurnDriver が driveOppTurn を実行
//   3. opp endTurn → flow.startTurn(self) の auto-phase で FILE +2 = 8 → 解決編
//   4. a1 が発火し discard pick が pendingEffectPick へ surface (修正後)
//   5. HandZone が pick mode で auto-expand → 手札カードを選択 → リムーブエリアへ移動

import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

async function primeHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setAiSpeedMs: (n: number) => void; setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
    w.__game.store.getState().setAiSpeedMs(0); // driver 即時化
  });
}

async function getPendingEffectPick(page: Page): Promise<{
  player: string;
  atomVerb: string;
  candidates: { uid: string; cardId: string; player: string }[];
} | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick;
  })) as { player: string; atomVerb: string; candidates: { uid: string; cardId: string; player: string }[] } | null;
}

type AnyState = Record<string, unknown>;

function applyFixture(gs: AnyState): void {
  const players = gs.players as { self: AnyState; opp: AnyState };
  const self = players.self;
  const opp = players.opp;

  // self: D08026 (青) 事件編, FILE 6, deck 十分, 手札2枚, partner active, scene/evidence 空
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D08017' };
  self.file = [fb, fb, fb, fb, fb, fb]; // 6 → auto-phase +2 = 8 → 解決編
  self.deck = ['D08017', 'D08017', 'D08017', 'D08017'];
  self.hand = ['D08017', 'D08019'];
  self.scene = [];
  self.evidence = [];
  self.remove = [];

  // opp: endTurn しかできない最小状態
  opp.partner = { cardId: 'PO', state: 'sleep', location: 'partner-area' };
  opp.case = { cardId: 'CO', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
  opp.deck = ['c1', 'c2', 'c3'];
  opp.hand = [];
  opp.scene = [];
  opp.evidence = [];
  opp.file = [];

  gs.pendingEffects = [];
  gs.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('BUG-090 — human auto-phase 解決編移行で a1 discard pick が surface', () => {
  test('FILE→8→解決編→a1: pendingEffectPick(discard) が出て手札からリムーブできる', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHumanSelf(page);
    await buildGameState(page, applyFixture);

    // driveOppTurn が opp endTurn → self auto-phase を回し、FILE が 7+ で解決編へ
    await expect
      .poll(async () => (await getGameState(page)).players.self.case.status, { timeout: 8000 })
      .toBe('解決編');

    // 修正の核心: a1 の discard pick が store に surface している (旧バグでは null)
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 8000 })
      .toBe('discard');

    const pending = await getPendingEffectPick(page);
    expect(pending?.player).toBe('self');
    expect((pending?.candidates.length ?? 0), '手札候補が存在').toBeGreaterThan(0);

    // 手札が pick mode で expand され、選択可能カードが表示される
    await expect(page.locator('.hand-card--pickable').first()).toBeVisible({ timeout: 5000 });

    // 機能確認 (画面表示 ≠ 機能): 手札候補を選択 → リムーブエリアへ移動
    const before = await getGameState(page);
    const handBefore = (before.players.self as { hand: string[] }).hand.length;
    const removeBefore = ((before.players.self as { remove?: string[] }).remove ?? []).length;

    const pickUid = pending!.candidates[0]!.uid;
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: pickUid });

    await expect
      .poll(async () => ((await getGameState(page)).players.self as { hand: string[] }).hand.length, { timeout: 5000 })
      .toBe(handBefore - 1);

    const after = await getGameState(page);
    const removeAfter = ((after.players.self as { remove?: string[] }).remove ?? []).length;
    expect(removeAfter, '選んだ手札がリムーブエリアへ').toBe(removeBefore + 1);

    // pick 解決後は pendingEffectPick が消える
    expect(await getPendingEffectPick(page)).toBeNull();

    expect(errors, 'console error 0').toEqual([]);
  });
});
