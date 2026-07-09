# feat(tooling): hybrid pipeline refuse-2行 対応 — pool 93→218 unit へ拡大 (2026-07-09)

- **prepare.cjs `--max-refusals 2`**: refused 全行を除去して rest compile、twin key を
  「refused 正規化テキスト**集合** (順序不問) + rest deep-equal」に一般化。選定は refusals 数
  昇順 (1行優先) → twin group 大きい順。payload 正準 = `refusedLines[]` (1行時は旧 `refusedLine` も併記)。
- **finish.cjs**: twin 機械証明を集合比較化 (行数一致 + 正規化テキスト sort join 一致 + 全行除去後
  rest deep-equal)。旧 payload (refusedLine 単数) 後方互換。
- **実測**: 2行 pool = **125 unit** が pipeline 対象化 (1行 93 と合計 218 = 未出荷 248 base の 88%)。
  `--n 40 --max-refusals 2` で 1行35 + 2行5 = 47 printings 選定、2行側の twin 即効
  (D06003+3 = 1 unit author → 4 printings、合成 wf_result で finish 集合証明 GREEN 4 specs 実証)。
- gates: tsc0 / genprobe-validation 11/11 / src 変更 0。
