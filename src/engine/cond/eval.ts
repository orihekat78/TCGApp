// engine.cond.eval — Condition evaluator
// spec: Phase 3 Group B Task 3.6
// rules: 17-icons.md §条件アイコン, 13-keywords.md, 15-abilities-effects.md,
//        18-mr.md, 19-special-rules.md, 25-qa-effects-resolution.md
//
// Condition unmet → "ability/effect not held at all" (rules/17 Point).

import type { GameState, Condition, EffectCtx, Candidate } from '@/engine/types';
import { candidates, matchOneFilter } from '@/engine/target/candidates.js';
import { resolve as resolveTarget } from '@/engine/target/resolve.js';
import { lookupCardDef, allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';
import { char as charRead } from '@/engine/read/char.js';

/** Type predicate: narrows a Candidate to the 'char' variant. */
function isCharCandidate(c: Candidate): c is { kind: 'char'; uid: string; cardId: string; player: 'self' | 'opp' } {
  return c.kind === 'char';
}

/**
 * Evaluate a Condition to boolean using current state + ctx.
 */
export function evalCond(state: GameState, cond: Condition, ctx: EffectCtx): boolean {
  switch (cond.kind) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'not':
      return !evalCond(state, cond.c, ctx);
    case 'and':
      return cond.cs.every(c => evalCond(state, c, ctx));
    case 'or':
      return cond.cs.some(c => evalCond(state, c, ctx));
    case 'turn':
      return state.turn.player === resolvePlayer(cond.player, ctx);
    case 'partnerColor': {
      const owner = ctx.source.player;
      const partner = state.players[owner].partner;
      const d = lookupCardDef(partner.cardId);
      const want = Array.isArray(cond.color) ? cond.color : [cond.color];
      const have = d?.colors ?? [];
      return want.some(c => have.includes(c));
    }
    case 'caseColor': {
      const owner = ctx.source.player;
      const caseInfo = state.players[owner].case;
      // CardDef is primary source of colors; caseInfo.colors is a runtime fallback
      // (used when CardDef is not yet registered, e.g. during tests or lazy loading).
      const d = lookupCardDef(caseInfo.cardId);
      const have = d?.colors ?? caseInfo.colors ?? [];
      const want = Array.isArray(cond.color) ? cond.color : [cond.color];
      if (cond.combine === 'and') {
        return want.every(c => have.includes(c));
      }
      return want.some(c => have.includes(c));
    }
    case 'caseTrait': {
      const owner = ctx.source.player;
      const caseInfo = state.players[owner].case;
      const d = lookupCardDef(caseInfo.cardId);
      const traits = d?.traits ?? [];
      return traits.includes(cond.trait);
    }
    case 'fileAtLeast': {
      const owner = ctx.source.player;
      // rules/17: アシスト中のパートナーも枚数に数える — file array already includes assisted-partner entries
      return state.players[owner].file.length >= cond.n;
    }
    case 'caseStatus': {
      const owner = ctx.source.player;
      return state.players[owner].case.status === cond.status;
    }
    case 'bond': {
      // rules/17: パートナーでは条件を満たさない — scene only
      const owner = ctx.source.player;
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      for (const c of state.players[owner].scene) {
        const d = lookupCardDef(c.cardId);
        if (!d) continue;
        const components = allCardNameComponentsForDef(d);
        if (wants.some(w => components.includes(w))) return true;
      }
      return false;
    }
    case 'sceneHas': {
      const cands = candidates(state, { kind: 'all', query: cond.query }, ctx);
      const need = cond.nMin ?? 1;
      return cands.length >= need;
    }
    case 'apAtLeast': {
      const resolved = resolveCharsForRef(state, cond.ref, ctx);
      return resolved.some(uid => charRead.ap(state, uid) >= cond.n);
    }
    case 'lpAtLeast': {
      const resolved = resolveCharsForRef(state, cond.ref, ctx);
      return resolved.some(uid => charRead.lp(state, uid) >= cond.n);
    }
    case 'evidenceAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].evidence.length >= cond.n;
    }
    case 'fileTopType': {
      const owner = ctx.source.player;
      const file = state.players[owner].file;
      if (file.length === 0) return false;
      // "Top" = last pushed (per mutate.file.popTop semantics)
      return file[file.length - 1].type === cond.type;
    }
    case 'scratchTrace': {
      const p = resolvePlayer(cond.player, ctx);
      return state.scratchTrace[p] === cond.v;
    }
    case 'flag': {
      const p = resolvePlayer(cond.player, ctx);
      // turnState values may be Record<string, number> for declaredAbilityUseCount;
      // we expect boolean here so widen via unknown then compare.
      const v: unknown = state.turnState[p][cond.key];
      return v === cond.v;
    }
    case 'declaredUseUnder': {
      const used = charRead.declaredUseCount(state, cond.uid, cond.abilityId);
      return used < cond.max;
    }
    case 'bound': {
      const bound = ctx.bindings[cond.key];
      if (cond.presence === 'matched') {
        return Array.isArray(bound) && bound.length > 0;
      }
      // 'exists' or undefined → present in bindings
      return bound !== undefined;
    }
    case 'removeColorAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.color) ? cond.color : [cond.color];
      const count = state.players[p].remove.filter(id => {
        const d = lookupCardDef(id);
        const colors = d?.colors ?? [];
        return wants.some(w => colors.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeTraitAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.trait) ? cond.trait : [cond.trait];
      const count = state.players[p].remove.filter(id => {
        const d = lookupCardDef(id);
        const traits = d?.traits ?? [];
        return wants.some(w => traits.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeNameAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      const count = state.players[p].remove.filter(id => {
        const d = lookupCardDef(id);
        if (!d) return false;
        const components = allCardNameComponentsForDef(d);
        return wants.some(w => components.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'stackedCountAtLeast': {
      const uids = resolveCharsForRef(state, cond.ref, ctx);
      return uids.some(uid => charRead.stackedCount(state, uid) >= cond.n);
    }
    case 'contactOpponentApHigher': {
      // D11007 a3: contact:start payload から aUid (attacker) / bUid (defender) を取得。
      // 自分 (ctx.source.uid) が攻撃者 (aUid) として、相手 (bUid) の AP が自分より高いコンタクトのみ true。
      // BUG-098: 旧実装は自分の関与を確認せず、任意のコンタクト (defender>attacker) で過剰発火していた。
      // 【自分ターン中】= 自分が攻撃するので攻撃者 (aUid) 限定で十分 (rules/07-08)。
      const payload = ctx.triggerPayload as { aUid?: string; bUid?: string } | undefined;
      if (!payload?.aUid || !payload?.bUid) return false;
      if (payload.aUid !== ctx.source.uid) return false; // 自分が攻撃者のコンタクトのみ
      const aAp = charRead.ap(state, payload.aUid);
      const bAp = charRead.ap(state, payload.bUid);
      return bAp > aAp;
    }
    case 'guardedBySelf': {
      // D11016 a1: action:guarded payload.guardUid が自分 (ctx.source.uid) と一致するとき true
      // (「このキャラがガードしたとき」= 自分のガードのみ発火、rules/07。BUG-097)
      const guardUid = (ctx.triggerPayload as { guardUid?: string } | undefined)?.guardUid;
      return guardUid === ctx.source.uid;
    }
    case 'enterOrderEquals': {
      // D11014 a1 / D11003 / D11009 driver: enter hook payload.enterOrderThisTurn が n と一致するか
      // rules/17 §【疾風 N】: 「自分の現場にこのターン N番目に登場したとき」
      // (累積 enterOrder ではなく、ターン境界でリセットされる counter を参照)
      const payload = ctx.triggerPayload as { enterOrderThisTurn?: number } | undefined;
      return payload?.enterOrderThisTurn === cond.n;
    }
    case 'boundMatchesFilter': {
      // D11014 a2 driver: ctx.bindings[bindKey][0] の cardId を TargetFilter で評価
      // (「〚カード名[X]〛を登場させた場合」を declarative 化)
      const bound = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bound) || bound.length === 0) return false;
      const cardId = (bound[0] as { cardId?: string }).cardId;
      if (typeof cardId !== 'string') return false;
      const d = lookupCardDef(cardId);
      const f = cond.filter;
      // CardDef-driven filter のみサポート (SceneCharacter state 系は対象外)
      if (f.cardId !== undefined) {
        const ids = Array.isArray(f.cardId) ? f.cardId : [f.cardId];
        if (!ids.includes(cardId)) return false;
      }
      if (f.cardName !== undefined) {
        const wants = Array.isArray(f.cardName) ? f.cardName : [f.cardName];
        const components = d ? allCardNameComponentsForDef(d) : [];
        if (!wants.some(w => components.includes(w))) return false;
      }
      if (f.trait !== undefined) {
        const wants = Array.isArray(f.trait) ? f.trait : [f.trait];
        const traits = d?.traits ?? [];
        if (!wants.some(w => traits.includes(w))) return false;
      }
      if (f.color !== undefined) {
        const wants = Array.isArray(f.color) ? f.color : [f.color];
        const colors = d?.colors ?? [];
        if (!wants.some(w => colors.includes(w))) return false;
      }
      if (f.levelMin !== undefined && (d?.level ?? 0) < f.levelMin) return false;
      if (f.levelMax !== undefined && (d?.level ?? 0) > f.levelMax) return false;
      return true;
    }
    case 'triggerCharMatches': {
      // 2026-06-06 タスクC: トリガ payload のキャラ (reasoning:end の推理キャラ等) を side+filter で評価。
      const pl = ctx.triggerPayload as { uid?: string; player?: 'self' | 'opp' } | undefined;
      if (!pl?.uid || !pl.player) return false;
      // side:'self' = トリガキャラが card 所有者と同じ側 (ctx.source.player)
      const sameSide = pl.player === ctx.source.player;
      if (cond.side === 'self' && !sameSide) return false;
      if (cond.side === 'opp' && sameSide) return false;
      if (cond.filter) {
        const ch = state.players[pl.player].scene.find(c => c.uid === pl.uid);
        if (!ch) return false;
        const cand: Candidate = { kind: 'char', uid: ch.uid, cardId: ch.cardId, player: pl.player };
        if (!matchOneFilter(state, ch.cardId, cond.filter, ch, cand)) return false;
      }
      return true;
    }
    case 'custom':
      return cond.check(state, ctx);
  }
}

export function evalAll(state: GameState, cs: Condition[], ctx: EffectCtx): boolean[] {
  return cs.map(c => evalCond(state, c, ctx));
}

function resolvePlayer(p: 'self' | 'opp', ctx: EffectCtx): 'self' | 'opp' {
  // 'self' / 'opp' here refer to perspective. Owner = ctx.source.player.
  // The Condition spec uses 'self' = owner; 'opp' = opp-of-owner.
  if (p === 'self') return ctx.source.player;
  return ctx.source.player === 'self' ? 'opp' : 'self';
}

function resolveCharsForRef(state: GameState, ref: import('@/engine/types').TargetingRef, ctx: EffectCtx): string[] {
  // For apAtLeast / lpAtLeast / stackedCountAtLeast we want char uids.
  // resolveTarget auto-resolves for 'self' / 'all' / 'fromBound'; for 'pick'
  // we use ctx.picked when present, else fall back to candidates.
  try {
    if (ref.kind === 'pick') {
      const picked = ctx.picked ?? candidates(state, ref, ctx);
      return picked.filter(isCharCandidate).map(c => c.uid);
    }
    const resolved = resolveTarget(state, ref, ctx);
    return resolved.filter(isCharCandidate).map(c => c.uid);
  } catch {
    return [];
  }
}

export const cond = {
  eval: evalCond,
  evalAll,
};
