// Phase 8.6: runHandUseFlow tests
//
// rules: 05-turn-phases.md §手札の使用 (1 ターン 1 回 / ネクストヒント済不可)
// spec: .claude/specs/2026-05-11-ui-action-flows.md ①手札の使用
//
// 仕様:
//   - standard kind ConfirmModal → accept → mutate.flag.setHandUseUsed(true)
//   - reject → cancelled (state 不変)
//   - no-state → no-state
//   - not-allowed: cardId が手札にない / handUseUsed済 / nextHintUsed済
//
// 色 / レベル制限は engine.canHandUseCard 側のテストでカバー (CardDef 未登録時は寛容)。

import { describe, it, expect, beforeEach } from 'vitest';
import { runHandUseFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types/game-state';

function setupForHandUse(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['CARD-A'];
  return s;
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function rejectConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(false);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

describe('runHandUseFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useConfirmationStore.getState()._reset();
  });

  it('shows standard kind modal then dispatches handUseCard on accept', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });

    expect(useConfirmationStore.getState().current?.kind).toBe('standard');
    expect(useConfirmationStore.getState().current?.title).toContain('手札の使用');

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.turnState.self.handUseUsed).toBe(true);
  });

  it('returns cancelled on reject and leaves state unchanged', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const before = useGameStateStore.getState().gameState;
    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('returns no-state when gameState is null', async () => {
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('not-allowed when cardId is not in hand', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const result = await runHandUseFlow({ player: 'self', cardId: 'NOT-IN-HAND' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when handUseUsed is already true', async () => {
    const s = setupForHandUse();
    s.turnState.self.handUseUsed = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when nextHintUsed is already true (rules/05)', async () => {
    const s = setupForHandUse();
    s.turnState.self.nextHintUsed = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
