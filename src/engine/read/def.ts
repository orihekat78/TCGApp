// engine.read.def — カードDB参照セレクタ (純粋関数)
// Phase 5 で TSV ロード接続。今は stubbed registry。
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md

import type { CardDef } from '@/engine/types';

// 内部レジストリ: Phase 5 で engine.cards.register(def) から登録される
const _registry = new Map<string, CardDef>();

// カードを登録する (Phase 5 で TSV ローダが呼ぶ)
export function register(def: CardDef): void {
  _registry.set(def.id, def);
}

// テスト・フェーズ移行時にレジストリをリセット
export function _resetRegistry(): void {
  _registry.clear();
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

export const def = {
  card,
  byTrait,
  byColor,
};
