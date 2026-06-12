// E2E: engine-extension reasoning-hook (2026-06-06 タスクC) の実機 text-faithfulness 検証。
//
// B01017 本堂瑛祐「このキャラが推理したとき、デッキ上2枚見て[探偵]のキャラを1枚まで手札に加え、残りデッキ下」。
// reasoning:end hook で triggered ability が発火し、deck-look-N が「[探偵]のキャラ」のみ拾うことを
// decoy (非[探偵]) を盤面に置いて確認 (card-addition-checklist §7)。
//
// seam: __game.setGameState (bug-117/118-120 と同パターン)。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

// BUG-132 GAP-1 (2026-06-12): B01017 は「1枚まで」型 → 取得/decline pick が先に surface する
async function getPendingEffectPick(page: Page): Promise<{
  atomVerb: string;
  candidates: { uid: string; cardId: string }[];
} | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick;
  })) as { atomVerb: string; candidates: { uid: string; cardId: string }[] } | null;
}

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function apOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { ap: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.ap(w.__game.getState().gameState, u);
  }, uid);
}

type AnyState = Record<string, unknown>;

test.describe('reasoning-hook B01017 (2026-06-06)', () => {
  test('B01017: 推理したとき デッキ上2枚から [探偵] D08003 を手札に加え、非[探偵] D08009 は拾わない', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [mkC('B01017', 'hnd#1')];
      // deck top: フィラー(推理 LP1 で証拠化) → D08003(探偵=正) → D08009(少年探偵団=decoy)
      self.deck = ['D08005', 'D08003', 'D08009'];
      self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'reasoning', uid: 'hnd#1' });

    // BUG-132 GAP-1: 「まで」型は取得 pick が surface — 候補列挙で [探偵] filter を直接検証
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('deckRevealUntil');
    const pick = await getPendingEffectPick(page);
    const candIds = pick?.candidates.map((c) => c.cardId) ?? [];
    expect(candIds, '[探偵] D08003 のみ候補').toContain('D08003');
    expect(candIds, '非[探偵] D08009 は候補に出ない').not.toContain('D08009');
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: pick!.candidates.find((c) => c.cardId === 'D08003')!.uid });

    const after = await getGameState(page);
    const self = after.players.self as { hand: string[]; deck: string[]; scene: { uid: string; state: string }[] };
    expect(self.hand, '[探偵] の D08003 が手札に (テキスト通り)').toContain('D08003');
    expect(self.hand, '非[探偵] の D08009 は手札に入らない').not.toContain('D08009');
    expect(self.deck, 'D08003 はデッキから抜けた').not.toContain('D08003');
    expect(self.scene.find((c) => c.uid === 'hnd#1')?.state, '推理でスリープ').toBe('sleep');
    expect(errors).toEqual([]);
  });

  // B03102 横溝重悟: 自分の現場の[警察]Lv≤4 が推理したとき このキャラ AP+1000 turn (triggerCharMatches)
  test('B03102: 自分側[警察]Lv≤4 (D02009) の推理で AP 5000→6000、非[警察] (D08009) では不発', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      // B03102 (黄Lv5) + 自分側 警察Lv3 D02009 + 非警察 D08009
      self.scene = [mkC('B03102', 'ykm#1'), mkC('D02009', 'pol#1'), mkC('D08009', 'boy#1')];
      self.deck = ['D08005', 'D08013', 'D08014'];
      self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // 非[警察] D08009 が推理 → 不発
    await dispatchAction(page, { type: 'reasoning', uid: 'boy#1' });
    expect(await apOf(page, 'ykm#1'), '非[警察]の推理では buff 不発 (5000)').toBe(5000);
    // 自分側[警察]Lv3 D02009 が推理 → AP+1000
    await dispatchAction(page, { type: 'reasoning', uid: 'pol#1' });
    expect(await apOf(page, 'ykm#1'), '自分側[警察]Lv≤4 の推理で AP+1000 (6000)').toBe(6000);
    expect(errors).toEqual([]);
  });
});
