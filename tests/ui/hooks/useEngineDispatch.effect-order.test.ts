// Phase 8 完全クローズ Commit 5: setEffectOrder dispatch tests
//
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
// spec: 計画 — Commit 5

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { _setResolutionLock } from '@/engine/event/registry';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types/game-state';
import type { EffectStackEntry } from '@/engine/types/effect-stack';

function makeEntry(id: string, player: 'self' | 'opp', state: EffectStackEntry['state'] = 'pending'): EffectStackEntry {
  return {
    id,
    source: { player },
    triggeredBy: { hook: 'test' },
    triggeredAt: { turn: 1, phase: 'main', nano: id.charCodeAt(0) },
    effect: { kind: 'atom', verb: 'noop', args: {} } as never,
    state,
  };
}

function makeStateWithEntries(entries: EffectStackEntry[]): GameState {
  const s = createEmptyGameState();
  s.turn.player = 'self';
  s.turn.phase = 'main';
  s.pendingEffects = entries;
  return s;
}

describe('setEffectOrder dispatch (Commit 5)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    _setResolutionLock(false, null);
  });

  it('set ownerChosenOrder on owned entry → succeeds', () => {
    const s = makeStateWithEntries([
      makeEntry('e_1', 'self'),
      makeEntry('e_2', 'self'),
    ]);
    useGameStateStore.setState({ gameState: s });
    const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_1', order: 2, player: 'self' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.find((e) => e.id === 'e_1')?.ownerChosenOrder).toBe(2);
  });

  it('non-owner cannot set order → not-allowed', () => {
    const s = makeStateWithEntries([makeEntry('e_1', 'opp')]);
    useGameStateStore.setState({ gameState: s });
    const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_1', order: 1, player: 'self' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-allowed');
  });

  it('non-existent entry → not-allowed', () => {
    const s = makeStateWithEntries([]);
    useGameStateStore.setState({ gameState: s });
    const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_nope', order: 0, player: 'self' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-allowed');
  });

  it('resolution lock 中は not-allowed', () => {
    const s = makeStateWithEntries([makeEntry('e_1', 'self')]);
    useGameStateStore.setState({ gameState: s });
    _setResolutionLock(true, 'resolving');
    try {
      const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_1', order: 0, player: 'self' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-allowed');
    } finally {
      _setResolutionLock(false, null);
    }
  });
});
