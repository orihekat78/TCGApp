// Track B compiler — B1 行 rule 採掘器 (全決定論、AI 翻訳ゼロ)。
//
// 原理: shipped CardDef の AbilityDef.description ⇔ 印字行 の突合せで「行 key → 意味射影 ability」の
// 対応を出荷済 exemplar から機械採掘する。採掘 rule は全て実機ゲート (vitest/smoke) 通過済み実装が根拠。
// 対応の取り方は 2 段:
//   desc 突合 (origin='desc'): alignNorm(description) === alignNorm(印字行)。最高信頼。
//   消去法   (origin='elim'): desc がパラフレーズ (旧 shipped ~450 枚は要約/矢印記法) で突合不能でも、
//     desc 突合と keyword 行を除いた「残 ability × 残行」が同数なら配列順で pair する。
//     誤 pairing の可能性は oracle dry-run が card 単位で検出し (composition 再現失敗 = mismatch)、
//     mismatch card の elim 由来 rule は purge loop が決定論的に除去する (下記 4)。
//
// 安全機構 (refuse-first):
//   1. 同一 key に複数の意味が観測されたら conflict — rule 化を拒否 (該当行を含む card は refuse)
//   2. closure (custom TS) を含む ability は rule 化しない → closure カードは恒久 refuse
//   3. 対応が完全 (全 ability + 全 keyword + 全行が説明可能) でない card からは採掘しない
//   4. purge loop: dry-run oracle の mismatch card 集合 E について「全 exemplar が E 由来かつ elim 起源」
//      の rule を削除して再実行、固定点まで反復 (rule 集合は単調減少 → 停止保証)。desc 起源 rule は
//      mismatch card 由来でも残す (mismatch の原因は ability 配列順 ≠ 行順などの構造逸脱で、
//      desc pairing 自体は成立しているため)。
//   5. 固定点後も mismatch の card は exceptions.json へ自動登録 → compile が id 単位で refuse
//      (composition では shipped 実装を再現できない card — B3 調査 queue)
//
// 使い方: node scripts/compiler/tsv-corpus.cjs && npx tsx scripts/compiler/dump-shipped.ts &&
//         node scripts/compiler/mine.cjs
// 出力: scripts/compiler/rules/line-rules.json / rules/exceptions.json (checked-in、レビュー対象)
//       .tmp/compiler/mine-report.json (詳細レポート)
const fs = require('fs');
const path = require('path');
const { segment } = require('./compile.cjs');
const { lineKey, alignNorm, colKey } = require('./norm.cjs');
const { stableStringify, semanticAbility, hasClosure } = require('./canonical.cjs');
const { runOracle } = require('./oracle.cjs');
const { PARTNER_BOILERPLATE } = require('./productions.cjs');

const nrmKw = (s) => s.replace(/［/g, '[').replace(/］/g, ']').trim();
const KW_LINE = /^(?:〚[^〛]*〛)+$/;
const baseId = (id) => id.replace(/P\d*$/, '');

