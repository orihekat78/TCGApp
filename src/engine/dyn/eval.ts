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
import { effectiveTraitNames } from '@/engine/target/candidates.js';
import { char as charRead } from '@/engine/read/char.js';
import { scene } from '@/engine/read/scene.js'; // session64: $self.setCardCount (このキャラの setCards 枚数)
import { def } from '@/engine/read/def.js'; // BUG-114: $discarded.level/ap で discard したカードの printed 値を参照
import { lookupCardDef, allCardNameComponentsForDef, cardNameComponents } from '@/engine/target/card-def-registry.js'; // wave (2026-07-02): $self.removeNameCount の分割名一致 (removeNameAtLeast cond と同式) / W6 step1: $declared.*.sceneNameCount

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

// mega-wave W5 (2026-07-03, r37/r38): number | {dyn:string} → number の汎用 literalizer。
// atom-handlers/_shared.ts resolveDeltaToNumber と同 guard (number 短絡 / {dyn}→evalDyn / 非有限→0) だが、
// cost/ (r37 removeDeckTop.n) と effect/atom-handlers (r38 evidenceFlip max) の両層から使うため
// dyn/eval.ts に置く (cost→atom-handlers の層違反 import を避ける)。resolveDeltaToNumber は非改変。
export function resolveDynNumber(v: unknown, state: GameState, ctx: EffectCtx): number {
  if (typeof v === 'number') return v;
  if (v !== null && typeof v === 'object' && typeof (v as { dyn?: unknown }).dyn === 'string') {
    const r = evalDyn(state, (v as { dyn: string }).dyn, ctx);
    return typeof r === 'number' && Number.isFinite(r) ? r : 0;
  }
  return 0;
}

