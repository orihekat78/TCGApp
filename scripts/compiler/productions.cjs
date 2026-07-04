// Track B compiler — production rule 集 (whitelist 文法)。
//
// rule 形状 (compile.cjs 契約):
//   { name: string,                          // 一意名 (レポート/レビュー用)
//     match: (seg, entry) => bool,           // 句が本 rule に一致するか (seg = {col, text})
//     emit:  (seg, entry) => {abilities?: AbilityDef[], keywords?: string[]} }
//   { name, refuseEntry: (entry) => string|false }  // card 単位の恒久 refuse (例外リスト)
//
// 登録原則:
//   - 1 rule = 出荷済 primitive の文言パターン 1 つ (exemplar カードを根拠に持つこと)
//   - 裁定テーブル (「〜まで」=0可 rules/15 / colorNot some説 B08079 / deck-look 型別 rules/26)
//     は rule 内にエンコードし、rule コメントに出典を明記する
//   - 未知句を部分推測で埋める rule は禁止 (compile 側が card 全体 refuse で止める前提を壊さない)
//
// B1 の主力 = mined 行 rule (rules/line-rules.json):
//   shipped CardDef の AbilityDef.description ⇔ 印字行 の突合せ (mine.cjs、全決定論) で採掘した
//   「行 key → 意味射影 ability / keywords」の exact 対応表。AI の即興翻訳は一切含まない —
//   全 rule が shipped exemplar (実機 vitest/smoke を通過済みの実装) を根拠に持つ。
//   同一 key に複数意味が観測された場合 (conflict) は mine.cjs が rule 化を拒否している。
const fs = require('fs');
const path = require('path');
const { lineKey, colKey } = require('./norm.cjs');

const RULES_DIR = path.join(__dirname, 'rules');

// ---- 手書き rule: パートナー共通能力 (定型文 → DSL なし) ----
// 出典: rules/01-victory-conditions.md (事件解決) / rules/13-keywords.md (全パートナー共通能力)。
// アシスト/事件解決は engine 骨格 (flow) がハードコード実装しており CardDef.abilities に DSL 化しない
// (shipped 実測: 全 partner の共通能力行は abilities=[] — B01001 等)。
const PARTNER_BOILERPLATE = new Set([
  '【解決編】【事件解決】【スリープ】：自分の証拠が事件レベルの数以上ある場合、ゲームに勝利する。',
  '【アシスト】【スリープ】：FILEエリアに移動する。自分のFILEエリアにカードが7枚以上ある場合、事件を解決編にする。',
]);

const partnerBoilerplateRule = {
  name: 'partner-common-boilerplate',
  match: (seg, entry) => entry.kind === 'partner' && PARTNER_BOILERPLATE.has(lineKey(seg.text)),
  emit: () => ({}),
};

// ---- mined 行 rule (line-rules.json) ----
function loadMinedLineRules() {
  const file = path.join(RULES_DIR, 'line-rules.json');
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map(data.rules.map((r) => [r.key, r]));
  // key = kind|col|lineKey — 同一文言でも kind/col が違えば別 rule (over-general match の防止)。
  // 列全体 rule (複数行 1 能力) は COLSPAN namespace で分離。
  const keyOf = (seg, entry) =>
    seg.colSpan ? `${entry.kind}|${seg.col}|COLSPAN|${colKey(seg.text)}` : `${entry.kind}|${seg.col}|${lineKey(seg.text)}`;
  return {
    name: 'mined-line-rules',
    match: (seg, entry) => map.has(keyOf(seg, entry)),
    emit: (seg, entry) => {
      const r = map.get(keyOf(seg, entry));
      if (r.keywords) return { keywords: r.keywords };
      if (r.abilities) return { abilities: r.abilities }; // 1 行複数能力 (icon 併記行、B02044 型)
      return { abilities: [r.ability] };
    },
  };
}

// ---- 例外リスト (exceptions.json) ----
// mined 文法では shipped 実装を再現できないカード (composition が意味不一致になる系) の恒久 refuse。
// mine.cjs が oracle dry-run の mismatch から決定論的に生成する — silent 誤訳をカード単位で封じる。
function loadExceptions() {
  const file = path.join(RULES_DIR, 'exceptions.json');
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = new Map(data.cards.map((c) => [c.id, c.reason]));
  return {
    name: 'composition-exceptions',
    refuseEntry: (entry) => ids.get(entry.id) || false,
  };
}

// ---- B4 param 行 rule (param-rules.json) ----
// exact 行 rule の slot 汎化 (数値/色/カード名/特徴)。exemplar 間の共変 path 積集合を根拠に持ち、
// param-mine.cjs の検証 pass (全 exact rule の再現 + purge) を通過した rule のみ収載。
// loadProductions 順で mined-line-rules の **後** に置く = exact 一致が常に優先、param は
// 「既知 template × 未知 slot 値の組」のみ担当する。
function loadParamRules() {
  const file = path.join(RULES_DIR, 'param-rules.json');
  if (!fs.existsSync(file)) return null;
  const { extractSlots, instantiate } = require('./param.cjs');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map(data.rules.map((r) => [`${r.kind}|${r.col}|${r.template}`, r]));
  const lookup = (seg, entry) => {
    if (seg.colSpan) return null;
    const { template, slots } = extractSlots(lineKey(seg.text));
    const r = map.get(`${entry.kind}|${seg.col}|${template}`);
    if (!r) return null;
    if (slots.length !== r.slotTypes.length) return null;
    if (!slots.every((s, j) => s.type === r.slotTypes[j])) return null;
    return { r, slots };
  };
  return {
    name: 'param-line-rules',
    match: (seg, entry) => lookup(seg, entry) !== null,
    emit: (seg, entry) => {
      const { r, slots } = lookup(seg, entry);
      return { abilities: [instantiate(r, slots, seg.text)] };
    },
  };
}

function loadProductions() {
  const rules = [];
  const exceptions = loadExceptions();
  if (exceptions) rules.push(exceptions);
  rules.push(partnerBoilerplateRule);
  const mined = loadMinedLineRules();
  if (mined) rules.push(mined);
  const param = loadParamRules();
  if (param) rules.push(param);
  return rules;
}

module.exports = { loadProductions, PARTNER_BOILERPLATE };
