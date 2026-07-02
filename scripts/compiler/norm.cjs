// Track B compiler — 共有正規化 (B1)。
// 印字テキストの行分割と rule key 正規化。compile (変換時) と mine (採掘時) が同一関数を使うことで
// key の再現性を担保する。
//
// 括弧注記の扱い (2026-07-02 B1 設計判断):
//   公式テキストの （…） / (…) は注釈 (reminder text) — corpus 全 58 種 + 半角 1 種を全数目視し、
//   全て隣接効果の説明文と確認 (例: 〚突撃〛（登場したターンからすぐにアクションできる）)。
//   【】icon 内に括弧が現れる例は 0 件 (recon 実測)。よって key 正規化で括弧を全 strip する。
//   shipped 内で「括弧のみが異なり DSL が異なる」ペアが存在すれば mine の conflict 検出が
//   rule 化を拒否する (silent 誤訳にはならない)。

// 行区切り: TSV は改行を literal "\n" (0x5c 0x6e) で持つ (実測 959 列)。<br> 変種 3 列も同扱い。
const LINE_SEP = /\\n|<br>/;

// （…） / (…) 注釈を除去 (入れ子なし — corpus 実測で入れ子 0)。
function stripReminders(s) {
  return s.replace(/（[^（）]*）/g, '').replace(/\([^()]*\)/g, '');
}

// 印字列 → 行配列 (trim 済・空行除去)。
function splitLines(colText) {
  return (colText || '')
    .split(LINE_SEP)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// rule key: 注釈 strip + trim のみ (句読点・全半角はそのまま — 過剰正規化は誤 match の源)。
function lineKey(line) {
  return stripReminders(line).trim();
}

// mining 専用: description ⇔ 印字行 の突合せ用ゆるい正規化。
// shipped の description は「注釈除去 + 文末 。付加」等の揺れがある — key には使わない。
// 列区切り (literal "\n") も除去する (複数行 description の列単位突合せ用)。
function alignNorm(s) {
  return stripReminders(s).replace(/\\n|<br>/g, '').replace(/。$/, '').replace(/\s+/g, '').trim();
}

// colspan rule key: 列の全行 (それぞれ lineKey 正規化) を "\n" で連結。
// 「1 能力の description が複数の印字行にまたがる」カード (B03026 の 2 行カットイン等) 用 —
// per-line rule とは別 namespace (compile は列全体 → 行 の順で lookup する)。
function colKey(colText) {
  return splitLines(colText).map(lineKey).join('\n');
}

module.exports = { splitLines, stripReminders, lineKey, alignNorm, colKey, LINE_SEP };
