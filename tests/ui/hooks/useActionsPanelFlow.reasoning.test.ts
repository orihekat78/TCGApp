// Phase 8 Task 8.6: runReasoningFlow tests
//
// rules: 11-reasoning.md, 13-keywords.md §名乗り例外
// spec: .claude/specs/2026-05-11-ui-action-flows.md ①推理
//
// 仕様:
//   1. 自プレイヤーの reasoning 候補を engine.canReason で列挙 (partner:self + scene)
//   2. useTargetPicker.start({ candidates, purpose:'reasoning' })
//   3. 選択 → useConfirmation.ask (kind:'standard')
//   4. accept → dispatchEngineAction reasoning
//   5. picker cancel / confirm reject → { ok:false, reason:'cancelled' }, state 不変

import { describe, it, expect, beforeEach } from 'vitest';
import { runReasoningFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(uid: string): SceneCharacter {
  return baseChar({ cardId: 'cX', uid, enterOrder: 0 });
}

function setup(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: '', state: 'active', location: 'partner-area' };
  s.players.self.scene = [makeChar('c1'), makeChar('c2')];
  return s;
}

describe('runReasoningFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useTargetPickerStore.getState()._reset();
    useConfirmationStore.getState()._reset();
  });

  it('enumerates candidates (partner + active scene chars) and dispatches on pick+confirm', async () => {
    useGameStateStore.setState({ gameState: setup() });

    const promise = runReasoningFlow({ player: 'self' });

    // Picker should be in 'picking' phase with 3 candidates
    const pickerPhase = useTargetPickerStore.getState().phase;
    expect(pickerPhase.phase).toBe('picking');
    if (pickerPhase.phase === 'picking') {
      expect(pickerPhase.candidates).toContain('partner:self');
      expect(pickerPhase.candidates).toContain('c1');
      expect(pickerPhase.candidates).toContain('c2');
      expect(pickerPhase.purpose).toBe('reasoning');
    }

    // Pick c1
    const pickerResolver = useTargetPickerStore.getState()._resolver!;
    useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
    useTargetPickerStore.getState()._setResolver(null);
    pickerResolver('c1');

    // Wait microtask
    await new Promise<void>((r) => setTimeout(r, 0));

    // ConfirmModal should now be open
    expect(useConfirmationStore.getState().current).not.toBeNull();

    // Accept
    const confResolver = useConfirmationStore.getState()._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    confResolver(true);

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene[0]?.state).toBe('sleep');
  });

  it('returns cancelled when picker is cancelled (target picker resolves null)', async () => {
    useGameStateStore.setState({ gameState: setup() });
    const before = useGameStateStore.getState().gameState;
    const promise = runReasoningFlow({ player: 'self' });

    // Cancel picker
    const r = useTargetPickerStore.getState()._resolver!;
    useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
    useTargetPickerStore.getState()._setResolver(null);
    r(null);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('returns cancelled when confirmation is rejected', async () => {
    useGameStateStore.setState({ gameState: setup() });
    const before = useGameStateStore.getState().gameState;
    const promise = runReasoningFlow({ player: 'self' });

    // Pick c1
    const r = useTargetPickerStore.getState()._resolver!;
    useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
    useTargetPickerStore.getState()._setResolver(null);
    r('c1');
    await new Promise<void>((r2) => setTimeout(r2, 0));

    // Reject confirmation
    const cr = useConfirmationStore.getState()._resolver!;
    useConfirmationStore.getState()._setCurrent(null);
    useConfirmationStore.getState()._setResolver(null);
    cr(false);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('returns no-state when gameState is null', async () => {
    const result = await runReasoningFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('returns no-state-like when no candidates are available (0 active units)', async () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // partner is sleep, no scene chars
    s.players.self.partner = { cardId: '', state: 'sleep', location: 'partner-area' };
    useGameStateStore.setState({ gameState: s });

    const result = await runReasoningFlow({ player: 'self' });
    // 0 candidates → picker.start returns null immediately → cancelled
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });
});
