/**
 * Task A codegen — certified green spec (abilities JSON) → CardDef .ts file.
 *
 * Input spec (per card, from certify workflow):
 *   { rep, verdict:'green', confidence, tier, keywords:[], isMR:false,
 *     abilities:[AbilityDef...], clauseMap:[{clause,mapsTo,grounding}], ruleRefs:[], cluster }
 * Metadata (no/colors/level/ap/lp/traits/rarity/imageUrl/names) is pulled from the TSV catalog
 * by id, so agents only author the hard part (abilities). Emits files that match the
 * hand-authored convention (header comment + const aN + export const <ID>).
 *
 * Usage:
 *   node scripts/taskA-codegen.cjs <specs.json> [--write]
 * Without --write: prints would-be paths + a dry-run of the first file.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '.claude', 'specs', 'cards-data');
const SRC_CARDS = path.join(__dirname, '..', 'src', 'cards');
const COLORS = new Set(['青', '赤', '黄', '緑', '白', '黒']);

function parseTsv(p) {
  const raw = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  if (!lines.length) return [];
  const h = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const c = line.split('\t');
    const o = {};
    h.forEach((k, i) => (o[k] = c[i] ?? ''));
    return o;
  });
}

function loadCatalog() {
  const cat = {};
  for (const pkg of fs.readdirSync(DATA)) {
    if (!/^(ct-[dp]\d\d|pr-\d\d)$/.test(pkg)) continue;
    for (const kind of ['character', 'event', 'case', 'partner']) {
      const p = path.join(DATA, pkg, `${kind}.tsv`);
      if (!fs.existsSync(p)) continue;
      for (const r of parseTsv(p)) {
        if (!r.cardNum) continue;
        r.kind = kind;
        r.pkg = pkg;
        cat[r.cardNum] = r;
      }
    }
  }
  return cat;
}

/** "白,黄" | "青緑" | "青,緑,白,赤,黄" -> ['白','黄'] etc. */
function splitColors(s) {
  const out = [];
  for (const chunk of (s || '').split(',')) {
    for (const ch of chunk.trim()) {
      if (COLORS.has(ch) && !out.includes(ch)) out.push(ch);
    }
  }
  return out;
}

