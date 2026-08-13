// engine.read.def — カードDB参照セレクタ (純粋関数)
// Phase 5 で TSV ロード接続。今は stubbed registry。
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md

import type { CardDef } from '@/engine/types';

// 内部レジストリ: Phase 5 で engine.cards.register(def) から登録される
const _registry = new Map<string, CardDef>();
const _baseRegistry = new Map<string, CardDef>();
const _temporaryOverlays = new Map<string, Map<number, CardDef>>();
let nextTemporaryOverlayId = 0;

function refreshVisibleDefinition(id: string): void {
  const overlays = _temporaryOverlays.get(id);
  const newestOverlay = overlays === undefined
    ? undefined
    : Array.from(overlays.values()).at(-1);
  const visible = newestOverlay ?? _baseRegistry.get(id);
  if (visible === undefined) _registry.delete(id);
  else _registry.set(id, visible);
}

// カードを登録する (Phase 5 で TSV ローダが呼ぶ)
export function register(def: CardDef): void {
  _baseRegistry.set(def.id, def);
  refreshVisibleDefinition(def.id);
}

/**
 * Make one definition available for an authorized async operation only.
 * Restore an existing entry exactly; never clear the whole registry.
 */
export function registerTemporary(def: CardDef): () => void {
  const overlayId = nextTemporaryOverlayId++;
  const overlays = _temporaryOverlays.get(def.id) ?? new Map<number, CardDef>();
  overlays.set(overlayId, def);
  _temporaryOverlays.set(def.id, overlays);
  refreshVisibleDefinition(def.id);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const activeOverlays = _temporaryOverlays.get(def.id);
    activeOverlays?.delete(overlayId);
    if (activeOverlays?.size === 0) _temporaryOverlays.delete(def.id);
    refreshVisibleDefinition(def.id);
  };
}

export async function withTemporaryRegistration<T>(def: CardDef, run: () => Promise<T>): Promise<T> {
  const restore = registerTemporary(def);
  try {
    return await run();
  } finally {
    restore();
  }
}

// テスト・フェーズ移行時にレジストリをリセット
export function _resetRegistry(): void {
  _registry.clear();
  _baseRegistry.clear();
  _temporaryOverlays.clear();
}

// engine.cards.all() 用: 全登録カードを取得
export function _allRegistered(): CardDef[] {
  return Array.from(_registry.values());
}

function card(cardId: string): CardDef | undefined {
  return _registry.get(cardId);
}

function byTrait(trait: string): CardDef[] {
  return Array.from(_registry.values()).filter(d => d.traits.includes(trait));
}

function byColor(color: string): CardDef[] {
  return Array.from(_registry.values()).filter(d => d.colors.includes(color));
}

/** Canonical selectable trait universe, deterministic for declaration UI and AI. */
function allTraits(): string[] {
  return [...new Set(Array.from(_registry.values()).flatMap((d) => d.traits))].sort((a, b) => a.localeCompare(b, 'ja'));
}

/**
 * MR 判定 (rules/18)。MR/MRP/MRCP 全 printing を含むため rarity の前方一致で判定する
 * (engine/mr-partner-area-core, 2026-06-23)。CardDef.isMR が明示 true ならそれも尊重する
 * (将来 loader が直接 set する場合の前方互換)。未登録 cardId / 'back-card' 等は false。
 */
function isMR(cardId: string): boolean {
  const d = _registry.get(cardId);
  if (!d) return false;
  if (d.isMR) return true;
  return d.rarity?.startsWith('MR') ?? false;
}

export const def = {
  card,
  byTrait,
  byColor,
  allTraits,
  isMR,
};
