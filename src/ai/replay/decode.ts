import {
  assertReplayLogV3,
  canonicalReplayJson,
  type ReplayLogV3,
} from './state-frame.js';
import type { LegacyReplayLog, ReplayLogV1, ReplayLogV2, ReplayMove } from './recorder.js';

export const REPLAY_VALIDATION_ERROR = 'Invalid replay file';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertLegacyResult(value: unknown): void {
  if (!isRecord(value)) throw new Error(REPLAY_VALIDATION_ERROR);
  if (!['self', 'opp', 'draw', 'invariant-fail'].includes(String(value.winner))) {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
  if (!['evidence', 'deck-out', 'turn-cap', 'invariant'].includes(String(value.reason))) {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
  if (typeof value.turns !== 'number' || !Number.isSafeInteger(value.turns) || value.turns < 0) {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
  if (value.error !== undefined && typeof value.error !== 'string') throw new Error(REPLAY_VALIDATION_ERROR);
}

function assertLegacyMoves(value: unknown): asserts value is ReplayMove[] {
  if (!Array.isArray(value)) throw new Error(REPLAY_VALIDATION_ERROR);
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.turn !== 'number'
      || !Number.isSafeInteger(entry.turn)
      || entry.turn < 0
      || (entry.player !== 'self' && entry.player !== 'opp')
      || !isRecord(entry.move)
      || typeof entry.move.kind !== 'string') {
      throw new Error(REPLAY_VALIDATION_ERROR);
    }
  }
}

function assertNondeterminism(value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value.random) || !Array.isArray(value.now)) {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
  if (value.random.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry >= 1)
    || value.now.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
}

function decodeLegacyReplayLog(value: JsonRecord): LegacyReplayLog {
  if (!isRecord(value.initialState)) throw new Error(REPLAY_VALIDATION_ERROR);
  assertLegacyMoves(value.moves);
  assertLegacyResult(value.result);
  if (value.schemaVersion === 1) {
    return value as unknown as ReplayLogV1;
  }
  assertNondeterminism(value.nondeterminism);
  return value as unknown as ReplayLogV2;
}

/** Decode untrusted replay JSON before any playback consumer dereferences it. */
export function decodeReplayLog(value: unknown): LegacyReplayLog | ReplayLogV3 {
  try {
    if (!isRecord(value)) throw new Error(REPLAY_VALIDATION_ERROR);
    if (value.schemaVersion === 1 || value.schemaVersion === 2) return decodeLegacyReplayLog(value);
    if (value.schemaVersion === 3) {
      // Validate the complete untrusted object, including unknown fields, before
      // any consumer can clone it or claim the active match session.
      canonicalReplayJson(value);
      assertReplayLogV3(value);
      return value;
    }
  } catch {
    throw new Error(REPLAY_VALIDATION_ERROR);
  }
  throw new Error(REPLAY_VALIDATION_ERROR);
}
