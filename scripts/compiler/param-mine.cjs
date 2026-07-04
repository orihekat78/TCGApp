// Track B compiler — B4 param rule 採掘 CLI。
// 前提: node scripts/compiler/mine.cjs 済 (rules/line-rules.json が最新)。
// 手順:
//   1. exact 行 rule から param rule 候補を構築 (param.cjs buildParamRules)
//   2. 検証 pass: 全 exact rule に対し param rule を試適用 — 生成 ability が exact と
//      (description 除き) deep-equal でない template の rule は purge (refuse-first)
//   3. rules/param-rules.json へ出力 + 未出荷 corpus への compile 率を再計測
// 使い方: node scripts/compiler/param-mine.cjs
const fs = require('fs');
const path = require('path');
const { buildParamRules, extractSlots, instantiate, stripDesc, deepEqual } = require('./param.cjs');
const { lineKey } = require('./norm.cjs');

const ROOT = path.join(__dirname, '..', '..');
const RULES_DIR = path.join(__dirname, 'rules');
const TMP = path.join(ROOT, '.tmp', 'compiler');

const lineRules = JSON.parse(fs.readFileSync(path.join(RULES_DIR, 'line-rules.json'), 'utf8')).rules;

// ---- 1. 構築 ----
const { rules, rejected, skipped, groupCount } = buildParamRules(lineRules);
console.log(
  `param-mine: groups=${groupCount} built=${rules.length} rejected=${rejected.length} ` +
    `skipped=${JSON.stringify(skipped)}`,
);

// ---- 2. 検証 pass (exact rule 全数を param で再現できるか) ----
// param rule の適用対象 = template + kind/col + slotTypes 一致。exact ability と不一致 → purge。
const byTemplate = new Map(rules.map((r) => [`${r.kind}|${r.col}|${r.template}`, r]));
const purged = new Set();
let checked = 0;
for (const er of lineRules) {
  if (er.key.includes('|COLSPAN|')) continue;
  const parts = er.key.split('|');
  const kind = parts[0];
  const col = parts[1];
  const line = parts.slice(2).join('|');
  const { template, slots } = extractSlots(line);
  const pr = byTemplate.get(`${kind}|${col}|${template}`);
  if (!pr || purged.has(pr)) continue;
  const active = slots.filter((_s, j) => {
    // literal 化された occurrence は template 側に畳まれているため、再抽出した slots と
    // rule.slotTypes の長さ一致で判定 (不一致 = literal 化 rule に non-literal 行が来た = 対象外)
    void j;
    return true;
  });
  if (active.length !== pr.slotTypes.length) continue; // literal 折込 rule と slot 数不一致
  if (!active.every((s, j) => s.type === pr.slotTypes[j])) continue;
  checked++;
  if (er.keywords || er.abilities) {
    purged.add(pr); // keyword/複数 ability 行に template 一致 = param では再現不能
    continue;
  }
  const inst = instantiate(pr, active, line);
  if (!deepEqual(stripDesc(inst), stripDesc(er.ability))) purged.add(pr);
}
const survivors = rules.filter((r) => !purged.has(r));
console.log(`  verify: checked=${checked} purged=${purged.size} survivors=${survivors.length}`);

// ---- 3. 出力 (G1 oracle loop 前に一旦書く — loadProductions が file 経由で読むため) ----
function writeParamRules(list) {
  fs.writeFileSync(
    path.join(RULES_DIR, 'param-rules.json'),
    JSON.stringify(
      { generatedBy: 'scripts/compiler/param-mine.cjs', ruleCount: list.length, rules: list },
      null,
      1,
    ),
  );
}
writeParamRules(survivors);

// ---- 3b. G1 oracle loop: exact+param で全 shipped を再現 or refuse (mismatch 0 まで) ----
// mismatch の主因 = shipped が印字の一部だけ実装した partial カード (//DEFERRED 型) の未実装行に
// param rule が正しく match して「shipped より多い」abilities を生む系。rule 自体は正しい
// (shipped-gap の検出器として機能) ため purge せず、mine.cjs 前例に従い **カード単位で
// exceptions.json へ登録** (reason='param-g1: shipped 非再現 (partial/構造逸脱疑い)')。
// exceptions は compile を id 単位 refuse にする — silent 誤訳はカード単位で封じられる。
{
  const { runOracle } = require('./oracle.cjs');
  const { loadProductions } = require('./productions.cjs');
  const corpusAll = JSON.parse(fs.readFileSync(path.join(TMP, 'corpus.json'), 'utf8')).cards;
  const shippedDsl = JSON.parse(fs.readFileSync(path.join(TMP, 'shipped-dsl.json'), 'utf8')).cards;
  const excFile = path.join(RULES_DIR, 'exceptions.json');
  const exc = JSON.parse(fs.readFileSync(excFile, 'utf8'));
  const report = runOracle(corpusAll, shippedDsl, loadProductions());
  const mm = report.buckets.mismatch || [];
  if (mm.length) {
    const known = new Set(exc.cards.map((c) => c.id));
    for (const m of mm) {
      if (!known.has(m.id)) exc.cards.push({ id: m.id, reason: 'param-g1: shipped 非再現 (partial/構造逸脱疑い)' });
    }
    fs.writeFileSync(excFile, JSON.stringify(exc, null, 1));
    console.log(`  G1 loop: mismatch=${mm.length} → exceptions 追加 [${mm.map((m) => m.id).join(', ')}]`);
  } else {
    console.log('  G1 loop: mismatch=0');
  }
}

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(
  path.join(TMP, 'param-mine-report.json'),
  JSON.stringify({ groupCount, built: rules.length, rejected, skipped, purged: purged.size }, null, 1),
);

// compile 率 (exact + param) を未出荷に対して再計測
const { loadCorpus } = require('./tsv-corpus.cjs');
const { compileCard } = require('./compile.cjs');
const shipped = new Set(
  JSON.parse(fs.readFileSync(path.join(TMP, 'shipped-dsl.json'), 'utf8')).cards.map((c) => c.id),
);
const corpus = loadCorpus(ROOT);
let unshipped = 0;
let ok = 0;
const okIds = [];
for (const e of corpus) {
  if (shipped.has(e.id) || e.kind === 'partner') continue;
  unshipped++;
  const r = compileCard(e);
  if (r.status === 'compiled') {
    ok++;
    okIds.push(e.id);
  }
}
fs.writeFileSync(path.join(TMP, 'param-compilable.json'), JSON.stringify(okIds, null, 1));
console.log(`  unshipped compile 可 (exact+param) = ${ok}/${unshipped} (was 15 exact-only)`);
