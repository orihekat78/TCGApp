import type { Effect, GameState } from '../types/index.js';
import type { ContinuationFrame, PendingEffectPickSide } from './pending-state.js';
import { effectivePendingPickRange } from './pick-selection.js';
import { ATOM_VERBS, validate } from './validate.js';
import { def } from '../read/def.js';
import {
  cardOccurrenceUid,
  isCardOccurrenceWitness,
  isCardOccurrenceWitnessFor,
} from '../target/card-occurrence.js';
import {
  DECLARED_NAME_DOMAINS,
  findDeclareNameSpec,
  resolveDeclaredName,
  type DeclareNameSpec,
} from './declared-name-domain.js';
import {
  continuationMayEnterSceneForPlayer,
  isSceneEnterSwitchPickArgs,
  isValidSceneEnterSwitchPickAuthority,
} from './scene-switch.js';

type ValidationMode = 'live' | 'persisted';

export type PendingRuntimeValidationOptions = {
  allowMarker?: boolean;
  mode?: ValidationMode;
};

const PLAYERS = new Set(['self', 'opp']);
const SOURCE_AREAS = new Set([
  'scene', 'partner-area', 'hand', 'evidence', 'file', 'remove', 'case',
]);
const CARD_CANDIDATE_AREAS = new Set([
  'scene', 'partner-area', 'hand', 'deck', 'remove', 'evidence', 'file', 'case', 'set-card',
]);
const INDEXED_CARD_CANDIDATE_AREAS = new Set([
  'partner-area', 'hand', 'deck', 'remove', 'evidence', 'file',
]);
const RESOLUTION_KINDS = new Set(['normal-event', 'hirameki', 'cutin']);
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function fail(path: string, message: string): never {
  throw new Error(`Invalid ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return value;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    fail(path, 'expected a non-empty string');
  }
  return value;
}

function optionalString(value: unknown, path: string): void {
  if (value !== undefined) string(value, path);
}

function occurrenceWitness(value: unknown, path: string): void {
  string(value, path);
  if (!isCardOccurrenceWitness(value)) {
    fail(path, 'expected a versioned indexed-zone witness');
  }
}

function boundOccurrenceWitness(
  value: unknown,
  path: string,
  player: 'self' | 'opp',
  area: 'deck' | 'evidence' | 'remove',
): void {
  occurrenceWitness(value, path);
  if (!isCardOccurrenceWitnessFor(value, player, area)) {
    fail(path, 'must match the candidate player and area');
  }
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected a boolean');
  return value;
}

function optionalBool(value: unknown, path: string): void {
  if (value !== undefined) bool(value, path);
}

function integer(value: unknown, path: string, min = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) {
    fail(path, `expected a safe integer >= ${min}`);
  }
  return value as number;
}

function optionalInteger(value: unknown, path: string, min = 0): void {
  if (value !== undefined) integer(value, path, min);
}

function oneOf(value: unknown, values: ReadonlySet<string>, path: string): string {
  if (typeof value !== 'string' || !values.has(value)) {
    fail(path, `expected one of ${Array.from(values).join(', ')}`);
  }
  return value;
}

function player(value: unknown, path: string): void {
  oneOf(value, PLAYERS, path);
}

function optionalPlayer(value: unknown, path: string): void {
  if (value !== undefined) player(value, path);
}

function stringArray(value: unknown, path: string): void {
  array(value, path).forEach((item, index) => string(item, `${path}[${index}]`));
}

function hasSameStringMultiset(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  left.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  for (const value of right) {
    const count = counts.get(value) ?? 0;
    if (count === 0) return false;
    if (count === 1) counts.delete(value);
    else counts.set(value, count - 1);
  }
  return counts.size === 0;
}

function genericData(
  value: unknown,
  path: string,
  mode: ValidationMode,
  stack = new WeakSet<object>(),
  depth = 0,
): void {
  if (depth > 32) fail(path, 'maximum nesting depth exceeded');
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'number must be finite');
    return;
  }
  if (typeof value === 'function') {
    if (mode === 'persisted') fail(path, 'functions are not persistable');
    return;
  }
  if (typeof value !== 'object') fail(path, `unsupported ${typeof value} value`);
  if (stack.has(value)) fail(path, 'cyclic value');
  stack.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => genericData(item, `${path}[${index}]`, mode, stack, depth + 1));
  } else {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) fail(path, `dangerous key ${key}`);
      genericData(item, `${path}.${key}`, mode, stack, depth + 1);
    }
  }
  stack.delete(value);
}

function nullable(
  value: unknown,
  path: string,
  check: (value: unknown, path: string) => void,
): void {
  if (value === null || value === undefined) return;
  check(value, path);
}

function causalTrace(value: unknown, path: string): void {
  const item = record(value, path);
  string(item.rootEventId, `${path}.rootEventId`);
  string(item.tailEventId, `${path}.tailEventId`);
  optionalBool(item.awaitingResume, `${path}.awaitingResume`);
  optionalBool(item.completed, `${path}.completed`);
}

function source(value: unknown, path: string, requireUid = false): void {
  const item = record(value, path);
  string(item.cardId, `${path}.cardId`, true);
  string(item.abilityId, `${path}.abilityId`, true);
  if (item.area !== undefined) oneOf(item.area, SOURCE_AREAS, `${path}.area`);
  if (requireUid) string(item.uid, `${path}.uid`, true);
  else if (item.uid !== undefined) string(item.uid, `${path}.uid`, true);
  if (item.resolutionKind !== undefined) oneOf(item.resolutionKind, RESOLUTION_KINDS, `${path}.resolutionKind`);
  optionalInteger(item.triggerBatch, `${path}.triggerBatch`, 1);
  optionalInteger(item.ownerChosenOrder, `${path}.ownerChosenOrder`);
  optionalBool(item.ownerOrderConfirmed, `${path}.ownerOrderConfirmed`);
  if (item.declaredBatch !== undefined
    && typeof item.declaredBatch !== 'string'
    && !Number.isSafeInteger(item.declaredBatch)) {
    fail(`${path}.declaredBatch`, 'expected a string or safe integer');
  }
  if (item.causalTrace !== undefined) causalTrace(item.causalTrace, `${path}.causalTrace`);
}

function candidate(value: unknown, path: string): void {
  const item = record(value, path);
  const kind = string(item.kind, `${path}.kind`);
  switch (kind) {
    case 'char':
      string(item.uid, `${path}.uid`);
      string(item.cardId, `${path}.cardId`);
      player(item.player, `${path}.player`);
      if (item.area !== undefined || item.index !== undefined) fail(path, 'char candidates cannot carry an area or index');
      return;
    case 'partner':
      player(item.player, `${path}.player`);
      return;
    case 'card': {
      string(item.cardId, `${path}.cardId`);
      const area = oneOf(item.area, CARD_CANDIDATE_AREAS, `${path}.area`);
      player(item.player, `${path}.player`);
      if (INDEXED_CARD_CANDIDATE_AREAS.has(area)) integer(item.index, `${path}.index`);
      else if (item.index !== undefined) fail(`${path}.index`, 'not allowed for this area');
      optionalString(item.hostUid, `${path}.hostUid`);
      optionalString(item.setCardInstanceId, `${path}.setCardInstanceId`);
      if (area === 'evidence' || area === 'remove') occurrenceWitness(item.occurrenceWitness, `${path}.occurrenceWitness`);
      else optionalString(item.occurrenceWitness, `${path}.occurrenceWitness`);
      return;
    }
    case 'evidence':
      player(item.player, `${path}.player`);
      integer(item.index, `${path}.index`);
      if (item.area !== undefined && item.area !== 'evidence') fail(`${path}.area`, 'evidence candidates require area evidence');
      occurrenceWitness(item.occurrenceWitness, `${path}.occurrenceWitness`);
      return;
    case 'file':
      player(item.player, `${path}.player`);
      integer(item.index, `${path}.index`);
      return;
    default:
      fail(`${path}.kind`, 'unsupported candidate kind');
  }
}

function effect(value: unknown, path: string, mode: ValidationMode): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected an effect object');
  }
  const result = validate(value as Effect);
  if (!result.ok) fail(path, result.errors[0] ?? 'invalid effect');
  genericData(value, path, mode);
}

function effectArray(value: unknown, path: string, mode: ValidationMode): void {
  array(value, path).forEach((item, index) => effect(item, `${path}[${index}]`, mode));
}

function effectCtx(value: unknown, path: string, mode: ValidationMode, depth = 0): void {
  if (depth > 16) fail(path, 'effect context parent depth exceeded');
  const item = record(value, path);
  const src = record(item.source, `${path}.source`);
  player(src.player, `${path}.source.player`);
  oneOf(src.area, SOURCE_AREAS, `${path}.source.area`);
  if (src.cardId !== undefined) string(src.cardId, `${path}.source.cardId`, true);
  if (src.uid !== undefined) string(src.uid, `${path}.source.uid`, true);
  if (src.abilityId !== undefined) string(src.abilityId, `${path}.source.abilityId`, true);
  if (src.resolutionKind !== undefined) oneOf(src.resolutionKind, RESOLUTION_KINDS, `${path}.source.resolutionKind`);
  optionalInteger(src.triggerBatch, `${path}.source.triggerBatch`, 1);
  optionalInteger(src.ownerChosenOrder, `${path}.source.ownerChosenOrder`);
  optionalBool(src.ownerOrderConfirmed, `${path}.source.ownerOrderConfirmed`);
  if (src.declaredBatch !== undefined
    && typeof src.declaredBatch !== 'string'
    && !Number.isSafeInteger(src.declaredBatch)) {
    fail(`${path}.source.declaredBatch`, 'expected a string or safe integer');
  }

  const bindings = record(item.bindings, `${path}.bindings`);
  for (const [key, values] of Object.entries(bindings)) {
    array(values, `${path}.bindings.${key}`)
      .forEach((entry, index) => {
        const entryPath = `${path}.bindings.${key}[${index}]`;
        const binding = record(entry, entryPath);
        genericData(entry, entryPath, mode);
        if (binding.area === 'deck') {
          player(binding.player, `${entryPath}.player`);
          const bindingPlayer = binding.player as 'self' | 'opp';
          const bindingIndex = integer(binding.index, `${entryPath}.index`);
          const cardId = string(binding.cardId, `${entryPath}.cardId`);
          boundOccurrenceWitness(
            binding.occurrenceWitness,
            `${entryPath}.occurrenceWitness`,
            bindingPlayer,
            'deck',
          );
          const uid = string(binding.uid, `${entryPath}.uid`);
          if (uid !== cardOccurrenceUid(bindingPlayer, 'deck', cardId, bindingIndex)) {
            fail(`${entryPath}.uid`, 'does not match the indexed deck occurrence');
          }
        } else if (binding.area === 'remove' || binding.area === 'evidence') {
          player(binding.player, `${entryPath}.player`);
          const bindingPlayer = binding.player as 'self' | 'opp';
          const bindingIndex = integer(binding.index, `${entryPath}.index`);
          occurrenceWitness(binding.occurrenceWitness, `${entryPath}.occurrenceWitness`);
          if (binding.area === 'remove') {
            const cardId = string(binding.cardId, `${entryPath}.cardId`);
            if (binding.uid !== undefined
              && binding.uid !== cardOccurrenceUid(bindingPlayer, 'remove', cardId, bindingIndex)) {
              fail(`${entryPath}.uid`, 'does not match the indexed remove occurrence');
            }
          } else if (binding.uid !== undefined) {
            const expectedUid = `evidence:${bindingPlayer}:${bindingIndex}`;
            if (binding.uid !== expectedUid) fail(`${entryPath}.uid`, 'does not match the indexed evidence occurrence');
          }
        }
      });
  }
  if (item.declaredNames !== undefined) {
    const names = record(item.declaredNames, `${path}.declaredNames`);
    Object.entries(names).forEach(([key, name]) => string(name, `${path}.declaredNames.${key}`, true));
  }
  if (item.declaredNameDomains !== undefined) {
    const domains = record(item.declaredNameDomains, `${path}.declaredNameDomains`);
    const names = item.declaredNames === undefined
      ? {}
      : record(item.declaredNames, `${path}.declaredNames`);
    for (const [key, rawDomain] of Object.entries(domains)) {
      if (!Object.prototype.hasOwnProperty.call(names, key)) {
        fail(`${path}.declaredNameDomains.${key}`, 'does not have a declared name');
      }
      const domain = oneOf(
        rawDomain,
        new Set(DECLARED_NAME_DOMAINS),
        `${path}.declaredNameDomains.${key}`,
      ) as 'unrestricted' | 'registered-character-card-name';
      const declaredName = names[key];
      if (typeof declaredName === 'string'
        && declaredName !== ''
        && resolveDeclaredName(domain, declaredName) !== declaredName) {
        fail(`${path}.declaredNames.${key}`, `is not allowed by ${domain}`);
      }
    }
    for (const key of Object.keys(names)) {
      if (!Object.prototype.hasOwnProperty.call(domains, key)) {
        fail(`${path}.declaredNameDomains.${key}`, 'is required for the declared name');
      }
    }
  }
  if (item.picked !== undefined) {
    array(item.picked, `${path}.picked`)
      .forEach((entry, index) => candidate(entry, `${path}.picked[${index}]`));
  }
  optionalBool(item.viaCost, `${path}.viaCost`);
  if (item.costPaid !== undefined) genericData(item.costPaid, `${path}.costPaid`, mode);
  if (item.triggerPayload !== undefined) genericData(item.triggerPayload, `${path}.triggerPayload`, mode);
  if (item.contact !== undefined) {
    const contact = record(item.contact, `${path}.contact`);
    string(contact.byUid, `${path}.contact.byUid`);
    optionalString(contact.targetUid, `${path}.contact.targetUid`);
    optionalString(contact.guardUid, `${path}.contact.guardUid`);
    player(contact.attackerSide, `${path}.contact.attackerSide`);
  }
  if (item.causal !== undefined) {
    const causal = record(item.causal, `${path}.causal`);
    optionalString(causal.publicHandRevealToken, `${path}.causal.publicHandRevealToken`);
    if (causal.trace !== undefined) causalTrace(causal.trace, `${path}.causal.trace`);
    optionalString(causal.correlationEventId, `${path}.causal.correlationEventId`);
    if (causal.trace !== undefined && causal.correlationEventId !== undefined) {
      fail(`${path}.causal`, 'trace and correlationEventId are mutually exclusive');
    }
  }
  if (item.dyn !== undefined) genericData(item.dyn, `${path}.dyn`, mode);
  if (item.rng !== undefined) {
    if (mode === 'persisted' || typeof item.rng !== 'function') {
      fail(`${path}.rng`, 'expected a live runtime function');
    }
  }
  if (item.parent !== undefined) effectCtx(item.parent, `${path}.parent`, mode, depth + 1);
}

function continuation(value: unknown, path: string, mode: ValidationMode, depth = 0): void {
  if (depth > 16) fail(path, 'continuation depth exceeded');
  const item = record(value, path);
  effectArray(item.remainder, `${path}.remainder`, mode);
  effectCtx(item.ctx, `${path}.ctx`, mode);
  oneOf(item.kind, new Set(['sequence', 'chain']), `${path}.kind`);
  if (item.outer !== undefined) continuation(item.outer, `${path}.outer`, mode, depth + 1);
}

function sameDeclareNameSpec(left: DeclareNameSpec, right: DeclareNameSpec): boolean {
  return left.bind === right.bind
    && left.domain === right.domain
    && left.optional === right.optional;
}

function matchingDeclaredNameLineage(
  state: GameState,
  source: Record<string, unknown>,
): GameState['pendingEffects'] {
  const sourceArea = source.area;
  const entries = state.pendingEffects.filter((entry) => {
    if (entry.source.player !== source.player
      || entry.source.cardId !== source.cardId
      || entry.source.abilityId !== source.abilityId) return false;
    if (source.uid !== undefined && entry.source.uid !== source.uid) return false;
    if (sourceArea !== undefined && (entry.source.area ?? 'scene') !== sourceArea) return false;
    if (source.resolutionKind !== undefined
      && entry.source.resolutionKind !== source.resolutionKind) return false;
    if (source.triggerBatch !== undefined && entry.triggerBatch !== source.triggerBatch) return false;
    if (source.ownerChosenOrder !== undefined
      && entry.ownerChosenOrder !== source.ownerChosenOrder) return false;
    if (source.ownerOrderConfirmed !== undefined
      && entry.ownerOrderConfirmed !== source.ownerOrderConfirmed) return false;
    if (source.declaredBatch !== undefined && entry.declaredBatch !== source.declaredBatch) return false;
    return true;
  });
  return entries;
}

function expectedDeclaredNameSpec(
  state: GameState,
  source: Record<string, unknown>,
  path: string,
): DeclareNameSpec | null {
  const cardId = string(source.cardId, `${path}.source.cardId`);
  const abilityId = string(source.abilityId, `${path}.source.abilityId`);
  let printedSpec: DeclareNameSpec | null = null;
  try {
    const printed = def.card(cardId)?.abilities.find((ability) => ability.id === abilityId);
    printedSpec = findDeclareNameSpec(printed?.effect);
  } catch {
    fail(path, 'printed ability has an invalid declared-name descriptor');
  }

  const queuedSpecs: DeclareNameSpec[] = [];
  for (const queued of matchingDeclaredNameLineage(state, source)) {
    let queuedSpec: DeclareNameSpec | null;
    try {
      queuedSpec = findDeclareNameSpec(queued.effect);
    } catch {
      fail(path, 'queued declaration lineage has an invalid declared-name descriptor');
    }
    if (!queuedSpec) continue;
    if (printedSpec && !sameDeclareNameSpec(queuedSpec, printedSpec)) {
      fail(path, 'queued declaration lineage does not match the printed ability');
    }
    if (queuedSpecs.some((candidate) => !sameDeclareNameSpec(candidate, queuedSpec))) {
      fail(path, 'queued declaration lineage is ambiguous');
    }
    queuedSpecs.push(queuedSpec);
  }
  return queuedSpecs[0] ?? null;
}

function assertExactDeclaredNameKeys(
  item: Record<string, unknown>,
  bind: string,
  path: string,
): void {
  const keys = Object.keys(item);
  if (keys.length !== 1 || keys[0] !== bind) {
    fail(path, `must contain exactly the queued declaration bind ${bind}`);
  }
}

function assertEffectCtxDeclaredNameAuthority(
  state: GameState,
  item: Record<string, unknown>,
  path: string,
): void {
  const dyn = item.dyn !== undefined ? record(item.dyn, `${path}.dyn`) : undefined;
  const hasDynName = dyn !== undefined && Object.prototype.hasOwnProperty.call(dyn, 'declaredName');
  const hasNames = item.declaredNames !== undefined;
  const hasDomains = item.declaredNameDomains !== undefined;
  if (!hasDynName && !hasNames && !hasDomains) return;

  const source = record(item.source, `${path}.source`);
  const expected = expectedDeclaredNameSpec(state, source, path);
  if (!expected) {
    fail(path, 'declared-name state has no matching queued declaration lineage');
  }

  if (!hasNames || !hasDomains) {
    if (expected.domain === 'unrestricted') {
      if (!hasNames && !hasDomains) {
        if (hasDynName && typeof dyn?.declaredName !== 'string') {
          fail(`${path}.dyn.declaredName`, 'expected a string');
        }
        return;
      }
      if (!hasNames || hasDomains) {
        fail(path, 'legacy unrestricted declaration maps are inconsistent');
      }
      const legacyNames = record(item.declaredNames, `${path}.declaredNames`);
      assertExactDeclaredNameKeys(legacyNames, expected.bind, `${path}.declaredNames`);
      const legacyName = legacyNames[expected.bind];
      if (typeof legacyName !== 'string') {
        fail(`${path}.declaredNames.${expected.bind}`, 'expected a string');
      }
      if (!hasDynName || typeof dyn?.declaredName !== 'string') {
        fail(`${path}.dyn.declaredName`, 'expected a string');
      }
      if (dyn.declaredName !== legacyName) {
        fail(`${path}.dyn.declaredName`, 'must match the legacy declared name');
      }
      return;
    }
    fail(
      !hasNames ? `${path}.declaredNames` : `${path}.declaredNameDomains`,
      `is required by queued ${expected.domain} declaration lineage`,
    );
  }

  const names = record(item.declaredNames, `${path}.declaredNames`);
  const domains = record(item.declaredNameDomains, `${path}.declaredNameDomains`);
  assertExactDeclaredNameKeys(names, expected.bind, `${path}.declaredNames`);
  assertExactDeclaredNameKeys(domains, expected.bind, `${path}.declaredNameDomains`);
  if (!Object.prototype.hasOwnProperty.call(names, expected.bind)) {
    fail(`${path}.declaredNames.${expected.bind}`, 'is required by queued declaration lineage');
  }
  if (domains[expected.bind] !== expected.domain) {
    fail(
      `${path}.declaredNameDomains.${expected.bind}`,
      `must match queued ${expected.domain} declaration lineage`,
    );
  }

  const name = names[expected.bind];
  if (typeof name !== 'string') fail(`${path}.declaredNames.${expected.bind}`, 'expected a string');
  if (name === '' && !expected.optional) {
    fail(`${path}.declaredNames.${expected.bind}`, 'mandatory declaration cannot be empty');
  }
  if (name !== '' && resolveDeclaredName(expected.domain, name) !== name) {
    fail(`${path}.declaredNames.${expected.bind}`, `is not canonical for ${expected.domain}`);
  }
  if (name !== '') {
    if (!hasDynName || dyn?.declaredName !== name) {
      fail(`${path}.dyn.declaredName`, 'must match the canonical declared name');
    }
  } else if (!hasDynName || dyn?.declaredName !== '') {
    fail(`${path}.dyn.declaredName`, 'must match the skipped declaration');
  }
}

/** Cross-check persisted declaration data against state-owned queued ability lineage. */
export function assertPendingDeclaredNameAuthority(
  state: GameState,
  value: unknown,
  path = 'pending runtime',
): void {
  const seen = new WeakSet<object>();
  const visit = (candidate: unknown, candidatePath: string, depth: number): void => {
    if (candidate === null || typeof candidate !== 'object') return;
    if (depth > 32) fail(candidatePath, 'declared-name authority depth exceeded');
    if (seen.has(candidate)) return;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${candidatePath}[${index}]`, depth + 1));
      return;
    }
    const item = candidate as Record<string, unknown>;
    const source = item.source;
    if (item.bindings !== undefined
      && source !== null
      && typeof source === 'object'
      && !Array.isArray(source)
      && (source as Record<string, unknown>).player !== undefined
      && (source as Record<string, unknown>).area !== undefined) {
      assertEffectCtxDeclaredNameAuthority(state, item, candidatePath);
    }
    for (const [key, nested] of Object.entries(item)) {
      visit(nested, `${candidatePath}.${key}`, depth + 1);
    }
  };
  visit(value, path, 0);
}

