# memory — 現セッション scratchpad

> 過去ログは `.claude/sessions/YYYY-MM-DD.md`。直近 = [2026-06-24.md](sessions/2026-06-24.md) (セッション55〜57)。
> 再開手順は `.claude/NEXT-SESSION-PROMPT.md`。

## 現在地 (2026-06-24 セッション58 完了 — engine additive wave)

- **main = bad13ee4** (docs) ← a206e9dc (engine additive wave) ← 813d0b19 (spec) ← d0bd58c6 (event-choose3 docs)。
  ⚠ a206e9dc = **engine 変更あり (additive)**。push 後 CI in_progress → 開始時 green 確認。
- branch `engine/additive-wave-lvldelta-stuncost-0624` = main 一致。working tree clean (`.claude/design/` ?? 除外)。
- ⚠ auto-docs (structure/mapping/CHANGELOG) 未再生成 (precedent 通り未commit・CI除外)。
- card session は worktree `C:/tmp/conan-cards-w` で並行 (engine/card 分離ゆえ衝突無し)。

## engine additive wave (lvlDelta + stunChar)

- **Gap1 ContinuousModifier.lvlDelta**: apDelta/lpDelta 完全対称。honor=read.char.level + candidates.matchOneFilter
  (BUG-117)。再帰は既存 `_inContinuousDelta` guard が depth-2 終端。B08059/B08050 解禁。
- **Gap3 Cost stunChar**: sleepChar 対称 + **n.max honor で「1枚」faithful**。honor=union/canPay/pay/UI costToText/validate-specs。B08004 解禁。
- **Gap2 carrier-reuse は stale DEFER 訂正 (engine変更0)**: bind:'$picked' 機構は 2026-06-12 出荷済 (BUG-130)、exemplar B02040。B08023 解放。
- 各 gap **opus 敵対 review (4/3 lens) = no-blocker**。pre-existing 欠陥を **BUG-156** (sleepChar/stunChar cost over-pay) /
  **BUG-157** (read.char.ap/lp 無 guard 相互再帰) に記録 (本 wave 非起因、unified 修正は別 commit)。
- gate: tsc0 / eslint+8lint 0err / vitest **3054** / smoke **winsA=498** 不変。test 15件 (lvldelta 9 / stunchar 6)。
- 流儀: brainstorming → spec → TDD(RED→GREEN) → gate → opus 敵対 review workflow → concern 反映 → FF push。実証済。

## 次やること候補 (要ユーザー選択、詳細は NEXT-SESSION-PROMPT)

A) engine additive 続き (scope array B08019 / set-card-removal cost B08033a2 / BUG-156/157 unified) /
B) MR Phase2-4 / C) カード追加 (B08023/B08050/B08059/B08004 解放済) / D) auto-docs sync。
