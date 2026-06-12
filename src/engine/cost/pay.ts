// engine.cost.pay — Cost payment (mutates draft)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 25-qa-effects-resolution.md (viaCost flag)
//
// IMPORTANT:
//   - Caller MUST invoke pay() inside a produce() block; the function mutates the draft.
//   - During payment we set ctx.viaCost = true. Downstream emit logic can read this
//     to suppress "by own ability" hooks (rules/25). TODO Phase 3.10: wire viaCost
//     into event.emit so triggered abilities do not fire from cost-payment mutations.
//   - canPay() should be called first; pay() throws if a step cannot be paid.

import type { GameState, Cost, EffectCtx, PayResult, Candidate } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';
import { mutate } from '@/engine/mutate/index.js';
import { canPay } from './evaluate.js';

/**
 * Pay a Cost. Mutates the draft in place.
 * Sets ctx.viaCost = true while executing. Restores prior value when done.
 */
export function pay(state: GameState, cost: Cost, ctx: EffectCtx): PayResult {
  const prevViaCost = ctx.viaCost;
  ctx.viaCost = true;

  try {
    const result: PayResult = { paidItems: [], releasedTriggers: [] };
    payInner(state, cost, ctx, result);
    return result;
  } finally {
    ctx.viaCost = prevViaCost;
  }
}

