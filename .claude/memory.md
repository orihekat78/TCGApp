# 作業ログ — 名探偵コナンTCG プロジェクト

直近セッションの詳細は日次ログへローテート済:

- [.claude/sessions/2026-06-05.md](sessions/2026-06-05.md) — Engine 拡張 batch #1〜#5
  (engine 変更 0、ALL_CARDS 859→933、最新 commit a8aa42c4)
- [.claude/sessions/2026-06-05-2.md](sessions/2026-06-05-2.md) — カード text-faithfulness 監査
  (Playwright 実機検証 + 多エージェント監査 workflow)。BUG-117/118/119/120/121 の engine バグ
  5 系統を検出・修正 (`427a4754`/`b3885daf`/`f5437e9f`/`c410db60` push 済)
- [.claude/sessions/2026-06-06.md](sessions/2026-06-06.md) — BUG-121 残課題の全解消
  (sequence 内 choice 汎用化 / bug-077 flaky 解消 / suspect 全検証) + Playwright text-faithfulness
  検査の規約化 + 教訓ファイル更新運用の明文化 (LESSONS-LEARNED-3.md)
- [.claude/sessions/2026-06-06-2.md](sessions/2026-06-06-2.md) — タスク B (text-faithfulness 監査 横展開)。
  engine フィルタ評価経路の全数突合 + 多エージェント監査 (358 枚) → BUG-122 (icon-keyword:
  filter.keyword がアイコン能力未検出 / B05112) + BUG-123 (kind:'character' 欠落で event 混入 /
  B01094・B09044) 検出・修正。教訓 26
- [.claude/sessions/2026-06-06-3.md](sessions/2026-06-06-3.md) — タスク E (BUG-083 = throw 解消済を確認・
  test 追加) + C #1 (reasoning hook 解禁: reasoning:end を card-triggerable 化 + B01017/B01074。
  ALL_CARDS 935)。次は C 残 (reasoning 残 ~13 / disguise / event→evidence / look-top-N) → A → D
- [.claude/sessions/2026-06-06-4.md](sessions/2026-06-06-4.md) — C disguise-hook 解禁 (1ユニット, commit c15ad259):
  disguise:into を TRIGGERED_HOOKS 追加 (additive) + canDisguise に変装ゲート条件 (caseColor/fileAtLeast) 評価。
  カード D06012/B03129/B02045。ALL_CARDS 938。+ **BUG-124** (commit 9a36b166, review 水平展開検出): caseTrait が
  caseTraits 未参照の field-drop を union 修正。vitest 1818 pass 回帰0 / e2e (disguise 2 + case-trait 4) pass。
  次は C 残 (event→evidence / reasoning 残 ~11) → A (engine変更0 大量) → D

次セッション kickoff: [.claude/NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md)
