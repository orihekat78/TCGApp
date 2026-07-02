// Track B compiler — oracle diff runner。
// 実装済カード全件: 印字テキスト → compile → shipped DSL と正規化 diff → 3 値判定。
//   match    = compile 成功かつ shipped と構造一致
//   refuse   = 未知句で card 全体 refuse (安全側。B0 は production 0 件なので text-bearing は全部これ)
//   mismatch = compile 成功したが shipped と不一致 — silent 誤訳。G1 ゲート = これが 0 (B1 以降)
// 使い方: node scripts/compiler/oracle.cjs [--gate]
//   事前に tsv-corpus.cjs / dump-shipped.ts を実行して .tmp/compiler/*.json を生成しておく。
//   --gate: mismatch > 0 で exit 1 (G1 ゲート用)。
const fs = require('fs');
const path = require('path');
const { compileCard } = require('./compile.cjs');
const { loadProductions } = require('./productions.cjs');
const { stableStringify, semanticCard } = require('./canonical.cjs');

// P variant (B08004P / B05005P 等) は印字テキスト同一の別 printing — corpus は base id のみ持つ。
function baseId(id) {
  return id.replace(/P\d*$/, '');
}

// 比較は意味射影 (canonical.semanticCard): ability の id/name/description/ruleRefs は非意味 metadata として
// 除外し、type/scope/trigger/condition/cost/limit/effect/continuousModifier + keywords を厳密比較する。
// abilities の配列順は保持比較 (rules/15 同時発動の既定解決順)。
function judge(entry, shippedCard, productions) {
  const res = compileCard(entry, productions);
  if (res.status === 'refused') return { verdict: 'refuse', refusals: res.refusals };
  const got = stableStringify(semanticCard({ abilities: res.abilities, keywords: res.keywords }));
  const want = stableStringify(semanticCard(shippedCard));
  if (got === want) return { verdict: 'match' };
  return { verdict: 'mismatch', got, want };
}

// corpus = tsv-corpus 行配列 / shipped = canonicalCard 配列。
function runOracle(corpus, shipped, productions = loadProductions()) {
  const byId = new Map(corpus.map((c) => [c.id, c]));
  const buckets = { match: [], refuse: [], mismatch: [], noCorpus: [] };
  const refuseReasons = {};
  for (const sc of shipped) {
    const entry = byId.get(sc.id) || byId.get(baseId(sc.id));
    if (!entry) {
      buckets.noCorpus.push(sc.id);
      continue;
    }
    const r = judge(entry, sc, productions);
    if (r.verdict === 'mismatch') {
      buckets.mismatch.push({ id: sc.id, got: r.got, want: r.want });
    } else if (r.verdict === 'refuse') {
      buckets.refuse.push(sc.id);
      for (const ref of r.refusals) {
        const key = `${ref.col}:${ref.reason}`;
        refuseReasons[key] = (refuseReasons[key] || 0) + 1;
      }
    } else {
      buckets.match.push(sc.id);
    }
  }
  // 未実装分 (残カード) への適用率の物差し: corpus のうち shipped が消費しなかった entry を素 compile。
  const claimed = new Set();
  for (const sc of shipped) claimed.add(byId.has(sc.id) ? sc.id : baseId(sc.id));
  const unshipped = corpus.filter((c) => !claimed.has(c.id));
  const unshippedCompiled = unshipped.filter((c) => compileCard(c, productions).status === 'compiled');
  return {
    totals: {
      shipped: shipped.length,
      judged: buckets.match.length + buckets.refuse.length + buckets.mismatch.length,
      match: buckets.match.length,
      refuse: buckets.refuse.length,
      mismatch: buckets.mismatch.length,
      noCorpus: buckets.noCorpus.length,
      unshipped: unshipped.length,
      unshippedCompiled: unshippedCompiled.length,
    },
    buckets,
    refuseReasons,
    unshippedCompiledIds: unshippedCompiled.map((c) => c.id),
  };
}

if (require.main === module) {
  const root = path.join(__dirname, '..', '..');
  const dir = path.join(root, '.tmp', 'compiler');
  const corpus = JSON.parse(fs.readFileSync(path.join(dir, 'corpus.json'), 'utf8')).cards;
  const shipped = JSON.parse(fs.readFileSync(path.join(dir, 'shipped-dsl.json'), 'utf8')).cards;
  const report = runOracle(corpus, shipped);
  fs.writeFileSync(path.join(dir, 'oracle-report.json'), JSON.stringify(report, null, 1));
  const t = report.totals;
  console.log(`oracle: shipped=${t.shipped} judged=${t.judged} | match=${t.match} refuse=${t.refuse} mismatch=${t.mismatch} | no-corpus=${t.noCorpus}`);
  console.log(`  unshipped=${t.unshipped} (compile 可 ${t.unshippedCompiled})`);
  if (t.mismatch) {
    console.log(`  MISMATCH ids: ${report.buckets.mismatch.slice(0, 20).map((m) => m.id).join(', ')}${t.mismatch > 20 ? ' …' : ''}`);
  }
  if (process.argv.includes('--gate') && t.mismatch > 0) {
    console.error('G1 GATE FAIL: silent mismatch > 0');
    process.exit(1);
  }
}

module.exports = { runOracle, judge, baseId };
