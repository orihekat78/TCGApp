// engine.effect.run — Effect Descriptor 解釈器 (resolver)
// spec: .claude/specs/engine-api-effect-descriptor.md
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
//
// 設計メモ:
//   - replace / negate は "発動時に即解決" の例外 (rules/15) であり、
//     emit 時の handler が直接 engine.resolve.replace / cancel を呼ぶ。
//     よって engine.effect.run でこれらが渡された場合は明示的に throw する
//     (誤用検知)。
//   - choice の明示選択は ctx.dyn.choiceIndex (number)。未指定のautonomous
//     経路は先頭の適用可能optionを使い、通常のunconditional choiceはindex 0互換。
//   - optional の実行は ctx.dyn.optionalRun (boolean) で行う。未指定 / false なら skip。
//   - forEach は over を engine.target.resolve で展開し、各候補を
//     ctx.bindings['$each'] に単一要素配列として束ねて do を実行する。
//   - parallel は今は sequence と同じ意味。並列実行のセマンティクスが必要に
//     なれば再検討する (TODO: phase 4 以降)。

import type { GameState, Effect, EffectCtx, Candidate } from '../types/index.js';
import type { ContinuationFrame } from './resolve-picks.js';
import { isDraft } from 'immer';
import { runAtom } from './atom-handlers.js';
import { char as charMutator } from '../mutate/char.js'; // W6 step6 (r79): _mrSelectCharUids タグ書込
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from './resolve-picks.js';
import { assertCompleteSetCardSource } from './source-identity.js';
import { resolve as resolveTarget } from '../target/resolve.js';
import { _attachPendingDeckPlaceContinuation, _attachPendingDeckReorderContinuation, _peekPendingDeckPlaceSide, _peekPendingDeckReorderSide, peekPublicHandRevealToken, resolveBindRef, takePublicHandRevealToken } from './atom-handlers/_shared.js';
import { _peekPendingEffectChoiceSide, _peekPendingEffectOptionalSide, _peekPendingEffectRepeatOptionalSide, _peekPendingRpsSide, _peekPendingSetCardChoiceSide, appendPendingChoiceContinuation, appendPendingRpsContinuation, pushPendingEffectRepeatOptionalSide, setPendingEffectRepeatOptionalRemainder, pushPendingRpsSide, setPendingRpsResume, pushPendingSetCardChoiceSide, setPendingSetCardChoiceResume, appendPendingSetCardChoiceContinuation, pushPendingEffectChoiceSide, setPendingChoiceBindings, setPendingChoiceResume, type PendingEffectPickSide, type RpsHand } from './pending-state.js';
import { toPlainDeep } from './pending-state.js';
import { continuationMayEnterSceneForPlayer } from './scene-switch.js';
import {
  adoptEffectCausalTrace,
  cloneCausalEffectTrace,
  ensureEffectCausalTrace,
  handoffPausedEffectCausalTrace,
  markEffectCausalAwaitingResume,
} from '../log/effect-causal.js';

type Player = 'self' | 'opp';

function decisionSource(ctx: EffectCtx): {
  cardId: string; abilityId: string; uid: string;
  setCardId?: string; setCardInstanceId?: string;
  abilityOrigin?: EffectCtx['source']['abilityOrigin']; abilityIndex?: number;
  area?: EffectCtx['source']['area'];
  resolutionKind?: EffectCtx['source']['resolutionKind'];
  triggerBatch?: number; ownerChosenOrder?: number; ownerOrderConfirmed?: boolean;
} {
  return {
    cardId: ctx.source.cardId ?? '',
    abilityId: ctx.source.abilityId ?? '',
    uid: ctx.source.uid ?? '',
    ...(ctx.source.setCardId !== undefined ? { setCardId: ctx.source.setCardId } : {}),
    ...(ctx.source.setCardInstanceId !== undefined ? { setCardInstanceId: ctx.source.setCardInstanceId } : {}),
    ...(ctx.source.abilityOrigin !== undefined ? { abilityOrigin: ctx.source.abilityOrigin } : {}),
    ...(ctx.source.abilityIndex !== undefined ? { abilityIndex: ctx.source.abilityIndex } : {}),
    ...(ctx.source.area ? { area: ctx.source.area } : {}),
    ...(ctx.source.resolutionKind ? { resolutionKind: ctx.source.resolutionKind } : {}),
    ...(ctx.source.triggerBatch !== undefined ? { triggerBatch: ctx.source.triggerBatch } : {}),
    ...(ctx.source.ownerChosenOrder !== undefined ? { ownerChosenOrder: ctx.source.ownerChosenOrder } : {}),
    ...(ctx.source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: ctx.source.ownerOrderConfirmed } : {}),
    ...(ctx.source.declaredBatch !== undefined ? { declaredBatch: ctx.source.declaredBatch } : {}),
  };
}

