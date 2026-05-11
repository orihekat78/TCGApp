// engine.dyn.eval — Dyn (late-bound) expression evaluator
// spec: Phase 3 Group B Task 3.3
// rules: 15-abilities-effects.md (Effect Descriptor parameterization)
//
// Effect DSL uses string placeholders that need late-bound evaluation:
//   - $self.ap, $self.lp, $self.uid — value from ctx.source (effect source uid)
//   - $contact.byUid, $contact.targetUid, $contact.guardUid, $contact.attackerSide — from ctx.contact
//   - $cost.<key>.<path> — from ctx.costPaid[<key>]
//   - $dyn.X — from ctx.dyn[X] (pre-computed by parent effect)
//   - $pick — placeholder for target-pick result, NOT evaluable here
//
// Supports simple arithmetic: $dyn.X * 1000, $self.ap + 100
// Left-to-right precedence (no parens). TODO Phase 5: parentheses / precedence if needed.
// SECURITY: does NOT use eval() or new Function().

import type { GameState } from '@/engine/types';
import type { EffectCtx } from '@/engine/types';
import { char as charRead } from '@/engine/read/char.js';

type DynValue = number | string | boolean | undefined;

/**
 * Evaluate a dyn expression.
 * If expr is a number/boolean, return as-is.
 * If expr is a string not starting with '$' and not containing operators, return as-is.
 * Otherwise tokenize and evaluate.
 */
export function evalDyn(state: GameState, expr: string | number | boolean, ctx: EffectCtx): DynValue {
  if (typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr !== 'string') {
    throw new Error(`dyn.eval: unsupported expr type: ${typeof expr}`);
  }

  // Plain string passthrough: no '$' anywhere → literal
  if (!expr.includes('$')) {
    // also passthrough numeric literals expressed as string? Spec implies pass-through.
    return expr;
  }

  // Tokenize and evaluate
  return evaluateExpression(state, expr, ctx);
}

const OPERATORS = new Set(['+', '-', '*', '/', '%']);

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' };

function tokenize(state: GameState, expr: string, ctx: EffectCtx): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = expr.length;

  while (i < n) {
    const ch = expr[i];

    // Whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Operator
    if (OPERATORS.has(ch)) {
      tokens.push({ type: 'op', value: ch as '+' | '-' | '*' | '/' | '%' });
      i++;
      continue;
    }

    // $-prefixed placeholder
    if (ch === '$') {
      // Read $root.path.path...
      let j = i + 1;
      while (j < n && !OPERATORS.has(expr[j]) && expr[j] !== ' ' && expr[j] !== '\t') {
        j++;
      }
      const placeholder = expr.slice(i, j);
      const resolved = resolvePlaceholder(state, placeholder, ctx);
      if (typeof resolved === 'number') {
        tokens.push({ type: 'num', value: resolved });
      } else if (typeof resolved === 'string') {
        tokens.push({ type: 'str', value: resolved });
      } else if (typeof resolved === 'boolean') {
        // booleans are not arithmetic-able, treat as string here
        tokens.push({ type: 'str', value: String(resolved) });
      } else {
        throw new Error(`dyn.eval: placeholder ${placeholder} resolved to non-primitive`);
      }
      i = j;
      continue;
    }

    // Number literal
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < n && ((expr[j] >= '0' && expr[j] <= '9') || expr[j] === '.')) j++;
      const value = Number(expr.slice(i, j));
      if (Number.isNaN(value)) throw new Error(`dyn.eval: bad number at ${i}: ${expr.slice(i, j)}`);
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }

    throw new Error(`dyn.eval: unexpected character '${ch}' at ${i} in "${expr}"`);
  }

  return tokens;
}

function evaluateExpression(state: GameState, expr: string, ctx: EffectCtx): DynValue {
  const tokens = tokenize(state, expr, ctx);
  if (tokens.length === 0) return undefined;

  // Single token: return raw value
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.type === 'op') throw new Error(`dyn.eval: lone operator in "${expr}"`);
    return t.value;
  }

  // Arithmetic: tokens must alternate value op value op value...
  // Left-to-right precedence (TODO Phase 5: standard precedence with parens)
  let acc: number;
  const first = tokens[0];
  if (first.type !== 'num') {
    throw new Error(`dyn.eval: expected number at start of arithmetic in "${expr}"`);
  }
  acc = first.value;

  for (let k = 1; k < tokens.length; k += 2) {
    const opTok = tokens[k];
    const valTok = tokens[k + 1];
    if (opTok?.type !== 'op') throw new Error(`dyn.eval: expected operator at index ${k} in "${expr}"`);
    if (valTok?.type !== 'num') throw new Error(`dyn.eval: expected number at index ${k + 1} in "${expr}"`);
    switch (opTok.value) {
      case '+': acc = acc + valTok.value; break;
      case '-': acc = acc - valTok.value; break;
      case '*': acc = acc * valTok.value; break;
      case '/': acc = acc / valTok.value; break;
      case '%': acc = acc % valTok.value; break;
    }
  }
  return acc;
}

