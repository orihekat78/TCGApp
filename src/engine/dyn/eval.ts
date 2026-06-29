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
import { scene } from '@/engine/read/scene.js'; // session64: $self.setCardCount (このキャラの setCards 枚数)
import { def } from '@/engine/read/def.js'; // BUG-114: $discarded.level/ap で discard したカードの printed 値を参照

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
const PARENS = new Set(['(', ')']);
// Cleanup Phase #1 (2026-05-22): 演算子優先度 (precedence) と括弧 (parens) 対応
// `*` / `/` / `%` > `+` / `-`、括弧でグループ化可能
const PRECEDENCE: Record<'+' | '-' | '*' | '/' | '%', number> = {
  '+': 1, '-': 1,
  '*': 2, '/': 2, '%': 2,
};

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' }
  | { type: 'lparen' }
  | { type: 'rparen' };

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

    // Parenthesis (Cleanup Phase #1)
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    // $-prefixed placeholder
    if (ch === '$') {
      // Read $root.path.path...
      let j = i + 1;
      while (j < n && !OPERATORS.has(expr[j]) && !PARENS.has(expr[j]) && expr[j] !== ' ' && expr[j] !== '\t') {
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
  const raw = tokenize(state, expr, ctx);
  if (raw.length === 0) return undefined;

  // Fold unary minus: a leading '-' token, or a '-' immediately after another op or '(',
  // combined with the following number token becomes a negative number literal.
  // This allows '-3 * $dyn.x' / '$dyn.x + -1' / '($a + -2)' to work correctly.
  const tokens: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (
      t.type === 'op' &&
      t.value === '-' &&
      (i === 0 || raw[i - 1]?.type === 'op' || raw[i - 1]?.type === 'lparen')
    ) {
      const next = raw[i + 1];
      if (next?.type === 'num') {
        tokens.push({ type: 'num', value: -next.value });
        i++; // consume the number token
        continue;
      }
    }
    tokens.push(t);
  }

  // Single token: return raw value
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.type === 'op' || t.type === 'lparen' || t.type === 'rparen') {
      throw new Error(`dyn.eval: lone operator/paren in "${expr}"`);
    }
    return t.value;
  }

  // Cleanup Phase #1 (2026-05-22): shunting-yard 法で precedence + parens 対応
  // 1. infix → postfix (RPN) 変換
  // 2. RPN を stack で評価
  // 文字列 token は arithmetic に含まれないため reject
  const output: Token[] = [];
  const opStack: Token[] = [];
  for (const t of tokens) {
    if (t.type === 'num') {
      output.push(t);
    } else if (t.type === 'str') {
      throw new Error(`dyn.eval: string operand in arithmetic "${expr}"`);
    } else if (t.type === 'op') {
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.type === 'op' && PRECEDENCE[top.value] >= PRECEDENCE[t.value]) {
          output.push(opStack.pop()!);
        } else {
          break;
        }
      }
      opStack.push(t);
    } else if (t.type === 'lparen') {
      opStack.push(t);
    } else if (t.type === 'rparen') {
      // pop until matching lparen
      let found = false;
      while (opStack.length > 0) {
        const top = opStack.pop()!;
        if (top.type === 'lparen') {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) throw new Error(`dyn.eval: unmatched ')' in "${expr}"`);
    }
  }
  // drain operator stack
  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top.type === 'lparen' || top.type === 'rparen') {
      throw new Error(`dyn.eval: unmatched '(' in "${expr}"`);
    }
    output.push(top);
  }

  // Evaluate RPN
  const stack: number[] = [];
  for (const t of output) {
    if (t.type === 'num') {
      stack.push(t.value);
    } else if (t.type === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) {
        throw new Error(`dyn.eval: operator '${t.value}' missing operand in "${expr}"`);
      }
      switch (t.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(a / b); break;
        case '%': stack.push(a % b); break;
      }
    }
  }
  if (stack.length !== 1) {
    throw new Error(`dyn.eval: invalid expression "${expr}" (stack size ${stack.length})`);
  }
  return stack[0];
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
    case 'discarded':
      return resolveDiscarded(ctx, rest, placeholder);
    default:
      throw new Error(`dyn.eval: unknown placeholder root "$${root}" in "${placeholder}"`);
  }
}

