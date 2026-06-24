// engine.cost.canPay — Cost feasibility check (read-only)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 26-qa-deck-refresh.md (デッキ不足→不可)
//
// canPay is read-only. It does NOT mutate state and does NOT consume costs.

import type { GameState, Cost, EffectCtx, TargetingRef } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';

// refactor 2b (2026-06-12): Cost union の kind 一覧を value として単一ソース化。
// `satisfies Record<Cost['kind'], true>` で union との両方向同期をコンパイル時に強制。
// scripts/taskA-validate-specs.cjs COSTS との同期は tests/engine/sync-taskA-whitelists.test.ts。
const COST_KIND_MAP = {
  sleepSelf: true, sleepChar: true, stunChar: true, removeFromHand: true, removeFromScene: true,
  removeDeckTop: true, discardEvidence: true, selfToDeckBottom: true,
  sceneToDeckBottom: true, // Task D E2 (2026-06-12)
  removeAreaToDeckBottom: true, // cluster4 (2026-06-14)
  removeSetCard: true, // engine additive wave (2026-06-24): 裏向きセットを合わせて n 枚リムーブ (B08033 a2)
  pay: true, choice: true, fileFrom: true, flipFaceUpEvidence: true, custom: true,
} as const satisfies Record<Cost['kind'], true>;
export const COST_KINDS: ReadonlySet<string> = new Set(Object.keys(COST_KIND_MAP));

/**
 * Check if a Cost is fully payable in the given state.
 */
export function canPay(state: GameState, cost: Cost, ctx: EffectCtx): boolean {
  switch (cost.kind) {
    case 'sleepSelf': {
      const uid = ctx.source.uid;
      if (!uid) return false;
      const c = findChar(state, uid);
      if (!c) return false;
      // Only active is payable: rules/21 sleep-icon cost means "sleep this character".
      // A character already sleeping has no state change → no real cost.
      // A stun character cannot be made to sleep via a cost action.
      return c.state === 'active';
    }
    case 'sleepChar': {
      const cands = candidates(state, cost.target, ctx);
      if (cands.length === 0) return false;
      // At least one candidate must be in a state we can sleep (active)
      return cands.some(cand => {
        if (cand.kind !== 'char') return false;
        const c = findChar(state, cand.uid);
        return !!c && c.state === 'active';
      });
    }
    // engine additive wave (2026-06-24): stunChar — sleepChar と同形。コスト文「アクティブ状態の[X]」より
    // active 候補が最低1枚必要 (sleep/stun は対象不可、rules/03 スタン特殊挙動)。
    case 'stunChar': {
      const cands = candidates(state, cost.target, ctx);
      if (cands.length === 0) return false;
      return cands.some(cand => {
        if (cand.kind !== 'char') return false;
        const c = findChar(state, cand.uid);
        return !!c && c.state === 'active';
      });
    }
    case 'removeFromHand': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    case 'removeFromScene': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト。
    // rules/21: 全部行えなければ使用不可 (candidates >= n)。デッキ枚数条件は無い。
    case 'sceneToDeckBottom': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // cluster4 (2026-06-14): 〚リムーブエリアにある…を n 枚デッキの下に移す〛コスト。
    // sceneToDeckBottom と同型 (cost.target は area:'remove' の pick)。
    // rules/21: 全部行えなければ使用不可 (candidates >= n)。デッキへ「増やす」だけなのでデッキ枚数条件は無い。
    case 'removeAreaToDeckBottom': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
    //   リムーブする〛コスト (B08033 a2)。self 全 scene の faceUp:false set card 総数 ≥ n。
    // rules/21: 全部行えなければ使用不可 / コスト「自分の」省略 → ctx.source.player の scene のみ (self-only)。
    // テキスト「裏向きで」ゆえ faceUp:true (表向きセット) は数えない。
    case 'removeSetCard': {
      let count = 0;
      for (const c of state.players[ctx.source.player].scene) {
        count += c.setCards.filter(e => !e.faceUp).length;
      }
      return count >= cost.n;
    }
    case 'removeDeckTop': {
      return state.players[cost.player].deck.length >= cost.n;
    }
    case 'discardEvidence': {
      return state.players[ctx.source.player].evidence.length >= cost.n;
    }
    case 'selfToDeckBottom': {
      const uid = ctx.source.uid;
      if (!uid) return false;
      return !!findChar(state, uid);
    }
    case 'pay': {
      return cost.items.every(item => canPay(state, item, ctx));
    }
    case 'choice': {
      return cost.items.some(item => canPay(state, item, ctx));
    }
    case 'fileFrom': {
      // BUG-129 水平展開 (Task D E3): popTop はアシストパートナーを skip するため、
      // 計数も非 assisted-partner のみで行う (rules/21: 全部行えなければ使用不可)。
      const payable = state.players[ctx.source.player].file
        .filter(f => f.type !== 'assisted-partner').length;
      return payable >= cost.n;
    }
    case 'flipFaceUpEvidence': {
      const facedown = state.players[ctx.source.player].evidence.filter(e => !e.faceUp).length;
      return facedown >= cost.n.min;
    }
    case 'custom': {
      return cost.check(state, ctx);
    }
    // refactor 2b: case 追加漏れの compile-time 検出 (noImplicitReturns 無効のため明示 guard)。
    // 到達不能 (union 網羅済)。万一 runtime で未知 kind が来た場合は旧挙動 (undefined=falsy) 同等の false。
    default: {
      const _exhaustive: never = cost;
      void _exhaustive;
      return false;
    }
  }
}

function findChar(state: GameState, uid: string) {
  for (const p of ['self', 'opp'] as const) {
    const found = state.players[p].scene.find(c => c.uid === uid);
    if (found) return found;
  }
  return null;
}

/**
 * Resolve which player should be charged for a TargetingRef-style cost target.
 * Convenience helper — most cost target refs are scoped to owner via ctx.source.player.
 * Currently unused but kept for future symmetry.
 */
export function ownerOfTarget(_ref: TargetingRef, ctx: EffectCtx): 'self' | 'opp' {
  return ctx.source.player;
}
