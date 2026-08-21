import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import type { CausalLogEntryV1, GameState } from '../types/game-state.js';
import type {
  MisreadCandidate,
  MisreadDecision,
  PendingMisreadAuthority,
} from '../types/misread.js';

function extractMisreadX(ability: unknown): number | null {
  if (!ability || typeof ability !== 'object') return null;
  const candidate = ability as { type?: string; effect?: { args?: { x?: number } } };
  if (candidate.type !== 'icon-misread') return null;
  const x = candidate.effect?.args?.x;
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export function collectMisreadCandidates(
  state: GameState,
  player: 'self' | 'opp',
): MisreadCandidate[] {
  const candidates: MisreadCandidate[] = [];
  for (const character of state.players[player].scene) {
    if (character.state !== 'active') continue;
    if (readChar.originalAbilitiesDisabled(state, character.uid)) continue;
    const card = readDef.card(character.cardId);
    if (!card) continue;
    let x: number | null = null;
    for (const ability of card.abilities) {
      const abilityX = extractMisreadX(ability);
      if (abilityX === null) continue;
      if (x !== null) {
        throw new Error(`Invalid pendingMisread: duplicate Misread icon uid=${character.uid}`);
      }
      x = abilityX;
    }
    if (x !== null) candidates.push({ uid: character.uid, x });
  }
  return candidates;
}

function findReasoner(
  state: GameState,
  uid: string,
): { cardId: string; player: 'self' | 'opp'; state: 'active' | 'sleep' | 'stun' } | null {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const player = uid === 'partner:self' ? 'self' : 'opp';
    const partner = state.players[player].partner;
    return { cardId: partner.cardId, player, state: partner.state };
  }
  for (const player of ['self', 'opp'] as const) {
    const character = state.players[player].scene.find((entry) => entry.uid === uid);
    if (character) return { cardId: character.cardId, player, state: character.state };
  }
  return null;
}

function sameCandidates(
  left: ReadonlyArray<MisreadCandidate>,
  right: ReadonlyArray<MisreadCandidate>,
): boolean {
  return left.length === right.length
    && left.every((candidate, index) => (
      candidate.uid === right[index]?.uid && candidate.x === right[index]?.x
    ));
}

function sameTrace(
  left: PendingMisreadAuthority['causalTrace'],
  right: PendingMisreadAuthority['causalTrace'],
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.rootEventId === right.rootEventId
    && left.tailEventId === right.tailEventId
    && left.awaitingResume === right.awaitingResume
    && left.completed === right.completed;
}

function sameContinuationEntryTrace(
  left: PendingMisreadAuthority['causalTrace'],
  right: PendingMisreadAuthority['causalTrace'],
): boolean {
  if (left === undefined || right === undefined) return left === right;
  // The stack entry snapshots the trace before the human pause marks its live
  // branch awaitingResume. Its immutable event anchors must still agree.
  return left.rootEventId === right.rootEventId
    && left.tailEventId === right.tailEventId;
}

type LiveMisreadLease = {
  authority: PendingMisreadAuthority;
  semanticStateAnchor?: string;
  sessionId?: string;
  runtimeToken?: number;
  runtimeOwner?: object;
};

export type LiveMisreadLeaseCheckpoint = {
  epoch: number;
  lease: LiveMisreadLease | null;
};

let liveMisreadLease: LiveMisreadLease | null = null;
let liveMisreadLeaseEpoch = 0;

type SemanticStateNode =
  | ['null']
  | ['undefined']
  | ['boolean', boolean]
  | ['string', string]
  | ['number', number | 'NaN' | '+Infinity' | '-Infinity' | '-0']
  | ['reference', number]
  | [
      'array',
      number,
      number,
      Array<[number, SemanticStateNode]>,
      Array<[string, SemanticStateNode]>,
    ]
  | ['object' | 'null-object', number, Array<[string, SemanticStateNode]>];

type SemanticStateContext = {
  active: WeakSet<object>;
  ids: WeakMap<object, number>;
  nextId: number;
};

function readOwnDataValue(value: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) {
    throw new Error(`Invalid pendingMisread: accessor GameState value at ${path}`);
  }
  if (!descriptor.enumerable) {
    throw new Error(`Invalid pendingMisread: non-enumerable GameState value at ${path}`);
  }
  return descriptor.value;
}

function isArrayIndexKey(key: string): boolean {
  const index = Number(key);
  return Number.isInteger(index)
    && index >= 0
    && index < 0xffff_ffff
    && String(index) === key;
}

