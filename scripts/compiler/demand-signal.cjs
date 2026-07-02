// Track B demand-signal (2026-07-02 pivot 成果物の正式ツール化)
// unshipped card の「rule 未被覆行」を抽象クローズ (数値→K / Lv→LvN / 単独色→【色】 /
// 〚カード名〛→⟨カード名⟩ / 〚特徴〛→⟨特徴⟩ / 「引用能力」→「⟨能力⟩」) に畳み、
// 影響カード数降順で Track A 需要ランクを出す。全決定論 (AI 翻訳ゼロ)。
// 前提: tsv-corpus → dump-shipped → mine 実行済 (.tmp/compiler/*.json)。
// 出力: .tmp/compiler/demand-signal.json = { lines: [{clause, cards, ids}], subclauses: [同] }
//   lines = 印字行 1 本粒度 (= card を実際に block している単位)
//   subclauses = 「。」節粒度 (= 行を跨いで共有される primitive 需要。合成不能なので行 unlock は保証しない)
// 用途: specs/compiler-demand-signal-2026-07-02.md の需要ランク再生成 + Track A への具体 id 手渡し。
'use strict';
const fs = require('fs');
const path = require('path');
const { segment } = require('./compile.cjs');
const { lineKey, colKey } = require('./norm.cjs');
const { PARTNER_BOILERPLATE } = require('./productions.cjs');

const TMP = path.join(__dirname, '..', '..', '.tmp', 'compiler');
const baseId = (id) => id.replace(/P\d*$/, '');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// 抽象化: 順序重要 — Lv 先 (残 digits を K に潰す前)、色は単独トークンのみ (【事件緑＆白】等の複合 icon は保持)
function abstractClause(line, titleSet, featureSet) {
  let s = line;
  s = s.replace(/(Lv|レベル)[0-9０-９]+/g, 'LvN');
  s = s.replace(/[0-9０-９]+/g, 'K');
  s = s.replace(/【(赤|青|緑|白|黄|黒)】/g, '【色】');
  s = s.replace(/〚([^〛]+)〛/g, (m, inner) => {
    if (titleSet.has(inner)) return '〚⟨カード名⟩〛';
    if (featureSet.has(inner)) return '〚⟨特徴⟩〛';
    return m;
  });
  // 「引用された能力テキスト」(grant/持つ/書き換え対象) は中身を畳む — grant primitive の需要集計用
  s = s.replace(/「[^」]{6,}」/g, '「⟨能力⟩」');
  return s;
}

// 「。」節粒度 (【】icon prefix は先頭節に残る)。「」〚〛内の 。 では割らない。空節は捨てる。
function splitSubclauses(line) {
  const out = [];
  let cur = '';
  let depth = 0;
  for (const ch of line) {
    cur += ch;
    if (ch === '「' || ch === '〚') depth++;
    else if (ch === '」' || ch === '〛') depth = Math.max(0, depth - 1);
    else if (ch === '。' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function main() {
  const corpus = loadJson(path.join(TMP, 'corpus.json'));
  const shipped = loadJson(path.join(TMP, 'shipped-dsl.json'));
  const ruleFile = loadJson(path.join(__dirname, 'rules', 'line-rules.json'));

  const shippedIds = new Set(shipped.cards.map((c) => c.id));
  const ruleKeys = new Set(ruleFile.rules.map((r) => r.key));

  const titleSet = new Set();
  const featureSet = new Set();
  for (const c of corpus.cards) {
    if (c.title) titleSet.add(c.title.trim());
    for (const f of (c.features || '').split(/[／\/、]/)) if (f.trim()) featureSet.add(f.trim());
  }

  const byLine = new Map(); // 抽象行 -> Set<baseId>
  const bySub = new Map(); // 抽象節 -> Set<baseId>
  const add = (map, k, id) => {
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(id);
  };
  let unshippedCount = 0;
  for (const entry of corpus.cards) {
    if (shippedIds.has(entry.id)) continue;
    const segs = segment(entry.texts || {});
    if (segs.length === 0) continue; // vanilla
    unshippedCount++;
    // colspan rule (列全体 1 rule) が被覆する列は行単位チェックから除外
    const coveredCols = new Set();
    for (const col of new Set(segs.map((s) => s.col))) {
      if (ruleKeys.has(`${entry.kind}|${col}|${colKey(entry.texts[col])}`)) coveredCols.add(col);
    }
    for (const seg of segs) {
      if (coveredCols.has(seg.col)) continue;
      const key = lineKey(seg.text);
      if (key === '') continue;
      if (entry.kind === 'partner' && PARTNER_BOILERPLATE.has(key)) continue;
      if (ruleKeys.has(`${entry.kind}|${seg.col}|${key}`)) continue;
      const id = baseId(entry.id);
      add(byLine, abstractClause(key, titleSet, featureSet), id);
      for (const sub of splitSubclauses(key)) add(bySub, abstractClause(sub, titleSet, featureSet), id);
    }
  }

  const rank = (map) =>
    [...map.entries()]
      .map(([clause, ids]) => ({ clause, cards: ids.size, ids: [...ids].sort() }))
      .sort((a, b) => b.cards - a.cards || a.clause.localeCompare(b.clause, 'ja'));
  const out = { lines: rank(byLine), subclauses: rank(bySub) };

  fs.writeFileSync(path.join(TMP, 'demand-signal.json'), JSON.stringify(out, null, 1));
  console.log(`unshipped(text-bearing)=${unshippedCount} lines=${out.lines.length} subclauses=${out.subclauses.length}`);
  console.log('--- top lines ---');
  for (const e of out.lines.slice(0, 12)) console.log(`${String(e.cards).padStart(3)}  ${e.clause}`);
  console.log('--- top subclauses ---');
  for (const e of out.subclauses.slice(0, 20)) console.log(`${String(e.cards).padStart(3)}  ${e.clause}`);
}

if (require.main === module) main();
module.exports = { abstractClause };
