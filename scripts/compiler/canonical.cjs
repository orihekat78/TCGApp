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

module.exports = { canonicalize, canonicalCard, stableStringify, hasClosure };
