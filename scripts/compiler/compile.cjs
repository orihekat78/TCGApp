// Track B compiler — whitelist 文法 compiler 本体 (B0 = harness skeleton)。
// 原則: 一致句のみ変換。未知句が 1 つでもあれば card 全体を refuse (partial 変換禁止)。
// silent 誤訳 (AI 即興翻訳) を構造排除し、「静かに誤る」→「うるさく止まる」に反転する。
const { loadProductions } = require('./productions.cjs');
const { TEXT_COLS } = require('./tsv-corpus.cjs');

// 句分割 — B1 で 【】〚〛アイコン / 「:」コスト境界 / 「。」節 / 接続 (「その場合」「代わりに」)
// の構造化に置換する。B0 は「非空テキスト列全体 = 1 句」の最粗粒度 (production 0 件なら必ず refuse)。
function segment(texts) {
  const segs = [];
  for (const col of TEXT_COLS) {
    const t = (texts[col] || '').trim();
    if (t) segs.push({ col, text: t });
  }
  return segs;
}

// entry = corpus 行 ({id, kind, texts, ...})。productions = loadProductions() 形式の rule 配列。
// 戻り値:
//   { id, status: 'compiled', abilities, keywords, refusals: [] }
//   { id, status: 'refused',  refusals: [{col, text, reason}] }   // 1 句でも未知なら全体 refuse
function compileCard(entry, productions = loadProductions()) {
  const segs = segment(entry.texts || {});
  const refusals = [];
  const abilities = [];
  const keywords = [];
  for (const seg of segs) {
    const rule = productions.find((p) => p.match(seg, entry));
    if (!rule) {
      refusals.push({ col: seg.col, text: seg.text, reason: 'unknown-phrase' });
      continue;
    }
    const out = rule.emit(seg, entry) || {};
    abilities.push(...(out.abilities || []));
    keywords.push(...(out.keywords || []));
  }
  if (refusals.length) return { id: entry.id, status: 'refused', refusals };
  return { id: entry.id, status: 'compiled', abilities, keywords, refusals: [] };
}

module.exports = { compileCard, segment };
