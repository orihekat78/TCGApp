import type { EffectCtx } from '@/engine/types';

export type RemoveSetCardWitness =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'valid'; hostUids: string[]; instanceIds?: string[] };

function isDenseStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
    if (typeof value[index] !== 'string' || value[index].length === 0) return false;
  }
  return true;
}

/** Parse the public witness without dropping malformed elements into fallback. */
export function parseRemoveSetCardWitness(value: unknown): RemoveSetCardWitness {
  if (value === undefined) return { kind: 'absent' };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { kind: 'invalid' };
  const raw = value as { hostUids?: unknown; instanceIds?: unknown };
  if (!Object.prototype.hasOwnProperty.call(raw, 'hostUids') || !isDenseStringArray(raw.hostUids)) {
    return { kind: 'invalid' };
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'instanceIds')) {
    return { kind: 'valid', hostUids: raw.hostUids };
  }
  if (!isDenseStringArray(raw.instanceIds) || raw.instanceIds.length !== raw.hostUids.length) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', hostUids: raw.hostUids, instanceIds: raw.instanceIds };
}

/** Read the same witness shape used by authorization and actual payment. */
export function readRemoveSetCardWitness(ctx: EffectCtx): RemoveSetCardWitness {
  const params = ctx.dyn?.['costParams'] as Record<string, unknown> | undefined;
  if (!params || !Object.prototype.hasOwnProperty.call(params, 'removeSetCard')) return { kind: 'absent' };
  const value = params['removeSetCard'];
  return value === undefined ? { kind: 'invalid' } : parseRemoveSetCardWitness(value);
}
