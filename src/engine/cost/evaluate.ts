// engine.cost.canPay — Cost feasibility check (read-only)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 26-qa-deck-refresh.md (デッキ不足→不可)
//
// canPay is read-only. It does NOT mutate state and does NOT consume costs.

import type { GameState, Cost, EffectCtx, TargetingRef } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';
import { resolveDynNumber } from '@/engine/dyn/eval.js';
import { canPayAtomically, isWellFormedCost } from './pay.js';
import { eligibleRemoveSetCards } from './remove-set-card-eligible.js';
import { def as readDef } from '@/engine/read/def.js';

// refactor 2b (2026-06-12): Cost union の kind 一覧を value として単一ソース化。
// `satisfies Record<Cost['kind'], true>` で union との両方向同期をコンパイル時に強制。
// scripts/taskA-validate-specs.cjs COSTS との同期は tests/engine/sync-taskA-whitelists.test.ts。
const COST_KIND_MAP = {
  sleepSelf: true, sleepChar: true, stunChar: true, removeFromHand: true, removeFromScene: true,
  revealFromHand: true, // engine additive wave (2026-06-28): 手札公開 presence-check cost (B08093 a1)
  revealHandToDeckTop: true, // engine mega-wave W1 (2026-07-03, P29): 手札公開→デッキ上 cost (B05049 a1)
  removeDeckTop: true, removeDeckAll: true, discardEvidence: true, selfToDeckBottom: true, selfToRemove: true, selfToPartnerArea: true,
  sceneToDeckBottom: true, // Task D E2 (2026-06-12)
  removeAreaToDeckBottom: true, // cluster4 (2026-06-14)
  partnerAreaRemove: true, // engine defer-unlock mini-wave (2026-07-09): PA カード n 枚リムーブ (B07039)
  removeSetCard: true, // engine additive wave (2026-06-24): 裏向きセットを合わせて n 枚リムーブ (B08033 a2)
  removeStackedCards: true,
  sceneStackUnderSelf: true, // engine mega-wave W4 (2026-07-03, r6): 現場キャラを自身の下に重ねる (B09048 a2)
  handStackUnder: true, // engine mega-wave W4 (2026-07-03, r7): 手札公開→現場キャラ下に重ねる (B08006 a1)
  selfLpDeltaTurn: true, // M2後半 (2026-07-10): 〚ターン終了時までLP-2する〛(B06003 a1)
  removeFromHandDownTo: true, // M2後半 (2026-07-10): 〚手札が n 枚になるまでリムーブ〛(B08047 a2)
  pay: true, choice: true, fileFrom: true, flipFaceUpEvidence: true, custom: true,
} as const satisfies Record<Cost['kind'], true>;
export const COST_KINDS: ReadonlySet<string> = new Set(Object.keys(COST_KIND_MAP));

/**
 * Check if a Cost is fully payable in the given state.
 */