function resolveSelf(state: GameState, rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $self requires a property path (e.g. $self.ap) — got "${original}"`);
  }
  const prop = rest[0];
  // $self.sceneTrait.<trait>: ctx.source.player の現場で特徴 <trait> を持つキャラ数 (D08007 カットイン等のスケーリング)。
  // カットインは手札カード由来で ctx.source.uid を持たないため、uid 要件より前に player ベースで数える。
  if (prop === 'sceneTrait') {
    const trait = rest[1];
    if (typeof trait !== 'string' || trait.length === 0) {
      throw new Error(`dyn.eval: $self.sceneTrait requires a trait name (e.g. $self.sceneTrait.少年探偵団) — got "${original}"`);
    }
    const side = ctx.source.player;
    return state.players[side].scene.filter(c => charRead.traits(state, c.uid).includes(trait)).length;
  }
  // $self.faceUpEvidence: ctx.source.player の表向き証拠枚数 (D08005 a1 の AP スケーリング等)。
  // sceneTrait と同じく uid 要件より前に player ベースで数える (continuous modifier は uid を渡すが統一)。
  if (prop === 'faceUpEvidence') {
    const side = ctx.source.player;
    return state.players[side].evidence.filter(e => e.faceUp).length;
  }
  // Task D E3 (2026-06-12): $self.fileCount — 所有者の FILE 枚数 (アシストパートナー含む、
  // rules/17 §【FILE(X)】と同じ計数)。「FILEエリアの枚数以下のレベル」系 (B08060/B09052/B05102) の布石。
  if (prop === 'fileCount') {
    const side = ctx.source.player;
    return state.players[side].file.length;
  }
  // engine additive (2026-06-29): $self.oppSceneCount — 相手 (ctx.source.player の対戦相手) の現場キャラ枚数。
  // B08086 テキーラ「相手の現場にいるキャラ1枚につき AP+2000」継続修飾の dyn 足場 (rules/15 §常時有効型)。
  // sceneTrait/faceUpEvidence/fileCount と同じ player ベース (uid 要件より前)、フィルタ無し総数。静的
  // state.players[opp].scene.length 読み → continuousDelta 再帰経路 (BUG-156/157) を踏まない。現場のみ
  // (相手パートナーエリアの MR は数えない、rules/03 §現場=scene)。
  if (prop === 'oppSceneCount') {
    const opp = ctx.source.player === 'self' ? 'opp' : 'self';
    return state.players[opp].scene.length;
  }
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
    // session64: $self.setCardCount — このキャラに (裏向き/表向き) セットされたカード枚数 (rules/16)。
    // B05030 主眼「セットされているカード1枚につき AP+1000」継続修飾の dyn 足場。setCards.length は
    // 静的 state field → ap/lp の continuousDelta 再帰経路を踏まない (BUG-156/157 と無縁)。
    case 'setCardCount':
      return scene.byUid(state, uid)?.setCards.length ?? 0;
    // engine additive: $self.stackedCount — このキャラの下に重なっているカード枚数 (rules/16)。
    // B06006 a2「下に重なっているカード1枚につき AP+1000」継続修飾の dyn 足場。setCardCount と同型だが
    // stackedCards は number field (重ね≠セット rules/16: 重ねは枚数以外の情報を持たない)。静的 state
    // field 読みのため ap/lp の continuousDelta 再帰経路を踏まない (BUG-156/157 と無縁)。
    case 'stackedCount':
      return scene.byUid(state, uid)?.stackedCards ?? 0;
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

// $discarded.<field>: discard{bind:'$discarded'} で除去した手札カードの printed 値 (BUG-114)。
// 「リムーブしたカードのレベル/AP1000につきAP+1000」(B05040/B08055) のスケーリング用。
// カードは既に remove へ移っているため CardDef の printed 値を参照する (手札カードに修飾は無い)。
// 未 bind (discard していない / 0 枚) は 0 を返す = scaling 無効 (してもよい を skip した場合等)。
function resolveDiscarded(ctx: EffectCtx, rest: string[], original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $discarded requires <field> (level/ap/lp) — got "${original}"`);
  }
  const field = rest[0];
  const binding = (ctx.bindings as Record<string, unknown>)['$discarded'];
  if (!Array.isArray(binding) || binding.length === 0) return 0;
  // discard{bind} は除去全カードを array で書くが、本 root は先頭 1 枚を参照 (現用途は max:1 の
  // B05040/B08055 のみ。複数枚 discard でのスケーリングが必要な card が出たら集計仕様を再定義する)。
  const cardId = (binding[0] as { cardId?: string }).cardId;
  if (typeof cardId !== 'string') return 0;
  const d = def.card(cardId);
  if (!d) return 0;
  switch (field) {
    case 'level':
      return d.level ?? 0;
    case 'ap':
      return d.ap ?? 0;
    case 'lp':
      return d.lp ?? 0;
    default:
      throw new Error(`dyn.eval: unknown $discarded field "${field}" in "${original}"`);
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
