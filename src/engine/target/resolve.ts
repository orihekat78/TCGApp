// engine.target.resolve — validate a pick against a TargetingRef + apply distinctNames rule
// spec: Phase 3 Group B Task 3.4
// rules: 15-abilities-effects.md, 19-special-rules.md §複数名カード重複不可

import type { GameState, TargetingRef, Candidate, EffectCtx } from '@/engine/types';
import { candidates, legalCount } from './candidates.js';
import { lookupCardDef, allCardNameComponentsForDef } from './card-def-registry.js';

/**
 * Resolve a TargetingRef into the final list of Candidates.
 * - 'self' / 'all' / 'fromBound' → auto-resolve (picked ignored)
 * - 'pick' → validate `picked` against query + count range + distinctNames
 */
export function resolve(
  state: GameState,
  ref: TargetingRef,
  ctx: EffectCtx,
  picked?: Candidate[],
): Candidate[] {
  switch (ref.kind) {
    case 'self':
    case 'all':
    case 'fromBound':
      return candidates(state, ref, ctx);
    case 'pick': {
      if (!picked) {
        throw new Error('target.resolve: picked is required for ref.kind=pick');
      }
      const available = candidates(state, ref, ctx);
      const range = legalCount(state, ref, ctx);

      // Count range check
      if (picked.length < range.min || picked.length > range.max) {
        throw new Error(
          `target.resolve: picked count ${picked.length} out of legal range [${range.min}, ${range.max}]`,
        );
      }

      // Each picked must be in available
      for (const p of picked) {
        if (!available.some(a => candidateEquals(a, p))) {
          throw new Error(
            `target.resolve: picked candidate not in available list: ${JSON.stringify(p)}`,
          );
        }
      }

      // distinctNames (rules/19): no two picks may share any card-name component
      if (ref.query.distinctNames) {
        const seen = new Set<string>();
        for (const p of picked) {
          const components = componentsForCandidate(p);
          for (const c of components) {
            if (seen.has(c)) {
              throw new Error(
                `target.resolve: distinctNames violated — duplicate card-name component "${c}"`,
              );
            }
          }
          for (const c of components) seen.add(c);
        }
      }

      // Cluster WB1 (2026-07-11, B09105): distinctLevel (rules: 「それぞれレベルの異なる」)。
      // no two picks may share the same (印字) level。card/char 候補は lookupCardDef(cardId).level。
      if (ref.query.distinctLevel) {
        const seenLv = new Set<number>();
        for (const p of picked) {
          const lv = levelForCandidate(p);
          if (lv === undefined) continue; // partner/evidence/file 等は level 概念なし → skip
          if (seenLv.has(lv)) {
            throw new Error(
              `target.resolve: distinctLevel violated — duplicate level "${lv}"`,
            );
          }
          seenLv.add(lv);
        }
      }

      if (ref.query.distinctColors) {
        const seenColors = new Set<string>();
        for (const p of picked) {
          const colors = colorsForCandidate(p);
          if (colors.some(color => seenColors.has(color))) {
            throw new Error('target.resolve: distinctColors violated — shared color');
          }
          colors.forEach(color => seenColors.add(color));
        }
      }

      // engine mega-wave W4 (2026-07-03, r84): perSideMax — side 毎の選択上限 (「自分と相手で1枚ずつ」
      // B08019 a2)。distinctNames と同 posture の runtime validate。partner candidate は player 概念が
      // side quota に馴染まないため使用不可 (throw)。
      if (typeof ref.query.perSideMax === 'number') {
        const bySide: Record<string, number> = {};
        for (const p of picked) {
          if (p.kind === 'partner') {
            throw new Error('target.resolve: perSideMax cannot be used with partner candidates');
          }
          const side = (p as { player?: string }).player ?? '?';
          bySide[side] = (bySide[side] ?? 0) + 1;
          if (bySide[side]! > ref.query.perSideMax) {
            throw new Error(
              `target.resolve: perSideMax violated — more than ${ref.query.perSideMax} picks on side "${side}"`,
            );
          }
        }
      }

      return picked;
    }
  }
}

function candidateEquals(a: Candidate, b: Candidate): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'char':
      return b.kind === 'char' && a.uid === b.uid && a.player === b.player;
    case 'partner':
      return b.kind === 'partner' && a.player === b.player;
    case 'card':
      return (
        b.kind === 'card' &&
        a.cardId === b.cardId &&
        a.area === b.area &&
        a.player === b.player &&
        a.index === b.index
      );
    case 'evidence':
      return b.kind === 'evidence' && a.player === b.player && a.index === b.index;
    case 'file':
      return b.kind === 'file' && a.player === b.player && a.index === b.index;
  }
}

function componentsForCandidate(cand: Candidate): string[] {
  switch (cand.kind) {
    case 'char':
    case 'card': {
      const d = lookupCardDef(cand.cardId);
      if (!d) return [cand.cardId];
      return allCardNameComponentsForDef(d);
    }
    case 'partner':
    case 'evidence':
    case 'file':
      return [];
  }
}

// Cluster WB1 (2026-07-11, B09105): distinctLevel 用 — 候補の (印字) レベル。char/card のみ level を持つ。
function levelForCandidate(cand: Candidate): number | undefined {
  if (cand.kind !== 'char' && cand.kind !== 'card') return undefined;
  return lookupCardDef(cand.cardId)?.level;
}

function colorsForCandidate(cand: Candidate): string[] {
  if (cand.kind !== 'char' && cand.kind !== 'card') return [];
  return lookupCardDef(cand.cardId)?.colors ?? [];
}
