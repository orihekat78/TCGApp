import type {
  CausalEventKind,
  CausalEventTag,
  CausalLogEntryV1,
  CausalOutcome,
  GameState,
  LegacyLogEntry,
  PublicCausalRef,
  PublicCausalZone,
} from '@/engine/types';
import { lookupCardDef } from '@/engine/target/card-def-registry.js';

export type PublicCausalLocator =
  | { kind: 'player'; side: 'self' | 'opp' }
  | { kind: 'zone'; side: 'self' | 'opp'; zone: PublicCausalZone }
  | { kind: 'scene-card'; side: 'self' | 'opp'; uid: string }
  | { kind: 'partner-card'; side: 'self' | 'opp' }
  | { kind: 'case-card'; side: 'self' | 'opp' }
  | { kind: 'set-card'; side: 'self' | 'opp'; hostUid: string; instanceId: string }
  | { kind: 'evidence-card'; side: 'self' | 'opp'; index: number }
  | { kind: 'file-card'; side: 'self' | 'opp'; index: number };

export type AppendCausalInput = {
  actor: 'self' | 'opp';
  kind: CausalEventKind;
  tags?: CausalEventTag[];
  parentEventId?: string;
  correlationEventId?: string;
  source?: PublicCausalLocator;
  targets: PublicCausalLocator[];
  outcome: CausalOutcome;
};

export type LegacyNormalizationContext = {
  sessionId: string;
  sequence: number;
};

export type { CausalEventTag } from '@/engine/types';

export type NormalizedLogNode = {
  id: string;
  order: number;
  origin: 'legacy' | 'causal';
  ts: number;
  actor: 'self' | 'opp';
  turn: number;
  kind: CausalEventKind;
  label: string;
  tags: CausalEventTag[];
  parentId?: string;
  correlationId?: string;
  source?: PublicCausalRef;
  targets: PublicCausalRef[];
  outcome: CausalOutcome;
};

export type NormalizedLogGraph = {
  sessionId: string;
  nodes: NormalizedLogNode[];
};

export type NormalizeGameLogOptions = {
  legacySessionId: string;
};

const EVENT_KINDS = new Set<CausalEventKind>([
  'use', 'declare', 'select', 'draw', 'discard', 'zone-move', 'enter', 'sleep', 'stun', 'activate', 'face-change',
  'value-change', 'evidence', 'case-status-change', 'case-resolve', 'negate', 'fizzle', 'cancel',
  'game-result', 'summary',
]);
const REF_KINDS = new Set(['player', 'card', 'zone', 'counter', 'rule']);
const ZONES = new Set<PublicCausalZone>(['deck', 'hand', 'scene', 'partner', 'case', 'file', 'evidence', 'remove', 'set-card']);
const SIDES = new Set(['self', 'opp']);
const EVENT_TAGS = new Set<CausalEventTag>(['contact', 'cutin', 'hirameki', 'misread', 'refresh']);
const REF_FIELDS = new Set(['visibility', 'kind', 'label', 'side', 'zone', 'cardNumber']);
const ENTRY_FIELDS = new Set([
  'schemaVersion', 'eventId', 'sessionId', 'sequence', 'ts', 'player', 'actor', 'turn',
  'action', 'target', 'targetAudience', 'result', 'kind', 'parentEventId',
  'correlationEventId', 'source', 'targets', 'outcome',
  'tags',
]);
const LEGACY_FIELDS = new Set([
  'schemaVersion', 'ts', 'player', 'turn', 'action', 'target', 'targetAudience', 'result',
]);
const APPEND_FIELDS = new Set([
  'actor', 'kind', 'parentEventId', 'correlationEventId', 'source', 'targets', 'outcome',
  'tags',
]);
const OUTCOME_STATES = new Set(['success', 'failed', 'cancelled', 'negated', 'fizzled', 'sleep', 'stun', 'active']);
const COUNT_UNITS = new Set(['card', 'evidence', 'lp', 'ap', 'level']);

export function startCausalSession(state: GameState, sessionId: string): void {
  assertSessionId(sessionId);
  if (state.causalLog !== undefined || state.log.some(hasSchemaVersion)) {
    throw new Error('Cannot replace an active causal session');
  }
  state.causalLog = { schemaVersion: 1, sessionId, nextSequence: 1 };
}

