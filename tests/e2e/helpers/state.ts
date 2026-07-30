// E2E test state manipulation helpers — buildGameState / dispatch / probe / polling
//
// 設計方針:
// - buildGameState は modifier 関数を string 経由で渡し evaluate 内で実行 (Playwright cross-process)
// - modifier は GameState を mutate (引数渡し)。外部スコープ参照不可
// - dispatch / getState / getActionContext は __game の thin wrapper

import type { Page } from '@playwright/test';
import type { GameWindow, GameStateLike } from './types';

/**
 * createSampleGameState を呼び、modifier を適用して setGameState。
 * modifier は string 化されて evaluate 内で再構築される (外部スコープ参照不可)。
 *
 * 外部値を渡したい場合は第 3 引数 `arg` を使う。modifier シグネチャは
 * `(gs, arg) => void`。arg は JSON シリアライズ可能であること。
 */
export async function buildGameState<T = void>(
  page: Page,
  modifier: (gs: GameStateLike, arg: T) => void,
  arg?: T,
): Promise<void> {
  const fnStr = modifier.toString();
  await page.evaluate(
    ({ src, a }) => {
      const fn = new Function('return (' + src + ')')() as (gs: unknown, a: unknown) => void;
      const w = window as unknown as GameWindow;
      const gs = w.__game.createSampleGameState();
      fn(gs, a);
      w.__game.setGameState(gs);
    },
    { src: fnStr, a: arg as unknown },
  );
}

export async function getGameState(page: Page): Promise<GameStateLike> {
  return (await page.evaluate(() => {
    const w = window as unknown as GameWindow;
    return w.__game.getState().gameState as unknown;
  })) as GameStateLike;
}

export async function dispatchAction<T = { ok: boolean; reason?: string }>(page: Page, action: unknown): Promise<T> {
  return (await page.evaluate((act) => {
    const w = window as unknown as GameWindow;
    if (!act || typeof act !== 'object') return w.__game.dispatch(act) as unknown;
    const bound = { ...(act as Record<string, unknown>) };
    const pendingKeyByType: Record<string, string> = {
      effectPickResolve: 'pendingEffectPick',
      choiceResolve: 'pendingEffectChoice',
      optionalResolve: 'pendingEffectOptional',
      chooseInterceptResolve: 'pendingChooseIntercept',
      repeatOptionalResolve: 'pendingEffectRepeatOptional',
      deckReorderResolve: 'pendingDeckReorder',
      deckPlaceResolve: 'pendingDeckPlace',
      leaveInterceptResolve: 'pendingLeaveIntercept',
      rpsResolve: 'pendingRps',
      setCardChoiceResolve: 'pendingSetCardChoice',
      setCardReplacementResolve: 'pendingSetCardReplacement',
      hiramekiResolve: 'pendingHirameki',
      misreadResolve: 'pendingMisread',
    };
    const pendingKey = pendingKeyByType[String(bound.type)];
    const uiState = w.__game.getState() as unknown as Record<string, unknown>;
    const pending = pendingKey
      ? uiState[pendingKey] as { decisionId?: string } | null | undefined
      : null;
    if (bound.decisionId === undefined && pending?.decisionId !== undefined) {
      bound.decisionId = pending.decisionId;
    }
    return w.__game.dispatch(bound) as unknown;
  }, action)) as T;
}

export async function getActionContext(
  page: Page,
  actionId?: string,
): Promise<{ id: string; phase: string; byPlayer?: string; firstUid?: string; secondUid?: string; cutInUsed?: Record<string, boolean> } | null> {
  return (await page.evaluate((id) => {
    const w = window as unknown as GameWindow;
    const ax = id ?? w.__game.getState().activeActionId;
    if (!ax) return null;
    return w.__game.getActionContext(ax);
  }, actionId)) as Awaited<ReturnType<typeof getActionContext>>;
}

export async function getActiveActionId(page: Page): Promise<string | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as GameWindow;
    return w.__game.getState().activeActionId;
  })) as string | null;
}

/**
 * 指定 phase になるまで polling (Playwright waitForFunction 経由)。
 * 主要 phase: 'guard-window' / 'leave-resolution' / 'contact-pending' /
 *             'action-1' / 'action-2' / 'judge' / 'contact-end' / 'action-end'
 */
export async function waitForPhase(
  page: Page,
  phase: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const w = window as unknown as GameWindow;
      const id = w.__game.getState().activeActionId;
      if (!id) return false;
      const ax = w.__game.getActionContext(id);
      return ax?.phase === expected;
    },
    phase,
    { timeout },
  );
}

/**
 * action context が解放 (null/undefined) されるまで polling — action 完走の判定。
 * state-machine が contact-end → action-end 遷移時に `_contexts.delete(id)` を呼ぶため、
 * `getActionContext()` の戻り値は **undefined** になる (null ではない)。両者を信号とする。
 */
export async function waitForActionEnd(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as GameWindow;
      const id = w.__game.getState().activeActionId;
      if (!id) return true;
      const ax = w.__game.getActionContext(id);
      return ax == null || ax.phase === 'action-end';
    },
    null,
    { timeout },
  );
}
