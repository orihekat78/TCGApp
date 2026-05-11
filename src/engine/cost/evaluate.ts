// engine.cost.canPay — Cost feasibility check (read-only)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 26-qa-deck-refresh.md (デッキ不足→不可)
//
// canPay is read-only. It does NOT mutate state and does NOT consume costs.

import type { GameState, Cost, EffectCtx, TargetingRef } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';

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
    case 'removeFromHand': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    case 'removeFromScene': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
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
      return state.players[ctx.source.player].file.length >= cost.n;
    }
    case 'flipFaceUpEvidence': {
      const facedown = state.players[ctx.source.player].evidence.filter(e => !e.faceUp).length;
      return facedown >= cost.n.min;
    }
    case 'custom': {
      return cost.check(state, ctx);
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