export function appendCausal(state: GameState, input: AppendCausalInput): CausalLogEntryV1 {
  assertAppendInput(input);
  const allocator = validateAllocatorForAppend(state);
  const existing = collectCausalEntries(state.log);
  if (existing.some((entry) => entry.kind === 'game-result')) {
    throw new Error('Cannot append a causal event after game-result');
  }
  const sequence = allocator.nextSequence;
  const eventId = `${allocator.sessionId}:${sequence}`;
  assertEdgeForAppend(existing, allocator.sessionId, input.parentEventId, eventId);
  assertEdgeForAppend(existing, allocator.sessionId, input.correlationEventId, eventId);

  const source = input.source === undefined ? undefined : projectPublicCausalRef(state, input.source);
  const targets = input.targets.map((locator) => projectPublicCausalRef(state, locator));
  const target = targets[0]?.label;
  const result = outcomeText(input.outcome);
  const entry: CausalLogEntryV1 = {
    schemaVersion: 1,
    eventId,
    sessionId: allocator.sessionId,
    sequence,
    ts: sequence,
    player: input.actor,
    actor: input.actor,
    turn: state.turn.number,
    action: actionFor(input.kind),
    ...(target ? { target } : {}),
    ...(result ? { result } : {}),
    kind: input.kind,
    ...(input.tags?.length ? { tags: [...input.tags] } : {}),
    ...(input.parentEventId ? { parentEventId: input.parentEventId } : {}),
    ...(input.correlationEventId ? { correlationEventId: input.correlationEventId } : {}),
    ...(source ? { source } : {}),
    targets,
    outcome: cloneOutcome(input.outcome),
  };
  assertCausalEntry(entry);
  state.log.push(entry);
  allocator.nextSequence = sequence + 1;
  return cloneCausalEntry(entry);
}

export function projectPublicCausalRef(state: GameState, locator: PublicCausalLocator): PublicCausalRef {
  assertLocator(locator);
  const player = state.players[locator.side];
  switch (locator.kind) {
    case 'player':
      return publicPlayer(locator.side);
    case 'zone':
      return {
        visibility: 'public',
        kind: 'zone',
        label: `${sideLabel(locator.side)}の${zoneLabel(locator.zone)}`,
        side: locator.side,
        zone: locator.zone,
      };
    case 'scene-card': {
      const card = player.scene.find((candidate) => candidate.uid === locator.uid);
      if (!card) throw new Error(`Missing or stale public scene locator: ${locator.uid}`);
      return publicCard(card.cardId, locator.side, 'scene');
    }
    case 'partner-card':
      if (!player.partner.cardId) throw new Error('Missing or stale public partner locator');
      if (player.partner.location === 'mr-removed') {
        throw new Error('Removed partner identity is not public');
      }
      return publicCard(
        player.partner.cardId,
        locator.side,
        player.partner.location === 'file-area' ? 'file' : 'partner',
      );
    case 'case-card':
      if (!player.case.cardId) throw new Error('Missing or stale public case locator');
      return publicCard(player.case.cardId, locator.side, 'case');
    case 'set-card': {
      const host = player.scene.find((candidate) => candidate.uid === locator.hostUid);
      const card = host?.setCards.find((candidate) => candidate.instanceId === locator.instanceId);
      if (!card) throw new Error(`Missing or stale public set-card locator: ${locator.instanceId}`);
      if (!card.faceUp) throw new Error('Hidden set-card identity is not public');
      return publicCard(card.cardId, locator.side, 'scene');
    }
    case 'evidence-card': {
      const card = player.evidence[locator.index];
      if (!card) throw new Error(`Missing or stale public evidence locator: ${locator.index}`);
      if (!card.faceUp) throw new Error('Hidden evidence identity is not public');
      return publicCard(card.cardId, locator.side, 'evidence');
    }
    case 'file-card': {
      const card = player.file[locator.index];
      if (!card) throw new Error(`Missing or stale public file locator: ${locator.index}`);
      if (card.type === 'card-back' && card.faceUp !== true) {
        throw new Error('Hidden file identity is not public');
      }
      return publicCard(card.cardId, locator.side, 'file');
    }
  }
}