function pendingPick(value: unknown, path: string, mode: ValidationMode): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  optionalPlayer(item.ownerPlayer, `${path}.ownerPlayer`);
  const verb = string(item.atomVerb, `${path}.atomVerb`);
  if (!ATOM_VERBS.has(verb)) fail(`${path}.atomVerb`, 'unknown atom verb');
  const candidates = array(item.candidates, `${path}.candidates`);
  const candidateUids = new Set<string>();
  candidates.forEach((raw, index) => {
    const candidateItem = record(raw, `${path}.candidates[${index}]`);
    const candidateUid = string(candidateItem.uid, `${path}.candidates[${index}].uid`);
    if (candidateUids.has(candidateUid)) {
      fail(`${path}.candidates[${index}].uid`, 'duplicate candidate uid');
    }
    candidateUids.add(candidateUid);
    const candidateCardId = string(candidateItem.cardId, `${path}.candidates[${index}].cardId`);
    player(candidateItem.player, `${path}.candidates[${index}].player`);
    const candidatePlayer = candidateItem.player as 'self' | 'opp';
    const candidateKind = candidateItem.kind === undefined
      ? undefined
      : oneOf(candidateItem.kind, new Set(['char', 'card', 'evidence']), `${path}.candidates[${index}].kind`);
    if (candidateKind === 'char') {
      if (candidateItem.area !== undefined || candidateItem.index !== undefined) {
        fail(`${path}.candidates[${index}]`, 'char candidates cannot carry an area or index');
      }
    } else if (candidateKind === 'card') {
      const area = oneOf(candidateItem.area, CARD_CANDIDATE_AREAS, `${path}.candidates[${index}].area`);
      let candidateIndex: number | undefined;
      if (INDEXED_CARD_CANDIDATE_AREAS.has(area)) {
        candidateIndex = integer(candidateItem.index, `${path}.candidates[${index}].index`);
      } else if (candidateItem.index !== undefined) {
        fail(`${path}.candidates[${index}].index`, 'not allowed for this area');
      }
      if (area === 'evidence' || area === 'remove' || (area === 'deck' && verb === 'deckRevealUntil')) {
        if (candidateUid !== cardOccurrenceUid(candidatePlayer, area, candidateCardId, candidateIndex!)) {
          fail(`${path}.candidates[${index}].uid`, 'does not match the indexed card occurrence');
        }
        boundOccurrenceWitness(
          candidateItem.occurrenceWitness,
          `${path}.candidates[${index}].occurrenceWitness`,
          candidatePlayer,
          area,
        );
      }
    } else if (candidateKind === 'evidence') {
      if (candidateItem.area !== undefined && candidateItem.area !== 'evidence') {
        fail(`${path}.candidates[${index}].area`, 'evidence candidates require area evidence');
      }
      const candidateIndex = integer(candidateItem.index, `${path}.candidates[${index}].index`);
      if (candidateUid !== `evidence:${candidatePlayer}:${candidateIndex}`) {
        fail(`${path}.candidates[${index}].uid`, 'does not match the indexed evidence occurrence');
      }
      boundOccurrenceWitness(
        candidateItem.occurrenceWitness,
        `${path}.candidates[${index}].occurrenceWitness`,
        candidatePlayer,
        'evidence',
      );
    } else {
      const area = candidateItem.area;
      if (area === 'evidence' || area === 'remove') {
        fail(`${path}.candidates[${index}].kind`, 'required for a physical evidence/remove occurrence');
      }
      if (area === undefined && (candidateItem.index !== undefined || candidateItem.occurrenceWitness !== undefined)) {
        fail(`${path}.candidates[${index}].kind`, 'required for an indexed physical occurrence');
      }
      if (area !== undefined) oneOf(area, CARD_CANDIDATE_AREAS, `${path}.candidates[${index}].area`);
      optionalInteger(candidateItem.index, `${path}.candidates[${index}].index`);
    }
    optionalString(candidateItem.hostUid, `${path}.candidates[${index}].hostUid`);
    optionalString(candidateItem.setCardInstanceId, `${path}.candidates[${index}].setCardInstanceId`);
    optionalString(candidateItem.occurrenceWitness, `${path}.candidates[${index}].occurrenceWitness`);
    if (candidateItem.hidden !== undefined && typeof candidateItem.hidden !== 'boolean') {
      fail(`${path}.candidates[${index}].hidden`, 'expected a boolean');
    }
  });
  const atomArgs = record(item.atomArgs, `${path}.atomArgs`);
  optionalPlayer(item.sceneEnterSwitchPlayer, `${path}.sceneEnterSwitchPlayer`);
  genericData(item.atomArgs, `${path}.atomArgs`, mode);
  const sceneEnterSwitchPick = isSceneEnterSwitchPickArgs(atomArgs);
  if (atomArgs.__sceneEnterSwitchPick !== undefined && !sceneEnterSwitchPick) {
    fail(`${path}.atomArgs.__sceneEnterSwitchPick`, 'must be true when present');
  }
  if (sceneEnterSwitchPick) {
    const switchContinuation = item.continuation !== null
      && typeof item.continuation === 'object'
      && !Array.isArray(item.continuation)
      ? item.continuation as Record<string, unknown>
      : undefined;
    const switchCtx = switchContinuation?.ctx !== null
      && typeof switchContinuation?.ctx === 'object'
      && !Array.isArray(switchContinuation.ctx)
      ? switchContinuation.ctx as Record<string, unknown>
      : undefined;
    const switchSource = switchCtx?.source !== null
      && typeof switchCtx?.source === 'object'
      && !Array.isArray(switchCtx.source)
      ? switchCtx.source as Record<string, unknown>
      : undefined;
    if (verb !== 'sceneEnter'
      || item.sceneEnterSwitchPlayer !== undefined
      || !isValidSceneEnterSwitchPickAuthority(
        atomArgs,
        item.player as 'self' | 'opp',
        item.ownerPlayer as 'self' | 'opp' | undefined,
        switchSource?.player as 'self' | 'opp' | undefined,
      )) {
      fail(path, 'scene-enter switch pick must be an unbundled sceneEnter decision');
    }
    const originalArgs = record(
      atomArgs.__sceneEnterSwitchOriginalArgs,
      `${path}.atomArgs.__sceneEnterSwitchOriginalArgs`,
    );
    if (originalArgs.__sceneEnterSwitchPick !== undefined) {
      fail(`${path}.atomArgs.__sceneEnterSwitchOriginalArgs`, 'must not contain a nested switch pick');
    }
    const switchTarget = record(atomArgs.target, `${path}.atomArgs.target`);
    const switchRange = record(switchTarget.n, `${path}.atomArgs.target.n`);
    const switchQuery = record(switchTarget.query, `${path}.atomArgs.target.query`);
    if (switchTarget.kind !== 'pick'
      || integer(switchRange.min, `${path}.atomArgs.target.n.min`) !== 1
      || integer(switchRange.max, `${path}.atomArgs.target.n.max`) !== 1
      || switchQuery.area !== 'scene') {
      fail(`${path}.atomArgs.target`, 'must select exactly one scene character');
    }
    candidates.forEach((raw, index) => {
      const candidate = record(raw, `${path}.candidates[${index}]`);
      if (candidate.kind !== 'char' || candidate.player !== item.player) {
        fail(`${path}.candidates[${index}]`, 'switch candidates must be live characters owned by the decision player');
      }
    });
  }
  if (verb === 'deckRevealUntil') {
    const pendingPlayer = item.player as 'self' | 'opp';
    if (atomArgs.__windowPlayer !== undefined) {
      player(atomArgs.__windowPlayer, `${path}.atomArgs.__windowPlayer`);
    }
    const windowPlayer = (atomArgs.__windowPlayer ?? pendingPlayer) as 'self' | 'opp';
    const windowWitness = string(atomArgs.__windowWitness, `${path}.atomArgs.__windowWitness`);
    boundOccurrenceWitness(
      windowWitness,
      `${path}.atomArgs.__windowWitness`,
      windowPlayer,
      'deck',
    );
    const windowIds = array(atomArgs.__windowIds, `${path}.atomArgs.__windowIds`)
      .map((value, index) => string(value, `${path}.atomArgs.__windowIds[${index}]`));
    const windowOccurrences = array(
      atomArgs.__windowOccurrences,
      `${path}.atomArgs.__windowOccurrences`,
    );
    if (windowIds.length !== windowOccurrences.length) {
      fail(`${path}.atomArgs`, 'deckRevealUntil window IDs and occurrences must have the same length');
    }
    const windowUids = new Set<string>();
    windowOccurrences.forEach((raw, index) => {
      const occurrence = record(raw, `${path}.atomArgs.__windowOccurrences[${index}]`);
      if (occurrence.kind !== 'card') {
        fail(`${path}.atomArgs.__windowOccurrences[${index}].kind`, 'deck occurrences require kind card');
      }
      if (occurrence.player !== windowPlayer || occurrence.area !== 'deck') {
        fail(`${path}.atomArgs.__windowOccurrences[${index}]`, 'must match the reveal window player and deck area');
      }
      const cardId = string(
        occurrence.cardId,
        `${path}.atomArgs.__windowOccurrences[${index}].cardId`,
      );
      const occurrenceIndex = integer(
        occurrence.index,
        `${path}.atomArgs.__windowOccurrences[${index}].index`,
      );
      const uid = string(occurrence.uid, `${path}.atomArgs.__windowOccurrences[${index}].uid`);
      if (uid !== cardOccurrenceUid(windowPlayer, 'deck', cardId, occurrenceIndex)) {
        fail(`${path}.atomArgs.__windowOccurrences[${index}].uid`, 'does not match the indexed card occurrence');
      }
      if (occurrence.occurrenceWitness !== windowWitness) {
        fail(`${path}.atomArgs.__windowOccurrences[${index}].occurrenceWitness`, 'must match the reveal window witness');
      }
      if (windowIds[index] !== cardId) {
        fail(`${path}.atomArgs.__windowOccurrences[${index}].cardId`, 'must match the reveal window card ID');
      }
      if (windowUids.has(uid)) {
        fail(`${path}.atomArgs.__windowOccurrences[${index}].uid`, 'duplicate reveal window occurrence');
      }
      windowUids.add(uid);
    });
    candidates.forEach((raw, index) => {
      const candidate = record(raw, `${path}.candidates[${index}]`);
      if (candidate.kind !== 'card'
        || candidate.player !== windowPlayer
        || candidate.area !== 'deck'
        || candidate.occurrenceWitness !== windowWitness
        || typeof candidate.uid !== 'string'
        || !windowUids.has(candidate.uid)) {
        fail(`${path}.candidates[${index}].occurrenceWitness`, 'must belong to the exact reveal window');
      }
    });
  }
  if (atomArgs.minimumPolicy !== undefined) {
    oneOf(atomArgs.minimumPolicy, new Set(['best-effort', 'exact']), `${path}.atomArgs.minimumPolicy`);
  }
  const nMin = integer(item.nMin, `${path}.nMin`);
  const nMax = integer(item.nMax, `${path}.nMax`);
  if (nMin > nMax) fail(path, 'nMin must be <= nMax');
  if (sceneEnterSwitchPick && (nMin !== 1 || nMax !== 1)) {
    fail(path, 'scene-enter switch pick must require exactly one selection');
  }
  const requestedNMin = item.requestedNMin === undefined
    ? undefined
    : integer(item.requestedNMin, `${path}.requestedNMin`);
  const requestedNMax = item.requestedNMax === undefined
    ? undefined
    : integer(item.requestedNMax, `${path}.requestedNMax`);
  if (requestedNMin !== undefined && requestedNMax !== undefined
    && requestedNMin > requestedNMax) {
    fail(path, 'requestedNMin must be <= requestedNMax');
  }
  if (item.minimumPolicy !== undefined) {
    oneOf(item.minimumPolicy, new Set(['best-effort', 'exact']), `${path}.minimumPolicy`);
  }
  if ((atomArgs.minimumPolicy !== undefined && item.minimumPolicy !== atomArgs.minimumPolicy)
    || (atomArgs.minimumPolicy === undefined && item.minimumPolicy === 'exact')) {
    fail(path, 'minimumPolicy must match atomArgs.minimumPolicy');
  }
  source(item.source, `${path}.source`);
  optionalString(item.publicHandRevealToken, `${path}.publicHandRevealToken`);
  ['distinctNames', 'distinctLevel', 'distinctColors', 'skipResolvesAtom']
    .forEach((key) => optionalBool(item[key], `${path}.${key}`));
  optionalInteger(item.perSideMax, `${path}.perSideMax`, 1);
  optionalInteger(item.aggregateLevelMax, `${path}.aggregateLevelMax`);
  if (item.forcedUids !== undefined) stringArray(item.forcedUids, `${path}.forcedUids`);
  if (sceneEnterSwitchPick
    && (requestedNMin !== 1
      || requestedNMax !== 1
      || item.minimumPolicy !== 'best-effort'
      || item.continuation === undefined
      || item.forcedUids !== undefined
      || item.perSideMax !== undefined
      || item.aggregateLevelMax !== undefined
      || item.distinctNames === true
      || item.distinctLevel === true
      || item.distinctColors === true
      || item.skipResolvesAtom === true)) {
    fail(path, 'scene-enter switch pick carries non-canonical selection authority');
  }
  const effectiveRange = effectivePendingPickRange(item as unknown as PendingEffectPickSide);
  if (!effectiveRange.feasible) fail(path, 'exact minimum is not feasible');
  if ((requestedNMin !== undefined || requestedNMax !== undefined || item.minimumPolicy !== undefined)
    && (nMin !== effectiveRange.min || nMax !== effectiveRange.max)) {
    fail(path, 'runtime bounds must match the canonical feasible range');
  }
  if (item.continuation !== undefined) continuation(item.continuation, `${path}.continuation`, mode);
  if (item.sceneEnterSwitchPlayer !== undefined) {
    const switchPlayer = item.sceneEnterSwitchPlayer as 'self' | 'opp';
    const otherPlayer = switchPlayer === 'self' ? 'opp' : 'self';
    if (switchPlayer !== item.player
      || item.continuation === undefined
      || !continuationMayEnterSceneForPlayer(item.continuation as ContinuationFrame, switchPlayer)
      || continuationMayEnterSceneForPlayer(item.continuation as ContinuationFrame, otherPlayer)) {
      fail(`${path}.sceneEnterSwitchPlayer`, 'must match a future scene-entry continuation');
    }
  }
}

