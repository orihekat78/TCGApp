import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

// user_request 20260521_01 #3: 相手ターン中の contact 処理
//
// 背景:
//   BUG-044 (`5ffed7c`) / BUG-045 (`9169af4`) で AI attack + spectator stall は
//   修正済だが、「人間 vs CPU で opp が self キャラに actionAgainstChar」した
//   時の guard / cutin / disguise modal flow は E2E で未検証だった。
//
// 検証内容:
//   1. opp action declare → GuardPickerModal 表示 (defender=self, !spectator)
//   2. guard skip → CutInDisguisePickerModal 表示 (decider=self, !spectator)
//   3. CID pass → action 完了 (activeActionId=null) → turn 戻る
//   4. OppTurnOverlay が attacker/target/phase を具体表示 (Phase 3-C UX)
//   5. case ターゲットでは target="事件" 表示
//
// 注: scene char の手動構築は SceneCharacter 型 (turnEffects / keywordOverrides
//     などのフルフィールド) が必要なので makeChar ヘルパを用意する。

type SceneCharLike = {
  cardId: string;
  uid: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
  enterOrder: number;
  setCards: never[];
  stackedCards: number;
  keywordOverrides: { granted: never[]; disabledOriginal: boolean };
  apOverride: null;
  lpOverride: null;
  turnEffects: { contactImmune: boolean; removeOnTurnEnd: boolean };
  declaredUseCount: Record<string, never>;
};

const MAKE_CHAR_FN = `function makeChar(uid, cardId, state) {
  return {
    cardId: cardId, uid: uid, state: state,
    isNamed: false, enterOrder: 0,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {}
  };
}`;

type GameWindow = {
  __game: {
    getState: () => {
      gameState: {
        turn: { player: 'self' | 'opp'; number: number; phase: string };
        players: {
          self: { scene: SceneCharLike[]; partner: { state: string }; hand: string[]; case: { status: string; requiredEvidence: number; cardId: string; colors: string[] }; evidence: unknown[] };
          opp: { scene: SceneCharLike[]; partner: { state: string }; hand: string[]; case: unknown; evidence: unknown[] };
        };
      };
      activeActionId: string | null;
    };
    setGameState: (gs: unknown) => void;
    dispatch: (action: unknown) => { ok: boolean };
    getActionContext: (id: string) => { phase: string; byPlayer: 'self' | 'opp'; byUid: string } | null;
  };
};

test.describe('user_request #3: opp ターン中 contact UI', () => {
  test('opp action → self キャラ: GuardPickerModal が表示される', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    // GameSetupModal を skip して直接 state を構築
    await page.evaluate((makeCharSrc) => {
      eval(makeCharSrc);
      // @ts-expect-error -- makeChar is defined via eval
      const mc = makeChar;
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as ReturnType<GameWindow['__game']['getState']>['gameState'];
      gs.turn.player = 'opp';
      gs.turn.phase = 'main';
      gs.turn.number = 2;
      gs.players.opp.scene = [mc('o1', 'D11003', 'active')];
      gs.players.self.scene = [mc('s1', 'D08003', 'sleep'), mc('s2', 'D08005', 'active')];
      w.__game.setGameState(gs);
      w.__game.dispatch({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    }, MAKE_CHAR_FN);

    // GuardPickerModal が出るのを待つ
    await expect(page.locator('[data-testid="guard-picker-modal"]')).toBeVisible({ timeout: 3000 });
    // OppTurnOverlay の status text が「attacker → target (ガード判定中)」
    const labelText = await page.locator('[data-testid="opp-turn-label"]').textContent();
    expect(labelText).toContain('→');
    expect(labelText).toMatch(/ガード判定中|コンタクト/);
    // 候補が表示されている (s2 が active なので 1 件以上)
    const candCount = await page.locator('[data-testid^="guard-cand-"]').count();
    expect(candCount).toBeGreaterThanOrEqual(1);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('GuardPickerModal skip → cutin hand-pick パス で action 完了', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate((makeCharSrc) => {
      eval(makeCharSrc);
      // @ts-expect-error -- makeChar defined via eval
      const mc = makeChar;
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as ReturnType<GameWindow['__game']['getState']>['gameState'];
      gs.turn.player = 'opp';
      gs.turn.phase = 'main';
      gs.turn.number = 2;
      gs.players.opp.scene = [mc('o1', 'D11003', 'active')];
      gs.players.self.scene = [mc('s1', 'D08003', 'sleep'), mc('s2', 'D08005', 'active')];
      // 候補0枚でも、人間側は手札確認 + 明示パスを行う。
      gs.players.self.hand = [];
      w.__game.setGameState(gs);
      w.__game.dispatch({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    }, MAKE_CHAR_FN);

    await expect(page.locator('[data-testid="guard-picker-modal"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="guard-picker-skip"]').click();

    // self の cutin 判断は候補0枚/手札0枚でも HandZone に表示。
    const skipBtn = page.locator('[data-testid="hand-zone-pick-skip"]');
    await expect(skipBtn).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.hand-zone-pick-banner')).toContainText('カットイン可能 0枚');
    await expect(page.locator('.hand-empty-message')).toContainText('手札なし');
    // 人間 decision 中は相手ターン overlay が手札を遮らない。
    await expect(page.locator('[data-testid="opp-turn-overlay"]')).toHaveCount(0);
    await skipBtn.click();
    await page.waitForFunction(
      () => {
        const w = window as unknown as GameWindow;
        const id = w.__game.getState().activeActionId;
        if (!id) return true;
        const ax = w.__game.getActionContext(id);
        return ax == null || ax.phase === 'action-end';
      },
      null,
      { timeout: 5000 },
    );

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('action[case]: OppTurnOverlay status に "事件" が表示される', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate((makeCharSrc) => {
      eval(makeCharSrc);
      // @ts-expect-error -- makeChar defined via eval
      const mc = makeChar;
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState() as ReturnType<GameWindow['__game']['getState']>['gameState'];
      gs.turn.player = 'opp';
      gs.turn.phase = 'main';
      gs.turn.number = 2;
      gs.players.opp.scene = [mc('o1', 'D11003', 'active')];
      // self に evidence を入れて action[case] 対象成立
      gs.players.self.case = {
        cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['blue'],
      };
      gs.players.self.evidence = [
        { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
      ];
      // self に active キャラを置いて guard 候補ありに (modal で停止させ overlay 読みやすく)
      gs.players.self.scene = [mc('s2', 'D08005', 'active')];
      w.__game.setGameState(gs);
      w.__game.dispatch({ type: 'actionDeclareCase', byUid: 'o1', targetPlayer: 'self' });
    }, MAKE_CHAR_FN);

    // 何らかの phase で overlay が表示される (guard-window で modal あり or auto-pass で短時間)
    await expect(page.locator('[data-testid="opp-turn-overlay"]')).toBeVisible({ timeout: 3000 });
    // overlay 内に "事件" が含まれる (target.kind==='case' で nameOfUid='事件' のため)
    // 注: action が auto-pass で進行中の場合 phase 遷移が速いため、複数回 polling
    const seenJiken = await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="opp-turn-label"]');
        return el?.textContent?.includes('事件') ?? false;
      },
      null,
      { timeout: 3000 },
    ).then(() => true).catch(() => false);
    expect(seenJiken, 'overlay label に "事件" が含まれることを期待').toBe(true);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