export function normalizeLogEntry(entry: unknown, context: LegacyNormalizationContext): CausalLogEntryV1 {
  if (hasOwn(entry, 'schemaVersion') && (entry as Record<string, unknown>).schemaVersion !== undefined) {
    if ((entry as Record<string, unknown>).schemaVersion !== 1) {
      throw new Error('Unsupported causal schema version');
    }
    assertCausalEntry(entry);
    return cloneCausalEntry(entry);
  }
  assertLegacyEntry(entry);
  assertSessionId(context.sessionId);
  if (!Number.isSafeInteger(context.sequence) || context.sequence < 1) throw new Error('Invalid legacy sequence');
  const kind = legacyKind(entry.action, entry.result);
  const tags = tagsForAction(entry.action);
  return {
    schemaVersion: 1,
    eventId: `${context.sessionId}:${context.sequence}`,
    sessionId: context.sessionId,
    sequence: context.sequence,
    ts: entry.ts,
    player: entry.player,
    actor: entry.player,
    turn: entry.turn,
    action: actionFor(kind),
    kind,
    ...(tags.length ? { tags } : {}),
    targets: [],
    outcome: legacyOutcome(entry.action, entry.result),
  };
}

/**
 * Route an existing engine producer through the causal allocator while a live
 * causal session owns the match. Legacy target/result text is intentionally
 * not copied because those fields may contain hidden card identity.
 */
export function appendLegacyAsCausal(state: GameState, entry: LegacyLogEntry): CausalLogEntryV1 {
  assertLegacyEntry(entry);
  const kind = legacyKind(entry.action, entry.result);
  const tags = tagsForAction(entry.action);
  return appendCausal(state, {
    actor: entry.player,
    kind,
    ...(tags.length ? { tags } : {}),
    targets: [],
    outcome: legacyOutcome(entry.action, entry.result),
  });
}

export function normalizeGameLog(state: GameState, options: NormalizeGameLogOptions): NormalizedLogGraph {
  assertSessionId(options.legacySessionId);
  const causalEntries = collectCausalEntries(state.log);
  const orderedCausal = validateCausalLog(causalEntries);
  if (state.causalLog !== undefined) validateAllocatorState(state.causalLog, orderedCausal);
  const sessionId = orderedCausal[0]?.sessionId ?? options.legacySessionId;
  const nodes: NormalizedLogNode[] = [];
  const seenCausal = new Set<string>();
  let nextCausalSequence = 1;

  state.log.forEach((raw, index) => {
    const order = index + 1;
    if (isCausalLogEntry(raw)) {
      assertCausalEntry(raw);
      if (raw.sequence !== nextCausalSequence) throw new Error('Causal append order must match sequence');
      for (const edge of edges(raw)) {
        if (!seenCausal.has(edge)) throw new Error(`Causal edge does not precede consumer: ${edge}`);
      }
      nodes.push({
        id: raw.eventId,
        order,
        origin: 'causal',
        ts: raw.ts,
        actor: raw.actor,
        turn: raw.turn,
        kind: raw.kind,
        label: raw.action,
        tags: raw.tags ? [...raw.tags] : tagsForAction(raw.action),
        ...(raw.parentEventId ? { parentId: raw.parentEventId } : {}),
        ...(raw.correlationEventId ? { correlationId: raw.correlationEventId } : {}),
        ...(raw.source ? { source: cloneRef(raw.source) } : {}),
        targets: raw.targets.map(cloneRef),
        outcome: cloneOutcome(raw.outcome),
      });
      seenCausal.add(raw.eventId);
      nextCausalSequence += 1;
      return;
    }
    if (hasOwn(raw, 'schemaVersion') && (raw as unknown as Record<string, unknown>).schemaVersion !== undefined) {
      throw new Error('Unsupported causal schema version');
    }
    assertLegacyEntry(raw);
    nodes.push({
      id: `${options.legacySessionId}:legacy:${order}`,
      order,
      origin: 'legacy',
      ts: raw.ts,
      actor: raw.player,
      turn: raw.turn,
      kind: legacyKind(raw.action, raw.result),
      label: raw.action,
      tags: tagsForAction(raw.action),
      targets: [],
      outcome: legacyOutcome(raw.action, raw.result),
    });
  });

  return { sessionId, nodes };
}

