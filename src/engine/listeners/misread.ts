import { event } from '../event/registry.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import { mutate } from '../mutate/index.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState } from '../types/index.js';

export type MisreadCandidate = { uid: string; x: number };

export type PendingMisreadSide = {
  /** Player who owns the misread decision. */
  player: 'self' | 'opp';
  reasoningUid: string;
  reasoningPlayer: 'self' | 'opp';
  candidates: MisreadCandidate[];
};

declare global {
  var __pendingMisread: PendingMisreadSide | null | undefined;
}

function readPending(): PendingMisreadSide | null {
  return globalThis.__pendingMisread ?? null;
}

function writePending(value: PendingMisreadSide | null): void {
  globalThis.__pendingMisread = value;
}

export function _drainPendingMisread(): PendingMisreadSide | null {
  const value = readPending();
  writePending(null);
  return value;
}

export function _peekPendingMisread(): PendingMisreadSide | null {
  return readPending();
}

export function _resetPendingMisread(): void {
  writePending(null);
}

export function _resetMisreadRegistered(): void {
  _registered = false;
}

function findOwnerOfUid(state: GameState, uid: string): 'self' | 'opp' | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const player of ['self', 'opp'] as const) {
    if (state.players[player].scene.some((character) => character.uid === uid)) return player;
  }
  return null;
}

function extractMisreadX(ability: unknown): number | null {
  if (!ability || typeof ability !== 'object') return null;
  const candidate = ability as { type?: string; effect?: { args?: { x?: number } } };
  if (candidate.type !== 'icon-misread') return null;
  const x = candidate.effect?.args?.x;
  return typeof x === 'number' ? x : null;
}

function humanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

function collectCandidates(state: GameState, player: 'self' | 'opp'): MisreadCandidate[] {
  const candidates: MisreadCandidate[] = [];
  for (const character of state.players[player].scene) {
    if (character.state !== 'active') continue;
    if (readChar.originalAbilitiesDisabled(state, character.uid)) continue;
    const card = readDef.card(character.cardId);
    if (!card) continue;
    for (const ability of card.abilities) {
      const x = extractMisreadX(ability);
      if (x !== null) candidates.push({ uid: character.uid, x });
    }
  }
  return candidates;
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

function validatePicks(
  state: GameState,
  pending: PendingMisreadSide,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): MisreadCandidate[] {
  if (findOwnerOfUid(state, pending.reasoningUid) !== pending.reasoningPlayer) {
    throw new Error(`misreadResolve: stale reasoning target uid=${pending.reasoningUid}`);
  }
  const defender = pending.reasoningPlayer === 'self' ? 'opp' : 'self';
  if (pending.player !== defender) throw new Error('misreadResolve: invalid decision owner');

  const snapshot = new Map(pending.candidates.map((candidate) => [candidate.uid, candidate.x]));
  const live = new Map(collectCandidates(state, pending.player).map((candidate) => [candidate.uid, candidate.x]));
  const selected = new Set<string>();
  const picks: MisreadCandidate[] = [];
  for (const requested of requestedPicks) {
    if (selected.has(requested.uid)) throw new Error(`misreadResolve: duplicate uid=${requested.uid}`);
    selected.add(requested.uid);
    const snapshotX = snapshot.get(requested.uid);
    if (snapshotX === undefined || snapshotX !== requested.x) {
      throw new Error(`misreadResolve: forged pick uid=${requested.uid}`);
    }
    if (live.get(requested.uid) !== snapshotX) {
      throw new Error(`misreadResolve: stale pick uid=${requested.uid}`);
    }
    picks.push({ uid: requested.uid, x: snapshotX });
  }

  return picks;
}

export function _canResolveMisreadPicks(
  state: GameState,
  pending: PendingMisreadSide,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): boolean {
  try {
    validatePicks(state, pending, requestedPicks);
    return true;
  } catch {
    return false;
  }
}

/** Validate against the surfaced snapshot and live board before applying a decision. */
export function _resolveMisreadPicks(
  state: GameState,
  pending: PendingMisreadSide,
  requestedPicks: ReadonlyArray<MisreadCandidate>,
): void {
  const picks = validatePicks(state, pending, requestedPicks);
  let totalReduction = 0;
  for (const pick of picks) {
    mutate.scene.setState(state, pick.uid, 'sleep');
    totalReduction += pick.x;
    event.emit(state, 'misread:performed', { player: pending.player }, { player: pending.player, uid: pick.uid });
  }
  if (totalReduction > 0) setReasoningLpReduction(state, pending.reasoningUid, totalReduction);
}

let _registered = false;

export function registerMisreadListener(): void {
  if (_registered) return;
  _registered = true;
  event.on('reasoning:before-add', (state, payload) => {
    const uid = (payload as { uid?: string } | undefined)?.uid;
    if (!uid) return;
    const reasoningPlayer = findOwnerOfUid(state, uid);
    if (!reasoningPlayer) return;
    const defender = reasoningPlayer === 'self' ? 'opp' : 'self';
    const candidates = collectCandidates(state, defender);
    if (candidates.length === 0) return;

    const pending: PendingMisreadSide = {
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