function effectChoice(value: unknown, path: string, mode: ValidationMode): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  optionalPlayer(item.sourcePlayer, `${path}.sourcePlayer`);
  optionalString(item.publicHandRevealToken, `${path}.publicHandRevealToken`);
  source(item.source, `${path}.source`, true);
  array(item.options, `${path}.options`).forEach((raw, index) => {
    const option = record(raw, `${path}.options[${index}]`);
    integer(option.index, `${path}.options[${index}].index`);
    if (option.verb !== undefined) {
      const verb = string(option.verb, `${path}.options[${index}].verb`);
      if (!ATOM_VERBS.has(verb)) fail(`${path}.options[${index}].verb`, 'unknown atom verb');
    }
    if (option.args !== undefined) {
      record(option.args, `${path}.options[${index}].args`);
      genericData(option.args, `${path}.options[${index}].args`, mode);
    }
    optionalString(option.label, `${path}.options[${index}].label`);
    optionalBool(option.sceneEnter, `${path}.options[${index}].sceneEnter`);
  });
}

function effectOptional(value: unknown, path: string, mode: ValidationMode): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  optionalPlayer(item.ownerPlayer, `${path}.ownerPlayer`);
  optionalString(item.publicHandRevealToken, `${path}.publicHandRevealToken`);
  source(item.source, `${path}.source`, true);
  if (item.triggerPayload !== undefined) genericData(item.triggerPayload, `${path}.triggerPayload`, mode);
}