export function validateCausalLog(entries: readonly CausalLogEntryV1[]): CausalLogEntryV1[] {
  const sorted = [...entries].sort((left, right) => left.sequence - right.sequence);
  if (sorted.length === 0) return sorted;
  const ids = new Map<string, CausalLogEntryV1>();
  assertCausalEntry(sorted[0]);
  const sessionId = sorted[0].sessionId;

  for (const entry of sorted) {
    assertCausalEntry(entry);
    if (entry.sessionId !== sessionId) throw new Error('Cross-session causal graph');
    if (ids.has(entry.eventId)) throw new Error(`Duplicate causal event ID: ${entry.eventId}`);
    ids.set(entry.eventId, entry);
  }
  sorted.forEach((entry, index) => {
    if (entry.sequence !== index + 1) throw new Error('Causal sequence must be contiguous');
  });

  detectCycles(sorted, ids);
  for (const entry of sorted) {
    for (const edge of edges(entry)) {
      if (!edge.startsWith(`${entry.sessionId}:`)) throw new Error(`Cross-session causal edge: ${edge}`);
      const parent = ids.get(edge);
      if (!parent) throw new Error(`Missing causal edge: ${edge}`);
      if (parent.sessionId !== entry.sessionId) throw new Error(`Cross-session causal edge: ${edge}`);
      if (parent.sequence >= entry.sequence) throw new Error(`Forward causal edge: ${edge}`);
    }
  }
  return sorted;
}

/** Validate the causal graph together with its GameState-owned append allocator. */
export function validateGameCausalState(state: GameState): CausalLogEntryV1[] {
  const causalEntries = collectCausalEntries(state.log);
  const ordered = validateCausalLog(causalEntries);
  if (causalEntries.length > 0 && state.causalLog === undefined) {
    throw new Error('Causal log entries require a state-owned allocator');
  }
  if (state.causalLog !== undefined) validateAllocatorState(state.causalLog, ordered);

  let expectedSequence = 1;
  for (const entry of state.log) {
    if (!isCausalLogEntry(entry)) continue;
    if (entry.sequence !== expectedSequence) {
      throw new Error('Causal append order must match sequence');
    }
    expectedSequence += 1;
  }
  return ordered;
}

export function traverseCausalLog(entries: readonly CausalLogEntryV1[]): CausalLogEntryV1[] {
  return validateCausalLog(entries);
}

export function isCausalLogEntry(entry: unknown): entry is CausalLogEntryV1 {
  return isRecord(entry) && entry.schemaVersion === 1;
}

function validateAllocatorForAppend(state: GameState): NonNullable<GameState['causalLog']> {
  const allocator = state.causalLog;
  if (!allocator) throw new Error('Causal session is not initialized');
  const causalEntries = collectCausalEntries(state.log);
  validateAllocatorState(allocator, validateCausalLog(causalEntries));
  return allocator;
}

function validateAllocatorState(
  allocator: NonNullable<GameState['causalLog']>,
  ordered: readonly CausalLogEntryV1[],
): void {
  if (!isRecord(allocator) || allocator.schemaVersion !== 1) throw new Error('Unsupported causal allocator version');
  assertSessionId(allocator.sessionId);
  if (!Number.isSafeInteger(allocator.nextSequence) || allocator.nextSequence < 1) {
    throw new Error('Invalid causal sequence allocator');
  }
  if (ordered.some((entry) => entry.sessionId !== allocator.sessionId)) {
    throw new Error('Causal allocator session mismatch');
  }
  const expected = (ordered.at(-1)?.sequence ?? 0) + 1;
  if (allocator.nextSequence !== expected) {
    throw new Error(`Causal sequence allocator mismatch: expected ${expected}`);
  }
}

function collectCausalEntries(entries: readonly unknown[]): CausalLogEntryV1[] {
  const causal: CausalLogEntryV1[] = [];
  for (const entry of entries) {
    if (hasOwn(entry, 'schemaVersion') && (entry as Record<string, unknown>).schemaVersion !== undefined) {
      if ((entry as Record<string, unknown>).schemaVersion !== 1) {
        throw new Error('Unsupported causal schema version');
      }
      assertCausalEntry(entry);
      causal.push(entry);
    }
  }
  return causal;
}