function sameDecisionSource(
  side: { source: {
    cardId: string;
    abilityId: string;
    uid?: string;
    setCardId?: string;
    setCardInstanceId?: string;
    abilityOrigin?: EffectCtx['source']['abilityOrigin'];
    abilityIndex?: number;
  } },
  ctx: EffectCtx,
): boolean {
  return side.source.cardId === (ctx.source.cardId ?? '')
    && side.source.abilityId === (ctx.source.abilityId ?? '')
    && (side.source.uid ?? '') === (ctx.source.uid ?? '')
    && side.source.setCardId === ctx.source.setCardId
    && side.source.setCardInstanceId === ctx.source.setCardInstanceId
    && side.source.abilityOrigin === ctx.source.abilityOrigin
    && side.source.abilityIndex === ctx.source.abilityIndex;
}

/** Causal display state belongs to one branch only; sibling branches never inherit it. */
function branchScopedCtx(ctx: EffectCtx): EffectCtx {
  return {
    ...ctx,
    causal: {
      ...ctx.causal,
      ...(ctx.causal?.trace ? { trace: cloneCausalEffectTrace(ctx.causal.trace) } : {}),
    },
  };
}

function handoffParallelPause(ctx: EffectCtx, branchCtx: EffectCtx): void {
  handoffPausedEffectCausalTrace(ctx.causal?.trace, branchCtx.causal?.trace);
}

/** Move the cause into an already-prewalked decision from this exact effect. */
function transferPublicHandRevealToPendingDecision(ctx: EffectCtx): void {
  const token = peekPublicHandRevealToken(ctx);
  if (!token) return;
  const choice = _peekPendingEffectChoiceSide();
  if (choice && sameDecisionSource(choice, ctx) && !choice.publicHandRevealToken) {
    choice.publicHandRevealToken = takePublicHandRevealToken(ctx);
    return;
  }
  const optional = _peekPendingEffectOptionalSide();
  if (optional && sameDecisionSource(optional, ctx) && !optional.publicHandRevealToken) {
    optional.publicHandRevealToken = takePublicHandRevealToken(ctx);
  }
}

/**
 * BUG-111 family (continuation-nest, 2026-06-22): 中断 pick に continuation frame を連結する。
 * 既存 continuation があれば **上書きせず** outer 連結の末尾に append する。
 * これにより `sequence[chain[pausing-pick, step2], step3]` で chain (内側) が step2 を同梱した後、
 * 親 sequence (外側) が step3 を append でき、head=内側 → outer=外側 の順に実行される。
 * 単一 frame (outer 無し) は従来 (BUG-111 #1/#2) と byte 互換。
 */
