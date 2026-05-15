// Phase 8.6: runNextHintFlow tests
//
// rules: 12-next-hint.md
// spec: .claude/specs/2026-05-11-ui-action-flows.md ⑥ネクストヒント
//
// 仕様:
//   1. canStartNextHint で開始可否判定 (FILE 1+ かつ非アシストパートナー)
//   2. useConfirmation.ask (standard)
//   3. accept → dispatchEngineAction nextHint (optionalCardId 省略)
//   4. reject → cancelled

import { describe, it, expect, beforeEach } from 'vitest';
import { runNextHintFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, FileCard } from '@/engine/types/game-state';

function setupWithFile(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const fb: FileCard = { type: 'card-back' };
  s.players.self.file = [fb, fb, fb];
  return s;
}

describe('runNextHintFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useConfirmationStore.getState()._reset();
  });

  it('ask confirmation then dispatch on accept', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const promise = runNextHintFlow({ player: 'self' });

    // Confirmation should be open
    expect(useConfirmationStore.getState().current).not.toBeNull();
    expect(useConfirmationStore.getState().current?.title).toContain('ネクストヒント');

    // Accept
    const resolver = useConfirmationStore.getState()._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    resolver(true);

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.file.length).toBe(2);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('returns cancelled on reject', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const before = useGameStateStore.getState().gameState;
    const promise = runNextHintFlow({ player: 'self' });

    const resolver = useConfirmationStore.getState()._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    resolver(false);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('no-state when gameState is null', async () => {
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('not-allowed when FILE is empty', async () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: s });
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
