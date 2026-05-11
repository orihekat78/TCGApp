// engine.target.candidates — enumerate target candidates per TargetingRef/TargetQuery
// spec: Phase 3 Group B Task 3.4
// rules: 15-abilities-effects.md §対象指定の解釈, 19-special-rules.md §複数名カード

import type {
  GameState,
  TargetingRef,
  TargetQuery,
  TargetFilter,
  Candidate,
  SceneCharacter,
  EffectCtx,
} from '@/engine/types';
import { lookupCardDef, allCardNameComponentsForDef } from './card-def-registry.js';

type Side = 'self' | 'opp';

/**
 * Owner side resolution. EffectCtx has no explicit ownerPlayer — we use
 * ctx.source.player as the owner (the player whose card produced the effect).
 */
function ownerSide(ctx: EffectCtx): Side {
  return ctx.source.player;
}

function oppSide(p: Side): Side {
  return p === 'self' ? 'opp' : 'self';
}

function sidesForQuery(query: TargetQuery, ctx: EffectCtx): Side[] {
  const side = query.side;
  const owner = ownerSide(ctx);
  switch (side) {
    case 'self':
      return [owner];
    case 'opp':
      return [oppSide(owner)];
    case 'either':
    case undefined:
      // Default: either side (rules/15 — when only "キャラ" appears, both sides eligible)
      return ['self', 'opp'];
    case 'owner':
      return [owner];
    case 'opp-of-owner':
      return [oppSide(owner)];
  }
}

/**
 * Enumerate candidates for a TargetingRef.
 */
export function candidates(state: GameState, ref: TargetingRef, ctx: EffectCtx): Candidate[] {
  switch (ref.kind) {
    case 'self': {
      const uid = ctx.source.uid;
      if (!uid) return [];
      for (const p of ['self', 'opp'] as const) {
        const found = state.players[p].scene.find(c => c.uid === uid);
        if (found) return [{ kind: 'char', uid: found.uid, cardId: found.cardId, player: p }];
      }
      return [{
        kind: 'char',
        uid,
        cardId: ctx.source.cardId ?? '',
        player: ctx.source.player,
      }];
    }
    case 'pick':
    case 'all':
      return enumerateByQuery(state, ref.query, ctx);
    case 'fromBound': {
      const bound = ctx.bindings[ref.bindKey];
      return bound ?? [];
    }
  }
}