function assertAppendInput(value: unknown): asserts value is AppendCausalInput {
  if (!isRecord(value)) throw new Error('Causal append input must be an object');
  assertAllowedFields(value, APPEND_FIELDS, 'causal append');
  assertActor(value.actor);
  assertKind(value.kind);
  if (value.tags !== undefined) assertTags(value.tags);
  if (value.parentEventId !== undefined && typeof value.parentEventId !== 'string') throw new Error('Invalid causal edge');
  if (value.correlationEventId !== undefined && typeof value.correlationEventId !== 'string') throw new Error('Invalid causal edge');
  if (value.source !== undefined) assertLocator(value.source);
  if (!Array.isArray(value.targets)) throw new Error('Causal targets must be an array');
  value.targets.forEach(assertLocator);
  assertOutcome(value.outcome);
  assertKindOutcome(value.kind, value.outcome);
}

function assertCausalEntry(value: unknown): asserts value is CausalLogEntryV1 {
  if (!isRecord(value)) throw new Error('Causal entry must be an object');
  assertAllowedFields(value, ENTRY_FIELDS, 'causal entry');
  if (value.schemaVersion !== 1) throw new Error('Unsupported causal schema version');
  assertSessionId(value.sessionId);
  if (!Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1) throw new Error('Invalid causal sequence');
  if (value.eventId !== `${value.sessionId}:${value.sequence}`) throw new Error('Invalid causal event ID');
  if (!Number.isSafeInteger(value.ts) || Number(value.ts) < 0) throw new Error('Invalid causal timestamp');
  if (!Number.isSafeInteger(value.turn) || Number(value.turn) < 0) throw new Error('Invalid causal turn');
  assertActor(value.actor);
  if (value.player !== value.actor) throw new Error('Causal actor/player mismatch');
  assertKind(value.kind);
  if (value.tags !== undefined) assertTags(value.tags);
  if (value.action !== actionFor(value.kind)) throw new Error('Invalid causal compatibility action');
  if (value.targetAudience !== undefined) throw new Error('Causal target cannot be private');
  if (value.parentEventId !== undefined && typeof value.parentEventId !== 'string') throw new Error('Invalid causal edge');
  if (value.correlationEventId !== undefined && typeof value.correlationEventId !== 'string') throw new Error('Invalid causal edge');
  if (value.source !== undefined) assertPublicRef(value.source);
  if (!Array.isArray(value.targets)) throw new Error('Causal targets must be an array');
  value.targets.forEach(assertPublicRef);
  assertOutcome(value.outcome);
  assertKindOutcome(value.kind, value.outcome);
  if (value.target !== value.targets[0]?.label) throw new Error('Invalid causal compatibility target');
  if (value.result !== outcomeText(value.outcome)) throw new Error('Invalid causal compatibility result');
}

function assertLegacyEntry(value: unknown): asserts value is LegacyLogEntry {
  if (!isRecord(value)) throw new Error('Legacy log entry must be an object');
  assertAllowedFields(value, LEGACY_FIELDS, 'legacy log entry');
  if (value.schemaVersion !== undefined) throw new Error('Unsupported causal schema version');
  if (!Number.isSafeInteger(value.ts) || Number(value.ts) < 0) throw new Error('Invalid legacy timestamp');
  if (!Number.isSafeInteger(value.turn) || Number(value.turn) < 0) throw new Error('Invalid legacy turn');
  assertActor(value.player);
  assertBoundedString(value.action, 'legacy action', 500);
  if (value.target !== undefined) assertBoundedString(value.target, 'legacy target', 1_000);
  if (value.result !== undefined) assertBoundedString(value.result, 'legacy result', 2_000);
  if (value.targetAudience !== undefined && !SIDES.has(String(value.targetAudience))) {
    throw new Error('Invalid legacy target audience');
  }
}

