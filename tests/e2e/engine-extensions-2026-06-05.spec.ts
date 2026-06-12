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

  // ============================================================
  // Engine 拡張 #4: sceneToHand (char→hand bounce)
  // ============================================================
  test('B06069 a2: 【解決編】declared sleepSelf cost → 相手 levelMax:7 を 1枚 bounce', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [mkC('B06069', 'sno#1')];
      // opp の現場に level 4 D08013 (bounce 対象)
      opp.scene = [mkC('D08013', 'opp-bnc')];
      const oppHandBefore: string[] = [];
      opp.hand = oppHandBefore;
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const before = await getGameState(page);
    expect((before.players.opp as { hand: string[] }).hand, 'opp 手札 0 (前)').toHaveLength(0);
    expect((before.players.opp as { scene: { uid: string }[] }).scene.length, 'opp scene 1 (前)').toBe(1);

    await dispatchAction(page, { type: 'declaredAbility', uid: 'sno#1', abilId: 'a2' });

    // sceneToHand PA短縮形で pending pick (max:1, side:opp, levelMax:7)
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('sceneToHand');
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'opp-bnc' });

    const after = await getGameState(page);
    expect((after.players.opp as { hand: string[] }).hand, 'opp 手札に D08013').toContain('D08013');
    expect((after.players.opp as { scene: { uid: string }[] }).scene.length, 'opp scene 空').toBe(0);
    // Phase 2c (BUG-116 構造解消): sleepSelf cost は dispatcher (activateDeclaredAbility) が
    // def から自動で支払う — raw dispatch でも cost が silent skip されないことの実証
    const snoAfter = (after.players.self as { scene: { uid: string; state: string }[] }).scene
      .find((c) => c.uid === 'sno#1');
    expect(snoAfter?.state, 'sno#1 が sleepSelf cost で sleep').toBe('sleep');
    expect(errors).toEqual([]);
  });

  // ============================================================
  // Engine 拡張 #5a: deckRevealUntil maxN + handAddFromDeck
  // ============================================================
  test('D01013 灰原哀: handUseCard 経由 enter → 上から4枚見て【青】を手札+discard1 / 残りデッキ下', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [];
      // デッキ上 5 枚 — D08013 (青) が 2 番目に来る配置で、上から 4 枚見ると青 1 枚 (D08013) が拾える
      self.deck = ['D11015', 'D08013', 'D11003', 'D11004', 'D08005'];
      // 手札に D01013 (使用するキャラ) + ダミー D11005 (a1 chain で discard 用)
      self.hand = ['D01013', 'D11005'];
      self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 — D01013 (level 4) 使用可
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // D01013 を hand-use で登場 → enter a1 が走る
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D01013' });

    // BUG-132 GAP-1 (2026-06-12): 「1枚まで」型は先に deckRevealUntil の取得/decline pick が
    // surface する (rules/15 「〜まで」=0枚可)。候補 D08013 を選んで取得する。
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('deckRevealUntil');
    const revealPick = await getPendingEffectPick(page);
    const d08013Cand = revealPick?.candidates.find((c) => c.cardId === 'D08013');
    expect(d08013Cand, 'D08013 (青) が取得候補').toBeTruthy();
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: d08013Cand!.uid });

    // a1 step 2: handAddFromDeck で D08013 が手札に入る (deckRevealUntil maxN=4 で $matched=D08013)
    // a1 step 3: discard 1 — UI pick 待ち (humanChooser:self)
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('discard');
    const beforePick = await getGameState(page);
    const handBefore = (beforePick.players.self as { hand: string[] }).hand;
    expect(handBefore, '手札に D08013 が加わっている').toContain('D08013');
    // discard pick で D11005 を選択 (D08013 は残し、ダミーを捨てる)
    const pickPending = await getPendingEffectPick(page);
    const d11005Cand = pickPending?.candidates.find((c) => c.cardId === 'D11005');
    expect(d11005Cand, 'D11005 が discard 候補').toBeTruthy();
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: d11005Cand!.uid });

    const after = await getGameState(page);
    const deck = (after.players.self as { deck: string[] }).deck;
    const hand = (after.players.self as { hand: string[] }).hand;
    const remove = (after.players.self as { remove: string[] }).remove;

    // 手札: D08013 (拾った青) — D01013 は scene へ、D11005 は discard 済
    expect(hand, '手札に D08013').toContain('D08013');
    expect(hand, '手札に D11005 は残っていない (discard 済)').not.toContain('D11005');
    expect(remove, 'D11005 がリムーブエリア').toContain('D11005');

    // デッキ: 残りの 3 枚 [D11015, D11003, D11004] がデッキ下 + 元 5 枚目の D08005 が top
    // → [D08005, D11015, D11003, D11004] (順序: 元 5 枚目 + 残り 3 枚を下に)
    expect(deck.length, 'デッキ枚数 = 元 5 - 1(D08013手札) = 4').toBe(4);
    expect(deck[0], 'top = 元 5 枚目 D08005').toBe('D08005');
    // bottom 3 枚に残り (順不同で D11015/D11003/D11004 を含む)
    const bottom3 = deck.slice(-3).sort();
    expect(bottom3).toEqual(['D11003', 'D11004', 'D11015']);

    expect(errors).toEqual([]);
  });

  // ============================================================
  // Engine 拡張 #5b: charSetCard fromDeckTop
  // ============================================================
  test('B08054 広田正巳 a2: declared → 自分のデッキ上端を裏向きで $self にセット', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
      self.scene = [mkC('B08054', 'hir#1')];
      // デッキ上端を識別可能な特定 cardId に
      self.deck = ['D08013', 'D08019', 'D08021'];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const deckBefore = ((await getGameState(page)).players.self as { deck: string[] }).deck.slice();
    expect(deckBefore[0]).toBe('D08013');

    await dispatchAction(page, { type: 'declaredAbility', uid: 'hir#1', abilId: 'a2' });

    const after = await getGameState(page);
    const selfScene = (after.players.self as { scene: { uid: string; setCards: { cardId: string; faceUp: boolean }[] }[] }).scene;
    const deck = (after.players.self as { deck: string[] }).deck;

    // デッキ上端が消費される
    expect(deck.length, 'デッキ -1').toBe(deckBefore.length - 1);
    expect(deck[0], 'top は元 2 枚目').toBe('D08019');
    // B08054 に裏向きで D08013 がセットされている
    const hir = selfScene.find((c) => c.uid === 'hir#1');
    expect(hir?.setCards.length, 'setCards に 1 枚').toBe(1);
    expect(hir?.setCards[0], 'D08013 を裏向きで set').toEqual({ cardId: 'D08013', faceUp: false });
    expect(errors).toEqual([]);
  });

  // ============================================================
  // Engine 拡張 #5b 残課題: charSetCard PA短縮形 (uid pick + fromDeckTop)
  // ============================================================
  test('B02023 遠山和葉 a1: enter → 自陣キャラを1枚pick → デッキ上端を裏向きでセット', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
      // 自陣に既存キャラ (set 対象) + 登場する B02023 (enter triggers a1)
      self.scene = [mkC('D08006', 'tgt#1')];
      self.deck = ['D08013', 'D08019'];
      self.hand = ['B02023']; self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 (B02023 level 6 OK)
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // B02023 を hand-use で登場
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B02023' });

    // PA短縮形 charSetCard → pending pick (自陣キャラから 0-1 枚 + fromDeckTop)
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charSetCard');
    const pending = await getPendingEffectPick(page);
    // 候補 = 自陣 (tgt#1) + 登場した B02023 自身 → 2 件 (excludeSelf 未指定なので自身も含む)
    expect(pending?.candidates.some((c) => c.uid === 'tgt#1'), 'tgt#1 候補に含まれる').toBe(true);

    // tgt#1 にセット
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'tgt#1' });

    const after = await getGameState(page);
    const tgt = (after.players.self as { scene: { uid: string; setCards: { cardId: string; faceUp: boolean }[] }[] }).scene.find((c) => c.uid === 'tgt#1');
    const deck = (after.players.self as { deck: string[] }).deck;

    expect(tgt?.setCards.length, 'tgt#1 に 1 枚セット').toBe(1);
    expect(tgt?.setCards[0], 'D08013 を裏向きで set').toEqual({ cardId: 'D08013', faceUp: false });
    expect(deck, 'デッキから D08013 splice').toEqual(['D08019']);
    expect(errors).toEqual([]);
  });

  // ============================================================
  // engine 拡張 #5a batch #2: D01013 同型 5 枚 (色違い)
  // for ループで 5 case 生成 — filter の色違いで全て同じ semantics
  // ============================================================
  // 各色の match 用カード — ct-d{01..07} は折り目通り 1=青 / 2=緑 / 3=白 / 4=赤 / 5=黄 / 7=黒
  const siblings = [
    { cardId: 'D02011', color: '緑', matchCardId: 'D02002', caseColor: '緑' }, // D02002=緑
    { cardId: 'D03009', color: '白', matchCardId: 'D03002', caseColor: '白' }, // D03002=白
    { cardId: 'D04011', color: '赤', matchCardId: 'D04002', caseColor: '赤' }, // D04002=赤
    { cardId: 'D05012', color: '黄', matchCardId: 'D11015', caseColor: '黄' }, // D11015=黄
    { cardId: 'D07019', color: '黒', matchCardId: 'B07101', caseColor: '黒' }, // B07101=黒
  ];
  for (const { cardId, color, matchCardId, caseColor } of siblings) {
    test(`D01013 同型 (${color}): ${cardId} は上から4枚見て【${color}】1枚を手札+discard1`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await prime(page);
      await buildGameState(page, (gs: AnyState, args: { cardId: string; matchCardId: string; caseColor: string }) => {
        const self = (gs.players as AnyState).self as AnyState;
        self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
        self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: [args.caseColor], declaredUseCount: {} };
        self.scene = [];
        // デッキ上 4 枚に match を 1 枚混ぜる
        self.deck = ['D08019', args.matchCardId, 'D08021', 'D08019', 'D08005'];
        self.hand = [args.cardId, 'D11005']; // discard 用ダミー
        self.evidence = []; self.remove = [];
        const fb = { type: 'card-back', cardId: 'D08017' };
        self.file = [fb, fb, fb, fb, fb, fb, fb];
        gs.pendingEffects = [];
        gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      }, { cardId, matchCardId, caseColor });

      await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId });

      // BUG-132 GAP-1: 先に deckRevealUntil の取得/decline pick を解決 (match を取得)
      await expect
        .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
        .toBe('deckRevealUntil');
      const revealPick = await getPendingEffectPick(page);
      const matchCand = revealPick?.candidates.find((c) => c.cardId === matchCardId);
      expect(matchCand, `${matchCardId} (${color}) が取得候補`).toBeTruthy();
      await dispatchAction(page, { type: 'effectPickResolve', pickedUid: matchCand!.uid });

      await expect
        .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
        .toBe('discard');
      const pending = await getPendingEffectPick(page);
      const d11005 = pending?.candidates.find((c) => c.cardId === 'D11005');
      expect(d11005, 'D11005 が discard 候補').toBeTruthy();
      await dispatchAction(page, { type: 'effectPickResolve', pickedUid: d11005!.uid });

      const after = await getGameState(page);
      const hand = (after.players.self as { hand: string[] }).hand;
      expect(hand, `手札に ${color} の ${matchCardId}`).toContain(matchCardId);
      expect(hand, '手札に D11005 は残っていない (discard 済)').not.toContain('D11005');
      expect(errors).toEqual([]);
    });
  }
});
