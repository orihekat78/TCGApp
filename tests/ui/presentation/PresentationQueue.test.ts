import { describe, expect, it } from 'vitest';
import { PresentationQueue } from '@/ui/presentation/PresentationQueue';
import type { CausalEventKind, CausalLogEntryV1, CausalOutcome } from '@/engine/types';

describe('PresentationQueue', () => {
  it('notifies subscribers once for each externally visible queue mutation', () => {
    const queue = new PresentationQueue();
    let notifications = 0;
    const unsubscribe = queue.subscribe(() => { notifications += 1; });
    const graph: CausalLogEntryV1[] = [];

    const epoch = queue.startSession('session-a');
    expect(notifications).toBe(1);
    offer(queue, graph, entry(1));
    expect(notifications).toBe(2);
    expect(queue.completeCurrent(epoch)).toBe(true);
    expect(notifications).toBe(3);
    expect(queue.completeCurrent(epoch)).toBe(false);
    expect(notifications).toBe(3);

    unsubscribe();
    queue.startSession('session-b');
    expect(notifications).toBe(3);
  });

  it('keeps FIFO work in one session and ignores completion from an old epoch', () => {
    const queue = new PresentationQueue();
    const graphA: CausalLogEntryV1[] = [];
    const oldEpoch = queue.startSession('session-a');
    offer(queue, graphA, entry(1));
    offer(queue, graphA, entry(2));

    expect(queue.current()).toMatchObject({ type: 'event', event: { eventId: 'session-a:1' } });
    const newEpoch = queue.startSession('session-b');
    const graphB: CausalLogEntryV1[] = [];
    offer(queue, graphB, entry(1, { sessionId: 'session-b', eventId: 'session-b:1' }));

    expect(queue.completeCurrent(oldEpoch)).toBe(false);
    expect(queue.current()).toMatchObject({ type: 'event', event: { eventId: 'session-b:1' } });
    expect(queue.completeCurrent(newEpoch)).toBe(true);
    expect(queue.current()).toBeNull();
  });

  it('rejects options above the fixed capacity and terminal limits', () => {
    expect(() => new PresentationQueue({ maxOutstanding: 65 })).toThrow(/64|capacity/i);
    expect(() => new PresentationQueue({ terminalDrainMs: 3_001 })).toThrow(/3.?000|drain/i);
  });

  it('caps outstanding work at 64 and aggregates only an adjacent identical result', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    offer(queue, graph, entry(1, { kind: 'use', outcome: { type: 'state', state: 'success' } }));
    for (let sequence = 2; sequence <= 63; sequence += 1) {
      offer(queue, graph, entry(sequence, { kind: 'summary', outcome: { type: 'none' } }));
    }
    offer(queue, graph, entry(64, { parentEventId: 'session-a:1' }));

    const reorderedOutcome = { unit: 'card', amount: 1, type: 'count' } as CausalOutcome;
    const accepted = offer(queue, graph, entry(65, {
      parentEventId: 'session-a:1',
      outcome: reorderedOutcome,
    }));

    expect(accepted).toEqual({ accepted: true, aggregated: true });
    expect(queue.outstandingCount()).toBe(64);
    expect(queue.items().at(-1)).toEqual(expect.objectContaining({
      type: 'aggregate',
      causeEventId: 'session-a:1',
      kind: 'draw',
      count: 2,
      firstSequence: 64,
      lastSequence: 65,
      targets: [],
      eventIds: ['session-a:64', 'session-a:65'],
    }));
  });

  it('does not aggregate across an intervening event or a different correlation edge', () => {
    const queue = new PresentationQueue({ maxOutstanding: 4 });
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    offer(queue, graph, entry(1, { kind: 'use', outcome: { type: 'state', state: 'success' } }));
    offer(queue, graph, entry(2, { parentEventId: 'session-a:1' }));
    offer(queue, graph, entry(3, { kind: 'declare', outcome: { type: 'none' } }));
    offer(queue, graph, entry(4, { kind: 'select', outcome: { type: 'none' } }));

    expect(offer(queue, graph, entry(5, {
      parentEventId: 'session-a:1',
      correlationEventId: 'session-a:4',
    }))).toEqual({ accepted: false, reason: 'capacity' });
    expect(queue.items().map(itemSequence)).toEqual([1, 2, 3, 4]);
  });

  it('fails closed when the 65th critical event cannot be aggregated', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    const epoch = queue.startSession('session-a');
    for (let sequence = 1; sequence <= 64; sequence += 1) {
      expect(offer(queue, graph, entry(sequence, { kind: 'select' })))
        .toEqual({ accepted: true, aggregated: false });
    }
    expect(queue.current()).not.toBeNull();
    expect(offer(queue, graph, entry(65, { kind: 'select' })))
      .toEqual({ accepted: false, reason: 'capacity' });
    expect(queue.outstandingCount()).toBe(64);
    expect(queue.completeCurrent(epoch)).toBe(true);
  });

  it('signals backpressure release only after a valid full-queue removal', () => {
    const queue = new PresentationQueue({ maxOutstanding: 2 });
    const graph: CausalLogEntryV1[] = [];
    let released = 0;
    const unsubscribe = queue.onCapacityAvailable(() => { released += 1; });
    const epoch = queue.startSession('session-a');

    offer(queue, graph, entry(1, { kind: 'select' }));
    offer(queue, graph, entry(2, { kind: 'select' }));
    expect(released).toBe(0);
    expect(queue.completeCurrent(epoch - 1)).toBe(false);
    expect(released).toBe(0);
    expect(queue.completeCurrent(epoch)).toBe(true);
    expect(released).toBe(1);

    unsubscribe();
  });

  it('retries the deferred 65th event into the hidden summary without losing its range', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    for (let sequence = 1; sequence <= 64; sequence += 1) {
      expect(offer(queue, graph, entry(sequence, { kind: 'select' })))
        .toEqual({ accepted: true, aggregated: false });
    }
    const deferred = entry(65, { kind: 'select' });
    graph.push(deferred);
    expect(queue.enqueue(deferred, graph)).toEqual({ accepted: false, reason: 'capacity' });

    let retries = 0;
    queue.onCapacityAvailable(() => {
      retries += 1;
      expect(queue.enqueue(deferred, graph)).toEqual({ accepted: true, aggregated: true });
    });

    queue.setHidden(true);
    expect(retries).toBe(1);
    expect(queue.current()).toBeNull();
    const summary = queue.setHidden(false);
    expect(summary).toMatchObject({
      type: 'summary', reason: 'hidden', count: 65, firstSequence: 1, lastSequence: 65,
    });
    expect(summary?.eventIds).toHaveLength(64);
    expect(queue.items()).toEqual([summary]);
  });

  it('retries the deferred 65th event into the terminal summary before returning it', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    for (let sequence = 1; sequence <= 64; sequence += 1) {
      expect(offer(queue, graph, entry(sequence, { kind: 'select' })))
        .toEqual({ accepted: true, aggregated: false });
    }
    const deferred = entry(65, { kind: 'select' });
    graph.push(deferred);
    expect(queue.enqueue(deferred, graph)).toEqual({ accepted: false, reason: 'capacity' });

    let retries = 0;
    queue.onCapacityAvailable(() => {
      retries += 1;
      expect(queue.enqueue(deferred, graph)).toEqual({ accepted: true, aggregated: true });
    });

    queue.beginTerminal(0);
    const summary = queue.advanceTerminal(3_000);
    expect(retries).toBe(1);
    expect(summary).toMatchObject({
      type: 'summary', reason: 'terminal', count: 65, firstSequence: 1, lastSequence: 65,
    });
    expect(summary?.eventIds).toHaveLength(64);
    expect(queue.items()).toEqual([summary]);
  });

  it('does not merge aggregate continuations with a different public source or target', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    offer(queue, graph, entry(1, { kind: 'use', outcome: { type: 'state', state: 'success' } }));
    for (let sequence = 2; sequence <= 63; sequence += 1) {
      offer(queue, graph, entry(sequence, { kind: 'summary', outcome: { type: 'none' } }));
    }
    const common = {
      parentEventId: 'session-a:1',
      source: publicTarget('Source A'),
      targets: [publicTarget('Target A')],
    };
    offer(queue, graph, entry(64, common));
    expect(offer(queue, graph, entry(65, common))).toEqual({ accepted: true, aggregated: true });

    expect(offer(queue, graph, entry(66, {
      ...common,
      source: publicTarget('Source B'),
    }))).toEqual({ accepted: false, reason: 'capacity' });
    expect(queue.items().at(-1)).toMatchObject({
      type: 'aggregate', count: 2, source: { label: 'Source A' }, targets: [{ label: 'Target A' }],
    });
  });

  it('requires a validated, ordered graph for every direct admission', () => {
    const queue = new PresentationQueue();
    queue.startSession('session-a');

    expect(() => queue.enqueue(entry(2), [entry(2)])).toThrow(/contiguous/i);
    expect(() => queue.enqueue(entry(2), [entry(1), entry(2, { parentEventId: 'session-a:9' })]))
      .toThrow(/missing/i);

    const graph = [entry(1), entry(2)];
    expect(() => queue.enqueue(graph[1], graph)).toThrow(/first|sequence|order/i);
    expect(queue.enqueue(graph[0], graph)).toEqual({ accepted: true, aggregated: false });
    expect(() => queue.enqueue(graph[0], graph)).toThrow(/duplicate|order/i);
  });

  it('suppresses all hidden-tab motion and restores one bounded redacted summary', () => {
    const queue = new PresentationQueue({ maxOutstanding: 2 });
    const graph: CausalLogEntryV1[] = [];
    const activeEpoch = queue.startSession('session-a');
    offer(queue, graph, entry(1));
    offer(queue, graph, entry(2, { kind: 'discard' }));

    queue.setHidden(true);
    expect(queue.completeCurrent(activeEpoch)).toBe(false);
    for (let sequence = 3; sequence <= 67; sequence += 1) {
      offer(queue, graph, entry(sequence, {
        kind: 'evidence',
        targets: [publicTarget('Secret-looking visible label')],
      }));
    }

    expect(queue.outstandingCount()).toBe(1);
    expect(queue.current()).toBeNull();
    const summary = queue.setHidden(false);

    expect(summary).toMatchObject({
      type: 'summary',
      sessionId: 'session-a',
      reason: 'hidden',
      count: 67,
      firstSequence: 1,
      lastSequence: 67,
      kinds: ['draw', 'discard', 'evidence'],
    });
    expect(summary?.eventIds).toHaveLength(64);
    expect(JSON.stringify(summary)).not.toContain('Secret-looking visible label');
    expect(queue.items()).toEqual([summary]);
  });

  it('skip and terminal consume hidden summaries and never resurrect skipped work', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    const oldEpoch = queue.startSession('session-a');
    queue.setHidden(true);
    offer(queue, graph, entry(1));
    offer(queue, graph, entry(2));

    const skipped = queue.skip();
    expect(skipped).toMatchObject({ reason: 'skip', count: 2 });
    expect(queue.completeCurrent(oldEpoch)).toBe(false);
    expect(queue.setHidden(false)).toBeNull();
    expect(queue.items()).toEqual([skipped]);

    const terminalEpoch = queue.startSession('session-b');
    const graphB: CausalLogEntryV1[] = [];
    queue.setHidden(true);
    offer(queue, graphB, entry(1, { sessionId: 'session-b', eventId: 'session-b:1' }));
    queue.beginTerminal(0);
    const terminal = queue.advanceTerminal(3_000);
    expect(terminal).toMatchObject({ reason: 'terminal', count: 1 });
    expect(queue.completeCurrent(terminalEpoch)).toBe(false);
  });

  it('invalidates stale work and rebuilds replay presentation from the seek position', () => {
    const queue = new PresentationQueue();
    const staleEpoch = queue.startSession('session-a');
    queue.enqueue(entry(1), [entry(1)]);
    const graph = [entry(1), entry(2, { parentEventId: 'session-a:1' }), entry(3)];

    const replayEpoch = queue.rebuildFrom('session-a', graph, 2);

    expect(replayEpoch).not.toBe(staleEpoch);
    expect(queue.items().map(itemSequence)).toEqual([2, 3]);
    expect(queue.completeCurrent(staleEpoch)).toBe(false);
  });

  it('collapses terminal work at three seconds and skips immediately', () => {
    const queue = new PresentationQueue({ terminalDrainMs: 3_000 });
    const graphA: CausalLogEntryV1[] = [];
    const terminalEpoch = queue.startSession('session-a');
    offer(queue, graphA, entry(1));
    offer(queue, graphA, entry(2));
    queue.beginTerminal(1_000);

    expect(queue.advanceTerminal(3_999)).toBeNull();
    const timed = queue.advanceTerminal(4_000);
    expect(timed).toMatchObject({ type: 'summary', reason: 'terminal', count: 2 });
    expect(queue.items()).toEqual([timed]);
    expect(queue.completeCurrent(terminalEpoch)).toBe(false);

    const graphB: CausalLogEntryV1[] = [];
    const skipEpoch = queue.startSession('session-b');
    offer(queue, graphB, entry(1, { sessionId: 'session-b', eventId: 'session-b:1' }));
    offer(queue, graphB, entry(2, { sessionId: 'session-b', eventId: 'session-b:2' }));
    const skipped = queue.skip();
    expect(skipped).toMatchObject({ type: 'summary', reason: 'skip', count: 2 });
    expect(queue.items()).toEqual([skipped]);
    expect(queue.completeCurrent(skipEpoch)).toBe(false);
  });

  it('returns defensive copies of mutable presentation data', () => {
    const queue = new PresentationQueue();
    const graph: CausalLogEntryV1[] = [];
    queue.startSession('session-a');
    offer(queue, graph, entry(1, { outcome: { type: 'summary', count: 1, kinds: ['draw'] } }));

    const first = queue.items();
    if (first[0]?.type !== 'event' || first[0].event.outcome.type !== 'summary') throw new Error('fixture');
    first[0].event.targets.push(publicTarget('mutated'));
    first[0].event.outcome.kinds.push('discard');

    expect(queue.items()).toEqual([expect.objectContaining({
      type: 'event',
      event: expect.objectContaining({ targets: [], outcome: { type: 'summary', count: 1, kinds: ['draw'] } }),
    })]);
  });
});

