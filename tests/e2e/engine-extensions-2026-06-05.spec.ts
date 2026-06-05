// E2E verification for the 2026-06-05 engine-extension #1/#2 batches:
//   #1 leave:to-remove hook (314281d) + cards (da49cca)
//   #2 charModifyLevel verb (4992110) + cards (52feff8)
//
// Non-MVP cards are injected via __game.setGameState (same seam as bug-091); read.char.{ap,level} exposed.
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

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

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function levelOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { level: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.level(w.__game.getState().gameState, u);
  }, uid);
}

async function apOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { ap: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.ap(w.__game.getState().gameState, u);
  }, uid);
}

type AnyState = Record<string, unknown>;

test.describe('engine-extension #1/#2 (2026-06-05) E2E', () => {
  // ============================================================
  // Engine 拡張 #2: charModifyLevel verb
  // ============================================================
  test('B07103 a2: 【解決編】【宣言】相手キャラを 1pick で turn-level-1 (effective level 4→3)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = [mkC('B07103', 'bbn#1')];
      opp.scene = [mkC('B07103', 'opp#1', 'sleep')];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    expect(await levelOf(page, 'opp#1'), 'pre: printed level 4').toBe(4);

    await dispatchAction(page, { type: 'declaredAbility', uid: 'bbn#1', abilId: 'a2' });

    // PA 短縮形 max:1 で human pick が pending — 候補から opp#1 を選んで resolve
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charModifyLevel');
    const pending = await getPendingEffectPick(page);
    expect(pending?.candidates?.some((c) => c.uid === 'opp#1'), 'opp#1 が候補').toBe(true);
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'opp#1' });

    expect(await levelOf(page, 'opp#1'), 'post: effective level 3').toBe(3);
    expect(errors).toEqual([]);
  });

  test('B07103 a2: 【事件編】では declared a2 が gate される (回帰)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = [mkC('B07103', 'bbn#2')];
      opp.scene = [mkC('B07103', 'opp#2', 'sleep')];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    expect(await levelOf(page, 'opp#2')).toBe(4);
    await dispatchAction(page, { type: 'declaredAbility', uid: 'bbn#2', abilId: 'a2' });
    expect(await levelOf(page, 'opp#2'), 'gate不成立 → level不変').toBe(4);
    expect(errors).toEqual([]);
  });

  // ============================================================
  // Engine 拡張 #1: leave:to-remove hook + cards
  // ============================================================
  test('D03013 鈴木次郎吉: 相手ターン中に効果リムーブ → 自身の leave:draw1 が発火', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [mkC('D03013', 'jr#1', 'sleep')];
      opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
      // opp の B01063 で 自分以外 sleep cost + 1pick level≤7 sceneRemove (両方の現場が候補)
      opp.scene = [mkC('B01063', 'jdy#1'), mkC('D08006', 'jdy-aux')];
      self.hand = []; self.deck = ['D08013', 'D08019', 'D08021']; self.evidence = []; self.remove = [];
      opp.hand = []; opp.deck = ['D08013']; opp.evidence = []; opp.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    const selfDeckBefore = ((await getGameState(page)).players.self as { deck: unknown[] }).deck.length;

    await dispatchAction(page, { type: 'declaredAbility', uid: 'jdy#1', abilId: 'a1' });

    const gs = await getGameState(page);
    const selfScene = (gs.players.self as { scene: { uid: string }[] }).scene;
    const removeArea = (gs.players.self as { remove: string[] }).remove;
    const selfDeckAfter = (gs.players.self as { deck: unknown[] }).deck.length;
    const pe = (gs.pendingEffects as unknown[]) ?? [];

    const d03013Removed = !selfScene.some((c) => c.uid === 'jr#1') && removeArea.includes('D03013');
    const hasLeaveDraw = pe.some((e) => {
      const ev = e as { triggeredBy?: { hook?: string }; source?: { cardId?: string } };
      return ev.triggeredBy?.hook === 'leave:to-remove' && ev.source?.cardId === 'D03013';
    });
    const drewAlready = selfDeckAfter < selfDeckBefore;
    expect(d03013Removed, 'D03013 が removeエリア').toBe(true);
    expect(hasLeaveDraw || drewAlready, 'leave:to-remove 経路で draw が queue/resolve').toBe(true);
    expect(errors).toEqual([]);
  });

  // ============================================================
  // Engine 拡張 #3: multi-target Pattern A pick
  // ============================================================
  test('B02021 沖田総司 a1: 相手3キャラ全員に per-char AP-1000 が適用される (multi-target Pattern A)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active', ap: number | null = null) => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: ap, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
      self.scene = [mkC('B02021', 'okt#1')];
      // 相手の現場に 3 キャラ — printed AP は default 値 (D11015=5000)
      opp.scene = [
        mkC('D11015', 'opp-1', 'sleep'),
        mkC('D11015', 'opp-2', 'active'),
        mkC('D11015', 'opp-3', 'sleep'),
      ];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // pre: 相手 3 キャラの AP
    const pre1 = await apOf(page, 'opp-1');
    const pre2 = await apOf(page, 'opp-2');
    const pre3 = await apOf(page, 'opp-3');

    // 宣言 a1
    await dispatchAction(page, { type: 'declaredAbility', uid: 'okt#1', abilId: 'a1' });

    // PA 短縮形 max:5 で pending pick (charModifyAP)
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charModifyAP');
    const pending = await getPendingEffectPick(page);
    expect(pending?.candidates.length, '候補は 3 体').toBe(3);

    // 全 3 体を multi-pick で resolve (engine-extension #3 で per-char 適用される)
    await dispatchAction(page, {
      type: 'effectPickResolve',
      pickedUid: 'opp-1',
      pickedUids: ['opp-1', 'opp-2', 'opp-3'],
    });

    // 全 3 体に AP-1000 が適用されている
    expect(await apOf(page, 'opp-1'), 'opp-1: -1000').toBe(pre1 - 1000);
    expect(await apOf(page, 'opp-2'), 'opp-2: -1000').toBe(pre2 - 1000);
    expect(await apOf(page, 'opp-3'), 'opp-3: -1000').toBe(pre3 - 1000);
    expect(errors).toEqual([]);
  });
});
