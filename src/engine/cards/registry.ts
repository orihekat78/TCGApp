// engine.cards.* — カードDB登録/参照/バリデーション
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md
// spec: .claude/specs/engine-api-card-shape.md
//
// 設計メモ:
//   - 登録のソース・オブ・トゥルースは engine.read.def の `_registry` (Map<string, CardDef>)
//   - engine.cards.register は def モジュールへ委譲。read.def.* と同じレジストリを共有
//   - byName は rules/19 の複数名カード対応のため CardDef.names 配列を全件マッチ
//   - load(setCode) は tsv-loader へ委譲 (Task 5.1c)

import type { CardDef, ValidationResult } from '../types/index.js';
import {
  register as _register,
  _resetRegistry as _resetDefRegistry,
  _allRegistered,
} from '../read/def.js';
import { def as defSelectors } from '../read/def.js';
import { validateCards } from '../effect/validate.js';
// loadSet は Node 専用 (`tsv-loader-fs.ts`) — `load()` 内で動的 import する。
// ブラウザバンドルに node:fs を巻き込まないための分離 (Phase 9-B hotfix)。

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

// load(setCode): TSV をパースしてレジストリへ register する。
// 同一 id を再ロードした場合は上書きされる (Map の挙動)。
// loadSet は node:fs 依存のため tsv-loader-fs から動的 import (ブラウザ非引込み)。
async function load(setCode: 'CT-D08' | 'CT-D11'): Promise<void> {
  const { loadSet } = await import('./tsv-loader-fs.js');
  const defs = loadSet(setCode);
  for (const d of defs) register(d);
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

export const cards = {
  register,
  get,
  all,
  byName,
  byTrait,
  byColor,
  validate,
  validateAll,
  load,
  unload,
  _resetRegistry,
};
