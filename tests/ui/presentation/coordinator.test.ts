import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { useGameStateStore } from '@/ui/state/store';
import {
  admitPresentationFromState,
  currentPresentationSessionId,
  getPresentationQueue,
  rebuildPresentationAtCurrentState,
  resetPresentationQueue,
  skipCommittedPresentationSuffix,
} from '@/ui/presentation/coordinator';
import { usePresentationStore } from '@/ui/presentation/store';

describe('presentation coordinator', () => {
  it('reads the unowned session without mutating presentation state', () => {
    const queue = getPresentationQueue();
    const epoch = queue.currentEpoch();
    const revision = queue.revision();

    expect(currentPresentationSessionId()).toBe('presentation-unowned');
    expect(currentPresentationSessionId()).toBe('presentation-unowned');
    expect(queue.currentEpoch()).toBe(epoch);
    expect(queue.revision()).toBe(revision);
  });

  it('invalidates stale completion tokens on every session reset', () => {
    const queue = getPresentationQueue();
    const oldEpoch = resetPresentationQueue('old-session');
    const newEpoch = resetPresentationQueue('new-session');

    expect(newEpoch).toBeGreaterThan(oldEpoch);
    expect(queue.completeCurrent(oldEpoch)).toBe(false);
    expect(queue.current()).toBeNull();
  });

  it('rebuilds replay presentation after the current causal position without replaying past moves', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'replay-causal');
    appendCausal(state, { actor: 'self', kind: 'draw', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'none' } });
    const queue = getPresentationQueue();
    const oldEpoch = resetPresentationQueue('before-seek');

    const newEpoch = rebuildPresentationAtCurrentState(state);

    expect(newEpoch).toBeGreaterThan(oldEpoch);
    expect(queue.outstandingCount()).toBe(0);
    expect(queue.completeCurrent(oldEpoch)).toBe(false);
  });

  it('purges legacy replay work even when no causal session exists', () => {
    const state = createEmptyGameState();
    state.log.push({ ts: 1, player: 'self', turn: 1, action: 'draw' });
    const queue = getPresentationQueue();
    const oldEpoch = resetPresentationQueue('legacy-before');

    const newEpoch = rebuildPresentationAtCurrentState(state);

    expect(newEpoch).toBeGreaterThan(oldEpoch);
    expect(queue.current()).toBeNull();
  });

  it('admits every new live event exactly once in causal sequence order', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'live-causal');
    appendCausal(state, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('live-causal');

    expect(admitPresentationFromState(state)).toEqual({ admitted: 2, rejected: null });
    expect(getPresentationQueue().items().map((item) => (
      item.type === 'event' ? item.event.sequence : -1
    ))).toEqual([1, 2]);
    expect(admitPresentationFromState(state)).toEqual({ admitted: 0, rejected: null });

    appendCausal(state, { actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'none' } });
    expect(admitPresentationFromState(state)).toEqual({ admitted: 1, rejected: null });
    expect(getPresentationQueue().items().map((item) => (
      item.type === 'event' ? item.event.sequence : -1
    ))).toEqual([1, 2, 3]);
  });

  it('rejects a live graph from a different match session without changing the queue', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'foreign-causal');
    appendCausal(state, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('owned-causal');

    expect(admitPresentationFromState(state)).toEqual({ admitted: 0, rejected: 'session' });
    expect(getPresentationQueue().items()).toEqual([]);
  });

  it('rejects a foreign causal session before its first event is appended', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'foreign-empty');
    resetPresentationQueue('owned-empty');
    useGameStateStore.setState({ gameState: null });

    expect(admitPresentationFromState(state)).toEqual({ admitted: 0, rejected: 'session' });
    expect(useGameStateStore.getState().setGameState(state)).toBe(false);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(usePresentationStore.getState().presentationError).toContain('session');
  });

  it('rebuilds an empty causal replay at sequence one under its allocator session', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'replay-empty');
    resetPresentationQueue('before-empty-replay');

    rebuildPresentationAtCurrentState(state);

    expect(currentPresentationSessionId()).toBe('replay-empty');
    expect(getPresentationQueue().outstandingCount()).toBe(0);
  });

  it.each(['hand', 'deck'] as const)(
    'rejects a forged hidden %s card identity before live queue admission',
    (zone) => {
      const state = createEmptyGameState();
      startCausalSession(state, `hidden-${zone}`);
      appendCausal(state, {
        actor: 'opp',
        kind: 'draw',
        source: { kind: 'player', side: 'opp' },
        targets: [],
        outcome: { type: 'none' },
      });
      (state.log[0] as { source?: unknown }).source = {
        visibility: 'public',
        kind: 'card',
        label: 'SECRET-HIDDEN',
        side: 'opp',
        zone,
        cardNumber: 'SECRET-HIDDEN',
      };
      resetPresentationQueue(`hidden-${zone}`);

      expect(() => admitPresentationFromState(state)).toThrow(/hidden|public|zone/i);
      expect(getPresentationQueue().items()).toEqual([]);
    },
  );

  it.each(['file', 'evidence'] as const)(
    'redacts a forged face-down %s identity before live queue admission',
    (zone) => {
      const secret = `SECRET-${zone.toUpperCase()}`;
      const state = createEmptyGameState();
      if (zone === 'file') {
        state.players.opp.file = [{ type: 'card-back', cardId: secret }];
      } else {
        state.players.opp.evidence = [{
          cardId: secret,
          faceUp: false,
          origin: { turn: 1, via: 'reasoning' },
        }];
      }
      startCausalSession(state, `conditional-${zone}`);
      appendCausal(state, {
        actor: 'opp', kind: 'select', targets: [], outcome: { type: 'none' },
      });
      (state.log[0] as { target?: string; targets: unknown[] }).target = secret;
      (state.log[0] as { targets: unknown[] }).targets = [{
        visibility: 'public',
        kind: 'card',
        label: secret,
        side: 'opp',
        zone,
        cardNumber: secret,
      }];
      resetPresentationQueue(`conditional-${zone}`);

      expect(admitPresentationFromState(state)).toEqual({ admitted: 1, rejected: null });
      const queued = getPresentationQueue().items();
      expect(JSON.stringify(queued)).not.toContain(secret);
      expect(queued[0]).toMatchObject({
        type: 'event',
        event: { targets: [{ kind: 'zone', side: 'opp', zone }] },
      });
    },
  );

  it('keeps an assisted partner identity public after it moves to FILE', () => {
    const state = createEmptyGameState();
    state.players.opp.partner = {
      cardId: 'PUBLIC-PARTNER', state: 'sleep', location: 'file-area',
    };
    state.players.opp.file = [{ type: 'assisted-partner', cardId: 'PUBLIC-PARTNER' }];
    startCausalSession(state, 'public-assisted-partner');
    appendCausal(state, {
      actor: 'opp', kind: 'zone-move', targets: [],
      outcome: { type: 'move', from: 'partner', to: 'file', count: 1 },
    });
    (state.log[0] as { target?: string; targets: unknown[] }).target = 'PUBLIC-PARTNER';
    (state.log[0] as { targets: unknown[] }).targets = [{
      visibility: 'public', kind: 'card', label: 'PUBLIC-PARTNER',
      side: 'opp', zone: 'file', cardNumber: 'PUBLIC-PARTNER',
    }];
    resetPresentationQueue('public-assisted-partner');

    expect(admitPresentationFromState(state)).toEqual({ admitted: 1, rejected: null });
    expect(getPresentationQueue().items()[0]).toMatchObject({
      type: 'event',
      event: { targets: [{ kind: 'card', cardNumber: 'PUBLIC-PARTNER' }] },
    });
  });

  it('rejects a causal allocator mismatch before live queue admission', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'bad-allocator');
    appendCausal(state, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    state.causalLog!.nextSequence = 99;
    resetPresentationQueue('bad-allocator');

    expect(() => admitPresentationFromState(state)).toThrow(/allocator/i);
    expect(getPresentationQueue().items()).toEqual([]);
  });

  it('rejects physical causal append order that disagrees with sequence order', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'bad-append-order');
    appendCausal(state, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    state.log.reverse();
    resetPresentationQueue('bad-append-order');

    expect(() => admitPresentationFromState(state)).toThrow(/append order/i);
    expect(getPresentationQueue().items()).toEqual([]);
  });

  it('wires both setGameState and dispatch commits into one exact-once queue', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'store-live');
    appendCausal(state, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('store-live');

    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().dispatch((current) => produce(current, (draft) => {
      appendCausal(draft, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    }));

    expect(getPresentationQueue().items().map((item) => (
      item.type === 'event' ? item.event.sequence : -1
    ))).toEqual([1, 2]);
    useGameStateStore.setState({ gameState: null });
  });

  it('retries a deferred 65th event exactly once when presentation frees capacity', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'store-capacity');
    for (let index = 0; index < 65; index += 1) {
      appendCausal(state, { actor: 'opp', kind: 'select', targets: [], outcome: { type: 'none' } });
    }
    resetPresentationQueue('store-capacity');

    useGameStateStore.getState().setGameState(state);
    const committed = useGameStateStore.getState().gameState;
    const queue = getPresentationQueue();
    expect(queue.outstandingCount()).toBe(64);
    expect(usePresentationStore.getState().presentationError).toContain('capacity');

    expect(queue.completeCurrent(queue.currentEpoch())).toBe(true);
    expect(queue.outstandingCount()).toBe(64);
    expect(queue.items().at(-1)).toMatchObject({
      type: 'event',
      event: { eventId: 'store-capacity:65', sequence: 65 },
    });
    expect(usePresentationStore.getState().presentationError).toBeNull();
    expect(useGameStateStore.getState().gameState).toBe(committed);
  });

  it('marks committed but unadmitted work skipped so it cannot reappear later', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'skip-capacity');
    for (let index = 0; index < 65; index += 1) {
      appendCausal(state, { actor: 'opp', kind: 'select', targets: [], outcome: { type: 'none' } });
    }
    resetPresentationQueue('skip-capacity');
    useGameStateStore.getState().setGameState(state);

    expect(skipCommittedPresentationSuffix()).toBe(1);
    const queue = getPresentationQueue();
    queue.skip();
    queue.completeCurrent(queue.currentEpoch());
    expect(admitPresentationFromState(state)).toEqual({ admitted: 0, rejected: null });
    expect(queue.outstandingCount()).toBe(0);
  });

  it('rejects a malformed setGameState commit and preserves the last valid state', () => {
    const valid = createEmptyGameState();
    startCausalSession(valid, 'store-valid-set');
    appendCausal(valid, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('store-valid-set');
    useGameStateStore.getState().setGameState(valid);
    const committed = useGameStateStore.getState().gameState;

    const malformed = createEmptyGameState();
    startCausalSession(malformed, 'store-malformed-set');
    appendCausal(malformed, {
      actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' },
    });
    (malformed.log[0] as { parentEventId?: string }).parentEventId = 'store-malformed-set:999';
    useGameStateStore.getState().setGameState(malformed);

    expect(useGameStateStore.getState().gameState).toBe(committed);
    expect(usePresentationStore.getState().presentationError).toMatch(/parent|missing|edge/i);
    useGameStateStore.setState({ gameState: null });
  });

  it('rejects a malformed dispatch commit and preserves the last valid state', () => {
    const valid = createEmptyGameState();
    startCausalSession(valid, 'store-valid-dispatch');
    appendCausal(valid, { actor: 'self', kind: 'use', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('store-valid-dispatch');
    useGameStateStore.getState().setGameState(valid);
    const committed = useGameStateStore.getState().gameState;

    useGameStateStore.getState().dispatch((current) => produce(current, (draft) => {
      appendCausal(draft, {
        actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' },
      });
      (draft.log[1] as { parentEventId?: string }).parentEventId = 'store-valid-dispatch:999';
    }));

    expect(useGameStateStore.getState().gameState).toBe(committed);
    expect(usePresentationStore.getState().presentationError).toMatch(/parent|missing|edge/i);
    useGameStateStore.setState({ gameState: null });
  });
});
