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

/** Causal checkpoint を検証する E2E 用に、presentation と同じ session で state を開始する。 */
export async function buildCausalGameState<T = void>(
  page: Page,
  modifier: (gs: GameStateLike, arg: T) => void,
  arg?: T,
): Promise<void> {
  const fnStr = modifier.toString();
  await page.evaluate(
    async ({ src, a }) => {
      const fn = new Function('return (' + src + ')')() as (gs: unknown, a: unknown) => void;
      const w = window as unknown as GameWindow;
      const { startCausalSession, resetPresentationQueue } = await w.__game.testApi;
      const gs = w.__game.createSampleGameState();
      fn(gs, a);
      const sessionId = `e2e-causal-${crypto.randomUUID()}`;
      resetPresentationQueue(sessionId);
      startCausalSession(gs, sessionId);
      w.__game.setGameState(gs);
    },
    { src: fnStr, a: arg as unknown },
  );
}

async function surfaceDeckDecision(
  page: Page,
  atomVerb: 'deckToBottomBound' | 'deckPlaceSplitBound',
  cardIds: string[],
): Promise<void> {
  await page.evaluate(async ({ verb, ids }) => {
    const w = window as unknown as GameWindow;
    const {
      deckOccurrenceAuthority,
      runAtom,
      produce,
      persistPendingRuntimeState,
      resetPendingRuntimeState,
      surfacePendingSideChannels,
    } = await w.__game.testApi;
    const current = w.__game.getState().gameState as {
      players: { self: { deck: string[] } };
    };
    const used = new Set<number>();
    const occurrenceSpecs = ids.map((cardId) => {
      const index = current.players.self.deck.findIndex((deckCardId, deckIndex) => (
        deckCardId === cardId && !used.has(deckIndex)
      ));
      if (index < 0) throw new Error(`deck decision fixture card is absent: ${cardId}`);
      used.add(index);
      return { cardId, index };
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    resetPendingRuntimeState();
    const next = produce(current, (draft) => {
      const occurrences = occurrenceSpecs.map(({ cardId, index }) => {
        const occurrence = deckOccurrenceAuthority(draft, 'self', index);
        if (!occurrence) throw new Error(`deck decision fixture authority is stale: ${cardId}`);
        return occurrence;
      });
      const ctx = {
        source: {
          player: 'self',
          cardId: 'D08020',
          uid: 'e2e-deck-decision-source',
          abilityId: 'fixture',
          area: 'scene',
        },
        bindings: { '$e2eDeckCards': occurrences },
      };
      runAtom(draft, verb, { player: 'self', bindKey: '$e2eDeckCards' }, ctx);
      persistPendingRuntimeState(draft);
    });
    w.__game.setGameState(next, { preserveRuntime: true });
    surfacePendingSideChannels(w.__game.store.getState);
  }, { verb: atomVerb, ids: cardIds });
}

/** Open a real engine-owned deck reorder decision for modal E2E coverage. */
export async function surfaceDeckReorderDecision(page: Page, cardIds: string[]): Promise<void> {
  await surfaceDeckDecision(page, 'deckToBottomBound', cardIds);
}

/** Open a real engine-owned deck placement decision for modal E2E coverage. */
export async function surfaceDeckPlaceDecision(page: Page, cardIds: string[]): Promise<void> {
  await surfaceDeckDecision(page, 'deckPlaceSplitBound', cardIds);
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

/**
 * Production case-action FSM を guard なしで judge まで同期的に進める。
 * 3 dispatch を同じ browser task 内で行い、React driver との競合を避ける。
 */
export async function dispatchUnguardedCaseAction(
  page: Page,
  byUid: string,
  targetPlayer: 'self' | 'opp',
): Promise<string> {
  return page.evaluate(({ attackerUid, target }) => {
    const w = window as unknown as GameWindow;
    const declared = w.__game.dispatch({
      type: 'actionDeclareCase',
      byUid: attackerUid,
      targetPlayer: target,
    }) as { ok: boolean; reason?: string; detail?: string };
    if (!declared.ok) throw new Error(`actionDeclareCase failed: ${declared.reason ?? 'unknown'}${declared.detail ? `: ${declared.detail}` : ''}`);

    const actionId = w.__game.getState().activeActionId;
    if (!actionId) throw new Error('activeActionId not set after actionDeclareCase');

    const guarded = w.__game.dispatch({ type: 'actionGuard', actionId, guarderUid: null }) as {
      ok: boolean;
      reason?: string;
      detail?: string;
    };
    if (!guarded.ok) throw new Error(`actionGuard failed: ${guarded.reason ?? 'unknown'}${guarded.detail ? `: ${guarded.detail}` : ''}`);

    const judged = w.__game.dispatch({ type: 'actionJudge', actionId }) as {
      ok: boolean;
      reason?: string;
      detail?: string;
    };
    if (!judged.ok) throw new Error(`actionJudge failed: ${judged.reason ?? 'unknown'}${judged.detail ? `: ${judged.detail}` : ''}`);
    return actionId;
  }, { attackerUid: byUid, target: targetPlayer });
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
