// E2E: 2026-06-05 engine 拡張バッチ監査 (workflow audit-engine-extension-batches) で検出した
// BUG-117 同型 3 件の実機検証。いずれも「型/DSL に在る field/前提を engine 評価経路が黙って無視」する型。
//
//   BUG-118: matchOneFilter (candidates.ts) が filter.kind を評価しない
//            → B04009「リムーブの【青】イベントを1枚」が kind:'event' 黙殺で 青キャラも候補化
//   BUG-119: clearTurnEffects が lvlMod_turn/lvlMod_contact を消さない
//            → charModifyLevel scope:'turn'「ターン終了時までレベル-1」が permanent 化 (B07103 a2)
//   BUG-120: charSetCard short-form が byPlayer=resolvePlayer(a.player) を渡す
//            → player:'opp' (B02020 等) で『controller が相手キャラを選ぶ』の選択者が相手になる
//
// 修正前は各テストが fail / 修正後 pass。seam: __game.setGameState。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction } from './helpers';

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
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

async function levelOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { level: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.level(w.__game.getState().gameState, u);
  }, uid);
}

type AnyState = Record<string, unknown>;
// 注: buildGameState の modifier は文字列化され browser context で実行されるため外部スコープ参照不可。
// mkC は各 modifier 内にインライン定義する (engine-extensions spec と同方針)。

test.describe('engine-extension audit fixes (BUG-118/119/120, 2026-06-05)', () => {
  // ============================================================
  // BUG-118: handAddFromRemove の filter.kind が matchOneFilter で黙殺
  // ============================================================
  test('BUG-118 B04009: リムーブの【青】"イベント"のみ候補 (青キャラは kind:event で除外)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [mkC('B04009', 'hai#1')];
      // リムーブに 青イベント(D08024) と 青キャラ(D08009)。kind:'event' で D08024 のみが候補であるべき
      self.remove = ['D08024', 'D08009'];
      self.hand = []; self.evidence = []; self.deck = ['D08005', 'D08013'];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'declaredAbility', uid: 'hai#1', abilId: 'a1' });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('handAddFromRemove');
    const pending = await getPendingEffectPick(page);
    const ids = (pending?.candidates ?? []).map((c) => c.cardId);
    expect(ids, '青イベント D08024 が候補').toContain('D08024');
    expect(ids, '青キャラ D08009 は候補に入らない (kind:event filter)').not.toContain('D08009');
    expect(errors).toEqual([]);
  });

  // ============================================================
  // BUG-119: charModifyLevel scope:'turn' がターン終了で戻らない
  // ============================================================
  test('BUG-119 B07103 a2: turn-level-1 はターン終了で素値に戻る (lvlMod_turn clear)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = [mkC('B07103', 'bbn#1')];
      self.hand = []; self.evidence = []; self.remove = []; self.deck = ['D08005', 'D08013', 'D08019'];
      opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
      opp.scene = [mkC('B07103', 'opp#1', 'sleep')]; // printed level 4
      opp.hand = []; opp.evidence = []; opp.remove = []; opp.deck = ['D08005', 'D08013', 'D08019', 'D08021'];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    expect(await levelOf(page, 'opp#1'), 'pre: printed level 4').toBe(4);

    await dispatchAction(page, { type: 'declaredAbility', uid: 'bbn#1', abilId: 'a2' });
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charModifyLevel');
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'opp#1' });
    expect(await levelOf(page, 'opp#1'), 'mid: turn-scope level 3').toBe(3);

    // self のターンを終了 → clearTurnEffects('turn') で opp#1 の lvlMod_turn が消えるべき
    await dispatchAction(page, { type: 'endTurn', player: 'self' });

    expect(await levelOf(page, 'opp#1'), 'post: ターン終了で素値 4 に復帰 (lvlMod_turn clear)').toBe(4);
    expect(errors).toEqual([]);
  });

  // ============================================================
  // BUG-120: charSetCard short-form の選択者 (chooser) が controller でなく相手になる
  // ============================================================
  test('BUG-120 B02020 a2: 相手キャラへの setCard は controller(self) が選ぶ (chooser=controller)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
      self.scene = [];
      self.hand = ['B02020']; self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 — B02020 (level 6) 使用可
      self.deck = ['D08005'];
      // 相手の現場に 2 体 (set 対象候補)、相手デッキに上端カード
      opp.scene = [mkC('D08013', 'o#1'), mkC('D08019', 'o#2')];
      opp.deck = ['D08006', 'D08007']; opp.hand = []; opp.evidence = []; opp.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B02020' });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charSetCard');
    const pending = await getPendingEffectPick(page);
    expect(pending?.player, '選択者は controller(self) — rules/15「効果を使うプレイヤーが対象を選ぶ」').toBe('self');
    // 候補は相手の現場 (side:'opp')
    const candUids = (pending?.candidates ?? []).map((c) => c.uid).sort();
    expect(candUids, '相手キャラ o#1/o#2 が候補').toEqual(['o#1', 'o#2']);
    expect(errors).toEqual([]);
  });
});
