import { def } from '../read/def.js';
import { allCardNameComponentsForDef } from '../target/card-def-registry.js';
import { legacyCardOccurrence } from '../target/card-occurrence.js';
import type {
  PendingEffectPickSide,
  PendingPickMinimumPolicy,
} from './pending-state.js';

type PickCandidate = PendingEffectPickSide['candidates'][number];

function boundedMax(pending: PendingEffectPickSide): number {
  const requestedMax = pending.requestedNMax ?? pending.nMax;
  const raw = Number.isFinite(requestedMax) ? Math.floor(requestedMax) : pending.candidates.length;
  return Math.max(0, Math.min(raw, pending.candidates.length));
}

function requestedMinimum(pending: PendingEffectPickSide): number {
  const requested = pending.requestedNMin ?? pending.nMin;
  return Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : 0;
}

function requestedMaximum(pending: PendingEffectPickSide): number {
  const requested = pending.requestedNMax ?? pending.nMax;
  return Number.isFinite(requested)
    ? Math.max(0, Math.floor(requested))
    : pending.candidates.length;
}

/**
 * Card DSL owns whether a fixed minimum is a best-effort instruction or an
 * exact prerequisite.  Copy that policy into the runtime prompt once, before
 * it becomes engine-owned state; later consumers must not reinterpret args.
 */
export function pendingPickMinimumPolicyFromAtomArgs(
  atomArgs: Readonly<Record<string, unknown>>,
): PendingPickMinimumPolicy {
  const value = atomArgs.minimumPolicy;
  if (value === undefined) return 'best-effort';
  if (value === 'best-effort' || value === 'exact') return value;
  throw new Error('effectPick: invalid minimumPolicy');
}

function existingForcedUids(pending: PendingEffectPickSide): string[] {
  const candidates = new Set(pending.candidates.map(candidate => candidate.uid));
  return [...new Set(pending.forcedUids ?? [])]
    .filter(uid => candidates.has(uid));
}

export function findPendingPickCandidate(
  pending: PendingEffectPickSide,
  uid: string,
): PickCandidate | undefined {
  const direct = pending.candidates.find(candidate => candidate.uid === uid);
  if (direct) return direct;
  const legacy = legacyCardOccurrence(uid);
  if (!legacy) return undefined;
  const matches = pending.candidates.filter(candidate => candidate.kind === 'card'
    && candidate.cardId === legacy.cardId
    && candidate.index === legacy.index);
  return matches.length === 1 ? matches[0] : undefined;
}

export function canonicalPendingPickSelection(
  pending: PendingEffectPickSide,
  uids: readonly string[],
): string[] | null {
  const selected = uids.map(uid => findPendingPickCandidate(pending, uid));
  if (selected.some(candidate => candidate === undefined)) return null;
  return selected.map(candidate => candidate!.uid);
}

function candidateFor(pending: PendingEffectPickSide, uid: string): PickCandidate | undefined {
  return findPendingPickCandidate(pending, uid);
}

/** Returns the first constraint violated by an otherwise size-valid selection. */
export function pendingPickSelectionViolation(
  pending: PendingEffectPickSide,
  uids: readonly string[],
  requireForced = true,
): string | null {
  const canonical = canonicalPendingPickSelection(pending, uids);
  if (canonical === null) return 'unknown candidate uid';
  if (new Set(canonical).size !== canonical.length) return 'duplicate candidate uid';
  const exact = canonical.map(uid => candidateFor(pending, uid)) as PickCandidate[];
  if (requireForced) {
    const forced = existingForcedUids(pending);
    const requiredCount = Math.min(forced.length, boundedMax(pending));
    const selectedForcedCount = forced.filter(uid => canonical.includes(uid)).length;
    if (selectedForcedCount < requiredCount) return 'required candidate omitted';
  }

  if (pending.distinctNames === true) {
    const seen = new Set<string>();
    for (const candidate of exact) {
      const card = def.card(candidate.cardId);
      const names = card
        ? allCardNameComponentsForDef(card, candidate.kind === 'card' ? candidate.area : undefined)
        : [candidate.cardId];
      if (names.some(name => seen.has(name))) return 'distinctNames violated';
      names.forEach(name => seen.add(name));
    }
  }
  if (pending.distinctLevel === true) {
    const seen = new Set<number>();
    for (const candidate of exact) {
      const level = def.card(candidate.cardId)?.level;
      if (typeof level === 'number' && seen.has(level)) return 'distinctLevel violated';
      if (typeof level === 'number') seen.add(level);
    }
  }
  if (pending.distinctColors === true) {
    const seen = new Set<string>();
    for (const candidate of exact) {
      const colors = def.card(candidate.cardId)?.colors ?? [];
      if (colors.some(color => seen.has(color))) return 'distinctColors violated';
      colors.forEach(color => seen.add(color));
    }
  }
  if (typeof pending.perSideMax === 'number') {
    const bySide: Record<'self' | 'opp', number> = { self: 0, opp: 0 };
    for (const candidate of exact) {
      bySide[candidate.player] += 1;
      if (bySide[candidate.player] > pending.perSideMax) return 'perSideMax violated';
    }
  }
  if (typeof pending.aggregateLevelMax === 'number') {
    const total = exact.reduce((sum, candidate) => sum + (def.card(candidate.cardId)?.level ?? 0), 0);
    if (total > pending.aggregateLevelMax) return 'aggregateLevelMax violated';
  }
  return null;
}