function chooseInterceptResponse(value: unknown, path: string): void {
  const item = record(value, path);
  if (item.kind !== undefined && item.kind !== 'response') fail(`${path}.kind`, 'expected response');
  if (item.resolution !== undefined
    && item.resolution !== 'cancel'
    && item.resolution !== 'discard-or-cancel') {
    fail(`${path}.resolution`, 'expected cancel or discard-or-cancel');
  }
  player(item.player, `${path}.player`);
  optionalPlayer(item.ownerPlayer, `${path}.ownerPlayer`);
  optionalString(item.publicHandRevealToken, `${path}.publicHandRevealToken`);
  const protector = record(item.protector, `${path}.protector`);
  string(protector.uid, `${path}.protector.uid`);
  string(protector.cardId, `${path}.protector.cardId`);
  string(protector.abilityId, `${path}.protector.abilityId`);
  optionalString(protector.setCardInstanceId, `${path}.protector.setCardInstanceId`);
  string(item.targetUid, `${path}.targetUid`);
}

function chooseIntercept(value: unknown, path: string): void {
  const item = record(value, path);
  if (item.kind !== 'order') {
    chooseInterceptResponse(value, path);
    return;
  }
  player(item.player, `${path}.player`);
  optionalString(item.publicHandRevealToken, `${path}.publicHandRevealToken`);
  const choices = array(item.choices, `${path}.choices`);
  if (choices.length < 2) fail(`${path}.choices`, 'order prompt requires at least two choices');
  choices.forEach((choice, index) => chooseInterceptResponse(choice, `${path}.choices[${index}]`));
}

