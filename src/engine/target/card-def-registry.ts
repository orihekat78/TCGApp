// engine.target.card-def-registry — pluggable CardDef lookup for targeting
// spec: Phase 3 Group B Task 3.4
//
// The targeting layer needs to evaluate filters like {trait, color, level}
// against the CardDef of each candidate. To avoid coupling to a specific
// data-loading mechanism (Phase 5 TSV loader), we accept a lookup function.
// Default: delegate to engine.read.def.card (the global stub registry).

import type { CardDef } from '@/engine/types';
import { def } from '@/engine/read/def.js';

export type CardDefLookup = (cardId: string) => CardDef | undefined;

// Module-local lookup, defaults to engine.read.def.card
let _lookup: CardDefLookup = (cardId: string) => def.card(cardId);

export function setCardDefLookup(fn: CardDefLookup): void {
  _lookup = fn;
}

export function resetCardDefLookup(): void {
  _lookup = (cardId: string) => def.card(cardId);
}

export function lookupCardDef(cardId: string): CardDef | undefined {
  return _lookup(cardId);
}

/**
 * Split a card name into components per rules/19.
 * Splits on '&', '『 』', '( )'.
 * Example: "江戸川コナン&工藤新一" -> ["江戸川コナン&工藤新一", "江戸川コナン", "工藤新一"]
 * The original name is always included as a component.
 */
export function cardNameComponents(name: string): string[] {
  const components = new Set<string>();
  components.add(name);

  // Split on & first (BUG-178: 印字は全角＆のカードが 57 file — 半角/全角両対応。parenRe と同 posture)
  const ampParts = name.split(/[&＆]/).map(s => s.trim()).filter(Boolean);
  for (const part of ampParts) {
    components.add(part);
  }

  // Strip 『』 brackets and add content
  const bracketRe = /『([^『』]+)』/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(name)) !== null) {
    components.add(m[1]);
  }
  // Also: name with brackets stripped
  const noBrackets = name.replace(/『|』/g, '').trim();
  if (noBrackets) components.add(noBrackets);

  // Strip () parens and add content
  const parenRe = /[(（]([^()（）]+)[)）]/g;
  while ((m = parenRe.exec(name)) !== null) {
    components.add(m[1]);
  }
  const noParens = name.replace(/[()（）]/g, '').trim();
  if (noParens) components.add(noParens);

  return Array.from(components);
}

/**
 * Get all card-name components for a CardDef, factoring in rules/19 split-name
 * cards. Combines CardDef.names with any further splitting on each name.
 */
export function allCardNameComponentsForDef(d: CardDef): string[] {
  const out = new Set<string>();
  for (const n of d.names) {
    out.add(n);
    for (const c of cardNameComponents(n)) {
      out.add(c);
    }
  }
  return Array.from(out);
}
