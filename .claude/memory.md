# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-06-27-sessions58-61.md](sessions/2026-06-27-sessions58-61.md)。
> 再開手順: Track A = `.claude/NEXT-SESSION-PROMPT.md` / Track B = `.claude/NEXT-SESSION-PROMPT-TRACK-B.md`。

## 2026-07-02 Track B session B0 — compiler harness 出荷 (engine 変更 0)

- **B0 完了**: `scripts/compiler/` 6 file (tsv-corpus / canonical / productions / compile / dump-shipped / oracle)
  + `tests/compiler/` 5 file 30 test。詳細 = changelog-entries/2026-07-02-01-compiler-track-b0-harness.md。
- **受入実測**: corpus 2049 (dup 0、vanilla 52) / shipped **1509** (ALL_CARDS unique、closure 249) /
  oracle judged 1509/1509・noCorpus 0・mismatch 0・match 52=vanilla のみ・**text-bearing refuse 率 100%** ✔。
- **棚卸訂正**: 計画値「実装済 1514 / 残 535」→ 実測 **1509 / 540** (ALL_CARDS unique が ground truth)。
- **P variant 発見**: corpus (TSV) は P printing を別行で持つ → shipped P id はほぼ直 hit、baseId fallback は保険。
- gate: tsc0 / vitest 3522→3552 / smoke winsA=498 不変 / 8lint 0err。worktree /c/tmp/conan-compiler-b0 (要撤去)。
- 次 = **B1**: 句分割 (【】〚〛/「:」/「。」) + production rule 集 + 裁定テーブル → G1 (1509 oracle mismatch 0)。
  文法 rule 集へ敵対 review 1 回 (2 lens、T2)。closure 249 枚は match 不能 → refuse 恒久 or 等価形吸収を B1 で設計。

## 2026-07-02 Track B session B1 — 文法 core 出荷 (engine 変更 0)

- **B1 完了**: mine.cjs (desc突合 414 + 消去法 elim 216 + colspan 19 + purge loop、全決定論・AI 翻訳ゼロ) →
  rules/line-rules.json **623 rules** + exceptions.json 9 枚 (elim 起源 rule は match 済 exemplar 必須)。oracle 意味射影化 (semanticCard —
  id/name/description/ruleRefs 除外。根拠: shipped で a1/a2 揺れ・注釈揺れ実測)。
- **G1 達成**: shipped 1509 で **match 1161 (77.0%) / refuse 348 / mismatch 0**。非closure天井 1260 の 92%。
  mined-rules.test.ts が G1 恒常 pin。desc パラフレーズ (~453枚、旧shipped要約記法) は消去法+purge で回収。
- **設計判断**: 括弧注釈は key から全 strip (59 種全数目視、icon 内括弧 0) / closure 249 = 恒久 refuse
  (rule 化不能→手動枠) / 消去法の誤 pairing は oracle dry-run が card 単位検出→ purge が elim 起源 rule 除去。
- **副産物**: conflicts 6 key (shipped 同文言異DSL — 【ヒラメキ】スリープ 3 変種等、B3 裁定 queue) /
  shipped-gap-suspect 27 枚 (印字行に ability 無し = 部分実装疑い) / unshipped 地形 = 未知行1本のみ 214 枚。
- gate: tsc0 / vitest 3552→**3574** / smoke winsA=498 不変 / 8lint errors=0 / 敵対 review 2 lens (opus) — semantic lens が真 BLOCKER 検出 (refuse card 由来 elim rule 未検証 → B08007 幻 AP+1000)、purge 強化 (30 rule 除去、match 無影響) + 合成 fixture 回帰で封止。
- worktree /c/tmp/conan-compiler-b1 (tool/compiler-2)。次 = B1.5 parametric rule → B2 emit (詳細
  NEXT-SESSION-PROMPT-TRACK-B.md)。