function offer(
  queue: PresentationQueue,
  graph: CausalLogEntryV1[],
  value: CausalLogEntryV1,
) {
  graph.push(value);
  return queue.enqueue(value, graph);
}

function itemSequence(item: ReturnType<PresentationQueue['items']>[number]): number {
  return item.type === 'event' ? item.event.sequence : -1;
}

function entry(sequence: number, patch: Partial<CausalLogEntryV1> = {}): CausalLogEntryV1 {
  const kind = patch.kind ?? 'draw';
  const outcome = patch.outcome ?? ({ type: 'count', amount: 1, unit: 'card' } satisfies CausalOutcome);
  const sessionId = patch.sessionId ?? 'session-a';
  const targets = patch.targets ?? [];
  return {
    schemaVersion: 1,
    eventId: `${sessionId}:${sequence}`,
    sessionId,
    sequence,
    ts: sequence,
    turn: 1,
    player: 'opp',
    actor: 'opp',
    action: `causal.${kind}`,
    kind: kind satisfies CausalEventKind,
    targets,
    ...(targets[0] ? { target: targets[0].label } : {}),
    outcome,
    ...(outcome.type === 'none' ? {} : { result: outcomeText(outcome) }),
    ...patch,
  };
}

function publicTarget(label: string) {
  return { visibility: 'public' as const, kind: 'card' as const, label };
}

function outcomeText(outcome: CausalOutcome): string {
  switch (outcome.type) {
    case 'none': return '';
    case 'count': return `${outcome.amount}:${outcome.unit}`;
    case 'move': return `${outcome.from}->${outcome.to}:${outcome.count}`;
    case 'state': return outcome.state;
    case 'summary': return `${outcome.count}:${outcome.kinds.join(',')}`;
  }
}