function payInner(state: GameState, cost: Cost, ctx: EffectCtx, acc: PayResult): void {
  switch (cost.kind) {
    case 'sleepSelf': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: sleepSelf requires ctx.source.uid');
      mutate.scene.setState(state, uid, 'sleep');
      acc.paidItems.push({ kind: 'sleepSelf', details: { uid } });
      return;
    }
    case 'sleepChar': {
      const cands = candidates(state, cost.target, ctx);
      // Sleep all (or per pick semantics — caller supplies picked via ctx.picked
      // for pick refs; for simplicity here we sleep all available active ones if
      // no explicit picked override. In practice, the Effect runner sets ctx.picked
      // before invoking cost.pay; we honor it when present.)
      const targets = ctx.picked ?? cands;
      for (const cand of targets) {
        if (cand.kind !== 'char') continue;
        mutate.scene.setState(state, cand.uid, 'sleep');
        acc.paidItems.push({ kind: 'sleepChar', details: { uid: cand.uid } });
      }
      return;
    }
    case 'removeFromHand': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      mutate.hand.discardToRemove(state, ctx.source.player, ids);
      acc.paidItems.push({ kind: 'removeFromHand', details: { ids } });
      return;
    }
    case 'removeFromScene': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      for (const cand of targets) {
        if (cand.kind !== 'char') continue;
        mutate.scene.removeToRemove(state, cand.uid, 'cost');
        acc.paidItems.push({ kind: 'removeFromScene', details: { uid: cand.uid } });
      }
      return;
    }
    // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト。
    // UI 選択 (ctx.dyn.costParams.sceneToDeckBottom.uids) を優先し、無ければ
    // pickCandidates (ctx.picked → 先頭 n) fallback。rules/09・23: リムーブではない
    // ため leave:to-remove は発火しない (scene.toDeck 経由、rules/16 set/stacked 清掃込み)。
    case 'sceneToDeckBottom': {
      const explicit = readSceneToDeckUids(ctx);
      const uids: string[] = [];
      if (explicit.length >= cost.n) {
        uids.push(...explicit.slice(0, cost.n));
      } else {
        const targets = pickCandidates(state, cost.target, ctx, cost.n);
        for (const cand of targets) {
          if (cand.kind === 'char') uids.push(cand.uid);
        }
      }
      for (const uid of uids) {
        mutate.scene.toDeck(state, uid, 'bottom');
        acc.paidItems.push({ kind: 'sceneToDeckBottom', details: { uid } });
      }
      return;
    }
    case 'removeDeckTop': {
      const removed = mutate.deck.removeFromTop(state, cost.player, cost.n);
      acc.paidItems.push({ kind: 'removeDeckTop', details: { removed } });
      return;
    }
    case 'discardEvidence': {
      const p = ctx.source.player;
      const ids: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const top = mutate.evidence.removeTop(state, p);
        if (top) ids.push(top.cardId);
      }
      acc.paidItems.push({ kind: 'discardEvidence', details: { ids } });
      return;
    }
    case 'selfToDeckBottom': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfToDeckBottom requires ctx.source.uid');
      mutate.scene.toDeckBottom(state, uid);
      acc.paidItems.push({ kind: 'selfToDeckBottom', details: { uid } });
      return;
    }
    case 'pay': {
      for (const item of cost.items) {
        payInner(state, item, ctx, acc);
      }
      return;
    }
    case 'choice': {
      // Use ctx.dyn['costChoice'] (number index) if present, else first payable branch.
      const chooseIdx = readChosenIndex(ctx);
      const chosen = chooseIdx !== undefined ? cost.items[chooseIdx] : cost.items.find(i => canPay(state, i, ctx));
      if (!chosen) throw new Error('cost.pay: choice has no payable branch');
      payInner(state, chosen, ctx, acc);
      return;
    }
    case 'fileFrom': {
      // BUG-129 (Task D E3, 2026-06-12): 旧実装は popTop の戻り値を破棄しカードがゲームから
      // 消失していた (リフレッシュ母数バグ、rules/03/14)。FILE 所有者のリムーブエリアへ移す。
      const p = ctx.source.player;
      const ffIds: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const popped = mutate.file.popTop(state, p);
        if (popped) ffIds.push(popped.cardId);
      }
      if (ffIds.length > 0) {
        mutate.remove.add(state, p, ffIds);
      }
      acc.paidItems.push({ kind: 'fileFrom', details: { n: cost.n, ids: ffIds } });
      return;
    }
    case 'flipFaceUpEvidence': {
      const p = ctx.source.player;
      const indices = readFlipIndices(ctx);
      if (indices.length < cost.n.min || indices.length > cost.n.max) {
        throw new Error(
          `cost.pay: flipFaceUpEvidence picks ${indices.length} out of [${cost.n.min}, ${cost.n.max}]`,
        );
      }
      for (const idx of indices) {
        mutate.evidence.flipFaceUp(state, p, idx);
      }
      // Record count for $cost.flipFaceUpEvidence.count placeholder access
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['flipFaceUpEvidence'] = { count: indices.length };
      acc.paidItems.push({ kind: 'flipFaceUpEvidence', details: { count: indices.length, indices } });
      return;
    }
    case 'custom': {
      cost.pay(state, ctx);
      acc.paidItems.push({ kind: 'custom', details: {} });
      return;
    }
    // refactor 2b: payInner は void 戻りのため case 追加漏れが TS で検知されなかった
    // (Task D wave#1 で実証)。never 代入で compile-time 検出する。到達不能。
    default: {
      const _exhaustive: never = cost;
      void _exhaustive;
      return;
    }
  }
}

function pickCandidates(
  state: GameState,
  ref: import('@/engine/types').TargetingRef,
  ctx: EffectCtx,
  n: number,
): Candidate[] {
  // Prefer ctx.picked when matched against ref; otherwise take first n from candidates().
  if (ctx.picked && ctx.picked.length >= n) {
    return ctx.picked.slice(0, n);
  }
  const all = candidates(state, ref, ctx);
  return all.slice(0, n);
}

// Task D E2 (2026-06-12): UI が選んだ sceneToDeckBottom コスト対象 (readFlipIndices と同型)
function readSceneToDeckUids(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const std = params && (params['sceneToDeckBottom'] as { uids?: string[] } | undefined);
  if (std && Array.isArray(std.uids)) {
    return std.uids;
  }
  return [];
}

function readChosenIndex(ctx: EffectCtx): number | undefined {
  const dyn = ctx.dyn;
  if (dyn && typeof dyn['costChoice'] === 'number') {
    return dyn['costChoice'] as number;
  }
  return undefined;
}

function readFlipIndices(ctx: EffectCtx): number[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const fpu = params && (params['flipFaceUpEvidence'] as { indices?: number[] } | undefined);
  if (fpu && Array.isArray(fpu.indices)) {
    return fpu.indices;
  }
  return [];
}