function enumerateByQuery(state: GameState, query: TargetQuery, ctx: EffectCtx): Candidate[] {
  const area = query.area ?? 'scene';
  const sides = sidesForQuery(query, ctx);
  const out: Candidate[] = [];

  for (const side of sides) {
    switch (area) {
      case 'scene': {
        for (const c of state.players[side].scene) {
          const cand: Candidate = { kind: 'char', uid: c.uid, cardId: c.cardId, player: side };
          if (matchesQueryForChar(state, c, cand, query, ctx)) out.push(cand);
        }
        break;
      }
      case 'partner-area': {
        const cand: Candidate = { kind: 'partner', player: side };
        if (matchesFiltersByCardId(state, state.players[side].partner.cardId, query, cand)) {
          out.push(cand);
        }
        break;
      }
      case 'hand': {
        const hand = state.players[side].hand;
        for (let i = 0; i < hand.length; i++) {
          const cardId = hand[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'hand', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'deck': {
        const deck = state.players[side].deck;
        for (let i = 0; i < deck.length; i++) {
          const cardId = deck[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'deck', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'remove': {
        const rem = state.players[side].remove;
        for (let i = 0; i < rem.length; i++) {
          const cardId = rem[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'remove', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'evidence': {
        const ev = state.players[side].evidence;
        for (let i = 0; i < ev.length; i++) {
          const cand: Candidate = { kind: 'evidence', player: side, index: i };
          if (matchesFiltersByCardId(state, ev[i].cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'file': {
        const file = state.players[side].file;
        for (let i = 0; i < file.length; i++) {
          const cand: Candidate = { kind: 'file', player: side, index: i };
          out.push(cand);
        }
        break;
      }
      case 'case': {
        const caseCardId = state.players[side].case.cardId;
        const cand: Candidate = { kind: 'card', cardId: caseCardId, area: 'case', player: side };
        if (matchesFiltersByCardId(state, caseCardId, query, cand)) out.push(cand);
        break;
      }
    }
  }

  return out;
}

function matchesQueryForChar(
  state: GameState,
  c: SceneCharacter,
  cand: Candidate,
  query: TargetQuery,
  ctx: EffectCtx,
): boolean {
  // excludeSelf
  if (query.excludeSelf && cand.kind === 'char' && cand.uid === ctx.source.uid) return false;

  // state filter
  if (query.state && query.state.length > 0) {
    if (!query.state.includes(c.state)) return false;
  }

  // named filter (true=only named, false=only non-named, undefined=no filter)
  if (query.named !== undefined) {
    if (query.named !== c.isNamed) return false;
  }

  return matchesFilters(state, c.cardId, c, cand, query);
}

function matchesFiltersByCardId(
  state: GameState,
  cardId: string,
  query: TargetQuery,
  cand: Candidate,
): boolean {
  return matchesFilters(state, cardId, null, cand, query);
}

function matchesFilters(
  state: GameState,
  cardId: string,
  c: SceneCharacter | null,
  cand: Candidate,
  query: TargetQuery,
): boolean {
  if (query.filter) {
    if (!matchOneFilter(state, cardId, query.filter, c, cand)) return false;
  }
  if (query.filterAny && query.filterAny.length > 0) {
    const anyOk = query.filterAny.some(f => matchOneFilter(state, cardId, f, c, cand));
    if (!anyOk) return false;
  }
  return true;
}

function matchOneFilter(
  state: GameState,
  cardId: string,
  filter: TargetFilter,
  c: SceneCharacter | null,
  cand: Candidate,
): boolean {
  const d = lookupCardDef(cardId);

  if (filter.cardId !== undefined) {
    const ids = Array.isArray(filter.cardId) ? filter.cardId : [filter.cardId];
    if (!ids.includes(cardId)) return false;
  }

  // cardName (rules/19: split-name matching)
  if (filter.cardName !== undefined) {
    const wants = Array.isArray(filter.cardName) ? filter.cardName : [filter.cardName];
    const components = d ? allCardNameComponentsForDef(d) : [];
    const ok = wants.some(w => components.includes(w));
    if (!ok) return false;
  }

  if (filter.trait !== undefined) {
    const wants = Array.isArray(filter.trait) ? filter.trait : [filter.trait];
    const traits = d?.traits ?? [];
    if (!wants.some(w => traits.includes(w))) return false;
  }

  if (filter.color !== undefined) {
    const wants = Array.isArray(filter.color) ? filter.color : [filter.color];
    const colors = d?.colors ?? [];
    if (!wants.some(w => colors.includes(w))) return false;
  }

  if (filter.keyword !== undefined) {
    const wants = Array.isArray(filter.keyword) ? filter.keyword : [filter.keyword];
    const kws = (d as { keywords?: string[] } | undefined)?.keywords ?? [];
    if (!wants.some(w => kws.includes(w))) return false;
  }

  // Numeric filters — prefer SceneCharacter overrides where applicable
  const base = d ?? null;
  const ap = c?.apOverride ?? base?.ap ?? 0;
  const lp = c?.lpOverride ?? base?.lp ?? 0;
  const level = base?.level ?? 0;

  if (filter.apMin !== undefined && ap < filter.apMin) return false;
  if (filter.apMax !== undefined && ap > filter.apMax) return false;
  if (filter.lpMin !== undefined && lp < filter.lpMin) return false;
  if (filter.lpMax !== undefined && lp > filter.lpMax) return false;
  if (filter.levelMin !== undefined && level < filter.levelMin) return false;
  if (filter.levelMax !== undefined && level > filter.levelMax) return false;

  if (filter.hasSetCards !== undefined) {
    const has = !!(c && c.setCards.length > 0);
    if (has !== filter.hasSetCards) return false;
  }

  if (filter.custom !== undefined) {
    if (!filter.custom(state, cand)) return false;
  }
  return true;
}

/**
 * Legal count range.
 */
export function legalCount(
  state: GameState,
  ref: TargetingRef,
  ctx: EffectCtx,
): { min: number; max: number } {
  switch (ref.kind) {
    case 'self':
      return { min: 1, max: 1 };
    case 'pick': {
      const cands = candidates(state, ref, ctx);
      // "N枚まで" allows 0 (rules/15). When candidates < ref.n.min the min collapses.
      const min = Math.min(ref.n.min, cands.length);
      const max = Math.min(ref.n.max, cands.length);
      return { min, max };
    }
    case 'all': {
      const cands = candidates(state, ref, ctx);
      return { min: cands.length, max: cands.length };
    }
    case 'fromBound': {
      const bound = ctx.bindings[ref.bindKey] ?? [];
      return { min: bound.length, max: bound.length };
    }
  }
}
