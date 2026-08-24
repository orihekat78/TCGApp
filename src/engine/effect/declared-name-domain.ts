import type { DeclaredNameDomain, Effect } from '../types/index.js';
import { _allRegistered } from '../read/def.js';
import { allCardNameComponentsForDef } from '../target/card-def-registry.js';

export const DECLARED_NAME_DOMAINS = [
  'unrestricted',
  'registered-card-name',
  'registered-character-card-name',
] as const;

export type { DeclaredNameDomain } from '../types/index.js';

export type DeclareNameSpec = {
  bind: string;
  optional: boolean;
  domain: DeclaredNameDomain;
};

export function declaredNameDomain(value: unknown): DeclaredNameDomain {
  if (value === undefined || value === 'unrestricted') return 'unrestricted';
  if (value === 'registered-card-name') return value;
  if (value === 'registered-character-card-name') return value;
  throw new Error(`invalid declared-name domain: ${String(value)}`);
}

function findIn(value: unknown, optionalAncestor = false): DeclareNameSpec | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const effect = value as Record<string, unknown>;
  switch (effect.kind) {
    case 'atom': {
      if (effect.verb !== 'declareName') return null;
      const args = effect.args !== null && typeof effect.args === 'object' && !Array.isArray(effect.args)
        ? effect.args as Record<string, unknown>
        : {};
      return {
        bind: typeof args.bind === 'string' ? args.bind : '',
        optional: optionalAncestor || args.optional === true,
        domain: declaredNameDomain(args.domain),
      };
    }
    case 'sequence':
    case 'parallel':
    case 'chain':
      for (const step of Array.isArray(effect.steps) ? effect.steps : []) {
        const found = findIn(step, optionalAncestor);
        if (found) return found;
      }
      return null;
    case 'choice':
      for (const option of Array.isArray(effect.options) ? effect.options : []) {
        const found = findIn(option, optionalAncestor);
        if (found) return found;
      }
      return null;
    case 'conditional':
      return findIn(effect.then, optionalAncestor) ?? findIn(effect.else, optionalAncestor);
    case 'optional':
      return findIn(effect.effect, true);
    case 'forEach':
      return findIn(effect.do, optionalAncestor);
    case 'traitChoice':
      return findIn(effect.then, optionalAncestor);
    case 'rps':
      return findIn(effect.win, optionalAncestor) ?? findIn(effect.lose, optionalAncestor);
    case 'repeatOptional':
      return findIn(effect.body, true);
    case 'replace':
      return findIn(effect.with, optionalAncestor);
    default:
      return null;
  }
}

export function findDeclareNameSpec(effect: Effect | undefined): DeclareNameSpec | null {
  return findIn(effect);
}

export function declaredNameCandidates(domain: DeclaredNameDomain): string[] {
  const defs = _allRegistered().filter((card) => (
    domain !== 'registered-character-card-name' || card.kind === 'character'
  ));
  return [...new Set(
    defs.flatMap((card) => allCardNameComponentsForDef(card))
      .map((name) => name.trim())
      .filter(Boolean),
  )].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function comparableName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase('ja-JP');
}

function isWithinOneEdit(left: string, right: string): boolean {
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) return isWithinOneEdit(right, left);
  let edits = 0;
  for (let ai = 0, bi = 0; ai < a.length || bi < b.length;) {
    if (a[ai] === b[bi]) {
      ai += 1;
      bi += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length === b.length) {
      ai += 1;
      bi += 1;
    } else {
      bi += 1;
    }
  }
  return true;
}

/** Resolve only when the supplied information identifies one canonical name. */
export function resolveDeclaredName(
  domain: DeclaredNameDomain,
  value: unknown,
): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const supplied = value.trim();
  if (domain === 'unrestricted') return supplied;
  const key = comparableName(supplied);
  const candidates = declaredNameCandidates(domain);
  const exact = candidates.filter((candidate) => comparableName(candidate) === key);
  if (exact.length === 1) return exact[0]!;
  const abbreviations = candidates.filter((candidate) => comparableName(candidate).includes(key));
  if (abbreviations.length === 1) return abbreviations[0]!;
  if (abbreviations.length > 1) return null;
  if (Array.from(key).length < 3) return null;
  const near = candidates.filter((candidate) => isWithinOneEdit(key, comparableName(candidate)));
  return near.length === 1 ? near[0]! : null;
}

export function isDeclaredNameAllowed(domain: DeclaredNameDomain, value: unknown): boolean {
  return resolveDeclaredName(domain, value) !== null;
}

export function isDeclaredNameValidForEffect(
  effect: Effect | undefined,
  value: unknown,
): boolean {
  let spec: DeclareNameSpec | null;
  try {
    spec = findDeclareNameSpec(effect);
  } catch {
    return false;
  }
  if (!spec) return true;
  if (typeof value !== 'string' || value.trim() === '') {
    // Preserve legacy unrestricted AI behavior; constrained mandatory
    // declarations must provide a registered character name.
    return spec.optional || spec.domain === 'unrestricted';
  }
  return isDeclaredNameAllowed(spec.domain, value);
}