function encodeSemanticStateValue(
  value: unknown,
  path: string,
  context: SemanticStateContext,
): SemanticStateNode {
  if (value === null) return ['null'];
  if (value === undefined) return ['undefined'];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return ['number', 'NaN'];
    if (value === Number.POSITIVE_INFINITY) return ['number', '+Infinity'];
    if (value === Number.NEGATIVE_INFINITY) return ['number', '-Infinity'];
    if (Object.is(value, -0)) return ['number', '-0'];
    return ['number', value];
  }
  if (typeof value !== 'object') {
    throw new Error(`Invalid pendingMisread: unsupported GameState value at ${path}`);
  }
  if (context.active.has(value)) {
    throw new Error(`Invalid pendingMisread: cyclic GameState value at ${path}`);
  }
  const existingId = context.ids.get(value);
  if (existingId !== undefined) return ['reference', existingId];
  const objectId = context.nextId;
  context.nextId += 1;
  context.ids.set(value, objectId);
  context.active.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`Invalid pendingMisread: symbol-keyed GameState value at ${path}`);
    }
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new Error(`Invalid pendingMisread: non-plain GameState array at ${path}`);
      }
      const indexed: Array<[number, SemanticStateNode]> = [];
      const extra: Array<[string, SemanticStateNode]> = [];
      for (const key of Object.getOwnPropertyNames(value).sort()) {
        if (key === 'length') continue;
        const encoded = encodeSemanticStateValue(
          readOwnDataValue(value, key, `${path}.${key}`),
          `${path}.${key}`,
          context,
        );
        if (isArrayIndexKey(key)) indexed.push([Number(key), encoded]);
        else extra.push([key, encoded]);
      }
      indexed.sort(([left], [right]) => left - right);
      return ['array', objectId, value.length, indexed, extra];
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Invalid pendingMisread: non-plain GameState value at ${path}`);
    }
    const entries = Object.getOwnPropertyNames(value)
      .sort()
      .map((key): [string, SemanticStateNode] => [
        key,
        encodeSemanticStateValue(
          readOwnDataValue(value, key, `${path}.${key}`),
          `${path}.${key}`,
          context,
        ),
      ]);
    return [prototype === null ? 'null-object' : 'object', objectId, entries];
  } finally {
    context.active.delete(value);
  }
}

function captureSemanticStateAnchor(state: GameState): string {
  return JSON.stringify(encodeSemanticStateValue(state, '$', {
    active: new WeakSet<object>(),
    ids: new WeakMap<object, number>(),
    nextId: 1,
  }));
}

function cloneLiveMisreadLease(lease: LiveMisreadLease | null): LiveMisreadLease | null {
  return lease === null
    ? null
    : {
        authority: clonePendingMisreadAuthority(lease.authority),
        ...(lease.semanticStateAnchor !== undefined
          ? { semanticStateAnchor: lease.semanticStateAnchor }
          : {}),
        ...(lease.sessionId !== undefined ? { sessionId: lease.sessionId } : {}),
        ...(lease.runtimeToken !== undefined ? { runtimeToken: lease.runtimeToken } : {}),
        ...(lease.runtimeOwner !== undefined ? { runtimeOwner: lease.runtimeOwner } : {}),
      };
}

function assertLeaseMatchesAuthority(
  state: GameState,
  pending: PendingMisreadAuthority,
  lease: LiveMisreadLease | null,
): asserts lease is LiveMisreadLease {
  if (lease === null
    || !matchesPendingMisreadAuthority(lease.authority, pending)
    || lease.sessionId !== state.causalLog?.sessionId) {
    throw new Error('Invalid pendingMisread: live resume lease required');
  }
}

/** Minted only by the live reasoning pause. Never serialized into GameState. */
export function mintLiveMisreadLease(
  state: GameState,
  pending: PendingMisreadAuthority,
): void {
  if (liveMisreadLease !== null) {
    throw new Error('Invalid pendingMisread: unresolved live resume lease already exists');
  }
  liveMisreadLease = {
    authority: clonePendingMisreadAuthority(pending),
    ...(state.causalLog ? { sessionId: state.causalLog.sessionId } : {}),
  };
}

/** Bind the live lease to the exact persisted projection created at the pause. */
export function bindLiveMisreadLeaseRuntime(
  state: GameState,
  pending: PendingMisreadAuthority,
  runtimeToken: number,
  runtimeOwner: object,
): void {
  assertLeaseMatchesAuthority(state, pending, liveMisreadLease);
  const semanticStateAnchor = captureSemanticStateAnchor(state);
  if ((liveMisreadLease.runtimeToken !== undefined
      && liveMisreadLease.runtimeToken !== runtimeToken)
    || (liveMisreadLease.semanticStateAnchor !== undefined
      && liveMisreadLease.semanticStateAnchor !== semanticStateAnchor)) {
    throw new Error('Invalid pendingMisread: live resume lease cannot be rebound');
  }
  liveMisreadLease.semanticStateAnchor = semanticStateAnchor;
  liveMisreadLease.runtimeToken = runtimeToken;
  liveMisreadLease.runtimeOwner = runtimeOwner;
}

/** Reject JSON clones and cross-session restores even when every public field agrees. */
export function assertLiveMisreadLease(
  state: GameState,
  pending: PendingMisreadAuthority,
  runtimeToken: number,
  runtimeOwner: object,
): void {
  assertLeaseMatchesAuthority(state, pending, liveMisreadLease);
  if (liveMisreadLease.semanticStateAnchor !== captureSemanticStateAnchor(state)
    || liveMisreadLease.runtimeToken !== runtimeToken
    || liveMisreadLease.runtimeOwner !== runtimeOwner) {
    throw new Error('Invalid pendingMisread: live resume lease does not own this runtime');
  }
}

export function consumeLiveMisreadLease(
  state: GameState,
  pending: PendingMisreadAuthority,
  runtimeToken: number,
  runtimeOwner: object,
): void {
  assertLiveMisreadLease(state, pending, runtimeToken, runtimeOwner);
  liveMisreadLease = null;
}

/** Transactional clear. The current store transaction may restore its checkpoint. */
export function clearLiveMisreadLease(): void {
  liveMisreadLease = null;
}

/** Match/process boundary. Old transaction checkpoints cannot revive this lease. */
export function resetLiveMisreadLease(): void {
  liveMisreadLease = null;
  liveMisreadLeaseEpoch += 1;
}

export function checkpointLiveMisreadLease(): LiveMisreadLeaseCheckpoint {
  return { epoch: liveMisreadLeaseEpoch, lease: cloneLiveMisreadLease(liveMisreadLease) };
}

export function isLiveMisreadLeaseCheckpointCurrent(
  checkpoint: LiveMisreadLeaseCheckpoint,
): boolean {
  return checkpoint.epoch === liveMisreadLeaseEpoch;
}

export function rollbackLiveMisreadLease(checkpoint: LiveMisreadLeaseCheckpoint): void {
  if (!isLiveMisreadLeaseCheckpointCurrent(checkpoint)) {
    throw new Error('Invalid pendingMisread: stale live lease rollback');
  }
  liveMisreadLease = cloneLiveMisreadLease(checkpoint.lease);
}

export function matchesPendingMisreadAuthority(
  left: PendingMisreadAuthority,
  right: PendingMisreadAuthority,
): boolean {
  return left.continuationToken === right.continuationToken
    && left.player === right.player
    && left.reasoningUid === right.reasoningUid
    && left.reasoningPlayer === right.reasoningPlayer
    && sameCandidates(left.candidates, right.candidates)
    && sameTrace(left.causalTrace, right.causalTrace);
}

export function assertMisreadDecisionMatchesLive(
  state: GameState,
  pending: MisreadDecision,
): void {
  const reasoner = findReasoner(state, pending.reasoningUid);
  if (!reasoner
    || reasoner.player !== pending.reasoningPlayer
    || reasoner.state !== 'sleep') {
    throw new Error('Invalid pendingMisread: reasoning target must be owned and sleeping');
  }
  const defender = pending.reasoningPlayer === 'self' ? 'opp' : 'self';
  if (pending.player !== defender) {
    throw new Error('Invalid pendingMisread: decision owner must be the defender');
  }
  const live = collectMisreadCandidates(state, pending.player);
  if (live.length === 0 || !sameCandidates(pending.candidates, live)) {
    throw new Error('Invalid pendingMisread: candidates must match the live scene exactly');
  }
}

export function assertPendingMisreadAuthority(
  state: GameState,
  pending: PendingMisreadAuthority,
): void {
  const continuation = state.pendingReasoningContinuation;
  if (!Number.isSafeInteger(pending.continuationToken)
    || pending.continuationToken < 1
    || state.reasoningContinuationSeq !== pending.continuationToken) {
    throw new Error('Invalid pendingMisread: continuation token must match GameState');
  }
  if (continuation?.token !== pending.continuationToken
    || continuation.uid !== pending.reasoningUid
    || continuation.player !== pending.reasoningPlayer) {
    throw new Error('Invalid pendingMisread: reasoning target must match its continuation anchor');
  }
  assertMisreadDecisionMatchesLive(state, pending);
  assertMisreadCausalTrace(state, pending);
  assertReasoningContinuationEntry(state, pending);
}

function assertReasoningContinuationEntry(
  state: GameState,
  pending: PendingMisreadAuthority,
): void {
  const entries = state.pendingEffects.filter((entry) => (
    entry.reasoningContinuation?.token === pending.continuationToken
  ));
  const entry = entries[0];
  const payload = entry?.triggeredBy.payload as { uid?: unknown; player?: unknown } | undefined;
  if (entries.length !== 1
    || entry === undefined
    || entry.reasoningContinuation?.uid !== pending.reasoningUid
    || entry.reasoningContinuation.player !== pending.reasoningPlayer
    || entry.source.uid !== pending.reasoningUid
    || entry.source.player !== pending.reasoningPlayer
    || entry.triggeredBy.hook !== 'reasoning:after-sleep:continue'
    || payload?.uid !== pending.reasoningUid
    || payload.player !== pending.reasoningPlayer
    || (entry.state !== 'resolving' && entry.state !== 'resolved')
    || !sameContinuationEntryTrace(entry.causalTrace, pending.causalTrace)) {
    throw new Error('Invalid pendingMisread: reasoning continuation entry must match its physical anchor');
  }
}

function isCausalEntry(entry: GameState['log'][number]): entry is CausalLogEntryV1 {
  return 'schemaVersion' in entry && entry.schemaVersion === 1;
}

function assertMisreadCausalTrace(
  state: GameState,
  pending: PendingMisreadAuthority,
): void {
  const trace = pending.causalTrace;
  if (state.causalLog === undefined) {
    if (trace !== undefined) {
      throw new Error('Invalid pendingMisread: causal trace requires an active causal session');
    }
    return;
  }
  if (trace === undefined || trace.awaitingResume !== true || trace.completed === true) {
    throw new Error('Invalid pendingMisread: causal trace must own an awaiting reasoning branch');
  }

  const entries = state.log.filter(isCausalEntry);
  const byId = new Map(entries.map((entry) => [entry.eventId, entry]));
  const root = byId.get(trace.rootEventId);
  const tail = byId.get(trace.tailEventId);
  const reasoner = findReasoner(state, pending.reasoningUid);
  const cardNumber = reasoner?.cardId;
  let latestStandaloneDeclare: CausalLogEntryV1 | undefined;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (
      entry.kind === 'declare'
      && entry.parentEventId === undefined
      && entry.correlationEventId === undefined
    ) {
      latestStandaloneDeclare = entry;
      break;
    }
  }
  if (
    root === undefined
    || tail === undefined
    || root.sessionId !== state.causalLog.sessionId
    || tail.sessionId !== state.causalLog.sessionId
    || root.kind !== 'declare'
    || root.actor !== pending.reasoningPlayer
    || root.player !== pending.reasoningPlayer
    || root.parentEventId !== undefined
    || root.correlationEventId !== undefined
    || root.source?.side !== pending.reasoningPlayer
    || root.source?.cardNumber !== cardNumber
    || root.turn !== state.turn.number
    || latestStandaloneDeclare?.eventId !== root.eventId
    || tail.kind !== 'sleep'
    || tail.actor !== pending.reasoningPlayer
    || tail.player !== pending.reasoningPlayer
    || tail.parentEventId !== root.eventId
    || tail.correlationEventId !== undefined
    || tail.sequence !== root.sequence + 1
    || tail.targets.length !== 1
    || tail.targets[0]?.side !== pending.reasoningPlayer
    || tail.targets[0]?.cardNumber !== cardNumber
  ) {
    throw new Error('Invalid pendingMisread: causal trace does not match the live reasoning branch');
  }
}

export function clonePendingMisreadAuthority(
  pending: PendingMisreadAuthority,
): PendingMisreadAuthority {
  return {
    continuationToken: pending.continuationToken,
    player: pending.player,
    reasoningUid: pending.reasoningUid,
    reasoningPlayer: pending.reasoningPlayer,
    candidates: pending.candidates.map((candidate) => ({ ...candidate })),
    ...(pending.causalTrace ? { causalTrace: { ...pending.causalTrace } } : {}),
  };
}
