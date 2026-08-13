// engine.cards.* — カードDB登録/参照/バリデーション
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md
// spec: .claude/specs/engine-api-card-shape.md
//
// 設計メモ:
//   - 登録のソース・オブ・トゥルースは engine.read.def の `_registry` (Map<string, CardDef>)
//   - engine.cards.register は def モジュールへ委譲。read.def.* と同じレジストリを共有
//   - byName は rules/19 の複数名カード対応のため CardDef.names 配列を全件マッチ

import type { CardDef, ValidationResult } from '../types/index.js';
import {
  register as _register,
  _resetRegistry as _resetDefRegistry,
  _allRegistered,
  registerTemporary,
  withTemporaryRegistration,
} from '../read/def.js';
import { def as defSelectors } from '../read/def.js';
import { validateCards } from '../effect/validate.js';

function register(def: CardDef): void {
  _register(def);
}

function get(id: string): CardDef | undefined {
  return defSelectors.card(id);
}

function all(): CardDef[] {
  return _allRegistered();
}

// rules/19: 複数名カードは names 配列に分割名を全て持つので
// names 配列全体を見て名前マッチを判定する。
function byName(name: string): CardDef[] {
  return all().filter(d => d.names.includes(name));
}

function byTrait(trait: string): CardDef[] {
  return defSelectors.byTrait(trait);
}

function byColor(color: string): CardDef[] {
  return defSelectors.byColor(color);
}

function validate(def: CardDef): ValidationResult {
  return validateCards([def]);
}

function validateAll(): ValidationResult[] {
  return all().map(d => validateCards([d]));
}

function unload(setCode?: string): void {
  if (setCode === undefined) {
    _resetDefRegistry();
    return;
  }
  // setCode 指定: 該当セットの id だけを除去 (id prefix で判定)
  const prefix = setCode.replace(/^CT-/, '');
  const remaining = all().filter(d => !d.id.startsWith(prefix));
  _resetDefRegistry();
  for (const d of remaining) register(d);
}

function _resetRegistry(): void {
  _resetDefRegistry();
}

async function withTemporary<T>(def: CardDef, run: () => Promise<T>): Promise<T> {
  return withTemporaryRegistration(def, run);
}

function retainTemporary(def: CardDef): () => void {
  return registerTemporary(def);
}

export const cards = {
  register,
  get,
  all,
  byName,
  byTrait,
  byColor,
  validate,
  validateAll,
  unload,
  withTemporary,
  retainTemporary,
  _resetRegistry,
};