function setCardChoice(value: unknown, path: string): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  string(item.hostUid, `${path}.hostUid`);
  array(item.entries, `${path}.entries`).forEach((raw, index) => {
    const entry = record(raw, `${path}.entries[${index}]`);
    string(entry.instanceId, `${path}.entries[${index}].instanceId`);
    integer(entry.ordinal, `${path}.entries[${index}].ordinal`);
    optionalBool(entry.hidden, `${path}.entries[${index}].hidden`);
    optionalString(entry.cardId, `${path}.entries[${index}].cardId`);
    optionalString(entry.hostUid, `${path}.entries[${index}].hostUid`);
    optionalString(entry.hostLabel, `${path}.entries[${index}].hostLabel`);
  });
  if (item.face !== undefined) oneOf(item.face, new Set(['down', 'up', 'any']), `${path}.face`);
  if (item.destination !== undefined) {
    const destination = record(item.destination, `${path}.destination`);
    oneOf(destination.area, new Set(['evidence', 'hand', 'scene']), `${path}.destination.area`);
    if (destination.area === 'evidence') bool(destination.faceUp, `${path}.destination.faceUp`);
    if (destination.area === 'scene') string(destination.hostUid, `${path}.destination.hostUid`);
  }
  source(item.source, `${path}.source`, true);
  if (item.purpose !== undefined) oneOf(item.purpose, new Set(['effect', 'cost']), `${path}.purpose`);
  if (item.purpose === 'cost') {
    const nMin = integer(item.nMin, `${path}.nMin`);
    const nMax = integer(item.nMax, `${path}.nMax`);
    if (nMin > nMax) fail(path, 'nMin must be <= nMax');
    stringArray(item.selectedInstanceIds, `${path}.selectedInstanceIds`);
  }
}