function assertLocator(value: unknown): asserts value is PublicCausalLocator {
  if (!isRecord(value) || typeof value.kind !== 'string') throw new Error('Invalid public causal locator');
  switch (value.kind) {
    case 'player':
      assertAllowedFields(value, new Set(['kind', 'side']), 'public causal locator');
      assertSide(value.side);
      return;
    case 'zone':
      assertAllowedFields(value, new Set(['kind', 'side', 'zone']), 'public causal locator');
      assertSide(value.side);
      if (!ZONES.has(value.zone as PublicCausalZone)) throw new Error('Invalid public causal locator zone');
      return;
    case 'scene-card':
      assertAllowedFields(value, new Set(['kind', 'side', 'uid']), 'public causal locator');
      assertSide(value.side);
      assertIdentifier(value.uid, 'scene UID');
      return;
    case 'partner-card':
    case 'case-card':
      assertAllowedFields(value, new Set(['kind', 'side']), 'public causal locator');
      assertSide(value.side);
      return;
    case 'set-card':
      assertAllowedFields(value, new Set(['kind', 'side', 'hostUid', 'instanceId']), 'public causal locator');
      assertSide(value.side);
      assertIdentifier(value.hostUid, 'set-card host UID');
      assertIdentifier(value.instanceId, 'set-card instance ID');
      return;
    case 'evidence-card':
    case 'file-card':
      assertAllowedFields(value, new Set(['kind', 'side', 'index']), 'public causal locator');
      assertSide(value.side);
      if (!Number.isSafeInteger(value.index) || Number(value.index) < 0) throw new Error('Invalid public causal locator index');
      return;
    default:
      throw new Error(`Invalid public causal locator kind: ${value.kind}`);
  }
}

function assertPublicRef(value: unknown): asserts value is PublicCausalRef {
  if (!isRecord(value)) throw new Error('Public causal reference must be an object');
  assertAllowedFields(value, REF_FIELDS, 'public causal reference');
  if (value.visibility !== 'public') throw new Error('Causal references must be public');
  if (!REF_KINDS.has(String(value.kind))) throw new Error('Invalid public causal reference kind');
  assertBoundedString(value.label, 'public causal label', 120);
  if (value.side !== undefined) assertSide(value.side);
  if (value.zone !== undefined && !ZONES.has(value.zone as PublicCausalZone)) throw new Error('Invalid public causal zone');
  if (value.cardNumber !== undefined
    && (typeof value.cardNumber !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(value.cardNumber))) {
    throw new Error('Invalid public card number');
  }
  if (value.kind === 'card' && (value.zone === 'hand' || value.zone === 'deck' || value.zone === 'set-card')) {
    throw new Error('Hidden-zone card identity is not public');
  }
}

function assertOutcome(value: unknown): asserts value is CausalOutcome {
  if (!isRecord(value) || typeof value.type !== 'string') throw new Error('Invalid causal outcome');
  switch (value.type) {
    case 'none':
      assertAllowedFields(value, new Set(['type']), 'causal outcome');
      return;
    case 'count':
      assertAllowedFields(value, new Set(['type', 'amount', 'unit']), 'causal outcome');
      if (!Number.isSafeInteger(value.amount) || !COUNT_UNITS.has(String(value.unit))) throw new Error('Invalid count outcome');
      return;
    case 'move':
      assertAllowedFields(value, new Set(['type', 'from', 'to', 'count']), 'causal outcome');
      if (!ZONES.has(value.from as PublicCausalZone) || !ZONES.has(value.to as PublicCausalZone)
        || !Number.isSafeInteger(value.count) || Number(value.count) < 1) {
        throw new Error('Invalid move outcome');
      }
      return;
    case 'state':
      assertAllowedFields(value, new Set(['type', 'state']), 'causal outcome');
      if (!OUTCOME_STATES.has(String(value.state))) throw new Error('Invalid state outcome');
      return;
    case 'case-status':
      assertAllowedFields(value, new Set(['type', 'from', 'to']), 'causal outcome');
      if (value.from !== 'incident' || value.to !== 'resolved') {
        throw new Error('Invalid case-status outcome');
      }
      return;
    case 'face-change':
      assertAllowedFields(value, new Set(['type', 'from', 'to', 'count']), 'causal outcome');
      if ((value.from !== 'face-down' && value.from !== 'face-up')
        || (value.to !== 'face-down' && value.to !== 'face-up')
        || value.from === value.to
        || !Number.isSafeInteger(value.count)
        || Number(value.count) < 1) {
        throw new Error('Invalid face-change outcome');
      }
      return;
    case 'summary':
      assertAllowedFields(value, new Set(['type', 'count', 'kinds']), 'causal outcome');
      if (!Number.isSafeInteger(value.count) || Number(value.count) < 1 || !Array.isArray(value.kinds)) {
        throw new Error('Invalid summary outcome');
      }
      value.kinds.forEach(assertKind);
      return;
    default:
      throw new Error('Unknown causal outcome');
  }
}