export function canPay(state: GameState, cost: Cost, ctx: EffectCtx): boolean {
  if (cost.kind === 'custom') return false;
  if (!isWellFormedCost(cost)) return false;
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
      const min = cost.target.kind === 'pick' ? cost.target.n.min : 1;
      return cands.filter(cand => {
        if (cand.kind !== 'char') return false;
        const c = findChar(state, cand.uid);
        return !!c && c.state === 'active';
      }).length >= min;
    }
    // engine additive wave (2026-06-24): stunChar — sleepChar と同形。コスト文「アクティブ状態の[X]」より
    // active 候補が最低1枚必要 (sleep/stun は対象不可、rules/03 スタン特殊挙動)。
    case 'stunChar': {
      const cands = candidates(state, cost.target, ctx);
      const min = cost.target.kind === 'pick' ? cost.target.n.min : 1;
      return cands.filter(cand => {
        if (cand.kind !== 'char') return false;
        const c = findChar(state, cand.uid);
        return !!c && c.state === 'active';
      }).length >= min;
    }
    case 'removeFromHand': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // engine additive wave (2026-06-28): revealFromHand — 手札公開 presence-check cost (B08093 a1)。
    // removeFromHand と同型 (filter 一致 ≥ n) だが pay() は no-op (公開のみ、消費なし)。
    // n: {min,max} (attribution mini-wave 2026-07-10): min 基準で判定 (B08068 min:0 = 常に支払可)。
    case 'revealFromHand': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= (typeof cost.n === 'number' ? cost.n : cost.n.min);
    }
    // engine mega-wave W1 (2026-07-03, P29): revealHandToDeckTop — 手札公開→デッキ上 cost (B05049 a1)。
    // canPay は removeFromHand/revealFromHand と完全同型 (rules/21 全部行えなければ使用不可)。
    case 'revealHandToDeckTop': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    case 'removeFromScene': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // engine mega-wave W4 (2026-07-03, r6): 〚現場にいる…を n 枚このキャラの下に重ねる〛コスト (B09048 a2)。
    // removeFromScene と同型の count check。rules/16: 重ねるに state 前提なし (sleepChar/stunChar の
    // active gate を **付けない** こと — 敵対 review 指摘済の誤 clone ポイント)。
    case 'sceneStackUnderSelf': {
      const cands = candidates(state, cost.target, ctx);
      return cands.length >= cost.n;
    }
    // engine mega-wave W4 (2026-07-03, r7): 〚手札から…1枚公開し、現場の…1枚の下に重ねる〛コスト (B08006 a1)。
    // 両 pick の候補が各1以上 (rules/21 全部行えなければ使用不可)。host 側も state gate なし (rules/16)。
    case 'handStackUnder': {
      return candidates(state, cost.cardTarget, ctx).length >= 1
        && candidates(state, cost.hostTarget, ctx).length >= 1;
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
    // engine defer-unlock mini-wave (2026-07-09): 〚パートナーエリアにある…のカードを n 枚リムーブする〛
    // コスト (B07039)。removeAreaToDeckBottom と同型 (candidates が area:'partner-area' を列挙 = wave A1)。
    // rules/21: 全部行えなければ使用不可 (candidates >= n) / 「自分の」省略 → cost.target は side:'self'。
    case 'partnerAreaRemove': {
      // ⚠ partner-area 列挙はパートナー本体 ({kind:'partner'}) も含みうる — 本コストの対象は
      // PA 一般カード枠 (kind:'card') のみ (パートナーはリムーブ不可、rules/06)。
      const cands = candidates(state, cost.target, ctx).filter(c => c.kind === 'card');
      return cands.length >= cost.n;
    }
    // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
    //   リムーブする〛コスト (B08033 a2)。self 全 scene の faceUp:false set card 総数 ≥ n。
    // rules/21: 全部行えなければ使用不可 / コスト「自分の」省略 → ctx.source.player の scene のみ (self-only)。
    // テキスト「裏向きで」ゆえ faceUp:true (表向きセット) は数えない。
    case 'removeSetCard': {
      return eligibleRemoveSetCards(state, cost, ctx).length >= cost.n;
    }
    case 'removeStackedCards': {
      const uid = ctx.source.uid;
      if (typeof uid !== 'string' || cost.n < 1) return false;
      const host = state.players[ctx.source.player].scene.find(char => char.uid === uid);
      return host !== undefined && (Array.isArray(host.stackedCards) ? host.stackedCards.length : host.stackedCards) >= cost.n;
    }
    case 'removeDeckTop': {
      // mega-wave W5 (r37): n は number | {dyn} — dispatch 時に解決 (B04088 .oppSceneCount*2)。
      // 非有限/非数値は 0 扱い (resolveDynNumber guard) = deck.length >= 0 (n=0 コストは vacuous に true)。
      const rdN = resolveDynNumber(cost.n, state, ctx);
      return state.players[cost.player].deck.length >= rdN;
    }
    // engine A3 wave (2026-07-11, B09107): デッキ全部リムーブ — 恒真 (0 枚でも宣言可)。
    case 'removeDeckAll': {
      return true;
    }
    case 'discardEvidence': {
      return state.players[ctx.source.player].evidence.length >= cost.n;
    }
    // M2後半 (2026-07-10, B06003 a1): 恒真 — LP は下限なし (rules/19)、公式Q&A: LP1以下でも支払可。
    case 'selfLpDeltaTurn': {
      return true;
    }
    // M2後半 (2026-07-10, B08047 a2): 恒真 — 公式Q&A: 手札 n 枚以下でも宣言可 (支払枚数 0 で成立)。
    case 'removeFromHandDownTo': {
      return true;
    }
    case 'selfToDeckBottom': {
      const uid = ctx.source.uid;
      if (!uid) return false;
      return !!findChar(state, uid);
    }
    case 'selfToRemove': {
      if (ctx.source.area === 'scene') {
        const source = state.players[ctx.source.player].scene.find(char => char.uid === ctx.source.uid);
        return !!source && source.cardId === ctx.source.cardId;
      }
      const index = sourceOccurrenceIndex(ctx);
      if (index === null) return false;
      if (ctx.source.area === 'evidence') {
        const entry = state.players[ctx.source.player].evidence[index];
        return !!entry && entry.faceUp && entry.cardId === ctx.source.cardId;
      }
      if (ctx.source.area === 'file') {
        const entry = state.players[ctx.source.player].file[index];
        return !!entry && entry.type === 'card-back' && entry.faceUp === true && entry.cardId === ctx.source.cardId;
      }
      return false;
    }
    case 'selfToPartnerArea': {
      if (ctx.source.area !== 'scene' || !ctx.source.uid) return false;
      const player = ctx.source.player;
      const source = state.players[player].scene.find(char => char.uid === ctx.source.uid);
      return !!source
        && source.cardId === ctx.source.cardId
        && readDef.isMR(source.cardId)
        && !state.players[player].partnerAreaMR;
    }
    case 'pay': {
      return canPayAtomically(state, cost, ctx);
    }
    case 'choice': {
      return canPayAtomically(state, cost, ctx);
    }
    case 'fileFrom': {
      // BUG-129 水平展開 (Task D E3): popTop はアシストパートナーを skip するため、
      // 計数も非 assisted-partner のみで行う (rules/21: 全部行えなければ使用不可)。
      const payable = state.players[ctx.source.player].file
        .filter(f => f.type !== 'assisted-partner').length;
      return payable >= cost.n;
    }
    case 'flipFaceUpEvidence': {
      const selected = (ctx.dyn?.['costParams'] as Record<string, unknown> | undefined)?.['flipFaceUpEvidence'] as { indices?: unknown } | undefined;
      if (selected !== undefined) {
        if (!Array.isArray(selected.indices)) return false;
        const indices = selected.indices;
        if (indices.length < cost.n.min || indices.length > cost.n.max) return false;
        if (!indices.every(index => typeof index === 'number' && Number.isInteger(index))) return false;
        if (new Set(indices).size !== indices.length) return false;
        return indices.every(index => index >= 0 && index < state.players[ctx.source.player].evidence.length
          && !state.players[ctx.source.player].evidence[index]!.faceUp);
      }
      const facedown = state.players[ctx.source.player].evidence.filter(e => !e.faceUp).length;
      return facedown >= cost.n.min;
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

function sourceOccurrenceIndex(ctx: EffectCtx): number | null {
  const area = ctx.source.area;
  if (area !== 'evidence' && area !== 'file') return null;
  const match = new RegExp(`^${area}:${ctx.source.player}:(\\d+)$`).exec(ctx.source.uid ?? '');
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * Resolve which player should be charged for a TargetingRef-style cost target.
 * Convenience helper — most cost target refs are scoped to owner via ctx.source.player.
 * Currently unused but kept for future symmetry.
 */
export function ownerOfTarget(_ref: TargetingRef, ctx: EffectCtx): 'self' | 'opp' {
  return ctx.source.player;
}
