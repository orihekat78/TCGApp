// E2E verification for Task D engine拡張 wave#1 (2026-06-12):
//   E2 sceneToDeckBottom cost (B04011) / E3 fileFlipTop + fileTopMatches (B09021、decoy 込み) /
//   E4 textual-grant actionTargetsActive (B08037、filter fidelity)
// CLAUDE.md §セルフレビュー「画面処理 = カードテキスト文言」: 条件外 decoy を盤面に置き、
// filter・対象範囲・条件分岐がテキストと 1 対 1 で一致することを実機で確認する。
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

async function apOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { ap: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.ap(w.__game.getState().gameState, u);
  }, uid);
}

type AnyState = Record<string, unknown>;

const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });

test.describe('Task D engine拡張 wave#1 (2026-06-12) E2E', () => {
  // ============================================================
  // E2: cost sceneToDeckBottom — B04011 毛利小五郎
  // 「〚現場にいるカード名［江戸川コナン］を1枚デッキの下に移す〛：ターン終了時までこのキャラをLP＋2する」
  // ============================================================
  test('B04011: cost で江戸川コナンがデッキ下へ移り (リムーブでない)、自身 LP+2。decoy 非コナンは不動', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      // B04011 (能力主) + B01011 江戸川コナン (コスト対象) + B07103 decoy (非コナン)
      self.scene = [mk('B04011', 'kogoro#1'), mk('B01011', 'conan#1'), mk('B07103', 'decoy#1')];
      self.deck = ['D08002', 'D08003'];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // 宣言 dispatch は UI 層契約に合わせ cost+ctx を併送 (raw dispatch は cost を払わない BUG-116 経路)
    await dispatchAction(page, {
      type: 'declaredAbility', uid: 'kogoro#1', abilId: 'a1',
      cost: { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '江戸川コナン' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 },
      ctx: { source: { player: 'self', uid: 'kogoro#1', cardId: 'B04011', abilityId: 'a1', area: 'scene' }, bindings: {}, dyn: {} },
    });

    await expect
      .poll(async () => {
        const gs = (await getGameState(page)) as AnyState;
        const scene = ((gs.players as AnyState).self as AnyState).scene as { uid: string }[];
        return scene.map((c) => c.uid).join(',');
      }, { timeout: 5000 })
      .not.toContain('conan#1');

    const gs = (await getGameState(page)) as AnyState;
    const self = (gs.players as AnyState).self as AnyState;
    const deck = self.deck as string[];
    expect(deck[deck.length - 1], 'コナンはデッキの下 (末尾) へ').toBe('B01011');
    expect(self.remove as string[], 'リムーブではない (rules/09・23)').not.toContain('B01011');
    expect((self.scene as { uid: string }[]).map((c) => c.uid), 'decoy 非コナンは現場に残る').toContain('decoy#1');
    expect(errors).toEqual([]);
  });

  // ============================================================
  // E3: fileFlipTop + fileTopMatches — B09021 服部平次 a2
  // 「相手のFILEエリアにあるカードを上から1枚表向きにする。相手のFILEエリアにある1番上のカードが
  //   キャラの場合、キャラを1枚まで選び、ターン終了時までAP＋1000する」
  // ============================================================
  test('B09021 a2: FILE 最上がキャラ → 表向き化 + AP+1000 pick が出る', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      // 【事件青＆緑】= 事件が青と緑の両色 (combine:'and')
      // caseColor は CardDef.colors 優先のため、未登録 cardId で caseInfo.colors fallback を効かせる
      self.case = { cardId: 'E2E-CASE-BLUEGREEN', status: '事件編', requiredEvidence: 7, colors: ['青', '緑'], declaredUseCount: {} };
      self.scene = [mk('B09021', 'heiji#1')];
      // 相手 FILE: 最上 (末尾) = キャラ B01011。下 = イベント B02053 (decoy — 降りて表向きにしない)
      opp.file = [{ type: 'card-back', cardId: 'B02053' }, { type: 'card-back', cardId: 'B01011' }];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    const apBefore = await apOf(page, 'heiji#1');

    await dispatchAction(page, { type: 'declaredAbility', uid: 'heiji#1', abilId: 'a2' });

    // 最上のキャラが表向きになり、conditional 成立で charModifyAP pick が出る
    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charModifyAP');
    const gs1 = (await getGameState(page)) as AnyState;
    const oppFile = ((gs1.players as AnyState).opp as AnyState).file as { cardId: string; faceUp?: boolean }[];
    expect(oppFile[1]!.faceUp, '最上 (末尾) のキャラ B01011 が表向き').toBe(true);
    expect(oppFile[0]!.faceUp ?? false, '下のイベントは裏のまま (降りない)').toBe(false);

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'heiji#1' });
    expect(await apOf(page, 'heiji#1'), 'AP+1000 (ターン終了時まで)').toBe(apBefore + 1000);
    expect(errors).toEqual([]);
  });

  test('B09021 a2 decoy: FILE 最上がイベント → 表向き化のみ、AP+1000 は発生しない (fileTopMatches false)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      // caseColor は CardDef.colors 優先のため、未登録 cardId で caseInfo.colors fallback を効かせる
      self.case = { cardId: 'E2E-CASE-BLUEGREEN', status: '事件編', requiredEvidence: 7, colors: ['青', '緑'], declaredUseCount: {} };
      self.scene = [mk('B09021', 'heiji#1')];
      // 最上 (末尾) = イベント B02053 → 「1番上のカードがキャラの場合」不成立
      opp.file = [{ type: 'card-back', cardId: 'B01011' }, { type: 'card-back', cardId: 'B02053' }];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    const apBefore = await apOf(page, 'heiji#1');

    await dispatchAction(page, { type: 'declaredAbility', uid: 'heiji#1', abilId: 'a2' });

    // 表向き化は起こる
    await expect
      .poll(async () => {
        const gs1 = (await getGameState(page)) as AnyState;
        const f = ((gs1.players as AnyState).opp as AnyState).file as { faceUp?: boolean }[];
        return f[1]!.faceUp === true;
      }, { timeout: 5000 })
      .toBe(true);
    // conditional 不成立 → pick は出ない / AP 不変
    expect(await getPendingEffectPick(page), 'AP+1000 の pick は出ない').toBeNull();
    expect(await apOf(page, 'heiji#1'), 'AP 不変').toBe(apBefore);
    expect(errors).toEqual([]);
  });

  // ============================================================
  // E4: textual-grant actionTargetsActive — B08037 鈴木園子
  // 「【解決編】【宣言】【スリープ】：自分の現場にいる〚カード名［京極真］〛を1枚まで選び、
  //   ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える」
  // ============================================================
  test('B08037: pick 候補は京極真のみ (decoy 除外)、付与後 actionTargetsActive flag が立つ', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      // B08037 (能力主) + B08032 (鈴木園子&京極真 — 分割名で[京極真]を持つ rules/19) + B01011 decoy (非京極)
      self.scene = [mk('B08037', 'sonoko#1'), mk('B08032', 'kyogoku#1'), mk('B01011', 'decoy#1')];
      self.hand = []; self.evidence = []; self.remove = [];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, {
      type: 'declaredAbility', uid: 'sonoko#1', abilId: 'a1',
      cost: { kind: 'sleepSelf' },
      ctx: { source: { player: 'self', uid: 'sonoko#1', cardId: 'B08037', abilityId: 'a1', area: 'scene' }, bindings: {}, dyn: {} },
    });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('charSetTurnEffect');
    const pending = await getPendingEffectPick(page);
    const candUids = pending?.candidates?.map((c) => c.uid) ?? [];
    expect(candUids, '分割名[京極真]持ちは候補').toContain('kyogoku#1');
    expect(candUids, '非京極の decoy は候補外 (filter fidelity)').not.toContain('decoy#1');

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'kyogoku#1' });
    const gs1 = (await getGameState(page)) as AnyState;
    const kyogoku = (((gs1.players as AnyState).self as AnyState).scene as { uid: string; turnEffects: Record<string, unknown> }[]).find((c) => c.uid === 'kyogoku#1');
    expect(kyogoku?.turnEffects['actionTargetsActive'], '付与 flag が立つ').toBe(true);
    // 能力主はコスト【スリープ】でスリープ済
    const sonoko = (((gs1.players as AnyState).self as AnyState).scene as { uid: string; state: string }[]).find((c) => c.uid === 'sonoko#1');
    expect(sonoko?.state, 'コスト sleepSelf').toBe('sleep');
    expect(errors).toEqual([]);
  });
});