function assertKindOutcome(kind: CausalEventKind, outcome: CausalOutcome): void {
  if (kind === 'face-change' && outcome.type !== 'face-change') {
    throw new Error('Causal kind/outcome mismatch for face-change');
  }
  if (kind === 'activate' && (outcome.type !== 'state' || outcome.state !== 'active')) {
    throw new Error('Causal kind/outcome mismatch for activate');
  }
}

function assertEdgeForAppend(
  existing: readonly CausalLogEntryV1[],
  sessionId: string,
  edge: string | undefined,
  eventId: string,
): void {
  if (edge === undefined) return;
  if (edge === eventId) throw new Error('Causal event cannot reference itself');
  if (!edge.startsWith(`${sessionId}:`)) throw new Error('Cross-session causal edge');
  if (!existing.some((entry) => entry.eventId === edge)) throw new Error(`Missing causal edge: ${edge}`);
}

function detectCycles(entries: readonly CausalLogEntryV1[], ids: ReadonlyMap<string, CausalLogEntryV1>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: CausalLogEntryV1): void => {
    if (visiting.has(entry.eventId)) throw new Error(`Causal graph cycle at ${entry.eventId}`);
    if (visited.has(entry.eventId)) return;
    visiting.add(entry.eventId);
    for (const edge of edges(entry)) {
      const parent = ids.get(edge);
      if (parent) visit(parent);
    }
    visiting.delete(entry.eventId);
    visited.add(entry.eventId);
  };
  entries.forEach(visit);
}

function edges(entry: CausalLogEntryV1): string[] {
  return [entry.parentEventId, entry.correlationEventId].filter((value): value is string => value !== undefined);
}

function legacyKind(action: string, result?: string): CausalEventKind {
  const normalized = action.toLowerCase();
  const normalizedResult = result?.toLowerCase() ?? '';
  if (normalizedResult.includes('optional-skip') || normalizedResult.includes('declined')) return 'cancel';
  if (normalizedResult.includes('gate-skip') || normalizedResult.includes('gate-fail')
    || normalizedResult.includes('stale-selection') || normalizedResult.includes('not-found')) return 'fizzle';
  if (normalized.includes('draw')) return 'draw';
  if (normalized.includes('discard')) return 'discard';
  if (normalized.includes('sleep')) return 'sleep';
  if (normalized.includes('stun')) return 'stun';
  if (normalized.includes('evidence')) return 'evidence';
  if (normalized.includes('action-case-gain')) return 'evidence';
  if (normalized.includes('casetoresolved')) return 'case-status-change';
  if (normalized.includes('case') && normalized.includes('resolve')) return 'case-resolve';
  if (normalized.includes('negate')) return 'negate';
  if (normalized.includes('fizzle')) return 'fizzle';
  if (normalized.includes('cancel')) return 'cancel';
  if (normalized.startsWith('contact-')) return 'declare';
  if (normalized === 'reasoning' || normalized === 'nexthint' || normalized === 'partnerability') return 'declare';
  if (normalized.includes('declare')) return 'declare';
  if (normalized.includes('select')) return 'select';
  if (normalized === 'refresh' || normalized.includes('move') || normalized.includes('tohand')
    || normalized.includes('todeck') || normalized.includes('tofile')
    || normalized.includes('topartner') || normalized.includes('partnerarearemove')) return 'zone-move';
  if (normalized.includes('use')) return 'use';
  return 'summary';
}

function tagsForAction(action: string): CausalEventTag[] {
  const normalized = action.toLowerCase();
  const tags: CausalEventTag[] = [];
  if (normalized.startsWith('contact-')) tags.push('contact');
  if (normalized === 'contact-cutin') tags.push('cutin');
  if (normalized.includes('hirameki') || action.includes('ヒラメキ')) tags.push('hirameki');
  if (normalized.includes('misread') || action.includes('読み違い')) tags.push('misread');
  if (normalized === 'refresh') tags.push('refresh');
  return tags;
}

