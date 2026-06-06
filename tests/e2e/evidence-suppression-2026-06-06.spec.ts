// E2E: evidence 抑制 (evidenceToDeck + optional $trigger.gained) の実機 text-faithfulness 検証。
//
// B03038 時津潤哉「【自分ターン中】【ターン1】自分の現場のLP1以上のキャラが推理したとき、カードを1枚引いてもよい。
//   そうした場合、この推理によって自分は証拠を得ない。」
//   - 推理 → optional surface。
//   - する → 1ドロー + この推理で得た証拠をデッキへ戻す (証拠を得ない)。
//   - しない → 証拠を通常どおり保持・ドローなし。
//
// seam: __game.setGameState。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

type AnyState = Record<string, unknown>;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function getPendingOptional(page: Page): Promise<{ source: { cardId: string; abilityId: string } } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectOptional: unknown } } };
    return w.__game.getState().pendingEffectOptional as never;
  });
}

function build(gs: AnyState): void {
  const mkC = (cardId: string, uid: string) => ({ cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
  const self = (gs.players as AnyState).self as AnyState;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
  // B03038 (lp:1) 自身が推理する (LP1以上 → 自身の a1 が発火)
  self.scene = [mkC('B03038', 'tok#1')];
  self.deck = ['e1', 'draw1', 'rest']; self.hand = []; self.evidence = []; self.remove = []; self.file = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('evidence 抑制 B03038 (2026-06-06)', () => {
  test('する: 推理→optional→1ドロー + 得た証拠をデッキへ戻す (証拠を得ない)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    await dispatchAction(page, { type: 'reasoning', uid: 'tok#1' });

    const opt = await getPendingOptional(page);
    expect(opt, 'optional surface').not.toBeNull();
    expect(opt!.source, 'source = B03038 / a1').toMatchObject({ cardId: 'B03038', abilityId: 'a1' });

    await dispatchAction(page, { type: 'optionalResolve', run: true });

    const after = await getGameState(page);
    const self = after.players.self as { evidence: unknown[]; hand: string[]; deck: string[] };
    expect(self.evidence.length, 'この推理によって証拠を得ない (evidence 0)').toBe(0);
    expect(self.hand, '1ドローは行う (draw1)').toContain('draw1');
    expect(self.deck[0], '得た証拠 e1 がデッキ上へ復元').toBe('e1');
    expect(errors).toEqual([]);
  });

  test('しない: 証拠は通常どおり保持 (1枚) / ドローなし', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    await dispatchAction(page, { type: 'reasoning', uid: 'tok#1' });
    expect(await getPendingOptional(page), 'optional surface').not.toBeNull();

    await dispatchAction(page, { type: 'optionalResolve', run: false });

    const after = await getGameState(page);
    const self = after.players.self as { evidence: unknown[]; hand: string[] };
    expect(self.evidence.length, 'しない → 証拠1枚保持 (推理の e1)').toBe(1);
    expect(self.hand, 'しない → ドローなし').not.toContain('draw1');
    expect(errors).toEqual([]);
  });
});
