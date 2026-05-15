// Phase 8 Task 8.5: ActionsPanel フロー (endTurn 最小配線)
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
// 仕様:
//   - runEndTurnFlow(player) → ConfirmModal を表示 → accept で endTurn dispatch
//   - reject なら state は変わらない
//   - dispatch 結果 (DispatchResult) を返す

import { describe, it, expect, beforeEach } from 'vitest';
import { runEndTurnFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';

describe('runEndTurnFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useConfirmationStore.getState()._reset();
  });

  it('asks confirmation; on accept, advances turn and returns ok=true', async () => {
    const init = createEmptyGameState();
    init.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: init });

    const promise = runEndTurnFlow({ player: 'self' });

    // ConfirmModal が出ているはず
    const ConfState = useConfirmationStore.getState();
    expect(ConfState.current).not.toBeNull();
    expect(ConfState.current?.title).toContain('ターン');

    // accept
    const acceptResolver = ConfState._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    acceptResolver(true);

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.turn.player).toBe('opp');
    expect(after.turn.number).toBe(2);
  });

  it('on reject, state is unchanged and returns ok=false (cancelled)', async () => {
    const init = createEmptyGameState();
    init.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: init });
    const before = useGameStateStore.getState().gameState;

    const promise = runEndTurnFlow({ player: 'self' });

    // reject
    const resolver = useConfirmationStore.getState()._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    resolver(false);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });
});
