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
