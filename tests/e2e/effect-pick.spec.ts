// E2E regression: BUG-053 / BUG-054 — human player effect pick UI 経路
//
// シナリオ:
//   1. 人間 (self) が D08025「蘭の一撃」を手札使用
//   2. _humanPlayerSide='self' なら resolveEffectPicks が humanChooser fired
//      → pendingEffectPick が store にセットされる (auto-pick されない)
//   3. effectPickResolve({ pickedUid }) dispatch で対象が scene からリムーブ
//   4. n.min===0 の任意効果なので effectPickResolve({ pickedUid: null }) で
//      skip も可能
//
// 関連:
//   - BUG-053 (`7b1e86b`) human auto-pick 停止 (基盤)
//   - BUG-054 (`bacc22b`) EffectPickerModal + effectPickResolve dispatch
//   - tests/e2e/patterns/event-remove-by-ap.spec.ts (engine-level の同 card 検証)

import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  dispatchAction,
  expectNoConsoleErrors,
  type GameStateLike,
} from './helpers';

type FixtureArg = { cardId: string };

type FileCardLike = { type: 'card-back'; cardId: string };

/**
 * 蘭の一撃 (D08025、青 Lv5) を self 手札に置き、opp scene に AP8000 以下の
 * キャラを 1 枚配置。partner=青 (D08001 江戸川コナン) で
 * additionalCondition:{ partnerColor:'青' } を通す。
 */
function applyFixture(gs: GameStateLike, arg: FixtureArg): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
    hand: string[];
    file: FileCardLike[];
    scene: unknown[];
  };
  const opp = gs.players.opp as unknown as {
    hand: string[];
    scene: { uid: string; cardId: string; state: string; location: string; nameds: boolean }[];
  };

  // partner = 青 (D08001 江戸川コナン)
  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';

  // case = D08026 (青)
  self.case.cardId = 'D08026';
  self.case.status = '事件編';
  self.case.requiredEvidence = 7;
  self.case.colors = ['青'];

  // file 8 枚 (D08025 lv5 通過)
  const fileBack: FileCardLike = { type: 'card-back', cardId: 'D08003' };
  self.file = [fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack];

  // hand: 蘭の一撃 1 枚のみ
  self.hand = [arg.cardId];
  self.scene = [];

  // opp scene: AP8000 以下のターゲット (D08003: AP6000) を 1 枚 sleep で配置
  // (アクション可能でなくとも sceneRemove 効果はリムーブ可能)
  // SceneCharacter 全 field を満たす必要あり (mutate.scene.remove が
  // setCards.map / stackedCards 等を参照)
  opp.scene = [
    {
      uid: 'opp-1',
      cardId: 'D08003',
      state: 'sleep',
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    },
  ];
  opp.hand = [];

  // pendingEffects 空
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];

  // turnState reset
  const ts = (gs as unknown as { turnState: { self: { handUseUsed: boolean; nextHintUsed: boolean } } }).turnState;
  ts.self.handUseUsed = false;
  ts.self.nextHintUsed = false;
}

/**
 * humanPlayerSide を 'self' に強制設定 (spectator mode off と等価)。
 * BUG-053 で導入された側チャネル。
 */
async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

/**
 * `pendingEffectPick` を store から読む。BUG-054 で導入された field。
 */
async function getPendingEffectPick(page: Page): Promise<{
  player: string;
  candidates: { uid: string; cardId: string; player: string }[];
  atomVerb: string;
  nMin: number;
  nMax: number;
  source: { cardId: string; abilityId: string };
} | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as {
      __game: { getState: () => { pendingEffectPick: unknown } };
    };
    return w.__game.getState().pendingEffectPick;
  })) as ReturnType<typeof getPendingEffectPick> extends Promise<infer T> ? T : never;
}

test.describe('BUG-053/054 — human player effect pick UI 経路 (D08025 蘭の一撃)', () => {
  test('humanChooser fired → pendingEffectPick set + effectPickResolve で対象リムーブ', async ({
    page,
  }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState<FixtureArg>(page, applyFixture, { cardId: 'D08025' });

    // dispatch handUseCard → triggered listener が humanChooser=true で
    // $pick を未解決のまま side-channel にセット → drain → store.pendingEffectPick
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D08025' });

    const pending = await getPendingEffectPick(page);
    expect(pending, 'pendingEffectPick が set されている').not.toBeNull();
    expect(pending!.player, 'player=self (human)').toBe('self');
    expect(pending!.atomVerb, 'atomVerb=sceneRemove').toBe('sceneRemove');
    expect(pending!.source.cardId, 'source.cardId=D08025').toBe('D08025');
    expect(pending!.nMin, 'n.min=0 (任意効果)').toBe(0);
    expect(pending!.nMax, 'n.max=1').toBe(1);
    expect(
      pending!.candidates.length,
      '候補に opp-1 (AP8000 以下) が含まれる',
    ).toBeGreaterThanOrEqual(1);
    const targetUid = pending!.candidates.find((c) => c.uid === 'opp-1')?.uid;
    expect(targetUid, '候補に opp-1 がいる').toBe('opp-1');

    // dispatch effectPickResolve → atom が re-queue → 効果実行
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'opp-1' });

    // resolve 後、pendingEffectPick は null
    const cleared = await getPendingEffectPick(page);
    expect(cleared, 'resolve 後は pendingEffectPick=null').toBeNull();

    // opp scene から opp-1 が消えている (リムーブ成功)
    const state = await getGameState(page);
    const oppScene = (state.players.opp as unknown as { scene: { uid: string }[] }).scene;
    const survived = oppScene.find((c) => c.uid === 'opp-1');
    expect(survived, 'opp-1 は scene から除去された').toBeUndefined();

    expectNoConsoleErrors(errors);
  });

  test('任意効果 (n.min===0) で effectPickResolve({ pickedUid:null }) → no-op skip', async ({
    page,
  }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState<FixtureArg>(page, applyFixture, { cardId: 'D08025' });

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D08025' });

    const pending = await getPendingEffectPick(page);
    expect(pending!.nMin, 'D08025 は任意効果').toBe(0);

    // skip: pickedUid=null
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: null });

    const cleared = await getPendingEffectPick(page);
    expect(cleared, 'skip でも pendingEffectPick=null クリア').toBeNull();

    // 対象は残っている (no-op)
    const state = await getGameState(page);
    const oppScene = (state.players.opp as unknown as { scene: { uid: string }[] }).scene;
    expect(oppScene.find((c) => c.uid === 'opp-1'), 'skip で opp-1 は残る').toBeDefined();

    expectNoConsoleErrors(errors);
  });
});
