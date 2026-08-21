// engine.effect.resolveEffectPicks — Phase 7-2 (BUG-035 fix) + Phase 7-3 (AI policy hook)
//
// rules: 10-action-event.md §ヒラメキ (対象 0 で空発動可)、15-abilities-effects.md
// spec: .claude/bugs/BUG-035.md
//
// 役割:
//   effect tree を recursive に traverse し、`$pick` placeholder を含む atom を
//   `target.candidates(state, target, ctx)` で列挙して候補から 1 つに置換、`args.uid` を
//   picked.uid に substitute する。Effect を返す pure 関数 (deep clone、副作用なし)。
//
// 適用箇所:
//   - src/engine/listeners/triggered.ts: event.queue 呼出前
//   - src/ui/hooks/useEngineDispatch.ts:hiramekiResolve: 既存 resolveHiramekiPick の retrofit
//
// 設計:
//   - atom / choice / sequence / parallel / optional / conditional / forEach / replace 各 kind を walk
//   - negate / custom は skip (内部 effect なし or 動的、$pick 想定外)
//   - 候補 0 件: 元 atom そのまま (rules/10 no-op fallback)
//   - Phase 7-3: `opts.chooseAtomTarget` callback (HeuristicPolicy.chooseAtomTarget 等) で best 候補選択。
//     未指定 / null 返却 → 先頭採用 fallback (Phase 7-2 と互換)

import { candidates as targetCandidates } from '../target/candidates.js';
import { evalDyn } from '../dyn/eval.js';
import { evalCond } from '../cond/eval.js';
import { bindingKeysReadByCondition } from '../cond/binding-keys.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import type { GameState, Effect, EffectCtx, TargetingRef, Condition } from '../types/index.js';
import type { Candidate } from '../types/candidate.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from './atom-pick-spec.js';
import { findChooseInterceptReactions } from './consult-choose-intercept.js';
import { hand } from '../mutate/hand.js';
import { run as runEffect } from './resolver.js';
import { eventUseAllowed } from '../flow/main/hand-use-card.js';
import { cardOccurrenceUid, cardOccurrenceWitness, setCardOccurrenceUid } from '../target/card-occurrence.js';
import { char as charMutator } from '../mutate/char.js';
import { peekPublicHandRevealToken, takePublicHandRevealToken } from './atom-handlers/_shared.js';
import { chooseHeuristicAtomTarget } from './heuristic-atom-target.js';
import {
  cloneCausalEffectTrace,
  completeEffectCausalTrace,
  ensureEffectCausalTrace,
  markEffectCausalAwaitingResume,
  recordEffectCausalDecision,
  recordEffectCausalOperation,
} from '../log/effect-causal.js';
import {
  isSceneEnterSwitchPickArgs,
  isValidSceneEnterSwitchPickAuthority,
  resolveSceneEnterSwitchPickArgs,
  sceneEnterOwnsNextPick,
} from './scene-switch.js';

type Player = 'self' | 'opp';

function containsSceneEnter(effect: Effect): boolean {
  if (effect.kind === 'atom') return effect.verb === 'sceneEnter';
  if (effect.kind === 'sequence' || effect.kind === 'parallel') return effect.steps.some(containsSceneEnter);
  if (effect.kind === 'conditional') return containsSceneEnter(effect.then) || (effect.else ? containsSceneEnter(effect.else) : false);
  if (effect.kind === 'optional') return containsSceneEnter(effect.effect);
  return false;
}

export function pendingSource<T extends { uid?: string; cardId: string; abilityId: string }>(state: GameState, ctx: EffectCtx, source: T) {
  const trace = ensureEffectCausalTrace(state, ctx);
  markEffectCausalAwaitingResume(trace);
  return {
    ...source,
    ...(source.uid === undefined && ctx.source.uid !== undefined ? { uid: ctx.source.uid } : {}),
    ...(ctx.source.area ? { area: ctx.source.area } : {}),
    ...(ctx.source.resolutionKind ? { resolutionKind: ctx.source.resolutionKind } : {}),
    ...(ctx.source.triggerBatch !== undefined ? { triggerBatch: ctx.source.triggerBatch } : {}),
    ...(ctx.source.ownerChosenOrder !== undefined ? { ownerChosenOrder: ctx.source.ownerChosenOrder } : {}),
    ...(ctx.source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: ctx.source.ownerOrderConfirmed } : {}),
    ...(ctx.source.declaredBatch !== undefined ? { declaredBatch: ctx.source.declaredBatch } : {}),
    ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
  };
}

/**
 * BUG-161 (fixes the BUG-145 §2-documented over-fire): conditional pre-walk gate guard. A condition is "stable" at initial-walk time iff it does
 * NOT read a binding (ctx.bindings) — i.e. it depends only on board/turn state that exists before the
 * effect runs. Binding-dependent ifs (`bound`/`boundMatchesFilter`, or any $-token nested in args)
 * are set by a prior sequence/chain step (deck-look 「公開→$matched」family), so evalCond would be
 * stale (the binding is undefined during the walk). We recurse through and/or/not so a composite if is
 * stable only if EVERY leaf is stable. Serialized $-token scan catches nested arg refs defensively.
 */
function conditionIfIsStable(cond: Condition): boolean {
  if (!cond || typeof cond !== 'object') return true;
  if (bindingKeysReadByCondition(cond).length > 0) return false;
  switch (cond.kind) {
    case 'not':
      return conditionIfIsStable(cond.c);
    case 'and':
    case 'or':
      return cond.cs.every((c) => conditionIfIsStable(c));
    default: {
      // Defensive: any nested $-token (e.g. a filter referencing $matched.cardId) marks it unstable.
      return !JSON.stringify(cond).includes('$');
    }
  }
}

/**
 * A binding-dependent condition is unsafe to walk only until its required
 * binding exists.  Continuations re-enter resolveEffectPicks after their
 * preceding pick has populated ctx.bindings, so recognise the explicit
 * binding readers here instead of permanently treating the branch as opaque.
 */
function conditionHasMissingBinding(cond: Condition, bindings: EffectCtx['bindings']): boolean {
  if (!cond || typeof cond !== 'object') return false;
  return bindingKeysReadByCondition(cond)
    .some((key) => !Array.isArray(bindings[key]) || bindings[key].length === 0);
}

/**
 * 2026-05-30 BUG-085: atom args の `{ dyn: <expr> }` 値を late-bound 評価して
 * literal (number / string) に確定する。
 *
 * caseDeclaredEvidenceFlip (D08026 / D11021) の
 *   `delta: { dyn: '$cost.flipFaceUpEvidence.count * N' }`
 * を、human-pick 境界 (pendingEffectPick.atomArgs として運ばれる) を越える前に
 * ここで数値化することが目的。境界の先 (useEngineDispatch.effectPickResolve) では
 * costPaid を持つ ctx が再構築されないため、cost 依存 dyn はこのタイミング (= ctx に
 * costPaid が乗っている useDeclaredAbility の resolveEffectPicks 初期 walk) でしか
 * 解決できない。
 *
 * `{ dyn }` 値を持つ atom が現状 caseDeclaredEvidenceFlip のみのため、他カードへの
 * 影響はゼロ (dyn 値が無い args はそのまま同一参照を返す)。
 */
function resolveDynArgs(
  state: GameState,
  args: Record<string, unknown>,
  ctx: EffectCtx,
): Record<string, unknown> {
  let mutated = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      'dyn' in v &&
      typeof (v as { dyn: unknown }).dyn === 'string'
    ) {
      // M2後半 (2026-07-10, PR265): `$bound.<key>.*` 参照で <key> が初期 walk 時点で未 bind の場合は
      // literal 化を保留する ({dyn} のまま残す)。chain/sequence 前段 (deckRevealUntil 等) が bind を
      // 書くのは実行時であり、walk 時に evalDyn すると NaN が焼き込まれる (walk-literalize 罠 —
      // binding-dependent conditional は両枝 walk するため then 内 atom も踏む)。runtime 側は
      // handler-local resolveDeltaToNumber (mill/souza/handToDeckBottom 等) が解決する。
      // 既 bind の $bound / 非 $bound dyn ($cost.* 等) は従来通り literal 化 (byte 互換)。
      const dynExpr = (v as { dyn: string }).dyn;
      const boundKeys = [...dynExpr.matchAll(/\$bound\.(\$?\w+)/g)].map((m) => m[1]);
      const hasUnresolvedBound = boundKeys.some((key) => !(key in ((ctx.bindings ?? {}) as Record<string, unknown>)));
      // WB2 (2026-07-11, B09112): `$declared.<key>.*` 参照で <key> が初期 walk 時点で未宣言の場合も literal 化を
      // 保留する。declareName verb は chain/sequence 前段の実行時に ctx.declaredNames を書くため、walk 時点で
      // evalDyn すると sceneNameCount=0 (空宣言 defensive) が焼き込まれ maxN=0 baked / 未 defer だと raw {dyn}
      // が Math.min に渡り NaN 化。$bound と同型の deferral。runtime 側は handler-local resolveDeltaToNumber
      // (atomDeckRevealUntil maxN) が解決。既宣言 $declared / 非 $declared dyn は従来通り literal 化 (byte 互換)。
      const declaredKeys = [...dynExpr.matchAll(/\$declared\.(\w+)/g)].map((m) => m[1]);
      const hasUnresolvedDeclared = declaredKeys.some((key) => !(key in ((ctx.declaredNames ?? {}) as Record<string, unknown>)));
      if (hasUnresolvedBound || hasUnresolvedDeclared) {
        out[k] = v;
        continue;
      }
      out[k] = evalDyn(state, dynExpr, ctx);
      mutated = true;
    } else {
      out[k] = v;
    }
  }
  return mutated ? out : args;
}

/**
 * engine拡張 wave#2 cluster12 (nested-filter-dyn, 2026-06-15): pick query の `filter` が
 * 数値フィールドに `{dyn}` を持つ場合 (例: levelMax:{dyn:'$self.fileCount'} の「FILEエリアの
 * 枚数以下のレベル」系イベント) に、列挙 (targetCandidates) の前で `{dyn}` を具体値へ解決する。
 * 背景: buildShortFormPick は `query.filter = a.filter` を frozen card-def への **参照** で代入し、
 * resolveDynArgs は top-level 引数しか歩かないため、未解決のまま candidates.matchOneFilter へ渡ると
 * `level > {dyn-object}` = 常に false となり「レベル上限」が黙って消える (誤挙動・throw ではない)。
 * frozen def を破壊しないよう filter を **clone** してから解決する (in-place mutation 禁止)。
 * dyn を含まない filter は target を同一参照で返すため既存カードは no-op (smoke baseline 不変)。
 * rules: 15-abilities-effects.md (動的値解決) / 17-icons.md §FILE(X) ($self.fileCount は実装済)。
 */
