// Phase 8 完全クローズ Commit 5: setEffectOrder dispatch tests
//
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
// spec: 計画 — Commit 5

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { _setResolutionLock, event } from '@/engine/event/registry';
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
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('set ownerChosenOrder on owned entry → succeeds', () => {
    const first = { ...makeEntry('e_1', 'self'), triggerBatch: 7 };
    const second = { ...makeEntry('e_2', 'self'), triggerBatch: 7 };
    const s = makeStateWithEntries([first, second]);
    useGameStateStore.setState({ gameState: s });
    const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_1', order: 1, player: 'self' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.find((e) => e.id === 'e_1')?.ownerChosenOrder).toBe(1);
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
    const s = makeStateWithEntries([
      { ...makeEntry('e_1', 'self'), triggerBatch: 7 },
      { ...makeEntry('e_2', 'self'), triggerBatch: 7 },
    ]);
    useGameStateStore.setState({ gameState: s });
    _setResolutionLock(true, 'resolving');
    try {
      const r = dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_1', order: 0, player: 'self' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-allowed');
      expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ['e_1', 'e_2'], player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    } finally {
      _setResolutionLock(false, null);
    }
  });
  it('human same-timing batch remains pending until its owner confirms the order', () => {
    const first = makeEntry('e_1', 'self');
    const second = makeEntry('e_2', 'self');
    first.triggerBatch = 7;
    second.triggerBatch = 7;
    useGameStateStore.setState({ gameState: makeStateWithEntries([first, second]) });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    try {
      expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: 'e_2', order: 0, player: 'self' }).ok).toBe(true);
      let after = useGameStateStore.getState().gameState!;
      expect(after.pendingEffects.every((entry) => entry.state === 'pending')).toBe(true);
      expect(after.pendingEffects.map((entry) => entry.ownerChosenOrder).sort()).toEqual([0, 1]);
      expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ['e_2', 'e_1'], player: 'self' }).ok).toBe(true);
      after = useGameStateStore.getState().gameState!;
      expect(after.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    } finally {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    }
  });

  it('orders and confirms every currently unresolved effect owned by the priority player', () => {
    const currentA = { ...makeEntry('current-a', 'self'), triggerBatch: 3 };
    const currentB = { ...makeEntry('current-b', 'self'), triggerBatch: 3 };
    const futureA = { ...makeEntry('future-a', 'self'), triggerBatch: 4 };
    const futureB = makeEntry('future-b', 'self'); // legacy saved entry without batch metadata
    useGameStateStore.setState({ gameState: makeStateWithEntries([currentA, currentB, futureA, futureB]) });

    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: 'future-b', order: 0, player: 'self' }).ok).toBe(true);
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ['future-b', 'current-a', 'current-b', 'future-a'], player: 'self' }).ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: 'current-a', order: 0, player: 'self' }).ok).toBe(false);
  });

  it('accepts the canonical engine snapshot when entry timestamps diverge', () => {
    const canonicalFirst = makeEntry('canonical-first', 'self');
    canonicalFirst.triggeredAt.nano = 99;
    const canonicalSecond = makeEntry('canonical-second', 'self');
    canonicalSecond.triggeredAt.nano = 1;
    useGameStateStore.setState({ gameState: makeStateWithEntries([canonicalFirst, canonicalSecond]) });

    expect(dispatchEngineAction({
      type: 'resolveEffectOrder',
      entryIds: ['canonical-first', 'canonical-second'],
      player: 'self',
    })).toEqual({ ok: true });
  });

  it('normalizes a mixed-owner cross-batch legacy snapshot before executing it', () => {
    const crossBatch = {
      ...makeEntry('cross-batch', 'self'),
      triggerBatch: 7,
      ownerChosenOrder: 6,
      triggeredAt: { turn: 1, phase: 'main' as const, nano: 1 },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
    };
    const opponent = {
      ...makeEntry('opponent', 'opp'),
      triggerBatch: 7,
      triggeredAt: { turn: 1, phase: 'main' as const, nano: 2 },
    };
    const partialOrder = {
      ...makeEntry('partial-order', 'self'),
      triggerBatch: 8,
      ownerChosenOrder: 0,
      triggeredAt: { turn: 1, phase: 'main' as const, nano: 99 },
      effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } } as never,
    };
    const legacy = {
      ...makeEntry('legacy', 'self'),
      triggeredAt: { turn: 1, phase: 'main' as const, nano: 50 },
      effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } } as never,
    };
    const state = makeStateWithEntries([crossBatch, opponent, partialOrder, legacy]);
    state.players.self.deck = ['PARTIAL', 'CROSS', 'LEGACY'];
    const executionLog: string[] = [];
    const stop = event.on('effect:resolve:start', (_state, payload) => {
      const effectId = (payload as { effectId: string }).effectId;
      if (['partial-order', 'cross-batch', 'legacy'].includes(effectId)) executionLog.push(effectId);
    });
    useGameStateStore.setState({ gameState: state });

    try {
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder',
        entryIds: ['partial-order', 'cross-batch', 'legacy'],
        player: 'self',
      })).toEqual({ ok: true });
    } finally {
      stop();
    }

    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.filter(entry => entry.source.player === 'self')
      .map(entry => [entry.id, entry.ownerChosenOrder]))
      .toEqual([['cross-batch', 1], ['partial-order', 0], ['legacy', 2]]);
    expect(executionLog).toEqual(['partial-order', 'cross-batch', 'legacy']);
    expect(after.players.self.evidence.map(card => card.cardId)).toEqual(['PARTIAL', 'LEGACY']);
    expect(after.players.self.hand).toEqual(['CROSS']);
  });

  it('wakes the CPU driver after a human confirms effect order during the CPU turn', () => {
    const s = makeStateWithEntries([
      { ...makeEntry('e_1', 'self'), triggerBatch: 7 },
      { ...makeEntry('e_2', 'self'), triggerBatch: 7 },
    ]);
    s.turn.player = 'opp';
    useGameStateStore.setState({ gameState: s, oppMoveTick: 4 });

    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ['e_1', 'e_2'], player: 'self' }).ok).toBe(true);

    expect(useGameStateStore.getState().oppMoveTick).toBe(5);
  });

  it('rejects a stale confirmation snapshot without changing the current group', () => {
    const s = makeStateWithEntries([
      { ...makeEntry('old-a', 'self'), triggerBatch: 7 },
      { ...makeEntry('old-b', 'self'), triggerBatch: 7 },
    ]);
    useGameStateStore.setState({ gameState: s });
    const stale = ['old-a', 'old-b'];
    s.pendingEffects[0]!.state = 'resolved';
    s.pendingEffects.push({ ...makeEntry('new-a', 'self'), triggerBatch: 8 });
    s.pendingEffects.push({ ...makeEntry('new-b', 'self'), triggerBatch: 8 });

    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: stale, player: 'self' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.filter(entry => entry.state === 'pending').map(entry => entry.id))
      .toEqual(['old-b', 'new-a', 'new-b']);
    expect(after.pendingEffects.filter(entry => entry.state === 'pending').every(entry => entry.ownerOrderConfirmed !== true)).toBe(true);
  });
});
