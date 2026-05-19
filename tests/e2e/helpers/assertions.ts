// E2E test assertion helpers — engine state + DOM の両層を確認

import { expect, type Page } from '@playwright/test';
import { getGameState, getActionContext } from './state';
import type { GameStateLike, Side } from './types';

/**
 * 指定 side の evidence カウントを engine state で assert。
 */
export async function expectEvidenceCount(
  page: Page,
  side: Side,
  expected: number,
): Promise<void> {
  const gs = await getGameState(page);
  expect(gs.players[side].evidence.length).toBe(expected);
}

/**
 * 指定 uid の scene character の state を engine + DOM 両層で assert。
 * state==='sleep' のとき DOM `.sleep` class も確認 (UI reactivity 検証)。
 */
export async function expectActorState(
  page: Page,
  uid: string,
  side: Side,
  expected: 'active' | 'sleep' | 'stun',
): Promise<void> {
  const gs = await getGameState(page);
  const actor = gs.players[side].scene.find((s) => s.uid === uid);
  expect(actor?.state).toBe(expected);

  // DOM layer は scene にいるキャラのみ。sleep/stun の場合 class 確認
  if (expected === 'sleep' || expected === 'stun') {
    const elem = page.locator(`.card[data-uid="${uid}"]`);
    await expect(elem).toHaveClass(new RegExp(`\\b${expected}\\b`), { timeout: 3000 });
  }
}

/**
 * 指定 uid の scene character が現場に存在しないことを assert (リムーブ済み)。
 */
export async function expectActorRemoved(
  page: Page,
  uid: string,
  side: Side,
): Promise<void> {
  const gs = await getGameState(page);
  const actor = (gs as GameStateLike).players[side].scene.find((s) => s.uid === uid);
  expect(actor).toBeUndefined();
}

/**
 * action context の cutInUsed[player] が true であることを assert。
 * カットインが正常に登録されたことの直接確認。
 */
export async function expectCutInUsed(page: Page, player: Side): Promise<void> {
  const ax = await getActionContext(page);
  expect(ax?.cutInUsed?.[player]).toBe(true);
}

/**
 * action context の現 phase を assert。
 */
export async function expectActionPhase(page: Page, expected: string): Promise<void> {
  const ax = await getActionContext(page);
  expect(ax?.phase).toBe(expected);
}

/**
 * 指定 uid の char が指定 keyword を持つことを engine state で assert。
 * `read.char.hasKeyword(state, uid, kw)` で continuous modifier 評価込みの判定。
 */
export async function expectCharHasKeyword(
  page: Page,
  uid: string,
  keyword: string,
): Promise<void> {
  const has = await page.evaluate(
    ({ u, kw }) => {
      const w = (window as unknown as {
        __game: {
          getState: () => { gameState: unknown };
          read: { char: { hasKeyword: (s: unknown, u: string, kw: string) => boolean } };
        };
      }).__game;
      const gs = w.getState().gameState;
      return w.read.char.hasKeyword(gs, u, kw);
    },
    { u: uid, kw: keyword },
  );
  expect(has).toBe(true);
}

/**
 * 指定 uid の char が指定 keyword を持たないことを assert (negative case 用)。
 */
export async function expectCharNotHasKeyword(
  page: Page,
  uid: string,
  keyword: string,
): Promise<void> {
  const has = await page.evaluate(
    ({ u, kw }) => {
      const w = (window as unknown as {
        __game: {
          getState: () => { gameState: unknown };
          read: { char: { hasKeyword: (s: unknown, u: string, kw: string) => boolean } };
        };
      }).__game;
      const gs = w.getState().gameState;
      return w.read.char.hasKeyword(gs, u, kw);
    },
    { u: uid, kw: keyword },
  );
  expect(has).toBe(false);
}

/**
 * console error が空であることを assert (setupGamePage の errors を渡す)。
 */
export function expectNoConsoleErrors(errors: string[]): void {
  expect(errors).toEqual([]);
}