/** 1 つの filter object 内の `{dyn}` 数値フィールドを clone して解決。dyn 不在なら同一参照を返す (no-op)。 */
export function resolveFilterDynObj(state: GameState, f: unknown, ctx: EffectCtx): unknown {
  if (f === null || typeof f !== 'object' || Array.isArray(f)) return f;
  const fo = f as Record<string, unknown>;
  let changed = false;
  const nf: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fo)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      'dyn' in v &&
      typeof (v as { dyn: unknown }).dyn === 'string'
    ) {
      nf[k] = evalDyn(state, (v as { dyn: string }).dyn, ctx);
      changed = true;
    } else {
      nf[k] = v;
    }
  }
  return changed ? nf : f;
}

function resolveTargetFilterDyn(
  state: GameState,
  target: { kind?: string; query?: unknown } & Record<string, unknown>,
  ctx: EffectCtx,
): { kind?: string; query?: unknown } & Record<string, unknown> {
  const q = target.query as ({ filter?: unknown; filterAny?: unknown } & Record<string, unknown>) | undefined;
  if (!q || typeof q !== 'object') return target;
  let changed = false;
  // query.filter (単一 TargetFilter)
  let newFilter = q.filter;
  const rf = resolveFilterDynObj(state, q.filter, ctx);
  if (rf !== q.filter) { newFilter = rf; changed = true; }
  // query.filterAny (TargetFilter[]、OR 群) — 各 sub-filter も同様に解決 (filterAny+{dyn} の latent gap 対策)
  let newFilterAny = q.filterAny;
  if (Array.isArray(q.filterAny)) {
    let anyChanged = false;
    const arr = q.filterAny.map((sf) => {
      const rsf = resolveFilterDynObj(state, sf, ctx);
      if (rsf !== sf) anyChanged = true;
      return rsf;
    });
    if (anyChanged) { newFilterAny = arr; changed = true; }
  }
  if (!changed) return target; // dyn 不在 = 同一参照 (既存カード no-op / smoke baseline 不変)
  return { ...target, query: { ...q, filter: newFilter, filterAny: newFilterAny } };
}

/** Phase 7-3: $pick 候補から best を選ぶ callback (AIPolicy.chooseAtomTarget に対応)。 */
export type ChooseAtomTargetFn = (
  state: GameState,
  atomVerb: string,
  atomArgs: Readonly<Record<string, unknown>>,
  candidates: ReadonlyArray<Candidate>,
  byPlayer: Player,
) => Candidate | null;

// Runtime Pattern-B handlers receive a reconstructed EffectCtx after an effect
// queue/save boundary. Persist only a string handle in GameState; callbacks stay
// in a bounded module registry so serialization never stores executable values.
const RUNTIME_ATOM_TARGET_POLICY_HANDLE = '__runtimeAtomTargetPolicyHandle';
const BUILTIN_HEURISTIC_POLICY_HANDLE = 'builtin:heuristic';
const RUNTIME_ATOM_TARGET_POLICY_LIMIT = 4096;
const runtimeAtomTargetPolicies = new Map<string, ChooseAtomTargetFn>();
let runtimeAtomTargetPolicySequence = 0;

/** Match-session boundary cleanup. Headless callers are additionally bounded. */
export function resetRuntimeAtomTargetPolicySession(): void {
  runtimeAtomTargetPolicies.clear();
  runtimeAtomTargetPolicySequence = 0;
}

function rememberRuntimeAtomTargetPolicy(
  ctx: EffectCtx,
  policy: ChooseAtomTargetFn | undefined,
  policyKey: ResolveEffectPicksOpts['runtimeAtomTargetPolicyKey'],
): void {
  const dyn = (ctx.dyn ??= {}) as Record<string, unknown>;
  if (policyKey === 'heuristic') {
    dyn[RUNTIME_ATOM_TARGET_POLICY_HANDLE] = BUILTIN_HEURISTIC_POLICY_HANDLE;
    return;
  }
  if (!policy) {
    // Continuation re-walks normally omit the callback. Preserve the policy
    // handle captured at the original AI entry; session reset is the explicit
    // lifecycle boundary for clearing it.
    return;
  }
  const existing = dyn[RUNTIME_ATOM_TARGET_POLICY_HANDLE];
  if (existing === BUILTIN_HEURISTIC_POLICY_HANDLE) return;
  const handle = typeof existing === 'string'
    ? existing
    : `runtime-atom-policy:${++runtimeAtomTargetPolicySequence}`;
  dyn[RUNTIME_ATOM_TARGET_POLICY_HANDLE] = handle;
  // Refresh insertion order so only inactive/oldest handles are evicted.
  runtimeAtomTargetPolicies.delete(handle);
  runtimeAtomTargetPolicies.set(handle, policy);
  while (runtimeAtomTargetPolicies.size > RUNTIME_ATOM_TARGET_POLICY_LIMIT) {
    const oldest = runtimeAtomTargetPolicies.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    runtimeAtomTargetPolicies.delete(oldest);
  }
}

export function rememberedRuntimeAtomTargetPolicy(ctx: EffectCtx): ChooseAtomTargetFn | undefined {
  const handle = (ctx.dyn as Record<string, unknown> | undefined)?.[RUNTIME_ATOM_TARGET_POLICY_HANDLE];
  if (handle === BUILTIN_HEURISTIC_POLICY_HANDLE) return chooseHeuristicAtomTarget;
  return typeof handle === 'string'
    ? runtimeAtomTargetPolicies.get(handle)
    : undefined;
}

export interface ResolveEffectPicksOpts {
  /** Phase 7-3: heuristic chooser。未指定なら先頭採用 (Phase 7-2 互換)。 */
  chooseAtomTarget?: ChooseAtomTargetFn;
  /** JSON 復元後も再構築できる built-in chooser の識別子。 */
  runtimeAtomTargetPolicyKey?: 'heuristic';
  /** chooser に渡される byPlayer (省略時 'self')。 */
  byPlayer?: Player;
  /**
   * user_request 20260522_01 #2/#6 BUG-054: human player による pick が必要な
   * effect の場合 true。`substituteAtomPick` で `$pick` 未解決時に
   * globalThis 側チャネル `__pendingEffectPickSide` に候補を set し、
   * atom はそのまま (未解決) 返却する。caller (triggered listener) は
   * side-channel が set されていれば event.queue をスキップ。
   */
  humanChooser?: boolean;
  /**
   * Actual human side, independent from the effect source. A target can name
   * the opponent of its owner, so source ownership alone cannot decide
   * whether this particular pending decision belongs to the human.
   */
  humanPlayer?: Player | null;
  /** Pending side-channel に保存する識別子 (UI 側で表示や resolve 時に使用) */
  source?: { cardId: string; abilityId: string; uid?: string };
  /**
   * BUG-077: tryRePickFromAtom (runtime atom-handler awaiting-pick) から呼ばれた場合 true。
   * 初期 walk (resolveEffectPicks via triggered.ts) から呼ばれた場合 false (default)。
   * Pattern B atom (uid 不在、target=pick query) は runtime tryRePickFromAtom が
   * 各 atom 実行時に正しい state で side-channel を set できるため、初期 walk では
   * set を抑止する。初期 walk で sequence の後続 step が先行 step の target を
   * 横取りする問題 (D08013 a1: step2 evidenceToHand cands=0 → step3 discard が
   * side-channel を奪う) を防ぐ。
   * Pattern A atom (uid='$pick') は runtime handler に awaiting-pick path が無く
   * 初期 walk での side-channel set が必須なので、この flag に関わらず set する。
   */
  _fromAtomHandler?: boolean;
  /** Initial pre-walk context: this atom follows at least one printed sequence step. */
  _hasPriorSequenceStep?: boolean;
  /** Internal sequence signal: a human runtime pick must pause before later pre-walks. */
  _runtimePickPause?: { encountered: boolean };
}

function humanDecisionPlayer(opts: ResolveEffectPicksOpts): Player | null {
  if (opts.humanPlayer !== undefined) return opts.humanPlayer;
  const globalHuman = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
  if (globalHuman === 'self' || globalHuman === 'opp') return globalHuman;
  return opts.humanChooser === true ? (opts.byPlayer ?? 'self') : null;
}