function splitTraits(s) {
  // TSV features use mixed separators: comma (,) and pipe (|).
  return (s || '')
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function numOrUndef(s) {
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Serialize a JS value to TS source (double-quoted; eslint --fix normalizes to single later). */
function ser(v, indent) {
  const pad = '  '.repeat(indent);
  const pad1 = '  '.repeat(indent + 1);
  if (v === null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') {
    // 改行は単一行 TS リテラルにするため空白化 (description 等の複数行テキスト対策)。
    const s = v.replace(/\r?\n/g, ' ').replace(/ +/g, ' ');
    return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const items = v.map((x) => pad1 + ser(x, indent + 1));
    return `[\n${items.join(',\n')}\n${pad}]`;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    const items = keys.map((k) => {
      const kk = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${pad1}${kk}: ${ser(v[k], indent + 1)}`;
    });
    return `{\n${items.join(',\n')}\n${pad}}`;
  }
  throw new Error('cannot serialize: ' + typeof v);
}

// 許可する共通クラス (cards/_shared barrel)。spec の ability に {"__shared":"misreadX","args":{...}} 形で指定。
const SHARED_FNS = new Set([
  'misreadX', 'souzaX', 'partnerColorKeyword', 'eventRemoveByAP',
  'caseTraitConditioned', 'caseResolvedHandRemove', 'caseDeclaredEvidenceFlip',
]);

/** trigger.__eventUse:true → イベント自己使用 matcher closure (B06071/D08024/eventRemoveByAP 同型)。 */
const EVENT_USE_MATCHER = "(p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'";

/** AbilityDef JSON を TS 式へ。__eventUse pseudo-flag を closure に置換するため marker を経由。 */
function serAbility(ab, indent) {
  const clone = JSON.parse(JSON.stringify(ab));
  let hasEventUse = false;
  if (clone.trigger && clone.trigger.__eventUse === true) {
    delete clone.trigger.__eventUse;
    clone.trigger.matcher = '__EVENT_USE_MATCHER__';
    hasEventUse = true;
  }
  let src = ser(clone, indent);
  if (hasEventUse) src = src.replace(ser('__EVENT_USE_MATCHER__', 0), EVENT_USE_MATCHER);
  return src;
}

function genFile(spec, cat) {
  const r = cat[spec.rep];
  if (!r) throw new Error('no catalog record for ' + spec.rep);
  const id = spec.rep;
  const no = `${r.cardId || ''}/${id}`;
  const names = [r.title];
  const colors = splitColors(r.color);
  const traits = splitTraits(r.features);
  const ruleRefs = spec.ruleRefs && spec.ruleRefs.length ? spec.ruleRefs : ['rules/15-abilities-effects.md'];

  // header
  const textFields = [r.effect, r.cutIn, r.hirameki, r.henso].filter(Boolean);
  const headerText = textFields.map((t) => '//   ' + t.replace(/\n/g, ' ')).join('\n');
  // lint-listener-scope.ts は file 全文 (コメント含む) を /type:\s*['"]triggered['"]/ で走査するため、
  // header コメント内の `type:'...'` / `scope:'...'` の colon を除去して false-positive を防ぐ。
  const deColon = (t) => (t || '').replace(/\b(type|scope|trigger|hook|kind|verb)\s*:/g, '$1 ');
  const clauseLines = (spec.clauseMap || [])
    .map((c) => `//   - ${deColon(c.clause)} => ${deColon(c.mapsTo)}${c.grounding ? ` [${deColon(c.grounding)}]` : ''}`)
    .join('\n');

  let header =
    `// cards/${r.pkg}/${id} ${r.title} (${r.kind}) — Task A green候補 (engine変更0)\n` +
    `// rules: ${ruleRefs.join(', ')}\n` +
    `// 公式テキスト:\n${headerText || '//   (vanilla)'}\n`;
  if (clauseLines) header += `// 句マッピング:\n${clauseLines}\n`;

  // ability consts (plain JSON / __shared 共通クラス呼び出し / __eventUse closure)
  const abilities = spec.abilities || [];
  const sharedUsed = new Set();
  for (const ab of abilities) {
    if (ab.__shared) {
      if (!SHARED_FNS.has(ab.__shared)) throw new Error(`${id}: unknown shared fn ${ab.__shared}`);
      sharedUsed.add(ab.__shared);
      if (ab.args && ab.args.inner && ab.args.inner.__shared) throw new Error(`${id}: nested __shared not supported`);
    }
  }
  const hasPlain = abilities.some((ab) => !ab.__shared);
  const importTypes = hasPlain ? 'AbilityDef, CardDef' : 'CardDef';
  let body = `\nimport type { ${importTypes} } from '@/engine/types';\n`;
  if (sharedUsed.size) body += `import { ${[...sharedUsed].sort().join(', ')} } from '@/cards/_shared';\n`;
  body += '\n';
  const abilityNames = [];
  abilities.forEach((ab, i) => {
    const nm = (ab.id || (ab.args && ab.args.abilityId)) && /^[a-z][a-z0-9_]*$/.test(ab.id || ab.args.abilityId)
      ? (ab.id || ab.args.abilityId) : `a${i + 1}`;
    abilityNames.push(nm);
    if (ab.__shared) {
      body += `const ${nm} = ${ab.__shared}(${ser(ab.args || {}, 0)});\n\n`;
    } else {
      body += `const ${nm}: AbilityDef = ${serAbility(ab, 0)};\n\n`;
    }
  });

  // CardDef
  const def = { id, no, kind: r.kind, names, colors };
  if (r.kind === 'case') {
    def.caseLevel = numOrUndef(r.level);
    def.caseTraits = traits;
    def.traits = [];
  } else {
    if (r.kind !== 'partner') def.level = numOrUndef(r.level);
    if (r.kind === 'character') {
      // character は ap/lp 必須 (numeric)。TSV が空欄のデータ欠落は 0 として扱う (LP0/AP0 は正当な印字値)。
      def.ap = numOrUndef(r.ap) ?? 0;
      def.lp = numOrUndef(r.lp) ?? 0;
    }
    def.traits = traits;
  }
  def.rarity = r.rarity || 'C';
  if (spec.isMR) def.isMR = true;
  def.imageUrl = r.imagePath || '';
  if (r.kind === 'character' && spec.keywords && spec.keywords.length) def.keywords = spec.keywords;

  // build object literal text manually so abilities reference the consts
  const lines = [];
  for (const [k, val] of Object.entries(def)) {
    if (val === undefined) continue;
    lines.push(`  ${k}: ${ser(val, 1)},`);
  }
  const abilitiesField = abilityNames.length ? `[${abilityNames.join(', ')}]` : '[]';
  lines.push(`  abilities: ${abilitiesField},`);
  lines.push(`  ruleRefs: ${ser(ruleRefs, 1)},`);

  body += `export const ${id}: CardDef = {\n${lines.join('\n')}\n};\n`;

  return { id, pkg: r.pkg, file: header + body };
}

function main() {
  const specsPath = process.argv[2];
  const write = process.argv.includes('--write');
  if (!specsPath) {
    console.error('usage: node scripts/taskA-codegen.cjs <specs.json> [--write]');
    process.exit(1);
  }
  const specs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
  const cat = loadCatalog();
  const results = [];
  for (const spec of specs) {
    if (spec.verdict !== 'green') continue;
    if (spec.needsManual) { console.error(`skip (needsManual): ${spec.rep} — ${spec.manualReason || ''}`); continue; }
    const { id, pkg, file } = genFile(spec, cat);
    const dir = path.join(SRC_CARDS, pkg);
    const outPath = path.join(dir, `${id}.ts`);
    results.push({ id, pkg, outPath, file });
    if (write) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, file);
    }
  }
  console.error(`${write ? 'wrote' : 'would write'} ${results.length} files`);
  if (!write && results.length) {
    console.log('=== DRY RUN: first file ===');
    console.log(results[0].file);
  }
  // emit registration helper (imports + array entries) to stdout-json on demand
  if (write) {
    const reg = results.map((r) => ({ id: r.id, pkg: r.pkg }));
    fs.writeFileSync(path.join(__dirname, '..', '.tmp-taskA-registered.json'), JSON.stringify(reg, null, 1));
  }
}

main();
module.exports = { genFile, loadCatalog, splitColors };
