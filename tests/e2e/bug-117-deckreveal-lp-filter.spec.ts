// E2E: BUG-117 — deckRevealUntil の ap/lp filter が黙って無視されるバグの実機検証。
//
// 症状: atom-handlers.ts targetFilterToPredicate (deckRevealUntil 専用 helper) は
//   cardId / color / trait / levelMin/Max / kind しか実装しておらず、
//   TargetFilter 型に在る apMin/apMax/lpMin/lpMax を **黙って drop** していた。
//   → 「LP0の【青】のキャラ」(B01013) や「LP2以上の【白】のキャラ」(B01053) が
//     LP 条件を無視して「最初の色一致キャラ」を拾う = カードテキスト通りに動かない。
//
// 本 spec は実機 (UI/engine) で「テキスト通りの LP 条件で正しいカードを拾う」ことを assert する。
//   修正前: fail (decoy を拾う) / 修正後: pass (正しい LP のカードを拾う)。
//
// seam: __game.setGameState (bug-091 / engine-extensions と同パターン)。
import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

// BUG-132 GAP-1 (2026-06-12): 「1枚まで」型は取得前に deckRevealUntil pick が surface する。
// 候補列挙に LP filter が反映されるため、本 spec は「decoy が候補に出ない」ことも直接 assert できる。
async function getPendingEffectPick(page: import('@playwright/test').Page): Promise<{
  atomVerb: string;
  candidates: { uid: string; cardId: string }[];
} | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick;
  })) as { atomVerb: string; candidates: { uid: string; cardId: string }[] } | null;
}

async function prime(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

type AnyState = Record<string, unknown>;

test.describe('BUG-117 deckRevealUntil ap/lp filter (2026-06-05)', () => {
  // ----------------------------------------------------------------
  // B01013 妃英理: 【登場時】上から2枚見る → LP0の【青】のキャラを1枚手札
  //   deck top2 = [D08013(青 LP1 = decoy), D08009(青 LP0 = 正解)]
  //   修正前: lpMax:0 無視で先頭の D08013 を拾う (WRONG)
  //   修正後: D08013 は lp1>0 で除外、D08009(lp0) を拾う (CORRECT)
  // ----------------------------------------------------------------
  test('B01013: LP0【青】filter で D08009(LP0) を拾い、D08013(LP1) は拾わない', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [];
      // top2: D08013(青 LP1 decoy) → D08009(青 LP0 target)
      self.deck = ['D08013', 'D08009'];
      self.hand = ['B01013'];
      self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 — B01013 (level 4) 使用可
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B01013' });

    // BUG-132 GAP-1: 取得 pick が surface — 候補列挙の時点で LP filter を直接検証できる
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('deckRevealUntil');
    const pick = await getPendingEffectPick(page);
    const candIds = pick?.candidates.map((c) => c.cardId) ?? [];
    expect(candIds, '候補は LP0【青】の D08009 のみ').toContain('D08009');
    expect(candIds, 'LP1【青】の D08013 は候補に出ない (LP条件で除外)').not.toContain('D08013');
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: pick!.candidates.find((c) => c.cardId === 'D08009')!.uid });

    const after = await getGameState(page);
    const hand = (after.players.self as { hand: string[] }).hand;
    expect(hand, '手札に LP0【青】の D08009 (テキスト通り)').toContain('D08009');
    expect(hand, '手札に LP1【青】の D08013 は入らない (LP条件で除外)').not.toContain('D08013');
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------
  // B01053 工藤有希子: 【登場時】上から2枚見る → LP2以上の【白】のキャラを1枚手札
  //   deck top2 = [D03009(白 LP1 = decoy), D03002(白 LP2 = 正解)]
  //   修正前: lpMin:2 無視で先頭の D03009 を拾う (WRONG)
  //   修正後: D03009 は lp1<2 で除外、D03002(lp2) を拾う (CORRECT)
  // ----------------------------------------------------------------
  test('B01053: LP2以上【白】filter で D03002(LP2) を拾い、D03009(LP1) は拾わない', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [];
      // top2: D03009(白 LP1 decoy) → D03002(白 LP2 target)
      self.deck = ['D03009', 'D03002'];
      self.hand = ['B01053'];
      self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 — B01053 (level 4) 使用可
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B01053' });

    // BUG-132 GAP-1: 取得 pick が surface — 候補列挙の時点で LP filter を直接検証できる
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('deckRevealUntil');
    const pick = await getPendingEffectPick(page);
    const candIds = pick?.candidates.map((c) => c.cardId) ?? [];
    expect(candIds, '候補は LP2以上【白】の D03002 のみ').toContain('D03002');
    expect(candIds, 'LP1【白】の D03009 は候補に出ない (LP条件で除外)').not.toContain('D03009');
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: pick!.candidates.find((c) => c.cardId === 'D03002')!.uid });

    const after = await getGameState(page);
    const hand = (after.players.self as { hand: string[] }).hand;
    expect(hand, '手札に LP2【白】の D03002 (テキスト通り)').toContain('D03002');
    expect(hand, '手札に LP1【白】の D03009 は入らない (LP条件で除外)').not.toContain('D03009');
    expect(errors).toEqual([]);
  });
});