function targetDecisionPlayer(
  target: { chooser?: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): Player {
  return target.chooser === 'opp-of-owner'
    ? (ctx.source.player === 'self' ? 'opp' : 'self')
    : (opts.byPlayer ?? 'self');
}

function isExplicitlyKnownNonHumanDecision(
  target: { chooser?: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): boolean {
  const ownerKnown = opts.humanChooser !== undefined || opts.humanPlayer !== undefined;
  return ownerKnown && humanDecisionPlayer(opts) !== targetDecisionPlayer(target, ctx, opts);
}

function isIndexedPhysicalPickTarget(target: unknown): boolean {
  const area = (target as { query?: { area?: unknown } } | undefined)?.query?.area;
  if (area === 'remove' || area === 'evidence') return true;
  return Array.isArray(area)
    && area.some(value => value === 'remove' || value === 'evidence');
}

/**
 * A runtime atom handler receives only EffectCtx, not the initial walk opts.
 * Preserve the real UI owner on that shared resolution context so a later
 * re-pick can distinguish a UI continuation from an AI continuation.
 */
function runtimeHumanDecisionPlayer(ctx: EffectCtx, opts: ResolveEffectPicksOpts): Player | null {
  const dyn = ctx.dyn as Record<string, unknown> | undefined;
  // `null` is a real, known non-human owner.  Do not collapse it with a
  // missing marker: old direct runtime handlers predate ownership tracking
  // and must retain their queued (human) behavior.
  if (dyn?.['runtimePickOwnerKnown'] === true) {
    const remembered = dyn['runtimeHumanPlayer'];
    return remembered === 'self' || remembered === 'opp' ? remembered : null;
  }
  // A direct atom-handler caller can explicitly identify an AI/spectator
  // decision without first passing through resolveEffectPicks. Preserve that
  // `false`/`null` ownership instead of falling through to the legacy human
  // queue behavior.
  if (opts.humanChooser !== undefined || opts.humanPlayer !== undefined) {
    return humanDecisionPlayer(opts);
  }
  // No ownership marker means this is a legacy direct runtime handler.  Its
  // pending decision belongs to the atom's chooser, even when a process-wide
  // human side happens to be configured for an unrelated match flow.
  return opts.byPlayer ?? ctx.source.player;
}

import {
  pushPendingEffectPickSide, toPlainDeep, _peekPendingEffectChoiceSide,
  setPendingChoiceResume, pushPendingEffectChoiceSide, setPendingChoiceBindings,
  appendPendingChoiceContinuation,
  pushPendingEffectOptionalSide, _peekPendingEffectOptionalSide, appendPendingOptionalContinuation,
  setPendingOptionalResume, setPendingOptionalBindings,
  setPendingOptionalCostPaid,
  type ContinuationFrame,
  type PendingEffectPickSide,
} from './pending-state.js';
import { normalizePendingPickRange, preparePendingPickRange } from './pick-selection.js';
// Phase 3b: pending管理は pending-state.ts へ分離。旧 public API は barrel 再export で不変 (importer 改変0)。
export {
  _pushPendingEffectPickSideForTest, pushPendingPickFromAtom, toPlainDeep,
  _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength, _peekPendingEffectPickSide, _clearPendingEffectPickQueue,
  _drainPendingEffectChoiceSide, _clearPendingEffectChoiceSide, _takePendingChoiceBindings,
  _peekPendingEffectChoiceSide, _takePendingChoiceResume, _clearPendingChoiceResume,
  _drainPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _peekPendingEffectOptionalSide,
  _takePendingOptionalResume, _clearPendingOptionalResume, _takePendingOptionalBindings,
  _takePendingOptionalCostPaid,
} from './pending-state.js';
export type {
  ContinuationFrame, PendingEffectPickSide, PendingEffectChoiceSide, PendingEffectOptionalSide,
} from './pending-state.js';

/**
 * Initial human Pattern-A picks are created by this pre-walk, before
 * resolver.run() can observe the pause. Preserve the runtime resolver's nested
 * order: inner remainder first, followed by outer continuation frames.
 */
function attachPrewalkContinuation(
  pick: { continuation?: ContinuationFrame },
  frame: ContinuationFrame,
): void {
  if (!pick.continuation) {
    pick.continuation = frame;
    return;
  }
  let tail = pick.continuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = frame;
}

/**
 * BUG-076: atom-handler の awaiting-pick path から呼ばれる「単一 atom の pattern B
 * pick を side-channel に set する」エントリポイント。sequence 内の複数 pattern B
 * atom がある場合、step N が atom-handler で awaiting-pick した時点で本関数を呼ぶ
 * ことで、step N 用の side-channel を set し、UI が次の modal を表示できる。
 *
 * 呼び出し条件:
 *   - atom-handler で a.target が string|array に正規化できない (pick query object のまま)
 *   - side-channel が現在空 (上書きしない)
 *
 * 呼び出し場所: src/engine/effect/atom-handlers.ts の各 case の awaiting-pick path。
 */
/**
 * engine mega-wave W2b (2026-07-03, P50/r27): mustBeSelectedByOppEvent (B08087 吞口重彦) の
 * forced-inclusion 集合算出。「相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ」。
 *
 * 条件 (公式Q&A 準拠):
 *  1. pick が **イベントの使用自効果** であること: ctx.triggerPayload が effect:declared の
 *     event-use payload ({kind:'event-use', cardId}) で、かつ source.cardId === payload.cardId。
 *     - 混成 review blocker (2026-07-03): 旧実装の「source def.kind==='event'」だけでは、イベント
 *       カードに印字された【ヒラメキ】(hook evidence:remove-by-action) や【カットイン】由来の
 *       pick まで誤って強制していた。公式Q&A「**相手が使用した**イベントの効果で」= 手札の使用/
 *       ネクストヒント経路のみ (B09034 の類似制限と同じ線引き)。
 *     - cardId 一致で「イベント使用に反応した第三者キャラの効果」(B08020 型 reaction、同 hook・
 *       同 payload) も除外 — それは「イベントの効果」でなくキャラ能力の効果。
 *     - def.kind==='event' は belt (character-use は emitKind 分岐で来ない)。
 *  2. 候補が chooser の **相手側** board char (c.player !== chooserPlayer)。「相手は…選ぶ」の方向。
 *  3. read.char.selfContinuousFlag が true (continuous + condition honor、現場 board char のみ)。
 *  4. 候補集合に入っていること (「選べる場合」) — cands を走査するので自動成立。filter 不一致で
 *     候補外の flag char は強制しない。
 *
 * 返り値は unclamped。nMax を超える場合 (吞口2枚 × 「1枚まで」) は消費側が min(forced, nMax) 枚
 * を enforce (どれを選ぶかは chooser の自由、公式Q&A「どちらか1枚を相手が選びます」)。
 */
function forcedInclusionUids(
  state: GameState,
  cands: readonly Candidate[],
  chooserPlayer: Player,
  sourceCardId: string | undefined,
  ctx: EffectCtx,
): string[] {
  if (!sourceCardId) return [];
  const tp = (ctx as { triggerPayload?: { kind?: unknown; cardId?: unknown } }).triggerPayload;
  if (tp?.kind !== 'event-use') return [];
  if (tp.cardId !== sourceCardId) return [];
  const d = readDef.card(sourceCardId);
  if (!d || d.kind !== 'event') return [];
  const out: string[] = [];
  for (const c of cands) {
    if (c.kind !== 'char') continue;
    if (c.player === chooserPlayer) continue;
    if (readChar.selfContinuousFlag(state, c.uid, 'mustBeSelectedByOppEvent')) out.push(c.uid);
  }
  return out;
}

export function tryRePickFromAtom(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): void {
  // BUG-078 fix: queue 化したので「既に set 済み」guard は不要。同 sequence 内の連続 PB
  // atom も全て push する (UI が先頭から消化、effectPickResolve のたびに次が drain される)。
  // BUG-077: _fromAtomHandler=true で substituteAtomPick を呼ぶことで、
  // Pattern B でも side-channel set を許可 (初期 walk からの呼出と区別)。
  // Runtime re-picks are not implicitly human decisions. Atom handlers run
  // for both the UI owner and AI/spectator resolution. Preserve a known
  // tri-state owner, but do not manufacture one for legacy direct handlers:
  // the atom's target may make the chooser `opp-of-owner`, so source ownership
  // cannot identify the actual decision player before target resolution.
  const runtimeDyn = ctx.dyn as Record<string, unknown> | undefined;
  const runtimeOwnerKnown = runtimeDyn?.['runtimePickOwnerKnown'] === true
    || opts.humanChooser !== undefined
    || opts.humanPlayer !== undefined;
  const human = runtimeHumanDecisionPlayer(ctx, opts);
  const chooseAtomTarget = opts.chooseAtomTarget ?? rememberedRuntimeAtomTargetPolicy(ctx);
  const queueBefore = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue?.length ?? 0;
  const resolved = substituteAtomPick(state, atom, ctx, {
    ...opts,
    chooseAtomTarget,
    ...(runtimeOwnerKnown
      ? {
          humanChooser: human !== null && human === opts.byPlayer,
          humanPlayer: human,
        }
      : {}),
    _fromAtomHandler: true,
  });
  // A runtime atom-handler has already consumed the original atom.  For an
  // AI/spectator chooser, execute its substituted atom synchronously so the
  // enclosing sequence can continue.  `resolved === atom` is the explicit
  // no-candidate/unresolved sentinel; running it again would recurse into the
  // same handler and double-apply (or loop) instead.
  const queued = ((globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue?.length ?? 0) > queueBefore;
  if (!queued && resolved !== atom) runEffect(state, resolved, ctx);
}

/**
 * 物理動作 atom 短縮形対応: target 未指定 + n: number の verb で既定 pick query を補完。
 * カード DSL では `evidenceToHand({player:'self', n:1})` のように書きたく、target query は
 * verb 既定 (area/side/chooser) を engine が推論する。
 */
// 短縮形の verb → 既定 area マッピングは ATOM_PICK_SPEC (atom-pick-spec.ts) に集約。

function substituteAtomPick(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): Effect {
  if (!atom.args || typeof atom.args !== 'object') return atom as Effect;
  const args = atom.args as {
    uid?: unknown; target?: unknown; player?: unknown;
    n?: unknown; max?: unknown; filter?: unknown;
  } & Record<string, unknown>;
  const verbStr = typeof atom.verb === 'string' ? atom.verb : '';
  // 物理動作 atom 短縮形: { player, n or max, filter? } で target 未指定なら
  // verb 既定 area を使って pick query を engine が補完する。
  // - n: number → { min: n, max: n } 固定
  // - max: number → { min: 0, max } 任意 (0 枚 skip 可)
  // - filter → query.filter に pass-through (trait / apMax / levelMax / cardName 等)
  let effectiveTarget = args.target as { kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player } | undefined;
  // 短縮形 (PB は初期 walk、PA は通常 runtime handler で target 構築): ATOM_PICK_SPEC が権威。
  // sequence の human 順序検査中だけPAも候補確認用に構築する。atom自体は未変更で返し、
  // runtime handler が従来どおり正式な pending を生成する。
  const sfSpec = ATOM_PICK_SPEC[verbStr];
  const inspectRuntimeShortForm = opts._runtimePickPause !== undefined && opts._fromAtomHandler !== true;
  if (effectiveTarget === undefined && sfSpec
    && (sfSpec.mode === 'PB' || inspectRuntimeShortForm)
    && (typeof args.n === 'number' || typeof args.max === 'number')) {
    const p = (args.player as Player) ?? 'self';
    const sideDefault = sfSpec.mode === 'PB' ? p : 'either';
    effectiveTarget = buildShortFormPick(sfSpec.defaultArea, args, p, sideDefault) as {
      kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player;
    };
  }
  const target = effectiveTarget;
  if (!target || target.kind !== 'pick' || !target.query) {
    // 非 pick atom (uid=$contact.byUid 等で target なし) でも {dyn} arg は literal 化する。
    // 例: D08007 cutin の delta:{dyn:'$self.sceneTrait.少年探偵団 * 1000'} (pick 不在だが dyn 評価が必要)。
    // resolveDynArgs は {dyn} object のみ変換し、それ以外は同一参照を返すため既存 atom は no-op。
    const dynResolved = resolveDynArgs(state, args, ctx);
    if (dynResolved === args) return atom as Effect;
    return { kind: 'atom', verb: atom.verb as never, args: dynResolved } as Effect;
  }

  // A fixed scene-entry card can carry a pick-shaped target solely as exact
  // source-zone provenance.  It is not another player decision.  Rewriting
  // that target to an array drops area/side/occurrence authority before the
  // runtime handler can validate and consume the selected physical card.
  if (verbStr === 'sceneEnter'
    && !isSceneEnterSwitchPickArgs(args)
    && !sceneEnterOwnsNextPick(args)) {
    return atom as Effect;
  }

  // BUG-065: 2 つの effect 記述形式を区別して解決:
  //   Pattern A: { uid: '$pick', target: {kind:'pick',...} } (sceneRemove / charModifyAP 等)
  //              → uid を picked.uid に置換、target を drop
  //   Pattern B: { target: {kind:'pick',...} } (uid 不在、discard / evidenceToHand 等)
  //              → target を picked の cardId/uid 配列に置換 (atom-handler は配列を期待)
  const isPatternA = args.uid === '$pick';
  // D08021 driver 2026-05-26: Pattern B was originally restricted to args.uid===undefined
  // (discard / evidenceToHand 等)。charStackCard は uid='$self' を保持し cardIds/target を
  // pick で解決する必要があるため、uid が '$pick' でない全パターンを Pattern B として扱う。
  // 初期 walk (`!_fromAtomHandler`) では Pattern B push は下記 guard で抑止される。
  const isPatternB = !isPatternA;
  if (!isPatternA && !isPatternB) return atom as Effect;

  // cluster12 (nested-filter-dyn): filter 内の {dyn} (levelMax:{dyn:'$self.fileCount'} 等) を
  // 列挙前に具体値へ解決 (frozen def は clone して非破壊)。dyn 不在なら同一参照 = no-op。
  const resolvedTarget = resolveTargetFilterDyn(
    state,
    target as { kind?: string; query?: unknown } & Record<string, unknown>,
    ctx,
  );
  const deferLaterIndexedPatternB = opts._fromAtomHandler !== true
    && opts._hasPriorSequenceStep === true
    && isPatternB
    && isIndexedPhysicalPickTarget(resolvedTarget)
    && isExplicitlyKnownNonHumanDecision(target, ctx, opts);
  if (deferLaterIndexedPatternB) {
    // A prior printed step can mutate the indexed zone and invalidate an
    // otherwise exact witness. Keep only this atom unresolved; its runtime
    // handler re-picks from the post-prior-step state. Never refresh a witness.
    return atom as Effect;
  }
  const cands0 = targetCandidates(state, resolvedTarget as TargetingRef, ctx);
  // S2 wave (2026-07-11, B03093): 「相手のイベントの効果によって選ばれない」— pick 経路唯一の
  // chokepoint (AI substitute / human pending 双方が本列挙を通る) で char candidate を負 filter。
  // source カードが kind==='event' かつ相手側 (aura 保有 side ≠ picker) のみ適用。cond 計数・
  // アクション対象・ガードは本関数非経由 = 公式Q&A (「キャラを選ばないイベントの効果による影響は
  // 受ける」/ キャラ能力では選べる / イベントが与えた能力はキャラの能力扱い B02052) と整合。
  const sourceKind = readDef.card(ctx.source.cardId ?? '')?.kind;
  const cands = cands0.filter(c => {
    // An effect that says "use an event from hand" has the same printed
    // authorization gate as every other event-use entry point.  Filter here,
    // before both human pending UI and AI policy selection, so an invalid card
    // cannot consume the only pick and make a later valid card unreachable.
    if (verbStr === 'useEventFromHand' && c.kind === 'card' && !eventUseAllowed(state, c.player, c.cardId)) return false;
    if (c.kind !== 'char' || c.player === ctx.source.player) return true;
    if (readChar.charUntargetableByOppEffect(state, c.uid)) return false;
    return sourceKind !== 'event' || !readChar.charUntargetableByOppEvent(state, c.uid);
  });
  if (cands.length === 0) {
    const zeroChooser: Player = (target as { chooser?: string }).chooser === 'opp-of-owner'
      ? (ctx.source.player === 'self' ? 'opp' : 'self')
      : (opts.byPlayer ?? 'self');
    const zeroN = (target as { n?: { min?: number; max?: number } }).n;
    const zeroHuman = opts._fromAtomHandler === true
      && runtimeHumanDecisionPlayer(ctx, opts) === zeroChooser;
    // Human optional hand-entry is an explicit decision even with no legal cards.
    // Keep this narrow: other zero-candidate verbs retain their chain/no-op semantics.
    const zeroArea = (resolvedTarget as { query?: { area?: unknown } }).query?.area;
    if (verbStr === 'sceneEnter' && zeroArea === 'hand' && zeroN?.min === 0) {
      if (zeroHuman) {
        pushPendingEffectPickSide(normalizePendingPickRange({
          player: zeroChooser,
          ownerPlayer: ctx.source.player,
          candidates: [],
          atomVerb: verbStr,
          atomArgs: toPlainDeep({ ...args }),
          nMin: 0,
          nMax: zeroN.max ?? 1,
          source: pendingSource(state, ctx, opts.source ?? { cardId: '', abilityId: '' }),
          skipResolvesAtom: true,
        }));
        return atom as Effect;
      }
      const initialHuman = opts._fromAtomHandler !== true
        && humanDecisionPlayer(opts) === zeroChooser;
      if (initialHuman && opts._runtimePickPause) {
        // Runtime deliberately surfaces an explicit "登場しない" decision even
        // with no legal hand card. Stop the initial walk here so a later PA pick
        // cannot enter the FIFO first. Other zero-candidate PB atoms stay modal-free.
        opts._runtimePickPause.encountered = true;
        return atom as Effect;
      }
    }
    // 拡張 5 (chain): no-candidate を chain break 信号として記録 (Phase 3c: ctx.dyn 経由。runtime tryRePickFromAtom
    // 経路では本 ctx = resolver chain ctx と同一参照ゆえ resolver chain case が読む。初期 walk 経路は dead write)
    takePublicHandRevealToken(ctx);
    (ctx.dyn ??= {}).chainStepNoApply = true;
    return atom as Effect; // no-op fallback
  }

  const verb = typeof atom.verb === 'string' ? atom.verb : '';
  // WC2a (2026-07-11, B05093 榎本梓): pick query chooser の owner 相対解決 chokepoint (唯一点)。
  // 「相手はその中から1枚選び、自分はそれを手札に加える」= 選ぶ主体は所有者の相手 (chooser)、
  // 恩恵 (hand-add) は所有者。owner = ctx.source.player。'opp-of-owner' のみ opp 側へ振る。
  // 他 chooser 値 ('self'|'owner'|'opp'|'source'|undefined) と短縮形経路は opts.byPlayer 維持で
  // byte 等価 — buildShortFormPick は **絶対** chooser を埋め、caller が同値を opts.byPlayer に渡すため
  // (target.chooser を一律 owner 相対解釈すると owner='opp' の短縮形で二重反転する)。'opp-of-owner' は
  // 型に存在するが既存カード/短縮形いずれも未使用 (grep 実測 0) = 純 additive。pending.player=chooser
  // 側に載り、owner≠chooser の再実行座標系は BUG-175 pending.ownerPlayer が支える (下 push 参照)。
  const byPlayer = targetDecisionPlayer(target, ctx, opts);

  // mega-wave W6 step6 (2026-07-04, r79/B08014): source card が MR の「選ぶ」効果 — 解決済み現場
  // キャラ uid を informational field `_mrSelectCharUids` として args に同梱する (turnEffects への
  // 書込自体は resolver.ts atom dispatch 前 guard が行う = pure walk の純度契約を保つ)。
  // ⚠ human 継続経路 (apply-pick.ts applyPickAndContinuation) と対称実装必須 — 片翼だと CPU 対戦
  // でだけ動く BUG-158 型死角。非 MR source は完全素通し (既存カード byte 不変)。
  const w6MrCardId = ctx.source.cardId ?? opts.source?.cardId;
  const w6IsMrSource = typeof w6MrCardId === 'string' && readDef.isMR(w6MrCardId);
  const w6TagMr = (a: Record<string, unknown>, uids: string[]): Record<string, unknown> =>
    (w6IsMrSource && uids.length > 0) ? { ...a, _mrSelectCharUids: uids } : a;

  // engine mega-wave W2b (2026-07-03, P50/r27): mustBeSelectedByOppEvent (B08087) の forced 集合。
  // pick が「イベント使用の自効果」(ctx.triggerPayload kind==='event-use' + cardId 一致) のとき、
  // chooser の相手側 board char で flag が成立しているものを候補集合から抽出する。
  // ヒラメキ/カットイン/第三者 reaction/キャラ能力は helper 冒頭 gate で即 [] (hot-path 素通し)。
  // unclamped — 消費側が min(forced, nMax) を enforce。
  const forcedUids = forcedInclusionUids(state, cands, byPlayer, opts.source?.cardId, ctx);

  // user_request 20260522_01 #2/#6 BUG-054 + BUG-065 + BUG-075 + BUG-076: human player の
  // ときは side-channel に候補を set して atom を未解決のまま返却 (caller が queue 抑止)。
  //
  // BUG-075: sequence 内に複数 pattern B atom がある場合、後続 atom の walk で side-channel
  // を上書きすると最初の atom 用 modal が出なくなる。既に set 済みなら新規 set せず未解決返却。
  //
  // BUG-076: evidence kind の Candidate は cardId field を持たないため (kind:'evidence',
  // player, index のみ)、従来 filter から除外されていた。evidenceToHand などの atom で
  // evidence area を pick する場合に対応するため、evidence/file kind も candidate に含める。
  // Runtime atom handlers stop resolution by pushing a pending queue entry.
  // Unlike the initial pre-walk, that pause signal is required even when the
  // atom's chooser is not the configured human side.
  const runtimeDyn = ctx.dyn as Record<string, unknown> | undefined;
  // Runtime owner tri-state: known human and marker-absent legacy handlers
  // pause for a pending choice. Multi-target Pattern A also uses the canonical
  // queue even for a known non-human owner: apply-pick owns set selection,
  // forced/distinct constraints, per-target application, bindings, intercepts,
  // causal decisions, and continuation re-entry. Single-target Pattern A and
  // Pattern B keep the existing inline non-human path.
  const explicitRuntimeOwner = opts.humanChooser !== undefined || opts.humanPlayer !== undefined;
  const runtimePatternAMulti = opts._fromAtomHandler === true
    && isPatternA
    && ((target as { n?: { max?: number } }).n?.max ?? 1) > 1;
  const runtimePatternASetCardOccurrence = opts._fromAtomHandler === true
    && isPatternA
    && verb === 'charRemoveSetCard';
  const runtimeQueues = opts._fromAtomHandler === true
    && (runtimePatternAMulti
      || runtimePatternASetCardOccurrence
      || runtimeDyn?.['runtimePickOwnerKnown'] !== true && !explicitRuntimeOwner
      || runtimeHumanDecisionPlayer(ctx, opts) === byPlayer);
  const hasExplicitHumanIdentity = opts.humanChooser === true || opts.humanPlayer !== undefined;
  if (runtimeQueues || (hasExplicitHumanIdentity && humanDecisionPlayer(opts) === byPlayer)) {
    // BUG-078 fix: queue 化したので「既に set 済み」guard は不要。複数の awaiting を
    // 全て push し、UI が FIFO で消化する (BUG-075 の上書き問題は queue 化で解消)。
    // BUG-077: Pattern B (uid 不在) は runtime atom-handler の awaiting-pick path で
    // tryRePickFromAtom 経由で push される (正しい state を持つため)。
    // 初期 walk (triggered.ts → resolveEffectPicks) では set を抑止し、後続 step が
    // 先行 step の target を横取りする問題を回避。Pattern A は runtime に awaiting-pick
    // path が無いため、初期 walk でも push 必要 (flag 無視)。
    if (isPatternB && !opts._fromAtomHandler) {
      if (opts._runtimePickPause) opts._runtimePickPause.encountered = true;
      return atom as Effect;
    }
    const publicHandRevealToken = takePublicHandRevealToken(ctx);
    type CardLike = {
      uid: string;
      cardId: string;
      player: Player;
      kind?: 'char' | 'card' | 'evidence';
      area?: string;
      index?: number;
      hostUid?: string;
      setCardInstanceId?: string;
      hidden?: boolean;
    };
    const cardLikeCands: CardLike[] = [];
    if (verb === 'charRemoveSetCard') charMutator.ensureSetCardInstanceIds(state);
    for (const c of cands) {
      if (c.kind === 'char') {
        if (verb === 'charRemoveSetCard') {
          const host = state.players[c.player].scene.find(candidate => candidate.uid === c.uid);
          for (const entry of host?.setCards ?? []) {
            if (!entry.instanceId) continue;
            if (args.faceDownOnly === true && entry.faceUp) continue;
            cardLikeCands.push({
              uid: setCardOccurrenceUid(c.player, c.uid, entry.instanceId),
              cardId: entry.faceUp ? entry.cardId : c.cardId,
              player: c.player,
              kind: 'card',
              area: 'set-card',
              hostUid: c.uid,
              setCardInstanceId: entry.instanceId,
              ...(entry.faceUp ? {} : { hidden: true }),
            });
          }
        } else {
          cardLikeCands.push({ uid: c.uid, cardId: c.cardId, player: c.player, kind: 'char' });
        }
      } else if (c.kind === 'card') {
        // Card candidates have no native uid.  The occurrence identity must include
        // player + area + index: a union query can contain the same cardId at index 0
        // in more than one area.
        cardLikeCands.push({
          uid: cardOccurrenceUid(c.player, c.area, c.cardId, c.index ?? 0), cardId: c.cardId,
          player: c.player, kind: 'card', area: c.area, index: c.index,
          ...(c.occurrenceWitness === undefined ? {} : { occurrenceWitness: c.occurrenceWitness }),
        });
      } else if (c.kind === 'evidence') {
        // BUG-076: evidence area の pick (D08013 a1 step 2 evidenceToHand 等)
        const evCardId = state.players[c.player].evidence[c.index]?.cardId ?? 'unknown';
        cardLikeCands.push({
          uid: `evidence:${c.player}:${c.index}`, cardId: evCardId, player: c.player,
          kind: 'evidence', area: 'evidence', index: c.index,
          ...(c.occurrenceWitness === undefined ? {} : { occurrenceWitness: c.occurrenceWitness }),
        });
      }
      // file kind は face-down で cardId 不明のため skip (face-up にした後 separately 処理)
    }
    if (cardLikeCands.length === 0) {
      // 拡張 5 (chain): cardLikeCands 0 = pick 不能 → chain break 信号 (Phase 3c: ctx.dyn 経由、同上)
      (ctx.dyn ??= {}).chainStepNoApply = true;
      return atom as Effect;
    }
    const targetRef = target as { n?: { min?: number; max?: number }; query?: { distinctNames?: boolean; distinctLevel?: boolean; distinctColors?: boolean; perSideMax?: number; aggregateLevelMax?: number | { dyn: string } } };
    const aggregateDyn = targetRef.query?.aggregateLevelMax;
    // A later sequence step can depend on a discard bind produced by an
    // earlier runtime atom. Do not freeze its target cap to zero during the
    // initial UI pre-walk; the atom handler will re-resolve it after binding.
    if (typeof aggregateDyn === 'object'
      && aggregateDyn !== null
      && aggregateDyn.dyn.startsWith('$discarded.')
      && !Array.isArray((ctx.bindings as Record<string, unknown>)['$discarded'])) {
      return atom as Effect;
    }
    const aggregateLevelMax = typeof targetRef.query?.aggregateLevelMax === 'number'
      ? targetRef.query.aggregateLevelMax
      : targetRef.query?.aggregateLevelMax && typeof targetRef.query.aggregateLevelMax === 'object'
        ? evalDyn(state, targetRef.query.aggregateLevelMax.dyn, ctx)
        : undefined;
    const pendingPick = preparePendingPickRange({
      player: byPlayer,
      // BUG-175: 能力所有者を同梱 — chooser≠owner の cross-side pick で解決後 ctx の座標系を保つ
      ownerPlayer: ctx.source.player,
      candidates: cardLikeCands,
      atomVerb: verb,
      // BUG-085: { dyn } 値 (例 delta) を costPaid を持つ ctx で literal 化してから
      // pendingEffectPick として human-pick 境界へ運ぶ。
      // BUG-132: deep-plain 化 — runtime 経路 (drafted entry.effect 由来) の nested object が
      // draft proxy のまま produce 境界を跨ぐと次 produce の finalize で revoked-proxy crash。
      atomArgs: toPlainDeep(resolveDynArgs(state, { ...args }, ctx)),
      nMin: targetRef.n?.min ?? 1,
      nMax: targetRef.n?.max ?? 1,
      source: pendingSource(state, ctx, opts.source ?? { cardId: '', abilityId: '' }),
      ...(publicHandRevealToken ? { publicHandRevealToken } : {}),
      // D08021 driver 2026-05-26: target.query.distinctNames を UI に伝える。
      // CardListModal multi-select で同 name component 衝突候補を click 不可化する。
      distinctNames: targetRef.query?.distinctNames === true,
      // Cluster WB1 (2026-07-11, B09105): distinctLevel を UI/AI へ伝播 (「それぞれレベルの異なる」)。
      distinctLevel: targetRef.query?.distinctLevel === true,
      distinctColors: targetRef.query?.distinctColors === true,
      // engine mega-wave W4 (2026-07-03, r84): perSideMax quota を UI/AI へ伝播 (B08019 a2)。
      ...(typeof targetRef.query?.perSideMax === 'number' ? { perSideMax: targetRef.query.perSideMax } : {}),
      ...(typeof aggregateLevelMax === 'number' && Number.isFinite(aggregateLevelMax) ? { aggregateLevelMax } : {}),
      // cluster14: atom が skipResolvesAtom:true を持つ場合 (B09010「2枚まで登場」+ 後続 FILE上1リムーブ)、
      //   0枚 decline を applyPickSkipAndContinuation で解決し remainder を実行する (deckRevealUntil と同契約)。
      skipResolvesAtom: (args as { skipResolvesAtom?: boolean }).skipResolvesAtom === true,
      ...(isSceneEnterSwitchPickArgs(args)
        ? {
            continuation: {
              remainder: [],
              ctx: toPlainDeep(ctx) as EffectCtx,
              kind: 'sequence' as const,
            },
          }
        : {}),
      // W2b (P50/r27): mustBeSelectedByOppEvent forced 集合。UI (auto-select+lock/restrict) と
      // chooseAiPick が honor。空なら undefined (従来 pending と byte 等価)。
      ...(forcedUids.length > 0 ? { forcedUids } : {}),
    } satisfies PendingEffectPickSide);
    if (pendingPick === null) {
      takePublicHandRevealToken(ctx);
      (ctx.dyn ??= {}).chainStepNoApply = true;
      return atom as Effect;
    }
    pushPendingEffectPickSide(pendingPick);
    // A pre-walk already materialized the human decision. Return a no-op
    // carrier so the runtime atom handler cannot enqueue the same pick again.
    // Runtime handlers still receive the original atom: their caller observes
    // the newly queued decision and pauses without re-running the carrier.
    return opts._fromAtomHandler === true
      ? atom as Effect
      : { kind: 'parallel', steps: [] };
  }

  takePublicHandRevealToken(ctx);
  const heuristicPick = (opts.chooseAtomTarget ?? rememberedRuntimeAtomTargetPolicy(ctx))?.(
    state,
    verb,
    args as Readonly<Record<string, unknown>>,
    cands,
    byPlayer,
  );
  // W2b (P50/r27): 単一 pick (Pattern A / cardId contract / generic single) は forced が heuristic を
  // 上書きする (「必ず選ぶ」)。forced 複数 × 単一 pick は先頭 1枚 (min(forced,nMax) clamp、公式Q&A)。
  const forcedFirst = forcedUids.length > 0
    ? cands.find((c) => c.kind === 'char' && c.uid === forcedUids[0])
    : undefined;
  const picked = forcedFirst ?? heuristicPick ?? cands[0];
  if (!picked) return atom as Effect;
  const markAutonomousPick = (resolvedArgs: Record<string, unknown>): Record<string, unknown> => ({
    ...resolvedArgs,
    __causalDecisionActor: byPlayer,
  });

  if (isPatternA) {
    if (picked.kind !== 'char') return atom as Effect;
    if (isSceneEnterSwitchPickArgs(args)) {
      if (!isValidSceneEnterSwitchPickAuthority(
        args,
        byPlayer,
        ctx.source.player,
        ctx.source.player,
      )) {
        return { kind: 'parallel', steps: [] };
      }
      const restored = resolveSceneEnterSwitchPickArgs(args, picked.uid);
      if (restored === null) return { kind: 'parallel', steps: [] };
      return {
        kind: 'atom',
        verb: 'sceneEnter',
        args: markAutonomousPick(
          resolveDynArgs(state, restored, ctx) as Record<string, unknown>,
        ),
      };
    }
    const interceptReactions = findChooseInterceptReactions(state, picked.uid, ctx);
    const decisionTrace = interceptReactions.length === 0 ? undefined : ensureEffectCausalTrace(state, ctx);
    if (decisionTrace !== undefined) recordEffectCausalDecision(state, decisionTrace, byPlayer);
    let effectCancelled = false;
    for (const reaction of interceptReactions) {
      if (reaction.resolution === 'cancel') {
        // Simultaneous mandatory reactions have already triggered.  Cancelling
        // the selected effect must not erase sibling response resolutions.
        effectCancelled = true;
        continue;
      }
      recordEffectCausalDecision(state, decisionTrace, reaction.responder);
      const card = state.players[reaction.responder].hand[0];
      if (!card) {
        // Only declining (or being unable to pay) negates the selected effect.
        // Continue so every already-triggered sibling response still resolves.
        effectCancelled = true;
        continue;
      }
      // Paying the printed cost protects the selected effect: remove one
      // hand occurrence.  Another simultaneous response may still cancel it.
      hand.discardToRemove(state, reaction.responder, [card], { byPlayer: reaction.responder });
      recordEffectCausalOperation(state, ctx, {
        actor: reaction.responder,
        kind: 'discard',
        source: { kind: 'zone', side: reaction.responder, zone: 'hand' },
        targets: [{ kind: 'zone', side: reaction.responder, zone: 'remove' }],
        outcome: { type: 'move', from: 'hand', to: 'remove', count: 1 },
      });
    }
    if (effectCancelled) {
      (ctx.dyn ??= {}).chooseIntercepted = true;
      completeEffectCausalTrace(
        state,
        decisionTrace,
        ctx.source.player,
        'cancel',
        { type: 'state', state: 'negated' },
      );
      return { kind: 'parallel', steps: [] };
    }
    const { target: _omit, ...restArgs } = args;
    void _omit;
    return {
      kind: 'atom',
      verb: atom.verb as never,
      // BUG-085: AI / heuristic 経路 (human-pick 境界なし) でも { dyn } を literal 化する。
      args: interceptReactions.length === 0
        ? markAutonomousPick(w6TagMr(resolveDynArgs(state, { ...restArgs, uid: picked.uid }, ctx) as Record<string, unknown>, [picked.uid]))
        : w6TagMr(resolveDynArgs(state, { ...restArgs, uid: picked.uid }, ctx) as Record<string, unknown>, [picked.uid]),
    } as Effect;
  }

  // A picked Hirameki source is a physical occurrence, not a card-id value.
  // Mirror the human continuation shape so autonomous resolution preserves
  // the selected uid plus its owner/area/index across the declared queue.
  if (args.occurrence === '$pick') {
    const occurrence = (() => {
      if (picked.kind === 'char') {
        return {
          kind: 'char' as const,
          uid: picked.uid,
          cardId: picked.cardId,
          player: picked.player,
          area: 'scene' as const,
        };
      }
      if (picked.kind === 'evidence') {
        const cardId = state.players[picked.player].evidence[picked.index]?.cardId;
        return cardId === undefined ? null : {
          kind: 'evidence' as const,
          uid: `evidence:${picked.player}:${picked.index}`,
          cardId,
          player: picked.player,
          area: 'evidence' as const,
          index: picked.index,
          occurrenceWitness: picked.occurrenceWitness ?? cardOccurrenceWitness(state, picked.player, 'evidence'),
        };
      }
      if (picked.kind !== 'card') return null;
      const supportedArea = picked.area === 'remove'
        || picked.area === 'case'
        || picked.area === 'partner-area'
        || picked.area === 'hand';
      if (!supportedArea) return null;
      return {
        kind: 'card' as const,
        uid: picked.uid ?? cardOccurrenceUid(picked.player, picked.area, picked.cardId, picked.index ?? 0),
        cardId: picked.cardId,
        player: picked.player,
        area: picked.area,
        ...(picked.index === undefined ? {} : { index: picked.index }),
        ...((picked.area === 'remove' && typeof picked.index === 'number')
          ? { occurrenceWitness: picked.occurrenceWitness ?? cardOccurrenceWitness(state, picked.player, 'remove') }
          : picked.occurrenceWitness === undefined ? {} : { occurrenceWitness: picked.occurrenceWitness }),
      };
    })();
    if (occurrence === null) return atom as Effect;
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: markAutonomousPick(resolveDynArgs(state, { ...args, occurrence }, ctx)),
    } as Effect;
  }

  // Pattern B: target → cardId/uid 配列に置換 (atom-handler が配列を期待)
  // BUG-077 後続: evidence kind (evidenceToHand 等の AI 経路) も解決対象に含む
  // BUG-103 (D08021): multi-pick contract (cardIds:'$pick.cardIds')。AI 経路では cardIds が
  // 未解決のまま handler に届き awaiting-pick → no-op (stackedCards=0、a2突撃/a3draw/a4evidence が
  // unlock されず CPU の D08021 がバニラ化)。単一 pick の target:[uid] では cardIds を埋められないため、
  // card 候補から最大 max 枚を greedy 選択し cardIds 配列に詰める (heuristic: 取れるだけ取る)。
  if (args.cardIds === '$pick.cardIds') {
    const nMaxC = (target as { n?: { max?: number } } | undefined)?.n?.max ?? cands.length;
    // engine拡張 wave (2026-06-23): evidence kind も AI multi-pick 対象に含める (human path は
    //   BUG-076 で対応済、CPU 側は 'card' kind 限定だった)。evidenceFlipDown「自分の表向き証拠を
    //   N つまで選び裏向き」(B05013) の CPU 解決用。既存 multi-pick (D08021/B09034) は remove/hand
    //   = 'card' kind ゆえ evidence 追加は純 additive (回帰0)。greedy max 枚 (取れるだけ取る)。
    const chosen = cands
      .filter((c) => c.kind === 'card' || c.kind === 'evidence')
      .slice(0, nMaxC);
    const chosenIds = chosen
      .map((c) => c.kind === 'evidence'
        ? (state.players[c.player].evidence[c.index]?.cardId ?? '')
        : (c as { cardId: string }).cardId)
      .filter((id) => id !== '');
    // target (pick query) は残す: handler が target.query.area を見て source area (remove 等) から
    // 各 cardId を splice する (落とすと stackedCards は増えるが source に残り複製になる)。
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: markAutonomousPick(resolveDynArgs(state, {
        ...args,
        cardIds: chosenIds,
        selectedDeckIndexes: chosen.map((candidate) => candidate.kind === 'card' ? candidate.index : undefined),
        selectedCardOccurrences: chosen.flatMap((candidate) => {
          if (candidate.kind === 'card' && typeof candidate.index === 'number') {
            return [{
              uid: cardOccurrenceUid(candidate.player, candidate.area, candidate.cardId, candidate.index),
              cardId: candidate.cardId,
              area: candidate.area,
              player: candidate.player,
              index: candidate.index,
              ...(candidate.occurrenceWitness === undefined ? {} : { occurrenceWitness: candidate.occurrenceWitness }),
            }];
          }
          if (candidate.kind === 'evidence') {
            const cardId = state.players[candidate.player].evidence[candidate.index]?.cardId;
            return cardId === undefined ? [] : [{
              uid: `evidence:${candidate.player}:${candidate.index}`,
              cardId,
              area: 'evidence' as const,
              player: candidate.player,
              index: candidate.index,
              occurrenceWitness: candidate.occurrenceWitness
                ?? cardOccurrenceWitness(state, candidate.player, 'evidence'),
            }];
          }
          return [];
        }),
      }, ctx)),
    } as Effect;
  }
  // BUG-106 (D11014 a2 / D11019 a1 driver): single-pick contract (cardId:'$pick.cardId')。
  // sceneEnter のように cardId を pick で解決し、target(pick query) を source-area splice の
  // ために保持する atom。AI 経路で cardId を解決しないと handler が awaiting-pick →
  // tryRePickFromAtom (target が pick-query でない) → silent no-op (reanimate 不発、後続 draw 不発)。
  // human path の effectPickResolve (useEngineDispatch hasCardIdBind) と対称に cardId を解決する。
  if (args.cardId === '$pick.cardId') {
    // 2026-06-04 review(#4): 下の generic Pattern B と同じく evidence kind も解決可能にする
    // (現状 sceneEnter は remove/deck/hand=card kind からのみで evidence 経路は未使用だが、整合のため)。
    const pickedCardId =
      picked.kind === 'card' ? picked.cardId :
      picked.kind === 'char' ? picked.cardId :
      picked.kind === 'evidence' ? (state.players[picked.player].evidence[picked.index]?.cardId ?? null) :
      null;
    if (pickedCardId === null) return atom as Effect;
    // target (pick query) は残す: handler が target.query.area を見て source area (remove 等)
    // から cardId を splice する。drop すると複製 (リムーブに残ったまま登場) になる。
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: markAutonomousPick(resolveDynArgs(state, {
        ...args,
        cardId: pickedCardId,
        ...(picked.kind === 'card' ? { selectedCardIndex: picked.index } : {}),
        ...(picked.kind === 'card' && typeof picked.index === 'number'
          ? { selectedCardOccurrences: [{ uid: cardOccurrenceUid(picked.player, picked.area, picked.cardId, picked.index), cardId: picked.cardId, area: picked.area, player: picked.player, index: picked.index, ...(picked.occurrenceWitness === undefined ? {} : { occurrenceWitness: picked.occurrenceWitness }) }] }
          : picked.kind === 'evidence'
            ? { selectedCardOccurrences: [{
              uid: `evidence:${picked.player}:${picked.index}`,
              cardId: pickedCardId,
              area: 'evidence' as const,
              player: picked.player,
              index: picked.index,
              occurrenceWitness: picked.occurrenceWitness
                ?? cardOccurrenceWitness(state, picked.player, 'evidence'),
            }] }
            : {}),
      }, ctx)),
    } as Effect;
  }
  const selectedIndexedOccurrenceOf = (candidate: Candidate) => {
    if (candidate.kind === 'card'
      && typeof candidate.index === 'number'
      && (candidate.area === 'remove' || candidate.area === 'evidence')) {
      return {
        uid: cardOccurrenceUid(candidate.player, candidate.area, candidate.cardId, candidate.index),
        cardId: candidate.cardId,
        area: candidate.area,
        player: candidate.player,
        index: candidate.index,
        occurrenceWitness: candidate.occurrenceWitness
          ?? cardOccurrenceWitness(state, candidate.player, candidate.area),
      };
    }
    if (candidate.kind === 'evidence') {
      const cardId = state.players[candidate.player].evidence[candidate.index]?.cardId;
      if (cardId === undefined) return null;
      return {
        uid: `evidence:${candidate.player}:${candidate.index}`,
        cardId,
        area: 'evidence' as const,
        player: candidate.player,
        index: candidate.index,
        occurrenceWitness: candidate.occurrenceWitness
          ?? cardOccurrenceWitness(state, candidate.player, 'evidence'),
      };
    }
    return null;
  };
  const pickValueOf = (c: (typeof cands)[number]): string | null =>
    c.kind === 'card' ? c.cardId :
    c.kind === 'char' ? c.uid :
    c.kind === 'evidence' ? (state.players[c.player].evidence[c.index]?.cardId ?? null) :
    null;
  // BUG-165 (wave-10 2026-07-02): nMax>1 の generic Pattern B は旧実装が heuristic 先頭 1枚に collapse
  // していた (B04005「手札を2枚リムーブする」が AI 同期 walk で 1枚しか落ちない)。cardIds:'$pick.cardIds'
  // contract (BUG-103) と同流儀で greedy に nMax 枚を target に詰める (「取れるだけ取る」、heuristic の
  // 単一選好は multi では cardIds contract 同様不使用)。nMax<=1 は従来 path byte 不変。
  const nMaxG = (target as { n?: { max?: number } } | undefined)?.n?.max ?? 1;
  if (nMaxG > 1) {
    // W2b (P50/r27): forced (mustBeSelectedByOppEvent) を greedy 先頭に合流してから nMaxG で clamp
    // (「2枚以上/好きな数 → 必ず全部選ぶ」公式Q&A。forced 0 件なら従来順 byte 等価)。
    const orderedCands = forcedUids.length > 0
      ? [...cands.filter((c) => c.kind === 'char' && forcedUids.includes(c.uid)),
         ...cands.filter((c) => !(c.kind === 'char' && forcedUids.includes(c.uid)))]
      : cands;
    const chosenCands = orderedCands
      .filter((candidate) => pickValueOf(candidate) !== null)
      .slice(0, nMaxG);
    const pickValues = chosenCands
      .map(pickValueOf)
      .filter((value): value is string => value !== null);
    if (pickValues.length === 0) return atom as Effect;
    // W6 step6 (r79): 選択集合中の char-kind uid のみを MR タグ対象にする (card/evidence は対象外)
    const w6CharUidsG = chosenCands
      .filter((c): c is Extract<typeof c, { kind: 'char' }> => c.kind === 'char')
      .map((c) => c.uid);
    const indexedOccurrences = chosenCands.map(selectedIndexedOccurrenceOf);
    const selectedOccurrencePart = indexedOccurrences.length > 0
      && indexedOccurrences.every(occurrence => occurrence !== null)
      ? { selectedCardOccurrences: indexedOccurrences }
      : {};
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: markAutonomousPick(w6TagMr(resolveDynArgs(state, {
        ...args,
        target: pickValues,
        ...selectedOccurrencePart,
      }, ctx) as Record<string, unknown>, w6CharUidsG)),
    } as Effect;
  }
  const pickValue = pickValueOf(picked);
  if (pickValue === null) return atom as Effect;
  const indexedOccurrence = selectedIndexedOccurrenceOf(picked);
  return {
    kind: 'atom',
    verb: atom.verb as never,
    args: markAutonomousPick(w6TagMr(
      resolveDynArgs(state, {
        ...args,
        target: [pickValue],
        ...(indexedOccurrence === null ? {} : { selectedCardOccurrences: [indexedOccurrence] }),
      }, ctx) as Record<string, unknown>,
      picked.kind === 'char' ? [picked.uid] : [],
    )),
  } as Effect;
}

