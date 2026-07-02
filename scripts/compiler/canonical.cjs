// Track B compiler — canonical 正規化。
// shipped DSL と compile 出力を構造比較可能な同一形へ写す (oracle diff の土台)。
// 方針: key 昇順 / undefined 除去 / 関数は '<closure>' marker (custom カードは match 不可能として顕在化)。
// 等価形の吸収 (sequence[1つ]=atom 等) は B1 の文法設計と同時に導入する — B0 では構造完全一致のみ。

function canonicalize(v) {
  if (typeof v === 'function') return '<closure>';
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicalize);
  const o = {};
  for (const k of Object.keys(v).sort()) {
    if (v[k] === undefined) continue;
    o[k] = canonicalize(v[k]);
  }
  return o;
}

// oracle の比較対象 = テキスト翻訳の産物のみ (abilities + keywords)。
// stat 系 (color/level/ap/lp/names/traits) は TSV → codegen が機械転記するため compiler の守備範囲外。
// keywords は順序無意味 (印字順 ≠ 意味) → sort で吸収。abilities は a1/a2 順序が意味を持つ → 保持。
function canonicalCard(def) {
  return canonicalize({
    id: def.id,
    keywords: [...(def.keywords || [])].sort(),
    abilities: def.abilities || [],
  });
}

function stableStringify(v) {
  return JSON.stringify(canonicalize(v));
}

function hasClosure(v) {
  return stableStringify(v).includes('"<closure>"');
}

// ---- 意味射影 (B1) ----
// oracle 比較は「意味を持つ field」のみ。以下は非意味 metadata として落とす:
//   id          — カード内通し名 (a1/a2)。shipped で同一テキストでも a1/a2 が揺れる実測 (B01008=a2 / B01029=a1)
//   name        — 表示名のみ
//   description — 公式テキスト転記。shipped で注釈除去・文末「。」付加の揺れがある
//   ruleRefs    — ドキュメント参照
// それ以外 (type/scope/trigger/condition/cost/limit/effect/continuousModifier) は全て比較対象。
// abilities の配列順は意味を持ちうる (rules/15 同時発動の既定解決順・UI 表示順) — 保持して比較する。
const NON_SEMANTIC_ABILITY_KEYS = ['id', 'name', 'description', 'ruleRefs'];

function semanticAbility(a) {
  const o = { ...a };
  for (const k of NON_SEMANTIC_ABILITY_KEYS) delete o[k];
  return canonicalize(o);
}

function semanticCard(card) {
  return canonicalize({
    keywords: [...(card.keywords || [])].sort(),
    abilities: (card.abilities || []).map(semanticAbility),
  });
}

module.exports = { canonicalize, canonicalCard, stableStringify, hasClosure, semanticAbility, semanticCard };