function legacyOutcome(action: string, result: string | undefined): CausalOutcome {
  if (action.toLowerCase() !== 'contact-judge' || result === undefined) return { type: 'none' };
  if (/\bHIT\b/i.test(result)) return { type: 'state', state: 'success' };
  if (/\bMISS\b/i.test(result)) return { type: 'state', state: 'failed' };
  return { type: 'none' };
}

function assertTags(value: unknown): asserts value is CausalEventTag[] {
  if (!Array.isArray(value) || value.length > EVENT_TAGS.size) throw new Error('Invalid causal tags');
  const seen = new Set<CausalEventTag>();
  for (const tag of value) {
    if (!EVENT_TAGS.has(tag as CausalEventTag) || seen.has(tag as CausalEventTag)) {
      throw new Error('Invalid causal tags');
    }
    seen.add(tag as CausalEventTag);
  }
}

function actionFor(kind: CausalEventKind): string {
  return `causal.${kind}`;
}

function outcomeText(outcome: CausalOutcome): string | undefined {
  switch (outcome.type) {
    case 'none': return undefined;
    case 'count': return `${outcome.amount}:${outcome.unit}`;
    case 'move': return `${outcome.from}->${outcome.to}:${outcome.count}`;
    case 'state': return outcome.state;
    case 'case-status': return `${outcome.from}->${outcome.to}`;
    case 'face-change': return `${outcome.from}->${outcome.to}:${outcome.count}`;
    case 'summary': return `${outcome.count}:${outcome.kinds.join(',')}`;
  }
}

function publicPlayer(side: 'self' | 'opp'): PublicCausalRef {
  return { visibility: 'public', kind: 'player', label: sideLabel(side), side };
}

function publicCard(cardId: string, side: 'self' | 'opp', zone: PublicCausalZone): PublicCausalRef {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(cardId)) throw new Error('Public card number is invalid');
  const label = lookupCardDef(cardId)?.names[0] ?? cardId;
  const ref: PublicCausalRef = {
    visibility: 'public', kind: 'card', label, side, zone, cardNumber: cardId,
  };
  assertPublicRef(ref);
  return ref;
}

function sideLabel(side: 'self' | 'opp'): string {
  return side === 'self' ? '自分' : '相手';
}

function zoneLabel(zone: PublicCausalZone): string {
  const labels: Record<PublicCausalZone, string> = {
    'set-card': 'set-card',
    deck: 'デッキ', hand: '手札', scene: '現場', partner: 'パートナー', case: '事件',
    file: 'FILE', evidence: '証拠', remove: 'リムーブ',
  };
  return labels[zone];
}

function cloneCausalEntry(entry: CausalLogEntryV1): CausalLogEntryV1 {
  return {
    ...entry,
    ...(entry.tags ? { tags: [...entry.tags] } : {}),
    ...(entry.source ? { source: cloneRef(entry.source) } : {}),
    targets: entry.targets.map(cloneRef),
    outcome: cloneOutcome(entry.outcome),
  };
}

function cloneRef(ref: PublicCausalRef): PublicCausalRef {
  return { ...ref };
}

function cloneOutcome(outcome: CausalOutcome): CausalOutcome {
  return outcome.type === 'summary' ? { ...outcome, kinds: [...outcome.kinds] } : { ...outcome };
}

function assertSessionId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(value)) {
    throw new Error('Invalid causal session ID');
  }
}

function assertActor(value: unknown): asserts value is 'self' | 'opp' {
  if (!SIDES.has(String(value))) throw new Error('Invalid causal actor');
}

function assertSide(value: unknown): asserts value is 'self' | 'opp' {
  if (!SIDES.has(String(value))) throw new Error('Invalid public causal locator side');
}

function assertKind(value: unknown): asserts value is CausalEventKind {
  if (!EVENT_KINDS.has(value as CausalEventKind)) throw new Error('Invalid causal event kind');
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 160) throw new Error(`Invalid ${label}`);
}

function assertBoundedString(value: unknown, label: string, max: number): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) throw new Error(`Invalid ${label}`);
}

function assertAllowedFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`Unknown ${label} field: ${field}`);
  }
}

function hasSchemaVersion(value: unknown): boolean {
  return hasOwn(value, 'schemaVersion') && (value as Record<string, unknown>).schemaVersion !== undefined;
}

function hasOwn(value: unknown, field: string): value is Record<string, unknown> {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
