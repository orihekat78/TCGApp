// Track B compiler — whitelist 文法 compiler 本体。
// 原則: 一致句のみ変換。未知句が 1 つでもあれば card 全体を refuse (partial 変換禁止)。
// silent 誤訳 (AI 即興翻訳) を構造排除し、「静かに誤る」→「うるさく止まる」に反転する。
const { loadProductions } = require('./productions.cjs');
const { TEXT_COLS } = require('./tsv-corpus.cjs');
const { splitLines } = require('./norm.cjs');

// 句分割 (B1): 列ごとに印字行 (literal "\n" / <br> 区切り) へ分解する。
// 1 行 = 1 rule 単位。shipped の AbilityDef.description が印字行と 1:1 対応する実測に基づく
// (行より細かい「。」節分割は parametric rule 導入時に再検討 — exact 行 rule には不要)。
function segment(texts) {
  const segs = [];
  for (const col of TEXT_COLS) {
    for (const line of splitLines(texts[col])) segs.push({ col, text: line });
  }
  return segs;
}

// entry = corpus 行 ({id, kind, texts, ...})。productions = loadProductions() 形式の rule 配列。
// rule 契約:
//   { name, match(seg, entry) => bool, emit(seg, entry) => {abilities?, keywords?} }
//     seg = {col, text} (1 行) または {col, text, colSpan: true} (列全体 — 複数行 1 能力の rule 用。
//     compile は列ごとに「列全体 rule → 行 rule」の順で lookup する)
//   { name, refuseEntry(entry) => string|false }  — card 単位の恒久 refuse (例外リスト。理由文字列を返す)
// 戻り値:
//   { id, status: 'compiled', abilities, keywords, refusals: [] }
//   { id, status: 'refused',  refusals: [{col, text, reason}] }   // 1 句でも未知なら全体 refuse
function compileCard(entry, productions = loadProductions()) {
  for (const p of productions) {
    const why = p.refuseEntry && p.refuseEntry(entry);
    if (why) return { id: entry.id, status: 'refused', refusals: [{ col: '*', text: '', reason: why }] };
  }
  const texts = entry.texts || {};
  const refusals = [];
  const abilities = [];
  const keywords = [];
  const collect = (out) => {
    abilities.push(...((out && out.abilities) || []));
    keywords.push(...((out && out.keywords) || []));
  };
  for (const col of TEXT_COLS) {
    const colText = (texts[col] || '').trim();
    const lines = splitLines(colText);
    if (!lines.length) continue;
    const colSeg = { col, text: colText, colSpan: true };
    const colRule = productions.find((p) => p.match && p.match(colSeg, entry));
    if (colRule) {
      collect(colRule.emit(colSeg, entry));
      continue;
    }
    for (const line of lines) {
      const seg = { col, text: line };
      const rule = productions.find((p) => p.match && p.match(seg, entry));
      if (!rule) {
        refusals.push({ col, text: line, reason: 'unknown-phrase' });
        continue;
      }
      collect(rule.emit(seg, entry));
    }
  }
  if (refusals.length) return { id: entry.id, status: 'refused', refusals };
  return { id: entry.id, status: 'compiled', abilities, keywords, refusals: [] };
}

module.exports = { compileCard, segment };