// 1 card から (行 key → ability / keywords) 対応を採掘する。
function mineCard(entry, shipped) {
  const segs = segment(entry.texts || {});
  const slots = segs.map((s, i) => ({
    i,
    col: s.col,
    key: `${entry.kind}|${s.col}|${lineKey(s.text)}`,
    an: alignNorm(s.text),
    kwTokens: KW_LINE.test(lineKey(s.text)) ? [...lineKey(s.text).matchAll(/〚([^〛]*)〛/g)].map((m) => m[1].trim()) : null,
    boiler: entry.kind === 'partner' && PARTNER_BOILERPLATE.has(lineKey(s.text)),
    used: false,
  }));
  // 1) desc 突合
  const pairs = [];
  const colspanPairs = []; // {col, ab|abs, origin}
  let unalignedAbs = [];
  for (const ab of shipped.abilities || []) {
    const an = ab.description ? alignNorm(ab.description) : '';
    const slot = an !== '' ? slots.find((sl) => !sl.used && !sl.boiler && sl.an === an) : undefined;
    if (slot) {
      slot.used = true;
      pairs.push({ slot, ab, origin: 'desc' });
    } else {
      unalignedAbs.push(ab);
    }
  }
  // 1.5) colspan desc 突合: description が列の全行連結と一致する (複数行 1 能力 — B03026 型)。
  //      対象列は「全行が未消費」の列のみ (部分列 rule は作らない — compile は列全体でしか lookup しない)。
  const wholeLeftoverCols = () =>
    [...new Set(slots.filter((sl) => !sl.used && !sl.boiler).map((sl) => sl.col))].filter((col) =>
      slots.filter((sl) => sl.col === col && !sl.boiler).every((sl) => !sl.used) &&
      slots.filter((sl) => sl.col === col).length >= 2
    );
  for (const ab of [...unalignedAbs]) {
    const an = ab.description ? alignNorm(ab.description) : '';
    if (!an) continue;
    const col = wholeLeftoverCols().find((c) => alignNorm((entry.texts || {})[c] || '') === an);
    if (!col) continue;
    for (const sl of slots) if (sl.col === col) sl.used = true;
    colspanPairs.push({ col, ab, origin: 'colspan-desc' });
    unalignedAbs = unalignedAbs.filter((x) => x !== ab);
  }
  // 2) keyword 行の割当 (shipped.keywords の多重集合と厳密一致するまで)
  const want = [...(shipped.keywords || [])];
  const kwLines = [];
  for (const sl of slots) {
    if (sl.used || sl.boiler || !sl.kwTokens || !want.length) continue;
    const mapped = [];
    let ok = true;
    const rest = [...want];
    for (const tok of sl.kwTokens) {
      const idx = rest.findIndex((k) => nrmKw(k) === nrmKw(tok));
      if (idx < 0) { ok = false; break; }
      mapped.push(rest[idx]);
      rest.splice(idx, 1);
    }
    if (!ok) continue; // keyword 行に見えるが shipped.keywords に無い → ability 候補として残す (消去法へ)
    sl.used = true;
    kwLines.push({ slot: sl, mapped });
    want.length = 0;
    want.push(...rest);
  }
  if (want.length) return { status: 'skipped', reason: 'kw-unaccounted' };
  // 3) 消去法: 残 ability × 残行 が同数なら配列順 pair。
  //    残行が 1 本で残 ability が複数なら、その 1 行に全 ability を pack する
  //    (「【登場時】【変装時】X」のような icon 併記行 = 1 行複数能力。B02044 型)。
  //    残 ability が 1 つで残行が「単一の全行未消費列」なら colspan pair (B02032 型 — 使用条件行 + 効果行)。
  //    残 ability < 残行 (印字行に対応 ability が無い) は shipped 側の部分実装疑い — 採掘せず報告する。
  //    ※ 消去法 pairing の誤りは purge loop (安全機構 4) が oracle mismatch から検出・除去する。
  const restSlots = slots.filter((sl) => !sl.used && !sl.boiler);
  const packs = []; // {slot, abs:[...], origin:'elim'}
  if (unalignedAbs.length === restSlots.length) {
    for (let j = 0; j < unalignedAbs.length; j++) {
      pairs.push({ slot: restSlots[j], ab: unalignedAbs[j], origin: 'elim' });
    }
  } else if (restSlots.length === 1 && unalignedAbs.length > 1) {
    packs.push({ slot: restSlots[0], abs: unalignedAbs, origin: 'elim' });
  } else if (unalignedAbs.length === 1 && wholeLeftoverCols().length === 1 && restSlots.every((sl) => sl.col === wholeLeftoverCols()[0])) {
    colspanPairs.push({ col: wholeLeftoverCols()[0], ab: unalignedAbs[0], origin: 'colspan-elim' });
    for (const sl of restSlots) sl.used = true;
  } else if (unalignedAbs.length < restSlots.length) {
    return { status: 'skipped', reason: 'shipped-gap-suspect' };
  } else {
    return { status: 'skipped', reason: 'align-ambiguous' };
  }
  const rules = [];
  let closureAbilities = 0;
  const strip = (ab) => {
    const payload = { ...ab };
    delete payload.id; // カード内通し名 — emit 時に採番し直す
    delete payload.name; // 表示名
    delete payload.description; // 公式テキスト — emit 時に対象 card の印字行から転記する
    return payload;
  };
  for (const { slot, ab, origin } of pairs) {
    if (hasClosure(ab)) {
      closureAbilities++;
      continue; // closure ability は rule 化しない (該当行は永続 unknown-phrase → card refuse)
    }
    rules.push({ key: slot.key, ability: strip(ab), exemplar: shipped.id, origin });
  }
  for (const { slot, abs, origin } of packs) {
    if (abs.some((ab) => hasClosure(ab))) {
      closureAbilities += abs.filter((ab) => hasClosure(ab)).length;
      continue;
    }
    rules.push({ key: slot.key, abilities: abs.map(strip), exemplar: shipped.id, origin });
  }
  for (const { col, ab, origin } of colspanPairs) {
    if (hasClosure(ab)) {
      closureAbilities++;
      continue;
    }
    rules.push({
      key: `${entry.kind}|${col}|COLSPAN|${colKey((entry.texts || {})[col] || '')}`,
      ability: strip(ab),
      exemplar: shipped.id,
      origin,
    });
  }
  for (const kl of kwLines) rules.push({ key: kl.slot.key, keywords: kl.mapped, exemplar: shipped.id, origin: 'desc' });
  return { status: 'mined', rules, closureAbilities };
}