/**
 * Finds the largest legal selection. Printed minimums are reduced to this size
 * because mandatory effects resolve as much as possible when too few targets exist.
 */
export function maximumFeasiblePendingPickSelection(
  pending: PendingEffectPickSide,
  preferredUids: readonly string[] = [],
): string[] {
  const max = boundedMax(pending);
  const forced = existingForcedUids(pending);

  const orderedUids = [
    ...forced,
    ...preferredUids,
    ...pending.candidates.map(candidate => candidate.uid),
  ].filter((uid, index, all) => all.indexOf(uid) === index && candidateFor(pending, uid) !== undefined);
  let best: string[] = [];

  const search = (index: number, selected: string[]): boolean => {
    if (selected.length > best.length
      && pendingPickSelectionViolation(pending, selected, true) === null) {
      best = [...selected];
    }
    if (best.length === max) return true;
    if (index >= orderedUids.length
      || selected.length + (orderedUids.length - index) <= best.length) return false;

    const uid = orderedUids[index]!;
    if (selected.length < max) {
      const withCandidate = [...selected, uid];
      if (pendingPickSelectionViolation(pending, withCandidate, false) === null
        && search(index + 1, withCandidate)) return true;
    }
    return search(index + 1, selected);
  };

  search(0, []);
  if (forced.length > 0 && pendingPickSelectionViolation(pending, best, true) !== null) {
    throw new Error('effectPick: required candidates violate selection constraints');
  }
  return best;
}

export type PendingPickEffectiveRange = {
  min: number;
  max: number;
  feasible: boolean;
};

export function effectivePendingPickRange(
  pending: PendingEffectPickSide,
): PendingPickEffectiveRange {
  const max = maximumFeasiblePendingPickSelection(pending).length;
  const requestedMin = requestedMinimum(pending);
  const minimumPolicy = pending.minimumPolicy ?? 'best-effort';
  return {
    min: minimumPolicy === 'exact' ? requestedMin : Math.min(requestedMin, max),
    max,
    feasible: minimumPolicy !== 'exact' || max >= requestedMin,
  };
}

export function canApplyPendingPickSelection(
  pending: PendingEffectPickSide,
  pickedUid: string | null,
  pickedUids?: readonly string[],
): boolean {
  const range = effectivePendingPickRange(pending);
  if (!range.feasible) return false;
  if (pickedUid === null) return range.min === 0;
  const canonicalPrimary = findPendingPickCandidate(pending, pickedUid)?.uid;
  const uids = canonicalPendingPickSelection(pending, pickedUids ?? [pickedUid]);
  if (canonicalPrimary === undefined || uids === null) return false;
  return uids.includes(canonicalPrimary)
    && uids.length >= range.min
    && uids.length <= range.max
    && pendingPickSelectionViolation(pending, uids) === null;
}

export function finalizePendingPickRange(
  pending: PendingEffectPickSide,
  minimumPolicy: PendingPickMinimumPolicy = pending.minimumPolicy ?? 'best-effort',
): PendingEffectPickSide | null {
  const withRequest = {
    ...pending,
    requestedNMin: pending.requestedNMin ?? requestedMinimum(pending),
    requestedNMax: pending.requestedNMax ?? requestedMaximum(pending),
    minimumPolicy,
  } satisfies PendingEffectPickSide;
  const range = effectivePendingPickRange(withRequest);
  if (!range.feasible) return null;
  return { ...withRequest, nMin: range.min, nMax: range.max };
}

/** Producer boundary: validates the DSL policy and materializes canonical bounds. */
export function preparePendingPickRange(
  pending: PendingEffectPickSide,
): PendingEffectPickSide | null {
  const minimumPolicy = pendingPickMinimumPolicyFromAtomArgs(pending.atomArgs);
  if (pending.minimumPolicy !== undefined && pending.minimumPolicy !== minimumPolicy) {
    throw new Error('effectPick: minimumPolicy disagrees with atomArgs');
  }
  return finalizePendingPickRange(pending, minimumPolicy);
}

export function normalizePendingPickRange(pending: PendingEffectPickSide): PendingEffectPickSide {
  const normalized = preparePendingPickRange(pending);
  if (normalized === null) {
    throw new Error('effectPick: exact minimum is not feasible');
  }
  return normalized;
}