/** v が number か {dyn:string} 短縮形か (isShortFormDelta と同式、max/n 用)。 */
export function isDynObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && typeof (v as { dyn?: unknown }).dyn === 'string';
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
    case 'removed':
      return resolveRemoved(ctx, rest, placeholder);
    case 'bound':
      return resolveBound(state, rest, ctx, placeholder);
    // mini-wave #2 (2026-07-10): $trigger.cardLevel = trigger payload.cardId の CardDef 印字レベル
    // (「そのカードのレベル以下」B01005、QA=元のレベル参照)。$trigger.<key> の数値/文字列 passthrough も許容。
    case 'trigger': {
      const tp = (ctx as { triggerPayload?: Record<string, unknown> }).triggerPayload;
      if (!tp) throw new Error(`dyn.eval: $trigger — ctx.triggerPayload 不在 in "${placeholder}"`);
      const tf = rest[0];
      if (tf === 'cardLevel') {
        const cid = tp['cardId'];
        if (typeof cid !== 'string') return NaN;
        return def.card(cid)?.level ?? NaN;
      }
      const v = tp[tf];
      if (typeof v === 'number' || typeof v === 'string') return v;
      throw new Error(`dyn.eval: unknown $trigger field "${tf}" in "${placeholder}"`);
    }
    case 'declared':
      return resolveDeclared(state, rest, ctx, placeholder);
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
  // engine additive wave (2026-06-30): $self.sceneColorNot.<color>[.<color>...] — ctx.source.player の
  // 現場で「指定色以外の色を持つ」キャラ数 (B02002 江戸川コナン「自分の現場にいる【青】以外の色を持つ
  // キャラ1枚につき AP+1000」)。colorNot は some説 (公式 B08079, cond/eval.ts matchOneFilter と同式:
  // いずれかの色が除外集合外なら該当)。sceneTrait/oppSceneCount と同じく player ベース (uid 要件より前)。
  // 複数色は dotted で除外集合に追加 (青.赤 = {青,赤} を両方持たないキャラ以外、= {青,赤}以外の色を持つ)。
  // charRead.colors は scene char の現 cardId 参照 ⇒ 変装後の色を honor (rules/19)。
  if (prop === 'sceneColorNot') {
    const nots = rest.slice(1).filter(x => typeof x === 'string' && x.length > 0);
    if (nots.length === 0) {
      throw new Error(`dyn.eval: $self.sceneColorNot requires at least one color (e.g. $self.sceneColorNot.青) — got "${original}"`);
    }
    const side = ctx.source.player;
    return state.players[side].scene.filter(c => charRead.colors(state, c.uid).some(x => !nots.includes(x))).length;
  }
  // engine additive wave (2026-07-02): $self.removeNameCount.<name>[.<name>...] — ctx.source.player の
  // リムーブエリアで「指定カード名 (分割名component いずれか) を持つ」カード数 (PR158/PR164 犯人 カットイン
  // 「自分のリムーブエリアにある〚カード名［犯人］〛1枚につき AP+2000（このカードも含める）」)。
  // 「このカードも含める」: カットインは resolve 時点で既に remove 内 (contact.ts: effect:declared emit →
  // discardToRemove → resolve.runAllUntilEmpty の順、遅延解決) のため自然に自身も計数される (特別扱い不要)。
  // 名前一致は removeNameAtLeast cond (cond/eval.ts) と同式 (allCardNameComponentsForDef、rules/19 分割名)。
  // sceneTrait/oppSceneCount と同じ player ベース (uid 要件より前、カットインは ctx.source.uid を持たない)。
  if (prop === 'removeNameCount') {
    const wants = rest.slice(1).filter(x => typeof x === 'string' && x.length > 0);
    if (wants.length === 0) {
      throw new Error(`dyn.eval: $self.removeNameCount requires at least one card name (e.g. $self.removeNameCount.犯人) — got "${original}"`);
    }
    const side = ctx.source.player;
    return state.players[side].remove.filter(id => {
      const d = lookupCardDef(id);
      if (!d) return false;
      return wants.some(w => allCardNameComponentsForDef(d).includes(w));
    }).length;
  }
  // engine defer-unlock mini-wave (2026-07-09): $self.partnerAreaTraitCount.<trait>[.<trait>...] —
  // ctx.source.player の PA 一般カード枠 (partnerAreaCards、G39) で「指定特徴のいずれかを持つ」カード数
  // (B07046 ドロン刑事「PA にある特徴[ビッグジュエル]のカード1枚につき AP+1000」= 継続 aura の
  // apDelta:{dyn:'$self.partnerAreaTraitCount.ビッグジュエル * 1000'})。removeNameCount と同式の
  // player ベース (uid 要件より前)。判定は CardDef 印字 traits (PA カードは盤面キャラでないため
  // continuous grant 経路なし)。同一 cardId 重複も各1枚 (partnerAreaCards は CardId[] multiset)。
  if (prop === 'partnerAreaTraitCount') {
    const patWants = rest.slice(1).filter(x => typeof x === 'string' && x.length > 0);
    if (patWants.length === 0) {
      throw new Error(`dyn.eval: $self.partnerAreaTraitCount requires at least one trait (e.g. $self.partnerAreaTraitCount.ビッグジュエル) — got "${original}"`);
    }
    const patSide = ctx.source.player;
    return (state.players[patSide].partnerAreaCards ?? []).filter(id => {
      const traits = effectiveTraitNames(state, id, null, { kind: 'card', cardId: id, area: 'partner-area', player: patSide });
      return patWants.some(w => traits.includes(w));
    }).length;
  }
  // engine additive wave-14 (2026-07-02, G16 残): $self.sceneMaxLp — ctx.source.player の現場キャラの
  // 「実効 LP の最大値」。B08043「手のこんだ悪巧み」(相手の現場のキャラが自分の現場で LP がもっとも高い
  // キャラの LP 以下の場合リムーブ) の相対 LP フィルタ足場。filter に lpMax:{dyn:'$self.sceneMaxLp'} を
  // 置くと resolveFilterDynObj が field-agnostic に literalize、matchOneFilter が対象の実効 LP と突合
  // (G15 の apMin/apMax:{dyn:'$self.ap'} と同経路、B09096 先例)。実効 LP = charRead.lp (override?base +
  // lpMod各scope + continuous + aura。公式 Q&A: 参照 LP は解決時点の増減後の実効値 → filter-LP と表示 LP
  // 一致 BUG-117 原則)。現場 0 枚 = 「もっとも高いキャラ」不在 → max of ∅ = -Infinity を返す (公式 Q&A:
  // 自分の現場にキャラがいない場合はリムーブ不可。lpMax:-Infinity は matchOneFilter で lp > -Infinity が
  // 恒真ゆえ全候補を除外)。sceneTrait/oppSceneCount と同じく player ベース (uid 要件より前 — イベントは
  // ctx.source.uid を持たない)。集計は他キャラの LP を charRead.lp で読むが、B08043 は継続修飾ではなく
  // pick filter で消費するため apDelta/lpDelta の continuousDelta 再帰経路 (BUG-156/157) を踏まない。
  if (prop === 'sceneMaxLp') {
    const side = ctx.source.player;
    const scene = state.players[side].scene;
    if (scene.length === 0) return Number.NEGATIVE_INFINITY;
    return Math.max(...scene.map(c => charRead.lp(state, c.uid)));
  }
  const uid = ctx.source.uid;
  if (!uid) {
    throw new Error(`dyn.eval: $self.${prop} requires ctx.source.uid (none provided)`);
  }
  switch (prop) {
    // B09036: count this source and every character on its controller's scene
    // that has at least one effective card-name component in common.  names()
    // deliberately applies the turn nameOverride first (rules/19); therefore a
    // renamed source still counts itself and no longer counts its printed name.
    case 'sameNameCount': {
      const sourceNames = charRead.names(state, uid);
      if (sourceNames.length === 0) return 0;
      const wanted = new Set(sourceNames.flatMap(cardNameComponents));
      return state.players[ctx.source.player].scene.filter(char =>
        charRead.names(state, char.uid).some(name => cardNameComponents(name).some(part => wanted.has(part))),
      ).length;
    }
    case 'ap':
      // Current effective AP via existing read API (includes overrides).
      // TODO Phase 5: turnEffect-based modifiers may need further integration here.
      return charRead.ap(state, uid);
    case 'lp':
      return charRead.lp(state, uid);
    // engine additive wave-4 (2026-07-01): $self.level — このキャラの有効レベル (rules/11/19)。
    // 「このキャラのレベル以下/同じレベルの〜」相対 level フィルタの dyn 足場 (filter の levelMin/levelMax に
    // {dyn:'$self.level'} を置くと resolveFilterDynObj が field-agnostic に解決 → matchOneFilter が effective
    // level を honor、両方既出荷)。charRead.level は base + 各 lvlMod + continuous (ap/lp と対称、B09096 相対AP
    // 先例)。continuousDeltaSafe 経由で BUG-156/157 の再帰を踏まない。level は下限なし (rules/19、マイナス可)。
    case 'level':
      return charRead.level(state, uid);
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
    case 'stackedCount': {
      const stacked = scene.byUid(state, uid)?.stackedCards;
      return stacked == null ? 0 : Array.isArray(stacked) ? stacked.length : stacked;
    }
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

// mega-wave W5 (2026-07-03): $bound.<key>.<field> — bind 済み Candidate 集合の遅延参照 (r38/r47 統合 root)。
// field: count    = 集合枚数 (evidenceFlip bind → 「表向きにした枚数と同じ数まで」B08028)
//        level    = 先頭要素の実効レベル。uid あり board char = charRead.level (rules/19 実効値、B09109 QA1
//                   「解決時点の増減後レベルを参照」)。uid 無し (souza 等 deck bound、cardId のみ) = printed
//                   CardDef.level (B04074、盤面外に修飾は乗らない)
//        cardName = 先頭要素のカード名。uid あり = 実効 names 先頭 (wave-6 grantNames honor)、無し = printed names[0]。
//                   ⚠ 複数名カード (rules/19) は先頭 (複合名) のみ返す — 分割名 any-match が要る consumer が
//                   出たら配列対応を別途設計 (DEFERRED-INDEX megaw5 節)
// 欠損 binding は defensive (count=0 / level=NaN / cardName='') — 「してもよい」skip 経路で throw しない
// ($discarded の 0-fallback と同 posture。NaN filter は matchOneFilter/predicate で不一致に落ちる)。
// 未知 field は throw (author typo を fail-fast)。key は ctx.bindings を verbatim 参照 ('$flipped' 等 $ 込み可)。
// engine A3 wave (2026-07-11, B08002): $removed.<field> — sceneRemove{bind} が除去**前**に snapshot した
//   実効 level/ap/lp を参照 (静的値。$bound.level の除去後 re-read = 印字落ちを回避、公式Q&A: 増減状態を参照)。
//   $discarded と同 posture (先頭1枚参照 / unbound は 0)。B08002 a1 mill n:{dyn:'$removed.level'}。
function resolveRemoved(ctx: EffectCtx, rest: string[], original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $removed requires <field> (level/ap/lp) — got "${original}"`);
  }
  const field = rest[0];
  const binding = (ctx.bindings as Record<string, unknown>)['$removed'];
  if (!Array.isArray(binding) || binding.length === 0) return 0;
  const first = binding[0] as { snapLevel?: number; snapAp?: number; snapLp?: number };
  switch (field) {
    case 'level':
      return first.snapLevel ?? 0;
    case 'ap':
      return first.snapAp ?? 0;
    case 'lp':
      return first.snapLp ?? 0;
    default:
      throw new Error(`dyn.eval: unknown $removed field "${field}" in "${original}"`);
  }
}

function resolveBound(state: GameState, rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length < 2) {
    throw new Error(`dyn.eval: $bound requires <key>.<field> (count/level/cardName) — got "${original}"`);
  }
  const key = rest[0];
  const field = rest[1];
  const binding = (ctx.bindings as Record<string, unknown>)[key];
  const arr = Array.isArray(binding) ? binding : [];
  const first = arr[0] as { uid?: string; cardId?: string } | undefined;
  switch (field) {
    case 'count':
      return arr.length;
    // engine mini-wave (2026-07-10): 集合全要素のレベル合計 (B04063「リムーブエリアに移したカードの
    // レベルの合計以下」)。uid 要素 = 実効 level (scene)、cardId 要素 = 印字 level ('level' case と同解決)。
    case 'levelSum': {
      let sum = 0;
      for (const it of arr as { uid?: string; cardId?: string }[]) {
        if (typeof it.uid === 'string' && scene.byUid(state, it.uid)) sum += charRead.level(state, it.uid);
        else if (typeof it.cardId === 'string') sum += def.card(it.cardId)?.level ?? 0;
      }
      return sum;
    }
    case 'level': {
      if (!first) return NaN;
      if (typeof first.uid === 'string' && scene.byUid(state, first.uid)) {
        return charRead.level(state, first.uid);
      }
      if (typeof first.cardId === 'string') {
        return def.card(first.cardId)?.level ?? NaN;
      }
      return NaN;
    }
    case 'cardName': {
      if (!first) return '';
      if (typeof first.uid === 'string' && scene.byUid(state, first.uid)) {
        return charRead.names(state, first.uid)[0] ?? '';
      }
      if (typeof first.cardId === 'string') {
        return def.card(first.cardId)?.names[0] ?? '';
      }
      return '';
    }
    default:
      throw new Error(`dyn.eval: unknown $bound field "${field}" in "${original}"`);
  }
}

// mega-wave W6 step1 (2026-07-04): $declared.<key>[.<field>] — declareName verb が ctx.declaredNames へ
// 書いた宣言カード名の遅延参照。
//   $declared.<key>                = 宣言名文字列そのもの (filter dyn `cardName:{dyn:'$declared.named'}` 用。
//                                    resolveFilterDynObj が field-agnostic に literalize → matchOneFilter 突合)
//   $declared.<key>.sceneNameCount = ctx.source.player の現場で宣言名を名前に持つキャラ数 (B09112
//                                    「指定したカード名のキャラ1枚につき」)。実効 names (wave-6 grantNames /
//                                    step2 nameOverride honor = charRead.names) の各要素を rules/19 分割
//                                    component 化して any-match ($self.removeNameCount と同式)。
// 欠損 key / 空宣言は defensive ('' / 0) — 「してもよい」skip・AI 未供給経路で throw しない
// (resolveBound と同 posture)。未知 field は throw (author typo fail-fast)。
function resolveDeclared(state: GameState, rest: string[], ctx: EffectCtx, original: string): DynValue {
  if (rest.length === 0) {
    throw new Error(`dyn.eval: $declared requires a key (e.g. $declared.named) — got "${original}"`);
  }
  const key = rest[0];
  const declared = ctx.declaredNames?.[key] ?? '';
  if (rest.length === 1) return declared;
  const field = rest[1];
  switch (field) {
    case 'sceneNameCount': {
      if (declared === '') return 0;
      const side = ctx.source.player;
      return state.players[side].scene.filter(c =>
        charRead.names(state, c.uid).some(n => cardNameComponents(n).includes(declared)),
      ).length;
    }
    default:
      throw new Error(`dyn.eval: unknown $declared field "${field}" in "${original}"`);
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
  // S1 wave (2026-07-11, B07001): $cost.<key>.traitCountAny:特徴A|特徴B — コストで移動した
  // cardId 群 (entry.ids / entry.removed) のうち、印字特徴のいずれかを持つカードの枚数。
  // 公式Q&A (B07001): 両特徴を持つカードも 1 枚分として数える = any-match の枚数カウント。
  // 「1枚につき AP+1000」= charModifyAP delta:{dyn:'$cost.removeDeckTop.traitCountAny:少年探偵団|毛利探偵事務所 * 1000'}。
  if (innerPath.length === 1 && innerPath[0].startsWith('traitCountAny:')) {
    const traits = innerPath[0].slice('traitCountAny:'.length).split('|').filter(t => t.length > 0);
    const rec = entry as { ids?: unknown; removed?: unknown };
    const idsRaw = Array.isArray(rec.ids) ? rec.ids : Array.isArray(rec.removed) ? rec.removed : [];
    const ids = idsRaw.filter((x): x is string => typeof x === 'string');
    return ids.filter(id => {
      const d = lookupCardDef(id);
      return d !== undefined && (d.traits ?? []).some(t => traits.includes(t));
    }).length;
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