export function resolveEffectPicks(
  state: GameState,
  effect: Effect,
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts = {},
): Effect {
  if (opts._fromAtomHandler !== true) {
    rememberRuntimeAtomTargetPolicy(
      ctx,
      opts.chooseAtomTarget,
      opts.runtimeAtomTargetPolicyKey,
    );
  }
  // Continuation atom handlers only receive EffectCtx.  Persist a tri-state
  // owner: known human side, known non-human (`null`), or marker absent for
  // legacy direct handlers (which intentionally queue).
  if (opts.humanChooser !== undefined || opts.humanPlayer !== undefined) {
    const dyn = (ctx.dyn ??= {}) as Record<string, unknown>;
    dyn['runtimePickOwnerKnown'] = true;
    dyn['runtimeHumanPlayer'] = humanDecisionPlayer(opts);
  }
  if (!effect || typeof effect !== 'object') return effect;
  switch (effect.kind) {
    case 'atom':
      return substituteAtomPick(state, effect, ctx, opts);
    case 'sequence': {
      // sequence 内で human choice が pause したら、後続 step は continuation に保存して walk を
      // 打ち切る。choice 本体だけを resume holder に残すことで、選択 option を実行してから次の
      // decision を surface する。holder に remainder まで wrap すると再 walk が次の choice を先に
      // publish し、stack が選択 option の実行前に pause する。
      const seqOut: Effect[] = [];
      for (let i = 0; i < effect.steps.length; i++) {
        const runtimePickPause = opts._runtimePickPause ?? { encountered: false };
        runtimePickPause.encountered = false;
        const pendingQueue = (globalThis as {
          __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
        }).__pendingEffectPickQueue;
        const pickCountBefore = pendingQueue?.length ?? 0;
        const choiceBefore = _peekPendingEffectChoiceSide() !== null;
        const optionalBefore = _peekPendingEffectOptionalSide() !== null;
        seqOut.push(resolveEffectPicks(state, effect.steps[i]!, ctx, {
          ...opts,
          _hasPriorSequenceStep: opts._hasPriorSequenceStep === true || i > 0,
          _runtimePickPause: runtimePickPause,
        }));
        if (runtimePickPause.encountered) {
          // Pattern-B is intentionally queued by its runtime handler. Keep the
          // untouched tail behind that carrier so resolver.run() attaches it as
          // the continuation; pre-walking a later Pattern-A would invert the
          // printed decision order (B01094/B01094P).
          return { kind: 'sequence', steps: [...seqOut, ...effect.steps.slice(i + 1)] };
        }
        if (ctx.dyn?.chooseIntercepted === true) {
          delete ctx.dyn.chooseIntercepted;
          return { kind: 'parallel', steps: [] };
        }
        const choiceAfter = _peekPendingEffectChoiceSide() !== null;
        if (!choiceBefore && choiceAfter) {
          const remainder = effect.steps.slice(i + 1);
          if (remainder.length > 0) {
            appendPendingChoiceContinuation({ remainder, ctx, kind: 'sequence' });
          }
          return { kind: 'sequence', steps: seqOut };
        }
        const optionalAfter = _peekPendingEffectOptionalSide() !== null;
        if (!optionalBefore && optionalAfter) {
          const remainder = effect.steps.slice(i + 1);
          if (remainder.length > 0) {
            appendPendingOptionalContinuation({ remainder, ctx, kind: 'sequence' });
          }
          return { kind: 'sequence', steps: seqOut };
        }
        const queueAfter = (globalThis as {
          __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
        }).__pendingEffectPickQueue;
        if ((queueAfter?.length ?? 0) > pickCountBefore) {
          const remainder = effect.steps.slice(i + 1);
          if (remainder.length > 0) {
            const firstNew = queueAfter?.[pickCountBefore];
            if (firstNew) {
              attachPrewalkContinuation(firstNew, { remainder, ctx, kind: 'sequence' });
            }
          }
          // The queued Pattern-A carrier remains in seqOut as the established
          // runtime safety no-op. Defer the tail until the human resolves it.
          return { kind: 'sequence', steps: seqOut };
        }
      }
      return { kind: 'sequence', steps: seqOut };
    }
    case 'parallel':
      // A public reveal token is causal branch state, not ambient dyn state.
      // Copy it per branch so one sibling cannot decorate another sibling's pick.
      return {
        kind: 'parallel',
        steps: effect.steps.map((s) => resolveEffectPicks(
          state,
          s,
          {
            ...ctx,
            causal: {
              ...ctx.causal,
              ...(ctx.causal?.trace ? { trace: cloneCausalEffectTrace(ctx.causal.trace) } : {}),
            },
          },
          opts,
        )),
      };
    case 'traitChoice': {
      const traits = readDef.allTraits();
      const rawIndex = (ctx.dyn as { choiceIndex?: unknown } | undefined)?.choiceIndex;
      if (typeof rawIndex === 'number' && traits[rawIndex]) {
        delete (ctx.dyn as { choiceIndex?: unknown }).choiceIndex;
        (ctx.bindings as Record<string, unknown>)[effect.bind] = [{ trait: traits[rawIndex] }];
        return resolveEffectPicks(state, effect.then, ctx, opts);
      }
      const human = humanDecisionPlayer(opts);
      if (human === ctx.source.player) {
        const publicHandRevealToken = takePublicHandRevealToken(ctx);
        pushPendingEffectChoiceSide({
          player: human,
          ...(publicHandRevealToken ? { publicHandRevealToken } : {}),
          source: pendingSource(state, ctx, { cardId: opts.source?.cardId ?? '', abilityId: opts.source?.abilityId ?? '', uid: ctx.source.uid ?? '' }),
          options: traits.map((label, index) => ({ index, label })),
        });
        setPendingChoiceResume(effect);
        setPendingChoiceBindings({ ...(ctx.bindings as Record<string, unknown>) });
        return { kind: 'parallel', steps: [] };
      }
      const trait = traits[0];
      if (!trait) return { kind: 'parallel', steps: [] };
      (ctx.bindings as Record<string, unknown>)[effect.bind] = [{ trait }];
      return resolveEffectPicks(state, effect.then, ctx, opts);
    }
    case 'rps':
      // RPS is resolved by its dedicated pending flow.  Keep both branches
      // opaque during ordinary pick pre-walk.
      return effect;
    case 'choice': {
      // BUG-108: ctx.dyn.choiceIndex 指定時は選択 option へ unwrap する (dyn-arg / pick と同様に
      // walk 中に bake)。resolver.run の choice も choiceIndex を読むが、effect は event.queue →
      // entryToCtx で ctx.dyn が落ちるため runtime には届かない。ctx.dyn を保持する resolveEffectPicks
      // (declared-ability / triggered の初期 walk) でここで解決する。
      // 未指定 / 範囲外なら全 option を walk し、resolver.run の default (=0) に委ねる。
      const rawIdx = (ctx.dyn as { choiceIndex?: unknown } | undefined)?.choiceIndex;
      if (
        typeof rawIdx === 'number' && Number.isInteger(rawIdx)
        && rawIdx >= 0 && rawIdx < effect.options.length
      ) {
        // 2026-06-04 review(#5): 消費した choiceIndex は同一 ctx の後続 choice (sequence の別 step)
        // へ leak させない。ctx.dyn は step 間で共有参照のため、消さないと 2 つ目の choice が
        // 前段の index で誤 unwrap する (現状そのようなカードは無いが latent defect の予防)。
        delete (ctx.dyn as { choiceIndex?: unknown }).choiceIndex;
        const closesPublicHandReveal = peekPublicHandRevealToken(ctx) !== undefined;
        const branch = resolveEffectPicks(state, effect.options[rawIdx], ctx, opts);
        // Scope cleanup is required only when this resumed choice owns a
        // public hand-reveal token. Normal choices retain their atom/effect
        // shape for downstream continuations and callers.
        return closesPublicHandReveal
          ? {
              kind: 'sequence',
              steps: [branch, { kind: 'atom', verb: 'publicHandRevealScopeEnd', args: {} }],
            }
          : branch;
      }
      // BUG-121: human の複数 option choice (chooser=owner 側) は option 0 既定化せず pause し、
      // pendingEffectChoice を surface する。pick と同型: side-channel に積み、effect は no-op
      // (空 parallel) を返して runtime に届けない (どの option も実行しない)。choiceResolve dispatch
      // 後に applyChoiceAndContinuation が readDef から元 effect を復元し choiceIndex 付きで再 walk する。
      //   - choiceIndex 指定済 (declared 経路) は上の unwrap 分岐で処理済 → ここに来ない (無傷)
      //   - humanChooser=false (AI / hirameki) は従来通り全 walk → resolver.run default 0 (無傷)
      //   - options.length===1 (構造的単一 choice: B02046/B04071/D11014 等) は従来通り (無傷)
      //   - chooser==='opp' (相手が選ぶ) は human modal に出さない (従来通り)
      if (
        opts.humanChooser === true
        && effect.options.length > 1
        && effect.chooser !== 'opp'
      ) {
        const srcUid = (ctx.source as { uid?: string } | undefined)?.uid ?? '';
        const publicHandRevealToken = takePublicHandRevealToken(ctx);
        pushPendingEffectChoiceSide({
          player: opts.byPlayer ?? 'self',
          ...(publicHandRevealToken ? { publicHandRevealToken } : {}),
          source: pendingSource(state, ctx, {
            cardId: opts.source?.cardId ?? '',
            abilityId: opts.source?.abilityId ?? '',
            uid: srcUid,
          }),
          options: effect.options.map((o, i) => ({
            index: i,
            verb: o.kind === 'atom' ? (o.verb as string) : undefined,
            args: o.kind === 'atom' ? (o.args as Record<string, unknown>) : undefined,
            sceneEnter: containsSceneEnter(o),
          })),
        });
        // 再開 holder = この choice 効果そのもの (top-level)。sequence 内なら sequence case が
        // 後で {sequence:[choice, ...remainder]} に wrap する (pre-choice step 二重実行防止)。
        setPendingChoiceResume(effect);
        // BUG-114: surface 時の ctx.bindings (cutin の $contact.byUid 等) を保持し、resume ctx へ復元する。
        setPendingChoiceBindings({ ...(ctx.bindings as Record<string, unknown>) });
        return { kind: 'parallel', steps: [] };
      }
      return {
        kind: 'choice',
        chooser: effect.chooser,
        options: effect.options.map((o) => resolveEffectPicks(state, o, ctx, opts)),
      };
    }
    case 'optional': {
      // 2026-06-06 タスクC: optional 決定の配線 (choice の boolean 版)。
      //   - ctx.dyn.optionalRun 指定済 (optionalResolve 再開) → その値で確定 (consume 後 delete で leak 防止)。
      //   - humanChooser → pendingEffectOptional を surface して pause (no-op return)。
      //   - AI / non-human → skip (optional は自己コストを含むことが多く既定で使わない)。
      const dynRun = (ctx.dyn as { optionalRun?: unknown } | undefined)?.optionalRun;
      if (typeof dynRun === 'boolean') {
        // 消費した optionalRun は同一 ctx の後続/ネスト optional へ leak させない (choiceIndex と同方針)
        delete (ctx.dyn as { optionalRun?: unknown }).optionalRun;
        const closesPublicHandReveal = peekPublicHandRevealToken(ctx) !== undefined;
        const branch = dynRun
          ? resolveEffectPicks(state, effect.effect, ctx, opts)
          : effect.else ? resolveEffectPicks(state, effect.else, ctx, opts) : { kind: 'parallel' as const, steps: [] };
        // As with a selected choice, only a resumed public hand-reveal window
        // needs an explicit scope terminator. Otherwise preserve the resolved
        // branch's original shape.
        return closesPublicHandReveal
          ? {
              kind: 'sequence',
              steps: [branch, { kind: 'atom', verb: 'publicHandRevealScopeEnd', args: {} }],
            }
          : branch;
      }
      const ownerPlayer = ctx.source.player;
      const decisionPlayer = effect.chooser === 'opp-of-owner'
        ? (ownerPlayer === 'self' ? 'opp' : 'self')
        : ownerPlayer;
      const humanPlayer = humanDecisionPlayer(opts);
      if (humanPlayer === decisionPlayer) {
        const srcUid = (ctx.source as { uid?: string } | undefined)?.uid ?? '';
        const publicHandRevealToken = takePublicHandRevealToken(ctx);
        pushPendingEffectOptionalSide({
          player: decisionPlayer,
          ...(publicHandRevealToken ? { publicHandRevealToken } : {}),
          ownerPlayer,
          source: pendingSource(state, ctx, {
            cardId: opts.source?.cardId ?? '',
            abilityId: opts.source?.abilityId ?? '',
            uid: srcUid,
          }),
          // 再開 ctx で $trigger.<field> を解決できるよう triggerPayload を保持 (B03038)
          triggerPayload: (ctx as { triggerPayload?: unknown }).triggerPayload,
        });
        // 再開 holder = この optional 効果そのもの (optionalResolve 後に再 walk)。
        setPendingOptionalResume(effect);
        // engine wave-18: surface 時の ctx.bindings ($contact.* / ctx.contact) を保持し resume ctx へ復元
        // (BUG-114 choice-bindings の対称。B04092 キャンティ optional{chain[sleep, inContact pick]})。
        setPendingOptionalBindings({ ...(ctx.bindings as Record<string, unknown>) });
        // WC2b: surface 時の costPaid を保持 → resume ctx で $cost.* 参照可 (B06023 invoke)。
        setPendingOptionalCostPaid((ctx as { costPaid?: Record<string, unknown> }).costPaid);
        return { kind: 'parallel', steps: [] };
      }
      if (effect.aiRun === 'if-hand' && state.players[decisionPlayer].hand.length > 0) {
        return resolveEffectPicks(state, effect.effect, ctx, opts);
      }
      return effect.else ? resolveEffectPicks(state, effect.else, ctx, opts) : { kind: 'parallel', steps: [] };
    }
    case 'conditional': {
      // BUG-161 fix (binding-aware, BUG-145 §2 の over-fire 根治): a choice/optional/$pick in the NON-taken branch must not
      // eager-surface a pendingEffectChoice/Optional/Pick. We gate the pre-walk on evalCond and walk
      // ONLY the taken branch — BUT ONLY when `if` is STABLE at pre-walk time (does not depend on a
      // binding set by a prior sequence/chain step). For binding-dependent `if` (deck-look 「公開→
      // $matched→…の場合」family: B06048/B01048/B08020/… steps[N>0]), `$matched`/`$revealed` are not
      // yet bound during the initial walk, so evalCond would be stale-FALSE and wrongly suppress a
      // then-branch that runtime WILL execute (regression: discard/handAdd never resolves). For those
      // we keep walking BOTH branches (current behavior, byte-compatible). Runtime resolver.ts re-evals
      // `if` against the live state and runs only the correct branch either way (double-eval safe:
      // same state+ctx for stable `if`; for binding `if` runtime is the source of truth).
      if (conditionIfIsStable(effect.if)) {
        const taken = evalCond(state, effect.if, ctx);
        return {
          kind: 'conditional',
          if: effect.if,
          then: taken ? resolveEffectPicks(state, effect.then, ctx, opts) : effect.then,
          else: effect.else
            ? (taken ? effect.else : resolveEffectPicks(state, effect.else, ctx, opts))
            : undefined,
        };
      }
      // Do not inspect a human branch before its bind-producing predecessor
      // runs: it could surface an orphaned UI decision.  AI/spectator walks
      // have no modal to protect, so resolve both branches now; runtime still
      // executes only the branch selected after the binding is produced.
      if (conditionHasMissingBinding(effect.if, ctx.bindings)) {
        const runtimeDyn = ctx.dyn as Record<string, unknown> | undefined;
        const knownNonHuman = (runtimeDyn?.['runtimePickOwnerKnown'] === true
          && runtimeDyn?.['runtimeHumanPlayer'] !== 'self'
          && runtimeDyn?.['runtimeHumanPlayer'] !== 'opp')
          // Initial AI pre-walk carries its deterministic picker callback,
          // while legacy runtime atom handlers do not.  Treat only this
          // initial path as non-human; the latter must retain its queue.
          || (opts.humanChooser === false && opts.chooseAtomTarget !== undefined);
        // No marker is legacy runtime territory.  Preserve its queued human
        // boundary instead of eagerly substituting both branches.
        if (!knownNonHuman) return effect;
        return {
          kind: 'conditional',
          if: effect.if,
          then: resolveEffectPicks(state, effect.then, ctx, opts),
          else: effect.else ? resolveEffectPicks(state, effect.else, ctx, opts) : undefined,
        };
      }
      const taken = evalCond(state, effect.if, ctx);
      return {
        kind: 'conditional',
        if: effect.if,
        then: taken ? resolveEffectPicks(state, effect.then, ctx, opts) : effect.then,
        else: effect.else
          ? (taken ? effect.else : resolveEffectPicks(state, effect.else, ctx, opts))
          : undefined,
      };
    }
    case 'forEach':
      // forEach は over の各候補で do を実行する dynamic 構造。$pick は do 内に出ない想定だが
      // 念のため再帰 (do 自体が atom-with-$pick になることはないが、ネスト構造はあり得る)
      return { kind: 'forEach', over: effect.over, do: resolveEffectPicks(state, effect.do, ctx, opts) };
    case 'repeatOptional':
      // The body can depend on bindings created by earlier runtime steps (B09033 $revealed).
      // Defer its walk until the player accepts this round.
      return effect;
    case 'setCardToEvidence':
    case 'moveSetCard':
      return effect;
    case 'replace':
      return { kind: 'replace', trigger: effect.trigger, with: resolveEffectPicks(state, effect.with, ctx, opts) };
    case 'chain':
    case 'negate':
    case 'custom':
      // pre-walk passthrough (un-walked, 参照同一の effect をそのまま返す)。chain の step 内 atom $pick は
      // dispatch 時 (resolver.ts:78 chain case → run(step) → atom-handler tryRePickFromAtom) に解決されるため、
      // ここで pre-walk しなくても drop しない。出荷カードに choice/optional を step に持つ chain は 0 件
      // (Phase 3g 設計レビュー: ALL_CARDS object-walk で実証)。negate/custom は walk 対象の sub-effect を持たない。
      // ※将来 chain step に choice/optional を持つカードが出たら、ここを sequence と同様に walk する必要がある (BUG-152 latent)。
      return effect;
    default: {
      // Phase 3g: Effect union (11 member) の member 脱落を compile-time 検出 (noImplicitReturns 無効ゆえ
      // silent passthrough を塞ぐ)。全 member を明示 case 化したため到達不能。throw ではなく void+return 変種 —
      // 本関数は produce() try 外 (ai/policy.ts:419-423、applyMove→declared-ability:199 経由) から到達するため、
      // 将来到達可能化した際に throw だと stepTurn を貫通する (Phase 3e/3f と同判断)。sibling の resolver.ts:174 が
      // throw なのは run() が dispatch sink で未処理 kind = 実バグ (loud fail) ゆえの正当な非対称。
      const _exhaustive: never = effect;
      void _exhaustive;
      return effect;
    }
  }
}
