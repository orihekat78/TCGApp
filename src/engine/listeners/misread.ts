import {
  _abortEventJournal,
  _beginEventJournal,
  _commitEventJournal,
  event,
} from '../event/registry.js';
import { mutate } from '../mutate/index.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type {
  CausalEffectTrace,
  GameState,
  MisreadCandidate,
  MisreadDecision,
  PendingMisreadAuthority,
} from '../types/index.js';
import {
  assertMisreadDecisionMatchesLive,
  clonePendingMisreadAuthority,
  collectMisreadCandidates,
  resetLiveMisreadLease,
} from '../state/misread-authority.js';

type PendingMisreadValue = MisreadDecision | PendingMisreadAuthority;

declare global {
  var __pendingMisread: PendingMisreadValue | null | undefined;
}

function readPending(): PendingMisreadValue | null {
  return globalThis.__pendingMisread ?? null;
}

function writePending(value: PendingMisreadValue | null): void {
  globalThis.__pendingMisread = value;
}

export function _drainPendingMisread(): PendingMisreadAuthority | null {
  const value = readPending();
  writePending(null);
  if (value === null) return null;
  if (!('continuationToken' in value)) {
    throw new Error('Invalid pendingMisread: unauthenticated runtime projection');
  }
  return clonePendingMisreadAuthority(value);
}

export function _peekPendingMisread(): PendingMisreadValue | null {
  return readPending();
}

/** Transfer one consumed reasoning continuation token into the human decision. */
export function _authenticatePendingMisread(
  reasoningUid: string,
  reasoningPlayer: 'self' | 'opp',
  continuationToken: number,
  causalTrace?: CausalEffectTrace,
): PendingMisreadAuthority | null {
  const pending = readPending();
  if (pending === null
    || pending.reasoningUid !== reasoningUid
    || pending.reasoningPlayer !== reasoningPlayer) return null;
  if ('continuationToken' in pending) {
    throw new Error('Invalid pendingMisread: decision already authenticated');
  }
  const authenticated: PendingMisreadAuthority = {
    continuationToken,
    player: pending.player,
    reasoningUid: pending.reasoningUid,
    reasoningPlayer: pending.reasoningPlayer,
    candidates: pending.candidates.map((candidate) => ({ ...candidate })),
    ...(causalTrace ? { causalTrace: { ...causalTrace } } : {}),
  };
  writePending(clonePendingMisreadAuthority(authenticated));
  return authenticated;
}

export function _resetPendingMisread(): void {
  writePending(null);
  resetLiveMisreadLease();
}

export function _resetMisreadRegistered(): void {
  _registered = false;
}

function humanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

function setReasoningLpReduction(state: GameState, uid: string, reduction: number): void {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const player = uid === 'partner:self' ? 'self' : 'opp';
    const partner = state.players[player].partner;
    partner.turnEffects ??= {};
    partner.turnEffects['lpMod_reasoning'] = -reduction;
    return;
  }
  for (const player of ['self', 'opp'] as const) {
    const character = state.players[player].scene.find((entry) => entry.uid === uid);
    if (!character) continue;
    character.turnEffects['lpMod_reasoning'] = -reduction;
    return;
  }
  throw new Error(`misreadResolve: missing reasoning target uid=${uid}`);
}

export function _validateMisreadPicks(
  state: GameState,
  pending: MisreadDecision,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): MisreadCandidate[] {
  assertMisreadDecisionMatchesLive(state, pending);

  const snapshot = new Map(pending.candidates.map((candidate) => [candidate.uid, candidate.x]));
  const selected = new Set<string>();
  const picks: MisreadCandidate[] = [];
  for (const requested of requestedPicks) {
    if (selected.has(requested.uid)) throw new Error(`misreadResolve: duplicate uid=${requested.uid}`);
    selected.add(requested.uid);
    const snapshotX = snapshot.get(requested.uid);
    if (snapshotX === undefined || snapshotX !== requested.x) {
      throw new Error(`misreadResolve: forged pick uid=${requested.uid}`);
    }
    picks.push({ uid: requested.uid, x: snapshotX });
  }

  return picks;
}

export function _canResolveMisreadPicks(
  state: GameState,
  pending: MisreadDecision,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): boolean {
  try {
    _validateMisreadPicks(state, pending, requestedPicks);
    return true;
  } catch {
    return false;
  }
}

/** Commit the whole simultaneous Misread batch before any reaction can observe it. */
export function _applyValidatedMisreadPicks(
  state: GameState,
  pending: MisreadDecision,
  picks: ReadonlyArray<MisreadCandidate>,
): void {
  const journal = _beginEventJournal();
  try {
    for (const pick of picks) mutate.scene.setState(state, pick.uid, 'sleep');
    const totalReduction = picks.reduce((sum, pick) => sum + pick.x, 0);
    if (totalReduction > 0) setReasoningLpReduction(state, pending.reasoningUid, totalReduction);
    // state:change listeners must see the whole simultaneous Misread commit.
    _commitEventJournal(journal);
  } catch (error) {
    _abortEventJournal(journal);
    throw error;
  }
  for (const pick of picks) {
    event.emit(state, 'misread:performed', { player: pending.player }, { player: pending.player, uid: pick.uid });
  }
}

/** Validate against the surfaced snapshot and live board before applying a decision. */
export function _resolveMisreadPicks(
  state: GameState,
  pending: MisreadDecision,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): void {
  const picks = _validateMisreadPicks(state, pending, requestedPicks);
  _applyValidatedMisreadPicks(state, pending, picks);
}

let _registered = false;

export function registerMisreadListener(): void {
  if (_registered) return;
  _registered = true;
  event.on('reasoning:before-add', (state, payload) => {
    const uid = (payload as { uid?: string } | undefined)?.uid;
    if (!uid) return;
    const reasoningPlayer = state.players.self.scene.some((character) => character.uid === uid)
      || uid === 'partner:self'
      ? 'self'
      : state.players.opp.scene.some((character) => character.uid === uid)
        || uid === 'partner:opp'
        ? 'opp'
        : null;
    if (reasoningPlayer === null) return;
    const defender = reasoningPlayer === 'self' ? 'opp' : 'self';
    const candidates = collectMisreadCandidates(state, defender);
    if (candidates.length === 0) return;

    const pending: MisreadDecision = {
      player: defender,
      reasoningUid: uid,
      reasoningPlayer,
      candidates,
    };
    if (defender === humanPlayerSide()) {
      writePending(pending);
      return;
    }

    const policy = new HeuristicPolicy();
    const picks = policy.chooseMisreadTriggers
      ? policy.chooseMisreadTriggers(state, uid, candidates)
      : candidates;
    _resolveMisreadPicks(state, pending, picks);
  });
}