function mineAll(corpus, shipped) {
  const byId = new Map(corpus.map((c) => [c.id, c]));
  const ruleMap = new Map(); // key → {semantic, rule, exemplars: Map(shippedId→origin), count}
  const conflicts = new Map();
  const skipped = {};
  let minedCards = 0;
  let closureAbilities = 0;
  for (const sc of shipped) {
    const entry = byId.get(sc.id) || byId.get(baseId(sc.id));
    if (!entry) continue; // noCorpus は oracle 側で顕在化する
    const r = mineCard(entry, sc);
    if (r.status === 'skipped') {
      (skipped[r.reason] = skipped[r.reason] || []).push(sc.id);
      continue;
    }
    minedCards++;
    closureAbilities += r.closureAbilities;
    for (const rule of r.rules) {
      const semantic = rule.ability
        ? 'ability:' + stableStringify(semanticAbility(rule.ability))
        : rule.abilities
          ? 'abilities:' + stableStringify(rule.abilities.map(semanticAbility))
          : 'keywords:' + stableStringify([...rule.keywords].sort());
      const cur = ruleMap.get(rule.key);
      if (!cur) {
        ruleMap.set(rule.key, { semantic, rule, exemplars: new Map([[rule.exemplar, rule.origin]]), count: 1 });
      } else if (cur.semantic === semantic) {
        if (!cur.exemplars.has(rule.exemplar) || rule.origin === 'desc') cur.exemplars.set(rule.exemplar, rule.origin);
        cur.count++;
      } else {
        if (!conflicts.has(rule.key)) {
          conflicts.set(rule.key, [{ semantic: cur.semantic, exemplars: [...cur.exemplars.keys()] }]);
        }
        conflicts.get(rule.key).push({ semantic, exemplars: [rule.exemplar] });
      }
    }
  }
  for (const key of conflicts.keys()) ruleMap.delete(key); // conflict key は rule 化拒否 (refuse-first)
  return { ruleMap, conflicts, skipped, minedCards, closureAbilities };
}

// in-memory rule map → compile.cjs production (productions.cjs loadMinedLineRules と同形)
function productionFromRuleMap(ruleMap) {
  const keyOf = (seg, entry) =>
    seg.colSpan ? `${entry.kind}|${seg.col}|COLSPAN|${colKey(seg.text)}` : `${entry.kind}|${seg.col}|${lineKey(seg.text)}`;
  return {
    name: 'mined-line-rules',
    match: (seg, entry) => ruleMap.has(keyOf(seg, entry)),
    emit: (seg, entry) => {
      const r = ruleMap.get(keyOf(seg, entry)).rule;
      if (r.keywords) return { keywords: r.keywords };
      if (r.abilities) return { abilities: r.abilities };
      return { abilities: [r.ability] };
    },
  };
}

const boilerRule = {
  name: 'partner-common-boilerplate',
  match: (seg, entry) => entry.kind === 'partner' && PARTNER_BOILERPLATE.has(lineKey(seg.text)),
  emit: () => ({}),
};

// purge loop (安全機構 4): 消去法起源 rule に「composition 検証済 exemplar ≥1」を必須化する。
// 検証済 = その exemplar card 全体が compile==match で shipped を再現した、の意。
// 敵対 review (2026-07-02) の BLOCKER 対応: refuse する card (別行が conflict/closure) から採掘した
// elim rule は mismatch に一度も出ないまま出荷される穴があった (B08007 header 行 → 幻の AP+1000 rule)。
// mismatch 由来だけでなく「match する exemplar を 1 枚も持たない」elim rule を全て除去する。
// desc 起源は pairing 自体が文字列一致で成立しているため対象外 (positional shift が構造上起きない)。
// 除去で match が減ると他 rule の検証も消えうる → 固定点まで反復 (rule 集合は単調減少 → 停止保証)。
function purgeLoop(corpus, shipped, ruleMap) {
  let purgedTotal = 0;
  let dry;
  for (let iter = 0; iter < 50; iter++) {
    dry = runOracle(corpus, shipped, [boilerRule, productionFromRuleMap(ruleMap)]);
    const matched = new Set(dry.buckets.match);
    const purge = [];
    for (const [key, v] of ruleMap) {
      const origins = [...v.exemplars.entries()];
      if (origins.every(([id, origin]) => origin.endsWith('elim') && !matched.has(id))) purge.push(key);
    }
    if (!purge.length) break; // 残 mismatch は構造逸脱 (順序等) — exceptions へ
    for (const key of purge) ruleMap.delete(key);
    purgedTotal += purge.length;
  }
  return { dry, purgedTotal };
}