/** Choice can become reachable only after a preceding runtime binding. */
function pauseRuntimeHumanChoice(state: GameState, eff: Extract<Effect, { kind: 'choice' }>, ctx: EffectCtx): boolean {
  const dyn = ctx.dyn as Record<string, unknown> | undefined;
  if (typeof dyn?.choiceIndex === 'number') return false;
  const human = dyn?.runtimePickOwnerKnown === true
    ? dyn.runtimeHumanPlayer
    : (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
  if ((human !== 'self' && human !== 'opp') || human !== ctx.source.player
    || eff.options.length < 2 || eff.chooser === 'opp') return false;
  const trace = ensureEffectCausalTrace(state, ctx);
  markEffectCausalAwaitingResume(trace);
  const publicHandRevealToken = takePublicHandRevealToken(ctx);
  pushPendingEffectChoiceSide({
    player: ctx.source.player,
    ...(publicHandRevealToken ? { publicHandRevealToken } : {}),
    source: {
      ...decisionSource(ctx),
      ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
    },
    options: eff.options.map((option, index) => ({
      index,
      verb: option.kind === 'atom' ? option.verb : undefined,
      args: option.kind === 'atom' ? option.args as Record<string, unknown> : undefined,
    })),
  });
  setPendingChoiceResume(eff);
  setPendingChoiceBindings(toPlainDeep({ ...(ctx.bindings as Record<string, unknown>) }) as Record<string, unknown>);
  (ctx.dyn ??= {}).runtimeChoicePending = true;
  return true;
}

const continuationCtxSnapshots = new WeakMap<object, EffectCtx>();

function attachContinuation(
  pick: { player?: Player; continuation?: ContinuationFrame; sceneEnterSwitchPlayer?: Player },
  frame: ContinuationFrame,
): void {
  // UI dispatch runs the resolver inside Immer. A continuation that crosses the
  // produce boundary must not retain revoked drafts. Plain engine callers rely on
  // the original ctx/bindings identity, so preserve it when no draft is present.
  const safeFrame = snapshotContinuationFrame(frame);
  if (!pick.continuation) {
    pick.continuation = safeFrame;
  } else {
    let tail = pick.continuation;
    while (tail.outer) tail = tail.outer;
    tail.outer = safeFrame;
  }
  const entersSelf = continuationMayEnterSceneForPlayer(pick.continuation, 'self');
  const entersOpp = continuationMayEnterSceneForPlayer(pick.continuation, 'opp');
  const switchPlayer = entersSelf !== entersOpp ? (entersSelf ? 'self' : 'opp') : undefined;
  // One bundled answer can carry a switch victim only when the same player
  // owns both decisions. Cross-owner entry pauses later as its own scene pick.
  if (switchPlayer === pick.player) pick.sceneEnterSwitchPlayer = switchPlayer;
  else delete pick.sceneEnterSwitchPlayer;
}

/**
 * Autonomous choices preserve the historical first-option default unless that
 * option is a top-level conditional known to be false and has no else branch.
 * This lets CPU/headless flows select the first applicable printed branch while keeping ordinary
 * unconditional choices byte-compatible. If every branch is inapplicable,
 * option 0 remains the deliberate no-op fallback.
 */
function autonomousChoiceIndex(
  state: GameState,
  eff: Extract<Effect, { kind: 'choice' }>,
  ctx: EffectCtx,
): number {
  const applicable = eff.options.findIndex(option => (
    option.kind !== 'conditional' || option.else !== undefined || evalCond(state, option.if, ctx)
  ));
  return applicable >= 0 ? applicable : 0;
}

function appendSetCardContinuation(remainder: Effect[], ctx: EffectCtx, kind: 'sequence' | 'chain'): void {
  if (remainder.length === 0) return;
  const resumeCtx = toPlainDeep(ctx) as EffectCtx;
  if (resumeCtx.dyn) delete (resumeCtx.dyn as Record<string, unknown>).setCardChoicePending;
  appendPendingSetCardChoiceContinuation({ remainder, ctx: resumeCtx, kind });
}

function snapshotContinuationFrame(frame: ContinuationFrame): ContinuationFrame {
  const ctxHasDraft = containsDraft(frame.ctx);
  const remainderHasDraft = containsDraft(frame.remainder);
  if (!ctxHasDraft && !remainderHasDraft) return frame;

  let ctx = frame.ctx;
  if (ctxHasDraft) {
    const ctxKey = frame.ctx as object;
    const cached = continuationCtxSnapshots.get(ctxKey);
    if (cached) ctx = cached;
    else {
      ctx = toPlainDeep(frame.ctx);
      continuationCtxSnapshots.set(ctxKey, ctx);
    }
  }
  return {
    ...frame,
    ctx,
    remainder: remainderHasDraft ? toPlainDeep(frame.remainder) : frame.remainder,
  };
}

function containsDraft(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  if (isDraft(value)) return true;
  const objectValue = value as object;
  if (seen.has(objectValue)) return false;
  seen.add(objectValue);
  return Object.keys(objectValue).some((key) =>
    containsDraft((objectValue as Record<string, unknown>)[key], seen));
}

/**
 * Effect Descriptor を解釈・実行する。
 * Immer draft 内 (produce のコールバック) で呼ぶこと。
 */
export function run(state: GameState, eff: Effect, ctx: EffectCtx): void {
  // A terminal result takes effect immediately, including in the middle of a
  // sequence. Recursive calls for later steps must therefore become no-ops.
  if (state.gameResult !== undefined) return;
  assertCompleteSetCardSource(ctx.source);

  switch (eff.kind) {
    case 'sequence': {
      // BUG-105: pick await で一時停止し、残り step を pick 本体 (pending.continuation) に同梱する
      // (BUG-111 で別 FIFO __pendingChainContinuation から移行 = 1:1)。chain と同型。ただし no-apply-break
      // はしない = 各 step は独立。pick を含む step の後段が
      // pick 解決前の盤面で評価される不具合 (D08024 step2 AP対象 / D11020 step2 条件 / D11014 step3 draw) を修正。
      // 注: pick を持たない step のみの sequence は queue 長が増えず従来通り一括実行 (動作不変)。
      const gSeq = globalThis as {
        __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
      };
      for (let i = 0; i < eff.steps.length; i++) {
        const repeatBefore = _peekPendingEffectRepeatOptionalSide() !== null;
        const reorderBefore = _peekPendingDeckReorderSide();
        const placeBefore = _peekPendingDeckPlaceSide();
        const qBefore = gSeq.__pendingEffectPickQueue?.length ?? 0;
        const choiceBefore = _peekPendingEffectChoiceSide();
        const rpsBefore = _peekPendingRpsSide();
        const setCardBefore = _peekPendingSetCardChoiceSide();
        run(state, eff.steps[i]!, ctx);
        transferPublicHandRevealToPendingDecision(ctx);
        if (_peekPendingEffectChoiceSide() !== choiceBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) appendPendingChoiceContinuation(snapshotContinuationFrame({ remainder, ctx, kind: 'sequence' }));
          delete ctx.dyn?.runtimeChoicePending;
          return;
        }
        if (_peekPendingRpsSide() !== rpsBefore) {
          appendPendingRpsContinuation(snapshotContinuationFrame({ remainder: eff.steps.slice(i + 1), ctx, kind: 'sequence' }));
          delete ctx.dyn?.rpsPending;
          return;
        }
        if (_peekPendingSetCardChoiceSide() !== setCardBefore) {
          appendSetCardContinuation(eff.steps.slice(i + 1), ctx, 'sequence');
          delete ctx.dyn?.setCardChoicePending;
          return;
        }
        const repeatAfter = _peekPendingEffectRepeatOptionalSide() !== null;
        if (!repeatBefore && repeatAfter) { setPendingEffectRepeatOptionalRemainder(eff.steps.slice(i + 1)); return; }
        const reorderAfter = _peekPendingDeckReorderSide();
        if (reorderAfter && reorderAfter !== reorderBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            _attachPendingDeckReorderContinuation({
              remainder,
              ctx: toPlainDeep(ctx) as EffectCtx,
              kind: 'sequence',
            }, true);
          }
          return;
        }
        const placeAfter = _peekPendingDeckPlaceSide();
        if (placeAfter && placeAfter !== placeBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            _attachPendingDeckPlaceContinuation({
              remainder,
              ctx: toPlainDeep(ctx) as EffectCtx,
              kind: 'sequence',
            }, true);
          }
          return;
        }
        const qAfter = gSeq.__pendingEffectPickQueue?.length ?? 0;
        if (qAfter > qBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            // BUG-111: continuation を「この step で enqueue された最初の pick」本体に同梱 (別 FIFO 廃止 → 1:1)。
            // BUG-111 family (nest): 内側 (chain) が既に同梱済なら上書きせず outer に append する。
            const firstNew = gSeq.__pendingEffectPickQueue?.[qBefore];
            if (firstNew) attachContinuation(firstNew, { remainder, ctx, kind: 'sequence' });
          }
          return; // sequence 一時停止 (pick 解決後に continuation で残り step が post-pick 盤面で実行)
        }
      }
      return;
    }
    // 拡張 5 (D08003 driver): 公式テキスト「そうした場合」 semantics。
    // step N の実効果あり (= pick 不可で no-op でない) のとき N+1 を実行。
    // pick await 時は残りを「enqueue された pick 本体」の `continuation` に同梱し (BUG-111)、
    // effectPickResolve / drainAiEffectPicks が pick 解決時に実行する。
    case 'chain': {
      const g = globalThis as {
        __pendingEffectPickQueue?: PendingEffectPickSide[];
      };
      for (let i = 0; i < eff.steps.length; i++) {
        const step = eff.steps[i]!;
        // Phase 3c (2026-06-22): chain step の no-apply 信号を globalThis __chainStepNoApply から ctx.dyn へ移設。
        // ctx は本 run() tree の全 child run()/runAtom に同一参照で素通しされるため、atom-handler /
        // resolve-picks (tryRePickFromAtom 経由) が同一 ctx に立てた値を本ループが読む (intra-produce)。
        (ctx.dyn ??= {}).chainStepNoApply = false;
        const reorderBefore = _peekPendingDeckReorderSide();
        const placeBefore = _peekPendingDeckPlaceSide();
        const queueLenBefore = g.__pendingEffectPickQueue?.length ?? 0;
        const choiceBefore = _peekPendingEffectChoiceSide();
        const rpsBefore = _peekPendingRpsSide();
        const setCardBefore = _peekPendingSetCardChoiceSide();
        run(state, step, ctx);
        transferPublicHandRevealToPendingDecision(ctx);
        if (_peekPendingEffectChoiceSide() !== choiceBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) appendPendingChoiceContinuation(snapshotContinuationFrame({ remainder, ctx, kind: 'chain' }));
          delete ctx.dyn?.runtimeChoicePending;
          return;
        }
        if (_peekPendingRpsSide() !== rpsBefore) {
          appendPendingRpsContinuation(snapshotContinuationFrame({ remainder: eff.steps.slice(i + 1), ctx, kind: 'chain' }));
          delete ctx.dyn?.rpsPending;
          return;
        }
        if (_peekPendingSetCardChoiceSide() !== setCardBefore) {
          appendSetCardContinuation(eff.steps.slice(i + 1), ctx, 'chain');
          delete ctx.dyn?.setCardChoicePending;
          return;
        }
        const reorderAfter = _peekPendingDeckReorderSide();
        if (reorderAfter && reorderAfter !== reorderBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            _attachPendingDeckReorderContinuation({
              remainder,
              ctx: toPlainDeep(ctx) as EffectCtx,
              kind: 'chain',
            }, true);
          }
          return;
        }
        const placeAfter = _peekPendingDeckPlaceSide();
        if (placeAfter && placeAfter !== placeBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            _attachPendingDeckPlaceContinuation({
              remainder,
              ctx: toPlainDeep(ctx) as EffectCtx,
              kind: 'chain',
            }, true);
          }
          return;
        }
        const queueLenAfter = g.__pendingEffectPickQueue?.length ?? 0;
        if (queueLenAfter > queueLenBefore) {
          // step が pick await → 残り step を「この step で enqueue された最初の pick」本体に同梱 (BUG-111)
          // BUG-111 family (nest): 既存 continuation があれば上書きせず outer に append する。
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            const firstNew = g.__pendingEffectPickQueue?.[queueLenBefore];
            if (firstNew) {
              attachContinuation(firstNew, { remainder, ctx, kind: 'chain' });
            }
          }
          return; // chain 一時停止
        }
        if (ctx.dyn?.chainStepNoApply) {
          // step が no-candidate → chain break (以降 skip)
          return;
        }
      }
      return;
    }
    case 'parallel': {
      // TODO: Phase 4+ で必要に応じて並列セマンティクスを定義する。
      // 現状は sequence と同じ挙動 (副作用順は配列順)。
      const g = globalThis as {
        __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
      };
      for (let i = 0; i < eff.steps.length; i++) {
        const branchCtx = branchScopedCtx(ctx);
        const reorderBefore = _peekPendingDeckReorderSide();
        const placeBefore = _peekPendingDeckPlaceSide();
        const queueLenBefore = g.__pendingEffectPickQueue?.length ?? 0;
        const choiceBefore = _peekPendingEffectChoiceSide();
        const rpsBefore = _peekPendingRpsSide();
        const setCardBefore = _peekPendingSetCardChoiceSide();
        run(state, eff.steps[i]!, branchCtx);
        transferPublicHandRevealToPendingDecision(branchCtx);
        const remainder = eff.steps.slice(i + 1);
        if (_peekPendingEffectChoiceSide() !== choiceBefore) {
          handoffParallelPause(ctx, branchCtx);
          if (remainder.length > 0) appendPendingChoiceContinuation(snapshotContinuationFrame({ remainder, ctx: branchScopedCtx(ctx), kind: 'sequence' }));
          delete branchCtx.dyn?.runtimeChoicePending;
          return;
        }
        if (_peekPendingRpsSide() !== rpsBefore) {
          handoffParallelPause(ctx, branchCtx);
          if (remainder.length > 0) appendPendingRpsContinuation(snapshotContinuationFrame({ remainder, ctx: branchScopedCtx(ctx), kind: 'sequence' }));
          delete branchCtx.dyn?.rpsPending;
          return;
        }
        if (_peekPendingSetCardChoiceSide() !== setCardBefore) {
          handoffParallelPause(ctx, branchCtx);
          appendSetCardContinuation(remainder, branchScopedCtx(ctx), 'sequence');
          delete branchCtx.dyn?.setCardChoicePending;
          return;
        }
        const reorderAfter = _peekPendingDeckReorderSide();
        if (reorderAfter && reorderAfter !== reorderBefore) {
          handoffParallelPause(ctx, branchCtx);
          if (remainder.length > 0) {
            // `parallel` currently has sequence semantics, so its deferred tail
            // resumes through the existing sequence continuation representation.
            _attachPendingDeckReorderContinuation(snapshotContinuationFrame({ remainder, ctx: branchScopedCtx(ctx), kind: 'sequence' }), true);
          }
          return;
        }
        const placeAfter = _peekPendingDeckPlaceSide();
        if (placeAfter && placeAfter !== placeBefore) {
          handoffParallelPause(ctx, branchCtx);
          if (remainder.length > 0) {
            _attachPendingDeckPlaceContinuation(snapshotContinuationFrame({ remainder, ctx: branchScopedCtx(ctx), kind: 'sequence' }), true);
          }
          return;
        }
        const queueLenAfter = g.__pendingEffectPickQueue?.length ?? 0;
        if (queueLenAfter > queueLenBefore) {
          handoffParallelPause(ctx, branchCtx);
          if (remainder.length > 0) {
            const firstNew = g.__pendingEffectPickQueue?.[queueLenBefore];
            if (firstNew) attachContinuation(firstNew, { remainder, ctx: branchScopedCtx(ctx), kind: 'sequence' });
          }
          return;
        }
        adoptEffectCausalTrace(ctx.causal?.trace, branchCtx.causal?.trace);
      }
      return;
    }
    case 'choice': {
      if (pauseRuntimeHumanChoice(state, eff, ctx)) return;
      // Explicit human/declared choice wins. Autonomous flow skips a known
      // inapplicable top-level conditional, otherwise preserves option 0.
      const raw = ctx.dyn?.choiceIndex;
      const idx = typeof raw === 'number' && Number.isInteger(raw)
        ? raw
        : autonomousChoiceIndex(state, eff, ctx);
      if (idx < 0 || idx >= eff.options.length) {
        throw new Error(`effect.run: choice index ${idx} out of range [0, ${eff.options.length})`);
      }
      run(state, eff.options[idx], ctx);
      return;
    }
    case 'optional': {
      // ctx.dyn.optionalRun が true なら実行、それ以外は skip。
      const should = ctx.dyn?.optionalRun === true;
      if (should) {
        run(state, eff.effect, ctx);
      }
      return;
    }
    case 'conditional': {
      const ok = evalCond(state, eff.if, ctx);
      if (ok) {
        run(state, eff.then, ctx);
      } else if (eff.else !== undefined) {
        run(state, eff.else, ctx);
      }
      return;
    }
    case 'forEach': {
      const list: Candidate[] = resolveTarget(state, eff.over, ctx);
      // 直前の $each バインディングを退避し、ループ完了後に復元する。
      const prev = ctx.bindings['$each'];
      try {
        for (let i = 0; i < list.length; i++) {
          const cand = list[i]!;
          ctx.bindings['$each'] = [cand];
          const reorderBefore = _peekPendingDeckReorderSide();
          const placeBefore = _peekPendingDeckPlaceSide();
          const qBefore = (globalThis as {
            __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
          }).__pendingEffectPickQueue?.length ?? 0;
          run(state, eff.do, ctx);
          const reorderAfter = _peekPendingDeckReorderSide();
          if (reorderAfter && reorderAfter !== reorderBefore) {
            const remaining = list.slice(i + 1);
            if (remaining.length > 0) {
              const bindings = { ...ctx.bindings };
              if (prev === undefined) delete bindings['$each'];
              else bindings['$each'] = prev;
              if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachReorderRemaining')) {
                delete bindings[eff.over.bindKey];
              }
              let suffix = 0;
              let bindKey = '$__forEachReorderRemaining';
              while (bindings[bindKey] !== undefined) bindKey = `$__forEachReorderRemaining${++suffix}`;
              bindings[bindKey] = remaining;
              const resumeCtx: EffectCtx = { ...ctx, bindings };
              _attachPendingDeckReorderContinuation({
                remainder: [{ kind: 'forEach', over: { kind: 'fromBound', bindKey }, do: eff.do }],
                ctx: resumeCtx,
                kind: 'sequence',
              }, true);
            }
            return;
          }
          const placeAfter = _peekPendingDeckPlaceSide();
          if (placeAfter && placeAfter !== placeBefore) {
            const remaining = list.slice(i + 1);
            if (remaining.length > 0) {
              const bindings = { ...ctx.bindings };
              if (prev === undefined) delete bindings['$each'];
              else bindings['$each'] = prev;
              if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachPlaceRemaining')) {
                delete bindings[eff.over.bindKey];
              }
              let suffix = 0;
              let bindKey = '$__forEachPlaceRemaining';
              while (bindings[bindKey] !== undefined) bindKey = `$__forEachPlaceRemaining${++suffix}`;
              bindings[bindKey] = remaining;
              const resumeCtx: EffectCtx = { ...ctx, bindings };
              _attachPendingDeckPlaceContinuation({
                remainder: [{ kind: 'forEach', over: { kind: 'fromBound', bindKey }, do: eff.do }],
                ctx: resumeCtx,
                kind: 'sequence',
              }, true);
            }
            return;
          }
          const queue = (globalThis as {
            __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
          }).__pendingEffectPickQueue;
            if ((queue?.length ?? 0) > qBefore) {
            const remaining = list.slice(i + 1);
            if (remaining.length > 0) {
              const bindings = { ...ctx.bindings };
              if (prev === undefined) delete bindings['$each'];
              else bindings['$each'] = prev;
              if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachPickRemaining')) {
                delete bindings[eff.over.bindKey];
              }
              let suffix = 0;
              let bindKey = '$__forEachPickRemaining';
              while (bindings[bindKey] !== undefined) bindKey = `$__forEachPickRemaining${++suffix}`;
              bindings[bindKey] = remaining;
              const firstNew = queue?.[qBefore];
              if (firstNew) {
                attachContinuation(firstNew, {
                  remainder: [{ kind: 'forEach', over: { kind: 'fromBound', bindKey }, do: eff.do }],
                  ctx: { ...ctx, bindings },
                  kind: 'sequence',
                });
              }
            }
              return;
            }
            if (ctx.dyn?.setCardChoicePending === true) {
              const remaining = list.slice(i + 1);
              if (remaining.length > 0) {
                const bindings = { ...ctx.bindings };
                if (prev === undefined) delete bindings['$each'];
                else bindings['$each'] = prev;
                let bindKey = '$__forEachSetCardRemaining';
                let suffix = 0;
                while (bindings[bindKey] !== undefined) bindKey = `$__forEachSetCardRemaining${++suffix}`;
                bindings[bindKey] = remaining;
                appendSetCardContinuation([{ kind: 'forEach', over: { kind: 'fromBound', bindKey }, do: eff.do }], { ...ctx, bindings }, 'sequence');
              }
              delete ctx.dyn.setCardChoicePending;
              return;
            }
        }
      } finally {
        if (prev === undefined) {
          delete ctx.bindings['$each'];
        } else {
          ctx.bindings['$each'] = prev;
        }
        if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachReorderRemaining')) {
          delete ctx.bindings[eff.over.bindKey];
        }
        if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachPlaceRemaining')) {
          delete ctx.bindings[eff.over.bindKey];
        }
        if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachPickRemaining')) {
          delete ctx.bindings[eff.over.bindKey];
        }
        if (eff.over.kind === 'fromBound' && eff.over.bindKey.startsWith('$__forEachSetCardRemaining')) {
          delete ctx.bindings[eff.over.bindKey];
        }
      }
      return;
    }
    case 'repeatOptional': {
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== ctx.source.player) return;
      const trace = ensureEffectCausalTrace(state, ctx);
      markEffectCausalAwaitingResume(trace);
      pushPendingEffectRepeatOptionalSide({
        player: ctx.source.player,
        source: {
          ...decisionSource(ctx),
          uid: ctx.source.uid ?? '',
          ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
        },
        remaining: eff.max,
      }, { body: eff.body, remaining: eff.max, ctx, remainder: [] });
      return;
    }
    case 'traitChoice':
      // Resolved during pre-walk. Runtime fallback is intentionally inert.
      return;
    case 'rps': {
      const hands: RpsHand[] = ['rock', 'paper', 'scissors'];
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      const owner = ctx.source.player;
      const wins = (a: RpsHand, b: RpsHand): boolean =>
        (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
      const randomHand = (): RpsHand => hands[Math.floor(Math.random() * hands.length)]!;
      if (human === null) {
        const ownerHand = randomHand();
        let otherHand = randomHand();
        while (ownerHand === otherHand) otherHand = randomHand();
        const branch = wins(ownerHand, otherHand) ? eff.win : eff.lose;
        run(state, resolveEffectPicks(state, branch, ctx, { byPlayer: owner, humanChooser: false }), ctx);
        return;
      }
      const aiHand = randomHand();
      const trace = ensureEffectCausalTrace(state, ctx);
      markEffectCausalAwaitingResume(trace);
      pushPendingRpsSide({
        player: human,
        ownerPlayer: owner,
        aiHand,
        source: {
          ...decisionSource(ctx),
          uid: ctx.source.uid ?? '',
          ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
        },
      });
      setPendingRpsResume(eff, { ...(ctx.bindings as Record<string, unknown>) });
      (ctx.dyn ??= {}).rpsPending = true;
      return;
    }
    case 'setCardToEvidence': {
      const hostUid = resolveBindRef(eff.hostUid, ctx) as string;
      if (typeof hostUid !== 'string' || hostUid.startsWith('$')) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      charMutator.ensureSetCardInstanceIds(state);
      const host = (['self', 'opp'] as const).flatMap((player) => state.players[player].scene.map((char) => ({ player, char }))).find(({ char }) => char.uid === hostUid);
      if (!host || host.char.setCards.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== ctx.source.player) {
        const entry = host.char.setCards[host.char.setCards.length - 1]!;
        const moved = charMutator.takeOneSetCard(state, hostUid, entry.instanceId ?? '');
        if (!moved) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
        state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: true, origin: { turn: state.turn.number, via: 'effect', sourceCardId: ctx.source.cardId } });
        advanceIndexedZoneEpoch(state, moved.player, 'evidence');
        return;
      }
      const entries = host.char.setCards.map((entry, index) => ({ instanceId: entry.instanceId ?? '', ordinal: index + 1 })).filter((entry) => entry.instanceId !== '');
      if (entries.length === 0) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      const trace = ensureEffectCausalTrace(state, ctx);
      markEffectCausalAwaitingResume(trace);
      const choice = {
        player: human,
        hostUid,
        entries,
        source: {
          ...decisionSource(ctx),
          uid: ctx.source.uid ?? '',
          ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
        },
      };
      pushPendingSetCardChoiceSide(choice);
      setPendingSetCardChoiceResume(eff, { ...(ctx.bindings as Record<string, unknown>) }, choice);
      (ctx.dyn ??= {}).setCardChoicePending = true;
      return;
    }
    case 'moveSetCard': {
      const hostUid = resolveBindRef(eff.hostUid, ctx) as string;
      if (typeof hostUid !== 'string' || hostUid.startsWith('$')) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      const destination = eff.destination.area === 'scene'
        ? { area: 'scene' as const, hostUid: resolveBindRef(eff.destination.hostUid, ctx) as string }
        : eff.destination;
      if (destination.area === 'scene' && (typeof destination.hostUid !== 'string' || destination.hostUid.startsWith('$'))) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      charMutator.ensureSetCardInstanceIds(state);
      const host = (['self', 'opp'] as const).flatMap((player) => state.players[player].scene.map((char) => ({ player, char }))).find(({ char }) => char.uid === hostUid);
      if (!host) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      const entries = host.char.setCards
        .map((entry, index) => ({ entry, instanceId: entry.instanceId ?? '', ordinal: index + 1 }))
        .filter(({ entry, instanceId }) => instanceId !== '' && (eff.face === 'any' || (eff.face === 'up' ? entry.faceUp : !entry.faceUp)));
      if (entries.length === 0) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== ctx.source.player) {
        const moved = charMutator.moveOneSetCard(state, hostUid, entries[entries.length - 1]!.instanceId, eff.face, destination);
        if (!moved) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
        if (destination.area === 'evidence') {
          state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: destination.faceUp, origin: { turn: state.turn.number, via: 'effect', sourceCardId: ctx.source.cardId } });
          advanceIndexedZoneEpoch(state, moved.player, 'evidence');
        } else if (destination.area === 'hand') {
          state.players[moved.player].hand.push(moved.cardId);
        }
        return;
      }
      const trace = ensureEffectCausalTrace(state, ctx);
      markEffectCausalAwaitingResume(trace);
      const choice = {
        player: human,
        hostUid,
        face: eff.face,
        destination,
        // A face-up set card is already public information. Preserve that UI
        // visibility while never serializing an identity for a face-down entry.
        entries: entries.map(({ entry, instanceId, ordinal }) => entry.faceUp
          ? { instanceId, ordinal, hidden: false, cardId: entry.cardId }
          : { instanceId, ordinal, hidden: true }),
        source: {
          ...decisionSource(ctx),
          uid: ctx.source.uid ?? '',
          ...(trace ? { causalTrace: cloneCausalEffectTrace(trace) } : {}),
        },
      };
      pushPendingSetCardChoiceSide(choice);
      setPendingSetCardChoiceResume(eff, { ...(ctx.bindings as Record<string, unknown>) }, choice);
      (ctx.dyn ??= {}).setCardChoicePending = true;
      return;
    }
    case 'replace':
    case 'negate':
      throw new Error(
        'replace/negate are immediate-resolution; not runnable via effect.run — see resolver stack handling',
      );
    case 'atom': {
      // mega-wave W6 step6 (2026-07-04, r79/B08014): MR の「選ぶ」効果で解決された現場キャラへ
      // selectedByOwnMr を実行 **前** に記録する (atom 自体が対象を移動/除去しても標識は先に立つ)。
      // _mrSelectCharUids は resolve-picks (AI 同期 walk) / apply-pick (human 継続) の両 pick 経路が
      // source card = MR の時のみ付与する informational field — 既存カードには存在しない → property
      // 不在 1 判定のみのゼロコスト素通し (全 atom 共有 dispatch ゆえ blast radius 最小化)。
      // owner guard = ctx.source.player (「**自分の**MRの能力」— 相手 MR による選択は数えない)。
      const w6MrUids = (eff.args as Record<string, unknown> | undefined)?.['_mrSelectCharUids'];
      if (Array.isArray(w6MrUids) && w6MrUids.length > 0) {
        for (const u of w6MrUids) {
          if (typeof u === 'string') charMutator.tagSelectedByOwnMr(state, u, ctx.source.player);
        }
      }
      const decisionActor = (eff.args as Record<string, unknown> | undefined)?.__causalDecisionActor;
      const previousDecisionActor = ctx.causal?.pendingDecisionActor;
      if (decisionActor === 'self' || decisionActor === 'opp') {
        (ctx.causal ??= {}).pendingDecisionActor = decisionActor;
      }
      try {
        runAtom(state, eff.verb, eff.args, ctx);
      } finally {
        if (
          (decisionActor === 'self' || decisionActor === 'opp')
          && ctx.causal?.pendingDecisionActor === decisionActor
        ) {
          if (previousDecisionActor === undefined) delete ctx.causal.pendingDecisionActor;
          else ctx.causal.pendingDecisionActor = previousDecisionActor;
        }
      }
      return;
    }
    case 'custom': {
      eff.fn(state, ctx);
      return;
    }
    default: {
      const _exhaustive: never = eff;
      throw new Error(`effect.run: unknown kind ${String(_exhaustive)}`);
    }
  }
}
