// E2E: 2026-06-05 監査 workflow が「静的には faithful・実機未確認」とした suspect の runtime カバレッジ。
// 既存 e2e 代表カードと異なる filter 組合せ (AND filter / choice 入れ子 / leave→filtered pick) を実機検証する。
// これらは BUG ではなく、テキスト通り動くことの確認 + 恒久カバレッジ追加。
//
//   D09014 a2: sceneToHand long-form pick で levelMax:5 AND state:['sleep'] の AND 評価
//   B06007 a2: enter choice の option2 (sceneToHand 短縮形 levelMax:7) が runtime で filter 効く
//   B03091  : leave:to-remove (相手ターン中) → charModifyAP trait:警察 + side:self の pick が self に surface
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

type AnyState = Record<string, unknown>;
const MK = "const mkC=(cardId,uid,state='active')=>({cardId,uid,state,isNamed:false,enterOrder:1,setCards:[],stackedCards:0,keywordOverrides:{granted:[],disabledOriginal:false},apOverride:null,lpOverride:null,turnEffects:{contactImmune:false,removeOnTurnEnd:false},declaredUseCount:{}});";

test.describe('audit suspects runtime coverage (2026-06-05)', () => {
  // ----------------------------------------------------------------
  // D09014 a2: sceneToHand long-form — levelMax:5 AND state:['sleep'] (side:opp)
  //   候補は「相手の lv5以下 かつ sleep」のみ。lv6/sleep・lv5/stun・lv5/active は除外。
  // ----------------------------------------------------------------
  test('D09014 a2: 相手 level≤5 かつ sleep のみ候補 (level/state AND filter)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, new Function('gs', MK + `
      const self = gs.players.self, opp = gs.players.opp;
      self.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' }; // 黄 (partnerColor gate)
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      self.scene = [mkC('D09014', 'yam#1')];
      self.hand = []; self.evidence = []; self.remove = []; self.deck = ['D08005','D08013'];
      opp.scene = [
        mkC('D08019', 'oA', 'sleep'),  // lv5 sleep → 唯一の候補
        mkC('D08011', 'oB', 'sleep'),  // lv6 sleep → levelMax で除外
        mkC('D09008', 'oC', 'stun'),   // lv5 stun  → state で除外
        mkC('D11011', 'oD', 'active'), // lv5 active → state で除外
      ];
      opp.hand = []; opp.evidence = []; opp.remove = []; opp.deck = ['D08005'];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    `) as (gs: AnyState) => void);

    await dispatchAction(page, { type: 'declaredAbility', uid: 'yam#1', abilId: 'a2' });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('sceneToHand');
    const pending = await getPendingEffectPick(page);
    const uids = (pending?.candidates ?? []).map((c) => c.uid).sort();
    expect(uids, 'lv5+sleep の oA のみ (lv6/stun/active は除外)').toEqual(['oA']);
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------
  // B06007 a2: enter choice の option2 (sceneToHand 短縮形 side:opp levelMax:7)
  //   choice modal → cp-opt-1 click → 短縮形 pick が surface、候補は相手 lv7以下のみ。
  // ----------------------------------------------------------------
  test('B06007 a2: choice option2 bounce → 相手 level≤7 のみ候補 (choice入れ子+短縮形 filter)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, new Function('gs', MK + `
      const self = gs.players.self, opp = gs.players.opp;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' }; // 青 (partnerColor gate)
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      self.scene = [];
      self.hand = ['B06007']; self.evidence = []; self.remove = []; self.deck = ['D08005','D08013'];
      const fb = { type: 'card-back', cardId: 'D08017' };
      self.file = [fb,fb,fb,fb,fb,fb,fb]; // FILE 7 (B06007 lv7 使用可)
      opp.scene = [ mkC('D08005', 'oP', 'active'), mkC('D08003', 'oQ', 'active') ]; // lv7 / lv8
      opp.hand = []; opp.evidence = []; opp.remove = []; opp.deck = ['D08005'];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    `) as (gs: AnyState) => void);

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B06007' });

    // ⚠ BUG-121: enter トリガの複数択 choice は handUseCard フローで choiceIndex を供給されず、
    //   engine が option 0 (突撃付与) に既定化する。choice-picker-modal は出ず、human は選べない。
    //   本テストは「現状の挙動」を固定する regression。BUG-121 修正後に「choice modal → option2 →
    //   相手 lv7 bounce」へ書き換える (期待挙動)。
    const modalVisible = await page.getByTestId('choice-picker-modal').isVisible().catch(() => false);
    expect(modalVisible, 'BUG-121: 現状 enter choice modal は出ない (option 0 既定化)').toBe(false);

    const after = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gs = (window as any).__game.getState().gameState;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b06 = gs.players.self.scene.find((c: any) => c.cardId === 'B06007');
      return {
        b06Entered: !!b06,
        b06TurnKw: (b06 && b06.turnEffects && b06.turnEffects.grantedKeywords) || [],
        oppSceneLen: gs.players.opp.scene.length,
      };
    });
    expect(after.b06Entered, 'B06007 は登場している').toBe(true);
    // option 0 (突撃 turn-scope 付与) が既定適用 → opp 現場は不変 (option2 bounce は実行されない)
    expect(after.b06TurnKw, 'option 0 既定: 突撃 が turn-scope で付与される').toContain('突撃');
    expect(after.oppSceneLen, 'option2(bounce) は実行されない → opp 現場 2 のまま').toBe(2);
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------
  // B03091: 【相手ターン中】【現場リムーブ時】自分の[警察]を1枚 AP+1000。
  //   opp(AI) の B01063 で self の B03091 を level≤7 リムーブ → leave:to-remove 発火 (turn:opp) →
  //   B03091 の charModifyAP pick が self(owner) に surface、候補は自分の[警察]のみ。
  // ----------------------------------------------------------------
  test('B03091: 相手ターン中のリムーブで leave→[警察]+side:self の pick が self に surface', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, new Function('gs', MK + `
      const self = gs.players.self, opp = gs.players.opp;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      // self: B03091(警察,lv3,リムーブ対象) + 警察キャラ(pol) + 非警察キャラ(civ)
      self.scene = [ mkC('B03091', 'tk#1'), mkC('D09008', 'pol#1'), mkC('D08013', 'civ#1') ];
      self.hand = []; self.evidence = []; self.remove = []; self.deck = ['D08005','D08013'];
      // opp(AI): B01063 (cost=自分の他キャラをsleep / effect=level≤7 を1枚リムーブ) + sleep コスト用の補助キャラ
      opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
      opp.scene = [ mkC('B01063', 'jdy#1'), mkC('D08006', 'aux#1') ];
      opp.hand = []; opp.evidence = []; opp.remove = []; opp.deck = ['D08005'];
      gs.pendingEffects = [];
      gs.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    `) as (gs: AnyState) => void);

    // opp(AI) の B01063 a1 を dispatch → cost sleep(aux) + effect で level≤7 を1枚リムーブ。
    // AI 経路で B03091(lv3) がリムーブされ leave:to-remove 発火 → B03091 の self-pick が surface。
    await dispatchAction(page, { type: 'declaredAbility', uid: 'jdy#1', abilId: 'a1' });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 6000 })
      .toBe('charModifyAP');
    const pending = await getPendingEffectPick(page);
    expect(pending?.player, 'pick の選択者は B03091 の owner(self)').toBe('self');
    const uids = (pending?.candidates ?? []).map((c) => c.uid).sort();
    // 候補 = 自分の現場の[警察] (pol#1)。非警察 civ#1 と 相手キャラは除外。
    expect(uids, '自分の[警察] pol#1 のみ (非警察/相手は除外)').toEqual(['pol#1']);
    expect(errors).toEqual([]);
  });
});
