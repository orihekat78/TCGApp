import type { CausalEventKind, CausalLogEntryV1, CausalOutcome, PublicCausalRef } from '@/engine/types';
import { traverseCausalLog } from '@/engine/log/causal';

export type PresentationEventItem = {
  type: 'event';
  event: CausalLogEntryV1;
};

export type PresentationAggregateItem = {
  type: 'aggregate';
  sessionId: string;
  causeEventId: string;
  kind: CausalEventKind;
  count: number;
  firstSequence: number;
  lastSequence: number;
  eventIds: string[];
  source?: PublicCausalRef;
  targets: PublicCausalRef[];
  outcome: CausalOutcome;
};

export type PresentationSummaryItem = {
  type: 'summary';
  sessionId: string;
  reason: 'hidden' | 'terminal' | 'skip';
  count: number;
  /** Exact canonical causal-log range retained even when eventIds is sampled. */
  firstSequence: number;
  lastSequence: number;
  /** Bounded trace sample. `count` remains authoritative when more than 64 events collapse. */
  eventIds: string[];
  kinds: CausalEventKind[];
};

export type PresentationItem = PresentationEventItem | PresentationAggregateItem | PresentationSummaryItem;

export type PresentationEnqueueResult =
  | { accepted: true; aggregated: boolean }
  | { accepted: false; reason: 'capacity' | 'session' };

export type PresentationQueueOptions = {
  maxOutstanding?: number;
  terminalDrainMs?: number;
};

const HARD_MAX_OUTSTANDING = 64;
const HARD_MAX_TERMINAL_DRAIN_MS = 3_000;
const MAX_TRACE_IDS = 64;
const COMPRESSIBLE_KINDS = new Set<CausalEventKind>([
  'draw', 'discard', 'zone-move', 'sleep', 'stun', 'value-change', 'evidence',
]);

export class PresentationQueue {
  readonly #maxOutstanding: number;
  readonly #terminalDrainMs: number;
  #epoch = 0;
  #sessionId: string | null = null;
  #items: PresentationItem[] = [];
  #hidden = false;
  #hiddenSummary: PresentationSummaryItem | null = null;
  #terminalDeadline: number | null = null;
  #lastAdmittedSequence: number | null = null;
  #revision = 0;
  readonly #listeners = new Set<() => void>();
  readonly #capacityListeners = new Set<() => void>();