function setCardReplacement(value: unknown, path: string): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  string(item.fromUid, `${path}.fromUid`);
  string(item.setCardInstanceId, `${path}.setCardInstanceId`);
  array(item.candidates, `${path}.candidates`).forEach((raw, index) => {
    const candidateItem = record(raw, `${path}.candidates[${index}]`);
    string(candidateItem.uid, `${path}.candidates[${index}].uid`);
    string(candidateItem.cardId, `${path}.candidates[${index}].cardId`);
  });
  source(item.source, `${path}.source`, true);
  if (item.resume === undefined) return;
  const resume = record(item.resume, `${path}.resume`);
  const kind = oneOf(resume.kind, new Set([
    'scene-remove', 'scene-to-deck', 'scene-to-hand', 'scene-to-evidence', 'scene-to-stack',
  ]), `${path}.resume.kind`);
  if (kind === 'scene-remove') {
    oneOf(resume.cause, new Set(['contact-ap', 'effect', 'switch', 'cost', 'misplay-overflow']), `${path}.resume.cause`);
    optionalString(resume.byUid, `${path}.resume.byUid`);
    optionalPlayer(resume.byPlayer, `${path}.resume.byPlayer`);
    if (resume.leaveInterceptDecision !== undefined) {
      const decision = record(resume.leaveInterceptDecision, `${path}.resume.leaveInterceptDecision`);
      string(decision.interceptorUid, `${path}.resume.leaveInterceptDecision.interceptorUid`);
      bool(decision.accept, `${path}.resume.leaveInterceptDecision.accept`);
      optionalBool(decision.interceptorCostPaid, `${path}.resume.leaveInterceptDecision.interceptorCostPaid`);
    }
    if (resume.afterSceneRemove !== undefined) {
      const after = record(resume.afterSceneRemove, `${path}.resume.afterSceneRemove`);
      string(after.uid, `${path}.resume.afterSceneRemove.uid`);
      oneOf(after.cause, new Set(['contact-ap', 'effect', 'switch', 'cost', 'misplay-overflow']), `${path}.resume.afterSceneRemove.cause`);
      optionalString(after.byUid, `${path}.resume.afterSceneRemove.byUid`);
      optionalPlayer(after.byPlayer, `${path}.resume.afterSceneRemove.byPlayer`);
      if (after.leaveInterceptDecision !== undefined) {
        const decision = record(after.leaveInterceptDecision, `${path}.resume.afterSceneRemove.leaveInterceptDecision`);
        string(decision.interceptorUid, `${path}.resume.afterSceneRemove.leaveInterceptDecision.interceptorUid`);
        bool(decision.accept, `${path}.resume.afterSceneRemove.leaveInterceptDecision.accept`);
        optionalBool(decision.interceptorCostPaid, `${path}.resume.afterSceneRemove.leaveInterceptDecision.interceptorCostPaid`);
      }
    }
  } else if (kind === 'scene-to-deck') {
    oneOf(resume.pos, new Set(['bottom', 'top']), `${path}.resume.pos`);
  } else if (kind === 'scene-to-evidence') {
    bool(resume.faceUp, `${path}.resume.faceUp`);
    optionalString(resume.sourceCardId, `${path}.resume.sourceCardId`);
  } else if (kind === 'scene-to-stack') {
    string(resume.hostUid, `${path}.resume.hostUid`);
  }
}

function deckReveal(value: unknown, path: string): void {
  const item = record(value, path);
  player(item.player, `${path}.player`);
  oneOf(item.visibility, new Set(['public', 'private']), `${path}.visibility`);
  oneOf(item.viewer, new Set(['self', 'opp', 'all']), `${path}.viewer`);
  stringArray(item.revealed, `${path}.revealed`);
  if (item.matched !== null) string(item.matched, `${path}.matched`);
  optionalBool(item.awaitingPick, `${path}.awaitingPick`);
  if (item.presentation !== undefined) oneOf(item.presentation, new Set(['reveal-return']), `${path}.presentation`);
  if (item.source !== undefined) {
    const src = record(item.source, `${path}.source`);
    optionalString(src.cardId, `${path}.source.cardId`);
    optionalString(src.abilityId, `${path}.source.abilityId`);
    optionalString(src.uid, `${path}.source.uid`);
  }
}

function publicHandReveal(value: unknown, path: string): void {
  const item = record(value, path);
  player(item.owner, `${path}.owner`);
  oneOf(item.audience, new Set(['all']), `${path}.audience`);
  stringArray(item.cardIds, `${path}.cardIds`);
  oneOf(item.lifetime, new Set(['effect', 'presentation']), `${path}.lifetime`);
  string(item.resolutionToken, `${path}.resolutionToken`);
  if (item.origin !== undefined) {
    oneOf(item.origin, new Set(['deck-selected-card']), `${path}.origin`);
  }
  if (item.origin === 'deck-selected-card') {
    if (array(item.cardIds, `${path}.cardIds`).length !== 1) {
      fail(`${path}.cardIds`, 'deck-selected-card must expose exactly one selected card');
    }
    if (item.lifetime !== 'presentation') {
      fail(`${path}.lifetime`, 'deck-selected-card must be presentation-only');
    }
    if (item.handSnapshot !== undefined) {
      fail(`${path}.handSnapshot`, 'deck-selected-card must not persist the private hand');
    }
  } else {
    stringArray(item.handSnapshot, `${path}.handSnapshot`);
  }
  const src = record(item.source, `${path}.source`);
  optionalString(src.cardId, `${path}.source.cardId`);
  optionalString(src.abilityId, `${path}.source.abilityId`);
  optionalString(src.uid, `${path}.source.uid`);
}

function singleOrArray(value: unknown, path: string, check: (value: unknown, path: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => check(item, `${path}[${index}]`));
  } else check(value, path);
}

function marker(value: unknown, path: string, mode: ValidationMode): void {
  const item = record(value, path);
  const token = integer(item.token, `${path}.token`, 1);
  const owner = record(item.owner, `${path}.owner`);
  if (integer(owner.token, `${path}.owner.token`, 1) !== token) {
    fail(`${path}.owner.token`, 'must match marker token');
  }
  const snapshot = array(owner.snapshot, `${path}.owner.snapshot`);
  genericData(snapshot, `${path}.owner.snapshot`, mode);
}

