// E2E: M3 PA batch — パートナーエリア常駐 MR の宣言能力 human 経路 (実機クリック)
//
// 検証対象 (UI 基盤 3+3 点、本 session 新設):
//   - PartnerArea partnerAreaMR tile 描画 + candidate 強調 + クリック選択
//   - enumDeclaredAbilitySources の partnerMR:self source 列挙
//   - flows resolveDeclaredSourceCardId / uidToDisplayName の partnerMR: 解決 (confirm 文言)
//
// カード: B05066 赤井秀一＆沖矢昴 a2 (scope 補正済) —
//   「【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//     この能力はパートナーエリアでも宣言できる。」
//   decoy: 自分の現場キャラ (side:'opp' → pick 候補に出ないこと = 画面処理とテキスト語義の 1対1)
//
// seam: __game.setGameState (bug-085 / bug-117 と同パターン)
// rules: 18-mr.md §パートナーエリアにいるMRキャラ / 21-declared-ability-cost.md / 15 (「〜まで」=0可)

import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  expectNoConsoleErrors,
  type GameStateLike,
} from './helpers';

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

// 注: buildGameState は modifier を string 化して page 内で実行するため、
// fixture 内では外部ヘルパ参照不可 — SceneCharacter 形は literal 直書き。
function applyFixture(gs: GameStateLike): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    partnerAreaMR: unknown;
    scene: unknown[]; hand: string[];
  };
  const opp = gs.players.opp as unknown as { scene: unknown[] };
  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';
  // PA 常駐 MR (MR能力① で移動してきた想定、rules/18)
  self.partnerAreaMR = {
    uid: 'partnerMR:self', cardId: 'B05066', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
  // decoy: 自分の現場キャラ (side:'opp' 対象なので候補に出ない)
  self.scene = [
    {
      uid: 'self-decoy', cardId: 'D08013', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    },
  ];
  // 相手現場: レベル-1 対象
  opp.scene = [
    {
      uid: 'opp-v', cardId: 'D08013', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    },
  ];
  (gs as unknown as { turn: unknown }).turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}
test.describe('M3 — PA 常駐 MR の宣言能力 (実機クリック)', () => {
  test('PA-MR tile 表示 → 宣言能力 → tile 強調クリック → 確認 → 相手キャラ選択 → レベル-1', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, applyFixture);

    // 0) PA-MR tile が描画される。カード名表示は cards.json 由来 (非 MVP カードは '???' fallback、
    //    表示データ制約で M3 スコープ外) — data-card-id と MR 状態ラベルで tile 実在を確認。
    const tile = page.locator('[data-testid="pa-mr-self"]');
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('data-card-id', 'B05066');
    await expect(tile).toContainText('MR ● アクティブ');

    // 1) ACTIONS 「宣言能力」
    await page.locator('[data-action-id="declared-ability"]').click();

    // 2) source picker: PA-MR tile が candidate 強調される → クリック
    await expect(tile).toHaveClass(/candidate/);
    await tile.click();

    // 3) 確認モーダル: raw uid でなく MR 名が表示される (uidToDisplayName partnerMR: 解決)
    const confirmBody = page.locator('.confirm-modal, [class*="confirm"]').first();
    await expect(confirmBody).toContainText('赤井秀一');
    await page.locator('.confirm-ok').click();

    // 4) charModifyLevel pick: 相手現場キャラのみ候補 (side:'opp' — 自現場 decoy は候補外)
    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { pendingEffectPick: { candidates: { uid: string }[] } | null } } };
      return w.__game.getState().pendingEffectPick != null;
    }, { timeout: 5000 });
    const candUids = await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { pendingEffectPick: { candidates: { uid: string }[] } | null } } };
      return (w.__game.getState().pendingEffectPick?.candidates ?? []).map((c) => c.uid);
    });
    expect(candUids, '相手現場のみ候補 (テキスト「相手の現場にいるキャラ」)').toEqual(['opp-v']);

    // 5) 相手キャラをクリック → レベル-1 反映
    await page.locator('[data-uid="opp-v"]').click();
    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { opp: { scene: { uid: string; turnEffects: Record<string, unknown> }[] } } } } } };
      const c = w.__game.getState().gameState.players.opp.scene.find((x) => x.uid === 'opp-v');
      return c != null && c.turnEffects['lvlMod_turn'] === -1;
    }, { timeout: 5000 });

    // 6) 【ターン1】消費 + log 記録
    const state = await getGameState(page);
    const paMr = (state.players.self as unknown as { partnerAreaMR: { declaredUseCount: Record<string, number> } }).partnerAreaMR;
    expect(paMr.declaredUseCount['a2'], '【ターン1】使用回数記録').toBe(1);
    // pick 適用後は effect:charModifyLevel が末尾に追記されるため「含む」で assert
    const log = (state as unknown as { log: { action: string; target?: string }[] }).log;
    const decl = log.find((e) => e.action === 'declaredAbility' && (e.target ?? '').includes(':a2'));
    expect(decl, 'declaredAbility :a2 が log に記録').toBeTruthy();

    expectNoConsoleErrors(errors);
  });
});