  constructor(options: PresentationQueueOptions = {}) {
    this.#maxOutstanding = options.maxOutstanding ?? HARD_MAX_OUTSTANDING;
    this.#terminalDrainMs = options.terminalDrainMs ?? HARD_MAX_TERMINAL_DRAIN_MS;
    if (!Number.isSafeInteger(this.#maxOutstanding)
      || this.#maxOutstanding < 1
      || this.#maxOutstanding > HARD_MAX_OUTSTANDING) {
      throw new Error(`Presentation queue capacity must be between 1 and ${HARD_MAX_OUTSTANDING}`);
    }
    if (!Number.isFinite(this.#terminalDrainMs)
      || this.#terminalDrainMs < 0
      || this.#terminalDrainMs > HARD_MAX_TERMINAL_DRAIN_MS) {
      throw new Error(`Presentation terminal drain must be between 0 and ${HARD_MAX_TERMINAL_DRAIN_MS}ms`);
    }
  }

  startSession(sessionId: string): number {
    assertSessionId(sessionId);
    this.#epoch += 1;
    this.#sessionId = sessionId;
    this.#items = [];
    this.#hidden = false;
    this.#hiddenSummary = null;
    this.#terminalDeadline = null;
    this.#lastAdmittedSequence = null;
    this.#notify();
    return this.#epoch;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Dedicated backpressure signal. It never fires during enqueue. */
  onCapacityAvailable(listener: () => void): () => void {
    this.#capacityListeners.add(listener);
    return () => this.#capacityListeners.delete(listener);
  }

  revision(): number {
    return this.#revision;
  }

  currentEpoch(): number {
    return this.#epoch;
  }

  enqueue(
    event: CausalLogEntryV1,
    graph: readonly CausalLogEntryV1[],
  ): PresentationEnqueueResult {
    if (this.#sessionId === null || event.sessionId !== this.#sessionId) {
      return { accepted: false, reason: 'session' };
    }
    const ordered = traverseCausalLog(graph);
    const validated = ordered.find((candidate) => candidate.eventId === event.eventId);
    if (!validated || !sameEntry(validated, event)) {
      throw new Error(`Presentation event is not part of the validated graph: ${event.eventId}`);
    }
    if (this.#lastAdmittedSequence === null && validated.sequence !== 1) {
      throw new Error(`First presentation event must have sequence 1: ${event.eventId}`);
    }
    const result = this.#enqueueValidated(validated);
    if (result.accepted) this.#notify();
    return result;
  }

  current(): PresentationItem | null {
    return this.#items[0] ? cloneItem(this.#items[0]) : null;
  }

  completeCurrent(epoch: number): boolean {
    if (epoch !== this.#epoch || this.#items.length === 0) return false;
    const releasedCapacity = this.#items.length >= this.#maxOutstanding;
    this.#items.shift();
    this.#notify();
    if (releasedCapacity) this.#notifyCapacityAvailable();
    return true;
  }

  outstandingCount(): number {
    return this.#items.length + (this.#hiddenSummary ? 1 : 0);
  }

  items(): PresentationItem[] {
    return this.#items.map(cloneItem);
  }

  setHidden(hidden: boolean): PresentationSummaryItem | null {
    if (hidden === this.#hidden) return null;
    this.#hidden = hidden;
    if (hidden) {
      if (this.#items.length === 0) return null;
      const releasedCapacity = this.#items.length >= this.#maxOutstanding;
      const absorbed = summaryForItems(this.#requiredSession(), 'hidden', this.#items);
      this.#hiddenSummary = this.#hiddenSummary
        ? mergeSummaries(this.#hiddenSummary, absorbed, 'hidden')
        : absorbed;
      this.#items = [];
      this.#epoch += 1;
      this.#notify();
      if (releasedCapacity) this.#notifyCapacityAvailable();
      return cloneSummary(this.#hiddenSummary);
    }
    if (!this.#hiddenSummary) {
      this.#notify();
      return null;
    }
    const summary = this.#hiddenSummary;
    this.#hiddenSummary = null;
    if (this.#items.length >= this.#maxOutstanding) {
      throw new Error('Hidden presentation summary exceeds queue capacity');
    }
    this.#items.push(summary);
    this.#notify();
    return cloneSummary(summary);
  }

  rebuildFrom(sessionId: string, graph: readonly CausalLogEntryV1[], currentSequence: number): number {
    if (!Number.isSafeInteger(currentSequence) || currentSequence < 1) throw new Error('Invalid replay sequence');
    const ordered = traverseCausalLog(graph);
    if (ordered.some((entry) => entry.sessionId !== sessionId)) throw new Error('Replay graph session mismatch');
    const epoch = this.startSession(sessionId);
    for (const event of ordered) {
      if (event.sequence < currentSequence) continue;
      const result = this.#enqueueValidated(event);
      if (!result.accepted) throw new Error(`Replay presentation rebuild failed: ${result.reason}`);
    }
    return epoch;
  }

  beginTerminal(now: number): void {
    if (!Number.isFinite(now)) throw new Error('Invalid terminal clock');
    this.#terminalDeadline = now + this.#terminalDrainMs;
  }

  advanceTerminal(now: number): PresentationSummaryItem | null {
    if (this.#terminalDeadline === null || now < this.#terminalDeadline) return null;
    this.#terminalDeadline = null;
    const releasedCapacity = this.#items.length >= this.#maxOutstanding;
    const summary = this.#collapse('terminal');
    if (!summary) return null;
    this.#notify();
    if (releasedCapacity) this.#notifyCapacityAvailable();
    const current = this.#items[0];
    return current?.type === 'summary' ? cloneSummary(current) : summary;
  }

  skip(): PresentationSummaryItem | null {
    this.#terminalDeadline = null;
    const summary = this.#collapse('skip');
    if (summary) this.#notify();
    return summary;
  }

  #notify(): void {
    this.#revision += 1;
    for (const listener of this.#listeners) listener();
  }

  #notifyCapacityAvailable(): void {
    for (const listener of this.#capacityListeners) listener();
  }

  #enqueueValidated(event: CausalLogEntryV1): PresentationEnqueueResult {
    if (this.#sessionId === null || event.sessionId !== this.#sessionId) {
      return { accepted: false, reason: 'session' };
    }
    if (this.#lastAdmittedSequence !== null && event.sequence !== this.#lastAdmittedSequence + 1) {
      throw new Error(`Duplicate or out-of-order presentation event: ${event.eventId}`);
    }
    if (this.#hidden) {
      this.#hiddenSummary = addEventToSummary(this.#requiredSession(), this.#hiddenSummary, event);
      this.#lastAdmittedSequence = event.sequence;
      return { accepted: true, aggregated: true };
    }
    const current = this.#items[0];
    if (this.#items.length === 1 && current?.type === 'summary' && current.reason === 'terminal') {
      this.#items[0] = addEventToSummary(this.#requiredSession(), current, event);
      this.#lastAdmittedSequence = event.sequence;
      return { accepted: true, aggregated: true };
    }
    if (this.#items.length < this.#maxOutstanding) {
      this.#items.push({ type: 'event', event: cloneEvent(event) });
      this.#lastAdmittedSequence = event.sequence;
      return { accepted: true, aggregated: false };
    }
    if (this.#aggregateLast(event)) {
      this.#lastAdmittedSequence = event.sequence;
      return { accepted: true, aggregated: true };
    }
    return { accepted: false, reason: 'capacity' };
  }

  #aggregateLast(event: CausalLogEntryV1): boolean {
    if (!COMPRESSIBLE_KINDS.has(event.kind)) return false;
    const causeEventId = event.parentEventId ?? event.correlationEventId;
    if (!causeEventId) return false;
    const last = this.#items.at(-1);
    if (!last) return false;
    if (last.type === 'event') {
      if (!sameRepeat(last.event, event)) return false;
      this.#items[this.#items.length - 1] = {
        type: 'aggregate',
        sessionId: event.sessionId,
        causeEventId,
        kind: event.kind,
        count: 2,
        firstSequence: last.event.sequence,
        lastSequence: event.sequence,
        eventIds: [last.event.eventId, event.eventId],
        ...(event.source ? { source: { ...event.source } } : {}),
        targets: event.targets.map((target) => ({ ...target })),
        outcome: cloneOutcome(event.outcome),
      };
      return true;
    }
    if (last.type !== 'aggregate'
      || last.causeEventId !== causeEventId
      || last.kind !== event.kind
      || !sameRef(last.source, event.source)
      || !sameRefs(last.targets, event.targets)
      || !sameOutcome(last.outcome, event.outcome)) return false;
    this.#items[this.#items.length - 1] = {
      ...last,
      count: last.count + 1,
      lastSequence: event.sequence,
      eventIds: appendTraceId(last.eventIds, event.eventId),
      outcome: cloneOutcome(last.outcome),
    };
    return true;
  }

  #collapse(reason: 'terminal' | 'skip'): PresentationSummaryItem | null {
    const work = [...this.#items];
    if (this.#hiddenSummary) work.push(this.#hiddenSummary);
    if (work.length === 0) return null;
    const summary = summaryForItems(this.#requiredSession(), reason, work);
    this.#epoch += 1;
    this.#items = [summary];
    this.#hidden = false;
    this.#hiddenSummary = null;
    return cloneSummary(summary);
  }

  #requiredSession(): string {
    if (this.#sessionId === null) throw new Error('Presentation session is not initialized');
    return this.#sessionId;
  }
}

function addEventToSummary(
  sessionId: string,
  summary: PresentationSummaryItem | null,
  event: CausalLogEntryV1,
): PresentationSummaryItem {
  if (!summary) {
    return {
      type: 'summary', sessionId, reason: 'hidden', count: 1,
      firstSequence: event.sequence, lastSequence: event.sequence,
      eventIds: [event.eventId], kinds: [event.kind],
    };
  }
  return {
    ...summary,
    count: summary.count + 1,
    lastSequence: event.sequence,
    eventIds: appendTraceId(summary.eventIds, event.eventId),
    kinds: unique([...summary.kinds, event.kind]),
  };
}

function summaryForItems(
  sessionId: string,
  reason: PresentationSummaryItem['reason'],
  items: readonly PresentationItem[],
): PresentationSummaryItem {
  const eventIds: string[] = [];
  const kinds: CausalEventKind[] = [];
  let count = 0;
  let firstSequence = Number.POSITIVE_INFINITY;
  let lastSequence = 0;
  for (const item of items) {
    if (item.type === 'event') {
      count += 1;
      firstSequence = Math.min(firstSequence, item.event.sequence);
      lastSequence = Math.max(lastSequence, item.event.sequence);
      appendTraceIds(eventIds, [item.event.eventId]);
      kinds.push(item.event.kind);
    } else if (item.type === 'aggregate') {
      count += item.count;
      firstSequence = Math.min(firstSequence, item.firstSequence);
      lastSequence = Math.max(lastSequence, item.lastSequence);
      appendTraceIds(eventIds, item.eventIds);
      kinds.push(item.kind);
    } else {
      count += item.count;
      firstSequence = Math.min(firstSequence, item.firstSequence);
      lastSequence = Math.max(lastSequence, item.lastSequence);
      appendTraceIds(eventIds, item.eventIds);
      kinds.push(...item.kinds);
    }
  }
  return {
    type: 'summary', sessionId, reason, count,
    firstSequence, lastSequence, eventIds, kinds: unique(kinds),
  };
}

function mergeSummaries(
  left: PresentationSummaryItem,
  right: PresentationSummaryItem,
  reason: PresentationSummaryItem['reason'],
): PresentationSummaryItem {
  const eventIds = [...left.eventIds];
  appendTraceIds(eventIds, right.eventIds);
  return {
    type: 'summary', sessionId: left.sessionId, reason,
    count: left.count + right.count,
    firstSequence: Math.min(left.firstSequence, right.firstSequence),
    lastSequence: Math.max(left.lastSequence, right.lastSequence),
    eventIds,
    kinds: unique([...left.kinds, ...right.kinds]),
  };
}

function sameRepeat(left: CausalLogEntryV1, right: CausalLogEntryV1): boolean {
  return left.kind === right.kind
    && left.parentEventId === right.parentEventId
    && left.correlationEventId === right.correlationEventId
    && sameRef(left.source, right.source)
    && sameRefs(left.targets, right.targets)
    && sameStrings(left.tags, right.tags)
    && sameOutcome(left.outcome, right.outcome);
}

function sameEntry(left: CausalLogEntryV1, right: CausalLogEntryV1): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.eventId === right.eventId
    && left.sessionId === right.sessionId
    && left.sequence === right.sequence
    && left.ts === right.ts
    && left.player === right.player
    && left.actor === right.actor
    && left.turn === right.turn
    && left.action === right.action
    && left.target === right.target
    && left.result === right.result
    && left.kind === right.kind
    && sameStrings(left.tags, right.tags)
    && left.parentEventId === right.parentEventId
    && left.correlationEventId === right.correlationEventId
    && sameRef(left.source, right.source)
    && sameRefs(left.targets, right.targets)
    && sameOutcome(left.outcome, right.outcome);
}

function sameRefs(left: readonly PublicCausalRef[], right: readonly PublicCausalRef[]): boolean {
  return left.length === right.length && left.every((value, index) => sameRef(value, right[index]));
}

function sameStrings(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (!left || !right) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameRef(left: PublicCausalRef | undefined, right: PublicCausalRef | undefined): boolean {
  if (!left || !right) return left === right;
  return left.visibility === right.visibility
    && left.kind === right.kind
    && left.label === right.label
    && left.side === right.side
    && left.zone === right.zone
    && left.cardNumber === right.cardNumber;
}

function sameOutcome(left: CausalOutcome, right: CausalOutcome): boolean {
  if (left.type !== right.type) return false;
  switch (left.type) {
    case 'none': return true;
    case 'count': return right.type === 'count' && left.amount === right.amount && left.unit === right.unit;
    case 'move': return right.type === 'move'
      && left.from === right.from && left.to === right.to && left.count === right.count;
    case 'state': return right.type === 'state' && left.state === right.state;
    case 'case-status': return right.type === 'case-status'
      && left.from === right.from && left.to === right.to;
    case 'face-change': return right.type === 'face-change'
      && left.from === right.from && left.to === right.to && left.count === right.count;
    case 'summary': return right.type === 'summary'
      && left.count === right.count
      && left.kinds.length === right.kinds.length
      && left.kinds.every((kind, index) => kind === right.kinds[index]);
  }
}

function cloneItem(item: PresentationItem): PresentationItem {
  if (item.type === 'event') return { type: 'event', event: cloneEvent(item.event) };
  if (item.type === 'aggregate') {
    return {
      ...item,
      eventIds: [...item.eventIds],
      ...(item.source ? { source: { ...item.source } } : {}),
      targets: item.targets.map((target) => ({ ...target })),
      outcome: cloneOutcome(item.outcome),
    };
  }
  return cloneSummary(item);
}

function cloneSummary(summary: PresentationSummaryItem): PresentationSummaryItem {
  return { ...summary, eventIds: [...summary.eventIds], kinds: [...summary.kinds] };
}

function cloneEvent(event: CausalLogEntryV1): CausalLogEntryV1 {
  return {
    ...event,
    ...(event.tags ? { tags: [...event.tags] } : {}),
    ...(event.source ? { source: { ...event.source } } : {}),
    targets: event.targets.map((target) => ({ ...target })),
    outcome: cloneOutcome(event.outcome),
  };
}

function cloneOutcome(outcome: CausalOutcome): CausalOutcome {
  return outcome.type === 'summary' ? { ...outcome, kinds: [...outcome.kinds] } : { ...outcome };
}

function appendTraceId(ids: readonly string[], eventId: string): string[] {
  const next = [...ids];
  appendTraceIds(next, [eventId]);
  return next;
}

function appendTraceIds(target: string[], source: readonly string[]): void {
  const remaining = MAX_TRACE_IDS - target.length;
  if (remaining > 0) target.push(...source.slice(0, remaining));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function assertSessionId(value: string): void {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(value)) throw new Error('Invalid presentation session ID');
}