export function assertPendingRuntimeValue(
  key: string,
  value: unknown,
  options: PendingRuntimeValidationOptions = {},
): void {
  const mode = options.mode ?? 'live';
  const path = key.replace(/^__/, '').replace('pending', 'pending ');
  genericData(value, path, mode);
  switch (key) {
    case '__pendingActionExpansion':
    case '__pendingChainContinuation':
      if (value !== null && value !== undefined) fail(path, 'retired channel must be empty');
      return;
    case '__pendingContactStartAxId':
      if (value !== null && value !== undefined) string(value, path);
      return;
    case '__pendingRuntimeStateMarker':
      if (!options.allowMarker) fail(path, 'internal marker cannot be persisted');
      nullable(value, path, (entry, entryPath) => marker(entry, entryPath, mode));
      return;
    case '__pendingEffectPickQueue':
      nullable(value, 'pendingEffectPick queue', (entry, entryPath) => {
        array(entry, entryPath).forEach((item, index) => pendingPick(item, `pendingEffectPick[${index}]`, mode));
      });
      return;
    case '__pendingEffectPickSide':
      nullable(value, 'pendingEffectPick', (entry, entryPath) => pendingPick(entry, entryPath, mode));
      return;
    case '__pendingEffectChoiceSide':
      nullable(value, 'pendingEffectChoice', (entry, entryPath) => effectChoice(entry, entryPath, mode));
      return;
    case '__pendingEffectOptionalSide':
      nullable(value, 'pendingEffectOptional', (entry, entryPath) => effectOptional(entry, entryPath, mode));
      return;
    case '__pendingChooseInterceptSide':
      nullable(value, 'pendingChooseIntercept', chooseIntercept);
      return;
    case '__pendingEffectRepeatOptionalSide':
      nullable(value, 'pendingEffectRepeatOptional', (entry, entryPath) => {
        const item = record(entry, entryPath);
        player(item.player, `${entryPath}.player`);
        source(item.source, `${entryPath}.source`, true);
        integer(item.remaining, `${entryPath}.remaining`, 1);
      });
      return;
    case '__pendingHirameki':
      nullable(value, 'pendingHirameki', (entry, entryPath) => {
        const item = record(entry, entryPath);
        player(item.player, `${entryPath}.player`);
        string(item.cardId, `${entryPath}.cardId`);
        string(item.abilityId, `${entryPath}.abilityId`);
        optionalBool(item.effectValid, `${entryPath}.effectValid`);
        optionalString(item.actorUid, `${entryPath}.actorUid`);
        optionalString(item.actionId, `${entryPath}.actionId`);
        optionalString(item.causalCorrelationEventId, `${entryPath}.causalCorrelationEventId`);
        optionalBool(item.gainDeferred, `${entryPath}.gainDeferred`);
        if (item.heldEvidence !== undefined) {
          const held = record(item.heldEvidence, `${entryPath}.heldEvidence`);
          string(held.token, `${entryPath}.heldEvidence.token`);
          player(held.player, `${entryPath}.heldEvidence.player`);
          string(held.cardId, `${entryPath}.heldEvidence.cardId`);
          if (item.actionId === undefined) {
            fail(`${entryPath}.actionId`, 'required for held evidence');
          }
          if (item.actorUid === undefined) {
            fail(`${entryPath}.actorUid`, 'required for held evidence');
          }
          bool(item.effectValid, `${entryPath}.effectValid`);
          if (held.player !== item.player) {
            fail(`${entryPath}.heldEvidence.player`, 'must match pending player');
          }
          if (held.cardId !== item.cardId) {
            fail(`${entryPath}.heldEvidence.cardId`, 'must match pending cardId');
          }
          if (item.occurrence !== undefined) {
            fail(entryPath, 'heldEvidence and occurrence are mutually exclusive');
          }
          if (item.causalCorrelationEventId !== undefined) {
            fail(`${entryPath}.causalCorrelationEventId`, 'held evidence has no remove-event correlation');
          }
        }
        if (item.occurrence !== undefined) {
          const occurrence = record(item.occurrence, `${entryPath}.occurrence`);
          string(occurrence.uid, `${entryPath}.occurrence.uid`);
          player(occurrence.player, `${entryPath}.occurrence.player`);
          string(occurrence.cardId, `${entryPath}.occurrence.cardId`);
          if (occurrence.area !== 'remove') fail(`${entryPath}.occurrence.area`, 'expected remove');
          integer(occurrence.index, `${entryPath}.occurrence.index`);
          occurrenceWitness(occurrence.occurrenceWitness, `${entryPath}.occurrence.occurrenceWitness`);
        }
      });
      return;
    case '__pendingMisread':
      nullable(value, 'pendingMisread', (entry, entryPath) => {
        const item = record(entry, entryPath);
        integer(item.continuationToken, `${entryPath}.continuationToken`, 1);
        player(item.player, `${entryPath}.player`);
        string(item.reasoningUid, `${entryPath}.reasoningUid`);
        player(item.reasoningPlayer, `${entryPath}.reasoningPlayer`);
        if (item.causalTrace !== undefined) causalTrace(item.causalTrace, `${entryPath}.causalTrace`);
        array(item.candidates, `${entryPath}.candidates`).forEach((raw, index) => {
          const candidateItem = record(raw, `${entryPath}.candidates[${index}]`);
          string(candidateItem.uid, `${entryPath}.candidates[${index}].uid`);
          if (typeof candidateItem.x !== 'number' || !Number.isFinite(candidateItem.x)) {
            fail(`${entryPath}.candidates[${index}].x`, 'expected a finite number');
          }
        });
      });
      return;
    case '__pendingEffectChoiceResume':
      nullable(value, 'pendingEffectChoiceResume', (entry, entryPath) => {
        const item = record(entry, entryPath);
        if (!Object.prototype.hasOwnProperty.call(item, 'effect')
          || !Object.prototype.hasOwnProperty.call(item, 'bindings')
          || !Object.prototype.hasOwnProperty.call(item, 'continuation')) {
          fail(entryPath, 'effect, bindings, and continuation are required');
        }
        if (item.effect !== null) effect(item.effect, `${entryPath}.effect`, mode);
        if (item.bindings !== null) {
          record(item.bindings, `${entryPath}.bindings`);
          genericData(item.bindings, `${entryPath}.bindings`, mode);
        }
        if (item.continuation !== null) continuation(item.continuation, `${entryPath}.continuation`, mode);
      });
      return;
    case '__pendingChooseInterceptResume':
      nullable(value, 'pendingChooseInterceptResume', (entry, entryPath) => {
        const item = record(entry, entryPath);
        pendingPick(item.pending, `${entryPath}.pending`, mode);
        string(item.pickedUid, `${entryPath}.pickedUid`);
        if (item.pickedUids !== undefined) stringArray(item.pickedUids, `${entryPath}.pickedUids`);
        optionalString(item.switchRemoveUid, `${entryPath}.switchRemoveUid`);
        if (item.switchRemoveUids !== undefined) stringArray(item.switchRemoveUids, `${entryPath}.switchRemoveUids`);
        if (item.batchToken !== undefined) integer(item.batchToken, `${entryPath}.batchToken`, 1);
        optionalBool(item.effectCancelled, `${entryPath}.effectCancelled`);
        if (item.guard !== undefined) chooseIntercept(item.guard, `${entryPath}.guard`);
        if (item.remainingGuards !== undefined) {
          array(item.remainingGuards, `${entryPath}.remainingGuards`).forEach((guard, index) => {
            chooseInterceptResponse(guard, `${entryPath}.remainingGuards[${index}]`);
          });
        }
      });
      return;
    case '__pendingEffectRepeatOptionalResume':
      nullable(value, 'pendingEffectRepeatOptionalResume', (entry, entryPath) => {
        const item = record(entry, entryPath);
        effect(item.body, `${entryPath}.body`, mode);
        integer(item.remaining, `${entryPath}.remaining`, 1);
        effectCtx(item.ctx, `${entryPath}.ctx`, mode);
        effectArray(item.remainder, `${entryPath}.remainder`, mode);
        if (item.continuation !== undefined) continuation(item.continuation, `${entryPath}.continuation`, mode);
      });
      return;
    case '__pendingEffectOptionalResume':
    case '__pendingRpsResume':
    case '__pendingSetCardChoiceResume':
      nullable(value, path, (entry, entryPath) => effect(entry, entryPath, mode));
      return;
    case '__pendingEffectOptionalContinuation':
    case '__pendingRpsContinuation':
    case '__pendingSetCardChoiceContinuation':
    case '__pendingSetCardReplacementContinuation':
      nullable(value, path, (entry, entryPath) => continuation(entry, entryPath, mode));
      return;
    case '__pendingEffectOptionalBindings':
    case '__pendingEffectOptionalCostPaid':
    case '__pendingRpsBindings':
    case '__pendingSetCardChoiceBindings':
      nullable(value, path, (entry, entryPath) => {
        record(entry, entryPath);
        genericData(entry, entryPath, mode);
      });
      return;
    case '__pendingRpsSide':
      nullable(value, 'pendingRps', (entry, entryPath) => {
        const item = record(entry, entryPath);
        player(item.player, `${entryPath}.player`);
        player(item.ownerPlayer, `${entryPath}.ownerPlayer`);
        oneOf(item.aiHand, new Set(['rock', 'paper', 'scissors']), `${entryPath}.aiHand`);
        source(item.source, `${entryPath}.source`, true);
      });
      return;
    case '__pendingSetCardChoiceSide':
    case '__pendingSetCardChoiceGuard':
      nullable(value, 'pendingSetCardChoice', setCardChoice);
      return;
    case '__pendingSetCardReplacementSide':
    case '__pendingSetCardReplacementGuard':
      nullable(value, 'pendingSetCardReplacement', setCardReplacement);
      return;
    case '__pendingDeckRevealSide':
      nullable(value, 'pendingDeckReveal', (entry, entryPath) => singleOrArray(entry, entryPath, deckReveal));
      return;
    case '__pendingPublicHandRevealSide':
      nullable(value, 'pendingPublicHandReveal', (entry, entryPath) => singleOrArray(entry, entryPath, publicHandReveal));
      return;
    case '__pendingDeckReorderSide':
      nullable(value, 'pendingDeckReorder', (entry, entryPath) => {
        const item = record(entry, entryPath);
        player(item.player, `${entryPath}.player`);
        stringArray(item.cardIds, `${entryPath}.cardIds`);
        if ((item.deckSnapshot === undefined) !== (item.occurrences === undefined)) {
          fail(entryPath, 'deckSnapshot and occurrences must be provided together');
        }
        if (item.deckSnapshot === undefined) {
          fail(entryPath, 'deckSnapshot and occurrences are required');
        }
        if (item.deckSnapshot !== undefined) stringArray(item.deckSnapshot, `${entryPath}.deckSnapshot`);
        if (item.occurrenceWitness === undefined) fail(entryPath, 'occurrenceWitness is required');
        boundOccurrenceWitness(
          item.occurrenceWitness,
          `${entryPath}.occurrenceWitness`,
          item.player as 'self' | 'opp',
          'deck',
        );
        const validatedOccurrences: Array<{ cardId: string; index: number }> = [];
        if (item.occurrences !== undefined) {
          array(item.occurrences, `${entryPath}.occurrences`).forEach((raw, index) => {
            const occurrence = record(raw, `${entryPath}.occurrences[${index}]`);
            validatedOccurrences.push({
              cardId: string(occurrence.cardId, `${entryPath}.occurrences[${index}].cardId`),
              index: integer(occurrence.index, `${entryPath}.occurrences[${index}].index`),
            });
          });
        }
        if (item.deckSnapshot !== undefined && item.occurrences !== undefined) {
          const cardIds = item.cardIds as string[];
          const deckSnapshot = item.deckSnapshot as string[];
          if (validatedOccurrences.length !== cardIds.length) {
            fail(`${entryPath}.occurrences`, 'count must match cardIds');
          }
          if (!hasSameStringMultiset(cardIds, validatedOccurrences.map(occurrence => occurrence.cardId))) {
            fail(`${entryPath}.occurrences`, 'card multiset must match cardIds');
          }
          const indexes = new Set<number>();
          validatedOccurrences.forEach((occurrence, index) => {
            if (occurrence.index >= deckSnapshot.length) {
              fail(`${entryPath}.occurrences[${index}].index`, 'must reference deckSnapshot');
            }
            if (indexes.has(occurrence.index)) {
              fail(`${entryPath}.occurrences[${index}].index`, 'must be unique');
            }
            indexes.add(occurrence.index);
            if (deckSnapshot[occurrence.index] !== occurrence.cardId) {
              fail(`${entryPath}.occurrences[${index}]`, 'must match deckSnapshot occurrence');
            }
          });
        }
        if (item.ctx === undefined) fail(entryPath, 'ctx is required');
        effectCtx(item.ctx, `${entryPath}.ctx`, mode);
        if (item.continuation !== undefined) continuation(item.continuation, `${entryPath}.continuation`, mode);
      });
      return;
    case '__pendingDeckPlaceSide':
      nullable(value, 'pendingDeckPlace', (entry, entryPath) => {
        const item = record(entry, entryPath);
        player(item.player, `${entryPath}.player`);
        stringArray(item.cardIds, `${entryPath}.cardIds`);
        player(item.ownerPlayer, `${entryPath}.ownerPlayer`);
        const hasSnapshot = item.deckSnapshot !== undefined;
        const hasOccurrences = item.occurrences !== undefined;
        if (hasSnapshot !== hasOccurrences) {
          fail(entryPath, 'deckSnapshot and occurrences must be provided together');
        }
        if (!hasSnapshot) {
          fail(entryPath, 'deckSnapshot and occurrences are required');
        }
        if (hasSnapshot) stringArray(item.deckSnapshot, `${entryPath}.deckSnapshot`);
        if (item.occurrenceWitness === undefined) fail(entryPath, 'occurrenceWitness is required');
        boundOccurrenceWitness(
          item.occurrenceWitness,
          `${entryPath}.occurrenceWitness`,
          item.player as 'self' | 'opp',
          'deck',
        );
        const validatedOccurrences: Array<{ cardId: string; index: number }> = [];
        if (hasOccurrences) {
          array(item.occurrences, `${entryPath}.occurrences`).forEach((raw, index) => {
            const occurrence = record(raw, `${entryPath}.occurrences[${index}]`);
            validatedOccurrences.push({
              cardId: string(occurrence.cardId, `${entryPath}.occurrences[${index}].cardId`),
              index: integer(occurrence.index, `${entryPath}.occurrences[${index}].index`),
            });
          });
        }
        if (hasSnapshot && hasOccurrences) {
          const cardIds = item.cardIds as string[];
          const deckSnapshot = item.deckSnapshot as string[];
          if (validatedOccurrences.length !== cardIds.length) {
            fail(`${entryPath}.occurrences`, 'count must match cardIds');
          }
          if (!hasSameStringMultiset(cardIds, validatedOccurrences.map(occurrence => occurrence.cardId))) {
            fail(`${entryPath}.occurrences`, 'card multiset must match cardIds');
          }
          const indexes = new Set<number>();
          validatedOccurrences.forEach((occurrence, index) => {
            if (occurrence.index >= deckSnapshot.length) {
              fail(`${entryPath}.occurrences[${index}].index`, 'must reference deckSnapshot');
            }
            if (indexes.has(occurrence.index)) {
              fail(`${entryPath}.occurrences[${index}].index`, 'must be unique');
            }
            indexes.add(occurrence.index);
            if (deckSnapshot[occurrence.index] !== occurrence.cardId) {
              fail(`${entryPath}.occurrences[${index}]`, 'must match deckSnapshot occurrence');
            }
          });
        }
        if (item.ctx === undefined) fail(entryPath, 'ctx is required');
        effectCtx(item.ctx, `${entryPath}.ctx`, mode);
        if (item.continuation !== undefined) continuation(item.continuation, `${entryPath}.continuation`, mode);
      });
      return;
    default:
      fail(path, 'unsupported pending runtime key');
  }
}