/**
 * Resolve a $-prefixed placeholder like '$self.ap', '$dyn.x', '$cost.flipFaceUpEvidence.count'.
 * Returns the resolved primitive value.
 * Throws if placeholder is unrecognized or evaluates to undefined where required.
 */
function resolvePlaceholder(state: GameState, placeholder: string, ctx: EffectCtx): DynValue {
  if (placeholder === '$pick') {
    throw new Error('dyn.eval: $pick is not evaluable here');
  }

  // Strip leading '$' and split by '.'
  const body = placeholder.slice(1);
  const parts = body.split('.');
  if (parts.length === 0) {
    throw new Error(`dyn.eval: invalid placeholder "${placeholder}"`);
  }

  const root = parts[0];
  const rest = parts.slice(1);

  switch (root) {
    case 'self':
      return resolveSelf(state, rest, ctx, placeholder);
    case 'contact':
      return resolveContact(rest, ctx, placeholder);
    case 'cost':
      return resolveCost(rest, ctx, placeholder);
    case 'dyn':
      return resolveDyn(rest, ctx, placeholder);
    default:
      throw new Error(`dyn.eval: unknown placeholder root "$${root}" in "${placeholder}"`);
  }
}

function resolveSelf(state: GameState, rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $self requires a property path (e.g. $self.ap) — got "${original}"`);
  }
  const prop = rest[0];
  const uid = ctx.source.uid;
  if (!uid) {
    throw new Error(`dyn.eval: $self.${prop} requires ctx.source.uid (none provided)`);
  }
  switch (prop) {
    case 'ap':
      // Current effective AP via existing read API (includes overrides).
      // TODO Phase 5: turnEffect-based modifiers may need further integration here.
      return charRead.ap(state, uid);
    case 'lp':
      return charRead.lp(state, uid);
    case 'uid':
      return uid;
    case 'cardId':
      return ctx.source.cardId ?? '';
    default:
      throw new Error(`dyn.eval: unknown $self property "${prop}" in "${original}"`);
  }
}

function resolveContact(rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (!ctx.contact) {
    throw new Error(`dyn.eval: ${original} requires ctx.contact (none provided)`);
  }
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $contact requires a property path — got "${original}"`);
  }
  const prop = rest[0];
  switch (prop) {
    case 'byUid':
      return ctx.contact.byUid;
    case 'targetUid':
      return ctx.contact.targetUid;
    case 'guardUid':
      return ctx.contact.guardUid;
    case 'attackerSide':
      return ctx.contact.attackerSide;
    default:
      throw new Error(`dyn.eval: unknown $contact property "${prop}" in "${original}"`);
  }
}

function resolveCost(rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length < 2) {
    throw new Error(`dyn.eval: $cost requires <key>.<path> — got "${original}"`);
  }
  const key = rest[0];
  const innerPath = rest.slice(1);
  const costPaid = ctx.costPaid;
  if (!costPaid) {
    throw new Error(`dyn.eval: ${original} requires ctx.costPaid (none provided)`);
  }
  const entry = costPaid[key];
  if (entry === undefined) {
    throw new Error(`dyn.eval: ctx.costPaid['${key}'] is undefined (in "${original}")`);
  }
  return drillDown(entry, innerPath, original);
}

function resolveDyn(rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $dyn requires a key — got "${original}"`);
  }
  const dyn = ctx.dyn;
  if (!dyn) {
    throw new Error(`dyn.eval: ${original} requires ctx.dyn (none provided)`);
  }
  const first = rest[0];
  if (!(first in dyn)) {
    throw new Error(`dyn.eval: ctx.dyn['${first}'] is undefined (in "${original}")`);
  }
  return drillDown(dyn[first], rest.slice(1), original);
}

function drillDown(value: unknown, path: string[], original: string): DynValue {
  let cur: unknown = value;
  for (const seg of path) {
    if (cur === null || cur === undefined) {
      throw new Error(`dyn.eval: cannot read "${seg}" on null/undefined (in "${original}")`);
    }
    if (typeof cur !== 'object') {
      throw new Error(`dyn.eval: cannot read "${seg}" on non-object (in "${original}")`);
    }
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (typeof cur === 'number' || typeof cur === 'string' || typeof cur === 'boolean') {
    return cur;
  }
  if (cur === undefined) return undefined;
  throw new Error(`dyn.eval: resolved value is not primitive (in "${original}")`);
}

export const dyn = {
  eval: evalDyn,
};
