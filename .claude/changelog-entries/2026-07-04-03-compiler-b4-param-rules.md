# feat(compiler): Track B B4 — parametric rule (slot 汎化) + engine 完成後の re-mine

- **日付**: 2026-07-04
- **種別**: compiler ツール (Track B、src/engine 変更 0)

## 内容

engine 骨格凍結後の初 re-mine + 行 rule の slot 汎化 (B4):

- **re-mine**: 出荷 1592 枚 (step12 batch1 込) から exact 行 rule **4 → 717** に更新
  (oracle 再現 match 1152 / mismatch 0)。
- **B4 param rule (新規)**: 行 rule の 数値/色/カード名/特徴 を slot 化し、exemplar 間の
  **共変 JSON path 積集合**で汎化 (scripts/compiler/param.cjs + param-mine.cjs)。
  refuse-first 維持: 共変 path 不在で異値 → group 放棄 / skeleton 構造不一致 → 放棄 /
  検証 pass (全 exact rule の再現、purge 0) / **G1 oracle loop** (shipped 非再現カードは
  exceptions へ自動登録 — B02047/B05045/B05045P/B05056 の 4 枚 = partial 実装 shipped の
  未実装行に param が正しく match した系 = shipped-gap 検出器として機能)。
  compile 時は exact rule 優先、param は「既知 template × 未知 slot 値」のみ担当。
- param rule 569 本 / compiler test 68+9 green (G1 mismatch 0 回帰込)。

## 実測 (自動 compile 率)

- 未実装 482 枚中 compile 可: exact-only 15 → **exact+param 22** (+7: B04093 コルン
  inContact clone / B09070P / PR 系 cutin-only 5枚 ほか)
- **知見: ボトルネックは slot 値でなく句の構造多様性** — 未実装カードの refuse は
  「既知 template の値違い」ではなく新規句の組合せが主因。
- **near-miss 実測: 未知行が 1 行だけのカード = 205/482** — compiler が N-1 行を変換し
  残り 1 行のみ agent author する hybrid pipeline が次の最大レバー (別途設計)。

## 次候補

1. compile 可 22 枚の codegen batch (T0 経路: crosscheck + validate + tsc)
2. near-miss hybrid pipeline (compiler 部分変換 + agent 1 行補完 + 全ゲート)