if (require.main === module) {
  const root = path.join(__dirname, '..', '..');
  const dir = path.join(root, '.tmp', 'compiler');
  const corpus = JSON.parse(fs.readFileSync(path.join(dir, 'corpus.json'), 'utf8')).cards;
  const shipped = JSON.parse(fs.readFileSync(path.join(dir, 'shipped-dsl.json'), 'utf8')).cards;
  const { ruleMap, conflicts, skipped, minedCards, closureAbilities } = mineAll(corpus, shipped);
  const preRules = ruleMap.size;
  const { dry, purgedTotal } = purgeLoop(corpus, shipped, ruleMap);

  const byId = new Map(corpus.map((c) => [c.id, c]));
  const excMap = new Map();
  for (const m of dry.buckets.mismatch) {
    const entry = byId.get(m.id) || byId.get(baseId(m.id));
    excMap.set(entry.id, { id: entry.id, shippedId: m.id, reason: 'composition-mismatch (mined): 文法では shipped 実装を再現できない — B3 調査 queue' });
  }

  // 出力: checked-in rules
  const rulesDir = path.join(__dirname, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  const rulesOut = [...ruleMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      key,
      ...(v.rule.keywords ? { keywords: v.rule.keywords } : v.rule.abilities ? { abilities: v.rule.abilities } : { ability: v.rule.ability }),
      exemplars: [...v.exemplars.keys()].sort().slice(0, 3),
      origins: [...new Set(v.exemplars.values())].sort(),
      count: v.count,
    }));
  fs.writeFileSync(
    path.join(rulesDir, 'line-rules.json'),
    JSON.stringify({ generatedBy: 'scripts/compiler/mine.cjs', minedFromShipped: shipped.length, ruleCount: rulesOut.length, rules: rulesOut }, null, 1)
  );
  fs.writeFileSync(
    path.join(rulesDir, 'exceptions.json'),
    JSON.stringify({ generatedBy: 'scripts/compiler/mine.cjs', cards: [...excMap.values()].sort((a, b) => (a.id < b.id ? -1 : 1)) }, null, 1)
  );

  // 検証: exceptions 適用後の oracle は mismatch=0 でなければならない (G1)
  const excRule = { name: 'composition-exceptions', refuseEntry: (entry) => (excMap.has(entry.id) ? excMap.get(entry.id).reason : false) };
  const finalReport = runOracle(corpus, shipped, [excRule, boilerRule, productionFromRuleMap(ruleMap)]);

  fs.writeFileSync(
    path.join(dir, 'mine-report.json'),
    JSON.stringify(
      {
        minedCards,
        closureAbilities,
        ruleCount: rulesOut.length,
        purgedRules: purgedTotal,
        preRuleCount: preRules,
        skipped: Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, { count: v.length, ids: v.slice(0, 30) }])),
        conflicts: [...conflicts.entries()].map(([key, sems]) => ({ key, variants: sems })),
        exceptions: [...excMap.values()],
        dryMismatch: dry.buckets.mismatch.slice(0, 50),
        finalTotals: finalReport.totals,
      },
      null,
      1
    )
  );

  // 自己検査 (敵対 review BLOCKER の恒常ガード): 消去法起源 rule は必ず match 済 exemplar を持つ。
  const matchedFinal = new Set(finalReport.buckets.match);
  for (const [key, v] of ruleMap) {
    const origins = [...v.exemplars.entries()];
    if (origins.every(([id, origin]) => origin.endsWith('elim') && !matchedFinal.has(id))) {
      console.error(`MINE INVARIANT FAIL: unvalidated elim rule survived purge: ${key}`);
      process.exit(1);
    }
  }

  const t = finalReport.totals;
  console.log(`mine: rules=${rulesOut.length} (from ${minedCards} cards, purged ${purgedTotal}/${preRules}) conflicts=${conflicts.size} closureAb=${closureAbilities}`);
  console.log(`  skipped: ${Object.entries(skipped).map(([k, v]) => `${k}=${v.length}`).join(' ') || 'none'}`);
  console.log(`  dry-run: match=${dry.totals.match} refuse=${dry.totals.refuse} mismatch=${dry.totals.mismatch} → exceptions=${excMap.size}`);
  console.log(`  final:   match=${t.match} refuse=${t.refuse} mismatch=${t.mismatch} | unshipped compile 可=${t.unshippedCompiled}/${t.unshipped}`);
  if (t.mismatch > 0) {
    console.error('MINE INVARIANT FAIL: exceptions 適用後も mismatch > 0');
    process.exit(1);
  }
}

module.exports = { mineCard, mineAll, productionFromRuleMap, purgeLoop };
