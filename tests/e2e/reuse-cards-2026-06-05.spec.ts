// E2E verification for the 2026-06-05 catalog-reuse cards (sequential hand-impl):
//   PR174 毛利小五郎 (continuous 解決編 self AP+2000), B06071/B06071P 「閃光弾!?」 (forEach all sleep→stun),
//   B02032 「立てや坂田ァ!!」 (解決編 & 絆服部平次 gate → opp 全員 sleep).
// Non-MVP cards are injected via __game.setGameState (same seam as bug-091); read.char.ap is exposed.
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction, getActiveActionId, waitForPhase } from './helpers';

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
function mk(cardId: string, uid: string, state: string): AnyState {
  return { cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} };
}

test.describe('catalog-reuse 2026-06-05 cards', () => {
  test('PR174 a2: 解決編 & 現場[毛利探偵事務所]3枚で 自己 AP+2000', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string) => ({ cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [mkC('PR174', 'p#1'), mkC('D08003', 'k#1'), mkC('D08003', 'k#2')];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    expect(await apOf(page, 'p#1'), '解決編+3枚 → 4000+2000').toBe(6000);
    expect(errors).toEqual([]);
  });

  test('B06071: forEach で 自分と相手の現場のスリープ全員をスタン (active は不変)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, st: string) => ({ cardId, uid, state: st, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState, opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [mkC('D08003', 'self-A', 'sleep'), mkC('D08005', 'self-B', 'active')];
      opp.scene = [mkC('D11004', 'opp-A', 'sleep'), mkC('D11006', 'opp-B', 'sleep'), mkC('D11008', 'opp-C', 'active')];
      self.hand = ['B06071']; self.deck = ['D08013']; self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' }; self.file = [fb, fb, fb, fb, fb, fb, fb];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B06071' });
    const gs = await getGameState(page);
    const states = (s: string) => {
      const find = (arr: { uid: string; state: string }[], u: string) => arr.find((c) => c.uid === u)!.state;
      return find;
    };
    const selfScene = (gs.players.self as { scene: { uid: string; state: string }[] }).scene;
    const oppScene = (gs.players.opp as { scene: { uid: string; state: string }[] }).scene;
    const f = states('');
    expect(f(selfScene, 'self-A')).toBe('stun');
    expect(f(selfScene, 'self-B')).toBe('active'); // active 不変
    expect(f(oppScene, 'opp-A')).toBe('stun');
    expect(f(oppScene, 'opp-B')).toBe('stun');
    expect(f(oppScene, 'opp-C')).toBe('active');
    expect(errors).toEqual([]);
  });

  test('B02032: 解決編 & 絆服部平次 で 相手全員スリープ / gate 不成立は無効', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    async function runCase(status: string, hattori: boolean): Promise<string[]> {
      await buildGameState(page, (gs: AnyState, arg: { status: string; hattori: boolean }) => {
        const mkC = (cardId: string, uid: string, st: string) => ({ cardId, uid, state: st, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
        const self = (gs.players as AnyState).self as AnyState, opp = (gs.players as AnyState).opp as AnyState;
        self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
        self.case = { cardId: 'D08026', status: arg.status, requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
        self.scene = arg.hattori ? [mkC('B01025', 'h#1', 'active')] : [mkC('D08005', 'x#1', 'active')];
        opp.scene = [mkC('D11004', 'opp-A', 'active'), mkC('D11006', 'opp-B', 'active')];
        self.hand = ['B02032']; self.deck = ['D08013']; self.evidence = []; self.remove = [];
        const fb = { type: 'card-back', cardId: 'D08017' }; self.file = [fb, fb, fb, fb, fb];
        gs.pendingEffects = [];
        gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      }, { status, hattori });
      await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B02032' });
      const gs = await getGameState(page);
      return (gs.players.opp as { scene: { state: string }[] }).scene.map((c) => c.state);
    }
    expect(await runCase('解決編', true), '解決編+服部平次 → 全員sleep').toEqual(['sleep', 'sleep']);
    expect(await runCase('事件編', true), '事件編 → 無効 (active のまま)').toEqual(['active', 'active']);
    expect(await runCase('解決編', false), '服部平次なし → 無効').toEqual(['active', 'active']);
    expect(errors).toEqual([]);
  });

  test('B07016 a1: 自分が【緑】イベント使用時のみ effect:declared react が発火 (色matcher)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    async function pendCountAfter(eventCardId: string): Promise<number> {
      await buildGameState(page, (gs: AnyState, ev: string) => {
        const mkC = (cardId: string, uid: string, st: string) => ({ cardId, uid, state: st, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
        const self = (gs.players as AnyState).self as AnyState, opp = (gs.players as AnyState).opp as AnyState;
        self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
        self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['緑', '白'], declaredUseCount: {} };
        self.scene = [mkC('B07016', 'hatt#1', 'active')];
        opp.scene = [mkC('D08006', 'opp-x', 'active')]; // lv<=8 target
        self.hand = [ev]; self.deck = ['D08013']; self.evidence = []; self.remove = [];
        const fb = { type: 'card-back', cardId: 'D08017' }; self.file = [fb, fb, fb, fb, fb, fb, fb];
        gs.pendingEffects = [];
        gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      }, eventCardId);
      await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: eventCardId });
      return page.evaluate(() => {
        const w = window as unknown as { __game: { getState: () => { gameState: { pendingEffects?: { source?: { uid?: string } }[] } } } };
        return (w.__game.getState().gameState.pendingEffects ?? []).filter((p) => p.source?.uid === 'hatt#1').length;
      });
    }
    expect(await pendCountAfter('B02032'), '緑イベント → 服部平次 a1 発火').toBeGreaterThan(0); // B02032 = 緑
    expect(await pendCountAfter('B06071'), '白イベント → 服部平次 a1 発火せず').toBe(0); // B06071 = 白
    expect(errors).toEqual([]);
  });

  test('B03114 a1: 自身をリムーブする effect でも 効果は継続 (rules/15)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string) => ({ cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState, opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'B07101', state: 'active', location: 'partner-area' }; // 黒 partner
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = [mkC('B03114', 'sco#1')]; // スコッチ
      opp.scene = [mkC('D08006', 'opp-t')];
      self.hand = []; self.deck = ['D08013']; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await dispatchAction(page, { type: 'declaredAbility', uid: 'sco#1', abilId: 'a1' });
    const gs = await getGameState(page);
    const selfScene = (gs.players.self as { scene: { uid: string }[] }).scene.map((c) => c.uid);
    const remove = (gs.players.self as { remove: string[] }).remove;
    expect(selfScene, 'スコッチ自身が現場からリムーブ (step1)').not.toContain('sco#1');
    expect(remove, 'スコッチがリムーブエリアへ').toContain('B03114');
    expect(errors, '自身除去後も効果解決でエラーなし').toEqual([]);
  });

  test('D01010 / D02009: 〚ミスリード1〛+【カットイン】が cutin として認識 (pickable)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const self2 = ((gs.players as AnyState).self as AnyState).scene as { uid: string; state: string; isNamed: boolean }[];
      const a = self2.find((s) => s.uid === 'self-2');
      if (a) { a.state = 'active'; a.isNamed = false; }
      for (const s of (((gs.players as AnyState).opp as AnyState).scene as { state: string }[])) s.state = 'sleep';
      const hand = ((gs.players as AnyState).self as AnyState).hand as string[];
      hand.push('D01010', 'D02009');
    });
    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
    if (!(await getActiveActionId(page))) throw new Error('action not declared');
    await waitForPhase(page, 'action-2'); // self の cutin window
    const pickable = await page.evaluate(() => Array.from(document.querySelectorAll('.hand-card--pickable')).map((el) => el.getAttribute('data-card-id')));
    expect(pickable, 'D01010 が cutin として pickable').toContain('D01010');
    expect(pickable, 'D02009 が cutin として pickable').toContain('D02009');
    expect(errors).toEqual([]);
  });

  test('B05089: 【事件編】登場→1ドロー / 【解決編】登場→突撃[キャラ] (caseStatus gate)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    async function enter(status: string): Promise<{ deck: number; hand: number; kw: string[] }> {
      await buildGameState(page, (gs: AnyState, st: string) => {
        const self = (gs.players as AnyState).self as AnyState;
        self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
        self.case = { cardId: 'D08026', status: st, requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
        self.scene = []; self.hand = ['B05089']; self.deck = ['D08013', 'D08019', 'D08021']; self.evidence = []; self.remove = [];
        const fb = { type: 'card-back', cardId: 'D08017' }; self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 >= level 6 (handUseCard 可)
        gs.pendingEffects = []; gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      }, status);
      await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B05089' });
      return page.evaluate(() => {
        const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { deck: unknown[]; hand: unknown[]; scene: { cardId: string; uid: string }[] } } } }; read: { char: { keywords: (s: unknown, u: string) => string[] } } } };
        const g = w.__game.getState().gameState;
        const c = g.players.self.scene.find((x) => x.cardId === 'B05089');
        return { deck: g.players.self.deck.length, hand: g.players.self.hand.length, kw: c ? w.__game.read.char.keywords(g, c.uid) : [] };
      });
    }
    const jiken = await enter('事件編');
    expect(jiken.deck, '事件編: 1ドローでデッキ-1').toBe(2);
    expect(jiken.kw, '事件編: 突撃なし').not.toContain('突撃[キャラ]');
    const kaiketsu = await enter('解決編');
    expect(kaiketsu.kw, '解決編: 突撃[キャラ] 付与').toContain('突撃[キャラ]');
    expect(kaiketsu.deck, '解決編: ドローなし (デッキ不変)').toBe(3);
    expect(errors).toEqual([]);
  });

  test('B04096: イベント使用で2ドロー', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = []; self.hand = ['B04096']; self.deck = ['D08013', 'D08019', 'D08021', 'D08005']; self.evidence = []; self.remove = [];
      const fb = { type: 'card-back', cardId: 'D08017' }; self.file = [fb, fb, fb, fb, fb];
      gs.pendingEffects = []; gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04096' });
    const gs = await getGameState(page);
    expect((gs.players.self as { deck: unknown[] }).deck.length, '4→2 (2ドロー)').toBe(2);
    expect(errors).toEqual([]);
  });

  test('B07071: 〚突撃〛 + 手札2枚以下で自己AP+2000 (custom hand-size)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    async function apAtHand(n: number): Promise<{ ap: number; kw: string[] }> {
      await buildGameState(page, (gs: AnyState, hn: number) => {
        const self = (gs.players as AnyState).self as AnyState;
        self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
        self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
        self.scene = [{ cardId: 'B07071', uid: 'cam#1', state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} }];
        self.hand = Array(hn).fill('D08013'); self.deck = []; self.evidence = []; self.remove = [];
        gs.pendingEffects = []; gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      }, n);
      return page.evaluate(() => {
        const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { ap: (s: unknown, u: string) => number; keywords: (s: unknown, u: string) => string[] } } } };
        const g = w.__game.getState().gameState;
        return { ap: w.__game.read.char.ap(g, 'cam#1'), kw: w.__game.read.char.keywords(g, 'cam#1') };
      });
    }
    const h2 = await apAtHand(2);
    expect(h2.ap, '手札2枚 → 6000+2000').toBe(8000);
    expect(h2.kw, '無条件 突撃').toContain('突撃');
    const h3 = await apAtHand(3);
    expect(h3.ap, '手札3枚 → 修正なし').toBe(6000);
    expect(errors).toEqual([]);
  });
});
